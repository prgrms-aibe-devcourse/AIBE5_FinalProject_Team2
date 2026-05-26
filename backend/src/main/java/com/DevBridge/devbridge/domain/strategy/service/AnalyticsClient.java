package com.DevBridge.devbridge.domain.strategy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * HTTP client for the Alpha-Helix Python analytics sidecar.
 * All heavy quant logic (yfinance, vectorbt, QuantStats, SHAP, XGBoost) lives there.
 *
 * 개선 사항:
 *  - Resilience4j CircuitBreaker: 10회 중 50% 실패 시 30초 OPEN (Python 사이드카 다운 시 빠른 실패)
 *  - Resilience4j Retry: 최대 3회 재시도, 2초 대기 (일시적 네트워크 오류 대응)
 *  - 4xx(클라이언트 오류)는 재시도 제외 — 잘못된 파라미터 반복 호출 방지
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AnalyticsClient {

    @Value("${app.analytics.base-url}")
    private String baseUrl;

    @Value("${app.analytics.internal-token}")
    private String token;

    @Value("${app.analytics.timeout-sec:30}")
    private int timeoutSec;

    private final ObjectMapper om = new ObjectMapper();
    private final CircuitBreakerRegistry cbRegistry;
    private final RetryRegistry retryRegistry;

    private CircuitBreaker circuitBreaker;
    private Retry retry;

    @PostConstruct
    void init() {
        circuitBreaker = cbRegistry.circuitBreaker("analytics");
        retry = retryRegistry.retry("analytics");
    }

    private HttpClient client() {
        return HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /** 실제 HTTP 호출. 4xx는 재시도 없는 ClientError로 래핑. */
    private JsonNode callOnce(String path, String method, Object body) {
        try {
            String payload = body == null ? "" : om.writeValueAsString(body);
            byte[] payloadBytes = payload.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            log.info("analytics CALL {} {} payload-len={}", method, path, payloadBytes.length);
            HttpRequest.Builder b = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + path))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("Accept", "application/json")
                    .header("X-Internal-Token", token)
                    .timeout(Duration.ofSeconds(timeoutSec));
            HttpRequest req = switch (method) {
                case "GET" -> b.GET().build();
                case "POST" -> b.POST(HttpRequest.BodyPublishers.ofByteArray(payloadBytes)).build();
                default -> throw new IllegalArgumentException("method " + method);
            };
            HttpResponse<String> resp = client().send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 400 && resp.statusCode() < 500) {
                // 4xx — 클라이언트 오류: 재시도 무의미, Circuit Breaker 카운트 제외
                log.warn("analytics {} {} → HTTP {} (client error, no retry)", method, path, resp.statusCode());
                throw new AnalyticsException.ClientError(
                        "analytics client error HTTP " + resp.statusCode() + ": " + resp.body());
            }
            if (resp.statusCode() >= 500) {
                log.warn("analytics {} {} → HTTP {} (server error)", method, path, resp.statusCode());
                throw new AnalyticsException("analytics server error HTTP " + resp.statusCode() + ": " + resp.body());
            }
            return om.readTree(resp.body());
        } catch (AnalyticsException e) {
            throw e;
        } catch (Exception e) {
            log.error("analytics call failed {} {}", method, path, e);
            throw new AnalyticsException("analytics call failed: " + e.getMessage(), e);
        }
    }

    /** Retry + CircuitBreaker 래핑 호출 */
    private JsonNode call(String path, String method, Object body) {
        Supplier<JsonNode> decorated = CircuitBreaker.decorateSupplier(
                circuitBreaker,
                Retry.decorateSupplier(retry, () -> callOnce(path, method, body))
        );
        try {
            return decorated.get();
        } catch (AnalyticsException.ClientError e) {
            throw e; // 클라이언트 오류는 그대로 전파
        } catch (io.github.resilience4j.circuitbreaker.CallNotPermittedException e) {
            log.warn("analytics circuit OPEN — fast fail for {} {}", method, path);
            throw new AnalyticsException("Analytics 서비스가 일시적으로 사용 불가합니다. 잠시 후 다시 시도해주세요.");
        } catch (Exception e) {
            if (e instanceof AnalyticsException ae) throw ae;
            throw new AnalyticsException("analytics call failed: " + e.getMessage(), e);
        }
    }

    /** GET /health — used for liveness check from Spring. */
    public boolean isHealthy() {
        try {
            JsonNode n = callOnce("/health", "GET", null); // health check는 CB 우회
            return "ok".equals(n.path("status").asText());
        } catch (Exception e) {
            return false;
        }
    }

    /** POST /backtest — run vectorbt backtest. */
    public JsonNode backtest(String ticker, String strategy, Map<String, Object> extra) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("ticker", ticker);
        body.put("strategy", strategy == null ? "sma_cross" : strategy);
        if (extra != null) body.putAll(extra);
        return call("/backtest", "POST", body);
    }

    /** POST /signals/today — daily signal batch (used by 22:30 KST scheduler). */
    public JsonNode todaySignals(List<String> tickers, String strategy, boolean includeMl) {
        return call("/signals/today", "POST", Map.of(
                "tickers", tickers,
                "strategy", strategy == null ? "sma_cross" : strategy,
                "include_ml", includeMl
        ));
    }

    /** POST /models/train — train XGBoost classifier for one ticker. */
    public JsonNode trainModel(String ticker) {
        return call("/models/train", "POST", Map.of("ticker", ticker, "period", "5y"));
    }

    /** POST /robust/walk-forward — out-of-sample validation. */
    public JsonNode walkForward(String ticker, String strategy) {
        return call("/robust/walk-forward", "POST", Map.of(
                "ticker", ticker,
                "strategy", strategy == null ? "sma_cross" : strategy,
                "period", "10y"
        ));
    }

    /** GET /price/latest?ticker=XXX */
    public Double latestClose(String ticker) {
        try {
            JsonNode n = callOnce("/price/latest?ticker=" + ticker, "GET", null);
            return n.path("close").isNumber() ? n.path("close").asDouble() : null;
        } catch (Exception e) {
            log.warn("latestClose failed for {}: {}", ticker, e.getMessage());
            return null;
        }
    }

    /** POST /regime — market regime analysis (bull/bear/sideways/high-vol). */
    public JsonNode regime(String ticker) {
        return call("/regime", "POST", Map.of("ticker", ticker, "period", "5y"));
    }

    /** POST /trust — composite Trust Score (0~100) from multiple robustness checks. */
    public JsonNode trustScore(String ticker, String strategy) {
        return call("/trust", "POST", Map.of(
                "ticker", ticker,
                "strategy", strategy == null ? "sma_cross" : strategy
        ));
    }

    /** POST /backtest/infinite-buying — 무한매수법 백테스트. */
    public JsonNode infiniteBuying(List<String> tickers, Map<String, Object> extra) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("tickers", tickers);
        body.put("period", "10y");
        if (extra != null) body.putAll(extra);
        return call("/backtest/infinite-buying", "POST", body);
    }

    /** POST /orders/infinite-buying/plan — 다음 거래일 주문 계획. */
    public JsonNode infiniteBuyingPlan(List<String> tickers, Map<String, Object> extra) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("tickers", tickers);
        body.put("period", "10y");
        if (extra != null) body.putAll(extra);
        return call("/orders/infinite-buying/plan", "POST", body);
    }

    public static class AnalyticsException extends RuntimeException {
        public AnalyticsException(String m) { super(m); }
        public AnalyticsException(String m, Throwable t) { super(m, t); }

        /** 4xx 클라이언트 오류 — 재시도 제외 대상 */
        public static class ClientError extends AnalyticsException {
            public ClientError(String m) { super(m); }
        }
    }
}

