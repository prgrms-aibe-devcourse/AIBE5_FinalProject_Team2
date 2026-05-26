import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header_partner from "../components/Header_partner";
import mascotIcon from "../assets/hero_check.png";
import heroStudent from "../assets/hero_student.png";
import { chatWithAI, langInstruction } from "../lib/aiClient";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";
const SUCCESS_GRAD = "linear-gradient(135deg, #34D399 0%, #10B981 100%)";

/* ─────────────────────────────────────────────────────────
   대화 단계
   ASK_VERIFY → VERIFY_EMAIL → VERIFY_CODE → ASK_PDF → PARSING_PDF
   → ASK_GITHUB → FETCHING_GH → DONE
   ───────────────────────────────────────────────────────── */

const Q1_INTRO_BY_LANG = {
  ko: null,
  en: `Hi! I'm Haenguni, your AI profile assistant 🐣

Filling out a profile by hand is tedious, right? I'll **only ask 3 things** and fill in almost everything for you!

────────────────────

**1️⃣ You haven't verified your school or company yet!**

A verification badge **boosts your trust score** ✨
Do you have a **company email** or **school email** you'd like to verify?`,
  zh: `您好！我是协助您填写资料的 AI 幸运鸟 🐣

逐一填写资料很麻烦吧？我只问 **3 个问题**，就能为您填写几乎所有内容！

────────────────────

**1️⃣ 您还未认证学校或公司！**

认证后 **信任推荐度将提高** ✨
是否有可用于认证的 **公司邮箱** 或 **学校邮箱**？`,
};
const Q1_INTRO = `안녕하세요! 저는 프로필 작성을 도와드리는 AI 매니저예요 🐣

개발자분들이 일일이 프로필 채우는 거 번거로우시죠? 제가 **3가지만 여쭤보고** 거의 다 채워드릴게요!

──────────────────────

**1️⃣ 아직 학교나 회사 인증을 안 하셨네요!**

인증 마크를 달면 **신뢰 추천도가 올라가요** ✨
인증받고 싶으신 **회사메일** 또는 **학교메일**이 있으신가요?`;

const Q2_INTRO_BY_LANG = {
  ko: null,
  en: `Great! Next question 😊

────────────────────

**2️⃣ Do you already have a CV or Portfolio PDF?**

Upload the PDF and I'll **read it and auto-fill your profile**!
Experience / education / awards / certifications / bio — all at once 📄✨`,
  zh: `太好了！下一个问题 😊

────────────────────

**2️⃣ 您是否已有 CV 或作品集 PDF？**

上传 PDF，我会 **读取内容并自动填写资料**！
经历 / 学历 / 获奖 / 证书 / 个人简介，一次搞定 📄✨`,
};
const Q2_INTRO = `좋아요! 다음 질문이에요 😊

──────────────────────

**2️⃣ 이미 작성하신 CV나 Portfolio PDF가 있으신가요?**

PDF 파일을 올려주시면 **내용을 읽어와서 프로필 규격에 맞게 자동으로 채워드릴게요!**
경력 / 학력 / 수상 / 자격증 / 자기소개까지 한 번에요 📄✨`;

const Q3_INTRO_BY_LANG = {
  ko: null,
  en: `Awesome! Last question 🚀

────────────────────

**3️⃣ Share your GitHub profile or repository URL!**

e.g. https://github.com/torvalds or https://github.com/torvalds/linux

I'll link GitHub to your profile and auto-suggest your skill set! 💻⭐`,
  zh: `太棒了！最后一个问题 🚀

────────────────────

**3️⃣ 请告诉我您的 GitHub 资料或仓库 URL！**

例：https://github.com/torvalds 或 https://github.com/torvalds/linux

我会将 GitHub 链接到您的资料，并自动推荐技能集！💻⭐`,
};
const Q3_INTRO = `훌륭해요! 마지막 질문입니다 🚀

──────────────────────

**3️⃣ GitHub 프로필 또는 저장소 URL을 알려주세요!**

예: https://github.com/torvalds 또는 https://github.com/torvalds/linux

입력하면 프로필에 GitHub 링크가 연동되고, 스킬셋도 자동으로 제안드려요! 💻⭐`;

/* ─────────────────────────────────────────
   이메일 도메인 → 학교/회사 이름 매핑 (시연용)
   ──────────────────────────────────────── */
// aliases: 한/영 학교명 변형. PDF 파싱·AI chat 결과가 영문일 수도 있으므로
// 이메일 인증 시 같은 학교의 모든 entry 에 verified 마크가 자동 전파되도록 검사용.
const SCHOOL_DOMAIN_MAP = {
  "korea.ac.kr":  { name: "고려대학교",     type: "대학교(4년)", aliases: ["고려대학교", "고려대", "korea university", "ku"] },
  "snu.ac.kr":    { name: "서울대학교",     type: "대학교(4년)", aliases: ["서울대학교", "서울대", "seoul national university", "snu"] },
  "yonsei.ac.kr": { name: "연세대학교",     type: "대학교(4년)", aliases: ["연세대학교", "연세대", "yonsei university"] },
  "kaist.ac.kr":  { name: "KAIST",          type: "대학교(4년)", aliases: ["kaist", "한국과학기술원"] },
  "postech.ac.kr":{ name: "POSTECH",        type: "대학교(4년)", aliases: ["postech", "포항공과대학교", "포스텍"] },
  "hanyang.ac.kr":{ name: "한양대학교",     type: "대학교(4년)", aliases: ["한양대학교", "한양대", "hanyang university"] },
  "skku.edu":     { name: "성균관대학교",   type: "대학교(4년)", aliases: ["성균관대학교", "성균관대", "sungkyunkwan university", "skku"] },
  "sogang.ac.kr": { name: "서강대학교",     type: "대학교(4년)", aliases: ["서강대학교", "서강대", "sogang university"] },
  "cau.ac.kr":    { name: "중앙대학교",     type: "대학교(4년)", aliases: ["중앙대학교", "중앙대", "chung-ang university", "chungang university"] },
  "khu.ac.kr":    { name: "경희대학교",     type: "대학교(4년)", aliases: ["경희대학교", "경희대", "kyung hee university", "kyunghee university"] },
  "unist.ac.kr":  { name: "UNIST",          type: "대학교(4년)", aliases: ["unist", "울산과학기술원"] },
  "ewha.ac.kr":   { name: "이화여자대학교", type: "대학교(4년)", aliases: ["이화여자대학교", "이화여대", "ewha womans university", "ewha university"] },
};
const COMPANY_DOMAIN_MAP = {
  "samsung.com": "삼성전자",
  "lge.com":     "LG전자",
  "sk.com":      "SK그룹",
  "hyundai.com": "현대자동차",
  "kakao.com":   "카카오",
  "navercorp.com":"네이버",
  "naver.com":   "네이버",
  "line.me":     "라인",
  "coupang.com": "쿠팡",
  "woowahan.com":"우아한형제들",
  "toss.im":     "토스",
  "krafton.com": "크래프톤",
  "nexon.co.kr": "넓슨",
  "ncsoft.com":  "엔쥏소프트",
};
function lookupSchoolByEmail(email) {
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (SCHOOL_DOMAIN_MAP[domain]) return SCHOOL_DOMAIN_MAP[domain];
  // .ac.kr 도메인은 대학교로 간주, 이름은 도메인 앞자리로
  if (domain.endsWith(".ac.kr")) {
    const base = domain.split(".")[0];
    return { name: base.toUpperCase() + "대학교", type: "대학교(4년)" };
  }
  return { name: domain, type: "대학교(4년)" };
}
function lookupCompanyByEmail(email) {
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (COMPANY_DOMAIN_MAP[domain]) return COMPANY_DOMAIN_MAP[domain];
  return domain.split(".")[0].toUpperCase();
}

/* GitHub URL에서 handle/repo 추출 */
function parseGithubUrl(input) {
  const s = input.trim().replace(/\.git$/, "");
  // github.com/handle 또는 github.com/handle/repo
  const m = s.match(/github\.com[/:]+([\w-]+)(?:\/([\w.-]+))?/i);
  if (m) {
    const handle = m[1];
    const repo = m[2] || "";
    return {
      handle,
      repo,
      profileUrl: `https://github.com/${handle}`,
      repoUrl: repo ? `https://github.com/${handle}/${repo}` : `https://github.com/${handle}`,
    };
  }
  // 그냥 handle만 입력한 경우
  if (/^[\w-]+$/.test(s)) {
    return { handle: s, repo: "", profileUrl: `https://github.com/${s}`, repoUrl: `https://github.com/${s}` };
  }
  return null;
}

const DONE_MSG = `🎉 **세 가지 질문에 충실히 답해주신 덕분에 프로필을 대부분 완성했어요!**

아래 요약을 확인하시고 **"프로필에 적용하기"** 버튼을 눌러주세요. 프로필 등록 페이지에 모든 내용이 자동으로 채워져 있을 거예요 ✨`;

/* ─────────────────────────────────────────────────────────
   PDF 파싱: pdfjs-dist를 esm.sh에서 동적 import
   ───────────────────────────────────────────────────────── */
let _pdfjsPromise = null;
async function loadPdfJs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const pdfjs = await import(
        /* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.min.mjs"
      );
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";
      return pdfjs;
    })();
  }
  return _pdfjsPromise;
}

async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return text;
}

/* ─────────────────────────────────────────────────────────
   AI로 CV 텍스트를 구조화된 프로필로 변환
   ───────────────────────────────────────────────────────── */
const EXTRACT_SYSTEM = `너는 CV/이력서 PDF 텍스트를 구조화된 JSON으로 변환하는 도우미야.
반드시 아래 스키마의 JSON 객체 하나만 응답해. 코드블록(\`\`\`)이나 설명 없이 순수 JSON만 반환해.
모든 텍스트는 한국어로. 누락된 필드는 빈 문자열 "" 또는 빈 배열 []로.

"bio"와 "strengthDesc"는 CV의 경력/프로젝트/수상/자격증을 근거로 구체적이고 풍부하게 작성해야 해.
- "bio": 4~6문장. 본인의 전문 분야, 주요 경력 연차, 대표 도메인(예: 핀테크/이커머스/AI 등), 대표 기술 스택 2~3개, 일하는 방식이나 가치관까지 자연스럽게 한 단락으로. 1인칭("저는~합니다") 톤. 추상어 ("열정적인", "성실한") 만 나열하지 말고 실제 사례·숫자(연차, 프로젝트 규모 등)를 녹여서.
- "strengthDesc": 6~10문장 또는 3~5개 불릿. 본인이 가장 잘하는 업무 영역, 협업 스타일, 문제 해결 방식, 차별화된 강점을 구체적으로. 가능하면 "어떤 상황에서 무엇을 어떻게 해서 어떤 결과를 냈는지" 형태로. CV에 근거가 없으면 추정·창작하지 말고 일반적이지만 자연스러운 문장으로 보강.

**careers (가장 중요)**: CV 에 등장하는 **모든 소속/경력 entry 를 빠짐없이** 추출해.
- 일반 회사뿐 아니라 **연구소, 대학교 직원/조교, 인턴십, 계약직, 프리랜서, 정부과제 PI/연구원, 스타트업, 학회 활동** 도 모두 포함.
- 같은 기관에서 여러 직책/기간이 있으면 **각각 별도 entry** 로 분리 (예: POSTECH 학부 인턴 + POSTECH 박사후연구원 → 2 entries). 후처리에서 병합됨.
- companyName 은 가급적 한국어 정식 명칭 (예: "포항공과대학교", "고려대학교 통계연구소", "삼성전자").
- description 에는 주요 프로젝트·역할·기술·성과를 **2~3문장 이상** 구체적으로.
- 누락 의심 시 학력 섹션에서 추출하지 말고 careers 로 먼저 시도. 확실히 학력만이면 careers 에 안 넣어도 됨.

스키마:
{
 "bio": "위 가이드대로 작성한 4~6문장 자기소개",
 "strengthDesc": "위 가이드대로 작성한 강점/협업 스타일 문단 또는 불릿",
 "skills": [{"techName": "기술명", "proficiency": "초급|중급|고급|전문가", "experience": "1년 미만|1~3년|3~5년|5년 이상"}],
 "careers": [{"companyName": "회사/기관명", "jobTitle": "직무명", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "isCurrent": false, "description": "주요 업무·프로젝트·기술 2~3문장 요약"}],
 "educations": [{"schoolName": "학교명", "major": "전공", "degree": "학사|석사|박사", "graduationDate": "YYYY-MM"}],
 "awards": [{"awardName": "수상명", "awarding": "수여기관", "awardDate": "YYYY-MM-DD", "description": "수상 내역 요약"}],
 "certifications": [{"certName": "자격증명", "issuer": "발급기관", "acquiredDate": "YYYY-MM-DD"}]
}`;

function safeParseJson(str) {
  if (!str || typeof str !== "string") return null;

  // 1) 코드펜스 제거: ```json ... ``` / ``` ... ```
  let s = str.trim()
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 2) 그대로 시도
  try { return JSON.parse(s); } catch { /* continue */ }

  // 3) 첫 { 부터 균형 맞는 } 까지 잘라서 시도 (문자열 내부 중괄호 무시)
  const start = s.indexOf("{");
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = s.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch { /* fall through */ }
          break;
        }
      }
    }
  }

  // 4) greedy 매치 시도
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* ignore */ }
  }

  // 5) 잘린 JSON 복구 시도: 미닫힌 문자열/배열/객체를 닫아준다.
  //    Gemini가 maxOutputTokens 한도로 응답이 끊긴 케이스 (예: "graduationDate": "2018 에서 끊김)
  const recovered = tryRecoverTruncatedJson(s.slice(s.indexOf("{")));
  if (recovered) {
    try { return JSON.parse(recovered); } catch { /* ignore */ }
  }
  return null;
}

/**
 * 잘린 JSON 문자열을 닫아 파싱 가능한 형태로 복구 시도.
 * - 마지막 미완성 토큰(콤마 뒤 공백, 미닫힌 문자열 등)을 잘라내고
 * - 열린 [ { 와 문자열을 역순으로 닫는다.
 */
function tryRecoverTruncatedJson(input) {
  if (!input || input[0] !== "{") return null;
  let s = input;

  // 5-1) 일단 열린/닫힌 따옴표·괄호 상태를 추적
  const stack = []; // '{' or '['
  let inStr = false, esc = false;
  let lastCommaIdx = -1, lastSafeEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      lastSafeEnd = i;
    } else if (ch === ",") {
      lastCommaIdx = i;
    }
  }

  // 5-2) 문자열 안에서 끊긴 경우: 마지막 콤마(또는 안전한 닫힘) 직후까지만 잘라낸다.
  if (inStr) {
    const cut = Math.max(lastCommaIdx, lastSafeEnd);
    if (cut <= 0) return null;
    s = s.slice(0, cut); // 콤마 자체는 자르지 않음 → 곧 콤마 정리
  }

  // 5-3) 후행 콤마/공백 정리
  s = s.replace(/[,\s]+$/g, "");
  // "key": 처럼 값 없이 끝난 경우 그 키도 잘라냄
  s = s.replace(/,\s*"[^"\\]*"\s*:\s*$/g, "");
  s = s.replace(/\{\s*"[^"\\]*"\s*:\s*$/g, "{");

  // 5-4) 남은 스택 역순으로 닫기
  // 위에서 s를 잘라냈으므로 stack을 다시 계산
  const stack2 = [];
  let inStr2 = false, esc2 = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr2) {
      if (esc2) esc2 = false;
      else if (ch === "\\") esc2 = true;
      else if (ch === '"') inStr2 = false;
      continue;
    }
    if (ch === '"') { inStr2 = true; continue; }
    if (ch === "{" || ch === "[") stack2.push(ch);
    else if (ch === "}" || ch === "]") stack2.pop();
  }
  if (inStr2) s += '"'; // 안전망
  while (stack2.length) {
    const open = stack2.pop();
    s += open === "{" ? "}" : "]";
  }
  return s;
}

async function extractProfileFromPdf(text) {
  const res = await fetch("/api/ai/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: EXTRACT_SYSTEM,
      text: `다음은 CV PDF에서 추출한 텍스트야. 위 스키마대로 JSON만 반환해줘:\n\n${text.slice(0, 12000)}`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI 요청 실패 (${res.status})`);
  }
  const data = await res.json();
  const parsed = safeParseJson(data.reply);
  if (!parsed) {
    console.error("[extractProfileFromPdf] AI 원본 응답:", data.reply);
    throw new Error("AI 응답을 JSON으로 파싱하지 못했어요 (콘솔에서 원본 응답 확인)");
  }
  return parsed;
}

/* ─────────────────────────────────────────────────────────
   GitHub 이메일 → 스킬/공헌도 (Mock)
   ───────────────────────────────────────────────────────── */
function _mockGithubAnalysis(email) {
  const seed = email.split("@")[0] || "user";
  const skillPool = [
    { techName: "TypeScript", commits: 1248 },
    { techName: "Python",     commits: 982  },
    { techName: "React",      commits: 765  },
    { techName: "Node.js",    commits: 543  },
    { techName: "Docker",     commits: 312  },
    { techName: "FastAPI",    commits: 187  },
  ];
  const skills = skillPool.slice(0, 4 + (seed.length % 3));
  return {
    email,
    handle: seed,
    totalCommits: skills.reduce((a, b) => a + b.commits, 0),
    publicRepos: 14 + (seed.length % 12),
    skills,
    topRepo: `${seed}/awesome-project`,
  };
}

/* ─────────────────────────────────────────────────────────
   메인 컴포넌트
   ───────────────────────────────────────────────────────── */
export default function AIchatProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLanguage();
  const {
    partnerProfileDetail, updatePartnerProfileDetail,
    clientProfileDetail, updateClientProfileDetail,
    userRole,
    syncProfileDetailToServer,
  } = useStore();
  const isClient = userRole === "client";
  const updateProfileDetail = isClient ? updateClientProfileDetail : updatePartnerProfileDetail;
  const profileDetail = isClient ? clientProfileDetail : partnerProfileDetail;
  const profileBackPath = isClient ? "/client_profile" : "/partner_profile";

  // 헤더와 동일한 hero 이미지 source
  const [dbHero, setDbHero] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await profileApi.getMyDetail();
        if (!cancelled) setDbHero(data?.profileImageUrl || null);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const userHero = (() => {
    const raw = dbHero || profileDetail?.heroImage;
    if (raw && /cdn\.Alpha-Helix\.com/i.test(raw)) return heroStudent;
    return raw || heroStudent;
  })();

  const [messages, setMessages] = useState([
    { role: "bot", text: (lang !== "ko" && Q1_INTRO_BY_LANG[lang]) || Q1_INTRO, time: new Date() },
  ]);
  const [step, setStep] = useState("ASK_VERIFY");
  const [busy, setBusy] = useState(false);

  // 수집 데이터
  const [verifyType, setVerifyType] = useState(null); // 'school' | 'company'
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState(null);
  const [pdfProfile, setPdfProfile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [githubData, setGithubData] = useState(null);

  // 입력 상태
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [freeInput, setFreeInput] = useState("");

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // GitHub 링크만 등록하고 싶은 사용자 → 바로 3단계로 점프
  useEffect(() => {
    if (location.state?.startAt === "github") {
      setMessages([
        { role: "bot", text: `바로 GitHub 연동부터 시작할게요! 🚀\n\n${(lang !== "ko" && Q3_INTRO_BY_LANG[lang]) || Q3_INTRO}`, time: new Date() },
      ]);
      setStep("ASK_GITHUB");
    }
  }, [location.state?.startAt]);

  const pushBot = (text) =>
    setMessages((p) => [...p, { role: "bot", text, time: new Date() }]);
  const pushUser = (text) =>
    setMessages((p) => [...p, { role: "user", text, time: new Date() }]);

  /* ─── Q1 인증 ─── */
  const handleChooseVerify = (type) => {
    setVerifyType(type);
    pushUser(type === "school" ? "학교 메일로 인증할게요" : "회사 메일로 인증할게요");
    pushBot(`${type === "school" ? "학교" : "회사"} 메일을 입력해 주세요. 입력하시면 인증번호 6자리를 보내드릴게요 📧`);
    setStep("VERIFY_EMAIL");
  };

  const handleSkipVerify = () => {
    pushUser("이번엔 건너뛸게요");
    pushBot("알겠습니다! 인증은 나중에 마이페이지에서 진행할 수 있어요 👌");
    goAskPdf();
  };

  const handleSendCode = async () => {
    const email = emailInput.trim();
    if (!email || !email.includes("@")) return;
    pushUser(email);
    setPendingEmail(email);
    setEmailInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/verify/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `발송 실패 (${res.status})`);
      pushBot(`✉️ **${email}** 으로 인증번호를 보냈어요!

받은 메일에서 6자리 코드를 확인하시고 아래에 입력해 주세요. (5분 내 유효)`);
      setStep("VERIFY_CODE");
    } catch (err) {
      console.error("[verify] send-code 실패:", err);
      pushBot(`메일 발송 중 오류가 발생했어요 😢\n(${err.message})\n\n다시 시도하시거나 "건너뛰기"를 눌러주세요.`);
      setStep("VERIFY_EMAIL");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (codeInput.length !== 6) return;
    pushUser(codeInput);
    setBusy(true);
    try {
      const res = await fetch("/api/verify/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: codeInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setVerifiedEmail({ type: verifyType, email: pendingEmail });
        pushBot(`✅ **인증 완료!** ${verifyType === "school" ? "학교" : "회사"} 인증 마크가 프로필에 부여돼요 🎖️`);
        setCodeInput("");
        goAskPdf();
      } else {
        pushBot(`앗, ${data.error || "인증번호가 일치하지 않거나 만료되었어요"} 🙏`);
        setCodeInput("");
      }
    } catch (err) {
      console.error("[verify] check-code 실패:", err);
      pushBot(`인증 확인 중 오류가 발생했어요 😢\n(${err.message})`);
      setCodeInput("");
    } finally {
      setBusy(false);
    }
  };

  const goAskPdf = () => {
    setTimeout(() => {
      pushBot((lang !== "ko" && Q2_INTRO_BY_LANG[lang]) || Q2_INTRO);
      setStep("ASK_PDF");
    }, 400);
  };

  /* ─── Q2 PDF ─── */
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      pushBot("PDF 파일만 업로드할 수 있어요 🙏");
      return;
    }
    pushUser(`📎 ${file.name} 업로드`);
    setPdfFileName(file.name);
    setStep("PARSING_PDF");
    setBusy(true);
    try {
      const text = await extractPdfText(file);
      pushBot(`📖 PDF에서 약 ${text.length.toLocaleString()}자를 읽어왔어요. AI가 구조화된 프로필로 정리하고 있어요...`);
      const profile = await extractProfileFromPdf(text);
      setPdfProfile(profile);
      const summary = [
        profile.skills?.length ? `🛠️ 보유 기술 **${profile.skills.length}개**` : null,
        profile.careers?.length ? `💼 경력 **${profile.careers.length}건**` : null,
        profile.educations?.length ? `🎓 학력 **${profile.educations.length}건**` : null,
        profile.awards?.length ? `🏆 수상 **${profile.awards.length}건**` : null,
        profile.certifications?.length ? `🏅 자격증 **${profile.certifications.length}건**` : null,
      ].filter(Boolean).join(" · ");
      pushBot(`✅ 추출 완료!\n\n${summary || "텍스트는 읽었지만 구조화된 항목이 부족해요."}`);
      goAskGithub();
    } catch (err) {
      console.error("[PDF] 처리 실패:", err);
      pushBot(`PDF 처리 중 오류가 발생했어요 😢\n(${err.message})\n\n건너뛰고 다음 질문으로 갈게요.`);
      goAskGithub();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSkipPdf = () => {
    pushUser("PDF는 없어요");
    pushBot("괜찮아요! 다음 질문으로 갈게요 😊");
    goAskGithub();
  };

  const goAskGithub = () => {
    setTimeout(() => {
      pushBot((lang !== "ko" && Q3_INTRO_BY_LANG[lang]) || Q3_INTRO);
      setStep("ASK_GITHUB");
    }, 400);
  };

  /* ─── Q3 GitHub URL ─── */
  const handleGithubSubmit = async () => {
    const input = githubInput.trim();
    if (!input) return;
    pushUser(input);
    const parsed = parseGithubUrl(input);
    if (!parsed) {
      pushBot(`흐음, GitHub URL 형식이 좀 이상해요 🤔\n예를 들어 \`https://github.com/torvalds\` 같은 형태로 다시 입력해 주세요.`);
      return;
    }
    setStep("FETCHING_GH");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    // 시연용 mock 데이터 (handle 기반)
    const seed = parsed.handle;
    const skillPool = [
      { techName: "TypeScript", commits: 1248 },
      { techName: "Python",     commits: 982  },
      { techName: "React",      commits: 765  },
      { techName: "Node.js",    commits: 543  },
      { techName: "Docker",     commits: 312  },
      { techName: "FastAPI",    commits: 187  },
    ];
    const skills = skillPool.slice(0, 4 + (seed.length % 3));
    const data = {
      handle: parsed.handle,
      repo: parsed.repo,
      profileUrl: parsed.profileUrl,
      repoUrl: parsed.repoUrl,
      totalCommits: skills.reduce((a, b) => a + b.commits, 0),
      publicRepos: 14 + (seed.length % 12),
      skills,
    };
    setGithubData(data);
    setBusy(false);
    pushBot(`🐙 **${data.handle}** 계정 분석 완료!

🔗 프로필 URL: ${data.profileUrl}
${data.repo ? `📦 대표 레포: ${data.repo}\n` : ""}
주요 기술 스택:
${data.skills.map((s) => `• **${s.techName}** — ${s.commits.toLocaleString()} commits`).join("\n")}`);
    setGithubInput("");
    setTimeout(() => {
      pushBot(DONE_MSG);
      pushBot("💬 프로필에 추가로 반영하고 싶은 내용이 있으시면 자유롭게 말씀해 주세요! 없으시면 아래 초록 버튼을 눌러 적용하세요 👇");
      setStep("DONE");
    }, 600);
  };

  const handleSkipGithub = () => {
    pushUser("GitHub 연동은 나중에요");
    pushBot("알겠습니다! 그럼 지금까지 모은 정보로 프로필을 정리해드릴게요 ✨");
    setTimeout(() => {
      pushBot(DONE_MSG);
      pushBot("💬 프로필에 추가로 반영하고 싶은 내용이 있으시면 자유롭게 말씀해 주세요! 없으시면 아래 초록 버튼을 눌러 적용하세요 👇");
      setStep("DONE");
    }, 400);
  };

  const handleFreeChat = async () => {
    const input = freeInput.trim();
    if (!input || busy) return;
    pushUser(input);
    setFreeInput("");
    setBusy(true);
    try {
      const context = [
        pdfProfile ? `PDF 프로필 요약: 스킬 ${pdfProfile.skills?.length || 0}개, 경력 ${pdfProfile.careers?.length || 0}건, 학력 ${pdfProfile.educations?.length || 0}건` : "",
        githubData ? `GitHub: @${githubData.handle}, ${githubData.publicRepos} repos` : "",
        verifiedEmail ? `이메일 인증: ${verifiedEmail.email}` : "",
      ].filter(Boolean).join("\n");
      const reply = await chatWithAI(
        [{ role: "user", text: input }],
        `너는 ALPHA-HELIX 플랫폼의 AI 프로필 도우미 "AI 매니저"야. 사용자가 방금 3단계 프로필 자동 작성을 마쳤어.\n수집된 정보:\n${context}\n\n사용자가 추가 요청이나 질문을 할 수 있어. 친절하고 간결하게 답해줘.\n${langInstruction(lang)}`
      );
      pushBot(reply);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  /* ─── 적용하기: store에 병합 + 서버 DB 저장 ─── */
  const handleApply = async () => {
    // patch 는 기존 profileDetail 위에 시작 — 이전에 저장된 careers/educations
    // /skills 등이 이번 AI chat 결과에 없다고 사라지면 안 됨 (사용자 데이터 보호).
    // PDF/AI 가 새로 추출한 항목들은 아래에서 union(dedup) 으로 합침.
    const patch = { ...profileDetail };
    const baseId = Date.now();

    // ── PDF 프로필 병합 (PartnerProfile 폼 스키마와 정확히 일치) ──
    // dedup-union helper: 기존 배열 + 새 배열에서 같은 키의 항목은 새 값으로 덮되,
    // 기존에만 있는 항목은 그대로 보존. PDF/AI 가 일부만 추출했을 때 사용자가
    // 가지고 있던 다른 entries 가 사라지지 않도록 보호.
    const mergeDedup = (existing = [], incoming = [], keyFn) => {
      const map = new Map();
      (existing || []).forEach(item => { const k = keyFn(item); if (k) map.set(k, item); });
      (incoming || []).forEach(item => { const k = keyFn(item); if (k) map.set(k, item); });
      return Array.from(map.values());
    };
    const normKey = (s) => {
      const COMPANY_ALIAS_FLAT = {
        "삼성전자": ["samsung electronics", "samsung", "samsungelectronics"],
        "lg전자": ["lg electronics", "lge", "lgelectronics"],
        "sk하이닉스": ["sk hynix", "skhynix"],
        "현대자동차": ["hyundai motor", "hyundai", "hyundaimotorcompany"],
        "카카오": ["kakao"], "네이버": ["naver", "navercorp"],
        "포항공과대학교": ["postech", "포스텍"],
        "고려대학교": ["korea university", "고려대"],
        "서울대학교": ["seoul national university", "snu", "서울대"],
        "연세대학교": ["yonsei university", "연세대"],
        "한국과학기술원": ["kaist"],
        "국립통계연구원": ["statistics research institute", "국가통계연구센터", "국가통계센터", "통계연구원", "통계청"],
      };
      const m = new Map();
      for (const [canon, aliases] of Object.entries(COMPANY_ALIAS_FLAT)) {
        m.set(canon.replace(/\s+/g, "").toLowerCase(), canon);
        for (const a of aliases) m.set(a.replace(/\s+/g, "").toLowerCase(), canon);
      }
      const base = (s || "").toString().toLowerCase().replace(/\s+/g, "")
        .replace(/(주식회사|주|co\.|corp\.?|inc\.?|ltd\.?|llc\.?|gmbh|corporation|company)$/g, "")
        .replace(/사업부$/g, "").replace(/연구소$/g, "").replace(/랩$/g, "");
      // 삼성 계열 강제 통합
      if (base.includes("samsung") || base.includes("삼성")) return "삼성전자";
      return m.get(base) || base;
    };

    let educations = [];
    let careers = [];

    if (pdfProfile) {
      if (pdfProfile.bio) patch.bio = pdfProfile.bio;
      if (pdfProfile.strengthDesc) patch.strengthDesc = pdfProfile.strengthDesc;

      if (pdfProfile.skills?.length) {
        const newSkills = pdfProfile.skills.map((s, i) => ({
          id: baseId + i,
          techName: s.techName || "",
          customTech: "",
          proficiency: s.proficiency || "중급",
          experience: s.experience || "1~3년",
          mode: "saved",
        }));
        // 기존 skills + PDF skills, techName 으로 dedup (PDF 값이 우선)
        patch.skills = mergeDedup(patch.skills || [], newSkills, (s) => normKey(s.techName));
      }

      if (pdfProfile.careers?.length) {
        // ── 같은 회사 이력은 하나로 묶고, 각 세부 이력은 프로젝트로 정리 ──
        // 한/영 회사명 통합 매핑 (양방향)
        const COMPANY_ALIAS = {
          // 삼성 계열: 이름에 'samsung' 또는 '삼성' 포함이면 모두 삼성전자로 통일 (후처리에서 별도 처리)
          "삼성전자": ["samsung electronics", "samsung", "samsungelectronics", "삼성전자인텔리전스데이터사이언스연구소", "삼성인텔리전스데이터사이언스", "samsung intelligence data science", "삼성메모리사업부", "samsung memory", "삼성전자메모리사업부"],
          // 삼성 prefix 캐치: 아래 normCompany에서 추가로 처리
          "lg전자": ["lg electronics", "lge", "lgelectronics"],
          "sk하이닉스": ["sk hynix", "skhynix"],
          "현대자동차": ["hyundai motor", "hyundai", "hyundaimotorcompany"],
          "카카오": ["kakao"],
          "네이버": ["naver", "navercorp", "naver corp"],
          "라인": ["line", "line corporation", "linecorporation"],
          "쿠팡": ["coupang"],
          "우아한형제들": ["woowahan", "woowahan brothers", "배달의민족"],
          "토스": ["toss", "viva republica", "vivarepublica"],
          "크래프톤": ["krafton"],
          "포항공과대학교": ["postech", "포스텍"],
          "고려대학교": ["korea university", "고려대"],
          "서울대학교": ["seoul national university", "snu", "서울대"],
          "연세대학교": ["yonsei university", "연세대"],
          "한국과학기술원": ["kaist"],
          "국립통계연구원": ["statistics research institute", "국가통계연구센터", "국가통계센터", "통계연구원", "통계청"],
        };
        // 회사명 → 대표 한글명 매핑 구축
        const aliasToCanon = new Map();
        for (const [canon, aliases] of Object.entries(COMPANY_ALIAS)) {
          aliasToCanon.set(canon.replace(/\s+/g, "").toLowerCase(), canon);
          for (const a of aliases) aliasToCanon.set(a.replace(/\s+/g, "").toLowerCase(), canon);
        }
        const normCompany = (s) => {
          const base = (s || "").replace(/\s+/g, "").toLowerCase()
            .replace(/(주식회사|주|co\.|corp\.?|inc\.?|ltd\.?|llc\.?|gmbh|corporation|company)$/g, "")
            .replace(/사업부$/g, "").replace(/연구소$/g, "").replace(/랩$/g, "");
          // 삼성 계열 강제 통합: 'samsung' 또는 '삼성' 포함이면 무조건 삼성전자
          if (base.includes("samsung") || base.includes("삼성")) return "삼성전자";
          return aliasToCanon.get(base) || base;
        };
        const groups = new Map(); // key: 정규화된 회사명 → { companyName, items }
        pdfProfile.careers.forEach((c) => {
          const key = normCompany(c.companyName);
          if (!key) return;
          if (!groups.has(key)) {
            // 대표 표시명: 한글 우선, 없으면 원본
            const displayName = aliasToCanon.has(normCompany(c.companyName))
              ? aliasToCanon.get((c.companyName || "").replace(/\s+/g, "").toLowerCase()) || c.companyName
              : c.companyName;
            groups.set(key, { companyName: displayName, items: [] });
          }
          groups.get(key).items.push(c);
        });

        let gi = 0;
        for (const { companyName, items } of groups.values()) {
          // 시작일 오름차순으로 정렬 → 가장 최근 직무를 대표로
          const sorted = [...items].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
          const earliest = sorted[0];
          const latest = sorted[sorted.length - 1];
          const anyCurrent = items.some((x) => x.isCurrent);

          // 이력이 1개면 프로젝트 없이 그대로, 2개 이상이면 모든 세부 이력을 프로젝트로 추가
          const projects = items.length > 1
            ? sorted.map((x, pi) => ({
                id: baseId + 1000 + gi * 100 + pi,
                name: x.jobTitle || x.description?.split(/[.\n]/)[0] || `프로젝트 ${pi + 1}`,
                startDate: x.startDate || "",
                endDate: x.isCurrent ? "" : (x.endDate || ""),
                description: x.description || "",
              }))
            : [];

          careers.push({
            id: baseId + 1000 + gi,
            company: companyName || "",
            mainTech: latest.jobTitle || "",
            companyName: companyName || "",
            jobTitle: latest.jobTitle || "",
            startDate: earliest.startDate || "",
            endDate: anyCurrent ? "" : (latest.endDate || ""),
            current: anyCurrent,
            isCurrent: anyCurrent,
            type: "정규직",
            employmentType: "정규직",
            role: "백엔드 개발자",
            level: "중급",
            description: items.length > 1 ? "" : (earliest.description || ""),
            projects,
          });
          gi++;
        }
      }

      if (pdfProfile.educations?.length) {
        // 한글 학교명 → 영문명 변환 (AI가 한글만 줘도 영문으로 저장)
        const SCHOOL_KO_TO_EN = {
          "고려대학교": "Korea University", "고려대": "Korea University",
          "서울대학교": "Seoul National University", "서울대": "Seoul National University",
          "연세대학교": "Yonsei University", "연세대": "Yonsei University",
          "포항공과대학교": "POSTECH", "포스텍": "POSTECH",
          "한국과학기술원": "KAIST",
          "성균관대학교": "Sungkyunkwan University",
          "한양대학교": "Hanyang University",
          "이화여자대학교": "Ewha Womans University",
          "시카고 대학교": "University of Chicago", "시카고대학교": "University of Chicago",
        };
        // 학교명 → 영문명 우선 반환 (한글이면 영문으로 변환, 영문이면 그대로)
        const toEnSchoolName = (name) => {
          const trimmed = (name || "").trim();
          return SCHOOL_KO_TO_EN[trimmed] || trimmed;
        };
        // dedup용 정규화 키 (한/영 동일 학교 → 같은 key)
        const normSchool = (name) => {
          const en = toEnSchoolName(name);
          return en.toLowerCase().replace(/\s+/g, "");
        };

        // 같은 학교+학위는 하나만 유지 (Map으로 dedup)
        const engFirst = new Map();
        for (const e of pdfProfile.educations) {
          const deg = (e.degree || "bachelor").trim();
          let schoolType = "대학교(4년)";
          let degreeType = "학사";
          const degL = deg.toLowerCase();
          if (degL.includes("phd") || degL.includes("ph.d") || degL.includes("박사") || degL.includes("doctor")) {
            schoolType = "대학원(박사)"; degreeType = "박사";
          } else if (degL.includes("m.s") || degL.includes("ms ") || degL.includes("master") || degL.includes("석사")) {
            schoolType = "대학원(석사)"; degreeType = "석사";
          }
          // 재학중 여부: isCurrent=true 또는 graduationDate에 'now'/'present'/'현재' 포함
          const gradRaw = (e.graduationDate || "").toLowerCase();
          const isCurrent = e.isCurrent === true || gradRaw.includes("now") || gradRaw.includes("현재") || gradRaw.includes("present");
          // 항상 영문명으로 저장
          const schoolNameEn = toEnSchoolName(e.schoolName || "");
          const schoolKey = normSchool(e.schoolName) + "|" + degreeType;
          const entry = {
            schoolType,
            schoolName: schoolNameEn,
            track: "",
            major: e.major || "",
            degreeType,
            status: isCurrent ? "재학중" : "졸업",
            admissionDate: "",
            graduationDate: isCurrent ? "" : (e.graduationDate || ""),
            gpa: "",
            gpaScale: "4.5",
            researchTopic: "",
          };
          // 같은 key가 없으면 추가, 있으면 영문명 entry로 덮어쓰기
          if (!engFirst.has(schoolKey)) {
            engFirst.set(schoolKey, entry);
          } else {
            const existing = engFirst.get(schoolKey);
            const existingIsEng = /[a-zA-Z]/.test((existing.schoolName || "").slice(0, 3));
            const newIsEng = /[a-zA-Z]/.test(schoolNameEn.slice(0, 3));
            if (!existingIsEng && newIsEng) engFirst.set(schoolKey, entry);
          }
        }
        educations = Array.from(engFirst.values()).map((e, i) => ({ ...e, id: baseId + 2000 + i }));
      }

      if (pdfProfile.awards?.length) {
        const newAwards = pdfProfile.awards.map((a, i) => ({
          id: baseId + 3000 + i,
          awardName: a.awardName || "",
          awarding: a.awarding || "",
          awardDate: a.awardDate || "",
          description: a.description || "",
        }));
        patch.awards = mergeDedup(patch.awards || [], newAwards, (a) => normKey(a.awardName) + "|" + normKey(a.awardDate));
      }

      if (pdfProfile.certifications?.length) {
        const newCerts = pdfProfile.certifications.map((c, i) => ({
          id: baseId + 4000 + i,
          certName: c.certName || "",
          issuer: c.issuer || "",
          acquiredDate: c.acquiredDate || "",
        }));
        patch.certifications = mergeDedup(patch.certifications || [], newCerts, (c) => normKey(c.certName) + "|" + normKey(c.acquiredDate));
      }
    }

    // ── 이메일 인증 → 학교/회사 항목 자동 추가 + 인증마크 ──
    if (verifiedEmail?.type === "school") {
      const sch = lookupSchoolByEmail(verifiedEmail.email);
      // alias 배열 기반 매칭 — 한/영 학교명 모두 허용. 정규화 후 부분 일치.
      const aliases = (sch.aliases && sch.aliases.length ? sch.aliases : [sch.name])
        .map(a => a.toLowerCase().replace(/\s+/g, "").replace(/대학교|대학원|university/g, ""));
      const matchesSchool = (raw) => {
        if (!raw) return false;
        const norm = String(raw).toLowerCase().replace(/\s+/g, "").replace(/대학교|대학원|university/g, "");
        if (!norm) return false;
        return aliases.some(a => a && (norm.includes(a) || a.includes(norm)));
      };
      const matched = educations
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => matchesSchool(e.schoolName));
      if (matched.length > 0) {
        matched.forEach(({ i }) => {
          educations[i].verifiedSchool = true;
          educations[i].verifiedEmail = verifiedEmail.email;
        });
      }
      // 매칭 없을 때 새 항목 자동 추가하지 않음.
      // (PDF/AI 파싱이 영문명 "Korea University" 로 학력 만들었을 때 인증 후 한국어 "고려대학교" 가 추가로 생기는 중복 방지.
      //  실제 학력은 PartnerProfile/Client_Profile 진입 시 verifiedEmail 기준으로 retroactive 인증 마크가 자동 표시됨.)
    }
    if (verifiedEmail?.type === "company") {
      const companyName = lookupCompanyByEmail(verifiedEmail.email);
      const idx = careers.findIndex(
        (c) => c.company && companyName.includes(c.company.replace(/\s+/g, ""))
      );
      if (idx >= 0) {
        careers[idx].verifiedCompany = true;
        careers[idx].verifiedEmail = verifiedEmail.email;
      } else {
        careers.unshift({
          id: baseId + 9002,
          company: companyName,
          mainTech: "백엔드 개발자",
          companyName,
          jobTitle: "백엔드 개발자",
          startDate: "",
          endDate: "",
          current: true,
          isCurrent: true,
          type: "정규직",
          employmentType: "정규직",
          role: "백엔드 개발자",
          level: "중급",
          description: "",
          projects: [],
          verifiedCompany: true,
          verifiedEmail: verifiedEmail.email,
        });
      }
    }

    // educations: 학교 + 학위 조합으로 dedup (학사·석사·박사 별도 유지)
    if (educations.length) {
      // 한글→영문 변환 (파싱 블록과 동일한 매핑)
      const SCHOOL_KO_TO_EN_DEDUP = {
        "고려대학교": "Korea University", "고려대": "Korea University",
        "서울대학교": "Seoul National University", "서울대": "Seoul National University",
        "연세대학교": "Yonsei University", "연세대": "Yonsei University",
        "포항공과대학교": "POSTECH", "포스텍": "POSTECH",
        "한국과학기술원": "KAIST",
        "성균관대학교": "Sungkyunkwan University",
        "한양대학교": "Hanyang University",
        "이화여자대학교": "Ewha Womans University",
        "시카고 대학교": "University of Chicago", "시카고대학교": "University of Chicago",
      };
      const normSchoolKey = (name) => {
        const trimmed = (name || "").trim();
        const en = SCHOOL_KO_TO_EN_DEDUP[trimmed] || trimmed;
        return en.toLowerCase().replace(/\s+/g, "");
      };
      patch.educations = mergeDedup(
        patch.educations || [],
        educations,
        (e) => normSchoolKey(e.schoolName) + "|" + normKey(e.degreeType || e.degree),
      );
    }
    // careers: 회사명 기준 dedup (같은 회사 여러 기간은 PDF 측에서 이미 그룹핑됨)
    if (careers.length) {
      patch.careers = mergeDedup(patch.careers || [], careers, (c) => normKey(c.companyName || c.company));
    }

    // ── GitHub 스킬 병합 + URL 저장 ──
    if (githubData) {
      // 스킬 병합 (중복 제거)
      if (githubData.skills?.length) {
        const existing = new Set((patch.skills || []).map((s) => s.techName));
        const extra = githubData.skills
          .filter((s) => !existing.has(s.techName))
          .map((s, i) => ({
            id: baseId + 5000 + i,
            techName: s.techName,
            customTech: "",
            proficiency: s.commits > 800 ? "전문가" : s.commits > 400 ? "고급" : "중급",
            experience: s.commits > 800 ? "5년 이상" : "3~5년",
            mode: "saved",
          }));
        patch.skills = [...(patch.skills || []), ...extra];
      }
      // GitHub URL 저장 (프로필의 SNS/링크 영역)
      patch.githubUrl = githubData.profileUrl;
      patch.githubHandle = githubData.handle;
      if (githubData.repo) patch.githubRepoUrl = githubData.repoUrl;
    }

    if (verifiedEmail) {
      patch.verifiedEmail = verifiedEmail;
    }

    updateProfileDetail(patch);

    // ── 백엔드 DB 저장: PartnerProfile/Client_Profile 의 "전체 설정 저장하기"와 동일 경로 ──
    try {
      const result = await syncProfileDetailToServer(isClient ? "client" : "partner");
      if (!result?.ok) {
        console.warn("[AIchatProfile] 서버 저장 실패:", result?.reason, result?.error);
        if (result?.reason === "unauthenticated") {
          alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
        } else {
          alert("프로필을 서버에 저장하는 중 오류가 발생했어요. 프로필 관리 페이지에서 '전체 설정 저장하기'를 눌러주세요.");
        }
      }
    } catch (e) {
      console.error("[AIchatProfile] syncProfileDetailToServer 예외:", e);
    }

    navigate(profileBackPath);
  };

  /* ─── 텍스트 포매터 ─── */
  const formatText = (text) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((p, j) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={j}>{p.slice(2, -2)}</strong>
              : p
          )}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });

  /* ─── 단계별 입력 영역 렌더링 ─── */
  const renderStepInput = () => {
    if (busy) {
      return (
        <div style={{ padding: "16px 24px", color: "#64748B", fontSize: 13, fontFamily: F, textAlign: "center" }}>
          처리 중이에요... 잠시만요 ⏳
        </div>
      );
    }

    if (step === "ASK_VERIFY") {
      return (
        <div style={{ padding: "12px 24px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ChipBtn onClick={() => handleChooseVerify("school")}>🎓 학교 메일로 인증</ChipBtn>
          <ChipBtn onClick={() => handleChooseVerify("company")}>🏢 회사 메일로 인증</ChipBtn>
          <ChipBtn onClick={handleSkipVerify} variant="ghost">건너뛰기</ChipBtn>
        </div>
      );
    }

    if (step === "VERIFY_EMAIL") {
      return (
        <InputRow
          value={emailInput}
          onChange={setEmailInput}
          onSubmit={handleSendCode}
          placeholder={verifyType === "school" ? "예: hong@korea.ac.kr" : "예: hong@samsung.com"}
          buttonText="인증번호 받기"
          onSkip={handleSkipVerify}
        />
      );
    }

    if (step === "VERIFY_CODE") {
      return (
        <InputRow
          value={codeInput}
          onChange={(v) => setCodeInput(v.replace(/\D/g, "").slice(0, 6))}
          onSubmit={handleVerifyCode}
          placeholder="6자리 인증번호"
          buttonText="인증 확인"
          onSkip={handleSkipVerify}
        />
      );
    }

    if (step === "ASK_PDF") {
      return (
        <div style={{ padding: "12px 24px 16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 20px", borderRadius: 999, border: "none",
              background: PRIMARY_GRAD, color: "white",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: F, boxShadow: "0 2px 10px rgba(99,102,241,0.30)",
            }}
          >
            📄 PDF 파일 업로드
          </button>
          <ChipBtn onClick={handleSkipPdf} variant="ghost">PDF 없어요 / 건너뛰기</ChipBtn>
        </div>
      );
    }

    if (step === "ASK_GITHUB") {
      return (
        <InputRow
          value={githubInput}
          onChange={setGithubInput}
          onSubmit={handleGithubSubmit}
          placeholder="예: https://github.com/torvalds 또는 github.com/torvalds/linux"
          buttonText="연동하기"
          onSkip={handleSkipGithub}
        />
      );
    }

    if (step === "DONE") {
      return (
        <InputRow
          value={freeInput}
          onChange={setFreeInput}
          onSubmit={handleFreeChat}
          placeholder="추가로 반영하고 싶은 내용을 입력하세요 (예: bio를 더 간결하게 해줘)"
          buttonText="전송"
        />
      );
    }

    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      <Header_partner />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 32px" }}>
        {/* 상단 배너 */}
        <div style={{
          background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
          border: "1.5px solid #DBEAFE", borderRadius: 18,
          padding: "20px 28px",
          display: "flex", alignItems: "center", gap: 20, marginBottom: 20,
        }}>
          <img src={mascotIcon} alt="AI 매니저" style={{ width: 60, height: 60, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1E40AF", margin: "0 0 4px", fontFamily: F }}>
              AI 매니저와 프로필 자동 완성하기
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", margin: 0, fontFamily: F }}>
              3가지 질문으로 프로필을 자동으로 채워드려요. 인증 · CV PDF · GitHub만 알려주세요!
            </p>
          </div>
          <button
            onClick={() => navigate(profileBackPath)}
            style={{
              padding: "11px 22px", borderRadius: 999, border: "1px solid #C7D2FE",
              background: "linear-gradient(135deg, #EEF2FF 0%, #DBEAFE 50%, #E0E7FF 100%)",
              color: "#1E40AF", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0,
              boxShadow: "0 1px 2px rgba(99, 102, 241, 0.08)",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 50%, #C7D2FE 100%)";
              e.currentTarget.style.boxShadow = "0 3px 10px rgba(99, 102, 241, 0.18)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #EEF2FF 0%, #DBEAFE 50%, #E0E7FF 100%)";
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(99, 102, 241, 0.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            ← 프로필로 돌아가기
          </button>
        </div>

        {/* 채팅창 */}
        <div style={{
          background: "white", borderRadius: 18,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          overflow: "hidden", border: "1px solid #E5E7EB",
        }}>
          {/* 채팅 헤더 */}
          <div style={{
            padding: "14px 24px",
            background: "#FAFAFA",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            {/* 마스코트 + 이름 + 온라인 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <img
                  src={heroStudent}
                  alt="AI 매니저"
                  style={{
                    width: 72, height: 72, borderRadius: "50%",
                    objectFit: "cover",
                    background: "#EFF6FF",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E3A8A", fontFamily: F, lineHeight: 1.2 }}>AI 매니저</div>
                <div style={{ fontSize: 14, color: "#22C55E", fontWeight: 600, fontFamily: F }}>● 온라인</div>
              </div>
            </div>
            {/* 진행 단계 표시 */}
            <div style={{ flex: 1 }}>
              <StepIndicator step={step} onStepClick={(idx) => {
                const stepMap = ["ASK_VERIFY", "ASK_PDF", "ASK_GITHUB"];
                const labels = [
                  "다시 이메일 인증 단계로 돌아왔어요! 처음부터 다시 진행해볼까요? 😊",
                  "다시 CV / Portfolio 단계로 돌아왔어요! PDF를 새로 올려주세요 📄",
                  "다시 GitHub 연동 단계로 돌아왔어요! URL을 다시 입력해주세요 🐙",
                ];
                setStep(stepMap[idx]);
                pushBot(labels[idx]);
              }} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* 메시지 목록 */}
          <div style={{
            height: "calc(100vh - 360px)", minHeight: 440, overflowY: "auto",
            padding: "20px 24px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 10, alignItems: "flex-end",
              }}>
                {msg.role === "bot" && (
                  <img src={heroStudent} alt="bot" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
                )}
                <div style={{
                  maxWidth: "75%", padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  background: msg.role === "user" ? PRIMARY_GRAD : "#F8FAFC",
                  border: msg.role === "bot" ? "1px solid #E5E7EB" : "none",
                  color: msg.role === "user" ? "white" : "#111827",
                  fontSize: 17, fontFamily: F, lineHeight: 1.7,
                  boxShadow: msg.role === "user" ? "0 2px 10px rgba(99,102,241,0.25)" : "none",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {formatText(msg.text)}
                  <p style={{
                    fontSize: 12, margin: "6px 0 0",
                    color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                    textAlign: "right",
                  }}>
                    {msg.time.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <img
                    src={userHero}
                    alt="나"
                    style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
                  />
                )}
              </div>
            ))}

            {busy && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <img src={heroStudent} alt="bot" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%" }} />
                <div style={{
                  padding: "12px 18px", borderRadius: "4px 18px 18px 18px",
                  background: "#F8FAFC", border: "1px solid #E5E7EB",
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  <style>{`
                    @keyframes typingDot {
                      0%,80%,100% { transform: scale(0.7); opacity: 0.4; }
                      40% { transform: scale(1); opacity: 1; }
                    }
                  `}</style>
                  {[0, 1, 2].map((k) => (
                    <div key={k} style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#94A3B8",
                      animation: `typingDot 1.2s ease-in-out ${k * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 단계별 입력 영역 */}
          <div style={{ borderTop: "1px solid #F1F5F9" }}>
            {renderStepInput()}
          </div>
        </div>

        {/* 적용 카드 - DONE일 때만 */}
        {step === "DONE" && (
          <div style={{
            marginTop: 20,
            background: "linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)",
            border: "1.5px solid #A7F3D0", borderRadius: 16,
            padding: "20px 28px",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#065F46", fontFamily: F, marginBottom: 12 }}>
              ✨ 자동 완성 요약
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#047857", fontFamily: F, marginBottom: 16 }}>
              <div>{verifiedEmail ? `✅ ${verifiedEmail.type === "school" ? "학교" : "회사"} 인증: ${verifiedEmail.email}` : "⏭️ 이메일 인증 건너뜀"}</div>
              <div>{pdfProfile ? `✅ CV PDF 분석: ${pdfFileName} (스킬 ${pdfProfile.skills?.length || 0}개 / 경력 ${pdfProfile.careers?.length || 0}건 / 학력 ${pdfProfile.educations?.length || 0}건)` : "⏭️ PDF 업로드 건너뜀"}</div>
              <div>{githubData ? `✅ GitHub 연동: @${githubData.handle} (${githubData.publicRepos} repos / ${githubData.totalCommits.toLocaleString()} commits)` : "⏭️ GitHub 연동 건너뜀"}</div>
              {githubData?.skills?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#065F46", fontWeight: 700, marginBottom: 6, fontFamily: F }}>🏷️ GitHub 추출 기술 스택</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {githubData.skills.map((s, i) => (
                      <span key={i} style={{
                        padding: "4px 12px", borderRadius: 999,
                        background: "linear-gradient(135deg, #D1FAE5 0%, #FEF9C3 100%)",
                        border: "1px solid #A7F3D0",
                        fontSize: 12, fontWeight: 600, color: "#065F46", fontFamily: F,
                      }}>
                        {s.techName} · {s.commits.toLocaleString()} commits
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleApply}
                style={{
                  padding: "14px 36px", borderRadius: 12, border: "none",
                  background: SUCCESS_GRAD, color: "white",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F,
                  boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(16,185,129,0.5)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.35)"}
              >
                프로필에 적용하기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 작은 컴포넌트들 ─── */
function ChipBtn({ children, onClick, variant }) {
  const ghost = variant === "ghost";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 16px", borderRadius: 999,
        border: ghost ? "1.5px solid #E5E7EB" : "1.5px solid #DBEAFE",
        background: ghost ? "white" : "#DBEAFE",
        color: ghost ? "#374151" : "#1e3a5f",
        fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        if (ghost) { e.currentTarget.style.background = "#FEF9C3"; e.currentTarget.style.color = "#713f12"; }
        else { e.currentTarget.style.background = "#BFDBFE"; }
      }}
      onMouseLeave={e => {
        if (ghost) { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#374151"; }
        else { e.currentTarget.style.background = "#DBEAFE"; }
      }}
    >
      {children}
    </button>
  );
}

function InputRow({ value, onChange, onSubmit, placeholder, buttonText, onSkip }) {
  return (
    <div style={{ padding: "12px 20px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.nativeEvent.isComposing) return;
            onSubmit();
          }
        }}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 220, padding: "12px 18px", borderRadius: 999,
          border: "1.5px solid #E5E7EB", outline: "none",
          fontSize: 16, fontFamily: F, color: "#111827",
        }}
        onFocus={(e) => (e.target.style.border = "1.5px solid #93C5FD")}
        onBlur={(e) => (e.target.style.border = "1.5px solid #E5E7EB")}
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        style={{
          padding: "11px 22px", borderRadius: 999, border: "none",
          background: value.trim() ? PRIMARY_GRAD : "#E5E7EB",
          color: "white", fontSize: 15, fontWeight: 700,
          cursor: value.trim() ? "pointer" : "default", fontFamily: F,
          boxShadow: value.trim() ? "0 2px 10px rgba(99,102,241,0.30)" : "none",
        }}
      >
        {buttonText}
      </button>
      {onSkip && <ChipBtn onClick={onSkip} variant="ghost">건너뛰기</ChipBtn>}
    </div>
  );
}

function StepIndicator({ step, onStepClick }) {
  const stepIdx =
    ["ASK_VERIFY", "VERIFY_EMAIL", "VERIFY_CODE"].includes(step) ? 0 :
    ["ASK_PDF", "PARSING_PDF"].includes(step) ? 1 :
    ["ASK_GITHUB", "FETCHING_GH"].includes(step) ? 2 :
    step === "DONE" ? 3 : 0;

  const items = [
    { n: 1, label: "이메일 인증" },
    { n: 2, label: "CV / Portfolio" },
    { n: 3, label: "GitHub 연동" },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
      flexWrap: "wrap", paddingRight: 4,
    }}>
      {items.map((it, i) => {
        const done = stepIdx > i;
        const active = stepIdx === i;
        const clickable = onStepClick && (done || active);
        return (
          <div key={it.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => clickable && onStepClick(i)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 999,
                background: done
                  ? "linear-gradient(135deg, #D1FAE5 0%, #FEF9C3 100%)"
                  : active
                  ? "linear-gradient(135deg, #ECFDF5 0%, #FEFCE8 100%)"
                  : "#F1F5F9",
                border: `1.5px solid ${done ? "#6EE7B7" : active ? "#86EFAC" : "#E2E8F0"}`,
                cursor: clickable ? "pointer" : "default",
                transition: "all 0.2s",
                boxShadow: active ? "0 2px 8px rgba(134,239,172,0.35)" : "none",
              }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.filter = "brightness(0.96)"; }}
              onMouseLeave={e => { if (clickable) e.currentTarget.style.filter = "none"; }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: done
                  ? "linear-gradient(135deg, #34D399, #A3E635)"
                  : active
                  ? "linear-gradient(135deg, #6EE7B7, #BEF264)"
                  : "#CBD5E1",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, fontFamily: F,
                flexShrink: 0,
              }}>
                {done ? "✓" : it.n}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: F,
                color: done ? "#065F46" : active ? "#14532D" : "#64748B",
              }}>
                {it.label}
              </span>
            </div>
            {i < items.length - 1 && (
              <div style={{ width: 20, height: 2, background: stepIdx > i ? "#86EFAC" : "#E2E8F0", borderRadius: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
