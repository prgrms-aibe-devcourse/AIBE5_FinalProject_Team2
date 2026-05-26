package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.chat.service.StreamChatService;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.domain.client.repository.ClientProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final StreamChatService streamChatService;

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
        if (type == null) return ClientProfile.ClientType.INDIVIDUAL;
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
}
