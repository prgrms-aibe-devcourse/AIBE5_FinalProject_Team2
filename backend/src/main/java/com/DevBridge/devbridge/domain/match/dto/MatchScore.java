package com.DevBridge.devbridge.domain.match.dto;

import lombok.*;

import java.util.List;

/**
 * AI 매칭 점수 결과 한 건.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchScore {
    private Long id;
    private Integer matchScore;     // 0~100
    private List<String> reasons;   // 매칭 이유 1~3개
}
