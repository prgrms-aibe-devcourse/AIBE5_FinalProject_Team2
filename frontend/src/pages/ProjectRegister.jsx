import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Info, CheckCircle2, FileText, CalendarDays,
  Users, UserSearch, MoreHorizontal, Check,
} from "lucide-react";
import Header_client from "../components/Header_client";
import Header_partner from "../components/Header_partner";
import ChatBot from "../components/ChatBot";
import { ScopeModal, DeliverablesModal, ScheduleModal, PaymentModal, RevisionModal, CompletionModal, SpecialTermsModal } from "../components/ContractModals";
import useStore from "../store/useStore";
import kikhoekIcon from "../assets/planning.png";
import designIcon from "../assets/design.png";
import baepoIcon from "../assets/deployment.png";
import devIcon from "../assets/development.png";
import mascotIcon from "../assets/hero_default.png";
import meetingIcon from "../assets/hero_meeting.png";
import homeBg from "../assets/home.png";
import { chatWithAI, langInstruction } from "../lib/aiClient";
import { projectsApi } from "../api";
import { useLanguage } from "../i18n/LanguageContext";

const PROJECT_REGISTER_AI_PROMPT = `너는 ALPHA-HELIX 플랫폼의 AI 매니저야. 클라이언트가 만들고 싶은 프로젝트를 듣고 서비스 개요, 주요 기능, 대상 사용자, 예상 규모, 추천 기술 스택을 정리해줘. 핵심은 **굵게** 표시하고, 이모지도 적절히. 5~10줄 이내.`;

/* ─────────────────────────────────────────────────────────
   7가지 세부 협의사항 자동 prefill
   - 앞 단계에서 입력한 데이터(예산/일정/제목/카테고리 등)를 기반으로,
     ContractModals 가 기대하는 구조(객체) 형태로 contractTerms 를 미리 채운다.
   - AI가 이미 객체 모양으로 채운 키는 그대로 사용.
   - AI가 문자열만 줬으면 해당 문자열을 memo/intro 등 적절한 자리에 흘려넣음.
───────────────────────────────────────────────────────── */
function fmtMoney(n) {
  if (n == null || n === "") return "10,000,000";
  const num = Number(String(n).replace(/[^0-9]/g, ""));
  if (!num) return "10,000,000";
  return num.toLocaleString("ko-KR");
}
function addMonthsKo(startDateStr, months) {
  // startDateStr: "YYYY-MM-DD" or "YYYY.MM.DD"
  if (!startDateStr) return "";
  const norm = String(startDateStr).replace(/\./g, "-");
  const d = new Date(norm);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + Number(months || 0));
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${dd}`;
}
function toKoDate(s) {
  if (!s) return "";
  return String(s).replace(/-/g, ".");
}
function buildPrefilledContractTerms(data, existing = {}) {
  const months = Number(data.durationMonths || data.contractMonths || 2) || 2;
  const startD = data.startDate || "";
  const endD = startD ? addMonthsKo(startD, months) : "";
  const launchD = startD ? addMonthsKo(startD, months) : "";
  const total = Number(String(data.budgetAmount ?? data.monthlyRate ?? "").replace(/[^0-9]/g, "")) || 10000000;
  const totalStr = fmtMoney(total);
  const init = total / 10 * 3;
  const mid  = total / 10 * 4;
  const last = total - init - mid;

  // 마일스톤: durationMonths 를 4 등분
  const phaseCount = 4;
  const weeksPer = Math.max(1, Math.round((months * 4) / phaseCount));
  const phaseTitles = ["기획/설계", "1차 개발", "2차 개발 / 통합", "최종 검수 / 배포"];
  const phaseDescs  = [
    "요구사항 상세 정의 및 UI/UX 와이어프레임 설계 확정",
    "핵심 기능 개발 및 주요 화면/API 구현",
    "전체 모듈 통합 및 보조 기능, 어드민 페이지 개발",
    "QA 테스트, 버그 수정 및 실 서버 배포 준비",
  ];
  const phases = phaseTitles.map((t, i) => ({
    num: `PHASE 0${i + 1}`,
    title: t,
    desc: phaseDescs[i],
    date: startD ? addMonthsKo(startD, Math.round((months / phaseCount) * (i + 1))) : "",
    weeks: `${weeksPer}주 소요`,
  }));

  // AI가 객체로 잘 줬으면 그대로 사용
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  // 작업 범위 (scope)
  const scopeArr = Array.isArray(data.scope) ? data.scope : [];
  const scopeMap = { planning: "기획", design: "디자인", publishing: "퍼블리싱", dev: "개발" };
  const scopeIncluded = scopeArr.length
    ? scopeArr.map(s => `${scopeMap[s] || s} 전반 작업`)
    : ["요구사항 분석 및 설계", "핵심 기능 개발", "산출물 인도"];
  const scopeExisting = existing.scope;
  const scope = isObj(scopeExisting) ? scopeExisting : {
    included: scopeIncluded,
    excluded: ["서버 인프라 운영", "출시 후 운영/장애 대응", "콘텐츠 제작 및 마케팅"],
    memo: typeof scopeExisting === "string"
      ? scopeExisting
      : `프로젝트명: ${data.title || "(제목 미입력)"}\n주요 기술: ${(data.techTags || []).join(", ") || "미정"}`,
  };

  // 산출물 (deliverables)
  const delExisting = existing.deliverables;
  const deliverables = isObj(delExisting) ? delExisting : {
    deliverables: [
      { icon: "📄", label: "요구사항 정의서 / 기획안 PDF" },
      { icon: "🎨", label: "UI/UX 디자인 시안 (Figma 링크)" },
      { icon: "💻", label: "소스코드 GitHub 레포지토리" },
      { icon: "📖", label: "사용 가이드 / API 문서" },
    ],
    formats: ["PDF", "Figma URL", "GitHub URL", "Markdown 문서"],
    delivery: ["ALPHA-HELIX 채팅 첨부", "GitHub 링크 공유", "필요 시 ZIP 별도 전달"],
    notes: typeof delExisting === "string" ? [delExisting] : ["전달물에는 한국어 설명 문서 포함", "운영 배포본은 별도 협의"],
  };

  // 일정 (schedule)
  const schExisting = existing.schedule;
  const schedule = isObj(schExisting) ? schExisting : {
    phases,
    startDate: toKoDate(startD) || "협의",
    endDate: endD || "협의",
    launchDate: launchD || "협의",
    reviewRules: [
      { label: "마일스톤별 검토 기간", value: "영업일 기준 3일 이내" },
      { label: "무상 수정 횟수", value: "총 3회 (디자인/기능 포함)" },
      { label: "피드백 지연 대응", value: "지연 일수만큼 자동 연장" },
    ],
  };

  // 대금 (payment)
  const payExisting = existing.payment;
  const payment = isObj(payExisting) ? payExisting : {
    total: totalStr,
    vatNote: "VAT 별도",
    stages: [
      { label: "계약금 (30%)", tag: "Initial", amount: `₩${fmtMoney(init)}`, desc: "계약 후 3일 이내" },
      { label: "중도금 (40%)", tag: null,      amount: `₩${fmtMoney(mid)}`,  desc: "1차 산출물 검수 완료 후" },
      { label: "잔금 (30%)",   tag: null,      amount: `₩${fmtMoney(last)}`, desc: "최종 납품 및 검수 완료 후" },
    ],
    bankName: "추후 협의 (계약 시 확정)",
    bankNote: "계좌 이체 · 일반 과세",
    extraPolicies: typeof payExisting === "string"
      ? [payExisting]
      : ["범위 외 요청: Man-month 실비 정산", "긴급 수정: 일괄 20% 할증 적용"],
  };

  // 수정 (revision)
  const revExisting = existing.revision;
  const revision = isObj(revExisting) ? revExisting : {
    freeItems: [
      "단순 텍스트 문구 및 기배치 이미지의 교체",
      "색상, 폰트 스타일 등 단순 UI/UX 스타일 가이드 조정",
      "기존 기획안의 범주를 벗어나지 않는 마이너 업데이트",
    ],
    paidItems: [
      "최초 기획에 없던 신규 페이지 제작 및 대규모 기능 추가",
      "프로젝트 전체 디자인 컨셉 및 톤앤매너의 전면 재구축",
      "백엔드 로직의 근본적 변경 또는 DB 스키마 구조의 재설계",
    ],
    memo: typeof revExisting === "string"
      ? revExisting
      : "무상 수정 횟수는 총 3회로 제한됩니다. 횟수 초과 시 또는 유상 수정 기준에 해당하는 요청의 경우, 작업량 산정 후 별도의 추가 비용이 발생할 수 있습니다.",
  };

  // 완료 기준 (completion)
  const cmpExisting = existing.completion;
  const completion = isObj(cmpExisting) ? cmpExisting : {
    steps: [
      { n: 1, title: "결과물 제출", desc: "작업자가 마일스톤 완료 후 결과물을 시스템에 업로드" },
      { n: 2, title: "상호 검수 및 수정", desc: "의뢰자의 피드백에 따른 오류 수정 및 보완 작업 진행" },
      { n: 3, title: "최종 승인 확정", desc: "모든 조건 충족 시 의뢰자가 최종 완료 버튼 클릭" },
    ],
    criteria: typeof cmpExisting === "string"
      ? [cmpExisting]
      : ["명세서 기반 기능 전수 동작", "주요 브라우저(Chrome, Safari) 호환성 확보", "코드 리뷰 인수인계 문서 포함"],
    categories: [
      { n: 1, title: "기획/디자인 산출물 전달", desc: "요구사항 정의서(PRD), UI/UX/Figma 디자인 파일 최종안 전달 완료." },
      { n: 2, title: "소스코드 리포지토리 전달", desc: "Github 프라이빗 리포지토리의 모든 개발 코드 및 배포 스크립트 최종 푸시 완료." },
      { n: 3, title: "API 명세 / 문서 전달", desc: "합의된 모든 핵심 및 부가 API의 명세서(Swagger 등) 전달 완료." },
      { n: 4, title: "운영 환경 테스트 완료", desc: "합의된 테스트 시나리오에 따른 QA 결과 보고서 제출 및 버그 수정 완료." },
    ],
  };

  // 추가 특약 (specialTerms)
  const spExisting = existing.specialTerms;
  const specialTerms = isObj(spExisting) ? spExisting : {
    intro: typeof spExisting === "string"
      ? spExisting
      : "프로젝트의 원활한 진행과 상호 권리 보호를 위해 아래의 추가 특약 사항을 협의합니다.",
    terms: [
      { id: "nda", icon: "🛡", title: "보안 및 기밀 유지 (NDA)", enabled: true,
        items: ["프로젝트 관련 모든 내부 자료 및 산출물에 대한 제3자 유출 금지", "위반 시 발생한 실제 손해에 대한 배상 책임 부담"] },
      { id: "ip", icon: "©", title: "지식재산권 귀속", enabled: true,
        items: ["최종 대금 지급 완료 시 산출물에 대한 모든 저작권은 의뢰인에게 귀속", "단, 작업자의 비상업적 목적 포트폴리오 활용 권한은 인정"] },
      { id: "dispute", icon: "⚖", title: "분쟁 해결 및 관할", enabled: false,
        items: ["발생하는 분쟁은 상호 협의를 통해 해결함을 원칙으로 하되, 원만히 해결되지 않을 경우 서울중앙지방법원을 전속 관할로 합니다."] },
      { id: "etc", icon: "…", title: "기타 특약", enabled: false,
        items: ["Communication: 계약 기간 내 상호 비방 금지 및 신의성실 원칙 준수", "Handover: 프로젝트 종료 후 인수인계 기간 최소 1주일 보장"] },
    ],
  };

  return { scope, deliverables, schedule, payment, revision, completion, specialTerms };
}

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BLUE_GRAD = "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)";

const PR_TEXT = {
  ko: {
    typeTitle: "어떤 프로젝트를 진행하실 예정인가요?",
    outsource: "외주", outsourceDesc: "외주 프로젝트를 맡기고 싶어요",
    fulltime: "기간제", fulltimeDesc: "기간제 상주 프로젝트를 맡기고 싶어요",
    skipStep: "이 단계 건너뛰기", nextStep: "다음 단계로", prevStep: "이전 단계로",
    registerTitle: "프로젝트 등록", fulltimeRegisterTitle: "기간제 프로젝트 등록",
    registerSubtitle: "Step-by-step guide",
    outsourceSteps: ["기본 정보", "준비 상태", "기획 상세 내용", "예산 및 인원 구성", "미팅 및 예상일정", "모집 요건", "기타 추가 정보"],
    outsourceSubs: ["프로젝트를 가장 잘 설명할 수 있는 핵심 정보를 입력해주세요.", "현재 프로젝트 준비 상태를 알려주세요.", "AI의 도움을 구체적으로 받으시면 훨씬 퀄리티 높은 프로젝트를 제안을 빠르게 완료하실 수 있습니다.", "프로젝트 예산과 협업에 필요한 인력 구성을 입력해주세요.", "파트너와의 미팅 방식과 예상 일정을 설정해주세요.", "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.", "프로젝트 모집에 필요한 상세 요건들을 입력해주세요."],
    fulltimeSteps: ["기본 정보", "근무 환경", "프로젝트 상세", "프로젝트 현황", "모집 요건", "기타 추가 정보"],
    fulltimeSubs: ["기간제 프로젝트에 대한 핵심 기본 정보를 입력해주세요.", "근무 형태, 위치, 기간 등 근무 환경을 설정해주세요.", "파트너가 수행하게 될 상세 업무 내용을 입력해주세요.", "현재 프로젝트의 개발 현황 및 팀 구성을 알려주세요.", "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.", "프로젝트 모집에 필요한 상세 요건들을 입력해주세요."],
    aiBannerTitle: "AI 매니저가 상세 내용 작성을 도와드릴게요.",
    aiBannerDesc: "프로젝트 핵심 키워드만 입력해도 상세 내용을 생성할 수 있습니다.",
    aiBannerBtn: "AI로 내용 작성 도움받기",
    helpTitle: "도움이 필요하신가요?",
    helpDesc: "프로젝트 등록 과정에서 궁금한 점이 있다면 언제든 고객센터로 문의해주세요.",
    fieldTitle: "프로젝트 제목", fieldTitlePh: "예) AI 기반 이커머스 추천 엔진 개발",
    fieldScope: "업무 범위 (중복 선택 가능)", fieldCategory: "카테고리",
    workScopes: [{key:"planning",label:"기획"},{key:"design",label:"디자인"},{key:"publishing",label:"프론트 개발"},{key:"dev",label:"백엔드 개발"}],
    categories: [{key:"web",label:"웹",desc:"반응형 웹, 관리자 페이지 등"},{key:"android",label:"안드로이드",desc:"Android 모바일 앱 개발"},{key:"ios",label:"iOS",desc:"iPhone, iPad 앱 개발"},{key:"pc",label:"PC 프로그램",desc:"Windows, macOS 설치형 프로그램"},{key:"embedded",label:"임베디드",desc:"펌웨어, 하드웨어 연동 프로그램"},{key:"etc",label:"기타",desc:"그 외 분야 프로젝트"}],
    completeTitle: (ft) => `${ft ? "기간제" : "외주"} 프로젝트 등록이 완료되었습니다!`,
    completeDesc: "파트너 찾기를 원하시면", completeCta: "파트너 찾기", completeDescEnd: "탭을 눌러보세요!",
    findPartner: "파트너 찾기 →", projectDashboard: "프로젝트 대시보드",
    partnerFreeTitle: "파트너도 무료 프로젝트를\n등록할 수 있어요!",
    partnerFreeBody: "\u0027파트너\u0027는 무료 프로젝트(외주)만 등록할 수 있어요!\n경험과 동료를 찾기에 좋은 기회입니다.\n진행하시겠어요?",
    partnerFreeBtn: "무료 프로젝트 등록하기", findProject: "프로젝트 찾기",
    finalLabel: "등록 완료 🎉",

    // Step 2 준비 상태
    s2_progressType: "프로젝트 진행 분류",
    s2_readiness:    "현재 준비 상태",
    s2_attach:       "참고 자료 첨부",
    s2_dragHint:     "파일을 드래그하거나 클릭하여 업로드하세요",
    s2_maxSize:      "최대 50MB까지 업로드 가능 (PDF, PPTX, DOCX, ZIP 등)",
    s2_visibility:   "자료 공개 범위 설정",
    s2_visAll:       "전체 공개",
    s2_visPartner:   "파트너에게만 공개",
    s2_visPrivate:   "비공개",
    // Step 3 기획 상세
    s3_aiTitle:      "AI 매니저가 상세 내용 작성을 도와드릴게요.",
    s3_aiDesc:       "프로젝트 핵심 키워드만 입력해도 상세 내용을 생성할 수 있습니다.",
    s3_aiBtn:        "AI로 내용 작성 도움받기",
    s3_field:        "프로젝트 분야",
    s3_fieldPh:      "서비스 기술 분야 선택",
    s3_recommend:    "추천 분야:",
    s3_max3:         "(최대 3개 선택 가능)",
    s3_detail:       "상세 업무 내용",
    s3_detailPh:     "프로젝트 개요 및 상세 업무 내용을 입력해주세요.",
    s3_charLimit:    "5000자 이내",
    s3_tech:         "관련 기술",
    s3_techPh:       "기술 스택을 검색하거나 입력하세요 (예: Python, Figma...)",
    s3_techHint:     "Enter 또는 쉼표(,)로 구분하여 추가",
    // Step 4 예산 / 인력
    s4_budget:       "지출 가능 예산",
    s4_won:          "원",
    s4_freeNote:     "파트너 무료 프로젝트는 예산이 0원으로 고정됩니다.",
    s4_budgetHint:   "예산에 따라 매칭되는 파트너의 숙련도가 달라질 수 있습니다.",
    s4_collab:       "협업 인력 구성",
    s4_persons:      "명",
    s4_role_planning:   "기획",
    s4_role_design:     "디자인/퍼블리싱",
    s4_role_publishing: "프론트 개발",
    s4_role_dev:        "백엔드 개발",
    // Step 5 미팅 / 일정
    s5_meetType:     "미팅 방식",
    s5_meetFreq:     "미팅 빈도",
    s5_tools:        "사용 툴",
    s5_meetingTypes:    ["온라인 (화상)", "오프라인 (대면)", "둘 다 가능", "미팅 불필요"],
    s5_meetingFreqs:    ["주 1회", "주 2~3회", "필요 시만", "정기 스탠드업"],
    s5_meetingTools:    ["Zoom", "Google Meet", "Teams", "Slack", "Discord", "카카오톡"],
    s5_startDate:    "예상 시작일",
    s5_negTitle:     "협의 가능합니다",
    s5_negSub:       "파트너와 상의 후 일정을 결정하고 싶습니다.",
    s5_specTitle:    "특정 시작일이 있습니다",
    s5_specSub:      "원하시는 구체적인 시작 날짜가 있는 경우 선택해주세요.",
    s5_duration:     "예상 진행 기간",
    s5_months:       "개월",
    s5_daysExpected: (d) => `(총 ${d}일 예상)`,
    s5_negotiable:   "예산 및 일정 협의 가능",
    s5_calCancel:    "취소",
    s5_calOk:        "확인",
    // Step 6 모집 요건
    s6_deadline:     "모집 마감일",
    s6_pickDate:     "날짜를 선택하세요",
    s6_govSupport:   "정부 지원사업 여부",
    s6_govNone:      "해당 없음",
    s6_govYes:       "해당 있음",
    s6_reqTags:      "지원자 필수 요건",
    s6_reqPh:        "필요한 역량이나 조건을 입력하세요",
    s6_reqPresets:   ["포트폴리오 필수", "경력 3년 이상", "상주 가능", "관련 학과 졸업"],
    s6_questions:    "사전 검증 질문",
    s6_qDesc:        "지원자에게 질문하고 싶은 내용을 작성해주세요 (최대 3개)",
    s6_qPh:          "질문을 입력하세요",
    s6_qAdd:         "질문 추가하기",
    // Step 7 기타
    s7_itExp:        "IT 경험 관리 여부",
    s7_itYes:        "IT 프로젝트 경험 있음",
    s7_itYesSub:     "이전에도 IT 관련 프로젝트를 진행해본 경험이 있습니다.",
    s7_itNo:         "IT 프로젝트 경험 없음",
    s7_itNoSub:      "IT 프로젝트를 처음 진행해보거나 경험이 적습니다.",
    s7_aiBannerTitle: "7가지 세부 협의사항이 복잡하시면 AI 매니저가 도와드릴게요.",
    s7_sevenTitle:   "7가지 세부 협의 사항",
    s7_sevenDesc:    "저장하기를 누르면 현재 입력 내용 기준으로 저장된 보기 상태로 전환되고, 이후에는 수정하기로 다시 편집할 수 있습니다.",
    s7_edit:         "수정",
    // FT (기간제) 공통
    ft_workType:     "근무 형태",
    ft_workTypes:    ["상주", "재택", "하이브리드"],
    ft_location:     "근무 지역",
    ft_locationPh:   "예시) 서울시 강남구 테헤란로",
    ft_period:       "근무 기간",
    ft_status:       "프로젝트 현황",
    ft_team:         "팀 구성",
    ft_addInfo:      "추가 안내사항",
    s2_typeNew:        "신규 프로젝트를 진행하려 합니다",
    s2_typeNewDesc:    "새로운 비즈니스 아이디어를 바탕으로 처음부터 구축하는 프로젝트입니다.",
    s2_typeMaint:      "운영 중인 서비스의 유지보수 또는 리뉴얼을 하려합니다",
    s2_typeMaintDesc:  "현재 운영 중인 시스템의 기능을 추가하거나 디자인을 개편하려 합니다.",
    s2_readyIdea:      "아이디어만 있음",
    s2_readyIdeaDesc:  "대략적인 컨셉만 있으며 구체화된 문서가 없는 초기 단계입니다.",
    s2_readyDoc:       "기획서/문서 있음",
    s2_readyDocDesc:   "요구사항 정의서나 기능 명세서 등 구체적인 기획 문서가 준비되어 있습니다.",
    s2_readyDesign:    "상세 설계 완료",
    s2_readyDesignDesc:"와이어프레임 또는 UI/UX 디자인이 완료되어 바로 개발 가능한 상태입니다.",
    s2_readyCode:      "기존 코드/유지보수",
    s2_readyCodeDesc:  "이미 서비스 중인 제품의 고도화 또는 유지보수 작업이 필요합니다.",
    ft2_workStyle:    "근무 형태",
    ft2_workStyles:   ["상주 (풀타임 오피스)", "원격 (재택 근무)", "혼합 (일부 상주)"],
    ft2_location:     "근무 위치",
    ft2_locationPh:   "예) 서울시 강남구 테헤란로 000",
    ft2_workDays:     "주 근무 일수",
    ft2_workDayOpts:  ["주 3일", "주 4일", "주 5일", "협의 가능"],
    ft2_workHours:    "근무 시간대",
    ft2_workHourOpts: ["오전 9시~오후 6시", "오전 10시~오후 7시", "자유 근무", "협의 가능"],
    ft2_contractTerm: "계약 기간",
    ft2_monthlyRate:  "월 보수 (예상 단가)",
    ft2_manwon:       "만원",
    ft4_devStage:     "현재 개발 단계",
    ft4_devStages:    ["기획 단계", "설계 단계", "개발 진행 중", "테스트 단계", "유지보수 단계"],
    ft4_teamSize:     "현재 팀 규모",
    ft4_teamSizes:    ["1명 (혼자)", "2~5명", "6~10명", "11명 이상"],
    ft4_stack:        "현재 사용 중인 기술 스택",
    ft4_stackPh:      "기술 스택 입력 (예: React, Spring, MySQL...)",
    ft4_techHint:     "Enter 또는 쉼표(,)로 구분하여 추가",
    ft4_status:       "프로젝트 현황 및 인수인계 사항",
    ft4_statusPh:     "현재 진행 중인 사항, 인수인계가 필요한 내용, 참고해야 할 기술 부채 등을 입력해주세요.",
    ft1_titlePh:      "예) 스타트업 풀스택 개발자 기간제 채용",
    ft1_scopeSingle:  "업무 범위 (단일 선택)",
    ft1_mainJob:      "주요 직무",
    ft1_mainJobHint:  "(선택하신 업무 범위에 따라 활성화됩니다)",
    ft1_recruitDetail:"상세 모집 요건",
    ft1_addLevel:     "다른 레벨 추가하기",
    ft1_recruitReq:   "모집 요건",
    ft1_yoe:          "연차",
    ft1_yoePh:        "연차 선택",
    ft1_yoeOpts:      ["신입", "1-3년", "3-5년", "5-10년", "10년 이상"],
    ft1_level:        "레벨",
    ft1_levelPh:      "레벨 선택",
    ft1_levelOpts:    ["주니어", "미드레벨", "시니어", "리드/매니저"],
    ft1_salary:       "월 급여",
    ft1_salaryPh:     "금액을 입력하세요 (예: 5,000,000)",
    ft1_skills:       "주요 기술",
    ft1_skillsPh:     "예: React, Node.js",
    ft1_detailReq:    "상세 요구 사항",
    ft1_detailReqPh:  "상세 업무 내용이나 우대 사항을 입력해 주세요.",
    ft1_headcount:    "필요인원",
  },
  en: {
    typeTitle: "What type of project are you planning?",
    outsource: "Outsourcing", outsourceDesc: "I want to outsource a project",
    fulltime: "Full-Time Contract", fulltimeDesc: "I want to hire a full-time on-site contractor",
    skipStep: "Skip this step", nextStep: "Next Step", prevStep: "Previous Step",
    registerTitle: "Project Registration", fulltimeRegisterTitle: "Full-Time Registration",
    registerSubtitle: "Step-by-step guide",
    outsourceSteps: ["Basic Info", "Readiness", "Project Details", "Budget & Team", "Meeting & Schedule", "Requirements", "Additional Info"],
    outsourceSubs: ["Enter the essential information that best describes your project.", "Let us know the current readiness status of your project.", "Getting AI assistance will help you complete a high-quality project proposal faster.", "Enter the project budget and required team composition.", "Set the meeting format and expected timeline with your partner.", "Enter the detailed requirements for recruiting project partners.", "Enter the detailed requirements for recruiting project partners."],
    fulltimeSteps: ["Basic Info", "Work Environment", "Project Details", "Project Status", "Requirements", "Additional Info"],
    fulltimeSubs: ["Enter the key basic information for the full-time contract project.", "Set the work format, location, duration, and other work environment details.", "Enter the detailed work tasks the partner will perform.", "Let us know the current development status and team composition.", "Enter the detailed requirements for recruiting project partners.", "Enter the detailed requirements for recruiting project partners."],
    aiBannerTitle: "Haenguni will help you write detailed content.",
    aiBannerDesc: "Enter just the key keywords and detailed content will be generated.",
    aiBannerBtn: "Get AI Writing Assistance",
    helpTitle: "Need help?",
    helpDesc: "If you have questions during project registration, feel free to contact our support center.",
    fieldTitle: "Project Title", fieldTitlePh: "e.g., AI-based E-commerce Recommendation Engine",
    fieldScope: "Work Scope (multiple selection)", fieldCategory: "Category",
    workScopes: [{key:"planning",label:"Planning"},{key:"design",label:"Design"},{key:"publishing",label:"Frontend Dev"},{key:"dev",label:"Backend Dev"}],
    categories: [{key:"web",label:"Web",desc:"Responsive web, admin pages, etc."},{key:"android",label:"Android",desc:"Android mobile app development"},{key:"ios",label:"iOS",desc:"iPhone, iPad app development"},{key:"pc",label:"PC Software",desc:"Windows, macOS desktop software"},{key:"embedded",label:"Embedded",desc:"Firmware, hardware integration"},{key:"etc",label:"Other",desc:"Other project types"}],
    completeTitle: (ft) => `${ft ? "Full-time" : "Outsourcing"} project registration complete!`,
    completeDesc: "To find a partner, check out the", completeCta: "Find Partners", completeDescEnd: "tab!",
    findPartner: "Find Partners →", projectDashboard: "Project Dashboard",
    partnerFreeTitle: "Partners can register\nfree projects too!",
    partnerFreeBody: "Partners can only register free (outsourcing) projects!\nIt's a great opportunity to find experience and collaborators.\nWould you like to proceed?",
    partnerFreeBtn: "Register Free Project", findProject: "Find Projects",
    finalLabel: "Submit 🎉",

    // Step 2
    s2_progressType: "Project Type",
    s2_readiness:    "Current Readiness",
    s2_attach:       "Reference Materials",
    s2_dragHint:     "Drag a file here or click to upload",
    s2_maxSize:      "Up to 50MB (PDF, PPTX, DOCX, ZIP, etc.)",
    s2_visibility:   "File Visibility",
    s2_visAll:       "Public",
    s2_visPartner:   "Partners only",
    s2_visPrivate:   "Private",
    // Step 3
    s3_aiTitle:      "Haenguni will help write the details.",
    s3_aiDesc:       "You can generate detailed content just by entering the project's key keywords.",
    s3_aiBtn:        "Get AI Writing Assistance",
    s3_field:        "Project Field",
    s3_fieldPh:      "Select service / tech field",
    s3_recommend:    "Recommended fields:",
    s3_max3:         "(up to 3)",
    s3_detail:       "Detailed Description",
    s3_detailPh:     "Enter the project overview and detailed work description.",
    s3_charLimit:    "Max 5000 characters",
    s3_tech:         "Tech Stack",
    s3_techPh:       "Search or enter tech stack (e.g., Python, Figma...)",
    s3_techHint:     "Press Enter or comma (,) to add",
    // Step 4
    s4_budget:       "Available Budget",
    s4_won:          "KRW",
    s4_freeNote:     "Free partner projects are fixed at 0 KRW.",
    s4_budgetHint:   "Partner skill level may vary depending on your budget.",
    s4_collab:       "Team Composition",
    s4_persons:      "persons",
    s4_role_planning:   "Planning",
    s4_role_design:     "Design / Publishing",
    s4_role_publishing: "Frontend Dev",
    s4_role_dev:        "Backend Dev",
    // Step 5
    s5_meetType:     "Meeting Format",
    s5_meetFreq:     "Meeting Frequency",
    s5_tools:        "Tools",
    s5_meetingTypes:    ["Online (video)", "Offline (in-person)", "Both", "No meetings needed"],
    s5_meetingFreqs:    ["Once a week", "2~3x a week", "Only when needed", "Regular standup"],
    s5_meetingTools:    ["Zoom", "Google Meet", "Teams", "Slack", "Discord", "KakaoTalk"],
    s5_startDate:    "Expected Start Date",
    s5_negTitle:     "Negotiable",
    s5_negSub:       "I want to decide the schedule after discussing with the partner.",
    s5_specTitle:    "I have a specific start date",
    s5_specSub:      "Choose this if you have a specific start date in mind.",
    s5_duration:     "Expected Duration",
    s5_months:       "months",
    s5_daysExpected: (d) => `(approx. ${d} days)`,
    s5_negotiable:   "Budget and schedule are negotiable",
    s5_calCancel:    "Cancel",
    s5_calOk:        "OK",
    // Step 6
    s6_deadline:     "Application Deadline",
    s6_pickDate:     "Select a date",
    s6_govSupport:   "Government-funded?",
    s6_govNone:      "Not applicable",
    s6_govYes:       "Applicable",
    s6_reqTags:      "Applicant Requirements",
    s6_reqPh:        "Enter required skills or conditions",
    s6_reqPresets:   ["Portfolio required", "3+ years experience", "On-site possible", "Related major"],
    s6_questions:    "Pre-screening Questions",
    s6_qDesc:        "Enter questions you want to ask applicants (max 3)",
    s6_qPh:          "Enter a question",
    s6_qAdd:         "Add Question",
    // Step 7
    s7_itExp:        "IT Experience",
    s7_itYes:        "Has IT project experience",
    s7_itYesSub:     "I have run IT-related projects before.",
    s7_itNo:         "No IT project experience",
    s7_itNoSub:      "This is my first IT project, or I have little experience.",
    s7_aiBannerTitle: "If the 7 detailed terms feel complex, Haenguni can help.",
    s7_sevenTitle:   "7 Detailed Agreement Terms",
    s7_sevenDesc:    "Click Save to lock the current values into a read-only view; you can use Edit later to modify them again.",
    s7_edit:         "Edit",
    // FT shared
    ft_workType:     "Work Format",
    ft_workTypes:    ["On-site", "Remote", "Hybrid"],
    ft_location:     "Work Location",
    ft_locationPh:   "e.g., Teheran-ro, Gangnam-gu, Seoul",
    ft_period:       "Work Period",
    ft_status:       "Project Status",
    ft_team:         "Team Composition",
    ft_addInfo:      "Additional Info",
    s2_typeNew:        "I'm starting a new project",
    s2_typeNewDesc:    "A project built from scratch based on a new business idea.",
    s2_typeMaint:      "Maintenance / renewal of an existing service",
    s2_typeMaintDesc:  "Adding features or redesigning a system that's already running.",
    s2_readyIdea:      "Just an idea",
    s2_readyIdeaDesc:  "Only a rough concept; no detailed documents yet.",
    s2_readyDoc:       "Has spec / planning docs",
    s2_readyDocDesc:   "Requirements or feature spec docs are already prepared.",
    s2_readyDesign:    "Detailed design done",
    s2_readyDesignDesc:"Wireframes or UI/UX design are complete and ready for development.",
    s2_readyCode:      "Existing code / maintenance",
    s2_readyCodeDesc:  "Improvement or maintenance of an already-running product.",
    ft2_workStyle:    "Work Style",
    ft2_workStyles:   ["On-site (full-time office)", "Remote (work from home)", "Hybrid (partial on-site)"],
    ft2_location:     "Work Location",
    ft2_locationPh:   "e.g., 000 Teheran-ro, Gangnam-gu, Seoul",
    ft2_workDays:     "Work Days / Week",
    ft2_workDayOpts:  ["3 days/week", "4 days/week", "5 days/week", "Negotiable"],
    ft2_workHours:    "Work Hours",
    ft2_workHourOpts: ["9 AM ~ 6 PM", "10 AM ~ 7 PM", "Flexible", "Negotiable"],
    ft2_contractTerm: "Contract Term",
    ft2_monthlyRate:  "Monthly Rate (estimate)",
    ft2_manwon:       "10K KRW",
    ft4_devStage:     "Current Dev Stage",
    ft4_devStages:    ["Planning", "Design", "In development", "Testing", "Maintenance"],
    ft4_teamSize:     "Current Team Size",
    ft4_teamSizes:    ["1 (solo)", "2~5", "6~10", "11+"],
    ft4_stack:        "Current Tech Stack",
    ft4_stackPh:      "Enter tech stack (e.g., React, Spring, MySQL...)",
    ft4_techHint:     "Press Enter or comma (,) to add",
    ft4_status:       "Project Status & Handover Notes",
    ft4_statusPh:     "Enter ongoing tasks, items requiring handover, technical debt to be aware of, etc.",
    ft1_titlePh:      "e.g., Startup full-stack developer contract hire",
    ft1_scopeSingle:  "Work Scope (single select)",
    ft1_mainJob:      "Main Job",
    ft1_mainJobHint:  "(activated based on selected work scope)",
    ft1_recruitDetail:"Detailed Requirements",
    ft1_addLevel:     "Add another level",
    ft1_recruitReq:   "Hiring Requirements",
    ft1_yoe:          "Experience",
    ft1_yoePh:        "Select experience",
    ft1_yoeOpts:      ["Entry", "1-3 yrs", "3-5 yrs", "5-10 yrs", "10+ yrs"],
    ft1_level:        "Level",
    ft1_levelPh:      "Select level",
    ft1_levelOpts:    ["Junior", "Mid", "Senior", "Lead/Manager"],
    ft1_salary:       "Monthly Salary",
    ft1_salaryPh:     "Enter amount (e.g., 5,000,000)",
    ft1_skills:       "Key Skills",
    ft1_skillsPh:     "e.g., React, Node.js",
    ft1_detailReq:    "Detailed Requirements",
    ft1_detailReqPh:  "Enter detailed work or preferred qualifications.",
    ft1_headcount:    "Headcount",
  },
  zh: {
    typeTitle: "您打算进行什么类型的项目？",
    outsource: "外包", outsourceDesc: "我想委托外包项目",
    fulltime: "驻场合同", fulltimeDesc: "我想招聘全职驻场承包商",
    skipStep: "跳过此步骤", nextStep: "下一步", prevStep: "上一步",
    registerTitle: "项目注册", fulltimeRegisterTitle: "驻场项目注册",
    registerSubtitle: "分步指南",
    outsourceSteps: ["基本信息", "准备状态", "项目详情", "预算与团队", "会议与日程", "招募要求", "其他信息"],
    outsourceSubs: ["请输入最能描述您项目的核心信息。", "请告知我们当前项目的准备状态。", "借助AI帮助，您可以更快完成高质量的项目提案。", "请输入项目预算和所需团队构成。", "请设置与合作伙伴的会议方式和预期时间表。", "请输入招募项目合作伙伴的详细要求。", "请输入招募项目合作伙伴的详细要求。"],
    fulltimeSteps: ["基本信息", "工作环境", "项目详情", "项目现状", "招募要求", "其他信息"],
    fulltimeSubs: ["请输入驻场合同项目的核心基本信息。", "请设置工作形式、地点、期限等工作环境详情。", "请输入合作伙伴将执行的详细工作内容。", "请告知我们当前的开发状况和团队构成。", "请输入招募项目合作伙伴的详细要求。", "请输入招募项目合作伙伴的详细要求。"],
    aiBannerTitle: "幸运鸟将帮助您撰写详细内容。",
    aiBannerDesc: "只需输入项目的核心关键词，即可生成详细内容。",
    aiBannerBtn: "获取AI写作帮助",
    helpTitle: "需要帮助吗？",
    helpDesc: "如果您在项目注册过程中有任何疑问，请随时联系我们的客服中心。",
    fieldTitle: "项目标题", fieldTitlePh: "例）基于AI的电商推荐引擎开发",
    fieldScope: "工作范围（可多选）", fieldCategory: "类别",
    workScopes: [{key:"planning",label:"策划"},{key:"design",label:"设计"},{key:"publishing",label:"前端开发"},{key:"dev",label:"后端开发"}],
    categories: [{key:"web",label:"网页",desc:"响应式网页、管理页面等"},{key:"android",label:"安卓",desc:"Android移动应用开发"},{key:"ios",label:"iOS",desc:"iPhone、iPad应用开发"},{key:"pc",label:"PC软件",desc:"Windows、macOS桌面软件"},{key:"embedded",label:"嵌入式",desc:"固件、硬件集成程序"},{key:"etc",label:"其他",desc:"其他类型项目"}],
    completeTitle: (ft) => `${ft ? "驻场" : "外包"} 项目注册完成！`,
    completeDesc: "如需寻找合作伙伴，请点击", completeCta: "寻找合作伙伴", completeDescEnd: "标签！",
    findPartner: "寻找合作伙伴 →", projectDashboard: "项目仪表板",
    partnerFreeTitle: "合作伙伴也可以注册\n免费项目！",
    partnerFreeBody: "合作伙伴只能注册免费（外包）项目！\n这是寻找经验和合作者的好机会。\n您想继续吗？",
    partnerFreeBtn: "注册免费项目", findProject: "查找项目",
    finalLabel: "提交 🎉",

    // Step 2
    s2_progressType: "项目进行分类",
    s2_readiness:    "当前准备状态",
    s2_attach:       "参考资料附件",
    s2_dragHint:     "拖拽文件到此处或点击上传",
    s2_maxSize:      "最大可上传 50MB（PDF, PPTX, DOCX, ZIP 等）",
    s2_visibility:   "资料公开范围",
    s2_visAll:       "完全公开",
    s2_visPartner:   "仅合作伙伴可见",
    s2_visPrivate:   "不公开",
    // Step 3
    s3_aiTitle:      "幸运鸟帮您撰写详细内容。",
    s3_aiDesc:       "只需输入项目核心关键词即可生成详细内容。",
    s3_aiBtn:        "获取 AI 写作帮助",
    s3_field:        "项目领域",
    s3_fieldPh:      "选择服务 / 技术领域",
    s3_recommend:    "推荐领域：",
    s3_max3:         "（最多 3 个）",
    s3_detail:       "详细工作内容",
    s3_detailPh:     "请输入项目概述与详细工作内容。",
    s3_charLimit:    "5000 字以内",
    s3_tech:         "相关技术",
    s3_techPh:       "搜索或输入技术栈（例：Python, Figma...）",
    s3_techHint:     "按 Enter 或逗号（,）添加",
    // Step 4
    s4_budget:       "可支出预算",
    s4_won:          "韩元",
    s4_freeNote:     "合作伙伴免费项目预算固定为 0 元。",
    s4_budgetHint:   "合作伙伴的熟练度可能随预算不同。",
    s4_collab:       "协作人员构成",
    s4_persons:      "人",
    s4_role_planning:   "策划",
    s4_role_design:     "设计/发布",
    s4_role_publishing: "前端开发",
    s4_role_dev:        "后端开发",
    // Step 5
    s5_meetType:     "会议方式",
    s5_meetFreq:     "会议频率",
    s5_tools:        "使用工具",
    s5_meetingTypes:    ["在线（视频）", "线下（面对面）", "两者均可", "无需会议"],
    s5_meetingFreqs:    ["每周 1 次", "每周 2~3 次", "按需", "定期站会"],
    s5_meetingTools:    ["Zoom", "Google Meet", "Teams", "Slack", "Discord", "卡卡话"],
    s5_startDate:    "预计开始日",
    s5_negTitle:     "可协商",
    s5_negSub:       "希望与合作伙伴商讨后决定时间。",
    s5_specTitle:    "有特定开始日",
    s5_specSub:      "如果您有具体的开始日期，请选择。",
    s5_duration:     "预计进行期间",
    s5_months:       "个月",
    s5_daysExpected: (d) => `（预计共 ${d} 天）`,
    s5_negotiable:   "预算及日程可协商",
    s5_calCancel:    "取消",
    s5_calOk:        "确定",
    // Step 6
    s6_deadline:     "招募截止日",
    s6_pickDate:     "请选择日期",
    s6_govSupport:   "是否为政府资助项目",
    s6_govNone:      "不适用",
    s6_govYes:       "适用",
    s6_reqTags:      "申请者必要条件",
    s6_reqPh:        "输入所需能力或条件",
    s6_reqPresets:   ["必须作品集", "3 年以上经验", "可驻场", "相关专业毕业"],
    s6_questions:    "预审问题",
    s6_qDesc:        "请输入您想问申请者的问题（最多 3 个）",
    s6_qPh:          "输入问题",
    s6_qAdd:         "添加问题",
    // Step 7
    s7_itExp:        "IT 经验管理",
    s7_itYes:        "有 IT 项目经验",
    s7_itYesSub:     "以前进行过 IT 相关项目。",
    s7_itNo:         "无 IT 项目经验",
    s7_itNoSub:      "首次进行 IT 项目或经验较少。",
    s7_aiBannerTitle: "如果 7 项详细协商事项复杂，幸运鸟可以帮忙。",
    s7_sevenTitle:   "7 项详细协商事项",
    s7_sevenDesc:    "点击保存后以当前输入为准转为查看状态，之后可通过“修改”重新编辑。",
    s7_edit:         "修改",
    // FT shared
    ft_workType:     "工作形式",
    ft_workTypes:    ["驻场", "远程", "混合"],
    ft_location:     "工作地点",
    ft_locationPh:   "例：首尔江南区德黑兰路",
    ft_period:       "工作期限",
    ft_status:       "项目现状",
    ft_team:         "团队构成",
    ft_addInfo:      "附加信息",
    s2_typeNew:        "我要启动新项目",
    s2_typeNewDesc:    "基于新的商业点子从零开始构建的项目。",
    s2_typeMaint:      "对已运营服务进行维护或重构",
    s2_typeMaintDesc:  "为现有系统添加功能或重新设计。",
    s2_readyIdea:      "仅有点子",
    s2_readyIdeaDesc:  "只有大致概念，还没有详细文档。",
    s2_readyDoc:       "已有策划书或文档",
    s2_readyDocDesc:   "需求说明书或功能规格书等具体文档已准备好。",
    s2_readyDesign:    "详细设计完成",
    s2_readyDesignDesc:"原型图或 UI/UX 设计已完成，可直接开发。",
    s2_readyCode:      "现有代码 / 维护",
    s2_readyCodeDesc:  "需要对已运营产品进行优化或维护。",
    ft2_workStyle:    "工作形式",
    ft2_workStyles:   ["驻场（全职办公室）", "远程（在家工作）", "混合（部分驻场）"],
    ft2_location:     "工作地点",
    ft2_locationPh:   "例：首尔江南区德黑兰路 000",
    ft2_workDays:     "每周工作天数",
    ft2_workDayOpts:  ["每周 3 天", "每周 4 天", "每周 5 天", "可协商"],
    ft2_workHours:    "工作时间",
    ft2_workHourOpts: ["上午 9 点~下午 6 点", "上午 10 点~下午 7 点", "自由工作", "可协商"],
    ft2_contractTerm: "合同期限",
    ft2_monthlyRate:  "月报酬（预估）",
    ft2_manwon:       "万元",
    ft4_devStage:     "当前开发阶段",
    ft4_devStages:    ["策划阶段", "设计阶段", "开发中", "测试阶段", "维护阶段"],
    ft4_teamSize:     "当前团队规模",
    ft4_teamSizes:    ["1 人（单人）", "2~5 人", "6~10 人", "11 人以上"],
    ft4_stack:        "当前使用的技术栈",
    ft4_stackPh:      "输入技术栈（例：React, Spring, MySQL...）",
    ft4_techHint:     "按 Enter 或逗号（,）添加",
    ft4_status:       "项目现状与交接事项",
    ft4_statusPh:     "请输入当前进行中的事项、需要交接的内容、需要注意的技术债务等。",
    ft1_titlePh:      "例：初创公司全栈开发者合同招聘",
    ft1_scopeSingle:  "工作范围（单选）",
    ft1_mainJob:      "主要职务",
    ft1_mainJobHint:  "（根据选中的工作范围激活）",
    ft1_recruitDetail:"详细招募要求",
    ft1_addLevel:     "添加其他级别",
    ft1_recruitReq:   "招募要求",
    ft1_yoe:          "年限",
    ft1_yoePh:        "选择年限",
    ft1_yoeOpts:      ["应届", "1-3 年", "3-5 年", "5-10 年", "10 年以上"],
    ft1_level:        "级别",
    ft1_levelPh:      "选择级别",
    ft1_levelOpts:    ["初级", "中级", "高级", "主管/经理"],
    ft1_salary:       "月薪",
    ft1_salaryPh:     "输入金额（例：5,000,000）",
    ft1_skills:       "主要技能",
    ft1_skillsPh:     "例：React, Node.js",
    ft1_detailReq:    "详细要求",
    ft1_detailReqPh:  "请输入详细工作内容或优先事项。",
    ft1_headcount:    "所需人数",
  },
};

const OUTSOURCE_STEPS = [
  { id: 1, label: "기본 정보", Icon: Info },
  { id: 2, label: "준비 상태", Icon: CheckCircle2 },
  { id: 3, label: "기획 상세 내용", Icon: FileText },
  { id: 4, label: "예산 및 인원 구성", Icon: CalendarDays },
  { id: 5, label: "미팅 및 예상일정", Icon: Users },
  { id: 6, label: "모집 요건", Icon: UserSearch },
  { id: 7, label: "기타 추가 정보", Icon: MoreHorizontal },
];

const STEP_SUBTITLES = {
  1: "프로젝트를 가장 잘 설명할 수 있는 핵심 정보를 입력해주세요.",
  2: "현재 프로젝트 준비 상태를 알려주세요.",
  3: "AI의 도움을 구체적으로 받으시면 훨씬 퀄리티 높은 프로젝트를 제안을 빠르게 완료하실 수 있습니다.",
  4: "프로젝트 예산과 협업에 필요한 인력 구성을 입력해주세요.",
  5: "파트너와의 미팅 방식과 예상 일정을 설정해주세요.",
  6: "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.",
  7: "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.",
};

const FULLTIME_STEPS = [
  { id: 1, label: "기본 정보",      Icon: Info },
  { id: 2, label: "근무 환경",      Icon: CalendarDays },
  { id: 3, label: "프로젝트 상세",  Icon: FileText },
  { id: 4, label: "프로젝트 현황",  Icon: CheckCircle2 },
  { id: 5, label: "모집 요건",      Icon: UserSearch },
  { id: 6, label: "기타 추가 정보", Icon: MoreHorizontal },
];

const FULLTIME_STEP_SUBTITLES = {
  1: "기간제 프로젝트에 대한 핵심 기본 정보를 입력해주세요.",
  2: "근무 형태, 위치, 기간 등 근무 환경을 설정해주세요.",
  3: "파트너가 수행하게 될 상세 업무 내용을 입력해주세요.",
  4: "현재 프로젝트의 개발 현황 및 팀 구성을 알려주세요.",
  5: "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.",
  6: "프로젝트 모집에 필요한 상세 요건들을 입력해주세요.",
};

/* ── 공통 입력 컴포넌트 ─────────────────────────────────────────── */
function FieldLabel({ children, required }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 10px", fontFamily: F }}>
      {children}
      {required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
    </p>
  );
}

function TextInput({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "13px 16px", borderRadius: 10,
        border: "1.5px solid #E5E7EB", fontSize: 14,
        fontFamily: F, color: "#111827", outline: "none",
        background: "white", transition: "border 0.15s",
      }}
      onFocus={e => (e.target.style.border = "1.5px solid #3B82F6")}
      onBlur={e => (e.target.style.border = "1.5px solid #E5E7EB")}
    />
  );
}

function Textarea({ placeholder, value, onChange, rows = 5 }) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "13px 16px", borderRadius: 10,
        border: "1.5px solid #E5E7EB", fontSize: 14,
        fontFamily: F, color: "#111827", outline: "none",
        background: "white", resize: "vertical", transition: "border 0.15s",
      }}
      onFocus={e => (e.target.style.border = "1.5px solid #3B82F6")}
      onBlur={e => (e.target.style.border = "1.5px solid #E5E7EB")}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder, labels }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "13px 40px 13px 16px",
          borderRadius: 10, border: "1.5px solid #E5E7EB",
          fontSize: 14, fontFamily: F,
          color: value ? "#111827" : "#9CA3AF",
          background: "white", appearance: "none",
          cursor: "pointer", outline: "none", boxSizing: "border-box",
        }}
        onFocus={e => (e.target.style.border = "1.5px solid #3B82F6")}
        onBlur={e => (e.target.style.border = "1.5px solid #E5E7EB")}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o, i) => <option key={o} value={o}>{labels && labels[i] !== undefined ? labels[i] : o}</option>)}
      </select>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <path d="M4 6l4 4 4-4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ChipBtn({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px", borderRadius: 8,
        border: `1.5px solid ${selected ? "#2563EB" : "#E5E7EB"}`,
        background: selected ? "#EFF6FF" : "white",
        color: selected ? "#2563EB" : "#374151",
        fontSize: 13, fontWeight: selected ? 700 : 500,
        cursor: "pointer", fontFamily: F, transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "#93C5FD"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "#E5E7EB"; }}
    >
      {label}
    </button>
  );
}

/* ── Step 1: 기본 정보 ─────────────────────────────────────────── */
const WORK_SCOPES = [
  { key: "planning",   label: "기획",        icon: kikhoekIcon },
  { key: "design",     label: "디자인",      icon: designIcon },
  { key: "publishing", label: "프론트 개발", icon: baepoIcon },
  { key: "dev",        label: "백엔드 개발", icon: devIcon },
];
const CATEGORIES = [
  { key: "web",       label: "웹",           desc: "반응형 웹, 관리자 페이지 등" },
  { key: "android",  label: "안드로이드",   desc: "Android 모바일 앱 개발" },
  { key: "ios",      label: "iOS",          desc: "iPhone, iPad 앱 개발" },
  { key: "pc",       label: "PC 프로그램",  desc: "Windows, macOS 설치형 프로그램" },
  { key: "embedded", label: "임베디드",     desc: "펌웨어, 하드웨어 연동 프로그램" },
  { key: "etc",      label: "기타",         desc: "그 외 분야 프로젝트" },
];

/* AI 채팅 유입 배너 - Step1 / FTStep1 상단에 노출 */
function AiChatEntryBanner({ onOpenAi }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  if (!onOpenAi) return null;
  return (
    <div style={{
      background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
      border: "1.5px solid #DBEAFE",
      borderRadius: 14,
      padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <img src={mascotIcon} alt="" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF", margin: "0 0 3px", fontFamily: F }}>{tr.aiBannerTitle}</p>
        <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F }}>{tr.aiBannerDesc}</p>
      </div>
      <button
        type="button"
        onClick={onOpenAi}
        style={{
          padding: "10px 20px", borderRadius: 999, border: "none",
          background: BLUE_GRAD,
          color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        {tr.aiBannerBtn}
      </button>
    </div>
  );
}

function Step1({ data, setData, onOpenAi }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const toggleScope = key => {
    const cur = data.scope || [];
    setData({ ...data, scope: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <AiChatEntryBanner onOpenAi={onOpenAi} />
      <div>
        <FieldLabel required>{tr.fieldTitle}</FieldLabel>
        <TextInput
          placeholder={tr.fieldTitlePh}
          value={data.title || ""}
          onChange={v => setData({ ...data, title: v })}
        />
      </div>
      <div>
        <FieldLabel required>{tr.fieldScope}</FieldLabel>
        <div style={{ display: "flex", gap: 16 }}>
          {tr.workScopes.map(({ key, label }) => {
            const icon = {planning:kikhoekIcon,design:designIcon,publishing:baepoIcon,dev:devIcon}[key];
            const selected = (data.scope || []).includes(key);
            return (
              <div
                key={key}
                onClick={() => toggleScope(key)}
                style={{
                  flex: 1, position: "relative",
                  padding: "28px 16px 22px",
                  borderRadius: 14,
                  border: `2px solid ${selected ? "#2563EB" : "#E5E7EB"}`,
                  background: selected ? "#EFF6FF" : "white",
                  cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 12,
                  transition: "all 0.15s",
                  boxShadow: selected ? "0 2px 12px rgba(37,99,235,0.12)" : "none",
                }}
                onMouseEnter={e => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#93C5FD";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(147,197,253,0.3)";
                  }
                }}
                onMouseLeave={e => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${selected ? "#2563EB" : "#D1D5DB"}`,
                  background: selected ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {selected && <Check size={11} color="white" strokeWidth={3} />}
                </div>
                <img src={icon} alt={label} style={{ width: 76, height: 76, objectFit: "contain" }} />
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: selected ? "#2563EB" : "#374151",
                  fontFamily: F,
                }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.fieldCategory}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tr.categories.map(({ key, label, desc }) => {
            const sel = (data.categories || []).includes(key);
            return (
              <div
                key={key}
                onClick={() => {
                  const cur = data.categories || [];
                  setData({ ...data, categories: sel ? cur.filter(k => k !== key) : [...cur, key] });
                }}
                style={{
                  padding: "14px 18px", borderRadius: 10,
                  border: `1.5px solid ${sel ? "#2563EB" : "#E5E7EB"}`,
                  background: sel ? "#EFF6FF" : "white",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.15s",
                  boxShadow: sel ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
                }}
                onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F8FBFF"; } }}
                onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; } }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: sel ? "#1D4ED8" : "#111827", margin: "0 0 2px", fontFamily: F }}>{label}</p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F }}>{desc}</p>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginLeft: 12,
                  border: `2px solid ${sel ? "#2563EB" : "#D1D5DB"}`,
                  background: sel ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {sel && <Check size={11} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: 준비 상태 ─────────────────────────────────────── */
const PROJECT_TYPES = [
  {
    key: "new",
    icon: (
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EEF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      </div>
    ),
    label: "신규 프로젝트를 진행하려 합니다",
    desc: "새로운 비즈니스 아이디어를 바탕으로 처음부터 구축하는 프로젝트입니다.",
  },
  {
    key: "maintain",
    icon: (
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFF7ED", border: "1.5px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </div>
    ),
    label: "운영 중인 서비스의 유지보수 또는 리뉴얼을 하려합니다",
    desc: "현재 운영 중인 시스템의 기능을 추가하거나 디자인을 개편하려 합니다.",
  },
];

const READY_STATUS = [
  {
    key: "idea",
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FFFBEB", border: "1.5px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/><circle cx="12" cy="12" r="4"/></svg>
      </div>
    ),
    label: "아이디어만 있음",
    desc: "대략적인 컨셉만 있으며 구체화된 문서가 없는 초기 단계입니다.",
  },
  {
    key: "doc",
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EEF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
    ),
    label: "기획서/문서 있음",
    desc: "요구사항 정의서나 기능 명세서 등 구체적인 기획 문서가 준비되어 있습니다.",
  },
  {
    key: "design",
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FDF4FF", border: "1.5px solid #E9D5FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
      </div>
    ),
    label: "상세 설계 완료",
    desc: "와이어프레임 또는 UI/UX 디자인이 완료되어 바로 개발 가능한 상태입니다.",
  },
  {
    key: "code",
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F0FDF4", border: "1.5px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      </div>
    ),
    label: "기존 코드/유지보수",
    desc: "이미 서비스 중인 제품의 고도화 또는 유지보수 작업이 필요합니다.",
  },
];

function SelectCard({ item, selected, onClick, single }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "18px 20px", borderRadius: 12,
        border: `1.5px solid ${selected ? "#2563EB" : "#E5E7EB"}`,
        background: selected ? "#EFF6FF" : "white",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 16,
        transition: "all 0.15s",
        boxShadow: selected ? "0 2px 12px rgba(37,99,235,0.12)" : "none",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F8FBFF"; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; } }}
    >
      {item.icon}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: selected ? "#1D4ED8" : "#111827", margin: "0 0 3px", fontFamily: F }}>{item.label}</p>
        <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F, lineHeight: 1.6 }}>{item.desc}</p>
      </div>
      {/* 체크/라디오 아이콘 */}
      <div style={{
        width: 22, height: 22, flexShrink: 0,
        borderRadius: single ? "50%" : 5,
        border: `2px solid ${selected ? "#2563EB" : "#D1D5DB"}`,
        background: selected ? "#2563EB" : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {selected && <Check size={12} color="white" strokeWidth={3} />}
      </div>
    </div>
  );
}

function Step2({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFile = (file) => {
    if (file) setUploadedFile(file);
  };

  const PROJECT_TYPES_L = PROJECT_TYPES.map(p => ({
    ...p,
    label: p.key === "new"      ? tr.s2_typeNew     : tr.s2_typeMaint,
    desc:  p.key === "new"      ? tr.s2_typeNewDesc : tr.s2_typeMaintDesc,
  }));
  const READY_STATUS_L = READY_STATUS.map(r => ({
    ...r,
    label: ({ idea: tr.s2_readyIdea, doc: tr.s2_readyDoc, design: tr.s2_readyDesign, code: tr.s2_readyCode })[r.key] || r.label,
    desc:  ({ idea: tr.s2_readyIdeaDesc, doc: tr.s2_readyDocDesc, design: tr.s2_readyDesignDesc, code: tr.s2_readyCodeDesc })[r.key] || r.desc,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 프로젝트 진행 분류 */}
      <div>
        <FieldLabel required>{tr.s2_progressType}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {PROJECT_TYPES_L.map(item => (
            <SelectCard
              key={item.key}
              item={item}
              single
              selected={data.projectType2 === item.key}
              onClick={() => setData({ ...data, projectType2: data.projectType2 === item.key ? "" : item.key })}
            />
          ))}
        </div>
      </div>

      {/* 현재 준비 상태 */}
      <div>
        <FieldLabel required>{tr.s2_readiness}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {READY_STATUS_L.map(item => {
            const sel = (data.readyStatus || []).includes(item.key);
            return (
              <SelectCard
                key={item.key}
                item={item}
                single={false}
                selected={sel}
                onClick={() => {
                  const cur = data.readyStatus || [];
                  setData({ ...data, readyStatus: sel ? cur.filter(k => k !== item.key) : [...cur, item.key] });
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 참고 자료 첨부 */}
      <div>
        <FieldLabel>{tr.s2_attach}</FieldLabel>
        <div
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? "#3B82F6" : "#D1D5DB"}`,
            borderRadius: 12,
            background: dragging ? "#EFF6FF" : "#FAFAFA",
            padding: "44px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="12" y2="12"/>
            <line x1="15" y1="15" x2="12" y2="12"/>
          </svg>
          {uploadedFile
            ? <p style={{ fontSize: 14, fontWeight: 600, color: "#2563EB", margin: 0, fontFamily: F }}>✅ {uploadedFile.name}</p>
            : <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0, fontFamily: F }}>{tr.s2_dragHint}</p>
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontFamily: F }}>{tr.s2_maxSize}</p>
              </>
          }
          <input ref={fileRef} type="file" accept=".pdf,.pptx,.docx,.zip" style={{ display: "none" }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      </div>

      {/* 자료 공개 범위 설정 */}
      <div>
        <FieldLabel>{tr.s2_visibility}</FieldLabel>
        <SelectInput
          value={data.visibility || "파트너에게만 공개"}
          onChange={v => setData({ ...data, visibility: v })}
          options={["전체 공개", "파트너에게만 공개", "비공개"]}
          labels={[tr.s2_visAll, tr.s2_visPartner, tr.s2_visPrivate]}
        />
      </div>
    </div>
  );
}

/* ── Step 3: 기획 상세 내용 ────────────────────────────── */
const RECOMMENDED_FIELDS = [
  "웹 서비스", "모바일 앱", "AI/데이터", "블록체인", "임베디드",
  "gen AI", "chatGPT챗봇", "자사몰 구축", "퍼블리싱", "기술자문",
  "데이터분석BI", "ERP", "CRM", "SaaS", "매칭 플랫폼", "기타",
];

const FIELD_CATEGORIES = [
  {
    id: "it_service", label: "IT 서비스 구축",
    items: [
      "중개·매칭 플랫폼", "SaaS·솔루션", "가상화폐·거래소",
      "그래픽·미디어", "VR·AR·MR", "커뮤니티·SNS",
      "POS·키오스크", "관제·모니터링", "IoT·블루투스",
      "LMS·강의 플랫폼", "병원·헬스케어", "통계·대시보드",
      "게임·리워드", "기타(IT 서비스 구축)",
    ],
  },
  {
    id: "internal", label: "내부 업무시스템",
    items: [
      "CRM 고객관리", "ERP 전사자원관리", "데이터 분석·BI",
      "SCM 공급망관리", "통합물류시스템", "재고·창고·PDA",
      "GW(그룹웨어)", "PMS Project 관리", "PPS 생산계획관리",
      "업무자동화·RPA", "엑셀 VBA·매크로", "스크래핑·API",
      "기타(내부 시스템)",
    ],
  },
  {
    id: "ai_ml", label: "AI·머신러닝",
    items: [
      "Gen AI 서비스", "ChatGPT·챗봇", "LLM 구축",
      "AI 모델 구축", "머신러닝·딥러닝", "기타(AI·머신러닝)",
    ],
  },
  {
    id: "commerce", label: "커머스·쇼핑몰",
    items: [
      "자사몰 구축", "입점몰 구축", "오픈마켓 연동",
      "커머스 이전·확장", "모바일 커머스", "라이브 커머스",
      "내부 시스템 연동", "솔루션 최적화", "기타(커머스·쇼핑몰)",
    ],
  },
  {
    id: "website", label: "웹사이트 제작",
    items: [
      "홈페이지·게시판", "퍼블리싱·반응형", "랜딩·소개 페이지",
      "마케팅 페이지", "워드프레스 구축", "기타(웹사이트 구축)",
    ],
  },
  {
    id: "cloud", label: "클라우드 도입",
    items: [
      "CSP 인프라 이전", "데이터 이전", "Cloud 앱 최적화",
      "아키텍처 컨설팅", "기타(클라우드)",
    ],
  },
  {
    id: "consulting", label: "컨설팅·PMO",
    items: [
      "기술 자문·가이드", "프로젝트 관리", "인증·자격 컨설팅",
      "BI·DA 데이터", "ISP 정보화 전략", "PI 프로세스 혁신",
      "DX 디지털 전환", "AX AI 접목·전환", "기타(컨설팅·PMO)",
    ],
  },
  {
    id: "maintenance", label: "유지보수·운영",
    items: [
      "커머스·쇼핑몰 운영", "네트워크·서버 운영", "내부 시스템 운영",
      "클라우드 인프라 운영", "기타(유지보수·운영)",
    ],
  },
  {
    id: "etc", label: "기타",
    items: ["기획서·제안서 등", "그래픽·영상 등", "기타"],
  },
];

// AI 채팅 상수 & 헬퍼
const AI_BOT_INTRO = `안녕하세요! 저는 프로젝트 등록을 도와드리는 AI 매니저예요 🐣\n\n아래 내용을 알려주시면 프로젝트 상세 내용을 자동으로 정리해 드릴게요:\n\n1. **어떤 서비스**를 만들고 싶으신가요?\n2. **주요 기능**은 무엇인가요?\n3. **사용자 대상**은 누구인가요?\n4. **예상 규모**나 특별 요구사항이 있으신가요?\n\n자유롭게 말씀해 주세요!`;
const AI_QUICK_PROMPTS = [
  "모바일 쇼핑몰 앱을 만들고 싶어요",
  "사내 인사관리 시스템이 필요해요",
  "AI 챗봇을 홈페이지에 붙이고 싶어요",
  "기존 ERP 시스템을 개선하고 싶어요",
];
function aiFormatText(text) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}
function _aiGenerateReply(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes("쇼핑") || lower.includes("커머스") || lower.includes("몰")) {
    return `쇼핑몰 프로젝트군요! 아래 내용을 정리해 드릴게요 ✍️\n\n**프로젝트 개요:** 상품 판매 및 결제 기능을 갖춘 쇼핑몰 플랫폼 구축\n**주요 기능:** 상품 등록/관리, 장바구니, 결제 연동(PG사), 주문/배송 관리, 회원 관리\n**기술 스택 추천:** React, Node.js, MySQL, AWS\n\n더 구체적인 기능이 있으시면 말씀해 주세요!`;
  }
  if (lower.includes("ai") || lower.includes("챗봇") || lower.includes("gpt")) {
    return `AI/챗봇 프로젝트네요! 💡\n\n**프로젝트 개요:** AI 기반 챗봇 서비스 개발 및 기존 서비스 연동\n**주요 기능:** 자연어 처리, 질의응답, FAQ 자동 응답, 관리자 대시보드\n**기술 스택 추천:** Python, FastAPI, OpenAI API, React\n\n예상 사용자 수나 연동이 필요한 시스템이 있으신가요?`;
  }
  if (lower.includes("erp") || lower.includes("인사") || lower.includes("시스템") || lower.includes("사내")) {
    return `기업 내부 시스템 프로젝트네요! 🏢\n\n**프로젝트 개요:** 사내 업무 효율화를 위한 시스템 구축/개선\n**주요 기능:** 인사/급여 관리, 결재 워크플로우, 보고서 자동화, 권한 관리\n**기술 스택 추천:** Java Spring, Oracle DB, Vue.js\n\n현재 사용 중인 시스템이나 연동이 필요한 솔루션이 있으신가요?`;
  }
  return `말씀해 주신 내용을 기반으로 프로젝트를 정리해 볼게요! 📝\n\n더 구체적인 내용을 알려주시면 더 정확한 프로젝트 명세서를 작성해 드릴 수 있어요.\n\n- 주요 기능이 무엇인가요?\n- 예상 사용자 규모는 어느 정도인가요?\n- 특별히 필요한 기술이나 연동 서비스가 있나요?`;
}

function FieldSelectModal({ selected, onClose, onConfirm }) {
  const { lang } = useLanguage();
  const [draft, setDraft] = React.useState(selected || []);
  const [activeCat, setActiveCat] = React.useState("it_service");
  const catRefs = React.useRef({});
  const scrollRef = React.useRef(null);
  const [showAiChat, setShowAiChat] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState([{ role: "bot", text: AI_BOT_INTRO, time: new Date() }]);
  const [chatInput, setChatInput] = React.useState("");
  const [chatTyping, setChatTyping] = React.useState(false);
  const chatBottomRef = React.useRef(null);

  React.useEffect(() => {
    if (showAiChat) chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatTyping, showAiChat]);

  const chatSend = async (text) => {
    const msg = (text !== undefined ? text : chatInput).trim();
    if (!msg) return;
    setChatInput("");
    const userMsg = { role: "user", text: msg, time: new Date() };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatTyping(true);
    try {
      const history = nextMessages.filter(
        (m) => !(m.role === "bot" && m.text === AI_BOT_INTRO)
      );
      const reply = await chatWithAI(history, PROJECT_REGISTER_AI_PROMPT + "\n" + langInstruction(lang));
      setChatMessages((prev) => [...prev, { role: "bot", text: reply, time: new Date() }]);
    } catch (err) {
      console.error("[ProjectRegister AI] 실패:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "bot", text: `죄송해요, 응답 중 오류가 발생했어요 🙇 (${err.message})`, time: new Date() },
      ]);
    } finally {
      setChatTyping(false);
    }
  };

  // 스크롤 연동: 오른쪽 콘텐츠 스크롤 시 activeCat 자동 변경
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let closestId = null;
      let closestDist = Infinity;
      Object.entries(catRefs.current).forEach(([id, el]) => {
        if (!el) return;
        const dist = Math.abs(el.getBoundingClientRect().top - containerTop - 40);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });
      if (closestId) setActiveCat(closestId);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const toggle = (item) => {
    if (draft.includes(item)) {
      setDraft(draft.filter(v => v !== item));
    } else if (draft.length < 3) {
      setDraft([...draft, item]);
    }
  };

  const scrollToCat = (id) => {
    setActiveCat(id);
    const el = catRefs.current[id];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.48)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        position: "relative",
        background: "white", borderRadius: 20,
        width: 860, maxWidth: "95vw", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}>
        {/* 헤더 */}
        <div style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#111827", fontFamily: F }}>
            분야를 선택해 주세요.
            <span style={{ fontSize: 14, fontWeight: 500, color: "#9CA3AF", marginLeft: 8 }}>(최대 3개)</span>
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#9CA3AF", fontSize: 20, lineHeight: 1, padding: 4,
            transition: "color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#374151"}
            onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
          >✕</button>
        </div>

        {/* AI 배너 */}
        <div style={{
          margin: "12px 20px 0",
          background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
          border: "1.5px solid #DBEAFE", borderRadius: 12,
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0,
        }}>
          <img
            src={meetingIcon}
            alt="AI 매니저"
            style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }}
          />
          <span style={{ flex: 1, fontSize: 13, color: "#374151", fontFamily: F }}>
            AI가 30초 만에 딱 맞는 분야를 찾아드려요.
          </span>
          <button
            onClick={() => setShowAiChat(true)}
            style={{
            padding: "7px 16px", borderRadius: 999, border: "none",
            background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
            color: "white", fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
          }}>AI에게 딱 맞는 분야 물어보기</button>
        </div>

        {/* 본문: 사이드바 + 콘텐츠 */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", marginTop: 12 }}>
          {/* 왼쪽 사이드바 */}
          <div style={{
            width: 160, flexShrink: 0,
            borderRight: "1px solid #F1F5F9",
            overflowY: "auto", padding: "4px 0",
          }}>
            {FIELD_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => scrollToCat(cat.id)} style={{
                display: "block", width: "100%",
                padding: "10px 20px", textAlign: "left",
                background: activeCat === cat.id ? "#EFF6FF" : "none",
                border: "none",
                borderLeft: activeCat === cat.id ? "3px solid #3B82F6" : "3px solid transparent",
                color: activeCat === cat.id ? "#2563EB" : "#6B7280",
                fontSize: 13, fontWeight: activeCat === cat.id ? 700 : 400,
                cursor: "pointer", fontFamily: F,
                transition: "all 0.15s",
              }}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* 오른쪽 스크롤 콘텐츠 */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
            {FIELD_CATEGORIES.map(cat => (
              <div key={cat.id} ref={el => catRefs.current[cat.id] = el} style={{ marginBottom: 32, paddingTop: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 16px", fontFamily: F }}>
                  {cat.label}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 16px" }}>
                  {cat.items.map(item => {
                    const checked = draft.includes(item);
                    const maxed = draft.length >= 3 && !checked;
                    return (
                      <label key={item} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        cursor: maxed ? "default" : "pointer",
                        opacity: maxed ? 0.45 : 1,
                      }}>
                        <div
                          onClick={() => !maxed && toggle(item)}
                          style={{
                            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                            border: `2px solid ${checked ? "#3B82F6" : "#D1D5DB"}`,
                            background: checked ? "#3B82F6" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span
                          onClick={() => !maxed && toggle(item)}
                          style={{ fontSize: 13, color: "#374151", fontFamily: F, userSelect: "none" }}
                        >{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid #F1F5F9",
          display: "flex", justifyContent: "flex-end", gap: 10,
          flexShrink: 0, background: "white",
        }}>
          {draft.length > 0 && (
            <span style={{ flex: 1, fontSize: 13, color: "#6B7280", fontFamily: F, alignSelf: "center" }}>
              {draft.length}개 선택됨: {draft.join(", ")}
            </span>
          )}
          <button onClick={onClose} style={{
            padding: "9px 24px", borderRadius: 999,
            border: "1.5px solid #D1D5DB", background: "white",
            color: "#374151", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F,
          }}>닫기</button>
          <button onClick={() => onConfirm(draft)} style={{
            padding: "9px 24px", borderRadius: 999, border: "none",
            background: "#DBEAFE",
            color: "#1e3a5f", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F,
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#BFDBFE"}
            onMouseLeave={e => e.currentTarget.style.background = "#DBEAFE"}
          >선택하기</button>
        </div>

        {/* AI 채팅 오버레이 */}
        {showAiChat && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "white", borderRadius: 20,
            display: "flex", flexDirection: "column",
          }}>
            {/* 채팅 헤더 */}
            <div style={{
              padding: "14px 20px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex", alignItems: "center", gap: 12,
              flexShrink: 0,
            }}>
              <button onClick={() => setShowAiChat(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#6B7280", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 8, fontFamily: F,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                분야 선택으로 돌아가기
              </button>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0, fontFamily: F }}>AI 매니저</p>
                  <p style={{ fontSize: 11, color: "#22C55E", margin: 0, fontFamily: F }}>● 온라인</p>
                </div>
              </div>
              <button onClick={onClose} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#9CA3AF", fontSize: 20, lineHeight: 1, padding: 4, transition: "color 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.color = "#374151"}
                onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
              >✕</button>
            </div>

            {/* 메시지 목록 */}
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "20px 24px",
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 10, alignItems: "flex-end",
                }}>
                  {msg.role === "bot" && (
                    <img src={mascotIcon} alt="bot" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
                  )}
                  <div style={{
                    maxWidth: "70%", padding: "12px 16px",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)"
                      : "#F8FAFC",
                    border: msg.role === "bot" ? "1px solid #E5E7EB" : "none",
                    color: msg.role === "user" ? "white" : "#111827",
                    fontSize: 14, fontFamily: F, lineHeight: 1.7,
                    boxShadow: msg.role === "user" ? "0 2px 10px rgba(99,102,241,0.25)" : "none",
                  }}>
                    {aiFormatText(msg.text)}
                    <p style={{
                      fontSize: 10, margin: "6px 0 0",
                      color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                      textAlign: "right",
                    }}>
                      {msg.time.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              {chatTyping && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <img src={mascotIcon} alt="bot" style={{ width: 32, height: 32, objectFit: "contain" }} />
                  <div style={{
                    padding: "12px 18px", borderRadius: "4px 18px 18px 18px",
                    background: "#F8FAFC", border: "1px solid #E5E7EB",
                    display: "flex", gap: 5, alignItems: "center",
                  }}>
                    <style>{`@keyframes td2{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: "50%", background: "#94A3B8",
                        animation: `td2 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* 빠른 질문 */}
            {chatMessages.length <= 1 && (
              <div style={{ padding: "0 24px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AI_QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => chatSend(p)} style={{
                    padding: "7px 14px", borderRadius: 999,
                    border: "1.5px solid #DBEAFE", background: "#EFF6FF",
                    color: "#2563EB", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
                    onMouseLeave={e => e.currentTarget.style.background = "#EFF6FF"}
                  >{p}</button>
                ))}
              </div>
            )}

            {/* 입력창 */}
            <div style={{
              padding: "12px 20px 16px",
              borderTop: "1px solid #F1F5F9",
              display: "flex", gap: 10, flexShrink: 0,
            }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    if (e.nativeEvent.isComposing) return;
                    chatSend();
                  }
                }}
                placeholder="프로젝트에 대해 자유롭게 말씀해 주세요..."
                style={{
                  flex: 1, padding: "12px 18px", borderRadius: 999,
                  border: "1.5px solid #E5E7EB", outline: "none",
                  fontSize: 14, fontFamily: F, color: "#111827",
                  transition: "border 0.15s",
                }}
                onFocus={e => e.target.style.border = "1.5px solid #93C5FD"}
                onBlur={e => e.target.style.border = "1.5px solid #E5E7EB"}
              />
              <button
                onClick={() => chatSend()}
                disabled={!chatInput.trim()}
                style={{
                  width: 46, height: 46, borderRadius: "50%", border: "none",
                  background: chatInput.trim()
                    ? "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)"
                    : "#E5E7EB",
                  cursor: chatInput.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s",
                  boxShadow: chatInput.trim() ? "0 2px 10px rgba(99,102,241,0.30)" : "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step3({ data, setData, onOpenAi }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const [techInput, setTechInput] = useState("");
  const [fieldModal, setFieldModal] = useState(false);

  const toggleField = (val) => {
    const cur = data.fields || [];
    if (cur.includes(val)) {
      setData({ ...data, fields: cur.filter(v => v !== val) });
    } else if (cur.length < 3) {
      setData({ ...data, fields: [...cur, val] });
    }
  };

  const addTech = (val) => {
    const trim = val.trim();
    if (!trim) return;
    const cur = data.techTags || [];
    if (!cur.includes(trim)) setData({ ...data, techTags: [...cur, trim] });
    setTechInput("");
  };

  const removeTech = (val) => {
    setData({ ...data, techTags: (data.techTags || []).filter(t => t !== val) });
  };

  const charCount = (data.detailContent || "").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* 분야 선택 모달 */}
      {fieldModal && (
        <FieldSelectModal
          selected={data.fields || []}
          onClose={() => setFieldModal(false)}
          onConfirm={(selected) => {
            setData({ ...data, fields: selected });
            setFieldModal(false);
          }}
        />
      )}

      {/* AI 배너 */}
      <div style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
        border: "1.5px solid #DBEAFE",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <img src={mascotIcon} alt="AI 매니저" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF", margin: "0 0 3px", fontFamily: F }}>{tr.s3_aiTitle}</p>
          <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F }}>{tr.s3_aiDesc}</p>
        </div>
        <button
          onClick={onOpenAi}
          style={{
            padding: "10px 20px", borderRadius: 999, border: "none",
            background: BLUE_GRAD,
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          {tr.s3_aiBtn}
        </button>
      </div>

      {/* 프로젝트 분야 */}
      <div>
        <FieldLabel required>{tr.s3_field}</FieldLabel>
        <div
          onClick={() => setFieldModal(true)}
          style={{
            padding: "16px 20px", borderRadius: 12,
            border: "1.5px solid #E5E7EB", background: "#F8FAFC",
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", transition: "border 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#93C5FD"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}
        >
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </div>
          <span style={{ flex: 1, fontSize: 14, color: (data.fields || []).length > 0 ? "#111827" : "#9CA3AF", fontFamily: F }}>
            {(data.fields || []).length > 0 ? (data.fields || []).join(", ") : tr.s3_fieldPh}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      {/* 추천 분야 칩 */}
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 10px", fontFamily: F }}>
          {tr.s3_recommend}
          <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 400, marginLeft: 6 }}>{tr.s3_max3}</span>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {RECOMMENDED_FIELDS.map(val => {
            const sel = (data.fields || []).includes(val);
            const maxed = (data.fields || []).length >= 3 && !sel;
            return (
              <button
                key={val}
                onClick={() => toggleField(val)}
                disabled={maxed}
                style={{
                  padding: "8px 18px", borderRadius: 999,
                  border: `1.5px solid ${sel ? "#2563EB" : "#D1D5DB"}`,
                  background: sel ? "#EFF6FF" : "white",
                  color: sel ? "#1D4ED8" : maxed ? "#C4C4C4" : "#374151",
                  fontSize: 13, fontWeight: sel ? 700 : 500,
                  cursor: maxed ? "default" : "pointer", fontFamily: F,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!sel && !maxed) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F0F7FF"; } }}
                onMouseLeave={e => { if (!sel && !maxed) { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "white"; } }}
              >{val}</button>
            );
          })}
        </div>
      </div>

      {/* 상세 업무 내용 */}
      <div>
        <FieldLabel required>{tr.s3_detail}</FieldLabel>
        <textarea
          placeholder={tr.s3_detailPh}
          value={data.detailContent || ""}
          maxLength={5000}
          onChange={e => setData({ ...data, detailContent: e.target.value })}
          rows={10}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "16px", borderRadius: 12,
            border: "1.5px solid #E5E7EB",
            fontSize: 14, fontFamily: F, color: "#111827",
            lineHeight: 1.8, outline: "none",
            background: "#FAFAFA", resize: "vertical",
            transition: "border 0.15s",
          }}
          onFocus={e => e.target.style.border = "1.5px solid #3B82F6"}
          onBlur={e => e.target.style.border = "1.5px solid #E5E7EB"}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "#9CA3AF", fontFamily: F }}>{tr.s3_charLimit}</span>
          <span style={{ fontSize: 12, color: charCount > 4500 ? "#EF4444" : "#9CA3AF", fontFamily: F }}>{charCount}/5000</span>
        </div>
      </div>

      {/* 관련 기술 */}
      <div>
        <FieldLabel required>{tr.s3_tech}</FieldLabel>
        {/* 태그 목록 */}
        {(data.techTags || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {(data.techTags || []).map(tag => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 999,
                border: "1.5px solid #BFDBFE", background: "#EFF6FF",
                fontSize: 13, fontWeight: 600, color: "#1D4ED8", fontFamily: F,
              }}>
                {tag}
                <span
                  onClick={() => removeTech(tag)}
                  style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, color: "#60A5FA" }}
                >×</span>
              </span>
            ))}
          </div>
        )}
        {/* 검색 입력 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 10,
          border: "1.5px solid #E5E7EB", background: "white",
          transition: "border 0.15s",
        }}
          onFocus={() => {}}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder={tr.s3_techPh}
            value={techInput}
            onChange={e => setTechInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                addTech(techInput);
              }
            }}
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 13, fontFamily: F, color: "#374151", background: "transparent",
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "6px 0 0", fontFamily: F }}>{tr.s3_techHint}</p>
      </div>
    </div>
  );
}

/* ── Mini Calendar (Step4용) ──────────────────────────────── */
function MiniCalendar({ value, onChange, onClose, koreanDays }) {
  const today = new Date();
  const sel = value ? new Date(value) : null;
  const [viewYear, setViewYear] = React.useState(sel ? sel.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(sel ? sel.getMonth() : today.getMonth());
  const [tempSel, setTempSel] = React.useState(sel);
  const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const DAYS = koreanDays ? ["일","월","화","수","목","금","토"] : ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: daysInPrev - firstDay + 1 + i, type: "prev" });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, type: "cur" });
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, type: "next" });
  return (
    <div style={{
      background: "white", borderRadius: 16,
      boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
      padding: "20px 18px 16px", width: 320,
      border: "1px solid #E5E7EB",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", fontFamily: F }}>{viewYear}년 {MONTHS[viewMonth]}</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: koreanDays && i === 0 ? "#EF4444" : "#9CA3AF", fontFamily: F, padding: "4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell, i) => {
          const isSun = i % 7 === 0;
          const isToday = cell.type === "cur" && cell.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          const isSel = tempSel && cell.type === "cur" && cell.day === tempSel.getDate() && viewMonth === tempSel.getMonth() && viewYear === tempSel.getFullYear();
          return (
            <button key={i}
              onClick={() => { if (cell.type === "cur") setTempSel(new Date(viewYear, viewMonth, cell.day)); }}
              style={{
                textAlign: "center", padding: "7px 0", fontSize: 13, fontFamily: F,
                color: cell.type !== "cur" ? "#D1D5DB" : isSel ? "white" : isToday ? "#3B82F6" : koreanDays && isSun ? "#EF4444" : "#374151",
                fontWeight: isSel || isToday ? 700 : 400,
                background: isSel ? "#3B82F6" : "transparent",
                borderRadius: 999, border: "none",
                cursor: cell.type === "cur" ? "pointer" : "default",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (cell.type === "cur" && !isSel) e.currentTarget.style.background = "#EFF6FF"; }}
              onMouseLeave={e => { if (cell.type === "cur" && !isSel) e.currentTarget.style.background = "transparent"; }}
            >{cell.day}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
        <button onClick={onClose} style={{ padding: "8px 22px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "white", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: F }}>취소</button>
        <button
          onClick={() => {
            if (tempSel) {
              const y = tempSel.getFullYear();
              const m = String(tempSel.getMonth() + 1).padStart(2, "0");
              const d = String(tempSel.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
            }
            onClose();
          }}
          style={{ padding: "8px 22px", borderRadius: 8, border: "none", background: BLUE_GRAD, fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", fontFamily: F }}
        >확인</button>
      </div>
    </div>
  );
}

/* ── Step 4: 예산 및 인원 구성 ───────────────────────────── */
function Step4({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const formatBudget = val => {
    const num = val.replace(/[^0-9]/g, "");
    return num ? Number(num).toLocaleString("ko-KR") : "";
  };

  const koreanBudget = val => {
    // val 은 원 단위 (예: 5000000 → "500만원")
    const won = Number(String(val || "").replace(/[^0-9]/g, ""));
    if (!won) return "";
    const eok = Math.floor(won / 100_000_000);
    const man = Math.floor((won % 100_000_000) / 10_000);
    const rest = won % 10_000;
    const parts = [];
    if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
    if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
    if (rest) parts.push(`${rest.toLocaleString("ko-KR")}`);
    return parts.join(" ") + "원";
  };

  const setCount = (key, val) => {
    const num = Math.max(0, Number(val) || 0);
    setData({ ...data, collab: { ...(data.collab || {}), [key]: num } });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* 지출 가능 예산 */}
      <div>
        <FieldLabel required>{tr.s4_budget}</FieldLabel>
        <div style={{
          display: "flex", alignItems: "center",
          border: `1.5px solid ${data.partnerFreeProject ? "#E5E7EB" : "#E5E7EB"}`, borderRadius: 12,
          overflow: "hidden", background: data.partnerFreeProject ? "#F3F4F6" : "white", transition: "border 0.15s",
        }}
          onFocusCapture={e => { if (!data.partnerFreeProject) e.currentTarget.style.border = "1.5px solid #3B82F6"; }}
          onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
        >
          <input
            type="text"
            placeholder="0"
            value={data.partnerFreeProject ? "0" : (data.budgetAmount || "")}
            readOnly={!!data.partnerFreeProject}
            onChange={e => { if (!data.partnerFreeProject) setData({ ...data, budgetAmount: formatBudget(e.target.value) }); }}
            style={{
              flex: 1, border: "none", outline: "none",
              padding: "16px 20px", fontSize: 20, fontWeight: 700,
              fontFamily: F, color: data.partnerFreeProject ? "#9CA3AF" : "#111827", background: "transparent",
              textAlign: "right", cursor: data.partnerFreeProject ? "not-allowed" : "text",
            }}
          />
          <span style={{ padding: "0 20px", fontSize: 16, fontWeight: 600, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB" }}>{tr.s4_won}</span>
        </div>
        {data.partnerFreeProject ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 12, color: "#7C3AED", fontFamily: F }}>{tr.s4_freeNote}</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, color: "#64748B", fontFamily: F }}>{tr.s4_budgetHint}</span>
            </div>
            {koreanBudget(data.budgetAmount) && (
              <span style={{ fontSize: 13, color: "#3B82F6", fontWeight: 700, fontFamily: F }}>
                = {koreanBudget(data.budgetAmount)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 협업 인력 구성 */}
      <div>
        <FieldLabel>{tr.s4_collab}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {COLLAB_ROLES.map(({ key, label, icon }) => {
            const cnt = (data.collab || {})[key] || 0;
            const active = cnt > 0;
            const localLabel = ({ planning: tr.s4_role_planning, design: tr.s4_role_design, publishing: tr.s4_role_publishing, dev: tr.s4_role_dev })[key] || label;
            return (
              <div key={key} style={{
                borderRadius: 14, padding: "16px 16px 14px",
                border: `2px solid ${active ? "#2563EB" : "#E5E7EB"}`,
                background: active ? "#EFF6FF" : "white",
                transition: "all 0.15s",
                display: "flex", flexDirection: "column", gap: 10, position: "relative",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <img src={icon} alt={label} style={{ width: 42, height: 42, objectFit: "contain" }} />
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${active ? "#2563EB" : "#D1D5DB"}`, background: active ? "#2563EB" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <Check size={10} color="white" strokeWidth={3} />}
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: active ? "#1D4ED8" : "#374151", margin: 0, fontFamily: F }}>{localLabel}</p>
                <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${active ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: 8, overflow: "hidden", background: "white" }}>
                  <input
                    type="number" min="0"
                    value={cnt === 0 ? "" : cnt}
                    placeholder="0"
                    onChange={e => setCount(key, e.target.value)}
                    style={{ flex: 1, border: "none", outline: "none", padding: "10px 12px", fontSize: 16, fontWeight: 700, fontFamily: F, color: "#111827", background: "transparent", width: 0 }}
                  />
                  <span style={{ padding: "0 12px", fontSize: 13, color: "#6B7280", borderLeft: `1px solid ${active ? "#BFDBFE" : "#E5E7EB"}`, fontFamily: F }}>{tr.s4_persons}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

/* ── Step 5: 미팅 및 예상일정 ──────────────────────────────── */
function Step5({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const [showCal, setShowCal] = React.useState(false);
  const calRef = useRef(null);

  React.useEffect(() => {
    const handler = e => { if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false); };
    if (showCal) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCal]);

  const durationDays = data.durationMonths ? Math.round(Number(data.durationMonths) * 30) : null;
  const startType = data.startDateType || "negotiable";

  const setSingle = (field, val) =>
    setData({ ...data, [field]: val === data[field] ? "" : val });
  const toggleMulti = (field, val) => {
    const cur = data[field] || [];
    setData({ ...data, [field]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <FieldLabel required>{tr.s5_meetType}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["온라인 (화상)", "오프라인 (대면)", "둘 다 가능", "미팅 불필요"].map((o, i) => (
            <ChipBtn key={o} label={tr.s5_meetingTypes[i]} selected={data.meetingType === o}
              onClick={() => setSingle("meetingType", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>{tr.s5_meetFreq}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["주 1회", "주 2~3회", "필요 시만", "정기 스탠드업"].map((o, i) => (
            <ChipBtn key={o} label={tr.s5_meetingFreqs[i]} selected={data.meetingFreq === o}
              onClick={() => setSingle("meetingFreq", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>{tr.s5_tools}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Zoom", "Google Meet", "Teams", "Slack", "Discord", "카카오톡"].map((o, i) => (
            <ChipBtn key={o} label={tr.s5_meetingTools[i]} selected={(data.meetingTools || []).includes(o)}
              onClick={() => toggleMulti("meetingTools", o)} />
          ))}
        </div>
      </div>

      {/* 예상 시작일 */}
      <div>
        <FieldLabel required>{tr.s5_startDate}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, position: "relative" }}>
          {[
            { key: "negotiable", title: tr.s5_negTitle,  sub: tr.s5_negSub },
            { key: "specific",   title: tr.s5_specTitle, sub: tr.s5_specSub },
          ].map(({ key, title, sub }) => {
            const sel = startType === key;
            return (
              <div
                key={key}
                onClick={() => {
                  setData({ ...data, startDateType: key });
                  if (key === "specific") setShowCal(true);
                  else setShowCal(false);
                }}
                style={{
                  padding: "20px 44px 18px 18px", borderRadius: 14,
                  border: `2px solid ${sel ? "#2563EB" : "#E5E7EB"}`,
                  background: sel ? "#EFF6FF" : "white",
                  cursor: "pointer",
                  display: "flex", alignItems: "flex-start", gap: 14,
                  transition: "all 0.15s",
                  boxShadow: sel ? "0 2px 12px rgba(37,99,235,0.12)" : "none",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = "#93C5FD"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: sel ? "#DBEAFE" : "#F1F5F9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {key === "negotiable"
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sel ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sel ? "#2563EB" : "#94A3B8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: sel ? "#1D4ED8" : "#1E293B", margin: "0 0 4px", fontFamily: F }}>{title}</p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.6 }}>{sub}</p>
                  {key === "specific" && data.startDate && (
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", margin: "8px 0 0", fontFamily: F }}>{data.startDate}</p>
                  )}
                </div>
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${sel ? "#2563EB" : "#D1D5DB"}`,
                  background: sel ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {sel && <Check size={10} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}

          {/* 달력 팝업 */}
          {showCal && (
            <div ref={calRef} style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 200 }}>
              <MiniCalendar
                value={data.startDate}
                onChange={v => { setData({ ...data, startDate: v, startDateType: "specific" }); setShowCal(false); }}
                onClose={() => setShowCal(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* 예상 진행 기간 */}
      <div>
        <FieldLabel required>{tr.s5_duration}</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1.5px solid #E5E7EB", borderRadius: 12,
            overflow: "hidden", background: "white", transition: "border 0.15s",
          }}
            onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
            onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
          >
            <input
              type="number" min="1" max="60" placeholder="0"
              value={data.durationMonths || ""}
              onChange={e => setData({ ...data, durationMonths: e.target.value })}
              style={{
                width: 120, border: "none", outline: "none",
                padding: "14px 20px", fontSize: 20, fontWeight: 700,
                fontFamily: F, color: "#111827", background: "transparent", textAlign: "center",
              }}
            />
            <span style={{ padding: "0 18px", fontSize: 15, fontWeight: 600, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB" }}>{tr.s5_months}</span>
          </div>
          {durationDays && (
            <span style={{ fontSize: 14, color: "#64748B", fontFamily: F }}>{tr.s5_daysExpected(durationDays)}</span>
          )}
        </div>
      </div>

      {/* 예산 및 일정 협의 가능 */}
      <div
        onClick={() => setData({ ...data, negotiable: !data.negotiable })}
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          border: `2px solid ${data.negotiable ? "#2563EB" : "#D1D5DB"}`,
          background: data.negotiable ? "#2563EB" : "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", flexShrink: 0,
        }}>
          {data.negotiable && <Check size={12} color="white" strokeWidth={3} />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: F }}>{tr.s5_negotiable}</span>
      </div>
    </div>
  );
}

/* ── Step 6: 모집 요건 ─────────────────────────────────────── */
const REQ_TAGS_PRESETS = ["포트폴리오 필수", "경력 3년 이상", "상주 가능", "관련 학과 졸업"];

function Step6({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const [showDeadlineCal, setShowDeadlineCal] = React.useState(false);
  const deadlineRef = useRef(null);
  const [reqInput, setReqInput] = React.useState("");

  React.useEffect(() => {
    const handler = e => { if (deadlineRef.current && !deadlineRef.current.contains(e.target)) setShowDeadlineCal(false); };
    if (showDeadlineCal) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDeadlineCal]);

  const addReqTag = val => {
    const trim = val.trim();
    if (!trim) return;
    const cur = data.reqTags || [];
    if (!cur.includes(trim)) setData({ ...data, reqTags: [...cur, trim] });
    setReqInput("");
  };
  const removeReqTag = tag => setData({ ...data, reqTags: (data.reqTags || []).filter(t => t !== tag) });

  const addQuestion = () => {
    const cur = data.questions || [];
    if (cur.length >= 3) return;
    setData({ ...data, questions: [...cur, ""] });
  };
  const removeQuestion = idx => {
    const cur = data.questions || [];
    setData({ ...data, questions: cur.filter((_, i) => i !== idx) });
  };
  const updateQuestion = (idx, val) => {
    const cur = [...(data.questions || [])];
    cur[idx] = val;
    setData({ ...data, questions: cur });
  };

  const formatDeadline = v => {
    if (!v) return "";
    const [y, m, d] = v.split("-");
    return `${y}.${m}.${d}`;
  };

  const govType = data.govSupport || "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* 모집 마감일 */}
      <div>
        <FieldLabel required>{tr.s6_deadline}</FieldLabel>
        <div style={{ position: "relative" }} ref={deadlineRef}>
          <div
            onClick={() => setShowDeadlineCal(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "18px 20px", borderRadius: 14,
              border: `2px solid ${showDeadlineCal ? "#2563EB" : "#E5E7EB"}`,
              background: "white", cursor: "pointer",
              maxWidth: 440, transition: "border 0.15s",
            }}
            onMouseEnter={e => { if (!showDeadlineCal) e.currentTarget.style.borderColor = "#93C5FD"; }}
            onMouseLeave={e => { if (!showDeadlineCal) e.currentTarget.style.borderColor = "#E5E7EB"; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ flex: 1, fontSize: 16, fontWeight: data.deadline ? 700 : 400, color: data.deadline ? "#111827" : "#9CA3AF", fontFamily: F }}>
              {data.deadline ? formatDeadline(data.deadline) : tr.s6_pickDate}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          {showDeadlineCal && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200 }}>
              <MiniCalendar
                value={data.deadline}
                onChange={v => { setData({ ...data, deadline: v }); setShowDeadlineCal(false); }}
                onClose={() => setShowDeadlineCal(false)}
                koreanDays
              />
            </div>
          )}
        </div>
      </div>

      {/* 정부 지원사업 여부 */}
      <div>
        <FieldLabel required>{tr.s6_govSupport}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 640 }}>
          {[
            { key: "none", label: tr.s6_govNone },
            { key: "yes",  label: tr.s6_govYes },
          ].map(({ key, label }) => {
            const sel = govType === key;
            return (
              <div
                key={key}
                onClick={() => setData({ ...data, govSupport: key })}
                style={{
                  padding: "22px 20px", borderRadius: 14,
                  border: `2px solid ${sel ? "#2563EB" : "#E5E7EB"}`,
                  background: sel ? "#EFF6FF" : "white",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.15s",
                  boxShadow: sel ? "0 2px 10px rgba(37,99,235,0.10)" : "none",
                  position: "relative",
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = "#93C5FD"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: sel ? "#1D4ED8" : "#374151", fontFamily: F }}>{label}</span>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: `2px solid ${sel ? "#2563EB" : "#D1D5DB"}`,
                  background: sel ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {sel && <Check size={11} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 지원자 필수 요건 */}
      <div>
        <FieldLabel required>{tr.s6_reqTags}</FieldLabel>
        {/* 검색 입력 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px", borderRadius: 10,
          border: "1.5px solid #E5E7EB", background: "white",
          marginBottom: 12, transition: "border 0.15s",
        }}
          onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
          onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
        >
          <input
            type="text"
            placeholder={tr.s6_reqPh}
            value={reqInput}
            onChange={e => setReqInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addReqTag(reqInput); } }}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: F, color: "#374151", background: "transparent" }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        {/* 태그 목록 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(data.reqTags && data.reqTags.length > 0
            ? data.reqTags
            : (tr.s6_reqPresets || REQ_TAGS_PRESETS)
          ).map(tag => {
            const isCustom = (data.reqTags || []).includes(tag);
            return (
              <span
                key={tag}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "8px 16px", borderRadius: 999,
                  border: isCustom ? "1.5px solid #BFDBFE" : "1.5px solid #E5E7EB",
                  background: isCustom ? "#EFF6FF" : "#F8FAFC",
                  fontSize: 13, fontWeight: 600,
                  color: isCustom ? "#1D4ED8" : "#374151",
                  fontFamily: F, cursor: isCustom ? "default" : "pointer",
                }}
                onClick={() => { if (!isCustom) addReqTag(tag); }}
              >
                # {tag}
                {isCustom && (
                  <span
                    onClick={e => { e.stopPropagation(); removeReqTag(tag); }}
                    style={{ cursor: "pointer", fontSize: 14, color: "#60A5FA", lineHeight: 1 }}
                  >×</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* 사전 검증 질문 */}
      <div>
        <FieldLabel required>{tr.s6_questions}</FieldLabel>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px", fontFamily: F }}>{tr.s6_qDesc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(data.questions || []).map((q, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="text"
                placeholder={tr.s6_qPh}
                value={q}
                onChange={e => updateQuestion(idx, e.target.value)}
                style={{
                  flex: 1, padding: "14px 18px", borderRadius: 10,
                  border: "1.5px solid #E5E7EB", fontSize: 14,
                  fontFamily: F, color: "#111827", outline: "none",
                  transition: "border 0.15s",
                }}
                onFocus={e => e.target.style.border = "1.5px solid #3B82F6"}
                onBlur={e => e.target.style.border = "1.5px solid #E5E7EB"}
              />
              <button
                onClick={() => removeQuestion(idx)}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "1.5px solid #E5E7EB", background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          ))}
          {(data.questions || []).length < 3 && (
            <button
              onClick={addQuestion}
              style={{
                width: "100%", padding: "14px", borderRadius: 10,
                border: "1.5px dashed #BFDBFE", background: "white",
                fontSize: 14, fontWeight: 600, color: "#3B82F6",
                cursor: "pointer", fontFamily: F,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#3B82F6"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {tr.s6_qAdd}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

/* ── Step 7: 기타 추가 정보 ────────────────────────────────── */
const COLLAB_ROLES = [
  { key: "planning",   label: "기획",          icon: kikhoekIcon },
  { key: "design",     label: "디자인/퍼블리싱", icon: designIcon },
  { key: "publishing", label: "프론트 개발",     icon: baepoIcon },
  { key: "dev",        label: "백엔드 개발",     icon: devIcon },
];
const DELIVERABLES = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    title: "기획 산출물 (요구사항 정의서, 화면 설계서 등)",
    sub: "최종 기획 문서 일체",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    title: "개발 소스 코드 (Github 레포지토리 또는 압축본)",
    sub: "모든 개발 리소스 소스",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    title: "최종 배포본 (Android/iOS 스토어 등록 및 서버 반영)",
    sub: "실제 서비스 런칭 기준",
  },
];
const REVISIONS = [
  {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><polyline points="12 16 12 16"/></svg>,
    title: "무상 수정 횟수: 총 2회",
    sub: "검수 기간 내 요청 건에 한함",
  },
  {
    icon: <span style={{ fontSize: 10, fontWeight: 900, color: "currentColor" }}>SCOPE</span>,
    title: "무상 수정 범위: 오타, 단순 오류 수정 및 디자인 폰트 수정 등",
    sub: "기획 범주 내 마이너 업데이트",
  },
  {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    title: "유상 수정 기준: 기능 추가, UI 전면 개편 등 기획 외 사항",
    sub: "별도 협의를 통한 추가 결제 진행",
  },
];

function EditBtn({ onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "6px 16px", borderRadius: 8, border: "none",
        background: hov
          ? "linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%)"
          : "linear-gradient(135deg, #BAE6FD 0%, #C7D2FE 50%, #DDD6FE 100%)",
        color: hov ? "white" : "#3730A3",
        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F,
        flexShrink: 0, transition: "all 0.18s",
        boxShadow: hov ? "0 2px 8px rgba(99,102,241,0.28)" : "none",
      }}
    >수정</button>
  );
}

function Step7({ data, setData, onOpenAi }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;

  const itType = data.itExp || "yes";

  // ─── 7가지 세부 협의사항 자동 prefill ─────────────────────────
  // 사용자가 앞 단계에서 입력한 데이터 (예산, 일정, 제목, 카테고리 등) 와
  // AI 가 채워준 contractTerms (있다면) 를 합쳐서 모달이 기대하는 구조로 만들어 둔다.
  // - AI 가 객체 모양으로 잘 채웠으면 그대로 사용
  // - AI 가 문자열 한 줄만 줬으면 그건 memo/intro/notes 등에 흘려넣고 나머지는 프로젝트 데이터로 구성
  // - 아예 비어있으면 프로젝트 데이터 + 합리적 기본값으로 구성
  React.useEffect(() => {
    const ct = data.contractTerms || {};
    // 이미 7개 모두 객체 모양이면 그대로 둠 (사용자가 직접 수정한 상태 보존)
    const allFilled = ["scope","deliverables","schedule","payment","revision","completion","specialTerms"].every(
      k => ct[k] && typeof ct[k] === "object" && !Array.isArray(ct[k])
    );
    if (allFilled) return;
    const prefilled = buildPrefilledContractTerms(data, ct);
    setData(d => ({ ...d, contractTerms: prefilled }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Step7 진입 시 1회만

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

      {/* IT 경험 관리 여부 */}
      <div>
        <FieldLabel required>{tr.s7_itExp}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            {
              key: "yes",
              title: tr.s7_itYes,
              sub: tr.s7_itYesSub,
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={itType === "yes" ? "#2563EB" : "#94A3B8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
            },
            {
              key: "no",
              title: tr.s7_itNo,
              sub: tr.s7_itNoSub,
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={itType === "no" ? "#2563EB" : "#94A3B8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            },
          ].map(({ key, title, sub, icon }) => {
            const sel = itType === key;
            return (
              <div
                key={key}
                onClick={() => setData({ ...data, itExp: key })}
                style={{
                  padding: "20px 44px 18px 18px", borderRadius: 14,
                  border: `2px solid ${sel ? "#2563EB" : "#E5E7EB"}`,
                  background: sel ? "#EFF6FF" : "white",
                  cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14,
                  transition: "all 0.15s", position: "relative",
                  boxShadow: sel ? "0 2px 12px rgba(37,99,235,0.12)" : "none",
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = "#93C5FD"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: sel ? "#DBEAFE" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: sel ? "#1D4ED8" : "#1E293B", margin: "0 0 4px", fontFamily: F }}>{title}</p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.6 }}>{sub}</p>
                </div>
                <div style={{ position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? "#2563EB" : "#D1D5DB"}`, background: sel ? "#2563EB" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                  {sel && <Check size={11} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI 유도 배너 */}
      <div style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
        border: "1.5px solid #DBEAFE",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <img src={mascotIcon} alt="AI 매니저" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF", margin: "0 0 3px", fontFamily: F }}>{tr.s7_aiBannerTitle}</p>
          <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F }}>{tr.s3_aiDesc}</p>
        </div>
        <button
          onClick={onOpenAi}
          style={{
            padding: "10px 20px", borderRadius: 999, border: "none",
            background: BLUE_GRAD,
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
            display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            boxShadow: "0 3px 10px rgba(37,99,235,0.25)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          {tr.s3_aiBtn}
        </button>
      </div>

      {/* 계약 조건 — 인라인 편집 */}
      <div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 8, fontFamily: F }}>
            {tr.s7_sevenTitle}
          </div>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.6 }}>
            {tr.s7_sevenDesc}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {(() => {
            const ct = data.contractTerms || {};
            const setTerm = (key) => (val) => setData({ ...data, contractTerms: { ...(data.contractTerms || {}), [key]: val } });
            return (
              <>
                <ScopeModal        onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.scope        ?? null} onChange={setTerm("scope")} />
                <DeliverablesModal onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.deliverables ?? null} onChange={setTerm("deliverables")} />
                <ScheduleModal     onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.schedule     ?? null} onChange={setTerm("schedule")} />
                <PaymentModal      onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.payment      ?? null} onChange={setTerm("payment")} />
                <RevisionModal     onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.revision     ?? null} onChange={setTerm("revision")} />
                <CompletionModal   onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.completion   ?? null} onChange={setTerm("completion")} />
                <SpecialTermsModal onClose={() => {}} inline showHeaderStatusBadge={false} value={ct.specialTerms ?? null} onChange={setTerm("specialTerms")} />
              </>
            );
          })()}
        </div>
      </div>

    </div>
  );
}

const STEP_COMPONENTS = { 1: Step1, 2: Step2, 3: Step3, 4: Step4, 5: Step5, 6: Step6, 7: Step7 };

/* ── FTStep2: 근무 환경 (기간제) ─────────────────────────────── */
function FTStep2({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const setSingle = (field, val) =>
    setData({ ...data, [field]: val === data[field] ? "" : val });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <FieldLabel required>{tr.ft2_workStyle}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["상주 (풀타임 오피스)", "원격 (재택 근무)", "혼합 (일부 상주)"].map((o, i) => (
            <ChipBtn key={o} label={tr.ft2_workStyles[i]} selected={data.workStyle === o}
              onClick={() => setSingle("workStyle", o)} />
          ))}
        </div>
      </div>
      {(data.workStyle === "상주 (풀타임 오피스)" || data.workStyle === "혼합 (일부 상주)") && (
        <div>
          <FieldLabel required>{tr.ft2_location}</FieldLabel>
          <TextInput
            placeholder={tr.ft2_locationPh}
            value={data.workLocation || ""}
            onChange={v => setData({ ...data, workLocation: v })}
          />
        </div>
      )}
      <div>
        <FieldLabel required>{tr.ft2_workDays}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["주 3일", "주 4일", "주 5일", "협의 가능"].map((o, i) => (
            <ChipBtn key={o} label={tr.ft2_workDayOpts[i]} selected={data.workDays === o}
              onClick={() => setSingle("workDays", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.ft2_workHours}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["오전 9시~오후 6시", "오전 10시~오후 7시", "자유 근무", "협의 가능"].map((o, i) => (
            <ChipBtn key={o} label={tr.ft2_workHourOpts[i]} selected={data.workHours === o}
              onClick={() => setSingle("workHours", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.ft2_contractTerm}</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1.5px solid #E5E7EB", borderRadius: 12,
            overflow: "hidden", background: "white", transition: "border 0.15s",
          }}
            onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
            onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
          >
            <input
              type="number" min="1" max="36" placeholder="0"
              value={data.contractMonths || ""}
              onChange={e => setData({ ...data, contractMonths: e.target.value })}
              style={{
                width: 120, border: "none", outline: "none",
                padding: "14px 20px", fontSize: 20, fontWeight: 700,
                fontFamily: F, color: "#111827", background: "transparent", textAlign: "center",
              }}
            />
            <span style={{ padding: "0 18px", fontSize: 15, fontWeight: 600, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB" }}>{tr.s5_months}</span>
          </div>
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.ft2_monthlyRate}</FieldLabel>
        <div style={{
          display: "flex", alignItems: "center",
          border: "1.5px solid #E5E7EB", borderRadius: 12,
          overflow: "hidden", background: "white", transition: "border 0.15s",
          maxWidth: 360,
        }}
          onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
          onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
        >
          <input
            type="text" placeholder="0"
            value={data.monthlyRate || ""}
            onChange={e => {
              const num = e.target.value.replace(/[^0-9]/g, "");
              setData({ ...data, monthlyRate: num ? Number(num).toLocaleString("ko-KR") : "" });
            }}
            style={{
              flex: 1, border: "none", outline: "none",
              padding: "16px 20px", fontSize: 20, fontWeight: 800,
              fontFamily: F, color: "#111827", background: "transparent", textAlign: "right",
            }}
          />
          <span style={{ padding: "0 7px", fontSize: 14, fontWeight: 800, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB" }}>{tr.ft2_manwon}</span>
        </div>
      </div>
    </div>
  );
}

/* ── FTStep4: 프로젝트 현황 (기간제) ─────────────────────────── */
function FTStep4({ data, setData }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const [stackInput, setStackInput] = useState("");
  const setSingle = (field, val) =>
    setData({ ...data, [field]: val === data[field] ? "" : val });
  const addStack = val => {
    const trim = val.trim();
    if (!trim) return;
    const cur = data.currentStacks || [];
    if (!cur.includes(trim)) setData({ ...data, currentStacks: [...cur, trim] });
    setStackInput("");
  };
  const removeStack = val =>
    setData({ ...data, currentStacks: (data.currentStacks || []).filter(t => t !== val) });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <FieldLabel required>{tr.ft4_devStage}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["기획 단계", "설계 단계", "개발 진행 중", "테스트 단계", "유지보수 단계"].map((o, i) => (
            <ChipBtn key={o} label={tr.ft4_devStages[i]} selected={data.devStage === o}
              onClick={() => setSingle("devStage", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.ft4_teamSize}</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["1명 (혼자)", "2~5명", "6~10명", "11명 이상"].map((o, i) => (
            <ChipBtn key={o} label={tr.ft4_teamSizes[i]} selected={data.teamSize === o}
              onClick={() => setSingle("teamSize", o)} />
          ))}
        </div>
      </div>
      <div>
        <FieldLabel required>{tr.ft4_stack}</FieldLabel>
        {(data.currentStacks || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {(data.currentStacks || []).map(tag => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 999,
                border: "1.5px solid #BFDBFE", background: "#EFF6FF",
                fontSize: 13, fontWeight: 600, color: "#1D4ED8", fontFamily: F,
              }}>
                {tag}
                <span onClick={() => removeStack(tag)}
                  style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, color: "#60A5FA" }}>×</span>
              </span>
            ))}
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderRadius: 10,
          border: "1.5px solid #E5E7EB", background: "white",
          transition: "border 0.15s",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder={tr.ft4_stackPh}
            value={stackInput}
            onChange={e => setStackInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addStack(stackInput); } }}
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 13, fontFamily: F, color: "#374151", background: "transparent",
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "6px 0 0", fontFamily: F }}>{tr.ft4_techHint}</p>
      </div>
      <div>
        <FieldLabel required>{tr.ft4_status}</FieldLabel>
        <Textarea
          placeholder={tr.ft4_statusPh}
          value={data.currentStatus || ""}
          onChange={v => setData({ ...data, currentStatus: v })}
          rows={6}
        />
      </div>
    </div>
  );
}

/* ── FTStep1: 기본 정보 (기간제) ─────────────────────────────── */
const FT_ROLE_JOBS = {
  planning:   ["서비스 기획", "PM", "전략 기획", "콘텐츠 기획"],
  design:     ["UI/UX 디자인", "그래픽 디자인", "브랜드 디자인", "웹 디자인", "웹 퍼블리싱", "HTML/CSS", "반응형 웹"],
  publishing: ["React", "Vue", "Next.js", "TypeScript", "디자인 시스템"],
  dev:        ["웹 개발", "앱 개발", "서버 개발", "AI 개발", "DB 설계"],
};

function RecruitCard({ card, showRemove, onUpdate, onRemove }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const [skillInput, setSkillInput] = React.useState("");
  const addSkill = (val) => {
    const trim = val.trim();
    if (!trim) return;
    const cur = card.skills || [];
    if (!cur.includes(trim)) onUpdate("skills", [...cur, trim]);
    setSkillInput("");
  };
  const removeSkill = (s) => onUpdate("skills", (card.skills || []).filter(t => t !== s));

  return (
    <div style={{
      border: "1.5px solid #BFDBFE", borderRadius: 14,
      background: "#F8FBFF", padding: "24px 24px 20px", position: "relative",
    }}>
      {showRemove && (
        <button
          onClick={onRemove}
          style={{
            position: "absolute", top: 14, right: 14,
            width: 28, height: 28, borderRadius: "50%",
            background: "white", border: "1.5px solid #E5E7EB",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1D4ED8", fontFamily: F }}>{tr.ft1_recruitReq}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div>
          <FieldLabel required>{tr.ft1_yoe}</FieldLabel>
          <SelectInput value={card.experience || ""} onChange={v => onUpdate("experience", v)}
            options={["신입", "1-3년", "3-5년", "5-10년", "10년 이상"]} labels={tr.ft1_yoeOpts} placeholder={tr.ft1_yoePh} />
        </div>
        <div>
          <FieldLabel required>{tr.ft1_level}</FieldLabel>
          <SelectInput value={card.level || ""} onChange={v => onUpdate("level", v)}
            options={["주니어", "미드레벨", "시니어", "리드/매니저"]} labels={tr.ft1_levelOpts} placeholder={tr.ft1_levelPh} />
        </div>
        <div>
          <FieldLabel required>{tr.ft1_salary}</FieldLabel>
          <div style={{
            display: "flex", alignItems: "center",
            border: "1.5px solid #E5E7EB", borderRadius: 10,
            overflow: "hidden", background: "white", transition: "border 0.15s",
          }}
            onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
            onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
          >
            <input type="text" placeholder={tr.ft1_salaryPh}
              value={card.salary || ""} onChange={e => onUpdate("salary", e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", padding: "13px 16px", fontSize: 14, fontFamily: F, color: "#111827", background: "transparent" }}
            />
            <span style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{tr.s4_won}</span>
          </div>
        </div>
        <div>
          <FieldLabel required>{tr.ft1_skills}</FieldLabel>
          {(card.skills || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {(card.skills || []).map(s => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 999, border: "1.5px solid #BFDBFE", background: "#EFF6FF", fontSize: 12, fontWeight: 600, color: "#1D4ED8", fontFamily: F }}>
                  {s}<span onClick={() => removeSkill(s)} style={{ cursor: "pointer", fontSize: 13, color: "#60A5FA", lineHeight: 1 }}>×</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "white", overflow: "hidden", transition: "border 0.15s" }}
            onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
            onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
          >
            <input type="text" placeholder={tr.ft1_skillsPh} value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); } }}
              style={{ flex: 1, border: "none", outline: "none", padding: "13px 16px", fontSize: 14, fontFamily: F, color: "#374151", background: "transparent" }}
            />
            <button onClick={() => addSkill(skillInput)}
              style={{ padding: "0 14px", alignSelf: "stretch", border: "none", borderLeft: "1px solid #E5E7EB", background: "#F0F7FF", color: "#2563EB", fontSize: 20, fontWeight: 700, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
              onMouseLeave={e => e.currentTarget.style.background = "#F0F7FF"}
            >+</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FieldLabel>{tr.ft1_detailReq}</FieldLabel>
        <Textarea placeholder={tr.ft1_detailReqPh}
          value={card.requirement || ""} onChange={v => onUpdate("requirement", v)} rows={3} />
      </div>

      <div>
        <FieldLabel required>{tr.ft1_headcount}</FieldLabel>
        <div style={{ display: "inline-flex", alignItems: "center", border: "1.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "white", transition: "border 0.15s" }}
          onFocusCapture={e => e.currentTarget.style.border = "1.5px solid #3B82F6"}
          onBlurCapture={e => e.currentTarget.style.border = "1.5px solid #E5E7EB"}
        >
          <input type="number" min="1" placeholder="0" value={card.headcount || ""}
            onChange={e => onUpdate("headcount", Number(e.target.value))}
            style={{ width: 120, border: "none", outline: "none", padding: "13px 16px", fontSize: 16, fontWeight: 700, fontFamily: F, color: "#111827", background: "transparent", textAlign: "center" }}
          />
          <span style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: F, borderLeft: "1px solid #E5E7EB" }}>{tr.s4_persons}</span>
        </div>
      </div>
    </div>
  );
}

function FTStep1({ data, setData, onOpenAi }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const cardIdRef = React.useRef(0);
  const newCard = () => { cardIdRef.current += 1; return { id: cardIdRef.current, experience: "", level: "", salary: "", skills: [], requirement: "", headcount: 1 }; };

  const scope = data.ftScope || "";
  const selectedJob = data.ftSelectedJob || "";
  const recruitCards = data.recruitCards || [];

  const setScope = (key) => {
    setData({ ...data, ftScope: scope === key ? "" : key, ftSelectedJob: "", recruitCards: [] });
  };
  const setJob = (job) => {
    if (selectedJob === job) {
      setData({ ...data, ftSelectedJob: "", recruitCards: [] });
    } else {
      setData({ ...data, ftSelectedJob: job, recruitCards: [newCard()] });
    }
  };
  const addCard = () => {
    setData({ ...data, recruitCards: [...recruitCards, newCard()] });
  };
  const removeCard = (id) => setData({ ...data, recruitCards: recruitCards.filter(c => c.id !== id) });
  const updateCard = (id, field, value) => setData({ ...data, recruitCards: recruitCards.map(c => c.id === id ? { ...c, [field]: value } : c) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <AiChatEntryBanner onOpenAi={onOpenAi} />

      {/* 프로젝트 제목 */}
      <div>
        <FieldLabel required>{tr.fieldTitle}</FieldLabel>
        <TextInput placeholder={tr.ft1_titlePh}
          value={data.title || ""} onChange={v => setData({ ...data, title: v })} />
      </div>

      {/* 업무 범위 - 단일 선택 */}
      <div>
        <FieldLabel required>{tr.ft1_scopeSingle}</FieldLabel>
        <div style={{ display: "flex", gap: 16 }}>
          {WORK_SCOPES.map(({ key, label, icon }) => {
            const selected = scope === key;
            const localLabel = (tr.workScopes && (tr.workScopes.find(w => w.key === key) || {}).label) || label;
            return (
              <div key={key} onClick={() => setScope(key)} style={{
                flex: 1, position: "relative",
                padding: "28px 16px 22px", borderRadius: 14,
                border: `2px solid ${selected ? "#2563EB" : "#E5E7EB"}`,
                background: selected ? "#EFF6FF" : "white",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                transition: "all 0.15s",
                boxShadow: selected ? "0 2px 12px rgba(37,99,235,0.12)" : "none",
              }}
                onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(147,197,253,0.3)"; } }}
                onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; } }}
              >
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  width: 20, height: 20, borderRadius: "50%",
                  border: `2px solid ${selected ? "#2563EB" : "#D1D5DB"}`,
                  background: selected ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}>
                  {selected && <Check size={11} color="white" strokeWidth={3} />}
                </div>
                <img src={icon} alt={label} style={{ width: 76, height: 76, objectFit: "contain" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: selected ? "#2563EB" : "#374151", fontFamily: F }}>{localLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 주요 직무 */}
      {scope && (
        <div>
          <FieldLabel required>{tr.ft1_mainJob} <span style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF", marginLeft: 4 }}>{tr.ft1_mainJobHint}</span></FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FT_ROLE_JOBS[scope].map(job => {
              const active = selectedJob === job;
              return (
                <button key={job} onClick={() => setJob(job)} style={{
                  padding: "10px 20px", borderRadius: 999,
                  border: `1.5px solid ${active ? "#2563EB" : "#D1D5DB"}`,
                  background: active ? "#2563EB" : "white",
                  color: active ? "white" : "#374151",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F0F7FF"; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "white"; } }}
                >{job}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상세 모집 요건 카드 */}
      {selectedJob && recruitCards.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldLabel required>{tr.ft1_recruitDetail}</FieldLabel>
          {recruitCards.map((card) => (
            <RecruitCard key={card.id} card={card}
              showRemove={recruitCards.length > 1}
              onUpdate={(field, value) => updateCard(card.id, field, value)}
              onRemove={() => removeCard(card.id)}
            />
          ))}
          <button onClick={addCard} style={{
            width: "100%", padding: "16px", borderRadius: 12,
            border: "1.5px dashed #BFDBFE", background: "white",
            fontSize: 14, fontWeight: 600, color: "#6B7280",
            cursor: "pointer", fontFamily: F,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#2563EB"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.color = "#6B7280"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {tr.ft1_addLevel}
          </button>
        </div>
      )}

      {/* 프로젝트 카테고리 */}
      <div>
        <FieldLabel required>{tr.fieldCategory}</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tr.categories.map(({ key, label, desc }) => {
            const sel = (data.categories || []).includes(key);
            return (
              <div key={key} onClick={() => {
                const cur = data.categories || [];
                setData({ ...data, categories: sel ? cur.filter(k => k !== key) : [...cur, key] });
              }} style={{
                padding: "14px 18px", borderRadius: 10,
                border: `1.5px solid ${sel ? "#2563EB" : "#E5E7EB"}`,
                background: sel ? "#EFF6FF" : "white",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.15s",
                boxShadow: sel ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
              }}
                onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#F8FBFF"; } }}
                onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; } }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: sel ? "#1D4ED8" : "#111827", margin: "0 0 2px", fontFamily: F }}>{label}</p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0, fontFamily: F }}>{desc}</p>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginLeft: 12,
                  border: `2px solid ${sel ? "#2563EB" : "#D1D5DB"}`,
                  background: sel ? "#2563EB" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}>
                  {sel && <Check size={11} color="white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const FULLTIME_STEP_COMPONENTS = { 1: FTStep1, 2: FTStep2, 3: Step3, 4: FTStep4, 5: Step6, 6: Step7 };

/* ── 사이드바 ──────────────────────────────────────────────── */
function Sidebar({ currentStep, steps, sidebarTitle, sidebarSubtitle, helpTitle, helpDesc, onStepClick }) {
  return (
    <div style={{
      width: 240, minWidth: 240,
      background: "#F8FAFC",
      borderRight: "1px solid #E9EEF4",
      display: "flex", flexDirection: "column",
      padding: "32px 0",
    }}>
      <div style={{ padding: "0 24px 28px" }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: "0 0 4px", fontFamily: F }}>{sidebarTitle || "Project Registration"}</p>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, fontFamily: F }}>{sidebarSubtitle || "Step-by-step guide"}</p>
      </div>
      <div style={{ flex: 1 }}>
        {steps.map((stepItem) => {
          const { id, label } = stepItem;
          const SideIcon = stepItem.Icon;
          const active = id === currentStep;
          const done = id < currentStep;
          return (
            <div key={id}
              onClick={() => onStepClick && onStepClick(id)}
              style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 24px",
              background: active ? "#DBEAFE" : "transparent",
              cursor: "pointer",
              transition: "background 0.15s",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: active ? "#2563EB" : done ? "#111827" : "#E5E7EB",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s",
              }}>
                {done
                  ? <Check size={12} color="white" strokeWidth={2.5} />
                  : <SideIcon size={12} color={active ? "white" : "#94A3B8"} />
                }
              </div>
              <span style={{
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? "#1D4ED8" : done ? "#111827" : "#9CA3AF",
                fontFamily: F, lineHeight: 1.4,
              }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ margin: "20px 16px 0", padding: "14px 16px", background: "#EFF6FF", borderRadius: 12, border: "1px solid #BFDBFE" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", margin: "0 0 6px", fontFamily: F }}>{helpTitle}</p>
        <p style={{ fontSize: 12, color: "#3B82F6", margin: 0, fontFamily: F, lineHeight: 1.65 }}>
          {helpDesc}
        </p>
      </div>
    </div>
  );
}

/* ── 하단 버튼 ─────────────────────────────────────────────── */
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

function BottomButtons({ onSkip, onNext, nextLabel, isFinal }) {
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  return (
    <div style={{
      padding: "20px 52px",
      borderTop: "1px solid #F1F5F9",
      display: "flex", justifyContent: "flex-end", gap: 12,
      background: "white",
    }}>
      <button
        onClick={onSkip}
        style={{
          padding: "12px 32px", borderRadius: 999,
          border: "1.5px solid #D1D5DB", background: "white",
          color: "#374151", fontSize: 14, fontWeight: 600,
          cursor: "pointer", fontFamily: F, transition: "all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
        onMouseLeave={e => (e.currentTarget.style.background = "white")}
      >
        {tr.prevStep}
      </button>
      <button
        onClick={onNext}
        style={{
          padding: "12px 40px", borderRadius: 999, border: "none",
          background: isFinal ? PRIMARY_GRAD : BLUE_GRAD,
          color: "white", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: F,
          boxShadow: isFinal
            ? "0 4px 18px rgba(99,102,241,0.35)"
            : "0 4px 14px rgba(37,99,235,0.28)",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        {nextLabel}
      </button>
    </div>
  );
}

/* ── 메인 컴포넌트 ─────────────────────────────────────────── */
export default function ProjectRegister() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const tr = PR_TEXT[lang] || PR_TEXT.en;
  const { userRole } = useStore();
  const aiProjectDraft = useStore((s) => s.aiProjectDraft);
  const clearAiProjectDraft = useStore((s) => s.clearAiProjectDraft);
  const [searchParams] = useSearchParams();
  const isFreeMode = searchParams.get("free") === "1";
  const editProjectId = searchParams.get("id");
  const isEditMode = !!editProjectId && searchParams.get("edit") === "1";
  const restoredProjectRegisterState = location.state?.projectRegisterState;

  // location.state(직접 전달)가 우선, 없으면 store의 aiProjectDraft(영구 백업) 사용
  const initialData = restoredProjectRegisterState?.data
    ?? (aiProjectDraft && Object.keys(aiProjectDraft).length > 0 ? aiProjectDraft : null)
    ?? (isFreeMode ? { budgetAmount: "0", partnerFreeProject: true } : {});
  const cameFromAi = !!(restoredProjectRegisterState?.data || (aiProjectDraft && Object.keys(aiProjectDraft).length > 0));

  const [phase, setPhase] = useState(
    restoredProjectRegisterState?.phase ?? (cameFromAi || isFreeMode || isEditMode ? 1 : 0)
  );
  const [projectType, setProjectType] = useState(restoredProjectRegisterState?.projectType ?? "outsource");
  const [step, setStep] = useState(restoredProjectRegisterState?.step ?? 1);
  const [data, setData] = useState(initialData);
  const [_editLoading, setEditLoading] = useState(isEditMode);

  // AI 초안을 한 번 사용한 후 store에서 비워서, 다음번에 새 등록 시 재사용되지 않도록 함
  useEffect(() => {
    if (aiProjectDraft && Object.keys(aiProjectDraft).length > 0) {
      console.log("[ProjectRegister] aiProjectDraft 적용됨", aiProjectDraft);
      clearAiProjectDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수정 모드: 기존 프로젝트 데이터 로드
  useEffect(() => {
    if (!isEditMode || !editProjectId) return;
    let mounted = true;
    setEditLoading(true);
    projectsApi.detail(editProjectId)
      .then((p) => {
        if (!mounted) return;
        // 백엔드 ProjectSummaryResponse → 폼 data 형식으로 변환
        const formData = {
          title: p.title || "",
          slogan: p.slogan || "",
          sloganSub: p.sloganSub || "",
          desc: p.desc || "",
          detailContent: p.detailContent || p.desc || "",
          fields: p.serviceField ? [p.serviceField] : [],
          techTags: (p.tags || []).map((t) => String(t).replace(/^#/, "")),
          budgetAmount: p.budgetAmount != null ? String(p.budgetAmount) : "",
          budgetMin: p.budgetMin || "",
          budgetMax: p.budgetMax || "",
          durationMonths: p.durationMonths != null ? String(p.durationMonths) : "",
          startDate: p.startDate || "",
          deadline: p.deadline || "",
          meetingType: p.meetingType || "",
          meetingFreq: p.meetingFreq || "",
          meetingTools: p.meetingTools || [],
          reqTags: p.reqTags || [],
          questions: p.questions || [],
          visibility: p.visibility || "public",
          partnerFreeProject: !!p.isPartnerFree,
          // 외주 전용
          projectType2: p.outsourceProjectType || "",
          readyStatus: p.readyStatus ? [p.readyStatus] : [],
          // 상주 전용
          workStyle: p.workStyle || "",
          workLocation: p.workLocation || "",
          workDays: p.workDays || "",
          workHours: p.workHours || "",
          contractMonths: p.contractMonths != null ? String(p.contractMonths) : "",
          monthlyRate: p.monthlyRate != null ? String(p.monthlyRate) : "",
          devStage: p.devStage || "",
          teamSize: p.teamSize || "",
          currentStacks: p.currentStacks || [],
          currentStatus: p.currentStatus || "",
          additionalComment: p.additionalComment || "",
          // 프로젝트 유형 추정
          _isFulltime: !!(p.workStyle || p.workLocation || p.contractMonths),
        };
        setData(formData);
        if (formData._isFulltime) setProjectType("fulltime");
        setPhase(1);
        setStep(1);
        console.log("[ProjectRegister] 수정 모드 - 기존 데이터 로드 완료", formData);
      })
      .catch((e) => {
        console.error("[ProjectRegister] 수정 데이터 로드 실패", e);
        alert("프로젝트 정보를 불러오지 못했습니다.");
        navigate(-1);
      })
      .finally(() => mounted && setEditLoading(false));
    return () => { mounted = false; };
  }, [isEditMode, editProjectId, navigate]);

  const isPartner = userRole === "partner";
  const isFulltime = projectType === "fulltime";

  const localOutsourceSteps = OUTSOURCE_STEPS.map((s, i) => ({ ...s, label: tr.outsourceSteps[i] }));
  const localFulltimeSteps  = FULLTIME_STEPS.map((s, i)  => ({ ...s, label: tr.fulltimeSteps[i] }));
  const ACTIVE_STEPS = isFulltime ? localFulltimeSteps : localOutsourceSteps;
  const ACTIVE_SUBTITLES = isFulltime ? tr.fulltimeSubs : tr.outsourceSubs;
  const ACTIVE_STEP_COMPONENTS = isFulltime ? FULLTIME_STEP_COMPONENTS : STEP_COMPONENTS;
  const totalSteps = ACTIVE_STEPS.length;

  const StepContent = ACTIVE_STEP_COMPONENTS[step];
  const currentStepInfo = ACTIVE_STEPS[step - 1];

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const isSubmittingRef = useRef(false); // 중복 등록 방지 (StrictMode 더블 호출 / 더블클릭 방어)

  const handleOpenAiChat = () => {
    navigate("/ai_chat_project", {
      state: {
        projectRegisterState: { phase, projectType, step, data },
      },
    });
  };

  const handleOpenAiContractChat = () => {
    navigate("/ai_chat_project", {
      state: {
        contractMode: true,
        projectRegisterState: { phase, projectType, step, data },
      },
    });
  };

  const handleComplete = async () => {
    // 중복 호출 방지 (StrictMode 더블 effect 또는 사용자 더블클릭)
    if (isSubmittingRef.current) {
      console.warn("[ProjectRegister] handleComplete 중복 호출 차단");
      return;
    }
    isSubmittingRef.current = true;
    // 폼 data → 백엔드 ProjectCreateRequest 매핑 (보수적, 누락 필드는 null 허용)
    const techTags = data.techTags || [];
    const tagsWithHash = techTags.map(t => (String(t).startsWith('#') ? t : `#${t}`));
    const payload = {
      projectType: isFulltime ? "fulltime" : "outsource",
      title: data.title || "(제목 없음)",
      slogan: data.slogan || data.title || "",
      sloganSub: data.sloganSub || null,
      desc: data.desc || data.detailContent || "",
      detailContent: data.detailContent || null,
      serviceField: (data.fields && data.fields[0]) || null,
      grade: "silver",
      workScope: data.scope || null,
      category: data.categories || null,
      tags: tagsWithHash.length ? tagsWithHash : null,
      visibility: data.visibility || "public",
      budgetAmount: data.budgetAmount ? Number(String(data.budgetAmount).replace(/[^0-9]/g, "")) || null : null,
      budgetMin: data.budgetMin || null,
      budgetMax: data.budgetMax || null,
      isPartnerFree: !!data.partnerFreeProject,
      startDateNegotiable: data.startDateType === "negotiable",
      startDate: data.startDate || null,
      durationMonths: data.durationMonths ? Number(data.durationMonths) || null : null,
      scheduleNegotiable: !!data.scheduleNegotiable,
      meetingType: data.meetingType || null,
      meetingFreq: data.meetingFreq || null,
      meetingTools: data.meetingTools || null,
      deadline: data.deadline || null,
      govSupport: !!data.govSupport,
      reqTags: data.reqTags || null,
      questions: data.questions || null,
      itExp: !!data.itExp,
      collabPlanning: data.collabPlanning ? Number(data.collabPlanning) : null,
      collabDesign: data.collabDesign ? Number(data.collabDesign) : null,
      collabPublishing: data.collabPublishing ? Number(data.collabPublishing) : null,
      collabDev: data.collabDev ? Number(data.collabDev) : null,
      additionalComment: data.additionalComment || null,
      avatarColor: "#3B82F6",
      // 외주 전용
      outsourceProjectType: !isFulltime ? (data.projectType2 || null) : null,
      readyStatus: !isFulltime && data.readyStatus && data.readyStatus[0] ? data.readyStatus[0] : null,
      // 상주 전용
      workStyle: isFulltime ? (data.workStyle || null) : null,
      workLocation: isFulltime ? (data.workLocation || null) : null,
      workDays: isFulltime ? (data.workDays || null) : null,
      workHours: isFulltime ? (data.workHours || null) : null,
      contractMonths: isFulltime ? (data.contractMonths ? Number(data.contractMonths) : null) : null,
      monthlyRate: isFulltime ? (data.monthlyRate ? Number(data.monthlyRate) : null) : null,
      devStage: isFulltime ? (data.devStage || null) : null,
      teamSize: isFulltime ? (data.teamSize || null) : null,
      currentStacks: isFulltime ? (data.currentStacks || null) : null,
      currentStatus: isFulltime ? (data.currentStatus || null) : null,
      // 스킬
      requiredSkills: techTags,
      preferredSkills: [],
      // 7가지 세부 협의사항 (Step7에서 수집한 JSON)
      contractTerms: data.contractTerms || null,
    };

    try {
      let result;
      if (isEditMode && editProjectId) {
        result = await projectsApi.update(editProjectId, payload);
        console.log("[ProjectRegister] 프로젝트 수정 성공:", result);
      } else {
        result = await projectsApi.create(payload);
        console.log("[ProjectRegister] 프로젝트 등록 성공:", result);
      }
      setShowCompleteModal(true);
    } catch (err) {
      console.error("[ProjectRegister] 등록/수정 실패:", err);
      const msg = err?.response?.data?.message
        || (err?.response?.status === 401 ? "로그인이 필요합니다. 다시 로그인해주세요." : "프로젝트 등록에 실패했습니다.");
      alert(msg);
    } finally {
      // 실패 시 다시 시도할 수 있도록 가드 해제, 성공 시는 모달 닫고 페이지 이동될 것이므로 굳이 풀지 않아도 무방하나 안전하게 해제
      isSubmittingRef.current = false;
    }
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: F, position: "relative" }}>
      {/* Blurred background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `url(${homeBg})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(20px) brightness(0.72)",
        transform: "scale(1.08)",
      }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, background: "rgba(160,185,210,0.20)" }} />

      {/* 파트너 안내 팝업 */}
      {isPartner && phase === 0 && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "white", borderRadius: 24,
            padding: "44px 48px 36px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            textAlign: "center", maxWidth: 440, width: "90vw",
            position: "relative",
          }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 32, height: 32, borderRadius: "50%",
                border: "none", background: "#F3F4F6",
                color: "#6B7280", fontSize: 18, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#E5E7EB"; e.currentTarget.style.color = "#111827"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#6B7280"; }}
            >×</button>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 14px", fontFamily: F, lineHeight: 1.4 }}>
              {tr.partnerFreeTitle.split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", fontFamily: F, lineHeight: 1.8 }}>
              {tr.partnerFreeBody.split("\n").map((line, i) => (
                <span key={i}>{i === 0 ? <><strong style={{ color: "#2563EB" }}>{line}</strong></> : line}{i < 2 && <br />}</span>
              ))}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  setProjectType("outsource");
                  setData({ budgetAmount: "0", partnerFreeProject: true });
                  setStep(1);
                  setPhase(1);
                }}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: PRIMARY_GRAD, color: "white",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F,
                  boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {tr.partnerFreeBtn}
              </button>
              <button
                onClick={() => navigate("/project_search")}
                style={{
                  width: "100%", padding: "13px", borderRadius: 12,
                  border: "1.5px solid #E5E7EB", background: "white",
                  color: "#374151", fontSize: 15, fontWeight: 600,
                  cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
              >
                {tr.findProject}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {isPartner ? <Header_partner /> : <Header_client />}

        <main style={{ flex: 1, padding: phase === 0 ? "0 20px" : "40px 20px 60px" }}>
          {phase === 0 ? (
            /* ── TYPE SELECTION ── */
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              minHeight: "calc(100vh - 140px)",
            }}>
              <div style={{
                background: "white", borderRadius: 24,
                padding: "52px 60px 44px",
                boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
              }}>
                {/* 그라데이션 제목 */}
                <h2 style={{
                  textAlign: "center",
                  fontSize: 28, fontWeight: 900,
                  margin: "0 0 36px",
                  fontFamily: F,
                  background: "linear-gradient(120deg, #7DD3FC 0%, #60A5FA 30%, #818CF8 65%, #C084FC 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  {tr.typeTitle}
                </h2>
                <div style={{ display: "flex", gap: 20, marginBottom: 40 }}>
                  {[
                    { key: "outsource", label: tr.outsource,   desc: tr.outsourceDesc,  icon: devIcon },
                    { key: "fulltime",  label: tr.fulltime, desc: tr.fulltimeDesc, icon: mascotIcon },
                  ].map(({ key, label, desc, icon }) => {
                    const selected = projectType === key;
                    return (
                      <div
                        key={key}
                        onClick={() => setProjectType(key)}
                        style={{
                          position: "relative", width: 280,
                          padding: "44px 28px 32px", borderRadius: 18,
                          border: `2px solid ${selected ? "#2563EB" : "#E5E7EB"}`,
                          background: selected ? "#F0F7FF" : "#FAFAFA",
                          cursor: "pointer",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: 14,
                          transition: "all 0.2s",
                          boxShadow: selected
                            ? "0 6px 24px rgba(37,99,235,0.16)"
                            : "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        onMouseEnter={e => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = "#93C5FD";
                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(147,197,253,0.3)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = "#E5E7EB";
                            e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                          }
                        }}
                      >
                        {/* Radio top-left */}
                        <div style={{
                          position: "absolute", top: 14, left: 14,
                          width: 22, height: 22, borderRadius: "50%",
                          border: `2px solid ${selected ? "#2563EB" : "#D1D5DB"}`,
                          background: selected ? "#2563EB" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {selected && <Check size={11} color="white" strokeWidth={3} />}
                        </div>
                        <img src={icon} alt={label}
                          style={{ width: 130, height: 130, objectFit: "contain" }} />
                        <p style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0, fontFamily: F }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 13, color: "#6B7280", margin: 0, fontFamily: F, textAlign: "center" }}>
                          {desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button
                    onClick={() => navigate(-1)}
                    style={{
                      padding: "14px 32px", borderRadius: 999,
                      border: "1.5px solid #D1D5DB", background: "white",
                      color: "#374151", fontSize: 15, fontWeight: 600,
                      cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    {tr.skipStep}
                  </button>
                  <button
                    onClick={() => { setPhase(1); setStep(1); setData({}); }}
                    style={{
                      padding: "14px 44px", borderRadius: 999, border: "none",
                      background: BLUE_GRAD,
                      color: "white", fontSize: 15, fontWeight: 700,
                      cursor: "pointer", fontFamily: F,
                      boxShadow: "0 4px 16px rgba(37,99,235,0.28)",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    {tr.nextStep}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── STEP FORM ── */
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{
                background: "white", borderRadius: 20,
                boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
                display: "flex", minHeight: 620,
                overflow: "hidden",
              }}>
                <Sidebar
                  currentStep={step}
                  steps={ACTIVE_STEPS}
                  sidebarTitle={isFulltime ? tr.fulltimeRegisterTitle : tr.registerTitle}
                  sidebarSubtitle={tr.registerSubtitle}
                  helpTitle={tr.helpTitle}
                  helpDesc={tr.helpDesc}
                  onStepClick={(id) => setStep(id)}
                />
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: 1, padding: "40px 52px", overflowY: "auto" }}>
                    <div style={{ marginBottom: 28 }}>
                      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 8px", fontFamily: F }}>
                        {currentStepInfo.label}
                      </h2>
                      <p style={{ fontSize: 14, color: "#6B7280", margin: 0, fontFamily: F }}>
                        {ACTIVE_SUBTITLES[step - 1]}
                      </p>
                    </div>
                    <StepContent data={data} setData={setData} onOpenAi={StepContent === Step7 ? handleOpenAiContractChat : handleOpenAiChat} />
                  </div>
                  <BottomButtons
                    onSkip={() => { if (step > 1) setStep(s => s - 1); else setPhase(0); }}
                    onNext={() => { if (step < totalSteps) setStep(s => s + 1); else handleComplete(); }}
                    nextLabel={step === totalSteps ? tr.finalLabel : tr.nextStep}
                    isFinal={step === totalSteps}
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        <ChatBot />

        {/* ─── 등록 완료 모달 ─── */}
        {showCompleteModal && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.52)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "white", borderRadius: 24,
              padding: "44px 48px 36px",
              width: 480, maxWidth: "90vw",
              position: "relative",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              textAlign: "center",
            }}>
              {/* X 버튼 */}
              <button
                onClick={() => { setShowCompleteModal(false); navigate(isPartner ? "/partner_dashboard?tab=starting_projects" : "/client_dashboard?tab=starting_projects"); }}
                style={{
                  position: "absolute", top: 16, right: 20,
                  background: "none", border: "none", cursor: "pointer",
                  color: "#9CA3AF", fontSize: 22, lineHeight: 1,
                  padding: 4, borderRadius: 6, transition: "color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#374151"}
                onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
              >✕</button>

              {/* 이모지 */}
              <div style={{ fontSize: 52, marginBottom: 16 }}>🥳🎉</div>

              {/* 제목 */}
              <h2 style={{
                fontSize: 20, fontWeight: 800, color: "#111827",
                margin: "0 0 12px", fontFamily: F, lineHeight: 1.4,
              }}>
                {tr.completeTitle(isFulltime)}
              </h2>

              {/* description */}
              <p style={{
                fontSize: 14, color: "#6B7280", margin: "0 0 32px",
                fontFamily: F, lineHeight: 1.7,
              }}>
                {tr.completeDesc}<br />
                <strong style={{ color: "#2563EB" }}>{tr.completeCta}</strong> {tr.completeDescEnd}
              </p>

              {/* 버튼 2개 */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={() => { setShowCompleteModal(false); navigate("/partner_search"); }}
                  style={{
                    padding: "12px 28px", borderRadius: 999, border: "none",
                    background: PRIMARY_GRAD,
                    color: "white", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", fontFamily: F,
                    boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  {tr.findPartner}
                </button>
                <button
                  onClick={() => { setShowCompleteModal(false); navigate(isPartner ? "/partner_dashboard?tab=starting_projects" : "/client_dashboard?tab=starting_projects"); }}
                  style={{
                    padding: "12px 28px", borderRadius: 999,
                    border: "1.5px solid #E5E7EB", background: "white",
                    color: "#374151", fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
                >
                  {tr.projectDashboard}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
