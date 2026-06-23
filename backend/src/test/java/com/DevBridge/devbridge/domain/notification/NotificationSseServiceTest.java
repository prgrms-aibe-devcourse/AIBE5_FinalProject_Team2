package com.DevBridge.devbridge.domain.notification;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.service.NotificationSseService;
import com.DevBridge.devbridge.domain.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationSseServiceTest {

    private NotificationSseService sseService;

    @BeforeEach
    void setUp() {
        sseService = new NotificationSseService();
    }

    @Test
    void subscribe_returnsEmitterAndIncrementsCount() {
        SseEmitter emitter = sseService.subscribe(1L);
        assertThat(emitter).isNotNull();
        assertThat(sseService.activeCount()).isEqualTo(1);
    }

    @Test
    void subscribe_overwritesPreviousEmitterForSameUser() {
        sseService.subscribe(1L);
        sseService.subscribe(1L);
        // 같은 userId로 재연결 시 기존 emitter 교체 — 연결은 1개
        assertThat(sseService.activeCount()).isEqualTo(1);
    }

    @Test
    void push_whenNoSubscriber_doesNothing() {
        User user = User.builder().id(999L).build();
        Notification n = Notification.builder()
                .id(1L)
                .user(user)
                .notificationType(Notification.NotificationType.BACKTEST_COMPLETE)
                .title("완료")
                .message("백테스트 완료")
                .build();
        // 구독자 없음 → 예외 없이 no-op
        sseService.push(999L, n);
    }

    @Test
    void activeCount_initiallyZero() {
        assertThat(sseService.activeCount()).isZero();
    }
}
