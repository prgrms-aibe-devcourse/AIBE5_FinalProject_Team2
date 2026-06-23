package com.DevBridge.devbridge.domain.ai.repository;

import com.DevBridge.devbridge.domain.ai.entity.AlphaWorkspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface AlphaWorkspaceRepository extends JpaRepository<AlphaWorkspace, Long> {
    List<AlphaWorkspace> findByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<AlphaWorkspace> findByIdAndUserId(Long id, Long userId);
    /** 데일리 잡: TESTED 또는 LIVE 상태인 워크스페이스만 재실행 대상 */
    List<AlphaWorkspace> findByStatusIn(List<String> statuses);

    /**
     * 상태 IN + user 즉시 fetch. BriefingScheduler 가 LIVE 워크스페이스마다 ws.getUser() 를
     * N번 LAZY 로드하던 N+1 제거(DDIA 효율). user.userType 까지 한 쿼리로 확보.
     */
    @Query("select w from AlphaWorkspace w join fetch w.user where w.status in :statuses")
    List<AlphaWorkspace> findByStatusInFetchUser(@Param("statuses") List<String> statuses);

    /** 워크스페이스 이름 중복 방지 (유저 범위 · 대소문자 무시) */
    boolean existsByUserIdAndNameIgnoreCase(Long userId, String name);
    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(Long userId, String name, Long id);

    /** Claude 멀티세션 ID 만 단건 갱신(다른 컬럼 보존). 영속화로 재시작에도 대화 맥락 유지. */
    @Modifying
    @Transactional
    @Query("UPDATE AlphaWorkspace w SET w.claudeSessionId = :sid WHERE w.id = :id")
    int updateClaudeSessionId(@Param("id") Long id, @Param("sid") String sid);
}
