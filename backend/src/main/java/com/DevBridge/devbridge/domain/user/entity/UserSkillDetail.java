package com.DevBridge.devbridge.domain.user.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

/**
 * 사용자 스킬 상세 (proficiency/experience 포함).
 * - 기존 PARTNER_SKILL은 매칭/검색용 단순 매핑이라 유지하고,
 *   본 테이블은 프로필 표시용 풍부한 메타데이터 저장.
 */
@Entity
@Table(name = "USER_SKILL_DETAIL")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserSkillDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "tech_name", length = 100)
    private String techName;

    @Column(name = "custom_tech", length = 100)
    private String customTech;

    /** "초급" | "중급" | "고급" | "전문가" */
    @Column(length = 20)
    private String proficiency;

    /** "1년 미만" | "1~3년" | "3~5년" | "5년 이상" */
    @Column(length = 20)
    private String experience;

    /** UI 모드 (saved/editing 등) */
    @Column(length = 20)
    private String mode;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
