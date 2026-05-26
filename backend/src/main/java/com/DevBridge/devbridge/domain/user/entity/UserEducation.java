package com.DevBridge.devbridge.domain.user.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "USER_EDUCATION")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserEducation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** "고등학교" | "대학교(2-3년)" | "대학교(4년)" | "대학원(석사)" | "대학원(박사)" */
    @Column(name = "school_type", length = 30)
    private String schoolType;

    @Column(name = "school_name", length = 200)
    private String schoolName;

    @Column(length = 100)
    private String track;

    @Column(length = 200)
    private String major;

    /** "학사" | "석사" | "박사" 등 */
    @Column(name = "degree_type", length = 30)
    private String degreeType;

    /** "재학" | "졸업" | "휴학" | "수료" 등 */
    @Column(length = 20)
    private String status;

    @Column(name = "admission_date", length = 20)
    private String admissionDate;

    @Column(name = "graduation_date", length = 20)
    private String graduationDate;

    @Column(length = 20)
    private String gpa;

    @Column(name = "gpa_scale", length = 10)
    private String gpaScale;

    @Column(name = "research_topic", length = 500)
    private String researchTopic;

    @Column(name = "verified_school")
    private Boolean verifiedSchool;

    @Column(name = "verified_email", length = 255)
    private String verifiedEmail;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
