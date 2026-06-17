package com.DevBridge.devbridge.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "vision_board")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VisionBoard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** 아이템 배열 JSON 문자열 */
    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String items;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
