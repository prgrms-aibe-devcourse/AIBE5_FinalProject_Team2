package com.DevBridge.devbridge.domain.notification.service;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.repository.NotificationRepository;
import com.DevBridge.devbridge.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationSseService sseService;

    @Transactional
    public void create(User user, Notification.NotificationType type,
                       String title, String message,
                       String relatedEntityType, Long relatedEntityId) {
        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .notificationType(type)
                .title(title)
                .message(message)
                .relatedEntityType(relatedEntityType)
                .relatedEntityId(relatedEntityId)
                .build());
        // 연결된 SSE 클라이언트에게 즉시 push (연결 없으면 no-op)
        sseService.push(user.getId(), saved);
    }

    /** 중복 발송 방지용: 최근 withinHours 시간 내에 같은 타입의 알림이 이미 존재하는지 확인. */
    @Transactional(readOnly = true)
    public boolean existsRecent(User user, Notification.NotificationType type, int withinHours) {
        return notificationRepository.existsByUserAndNotificationTypeAndCreatedAtAfter(
                user, type, LocalDateTime.now().minusHours(withinHours));
    }

    /** 중복 발송 방지용: 특정 엔티티에 대해 최근 withinMinutes 분 내에 같은 타입의 알림이 이미 존재하는지 확인. */
    @Transactional(readOnly = true)
    public boolean existsRecentForEntity(User user, Notification.NotificationType type,
                                         String entityType, Long entityId, int withinMinutes) {
        return notificationRepository.existsByUserAndNotificationTypeAndRelatedEntityTypeAndRelatedEntityIdAndCreatedAtAfter(
                user, type, entityType, entityId, LocalDateTime.now().minusMinutes(withinMinutes));
    }
}
