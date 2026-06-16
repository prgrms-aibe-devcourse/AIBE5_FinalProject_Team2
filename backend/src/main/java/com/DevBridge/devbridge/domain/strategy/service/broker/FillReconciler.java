package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 체결 상태 재조정(reconcile)의 <b>단일 경로</b> — 주기 폴링({@link OrderFillPollingJob})과
 * 실시간 체결통보 WS({@link KisFillWebSocketService})가 모두 이 메서드를 거쳐 같은 로직으로 반영한다.
 *
 * <p><b>핵심 설계(DDIA 11장 — 스트림 vs 배치).</b> WebSocket 스트림은 "지금 즉시 재조정해라"는
 * <b>저지연 트리거</b>일 뿐이고, 실제 체결 상태는 항상 <b>권위있는 소스</b>(브로커 REST {@code queryFill})로
 * 재조회한다({@link OrderFillService#pollFill}). 따라서:
 * <ul>
 *   <li>푸시 메시지를 신뢰하거나 복호화하지 않아도 결과가 정확하다 — <i>스트림은 트리거, 진실은 재조회.</i></li>
 *   <li>폴링은 스트림이 끊기거나 놓쳐도 메우는 <b>안전망(배치 fallback)</b> 으로 그대로 남는다.</li>
 * </ul>
 * 이것이 돈이 오가는 경로를 한 번에 폴링→스트림으로 갈아엎지 않고 안전하게 전환하는 방법이다(strangler).
 *
 * <p>주의: {@code pollFill} 은 {@code @Transactional} 이다. 여기(다른 빈)에서 호출해야 Spring 프록시가 적용되어
 * 건별 트랜잭션이 보장된다(같은 빈 내 self-invocation 이면 트랜잭션이 무시됨).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FillReconciler {

    private final OrderProposalRepository proposalRepo;
    private final OrderFillService fillService;

    /**
     * EXECUTED + 체결 미확정 주문을 재조정한다.
     * @param userId null 이면 전체(폴링 잡 — 전 사용자 안전망), 지정 시 그 사용자만(WS 체결통보 트리거).
     * @return 재조정 시도 성공 건수
     */
    public int reconcileOpenFills(Long userId) {
        LocalDateTime since = LocalDateTime.now().minusHours(36);
        List<OrderProposal> candidates = (userId == null)
                ? proposalRepo.findFillCheckCandidates(since)
                : proposalRepo.findFillCheckCandidatesByUser(userId, since);
        if (candidates.isEmpty()) return 0;
        int ok = 0;
        for (OrderProposal p : candidates) {
            try {
                fillService.pollFill(p);   // 크로스빈 호출 → pollFill 의 @Transactional 적용
                ok++;
            } catch (Exception e) {
                log.debug("[FillReconciler] 재조정 실패 id={}: {}", p.getId(), e.getMessage());
            }
        }
        return ok;
    }
}
