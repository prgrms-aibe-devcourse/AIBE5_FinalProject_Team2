package com.DevBridge.devbridge.domain.ai.controller;

import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.ai.service.AlphaHelixService;
import com.DevBridge.devbridge.domain.ai.service.BriefingQuotaPolicy;
import com.DevBridge.devbridge.domain.ai.repository.AiUsageLogRepository;
import com.DevBridge.devbridge.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.CompletableFuture;

/**
 * Alpha-Helix Analytics Pipeline.
 * ─ POST /api/alpha/workspaces/{id}/backtest
 * ─ POST /api/alpha/workspaces/{id}/regime
 * ─ POST /api/alpha/workspaces/{id}/trust
 * ─ POST /api/alpha/workspaces/{id}/queue-orders
 * ─ POST /api/alpha/workspaces/{id}/auto-run
 * ─ POST /api/alpha/workspaces/{id}/briefing
 */
@Slf4j
@RestController
@RequestMapping("/api/alpha")
@RequiredArgsConstructor
public class AlphaAnalyticsController {

    private final AlphaHelixService svc;
    private final AiUsageLogRepository usageRepo;
    private final BriefingQuotaPolicy briefingQuota;

    // ─────────────────────────────────────────── Backtest

    @PostMapping("/workspaces/{id}/backtest")
    public ResponseEntity<?> backtest(
            @PathVariable Long id,
            @RequestParam(value = "period", required = false) String period,
            @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        var ws = wsOpt.get();
        if (ws.getStrategyConfigJson() == null) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", "먼저 /formalize로 전략을 정형화하세요"));
        }
        try {
            String periodFinal = (body != null && body.containsKey("period"))
                    ? (String) body.get("period") : period;
            Map<String, Object> customParams = new java.util.HashMap<>();
            if (body != null && body.get("customParams") instanceof Map<?, ?> cp) {
                @SuppressWarnings("unchecked")
                Map<String, Object> cpm = (Map<String, Object>) cp;
                customParams.putAll(cpm);
            }
            // 직접 지정(달력) 기간 — 시드계산기와 같은 selector 공유
            if (body != null && body.get("start") != null) customParams.put("start", body.get("start"));
            if (body != null && body.get("end") != null) customParams.put("end", body.get("end"));
            // quiet=true: 최적화 스윕 중간 실행 — 알림·개선제안서 생략
            boolean quiet = body != null && Boolean.TRUE.equals(body.get("quiet"));
            String json = svc.doBacktest(ws, periodFinal, customParams, quiet);

            // 백테스트 완료 후 개선 제안서 자동 생성 (비동기 — 응답 블로킹 없음, 1시간 쿨다운)
            // quiet=true 이면 최적화 중간 실행이므로 개선 제안서도 생략
            if (!quiet) {
                final var wsFinal = ws;
                final Long uidFinal = uid;
                final String pFinal = periodFinal;
                final Map<String, Object> cpFinal = new java.util.HashMap<>(customParams);
                boolean improveOnCooldown = wsFinal.getLastImproveAt() != null &&
                        wsFinal.getLastImproveAt().isAfter(java.time.LocalDateTime.now().minusHours(IMPROVE_COOLDOWN_HOURS));
                if (!improveOnCooldown) {
                    CompletableFuture.runAsync(() -> {
                        try {
                            svc.doImproveProposal(wsFinal, uidFinal, pFinal, cpFinal);
                            wsFinal.setLastImproveAt(java.time.LocalDateTime.now());
                            svc.getWorkspaceRepo().save(wsFinal);
                        } catch (Exception ex) {
                            log.warn("[auto improve-proposal] ws={} {}", id, ex.getMessage());
                        }
                    });
                }
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        } catch (Exception e) {
            log.error("backtest fail", e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ─────────────────────────────────────────── P3: 개선 제안서

    /** 전략 개선 제안서 — 진단 + 선택지(기존/안정형/공격형) + 각 선택지 전후 백테스트 비교. */
    @PostMapping("/workspaces/{id}/improve-proposal")
    public ResponseEntity<?> improveProposal(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        var ws = wsOpt.get();
        if (ws.getLastImproveAt() != null &&
                ws.getLastImproveAt().isAfter(java.time.LocalDateTime.now().minusHours(IMPROVE_COOLDOWN_HOURS))) {
            long remainMin = java.time.Duration.between(
                    java.time.LocalDateTime.now(),
                    ws.getLastImproveAt().plusHours(IMPROVE_COOLDOWN_HOURS)).toMinutes() + 1;
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "개선 제안서는 1시간에 1회 생성 가능합니다.",
                            "cooldown", true, "remainMinutes", remainMin));
        }
        try {
            String period = body != null && body.get("period") != null ? String.valueOf(body.get("period")) : null;
            @SuppressWarnings("unchecked")
            Map<String, Object> customParams = (body != null && body.get("customParams") instanceof Map)
                    ? (Map<String, Object>) body.get("customParams") : Map.of();
            Map<String, Object> result = svc.doImproveProposal(ws, uid, period, customParams);
            ws.setLastImproveAt(java.time.LocalDateTime.now());
            svc.getWorkspaceRepo().save(ws);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("improve-proposal fail ws={}", id, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    /** P4: Claude 패치(또는 임의 전후) 효과를 같은 비교 포맷으로 측정 — before/after 파라미터 각각 실측 백테스트. */
    @PostMapping("/workspaces/{id}/compare-backtest")
    public ResponseEntity<?> compareBacktest(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> before = (body != null && body.get("before") instanceof Map)
                    ? (Map<String, Object>) body.get("before") : Map.of();
            @SuppressWarnings("unchecked")
            Map<String, Object> after = (body != null && body.get("after") instanceof Map)
                    ? (Map<String, Object>) body.get("after") : Map.of();
            String period = body != null && body.get("period") != null ? String.valueOf(body.get("period")) : null;
            return ResponseEntity.ok(svc.doCompareBacktest(wsOpt.get(), before, after, period));
        } catch (Exception e) {
            log.error("compare-backtest fail ws={}", id, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ─────────────────────────────────────────── Regime

    @PostMapping("/workspaces/{id}/regime")
    public ResponseEntity<?> regime(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        try {
            String json = svc.doRegime(wsOpt.get(), body);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ─────────────────────────────────────────── Trust

    @PostMapping("/workspaces/{id}/trust")
    public ResponseEntity<?> trust(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        try {
            String json = svc.doTrust(wsOpt.get(), body);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ─────────────────────────────────────────── Queue Orders

    @PostMapping("/workspaces/{id}/queue-orders")
    public ResponseEntity<?> queueOrders(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        var ws = wsOpt.get();
        if (ws.getStrategyConfigJson() == null) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", "전략 정형화가 먼저 필요합니다"));
        }
        // IDE 가 보낸 현재 전략(프리셋 lean→vbt 매핑 또는 __unsupported__:id). 없으면 cfg.strategy_type 라우팅.
        String presetOverride = (body != null && body.get("strategy") != null)
                ? String.valueOf(body.get("strategy")) : null;
        try {
            Map<String, Object> resp = svc.doQueueOrders(ws, uid, presetOverride);
            return ResponseEntity.ok(resp);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        } catch (Exception e) {
            log.error("queue-orders fail", e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    // ─────────────────────────────────────────── Auto-Run

    @PostMapping("/workspaces/{id}/auto-run")
    public ResponseEntity<?> autoRun(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        // 선행 조건: goalProfile 필요
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        if (wsOpt.get().getGoalProfileJson() == null) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("error", "먼저 AI 채팅으로 목표를 정의하세요"));
        }
        try {
            Map<String, Object> report = svc.doAutoRun(id, uid);
            return ResponseEntity.ok(report);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("auto-run fail", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // ─────────────────────────────────────────── Briefing

    private static final long BRIEFING_COOLDOWN_HOURS = 7;
    private static final long IMPROVE_COOLDOWN_HOURS = 1;

    @PostMapping("/workspaces/{id}/briefing")
    public ResponseEntity<?> briefing(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        var wsOpt = svc.getWorkspaceRepo().findByIdAndUserId(id, uid);
        if (wsOpt.isEmpty()) return ResponseEntity.notFound().build();
        var ws = wsOpt.get();
        // ① 워크스페이스별 쿨다운 (새로고침 간격) — 7시간
        if (ws.getLastBriefingAt() != null &&
                ws.getLastBriefingAt().isAfter(java.time.LocalDateTime.now().minusHours(BRIEFING_COOLDOWN_HOURS))) {
            long remainMin = java.time.Duration.between(
                    java.time.LocalDateTime.now(),
                    ws.getLastBriefingAt().plusHours(BRIEFING_COOLDOWN_HOURS)).toMinutes() + 1;
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "브리핑은 " + BRIEFING_COOLDOWN_HOURS + "시간에 1회 생성 가능합니다.",
                            "cooldown", true, "remainMinutes", remainMin));
        }
        // ② 구독등급별 하루 LIVE 브리핑 총 횟수 (FREE1/STD2/PREM4/EXP7) — 유저 단위, KST 자정 리셋
        User.UserType ut = svc.getUserRepo().findById(uid).map(User::getUserType).orElse(User.UserType.FREE);
        int dailyLimit = briefingQuota.dailyLimitFor(ut);
        if (dailyLimit <= 0) {  // FREE — LIVE 브리핑 미제공 (Perplexity 호출 전 차단 → 비용 0)
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "LIVE 브리핑은 STANDARD 등급 이상부터 이용할 수 있어요.",
                            "quotaExceeded", true, "dailyLimit", 0, "usedToday", 0));
        }
        java.time.LocalDateTime todayStart = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).atStartOfDay();
        long usedToday = usageRepo.countBriefingsSince(uid, todayStart);
        // 일일 Perplexity 한도 소진 시: 차단 대신 Gemini 간략 브리핑으로 다운그레이드(degraded). Gemini 는 quota 에 안 셈.
        boolean degraded = usedToday >= dailyLimit;
        try {
            Map<String, Object> resp = new java.util.HashMap<>(svc.doBriefing(ws, uid, degraded));
            ws.setLastBriefingAt(java.time.LocalDateTime.now());
            svc.getWorkspaceRepo().save(ws);
            resp.put("dailyLimit", dailyLimit);
            if (degraded) {
                resp.put("degraded", "gemini");
                resp.put("usedToday", usedToday);   // Gemini 다운그레이드는 한도 미차감
            } else {
                resp.put("usedToday", usedToday + 1);
            }
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("briefing fail ws={}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "브리핑 생성 실패"));
        }
    }

    private static ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증 필요"));
    }
}
