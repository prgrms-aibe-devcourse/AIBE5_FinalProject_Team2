package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import com.DevBridge.devbridge.domain.strategy.repository.LeanJobRepository;
import com.DevBridge.devbridge.domain.strategy.service.lean.LeanQuotaPolicy;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.domain.user.service.FeatureAccessService;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lean v2 멀티테넌트 컨트롤 플레인 API — 제출/상태/결과콜백.
 *
 * <p>제출 시 {@code lean_job}(QUEUED, tier 스냅샷)을 만든다. 스케줄러(P2)가 등급 쿼터로 골라
 * K8s Job 으로 디스패치(K3)하고, 워커 Pod 가 완료 시 결과 콜백({@code /jobs/{id}/result})으로 보고한다.
 * 기존 {@link LeanBacktestController}(직접 analytics 프록시)와 공존 — 이쪽은 큐/테넌트 경유 경로.
 */
@RestController
@RequestMapping("/api/lean")
@RequiredArgsConstructor
@Slf4j
public class LeanJobController {

    private final LeanJobRepository jobRepo;
    private final UserRepository userRepo;
    private final FeatureAccessService access;
    private final LeanQuotaPolicy quota;
    private final com.DevBridge.devbridge.domain.strategy.service.lean.LeanK8sProperties k8sProps;
    private final ObjectMapper om = new ObjectMapper();

    /** 백테스트 제출 → lean_job(QUEUED) 생성. 등급(tier)은 구독에서 스냅샷. */
    @PostMapping("/backtest/submit")
    public ResponseEntity<?> submit(@RequestBody SubmitReq req) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return err(HttpStatus.UNAUTHORIZED, "JWT 인증 필요");
        if (!access.canUseLean(uid)) return err(HttpStatus.FORBIDDEN, "Lean IDE는 EXPERT 구독 전용입니다");
        if (req == null || req.strategyId() == null || req.strategyId().isBlank())
            return err(HttpStatus.BAD_REQUEST, "strategyId 필수");
        if (req.symbols() == null || req.symbols().isEmpty())
            return err(HttpStatus.BAD_REQUEST, "symbols 최소 1개");
        if (req.startDate() == null || req.endDate() == null)
            return err(HttpStatus.BAD_REQUEST, "startDate, endDate 필수");
        try {
            User u = userRepo.findById(uid).orElse(null);
            String tier = (u != null && u.getUserType() != null) ? u.getUserType().name() : null;
            // 게이트(canUseDeveloper)를 통과했는데 등급 쿼터가 0(allowlist FREE 등)이면 최소 STANDARD 보장
            if (tier == null || quota.maxConcurrentFor(tier) <= 0) tier = "STANDARD";

            LeanJob j = LeanJob.builder()
                    .userId(uid).tier(tier).kind("BACKTEST").status("QUEUED")
                    .strategyId(req.strategyId())
                    .symbolsJson(om.writeValueAsString(req.symbols()))
                    .startDate(req.startDate()).endDate(req.endDate())
                    .market(req.market() == null ? "us" : req.market())
                    .paramsJson(req.paramOverrides() == null ? null : om.writeValueAsString(req.paramOverrides()))
                    .build();
            jobRepo.save(j);
            log.info("[lean-v2] submit job={} user={} tier={} {}", j.getId(), uid, tier, req.strategyId());
            return ResponseEntity.ok(Map.of("jobId", j.getId(), "status", "QUEUED", "tier", tier));
        } catch (Exception e) {
            log.error("[lean-v2] submit failed user={}", uid, e);
            return err(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    /** 내 잡 단건 상태/결과(소유자만). */
    @GetMapping("/jobs/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return err(HttpStatus.UNAUTHORIZED, "JWT 인증 필요");
        LeanJob j = jobRepo.findById(id).orElse(null);
        if (j == null || !j.getUserId().equals(uid)) return err(HttpStatus.NOT_FOUND, "잡 없음");
        return ResponseEntity.ok(view(j, true));
    }

    /** 내 잡 목록(최신순). */
    @GetMapping("/jobs")
    public ResponseEntity<?> mine() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return err(HttpStatus.UNAUTHORIZED, "JWT 인증 필요");
        List<Map<String, Object>> jobs = jobRepo.findTop100ByUserIdOrderByCreatedAtDesc(uid)
                .stream().map(j -> view(j, false)).toList();
        return ResponseEntity.ok(Map.of("jobs", jobs));
    }

    /** 워커 Pod → BE 결과 콜백 (내부 토큰 인증). 잡을 DONE/ERROR 로 마감. */
    @PostMapping("/jobs/{id}/result")
    public ResponseEntity<?> result(@PathVariable Long id,
                                    @RequestHeader(value = "X-Internal-Token", required = false) String token,
                                    @RequestBody ResultReq req) {
        if (token == null || !token.equals(k8sProps.jobToken(id)))
            return err(HttpStatus.UNAUTHORIZED, "invalid job token");
        LeanJob j = jobRepo.findById(id).orElse(null);
        if (j == null) return err(HttpStatus.NOT_FOUND, "잡 없음");
        try {
            if ("DONE".equalsIgnoreCase(req.status())) {
                j.setStatus("DONE");
                j.setResultJson(req.result() == null ? null : om.writeValueAsString(req.result()));
            } else {
                j.setStatus("ERROR");
                j.setError(trunc(req.error()));
            }
            j.setFinishedAt(LocalDateTime.now());
            jobRepo.save(j);
            log.info("[lean-v2] result job={} -> {}", id, j.getStatus());
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            log.error("[lean-v2] result callback failed job={}", id, e);
            return err(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    private Map<String, Object> view(LeanJob j, boolean withResult) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("jobId", j.getId());
        m.put("status", j.getStatus());
        m.put("tier", j.getTier());
        m.put("strategyId", j.getStrategyId());
        m.put("market", j.getMarket());
        m.put("workerId", j.getWorkerId());
        m.put("createdAt", j.getCreatedAt());
        m.put("startedAt", j.getStartedAt());
        m.put("finishedAt", j.getFinishedAt());
        m.put("error", j.getError());
        if (withResult && j.getResultJson() != null) {
            try { m.put("result", om.readValue(j.getResultJson(), Object.class)); }  // Map/List (JsonNode 직렬화 quirk 회피)
            catch (Exception ignore) { m.put("result", j.getResultJson()); }
        }
        return m;
    }

    private static String trunc(String s) {
        if (s == null) return null;
        return s.length() > 1000 ? s.substring(0, 1000) : s;
    }

    private ResponseEntity<?> err(HttpStatus st, String msg) {
        return ResponseEntity.status(st).body(Map.of("error", msg == null ? st.getReasonPhrase() : msg));
    }

    public record SubmitReq(String strategyId, List<String> symbols, String startDate, String endDate,
                            String market, Map<String, Object> paramOverrides) {}

    public record ResultReq(String status, Map<String, Object> result, String error) {}
}
