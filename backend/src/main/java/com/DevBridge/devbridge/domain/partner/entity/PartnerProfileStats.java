package com.DevBridge.devbridge.domain.partner.entity;

import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import jakarta.persistence.*;
import lombok.*;

/**
 * 파트너 집계 통계 (캐시성).
 * ERD v2: partner_profile_stats
 */
@Entity
@Table(name = "PARTNER_PROFILE_STATS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerProfileStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_profile_id", nullable = false, unique = true)
    private PartnerProfile partnerProfile;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "completed_projects")
    private Integer completedProjects;

    private Double rating;

    @Column(name = "response_rate")
    private Integer responseRate;

    @Column(name = "repeat_rate")
    private Integer repeatRate;

    @Column(name = "availability_days")
    private Integer availabilityDays;
}

