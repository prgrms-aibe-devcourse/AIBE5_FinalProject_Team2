package com.DevBridge.devbridge.domain.review.controller;

import com.DevBridge.devbridge.domain.review.dto.PartnerReviewCreateRequest;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.review.service.PartnerReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class PartnerReviewController {

    private final PartnerReviewService service;

    /** 특정 파트너 프로필의 리뷰 목록 (공개). */
    @GetMapping("/partner/{partnerProfileId}")
    public ResponseEntity<?> listByPartner(@PathVariable Long partnerProfileId) {
        try {
            return ResponseEntity.ok(service.findByPartnerProfile(partnerProfileId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** 리뷰 작성/수정 (JWT 필수). */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody PartnerReviewCreateRequest req) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "로그인이 필요합니다."));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
