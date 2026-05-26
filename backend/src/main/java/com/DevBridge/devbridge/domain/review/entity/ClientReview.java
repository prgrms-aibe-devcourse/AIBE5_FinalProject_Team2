package com.DevBridge.devbridge.domain.review.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.project.entity.Project;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 클라이언트에 대한 후기/별점.
 * - rating: 1.0 ~ 5.0 (소수점 1자리)
 * - 파트너가 자신이 매칭/계약했던 클라이언트에게 남기는 리뷰
 * - 한 사용자가 같은 클라이언트에게 여러 리뷰를 남길 수 있음 (프로젝트별 등)
 */
@Entity
@Table(name = "CLIENT_REVIEW")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClientReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_profile_id", nullable = false)
    private ClientProfile clientProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_user_id", nullable = false)
    private User reviewer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(nullable = false)
    private Double rating;

    private Double expertise;
    private Double schedule;
    private Double communication;
    private Double proactivity;

    @Column(columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
