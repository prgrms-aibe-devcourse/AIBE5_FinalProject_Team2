package com.DevBridge.devbridge.domain.review.repository;

import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.review.entity.PartnerReview;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PartnerReviewRepository extends JpaRepository<PartnerReview, Long> {

    List<PartnerReview> findByPartnerProfileOrderByCreatedAtDesc(PartnerProfile partnerProfile);

    Optional<PartnerReview> findByPartnerProfileAndReviewer(PartnerProfile partnerProfile, User reviewer);

    /** 특정 프로젝트에 대한 upsert 키: (파트너프로필, 리뷰어, 프로젝트) */
    Optional<PartnerReview> findByPartnerProfileAndReviewerAndProject(
            PartnerProfile partnerProfile, User reviewer, Project project);

    /** EvaluationService: 특정 프로젝트의 모든 파트너 리뷰 */
    List<PartnerReview> findByProject(Project project);

    /** EvaluationService: 특정 유저가 작성한 모든 파트너 리뷰 */
    List<PartnerReview> findByReviewer(User reviewer);

    /** [partnerProfileId, avgRating, count] 묶음을 한 번에 가져오기 위한 통계 쿼리. */
    @Query("SELECT r.partnerProfile.id AS profileId, AVG(r.rating) AS avg, COUNT(r) AS cnt " +
           "FROM PartnerReview r " +
           "WHERE r.partnerProfile IN :profiles " +
           "GROUP BY r.partnerProfile.id")
    List<Object[]> aggregateByPartnerProfiles(@Param("profiles") List<PartnerProfile> profiles);
}
