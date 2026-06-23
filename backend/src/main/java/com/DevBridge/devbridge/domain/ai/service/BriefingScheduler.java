package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.ai.entity.AlphaWorkspace;
import com.DevBridge.devbridge.domain.ai.repository.AlphaWorkspaceRepository;
import com.DevBridge.devbridge.domain.ai.repository.AiUsageLogRepository;
import com.DevBridge.devbridge.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * LIVE 대표 전략 자동 브리핑 스케줄러.
 *
 * <p>미국장 개장(09:30 ET) + 2시간 = <b>11:30 ET</b>, 평일에 각 사용자의 <b>대표 LIVE 1개</b>만
 * 하루 1회 자동 브리핑한다. 비용 통제를 위해:
 * <ul>
 *   <li><b>STANDARD 이상</b>만 대상 (FREE 는 자동 브리핑 없음 — {@link BriefingQuotaPolicy})</li>
 *   <li>사용자당 LIVE 가 여러 개여도 <b>1개(대표)</b>만 브리핑 — 과거엔 LIVE 전체를 돌려 비용·횟수 폭증</li>
 *   <li>그 날 이미 일일 횟수를 쓴 사용자(브리핑 탭에서 직접 생성 등)는 스킵 — 중복 과금 방지</li>
 * </ul>
 *
 * <p>대표 워크스페이스는 클라이언트(localStorage)에 보관되므로 서버는 알 수 없어,
 * <b>가장 최근 LIVE(=id 최대)</b>를 대표로 근사한다. 사용자가 브리핑 탭을 열면 실제 대표가 우선 생성된다.
 *
 * <p>{@code app.briefing.auto-enabled=false} 로 전체를 끌 수 있다. 모델 기본 sonar(저비용).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BriefingScheduler {

    private final AlphaWorkspaceRepository wsRepo;
    private final AlphaHelixService svc;
    private final AiUsageLogRepository usageRepo;
    private final BriefingQuotaPolicy briefingQuota;

    @Value("${app.briefing.auto-enabled:true}")
    private boolean autoEnabled;

    /** 사용자 간 간격(ms) — Perplexity 레이트/비용 완화. */
    @Value("${app.briefing.auto-gap-ms:800}")
    private long gapMs;

    @Scheduled(cron = "0 30 11 * * MON-FRI", zone = "America/New_York")
    public void autoLiveBriefing() {
        if (!autoEnabled) {
            log.info("[BriefingScheduler] 자동 브리핑 비활성(app.briefing.auto-enabled=false) — 스킵");
            return;
        }
        List<AlphaWorkspace> liveWs = wsRepo.findByStatusInFetchUser(List.of("LIVE")); // user 즉시 fetch (N+1 제거)
        if (liveWs.isEmpty()) {
            log.info("[BriefingScheduler] 11:30 ET — LIVE 워크스페이스 없음, 스킵");
            return;
        }
        // 사용자별 대표 LIVE 1개만 선정 (가장 최근 LIVE = id 최대 를 대표로 근사)
        Map<Long, AlphaWorkspace> repByUser = new LinkedHashMap<>();
        for (AlphaWorkspace ws : liveWs) {
            if (ws.getUser() == null) continue;
            Long uid = ws.getUser().getId();
            AlphaWorkspace cur = repByUser.get(uid);
            if (cur == null || ws.getId() > cur.getId()) repByUser.put(uid, ws);
        }
        LocalDateTime todayStart = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay();
        log.info("[BriefingScheduler] 11:30 ET 자동 브리핑 — 대상 사용자 {}명 (LIVE {}개 중)", repByUser.size(), liveWs.size());
        int ok = 0, fail = 0, skip = 0;
        for (Map.Entry<Long, AlphaWorkspace> e : repByUser.entrySet()) {
            Long uid = e.getKey();
            AlphaWorkspace ws = e.getValue();
            try {
                User.UserType ut = ws.getUser().getUserType(); // fetch join 으로 추가 쿼리 없음
                int limit = briefingQuota.dailyLimitFor(ut);
                if (limit <= 0) { skip++; continue; }                                              // FREE — 자동 없음
                if (usageRepo.countBriefingsSince(uid, todayStart) >= limit) { skip++; continue; } // 이미 소진(중복 과금 방지)
                svc.doBriefing(ws, uid);
                ws.setLastBriefingAt(LocalDateTime.now());
                wsRepo.save(ws);
                ok++;
                if (gapMs > 0) Thread.sleep(gapMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ex) {
                fail++;
                log.warn("[BriefingScheduler] uid={} ws={} 자동 브리핑 실패: {}", uid, ws.getId(), ex.getMessage());
            }
        }
        log.info("[BriefingScheduler] 완료 — 성공 {} / 실패 {} / 스킵 {}", ok, fail, skip);
    }
}
