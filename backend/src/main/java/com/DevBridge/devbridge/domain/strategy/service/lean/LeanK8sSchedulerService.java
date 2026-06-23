package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import com.DevBridge.devbridge.domain.strategy.repository.LeanJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lean v2 K8s 스케줄러 — 큐(lean_job QUEUED)를 등급 쿼터로 공정 선택({@link LeanScheduler})해
 * K8s Job 으로 디스패치({@link LeanK8sDispatcher}). flag {@code app.lean.k8s.enabled} on 일 때만 동작.
 *
 * <p>결과는 워커 Pod 가 BE 콜백({@code POST /api/lean/jobs/{id}/result})으로 보고 → DONE/ERROR.
 * 콜백 유실/행(Pod 가 콜백 없이 죽음)에 대비해 매 틱 {@link #reconcile()} 로 deadline+grace 초과 잡을
 * ERROR 로 마감(시간 기반 백스톱). K8s Job.status 기반 정밀 재조정은 follow-up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeanK8sSchedulerService {

    private final LeanJobRepository repo;
    private final LeanQuotaPolicy quota;
    private final LeanK8sProperties props;
    private final LeanK8sDispatcher dispatcher;
    private final LeanJobManifestRenderer renderer;

    private static final List<String> RUNNINGISH = List.of("DISPATCHED", "RUNNING");
    /** deadline(등급 timeout) 이후 결과 콜백을 기다려 주는 여유. 초과하면 유실로 보고 ERROR 마감. */
    private static final int RECONCILE_GRACE_SEC = 120;

    @Scheduled(fixedDelay = 4000L, initialDelay = 15000L)
    public void tick() {
        if (!props.isEnabled()) return;
        try {
            dispatch();
        } catch (Exception e) {  // noqa
            log.warn("[k8s-sched] tick(dispatch) 오류: {}", e.getMessage());
        }
        try {
            reconcile();
        } catch (Exception e) {  // noqa
            log.warn("[k8s-sched] tick(reconcile) 오류: {}", e.getMessage());
        }
    }

    /**
     * 재조정 — RUNNINGISH 잡 상태 수렴. (1) K8s Job.status 정밀 재조정(실패→ERROR·활성→RUNNING),
     * (2) 시간 기반 백스톱(deadline+grace 초과 = 콜백 유실/행 → ERROR). 큐/쿼터가 막히지 않게 한다.
     */
    void reconcile() {
        List<LeanJob> runningish = repo.findByStatusInOrderByCreatedAtAsc(RUNNINGISH);
        if (runningish.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();

        // (1) 시간 기반 백스톱 — deadline+grace 초과 = 콜백 유실/행 추정.
        List<LeanJob> stuck = LeanScheduler.findTimedOut(
                runningish,
                j -> j.getDispatchedAt() != null ? j.getDispatchedAt() : j.getCreatedAt(),
                t -> props.resourcesFor(t).timeoutSec(),
                RECONCILE_GRACE_SEC, now);
        Set<Long> closed = new HashSet<>();
        for (LeanJob j : stuck) {
            j.setStatus("ERROR");
            j.setError("timeout/lost: K8s 결과 콜백 미수신 (deadline+" + RECONCILE_GRACE_SEC + "s 초과)");
            j.setFinishedAt(now);
            repo.save(j);
            closed.add(j.getId());
            log.warn("[k8s-sched] reconcile job {} → ERROR (콜백 유실 추정, deadline+{}s 초과)", j.getId(), RECONCILE_GRACE_SEC);
        }

        // (2) K8s Job.status 정밀 재조정 — 백스톱에 안 걸린 잡을 kubectl 로 조회해 빠르게 수렴.
        for (LeanJob j : runningish) {
            if (closed.contains(j.getId())) continue;
            LeanK8sDispatcher.JobPhase ph = dispatcher.jobPhase(j.getWorkerId(), j.getWorkerJobId());
            if (!ph.found()) continue;   // ttl 삭제·조회 실패 → 콜백/백스톱에 위임
            String decision = LeanScheduler.reconcileFromK8s(ph.failed(), ph.active(), j.getStatus());
            if ("ERROR".equals(decision)) {
                j.setStatus("ERROR");
                j.setError("K8s Job 실패(status.failed=" + ph.failed() + ")");
                j.setFinishedAt(now);
                repo.save(j);
                log.warn("[k8s-sched] reconcile job {} → ERROR (K8s Job failed)", j.getId());
            } else if ("RUNNING".equals(decision)) {
                j.setStatus("RUNNING");
                if (j.getStartedAt() == null) j.setStartedAt(now);
                repo.save(j);
            }
        }
    }

    /** QUEUED 잡을 등급 쿼터+전역캡 안에서 공정 선택 → K8s Job 생성 → DISPATCHED. */
    void dispatch() {
        List<LeanJob> queued = repo.findByStatusOrderByCreatedAtAsc("QUEUED");
        if (queued.isEmpty()) return;

        Map<Long, Integer> running = new HashMap<>();
        for (var uc : repo.countRunningByUser(RUNNINGISH)) {
            running.put(uc.getUserId(), uc.getCnt().intValue());
        }
        int global = (int) repo.countByStatusIn(RUNNINGISH);

        List<LeanJob> picked = LeanScheduler.pickDispatchable(
                queued, running, global, quota::maxConcurrentFor, quota.globalCap());

        for (LeanJob j : picked) {
            try {
                String jobName = dispatcher.dispatch(j);     // ns+quota 보장 + Job apply
                j.setStatus("DISPATCHED");
                j.setWorkerId(renderer.namespaceFor(j));      // 테넌트 네임스페이스
                j.setWorkerJobId(jobName);                    // K8s Job 이름
                j.setDispatchedAt(LocalDateTime.now());
                repo.save(j);
                log.info("[k8s-sched] dispatched job={} → ns={} k8sJob={}", j.getId(), j.getWorkerId(), jobName);
            } catch (Exception e) {  // noqa
                log.warn("[k8s-sched] dispatch job {} 실패(큐 유지·다음 틱 재시도): {}", j.getId(), e.getMessage());
            }
        }
    }
}
