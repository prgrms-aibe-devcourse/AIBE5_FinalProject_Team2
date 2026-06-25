package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.service.MarketDataService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * KIS(한국투자증권 해외주식) 어댑터 — 기존 {@link KisApiClient} 를 그대로 위임. KIS 로직 무수정.
 *
 * <p>주문 정수화(주식은 정수 수량), KIS rt_cd/msg_cd → 정규화 OrderResult,
 * inquire-ccnl(체결내역 CCLD_NCCS_DVSN=00) → 정규화 FillResult 로 변환한다.
 *
 * <p>체결 판정 규칙:
 * <ul>
 *   <li>목록에 있고 nccs_qty=0 → FILLED (전량 체결)</li>
 *   <li>목록에 있고 nccs_qty &gt; 0 but filledQty &gt; 0 → PARTIAL (일부 체결)</li>
 *   <li>목록에 있고 filledQty=0 → OPEN (미체결)</li>
 *   <li>목록에 없음 → OPEN 유지 (접수 거부/취소 가능성, 섣불리 FILLED 처리 금지)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KisBrokerAdapter implements Broker {

    private final KisApiClient kis;
    private final MarketDataService marketData; // 모의투자 해외시세 미지원 시 DB 최근 종가로 폴백

    @Override
    public BrokerAccount.BrokerType type() {
        return BrokerAccount.BrokerType.KIS;
    }

    @Override
    public OrderResult placeOrder(BrokerAccount b, String symbol, Side side, BigDecimal qty, BigDecimal limitPrice, OrderType orderType) {
        try {
            KisApiClient.Side ks = side == Side.BUY ? KisApiClient.Side.BUY : KisApiClient.Side.SELL;
            long q = qty.setScale(0, RoundingMode.DOWN).longValue();
            Double lim = limitPrice == null ? null : limitPrice.doubleValue();

            Map<String, Object> resp;
            if (KisApiClient.isDomesticTicker(symbol)) {
                // 국내주식: 6자리 숫자 종목코드. 시장가는 placeDomesticOrder 내부에서 ORD_DVSN=01로 처리.
                resp = kis.placeDomesticOrder(b, symbol, ks, q, lim);
            } else {
                // 해외주식
                // LOC=장마감지정가(34)는 REAL 전용 — KIS 모의투자는 00(지정가)만 지원.
                boolean realLoc = orderType == OrderType.LOC && b.getEnv() == BrokerAccount.Env.REAL;
                String ordDvsn = realLoc ? kis.locOrdDvsn() : KisApiClient.ORD_DVSN_LIMIT;
                // 단가 null이면 현재가 조회로 대체 (0원 전송 방지).
                if (lim == null) {
                    try {
                        Map<String, Object> quote = kis.getOverseasQuote(b, symbol);
                        Object lp = quote.get("last_price");
                        double px = lp instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(lp));
                        if (px > 0) lim = px;
                    } catch (Exception e) {
                        log.warn("[KIS] {} 지정가 산정용 시세 조회 예외: {}", symbol, e.getMessage());
                    }
                    // KIS 모의투자 도메인은 해외 시세(HHDFS00000300)를 제대로 안 줘서 0 반환 → 우리 DB 최근 종가로 폴백.
                    // 지정가(LIMIT) 주문이라 종가가 다소 과거여도 안전(가격 보호 — 시세 어긋나면 미체결일 뿐 과지불 없음).
                    if (lim == null) {
                        try {
                            var rows = marketData.getDaily(symbol, java.time.LocalDate.now().minusDays(14));
                            if (rows != null && !rows.isEmpty()) {
                                double close = rows.get(rows.size() - 1).getClose().doubleValue();
                                if (close > 0) { lim = close; log.info("[KIS] {} 시세 DB 종가 폴백 사용: {}", symbol, close); }
                            }
                        } catch (Exception e) {
                            log.warn("[KIS] {} DB 종가 폴백 실패: {}", symbol, e.getMessage());
                        }
                    }
                    if (lim == null) {
                        return OrderResult.failure("NO_QUOTE",
                                "KIS 지정가 산정 실패: " + symbol + " 현재가·DB 종가 모두 조회 불가로 0원 전송을 막았습니다. 잠시 후 다시 시도하세요.");
                    }
                }
                resp = kis.placeOverseasOrder(b, symbol, ks, q, lim, ordDvsn);
            }

            String rtCd = String.valueOf(resp.getOrDefault("rt_cd", ""));
            if (!"0".equals(rtCd)) {
                String msgCd = String.valueOf(resp.getOrDefault("msg_cd", ""));
                String msg   = String.valueOf(resp.getOrDefault("msg", ""));
                return OrderResult.failure(msgCd, friendlyKisError(msgCd, msg, b));
            }
            return OrderResult.success(String.valueOf(resp.getOrDefault("kis_order_no", "")), rtCd);
        } catch (Exception e) {
            return OrderResult.failure(null, e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
        }
    }

    @Override
    public FillResult queryFill(BrokerAccount b, OrderProposal p) {
        boolean domestic = KisApiClient.isDomesticTicker(p.getTicker());
        JsonNode resp;
        try {
            resp = domestic ? kis.getDomesticTodayOrders(b) : kis.getTodayOrders(b);
        } catch (Exception e) {
            return FillResult.error("KIS 미체결조회 실패: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        }
        // 국내: output1 배열 / 해외: output 배열
        JsonNode output = resp == null ? null
                : (domestic ? resp.path("output1") : resp.path("output"));
        JsonNode match = null;
        if (output != null && output.isArray()) {
            for (JsonNode o : output) {
                if (p.getKisOrderNo().equals(o.path("odno").asText())) { match = o; break; }
            }
        }
        String fillStatus;
        int filledQty;
        BigDecimal avgPrice = null;
        if (match != null) {
            int orderQty = firstInt(match, "ft_ord_qty", "ord_qty", "ar_qty");
            int nccsQty  = firstInt(match, "nccs_qty", "rmn_qty", "ord_psbl_qty");
            filledQty = Math.max(0, orderQty - nccsQty);
            if (nccsQty == 0 && orderQty > 0) {
                fillStatus = "FILLED";
            } else if (filledQty > 0) {
                fillStatus = "PARTIAL";
            } else {
                fillStatus = "OPEN";
            }
            // 해외: ft_ccld_unpr / avg_unpr  국내: avg_unpr3 (체결평균가)
            String unpr = firstStr(match, "ft_ccld_unpr", "avg_unpr3", "avg_unpr");
            if (!unpr.isEmpty() && !"0".equals(unpr)) {
                try { avgPrice = new BigDecimal(unpr); } catch (Exception ignore) { }
            }
        } else {
            log.warn("[KIS] 주문번호 {} ({}) 가 오늘 주문내역에 없음 — OPEN 유지.",
                    p.getKisOrderNo(), domestic ? "국내" : "해외");
            fillStatus = "OPEN";
            filledQty  = 0;
        }
        return FillResult.of(fillStatus, BigDecimal.valueOf(filledQty), avgPrice);
    }

    @Override
    public Map<String, Object> getBalance(BrokerAccount b) {
        return kis.getOverseasBalance(b);
    }

    @Override
    public void invalidateBalanceCache(BrokerAccount b) {
        kis.invalidateBalance(b);
    }

    @Override
    public Map<String, Object> getQuote(BrokerAccount b, String symbol) {
        return KisApiClient.isDomesticTicker(symbol)
                ? kis.getDomesticQuote(b, symbol)
                : kis.getOverseasQuote(b, symbol);
    }

    /** KIS 응답에서 여러 후보 키 중 첫 정수값 추출 (필드명 방어적 파싱). */
    private static int firstInt(JsonNode n, String... keys) {
        for (String k : keys) {
            String s = n.path(k).asText("").trim();
            if (s.matches("-?\\d+")) return Integer.parseInt(s);
        }
        return 0;
    }

    /** KIS 응답에서 여러 후보 키 중 첫 비어있지 않은 문자열 추출. */
    private static String firstStr(JsonNode n, String... keys) {
        for (String k : keys) {
            String s = n.path(k).asText("").trim();
            if (!s.isEmpty()) return s;
        }
        return "";
    }

    /** KIS msg_cd → 사용자 친화 메시지. */
    private static String friendlyKisError(String msgCd, String msg, BrokerAccount ba) {
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
