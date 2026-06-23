package com.DevBridge.devbridge.domain.notification.controller;

import com.DevBridge.devbridge.domain.notification.dto.NotificationResponse;
import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.repository.NotificationRepository;
import com.DevBridge.devbridge.domain.notification.service.NotificationSseService;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

/**
 * 알림 엔드포인트 — JWT 인증 사용자 본인 알림만 접근 가능 (IDOR 방지).
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final NotificationSseService sseService;

    /**
     * SSE 구독 — 새 알림 발생 시 실시간 push.
     * 프론트: const es = new EventSource('/api/notifications/stream', {withCredentials:true});
     *         es.addEventListener('notification', e => handleNew(JSON.parse(e.data)));
     * 연결 끊기면 EventSource가 자동 재연결 (지수 백오프).
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) {
            SseEmitter err = new SseEmitter();
            err.completeWithError(new SecurityException("인증 필요"));
            return err;
        }
        return sseService.subscribe(uid);
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        User user = currentUser();
        if (user == null) return unauthorized();
        List<NotificationResponse> list = notificationRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(NotificationResponse::from).toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/unread")
    public ResponseEntity<?> getUnread() {
        User user = currentUser();
        if (user == null) return unauthorized();
        List<NotificationResponse> list = notificationRepository.findByUserAndIsReadFalseOrderByCreatedAtDesc(user)
                .stream().map(NotificationResponse::from).toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/count")
    public ResponseEntity<?> getUnreadCount() {
        User user = currentUser();
        if (user == null) return unauthorized();
        long count = notificationRepository.countByUserAndIsReadFalse(user);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PatchMapping("/{notificationId}/read")
    @Transactional
    public ResponseEntity<?> markOneRead(@PathVariable Long notificationId) {
        User user = currentUser();
        if (user == null) return unauthorized();
        int updated = notificationRepository.markOneReadByIdAndUser(notificationId, user);
        return updated > 0 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PatchMapping("/read-all")
    @Transactional
    public ResponseEntity<?> markAllRead() {
        User user = currentUser();
        if (user == null) return unauthorized();
        notificationRepository.markAllReadByUser(user);
        return ResponseEntity.noContent().build();
    }

    private User currentUser() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return null;
        return userRepository.findById(uid).orElse(null);
    }

    private static ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증 필요"));
    }
}
