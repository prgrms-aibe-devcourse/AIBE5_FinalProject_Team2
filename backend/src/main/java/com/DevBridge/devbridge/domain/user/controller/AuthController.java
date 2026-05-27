package com.DevBridge.devbridge.domain.user.controller;

import com.DevBridge.devbridge.domain.user.dto.AuthResponse;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.global.security.JwtUtil;
import com.DevBridge.devbridge.domain.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public static final String AUTH_COOKIE_NAME = "DEVBRIDGE_TOKEN";

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    /**
     * 운영(HTTPS)에선 true 권장. 로컬 dev에선 false (HTTP localhost는 secure 쿠키를 못 받음).
     * application-prod.properties에 app.cookie.secure=true 로 설정.
     */
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${app.jwt.ttl-hours:24}")
    private long jwtTtlHours;

    /** JWT 토큰을 HttpOnly 쿠키로 set. JS에서 접근 불가 → XSS 환경에서도 토큰 탈취 방지. */
    private ResponseCookie buildAuthCookie(String token) {
        return ResponseCookie.from(AUTH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(java.time.Duration.ofHours(jwtTtlHours))
                .build();
    }

    /** 로그아웃 시 쿠키를 즉시 만료시키는 빈 쿠키. */
    private ResponseCookie buildClearCookie() {
        return ResponseCookie.from(AUTH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody SignupRequest request) {
        try {
            User user = authService.signup(request);
            String token = jwtUtil.issue(user.getId(), user.getEmail(),
                    user.getUserType() != null ? user.getUserType().name() : "GUEST");
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, buildAuthCookie(token).toString())
                    .body(AuthResponse.builder()
                            .userId(user.getId())
                            .email(user.getEmail())
                            .username(user.getUsername())
                            .phone(user.getPhone())
                            .birthDate(user.getBirthDate())
                            .userType(user.getUserType())
                            .token(token) // 호환성: 일부 호출부가 아직 body의 token을 읽을 수 있어 유지
                            .message("회원가입이 완료되었습니다.")
                            .build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message(e.getMessage())
                    .build());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        try {
            User user = authService.login(request);
            String token = jwtUtil.issue(user.getId(), user.getEmail(),
                    user.getUserType() != null ? user.getUserType().name() : "GUEST");
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, buildAuthCookie(token).toString())
                    .body(AuthResponse.builder()
                            .userId(user.getId())
                            .email(user.getEmail())
                            .username(user.getUsername())
                            .phone(user.getPhone())
                            .birthDate(user.getBirthDate())
                            .userType(user.getUserType())
                            .token(token)
                            .message("로그인에 성공했습니다.")
                            .build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message(e.getMessage())
                    .build());
        }
    }

    /**
     * 소셜 로그인 (구글 등). 프론트가 OAuth 제공자에서 검증한 이메일을 전달하면,
     * 해당 이메일로 등록된 User 에 대해 JWT 를 발급한다.
     * 미가입 이메일은 400 으로 응답하여 호출부에서 회원가입 플로우로 안내.
     */
    @PostMapping("/social-login")
    public ResponseEntity<AuthResponse> socialLogin(@RequestBody java.util.Map<String, String> request) {
        String email = request.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message("이메일이 필요합니다.")
                    .build());
        }
        try {
            User user = authService.socialLogin(email);
            String token = jwtUtil.issue(user.getId(), user.getEmail(),
                    user.getUserType() != null ? user.getUserType().name() : "GUEST");
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, buildAuthCookie(token).toString())
                    .body(AuthResponse.builder()
                            .userId(user.getId())
                            .email(user.getEmail())
                            .username(user.getUsername())
                            .phone(user.getPhone())
                            .birthDate(user.getBirthDate())
                            .userType(user.getUserType())
                            .token(token)
                            .message("로그인에 성공했습니다.")
                            .build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message(e.getMessage())
                    .build());
        }
    }

    /**
     * GitHub OAuth 로그인 — 프론트가 받은 OAuth code를 전달하면
     * 서버가 GitHub과 직접 토큰을 교환하고 사용자 이메일로 JWT를 발급.
     * 미가입 이메일은 400 → 프론트에서 회원가입 안내.
     */
    @PostMapping("/github-callback")
    public ResponseEntity<AuthResponse> githubCallback(@RequestBody java.util.Map<String, String> request) {
        String code = request.get("code");
        String redirectUri = request.get("redirectUri");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(AuthResponse.builder().message("code가 필요합니다.").build());
        }
        try {
            User user = authService.githubLogin(code, redirectUri != null ? redirectUri : "");
            String token = jwtUtil.issue(user.getId(), user.getEmail(),
                    user.getUserType() != null ? user.getUserType().name() : "GUEST");
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, buildAuthCookie(token).toString())
                    .body(AuthResponse.builder()
                            .userId(user.getId())
                            .email(user.getEmail())
                            .username(user.getUsername())
                            .phone(user.getPhone())
                            .birthDate(user.getBirthDate())
                            .userType(user.getUserType())
                            .token(token)
                            .message("로그인에 성공했습니다.")
                            .build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(AuthResponse.builder().message(e.getMessage()).build());
        }
    }

    /** 로그아웃: 인증 쿠키 즉시 만료. body는 단순 응답. */
    @PostMapping("/logout")
    public ResponseEntity<java.util.Map<String, String>> logout() {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildClearCookie().toString())
                .body(java.util.Map.of("message", "로그아웃 되었습니다."));
    }
}
