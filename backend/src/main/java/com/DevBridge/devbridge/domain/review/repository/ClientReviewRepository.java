package com.DevBridge.devbridge.domain.review.repository;

import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.review.entity.ClientReview;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientReviewRepository extends JpaRepository<ClientReview, Long> {

    List<ClientReview> findByClientProfile(ClientProfile clientProfile);

    /** 특정 프로젝트에 대한 upsert 키: (클라이언트프로필, 리뷰어, 프로젝트) */
    Optional<ClientReview> findByClientProfileAndReviewerAndProject(
            ClientProfile clientProfile, User reviewer, Project project);

    /** EvaluationService: 특정 프로젝트의 모든 클라이언트 리뷰 */
    List<ClientReview> findByProject(Project project);

    /** EvaluationService: 특정 유저가 작성한 모든 클라이언트 리뷰 */
    List<ClientReview> findByReviewer(User reviewer);

    @Query("SELECT cr FROM ClientReview cr WHERE cr.clientProfile IN :clientProfiles")
    List<ClientReview> findAllByClientProfiles(List<ClientProfile> clientProfiles);

    @Query("SELECT cr.clientProfile.id, AVG(cr.rating), COUNT(cr) " +
           "FROM ClientReview cr " +
           "WHERE cr.clientProfile IN :clientProfiles " +
           "GROUP BY cr.clientProfile.id")
    List<Object[]> aggregateByClientProfiles(List<ClientProfile> clientProfiles);
}
