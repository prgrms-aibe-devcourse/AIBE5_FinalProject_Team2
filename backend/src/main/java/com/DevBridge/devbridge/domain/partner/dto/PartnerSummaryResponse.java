package com.DevBridge.devbridge.domain.partner.dto;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import lombok.*;

import java.util.List;

/**
 * 파트너 검색/목록 응답.
 * - PartnerSearch.jsx의 파트너 카드에 필요한 모든 필드 포함.
 * - 프론트의 mockPartners.json shape와 호환.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerSummaryResponse {
    private Long id;                  // partner_profile.id
    private String username;          // users.username (회원가입 시 입력한 로그인 핸들 - 표시용)
    private String name;
    private String title;
    private String avatarColor;
    private String heroKey;
    private String heroImg;           // hero 이미지 URL (PartnerProfile.heroKey 기반)
    private String profileImageUrl;   // User 테이블 profile_image_url
    private String slogan;
    private String sloganSub;
    private String shortBio;          // 한줄 파트너 자기소개 (150자 이내)
    private String desc;              // bio
    private List<String> tags;        // skill names (앞 4~5개)
    private String serviceField;
    private String partnerType;       // 한글 라벨 ("개인"/"팀"/"기업")
    private String workPref;          // 한글 라벨 ("재택 선호"/"상주 선호"/"하이브리드")
    private Boolean remote;
    private String level;             // 한글 라벨 ("주니어"/"미들"/"시니어"/"리드")
    private String grade;             // "silver"/"gold"/"platinum"/"diamond" (소문자)
    private Integer match;            // AI 매칭 점수 (서버에서 임의 계산 또는 기본값)
    private String price;             // "618만원/월"
    private String period;            // "4개월" (placeholder)
    private String email;             // users.contact_email
    private String phone;             // users.phone
    private Integer experience;       // partner_profile_stats.experience_years
    private Integer completedProjects;
    private Double rating;
    private Integer reviewCount;
    private List<String> skillSet;
    private List<String> skillCategories; // (placeholder: 비워둠)
    private Integer levelCode;        // 0=junior, 1=middle, 2=senior, 3=lead
    private Integer hourlyRate;
    private Integer monthlyRate;
    private Integer responseRate;
    private Integer repeatRate;
    private Integer availabilityDays;
    private Integer workPrefCode;     // 0=remote, 1=onsite, 2=hybrid
}

