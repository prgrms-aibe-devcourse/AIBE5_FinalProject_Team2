package com.DevBridge.devbridge.domain.review.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClientReviewCreateRequest {
    private Long   clientProfileId;
    private Long   projectId;
    private Double rating;
    private Double expertise;
    private Double schedule;
    private Double communication;
    private Double proactivity;
    private String content;
}
