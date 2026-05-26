package com.DevBridge.devbridge.domain.partner.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "PARTNER_PROFILE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    // ===== ERD v2 확장 필드 =====
    @Column(length = 200)
    private String title;

    @Column(name = "hero_key", length = 30)
    private String heroKey;

    @Column(name = "service_field", length = 50)
    private String serviceField;

    @Column(name = "slogan_sub", length = 255)
    private String sloganSub;

    @Column(name = "strength_desc", columnDefinition = "TEXT")
    private String strengthDesc;

    @Column(name = "avatar_color", length = 16)
    private String avatarColor;

    @Enumerated(EnumType.STRING)
    @Column(name = "work_category", nullable = false)
    private WorkCategory workCategory;

    @Column(name = "job_roles", nullable = false, columnDefinition = "JSON")
    private String jobRoles;

    @Enumerated(EnumType.STRING)
    @Column(name = "partner_type", nullable = false)
    private PartnerType partnerType;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_project_type", nullable = false)
    private PreferredProjectType preferredProjectType;

    @Column(name = "work_available_hours", nullable = false, columnDefinition = "JSON")
    private String workAvailableHours;

    @Column(name = "communication_channels", nullable = false, columnDefinition = "JSON")
    private String communicationChannels;

    @Enumerated(EnumType.STRING)
    @Column(name = "dev_level", nullable = false)
    private DevLevel devLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "dev_experience", nullable = false)
    private DevExperience devExperience;

    @Enumerated(EnumType.STRING)
    @Column(name = "work_preference", nullable = false)
    private WorkPreference workPreference;

    @Column(nullable = false, length = 200)
    private String slogan;

    @Column(name = "salary_hour")
    private Integer salaryHour;

    @Column(name = "salary_month")
    private Integer salaryMonth;

    @Column(name = "github_url", length = 500)
    private String githubUrl;

    @Column(name = "blog_url", length = 500)
    private String blogUrl;

    @Column(name = "youtube_url", length = 500)
    private String youtubeUrl;

    @Column(name = "portfolio_file_url", length = 1000)
    private String portfolioFileUrl;

    @Column(name = "portfolio_file_tag", columnDefinition = "JSON")
    private String portfolioFileTag;

    @Column(name = "bio_file_url", length = 1000)
    private String bioFileUrl;

    @Column(name = "bio_file_tag", columnDefinition = "JSON")
    private String bioFileTag;

    @Column(name = "hashtags", columnDefinition = "JSON")
    private String hashtags;

    @Column(name = "short_bio", length = 200)
    private String shortBio;  // 한줄 파트너 자기소개 (200자 이내)

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Grade grade = Grade.SILVER;

    public enum WorkCategory {
        DEVELOP, PLANNING, DESIGN, DISTRIBUTION
    }

    public enum PartnerType {
        INDIVIDUAL, TEAM, SOLE_PROPRIETOR, CORPORATION
    }

    public enum PreferredProjectType {
        FREELANCE, CONTRACT_BASED
    }

    public enum DevLevel {
        JUNIOR, MIDDLE, SENIOR_5_7Y, SENIOR_7_10Y, LEAD
    }

    public enum DevExperience {
        UND_1Y, EXP_1_3Y, EXP_3_5Y, EXP_5_7Y, OVER_7Y
    }

    public enum WorkPreference {
        REMOTE, ONSITE, HYBRID
    }

    public enum Grade {
        SILVER, GOLD, PLATINUM, DIAMOND
    }
}
