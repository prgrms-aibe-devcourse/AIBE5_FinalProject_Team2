package com.DevBridge.devbridge.domain.interest.repository;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.interest.entity.UserInterestPartner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserInterestPartnerRepository extends JpaRepository<UserInterestPartner, Long> {
    List<UserInterestPartner> findByUser(User user);
    Optional<UserInterestPartner> findByUserIdAndPartnerProfileId(Long userId, Long partnerProfileId);
    void deleteByUserIdAndPartnerProfileId(Long userId, Long partnerProfileId);
    boolean existsByUserIdAndPartnerProfileId(Long userId, Long partnerProfileId);

    /** ID만 필요한 경우: 전체 엔티티 대신 partnerProfile PK만 조회. */
    @Query("SELECT uip.partnerProfile.id FROM UserInterestPartner uip WHERE uip.user.id = :userId")
    List<Long> findPartnerProfileIdsByUserId(@Param("userId") Long userId);
}
