package com.DevBridge.devbridge.domain.strategy.service.broker;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * B1: EXECUTED 주문의 실제 체결 상태를 주기적으로 폴링해 fill_status 갱신.
 *
 * <p>실시간 체결통보 WS({@link KisFillWebSocketService})가 도입된 뒤에도 이 폴링은 <b>안전망(fallback)</b>으로
 * 남는다 — 스트림이 끊기거나(재연결 지연) 푸시를 놓쳐도 3분 주기로 빠짐없이 메운다(DDIA 11장: 스트림+배치 병행).
 * 실제 재조정 로직은 {@link FillReconciler} 한 곳에 모여 폴링과 스트림이 공유한다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderFillPollingJob {

    private final FillReconciler reconciler;

    @Scheduled(fixedDelay = 3 * 60 * 1000L, initialDelay = 90 * 1000L)
    public void pollFills() {
        int ok = reconciler.reconcileOpenFills(null);   // 전체 사용자 — 안전망
        if (ok > 0) log.info("[OrderFillPollingJob] 체결 폴링 재조정 {}건", ok);
    }
}
