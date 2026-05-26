package com.DevBridge.devbridge.domain.match.service;

import com.DevBridge.devbridge.domain.ai.service.GeminiService;
import com.DevBridge.devbridge.domain.partner.service.PartnerService;
import com.DevBridge.devbridge.domain.client.service.ClientService;
import com.DevBridge.devbridge.domain.project.service.ProjectService;
import com.DevBridge.devbridge.domain.match.dto.MatchScore;
import com.DevBridge.devbridge.domain.partner.dto.PartnerSummaryResponse;
import com.DevBridge.devbridge.domain.client.dto.ClientSummaryResponse;
import com.DevBridge.devbridge.domain.project.dto.ProjectSummaryResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 사용자가 검색창에 입력한 자연어 질의를 기반으로
 * 1차 필터링된 후보들을 Gemini에 보내 0~100 점수 + 매칭 이유를 받는다.
 *
 * 알고리즘:
 *  1) Content-based filtering (프론트의 왼쪽 필터 + SQL)으로 후보 N개 추림
 *  2) 본 서비스가 후보를 한 줄 요약으로 압축 → Gemini 단일 호출
 *  3) [{ id, matchScore, reasons[] }] JSON 파싱
 *  4) 누락된 후보는 기본 점수(50)로 보강
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MatchService {

    private final PartnerService partnerService;
    private final ClientService clientService;
    private final ProjectService projectService;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int MAX_CANDIDATES = 50;

    /**
     * 파트너 매칭 점수 계산.
     */
    public List<MatchScore> scorePartners(String query, List<Long> candidateIds) {
        if (query == null || query.isBlank()) return List.of();

        // 1) 후보 로드 (전체 → id 필터)
        List<PartnerSummaryResponse> all = partnerService.findAll();
        Set<Long> idSet = (candidateIds == null || candidateIds.isEmpty())
                ? null
                : new HashSet<>(candidateIds);
        List<PartnerSummaryResponse> candidates = all.stream()
                .filter(p -> idSet == null || idSet.contains(p.getId()))
                .limit(MAX_CANDIDATES)
                .collect(Collectors.toList());

        if (candidates.isEmpty()) return List.of();

        // 2) Gemini 프롬프트 구성
        String userPrompt = buildPartnerPrompt(query, candidates);
        String systemPrompt = """
                너는 DevBridge 플랫폼의 매칭 추천 AI다.
                클라이언트의 요구사항과 후보 파트너들의 프로필을 비교하여 0~100 사이 정수 매칭 점수와
                매칭 이유 1~3개를 한국어로 산출한다.

                평가 기준:
                - 기술 스택 일치 (가중치 35%)
                - 도메인/서비스 분야 적합도 (25%)
                - 경력·등급·완료 프로젝트 수 (20%)
                - 예산·근무 형태 적합도 (10%)
                - 평점·응답률 등 신뢰도 (10%)

                반드시 아래 형식의 JSON 배열만 출력한다 (다른 텍스트 금지):
                [
                  { "id": 12, "matchScore": 92, "reasons": ["React 5년", "핀테크 PG 연동 경험"] },
                  ...
                ]
                """;

        String reply;
        try {
            reply = geminiService.oneShot(systemPrompt, userPrompt);
        } catch (Exception e) {
            log.warn("[MatchService] Gemini 호출 실패, 빈 결과 반환: {}", e.getMessage());
            return List.of();
        }

        // 3) JSON 파싱 (코드블록 제거 후)
        Map<Long, MatchScore> scored = parseScores(reply);

        // 4) 누락된 후보는 기본값 50점 처리
        List<MatchScore> result = new ArrayList<>();
        for (PartnerSummaryResponse p : candidates) {
            MatchScore s = scored.get(p.getId());
            if (s == null) {
                s = MatchScore.builder()
                        .id(p.getId())
                        .matchScore(50)
                        .reasons(List.of())
                        .build();
            }
            result.add(s);
        }
        return result;
    }

    private String buildPartnerPrompt(String query, List<PartnerSummaryResponse> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("사용자 요구사항: \"").append(query).append("\"\n\n");
        sb.append("후보 파트너 (id로 식별):\n");
        for (PartnerSummaryResponse p : candidates) {
            sb.append("- id=").append(p.getId())
              .append(" | 이름=").append(nullSafe(p.getUsername()))
              .append(" | 유형=").append(nullSafe(p.getPartnerType()))
              .append(" | 분야=").append(nullSafe(p.getServiceField()))
              .append(" | 등급=").append(nullSafe(p.getGrade()))
              .append(" | 레벨=").append(nullSafe(p.getLevel()))
              .append(" | 경력=").append(p.getExperience() != null ? p.getExperience() + "년" : "?")
              .append(" | 완료=").append(p.getCompletedProjects() != null ? p.getCompletedProjects() + "건" : "?")
              .append(" | 평점=").append(p.getRating() != null ? p.getRating() : "?")
              .append(" | 단가=").append(nullSafe(p.getPrice()))
              .append(" | 근무=").append(nullSafe(p.getWorkPref()))
              .append(" | 스킬=").append(p.getTags() != null ? String.join(",", p.getTags()) : "")
              .append(" | 소개=").append(truncate(p.getDesc(), 80))
              .append("\n");
        }
        sb.append("\n위 후보 각각에 대해 점수와 이유를 산출해 JSON 배열로만 출력하라.");
        return sb.toString();
    }

    private Map<Long, MatchScore> parseScores(String reply) {
        Map<Long, MatchScore> out = new HashMap<>();
        if (reply == null) return out;

        // 코드블록(```json ... ```) 제거
        String json = reply.trim();
        if (json.startsWith("```")) {
            int firstNewline = json.indexOf('\n');
            if (firstNewline > 0) json = json.substring(firstNewline + 1);
            int lastFence = json.lastIndexOf("```");
            if (lastFence > 0) json = json.substring(0, lastFence);
            json = json.trim();
        }

        try {
            JsonNode arr = objectMapper.readTree(json);
            if (!arr.isArray()) return out;
            for (JsonNode node : arr) {
                if (!node.has("id")) continue;
                Long id = node.get("id").asLong();
                int score = node.has("matchScore") ? node.get("matchScore").asInt(50) : 50;
                if (score < 0) score = 0;
                if (score > 100) score = 100;

                List<String> reasons = new ArrayList<>();
                if (node.has("reasons") && node.get("reasons").isArray()) {
                    node.get("reasons").forEach(r -> reasons.add(r.asText()));
                }
                out.put(id, MatchScore.builder()
                        .id(id).matchScore(score).reasons(reasons).build());
            }
        } catch (Exception e) {
            log.warn("[MatchService] JSON 파싱 실패: {} | reply head={}",
                    e.getMessage(), reply.substring(0, Math.min(200, reply.length())));
        }
        return out;
    }

    private String nullSafe(Object s) {
        return s == null ? "" : s.toString();
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "..." : s;
    }

    /* ──────────────── 클라이언트 매칭 ──────────────── */
    public List<MatchScore> scoreClients(String query, List<Long> candidateIds) {
        if (query == null || query.isBlank()) return List.of();
        List<ClientSummaryResponse> all = clientService.findAll();
        Set<Long> idSet = (candidateIds == null || candidateIds.isEmpty())
                ? null : new HashSet<>(candidateIds);
        List<ClientSummaryResponse> candidates = all.stream()
                .filter(c -> idSet == null || idSet.contains(c.getId()))
                .limit(MAX_CANDIDATES)
                .collect(Collectors.toList());
        if (candidates.isEmpty()) return List.of();

        String userPrompt = buildClientPrompt(query, candidates);
        String systemPrompt = """
                너는 DevBridge 플랫폼의 매칭 추천 AI다.
                파트너(개발자)가 어떤 클라이언트와 협업하고 싶은지 자연어로 입력했다.
                후보 클라이언트들의 프로필을 비교하여 0~100 사이 정수 매칭 점수와 이유 1~3개를 한국어로 산출하라.

                평가 기준:
                - 산업/도메인 일치 (30%)
                - 선호 기술 스택 일치 (25%)
                - 예산 적합도 (20%)
                - 등급/평점/재의뢰율 등 신뢰도 (15%)
                - 근무 형태/선호 레벨 적합도 (10%)

                반드시 아래 JSON 배열만 출력 (다른 텍스트 금지):
                [{ "id": 12, "matchScore": 88, "reasons": ["SaaS 도메인 일치", "예산 3000만원대 적합"] }, ...]
                """;

        String reply;
        try { reply = geminiService.oneShot(systemPrompt, userPrompt); }
        catch (Exception e) {
            log.warn("[MatchService] 클라이언트 매칭 Gemini 호출 실패: {}", e.getMessage());
            return List.of();
        }

        Map<Long, MatchScore> scored = parseScores(reply);
        List<MatchScore> result = new ArrayList<>();
        for (ClientSummaryResponse c : candidates) {
            MatchScore s = scored.get(c.getId());
            if (s == null) s = MatchScore.builder().id(c.getId()).matchScore(50).reasons(List.of()).build();
            result.add(s);
        }
        return result;
    }

    private String buildClientPrompt(String query, List<ClientSummaryResponse> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("파트너(개발자) 요구사항: \"").append(query).append("\"\n\n");
        sb.append("후보 클라이언트 (id로 식별):\n");
        for (ClientSummaryResponse c : candidates) {
            sb.append("- id=").append(c.getId())
              .append(" | 이름=").append(nullSafe(c.getName()))
              .append(" | 유형=").append(nullSafe(c.getClientType()))
              .append(" | 산업=").append(nullSafe(c.getIndustry()))
              .append(" | 등급=").append(nullSafe(c.getGrade()))
              .append(" | 예산=").append(c.getBudgetMin() != null ? c.getBudgetMin() + "~" + c.getBudgetMax() + "만원" : "?")
              .append(" | 평점=").append(c.getRating() != null ? c.getRating() : "?")
              .append(" | 완료=").append(c.getCompletedProjects() != null ? c.getCompletedProjects() + "건" : "?")
              .append(" | 재의뢰=").append(c.getRepeatRate() != null ? c.getRepeatRate() + "%" : "?")
              .append(" | 근무=").append(nullSafe(c.getWorkPrefLabel()))
              .append(" | 선호레벨=").append(c.getPreferredLevels() != null ? String.join(",", c.getPreferredLevels()) : "")
              .append(" | 선호스킬=").append(c.getPreferredSkills() != null ? String.join(",", c.getPreferredSkills()) : "")
              .append(" | 슬로건=").append(truncate(c.getSlogan(), 60))
              .append("\n");
        }
        sb.append("\n위 후보 각각에 대해 점수와 이유를 산출해 JSON 배열로만 출력하라.");
        return sb.toString();
    }

    /* ──────────────── 프로젝트 매칭 ──────────────── */
    public List<MatchScore> scoreProjects(String query, List<Long> candidateIds) {
        if (query == null || query.isBlank()) return List.of();
        List<ProjectSummaryResponse> all = projectService.findAll();
        Set<Long> idSet = (candidateIds == null || candidateIds.isEmpty())
                ? null : new HashSet<>(candidateIds);
        List<ProjectSummaryResponse> candidates = all.stream()
                .filter(p -> idSet == null || idSet.contains(p.getId()))
                .limit(MAX_CANDIDATES)
                .collect(Collectors.toList());
        if (candidates.isEmpty()) return List.of();

        String userPrompt = buildProjectPrompt(query, candidates);
        String systemPrompt = """
                너는 DevBridge 플랫폼의 매칭 추천 AI다.
                파트너(개발자)가 어떤 프로젝트를 찾고 있는지 자연어로 입력했다.
                후보 프로젝트들의 정보를 비교하여 0~100 사이 정수 매칭 점수와 이유 1~3개를 한국어로 산출하라.

                평가 기준:
                - 요구 기술 스택 일치 (35%)
                - 서비스 분야/도메인 적합도 (25%)
                - 예산·기간 적합도 (20%)
                - 근무 형태·레벨 적합도 (10%)
                - 클라이언트 등급/신뢰도 (10%)

                반드시 아래 JSON 배열만 출력 (다른 텍스트 금지):
                [{ "id": 12, "matchScore": 88, "reasons": ["React+Node 스택 일치", "예산 1000만원 적합"] }, ...]
                """;

        String reply;
        try { reply = geminiService.oneShot(systemPrompt, userPrompt); }
        catch (Exception e) {
            log.warn("[MatchService] 프로젝트 매칭 Gemini 호출 실패: {}", e.getMessage());
            return List.of();
        }

        Map<Long, MatchScore> scored = parseScores(reply);
        List<MatchScore> result = new ArrayList<>();
        for (ProjectSummaryResponse p : candidates) {
            MatchScore s = scored.get(p.getId());
            if (s == null) s = MatchScore.builder().id(p.getId()).matchScore(50).reasons(List.of()).build();
            result.add(s);
        }
        return result;
    }

    private String buildProjectPrompt(String query, List<ProjectSummaryResponse> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("파트너(개발자) 요구사항: \"").append(query).append("\"\n\n");
        sb.append("후보 프로젝트 (id로 식별):\n");
        for (ProjectSummaryResponse p : candidates) {
            sb.append("- id=").append(p.getId())
              .append(" | 제목=").append(nullSafe(p.getTitle()))
              .append(" | 분야=").append(nullSafe(p.getServiceField()))
              .append(" | 등급=").append(nullSafe(p.getGrade()))
              .append(" | 단가=").append(nullSafe(p.getPrice()))
              .append(" | 기간=").append(nullSafe(p.getPeriod()))
              .append(" | 근무=").append(nullSafe(p.getWorkPref()))
              .append(" | 유형=").append(nullSafe(p.getProjectType()))
              .append(" | 상태=").append(nullSafe(p.getStatus()))
              .append(" | 스킬=").append(p.getSkillSet() != null ? String.join(",", p.getSkillSet()) : "")
              .append(" | 슬로건=").append(truncate(p.getSlogan(), 60))
              .append(" | 설명=").append(truncate(p.getDesc(), 80))
              .append("\n");
        }
        sb.append("\n위 후보 각각에 대해 점수와 이유를 산출해 JSON 배열로만 출력하라.");
        return sb.toString();
    }
}
