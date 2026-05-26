package com.DevBridge.devbridge.domain.partner.repository;

import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.user.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PartnerProfileRepository extends JpaRepository<PartnerProfile, Long> {
    Optional<PartnerProfile> findByUser(User user);

    @Query("SELECT p FROM PartnerProfile p LEFT JOIN FETCH p.user")
    List<PartnerProfile> findAllWithUser();

    /** SQL-level pagination — Pageable 의 sort/limit/offset 으로 SELECT ... LIMIT N 발행. */
    @Query("SELECT p FROM PartnerProfile p LEFT JOIN FETCH p.user")
    List<PartnerProfile> findAllWithUserPaged(Pageable pageable);
}
