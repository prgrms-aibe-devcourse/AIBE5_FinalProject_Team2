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

    /**
     * 멱등 가드(자동 제안 중복 방지): 같은 시그널(sourceSignalId)로 아직 살아있는(=종료상태 아님)
     * 제안이 이미 존재하는가. 사용자 전체 제안을 메모리에 로드해 stream 으로 거르던 것을
     * DB EXISTS 단일 쿼리로 대체한다(source_signal_id 인덱스 사용). DDIA 3장(필터는 DB에서).
     *
     * @param terminalStatuses 살아있는 제안으로 치지 않는 종료 상태들(REJECTED/EXPIRED/EXEC_FAILED).
     *                         이 상태뿐이면 같은 시그널로 새 제안을 허용한다.
     */
    boolean existsByUserIdAndSourceSignalIdAndStatusNotIn(Long userId, Long sourceSignalId,
                                                          java.util.Collection<String> terminalStatuses);

    /** 주문큐 중복 방지: 같은 유저·워크스페이스·종목·side 의 특정 상태(PENDING) 제안 존재 여부. */
    boolean existsByUserIdAndWorkspaceIdAndTickerAndSideAndStatus(Long userId, Long workspaceId,
                                                                  String ticker, String side, String status);

    /** 만료 처리 잡용: PENDING 상태 + expires_at < now */
    List<OrderProposal> findByStatusAndExpiresAtBefore(String status, LocalDateTime cutoff);

    /**
     * DDIA 7장(compare-and-set): PENDING → APPROVED 원자적 상태전이.
     * 동시에 두 요청(더블클릭 approve, 또는 수동 approve + 자동체결)이 모두 PENDING 검사를
     * 통과해 '같은 주문을 두 번' 실주문하는 lost-update 를 차단한다.
     * UPDATE ... WHERE status='PENDING' 이 행을 잠그므로 둘 중 하나만 affected=1, 나머지는 0(이미 가져감).
     * @return 1=이 호출이 점유 성공(진행), 0=다른 스레드가 이미 점유(중단)
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("update OrderProposal p set p.status='APPROVED', p.decidedAt=:now, p.autoExecuted=:auto " +
           "where p.id=:id and p.status='PENDING'")
    int claimForExecution(@Param("id") Long id, @Param("now") LocalDateTime now, @Param("auto") boolean auto);

    /**
     * 당일 EXECUTED 주문 합산 USD. 일일누적 한도검증용.
     * 수량: 분수(qtyDecimal, 크립토)가 있으면 우선, 없으면 정수 qty.
     * 단가: limitPrice(지정가) 우선, 없으면 체결평균가(fillAvgPrice, 시장가 체결 후)로 보정, 둘 다 없으면 0.
     */
    @Query("select coalesce(sum(coalesce(p.qtyDecimal, p.qty) * coalesce(p.limitPrice, p.fillAvgPrice, 0)), 0) " +
           "from OrderProposal p " +
           "where p.userId = :uid and p.status = 'EXECUTED' and p.executedAt >= :since")
    java.math.BigDecimal sumExecutedUsdSince(@Param("uid") Long userId,
                                             @Param("since") LocalDateTime since);

    /**
     * 당일 EXECUTED 주문 합산 USD — 매수/매도(side) 분리. KIS KRW 일일 매수·매도 한도 검증용(M3).
     * 단가/수량 산정은 {@link #sumExecutedUsdSince} 와 동일.
     */
    @Query("select coalesce(sum(coalesce(p.qtyDecimal, p.qty) * coalesce(p.limitPrice, p.fillAvgPrice, 0)), 0) " +
           "from OrderProposal p " +
           "where p.userId = :uid and p.status = 'EXECUTED' and p.side = :side and p.executedAt >= :since")
    java.math.BigDecimal sumExecutedUsdSinceBySide(@Param("uid") Long userId,
                                                   @Param("side") String side,
                                                   @Param("since") LocalDateTime since);

    /** REAL 자동매매 졸업 게이트: 특정 계정에서 자동 체결(EXECUTED + autoExecuted=true)된 건수. */
    long countByBrokerAccountIdAndStatusAndAutoExecutedTrue(Long brokerAccountId, String status);

    /** REAL 자동매매 졸업 게이트: 특정 계정의 자동 체결 최초 시각 (2주 경과 판정용). */
    @Query("select min(p.executedAt) from OrderProposal p " +
           "where p.brokerAccountId = :baId and p.status = 'EXECUTED' and p.autoExecuted = true")
    LocalDateTime firstAutoExecutedAt(@Param("baId") Long brokerAccountId);

    /** B1 체결 폴링 대상: EXECUTED + kisOrderNo 있음 + 체결 미확정(null/UNKNOWN/OPEN/PARTIAL) + 최근 실행. */
    @Query("select p from OrderProposal p where p.status = 'EXECUTED' and p.kisOrderNo is not null " +
           "and (p.fillStatus is null or p.fillStatus in ('UNKNOWN','OPEN','PARTIAL')) " +
           "and p.executedAt >= :since")
    List<OrderProposal> findFillCheckCandidates(@Param("since") LocalDateTime since);

    /** 위와 동일하되 특정 사용자만 — 실시간 체결통보(WS)가 그 사용자의 미확정 주문만 즉시 재조정할 때 사용. */
    @Query("select p from OrderProposal p where p.userId = :uid and p.status = 'EXECUTED' and p.kisOrderNo is not null " +
           "and (p.fillStatus is null or p.fillStatus in ('UNKNOWN','OPEN','PARTIAL')) " +
           "and p.executedAt >= :since")
    List<OrderProposal> findFillCheckCandidatesByUser(@Param("uid") Long userId, @Param("since") LocalDateTime since);
}
