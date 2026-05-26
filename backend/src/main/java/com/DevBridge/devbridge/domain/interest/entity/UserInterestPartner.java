package com.DevBridge.devbridge.domain.interest.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 사용자가 파트너를 찜한 기록.
 * ERD v2: user_interest_partners
 */
@Entity
@Table(name = "USER_INTEREST_PARTNERS",
       uniqueConstraints = {@UniqueConstraint(name = "uk_uipa", columnNames = {"user_id", "partner_profile_id"})})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class UserInterestPartner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_profile_id", nullable = false)
    private PartnerProfile partnerProfile;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

