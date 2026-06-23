package com.DevBridge.devbridge.domain.notification.repository;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserOrderByCreatedAtDesc(User user);

    List<Notification> findByUserAndIsReadFalseOrderByCreatedAtDesc(User user);

    long countByUserAndIsReadFalse(User user);

    boolean existsByUserAndNotificationTypeAndCreatedAtAfter(
            User user, Notification.NotificationType notificationType, LocalDateTime after);

    boolean existsByUserAndNotificationTypeAndRelatedEntityTypeAndRelatedEntityIdAndCreatedAtAfter(
            User user, Notification.NotificationType notificationType,
            String relatedEntityType, Long relatedEntityId, LocalDateTime after);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id = :id AND n.user = :user")
    int markOneReadByIdAndUser(@Param("id") Long id, @Param("user") User user);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user = :user AND n.isRead = false")
    void markAllReadByUser(@Param("user") User user);
}
