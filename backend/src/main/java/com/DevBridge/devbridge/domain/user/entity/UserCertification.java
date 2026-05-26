package com.DevBridge.devbridge.domain.user.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "USER_CERTIFICATION")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserCertification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "cert_name", length = 200)
    private String certName;

    @Column(length = 200)
    private String issuer;

    @Column(name = "acquired_date", length = 20)
    private String acquiredDate;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
