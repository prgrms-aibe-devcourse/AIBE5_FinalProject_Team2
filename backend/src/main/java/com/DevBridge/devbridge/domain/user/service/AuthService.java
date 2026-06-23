package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.notification.entity.Notification;
import com.DevBridge.devbridge.domain.notification.service.NotificationService;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AesGcmCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AesGcmCryptoService crypto;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;
    private final NotificationService notificationService;

    @Transactional
    public User signup(SignupRequest request) {
        if (!emailVerificationService.consumeVerified(request.getEmail())) {
            throw new RuntimeException("이메일 인증이 필요합니다.");
        }
        if (userRepository.findByEmailAndDeletedFalse(request.getEmail()).isPresent()) {
            throw new RuntimeException("이미 사용 중인 이메일입니다.");
        }
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("이미 사용 중인 사용자 이름입니다.");
        }

        User user = User.builder()
                .email(request.getEmail())
                .phone(request.getPhone())
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .userType(request.getUserType())
                .birthDate(request.getBirthDate())
                .build();

        User saved = userRepository.save(user);
        try {
            notificationService.create(saved, Notification.NotificationType.ACCOUNT_CREATED,
                    "Alpha-Helix에 오신 것을 환영합니다!",
                    saved.getUsername() + " 님, 계정이 생성되었습니다. 워크스페이스를 만들고 전략을 시작해보세요.",
                    null, null);
        } catch (Exception e) {
            log.warn("[Auth] 가입 알림 전송 실패 (무시): {}", e.getMessage());
        }
        return saved;
    }

    @Transactional
    public User login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));

        if (user.isDeleted()) {
            throw new RuntimeException("탈퇴한 계정입니다.");
        }

        String stored = user.getPassword();
        String raw = request.getPassword();
        boolean ok;
        if (stored != null && stored.startsWith("$2")) {
            ok = passwordEncoder.matches(raw, stored);
        } else {
            // 레거시 평문 비번 — 일치 시 즉시 BCrypt 로 재해싱
            ok = stored != null && stored.equals(raw);
            if (ok) {
                user.setPassword(passwordEncoder.encode(raw));
                userRepository.save(user);
            }
        }
        if (!ok) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다.");
        }
        return user;
    }

    /** 비밀번호 찾기 — 이메일로 사용자 조회 후 해당 이메일로 인증코드 발송. 마스킹된 이메일 반환. */
    public java.util.Map<String, String> sendPasswordResetCode(String email) {
        userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
        emailVerificationService.sendCode(email);
        return java.util.Map.of("email", email, "maskedEmail", maskEmail(email));
    }

    /** 비밀번호 재설정 — 이메일이 인증 완료 상태인 경우에만 비밀번호 교체. */
    @Transactional
    public void resetPassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
        if (!emailVerificationService.consumeVerified(email)) {
            throw new RuntimeException("이메일 인증이 필요합니다.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    private String maskEmail(String email) {
        int atIdx = email.indexOf('@');
        if (atIdx <= 0) return email;
        String local = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        if (local.length() <= 2) return local.charAt(0) + "*" + domain;
        return local.charAt(0) + "*".repeat(local.length() - 2) + local.charAt(local.length() - 1) + domain;
    }

    /** 현재 비밀번호 검증 (step-1 인증용). */
    public boolean verifyPassword(Long userId, String rawPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        return passwordEncoder.matches(rawPassword, user.getPassword());
    }

    /** 비밀번호 변경. currentPassword 재검증 후 newPassword 로 교체. */
    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("현재 비밀번호가 일치하지 않습니다.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /**
     * 소셜 로그인 (구글 등) — 검증된 이메일 기반 find-or-create.
     * 계정이 있으면 로그인, 없으면 자동 가입(GitHub 플로우와 동일).
     * 호출 전 AuthController.verifyGoogleAccessToken 이 토큰을 Google 에 직접 검증하므로
     * 위조 이메일은 들어올 수 없다 → 이메일 인증 코드(SMTP) 없이도 안전하게 가입 가능.
     */
    @Transactional
    public User socialLogin(String email) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    if (user.isDeleted()) throw new RuntimeException("탈퇴한 계정입니다.");
                    return user;
                })
                .orElseGet(() -> {
                    String base = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9_]", "_");
                    if (base.isBlank()) base = "user";
                    String username = base;
                    int suffix = 2;
                    while (userRepository.findByUsername(username).isPresent()) {
                        username = base + suffix++;
                    }
                    User newUser = User.builder()
                            .email(email)
                            .username(username)
                            .password(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                            .phone("00000000000")
                            .userType(User.UserType.FREE)
                            .build();
                    return userRepository.save(newUser);
                });
    }

    /**
     * GitHub OAuth 로그인/회원가입 분기.
     * - 기존 계정 있음: GitHub 정보 업데이트 후 User 반환 (Optional.of)
     * - 기존 계정 없음: 이메일 인증 상태로 마킹 후 Optional.empty() 반환 → 프론트가 회원가입 폼으로 유도
     */
    @Transactional
    public java.util.Optional<User> githubLoginOrMark(String email, String githubLogin, String accessToken) {
        java.util.Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User user = existing.get();
            if (user.isDeleted()) throw new RuntimeException("탈퇴한 계정입니다.");
            user.setGithubUsername(githubLogin);
            user.setGithubConnectedAt(java.time.LocalDateTime.now());
            if (accessToken != null && !accessToken.isBlank()) {
                try { user.setGithubTokenEncrypted(crypto.encrypt(accessToken)); } catch (Exception ignored) {}
            }
            return java.util.Optional.of(userRepository.save(user));
        } else {
            // GitHub이 이미 이메일을 인증했으므로 인증 완료로 마킹 → 회원가입 폼에서 코드 입력 불필요
            emailVerificationService.markVerified(email);
            return java.util.Optional.empty();
        }
    }

    /**
     * GitHub OAuth 전용 — 이메일로 기존 계정을 찾고, 없으면 GitHub 정보로 자동 생성.
     */
    @Transactional
    public User findOrCreateGithubUser(String email, String githubLogin, String accessToken) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        byte[] encryptedToken = null;
        if (accessToken != null && !accessToken.isBlank()) {
            try { encryptedToken = crypto.encrypt(accessToken); } catch (Exception ignored) {}
        }
        final byte[] tokenBytes = encryptedToken;

        return userRepository.findByEmail(email)
                .map(existing -> {
                    if (existing.isDeleted()) {
                        throw new RuntimeException("탈퇴한 계정입니다.");
                    }
                    existing.setGithubUsername(githubLogin);
                    existing.setGithubConnectedAt(now);
                    if (tokenBytes != null) existing.setGithubTokenEncrypted(tokenBytes);
                    return userRepository.save(existing);
                })
                .orElseGet(() -> {
                    String baseUsername = githubLogin.toLowerCase().replaceAll("[^a-z0-9_]", "_");
                    String username = baseUsername;
                    int suffix = 2;
                    while (userRepository.findByUsername(username).isPresent()) {
                        username = baseUsername + suffix++;
                    }

                    User newUser = User.builder()
                            .email(email)
                            .username(username)
                            .password(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                            .phone("00000000000")
                            .userType(User.UserType.FREE)
                            .githubUsername(githubLogin)
                            .githubTokenEncrypted(tokenBytes)
                            .githubConnectedAt(now)
                            .build();

                    return userRepository.save(newUser);
                });
    }
}
