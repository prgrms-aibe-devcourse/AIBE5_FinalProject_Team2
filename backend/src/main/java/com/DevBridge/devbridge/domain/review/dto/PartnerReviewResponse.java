package com.DevBridge.devbridge.domain.review.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PartnerReviewResponse {
    private Long id;
    private Long partnerProfileId;
    private Long reviewerUserId;
    private String reviewerUsername;
    private Long projectId;
    private Double rating;
    private String content;
    private LocalDateTime createdAt;
}
