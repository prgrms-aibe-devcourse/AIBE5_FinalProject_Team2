package com.DevBridge.devbridge.domain.strategy.repository;

import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderProposalRepository extends JpaRepository<OrderProposal, Long> {

    List<OrderProposal> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<OrderProposal> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    Optional<OrderProposal> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndStatus(Long userId, String status);

    /** 만료 처리 잡용: PENDING 상태 + expires_at < now */
    List<OrderProposal> findByStatusAndExpiresAtBefore(String status, LocalDateTime cutoff);

    /**
     * 당일 EXECUTED 주문 합산 USD (qty * limit_price). 일일누적 한도검증용.
     * limit_price NULL(시장가) 건은 0으로 처리 — 호출측에서 별도 보정 필요.
     */
    @Query("select coalesce(sum(p.qty * coalesce(p.limitPrice, 0)), 0) " +
           "from OrderProposal p " +
           "where p.userId = :uid and p.status = 'EXECUTED' and p.executedAt >= :since")
    java.math.BigDecimal sumExecutedUsdSince(@Param("uid") Long userId,
                                             @Param("since") LocalDateTime since);
}
