package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.strategy.service.broker.KisApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 미국주식 주문/잔고 API. KIS 모의·실전 양쪽 모두 동일 엔드포인트로 동작 (env는 BrokerAccount에서 결정).
 *
 * 흐름:
 *  GET  /balance        → 보유종목 + 예수금
 *  POST /preview        → 한도 검증 + 예상 비용 계산 (실제 주문 X)
 *  POST /place          → 실제 KIS 주문 전송 (한도·tradingEnabled·검증여부 모두 통과해야 함)
 *  GET  /orders/today   → 당일 주문/체결 내역
 */
@RestController
@RequestMapping("/api/broker")
@RequiredArgsConstructor
@Slf4j
public class BrokerOrderController {

    private final BrokerAccountRepository brokerRepo;
    private final KisApiClient kis;
    private final com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository proposalRepo;

    @GetMapping("/balance")
    public ResponseEntity<?> balance(@RequestParam("env") BrokerAccount.Env env) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(Map.of("error", "먼저 KIS 계좌를 등록하세요"));
        try {
            return ResponseEntity.ok(kis.getOverseasBalance(b));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "잔고 조회 실패: " + e.getMessage()));
        }
    }

    @GetMapping("/orders/today")
    public ResponseEntity<?> ordersToday(@RequestParam("env") BrokerAccount.Env env) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(Map.of("error", "먼저 KIS 계좌를 등록하세요"));
        try {
            return ResponseEntity.ok(kis.getTodayOrders(b));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "주문내역 조회 실패: " + e.getMessage()));
        }
    }

    /** 미국주식 현재가 조회 — 지정가 입력시 참고용. KIS HHDFS00000300. */
    @GetMapping("/quote")
    public ResponseEntity<?> quote(@RequestParam("env") BrokerAccount.Env env, @RequestParam String ticker) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(Map.of("error", "먼저 KIS 계좌를 등록하세요"));
        try {
            return ResponseEntity.ok(kis.getOverseasQuote(b, ticker.trim().toUpperCase()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "현재가 조회 실패: " + e.getMessage()));
        }
    }

    /** WebSocket 체결통보 접속키 발급 — 프론트가 KIS WS에 직접 연결할 때 사용. */
    @PostMapping("/ws-key")
    public ResponseEntity<?> wsKey(@RequestParam("env") BrokerAccount.Env env) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(Map.of("error", "먼저 KIS 계좌를 등록하세요"));
        try {
            String key = kis.getWsApprovalKey(b);
            String wsUrl = b.getEnv() == BrokerAccount.Env.REAL
                    ? "wss://ops.koreainvestment.com:21000"
                    : "wss://ops.koreainvestment.com:31000";
            return ResponseEntity.ok(Map.of("approval_key", key, "ws_url", wsUrl, "env", b.getEnv().name()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "WS 키 발급 실패: " + e.getMessage()));
        }
    }

    public record OrderReq(String ticker, String side, Long quantity, Double limitPrice) {}

    /**
     * 주문 사전 검증. 한도·검증상태·tradingEnabled 검사. 실제 KIS 호출 없음.
     */
    @PostMapping("/orders/preview")
    public ResponseEntity<?> preview(@RequestParam("env") BrokerAccount.Env env, @RequestBody OrderReq req) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        var bad = guard(b, req);
        if (bad != null) return bad;
        double estUsd = req.limitPrice() == null ? 0.0 : req.limitPrice() * req.quantity();
        boolean overSingle = b.getMaxOrderUsd() > 0 && estUsd > b.getMaxOrderUsd();
        return ResponseEntity.ok(Map.of(
                "ok", !overSingle,
                "ticker", req.ticker().toUpperCase(),
                "side", req.side().toUpperCase(),
                "quantity", req.quantity(),
                "limit_price", req.limitPrice(),
                "est_total_usd", estUsd,
                "max_order_usd", b.getMaxOrderUsd(),
                "over_single_limit", overSingle,
                "env", b.getEnv().name(),
                "trading_enabled", b.getTradingEnabled()
        ));
    }

    /**
     * 실제 KIS 주문 전송.
     * 보안 가드: tradingEnabled, lastVerifiedAt, 한도, 입력 검증.
     */
    @PostMapping("/orders/place")
    @Transactional
    public ResponseEntity<?> place(@RequestParam("env") BrokerAccount.Env env, @RequestBody OrderReq req) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        var bad = guard(b, req);
        if (bad != null) return bad;
        if (!Boolean.TRUE.equals(b.getTradingEnabled())) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", "매매 스위치가 OFF입니다. 계좌 설정에서 활성화 후 다시 시도하세요."));
        }
        if (b.getLastVerifiedAt() == null) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", "먼저 /api/broker/account/test 로 키 유효성을 검증하세요."));
        }
        double estUsd = req.limitPrice() == null ? 0.0 : req.limitPrice() * req.quantity();
        if (b.getMaxOrderUsd() > 0 && estUsd > b.getMaxOrderUsd()) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", "1건당 한도(USD " + b.getMaxOrderUsd() + ") 초과: 예상 " + estUsd));
        }
        // 일일 누적 한도 — 자정(서버 로컬타임) 이후 EXECUTED 주문 USD 합산
        if (b.getDailyOrderUsd() != null && b.getDailyOrderUsd() > 0) {
            java.time.LocalDateTime since = java.time.LocalDate.now().atStartOfDay();
            java.math.BigDecimal todaySum = proposalRepo.sumExecutedUsdSince(uid, since);
            double todayTotal = todaySum == null ? 0.0 : todaySum.doubleValue();
            if (todayTotal + estUsd > b.getDailyOrderUsd()) {
                return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED).body(Map.of(
                    "error", "일일 누적 한도(USD " + b.getDailyOrderUsd() + ") 초과: 오늘 " + todayTotal + " + 신규 " + estUsd));
            }
        }
        try {
            KisApiClient.Side side = "SELL".equalsIgnoreCase(req.side()) ? KisApiClient.Side.SELL : KisApiClient.Side.BUY;
            Map<String, Object> result = kis.placeOverseasOrder(
                    b, req.ticker().toUpperCase(), side, req.quantity(), req.limitPrice());
            log.info("[KIS-ORDER] user={} {} {} x{} @ {} → {}",
                    uid, side, req.ticker(), req.quantity(), req.limitPrice(), result.get("kis_order_no"));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.warn("[KIS-ORDER] user={} failed: {}", uid, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "주문 실패: " + e.getMessage()));
        }
    }

    private static ResponseEntity<?> guard(BrokerAccount b, OrderReq req) {
        if (b == null) return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                .body(Map.of("error", "먼저 KIS 계좌를 등록하세요"));
        if (req == null || req.ticker() == null || req.ticker().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "ticker 필수"));
        if (req.quantity() == null || req.quantity() <= 0)
            return ResponseEntity.badRequest().body(Map.of("error", "quantity는 1 이상"));
        if (req.side() == null || !(req.side().equalsIgnoreCase("BUY") || req.side().equalsIgnoreCase("SELL")))
            return ResponseEntity.badRequest().body(Map.of("error", "side는 BUY/SELL"));
        return null;
    }

    private static ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증 필요"));
    }
}
