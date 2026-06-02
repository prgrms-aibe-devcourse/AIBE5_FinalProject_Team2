# 시스템 아키텍처 및 기능 가이드

> **작성일**: 2026년 5월 26일  
> **프로젝트**: Alpha-Helix  
> **대상**: 전체 시스템 개요

---

## 목차

1. [전체 시스템 구조](#1-전체-시스템-구조)
2. [프론트엔드 기능 모듈](#2-프론트엔드-기능-모듈)
3. [백엔드 API 구조](#3-백엔드-api-구조)
4. [Analytics 엔진](#4-analytics-엔진)
5. [데이터베이스 스키마](#5-데이터베이스-스키마)
6. [데이터 흐름](#6-데이터-흐름)

---

## 1. 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pages: Portfolio, Search, Strategy, Analytics, Dashboard │  │
│  │ Components: Header, Modal, Chat, AI Chat                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST API
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                Backend (Spring Boot + Gradle)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Controllers: User, Project, Portfolio, Analytics, Bank   │  │
│  │ Services: Auth, Matching, Portfolio Management           │  │
│  │ Entities: User, Project, Portfolio, Interest             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Database Access
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Users, Projects, Portfolio, Interests, Stats             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Analytics Service (Python/FastAPI)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Data Collectors: Polygon, FRED, Binance, Yahoo Finance   │  │
│  │ Backtest Engine: VectorBT (6 strategies)                 │  │
│  │ Risk Analysis: Kelly, Risk Parity, HMM                   │  │
│  │ ML: XGBoost Prediction, SHAP Explanation                 │  │
│  │ Market DB: Time Series Storage                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↑                                           ↑
         │ REST API (조회/실행)          │ Scheduled Tasks
         │                              │ (매일 06:00 UTC)
         └──────────────────────────────┘
```

---

## 2. 프론트엔드 기능 모듈

### 2.1 사용자 인증 및 계정 관리

**관련 페이지**:

- `Login.jsx`: 이메일/비밀번호 로그인
- `Signup.jsx`: 회원가입 (Partner/Client 선택)
- `OAuthKakaoCallback.jsx`: 카카오 OAuth 콜백
- `FindPassword.jsx`: 비밀번호 재설정
- `Mypage.jsx`: 개인정보 관리

**주요 기능**:

- 이메일 인증
- 프로필 사진 업로드
- 거래 계좌 정보 등록
- 1원 인증 (은행 검증)

---

### 2.2 파트너 관리

**관련 페이지**:

- `PartnerRegister.jsx`: 파트너 등록
- `Partner_Profile.jsx`: 파트너 프로필 수정
- `PartnerProfileView.jsx`: 파트너 프로필 조회
- `PartnerDashboard.jsx`: 파트너 대시보드
- `PartnerSearch.jsx`: 파트너 검색
- `Partner_Portfolio.jsx`: 포트폴리오 관리

**주요 기능**:

- 스킬 등록/관리
- 포트폴리오 공개/숨김
- 관심 프로젝트 저장
- 통계 조회 (프로젝트 수, 성공률 등)

---

### 2.3 클라이언트 관리

**관련 페이지**:

- `ClientRegister.jsx`: 클라이언트 등록
- `Client_Profile.jsx`: 클라이언트 프로필 수정
- `ClientProfileView.jsx`: 클라이언트 프로필 조회
- `ClientDashboard.jsx`: 클라이언트 대시보드
- `ClientSearch.jsx`: 클라이언트 검색

**주요 기능**:

- 선호 스킬 등록
- 프로젝트 등록 및 관리
- 파트너 매칭
- 프로젝트 진행 상황 추적

---

### 2.4 포트폴리오 관리

**관련 페이지**:

- `Partner_Portfolio.jsx`: 파트너 포트폴리오
- `Client_Portfolio.jsx`: 클라이언트 포트폴리오
- `PortfolioDetailEditor.jsx`: 포트폴리오 편집
- `PortfolioProjectPreview.jsx`: 프로젝트 미리보기

**주요 기능**:

- 포트폴리오 CRUD
- 프로젝트 추가/제거
- 설명 및 이미지 관리
- 공개/비공개 설정

---

### 2.5 프로젝트 매칭

**관련 페이지**:

- `ProjectRegister.jsx`: 프로젝트 등록
- `ProjectSearch.jsx`: 프로젝트 검색
- `ClientSearch.jsx`: 클라이언트 검색

**주요 기능**:

- 프로젝트 생성/검색
- 스킬 기반 매칭
- 관심 목록 관리
- 제안 전송

---

### 2.6 Analytics 및 전략 분석

**관련 페이지**:

- `AnalyticsLab.jsx`: 분석 실험실
- `StrategyWorkspace.jsx`: 전략 작업 공간
- `AlphaGuide.jsx`: Alpha-Helix 가이드

**주요 기능**:

- 전략 백테스트
- 파라미터 최적화
- 성과 지표 분석
- 레짐 분석
- 리스크 평가

---

### 2.7 AI 챗봇 및 설명 가능성

**관련 페이지**:

- `ChatBot.jsx`: 일반 챗봇
- `AIchatPortfolio.jsx`: 포트폴리오 AI 분석
- `AIchatProfile.jsx`: 프로필 AI 분석
- `AIchatProject.jsx`: 프로젝트 AI 분석

**주요 기능**:

- 자연어 질의응답
- 포트폴리오 성과 분석
- SHAP 설명가능성
- XGBoost 예측

---

### 2.8 구독 및 결제

**관련 페이지**:

- `Pricing.jsx`: 요금제 안내
- `SubscriptionManage.jsx`: 구독 관리
- `SubscriptionSuccess/Fail.jsx`: 결제 결과
- `TossPaymentSuccess/Fail.jsx`: Toss 결제 콜백

**주요 기능**:

- 구독 플랜 선택
- Toss 결제 통합
- 구독 취소/변경

---

### 2.9 알림 및 설정

**관련 페이지**:

- `NotificationsPage.jsx`: 알림 센터
- `BrokerSettings.jsx`: 거래소 설정

**주요 기능**:

- 실시간 알림
- 거래소 API 키 관리
- 리스크 알림 설정

---

### 2.10 가이드 및 교육

**관련 페이지**:

- `UsageGuide.jsx`: 사용 가이드 (메인)
- `UsageGuide_Contract.jsx`: 계약 가이드
- `UsageGuide_Matching.jsx`: 매칭 가이드
- `UsageGuide_Portfolio.jsx`: 포트폴리오 가이드
- `UsageGuide_Policy.jsx`: 정책 가이드
- `UsageGuide_ServicePolicy.jsx`: 서비스 정책

**주요 기능**:

- 기능별 사용 설명
- 최적 사용법 제시
- FAQ

---

## 3. 백엔드 API 구조

### 3.1 인증 관련 API

```
POST   /api/auth/signup              # 회원가입
POST   /api/auth/login               # 로그인
POST   /api/auth/logout              # 로그아웃
POST   /api/auth/refresh             # 토큰 갱신
GET    /api/auth/me                  # 현재 사용자 정보
```

### 3.2 사용자 관리 API

```
GET    /api/users/{userId}           # 사용자 정보 조회
PUT    /api/users/{userId}           # 사용자 정보 수정
POST   /api/users/profile/partner    # 파트너 프로필 생성
POST   /api/users/profile/client     # 클라이언트 프로필 생성
GET    /api/users/{userId}/profile   # 프로필 조회
```

### 3.3 포트폴리오 API

```
GET    /api/portfolios               # 포트폴리오 목록
POST   /api/portfolios               # 포트폴리오 생성
GET    /api/portfolios/{id}          # 포트폴리오 상세 조회
PUT    /api/portfolios/{id}          # 포트폴리오 수정
DELETE /api/portfolios/{id}          # 포트폴리오 삭제
GET    /api/portfolios/{id}/metrics  # 포트폴리오 성과 지표
```

### 3.4 프로젝트 API

```
GET    /api/projects                 # 프로젝트 목록
POST   /api/projects                 # 프로젝트 생성
GET    /api/projects/{id}            # 프로젝트 상세 조회
PUT    /api/projects/{id}            # 프로젝트 수정
DELETE /api/projects/{id}            # 프로젝트 삭제
GET    /api/projects/search          # 프로젝트 검색
```

### 3.5 매칭 API

```
POST   /api/matches/find             # 매칭 탐색
GET    /api/matches/{id}             # 매칭 상세
POST   /api/matches/{id}/confirm     # 매칭 확정
```

### 3.6 은행 검증 API

```
POST   /api/bank/verify              # 1원 인증 요청
GET    /api/bank/status              # 인증 상태 조회
```

### 3.7 Analytics API (FastAPI 경유)

```
POST   /api/backtest                 # 백테스트 실행
POST   /api/signals/today            # 오늘 신호 생성
GET    /api/metrics/portfolio        # 포트폴리오 지표
POST   /api/predict/up               # 상승 확률 예측
```

---

## 4. Analytics 엔진

### 4.1 데이터 수집 (Collector)

**스케줄**:

- **06:00 UTC**: US OHLCV (Polygon.io)
- **07:00 UTC**: 매크로 지표 (FRED)
- **매 1시간**: 암호화폐 (Binance)

**수집 대상**:

```
US ETF: TQQQ, SOXL, UPRO, QLD, TNA, LABU
벤치마크: SPY, QQQ
채권/방어: TLT, GLD, SHY, SCHD
매크로: FEDFUNDS, DGS10, DGS2, T10Y2Y, VIXCLS, CPIAUCSL, UNRATE, DCOILWTICO
암호화폐: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, DOGEUSDT
```

**구현**: `analytics/app/data/collector.py`

---

### 4.2 백테스트 엔진 (VectorBT)

**6가지 기본 전략**:

1. **Buy and Hold**: 첫날 매수 후 보유
2. **SMA Cross**: SMA(20) > SMA(60) → Long
3. **RSI Mean Reversion**: RSI < 30 → Long
4. **MACD**: MACD 라인 신호 교차
5. **Momentum (12-1)**: 12M 누적수익 - 1M > 0 → Long
6. **VIX Risk-Off**: VIX ≤ 25 → Long

**파라미터**:

- `initial_capital`: 초기 자본 (기본 $100,000)
- `fees`: 거래 수수료 (기본 0.001 = 0.1%)
- `slippage`: 슬리피지 (기본 0.0005)

**출력**:

- Portfolio Value: 누적 수익 곡선
- Trades: 개별 거래 기록
- Risk Metrics: Sharpe, Sortino, MDD 등

**구현**: `analytics/app/backtest/vbt_engine.py`

---

### 4.3 위험 관리 시스템 (Risk Control)

**구성 요소**:

1. **KellyPositionSizer**: 켈리 공식 기반 포지션 결정
   - Full Kelly: $f^* = \mu / \sigma^2$
   - Fractional Kelly: $f = f^* \times 0.25$ (보수적)
   - Bootstrap CI: 95% 신뢰구간 추정

2. **RiskBudgetAllocator**: 리스크 패리티 자산배분
   - 각 자산의 리스크 기여도 균등화
   - 변동성 타겟팅: $\text{Scale} = \sigma_{target} / \sigma_{realized}$

3. **ConfidenceScoringSystem**: 신호 신뢰도 평가
   - HMM 확률
   - 기술적 신호 강도
   - 리스크 환경

4. **VixMultiplierEngine**: VIX 기반 동적 조정

   ```
   VIX ≤ 15: 1.2x (저위험)
   15-25: 1.0x (정상)
   25-35: 0.6x (경고)
   > 35: 0.2x (극한)
   ```

5. **DrawdownCircuitBreaker**: 극단 손실 방지
   - Halt: MDD < -35%
   - Recovery: 복구 후 재시작

6. **RegimeAwareRiskFilter**: 국면별 리스크 제어
   - Bear/Crisis: 자동 포지션 청산

**구현**: `analytics/strategy/risk_control.py`

---

### 4.4 국면 탐지 (Regime Detection)

**5가지 국면**:

1. **Bull Quiet**: 이상적 (MA200 위, 상승, 저변동성)
2. **Bull Volatile**: 경고 (MA200 위, 상승, 고변동성)
3. **Bear**: 하락 (MA200 아래, 음의 추세)
4. **Sideways**: 방향성 없음
5. **High Vol Unstable**: 위험 (극단 변동성)

**측정**:

- MA200 대비 가격
- 20일 추세 기울기
- 60일 연환산 변동성

**구현**: `analytics/app/robust/regime.py`, `analytics/strategy/main.py`

---

### 4.5 머신러닝 (ML 예측)

**모델**: XGBoost

**입력 특성**:

- 기술적 지표: RSI, MACD, Momentum
- 매크로: VIX, 금리, 원유
- 가격 특성: 수익률, 변동성, 첨도

**출력**:

- 상승 확률 (0-1)

**설명가능성**: SHAP (SHapley Additive exPlanations)

- 각 피처의 기여도 시각화
- Top 3 영향 요소

**구현**: `analytics/app/models/xgboost_*.py`

---

## 5. 데이터베이스 스키마

### 5.1 사용자 테이블 (users)

| 컬럼                | 타입                | 설명                  |
| ------------------- | ------------------- | --------------------- |
| id                  | BIGINT PK           | 사용자 ID             |
| email               | VARCHAR(100) UNIQUE | 로그인 이메일         |
| username            | VARCHAR(50) UNIQUE  | 표시 이름             |
| password            | VARCHAR(255)        | 해시된 비밀번호       |
| phone               | VARCHAR(20)         | 전화번호              |
| user_type           | ENUM                | PARTNER / CLIENT      |
| gender              | ENUM                | MALE / FEMALE / OTHER |
| birth_date          | DATE                | 생년월일              |
| region              | VARCHAR(50)         | 거주 지역             |
| bank_name           | VARCHAR(50)         | 은행명                |
| bank_account_number | VARCHAR(50)         | 계좌번호              |
| bank_verified       | BOOLEAN             | 1원 인증 완료 여부    |
| created_at          | DATETIME            | 가입일                |
| updated_at          | DATETIME            | 수정일                |

### 5.2 파트너 프로필 (partner_profile)

| 컬럼         | 타입        | 설명        |
| ------------ | ----------- | ----------- |
| id           | BIGINT PK   |             |
| user_id      | BIGINT FK   | 1:1 users   |
| bio          | TEXT        | 자기소개    |
| hourly_rate  | DECIMAL     | 시간당 요금 |
| availability | VARCHAR(50) | 가능 시간   |
| created_at   | DATETIME    |             |

### 5.3 클라이언트 프로필 (client_profile)

| 컬럼         | 타입         | 설명      |
| ------------ | ------------ | --------- |
| id           | BIGINT PK    |           |
| user_id      | BIGINT FK    | 1:1 users |
| company_name | VARCHAR(100) | 회사명    |
| industry     | VARCHAR(50)  | 산업      |
| budget       | DECIMAL      | 예산      |
| created_at   | DATETIME     |           |

### 5.4 프로젝트 (projects)

| 컬럼        | 타입         | 설명                           |
| ----------- | ------------ | ------------------------------ |
| id          | BIGINT PK    |                                |
| client_id   | BIGINT FK    | 클라이언트                     |
| title       | VARCHAR(100) | 프로젝트명                     |
| description | TEXT         | 설명                           |
| field_id    | BIGINT FK    | 분야                           |
| status      | ENUM         | OPEN / IN_PROGRESS / COMPLETED |
| budget      | DECIMAL      | 예산                           |
| deadline    | DATE         | 마감일                         |
| created_at  | DATETIME     |                                |
| updated_at  | DATETIME     |                                |

### 5.5 관심 테이블

**user_interest_partners**:

- user_id, partner_id, created_at

**user_interest_projects**:

- user_id, project_id, created_at

---

## 6. 데이터 흐름

### 6.1 전략 실행 흐름

```
1. 사용자가 Analytics Lab에서 전략 파라미터 입력
   ↓
2. FastAPI 엔드포인트 `/backtest` 호출
   ↓
3. VectorBT 엔진이 백테스트 실행
   - OHLCV 데이터 로드
   - 기술적 지표 계산 (SMA, RSI, MACD)
   - 신호 생성
   - 포지션 관리
   - PnL 계산
   ↓
4. Risk Metrics 계산 (Sharpe, Sortino, MDD)
   ↓
5. 결과 Frontend 반환
   - 누적 수익 곡선
   - 거래 기록
   - 성과 지표
   ↓
6. 사용자가 Dashboard에서 결과 시각화
```

### 6.2 신호 생성 흐름 (매일 22:30 KST)

```
1. Scheduler 트리거
   ↓
2. Spring Boot에서 FastAPI `/signals/today` 호출
   ↓
3. 각 티커에 대해:
   a. 최근 2년 OHLCV 로드
   b. 국면 탐지 (Bull/Bear/Sideways)
   c. 기술적 신호 계산 (Momentum, SMA 등)
   d. HMM 신뢰도 추정
   e. 신뢰도 점수 계산
   f. ML 예측 (XGBoost)
   g. SHAP 설명 생성
   ↓
4. 결과를 Spring Boot에 반환
   ↓
5. Database에 저장 (신호 기록)
   ↓
6. 사용자 Dashboard에 표시
```

### 6.3 포트폴리오 평가 흐름

```
1. 사용자가 포트폴리오 조회
   ↓
2. Spring Boot에서 포트폴리오 보유 자산 조회
   ↓
3. FastAPI에 각 자산의 최근 수익률 요청
   ↓
4. QuantStats 엔진이 성과 메트릭 계산
   - CAGR
   - Sharpe Ratio
   - Sortino Ratio
   - Calmar Ratio
   - Max Drawdown
   - VaR / CVaR
   - Alpha / Beta (vs SPY)
   ↓
5. 결과를 Frontend 반환
   ↓
6. Dashboard 시각화
   - 수익 곡선
   - 성과 지표 표
   - 리스크 게이지
```

---

**마지막 수정**: 2026년 5월 26일  
**버전**: 1.0
