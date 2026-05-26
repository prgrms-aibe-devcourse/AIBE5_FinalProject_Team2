package com.DevBridge.devbridge.domain.user.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

/**
 * 사용자 프로필 상세 (AIchatProfile 결과 등) 통합 GET/PUT 페이로드.
 * 프론트엔드 zustand `partnerProfileDetail` / `clientProfileDetail` 스키마와 1:1 매칭.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserProfileDetailRequest {

    private String bio;
    private String strengthDesc;
    private String shortBio;          // 한줄 자기소개 (200자 이내)
    private String industry;
    private String githubUrl;
    private String githubHandle;
    private String githubRepoUrl;

    /** intro/skills/career/.../portfolio 가시성 토글 */
    private Map<String, Boolean> profileMenuToggles;

    private VerifiedEmail verifiedEmail;

    private List<SkillItem> skills;
    private List<CareerItem> careers;
    private List<EducationItem> educations;
    private List<CertificationItem> certifications;
    private List<AwardItem> awards;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class VerifiedEmail {
        private String type;  // "school" | "company"
        private String email;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SkillItem {
        private String techName;
        private String customTech;
        private String proficiency;
        private String experience;
        private String mode;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CareerItem {
        private String companyName;
        private String mainTech;
        private String jobTitle;
        private String startDate;
        private String endDate;
        private Boolean isCurrent;
        private String employmentType;
        private String role;
        private String level;
        private String description;
        /** [{name, startDate, endDate, description}, ...] */
        private List<Map<String, Object>> projects;
        private Boolean verifiedCompany;
        private String verifiedEmail;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EducationItem {
        private String schoolType;
        private String schoolName;
        private String track;
        private String major;
        private String degreeType;
        private String status;
        private String admissionDate;
        private String graduationDate;
        private String gpa;
        private String gpaScale;
        private String researchTopic;
        private Boolean verifiedSchool;
        private String verifiedEmail;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CertificationItem {
        private String certName;
        private String issuer;
        private String acquiredDate;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AwardItem {
        private String awardName;
        private String awarding;
        private String awardDate;
        private String description;
    }
}
