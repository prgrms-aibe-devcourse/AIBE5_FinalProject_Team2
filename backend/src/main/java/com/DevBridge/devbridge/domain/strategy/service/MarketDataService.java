package com.DevBridge.devbridge.domain.strategy.service;

import com.DevBridge.devbridge.domain.strategy.entity.MarketOhlcDaily;
import com.DevBridge.devbridge.domain.strategy.entity.Strategy;
import com.DevBridge.devbridge.domain.strategy.repository.MarketOhlcDailyRepository;
import com.DevBridge.devbridge.domain.strategy.repository.StrategyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 미국 주식 일봉 OHLC 수집 + DB 캐시.
 *
 * 1차 소스: Yahoo Finance v8 chart API — 무료, API 키 없음
 * (Stooq 는 2025년부터 JS PoW 봇탐지 도입으로 서버사이드 접근 불가)
 *
 * 매일 KST 07:00 (월~토)에 활성 전략들의 ticker 일봉을 갱신.
 * (미국장 마감은 KST 익일 새벽 5~6시. 안전 마진 1시간 후 페치)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketDataService {

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
            // 이미 로드한 existing을 날짜 셋으로 변환해 refreshTicker에 전달 — 중복 쿼리 방지
            var existingDates = existing.stream()
                    .map(MarketOhlcDaily::getTradeDate)
                    .collect(Collectors.toSet());
            int added = refreshTicker(t, startDate, existingDates);
            if (added > 0) {
                existing = ohlcRepo.findByTickerAndTradeDateGreaterThanEqualOrderByTradeDateAsc(t, startDate);
            }
        }
        return existing;
    }

    /** 외부에서 받아와 upsert. 새로 추가된 row 수 반환. */
    @Transactional
    public int refreshTicker(String ticker, LocalDate startDate) {
        return refreshTicker(ticker, startDate, null);
    }

    /**
     * 외부에서 받아와 upsert. existingDates가 null이면 DB에서 조회.
     * saveAll로 배치 INSERT — 개별 save보다 최대 수백 배 빠름.
     */
    @Transactional
    public int refreshTicker(String ticker, LocalDate startDate, Set<LocalDate> existingDates) {
        String t = ticker.toUpperCase();
        List<Row> rows;
        try {
            // 크립토(…USDT)는 Binance 일봉 klines, 그 외는 Stooq(미국주식).
            rows = isCrypto(t) ? fetchFromBinance(t, startDate) : fetchFromYahoo(t, startDate);
        } catch (Exception e) {
            log.warn("[MarketData] {} fetch failed: {}", t, e.getMessage());
            return 0;
        }
        if (rows.isEmpty()) return 0;

        // 기존 날짜 셋 — 전달받지 못한 경우에만 DB 조회
        Set<LocalDate> known = existingDates != null ? existingDates :
                ohlcRepo.findByTickerAndTradeDateGreaterThanEqualOrderByTradeDateAsc(t, startDate)
                        .stream().map(MarketOhlcDaily::getTradeDate).collect(Collectors.toSet());

        String source = isCrypto(t) ? "BINANCE" : "STOOQ";
        List<MarketOhlcDaily> toInsert = rows.stream()
                .filter(r -> !known.contains(r.date))
                .map(r -> MarketOhlcDaily.builder()
                        .ticker(t).tradeDate(r.date)
                        .open(BigDecimal.valueOf(r.open))
                        .high(BigDecimal.valueOf(r.high))
                        .low(BigDecimal.valueOf(r.low))
                        .close(BigDecimal.valueOf(r.close))
                        .volume(r.volume)
                        .source(source)
                        .build())
                .collect(Collectors.toList());

        if (!toInsert.isEmpty()) ohlcRepo.saveAll(toInsert);
        log.info("[MarketData] {} refreshed +{} rows (start {})", t, toInsert.size(), startDate);
        return toInsert.size();
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

    // ─────────────────────────────────────── Yahoo Finance chart API (미국주식)

    /**
     * Stooq 는 2025년 이후 JavaScript PoW 봇탐지를 도입해 서버사이드 HttpURLConnection 으로
     * 접근 불가. Yahoo Finance v8 chart API(인증 불필요)로 교체.
     */
    private List<Row> fetchFromYahoo(String ticker, LocalDate startDate) throws Exception {
        long period1 = startDate.atStartOfDay(ZoneOffset.UTC).toInstant().getEpochSecond();
        long period2 = LocalDate.now().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().getEpochSecond();
        String url = "https://query2.finance.yahoo.com/v8/finance/chart/" + ticker.toUpperCase()
                + "?interval=1d&period1=" + period1 + "&period2=" + period2;
        HttpURLConnection con = (HttpURLConnection) URI.create(url).toURL().openConnection();
        con.setRequestMethod("GET");
        con.setConnectTimeout(10_000);
        con.setReadTimeout(20_000);
        con.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        con.setRequestProperty("Accept", "application/json");
        int code = con.getResponseCode();
        if (code != 200) throw new RuntimeException("Yahoo HTTP " + code);

        JsonNode root;
        try (var is = con.getInputStream()) { root = om.readTree(is); }
        JsonNode result = root.path("chart").path("result");
        if (!result.isArray() || result.isEmpty())
            throw new RuntimeException("Yahoo: 빈 result");

        JsonNode meta     = result.get(0).path("meta");
        JsonNode tsArr    = result.get(0).path("timestamp");
        JsonNode quote    = result.get(0).path("indicators").path("quote").get(0);
        if (!tsArr.isArray() || quote == null)
            throw new RuntimeException("Yahoo: 타임스탬프/quote 누락");

        List<Row> out = new ArrayList<>();
        for (int i = 0; i < tsArr.size(); i++) {
            long ts = tsArr.get(i).asLong();
            LocalDate date = Instant.ofEpochSecond(ts).atZone(ZoneOffset.UTC).toLocalDate();
            JsonNode o = quote.path("open").get(i);
            JsonNode h = quote.path("high").get(i);
            JsonNode l = quote.path("low").get(i);
            JsonNode c = quote.path("close").get(i);
            JsonNode v = quote.path("volume").get(i);
            if (o == null || o.isNull() || c == null || c.isNull()) continue; // 장중 미완성 캔들 스킵
            out.add(new Row(date, o.asDouble(), h.asDouble(), l.asDouble(), c.asDouble(),
                    v != null && !v.isNull() ? v.asLong() : 0L));
        }
        return out;
    }

    // ─────────────────────────────────────── Binance 일봉 klines (크립토)

    /** 크립토 티커(…USDT)는 Binance 공개 klines 로 일봉 수집. data-api 호스트(공개 마켓데이터, 인증/지역제한 없음). */
    private List<Row> fetchFromBinance(String ticker, LocalDate startDate) throws Exception {
        List<Row> out = new ArrayList<>();
        long startMs = startDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        long now = System.currentTimeMillis();
        // klines 는 1회 최대 1000개 → closeTime 으로 페이지네이션
        while (startMs < now) {
            String url = "https://data-api.binance.vision/api/v3/klines?symbol=" + ticker.toUpperCase()
                    + "&interval=1d&startTime=" + startMs + "&limit=1000";
            HttpURLConnection con = (HttpURLConnection) URI.create(url).toURL().openConnection();
            con.setRequestMethod("GET");
            con.setConnectTimeout(10_000);
            con.setReadTimeout(20_000);
            con.setRequestProperty("User-Agent", "alpha-helix/1.0");
            int code = con.getResponseCode();
            if (code != 200) throw new RuntimeException("HTTP " + code);

            JsonNode arr;
            try (var is = con.getInputStream()) { arr = om.readTree(is); }
            if (arr == null || !arr.isArray() || arr.isEmpty()) break;

            long lastClose = 0;
            for (JsonNode k : arr) {
                // [openTime, open, high, low, close, volume, closeTime, ...]
                long openTime = k.get(0).asLong();
                LocalDate date = Instant.ofEpochMilli(openTime).atZone(ZoneOffset.UTC).toLocalDate();
                double open = k.get(1).asDouble(), high = k.get(2).asDouble(),
                       low = k.get(3).asDouble(), close = k.get(4).asDouble();
                long vol = (long) k.get(5).asDouble();
                out.add(new Row(date, open, high, low, close, vol));
                lastClose = k.get(6).asLong();
            }
            if (arr.size() < 1000) break;
            startMs = lastClose + 1;
        }
        return out;
    }

    /** 크립토 페어 판별 — 현재 SPOT 범위(…USDT). */
    private static boolean isCrypto(String ticker) {
        return ticker != null && ticker.toUpperCase().endsWith("USDT");
    }

    private final ObjectMapper om = new ObjectMapper();

    private record Row(LocalDate date, double open, double high, double low, double close, long volume) {}
}
