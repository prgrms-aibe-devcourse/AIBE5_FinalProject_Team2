package com.DevBridge.devbridge.domain.review.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PartnerReviewCreateRequest {
    private Long   partnerProfileId;
    private Long   projectId; // optional
    private Double rating;
    private Double expertise;
    private Double schedule;
    private Double communication;
    private Double proactivity;
    private String content;
}
