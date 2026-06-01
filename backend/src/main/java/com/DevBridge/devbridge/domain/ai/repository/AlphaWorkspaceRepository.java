package com.DevBridge.devbridge.domain.ai.repository;

import com.DevBridge.devbridge.domain.ai.entity.AlphaWorkspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlphaWorkspaceRepository extends JpaRepository<AlphaWorkspace, Long> {
    List<AlphaWorkspace> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<AlphaWorkspace> findByIdAndUserId(Long id, Long userId);
    /** 데일리 잡: TESTED 또는 LIVE 상태인 워크스페이스만 재실행 대상 */
    List<AlphaWorkspace> findByStatusIn(List<String> statuses);
}
