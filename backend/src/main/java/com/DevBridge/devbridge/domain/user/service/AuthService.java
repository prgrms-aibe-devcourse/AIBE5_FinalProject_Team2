package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.chat.service.StreamChatService;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.partner.entity.PartnerSkill;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.project.entity.SkillMaster;
import com.DevBridge.devbridge.domain.user.dto.LoginRequest;
import com.DevBridge.devbridge.domain.user.dto.SignupRequest;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.interest.entity.*;
import com.DevBridge.devbridge.domain.partner.entity.*;
import com.DevBridge.devbridge.domain.client.entity.*;
import com.DevBridge.devbridge.domain.project.entity.*;
import com.DevBridge.devbridge.domain.chat.entity.*;
import com.DevBridge.devbridge.domain.review.entity.*;
import com.DevBridge.devbridge.domain.notification.entity.*;
import com.DevBridge.devbridge.domain.payment.entity.*;
import com.DevBridge.devbridge.domain.strategy.entity.*;
import com.DevBridge.devbridge.domain.ai.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.interest.repository.*;
import com.DevBridge.devbridge.domain.partner.repository.*;
import com.DevBridge.devbridge.domain.client.repository.*;
import com.DevBridge.devbridge.domain.project.repository.*;
import com.DevBridge.devbridge.domain.chat.repository.*;
import com.DevBridge.devbridge.domain.review.repository.*;
import com.DevBridge.devbridge.domain.notification.repository.*;
import com.DevBridge.devbridge.domain.payment.repository.*;
import com.DevBridge.devbridge.domain.strategy.repository.*;
import com.DevBridge.devbridge.domain.ai.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final PartnerProfileRepository partnerProfileRepository;
    private final SkillMasterRepository skillMasterRepository;
    private final PartnerSkillRepository partnerSkillRepository;
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
        } else if (request.getUserType() == User.UserType.PARTNER) {
            createPartnerProfile(savedUser, request);
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

    private void createPartnerProfile(User user, SignupRequest request) {
        // 기본 회원가입에서 입력받은 industry를 PartnerProfile.serviceField로 매핑.
        // PartnerRegister.jsx에서 별도로 workCategory를 입력하면 그것이 우선됨.
        String resolvedServiceField = request.getIndustry();

        PartnerProfile partnerProfile = PartnerProfile.builder()
                .user(user)
                .heroKey("hero_default.png")
                .serviceField(resolvedServiceField)
                .workCategory(mapWorkCategory(request.getWorkCategory()))
                .jobRoles(request.getJobRoles())
                .partnerType(mapPartnerType(request.getPartnerType()))
                .preferredProjectType(mapProjectType(request.getPreferredProjectType()))
                .workAvailableHours(request.getWorkAvailableHours())
                .communicationChannels(request.getCommunicationChannels())
                .devLevel(mapDevLevel(request.getDevLevel()))
                .devExperience(mapDevExperience(request.getDevExperience()))
                .workPreference(mapWorkPreference(request.getWorkPreference()))
                .slogan(request.getSlogan())
                .salaryHour(request.getSalaryHour())
                .salaryMonth(request.getSalaryMonth())
                .githubUrl(request.getGithubUrl())
                .blogUrl(request.getBlogUrl())
                .youtubeUrl(request.getYoutubeUrl())
                .hashtags(request.getHashtags())
                .bio(request.getBio())
                .build();

        PartnerProfile savedPartner = partnerProfileRepository.save(partnerProfile);

        if (request.getSkills() != null) {
            for (String skillName : request.getSkills()) {
                SkillMaster skill = skillMasterRepository.findByName(skillName)
                        .orElseGet(() -> skillMasterRepository.save(SkillMaster.builder().name(skillName).build()));

                PartnerSkill partnerSkill = PartnerSkill.builder()
                        .partnerProfile(savedPartner)
                        .skill(skill)
                        .build();
                partnerSkillRepository.save(partnerSkill);
            }
        }
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

    private PartnerProfile.WorkCategory mapWorkCategory(String cat) {
        return switch (cat) {
            case "개발" -> PartnerProfile.WorkCategory.DEVELOP;
            case "기획" -> PartnerProfile.WorkCategory.PLANNING;
            case "디자인" -> PartnerProfile.WorkCategory.DESIGN;
            case "배포" -> PartnerProfile.WorkCategory.DISTRIBUTION;
            default -> PartnerProfile.WorkCategory.valueOf(cat);
        };
    }

    private PartnerProfile.PartnerType mapPartnerType(String type) {
        return switch (type) {
            case "개인" -> PartnerProfile.PartnerType.INDIVIDUAL;
            case "팀" -> PartnerProfile.PartnerType.TEAM;
            case "개인사업자" -> PartnerProfile.PartnerType.SOLE_PROPRIETOR;
            case "법인사업자" -> PartnerProfile.PartnerType.CORPORATION;
            default -> PartnerProfile.PartnerType.valueOf(type);
        };
    }

    private PartnerProfile.PreferredProjectType mapProjectType(String type) {
        return switch (type) {
            case "외주" -> PartnerProfile.PreferredProjectType.FREELANCE;
            case "기간제 근무" -> PartnerProfile.PreferredProjectType.CONTRACT_BASED;
            default -> PartnerProfile.PreferredProjectType.valueOf(type);
        };
    }

    private PartnerProfile.DevLevel mapDevLevel(String level) {
        if (level == null) return PartnerProfile.DevLevel.JUNIOR;
        if (level.contains("Junior")) return PartnerProfile.DevLevel.JUNIOR;
        if (level.contains("Mid")) return PartnerProfile.DevLevel.MIDDLE;
        if (level.contains("Senior (5-7")) return PartnerProfile.DevLevel.SENIOR_5_7Y;
        if (level.contains("Senior (7+")) return PartnerProfile.DevLevel.SENIOR_7_10Y;
        if (level.contains("Lead")) return PartnerProfile.DevLevel.LEAD;
        return PartnerProfile.DevLevel.valueOf(level);
    }

    private PartnerProfile.DevExperience mapDevExperience(String exp) {
        if (exp == null) return PartnerProfile.DevExperience.UND_1Y;
        if (exp.contains("< 1")) return PartnerProfile.DevExperience.UND_1Y;
        if (exp.contains("1-2")) return PartnerProfile.DevExperience.EXP_1_3Y;
        if (exp.contains("3-5")) return PartnerProfile.DevExperience.EXP_3_5Y;
        if (exp.contains("5-7")) return PartnerProfile.DevExperience.EXP_5_7Y;
        if (exp.contains("7+")) return PartnerProfile.DevExperience.OVER_7Y;
        return PartnerProfile.DevExperience.valueOf(exp);
    }

    private PartnerProfile.WorkPreference mapWorkPreference(String pref) {
        return switch (pref) {
            case "Remote" -> PartnerProfile.WorkPreference.REMOTE;
            case "On-site" -> PartnerProfile.WorkPreference.ONSITE;
            case "Hybrid" -> PartnerProfile.WorkPreference.HYBRID;
            default -> PartnerProfile.WorkPreference.valueOf(pref);
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
