package com.DevBridge.devbridge.domain.user.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "USER_AWARD")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "award_name", length = 200)
    private String awardName;

    @Column(length = 200)
    private String awarding;

    @Column(name = "award_date", length = 20)
    private String awardDate;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
