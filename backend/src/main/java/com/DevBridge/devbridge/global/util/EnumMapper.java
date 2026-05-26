package com.DevBridge.devbridge.global.util;

import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.User;

/**
 * ERD v2 JSON의 소문자 enum 문자열을 백엔드 UPPERCASE enum으로 변환.
 * - 정합표: docs/ERD_v2_enum_alignment.md
 */
public final class EnumMapper {

    private EnumMapper() {}

    public static User.UserType userType(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "client" -> User.UserType.CLIENT;
            case "partner" -> User.UserType.PARTNER;
            default -> null;
        };
    }

    public static User.Gender gender(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "male" -> User.Gender.MALE;
            case "female" -> User.Gender.FEMALE;
            case "other" -> User.Gender.OTHER;
            default -> null;
        };
    }

    /**
     * ERD: personal/business/corporate → 백엔드 4단계.
     * personal → INDIVIDUAL (기본), business → SOLE_PROPRIETOR, corporate → CORPORATION.
     */
    public static ClientProfile.ClientType clientType(String s) {
        if (s == null) return ClientProfile.ClientType.INDIVIDUAL;
        return switch (s.toLowerCase()) {
            case "personal" -> ClientProfile.ClientType.INDIVIDUAL;
            case "business" -> ClientProfile.ClientType.SOLE_PROPRIETOR;
            case "corporate" -> ClientProfile.ClientType.CORPORATION;
            case "team" -> ClientProfile.ClientType.TEAM;
            default -> ClientProfile.ClientType.INDIVIDUAL;
        };
    }

    public static PartnerProfile.WorkCategory workCategory(String s) {
        if (s == null) return PartnerProfile.WorkCategory.DEVELOP;
        return switch (s.toLowerCase()) {
            case "dev", "develop" -> PartnerProfile.WorkCategory.DEVELOP;
            case "planning" -> PartnerProfile.WorkCategory.PLANNING;
            case "design" -> PartnerProfile.WorkCategory.DESIGN;
            case "publishing", "distribution" -> PartnerProfile.WorkCategory.DISTRIBUTION;
            default -> PartnerProfile.WorkCategory.DEVELOP;
        };
    }

    public static PartnerProfile.PartnerType partnerType(String s) {
        if (s == null) return PartnerProfile.PartnerType.INDIVIDUAL;
        return switch (s.toLowerCase()) {
            case "individual" -> PartnerProfile.PartnerType.INDIVIDUAL;
            case "team" -> PartnerProfile.PartnerType.TEAM;
            case "company", "corporate" -> PartnerProfile.PartnerType.CORPORATION;
            case "sole_proprietor", "sole" -> PartnerProfile.PartnerType.SOLE_PROPRIETOR;
            default -> PartnerProfile.PartnerType.INDIVIDUAL;
        };
    }

    public static PartnerProfile.PreferredProjectType preferredProjectType(String s) {
        if (s == null) return PartnerProfile.PreferredProjectType.FREELANCE;
        return switch (s.toLowerCase()) {
            case "outsource", "freelance" -> PartnerProfile.PreferredProjectType.FREELANCE;
            case "fulltime", "contract_based", "both" -> PartnerProfile.PreferredProjectType.CONTRACT_BASED;
            default -> PartnerProfile.PreferredProjectType.FREELANCE;
        };
    }

    public static PartnerProfile.DevLevel devLevel(String s) {
        if (s == null) return PartnerProfile.DevLevel.JUNIOR;
        return switch (s.toLowerCase()) {
            case "junior" -> PartnerProfile.DevLevel.JUNIOR;
            case "middle", "mid" -> PartnerProfile.DevLevel.MIDDLE;
            case "senior" -> PartnerProfile.DevLevel.SENIOR_5_7Y;
            case "lead" -> PartnerProfile.DevLevel.LEAD;
            default -> PartnerProfile.DevLevel.JUNIOR;
        };
    }

    public static PartnerProfile.DevExperience devExperience(String s) {
        if (s == null) return PartnerProfile.DevExperience.UND_1Y;
        return switch (s) {
            case "0-1" -> PartnerProfile.DevExperience.UND_1Y;
            case "1-3" -> PartnerProfile.DevExperience.EXP_1_3Y;
            case "3-5" -> PartnerProfile.DevExperience.EXP_3_5Y;
            case "5-10" -> PartnerProfile.DevExperience.EXP_5_7Y;
            case "10+" -> PartnerProfile.DevExperience.OVER_7Y;
            default -> PartnerProfile.DevExperience.UND_1Y;
        };
    }

    public static PartnerProfile.WorkPreference workPreference(String s) {
        if (s == null) return PartnerProfile.WorkPreference.REMOTE;
        return switch (s.toLowerCase()) {
            case "remote" -> PartnerProfile.WorkPreference.REMOTE;
            case "onsite" -> PartnerProfile.WorkPreference.ONSITE;
            case "hybrid", "any" -> PartnerProfile.WorkPreference.HYBRID;
            default -> PartnerProfile.WorkPreference.REMOTE;
        };
    }

    public static PartnerProfile.Grade grade(String s) {
        if (s == null) return PartnerProfile.Grade.SILVER;
        return switch (s.toLowerCase()) {
            case "bronze", "silver" -> PartnerProfile.Grade.SILVER;
            case "gold" -> PartnerProfile.Grade.GOLD;
            case "platinum" -> PartnerProfile.Grade.PLATINUM;
            case "diamond" -> PartnerProfile.Grade.DIAMOND;
            default -> PartnerProfile.Grade.SILVER;
        };
    }

    // ========== Project enums ==========

    public static Project.ProjectType projectType(String s) {
        if (s == null) return Project.ProjectType.OUTSOURCE;
        return switch (s.toLowerCase()) {
            case "outsource" -> Project.ProjectType.OUTSOURCE;
            case "fulltime" -> Project.ProjectType.FULLTIME;
            default -> Project.ProjectType.OUTSOURCE;
        };
    }

    public static Project.OutsourceProjectType outsourceProjectType(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "new" -> Project.OutsourceProjectType.NEW;
            case "maintenance" -> Project.OutsourceProjectType.MAINTENANCE;
            default -> null;
        };
    }

    public static Project.ReadyStatus readyStatus(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "idea" -> Project.ReadyStatus.IDEA;
            case "document" -> Project.ReadyStatus.DOCUMENT;
            case "design" -> Project.ReadyStatus.DESIGN;
            case "code" -> Project.ReadyStatus.CODE;
            default -> null;
        };
    }

    public static Project.Visibility visibility(String s) {
        if (s == null) return Project.Visibility.PUBLIC;
        return switch (s.toLowerCase()) {
            case "public" -> Project.Visibility.PUBLIC;
            case "applicants" -> Project.Visibility.APPLICANTS;
            case "private" -> Project.Visibility.PRIVATE;
            default -> Project.Visibility.PUBLIC;
        };
    }

    public static Project.WorkStyle workStyle(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "onsite" -> Project.WorkStyle.ONSITE;
            case "remote" -> Project.WorkStyle.REMOTE;
            case "hybrid" -> Project.WorkStyle.HYBRID;
            default -> null;
        };
    }

    public static Project.WorkDays workDays(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "3", "three", "three_days" -> Project.WorkDays.THREE_DAYS;
            case "4", "four", "four_days" -> Project.WorkDays.FOUR_DAYS;
            case "5", "five", "five_days" -> Project.WorkDays.FIVE_DAYS;
            case "flexible" -> Project.WorkDays.FLEXIBLE;
            default -> null;
        };
    }

    public static Project.WorkHours workHours(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "morning" -> Project.WorkHours.MORNING;
            case "afternoon" -> Project.WorkHours.AFTERNOON;
            case "flexible" -> Project.WorkHours.FLEXIBLE;
            case "fulltime" -> Project.WorkHours.FULLTIME;
            default -> null;
        };
    }

    public static Project.DevStage devStage(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "planning" -> Project.DevStage.PLANNING;
            case "development" -> Project.DevStage.DEVELOPMENT;
            case "beta" -> Project.DevStage.BETA;
            case "operating" -> Project.DevStage.OPERATING;
            case "maintenance" -> Project.DevStage.MAINTENANCE;
            default -> null;
        };
    }

    public static Project.TeamSize teamSize(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "1-5", "size_1_5" -> Project.TeamSize.SIZE_1_5;
            case "6-10", "size_6_10" -> Project.TeamSize.SIZE_6_10;
            case "11-30", "size_11_30" -> Project.TeamSize.SIZE_11_30;
            case "31-50", "size_31_50" -> Project.TeamSize.SIZE_31_50;
            case "50+", "size_50_plus" -> Project.TeamSize.SIZE_50_PLUS;
            default -> null;
        };
    }

    public static Project.MeetingType meetingType(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "online" -> Project.MeetingType.ONLINE;
            case "offline" -> Project.MeetingType.OFFLINE;
            case "hybrid" -> Project.MeetingType.HYBRID;
            default -> null;
        };
    }

    public static Project.MeetingFreq meetingFreq(String s) {
        if (s == null) return null;
        return switch (s.toLowerCase()) {
            case "daily" -> Project.MeetingFreq.DAILY;
            case "weekly" -> Project.MeetingFreq.WEEKLY;
            case "biweekly" -> Project.MeetingFreq.BIWEEKLY;
            case "monthly" -> Project.MeetingFreq.MONTHLY;
            default -> null;
        };
    }

    public static Project.ProjectStatus projectStatus(String s) {
        if (s == null) return Project.ProjectStatus.RECRUITING;
        return switch (s.toLowerCase()) {
            case "recruiting" -> Project.ProjectStatus.RECRUITING;
            case "in_progress" -> Project.ProjectStatus.IN_PROGRESS;
            case "completed" -> Project.ProjectStatus.COMPLETED;
            case "closed" -> Project.ProjectStatus.CLOSED;
            default -> Project.ProjectStatus.RECRUITING;
        };
    }
}

