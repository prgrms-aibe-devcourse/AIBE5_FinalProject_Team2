package com.DevBridge.devbridge.domain.partner.entity;

import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.project.entity.SkillMaster;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "PARTNER_SKILL",
       uniqueConstraints = {@UniqueConstraint(name = "uk_partner_skill", columnNames = {"partner_profile_id", "skill_id"})})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_profile_id", nullable = false)
    private PartnerProfile partnerProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id", nullable = false)
    private SkillMaster skill;
}
