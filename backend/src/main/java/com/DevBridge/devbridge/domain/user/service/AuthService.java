package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AesGcmCryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final AesGcmCryptoService crypto;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public User signup(SignupRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
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

        return userRepository.save(user);
    }

    @Transactional
    public User login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));

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

    /**
     * 소셜 로그인 (구글 등) — 이메일 기반으로 기존 User 조회.
     */
    public User socialLogin(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
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
