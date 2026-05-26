package com.DevBridge.devbridge.domain.review.controller;

import com.DevBridge.devbridge.domain.review.dto.EvaluationItemDto;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.review.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/evaluation")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationService service;

    /** Client dashboard — completed projects I own, with review state. */
    @GetMapping("/client")
    public ResponseEntity<?> clientEvaluation() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return ResponseEntity.status(401)
                .body(Map.of("message", "로그인이 필요합니다."));
        try {
            List<EvaluationItemDto> data = service.getClientEvaluation(userId);
            return ResponseEntity.ok(data);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** Partner dashboard — completed projects I was matched to, with review state. */
    @GetMapping("/partner")
    public ResponseEntity<?> partnerEvaluation() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return ResponseEntity.status(401)
                .body(Map.of("message", "로그인이 필요합니다."));
        try {
            List<EvaluationItemDto> data = service.getPartnerEvaluation(userId);
            return ResponseEntity.ok(data);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
