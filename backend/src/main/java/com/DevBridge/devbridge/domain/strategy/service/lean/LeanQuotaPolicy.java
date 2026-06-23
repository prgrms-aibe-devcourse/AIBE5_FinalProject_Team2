package com.DevBridge.devbridge.domain.strategy.service.lean;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Lean 멀티테넌트 동시 실행 쿼터 정책 — 부하 최소화의 한 축.
 *
 * <p>등급별 동시 실행 한도 + 전역 캡. 스케줄러({@link LeanScheduler})가 이 정책으로
 * "지금 배정 가능한 잡"을 고른다. 설정: {@code app.lean.quota.*}.
 */
@Component
public class LeanQuotaPolicy {

    @Value("${app.lean.quota.free:0}")      private int free;
    @Value("${app.lean.quota.standard:1}")  private int standard;
    @Value("${app.lean.quota.premium:2}")   private int premium;
    @Value("${app.lean.quota.expert:4}")    private int expert;
    @Value("${app.lean.quota.global:6}")    private int global;

    /** 등급별 동시 실행 한도. null/FREE/미상 → free(기본 0=차단). */
    public int maxConcurrentFor(String tier) {
        if (tier == null) return free;
        switch (tier.toUpperCase()) {
            case "EXPERT":   return expert;
            case "PREMIUM":  return premium;
            case "STANDARD": return standard;
            default:         return free;
        }
    }

    /** 전역 동시 실행 캡(= 총 워커 슬롯 근사). 호스트/워커 추가 시 상향. */
    public int globalCap() {
        return global;
    }
}
