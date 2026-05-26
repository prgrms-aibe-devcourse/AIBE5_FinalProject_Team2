package com.DevBridge.devbridge.domain.user.repository;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.entity.UserCareer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserCareerRepository extends JpaRepository<UserCareer, Long> {
    List<UserCareer> findByUserOrderBySortOrderAscIdAsc(User user);
    void deleteByUser(User user);
}
