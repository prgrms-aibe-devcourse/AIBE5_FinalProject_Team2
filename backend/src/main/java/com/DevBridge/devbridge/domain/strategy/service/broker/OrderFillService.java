package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.service.NotificationService;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * B1: EXECUTED(주문 수락) 주문의 실제 체결 상태를 브로커별로 확인 ({@link BrokerRouter} 경유).
 *
 * <p>KIS: 체결내역(inquire-ccnl CCLD_NCCS_DVSN=00) — nccs_qty=0이면 FILLED, 일부면 PARTIAL, 목록 미존재면 OPEN(접수 거부/취소). 평균가 없음.
 * <br>Binance: {@code GET /api/v3/order} 로 실제 status(NEW/PARTIALLY_FILLED/FILLED/CANCELED) +
 * executedQty + 평균체결가(cummulativeQuoteQty/executedQty)를 정확히 반영.
 * 체결(FILLED/PARTIAL) 시 잔고 스냅샷(lastBalanceJson)도 브로커별로 자동 동기화(B2).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderFillService {

    private final OrderProposalRepository proposalRepo;
    private final BrokerAccountRepository brokerRepo;
    private final BrokerRouter brokerRouter;
    private final NotificationService notificationService;
    private final ObjectMapper om = new ObjectMapper();

    /** 단일 주문의 체결 상태를 폴링해 갱신 (브로커 라우팅). 결과 맵 {orderNo,fillStatus,filledQty,avgPrice,orderQty} 또는 {error}. */
    @Transactional
    public Map<String, Object> pollFill(OrderProposal p) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (p.getKisOrderNo() == null || p.getKisOrderNo().isBlank()) {
            out.put("error", "주문번호 없음");
            return out;
        }
        BrokerAccount b = brokerRepo.findById(p.getBrokerAccountId()).orElse(null);
        if (b == null) { out.put("error", "broker account 없음"); return out; }

        Broker broker = brokerRouter.forAccount(b);
        Broker.FillResult fr = broker.queryFill(b, p);
        if (fr.error() != null) { out.put("error", fr.error()); return out; }

        String prevFillStatus = p.getFillStatus();
        p.setFillStatus(fr.fillStatus());
        if (fr.filledQty() != null) {
            p.setFilledQtyDecimal(fr.filledQty());
            p.setFilledQty(fr.filledQty().setScale(0, RoundingMode.DOWN).intValue());
        }
        if (fr.avgPrice() != null) p.setFillAvgPrice(fr.avgPrice());   // Binance 는 실제 평균체결가 제공 (KIS 휴리스틱은 null)
        p.setFillCheckedAt(LocalDateTime.now());
        proposalRepo.save(p);

        // 체결 알림: 상태가 처음으로 FILLED/PARTIAL로 전환될 때만 발송 (재폴링 시 중복 방지)
        if ("FILLED".equals(fr.fillStatus()) && !"FILLED".equals(prevFillStatus)) {
            try {
                String sideKr = "BUY".equalsIgnoreCase(p.getSide()) ? "매수" : "매도";
                String title = "주문 체결 완료 — " + p.getTicker();
                String msg = String.format("%s %s주 %s 주문이 체결되었습니다.", p.getTicker(), p.getQty(), sideKr);
                notificationService.create(b.getUser(), Notification.NotificationType.ORDER_FILLED,
                        title, msg, "ORDER_PROPOSAL", p.getId());
            } catch (Exception e) {
                log.warn("[OrderFill] 체결 알림 생성 실패 proposal={}: {}", p.getId(), e.getMessage());
            }
        } else if ("PARTIAL".equals(fr.fillStatus()) && !"PARTIAL".equals(prevFillStatus) && !"FILLED".equals(prevFillStatus)) {
            try {
                String sideKr = "BUY".equalsIgnoreCase(p.getSide()) ? "매수" : "매도";
                String title = "주문 일부 체결 — " + p.getTicker();
                String msg = String.format("%s %s주 %s 주문이 일부 체결되었습니다.", p.getTicker(), p.getFilledQty(), sideKr);
                notificationService.create(b.getUser(), Notification.NotificationType.ORDER_PARTIAL,
                        title, msg, "ORDER_PROPOSAL", p.getId());
            } catch (Exception e) {
                log.warn("[OrderFill] 일부체결 알림 생성 실패 proposal={}: {}", p.getId(), e.getMessage());
            }
        }

        // B2: 체결(FILLED/PARTIAL) 시 캐시 무효화 후 실시간 잔고 동기화 (best-effort)
        if ("FILLED".equals(fr.fillStatus()) || "PARTIAL".equals(fr.fillStatus())) {
            try {
                broker.invalidateBalanceCache(b);  // 45초 캐시 제거 → 다음 getBalance()가 실시간 조회
                Map<String, Object> bal = broker.getBalance(b);
                b.setLastBalanceJson(om.writeValueAsString(bal));
                b.setLastBalanceAt(LocalDateTime.now());
                brokerRepo.save(b);
                out.put("balanceSynced", true);
            } catch (Exception e) {
                out.put("balanceSyncError", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            }
        }

        BigDecimal orderQty = p.getQtyDecimal() != null ? p.getQtyDecimal()
                : BigDecimal.valueOf(p.getQty() == null ? 0 : p.getQty());
        out.put("orderNo", p.getKisOrderNo());
        out.put("fillStatus", fr.fillStatus());
        out.put("filledQty", fr.filledQty());
        out.put("avgPrice", fr.avgPrice());
        out.put("orderQty", orderQty);
        log.info("[OrderFill] proposal={} broker={} order={} → {} (filled={}/{})",
                p.getId(), b.getBrokerType(), p.getKisOrderNo(), fr.fillStatus(), fr.filledQty(), orderQty.toPlainString());
        return out;
    }
}
