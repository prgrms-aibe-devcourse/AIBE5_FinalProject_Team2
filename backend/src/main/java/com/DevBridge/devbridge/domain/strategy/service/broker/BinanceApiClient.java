package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.payment.service.CryptoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Binance REST API 클라이언트 (Spring Boot 서버 측).
 *
 * - 스팟:   https://api.binance.com
 * - 선물:   https://fapi.binance.com
 * - 테스트넷: env=MOCK → https://testnet.binance.vision (스팟)
 *
 * 보안 규칙:
 *  - API Key는 X-MBX-APIKEY 헤더로만 전달 (URL 파라미터 금지)
 *  - Secret Key는 HMAC-SHA256 서명에만 사용, 절대 네트워크로 전송하지 않음
 *  - Private 엔드포인트는 timestamp + signature 파라미터 필수
 *  - BrokerAccount.tradingEnabled == true 확인은 호출 측(Controller) 책임
 *
 * 참고: https://developers.binance.com/docs/binance-spot-api-docs
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BinanceApiClient {

    private static final String SPOT_HOST        = "https://api.binance.com";
    private static final String SPOT_TESTNET_HOST = "https://testnet.binance.vision";
    private static final String FUTURES_HOST     = "https://fapi.binance.com";

    private final CryptoService crypto;
    private final ObjectMapper  objectMapper = new ObjectMapper();

    // ── 인프라 ────────────────────────────────────────────────────────────────

    private RestClient client(String baseUrl) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    private String spotHost(BrokerAccount b) {
        return b.getEnv() == BrokerAccount.Env.MOCK ? SPOT_TESTNET_HOST : SPOT_HOST;
    }

    private String futuresHost(BrokerAccount b) {
        // Binance 선물 테스트넷: https://testnet.binancefuture.com (별도 계정 필요)
        // 현재 MOCK env에서도 실제 fapi를 사용하되, 별도 테스트넷 계정이 있으면 환경변수로 분기 가능
        return FUTURES_HOST;
    }

    private String decryptSecret(BrokerAccount b) {
        return crypto.decrypt(b.getBinanceApiSecretEnc());
    }

    // ── HMAC-SHA256 서명 ──────────────────────────────────────────────────────

    /**
     * Binance 서명: HMAC-SHA256(queryString, secretKey) → HEX
     */
    private String sign(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (Exception e) {
            throw new RuntimeException("Binance sign failed", e);
        }
    }

    /** 파라미터 Map을 쿼리스트링으로 변환 (순서 보장 — LinkedHashMap 사용). */
    private String toQueryString(Map<String, Object> params) {
        var sb = new StringBuilder();
        params.forEach((k, v) -> {
            if (!sb.isEmpty()) sb.append('&');
            sb.append(k).append('=').append(v);
        });
        return sb.toString();
    }

    /** timestamp + signature가 추가된 쿼리스트링 반환. */
    private String signedQuery(Map<String, Object> params, String secret) {
        // timestamp는 항상 마지막 전에 삽입 (signature는 맨 마지막)
        params.put("timestamp", System.currentTimeMillis());
        String qs = toQueryString(params);
        return qs + "&signature=" + sign(qs, secret);
    }

    // ── Public 엔드포인트 ──────────────────────────────────────────────────────

    /** 서버 연결 테스트 (인증 불필요). */
    public boolean ping(BrokerAccount b) {
        try {
            client(spotHost(b)).get().uri("/api/v3/ping").retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("Binance ping failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 24시간 통계 (현재가, 변동률, 거래량).
     * @param symbol 예) BTCUSDT
     */
    public Map<String, Object> getTicker24h(BrokerAccount b, String symbol) {
        String json = client(spotHost(b)).get()
                .uri("/api/v3/ticker/24hr?symbol=" + symbol)
                .retrieve()
                .body(String.class);
        return parseMap(json);
    }

    /**
     * 오더북 조회.
     * @param depth 호가 건수 (5 | 10 | 20 | 50 | 100 | 500 | 1000)
     */
    public Map<String, Object> getOrderBook(BrokerAccount b, String symbol, int depth) {
        String json = client(spotHost(b)).get()
                .uri("/api/v3/depth?symbol=" + symbol + "&limit=" + depth)
                .retrieve()
                .body(String.class);
        return parseMap(json);
    }

    /**
     * 선물 펀딩레이트 조회 (최근 N건).
     */
    public List<Map<String, Object>> getFundingRate(BrokerAccount b, String symbol, int limit) {
        String json = client(futuresHost(b)).get()
                .uri("/fapi/v1/fundingRate?symbol=" + symbol + "&limit=" + limit)
                .retrieve()
                .body(String.class);
        return parseList(json);
    }

    // ── Private: 계정 조회 ─────────────────────────────────────────────────────

    /**
     * 스팟 계정 잔고 조회.
     * @return { "balances": [{"asset":"BTC","free":"0.001","locked":"0"},...], "totalUsdtValue": 1234.56 }
     */
    public Map<String, Object> getSpotBalance(BrokerAccount b) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        String qs = signedQuery(params, secret);

        String json = client(spotHost(b)).get()
                .uri("/api/v3/account?" + qs)
                .header("X-MBX-APIKEY", b.getBinanceApiKey())
                .retrieve()
                .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(json);
            List<Map<String, Object>> nonZero = new ArrayList<>();
            double totalUsdt = 0.0;
            for (JsonNode node : root.get("balances")) {
                double free = Double.parseDouble(node.get("free").asText("0"));
                double locked = Double.parseDouble(node.get("locked").asText("0"));
                if (free + locked > 1e-10) {
                    String asset = node.get("asset").asText();
                    nonZero.add(Map.of("asset", asset, "free", free, "locked", locked));
                    if ("USDT".equals(asset)) totalUsdt += free + locked;
                }
            }
            return Map.of(
                "balances", nonZero,
                "totalUsdtValue", totalUsdt,
                "accountType", root.path("accountType").asText("SPOT"),
                "canTrade", root.path("canTrade").asBoolean(false)
            );
        } catch (Exception e) {
            throw new RuntimeException("getSpotBalance parse failed: " + e.getMessage(), e);
        }
    }

    /**
     * 선물 계정 잔고 + 포지션 조회.
     */
    public Map<String, Object> getFuturesBalance(BrokerAccount b) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        String qs = signedQuery(params, secret);

        String json = client(futuresHost(b)).get()
                .uri("/fapi/v2/account?" + qs)
                .header("X-MBX-APIKEY", b.getBinanceApiKey())
                .retrieve()
                .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(json);
            List<Map<String, Object>> openPositions = new ArrayList<>();
            if (root.has("positions")) {
                for (JsonNode pos : root.get("positions")) {
                    double amt = Double.parseDouble(pos.path("positionAmt").asText("0"));
                    if (Math.abs(amt) > 1e-10) {
                        openPositions.add(Map.of(
                            "symbol",       pos.path("symbol").asText(),
                            "positionAmt",  amt,
                            "entryPrice",   pos.path("entryPrice").asText("0"),
                            "unrealizedPnl",pos.path("unrealizedProfit").asText("0"),
                            "leverage",     pos.path("leverage").asText("1")
                        ));
                    }
                }
            }
            return Map.of(
                "totalWalletBalance",     root.path("totalWalletBalance").asDouble(0),
                "totalUnrealizedProfit",  root.path("totalUnrealizedProfit").asDouble(0),
                "availableBalance",       root.path("availableBalance").asDouble(0),
                "openPositions",          openPositions
            );
        } catch (Exception e) {
            throw new RuntimeException("getFuturesBalance parse failed: " + e.getMessage(), e);
        }
    }

    // ── Private: 주문 ─────────────────────────────────────────────────────────

    /**
     * 스팟 주문.
     *
     * @param symbol   예) BTCUSDT
     * @param side     BUY | SELL
     * @param type     MARKET | LIMIT
     * @param qty      수량 (MARKET BUY는 quoteOrderQty가 더 일반적이나 여기서는 qty 통일)
     * @param price    LIMIT 주문 가격 (MARKET 무시)
     */
    public Map<String, Object> placeSpotOrder(
            BrokerAccount b, String symbol, String side, String type, String qty, String price) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("symbol", symbol);
        params.put("side", side);
        params.put("type", type);
        params.put("quantity", qty);
        if ("LIMIT".equalsIgnoreCase(type)) {
            params.put("timeInForce", "GTC");
            params.put("price", price);
        }
        String qs = signedQuery(params, secret);

        try {
            String json = client(spotHost(b)).post()
                    .uri("/api/v3/order")
                    .header("X-MBX-APIKEY", b.getBinanceApiKey())
                    .contentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED)
                    .body(qs)
                    .retrieve()
                    .body(String.class);
            return parseMap(json);
        } catch (RestClientResponseException e) {
            String msg = e.getResponseBodyAsString();
            log.warn("Binance spot order failed {}: {}", symbol, msg);
            throw new RuntimeException("Binance spot order failed: " + msg, e);
        }
    }

    /**
     * 선물 주문 (USDT-M 영구 선물).
     *
     * @param reduceOnly 청산 전용 주문 여부
     */
    public Map<String, Object> placeFuturesOrder(
            BrokerAccount b, String symbol, String side, String type,
            String qty, String price, boolean reduceOnly) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("symbol", symbol);
        params.put("side", side);
        params.put("type", type);
        params.put("quantity", qty);
        if ("LIMIT".equalsIgnoreCase(type)) {
            params.put("timeInForce", "GTC");
            params.put("price", price);
        }
        if (reduceOnly) params.put("reduceOnly", "true");
        String qs = signedQuery(params, secret);

        try {
            String json = client(futuresHost(b)).post()
                    .uri("/fapi/v1/order")
                    .header("X-MBX-APIKEY", b.getBinanceApiKey())
                    .contentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED)
                    .body(qs)
                    .retrieve()
                    .body(String.class);
            return parseMap(json);
        } catch (RestClientResponseException e) {
            String msg = e.getResponseBodyAsString();
            log.warn("Binance futures order failed {}: {}", symbol, msg);
            throw new RuntimeException("Binance futures order failed: " + msg, e);
        }
    }

    /**
     * 선물 레버리지 설정 (1x ~ 125x).
     */
    public Map<String, Object> setLeverage(BrokerAccount b, String symbol, int leverage) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("symbol", symbol);
        params.put("leverage", leverage);
        String qs = signedQuery(params, secret);

        String json = client(futuresHost(b)).post()
                .uri("/fapi/v1/leverage")
                .header("X-MBX-APIKEY", b.getBinanceApiKey())
                .contentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED)
                .body(qs)
                .retrieve()
                .body(String.class);
        return parseMap(json);
    }

    /**
     * 미체결 주문 취소 (스팟).
     */
    public Map<String, Object> cancelSpotOrder(BrokerAccount b, String symbol, long orderId) {
        String secret = decryptSecret(b);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("symbol", symbol);
        params.put("orderId", orderId);
        String qs = signedQuery(params, secret);

        String json = client(spotHost(b)).delete()
                .uri("/api/v3/order?" + qs)
                .header("X-MBX-APIKEY", b.getBinanceApiKey())
                .retrieve()
                .body(String.class);
        return parseMap(json);
    }

    // ── 내부 유틸 ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseMap(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Binance response parse failed: " + json, e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseList(String json) {
        try {
            return objectMapper.readValue(json, List.class);
        } catch (Exception e) {
            throw new RuntimeException("Binance response parse failed: " + json, e);
        }
    }
}
