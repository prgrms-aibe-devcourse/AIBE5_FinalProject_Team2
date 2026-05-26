package com.DevBridge.devbridge.domain.partner.repository;

import com.DevBridge.devbridge.domain.partner.entity.PartnerPortfolio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PartnerPortfolioRepository extends JpaRepository<PartnerPortfolio, Long> {

    List<PartnerPortfolio> findByUserIdOrderByUpdatedAtDesc(Long userId);

    List<PartnerPortfolio> findByUserIdAndIsAddedTrueOrderByUpdatedAtDesc(Long userId);

    List<PartnerPortfolio> findByUserUsernameAndIsAddedTrueAndIsPublicTrueOrderByUpdatedAtDesc(String username);

    Optional<PartnerPortfolio> findByUserIdAndSourceKey(Long userId, String sourceKey);

    void deleteByUserIdAndSourceKey(Long userId, String sourceKey);
}
