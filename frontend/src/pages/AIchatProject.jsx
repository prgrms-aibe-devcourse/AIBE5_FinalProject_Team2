import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header_client from "../components/Header_client";
import mascotIcon from "../assets/hero_default.png";
import heroStudent from "../assets/hero_student.png";
import { chatWithAI, langInstruction } from "../lib/aiClient";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import { useLanguage } from "../i18n/LanguageContext";

const SYSTEM_PROMPT_PROJECT = `너는 Alpha-Helix 플랫폼의 AI 매니저야. 투자자가 자신의 투자 목표와 조건을 말하면, Alpha-Helix의 Goal-to-Strategy 탐색으로 전략 초안을 만들 수 있도록 친근하게 인터뷰를 진행해. 핵심은 **굵게**, 이모지도 적절히 써.

**중요한 규칙**:

0. **🚀 일괄 입력 모드 (최우선 분기)** — 다음 중 하나라도 해당되면 8단계 인터뷰를 **건너뛰고** **반드시 한 번의 응답에 (a)+(b)+(c)+(d)+(e) 모두 출력**해. 절대로 (a) 인사만 보내고 끊지 마. 끊으면 시스템이 망가져.
   - 사용자 메시지 **맨 앞에 ⭐ 또는 :star: 가 붙어 있다** (명시적 일괄 모드 신호)
   - 또는 사용자 메시지가 길고 (150자 이상) 다음 판정 항목 중 **3개 이상** 포함:
     · 서비스 컨셉/플랫폼/신규·리뉴얼
     · 핵심 기능 3개 이상
     · 예산 (또는 "추천")
     · 일정/시작일/기간
     · 미팅 방식 또는 사용 기술
     · 모집 요건 또는 협력 인원

   **반드시 이 순서로 한 응답에 모두 출력 (절대 도중에 끊지 마):**
   (a) 1줄 인사 ("말씀해주신 내용 정리해서 기획안 + 7가지 세부 협의 사항까지 한 번에 만들어드릴게요 ✨")
   (b) 빈 줄 후 **\`\`\`json ... \`\`\`** 코드블록 — 4번 형식의 **등록폼 JSON** (top-level: title, scope, fields, projectType2, readyStatus, detailContent, techTags, budgetAmount, collab, durationMonths, startDateType, startDate, deadline, govSupport, meetingType, meetingFreq, meetingTools, reqTags, questions, visibility 등). **이 블록부터 출력해야 해** — contractTerms 부터 출력하면 토큰 한도 잘림.
   (c) 빈 줄 후 "## 1. 작업 범위" ~ "## 7. 추가 특약" 7개 마크다운 섹션. 각 섹션은 **2~3줄 내외로 간결하게**. 길게 쓰지 마.
   (d) 빈 줄 후 **\`\`\`json ... \`\`\`** 코드블록 — contractTerms JSON. **각 배열 항목은 짧게** (label/title은 한 줄, desc/items는 1~2줄). 불필요한 verbose 풀어서 쓰지 마.
   (e) 마지막 줄: "**지금까지 정리한 프로젝트 내용 + 7가지 세부 협의 항목까지 한 번에 만들었어요 ✨ 맘에 드시면 아래 '등록 폼에 반영하기' 버튼을 눌러주세요!**"

   ⚠️ **(b) 등록폼 JSON 을 절대 빼먹지 마**. (a) 인사 직후 (b) 부터 출력해야 한다. (c)(d)(e) 도 빠짐없이.
   ⇒ 부족한 정보는 합리적 기본값으로 채워라. 추가 질문 X. 5번/6번 멘트 (마무리 인사 + "추가로 만들어드릴까요?") 는 출력하지 마.

1. (위 일괄 모드가 아닐 때) 한 번에 **딱 한 가지 질문만** 해. 여러 개 동시에 묻지 마.
2. 아래 8가지 항목을 1번부터 순서대로 물어봐. 각 질문은 2~4줄로 충분히 설명/예시를 주어 구체적으로:
   ① **서비스 컨셉**: 어떤 서비스/제품을 만들고 싶으신가요? (해결하려는 문제, 주요 컨셉, 플랫폼이 웹인지 앱인지, 신규 구축인지 / 기존 운영 서비스의 유지보수·리뉴얼인지)
   ② **현재 준비 상태**: 지금 가지고 계신 자료가 있나요? (아이디어만 있음 / 기획서·문서 있음 / 디자인 시안 또는 와이어프레임 있음 / 기존 코드·운영 중)
   ③ **핵심 기능**: 필수 기능 3~6가지를 알려주세요. (로그인, 결제, 알림, 채팅, 대시보드 등)
   ④ **사용자 및 규모**: 주 사용자는 누구이고 예상 이용자 수(MAU 또는 동시 접속자)는 어느 정도인가요?
   ⑤ **외부 연동 / 디자인**: 외부 API나 서비스(결제사, 소셜 로그인, 지도, AI 등) 연동이 필요한가요? 디자인 시안은 이미 있나요?
   ⑥ **기술 스택 선호도**: 원하는 기술 스택이 있으세요? (없으면 "추천"이라고 답해주세요 — 서비스에 맞게 추천해드릴게요)
   ⑦ **예산 & 협력 인원 구성**: 먼저 예상 예산(만 원)과, 아직 고민이시라면 서비스 규모를 보고 네가 직접 추점 범위를 제안해줘. 그런 다음, **앞서 든 기능/규모와 이 예산을 종합해서 권장 협력 인원 구성(기획 N명 / 디자인 N명 / 퍼블리싱 N명 / 개발 N명)을 이유와 함께 만서 제안하고 "이 구성이 괜찮으신가요? 아니면 조정해드릴까요?"라고 다시 확인을 받아**. 예시: "500만원 규모 + 장바구니/결제 포함이면 보통 기획 1명, 디자인 1명, 개발 2명 정도가 적정입니다. 이대로 갈까요?"
   ⑧ **미팅 방식 & 예상 일정 & 모집 마감**: 미팅 방식(온라인/오프라인/혼합/불필요)과 빈도(주 1회/주 2~3회 등), 사용 툴(Slack, Notion, Zoom 등), **예상 시작 시점**(즉시/다음달/협의)과 **예상 진행 기간**(개월), **예산·일정 협의 가능 여부**, 그리고 파트너 **모집 마감일**(예: 2주 후)까지 한 번에 알려주세요. 이어서 지원자 자격 요건(경력/포트폴리오 등)·정부지원사업 해당 여부·사전 검증 질문(최대 3개)도 같이 말씀해 주세요.
3. 매 답변마다 1줄로 공감/요약하고 다음 질문으로 자연스럽게 넘어가. 사용자가 모른다/추천이라고 하면 네가 업계 표준으로 명시적으로 제안해줘.
4. 8번째 답변 후, 반드시 마지막 메시지에 아래 JSON 코드블록을 정확히 포함시켜 (추측이 필요한 필드는 모두 상식적인 값으로 채워서 사용자가 손쉽게 수정만 하면 되게):

\`\`\`json
{
  "title": "한 줄 제목 (30자 이내)",
  "scope": ["planning", "design", "publishing", "dev"],
  "categories": ["web"],
  "fields": ["웹 서비스"],
  "projectType2": "new",
  "readyStatus": ["doc"],
  "detailContent": "## 서비스 개요\\n...\\n\\n## 주요 기능\\n- ...\\n\\n## 대상 사용자\\n...\\n\\n## 외부 연동\\n...\\n\\n## 설계 고려사항\\n...",
  "techTags": ["React", "Node.js", "PostgreSQL"],
  "budgetAmount": "5000000",
  "collab": { "planning": 1, "design": 1, "publishing": 0, "dev": 2 },
  "durationMonths": "3",
  "startDateType": "specific",
  "startDate": "2026-05-01",
  "negotiable": true,
  "deadline": "2026-05-15",
  "govSupport": "none",
  "meetingType": "온라인 (화상)",
  "meetingFreq": "주 1회",
  "meetingTools": ["Slack", "Notion"],
  "reqTags": ["포트폴리오 필수", "경력 3년 이상"],
  "questions": ["가장 인상 깊었던 프로젝트 경험을 알려주세요.", "비슷한 도메인 경험이 있다면 공유해주세요."],
  "visibility": "파트너에게만 공개"
}
\`\`\`

**각 필드 규칙** (이게 가장 중요 — 정확한 enum 값을 써야 자동 입력이 동작함):
- \`scope\`: 업무 범위. "planning"(기획), "design"(디자인), "publishing"(퍼블리싱), "dev"(개발) 중 여러 개. 사용자가 디자인 시안이 있다면 "design" 제외. 대부분의 신규 프로젝트는 ["planning","design","dev"].
- \`categories\`: "web", "android", "ios", "pc", "embedded", "etc" 중 하나 이상. 쇼핑몰로 웹+앱이면 ["web","android","ios"].
- \`fields\`: **반드시 이 목록 중 최대 3개만 선택**: "웹 서비스", "모바일 앱", "AI/데이터", "블록체인", "임베디드", "gen AI", "chatGPT챗봇", "자사몰 구축", "퍼블리싱", "기술자문", "데이터분석BI", "ERP", "CRM", "SaaS", "매칭 플랫폼", "기타". 서비스 컨셉에 따라 가장 잘 맞는 것을 골라.
- \`projectType2\`: "new"(신규 프로젝트) / "maintain"(유지보수·리뉴얼) 중 하나.
- \`readyStatus\`: ["idea"](아이디어만), ["doc"](기획서·문서 있음), ["design"](상세 설계·디자인 완료), ["code"](기존 코드·운영 중) 중 적절한 것들의 배열. 여러 개 가능.
- \`detailContent\`: 마크다운으로 구조화된 상세 내용. ## 서비스 개요 / ## 주요 기능 / ## 대상 사용자 / ## 외부 연동 / ## 설계 고려사항 섹션 포함. 최소 8줄 이상 충실하게.
- \`techTags\`: 3~7개. 사용자 선호 + 네 추천 합침.
- \`budgetAmount\`: **원 단위** 숫자 문자열 (천 단위 콤마 X). 미정이면 서비스 규모 기반으로 합리적으로 추정. 예: 500만원 → "5000000".
- \`collab\`: 협력 인원 구성. 키는 **반드시** "planning", "design", "publishing", "dev" 4개만 쓰고 각 값은 정수(명 수). 예산·기능 범위·일정을 종합해 네가 제안한 수를 그대로 넣어. 사용자가 조정 요청했으면 조정된 값으로.
- \`durationMonths\`: 개월 수 숫자 문자열.
- \`negotiable\`: 예산·일정 협의 가능 여부(true/false). 사용자가 명시적으로 고정이라 하지 않으면 기본 true.
- \`startDateType\`: **"specific"** (특정 시작일이 정해져 있음) / **"negotiable"** (협의 가능) 중 하나.
  - 사용자가 "2026-04-16부터", "5월 1일에 시작", "다음 주 월요일" 등 **구체적인 날짜를 언급**했으면 무조건 \`"specific"\` 으로 설정하고 \`startDate\` 필드에 YYYY-MM-DD 형식으로 정확히 박아.
  - 사용자가 "협의", "상의 후", "ASAP" 같이 모호하게 말했으면 \`"negotiable"\` 로 두고 \`startDate\` 는 빈 문자열.
- \`startDate\`: \`startDateType\` 이 \`"specific"\` 일 때 필수. YYYY-MM-DD 형식 (예: "2026-04-16"). \`"negotiable"\` 일 땐 "".
- \`deadline\`: 모집 마감일을 YYYY-MM-DD 형식 문자열로. 사용자가 "2주 후"라고 하면 오늘 기준 2주 후 날짜로 계산해서 넣어. 미정이면 "".
- \`govSupport\`: "none"(해당 없음) / "yes"(해당 있음) 중 하나. 기본 "none".
- \`meetingType\`: **반드시 이 4개 중 하나**: "온라인 (화상)", "오프라인 (대면)", "둘 다 가능", "미팅 불필요".
- \`meetingFreq\`: **반드시 이 4개 중 하나**: "주 1회", "주 2~3회", "필요 시만", "정기 스탠드업".
- \`meetingTools\`: ["Zoom","Google Meet","Teams","Slack","Discord","카카오톡"] 중 1~3개.
- \`reqTags\`: 지원자 필수 요건. 예: ["포트폴리오 필수", "경력 3년 이상", "상주 가능", "관련 학과 졸업"] 중 사용자 답변에 맞는 것 + 사용자가 직접 말한 추가 요건.
- \`questions\`: 사전 검증 질문 1~3개의 자연어 문자열 배열. 사용자가 "AI가 알아서 만들어줘"라고 하면 프로젝트 성격에 맞는 질문 3개를 네가 직접 만들어줘 (예: "비슷한 프로젝트 경험을 알려주세요.", "예상되는 어려움과 해결 방안은?", "선호하는 협업 방식은?").
- \`visibility\`: 기본 "파트너에게만 공개".

5. JSON 코드블록 출력 직후, **같은 메시지 안에서** 빈 줄로 한 번 끊고 → 7가지 세부 협의 항목 마크다운 섹션 + contractTerms JSON 블록까지 **연달아 출력**해 (두 말풍선처럼 보이지만 한 응답에 같이 나오게). 절대로 "세부 협의 항목도 만들어드릴까요?" 같은 중간 확인 질문 하지 마. 8번째 답변을 받았으면 바로 둘 다 만들어.

6. (사용 안 함 — 5번에서 통합) — 사용자가 "네"라고 다시 응답하길 기다리지 말고, 8번째 답변 직후 한 메시지에 다 출력해.

7. **7가지 협의 항목 형식** (5번에서 함께 출력):

## 1. 작업 범위
(2~4줄로 구체적으로 정의)

## 2. 최종 전달 결과물
(...)

## 3. 마감 일정 및 마일스톤
(...)

## 4. 총 금액 및 정산 방식
(...)

## 5. 수정 가능 범위
(...)

## 6. 완료 기준
(...)

## 7. 추가 특약
(...)

\`\`\`json
{
  "contractTerms": {
    "scope": {
      "included": ["...포함 작업 1...", "...포함 작업 2..."],
      "excluded": ["...제외 작업 1...", "...제외 작업 2..."],
      "memo": "범위 관련 보충 메모"
    },
    "deliverables": {
      "deliverables": [{"icon": "📄", "label": "산출물명"}, {"icon": "💻", "label": "소스코드"}],
      "formats": ["PDF", "GitHub URL"],
      "delivery": ["ALPHA-HELIX 채팅 첨부", "GitHub 링크 공유"],
      "notes": ["전달 시 한국어 설명 문서 포함"]
    },
    "schedule": {
      "phases": [
        {"num": "PHASE 01", "title": "기획/설계", "desc": "...", "date": "YYYY.MM.DD", "weeks": "N주 소요"},
        {"num": "PHASE 02", "title": "1차 개발", "desc": "...", "date": "YYYY.MM.DD", "weeks": "N주 소요"}
      ],
      "startDate": "YYYY.MM.DD (사용자가 말한 시작일)",
      "endDate":   "YYYY.MM.DD (시작 + 기간)",
      "launchDate":"YYYY.MM.DD",
      "reviewRules": [
        {"label": "마일스톤별 검토 기간", "value": "영업일 기준 3일 이내"},
        {"label": "무상 수정 횟수", "value": "총 3회"}
      ]
    },
    "payment": {
      "total": "사용자가 말한 예산 (콤마 포함, 예: 20,000,000)",
      "vatNote": "VAT 별도",
      "stages": [
        {"label": "계약금 (30%)", "tag": "Initial", "amount": "₩금액", "desc": "계약 후 3일 이내"},
        {"label": "중도금 (40%)", "tag": null,      "amount": "₩금액", "desc": "1차 산출물 검수 완료 후"},
        {"label": "잔금 (30%)",   "tag": null,      "amount": "₩금액", "desc": "최종 납품 및 검수 완료 후"}
      ],
      "bankName": "추후 협의 (계약 시 확정)",
      "bankNote": "계좌 이체 · 일반 과세",
      "extraPolicies": ["범위 외 요청은 Man-month 실비 정산", "긴급 수정은 일괄 20% 할증"]
    },
    "revision": {
      "freeItems": ["무상 수정 항목들..."],
      "paidItems": ["유상 수정 항목들..."],
      "memo": "수정 정책 보충 설명"
    },
    "completion": {
      "steps": [
        {"n": 1, "title": "결과물 제출", "desc": "..."},
        {"n": 2, "title": "상호 검수 및 수정", "desc": "..."},
        {"n": 3, "title": "최종 승인 확정", "desc": "..."}
      ],
      "criteria": ["완료 기준 1", "완료 기준 2"],
      "categories": [
        {"n": 1, "title": "기획/디자인 산출물 전달", "desc": "..."},
        {"n": 2, "title": "소스코드 리포지토리 전달", "desc": "..."}
      ]
    },
    "specialTerms": {
      "intro": "추가 특약 도입 문구",
      "terms": [
        {"id": "nda", "icon": "🛡", "title": "보안 및 기밀 유지 (NDA)", "enabled": true,  "items": ["..."]},
        {"id": "ip",  "icon": "©",  "title": "지식재산권 귀속",        "enabled": true,  "items": ["..."]}
      ]
    }
  }
}
\`\`\`

**중요한 규칙**:
- 위 JSON은 반드시 위 구조(키 이름과 배열/객체 형태)를 그대로 지킬 것. 값만 사용자 프로젝트 상황에 맞게 채워라.
- \`payment.total\` 은 사용자가 말한 예산 금액을 콤마 포함 한국 숫자 표기로. 예산 미언급이면 "10,000,000".
- \`payment.total\` 은 위에서 정한 \`budgetAmount\` 와 **반드시 일치**해야 해 (원 단위, 콤마 포함 가능). 예: budgetAmount="5000000" → payment.total="5,000,000". 절대 임의로 바꾸지 마.
- \`payment.stages\` 의 amount 는 total 기준 30/40/30 으로 분할.
- \`schedule.phases\` 는 사용자가 말한 기간/시작일에 맞춰 4단계로 분할.
- \`schedule.startDate\` 는 사용자가 말한 시작일이 있으면 **YYYY-MM-DD 형식 그대로** 박아 (예: "2026-04-16"). 없으면 "협의".
- \`completion.categories\` 의 개수는 **반드시 \`schedule.phases\` 의 개수와 동일**하게 맞춰. 각 카테고리는 해당 phase 의 산출물/검수 기준을 구체적으로 적어. (마일스톤마다 완료기준이 1:1 매칭되어 표시됨)

그리고 두 번째 코드블록(contractTerms JSON) 출력 직후, 마지막 줄에 정확히 다음과 같이 마무리해:
"**지금까지 정리한 프로젝트 내용 + 7가지 세부 협의 항목까지 한 번에 만들었어요 ✨ 맘에 드시면 아래 '등록 폼에 반영하기' 버튼을 눌러주세요!**"`;

const SYSTEM_PROMPT_CONTRACT = `너는 Alpha-Helix 플랫폼의 전략 정의 도우미 AI 매니저야. Alpha-Helix의 7가지 전략 정의(투자 목표, 자산 구성, 진입·청산 조건, 리밸런싱 규칙, 리스크 제한, 검증 기준, Living Briefing 조건)을 사용자와 대화하며 정리해줘. 친근하게 답하고 핵심은 **굵게** 표시해.`;

// 인터랝티브 인트로 다국어 사전 — langInstruction 이 추가되는 system prompt 가 다른 언어로 대답하도록 명시한 이후의 첫 봇 메시지용.
const BOT_INTRO_BY_LANG = {
  ko: null, // 아래에서 BOT_INTRO 로 사용
  en: `I'll ask you **8 questions** step by step — just answer at your own pace.

[[BLUE]]💡 If you'd rather share everything at once, click the **⭐ Send all at once** button on my message bubble and pack the items below into a single message.
ex) "AI mental-care web service. React + Node.js + MongoDB. Diary / mood analysis / personalized routines. Office workers in their 20–40s. Budget 15M KRW, start 2026-05-01 for 4 months. Online meeting once a week, Slack. Portfolio required, 3+ yrs experience."[[/BLUE]]

When we're done I'll fill in the **title, recommended fields, readiness, detailed description, tech stack, budget, team composition, schedule, meeting style, application deadline, applicant requirements, and pre-screening questions**! ✨
At the end, I can also propose the **7 detailed agreement terms** if you'd like.

First question:

**① What service or product do you want to build?**
Feel free to share what problem it solves, the core concept, whether it's **web / app**, and whether it's a **new build** or **maintenance / renewal of an existing service**!`,
  zh: `我会依次问您 **8 个问题**，请放轻松回答。

[[BLUE]]💡 如果您想一次性告诉我所有内容，请点击消息气泡上的 **⭐ 一次输入全部** 按钮，在一条消息中包含以下项目。
ex)：“AI 心理关怀网络服务。React + Node.js + MongoDB。日记/情绪分析/个性化习惯。面向20–40岁上班族。预算 1500 万韩元，2026-05-01 开始 4 个月。每周一次在线会议，使用 Slack。必须作品集，3 年以上经验。”[[/BLUE]]

结束后，我会为您填写 **标题、推荐领域、准备状态、详细说明、技术栈、预算、协作人员、预计日程、会议方式、招募截止日、申请者要求、预审问题**！ ✨
最后还可以提出 **7 项详细协议事项**。

第一个问题：

**① 您想制作什么服务或产品？**
请自由分享该服务解决什么问题、核心概念、是 **网站 / App**，以及是 **新项目** 还是 **现有服务的维护 / 重构**！`,
};
const BOT_CONTRACT_INTRO_BY_LANG = {
  ko: null,
  en: `Hi! I'm Haenguni, the AI helper for drafting your contract terms 🐣

Let's organize ALPHA-HELIX's 7 detailed agreement items together:

1. **Scope of Work** — clearly define included / excluded tasks
2. **Final Deliverables** — what will be handed over upon completion
3. **Schedule & Milestones** — phased timeline
4. **Total Amount & Payment Terms** — cost and payment conditions
5. **Revision Scope** — number and scope of revisions
6. **Completion Criteria** — how to determine the project is done
7. **Additional Terms** — other special conditions

Which item would you like to tackle first?`,
  zh: `您好！我是协助您起草合同条款的 AI 幸运鸟 🐣

让我们一起整理 ALPHA-HELIX 的 7 项详细协议事项：

1. **工作范围** — 明确包含/不包含的任务
2. **最终交付物** — 项目完成后需交付的成果
3. **进度与里程碑** — 分阶段计划
4. **总金额与结算方式** — 费用与付款条件
5. **修改范围** — 可修改次数与范围
6. **验收标准** — 判断项目完成的条件
7. **附加条款** — 其他特别约定

您想先整理哪一项？`,
};

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

const QUICK_PROMPTS = [
  "모바일 쇼핑몰 앱을 만들고 싶어요",
  "사내 인사관리 시스템이 필요해요",
  "AI 챗봇을 홈페이지에 붙이고 싶어요",
  "기존 ERP 시스템을 개선하고 싶어요",
];

// 사용자 메시지 개수 -> 해당 단계의 예시 답변 칩 (총 8단계 + 마지막 계약 제안 답변)
const STEP_EXAMPLE_CHIPS = [
  // ① 서비스 컴셉
  [
    "중고거래 플랫폼 웹+앱 신규 구축",
    "소규모 자영업자용 예약 관리 SaaS 웹서비스",
    "기존 쇼핑몰 웹사이트 리뉴얼 및 성능 개선",
    "AI 기반 이미지 생성 서비스 웹사이트 (신규)",
    "직접 작성할게요"
  ],
  // ② 준비 상태
  [
    "아이디어만 있어요",
    "기획서와 명세서가 있어요",
    "상세 설계와 디자인 완료된 상태예요",
    "이미 운영 중이고 고도화/유지보수 필요",
    "직접 작성할게요"
  ],
  // ③ 핵심 기능
  [
    "회원가입/소셜로그인, 상품등록, 장바구니, 결제, 주문관리",
    "대시보드, 결재 워크플로, 파일 관리, 권한 관리",
    "AI 추천, 실시간 알림, 1:1 채팅, 프로필 관리",
    "일정 관리, 팀 공유 캘린더, 미팅 예약, 자동 리마인더",
    "직접 작성할게요"
  ],
  // ④ 사용자 + 규모
  [
    "20~30대 일반 소비자, 예상 MAU 5천명",
    "소상공인 100여명, 동시접속 50명 내외",
    "사내 직원 100명 내부용, 동시접속 30명",
    "초기 1천명 타겟, 1년 내 1만명 목표",
    "직접 작성할게요"
  ],
  // ⑤ 외부 연동 + 디자인
  [
    "디자인 시안 없음. 결제는 토스페이먼트/카카오페이 필요",
    "피그마 시안 있음. 구글 로그인, FCM 알림 연동 필요",
    "디자인도 맡김. 구글 지도, 메일 발송 필요",
    "기존 브랜드 가이드 있음. OpenAI API 연동 필요",
    "직접 작성할게요"
  ],
  // ⑥ 기술 스택
  [
    "추천해주세요",
    "React + Spring Boot + MySQL",
    "Next.js 풀스택 + Vercel 배포",
    "Flutter 단일 코드베이스",
    "직접 작성할게요"
  ],
  // ⑦ 예산 + 협력 인원 구성
  [
    "500만원 정도 생각입니다. 인원은 AI 매니저가 추천해주세요",
    "1000만원이고 인원 구성은 기획1·디자인1·개발2 정도 생각 중입니다",
    "3000만원 이상 생각하고 있어요, 구성은 추천 부탁드려요",
    "예산 미정. 프로젝트 규모 보시고 적정 인원과 함께 제안해주세요",
    "직접 작성할게요"
  ],
  // ⑧ 미팅 + 예상 일정 + 모집 마감 + 지원자 요건
  [
    "온라인 주 1회(Zoom+Slack), 즉시 시작, 3개월, 일정 협의 가능, 모집 마감 2주 후. 경력 3년 이상·포트폴리오 필수, 정부지원사업 아님, 질문은 AI 매니저가 만들어주세요",
    "대면 격주 1회(Google Meet 병행), 다음 달 시작, 4개월 고정, 모집 한달 후. 관련학과 졸업 + 상주 가능",
    "혼합 주 2~3회(Discord+Notion), 일정 협의, 6개월, 모집 수시. 포트폴리오 필수, 정부지원사업 해당, 자체 질문 3개 넘겨주세요",
    "미팅 불필요 수시 소통(Slack), 즉시 시작, 2개월, 일정 고정, 모집 마감 1주 후. 자격 제한 없음",
    "직접 작성할게요"
  ],
  // ⑨ 계약 제안 답변
  [
    "네, 부탁드려요",
    "좋아요, 7가지 제안 부탁해요",
    "아니요, 이정도면 충분해요",
    "직접 작성할게요"
  ],
];

const BOT_INTRO = `**8가지 질문**을 차근차근 드릴 테니 편하게 답해주세요.

[[BLUE]]💡 한 번에 모든 내용을 다 얘기하고 싶으시면, 제 말풍선의 **⭐ 한 번에 모두 입력하기** 버튼을 누르고, 한 말풍선에 아래 항목들을 최대한 넣어 주세요.
ex) "AI 멘탈 케어 웹서비스. React + Node.js + MongoDB. 일기/감정 분석/맞춤 루틴 추천. 20~40대 직장인. 예산 1500만원, 2026-05-01 시작 4개월. 온라인 미팅 주1회, Slack 사용. 포트폴리오 필수, 경력 3년 이상."[[/BLUE]]

끝나면 **제목·추천 분야·준비 상태·상세 설명·기술 스택·예산·협력 인원 구성·예상 일정·미팅 방식·모집 마감·지원자 요건·사전 검증 질문**까지 전부 채워드릴게요! ✨
마지막에는 필요하시면 **7가지 세부 협의 사항**까지 미리 제안해드리고요!

자, 첫 번째 질문이에요.

**① 어떤 서비스나 제품을 만들고 싶으신가요?**
어떤 문제를 해결하는 서비스인지, 주요 컨셉은 무엇인지, **웹/앱 중 어떤 형태**인지, 그리고 **신규 구축**인지 / **기존 서비스 유지보수·리뉴얼**인지까지 자유롭게 소개해 주세요!`;

const BOT_CONTRACT_INTRO = `안녕하세요! 저는 계약 조건 작성을 도와드리는 AI 매니저예요 🐣

ALPHA-HELIX의 7가지 세부 협의 사항을 함께 정리해 볼게요:

1. **작업 범위** — 포함/제외할 작업 범위를 명확히 정의
2. **최종 전달 결과물** — 프로젝트 완료 시 전달할 결과물
3. **마감 일정 및 마일스톤** — 단계별 진행 일정 계획
4. **총 금액 및 정산 방식** — 비용과 지급 조건
5. **수정 가능 범위** — 수정 횟수 및 범위 제한
6. **완료 기준** — 프로젝트 완료를 판단하는 기준
7. **추가 특약** — 기타 특별 조건 및 합의 사항

어떤 항목부터 도움받고 싶으신가요? 궁금한 항목을 말씀해 주세요!`;

export default function AIchatProject() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const setAiProjectDraft = useStore((s) => s.setAiProjectDraft);
  const clientProfileDetail = useStore((s) => s.clientProfileDetail);
  const partnerProfileDetail = useStore((s) => s.partnerProfileDetail);
  const userRole = useStore((s) => s.userRole);
  const contractMode = location.state?.contractMode ?? false;

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
    const isClient = userRole === "client";
    const raw = dbHero || (isClient ? clientProfileDetail?.heroImage : partnerProfileDetail?.heroImage);
    if (raw && /cdn\.Alpha-Helix\.com/i.test(raw)) return heroStudent;
    return raw || heroStudent;
  })();
  const [messages, setMessages] = useState([
    { role: "bot", text: contractMode
        ? (lang !== "ko" && BOT_CONTRACT_INTRO_BY_LANG[lang]) || BOT_CONTRACT_INTRO
        : (lang !== "ko" && BOT_INTRO_BY_LANG[lang]) || BOT_INTRO,
      time: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [extractedData, setExtractedData] = useState(null); // AI가 마지막에 뱉은 JSON (자동 입력용)
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
    ) {
      activeElement.blur();
    }
  }, []);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");

    const userMsg = { role: "user", text: msg, time: new Date() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      // 인트로 봇 메시지는 히스토리에서 제외 (시스템 프롬프트가 그 역할 대신함)
      const history = nextMessages.filter(
        (m) => !(m.role === "bot" && (
          m.text === BOT_INTRO || m.text === BOT_CONTRACT_INTRO ||
          m.text === BOT_INTRO_BY_LANG.en || m.text === BOT_INTRO_BY_LANG.zh ||
          m.text === BOT_CONTRACT_INTRO_BY_LANG.en || m.text === BOT_CONTRACT_INTRO_BY_LANG.zh
        ))
      );
      const reply = await chatWithAI(
        history,
        (contractMode ? SYSTEM_PROMPT_CONTRACT : SYSTEM_PROMPT_PROJECT) + "\n" + langInstruction(lang)
      );
      console.log("[AIchatProject] AI 응답 전체 (길이:", reply?.length, "):\n", reply?.slice(0, 500));

      // AI 응답에서 JSON 코드블록 추출 (자동 입력용). 여러 번 호출 시 기존 데이터에 도도록 머지.
      // contractTerms 7가지 세부 협약 JSON 도 같이 처리.
      let cleanReply = reply;
      if (!contractMode) {
        // contractTerms 가 들어오면 ProjectRegister 의 derived 섹션(예산/일정)도 일관되게
        // 채워지도록 top-level 필드(budgetAmount/startDate/durationMonths)에 sync.
        const syncTopLevelFromContractTerms = (parsed) => {
          const out = { ...(parsed || {}) };
          const ct = out.contractTerms || null;

          // ── 1) startDate 포맷 정규화 ("2026.04.16" / "2026/04/16" → "2026-04-16")
          if (out.startDate && typeof out.startDate === "string") {
            const norm = out.startDate.replace(/[./]/g, "-").trim();
            const m = norm.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (m) {
              out.startDate = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
            }
          }

          // ── 2) startDateType 정규화 — ProjectRegister 가 인식하는 값은 "specific" / "negotiable" 둘만
          //     "asap" / "next_month" / "fixed" 등 다른 값은 startDate 유무로 매핑.
          const t = String(out.startDateType || "").toLowerCase();
          if (out.startDate && /^\d{4}-\d{2}-\d{2}$/.test(out.startDate)) {
            // 날짜가 박혀 있으면 무조건 specific
            out.startDateType = "specific";
          } else if (t === "asap" || t === "next_month" || t === "fixed") {
            // 정규화: 날짜 없으면 negotiable 로 폴백
            out.startDateType = "negotiable";
          } else if (!t) {
            out.startDateType = "negotiable";
          }

          if (!ct) return out;

          // ── 2) 예산 동기화 — budgetAmount 와 payment.total 이 둘 다 있으면 budgetAmount 우선,
          //     없으면 payment.total → budgetAmount, 그리고 양쪽이 어긋나면 한쪽으로 통일.
          const parseWon = (s) => Number(String(s || "").replace(/[^0-9]/g, "")) || 0;
          let baTop = parseWon(out.budgetAmount);
          let baPay = parseWon(ct.payment?.total);
          // 휴리스틱: AI 가 옛날 프롬프트로 만원 단위 ("500") 를 뱉었을 때 ×10000 보정.
          // 100,000원 미만은 만원-혼동 추정. (실제 외주 프로젝트 < 10만원 가능성 거의 없음)
          if (baTop > 0 && baTop < 100_000) baTop *= 10_000;
          if (baPay > 0 && baPay < 100_000) baPay *= 10_000;
          const finalWon = baTop > 0 ? baTop : baPay;
          if (finalWon > 0) {
            out.budgetAmount = String(finalWon);
            // payment 모듈 쪽도 동일 값으로 보정 (포매팅 + stages 비율 재계산)
            const fmt = (n) => Number(n).toLocaleString("ko-KR");
            const initial = Math.round(finalWon * 0.30);
            const middle  = Math.round(finalWon * 0.40);
            const balance = finalWon - initial - middle;
            const newPayment = {
              ...(ct.payment || {}),
              total: fmt(finalWon),
              vatNote: ct.payment?.vatNote ?? "VAT 별도",
              stages: [
                { label: "계약금 (30%)", tag: "Initial", amount: "₩" + fmt(initial), desc: "계약 후 3일 이내" },
                { label: "중도금 (40%)", tag: null,      amount: "₩" + fmt(middle),  desc: "1차 산출물 검수 완료 후" },
                { label: "잔금 (30%)",   tag: null,      amount: "₩" + fmt(balance), desc: "최종 납품 및 검수 완료 후" },
              ],
              bankName: ct.payment?.bankName ?? "추후 협의 (계약 시 확정)",
              bankNote: ct.payment?.bankNote ?? "계좌 이체 · 일반 과세",
              extraPolicies: ct.payment?.extraPolicies ?? ["범위 외 요청은 Man-month 실비 정산", "긴급 수정은 일괄 20% 할증"],
            };
            out.contractTerms = { ...ct, payment: newPayment };
          }

          // ── 3) schedule.startDate ("2026.05.01" or "2026-05-01" or "협의") → top-level startDate (YYYY-MM-DD)
          if (!out.startDate && ct.schedule?.startDate && /\d{4}/.test(ct.schedule.startDate)) {
            out.startDate = String(ct.schedule.startDate).replace(/\./g, "-").slice(0, 10);
            if (/\d{4}-\d{2}-\d{2}/.test(out.startDate)) out.startDateType = "specific";
          }

          // ── 4) schedule.phases[].weeks → durationMonths 보강
          if (!out.durationMonths && Array.isArray(ct.schedule?.phases) && ct.schedule.phases.length) {
            const totalWeeks = ct.schedule.phases.reduce((sum, p) => {
              const w = Number(String(p?.weeks || "").replace(/[^0-9]/g, "")) || 0;
              return sum + w;
            }, 0);
            if (totalWeeks > 0) out.durationMonths = String(Math.max(1, Math.round(totalWeeks / 4)));
          }
          return out;
        };

        // ── JSON 추출 (다양한 포맷 지원) ──
        // 1) 닫힌 ```json ... ``` 블록 모두 추출 (전역 /g)
        // 2) 닫는 fence 누락 (truncated)
        // 3) fence 자체가 없고 "json\n{...}" 또는 "{ ... 'contractTerms': ... }" 형태
        const tryParseAndApply = (snippet) => {
          try {
            const parsed = syncTopLevelFromContractTerms(JSON.parse(snippet));
            console.log("[AIchatProject] JSON 파싱 성공:", Object.keys(parsed));
            setExtractedData((prev) => ({ ...(prev || {}), ...parsed }));
            return true;
          } catch (e) {
            console.warn("[AIchatProject] JSON 파싱 실패:", e.message, "\nsnippet:", snippet?.slice(0, 200));
            return false;
          }
        };
        // 한 위치에서 균형 잡힌 { ... } 한 덩어리 추출
        const extractBalancedJsonAt = (text, fromIdx) => {
          const start = text.indexOf("{", fromIdx);
          if (start === -1) return null;
          let depth = 0; let inStr = false; let esc = false;
          for (let i = start; i < text.length; i++) {
            const c = text[i];
            if (inStr) {
              if (esc) esc = false;
              else if (c === "\\") esc = true;
              else if (c === '"') inStr = false;
            } else {
              if (c === '"') inStr = true;
              else if (c === '{') depth++;
              else if (c === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
            }
          }
          return null;
        };

        const removeRanges = []; // 본문에서 잘라낼 [start, end] 영역 모음
        const closedRegex = /```json\s*([\s\S]*?)\s*```/g;
        let closedAny = false;
        let m;
        while ((m = closedRegex.exec(reply)) !== null) {
          closedAny = true;
          tryParseAndApply(m[1]);
          removeRanges.push([m.index, m.index + m[0].length]);
        }
        // truncated ```json 시작은 있는데 닫는 fence 없는 경우
        if (!closedAny && reply.includes("```json")) {
          const startIdx = reply.indexOf("```json");
          const range = extractBalancedJsonAt(reply, startIdx + 7);
          if (range) {
            tryParseAndApply(reply.slice(range.start, range.end));
            removeRanges.push([startIdx, reply.length]);
          } else {
            removeRanges.push([startIdx, reply.length]);
          }
        }
        // fence 없이 "json\n{...}" 형태 (모델이 fence 누락한 경우)
        // 또는 본문 어딘가의 contractTerms 포함 raw JSON 객체.
        if (removeRanges.length === 0) {
          // pattern A: 줄 시작에 "json\n" 또는 "JSON\n" 후 객체
          const jsonHeaderRe = /(^|\n)\s*json\s*\n/i;
          const jh = reply.match(jsonHeaderRe);
          if (jh) {
            const after = (jh.index || 0) + jh[0].length;
            const range = extractBalancedJsonAt(reply, after);
            if (range && tryParseAndApply(reply.slice(range.start, range.end))) {
              removeRanges.push([(jh.index || 0), range.end]);
            }
          }
        }
        if (removeRanges.length === 0) {
          // pattern B: 그냥 "{ ... \"contractTerms\" ... }" 가 본문에 있으면 그 덩어리만 추출
          const ctIdx = reply.search(/"contractTerms"\s*:/);
          if (ctIdx !== -1) {
            // contractTerms 키 앞쪽의 가장 가까운 { 부터 균형 추출
            let braceStart = reply.lastIndexOf("{", ctIdx);
            if (braceStart !== -1) {
              const range = extractBalancedJsonAt(reply, braceStart);
              if (range && tryParseAndApply(reply.slice(range.start, range.end))) {
                removeRanges.push([range.start, range.end]);
              }
            }
          }
        }
        // 추가로 top-level 등록폼 JSON도 별개 객체로 본문에 있을 수 있음 (title/scope/budgetAmount 키)
        if (removeRanges.length > 0) {
          const titleIdx = reply.search(/"title"\s*:/);
          if (titleIdx !== -1) {
            // 이미 제거 범위에 포함되지 않은 경우만
            const inRemoved = removeRanges.some(([s, e]) => titleIdx >= s && titleIdx <= e);
            if (!inRemoved) {
              let braceStart = reply.lastIndexOf("{", titleIdx);
              if (braceStart !== -1) {
                const range = extractBalancedJsonAt(reply, braceStart);
                if (range && tryParseAndApply(reply.slice(range.start, range.end))) {
                  removeRanges.push([range.start, range.end]);
                }
              }
            }
          }
        }

        if (removeRanges.length > 0) {
          // 영역 병합·정렬 후 본문에서 제거
          removeRanges.sort((a, b) => a[0] - b[0]);
          const merged = [];
          for (const [s, e] of removeRanges) {
            if (merged.length && s <= merged[merged.length - 1][1]) {
              merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
            } else merged.push([s, e]);
          }
          let out2 = "";
          let cursor = 0;
          for (const [s, e] of merged) { out2 += reply.slice(cursor, s); cursor = e; }
          out2 += reply.slice(cursor);
          // 떠도는 단독 "json" 헤더 라인 정리
          cleanReply = out2.replace(/(^|\n)\s*json\s*(?=\n|$)/gi, "").trim();
        }

        // JSON 제거 후 남은 leftover 정리:
        //  - 빈 section header: "### N. ..." 다음에 다음 section header 또는 끝까지 비어있으면 헤더 자체 제거
        //  - 연속된 "---" 구분선 정리
        //  - 연속 빈 줄 압축
        cleanReply = cleanReply
          .replace(/(^|\n)#{2,4}\s*\d+\.\s*[^\n]*\n+(?=(\n|#{2,4}\s|$))/g, "$1")  // 빈 section header 제거
          .replace(/(\n---\n)+/g, "\n---\n")                                      // 연속 구분선 압축
          .replace(/\n{3,}/g, "\n\n")                                             // 3+ 빈 줄 → 2개
          .trim();

        // 잘림 감지: ```json 시작 후 닫는 fence 가 없거나, 본문 마지막이 미완성 JSON 처럼 보이면 안내문 prepend.
        const looksTruncated =
          /```json[\s\S]*$/m.test(cleanReply) ||           // 닫는 fence 없는 ```json
          /[{[,]\s*$/.test(cleanReply) ||                   // 마지막 글자가 { [ , 로 끝남
          /"PHASE\s*\d*"?\s*:?\s*"?\s*$/i.test(cleanReply); // PHASE 0X 도중 끊김
        if (looksTruncated && removeRanges.length === 0) {
          cleanReply = "⚠️ 응답이 길어 도중에 잘렸어요. 같은 메시지 다시 보내주시거나 ⭐로 핵심만 짧게 다시 입력해 주세요.\n\n" + cleanReply;
        }
      }

      // JSON 만 오고 텍스트가 비면 (보통 batch mode 후속 응답) 기본 안내문 표시.
      const finalReply = cleanReply && cleanReply.trim().length > 0
        ? cleanReply
        : "✨ 기획안과 7가지 세부 협의 사항을 정리했어요!\n\n아래 **'등록 폼에 반영하기'** 버튼을 누르시면 자동으로 입력돼요.";

      // 7가지 세부 협의 마크다운("## 1. 작업 범위" 시작점) 이 본문에 포함돼 있으면
      // 시각적으로 두 말풍선으로 나눠 표시 (앞: 등록폼 정리, 뒤: 7가지 협의).
      const splitIdx = finalReply.search(/(?:^|\n)\s*##\s*1\.\s*작업\s*범위/);
      if (splitIdx > 30) {
        const head = finalReply.slice(0, splitIdx).trim();
        const tail = finalReply.slice(splitIdx).trim();
        const now = new Date();
        setMessages((prev) => [
          ...prev,
          ...(head ? [{ role: "bot", text: head, time: now }] : []),
          ...(tail ? [{ role: "bot", text: tail, time: new Date(now.getTime() + 1) }] : []),
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", text: finalReply, time: new Date() }]);
      }
    } catch (err) {
      console.error("[AIchatProject] AI 호출 실패:", err);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: `죄송해요, 응답 중 오류가 발생했어요 🙇\n(${err.message})`, time: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatText = (text) => {
    // 1) [[BLUE]]...[[/BLUE]] 영역을 파란색 박스 + ⭐ 한번에 입력하기 버튼으로 변환.
    //    원본 텍스트를 평문 + 파란 박스 노드로 분할.
    const blueRe = /\[\[BLUE\]\]([\s\S]*?)\[\[\/BLUE\]\]/g;
    const segments = [];
    let lastIdx = 0;
    let bm;
    while ((bm = blueRe.exec(text)) !== null) {
      if (bm.index > lastIdx) segments.push({ kind: "plain", text: text.slice(lastIdx, bm.index) });
      segments.push({ kind: "blue", text: bm[1].trim() });
      lastIdx = bm.index + bm[0].length;
    }
    if (lastIdx < text.length) segments.push({ kind: "plain", text: text.slice(lastIdx) });

    const renderPlain = (raw, keyPrefix) => raw.split("\n").map((line, i, arr) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={`${keyPrefix}-${i}`}>
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });

    return segments.map((seg, idx) => {
      if (seg.kind === "blue") {
        return (
          <div key={`blue-${idx}`} style={{
            background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
            border: "1.5px solid #BFDBFE",
            borderRadius: 12,
            padding: "12px 14px",
            margin: "8px 0",
            color: "#1E40AF",
            fontSize: 13.5,
            lineHeight: 1.6,
            fontFamily: F,
          }}>
            <div style={{ marginBottom: 10 }}>{renderPlain(seg.text, `blue-${idx}-t`)}</div>
            <button
              type="button"
              onClick={() => {
                setInput((prev) => (prev.startsWith("⭐") ? prev : `⭐ ${prev}`.trim()));
                // input 으로 포커스
                setTimeout(() => {
                  const el = document.querySelector('input[data-ai-chat-input="1"], textarea[data-ai-chat-input="1"]');
                  el?.focus();
                }, 30);
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999, border: "none",
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: F, boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
              }}
            >
              ⭐ 한 번에 모두 입력하기
            </button>
          </div>
        );
      }
      return <span key={`plain-${idx}`}>{renderPlain(seg.text, `plain-${idx}`)}</span>;
    });
  };


  const handleConfirm = () => {
    const savedProjectRegisterState = location.state?.projectRegisterState;

    // AI가 추출한 필드를 기존 data에 병합
    const mergedData = extractedData
      ? { ...(savedProjectRegisterState?.data ?? {}), ...extractedData }
      : savedProjectRegisterState?.data;

    // [중요] location.state는 새로고침/메뉴이동 시 사라지므로
    // store에도 백업 저장해 ProjectRegister가 폴백으로 읽을 수 있게 함.
    if (mergedData) {
      setAiProjectDraft(mergedData);
      console.log("[AIchatProject] store에 aiProjectDraft 저장 완료", mergedData);
    }

    if (savedProjectRegisterState) {
      navigate("/project_register", {
        replace: true,
        state: {
          projectRegisterState: { ...savedProjectRegisterState, data: mergedData },
        },
      });
      return;
    }

    // ProjectRegister에서 진입한 게 아니어도, 추출 데이터가 있으면 새 등록 흐름으로 보냄
    if (extractedData) {
      navigate("/project_register", {
        state: {
          projectRegisterState: { phase: 1, projectType: "outsource", step: 1, data: extractedData },
        },
      });
      return;
    }

    navigate("/project_register");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      <Header_client />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 32px" }}>

        {/* 상단 배너 */}
        <div style={{
          background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
          border: "1.5px solid #DBEAFE", borderRadius: 18,
          padding: "20px 28px",
          display: "flex", alignItems: "center", gap: 20,
          marginBottom: 20,
        }}>
          <img src={mascotIcon} alt="AI 매니저" style={{ width: 60, height: 60, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1E40AF", margin: "0 0 4px", fontFamily: F }}>
              AI 매니저와 프로젝트 내용 작성하기
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", margin: 0, fontFamily: F }}>
              대화를 통해 프로젝트 상세 내용을 자동으로 정리해 드려요. 완성 후 "프로젝트 등록에 적용하기"를 눌러주세요.
            </p>
          </div>
          <button
            onClick={handleConfirm}
            style={{
              padding: "11px 22px", borderRadius: 999, border: "none",
              background: extractedData
                ? "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)"
                : PRIMARY_GRAD,
              color: "white", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
              boxShadow: extractedData
                ? "0 4px 18px rgba(34,197,94,0.45)"
                : "0 4px 14px rgba(99,102,241,0.30)",
              transition: "opacity 0.15s",
              animation: extractedData ? "pulseReady 1.6s ease-in-out infinite" : "none",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <style>{`@keyframes pulseReady {0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}`}</style>
            {extractedData ? "✨ 프로젝트 등록에 자동 입력하기" : "← 프로젝트 등록으로 돌아가기"}
          </button>
        </div>

        {/* 채팅창 */}
        <div style={{
          background: "white", borderRadius: 18,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
          border: "1px solid #E5E7EB",
        }}>
          {/* 채팅 헤더 */}
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", gap: 12,
            background: "#FAFAFA",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "#DBEAFE",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              <img src={heroStudent} alt="AI 매니저" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, fontFamily: F }}>AI 매니저</p>
              <p style={{ fontSize: 15, color: "#22C55E", margin: 0, fontFamily: F }}>● 온라인</p>
            </div>
          </div>

          {/* 메시지 목록 */}
          <div style={{
            height: "calc(100vh - 320px)", minHeight: 520, maxHeight: 820,
            overflowY: "auto",
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
                  maxWidth: "70%",
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  background: msg.role === "user"
                    ? PRIMARY_GRAD
                    : "#F8FAFC",
                  border: msg.role === "bot" ? "1px solid #E5E7EB" : "none",
                  color: msg.role === "user" ? "white" : "#111827",
                  fontSize: 16, fontFamily: F, lineHeight: 1.7,
                  boxShadow: msg.role === "user" ? "0 2px 10px rgba(99,102,241,0.25)" : "none",
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

            {isTyping && (
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
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "#94A3B8",
                      animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 단계별 예시 답변 칩 (프로젝트 모드 + JSON 추출 전에만 표시) */}
          {!contractMode && !extractedData && (() => {
            const userMsgCount = messages.filter((m) => m.role === "user").length;
            const chips = STEP_EXAMPLE_CHIPS[userMsgCount];
            if (!chips || isTyping) return null;
            return (
              <div style={{ padding: "0 24px 12px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", margin: "0 0 8px", fontFamily: F }}>
                  💡 이런 답변은 어떨까요?
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {chips.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p)} style={{
                      padding: "7px 14px", borderRadius: 999,
                      border: "1.5px solid #DBEAFE", background: "#EFF6FF",
                      color: "#2563EB", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#DBEAFE"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#EFF6FF"; }}
                    >{p}</button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 계약 모드의 기존 빠른 질문 (첫 메시지에만) */}
          {contractMode && messages.length <= 1 && (
            <div style={{ padding: "0 24px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p)} style={{
                  padding: "7px 14px", borderRadius: 999,
                  border: "1.5px solid #DBEAFE", background: "#EFF6FF",
                  color: "#2563EB", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#DBEAFE"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#EFF6FF"; }}
                >{p}</button>
              ))}
            </div>
          )}

          {/* 기획안 완성 시 적용 안내 카드 */}
          {extractedData && (
            <div style={{
              margin: "4px 24px 16px",
              padding: "18px 20px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
              border: "1.5px solid #6EE7B7",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ fontSize: 28 }}>✨</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#065F46", margin: "0 0 4px", fontFamily: F }}>
                  프로젝트 기획안이 완성돼어요!
                </p>
                <p style={{ fontSize: 14, color: "#047857", margin: 0, fontFamily: F, lineHeight: 1.6 }}>
                  대화 내용을 바탕으로 기획안을 정리했어요. 아래 버튼을 누르면 프로젝트 등록 폼에 자동으로 입력돼요.
                </p>
              </div>
              <button
                onClick={handleConfirm}
                style={{
                  padding: "12px 22px", borderRadius: 999, border: "none",
                  background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)",
                  color: "white", fontSize: 15, fontWeight: 700,
                  cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
                  boxShadow: "0 4px 18px rgba(34,197,94,0.45)",
                }}
              >
                등록 폼에 반영하기 →
              </button>
            </div>
          )}

          {/* 입력창 */}
          <div style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid #F1F5F9",
            display: "flex", gap: 10,
          }}>
            <input
              type="text"
              autoFocus={false}
              data-ai-chat-input="1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  // 한글 조합 중일 때는 sendMessage가 실행되지 않도록 방지 (중복 입력 해결)
                  if (e.nativeEvent.isComposing) return;
                  sendMessage();
                }
              }}
              placeholder="프로젝트에 대해 자유롭게 말씀해 주세요..."
              style={{
                flex: 1, padding: "12px 18px", borderRadius: 999,
                border: "1.5px solid #E5E7EB", outline: "none",
                fontSize: 16, fontFamily: F, color: "#111827",
                transition: "border 0.15s",
              }}
              onFocus={e => e.target.style.border = "1.5px solid #93C5FD"}
              onBlur={e => e.target.style.border = "1.5px solid #E5E7EB"}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              style={{
                width: 46, height: 46, borderRadius: "50%", border: "none",
                background: input.trim() ? PRIMARY_GRAD : "#E5E7EB",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s",
                boxShadow: input.trim() ? "0 2px 10px rgba(99,102,241,0.30)" : "none",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
