package com.DevBridge.devbridge.domain.review.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.project.entity.Project;
import com.DevBridge.devbridge.domain.project.entity.ProjectApplication;
import com.DevBridge.devbridge.domain.review.dto.EvaluationItemDto;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.interest.entity.*;
import com.DevBridge.devbridge.domain.partner.entity.*;
import com.DevBridge.devbridge.domain.client.entity.*;
import com.DevBridge.devbridge.domain.project.entity.*;
import com.DevBridge.devbridge.domain.chat.entity.*;
import com.DevBridge.devbridge.domain.review.entity.*;
import com.DevBridge.devbridge.domain.notification.entity.*;
import com.DevBridge.devbridge.domain.payment.entity.*;
import com.DevBridge.devbridge.domain.strategy.entity.*;
import com.DevBridge.devbridge.domain.ai.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.interest.repository.*;
import com.DevBridge.devbridge.domain.partner.repository.*;
import com.DevBridge.devbridge.domain.client.repository.*;
import com.DevBridge.devbridge.domain.project.repository.*;
import com.DevBridge.devbridge.domain.chat.repository.*;
import com.DevBridge.devbridge.domain.review.repository.*;
import com.DevBridge.devbridge.domain.notification.repository.*;
import com.DevBridge.devbridge.domain.payment.repository.*;
import com.DevBridge.devbridge.domain.strategy.repository.*;
import com.DevBridge.devbridge.domain.ai.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final UserRepository               userRepository;
    private final ProjectRepository            projectRepository;
    private final ProjectApplicationRepository applicationRepository;
    private final PartnerProfileRepository     partnerProfileRepository;
    private final ClientProfileRepository      clientProfileRepository;
    private final PartnerReviewRepository      partnerReviewRepository;
    private final ClientReviewRepository       clientReviewRepository;

    private static final ObjectMapper          MAPPER   = new ObjectMapper();
    private static final DateTimeFormatter     DATE_FMT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    private List<String> parseTags(String reqTagsJson) {
        if (reqTagsJson == null || reqTagsJson.isBlank()) return Collections.emptyList();
        try {
            String s = reqTagsJson.trim();
            // MySQL JSON column stores array-in-a-string as a quoted JSON string — unwrap it
            if (s.startsWith("\"")) {
                s = MAPPER.readValue(s, String.class);
            }
            return MAPPER.readValue(s, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String completedDate(Project p) {
        if (p.getStartDate() == null || p.getDurationMonths() == null) return "";
        return p.getStartDate().plusMonths(p.getDurationMonths()).format(DATE_FMT);
    }

    private Integer deadlineDays(Project p) {
        if (p.getDeadline() == null) return null;
        return (int) ChronoUnit.DAYS.between(LocalDate.now(), p.getDeadline());
    }

    /**
     * For ClientDashboard: returns evaluation items for all COMPLETED projects
     * where the logged-in user is the project OWNER (client).
     *
     * "My review"    = PartnerReview written by ME (client) about the partner
     * "Their review" = ClientReview written by the PARTNER about ME
     */
    @Transactional(readOnly = true)
    public List<EvaluationItemDto> getClientEvaluation(Long clientUserId) {
        User clientUser = userRepository.findById(clientUserId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        ClientProfile myClientProfile = clientProfileRepository.findByUser(clientUser).orElse(null);

        List<Project> completedProjects = projectRepository
                .findByUserAndStatus(clientUser, Project.ProjectStatus.COMPLETED);

        List<EvaluationItemDto> result = new ArrayList<>();

        for (Project project : completedProjects) {
            // Find the matched partner via ProjectApplication
            List<ProjectApplication> apps = applicationRepository.findAllByProjectId(project.getId());
            ProjectApplication matchedApp = apps.stream()
                    .filter(a -> a.getStatus() == ProjectApplication.Status.COMPLETED
                              || a.getStatus() == ProjectApplication.Status.IN_PROGRESS
                              || a.getStatus() == ProjectApplication.Status.CONTRACTED)
                    .findFirst()
                    .orElse(apps.isEmpty() ? null : apps.get(0));

            if (matchedApp == null) continue;

            User partnerUser = matchedApp.getPartnerUser();
            PartnerProfile partnerProfile = partnerProfileRepository.findByUser(partnerUser).orElse(null);

            Optional<PartnerReview> myReview = (partnerProfile != null)
                    ? partnerReviewRepository.findByPartnerProfileAndReviewerAndProject(
                            partnerProfile, clientUser, project)
                    : Optional.empty();

            Optional<ClientReview> theirReview = (myClientProfile != null)
                    ? clientReviewRepository.findByClientProfileAndReviewerAndProject(
                            myClientProfile, partnerUser, project)
                    : Optional.empty();

            boolean myWritten    = myReview.isPresent();
            boolean theirWritten = theirReview.isPresent();
            boolean disclose     = myWritten && theirWritten;

            result.add(EvaluationItemDto.builder()
                    .projectId(project.getId())
                    .projectTitle(project.getTitle())
                    .projectSlogan(project.getSlogan())
                    .projectTags(parseTags(project.getReqTags()))
                    .isPartnerFree(project.getIsPartnerFree())
                    .budgetMin(project.getBudgetMin())
                    .budgetMax(project.getBudgetMax())
                    .budgetAmount(project.getBudgetAmount())
                    .durationMonths(project.getDurationMonths())
                    .avatarColor(project.getAvatarColor())
                    .completedDate(completedDate(project))
                    .deadlineDays(deadlineDays(project))
                    .counterpartyUserId(partnerUser.getId())
                    .counterpartyUsername(partnerUser.getUsername())
                    .counterpartyAvatarColor(partnerProfile != null ? partnerProfile.getAvatarColor() : null)
                    .counterpartyProfileId(partnerProfile != null ? partnerProfile.getId() : null)
                    .myReviewWritten(myWritten)
                    .counterpartyReviewWritten(theirWritten)
                    .myRating(myWritten ? myReview.get().getRating() : null)
                    .myExpertise(myWritten ? myReview.get().getExpertise() : null)
                    .mySchedule(myWritten ? myReview.get().getSchedule() : null)
                    .myCommunication(myWritten ? myReview.get().getCommunication() : null)
                    .myProactivity(myWritten ? myReview.get().getProactivity() : null)
                    .myContent(myWritten ? myReview.get().getContent() : null)
                    .counterpartyRating(disclose ? theirReview.get().getRating() : null)
                    .counterpartyContent(disclose ? theirReview.get().getContent() : null)
                    .counterpartyReviewDate(disclose && theirReview.get().getCreatedAt() != null
                            ? theirReview.get().getCreatedAt().format(DATE_FMT) : null)
                    .build());
        }

        return result;
    }

    /**
     * For PartnerDashboard: returns evaluation items for all COMPLETED projects
     * where the logged-in user is the matched PARTNER (applicant).
     *
     * "My review"    = ClientReview written by ME (partner) about the client
     * "Their review" = PartnerReview written by the CLIENT about ME
     */
    @Transactional(readOnly = true)
    public List<EvaluationItemDto> getPartnerEvaluation(Long partnerUserId) {
        User partnerUser = userRepository.findById(partnerUserId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        PartnerProfile myPartnerProfile = partnerProfileRepository.findByUser(partnerUser)
                .orElseThrow(() -> new RuntimeException("파트너 프로필이 없습니다."));

        List<ProjectApplication> completedApps = applicationRepository
                .findByPartnerUserAndProjectStatus(partnerUser, Project.ProjectStatus.COMPLETED);

        List<EvaluationItemDto> result = new ArrayList<>();

        for (ProjectApplication app : completedApps) {
            Project project    = app.getProject();
            User    clientUser = project.getUser();

            ClientProfile clientProfile = clientProfileRepository.findByUser(clientUser).orElse(null);

            Optional<ClientReview> myReview = (clientProfile != null)
                    ? clientReviewRepository.findByClientProfileAndReviewerAndProject(
                            clientProfile, partnerUser, project)
                    : Optional.empty();

            Optional<PartnerReview> theirReview =
                    partnerReviewRepository.findByPartnerProfileAndReviewerAndProject(
                            myPartnerProfile, clientUser, project);

            boolean myWritten    = myReview.isPresent();
            boolean theirWritten = theirReview.isPresent();
            boolean disclose     = myWritten && theirWritten;

            result.add(EvaluationItemDto.builder()
                    .projectId(project.getId())
                    .projectTitle(project.getTitle())
                    .projectSlogan(project.getSlogan())
                    .projectTags(parseTags(project.getReqTags()))
                    .isPartnerFree(project.getIsPartnerFree())
                    .budgetMin(project.getBudgetMin())
                    .budgetMax(project.getBudgetMax())
                    .budgetAmount(project.getBudgetAmount())
                    .durationMonths(project.getDurationMonths())
                    .avatarColor(project.getAvatarColor())
                    .completedDate(completedDate(project))
                    .deadlineDays(deadlineDays(project))
                    .counterpartyUserId(clientUser.getId())
                    .counterpartyUsername(clientUser.getUsername())
                    .counterpartyAvatarColor(clientProfile != null ? clientProfile.getAvatarColor() : null)
                    .counterpartyProfileId(clientProfile != null ? clientProfile.getId() : null)
                    .myReviewWritten(myWritten)
                    .counterpartyReviewWritten(theirWritten)
                    .myRating(myWritten ? myReview.get().getRating() : null)
                    .myExpertise(myWritten ? myReview.get().getExpertise() : null)
                    .mySchedule(myWritten ? myReview.get().getSchedule() : null)
                    .myCommunication(myWritten ? myReview.get().getCommunication() : null)
                    .myProactivity(myWritten ? myReview.get().getProactivity() : null)
                    .myContent(myWritten ? myReview.get().getContent() : null)
                    .counterpartyRating(disclose ? theirReview.get().getRating() : null)
                    .counterpartyContent(disclose ? theirReview.get().getContent() : null)
                    .counterpartyReviewDate(disclose && theirReview.get().getCreatedAt() != null
                            ? theirReview.get().getCreatedAt().format(DATE_FMT) : null)
                    .build());
        }

        return result;
    }
}
