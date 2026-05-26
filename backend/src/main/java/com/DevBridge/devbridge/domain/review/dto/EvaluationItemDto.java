package com.DevBridge.devbridge.domain.review.dto;

import com.DevBridge.devbridge.domain.project.entity.Project;
import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EvaluationItemDto {

    // Project info
    private Long         projectId;
    private String       projectTitle;
    private String       projectSlogan;
    private List<String> projectTags;
    private Boolean      isPartnerFree;
    private Integer      budgetMin;
    private Integer      budgetMax;
    private Integer      budgetAmount;
    private Integer      durationMonths;
    private String       avatarColor;
    private String       completedDate;   // formatted "yyyy.MM.dd"
    private Integer      deadlineDays;    // days until review deadline; negative = overdue

    // Counterparty info (the other person in the project)
    private Long   counterpartyUserId;
    private String counterpartyUsername;
    private String counterpartyAvatarColor;
    private Long   counterpartyProfileId;  // partnerProfileId or clientProfileId

    // Mutual disclosure state
    private boolean myReviewWritten;           // have I submitted a review?
    private boolean counterpartyReviewWritten; // has the other person submitted a review?

    // My review detail (always visible to me if I wrote it)
    private Double myRating;
    private Double myExpertise;
    private Double mySchedule;
    private Double myCommunication;
    private Double myProactivity;
    private String myContent;

    // Their review detail (ONLY populated if BOTH sides have written — mutual disclosure)
    private Double counterpartyRating;
    private String counterpartyContent;
    private String counterpartyReviewDate; // formatted "yyyy.MM.dd"
}
