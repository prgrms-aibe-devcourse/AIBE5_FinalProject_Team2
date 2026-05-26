package com.DevBridge.devbridge.domain.interest.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.project.entity.Project;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 사용자가 프로젝트를 찜한 기록.
 * ERD v2: user_interest_projects
 */
@Entity
@Table(name = "USER_INTEREST_PROJECTS",
       uniqueConstraints = {@UniqueConstraint(name = "uk_uip", columnNames = {"user_id", "project_id"})})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class UserInterestProject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

