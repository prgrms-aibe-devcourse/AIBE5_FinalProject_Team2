package com.DevBridge.devbridge.domain.ai.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 연리무한매수법 "대표 포트폴리오" — 검증된 strategyConfig 단일 소스(SSOT).
 *
 * <p>실제 사용자(이효연) 5월 실현손익 ₩8,026,367 대비 백테스트 0.88x 재현으로 검증된 파라미터.
 * doFormalize 시스템프롬프트·InfiniteBuyingController.create 분기에 흩어져 있던 연리 상수를
 * 한 곳에 모아 표류(duplicate-key drift)를 막는다.
 *
 * <p>규칙: TQQQ/SOXL 40분할, 평단×1.13 익절(1주 남김), 평단×1.10 이내 보통가 매수,
 * 익절 직후 0.5분할 보통가 재매수로 평단 재기준(랠리 사다리타기), 종목 가중 0.87:0.13, 고정 일매수.
 */
public final class YeonriPreset {

    private YeonriPreset() {}

    public static final String PRESET_ID = "preset-yeonri";
    public static final String STRATEGY_NAME = "연리 무한매수법 (대표 포트폴리오)";

    /**
     * 연리 strategyConfig envelope {candidates:[검증값 1장], selectedId} 생성.
     * @param capitalKrw 초기자본(KRW). null/0 이면 parameters.initial_capital 생략(analytics 기본값 사용).
     */
    public static Map<String, Object> buildEnvelope(Long capitalKrw) {
        // 종목 가중 — 실제 5월 매수 데이터 검증값(TQQQ $24,158 : SOXL $8,985 ≈ 73:27).
        Map<String, Object> weights = new LinkedHashMap<>();
        weights.put("TQQQ", 0.73);
        weights.put("SOXL", 0.27);

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("variant", "yeonri");
        params.put("split", 40);
        params.put("take_profit_pct", 13);
        params.put("loc_offset_pct", 10);
        params.put("leave_shares", 1);
        params.put("compound", false);
        params.put("ticker_weights", weights);
        params.put("restart_buy_fraction", 0.5);
        if (capitalKrw != null && capitalKrw > 0) params.put("initial_capital", capitalKrw);

        Map<String, Object> cand = new LinkedHashMap<>();
        cand.put("id", PRESET_ID);
        cand.put("strategy_name", STRATEGY_NAME);
        cand.put("strategy_type", "infinite_buying");
        cand.put("assets", List.of("TQQQ", "SOXL"));
        cand.put("parameters", params);
        cand.put("rationale",
                "검증된 연리무한매수법 — TQQQ/SOXL 40분할, 평단×1.13 익절(1주 남김), "
                + "평단×1.10 이내 보통가 매수, 익절 후 0.5분할 보통가 재매수로 랠리 사다리타기. "
                + "실제 5월 실현손익(₩8,026,367) 대비 백테스트 0.88x 재현.");
        cand.put("risk_tone", "공격");

        Map<String, Object> env = new LinkedHashMap<>();
        env.put("candidates", List.of(cand));
        env.put("selectedId", PRESET_ID);
        return env;
    }
}
