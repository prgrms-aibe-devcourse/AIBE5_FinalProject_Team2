package com.DevBridge.devbridge.domain.review.service;

import com.DevBridge.devbridge.domain.review.dto.PartnerReviewCreateRequest;
import com.DevBridge.devbridge.domain.review.dto.PartnerReviewResponse;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.review.entity.PartnerReview;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.repository.PartnerProfileRepository;
import com.DevBridge.devbridge.domain.review.repository.PartnerReviewRepository;
import com.DevBridge.devbridge.domain.project.repository.ProjectRepository;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PartnerReviewService {

    private final PartnerReviewRepository reviewRepository;
    private final PartnerProfileRepository partnerProfileRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public List<PartnerReviewResponse> findByPartnerProfile(Long partnerProfileId) {
        PartnerProfile pp = partnerProfileRepository.findById(partnerProfileId)
                .orElseThrow(() -> new RuntimeException("파트너 프로필을 찾을 수 없습니다."));
        return reviewRepository.findByPartnerProfileOrderByCreatedAtDesc(pp).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PartnerReviewResponse create(Long reviewerUserId, PartnerReviewCreateRequest req) {
        if (req.getRating() == null || req.getRating() < 0.5 || req.getRating() > 5.0) {
            throw new RuntimeException("rating 은 0.5 ~ 5.0 사이여야 합니다.");
        }
        User reviewer = userRepository.findById(reviewerUserId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        PartnerProfile pp = partnerProfileRepository.findById(req.getPartnerProfileId())
                .orElseThrow(() -> new RuntimeException("파트너 프로필을 찾을 수 없습니다."));
        if (pp.getUser() != null && pp.getUser().getId().equals(reviewerUserId)) {
            throw new RuntimeException("본인 프로필에는 후기를 남길 수 없습니다.");
        }
        Project project = req.getProjectId() != null
                ? projectRepository.findById(req.getProjectId()).orElse(null)
                : null;

        PartnerReview existing = (project != null)
                ? reviewRepository.findByPartnerProfileAndReviewerAndProject(pp, reviewer, project).orElse(null)
                : null;
        PartnerReview entity = existing != null ? existing : PartnerReview.builder()
                .partnerProfile(pp)
                .reviewer(reviewer)
                .build();
        entity.setRating(req.getRating());
        entity.setExpertise(req.getExpertise());
        entity.setSchedule(req.getSchedule());
        entity.setCommunication(req.getCommunication());
        entity.setProactivity(req.getProactivity());
        entity.setContent(req.getContent());
        entity.setProject(project);
        return toResponse(reviewRepository.save(entity));
    }

    private PartnerReviewResponse toResponse(PartnerReview r) {
        return PartnerReviewResponse.builder()
                .id(r.getId())
                .partnerProfileId(r.getPartnerProfile().getId())
                .reviewerUserId(r.getReviewer() != null ? r.getReviewer().getId() : null)
                .reviewerUsername(r.getReviewer() != null ? r.getReviewer().getUsername() : null)
                .projectId(r.getProject() != null ? r.getProject().getId() : null)
                .rating(r.getRating())
                .content(r.getContent())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
