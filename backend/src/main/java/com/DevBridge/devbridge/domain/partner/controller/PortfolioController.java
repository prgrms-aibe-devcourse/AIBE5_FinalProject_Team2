package com.DevBridge.devbridge.domain.partner.controller;

import com.DevBridge.devbridge.domain.partner.dto.PortfolioItemRequest;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.partner.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/portfolios")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;

    @GetMapping("/me")
    public ResponseEntity<?> myPortfolios() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauth();
        return ResponseEntity.ok(portfolioService.findMyItems(userId));
    }

    @GetMapping("/me/added")
    public ResponseEntity<?> myAddedPortfolios() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauth();
        return ResponseEntity.ok(portfolioService.findMyAddedItems(userId));
    }

    @GetMapping("/me/by-source/{sourceKey}")
    public ResponseEntity<?> myPortfolioBySource(@PathVariable String sourceKey) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauth();
        try {
            return ResponseEntity.ok(portfolioService.findMyItemBySource(userId, sourceKey));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{username}")
    public ResponseEntity<?> portfoliosByUsername(@PathVariable String username) {
        return ResponseEntity.ok(portfolioService.findPublicItemsByUsername(username));
    }

    @PutMapping("/by-source/{sourceKey}")
    public ResponseEntity<?> upsertBySource(@PathVariable String sourceKey, @RequestBody PortfolioItemRequest req) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauth();
        try {
            return ResponseEntity.ok(portfolioService.upsertMyItem(userId, sourceKey, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/by-source/{sourceKey}/added")
    public ResponseEntity<?> updateAdded(@PathVariable String sourceKey, @RequestBody Map<String, Boolean> body) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauth();
        try {
            return ResponseEntity.ok(portfolioService.updateAdded(userId, sourceKey, body.get("isAdded")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    private ResponseEntity<?> unauth() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "로그인이 필요합니다."));
    }
}