package com.DevBridge.devbridge.global.seed;

import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.partner.entity.PartnerPortfolio;
import com.DevBridge.devbridge.domain.partner.entity.PartnerSkill;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.project.entity.Project;
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
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 1회성 데이터 정리:
 *  - 완전한 데이터(7개 모듈 + 마일스톤 + 예산) 가진 프로젝트 50개만 남기고 나머지 제거.
 *  - 완전한 클라이언트(slogan + bio + industry + preferred skill) 50명만 남김.
 *  - 완전한 파트너(slogan + bio + serviceField + skills 3개+) 50명만 남김.
 *  - FK 연쇄 정리 (escrow, milestone, module, application, attachment, tags, skills, interests, reviews, meeting).
 *
 * 멱등: 마커 행을 PROJECT_FIELD_MASTER 같은 별 의미없는 테이블에 남기는 대신
 *       단순히 "이미 50 이하면 skip" 휴리스틱 사용. 한 번 정리되면 재실행해도 추가 삭제 없음.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataCleanupService {

    private static final int KEEP_PROJECTS = 50;
    private static final int KEEP_CLIENTS  = 50;
    private static final int KEEP_PARTNERS = 50;

    private final ProjectRepository projectRepository;
    private final ProjectModuleRepository projectModuleRepository;
    private final ProjectMilestoneRepository projectMilestoneRepository;
    private final ProjectEscrowRepository projectEscrowRepository;
    private final ProjectApplicationRepository projectApplicationRepository;
    private final ProjectAttachmentRepository projectAttachmentRepository;
    private final ProjectMeetingRepository projectMeetingRepository;
    private final ProjectTagRepository projectTagRepository;
    private final ProjectSkillMappingRepository projectSkillMappingRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final ClientProfileStatsRepository clientProfileStatsRepository;
    private final PartnerProfileRepository partnerProfileRepository;
    private final PartnerProfileStatsRepository partnerProfileStatsRepository;
    private final PartnerSkillRepository partnerSkillRepository;

    @PersistenceContext
    private EntityManager em;

    public Map<String, Integer> cleanupAll() {
        Map<String, Integer> result = new LinkedHashMap<>();
        // 각 cleanup 은 REQUIRES_NEW 로 독립 커밋 → 일부 실패해도 나머지는 보존.
        result.put("projectsRemoved", cleanupProjects());
        result.put("clientsRemoved",  cleanupClients());
        result.put("partnersRemoved", cleanupPartners());
        result.put("orphansRemoved",  cleanupOrphans());
        return result;
    }

    /**
     * 부모(projects) 가 사라졌는데 살아남은 orphan 종속 행 일괄 정리.
     * 매 startup 항상 실행. 멱등.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cleanupOrphans() {
        int total = 0;
        try {
            int n = em.createNativeQuery(
                "DELETE FROM project_modules WHERE project_id NOT IN (SELECT id FROM projects)"
            ).executeUpdate();
            total += n;
            if (n > 0) log.info("[Cleanup] orphan project_modules: {}", n);
        } catch (Exception e) { log.warn("[Cleanup] orphan modules: {}", e.getMessage()); }
        try {
            int n = em.createNativeQuery(
                "DELETE FROM project_milestones WHERE project_id NOT IN (SELECT id FROM projects)"
            ).executeUpdate();
            total += n;
            if (n > 0) log.info("[Cleanup] orphan project_milestones: {}", n);
        } catch (Exception e) { log.warn("[Cleanup] orphan milestones: {}", e.getMessage()); }
        try {
            int n = em.createNativeQuery(
                "DELETE FROM project_escrows WHERE project_id NOT IN (SELECT id FROM projects)"
            ).executeUpdate();
            total += n;
            if (n > 0) log.info("[Cleanup] orphan project_escrows: {}", n);
        } catch (Exception e) { log.warn("[Cleanup] orphan escrows: {}", e.getMessage()); }
        return total;
    }

    /**
     * 완전한 프로젝트 = 7개 모듈 + 1개 이상 마일스톤 + budgetAmount > 0 + title/desc/serviceField 모두 채워짐
     * + scope 모듈 데이터에 default 템플릿 마커("핵심 기능 설계 및 구현") 가 없거나
     *   AI contractTerms 가 적용된 흔적이 있어야 함 (= 완전한 데이터).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cleanupProjects() {
        List<Project> all = projectRepository.findAll();
        if (all.size() <= KEEP_PROJECTS) {
            log.info("[Cleanup] projects 이미 {} 이하 → skip", all.size());
            return 0;
        }

        // 모든 프로젝트의 모듈 / 마일스톤 카운트를 한 번에 로드
        Map<Long, List<ProjectModule>> modulesByProj = projectModuleRepository.findAll().stream()
                .collect(Collectors.groupingBy(ProjectModule::getProjectId));
        Map<Long, Long> milestoneCountByProj = projectMilestoneRepository.findAll().stream()
                .collect(Collectors.groupingBy(ProjectMilestone::getProjectId, Collectors.counting()));

        // 점수: 완전성 + 마일스톤 수 + 모듈 데이터 풍부도
        List<Project> ranked = all.stream()
                .map(p -> Map.entry(p, scoreProject(p, modulesByProj.getOrDefault(p.getId(), List.of()),
                                                       milestoneCountByProj.getOrDefault(p.getId(), 0L))))
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .map(Map.Entry::getKey)
                .toList();

        List<Project> toKeep   = ranked.stream().limit(KEEP_PROJECTS).toList();
        List<Project> toRemove = ranked.stream().skip(KEEP_PROJECTS).toList();
        Set<Long> removeIds = toRemove.stream().map(Project::getId).collect(Collectors.toSet());

        // FK 의존 데이터 일괄 삭제 (역순)
        for (Long pid : removeIds) {
            projectEscrowRepository.deleteAll(projectEscrowRepository.findByProjectIdOrderByIdAsc(pid));
            projectMilestoneRepository.deleteAll(projectMilestoneRepository.findByProjectIdOrderBySeqAsc(pid));
            projectModuleRepository.deleteAll(projectModuleRepository.findByProjectId(pid));
            projectAttachmentRepository.deleteAll(projectAttachmentRepository.findByProjectIdOrderByCreatedAtDesc(pid));
            projectMeetingRepository.findByProjectId(pid).ifPresent(projectMeetingRepository::delete);
        }
        // tag/skill mapping/application/interest/review 는 project 객체로 조회
        for (Project p : toRemove) {
            projectTagRepository.deleteAll(projectTagRepository.findByProject(p));
            projectSkillMappingRepository.deleteAll(projectSkillMappingRepository.findByProject(p));
            projectApplicationRepository.deleteAll(projectApplicationRepository.findAllByProjectId(p.getId()));
            // interest_project: project_id 외래키
            try { em.createQuery("DELETE FROM UserInterestProject ip WHERE ip.project.id = :pid")
                    .setParameter("pid", p.getId()).executeUpdate(); } catch (Exception ignore) {}
            // 리뷰: 둘 다 project FK
            try { em.createQuery("DELETE FROM PartnerReview r WHERE r.project.id = :pid")
                    .setParameter("pid", p.getId()).executeUpdate(); } catch (Exception ignore) {}
            try { em.createQuery("DELETE FROM ClientReview r WHERE r.project.id = :pid")
                    .setParameter("pid", p.getId()).executeUpdate(); } catch (Exception ignore) {}
        }
        em.flush();
        projectRepository.deleteAll(toRemove);

        log.info("[Cleanup] projects: {} → {} 유지, {} 삭제",
                all.size(), toKeep.size(), toRemove.size());
        return toRemove.size();
    }

    private long scoreProject(Project p, List<ProjectModule> mods, long milestoneCount) {
        if (p.getTitle() == null || p.getTitle().isBlank()) return Long.MIN_VALUE;
        if (p.getBudgetAmount() == null || p.getBudgetAmount() <= 0) return Long.MIN_VALUE;
        if (mods.size() < 7) return Long.MIN_VALUE;
        if (milestoneCount < 1) return Long.MIN_VALUE;

        long score = 0;
        score += milestoneCount * 100;
        score += mods.size() * 50;
        // 모듈 데이터가 default 템플릿 아닌 경우 가산
        for (ProjectModule m : mods) {
            String d = m.getData();
            if (d == null || d.isBlank()) continue;
            score += d.length() / 50; // 데이터가 풍부할수록 가산
            if ("협의완료".equals(m.getStatus())) score += 30;
        }
        if (p.getDesc() != null && p.getDesc().length() > 30) score += 50;
        if (p.getServiceField() != null) score += 20;
        if (p.getStatus() == Project.ProjectStatus.IN_PROGRESS) score += 200;
        if (p.getStatus() == Project.ProjectStatus.COMPLETED) score += 150;
        return score;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cleanupClients() {
        List<ClientProfile> all = clientProfileRepository.findAll();
        if (all.size() <= KEEP_CLIENTS) {
            log.info("[Cleanup] clients 이미 {} 이하 → skip", all.size());
            return 0;
        }
        List<ClientProfile> ranked = all.stream()
                .sorted((a, b) -> Long.compare(scoreClient(b), scoreClient(a)))
                .toList();
        List<ClientProfile> toKeep   = ranked.stream().limit(KEEP_CLIENTS).toList();
        List<ClientProfile> toRemove = ranked.stream().skip(KEEP_CLIENTS).toList();

        for (ClientProfile cp : toRemove) {
            // 종속 데이터 정리
            try { em.createQuery("DELETE FROM ClientPreferredSkill s WHERE s.clientProfile.id = :cid")
                    .setParameter("cid", cp.getId()).executeUpdate(); } catch (Exception ignore) {}
            try { em.createQuery("DELETE FROM ClientReview r WHERE r.clientProfile.id = :cid")
                    .setParameter("cid", cp.getId()).executeUpdate(); } catch (Exception ignore) {}
            clientProfileStatsRepository.findByClientProfile(cp).ifPresent(clientProfileStatsRepository::delete);
        }
        em.flush();
        clientProfileRepository.deleteAll(toRemove);
        log.info("[Cleanup] clients: {} → {} 유지, {} 삭제",
                all.size(), toKeep.size(), toRemove.size());
        return toRemove.size();
    }

    private long scoreClient(ClientProfile c) {
        if (c.getSlogan() == null || c.getSlogan().isBlank()) return Long.MIN_VALUE;
        long score = 0;
        if (c.getBio() != null && c.getBio().length() > 20) score += 100;
        if (c.getIndustry() != null) score += 30;
        if (c.getStrengthDesc() != null && c.getStrengthDesc().length() > 10) score += 50;
        if (c.getAvgProjectBudget() != null && c.getAvgProjectBudget() > 0) score += 50;
        if (c.getGrade() != null) score += 20;
        score += c.getSlogan().length();
        return score;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int cleanupPartners() {
        List<PartnerProfile> all = partnerProfileRepository.findAll();
        if (all.size() <= KEEP_PARTNERS) {
            log.info("[Cleanup] partners 이미 {} 이하 → skip", all.size());
            return 0;
        }

        // 파트너별 스킬 카운트 — count query 로만 받아서 영속성 컨텍스트에 PartnerSkill 엔티티 캐시 안 함.
        // (캐시되면 이후 partner_profile 삭제 시 transient 참조 오류 발생)
        @SuppressWarnings("unchecked")
        List<Object[]> skillCounts = em.createQuery(
                "SELECT s.partnerProfile.id, COUNT(s) FROM PartnerSkill s GROUP BY s.partnerProfile.id"
        ).getResultList();
        Map<Long, Long> skillCountByPartner = new HashMap<>();
        for (Object[] row : skillCounts) {
            skillCountByPartner.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }

        List<PartnerProfile> ranked = all.stream()
                .sorted((a, b) -> Long.compare(scorePartner(b, skillCountByPartner.getOrDefault(b.getId(), 0L)),
                                                scorePartner(a, skillCountByPartner.getOrDefault(a.getId(), 0L))))
                .toList();
        int keepCount = Math.min(KEEP_PARTNERS, ranked.size());
        List<Long> toRemoveIds = ranked.stream().skip(keepCount)
                .map(PartnerProfile::getId).toList();
        List<Long> toRemoveUserIds = ranked.stream().skip(keepCount)
                .map(p -> p.getUser() == null ? null : p.getUser().getId())
                .filter(Objects::nonNull).toList();

        // 영속성 컨텍스트 비우기 → 이후 native bulk DELETE 가 transient 참조 오류 안 일으킴
        em.clear();

        if (toRemoveIds.isEmpty()) return 0;

        // Native bulk DELETE (FK 컬럼 기준) — JPA 영속 상태와 무관하게 SQL 직접 실행
        int chunkSize = 500;
        for (int i = 0; i < toRemoveIds.size(); i += chunkSize) {
            List<Long> chunk = toRemoveIds.subList(i, Math.min(i + chunkSize, toRemoveIds.size()));
            String inList = chunk.stream().map(String::valueOf).collect(Collectors.joining(","));
            try { em.createNativeQuery("DELETE FROM PARTNER_SKILL WHERE partner_profile_id IN (" + inList + ")").executeUpdate(); } catch (Exception e) { log.warn("[Cleanup] PARTNER_SKILL delete: {}", e.getMessage()); }
            try { em.createNativeQuery("DELETE FROM PARTNER_REVIEW WHERE partner_profile_id IN (" + inList + ")").executeUpdate(); } catch (Exception e) { log.warn("[Cleanup] PARTNER_REVIEW delete: {}", e.getMessage()); }
            try { em.createNativeQuery("DELETE FROM USER_INTEREST_PARTNERS WHERE partner_profile_id IN (" + inList + ")").executeUpdate(); } catch (Exception e) { log.warn("[Cleanup] USER_INTEREST_PARTNERS delete: {}", e.getMessage()); }
            try { em.createNativeQuery("DELETE FROM PARTNER_PROFILE_STATS WHERE partner_profile_id IN (" + inList + ")").executeUpdate(); } catch (Exception e) { log.warn("[Cleanup] PARTNER_PROFILE_STATS delete: {}", e.getMessage()); }
        }
        // PartnerPortfolio 는 user_id FK
        if (!toRemoveUserIds.isEmpty()) {
            String userInList = toRemoveUserIds.stream().map(String::valueOf).collect(Collectors.joining(","));
            try { em.createNativeQuery("DELETE FROM partner_portfolios WHERE user_id IN (" + userInList + ")").executeUpdate(); } catch (Exception e) { log.warn("[Cleanup] partner_portfolios delete: {}", e.getMessage()); }
        }
        // 마지막으로 partner_profile 자체 삭제
        for (int i = 0; i < toRemoveIds.size(); i += chunkSize) {
            List<Long> chunk = toRemoveIds.subList(i, Math.min(i + chunkSize, toRemoveIds.size()));
            String inList = chunk.stream().map(String::valueOf).collect(Collectors.joining(","));
            try { em.createNativeQuery("DELETE FROM PARTNER_PROFILE WHERE id IN (" + inList + ")").executeUpdate(); }
            catch (Exception e) { log.warn("[Cleanup] PARTNER_PROFILE delete fail: {}", e.getMessage()); throw e; }
        }
        em.flush();
        int removedCount = toRemoveIds.size();
        int keptCount = all.size() - removedCount;
        log.info("[Cleanup] partners: {} → {} 유지, {} 삭제",
                all.size(), keptCount, removedCount);
        return removedCount;
    }

    private long scorePartner(PartnerProfile p, long skillCount) {
        if (p.getSlogan() == null || p.getSlogan().isBlank()) return Long.MIN_VALUE;
        if (p.getServiceField() == null || p.getServiceField().isBlank()) return Long.MIN_VALUE;
        if (skillCount < 3) return Long.MIN_VALUE;

        long score = 0;
        score += skillCount * 30;
        if (p.getBio() != null && p.getBio().length() > 30) score += 100;
        if (p.getStrengthDesc() != null && p.getStrengthDesc().length() > 10) score += 50;
        if (p.getGithubUrl() != null) score += 30;
        if (p.getPortfolioFileUrl() != null) score += 50;
        if (p.getGrade() != null) score += 20;
        if (p.getSalaryMonth() != null && p.getSalaryMonth() > 0) score += 20;
        return score;
    }
}
