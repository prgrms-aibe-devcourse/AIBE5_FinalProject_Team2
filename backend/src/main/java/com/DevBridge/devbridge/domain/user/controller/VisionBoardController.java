package com.DevBridge.devbridge.domain.user.controller;

import com.DevBridge.devbridge.domain.user.entity.VisionBoard;
import com.DevBridge.devbridge.domain.user.repository.VisionBoardRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vision-board")
@RequiredArgsConstructor
public class VisionBoardController {

    private final VisionBoardRepository repo;
    private final ObjectMapper mapper;

    /** 현재 사용자의 비전 보드 아이템 목록 조회. */
    @GetMapping
    public ResponseEntity<?> get() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            String json = repo.findByUserId(userId)
                    .map(VisionBoard::getItems)
                    .orElse("[]");
            Object parsed = mapper.readValue(json, Object.class);
            return ResponseEntity.ok(Map.of("items", parsed));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("items", List.of()));
        }
    }

    /** 현재 사용자의 비전 보드 아이템 목록 저장 (upsert). */
    @PutMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Object items = body.getOrDefault("items", List.of());
            String json = mapper.writeValueAsString(items);

            VisionBoard board = repo.findByUserId(userId)
                    .orElseGet(() -> VisionBoard.builder().userId(userId).build());
            board.setItems(json);
            repo.save(board);

            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
