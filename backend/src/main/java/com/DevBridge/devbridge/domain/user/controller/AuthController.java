package com.DevBridge.devbridge.domain.user.controller;

import com.DevBridge.devbridge.domain.user.dto.AuthResponse;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.global.security.JwtUtil;
import com.DevBridge.devbridge.domain.user.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    public static final String AUTH_COOKIE_NAME = "DEVBRIDGE_TOKEN";

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @Value("${app.jwt.ttl-hours:24}")
    private long jwtTtlHours;

    @Value("${github.client.id:}")
    private String githubClientId;

    @Value("${github.client.secret:}")
    private String githubClientSecret;

    private ResponseCookie buildAuthCookie(String token) {
        return ResponseCookie.from(AUTH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(java.time.Duration.ofHours(jwtTtlHours))
                .build();
    }

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
                            .githubUsername(user.getGithubUsername())
                            .token(token)
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
                            .githubUsername(user.getGithubUsername())
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
    public ResponseEntity<AuthResponse> socialLogin(@RequestBody Map<String, String> request) {
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
                            .githubUsername(user.getGithubUsername())
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
     * GitHub OAuth 로그인.
     * 프론트에서 GitHub 인가 코드(code)를 받아 access_token 으로 교환하고,
     * GitHub /user/emails + /user API 로 이메일·로그인명을 확인한 뒤 JWT 를 발급한다.
     * 기존 가입 이메일이면 그대로 로그인, 처음이면 자동으로 계정을 생성한다.
     */
    @PostMapping("/github")
    public ResponseEntity<AuthResponse> githubLogin(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        String redirectUri = request.get("redirectUri");

        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message("GitHub code가 필요합니다.").build());
        }

        try {
            // 1. code → access_token 교환
            var tokenHeaders = new org.springframework.http.HttpHeaders();
            tokenHeaders.set("Accept", "application/json");
            Map<String, String> tokenBody = Map.of(
                    "client_id", githubClientId,
                    "client_secret", githubClientSecret,
                    "code", code,
                    "redirect_uri", redirectUri != null ? redirectUri : ""
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> tokenResp = restTemplate.postForObject(
                    "https://github.com/login/oauth/access_token",
                    new org.springframework.http.HttpEntity<>(tokenBody, tokenHeaders),
                    Map.class
            );

            if (tokenResp == null || !tokenResp.containsKey("access_token")) {
                String errDesc = tokenResp != null ? String.valueOf(tokenResp.get("error_description")) : "응답 없음";
                return ResponseEntity.badRequest().body(AuthResponse.builder()
                        .message("GitHub 토큰 발급 실패: " + errDesc).build());
            }
            String accessToken = (String) tokenResp.get("access_token");

            var ghHeaders = new org.springframework.http.HttpHeaders();
            ghHeaders.set("Authorization", "Bearer " + accessToken);
            ghHeaders.set("Accept", "application/vnd.github+json");
            ghHeaders.set("X-GitHub-Api-Version", "2022-11-28");
            var ghEntity = new org.springframework.http.HttpEntity<>(ghHeaders);

            // 2. 인증된 primary 이메일 조회
            ResponseEntity<List<Map<String, Object>>> emailResp = restTemplate.exchange(
                    "https://api.github.com/user/emails",
                    HttpMethod.GET, ghEntity,
                    new ParameterizedTypeReference<>() {}
            );
            List<Map<String, Object>> emails = emailResp.getBody();
            if (emails == null || emails.isEmpty()) {
                return ResponseEntity.badRequest().body(AuthResponse.builder()
                        .message("GitHub 이메일 정보를 가져올 수 없습니다.").build());
            }
            String email = emails.stream()
                    .filter(e -> Boolean.TRUE.equals(e.get("primary")) && Boolean.TRUE.equals(e.get("verified")))
                    .map(e -> (String) e.get("email"))
                    .findFirst()
                    .orElseGet(() -> emails.stream()
                            .filter(e -> Boolean.TRUE.equals(e.get("verified")))
                            .map(e -> (String) e.get("email"))
                            .findFirst()
                            .orElse(null));
            if (email == null) {
                return ResponseEntity.badRequest().body(AuthResponse.builder()
                        .message("인증된 GitHub 이메일이 없습니다. GitHub 계정에서 이메일을 인증해 주세요.").build());
            }

            // 3. GitHub 프로필 조회 (username 확보)
            @SuppressWarnings("unchecked")
            Map<String, Object> ghUser = restTemplate.exchange(
                    "https://api.github.com/user",
                    HttpMethod.GET, ghEntity, Map.class
            ).getBody();
            String githubLogin = ghUser != null && ghUser.get("login") != null
                    ? (String) ghUser.get("login") : email.split("@")[0];

            // 4. 기존 계정 조회 → 없으면 자동 생성 (GitHub OAuth 표준 동작)
            // accessToken을 함께 저장해 Git 패널에서 별도 PAT 없이 바로 사용 가능
            User user = authService.findOrCreateGithubUser(email, githubLogin, accessToken);

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
                            .githubUsername(user.getGithubUsername())
                            .token(token)
                            .message("GitHub 로그인에 성공했습니다.")
                            .build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(AuthResponse.builder()
                    .message(e.getMessage()).build());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout() {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildClearCookie().toString())
                .body(Map.of("message", "로그아웃 되었습니다."));
    }
}
