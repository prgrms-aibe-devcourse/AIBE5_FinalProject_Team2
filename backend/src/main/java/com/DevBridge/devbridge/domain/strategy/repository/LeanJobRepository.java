package com.DevBridge.devbridge.domain.strategy.repository;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface LeanJobRepository extends JpaRepository<LeanJob, Long> {

    /** 큐(배정 대기) — 오래된 순. 스케줄러가 공정 배정에 사용. */
    List<LeanJob> findByStatusOrderByCreatedAtAsc(String status);

    /** 폴링 대상(DISPATCHED+RUNNING) — 오래된 순. */
    List<LeanJob> findByStatusInOrderByCreatedAtAsc(Collection<String> statuses);

    /** 한 테넌트의 잡 이력(최신순) + 상태 필터 옵션은 호출부에서. */
    List<LeanJob> findTop100ByUserIdOrderByCreatedAtDesc(Long userId);

    /** 전역 동시 실행 수(전역 캡 산정) — DISPATCHED+RUNNING. */
    long countByStatusIn(Collection<String> statuses);

    /** 유저별 동시 실행 수(등급 쿼터 산정) — DISPATCHED+RUNNING 을 user_id 로 그룹. */
    @Query("select j.userId as userId, count(j) as cnt from LeanJob j " +
           "where j.status in :statuses group by j.userId")
    List<UserRunningCount> countRunningByUser(@Param("statuses") Collection<String> statuses);

    /** 인터페이스 프로젝션(userId → 실행 중 개수). */
    interface UserRunningCount {
        Long getUserId();
        Long getCnt();
    }

    /** 한 테넌트의 잡 이력(최신순) — 사용자 화면용. */
    List<LeanJob> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** 최적화 그룹의 자식 잡들. */
    List<LeanJob> findByOptId(String optId);
}
