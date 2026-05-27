package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.chat.service.StreamChatService;
import com.DevBridge.devbridge.domain.git.client.GithubApiClient;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.client.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.client.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final StreamChatService streamChatService;
    private final GithubApiClient githubApiClient;

    @Value("${github.client-id:}")
    private String githubClientId;

    @Value("${github.client-secret:}")
    private String githubClientSecret;

    private final RestClient githubOAuth = RestClient.builder()
            .defaultHeader(HttpHeaders.ACCEPT, "application/json")
            .build();

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
                .password(request.getPassword())
                .userType(request.getUserType())
                .interests(request.getInterests())
                .birthDate(request.getBirthDate())
                .build();

        User savedUser = userRepository.save(user);

        if (request.getUserType() == User.UserType.CLIENT) {
            createClientProfile(savedUser, request);
        }

        // Sync the new user to Stream Chat so they can connect immediately after signup
        try {
            streamChatService.upsertStreamUser(savedUser);
        } catch (Exception e) {
            System.err.println("[StreamChat] Warning: upsertStreamUser failed for new user "
                    + savedUser.getId() + ": " + e.getMessage());
        }

        return savedUser;
    }

    private void createClientProfile(User user, SignupRequest request) {
        ClientProfile clientProfile = ClientProfile.builder()
                .user(user)
                .clientType(mapClientType(request.getClientType()))
                .slogan(request.getSlogan())
                .industry(request.getIndustry())
                .heroKey("hero_check.png")
                .build();
        clientProfileRepository.save(clientProfile);
    }

    // --- 매핑 도우미 메서드 (프론트엔드 한글/설명 -> Enum) ---

    private ClientProfile.ClientType mapClientType(String type) {
        return switch (type) {
            case "법인사업자" -> ClientProfile.ClientType.CORPORATION;
            case "개인 사업자" -> ClientProfile.ClientType.SOLE_PROPRIETOR;
            case "개인" -> ClientProfile.ClientType.INDIVIDUAL;
            case "팀" -> ClientProfile.ClientType.TEAM;
            default -> ClientProfile.ClientType.valueOf(type);
        };
    }

    public User login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));

        if (!user.getPassword().equals(request.getPassword())) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다.");
        }

        return user;
    }

    /**
     * 소셜 로그인 (구글 등) — 이메일 기반으로 기존 User 조회.
     * 비밀번호 검증을 건너뛰고 토큰 발급 대상 User를 반환한다.
     * 가입되지 않은 경우 예외를 던지므로 호출부에서 회원가입 안내로 분기.
     */
    public User socialLogin(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
    }

    /**
     * GitHub OAuth 로그인.
     * 1) code를 GitHub access token으로 교환
     * 2) GitHub /user + /user/emails API로 이메일 확보
     * 3) 기존 이메일 계정이 있으면 로그인, 없으면 예외(호출부에서 회원가입 안내)
     */
    public User githubLogin(String code, String redirectUri) {
        if (githubClientId == null || githubClientId.isBlank()) {
            throw new RuntimeException("GitHub OAuth가 설정되지 않았습니다.");
        }

        // 1. code → access token
        Map<String, Object> tokenResp = githubOAuth.post()
                .uri("https://github.com/login/oauth/access_token")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "client_id", githubClientId,
                        "client_secret", githubClientSecret,
                        "code", code,
                        "redirect_uri", redirectUri
                ))
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});

        String accessToken = (String) tokenResp.get("access_token");
        if (accessToken == null || accessToken.isBlank()) {
            String err = (String) tokenResp.getOrDefault("error_description", "GitHub 인증 코드가 유효하지 않습니다.");
            throw new RuntimeException(err);
        }

        // 2. 사용자 이메일 확보 (공개 이메일 → 없으면 /user/emails에서 primary 추출)
        Map<String, String> userInfo = githubApiClient.getOAuthUserInfo(accessToken);
        String email = userInfo.get("email");
        if (email == null || email.isBlank()) {
            email = githubApiClient.getPrimaryEmail(accessToken);
        }
        if (email == null || email.isBlank()) {
            throw new RuntimeException("GitHub 계정에 이메일이 없습니다. GitHub 설정에서 이메일을 공개로 변경하거나, 인증된 이메일을 추가해 주세요.");
        }

        // 3. 기존 계정 조회
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("가입되지 않은 이메일입니다."));
    }
}
