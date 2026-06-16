package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link FillReconciler} 단위 테스트 — 폴링(배치)과 체결통보(스트림)가 공유하는 단일 재조정 funnel 의 계약 검증.
 *
 * 핵심 설계 두 가지를 못박는다(DDIA 11장):
 *  1) 스트림 트리거는 <b>그 사용자</b>의 미확정 주문만 재조정한다(전체 스캔 안 함).
 *  2) 어느 경로든 체결 진실은 항상 권위있는 {@link OrderFillService#pollFill}(REST 재조회)로 반영된다 —
 *     스트림 푸시 본문을 신뢰하지 않는다.
 */
class FillReconcilerTest {

    private final OrderProposalRepository repo = mock(OrderProposalRepository.class);
    private final OrderFillService fillService = mock(OrderFillService.class);
    private final FillReconciler reconciler = new FillReconciler(repo, fillService);

    @Test
    void streamTrigger_reconciles_only_that_user_via_authoritative_pollFill() {
        OrderProposal p1 = new OrderProposal(); p1.setId(1L);
        OrderProposal p2 = new OrderProposal(); p2.setId(2L);
        when(repo.findFillCheckCandidatesByUser(eq(7L), any())).thenReturn(List.of(p1, p2));

        int n = reconciler.reconcileOpenFills(7L);

        assertThat(n).isEqualTo(2);
        verify(repo).findFillCheckCandidatesByUser(eq(7L), any());     // 사용자 한정 조회
        verify(repo, never()).findFillCheckCandidates(any());          // 전체 스캔 안 함
        verify(fillService).pollFill(p1);                              // 진실은 권위있는 재조회
        verify(fillService).pollFill(p2);
    }

    @Test
    void pollingFallback_reconciles_all_users() {
        when(repo.findFillCheckCandidates(any())).thenReturn(List.of());

        int n = reconciler.reconcileOpenFills(null);

        assertThat(n).isZero();
        verify(repo).findFillCheckCandidates(any());                   // 전체 사용자(안전망)
        verify(repo, never()).findFillCheckCandidatesByUser(any(), any());
    }

    @Test
    void oneFailure_doesNotAbort_remaining() {
        OrderProposal p1 = new OrderProposal(); p1.setId(1L);
        OrderProposal p2 = new OrderProposal(); p2.setId(2L);
        when(repo.findFillCheckCandidatesByUser(eq(7L), any())).thenReturn(List.of(p1, p2));
        when(fillService.pollFill(p1)).thenThrow(new RuntimeException("broker timeout"));

        int n = reconciler.reconcileOpenFills(7L);

        assertThat(n).isEqualTo(1);            // p1 실패해도 p2 는 진행 — 건별 격리
        verify(fillService).pollFill(p2);
    }
}
