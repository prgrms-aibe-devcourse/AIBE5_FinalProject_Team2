package com.DevBridge.devbridge.domain.ai.repository;

import com.DevBridge.devbridge.domain.ai.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, Long> {

    /** userId의 modelId에 대해 since 이후 합산 토큰 (in+out). 호출 없으면 0. */
    @Query("""
        SELECT COALESCE(SUM(u.tokensIn + u.tokensOut), 0)
        FROM AiUsageLog u
        WHERE u.userId = :uid AND u.modelId = :model AND u.createdAt >= :since AND u.success = true
    """)
    long sumTokensByUserAndModelSince(@Param("uid") Long uid,
                                       @Param("model") String modelId,
                                       @Param("since") LocalDateTime since);

    /** userId의 since 이후 모델별 합산 토큰을 한 번에(모델 N개 N+1 쿼리 방지). 각 행 = [modelId(String), sum(Long)]. */
    @Query("""
        SELECT u.modelId, COALESCE(SUM(u.tokensIn + u.tokensOut), 0)
        FROM AiUsageLog u
        WHERE u.userId = :uid AND u.createdAt >= :since AND u.success = true
        GROUP BY u.modelId
    """)
    List<Object[]> sumTokensByUserSinceGrouped(@Param("uid") Long uid, @Param("since") LocalDateTime since);

    /** 오늘(since 이후) 성공한 Perplexity 풀 브리핑 횟수 — 구독등급 일일 한도 집계.
     *  Gemini 폴백(briefing_fallback)은 quota 에 안 세서, 한도 소진 후에도 Gemini 간략 브리핑은 계속 받게 한다. */
    @Query("""
        SELECT COUNT(u)
        FROM AiUsageLog u
        WHERE u.userId = :uid AND u.feature = 'briefing_perplexity' AND u.createdAt >= :since AND u.success = true
    """)
    long countBriefingsSince(@Param("uid") Long uid, @Param("since") LocalDateTime since);
}
