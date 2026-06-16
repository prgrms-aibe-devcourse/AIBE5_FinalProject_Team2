package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.entity.UserProfileDetail;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailRequest;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailResponse;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.domain.user.repository.UserProfileDetailRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserProfileDetailRepository userProfileDetailRepository;

    private static final ObjectMapper OM = new ObjectMapper();

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

        return UserProfileDetailResponse.builder()
                .userId(userId)
                .username(user.getUsername())
                .email(user.getEmail())
                .userType(user.getUserType() != null ? user.getUserType().name() : "FREE")
                .phone(user.getPhone())
                .birthDate(user.getBirthDate() != null ? user.getBirthDate().toString() : null)
                .region(user.getRegion())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .taxEmail(user.getTaxEmail())
                .contactEmail(user.getContactEmail())
                .profileImageUrl(user.getProfileImageUrl())
                .githubUsername(user.getGithubUsername())
                .bio(detail != null ? detail.getBio() : null)
                .strengthDesc(detail != null ? detail.getStrengthDesc() : null)
                .shortBio(detail != null ? detail.getShortBio() : null)
                .githubUrl(detail != null ? detail.getGithubUrl() : null)
                .githubHandle(detail != null ? detail.getGithubHandle() : null)
                .githubRepoUrl(detail != null ? detail.getGithubRepoUrl() : null)
                .profileMenuToggles(toggles)
                .verifiedEmail(verified)
                .build();
    }

    @Transactional
    public void resetByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. username=" + username));
        resetMyProfile(user.getId());
    }

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

        return getDetail(userId);
    }

    @Transactional
    public Map<String, Object> updateBasicInfo(Long userId, com.DevBridge.devbridge.domain.user.dto.UpdateUserBasicInfoRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            String newEmail = req.getEmail().trim();
            if (!newEmail.equals(user.getEmail())) {
                if (userRepository.findByEmail(newEmail).isPresent()) {
                    throw new RuntimeException("이미 사용 중인 이메일입니다: " + newEmail);
                }
                user.setEmail(newEmail);
            }
        }
        if (req.getUsername() != null && !req.getUsername().isBlank()) {
            String newUsername = req.getUsername().trim();
            if (!newUsername.equals(user.getUsername())) {
                if (userRepository.findByUsername(newUsername).isPresent()) {
                    throw new RuntimeException("이미 사용 중인 닉네임입니다: " + newUsername);
                }
                user.setUsername(newUsername);
            }
        }
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
                User.Gender genderEnum = User.Gender.valueOf(req.getGender().toUpperCase().trim());
                user.setGender(genderEnum);
            } catch (IllegalArgumentException e) {
                log.warn("[ProfileService] gender 변환 실패: '{}'", req.getGender());
                throw new RuntimeException("잘못된 성별 값입니다. MALE, FEMALE, OTHER 중 하나를 사용해주세요.");
            }
        }
        if (req.getProfileImageUrl() != null) {
            user.setProfileImageUrl(req.getProfileImageUrl().isBlank() ? null : req.getProfileImageUrl());
        }
        if (req.getGithubNickname() != null) {
            String trimmed = req.getGithubNickname().trim();
            user.setGithubUsername(trimmed.isEmpty() ? null : trimmed);
        }
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "기본 정보가 업데이트되었습니다.");
        Map<String, Object> data = new HashMap<>();
        data.put("email", user.getEmail() != null ? user.getEmail() : "");
        data.put("username", user.getUsername() != null ? user.getUsername() : "");
        data.put("phone", user.getPhone() != null ? user.getPhone() : "");
        data.put("birthDate", user.getBirthDate() != null ? user.getBirthDate().toString() : "");
        data.put("region", user.getRegion() != null ? user.getRegion() : "");
        data.put("gender", user.getGender() != null ? user.getGender().name() : "");
        data.put("taxEmail", user.getTaxEmail() != null ? user.getTaxEmail() : "");
        data.put("contactEmail", user.getContactEmail() != null ? user.getContactEmail() : "");
        data.put("profileImageUrl", user.getProfileImageUrl() != null ? user.getProfileImageUrl() : "");
        data.put("githubUsername", user.getGithubUsername() != null ? user.getGithubUsername() : "");
        response.put("data", data);
        return response;
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
}
