package com.DevBridge.devbridge.domain.partner.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * 포트폴리오 단일 항목 요청/응답 공용 DTO.
 * 프론트(PortfolioDetailEditor) 의 defaultProject 구조와 매칭.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioItemRequest {
    /** 프론트 식별자 (예: "ongoing-1", "selected-2", "free-1700000000000"). */
    private String sourceKey;
    /** 연결된 프로젝트 id (선택). */
    private Long sourceProjectId;

    private String title;
    private String period;
    private String role;
    private String thumbnailUrl;
    private String workContent;
    private String vision;

    /** [{title, desc}] */
    private List<Map<String, Object>> coreFeatures;

    private String technicalChallenge;
    private String solution;

    /** ["React","Node.js",...] */
    private List<String> techTags;

    private String githubUrl;
    private String liveUrl;
    private String videoUrl;

    /** {basicInfo: true, workContent: true, ...} */
    private Map<String, Boolean> sections;

    private Boolean isAdded;
    private Boolean isPublic;
}
