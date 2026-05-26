package com.DevBridge.devbridge.domain.partner.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioItemResponse {
    private Long id;
    private String sourceKey;
    private Long sourceProjectId;

    private String title;
    private String period;
    private String role;
    private String thumbnailUrl;
    private String workContent;
    private String vision;

    private List<Map<String, Object>> coreFeatures;
    private String technicalChallenge;
    private String solution;
    private List<String> techTags;

    private String githubUrl;
    private String liveUrl;
    private String videoUrl;
    private Map<String, Boolean> sections;

    private Boolean isAdded;
    private Boolean isPublic;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
