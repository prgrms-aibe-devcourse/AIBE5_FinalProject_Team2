package com.DevBridge.devbridge.domain.partner.service;

import com.DevBridge.devbridge.domain.partner.dto.PortfolioItemRequest;
import com.DevBridge.devbridge.domain.partner.dto.PortfolioItemResponse;
import com.DevBridge.devbridge.domain.partner.entity.PartnerPortfolio;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.repository.PartnerPortfolioRepository;
import com.DevBridge.devbridge.domain.project.repository.ProjectRepository;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PartnerPortfolioRepository partnerPortfolioRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    private static final ObjectMapper OM = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<PortfolioItemResponse> findMyItems(Long userId) {
        return partnerPortfolioRepository.findByUserIdOrderByUpdatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PortfolioItemResponse> findMyAddedItems(Long userId) {
        return partnerPortfolioRepository.findByUserIdAndIsAddedTrueOrderByUpdatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PortfolioItemResponse findMyItemBySource(Long userId, String sourceKey) {
        String resolvedSourceKey = normalizeSourceKey(sourceKey);
        PartnerPortfolio item = partnerPortfolioRepository.findByUserIdAndSourceKey(userId, resolvedSourceKey)
                .orElseThrow(() -> new RuntimeException("포트폴리오 항목을 찾을 수 없습니다. sourceKey=" + resolvedSourceKey));
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public List<PortfolioItemResponse> findPublicItemsByUsername(String username) {
        return partnerPortfolioRepository.findByUserUsernameAndIsAddedTrueAndIsPublicTrueOrderByUpdatedAtDesc(username)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PortfolioItemResponse upsertMyItem(Long userId, String sourceKey, PortfolioItemRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        String resolvedSourceKey = normalizeSourceKey(sourceKey != null ? sourceKey : req.getSourceKey());
        PartnerPortfolio item = partnerPortfolioRepository.findByUserIdAndSourceKey(userId, resolvedSourceKey)
                .orElseGet(() -> PartnerPortfolio.builder()
                        .user(user)
                        .sourceKey(resolvedSourceKey)
                        .isAdded(Boolean.TRUE)
                        .isPublic(Boolean.TRUE)
                        .build());

        item.setSourceKey(resolvedSourceKey);
        item.setSourceProject(resolveProject(req.getSourceProjectId()));
        item.setTitle(req.getTitle());
        item.setPeriod(req.getPeriod());
        item.setRole(req.getRole());
        item.setThumbnailUrl(req.getThumbnailUrl());
        item.setWorkContent(req.getWorkContent());
        item.setVision(req.getVision());
        item.setCoreFeaturesJson(writeJson(req.getCoreFeatures()));
        item.setTechnicalChallenge(req.getTechnicalChallenge());
        item.setSolution(req.getSolution());
        item.setTechTagsJson(writeJson(req.getTechTags()));
        item.setGithubUrl(req.getGithubUrl());
        item.setLiveUrl(req.getLiveUrl());
        item.setVideoUrl(req.getVideoUrl());
        item.setSectionsJson(writeJson(req.getSections()));
        item.setIsAdded(req.getIsAdded() != null ? req.getIsAdded() : Boolean.TRUE);
        item.setIsPublic(req.getIsPublic() != null ? req.getIsPublic() : Boolean.TRUE);

        return toResponse(partnerPortfolioRepository.save(item));
    }

    @Transactional
    public PortfolioItemResponse updateAdded(Long userId, String sourceKey, Boolean isAdded) {
        String resolvedSourceKey = normalizeSourceKey(sourceKey);
        PartnerPortfolio item = partnerPortfolioRepository.findByUserIdAndSourceKey(userId, resolvedSourceKey)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));
                    return PartnerPortfolio.builder()
                            .user(user)
                            .sourceKey(resolvedSourceKey)
                            .isAdded(Boolean.TRUE)
                            .isPublic(Boolean.TRUE)
                            .build();
                });
        item.setIsAdded(Boolean.TRUE.equals(isAdded));
        return toResponse(partnerPortfolioRepository.save(item));
    }

    private Project resolveProject(Long sourceProjectId) {
        if (sourceProjectId == null) return null;
        // 프로젝트가 삭제됐거나 존재하지 않는 경우에도 portfolio 저장은 계속 진행.
        // (GitHub 등 외부 출처 portfolio 가 stale sourceProjectId 를 가질 수 있어
        //  포트폴리오 자체 저장이 막히는 회귀 방지)
        return projectRepository.findById(sourceProjectId).orElse(null);
    }

    private String normalizeSourceKey(String sourceKey) {
        if (sourceKey == null || sourceKey.isBlank()) {
            throw new RuntimeException("sourceKey 는 필수입니다.");
        }
        return sourceKey.trim();
    }

    private PortfolioItemResponse toResponse(PartnerPortfolio item) {
        return PortfolioItemResponse.builder()
                .id(item.getId())
                .sourceKey(item.getSourceKey())
                .sourceProjectId(item.getSourceProject() != null ? item.getSourceProject().getId() : null)
                .title(item.getTitle())
                .period(item.getPeriod())
                .role(item.getRole())
                .thumbnailUrl(item.getThumbnailUrl())
                .workContent(item.getWorkContent())
                .vision(item.getVision())
                .coreFeatures(readListOfMap(item.getCoreFeaturesJson()))
                .technicalChallenge(item.getTechnicalChallenge())
                .solution(item.getSolution())
                .techTags(readStringList(item.getTechTagsJson()))
                .githubUrl(item.getGithubUrl())
                .liveUrl(item.getLiveUrl())
                .videoUrl(item.getVideoUrl())
                .sections(readBooleanMap(item.getSectionsJson()))
                .isAdded(Boolean.TRUE.equals(item.getIsAdded()))
                .isPublic(Boolean.TRUE.equals(item.getIsPublic()))
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            throw new RuntimeException("JSON 직렬화 실패", e);
        }
    }

    private List<Map<String, Object>> readListOfMap(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return OM.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return OM.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private Map<String, Boolean> readBooleanMap(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            return OM.readValue(json, new TypeReference<LinkedHashMap<String, Boolean>>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }
}