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
 * ?ъ슜??援щ룆 議고쉶/?앹꽦/留뚮즺 泥섎━.
 * Toss 寃곗젣 肄쒕갚?먯꽌 activatePro() ?몄텧.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository repo;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** ?ъ슜?먯쓽 ?꾩옱 ?깃툒 (?쒖꽦 Pro媛 ?덇퀬 留뚮즺 ?덈릱?쇰㈃ PRO, 洹???FREE). */
    @Transactional(readOnly = true)
    public Subscription.Tier currentTier(Long userId) {
        return repo.findFirstByUserIdAndStatusOrderByExpiresAtDesc(userId, Subscription.Status.ACTIVE)
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(Subscription::getTier)
                .orElse(Subscription.Tier.FREE);
    }

    /**
     * ?꾩옱 ?쒖꽦 援щ룆 ?뷀떚??諛섑솚 (?놁쑝硫?null).
     * amountKrw 湲곕컲?쇰줈 ?꾨줎?몄뿉 STANDARD/PREMIUM ?쒖떆 ?곗뼱瑜?怨꾩궛?????ъ슜.
     */
    @Transactional(readOnly = true)
    public Subscription findActiveSub(Long userId) {
        return repo.findFirstByUserIdAndStatusOrderByExpiresAtDesc(userId, Subscription.Status.ACTIVE)
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElse(null);
    }

    /**
     * amountKrw 湲곕컲?쇰줈 ?꾨줎???쒖떆 ?곗뼱瑜?諛섑솚.
     * DB Tier??PRO ?⑥씪?댁?留?寃곗젣 湲덉븸?쇰줈 STANDARD/PREMIUM 援щ텇.
     */
    public static String deriveTierDisplay(Subscription sub) {
        if (sub == null) return "FREE";
        long amt = sub.getAmountKrw() != null ? sub.getAmountKrw() : 0L;
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
        String planName = amountKrw >= 19900L ? "PREMIUM" : "STANDARD";
        userRepository.findById(userId).ifPresent(u -> {
            u.setUserType(amountKrw >= 19900L ? User.UserType.PREMIUM : User.UserType.STANDARD);
            userRepository.save(u);
            notificationService.create(u, Notification.NotificationType.SUBSCRIPTION_ACTIVATED,
                    planName + " 플랜 구독이 시작되었습니다",
                    planName + " 플랜이 활성화되었습니다. 만료일: " + sub.getExpiresAt().toLocalDate() + ". 이용해 주셔서 감사합니다!",
                    "SUBSCRIPTION", saved.getId());
        });
        log.info("Pro activated userId={} orderId={} expiresAt={}", userId, orderId, sub.getExpiresAt());
        return saved;
    }

    /** 留뚮즺 ?쇨큵 泥섎━ (?ㅼ?以꾨윭?먯꽌 留ㅼ떆媛??몄텧 媛??. */
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

