package com.DevBridge.devbridge.domain.partner.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.project.entity.Project;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 파트너 포트폴리오 항목.
 * - 한 사용자가 여러 항목 보유 (project 기반 또는 free-form).
 * - source_key 는 프론트에서 식별자로 쓰는 문자열 (예: "ongoing-1", "selected-2", "free-{ts}").
 *   (user_id, source_key) 가 UNIQUE.
 */
@Entity
@Table(
        name = "partner_portfolios",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_partner_portfolio_user_source",
                columnNames = {"user_id", "source_key"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class PartnerPortfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 프론트 식별자(예: "ongoing-1"). user_id 와 함께 UNIQUE. */
    @Column(name = "source_key", nullable = false, length = 100)
    private String sourceKey;

    /** 연결된 프로젝트 (선택). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_project_id")
    private Project sourceProject;

    @Column(length = 255)
    private String title;

    @Column(length = 100)
    private String period;

    @Column(length = 100)
    private String role;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Lob
    @Column(name = "work_content", columnDefinition = "LONGTEXT")
    private String workContent;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String vision;

    /** JSON 문자열: [{title, desc}] */
    @Lob
    @Column(name = "core_features", columnDefinition = "LONGTEXT")
    private String coreFeaturesJson;

    @Lob
    @Column(name = "technical_challenge", columnDefinition = "LONGTEXT")
    private String technicalChallenge;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String solution;

    /** JSON 문자열: ["React","Node.js",...] */
    @Lob
    @Column(name = "tech_tags", columnDefinition = "LONGTEXT")
    private String techTagsJson;

    @Column(name = "github_url", length = 500)
    private String githubUrl;

    @Column(name = "live_url", length = 500)
    private String liveUrl;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    /** JSON 문자열: 섹션 토글 객체 */
    @Lob
    @Column(name = "sections_json", columnDefinition = "LONGTEXT")
    private String sectionsJson;

    /** PortfolioAddTab 의 "포트폴리오에 추가" 토글 상태. */
    @Column(name = "is_added", nullable = false)
    @Builder.Default
    private Boolean isAdded = true;

    @Column(name = "is_public", nullable = false)
    @Builder.Default
    private Boolean isPublic = true;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
