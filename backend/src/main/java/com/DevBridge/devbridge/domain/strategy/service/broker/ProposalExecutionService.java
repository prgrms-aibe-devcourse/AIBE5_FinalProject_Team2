package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.ai.entity.AlphaDecisionLog;
import com.DevBridge.devbridge.domain.ai.repository.AlphaDecisionLogRepository;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.OrderExecutionAudit;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.repository.OrderExecutionAuditRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * OrderProposal → 실제 KIS 주문 실행의 <b>단일 경로</b>.
 *
 * <p>수동 승인(OrderProposalController.approve)과 자동 체결(DailySignalGenerator auto-hook)이
 * 모두 이 서비스를 거치므로, 모든 안전 게이트가 한 곳에서만 정의되어 분기/누락이 없다:
 * <ul>
 *   <li>전역 kill-switch (TRADING_KILL_SWITCH)</li>
 *   <li>BrokerAccount.tradingEnabled 마스터 스위치</li>
 *   <li>1건당 한도(maxOrderUsd) · 일일 누적 한도(dailyOrderUsd)</li>
 *   <li>상태(PENDING)·만료 검증</li>
 * </ul>
 * REAL 자동매매 졸업 게이트(MOCK 2주+20회)는 활성화 시점(BrokerAccountController)에서 검증한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProposalExecutionService {

    private final OrderProposalRepository proposalRepo;
    private final AlphaDecisionLogRepository logRepo;
    private final BrokerRouter brokerRouter;
    private final TradingControlService tradingControl;
    private final OrderExecutionAuditRepository auditRepo;
    private final ObjectMapper om = new ObjectMapper();

    public record Result(boolean ok, String error, OrderProposal proposal) {}

    /**
     * 제안 실행. {@code auto=true} 면 자동 체결로 마킹(autoExecuted=true)한다.
     * 모든 안전 게이트를 통과해야만 KIS 로 주문이 나간다. 호출측은 소유권/인증을 먼저 검증해야 한다.
     */
    @Transactional
    public Result execute(OrderProposal p, BrokerAccount ba, boolean auto) {
        if (!"PENDING".equals(p.getStatus())) {
            return new Result(false, "PENDING 상태가 아님 (현재=" + p.getStatus() + ")", p);
        }
        if (p.getExpiresAt() != null && p.getExpiresAt().isBefore(LocalDateTime.now())) {
            p.setStatus("EXPIRED");
            proposalRepo.save(p);
            return new Result(false, "이미 만료됨", p);
        }
        if (ba == null) return new Result(false, "BrokerAccount 없음", p);
        // 전역 kill-switch 는 **실거래(REAL) 주문만** 차단한다(설계 의도: "모든 KIS 실주문 차단").
        // MOCK(모의/페이퍼) 은 자본 위험이 없으므로 통과시켜 검증·데모가 막히지 않게 한다.
        // (MOCK 도 계정별 tradingEnabled·1건/일일 한도·키 검증은 그대로 거친다.)
        if (ba.getEnv() == BrokerAccount.Env.REAL && tradingControl.isKillSwitchOn()) {
            log.warn("[exec] kill-switch ON (REAL) — 실거래 주문 거부 proposal={}", p.getId());
            return new Result(false, "전역 거래 차단(kill-switch) 활성화 — 실거래(REAL) 주문 거부", p);
        }
        // tradingEnabled 는 자동매매 마스터 스위치. 수동 제안(MANUAL)은 사용자가 직접 승인하므로 이 체크를 생략.
        if (!Boolean.TRUE.equals(ba.getTradingEnabled()) && !"MANUAL".equals(p.getSource())) {
            return new Result(false, "BrokerAccount.tradingEnabled=false — 자동매매 마스터 스위치 OFF", p);
        }

        Broker broker = brokerRouter.forAccount(ba);
        BigDecimal qtyEff = effectiveQty(p);

        // SELL 안전 클램프: 실보유 수량을 초과하는 매도를 차단(min(제안qty, 실보유)). 백테스트 가상보유(프리셋
        // plan 의 _final_shares 등) 나 stale qty 가 그대로 실계좌로 나가 과매도/공매도되는 것을 방지(R2).
        // 보유조회 실패/포맷불명이면 클램프 스킵(정상 매도를 막지 않음 — KIS 서버 검증에 위임).
        if ("SELL".equals(p.getSide())) {
            BigDecimal held = null;
            try {
                Map<String, Object> bal = broker.getBalance(ba);
                Object pos = (bal == null) ? null : bal.get("positions");
                if (pos instanceof List<?> list) {
                    held = BigDecimal.ZERO;  // positions 조회됨 → 해당 종목 없으면 보유 0
                    for (Object o : list) {
                        if (o instanceof Map<?, ?> m
                                && p.getTicker().equalsIgnoreCase(String.valueOf(m.get("ticker")))) {
                            Object q = m.get("qty");
                            if (q instanceof Number n) held = BigDecimal.valueOf(n.doubleValue());
                            break;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("[exec] 보유수량 조회 실패(SELL 클램프 스킵) proposal={}: {}", p.getId(), e.getMessage());
                held = null;
            }
            if (held != null) {
                if (held.signum() <= 0) {
                    p.setStatus("EXEC_FAILED");
                    p.setExecError("매도 거부: " + p.getTicker() + " 실보유 0주");
                    proposalRepo.save(p);
                    return new Result(false, "매도 거부: " + p.getTicker() + " 실보유 수량 0 (가상수량 매도 차단)", p);
                }
                if (qtyEff.compareTo(held) > 0) {
                    log.warn("[exec] SELL qty 실보유 클램프 {} → {} proposal={}", qtyEff, held, p.getId());
                    qtyEff = held;
                }
            }
        }

        // 1건당 한도 (시장가는 현재가로 추정 — KIS/크립토 공통, 시장가 한도우회 방지)
        double estUsd = estimateUsd(broker, ba, p, qtyEff);
        if (ba.getMaxOrderUsd() != null && ba.getMaxOrderUsd() > 0 && estUsd > ba.getMaxOrderUsd()) {
            return new Result(false, "1건당 한도(USD " + ba.getMaxOrderUsd() + ") 초과: 예상 " + estUsd, p);
        }
        // 일일 누적 한도
        if (ba.getDailyOrderUsd() != null && ba.getDailyOrderUsd() > 0) {
            BigDecimal todaySum = proposalRepo.sumExecutedUsdSince(p.getUserId(), LocalDate.now().atStartOfDay());
            double todayTotal = todaySum == null ? 0.0 : todaySum.doubleValue();
            if (todayTotal + estUsd > ba.getDailyOrderUsd()) {
                return new Result(false, "일일 누적 한도(USD " + ba.getDailyOrderUsd()
                        + ") 초과: 오늘 " + todayTotal + " + 신규 " + estUsd, p);
            }
        }

        // M3: KIS KRW 일일 매수/매도 한도 (KIS 는 KRW 한도 우선). USD 명목가를 근사 환율로 KRW 환산.
        //     dailyBuyKrw/dailySellKrw 는 설정만 되고 두 주문 경로 어디서도 집행되지 않던 dead 한도였다(32c121b).
        String krwViol = krwDailyLimitViolation(proposalRepo, ba, p.getSide(), p.getUserId(), estUsd);
        if (krwViol != null) return new Result(false, krwViol, p);

        // 손실 한도 서킷브레이커 (B3): B2 잔고스냅샷의 미실현 총손실이 한도 초과면 신규 매수 차단
        if ("BUY".equals(p.getSide()) && ba.getDailyLossLimitUsd() != null && ba.getDailyLossLimitUsd() > 0) {
            Double pnl = totalUnrealizedPnl(ba);
            if (pnl != null && pnl < -ba.getDailyLossLimitUsd()) {
                return new Result(false, "손실 한도 서킷브레이커: 미실현 손실 " + Math.round(-pnl)
                        + " USD 가 한도(" + ba.getDailyLossLimitUsd() + " USD) 초과 — 신규 매수 차단", p);
            }
        }

        // BUY 잔고 체크: 실계좌 예수금이 주문 예상 금액보다 적으면 차단.
        // 잔고 조회 실패 시엔 주문을 막지 않는다(fail-open) — KIS API 불안정으로 합법 주문이 막히는 것을 방지.
        if ("BUY".equals(p.getSide()) && estUsd > 0) {
            try {
                Map<String, Object> bal = broker.getBalance(ba);
                if (bal != null) {
                    double availableUsd = availableCashUsd(bal, ba);
                    if (availableUsd >= 0 && availableUsd < estUsd) {
                        String need = String.format("%.2f", estUsd);
                        String avail = String.format("%.2f", availableUsd);
                        return new Result(false,
                                "잔고 부족: 주문 예상 $" + need + " / 가용 예수금 $" + avail
                                + " (KIS KRW 계좌는 근사 환율 적용)", p);
                    }
                }
            } catch (Exception e) {
                log.warn("[exec] BUY 잔고 확인 실패(스킵) proposal={}: {}", p.getId(), e.getMessage());
            }
        }

        // 마크 APPROVED → 즉시 EXECUTED 시도.
        // DDIA 7장(compare-and-set): 동시에 두 요청(더블클릭 approve, 또는 approve+자동체결)이 모두 위
        // PENDING 검사를 통과해 '같은 주문을 두 번' 실주문하는 lost-update 를 원자적 상태전이로 차단.
        // UPDATE ... WHERE status='PENDING' 이 행을 잠그므로 둘 중 하나만 affected=1, 나머지는 즉시 멱등 반환.
        LocalDateTime decidedTs = LocalDateTime.now();
        if (proposalRepo.claimForExecution(p.getId(), decidedTs, auto) == 0) {
            return new Result(false, "이미 처리 중이거나 처리된 주문입니다.", p);
        }
        p.setStatus("APPROVED");   // 메모리 상태도 DB(claim)와 일치 — 이후 save 는 EXECUTED 기록
        p.setDecidedAt(decidedTs);
        p.setAutoExecuted(auto);

        try {
            Broker.Side side = "BUY".equals(p.getSide()) ? Broker.Side.BUY : Broker.Side.SELL;
            Broker.OrderType otype;
            try { otype = Broker.OrderType.valueOf(p.getOrderType() == null ? "LIMIT" : p.getOrderType()); }
            catch (IllegalArgumentException ex) { otype = Broker.OrderType.LIMIT; }
            Broker.OrderResult res = broker.placeOrder(ba, p.getTicker(), side, qtyEff, p.getLimitPrice(), otype);
            if (!res.ok()) {
                p.setStatus("EXEC_FAILED");
                p.setExecError(res.code() != null ? "[" + res.code() + "] " + res.message() : res.message());
                proposalRepo.save(p);
                recordLog(p, auto, "ORDER_EXEC_FAILED", "주문 실행 실패: " + p.getExecError());
                recordAudit(p, ba, auto, "EXEC_FAILED", res.code(), p.getExecError());
                return new Result(false, res.message(), p);
            }
            p.setStatus("EXECUTED");
            p.setExecutedAt(LocalDateTime.now());
            p.setKisOrderNo(res.orderNo());
            // KIS는 체결평균가를 반환하지 않으므로, limitPrice가 없는 주문(시장가/가격미설정)에 한해
            // 실행 시점의 현재가를 fillAvgPrice로 저장 — 실현손익 계산의 fallback 가격
            if (p.getLimitPrice() == null && p.getFillAvgPrice() == null) {
                try {
                    Map<String, Object> q = broker.getQuote(ba, p.getTicker());
                    Object lp = q.get("last_price");
                    double mktPrice = lp instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(lp));
                    if (mktPrice > 0) p.setFillAvgPrice(BigDecimal.valueOf(mktPrice));
                } catch (Exception e) {
                    log.warn("[exec] fillAvgPrice 캡처 실패 proposal={}: {}", p.getId(), e.getMessage());
                }
            }
            proposalRepo.save(p);
            recordLog(p, auto, "ORDER_EXECUTED",
                    (auto ? "[자동] " : "") + "주문 체결 접수: " + p.getSide() + " " + qtyEff.toPlainString() + " " + p.getTicker()
                            + " (#" + p.getKisOrderNo() + ")");
            recordAudit(p, ba, auto, "EXECUTED", res.code(), null);
            return new Result(true, null, p);
        } catch (Exception e) {
            log.error("[exec] order failed proposal={}", p.getId(), e);
            p.setStatus("EXEC_FAILED");
            p.setExecError(e.getMessage());
            proposalRepo.save(p);
            recordAudit(p, ba, auto, "EXEC_FAILED", null, e.getMessage());
            return new Result(false, e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(), p);
        }
    }

    /** 실행 수량: 분수(크립토)가 있으면 우선, 없으면 정수 qty. */
    private static BigDecimal effectiveQty(OrderProposal p) {
        if (p.getQtyDecimal() != null) return p.getQtyDecimal();
        return BigDecimal.valueOf(p.getQty() == null ? 0 : p.getQty());
    }

    /**
     * M3: KIS KRW 일일 매수/매도 한도 위반 검사. 위반 시 사용자 메시지, 아니면 null.
     * <p>KIS 계정에서만 적용된다(다른 브로커는 USD 한도 사용). {@code estUsd} 는 이번 주문의 명목가(USD)이며
     * 오늘 같은 side 로 EXECUTED 된 누적분과 합쳐 근사 환율로 KRW 환산 후 한도와 비교한다.
     * 수동 주문 경로(BrokerOrderController.place)도 이 메서드를 재사용해 두 경로의 한도 정책을 일치시킨다.
     */
    public static String krwDailyLimitViolation(OrderProposalRepository repo, BrokerAccount ba,
                                                String side, Long userId, double estUsd) {
        if (ba == null || ba.getBrokerType() != BrokerAccount.BrokerType.KIS) return null;
        boolean isBuy = "BUY".equalsIgnoreCase(side);
        Long krwLimit = isBuy ? ba.getDailyBuyKrw() : ba.getDailySellKrw();
        if (krwLimit == null || krwLimit <= 0) return null;
        BigDecimal sideSum = repo.sumExecutedUsdSinceBySide(userId, isBuy ? "BUY" : "SELL",
                LocalDate.now().atStartOfDay());
        double todayKrw = (sideSum == null ? 0.0 : sideSum.doubleValue()) * BrokerAccount.USD_KRW_APPROX;
        double newKrw = estUsd * BrokerAccount.USD_KRW_APPROX;
        if (todayKrw + newKrw > krwLimit) {
            return "KIS 일일 " + (isBuy ? "매수" : "매도") + " 한도(KRW " + krwLimit + ") 초과: 오늘 약 "
                    + Math.round(todayKrw) + " + 신규 약 " + Math.round(newKrw)
                    + " (USD→KRW " + (long) BrokerAccount.USD_KRW_APPROX + " 근사)";
        }
        return null;
    }

    /** 주문 추정 명목가(USD). 지정가는 그 값, 시장가는 현재가 조회로 추정(실패 시 0 — 기존 동작). */
    private double estimateUsd(Broker broker, BrokerAccount ba, OrderProposal p, BigDecimal qtyEff) {
        double price;
        if (p.getLimitPrice() != null) {
            price = p.getLimitPrice().doubleValue();
        } else {
            try {
                Map<String, Object> q = broker.getQuote(ba, p.getTicker());
                Object lp = q.get("last_price");
                price = lp instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(lp));
            } catch (Exception e) {
                price = 0.0;
            }
        }
        return qtyEff.doubleValue() * price;
    }

    /** B3 감사로그 — 실제 KIS 로 나간 주문 시도(성공/실패)를 불변 기록. best-effort. */
    private void recordAudit(OrderProposal p, BrokerAccount ba, boolean auto, String outcome, String rtCd, String detail) {
        try {
            // 크립토 분수 수량은 audit.qty(정수)로 표현 불가 → detail 에 실제 수량/심볼을 기록해 감사 충실성 유지.
            String effDetail = detail;
            if (effDetail == null && p.getQtyDecimal() != null) {
                effDetail = ba.getBrokerType() + " " + p.getSide() + " " + p.getQtyDecimal().toPlainString() + " " + p.getTicker();
            }
            auditRepo.save(OrderExecutionAudit.builder()
                    .userId(p.getUserId()).proposalId(p.getId()).brokerAccountId(ba.getId())
                    .env(ba.getEnv() == null ? null : ba.getEnv().name())
                    .ticker(p.getTicker()).side(p.getSide()).qty(p.getQty()).limitPrice(p.getLimitPrice())
                    .kisOrderNo(p.getKisOrderNo()).rtCd(rtCd).autoExecuted(auto).outcome(outcome)
                    .detail(effDetail == null ? null : (effDetail.length() > 500 ? effDetail.substring(0, 500) : effDetail))
                    .build());
        } catch (Exception e) {
            log.warn("[audit] 기록 실패 proposal={}: {}", p.getId(), e.getMessage());
        }
    }

    /**
     * 브로커 잔고 맵에서 가용 예수금(USD 기준)을 반환한다.
     * KIS KRW 계좌: cash_krw / USD_KRW_APPROX + cash_usd(0으로 폴백)
     * 그 외(Binance 등): cash_usd 직접 사용.
     * 파싱 불가/키 없으면 -1 반환 → 호출측 {@code availableUsd >= 0} 조건이 false → gate 스킵(fail-open).
     */
    private double availableCashUsd(Map<String, Object> bal, BrokerAccount ba) {
        try {
            if (ba.getBrokerType() == BrokerAccount.BrokerType.KIS) {
                Object krwObj = bal.get("cash_krw");
                double krw = krwObj instanceof Number n ? n.doubleValue() : -1;
                if (krw < 0) return -1;
                Object usdObj = bal.get("cash_usd");
                double usd = usdObj instanceof Number n ? n.doubleValue() : 0.0;
                return krw / BrokerAccount.USD_KRW_APPROX + usd;
            }
            Object usdObj = bal.get("cash_usd");
            if (usdObj instanceof Number n) return n.doubleValue();
            return -1;
        } catch (Exception e) {
            return -1;
        }
    }

    /** B3: B2 잔고스냅샷(lastBalanceJson)에서 미실현 총손익(USD). total_market_value_usd=KIS tot_evlu_pfls_amt. */
    private Double totalUnrealizedPnl(BrokerAccount ba) {
        if (ba.getLastBalanceJson() == null || ba.getLastBalanceJson().isBlank()) return null;
        try {
            JsonNode n = om.readTree(ba.getLastBalanceJson());
            return n.path("total_market_value_usd").asDouble(0);
        } catch (Exception e) {
            return null;
        }
    }

    private void recordLog(OrderProposal p, boolean auto, String type, String summary) {
        if (p.getWorkspaceId() == null) return;
        try {
            logRepo.save(AlphaDecisionLog.builder()
                    .workspaceId(p.getWorkspaceId()).actor(auto ? "AUTO" : "USER").eventType(type)
                    .summary(summary).build());
        } catch (Exception ignore) { }
    }

    /** KIS msg_cd → 사용자 친화 메시지. */
    public static String friendlyKisError(String msgCd, String msg, BrokerAccount ba) {
        String envLabel = ba != null && ba.getEnv() == BrokerAccount.Env.REAL ? "실전" : "모의";
        if ("EGW00202".equals(msgCd)) {
            return "KIS GW 라우팅 오류(EGW00202): 거래소 코드를 모두 시도했지만 라우팅이 실패했습니다. "
                    + "현재 " + envLabel + "계좌 기준 미국 정규장이 닫혀있거나, " + envLabel + "투자에서 거래 불가 종목일 수 있습니다.";
        }
        if ("EGW00201".equals(msgCd)) {
            return "KIS 초당 거래건수 초과(EGW00201): 잠시 후 다시 시도하세요.";
        }
        if ("EGW00105".equals(msgCd)) {
            return "KIS 인증 만료(EGW00105): 브로커 설정에서 토큰을 재발급하세요.";
        }
        return "KIS 주문 거부 (msg_cd=" + msgCd + "): " + msg;
    }
}
