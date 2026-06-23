package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 부하 최소화 스케줄링 코어 — <b>순수 함수</b>(상태/DB 의존 없음 → 단위테스트 용이).
 *
 * <p>큐(오래된 순)에서 지금 배정 가능한 잡을 고른다. 규칙:
 * <ul>
 *   <li><b>등급별 동시 한도</b>: 각 테넌트(유저)는 자기 등급 한도까지만 동시에 돈다(독식 방지·격리).</li>
 *   <li><b>전역 캡</b>: 전체 동시 실행이 캡을 넘지 않게 한다(서버 과부하 방지 = 백프레셔).</li>
 *   <li><b>공정(기아 방지)</b>: 오래된 순으로 훑되, 한도에 찬 테넌트는 건너뛰어 다른 테넌트가 통과.</li>
 * </ul>
 * 한도를 못 넘는 잡은 큐에 남아 다음 틱을 기다린다(=대기, 거부 아님).
 */
public final class LeanScheduler {

    private LeanScheduler() {}

    /**
     * @param queuedOldestFirst QUEUED 잡(생성 오래된 순)
     * @param runningByUser      유저별 현재 동시 실행 수(DISPATCHED+RUNNING)
     * @param globalRunning      전체 현재 동시 실행 수
     * @param tierCap            등급 → 동시 한도 (보통 {@link LeanQuotaPolicy#maxConcurrentFor})
     * @param globalCap          전역 동시 캡
     * @return 이번 틱에 배정할 잡들(큐 순서 유지)
     */
    public static List<LeanJob> pickDispatchable(
            List<LeanJob> queuedOldestFirst,
            Map<Long, Integer> runningByUser,
            int globalRunning,
            Function<String, Integer> tierCap,
            int globalCap) {
        List<LeanJob> picked = new ArrayList<>();
        if (queuedOldestFirst == null || queuedOldestFirst.isEmpty()) return picked;
        Map<Long, Integer> run = new HashMap<>(runningByUser == null ? Map.of() : runningByUser);
        int gr = globalRunning;
        for (LeanJob j : queuedOldestFirst) {
            if (gr >= globalCap) break;                         // 전역 캡 도달 → 백프레셔(이번 틱 종료)
            int cap = tierCap.apply(j.getTier());
            if (cap <= 0) continue;                             // FREE 등 미허용 등급 → 영구 스킵
            int userRun = run.getOrDefault(j.getUserId(), 0);
            if (userRun < cap) {                                // 등급 한도 여유 → 배정
                picked.add(j);
                run.put(j.getUserId(), userRun + 1);
                gr++;
            }
            // userRun >= cap : 이 테넌트는 한도 초과 → 스킵(다음 테넌트 통과, 독식 방지)
        }
        return picked;
    }

    /**
     * 콜백 유실/행(hang) 안전망 — DISPATCHED/RUNNING 잡 중 deadline+grace 를 넘긴 것을 고른다.
     *
     * <p>정상 경로는 워커 Pod 의 결과 콜백이지만, Pod 가 콜백 없이 죽으면(OOM·노드 장애 등) 잡이
     * 영원히 RUNNINGISH 로 남아 쿼터/전역캡을 잠근다. 이 함수가 고른 잡을 호출부가 ERROR 로 마감해
     * 큐가 막히지 않게 한다. (K8s Job.status 기반 정밀 재조정은 follow-up — 이건 시간 기반 백스톱.)
     *
     * @param startOf        잡의 기준 시각(보통 dispatchedAt, 없으면 createdAt)
     * @param timeoutSecFor  등급 → Job activeDeadlineSeconds
     * @param graceSec       deadline 이후 콜백 도착 여유
     * @param now            현재 시각
     */
    public static List<LeanJob> findTimedOut(
            List<LeanJob> runningish,
            Function<LeanJob, java.time.LocalDateTime> startOf,
            Function<String, Integer> timeoutSecFor,
            int graceSec,
            java.time.LocalDateTime now) {
        List<LeanJob> out = new ArrayList<>();
        if (runningish == null) return out;
        for (LeanJob j : runningish) {
            java.time.LocalDateTime start = startOf.apply(j);
            if (start == null) continue;
            int timeout = timeoutSecFor.apply(j.getTier());
            if (timeout <= 0) continue;
            if (now.isAfter(start.plusSeconds((long) timeout + graceSec))) out.add(j);
        }
        return out;
    }

    /**
     * K8s Job.status 기반 정밀 재조정 결정(순수) — 시간 백스톱({@link #findTimedOut})을 보완.
     * 워커 콜백이 결과의 진실원천이지만, K8s 가 직접 보고하는 실패/활성으로 상태를 더 빨리 수렴시킨다.
     *
     * <ul>
     *   <li>{@code failed > 0} → {@code "ERROR"} : Pod 가 실패(콜백이 안 와도 실패 확정).</li>
     *   <li>{@code active > 0 && DISPATCHED} → {@code "RUNNING"} : Pod 가 돌기 시작(표시 갱신).</li>
     *   <li>그 외 → {@code null} : 변경 없음. 성공/결과는 콜백이 진실원천, 그 유실은 백스톱이 담당.</li>
     * </ul>
     * (성공을 여기서 DONE 으로 올리지 않는 이유: 결과 JSON 은 콜백에만 있어 여기서 마감하면 결과를 잃는다.)
     */
    public static String reconcileFromK8s(int failed, int active, String currentStatus) {
        if (failed > 0) return "ERROR";
        if (active > 0 && "DISPATCHED".equals(currentStatus)) return "RUNNING";
        return null;
    }
}
