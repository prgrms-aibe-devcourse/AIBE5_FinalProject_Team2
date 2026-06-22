package com.DevBridge.devbridge.domain.user.repository;

import com.DevBridge.devbridge.domain.user.entity.VisionBoard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VisionBoardRepository extends JpaRepository<VisionBoard, Long> {
    Optional<VisionBoard> findByUserId(Long userId);
}
