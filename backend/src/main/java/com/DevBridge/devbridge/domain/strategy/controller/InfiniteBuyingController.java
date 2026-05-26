package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.InfiniteBuyingSubscription;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.strategy.repository.InfiniteBuyingSubscriptionRepository;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.strategy.service.broker.InfiniteBuyingJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 무한매수법 자동매매 구독 관리 REST.
 *
 *  GET    /api/broker/infinite-buying              — 내 구독 목록
 *  POST   /api/broker/infinite-buying              — 신규 등록 { brokerAccountId, ticker, seedUsd, ... }
 *  PATCH  /api/broker/infinite-buying/{id}/active  — { active: true|false }
 *  PATCH  /api/broker/infinite-buying/{id}/reset   — currentSplitRound=0 (사이클 수동 리셋)
 *  DELETE /api/broker/infinite-buying/{id}
 *  POST   /api/broker/infinite-buying/{id}/run-now — 즉시 1회 실행 (테스트용)
 */
@Slf4j
@RestController
@RequestMapping("/api/broker/infinite-buying")
@RequiredArgsConstructor
public class InfiniteBuyingController {

    private final InfiniteBuyingSubscriptionRepository subRepo;
    private final BrokerAccountRepository brokerRepo;
    private final UserRepository userRepo;
    private final InfiniteBuyingJob job;

    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다"));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        List<Map<String, Object>> rows = subRepo.findByUserIdOrderByCreatedAtDesc(uid).stream()
                .map(this::toDto).toList();
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        User user = userRepo.findById(uid).orElse(null);
        if (user == null) return unauth();

        Long brokerAccountId = asLong(body.get("brokerAccountId"));
        String ticker = String.valueOf(body.getOrDefault("ticker", "")).trim().toUpperCase();
        Double seedUsd = asDouble(body.get("seedUsd"));
        if (brokerAccountId == null || ticker.isEmpty() || seedUsd == null || seedUsd <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "brokerAccountId, ticker, seedUsd(>0) 필수"));
        }
        BrokerAccount b = brokerRepo.findById(brokerAccountId).orElse(null);
        if (b == null || !b.getUser().getId().equals(uid)) {
            return ResponseEntity.status(403).body(Map.of("error", "해당 BrokerAccount에 권한이 없습니다"));
        }

        InfiniteBuyingSubscription s = InfiniteBuyingSubscription.builder()
                .user(user)
                .brokerAccount(b)
                .ticker(ticker)
                .seedUsd(seedUsd)
                .splitCount(asInt(body.getOrDefault("splitCount", 40)))
                .dailyBuySplitRatio(asDouble(body.getOrDefault("dailyBuySplitRatio", 0.5)))
                .bigBuyPremiumPct(asDouble(body.getOrDefault("bigBuyPremiumPct", 12.0)))
                .takeProfitPct(asDouble(body.getOrDefault("takeProfitPct", 10.0)))
                .active(Boolean.TRUE.equals(body.getOrDefault("active", true)))
                .build();
        subRepo.save(s);
        return ResponseEntity.ok(toDto(s));
    }

    @PatchMapping("/{id}/active")
    @Transactional
    public ResponseEntity<?> setActive(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        InfiniteBuyingSubscription s = subRepo.findById(id).orElse(null);
        if (s == null || !s.getUser().getId().equals(uid)) {
            return ResponseEntity.status(404).body(Map.of("error", "구독을 찾을 수 없습니다"));
        }
        s.setActive(Boolean.TRUE.equals(body.get("active")));
        subRepo.save(s);
        return ResponseEntity.ok(toDto(s));
    }

    @PatchMapping("/{id}/reset")
    @Transactional
    public ResponseEntity<?> resetCycle(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        InfiniteBuyingSubscription s = subRepo.findById(id).orElse(null);
        if (s == null || !s.getUser().getId().equals(uid)) {
            return ResponseEntity.status(404).body(Map.of("error", "구독을 찾을 수 없습니다"));
        }
        s.setCurrentSplitRound(0);
        s.setLastRunMsg("사이클 수동 리셋");
        subRepo.save(s);
        return ResponseEntity.ok(toDto(s));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        InfiniteBuyingSubscription s = subRepo.findById(id).orElse(null);
        if (s == null || !s.getUser().getId().equals(uid)) {
            return ResponseEntity.status(404).body(Map.of("error", "구독을 찾을 수 없습니다"));
        }
        subRepo.delete(s);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    @PostMapping("/{id}/run-now")
    @Transactional
    public ResponseEntity<?> runNow(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        InfiniteBuyingSubscription s = subRepo.findById(id).orElse(null);
        if (s == null || !s.getUser().getId().equals(uid)) {
            return ResponseEntity.status(404).body(Map.of("error", "구독을 찾을 수 없습니다"));
        }
        // lastRunAt 무시하고 강제 실행하려면 임시로 null로
        s.setLastRunAt(null);
        subRepo.save(s);
        try {
            job.runNow(s);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
        return ResponseEntity.ok(toDto(subRepo.findById(id).orElse(s)));
    }

    private Map<String, Object> toDto(InfiniteBuyingSubscription s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("brokerAccountId", s.getBrokerAccount() != null ? s.getBrokerAccount().getId() : null);
        m.put("brokerEnv", s.getBrokerAccount() != null ? s.getBrokerAccount().getEnv().name() : null);
        m.put("ticker", s.getTicker());
        m.put("seedUsd", s.getSeedUsd());
        m.put("splitCount", s.getSplitCount());
        m.put("dailyBuySplitRatio", s.getDailyBuySplitRatio());
        m.put("bigBuyPremiumPct", s.getBigBuyPremiumPct());
        m.put("takeProfitPct", s.getTakeProfitPct());
        m.put("active", s.getActive());
        m.put("currentSplitRound", s.getCurrentSplitRound());
        m.put("lastRunAt", s.getLastRunAt());
        m.put("lastRunMsg", s.getLastRunMsg());
        m.put("createdAt", s.getCreatedAt());
        return m;
    }

    private static Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(v)); } catch (Exception e) { return null; }
    }
    private static Integer asInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return null; }
    }
    private static Double asDouble(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(v)); } catch (Exception e) { return null; }
    }
}
