package com.DevBridge.devbridge.domain.notification.service;

import com.DevBridge.devbridge.domain.notification.dto.NotificationResponse;
import com.DevBridge.devbridge.domain.notification.entity.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 사용자별 SSE 커넥션 관리.
 *
 * 클라이언트가 GET /api/notifications/stream 에 연결하면
 * emitter를 userId 키로 등록해두고, 새 알림이 생성될 때마다 push.
 *
 * 연결 타임아웃(기본 3분) 후 자동 해제. 프론트는 onclose 시 자동 재연결.
 * 스케일아웃 환경에서는 Redis Pub/Sub 으로 교체 필요 (현재는 단일 인스턴스 운영).
 */
@Slf4j
@Service
public class NotificationSseService {

    private static final long SSE_TIMEOUT_MS = 3 * 60 * 1000L;

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        emitter.onCompletion(() -> emitters.remove(userId));
        emitter.onTimeout(() -> {
            emitters.remove(userId);
            emitter.complete();
        });
        emitter.onError(e -> emitters.remove(userId));

        emitters.put(userId, emitter);
        log.debug("[SSE] 알림 구독: userId={}", userId);
        return emitter;
    }

    /** 새 알림 발생 시 해당 사용자에게 즉시 push. */
    public void push(Long userId, Notification notification) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter == null) return;

        try {
            NotificationResponse payload = NotificationResponse.from(notification);
            emitter.send(SseEmitter.event()
                .name("notification")
                .data(payload));
            log.debug("[SSE] 알림 push: userId={} type={}", userId, notification.getNotificationType());
        } catch (IOException e) {
            log.warn("[SSE] push 실패 — 연결 해제: userId={}", userId);
            emitters.remove(userId);
            emitter.completeWithError(e);
        }
    }

    public int activeCount() {
        return emitters.size();
    }
}
