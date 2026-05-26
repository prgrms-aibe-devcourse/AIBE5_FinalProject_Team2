package com.DevBridge.devbridge.domain.user.service;

import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.entity.UserProfileDetail;
import com.DevBridge.devbridge.domain.partner.entity.PartnerProfile;
import com.DevBridge.devbridge.domain.partner.entity.PartnerSkill;
import com.DevBridge.devbridge.domain.client.entity.ClientProfile;
import com.DevBridge.devbridge.domain.project.entity.SkillMaster;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailRequest;
import com.DevBridge.devbridge.domain.user.dto.UserProfileDetailResponse;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 사용자 프로필 세부 정보 (UserProfileDetail + Skills/Careers/Educations/Awards/Certifications) 일괄 처리.
 * - PartnerProfile.jsx, Client_Profile.jsx 의 "전체 설정 저장하기" 버튼에서 호출.
 * - AIchatProfile 결과 자동 저장에도 사용 가능.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final UserProfileDetailRepository userProfileDetailRepository;
    private final UserSkillDetailRepository userSkillDetailRepository;
    private final UserCareerRepository userCareerRepository;
    private final UserEducationRepository userEducationRepository;
    private final UserAwardRepository userAwardRepository;
    private final UserCertificationRepository userCertificationRepository;
    // ── PARTNER/CLIENT 검색용 레거시 테이블 동기화를 위한 추가 의존성 ──
    private final PartnerProfileRepository partnerProfileRepository;
    private final ClientProfileRepository clientProfileRepository;
    private final PartnerSkillRepository partnerSkillRepository;
    private final SkillMasterRepository skillMasterRepository;
    private final PartnerProfileStatsRepository partnerProfileStatsRepository;
    private final ClientProfileStatsRepository clientProfileStatsRepository;

    private static final ObjectMapper OM = new ObjectMapper();

    /** username 으로 다른 사용자의 프로필 상세를 조회 (다른 사람 PartnerProfileView/ClientProfileView 용 public 조회). */
    @Transactional(readOnly = true)
    public UserProfileDetailResponse getDetailByUsername(String username) {
        User u = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + username));
        return getDetail(u.getId());
    }

    @Transactional(readOnly = true)
    public UserProfileDetailResponse getDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        UserProfileDetail detail = userProfileDetailRepository.findByUser(user).orElse(null);

        Map<String, Boolean> toggles = parseToggles(detail != null ? detail.getProfileMenuToggles() : null);
        UserProfileDetailRequest.VerifiedEmail verified = null;
        if (detail != null && (detail.getVerifiedEmail() != null || detail.getVerifiedEmailType() != null)) {
            verified = UserProfileDetailRequest.VerifiedEmail.builder()
                    .type(detail.getVerifiedEmailType())
                    .email(detail.getVerifiedEmail())
                    .build();
        }

        List<UserProfileDetailRequest.SkillItem> skills = userSkillDetailRepository
                .findByUserOrderBySortOrderAscIdAsc(user).stream()
                .map(s -> UserProfileDetailRequest.SkillItem.builder()
                        .techName(s.getTechName())
                        .customTech(s.getCustomTech())
                        .proficiency(s.getProficiency())
                        .experience(s.getExperience())
                        .mode(s.getMode())
                        .build())
                .collect(Collectors.toList());

        List<UserProfileDetailRequest.CareerItem> careers = userCareerRepository
                .findByUserOrderBySortOrderAscIdAsc(user).stream()
                .map(c -> UserProfileDetailRequest.CareerItem.builder()
                        .companyName(c.getCompanyName())
                        .mainTech(c.getMainTech())
                        .jobTitle(c.getJobTitle())
                        .startDate(c.getStartDate())
                        .endDate(c.getEndDate())
                        .isCurrent(c.getIsCurrent())
                        .employmentType(c.getEmploymentType())
                        .role(c.getRole())
                        .level(c.getLevel())
                        .description(c.getDescription())
                        .projects(parseProjects(c.getProjects()))
                        .verifiedCompany(c.getVerifiedCompany())
                        .verifiedEmail(c.getVerifiedEmail())
                        .build())
                .collect(Collectors.toList());

        List<UserProfileDetailRequest.EducationItem> educations = userEducationRepository
                .findByUserOrderBySortOrderAscIdAsc(user).stream()
                .map(e -> UserProfileDetailRequest.EducationItem.builder()
                        .schoolType(e.getSchoolType())
                        .schoolName(e.getSchoolName())
                        .track(e.getTrack())
                        .major(e.getMajor())
                        .degreeType(e.getDegreeType())
                        .status(e.getStatus())
                        .admissionDate(e.getAdmissionDate())
                        .graduationDate(e.getGraduationDate())
                        .gpa(e.getGpa())
                        .gpaScale(e.getGpaScale())
                        .researchTopic(e.getResearchTopic())
                        .verifiedSchool(e.getVerifiedSchool())
                        .verifiedEmail(e.getVerifiedEmail())
                        .build())
                .collect(Collectors.toList());

        List<UserProfileDetailRequest.AwardItem> awards = userAwardRepository
                .findByUserOrderBySortOrderAscIdAsc(user).stream()
                .map(a -> UserProfileDetailRequest.AwardItem.builder()
                        .awardName(a.getAwardName())
                        .awarding(a.getAwarding())
                        .awardDate(a.getAwardDate())
                        .description(a.getDescription())
                        .build())
                .collect(Collectors.toList());

        List<UserProfileDetailRequest.CertificationItem> certs = userCertificationRepository
                .findByUserOrderBySortOrderAscIdAsc(user).stream()
                .map(c -> UserProfileDetailRequest.CertificationItem.builder()
                        .certName(c.getCertName())
                        .issuer(c.getIssuer())
                        .acquiredDate(c.getAcquiredDate())
                        .build())
                .collect(Collectors.toList());

        // CLIENT인 경우 ClientProfile에서 industry, slogan 가져오기
        String industry = null;
        String slogan = null;
        String shortBio = detail != null ? detail.getShortBio() : null;  // UserProfileDetail 우선
        String strengthDescFromProfile = null;
        if (user.getUserType() == User.UserType.CLIENT) {
            ClientProfile clientProfile = clientProfileRepository.findByUser(user).orElse(null);
            if (clientProfile != null) {
                industry = clientProfile.getIndustry();
                slogan = clientProfile.getSlogan();
                if (shortBio == null) shortBio = clientProfile.getShortBio();  // fallback
                strengthDescFromProfile = clientProfile.getStrengthDesc();
            }
        }

        // PARTNER인 경우 PartnerProfile에서 serviceField, slogan, grade 가져오기
        String serviceField = null;
        String grade = null;
        Integer completedProjects = null;
        Double rating = null;
        if (user.getUserType() == User.UserType.PARTNER) {
            PartnerProfile partnerProfile = partnerProfileRepository.findByUser(user).orElse(null);
            if (partnerProfile != null) {
                serviceField = partnerProfile.getServiceField();
                slogan = partnerProfile.getSlogan();  // 파트너도 slogan 가져오기
                if (shortBio == null) shortBio = partnerProfile.getShortBio();  // fallback
                strengthDescFromProfile = partnerProfile.getStrengthDesc();
                grade = partnerProfile.getGrade() != null ? partnerProfile.getGrade().name() : null;
                // PartnerProfileStats에서 completedProjects, rating 가져오기
                var statsOpt = partnerProfileStatsRepository.findByPartnerProfile(partnerProfile);
                if (statsOpt.isPresent()) {
                    var stats = statsOpt.get();
                    completedProjects = stats.getCompletedProjects();
                    rating = stats.getRating();
                }
            }
        } else {
            // CLIENT인 경우 ClientProfile에서 grade 가져오기
            ClientProfile clientProfile = clientProfileRepository.findByUser(user).orElse(null);
            if (clientProfile != null) {
                grade = clientProfile.getGrade() != null ? clientProfile.getGrade().name() : null;
                // ClientProfileStats에서 completedProjects, rating 가져오기  
                var statsOpt = clientProfileStatsRepository.findByClientProfile(clientProfile);
                if (statsOpt.isPresent()) {
                    var stats = statsOpt.get();
                    completedProjects = stats.getCompletedProjects();
                    rating = stats.getRating();
                }
            }
        }

        return UserProfileDetailResponse.builder()
                .userId(userId)
                // User 테이블 기본 정보
                .phone(user.getPhone())
                .birthDate(user.getBirthDate() != null ? user.getBirthDate().toString() : null)
                .region(user.getRegion())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .taxEmail(user.getTaxEmail())
                .contactEmail(user.getContactEmail())
                .profileImageUrl(user.getProfileImageUrl())
                .serviceField(serviceField)
                // PartnerProfile/ClientProfile 등급 정보
                .grade(grade)
                .completedProjects(completedProjects)
                .rating(rating)
                // UserProfileDetail 정보
                .bio(detail != null ? detail.getBio() : null)
                .strengthDesc(detail != null ? detail.getStrengthDesc() : null)
                .shortBio(shortBio)
                .industry(industry)
                .slogan(slogan)
                .sloganSub(strengthDescFromProfile)  // 프로필의 strengthDesc를 sloganSub로 사용
                .githubUrl(detail != null ? detail.getGithubUrl() : null)
                .githubHandle(detail != null ? detail.getGithubHandle() : null)
                .githubRepoUrl(detail != null ? detail.getGithubRepoUrl() : null)
                .profileMenuToggles(toggles)
                .verifiedEmail(verified)
                .skills(skills)
                .careers(careers)
                .educations(educations)
                .awards(awards)
                .certifications(certs)
                .build();
    }

    /** [DEV ONLY] username 으로 직접 초기화. */
    @Transactional
    public void resetByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. username=" + username));
        resetMyProfile(user.getId());
    }

    /**
     * 본인 프로필 데이터 일괄 초기화.
     * 자식 컬렉션 (skills/careers/educations/awards/certifications) 모두 삭제 +
     * UserProfileDetail 의 자기소개/슬로건/GitHub URL/short bio/strengthDesc/profileImageUrl 등도 초기 상태로.
     * USERS 테이블 자체(username/email/password) 와 phone/birthDate/region 등 계정 기본값은 보존.
     */
    @Transactional
    public void resetMyProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        // 자식 컬렉션 비우기
        try { userSkillDetailRepository.deleteByUser(user); } catch (Exception ignore) {}
        try { userCareerRepository.deleteByUser(user); } catch (Exception ignore) {}
        try { userEducationRepository.deleteByUser(user); } catch (Exception ignore) {}
        try { userAwardRepository.deleteByUser(user); } catch (Exception ignore) {}
        try { userCertificationRepository.deleteByUser(user); } catch (Exception ignore) {}

        // UserProfileDetail 의 텍스트/링크 필드 초기화 (인증 이메일/검증 상태도 같이 비움)
        userProfileDetailRepository.findByUser(user).ifPresent(detail -> {
            detail.setBio(null);
            detail.setShortBio(null);
            detail.setStrengthDesc(null);
            detail.setGithubUrl(null);
            detail.setGithubHandle(null);
            detail.setGithubRepoUrl(null);
            detail.setVerifiedEmail(null);
            detail.setVerifiedEmailType(null);
            userProfileDetailRepository.save(detail);
        });

        // PartnerProfile 의 slogan/sloganSub 도 같이 초기화 (있는 경우).
        // slogan 컬럼이 NOT NULL 제약일 수 있어 null 대신 빈 문자열 사용.
        partnerProfileRepository.findByUser(user).ifPresent(pp -> {
            try { pp.setSlogan(""); } catch (Exception ignore) {}
            try { pp.setSloganSub(""); } catch (Exception ignore) {}
            partnerProfileRepository.save(pp);
        });
    }

    /**
     * 전체 프로필 세부 정보 일괄 저장 (upsert + 자식 컬렉션은 deleteAll → insert).
     */
    @Transactional
    public UserProfileDetailResponse saveDetail(Long userId, UserProfileDetailRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다. id=" + userId));

        // 1) UserProfileDetail upsert
        UserProfileDetail detail = userProfileDetailRepository.findByUser(user)
                .orElseGet(() -> UserProfileDetail.builder().user(user).build());

        detail.setBio(req.getBio());
        detail.setStrengthDesc(req.getStrengthDesc());
        detail.setShortBio(req.getShortBio());
        detail.setGithubUrl(req.getGithubUrl());
        detail.setGithubHandle(req.getGithubHandle());
        detail.setGithubRepoUrl(req.getGithubRepoUrl());
        detail.setProfileMenuToggles(toJson(req.getProfileMenuToggles()));
        if (req.getVerifiedEmail() != null) {
            detail.setVerifiedEmailType(req.getVerifiedEmail().getType());
            detail.setVerifiedEmail(req.getVerifiedEmail().getEmail());
        }
        userProfileDetailRepository.save(detail);

        // 2) Skills (전체 삭제 후 재삽입)
        if (req.getSkills() != null) {
            userSkillDetailRepository.deleteByUser(user);
            int order = 0;
            for (UserProfileDetailRequest.SkillItem s : req.getSkills()) {
                if (s == null) continue;
                userSkillDetailRepository.save(UserSkillDetail.builder()
                        .user(user)
                        .techName(s.getTechName())
                        .customTech(s.getCustomTech())
                        .proficiency(s.getProficiency())
                        .experience(s.getExperience())
                        .mode(s.getMode())
                        .sortOrder(order++)
                        .build());
            }
        }

        // 3) Careers
        if (req.getCareers() != null) {
            userCareerRepository.deleteByUser(user);
            int order = 0;
            for (UserProfileDetailRequest.CareerItem c : req.getCareers()) {
                if (c == null) continue;
                userCareerRepository.save(UserCareer.builder()
                        .user(user)
                        .companyName(c.getCompanyName())
                        .mainTech(c.getMainTech())
                        .jobTitle(c.getJobTitle())
                        .startDate(c.getStartDate())
                        .endDate(c.getEndDate())
                        .isCurrent(c.getIsCurrent())
                        .employmentType(c.getEmploymentType())
                        .role(c.getRole())
                        .level(c.getLevel())
                        .description(c.getDescription())
                        .projects(toJson(c.getProjects()))
                        .verifiedCompany(c.getVerifiedCompany())
                        .verifiedEmail(c.getVerifiedEmail())
                        .sortOrder(order++)
                        .build());
            }
        }

        // 4) Educations
        if (req.getEducations() != null) {
            userEducationRepository.deleteByUser(user);
            int order = 0;
            for (UserProfileDetailRequest.EducationItem e : req.getEducations()) {
                if (e == null) continue;
                userEducationRepository.save(UserEducation.builder()
                        .user(user)
                        .schoolType(e.getSchoolType())
                        .schoolName(e.getSchoolName())
                        .track(e.getTrack())
                        .major(e.getMajor())
                        .degreeType(e.getDegreeType())
                        .status(e.getStatus())
                        .admissionDate(e.getAdmissionDate())
                        .graduationDate(e.getGraduationDate())
                        .gpa(e.getGpa())
                        .gpaScale(e.getGpaScale())
                        .researchTopic(e.getResearchTopic())
                        .verifiedSchool(e.getVerifiedSchool())
                        .verifiedEmail(e.getVerifiedEmail())
                        .sortOrder(order++)
                        .build());
            }
        }

        // 5) Awards
        if (req.getAwards() != null) {
            userAwardRepository.deleteByUser(user);
            int order = 0;
            for (UserProfileDetailRequest.AwardItem a : req.getAwards()) {
                if (a == null) continue;
                userAwardRepository.save(UserAward.builder()
                        .user(user)
                        .awardName(a.getAwardName())
                        .awarding(a.getAwarding())
                        .awardDate(a.getAwardDate())
                        .description(a.getDescription())
                        .sortOrder(order++)
                        .build());
            }
        }

        // 6) Certifications
        if (req.getCertifications() != null) {
            userCertificationRepository.deleteByUser(user);
            int order = 0;
            for (UserProfileDetailRequest.CertificationItem c : req.getCertifications()) {
                if (c == null) continue;
                userCertificationRepository.save(UserCertification.builder()
                        .user(user)
                        .certName(c.getCertName())
                        .issuer(c.getIssuer())
                        .acquiredDate(c.getAcquiredDate())
                        .sortOrder(order++)
                        .build());
            }
        }

        // 7) 검색/카드 노출용 레거시 테이블(PARTNER_PROFILE / CLIENT_PROFILE / PARTNER_SKILL) 동기화
        syncToLegacyProfile(user, req);

        return getDetail(userId);
    }

    /**
     * USER_PROFILE_DETAIL에 저장한 내용을 검색 화면이 사용하는 PARTNER_PROFILE / CLIENT_PROFILE 테이블에도 반영한다.
     * - PartnerSearch / ClientSearch 는 여전히 레거시 테이블을 읽기 때문에 두 곳 모두 채워야 AI 챗 결과가 노출된다.
     * - 회원가입 시 만들어진 row 가 없으면 동기화를 건너뛴다(필수 컬럼 NOT NULL 제약 회피).
     */
    private void syncToLegacyProfile(User user, UserProfileDetailRequest req) {
        if (user == null || user.getUserType() == null) return;

        if (user.getUserType() == User.UserType.PARTNER) {
            partnerProfileRepository.findByUser(user).ifPresent(pp -> {
                if (req.getBio() != null) pp.setBio(req.getBio());
                if (req.getStrengthDesc() != null) pp.setStrengthDesc(req.getStrengthDesc());
                if (req.getShortBio() != null) pp.setShortBio(req.getShortBio());
                if (req.getGithubUrl() != null) pp.setGithubUrl(req.getGithubUrl());
                partnerProfileRepository.save(pp);

                // PARTNER_SKILL 매핑은 USER_SKILL_DETAIL 기준으로 다시 만든다(delete-then-insert).
                if (req.getSkills() != null) {
                    partnerSkillRepository.deleteByPartnerProfile(pp);
                    Set<String> seen = new HashSet<>();
                    for (UserProfileDetailRequest.SkillItem s : req.getSkills()) {
                        if (s == null) continue;
                        String name = (s.getCustomTech() != null && !s.getCustomTech().isBlank())
                                ? s.getCustomTech().trim()
                                : (s.getTechName() != null ? s.getTechName().trim() : null);
                        if (name == null || name.isBlank()) continue;
                        if (!seen.add(name)) continue;
                        SkillMaster sm = skillMasterRepository.findByName(name)
                                .orElseGet(() -> skillMasterRepository.save(SkillMaster.builder().name(name).build()));
                        partnerSkillRepository.save(PartnerSkill.builder()
                                .partnerProfile(pp)
                                .skill(sm)
                                .build());
                    }
                }
            });
        } else if (user.getUserType() == User.UserType.CLIENT) {
            clientProfileRepository.findByUser(user).ifPresent(cp -> {
                if (req.getBio() != null) cp.setBio(req.getBio());
                if (req.getStrengthDesc() != null) cp.setStrengthDesc(req.getStrengthDesc());
                if (req.getShortBio() != null) cp.setShortBio(req.getShortBio());
                if (req.getIndustry() != null) cp.setIndustry(req.getIndustry());
                clientProfileRepository.save(cp);
            });
        }
    }
    private static String toJson(Object value) {
        if (value == null) return null;
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    private static Map<String, Boolean> parseToggles(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, new TypeReference<Map<String, Boolean>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private static List<Map<String, Object>> parseProjects(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return OM.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /**
     * 마이페이지에서 사용자 기본 정보 업데이트.
     * User 테이블: phone, birthDate, region, taxEmail, contactEmail, profileImageUrl
     * PartnerProfile: serviceField (파트너만)
     * ClientProfile: industry (클라이언트만)
     * 
     * @return 업데이트된 정보를 포함한 응답 (프론트엔드 재조회 불필요)
     */
    @Transactional
    public Map<String, Object> updateBasicInfo(Long userId, com.DevBridge.devbridge.domain.user.dto.UpdateUserBasicInfoRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        // User 테이블 업데이트 (빈 문자열 체크 추가)
        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            user.setPhone(req.getPhone());
        }
        if (req.getBirthDate() != null && !req.getBirthDate().isBlank()) {
            try {
                user.setBirthDate(java.time.LocalDate.parse(req.getBirthDate()));
            } catch (Exception e) {
                log.warn("[ProfileService] birthDate 파싱 실패: {}", req.getBirthDate());
            }
        }
        if (req.getRegion() != null && !req.getRegion().isBlank()) {
            user.setRegion(req.getRegion());
        }
        if (req.getTaxEmail() != null && !req.getTaxEmail().isBlank()) {
            user.setTaxEmail(req.getTaxEmail());
        }
        if (req.getContactEmail() != null && !req.getContactEmail().isBlank()) {
            user.setContactEmail(req.getContactEmail());
        }
        if (req.getGender() != null && !req.getGender().isBlank()) {
            try {
                String genderUpper = req.getGender().toUpperCase().trim();
                User.Gender genderEnum = User.Gender.valueOf(genderUpper);
                user.setGender(genderEnum);
            } catch (IllegalArgumentException e) {
                log.warn("[ProfileService] gender 변환 실패: '{}' (허용값: MALE, FEMALE, OTHER)", req.getGender());
                throw new RuntimeException("잘못된 성별 값입니다. MALE, FEMALE, OTHER 중 하나를 사용해주세요.");
            }
        }
        if (req.getProfileImageUrl() != null && !req.getProfileImageUrl().isBlank()) {
            user.setProfileImageUrl(req.getProfileImageUrl());
        }
        userRepository.save(user);

        // 파트너인 경우 serviceField, slogan 업데이트
        String updatedServiceField = null;
        if (user.getUserType() == User.UserType.PARTNER) {
            partnerProfileRepository.findByUser(user).ifPresent(pp -> {
                if (req.getServiceField() != null && !req.getServiceField().isBlank()) {
                    pp.setServiceField(req.getServiceField());
                }
                if (req.getSlogan() != null && !req.getSlogan().isBlank()) {
                    pp.setSlogan(req.getSlogan());
                }
                partnerProfileRepository.save(pp);
            });
            updatedServiceField = req.getServiceField();
        }

        // 클라이언트인 경우 industry, slogan 업데이트
        String updatedIndustry = null;
        if (user.getUserType() == User.UserType.CLIENT) {
            clientProfileRepository.findByUser(user).ifPresent(cp -> {
                if (req.getIndustry() != null && !req.getIndustry().isBlank()) {
                    cp.setIndustry(req.getIndustry());
                }
                if (req.getSlogan() != null && !req.getSlogan().isBlank()) {
                    cp.setSlogan(req.getSlogan());
                }
                clientProfileRepository.save(cp);
            });
            updatedIndustry = req.getIndustry();
        }

        // 업데이트된 정보 반환 (프론트엔드 재조회 불필요)
        Map<String, Object> response = new HashMap<>();
        response.put("message", "기본 정보가 업데이트되었습니다.");
        response.put("data", Map.of(
            "phone", user.getPhone() != null ? user.getPhone() : "",
            "birthDate", user.getBirthDate() != null ? user.getBirthDate().toString() : "",
            "region", user.getRegion() != null ? user.getRegion() : "",
            "gender", user.getGender() != null ? user.getGender().name() : "",
            "taxEmail", user.getTaxEmail() != null ? user.getTaxEmail() : "",
            "contactEmail", user.getContactEmail() != null ? user.getContactEmail() : "",
            "profileImageUrl", user.getProfileImageUrl() != null ? user.getProfileImageUrl() : "",
            "serviceField", updatedServiceField != null ? updatedServiceField : "",
            "industry", updatedIndustry != null ? updatedIndustry : ""
        ));
        return response;
    }
}
