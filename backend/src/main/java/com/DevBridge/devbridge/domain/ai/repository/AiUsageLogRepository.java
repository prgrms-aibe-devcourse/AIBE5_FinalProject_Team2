package com.DevBridge.devbridge.domain.ai.repository;

import com.DevBridge.devbridge.domain.ai.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

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
}
