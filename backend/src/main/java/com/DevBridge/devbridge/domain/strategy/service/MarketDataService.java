package com.DevBridge.devbridge.domain.strategy.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.strategy.entity.MarketOhlcDaily;
import com.DevBridge.devbridge.domain.strategy.entity.Strategy;
import com.DevBridge.devbridge.domain.strategy.repository.MarketOhlcDailyRepository;
import com.DevBridge.devbridge.domain.strategy.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 미국 주식 일봉 OHLC 수집 + DB 캐시.
 *
 * 1차 소스: Stooq CSV (https://stooq.com/q/d/l/?s=tqqq.us&i=d) — 무료, API 키 없음
 * (운영 등급 필요 시 Polygon/Alpha Vantage로 교체 — fetchFromSource()만 변경)
 *
 * 매일 KST 07:00 (월~토)에 활성 전략들의 ticker 일봉을 갱신.
 * (미국장 마감은 KST 익일 새벽 5~6시. 안전 마진 1시간 후 페치)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {

    private static final DateTimeFormatter STOOQ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final MarketOhlcDailyRepository ohlcRepo;
    private final StrategyRepository strategyRepo;

    /**
     * 특정 ticker의 startDate 이후 일봉을 반환.
     * DB에 충분히 있으면 그대로, 부족하면 외부에서 받아 채워 넣은 뒤 반환.
     */
    @Transactional
    public List<MarketOhlcDaily> getDaily(String ticker, LocalDate startDate) {
        String t = ticker.toUpperCase();
        var existing = ohlcRepo.findByTickerAndTradeDateGreaterThanEqualOrderByTradeDateAsc(t, startDate);
        var lastDate = existing.isEmpty() ? null : existing.get(existing.size() - 1).getTradeDate();
        boolean stale = lastDate == null || lastDate.isBefore(LocalDate.now().minusDays(2));
        if (stale) {
            int added = refreshTicker(t, startDate);
            if (added > 0) {
                existing = ohlcRepo.findByTickerAndTradeDateGreaterThanEqualOrderByTradeDateAsc(t, startDate);
            }
        }
        return existing;
    }

    /** 외부에서 받아와 upsert. 새로 추가된 row 수 반환. */
    @Transactional
    public int refreshTicker(String ticker, LocalDate startDate) {
        String t = ticker.toUpperCase();
        List<Row> rows;
        try {
            rows = fetchFromStooq(t, startDate);
        } catch (Exception e) {
            log.warn("[MarketData] {} fetch failed: {}", t, e.getMessage());
            return 0;
        }
        if (rows.isEmpty()) return 0;

        // 기존 날짜 셋 — 새 row만 insert
        var existing = ohlcRepo.findByTickerAndTradeDateGreaterThanEqualOrderByTradeDateAsc(t, startDate)
                .stream().map(MarketOhlcDaily::getTradeDate).collect(Collectors.toSet());

        int added = 0;
        for (Row r : rows) {
            if (existing.contains(r.date)) continue;
            ohlcRepo.save(MarketOhlcDaily.builder()
                    .ticker(t).tradeDate(r.date)
                    .open(BigDecimal.valueOf(r.open))
                    .high(BigDecimal.valueOf(r.high))
                    .low(BigDecimal.valueOf(r.low))
                    .close(BigDecimal.valueOf(r.close))
                    .volume(r.volume)
                    .source("STOOQ")
                    .build());
            added++;
        }
        log.info("[MarketData] {} refreshed +{} rows (start {})", t, added, startDate);
        return added;
    }

    /**
     * 매일 KST 07:00 (월요일~토요일) — 활성 전략들의 ticker를 모두 새로고침.
     * 일요일은 미국장 휴장이라 새 데이터 없음.
     */
    @Scheduled(cron = "0 0 7 * * MON-SAT", zone = "Asia/Seoul")
    public void scheduledRefresh() {
        var tickers = strategyRepo.findByActiveTrue().stream()
                .map(Strategy::getTicker).map(String::toUpperCase)
                .collect(Collectors.toSet());
        if (tickers.isEmpty()) return;
        log.info("[MarketData] daily refresh tickers={}", tickers);
        for (String t : tickers) {
            try {
                refreshTicker(t, LocalDate.now().minusYears(3));
            } catch (Exception e) {
                log.warn("[MarketData] {} scheduled refresh error: {}", t, e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────── Stooq CSV 파서

    private List<Row> fetchFromStooq(String ticker, LocalDate startDate) throws Exception {
        String d1 = startDate.format(STOOQ_DATE);
        String d2 = LocalDate.now().format(STOOQ_DATE);
        String url = "https://stooq.com/q/d/l/?s=" + ticker.toLowerCase() + ".us&d1=" + d1 + "&d2=" + d2 + "&i=d";
        HttpURLConnection con = (HttpURLConnection) URI.create(url).toURL().openConnection();
        con.setRequestMethod("GET");
        con.setConnectTimeout(10_000);
        con.setReadTimeout(15_000);
        con.setRequestProperty("User-Agent", "alpha-helix/1.0");
        int code = con.getResponseCode();
        if (code != 200) throw new RuntimeException("HTTP " + code);

        List<Row> out = new ArrayList<>();
        try (var br = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8))) {
            String line = br.readLine(); // header
            if (line == null || !line.toLowerCase().startsWith("date")) {
                throw new RuntimeException("invalid CSV header: " + line);
            }
            while ((line = br.readLine()) != null) {
                String[] cols = line.split(",");
                if (cols.length < 5) continue;
                try {
                    LocalDate date = LocalDate.parse(cols[0]);
                    double open = Double.parseDouble(cols[1]);
                    double high = Double.parseDouble(cols[2]);
                    double low = Double.parseDouble(cols[3]);
                    double close = Double.parseDouble(cols[4]);
                    long vol = cols.length > 5 && !cols[5].isEmpty() ? (long) Double.parseDouble(cols[5]) : 0L;
                    out.add(new Row(date, open, high, low, close, vol));
                } catch (Exception ignore) { /* skip bad row */ }
            }
        }
        return out;
    }

    private record Row(LocalDate date, double open, double high, double low, double close, long volume) {}
}
