package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.strategy.service.AnalyticsClient;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Bridge controller exposing the Alpha-Helix Python analytics sidecar to the frontend.
 * All endpoints require the user to be authenticated (Spring Security covers /api/**).
 *
 * Heavy quant logic (yfinance / vectorbt / QuantStats / SHAP / XGBoost) runs in
 * the Python service at app.analytics.base-url.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Slf4j
public class AnalyticsController {

    private final AnalyticsClient analytics;

    @GetMapping("/health")
    public Map<String, Object> health() {
        boolean ok = analytics.isHealthy();
        return Map.of("analytics", ok ? "up" : "down");
    }

    /**
     * Run a vectorbt backtest on yfinance data.
     * Body: { ticker, period, strategy, sma_fast, sma_slow, ... }
     */
    @PostMapping("/backtest")
    public ResponseEntity<JsonNode> backtest(@RequestBody Map<String, Object> body) {
        String ticker = (String) body.get("ticker");
        if (ticker == null || ticker.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String strategy = (String) body.getOrDefault("strategy", "sma_cross");
        Map<String, Object> extra = new HashMap<>(body);
        extra.remove("ticker");
        extra.remove("strategy");
        return ResponseEntity.ok(analytics.backtest(ticker, strategy, extra));
    }

    /**
     * Today's signals for a list of tickers (with optional ML probability + SHAP explanation).
     * Body: { tickers: [...], strategy, include_ml }
     */
    @PostMapping("/signals/today")
    @SuppressWarnings("unchecked")
    public ResponseEntity<JsonNode> todaySignals(@RequestBody Map<String, Object> body) {
        List<String> tickers = (List<String>) body.getOrDefault("tickers", List.of());
        String strategy = (String) body.getOrDefault("strategy", "sma_cross");
        boolean includeMl = Boolean.TRUE.equals(body.getOrDefault("include_ml", true));
        return ResponseEntity.ok(analytics.todaySignals(tickers, strategy, includeMl));
    }

    /** Train the XGBoost direction classifier for one ticker. */
    @PostMapping("/models/train")
    public ResponseEntity<JsonNode> train(@RequestBody Map<String, Object> body) {
        String ticker = (String) body.get("ticker");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(analytics.trainModel(ticker));
    }

    /** Walk-forward out-of-sample validation. */
    @PostMapping("/robust/walk-forward")
    public ResponseEntity<JsonNode> walkForward(@RequestBody Map<String, Object> body) {
        String ticker = (String) body.get("ticker");
        String strategy = (String) body.getOrDefault("strategy", "sma_cross");
        if (ticker == null || ticker.isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(analytics.walkForward(ticker, strategy));
    }
}
