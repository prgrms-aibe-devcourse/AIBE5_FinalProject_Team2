package com.DevBridge.devbridge.domain.interest.repository;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.interest.entity.UserInterestProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserInterestProjectRepository extends JpaRepository<UserInterestProject, Long> {
    List<UserInterestProject> findByUser(User user);
    Optional<UserInterestProject> findByUserIdAndProjectId(Long userId, Long projectId);
    void deleteByUserIdAndProjectId(Long userId, Long projectId);
    boolean existsByUserIdAndProjectId(Long userId, Long projectId);

    /** ID만 필요한 경우: 전체 엔티티 대신 project PK만 조회. */
    @Query("SELECT uip.project.id FROM UserInterestProject uip WHERE uip.user.id = :userId")
    List<Long> findProjectIdsByUserId(@Param("userId") Long userId);
}

