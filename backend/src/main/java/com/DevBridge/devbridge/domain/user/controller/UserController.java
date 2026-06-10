package com.DevBridge.devbridge.domain.user.controller;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 사용자 조회 엔드포인트.
 * id, username, userType, profileImageUrl만 노출 — email 등 개인정보 제외.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/search")
    public ResponseEntity<?> searchByUsername(@RequestParam String username) {
        return userRepository.findByUsername(username)
                .map(user -> ResponseEntity.ok(Map.of(
                        "id", user.getId(),
                        "username", user.getUsername(),
                        "userType", user.getUserType().name()
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-email")
    public ResponseEntity<?> findByEmail(@RequestParam String email) {
        return userRepository.findByEmail(email)
                .map(user -> ResponseEntity.ok(Map.of(
                        "id", user.getId(),
                        "username", user.getUsername(),
                        "userType", user.getUserType().name()
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> findById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(user -> {
                    java.util.Map<String, Object> body = new java.util.HashMap<>();
                    body.put("id", user.getId());
                    body.put("username", user.getUsername());
                    body.put("userType", user.getUserType() != null ? user.getUserType().name() : null);
                    body.put("profileImageUrl", user.getProfileImageUrl());
                    return ResponseEntity.ok(body);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/me/github-username")
    public ResponseEntity<?> getMyGithubUsername() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return ResponseEntity.status(401).build();
        return userRepository.findById(uid)
                .map(u -> ResponseEntity.ok(Map.of("githubUsername", u.getGithubUsername() == null ? "" : u.getGithubUsername())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/me/github-username")
    @Transactional
    public ResponseEntity<?> updateMyGithubUsername(@RequestBody Map<String, String> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return ResponseEntity.status(401).build();
        return userRepository.findById(uid)
                .map(u -> {
                    String username = body == null ? null : body.get("githubUsername");
                    if (username == null) username = "";
                    String trimmed = username.trim();
                    if (trimmed.length() > 100) trimmed = trimmed.substring(0, 100);
                    u.setGithubUsername(trimmed.isEmpty() ? null : trimmed);
                    u.setGithubConnectedAt(trimmed.isEmpty() ? null : java.time.LocalDateTime.now());
                    userRepository.save(u);
                    return ResponseEntity.ok(Map.of("githubUsername", trimmed));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
