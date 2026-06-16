package com.DevBridge.devbridge.domain.strategy.service.broker;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * KIS 실시간 체결통보 WebSocket — 체결 확인의 <b>저지연 트리거</b>.
 *
 * <p><b>설계(DDIA 11장: 스트림 vs 폴링).</b> 폴링(3분, {@link OrderFillPollingJob})을 한 번에 갈아엎지 않고,
 * 스트림을 <b>덧대어</b> 체결 푸시가 오는 즉시 재조정을 트리거한다. 단, 체결 <i>상태</i>는 푸시 본문을 믿지 않고
 * 항상 권위있는 소스(REST {@code queryFill})로 재조회한다({@link FillReconciler} → {@link OrderFillService#pollFill}).
 * 즉 <b>스트림 = "지금 재조정해" 신호, 진실 = REST 재조회</b>. 그래서 REAL 푸시의 AES 복호화·필드파싱을
 * 완벽히 안 해도 정확하며, 폴링은 안전망으로 남는다. 돈 경로를 안전하게 배치→스트림 전환하는 정석.
 *
 * <p>flag {@code app.kis.ws.enabled} (기본 off — 지속 연결이라 운영에서 명시 활성화).
 *
 * <p><b>장중 실측으로 확정해야 할 KIS 고유 항목(2가지):</b>
 * <ul>
 *   <li>{@code app.kis.ws.exec-tr-id} — 해외주식 실시간 체결통보 TR id(REAL/모의 상이 가능)</li>
 *   <li>{@code app.kis.ws.hts-id} — 구독 tr_key 로 쓰는 KIS HTS ID(계정별 저장 전이라 우선 전역 설정). 없으면 구독 보류.</li>
 * </ul>
 * 이 둘이 확정되기 전에도 연결·트리거·재조정·재연결·안전망 폴링의 구조는 완성되어 동작한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KisFillWebSocketService {

    private final KisApiClient kis;
    private final FillReconciler reconciler;
    private final OrderProposalRepository proposalRepo;
    private final BrokerAccountRepository brokerRepo;

    @Value("${app.kis.ws.enabled:false}")
    private boolean enabled;

    /** 해외주식 실시간 체결통보 TR id (장중 실측으로 확정 필요). */
    @Value("${app.kis.ws.exec-tr-id:H0GSCNI0}")
    private String execTrId;

    /** 구독 tr_key = KIS HTS ID. 빈 값이면 구독 보류(연결만 유지, 폴링이 체결 담당). */
    @Value("${app.kis.ws.hts-id:}")
    private String htsId;

    /** accountId → 연결 상태. 끊기면 제거되어 다음 ensureConnections 가 재연결한다. */
    private final Map<Long, Conn> connections = new ConcurrentHashMap<>();

    private static final class Conn {
        volatile WebSocket ws;
        final AtomicLong lastTrigger = new AtomicLong(0);
        final StringBuilder buf = new StringBuilder();
        final Long userId;
        Conn(Long userId) { this.userId = userId; }
    }

    public boolean isEnabled() { return enabled; }

    private static String wsUrl(BrokerAccount b) {
        return b.getEnv() == BrokerAccount.Env.REAL
                ? "wss://ops.koreainvestment.com:21000"
                : "wss://ops.koreainvestment.com:31000";
    }

    /**
     * 60초마다 "체결 미확정 주문을 가진 KIS 계정"의 WS 연결을 보장한다(끊겼으면 재연결).
     * 이건 데이터 폴링이 아니라 <b>연결 생존 관리</b>다 — 데이터는 푸시로 받는다. flag off 면 no-op.
     */
    @Scheduled(fixedDelay = 60_000L, initialDelay = 30_000L)
    public void ensureConnections() {
        if (!enabled) return;
        try {
            var candidates = proposalRepo.findFillCheckCandidates(LocalDateTime.now().minusHours(36));
            Set<Long> acctIds = candidates.stream()
                    .map(OrderProposal::getBrokerAccountId).filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            for (Long id : acctIds) {
                brokerRepo.findById(id)
                        .filter(a -> a.getBrokerType() == BrokerAccount.BrokerType.KIS)
                        .ifPresent(this::ensureConnected);
            }
        } catch (Exception e) {
            log.debug("[KIS-WS] ensureConnections 실패: {}", e.getMessage());
        }
    }

    /** 해당 KIS 계정의 체결통보 WS 연결 보장(중복 방지·비차단). */
    public void ensureConnected(BrokerAccount b) {
        if (!enabled || b == null || b.getId() == null
                || b.getBrokerType() != BrokerAccount.BrokerType.KIS) return;
        // computeIfAbsent 로 계정당 1연결만 — 동시 호출에도 중복 연결 방지.
        connections.computeIfAbsent(b.getId(), id -> {
            Conn c = new Conn(b.getUser() != null ? b.getUser().getId() : null);  // 프록시 getId(): 초기화 없이 FK만
            connect(b, c);   // 비차단(async)
            return c;
        });
    }

    private void connect(BrokerAccount b, Conn c) {
        try {
            String approvalKey = kis.getWsApprovalKey(b);
            if (approvalKey == null || approvalKey.isBlank()) {
                log.warn("[KIS-WS] 승인키 없음 — 연결 보류 account={}", b.getId());
                connections.remove(b.getId());
                return;
            }
            HttpClient.newHttpClient().newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .buildAsync(URI.create(wsUrl(b)), new Listener(b, c, approvalKey))
                    .whenComplete((ws, err) -> {
                        if (err != null) {
                            log.warn("[KIS-WS] 연결 실패 account={}: {}", b.getId(), err.getMessage());
                            connections.remove(b.getId());   // 다음 ensureConnections 에서 재시도
                        } else {
                            c.ws = ws;
                            log.info("[KIS-WS] 체결통보 연결 account={} env={}", b.getId(), b.getEnv());
                        }
                    });
        } catch (Exception e) {
            log.warn("[KIS-WS] connect 예외 account={}: {}", b.getId(), e.getMessage());
            connections.remove(b.getId());
        }
    }

    /** KIS 실시간 구독 프레임(표준 포맷). tr_key = HTS ID. */
    private String subscribeFrame(String approvalKey) {
        return "{\"header\":{\"approval_key\":\"" + approvalKey + "\",\"custtype\":\"P\","
                + "\"tr_type\":\"1\",\"content-type\":\"utf-8\"},"
                + "\"body\":{\"input\":{\"tr_id\":\"" + execTrId + "\",\"tr_key\":\"" + htsId + "\"}}}";
    }

    /** 체결통보 수신 → 해당 사용자의 미확정 주문을 즉시 재조정(권위있는 REST 재조회). WS 스레드 비차단 + 디바운스. */
    private void triggerReconcile(Conn c) {
        long now = System.currentTimeMillis();
        long last = c.lastTrigger.get();
        if (now - last < 2000L) return;                    // 2초 내 중복 트리거 무시(여러 체결 프레임 합치기)
        if (!c.lastTrigger.compareAndSet(last, now)) return;
        CompletableFuture.runAsync(() -> {                  // REST+DB 작업을 WS 콜백 스레드 밖에서
            try {
                int n = reconciler.reconcileOpenFills(c.userId);
                log.info("[KIS-WS] 체결통보 → 즉시 재조정 {}건 (user={})", n, c.userId);
            } catch (Exception e) {
                log.warn("[KIS-WS] 재조정 실패 user={}: {}", c.userId, e.getMessage());
            }
        });
    }

    private final class Listener implements WebSocket.Listener {
        private final BrokerAccount b;
        private final Conn c;
        private final String approvalKey;

        Listener(BrokerAccount b, Conn c, String approvalKey) {
            this.b = b; this.c = c; this.approvalKey = approvalKey;
        }

        @Override
        public void onOpen(WebSocket ws) {
            ws.request(1);
            if (htsId == null || htsId.isBlank()) {
                log.warn("[KIS-WS] HTS ID 미설정(app.kis.ws.hts-id) — 체결통보 구독 보류. 연결만 유지(폴링이 체결 담당).");
                return;
            }
            ws.sendText(subscribeFrame(approvalKey), true);
            log.info("[KIS-WS] 체결통보 구독 요청 tr_id={} account={}", execTrId, b.getId());
        }

        @Override
        public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
            ws.request(1);
            c.buf.append(data);
            if (last) {
                String msg = c.buf.toString();
                c.buf.setLength(0);
                handle(ws, msg);
            }
            return null;
        }

        private void handle(WebSocket ws, String msg) {
            if (msg.isEmpty()) return;
            if (msg.charAt(0) == '{') {
                // 제어 메시지: PINGPONG 은 그대로 되돌려 연결 유지, 그 외(구독 ack 등)는 로깅만.
                if (msg.contains("PINGPONG")) { ws.sendText(msg, true); return; }
                log.debug("[KIS-WS] control: {}", msg.length() > 200 ? msg.substring(0, 200) : msg);
                return;
            }
            // 실시간 데이터 프레임(0|TR|... 또는 1|TR|...). 체결통보 TR 이면 즉시 재조정 트리거.
            // 본문 파싱/복호화는 하지 않는다 — 트리거만 받고 진실은 REST 로 재조회(설계 의도).
            if (msg.contains(execTrId)) {
                triggerReconcile(c);
            }
        }

        @Override
        public CompletionStage<?> onClose(WebSocket ws, int statusCode, String reason) {
            log.info("[KIS-WS] 연결 종료 account={} ({}: {}) — 다음 ensureConnections 가 재연결", b.getId(), statusCode, reason);
            connections.remove(b.getId());
            return null;
        }

        @Override
        public void onError(WebSocket ws, Throwable error) {
            log.warn("[KIS-WS] 연결 오류 account={}: {}", b.getId(), error.getMessage());
            connections.remove(b.getId());
        }
    }

    @PreDestroy
    public void closeAll() {
        for (Conn c : connections.values()) {
            try {
                if (c.ws != null) c.ws.sendClose(WebSocket.NORMAL_CLOSURE, "shutdown");
            } catch (Exception ignore) { }
        }
        connections.clear();
    }

    // ───────────────────────── 진단용(연결 검증) — 기존 유지 ─────────────────────────

    /** 승인키 발급 + KIS WS 연결 1회 검증(즉시 닫음). 운영 모니터링/디버그용. */
    public Map<String, Object> testConnection(BrokerAccount b) {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            String key = kis.getWsApprovalKey(b);
            out.put("approvalKeyObtained", key != null && !key.isBlank());
        } catch (Exception e) {
            out.put("approvalKeyObtained", false);
            out.put("error", "승인키 발급 실패: " + e.getMessage());
            return out;
        }
        String url = wsUrl(b);
        out.put("wsUrl", url);
        WebSocket ws = null;
        try {
            ws = HttpClient.newHttpClient().newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .buildAsync(URI.create(url), new WebSocket.Listener() {})
                    .get(12, TimeUnit.SECONDS);
            out.put("wsConnected", true);
            log.info("[KIS-WS] 체결통보 WS 연결 검증 성공 {}", url);
        } catch (Exception e) {
            out.put("wsConnected", false);
            out.put("error", "WS 연결 실패: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        } finally {
            if (ws != null) {
                try { ws.sendClose(WebSocket.NORMAL_CLOSURE, "test").get(3, TimeUnit.SECONDS); } catch (Exception ignore) {}
            }
        }
        out.put("enabled", enabled);
        out.put("note", "지속 스트림은 app.kis.ws.enabled=true + (exec-tr-id·hts-id) 설정 시 활성. 그 전엔 폴링이 체결 담당.");
        return out;
    }
}
