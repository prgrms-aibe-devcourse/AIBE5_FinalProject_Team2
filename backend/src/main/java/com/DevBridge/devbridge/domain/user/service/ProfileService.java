package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.entity.UserProfileDetail;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.client.entity.ClientProfileStats;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailRequest;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailResponse;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.domain.user.repository.UserProfileDetailRepository;
import com.DevBridge.devbridge.domain.client.repository.ClientProfileRepository;
import com.DevBridge.devbridge.domain.client.repository.ClientProfileStatsRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 사용자 프로필 세부 정보 (UserProfileDetail) 일괄 처리.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserProfileDetailRepository userProfileDetailRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final ClientProfileStatsRepository clientProfileStatsRepository;

    private static final ObjectMapper OM = new ObjectMapper();

    /** username 으로 다른 사용자의 프로필 상세를 조회 (public 조회). */
    @Transactional(readOnly = true)
    public UserProfileDetailResponse getDetailByUsername(String username) {
        User u = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + username));
        return getDetail(u.getId());
    }

    @Transactional(readOnly = true)
    public UserProfileDetailResponse getDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        UserProfileDetail detail = userProfileDetailRepository.findByUser(user).orElse(null);

        Map<String, Boolean> toggles = parseToggles(detail != null ? detail.getProfileMenuToggles() : null);
        UserProfileDetailRequest.VerifiedEmail verified = null;
        if (detail != null && (detail.getVerifiedEmail() != null || detail.getVerifiedEmailType() != null)) {
            verified = UserProfileDetailRequest.VerifiedEmail.builder()
                    .type(detail.getVerifiedEmailType())
                    .email(detail.getVerifiedEmail())
                    .build();
        }

        String industry = null;
        String slogan = null;
        String shortBio = detail != null ? detail.getShortBio() : null;
        String strengthDescFromProfile = null;
        String grade = null;
        Integer completedProjects = null;
        Double rating = null;

        ClientProfile clientProfile = clientProfileRepository.findByUser(user).orElse(null);
        if (clientProfile != null) {
            industry = clientProfile.getIndustry();
            slogan = clientProfile.getSlogan();
            if (shortBio == null) shortBio = clientProfile.getShortBio();
            strengthDescFromProfile = clientProfile.getStrengthDesc();
            grade = clientProfile.getGrade() != null ? clientProfile.getGrade().name() : null;
            var statsOpt = clientProfileStatsRepository.findByClientProfile(clientProfile);
            if (statsOpt.isPresent()) {
                var stats = statsOpt.get();
                completedProjects = stats.getCompletedProjects();
                rating = stats.getRating();
            }
        }

        return UserProfileDetailResponse.builder()
                .userId(userId)
                .phone(user.getPhone())
                .birthDate(user.getBirthDate() != null ? user.getBirthDate().toString() : null)
                .region(user.getRegion())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .taxEmail(user.getTaxEmail())
                .contactEmail(user.getContactEmail())
                .profileImageUrl(user.getProfileImageUrl())
                .grade(grade)
                .completedProjects(completedProjects)
                .rating(rating)
                .bio(detail != null ? detail.getBio() : null)
                .strengthDesc(detail != null ? detail.getStrengthDesc() : null)
                .shortBio(shortBio)
                .industry(industry)
                .slogan(slogan)
                .sloganSub(strengthDescFromProfile)
                .githubUrl(detail != null ? detail.getGithubUrl() : null)
                .githubHandle(detail != null ? detail.getGithubHandle() : null)
                .githubRepoUrl(detail != null ? detail.getGithubRepoUrl() : null)
                .profileMenuToggles(toggles)
                .verifiedEmail(verified)
                .build();
    }

    /** [DEV ONLY] username 으로 직접 초기화. */
    @Transactional
    public void resetByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. username=" + username));
        resetMyProfile(user.getId());
    }

    /**
     * 본인 프로필 데이터 일괄 초기화.
     */
    @Transactional
    public void resetMyProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        userProfileDetailRepository.findByUser(user).ifPresent(detail -> {
            detail.setBio(null);
            detail.setShortBio(null);
            detail.setStrengthDesc(null);
            detail.setGithubUrl(null);
            detail.setGithubHandle(null);
            detail.setGithubRepoUrl(null);
            detail.setVerifiedEmail(null);
            detail.setVerifiedEmailType(null);
            userProfileDetailRepository.save(detail);
        });
    }

    /**
     * 전체 프로필 세부 정보 일괄 저장 (upsert).
     */
    @Transactional
    public UserProfileDetailResponse saveDetail(Long userId, UserProfileDetailRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        UserProfileDetail detail = userProfileDetailRepository.findByUser(user)
                .orElseGet(() -> UserProfileDetail.builder().user(user).build());

        detail.setBio(req.getBio());
        detail.setStrengthDesc(req.getStrengthDesc());
        detail.setShortBio(req.getShortBio());
        detail.setGithubUrl(req.getGithubUrl());
        detail.setGithubHandle(req.getGithubHandle());
        detail.setGithubRepoUrl(req.getGithubRepoUrl());
        detail.setProfileMenuToggles(toJson(req.getProfileMenuToggles()));
        if (req.getVerifiedEmail() != null) {
            detail.setVerifiedEmailType(req.getVerifiedEmail().getType());
            detail.setVerifiedEmail(req.getVerifiedEmail().getEmail());
        }
        userProfileDetailRepository.save(detail);

        syncToClientProfile(user, req);

        return getDetail(userId);
    }

    private void syncToClientProfile(User user, UserProfileDetailRequest req) {
        clientProfileRepository.findByUser(user).ifPresent(cp -> {
            if (req.getBio() != null) cp.setBio(req.getBio());
            if (req.getStrengthDesc() != null) cp.setStrengthDesc(req.getStrengthDesc());
            if (req.getShortBio() != null) cp.setShortBio(req.getShortBio());
            if (req.getIndustry() != null) cp.setIndustry(req.getIndustry());
            clientProfileRepository.save(cp);
        });
    }

    private static String toJson(Object value) {
        if (value == null) return null;
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    private static Map<String, Boolean> parseToggles(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, new TypeReference<Map<String, Boolean>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 마이페이지에서 사용자 기본 정보 업데이트.
     */
    @Transactional
    public Map<String, Object> updateBasicInfo(Long userId, com.DevBridge.devbridge.domain.user.dto.UpdateUserBasicInfoRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            user.setPhone(req.getPhone());
        }
        if (req.getBirthDate() != null && !req.getBirthDate().isBlank()) {
            try {
                user.setBirthDate(java.time.LocalDate.parse(req.getBirthDate()));
            } catch (Exception e) {
                log.warn("[ProfileService] birthDate 파싱 실패: {}", req.getBirthDate());
            }
        }
        if (req.getRegion() != null && !req.getRegion().isBlank()) {
            user.setRegion(req.getRegion());
        }
        if (req.getTaxEmail() != null && !req.getTaxEmail().isBlank()) {
            user.setTaxEmail(req.getTaxEmail());
        }
        if (req.getContactEmail() != null && !req.getContactEmail().isBlank()) {
            user.setContactEmail(req.getContactEmail());
        }
        if (req.getGender() != null && !req.getGender().isBlank()) {
            try {
                String genderUpper = req.getGender().toUpperCase().trim();
                User.Gender genderEnum = User.Gender.valueOf(genderUpper);
                user.setGender(genderEnum);
            } catch (IllegalArgumentException e) {
                log.warn("[ProfileService] gender 변환 실패: '{}' (허용값: MALE, FEMALE, OTHER)", req.getGender());
                throw new RuntimeException("잘못된 성별 값입니다. MALE, FEMALE, OTHER 중 하나를 사용해주세요.");
            }
        }
        if (req.getProfileImageUrl() != null && !req.getProfileImageUrl().isBlank()) {
            user.setProfileImageUrl(req.getProfileImageUrl());
        }
        userRepository.save(user);

        String updatedIndustry = null;
        if (user.getUserType() == User.UserType.CLIENT) {
            clientProfileRepository.findByUser(user).ifPresent(cp -> {
                if (req.getIndustry() != null && !req.getIndustry().isBlank()) {
                    cp.setIndustry(req.getIndustry());
                }
                if (req.getSlogan() != null && !req.getSlogan().isBlank()) {
                    cp.setSlogan(req.getSlogan());
                }
                clientProfileRepository.save(cp);
            });
            updatedIndustry = req.getIndustry();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "기본 정보가 업데이트되었습니다.");
        response.put("data", Map.of(
            "phone", user.getPhone() != null ? user.getPhone() : "",
            "birthDate", user.getBirthDate() != null ? user.getBirthDate().toString() : "",
            "region", user.getRegion() != null ? user.getRegion() : "",
            "gender", user.getGender() != null ? user.getGender().name() : "",
            "taxEmail", user.getTaxEmail() != null ? user.getTaxEmail() : "",
            "contactEmail", user.getContactEmail() != null ? user.getContactEmail() : "",
            "profileImageUrl", user.getProfileImageUrl() != null ? user.getProfileImageUrl() : "",
            "industry", updatedIndustry != null ? updatedIndustry : ""
        ));
        return response;
    }
}
