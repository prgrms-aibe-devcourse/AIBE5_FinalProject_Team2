package com.DevBridge.devbridge.domain.user.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "USER_CAREER")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserCareer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "main_tech", length = 200)
    private String mainTech;

    @Column(name = "job_title", length = 200)
    private String jobTitle;

    @Column(name = "start_date", length = 20)
    private String startDate;

    @Column(name = "end_date", length = 20)
    private String endDate;

    @Column(name = "is_current")
    private Boolean isCurrent;

    @Column(name = "employment_type", length = 30)
    private String employmentType;

    @Column(length = 100)
    private String role;

    @Column(length = 30)
    private String level;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** 같은 회사 내 세부 프로젝트 리스트 JSON: [{name,startDate,endDate,description}] */
    @Column(columnDefinition = "JSON")
    private String projects;

    @Column(name = "verified_company")
    private Boolean verifiedCompany;

    @Column(name = "verified_email", length = 255)
    private String verifiedEmail;

    @Column(name = "sort_order")
    private Integer sortOrder;
}
