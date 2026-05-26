package com.DevBridge.devbridge.domain.interest.controller;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.interest.entity.*;
import com.DevBridge.devbridge.domain.partner.entity.*;
import com.DevBridge.devbridge.domain.client.entity.*;
import com.DevBridge.devbridge.domain.project.entity.*;
import com.DevBridge.devbridge.domain.chat.entity.*;
import com.DevBridge.devbridge.domain.review.entity.*;
import com.DevBridge.devbridge.domain.notification.entity.*;
import com.DevBridge.devbridge.domain.payment.entity.*;
import com.DevBridge.devbridge.domain.strategy.entity.*;
import com.DevBridge.devbridge.domain.ai.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.interest.repository.*;
import com.DevBridge.devbridge.domain.partner.repository.*;
import com.DevBridge.devbridge.domain.client.repository.*;
import com.DevBridge.devbridge.domain.project.repository.*;
import com.DevBridge.devbridge.domain.chat.repository.*;
import com.DevBridge.devbridge.domain.review.repository.*;
import com.DevBridge.devbridge.domain.notification.repository.*;
import com.DevBridge.devbridge.domain.payment.repository.*;
import com.DevBridge.devbridge.domain.strategy.repository.*;
import com.DevBridge.devbridge.domain.ai.repository.*;
import com.DevBridge.devbridge.global.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 찜하기 기능 (프로젝트/파트너).
 * - 모든 엔드포인트 JWT 필수.
 */
@RestController
@RequestMapping("/api/interests")
@RequiredArgsConstructor
public class InterestController {

    private final UserInterestProjectRepository projectInterestRepo;
    private final UserInterestPartnerRepository partnerInterestRepo;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final PartnerProfileRepository partnerProfileRepository;

    // ==================== 프로젝트 찜 ====================

    @GetMapping("/projects")
    public ResponseEntity<?> myProjects() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        if (userRepository.findById(userId).isEmpty()) return ResponseEntity.notFound().build();
        List<Long> ids = projectInterestRepo.findProjectIdsByUserId(userId);
        return ResponseEntity.ok(Map.of("projectIds", ids));
    }

    @PostMapping("/projects/{projectId}")
    @Transactional
    public ResponseEntity<?> addProject(@PathVariable Long projectId) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        if (projectInterestRepo.existsByUserIdAndProjectId(userId, projectId)) {
            return ResponseEntity.ok(Map.of("interested", true, "message", "이미 찜한 프로젝트"));
        }
        User u = userRepository.findById(userId).orElseThrow();
        Project p = projectRepository.findById(projectId).orElseThrow();
        projectInterestRepo.save(UserInterestProject.builder().user(u).project(p).build());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("interested", true));
    }

    @DeleteMapping("/projects/{projectId}")
    @Transactional
    public ResponseEntity<?> removeProject(@PathVariable Long projectId) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        projectInterestRepo.deleteByUserIdAndProjectId(userId, projectId);
        return ResponseEntity.ok(Map.of("interested", false));
    }

    // ==================== 파트너 찜 ====================

    @GetMapping("/partners")
    public ResponseEntity<?> myPartners() {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        if (userRepository.findById(userId).isEmpty()) return ResponseEntity.notFound().build();
        List<Long> ids = partnerInterestRepo.findPartnerProfileIdsByUserId(userId);
        return ResponseEntity.ok(Map.of("partnerIds", ids));
    }

    @PostMapping("/partners/{partnerId}")
    @Transactional
    public ResponseEntity<?> addPartner(@PathVariable Long partnerId) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        if (partnerInterestRepo.existsByUserIdAndPartnerProfileId(userId, partnerId)) {
            return ResponseEntity.ok(Map.of("interested", true, "message", "이미 찜한 파트너"));
        }
        User u = userRepository.findById(userId).orElseThrow();
        PartnerProfile pp = partnerProfileRepository.findById(partnerId).orElseThrow();
        partnerInterestRepo.save(UserInterestPartner.builder().user(u).partnerProfile(pp).build());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("interested", true));
    }

    @DeleteMapping("/partners/{partnerId}")
    @Transactional
    public ResponseEntity<?> removePartner(@PathVariable Long partnerId) {
        Long userId = AuthContext.currentUserId();
        if (userId == null) return unauthorized();
        partnerInterestRepo.deleteByUserIdAndPartnerProfileId(userId, partnerId);
        return ResponseEntity.ok(Map.of("interested", false));
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "로그인이 필요합니다."));
    }
}

