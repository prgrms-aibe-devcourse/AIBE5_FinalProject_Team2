package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * LIVE 브리핑(라이브 리포팅) 구독등급별 하루 횟수 정책.
 *
 * <p>비용 통제: <b>STANDARD 이상</b>만 대표 LIVE 전략을 하루 <b>1회</b> 자동 브리핑한다.
 * FREE 는 LIVE 브리핑 미제공(0회). 등급별 추가 새로고침은 두지 않는다(실제 운용 시 도입).
 * 설정: {@code app.briefing.daily.*}.
 */
@Component
public class BriefingQuotaPolicy {

    @Value("${app.briefing.daily.free:0}")     private int free;      // FREE — LIVE 브리핑 미제공
    @Value("${app.briefing.daily.standard:1}") private int standard;  // Perplexity 풀 브리핑 1회/일
    @Value("${app.briefing.daily.premium:2}")  private int premium;   // 2회/일
    @Value("${app.briefing.daily.expert:3}")   private int expert;    // 3회/일 (소진 후엔 Gemini 간략 브리핑)

    /** 구독 등급별 하루 LIVE 브리핑 허용 횟수. null/미상 → free(1). */
    public int dailyLimitFor(User.UserType ut) {
        if (ut == null) return free;
        return switch (ut) {
            case EXPERT   -> expert;
            case PREMIUM  -> premium;
            case STANDARD -> standard;
            default       -> free;   // FREE
        };
    }
}
