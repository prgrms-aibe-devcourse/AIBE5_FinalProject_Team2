package com.DevBridge.devbridge.domain.strategy.service;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.service.NotificationService;
import com.DevBridge.devbridge.domain.strategy.entity.Subscription;
import com.DevBridge.devbridge.domain.strategy.repository.SubscriptionRepository;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 사용자 구독 조회/생성/만료 처리.
 * Toss 결제 완료 후 activatePro() 호출.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository repo;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** 사용자의 현재 등급 (활성 Pro가 있고 만료 안됐으면 PRO, 그외 FREE). */
    @Transactional(readOnly = true)
    public Subscription.Tier currentTier(Long userId) {
        return repo.findFirstByUserIdAndStatusOrderByExpiresAtDesc(userId, Subscription.Status.ACTIVE)
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(Subscription::getTier)
                .orElse(Subscription.Tier.FREE);
    }

    /**
     * 현재 활성 구독 엔티티 반환 (없으면 null).
     * amountKrw 기반으로 결제건에 STANDARD/PREMIUM 표시 레이블을 계산할 때 사용.
     */
    @Transactional(readOnly = true)
    public Subscription findActiveSub(Long userId) {
        return repo.findFirstByUserIdAndStatusOrderByExpiresAtDesc(userId, Subscription.Status.ACTIVE)
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElse(null);
    }

    /**
     * amountKrw 기반으로 결제 시 표시 레이블을 반환.
     * DB Tier는 PRO 단일이지만 결제 금액으로 STANDARD/PREMIUM 구분.
     */
    public static String deriveTierDisplay(Subscription sub) {
        if (sub == null) return "FREE";
        long amt = sub.getAmountKrw() != null ? sub.getAmountKrw() : 0L;
        if (amt >= 39900L) return "EXPERT";
        if (amt >= 19900L) return "PREMIUM";
        return "STANDARD";
    }

    /** M8: Toss 결제키로 기존 구독 조회 (없으면 null). confirm 멱등 사전체크용. */
    @Transactional(readOnly = true)
    public Subscription findByPaymentKey(String paymentKey) {
        if (paymentKey == null || paymentKey.isBlank()) return null;
        return repo.findByTossPaymentKey(paymentKey).orElse(null);
    }

    /** Pro 활성화 (Toss 결제 성공 후 호출). 기간 = 30일. 같은 결제키면 멱등(기존 구독 재사용). */
    @Transactional
    public Subscription activatePro(Long userId, String paymentKey, String orderId, long amountKrw) {
        // M8: 멱등성 — 같은 결제키로 이미 활성화된 구독이 있으면 중복 INSERT/이중 등급부여 없이 재사용.
        Subscription dup = findByPaymentKey(paymentKey);
        if (dup != null) {
            log.info("Pro activate 멱등 처리 — 이미 처리된 결제 userId={} orderId={}", userId, orderId);
            return dup;
        }
        LocalDateTime now = LocalDateTime.now();
        Subscription sub = Subscription.builder()
                .userId(userId)
                .tier(Subscription.Tier.PRO)
                .status(Subscription.Status.ACTIVE)
                .startedAt(now)
                .expiresAt(now.plusDays(30))
                .tossPaymentKey(paymentKey)
                .tossOrderId(orderId)
                .amountKrw(amountKrw)
                .build();
        Subscription saved = repo.save(sub);
        String planName = amountKrw >= 39900L ? "EXPERT" : amountKrw >= 19900L ? "PREMIUM" : "STANDARD";
        userRepository.findById(userId).ifPresent(u -> {
            u.setUserType(amountKrw >= 39900L ? User.UserType.EXPERT
                    : amountKrw >= 19900L ? User.UserType.PREMIUM : User.UserType.STANDARD);
            userRepository.save(u);
            notificationService.create(u, Notification.NotificationType.SUBSCRIPTION_ACTIVATED,
                    planName + " 플랜 구독이 시작되었습니다",
                    planName + " 플랜이 활성화되었습니다. 만료일: " + sub.getExpiresAt().toLocalDate() + ". 이용해 주셔서 감사합니다!",
                    "SUBSCRIPTION", saved.getId());
        });
        log.info("Pro activated userId={} orderId={} expiresAt={}", userId, orderId, sub.getExpiresAt());
        return saved;
    }

    /** 구독 즉시 해지 — expiresAt 을 now로 당기고 유저를 FREE로 전환. */
    @Transactional
    public void cancel(Long userId) {
        Subscription sub = findActiveSub(userId);
        if (sub == null) throw new IllegalStateException("활성 구독이 없습니다.");
        sub.setStatus(Subscription.Status.EXPIRED);
        sub.setExpiresAt(LocalDateTime.now());
        repo.save(sub);
        userRepository.findById(userId).ifPresent(u -> {
            u.setUserType(User.UserType.FREE);
            userRepository.save(u);
            notificationService.create(u, Notification.NotificationType.SUBSCRIPTION_EXPIRED,
                    "구독이 해지되었습니다",
                    "Pro 플랜 구독이 해지되어 무료 플랜으로 전환되었습니다. 이용해 주셔서 감사합니다.",
                    "SUBSCRIPTION", sub.getId());
        });
        log.info("Subscription cancelled userId={} subId={}", userId, sub.getId());
    }

    /** 만료 처리 (매시간 실행). */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public int expireAllDue() {
        var due = repo.findByStatusAndExpiresAtBefore(Subscription.Status.ACTIVE, LocalDateTime.now());
        for (var s : due) {
            s.setStatus(Subscription.Status.EXPIRED);
            userRepository.findById(s.getUserId()).ifPresent(u -> {
                u.setUserType(User.UserType.FREE);
                userRepository.save(u);
                notificationService.create(u, Notification.NotificationType.SUBSCRIPTION_EXPIRED,
                        "구독이 만료되었습니다",
                        "Pro 플랜이 만료되어 무료 플랜으로 전환되었습니다. 서비스를 계속 이용하시려면 구독을 갱신해주세요.",
                        "SUBSCRIPTION", s.getId());
            });
        }
        if (!due.isEmpty()) log.info("Expired {} subscriptions", due.size());
        return due.size();
    }

    /** 구독 만료 3일 전 알림 (매일 오전 9시 실행). */
    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void notifyExpiringSubscriptions() {
        LocalDateTime now = LocalDateTime.now();
        var expiring = repo.findByStatusAndExpiresAtBetween(
                Subscription.Status.ACTIVE,
                now.plusDays(2).plusHours(12),
                now.plusDays(3).plusHours(12));
        for (var sub : expiring) {
            userRepository.findById(sub.getUserId()).ifPresent(user -> {
                if (!notificationService.existsRecent(user, Notification.NotificationType.SUBSCRIPTION_EXPIRING_SOON, 24)) {
                    notificationService.create(user, Notification.NotificationType.SUBSCRIPTION_EXPIRING_SOON,
                            "구독 만료 3일 전",
                            "Pro 플랜이 3일 후 만료됩니다. 서비스를 계속 이용하시려면 결제 페이지에서 갱신해주세요.",
                            "SUBSCRIPTION", sub.getId());
                }
            });
        }
        if (!expiring.isEmpty()) log.info("Sent expiring-soon notification to {} users", expiring.size());
    }
}

