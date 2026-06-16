package com.DevBridge.devbridge.domain.strategy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 소비자 주도 계약(Consumer-Driven Contract) 테스트 — <b>Hard Parts 13장(계약)</b>.
 *
 * <p>BE(소비자)가 Analytics(제공자)의 {@code POST /backtest} 응답에서 <b>반드시 의존하는 필드</b>를
 * 빌드 타임에 못박는다. Analytics 가 응답 모양을 바꿔(필드 삭제/이름변경) 이 계약을 깨면,
 * 운영 런타임이 아니라 여기 CI 에서 잡힌다. BE↔Analytics 는 무형 JSON(느슨한 계약)이라
 * 이런 회귀를 자동으로 못 잡는데(학습 05장 §4), 이 테스트가 그 안전망이다.
 *
 * <p>또한 01장 B-6 의 Jackson 직렬화 함정처럼 "응답이 진짜 데이터인지(메타 garbage 가 아닌지)"도 본다.
 *
 * <p>FIXTURE 는 현재 {@code /backtest} 응답 계약의 대표 형태(vbt_engine.py 출력 키와 일치)다.
 * 실제 Analytics 응답이 바뀌면 이 fixture 를 record-replay 로 갱신하고, 갱신된 fixture 가 아래
 * 단언(=BE 의 하드 의존)을 만족하지 못하면 그게 곧 계약 위반 신호다.
 *
 * <p>외부 의존 없이 JDK 내장 {@link HttpServer} 로 Analytics 를 스텁한다(추가 라이브러리 0).
 */
class AnalyticsClientContractTest {

    private HttpServer server;
    private AnalyticsClient client;

    /** 현재 /backtest 응답 계약(vbt_engine.py 의 stats/equity_curve 키와 동일). 축약본. */
    private static final String BACKTEST_FIXTURE = """
        {
          "strategy": "sma_cross",
          "stats": {
            "total_return_pct": 142.5,
            "annualized_return_pct": 9.3,
            "max_drawdown_pct": -23.1,
            "sharpe": 0.81,
            "sortino": 1.12,
            "calmar": 0.40,
            "win_rate_pct": 54.0,
            "trades": 37,
            "start": "2016-06-01",
            "end": "2026-06-01"
          },
          "equity_curve": [
            { "date": "2016-06-01", "value": 100000.0 },
            { "date": "2016-06-02", "value": 100250.0 }
          ]
        }
        """;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/backtest", exchange -> {
            byte[] body = BACKTEST_FIXTURE.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(body); }
        });
        server.start();

        client = new AnalyticsClient(CircuitBreakerRegistry.ofDefaults(), RetryRegistry.ofDefaults());
        ReflectionTestUtils.setField(client, "baseUrl", "http://127.0.0.1:" + server.getAddress().getPort());
        ReflectionTestUtils.setField(client, "token", "test-token");
        ReflectionTestUtils.setField(client, "timeoutSec", 5);
        ReflectionTestUtils.setField(client, "heavyTimeoutSec", 5);
        ReflectionTestUtils.invokeMethod(client, "init");   // @PostConstruct: CircuitBreaker/Retry 초기화
    }

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void backtest_response_satisfies_consumer_contract() {
        JsonNode res = client.backtest("SPY", "sma_cross", Map.of());

        // (1) 응답은 진짜 데이터 객체여야 한다 — Jackson 메타 garbage("nodeType" 등)가 아니어야 함(01장 B-6).
        assertThat(res.isObject()).as("응답은 JSON object").isTrue();
        assertThat(res.has("nodeType")).as("Jackson 메타 garbage 아님").isFalse();

        // (2) BE 가 의존하는 핵심 계약 필드 — 없거나 타입이 바뀌면 여기서 실패한다.
        JsonNode stats = res.path("stats");
        assertThat(stats.isObject()).as("stats 객체 존재").isTrue();
        assertThat(stats.path("total_return_pct").isNumber()).as("총수익(%) 수치").isTrue();
        assertThat(stats.path("max_drawdown_pct").isNumber()).as("MDD(%) 수치").isTrue();
        assertThat(stats.path("sharpe").isNumber()).as("Sharpe 수치").isTrue();
        assertThat(stats.path("win_rate_pct").isNumber()).as("승률(%) 수치").isTrue();

        JsonNode curve = res.path("equity_curve");
        assertThat(curve.isArray()).as("자산곡선 배열").isTrue();
        assertThat(curve.size()).as("자산곡선 포인트 존재").isGreaterThan(0);
        assertThat(curve.get(0).path("date").isTextual()).as("곡선 포인트 date").isTrue();
        assertThat(curve.get(0).path("value").isNumber()).as("곡선 포인트 value 수치").isTrue();
    }
}
