package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.ai.entity.AlphaDecisionLog;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.OrderExecutionAudit;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.ai.repository.AlphaDecisionLogRepository;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderExecutionAuditRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.strategy.service.broker.BrokerRouter;
import com.DevBridge.devbridge.domain.strategy.service.broker.KisApiClient;
import com.DevBridge.devbridge.domain.strategy.service.broker.OrderFillService;
import com.DevBridge.devbridge.domain.strategy.service.broker.ProposalExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * OrderProposal 승인 큐 REST.
 *  GET    /api/proposals                  내 제안 전체 (status 필터 가능)
 *  GET    /api/proposals/pending-count    승인 대기 N (헤더 뱃지용)
 *  POST   /api/proposals                  수동 제안 생성 (source=MANUAL)
 *  POST   /api/proposals/{id}/approve     승인 → 즉시 KIS 주문 실행
 *  POST   /api/proposals/{id}/reject      거절
 */
@RestController
@RequestMapping("/api/proposals")
@RequiredArgsConstructor
@Slf4j
public class OrderProposalController {

    private final OrderProposalRepository proposalRepo;
    private final BrokerAccountRepository brokerAccountRepo;
    private final AlphaDecisionLogRepository logRepo;
    private final KisApiClient kis;
    private final ProposalExecutionService exec;
    private final OrderFillService fill;
    private final OrderExecutionAuditRepository auditRepo;
    private final BrokerRouter brokerRouter;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String status) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        List<OrderProposal> rows = (status == null || status.isBlank())
                ? proposalRepo.findByUserIdOrderByCreatedAtDesc(uid)
                : proposalRepo.findByUserIdAndStatusOrderByCreatedAtDesc(uid, status.toUpperCase());
        return ResponseEntity.ok(rows.stream().map(this::toJson).toList());
    }

    @GetMapping("/pending-count")
    public ResponseEntity<?> pendingCount() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        return ResponseEntity.ok(Map.of("count", proposalRepo.countByUserIdAndStatus(uid, "PENDING")));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();

        Long brokerAccountId = asLong(body.get("brokerAccountId"));
        String ticker = asString(body.get("ticker"));
        String side = asString(body.get("side"));
        BigDecimal qtyDec = asBigDecimal(body.get("qty"));   // 크립토 분수 허용

        if (brokerAccountId == null || ticker == null || side == null || qtyDec == null || qtyDec.signum() <= 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "brokerAccountId/ticker/side/qty(>0) 필수"));
        }
        if (!"BUY".equalsIgnoreCase(side) && !"SELL".equalsIgnoreCase(side)) {
            return ResponseEntity.badRequest().body(Map.of("error", "side는 BUY 또는 SELL"));
        }
        BrokerAccount ba = brokerAccountRepo.findByIdAndUserId(brokerAccountId, uid).orElse(null);
        if (ba == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "BrokerAccount 권한 없음"));
        }

        // 크립토(BINANCE)는 분수 수량을 qtyDecimal 에 저장(qty 는 NOT NULL placeholder). 주식(KIS)은 정수 qty.
        boolean crypto = ba.getBrokerType() == BrokerAccount.BrokerType.BINANCE;
        int qtyInt = crypto
                ? Math.max(1, qtyDec.setScale(0, java.math.RoundingMode.CEILING).intValue())
                : qtyDec.setScale(0, java.math.RoundingMode.DOWN).intValue();
        if (!crypto && qtyInt <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "주식 수량은 1 이상 정수여야 합니다"));
        }

        String orderTypeRaw = asString(body.get("orderType"));
        String orderType = (orderTypeRaw != null && (orderTypeRaw.equals("LIMIT") || orderTypeRaw.equals("MARKET") || orderTypeRaw.equals("LOC")))
                ? orderTypeRaw : "LIMIT";

        String stockName = asString(body.get("stockName"));

        OrderProposal p = proposalRepo.save(OrderProposal.builder()
                .userId(uid)
                .workspaceId(asLong(body.get("workspaceId")))
                .brokerAccountId(brokerAccountId)
                .ticker(ticker.toUpperCase())
                .stockName(stockName)
                .side(side.toUpperCase())
                .qty(qtyInt)
                .qtyDecimal(crypto ? qtyDec : null)
                .limitPrice("MARKET".equals(orderType) ? null : asBigDecimal(body.get("limitPrice")))
                .orderType(orderType)
                .source("MANUAL")
                .rationale(asString(body.getOrDefault("rationale", "사용자 수동 제안")))
                .status("PENDING")
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build());

        String qtyLabel = p.getQtyDecimal() != null ? p.getQtyDecimal().toPlainString() : String.valueOf(p.getQty());
        recordWorkspaceLog(p.getWorkspaceId(), "USER", "PROPOSAL_CREATED",
                "수동 주문 제안: " + p.getSide() + " " + qtyLabel + " " + p.getTicker(), null);
        return ResponseEntity.ok(toJson(p));
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public ResponseEntity<?> approve(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();

        OrderProposal p = proposalRepo.findByIdAndUserId(id, uid).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();

        BrokerAccount ba = brokerAccountRepo.findByIdAndUserId(p.getBrokerAccountId(), uid).orElse(null);
        if (ba == null) return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "BrokerAccount 권한 없음"));

        // 수동 승인도 자동 체결과 동일한 안전 게이트(kill-switch·tradingEnabled·한도)를 거친다.
        ProposalExecutionService.Result r = exec.execute(p, ba, false);
        if (!r.ok()) {
            return ResponseEntity.unprocessableEntity().body(Map.of("error", r.error()));
        }
        return ResponseEntity.ok(toJson(r.proposal()));
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public ResponseEntity<?> reject(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        OrderProposal p = proposalRepo.findByIdAndUserId(id, uid).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!"PENDING".equals(p.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "PENDING 상태가 아님 (현재=" + p.getStatus() + ")"));
        }
        p.setStatus("REJECTED");
        p.setDecidedAt(LocalDateTime.now());
        if (body != null && body.get("reason") != null) {
            p.setExecError("거절 사유: " + body.get("reason"));
        }
        proposalRepo.save(p);
        recordWorkspaceLog(p.getWorkspaceId(), "USER", "PROPOSAL_REJECTED",
                "주문 제안 거절: " + p.getSide() + " " + p.getQty() + " " + p.getTicker(), null);
        return ResponseEntity.ok(toJson(p));
    }

    /**
     * 주문 정정 — PENDING 제안의 수량/단가/주문유형/방향/사유를 수정.
     * PENDING 상태만 정정 가능(이미 승인·체결·거절된 건은 불가).
     * body 에 들어온 키만 갱신(부분 수정). 종목(ticker)은 정정 대상이 아니다(취소 후 재등록).
     */
    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> amend(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();

        OrderProposal p = proposalRepo.findByIdAndUserId(id, uid).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!"PENDING".equals(p.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "PENDING 상태만 정정 가능 (현재=" + p.getStatus() + ")"));
        }

        BrokerAccount ba = brokerAccountRepo.findByIdAndUserId(p.getBrokerAccountId(), uid).orElse(null);
        if (ba == null) return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "BrokerAccount 권한 없음"));
        boolean crypto = ba.getBrokerType() == BrokerAccount.BrokerType.BINANCE;

        // 방향(BUY/SELL)
        if (body.containsKey("side")) {
            String side = asString(body.get("side"));
            if (side == null || (!"BUY".equalsIgnoreCase(side) && !"SELL".equalsIgnoreCase(side))) {
                return ResponseEntity.badRequest().body(Map.of("error", "side는 BUY 또는 SELL"));
            }
            p.setSide(side.toUpperCase());
        }

        // 수량 — 크립토는 분수(qtyDecimal), 주식은 정수(qty). create 와 동일 규칙.
        if (body.containsKey("qty")) {
            BigDecimal qtyDec = asBigDecimal(body.get("qty"));
            if (qtyDec == null || qtyDec.signum() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "수량은 0보다 커야 합니다"));
            }
            int qtyInt = crypto
                    ? Math.max(1, qtyDec.setScale(0, java.math.RoundingMode.CEILING).intValue())
                    : qtyDec.setScale(0, java.math.RoundingMode.DOWN).intValue();
            if (!crypto && qtyInt <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "주식 수량은 1 이상 정수여야 합니다"));
            }
            p.setQty(qtyInt);
            p.setQtyDecimal(crypto ? qtyDec : null);
        }

        // 주문유형 (LIMIT/MARKET/LOC)
        String orderType = p.getOrderType();
        if (body.containsKey("orderType")) {
            String otRaw = asString(body.get("orderType"));
            if (otRaw != null && (otRaw.equals("LIMIT") || otRaw.equals("MARKET") || otRaw.equals("LOC"))) {
                orderType = otRaw;
                p.setOrderType(orderType);
            }
        }

        // 단가 — MARKET 이면 무조건 null, 그 외에는 들어온 값으로 갱신
        if ("MARKET".equals(orderType)) {
            p.setLimitPrice(null);
        } else if (body.containsKey("limitPrice")) {
            p.setLimitPrice(asBigDecimal(body.get("limitPrice")));
        }

        // 사유
        if (body.containsKey("rationale")) {
            p.setRationale(asString(body.get("rationale")));
        }

        proposalRepo.save(p);

        String qtyLabel = p.getQtyDecimal() != null ? p.getQtyDecimal().toPlainString() : String.valueOf(p.getQty());
        recordWorkspaceLog(p.getWorkspaceId(), "USER", "PROPOSAL_AMENDED",
                "주문 제안 정정: " + p.getSide() + " " + qtyLabel + " " + p.getTicker(), null);
        return ResponseEntity.ok(toJson(p));
    }

    /** B1: 이 주문의 실제 체결 상태를 KIS 에서 즉시 폴링해 갱신 (수동 트리거 — 스케줄잡과 동일 로직). */
    @PostMapping("/{id}/poll-fill")
    @Transactional
    public ResponseEntity<?> pollFill(@PathVariable Long id) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        OrderProposal p = proposalRepo.findByIdAndUserId(id, uid).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        if (!"EXECUTED".equals(p.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "EXECUTED 상태만 체결 조회 가능 (현재=" + p.getStatus() + ")"));
        }
        Map<String, Object> result = fill.pollFill(p);
        Map<String, Object> out = toJson(p);
        out.put("fillResult", result);
        return ResponseEntity.ok(out);
    }

    /** B3: 내 주문 실행 감사로그 (append-only — 실제 KIS 로 나간 주문 시도 영구 기록). */
    @GetMapping("/audit")
    public ResponseEntity<?> audit() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();
        return ResponseEntity.ok(auditRepo.findByUserIdOrderByCreatedAtDesc(uid).stream().map(this::auditDto).toList());
    }

    /**
     * 가격 없는 EXECUTED 제안에 현재가를 fillAvgPrice로 소급 채움.
     * limitPrice도 null인 기존 레코드를 현재 시세로 근사 보정 (정확한 체결가가 아니므로 PnL은 근삿값).
     * POST /api/proposals/backfill-prices
     */
    @PostMapping("/backfill-prices")
    @Transactional
    public ResponseEntity<?> backfillPrices() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauth();

        List<OrderProposal> targets = proposalRepo.findByUserIdOrderByCreatedAtDesc(uid).stream()
                .filter(p -> "EXECUTED".equals(p.getStatus()))
                .filter(p -> p.getFillAvgPrice() == null && p.getLimitPrice() == null)
                .toList();

        int filled = 0, skipped = 0;
        for (OrderProposal p : targets) {
            BrokerAccount ba = brokerAccountRepo.findByIdAndUserId(p.getBrokerAccountId(), uid).orElse(null);
            if (ba == null) { skipped++; continue; }
            try {
                var q = brokerRouter.forAccount(ba).getQuote(ba, p.getTicker());
                Object lp = q.get("last_price");
                double price = lp instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(lp));
                if (price <= 0) { skipped++; continue; }
                p.setFillAvgPrice(BigDecimal.valueOf(price));
                proposalRepo.save(p);
                filled++;
            } catch (Exception e) {
                log.warn("[backfill] proposal {} ({}) 현재가 조회 실패: {}", p.getId(), p.getTicker(), e.getMessage());
                skipped++;
            }
        }
        return ResponseEntity.ok(Map.of("filled", filled, "skipped", skipped, "total", targets.size()));
    }

    // ─────────────────────────────────────────── helpers

    private Map<String, Object> auditDto(OrderExecutionAudit a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", a.getId());
        m.put("proposalId", a.getProposalId());
        m.put("brokerAccountId", a.getBrokerAccountId());
        m.put("env", a.getEnv());
        m.put("ticker", a.getTicker());
        m.put("side", a.getSide());
        m.put("qty", a.getQty());
        m.put("limitPrice", a.getLimitPrice());
        m.put("kisOrderNo", a.getKisOrderNo());
        m.put("rtCd", a.getRtCd());
        m.put("autoExecuted", a.getAutoExecuted());
        m.put("outcome", a.getOutcome());
        m.put("detail", a.getDetail());
        m.put("createdAt", a.getCreatedAt());
        return m;
    }

    private Map<String, Object> toJson(OrderProposal p) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("workspaceId", p.getWorkspaceId());
        m.put("brokerAccountId", p.getBrokerAccountId());
        m.put("ticker", p.getTicker());
        m.put("stockName", p.getStockName());
        m.put("side", p.getSide());
        m.put("qty", p.getQty());
        m.put("qtyDecimal", p.getQtyDecimal());
        m.put("limitPrice", p.getLimitPrice());
        m.put("source", p.getSource());
        m.put("sourceSignalId", p.getSourceSignalId());
        m.put("status", p.getStatus());
        m.put("rationale", p.getRationale());
        m.put("kisOrderNo", p.getKisOrderNo());
        m.put("execError", p.getExecError());
        m.put("expiresAt", p.getExpiresAt());
        m.put("decidedAt", p.getDecidedAt());
        m.put("executedAt", p.getExecutedAt());
        m.put("fillStatus", p.getFillStatus());
        m.put("filledQty", p.getFilledQty());
        m.put("filledQtyDecimal", p.getFilledQtyDecimal());
        m.put("fillAvgPrice", p.getFillAvgPrice());
        m.put("fillCheckedAt", p.getFillCheckedAt());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private void recordWorkspaceLog(Long workspaceId, String actor, String type, String summary, String payload) {
        if (workspaceId == null) return;
        try {
            logRepo.save(AlphaDecisionLog.builder()
                    .workspaceId(workspaceId).actor(actor).eventType(type)
                    .summary(summary).payloadJson(payload).build());
        } catch (Exception ignore) { }
    }

    private static Long asLong(Object o) {
        if (o == null) return null;
        try { return Long.valueOf(o.toString()); } catch (Exception e) { return null; }
    }
    private static Integer asInt(Object o) {
        if (o == null) return null;
        try { return Integer.valueOf(o.toString()); } catch (Exception e) { return null; }
    }
    private static String asString(Object o) { return o == null ? null : o.toString(); }

    /**
     * KIS msg_cd → 사용자 친화 메시지.
     *  - EGW00202: GW 라우팅 오류. 99%는 chunked 인코딩이지만 이미 byte[]로 처리되므로,
     *    이 시점까지 남았다면 운영시간 외(미국 정규장 닫힘) 또는 모의계좌 비거래 종목 가능성.
     *  - EGW00201: 초당 거래건수 초과 (이미 1회 자동 재시도됨).
     *  - EGW00105: 인증/키 만료.
     */
    private static String friendlyKisError(String msgCd, String msg, com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount ba) {
        String envLabel = ba != null && ba.getEnv() == com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount.Env.REAL ? "실전" : "모의";
        if ("EGW00202".equals(msgCd)) {
            return "KIS GW 라우팅 오류(EGW00202): 거래소 코드를 모두 시도했지만 라우팅이 실패했습니다. "
                    + "현재 " + envLabel + "계좌 기준 미국 정규장이 닫혀있거나, " + envLabel + "투자에서 거래 불가 종목일 수 있습니다. "
                    + "한국시간 22:30~05:00(서머타임)/23:30~06:00에 다시 시도하세요.";
        }
        if ("EGW00201".equals(msgCd)) {
            return "KIS 초당 거래건수 초과(EGW00201): 잠시 후 다시 시도하세요.";
        }
        if ("EGW00105".equals(msgCd)) {
            return "KIS 인증 만료(EGW00105): 브로커 설정에서 토큰을 재발급하세요.";
        }
        return "KIS 주문 거부 (msg_cd=" + msgCd + "): " + msg;
    }
    private static BigDecimal asBigDecimal(Object o) {
        if (o == null) return null;
        try { return new BigDecimal(o.toString()); } catch (Exception e) { return null; }
    }
    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "로그인 필요"));
    }
}
