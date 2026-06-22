# Alpha-Helix

> **AIBE5 Team2** · AI 기반 퀀트 투자 워크스페이스  
> 자연어 한 줄로 투자 전략을 만들고, 백테스트 · AI 신호 · 실주문까지 한 흐름으로 연결합니다.

---

## 👥 팀원

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/songjihoon116">
        <img src="https://github.com/songjihoon116.png?size=100" width="80" style="border-radius:50%"/><br/>
        <b>송지훈</b>
      </a><br/>
      <sub>팀장 · 백엔드 리드</sub><br/>
      <sub>Spring Boot · JWT · KIS 브로커</sub><br/>
      <sub>OrderProposal · Toss 결제</sub>
    </td>
    <td align="center">
      <a href="https://github.com/0cha-0cha">
        <img src="https://github.com/0cha-0cha.png?size=100" width="80" style="border-radius:50%"/><br/>
        <b>손주현</b>
      </a><br/>
      <sub>프론트엔드 리드</sub><br/>
      <sub>React · Alpha Workspace UI</sub><br/>
      <sub>브리핑 · 알림 · 구독 플로우</sub>
    </td>
    <td align="center">
      <a href="https://github.com/ryu-han-kr">
        <img src="https://github.com/ryu-han-kr.png?size=100" width="80" style="border-radius:50%"/><br/>
        <b>한경수</b>
      </a><br/>
      <sub>인프라 · 배포 리드</sub><br/>
      <sub>EC2 · Nginx · systemd</sub><br/>
      <sub>CI/CD · 도메인/SSL</sub>
    </td>
  </tr>
</table>

> **AI/Analytics 공동 개발** — FastAPI · vectorbt 백테스트 엔진 · XGBoost 시그널 · SHAP · 5-State HMM Regime · Trust Score · QuantStats Tearsheet · 멀티 LLM 연동(Gemini · Perplexity · Anthropic)

---

## 프로젝트 소개

**Alpha-Helix**는 개인 투자자가 퀀트 전략을 쉽게 설계·검증·실행할 수 있도록 만든 올인원 AI 투자 워크스페이스입니다.

- 자연어로 투자 목표를 입력하면 AI가 전략 파라미터를 제안합니다.
- 7가지 전략 엔진으로 과거 데이터 백테스트 및 QuantStats Tearsheet 리포트를 생성합니다.
- XGBoost 모델이 매일 22:30 KST 자동 재학습하여 다음 날 매수 신호를 예측합니다.
- 신호는 OrderProposal 큐에 쌓이고, 사용자가 승인하면 한국투자증권(KIS) API로 실주문이 전송됩니다.

---

## 핵심 플로우

```
사용자 (자연어 목표 입력)
        │
        ▼
  AI 채팅 (Gemini 2.5-flash)
  → 전략 파라미터 추출 및 제안
        │
        ▼
  Alpha Workspace
  ┌─────────────────────────────────┐
  │  Config   │ 전략 파라미터 설정   │
  │  Report   │ 백테스트 실행        │  ◄── vectorbt + 7전략
  │  Regime   │ 시장 국면 분석       │  ◄── 5-State HMM
  │  Trust    │ 전략 신뢰도 점수     │  ◄── Walk-Forward + 섭동
  │  Briefing │ 일일 시장 브리핑     │  ◄── Gemini + Perplexity
  │  Log      │ 의사결정 기록        │
  └─────────────────────────────────┘
        │
        ▼
  DailySignalGenerator (매일 22:30 KST)
  → XGBoost up-probability + SHAP 설명
        │
        ▼
  OrderProposal 큐
  → MOCK 제안 생성 → 이메일 HMAC 승인 링크 발송
        │         (TTL 만료 시 자동 정리)
        ▼
  사용자 승인 (Proposals 페이지)
        │
        ▼
  KIS OpenAPI 실주문 전송
  (MOCK → REAL 명시 게이트 · 글로벌 Kill-Switch)
```

---

## 주요 기능

| 영역 | 설명 |
|------|------|
| **멀티 LLM 채팅** | Gemini 2.5-flash 기본, Anthropic · OpenAI · Perplexity 폴백 체인. AI 채팅 20 req/h/user 제한(Bucket4j). |
| **백테스트 엔진** | `buy_and_hold` · `sma_cross` · `rsi_meanrev` · `macd` · `momentum_12_1` · `vix_risk_off` · `infinite_buying` — 수수료 0.25% + 슬리피지 0.1% 반영. |
| **QuantStats Tearsheet** | HTML 리포트 자동 생성 후 `/reports/{file}.html` 정적 서빙. |
| **XGBoost AI 신호** | 13개 피처, 매일 22:30 KST 자동 재학습. SHAP으로 신호 근거 설명. |
| **5-State HMM Regime** | `bull_quiet` · `bull_volatile` · `sideways` · `bear` · `high_vol_unstable` 5국면 자동 분류. |
| **Trust Score** | Walk-Forward 안정성 + Regime 정합성 + 파라미터 섭동 민감도 종합 신뢰 점수. |
| **OrderProposal 큐** | 일일 시그널 → MOCK 제안 → HMAC 서명 이메일 승인 → 실주문. TTL 만료 자동 정리. |
| **KIS 브로커 연동** | 모의/실거래 계좌 등록, AES-GCM 암호화 저장, 토큰 자동 갱신, 잔고·현재가·주문 API. |
| **Living Briefing** | Gemini + Perplexity 실시간 뉴스 기반 일일 시장 브리핑. TTS 라디오 기능 내장. |
| **구독 플랜** | FREE · STANDARD(9,900원/월) · PREMIUM(19,900원/월) — Toss Payments v1 결제 연동. |
| **실시간 알림** | SSE 기반 시그널·체결·만료 알림 — Zustand persist + `/api/notifications/*`. |
| **Circuit Breaker** | Analytics 사이드카 Resilience4j CB + Retry. 사이드카 다운 시 자동 폴백. |

---

## 기술 스택

**Frontend**  
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

**Backend**  
![Spring Boot](https://img.shields.io/badge/Spring_Boot_4-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java_21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Gradle](https://img.shields.io/badge/Gradle_9-02303A?style=for-the-badge&logo=gradle&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Flyway](https://img.shields.io/badge/Flyway-CC0200?style=for-the-badge&logo=flyway&logoColor=white)

**Analytics**  
![Python](https://img.shields.io/badge/Python_3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-337AB7?style=for-the-badge&logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)

**Database**  
![MySQL](https://img.shields.io/badge/MySQL_8-4479A1?style=for-the-badge&logo=mysql&logoColor=white)

**AI**  
![Google Gemini](https://img.shields.io/badge/Gemini_2.5_flash-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-191919?style=for-the-badge&logo=anthropic&logoColor=white)
![Perplexity](https://img.shields.io/badge/Perplexity-20808D?style=for-the-badge&logo=perplexity&logoColor=white)

**Infra**  
![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Toss Payments](https://img.shields.io/badge/Toss_Payments-0064FF?style=for-the-badge&logo=toss&logoColor=white)

---

## 아키텍처

```
Browser (React · :5173)
    │
    │  REST / JWT HttpOnly Cookie
    ▼
Backend (Spring Boot · :8080)
    │
    │  HTTP + ANALYTICS_INTERNAL_TOKEN
    ▼
Analytics (FastAPI · :8001)
    ├── /backtest   — vectorbt 백테스트
    ├── /signal     — XGBoost 시그널 + SHAP
    ├── /trust-score — Walk-Forward + Regime
    └── /reports    — QuantStats HTML 서빙
```

---

## 보안 설계

| 항목 | 설명 |
|------|------|
| **JWT HttpOnly 쿠키** | XSS 토큰 탈취 방지. `HttpOnly; Secure(prod); SameSite=Lax` |
| **KIS 자격증명 암호화** | DB 평문 저장 금지. AES-GCM + `APP_CRYPTO_KEY` 환경변수 |
| **HMAC 승인 링크** | OrderProposal 이메일 토큰 위조 차단. `OrderProposalExpiryJob` 자동 만료 |
| **MOCK → REAL 게이트** | 모든 주문은 MOCK 선행. 사용자 명시 승인 후에만 실주문 전송 |
| **글로벌 Kill-Switch** | `TRADING_KILL_SWITCH=true` 시 KIS 어댑터가 모든 실주문 즉시 거부 |
| **Analytics 내부 토큰** | `ANALYTICS_INTERNAL_TOKEN`으로 외부 직접 접근 차단 |
| **Rate Limiting** | AI 채팅 20 req/h/user (Bucket4j) |

---

## 로컬 실행

### 사전 준비
- JDK 21, Node 20+, Python 3.11, MySQL 8
- `backend/src/main/resources/application-local.properties` 생성 (템플릿: `application.properties`)
- `analytics/.env` 생성 (템플릿: `analytics/.env.example`)

### 1. DB
```bash
mysql -uroot -p1234 -e "CREATE DATABASE alphahelix_db CHARACTER SET utf8mb4;"
```

### 2. Backend (:8080)
```bash
cd backend
# Windows
.\gradlew bootRun --args="--spring.profiles.active=local"
# Linux/Mac
./gradlew bootRun --args="--spring.profiles.active=local"
```

### 3. Analytics (:8001)
```bash
cd analytics
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```

### 4. Frontend (:5173)
```bash
cd frontend
npm install
npm run dev
```

### 헬스 체크
```
http://localhost:5173          # 프론트엔드
http://localhost:8080/actuator/health  # 백엔드 {"status":"UP"}
http://localhost:8001/docs     # Analytics Swagger
```

---

## 필수 환경변수

| 키 | 용도 |
|----|------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | MySQL 연결 |
| `JWT_SECRET` | JWT HS256 서명 (32+ bytes) |
| `APP_CRYPTO_KEY` | KIS 키 AES-GCM 암호화 (Base64 32 bytes) · **기본값 없음** |
| `APPROVAL_HMAC_SECRET` | OrderProposal 승인 링크 HMAC 서명 |
| `GEMINI_API_KEY` | Gemini AI (미설정 시 룰베이스 폴백) |
| `ANALYTICS_BASE_URL` / `ANALYTICS_INTERNAL_TOKEN` | BE → Analytics 인증 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Gmail SMTP 앱 비밀번호 |
| `TOSS_SECRET_KEY` | Toss Payments 시크릿 키 |
| `TRADING_KILL_SWITCH` | `true` 시 모든 KIS 실주문 차단 |

---

## 디렉터리 구조

```
.
├── backend/                        Spring Boot REST API
│   └── src/main/java/.../domain/
│       ├── strategy/               퀀트 전략 · 백테스트 · KIS 브로커 · OrderProposal
│       ├── ai/                     멀티 LLM · AiGateway · 쿼터 관리
│       ├── user/                   회원가입 · 로그인 · JWT · 이메일 인증
│       ├── payment/                Toss Payments · 구독 플랜
│       └── notification/           SSE 실시간 알림
│
├── analytics/                      FastAPI AI 사이드카
│   └── app/
│       ├── backtest/               vectorbt 엔진 · 무한매수법
│       ├── models/                 XGBoost 시그널 (일 22:30 KST 자동 재학습)
│       ├── explain/                SHAP 설명
│       ├── metrics/                QuantStats Tearsheet
│       └── robust/                 Walk-Forward · 5-State HMM · Trust Score
│
├── frontend/                       React + Vite
│   └── src/
│       ├── alpha/                  Alpha Workspace · 계좌 · Proposals · 브리핑
│       ├── pages/                  Home · Login · Mypage · 알림 · VisionBoard
│       ├── components/             공통 UI · Shell · PageLoader · ErrorBoundary
│       ├── store/                  Zustand (auth · notifications)
│       └── i18n/                   한/영 다국어
│
└── deploy/                         배포 설정
    ├── DEPLOY_FROM_SCRATCH.md
    ├── ENV_TEMPLATE.txt
    ├── nginx-who-a.conf
    └── who-a-*.service
```

---

## E2E 시나리오 (수동 검증)

1. 회원가입 → 이메일 인증 → 로그인 (JWT 쿠키 확인)
2. 마이페이지 → KIS 모의계좌 등록
3. Alpha Workspace 생성 → AI 채팅으로 전략 제안 받기
4. 백테스트 실행 → QuantStats Tearsheet 확인
5. Regime 분석 · Trust Score 조회
6. 일일 브리핑 생성 (TTS 라디오 재생)
7. OrderProposal 생성 → 이메일 승인 링크 → Proposals 페이지 MOCK 승인
8. (선택) Kill-Switch off + 실거래 계좌 → REAL 주문 게이트

---

## 라이선스

본 리포지토리는 교육·발표 목적의 비공개 팀 프로젝트입니다.  
AIBE5 — Team2 · Alpha-Helix
