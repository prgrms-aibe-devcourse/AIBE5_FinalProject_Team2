package com.DevBridge.devbridge.domain.partner.repository;

import com.DevBridge.devbridge.domain.partner.entity.PartnerSkill;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface PartnerSkillRepository extends JpaRepository<PartnerSkill, Long> {
    List<PartnerSkill> findByPartnerProfile(PartnerProfile partnerProfile);

    @Query("SELECT ps FROM PartnerSkill ps JOIN FETCH ps.skill WHERE ps.partnerProfile IN :profiles")
    List<PartnerSkill> findAllByPartnerProfiles(@Param("profiles") List<PartnerProfile> profiles);

    @Modifying
    @Transactional
    @Query("DELETE FROM PartnerSkill ps WHERE ps.partnerProfile = :profile")
    void deleteByPartnerProfile(@Param("profile") PartnerProfile profile);
}
