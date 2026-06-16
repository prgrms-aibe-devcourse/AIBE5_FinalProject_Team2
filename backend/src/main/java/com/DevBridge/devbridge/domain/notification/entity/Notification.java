package com.DevBridge.devbridge.domain.notification.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/** In-app system notifications: backtest, briefing, subscription, account, and order fill events. */
@Entity
@Table(name = "NOTIFICATION")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 50)
    private NotificationType notificationType;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "related_entity_type", length = 50)
    private String relatedEntityType;

    @Column(name = "related_entity_id")
    private Long relatedEntityId;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean isRead = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum NotificationType {
        BACKTEST_COMPLETE,
        BRIEFING_GENERATED,
        SUBSCRIPTION_ACTIVATED,
        SUBSCRIPTION_EXPIRING_SOON,
        SUBSCRIPTION_EXPIRED,
        ACCOUNT_CREATED,
        ORDER_FILLED,
        ORDER_PARTIAL
    }
}
