package com.DevBridge.devbridge.domain.match.dto;

import lombok.*;

import java.util.List;

/**
 * AI 매칭 점수 요청.
 * - query: 사용자가 검색창에 입력한 자연어 한 문장
 * - candidateIds: 1차 필터링으로 남은 후보 id (최대 50개 권장)
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchRequest {
    private String query;
    private List<Long> candidateIds;
}
