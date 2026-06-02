# API 명세서 (제출용)

서비스명: Alpha-Helix (Your Personal Quant Manager)  
버전: submission-v1.0  
최종 업데이트: 2026-06-01  
문서 상태: 제출본

---

## 1. 문서 목적

이 문서는 제출용 빌드 기준의 백엔드 API 명세입니다.  
실제 코드 기준으로 제공 API만 포함했고, 미구현 기능은 명시적으로 제외했습니다.

---

## 2. 제출 범위

### 2.1 포함 범위

- 인증/로그인
- 전략 CRUD 및 백테스트 트리거
- Analytics 사이드카 연동 API
- Alpha Workspace (목표 설정, 전략 정형화, 백테스트/Regime/Trust/Briefing)
- 일반 AI 채팅 및 LLM 메타 API
- 구독 조회/결제 confirm

### 2.2 제외 범위 (미구현)

아래 4개 기능은 제출 범위에서 제외합니다.

- 주문 제한 승인 큐
- Developer 모드
- 알림
- 계좌 연결

---

## 3. 기본 정보

### 3.1 Base URL

- 로컬: http://localhost:8080
- 운영: https://yourquantmanager.com

### 3.2 인증

- 보호 API는 JWT 인증 필요
- 인증 방식:

1. HttpOnly 쿠키 (DEVBRIDGE_TOKEN)
2. Authorization: Bearer <token>

### 3.3 공통 응답 원칙

컨트롤러별 응답 DTO가 다르므로 단일 envelope를 강제하지 않습니다.  
일반적으로 다음 형태를 사용합니다.

```json
{
  "message": "...",
  "error": "...",
  "data": {}
}
```

---

## 4. API 목록 (제출용)

## 4.1 인증 API

### POST /api/auth/signup

설명: 회원가입 + JWT 발급 + 인증 쿠키 설정

요청 예시

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "alpha_user"
}
```

응답(200)

```json
{
  "userId": 1,
  "email": "user@example.com",
  "username": "alpha_user",
  "token": "...",
  "message": "회원가입이 완료되었습니다."
}
```

### POST /api/auth/login

설명: 로그인 + JWT 발급 + 인증 쿠키 설정

### POST /api/auth/social-login

설명: 소셜 검증 이메일 기반 로그인

### POST /api/auth/github

설명: GitHub OAuth 코드 교환 로그인

요청 필드

- code: string (필수)
- redirectUri: string (선택)

### POST /api/auth/logout

설명: 인증 쿠키 삭제

응답(200)

```json
{
  "message": "로그아웃 되었습니다."
}
```

---

## 4.2 전략 API

기본 경로: /api/strategies

### GET /

설명: 내 전략 목록 조회

### GET /{id}

설명: 전략 상세 조회

### POST /

설명: 전략 생성

주요 검증

- code 필수
- ticker 필수
- method 필수
- principalKrw > 0
- 동일 user 내 code 중복 불가

### PUT /{id}

설명: 전략 수정

수정 가능 필드

- name, regime, goal, paramsJson, principalKrw, startDate, benchmark, active

수정 불가 필드

- ticker, code, method

### DELETE /{id}

설명: 전략 삭제 (연관 데이터 정리 후 삭제)

### GET /{id}/trades

설명: 전략 거래 내역 조회

쿼리

- source: BACKTEST | LIVE | MANUAL (기본 BACKTEST)

### GET /{id}/states

설명: 전략 상태 시계열 조회

### GET /{id}/signals

설명: 일일 시그널 조회

### GET /{id}/summary

설명: 백테스트 요약 조회

### GET /me/latest-signals

설명: 내 전략별 최신 시그널 1건

### GET /me/summaries

설명: 내 전략 요약 일괄 조회

### POST /seed

설명: 기본 전략 시드 생성

### POST /seed-leveraged

설명: 레버리지 ETF 유니버스 전략 시드 생성

### POST /{id}/backtest

설명: 단일 전략 백테스트 재실행

### POST /me/backtest-all

설명: 내 활성 전략 일괄 백테스트

---

## 4.3 Analytics Bridge API

기본 경로: /api/analytics

### GET /health

설명: Python analytics 사이드카 상태

응답(200)

```json
{
  "analytics": "up"
}
```

### POST /backtest

설명: vectorbt 백테스트 실행

요청 예시

```json
{
  "ticker": "AAPL",
  "strategy": "sma_cross",
  "period": "2y",
  "sma_fast": 20,
  "sma_slow": 50
}
```

### POST /signals/today

설명: 당일 시그널 생성 (옵션: ML 확률/SHAP)

### POST /models/train

설명: XGBoost 방향성 모델 학습

### POST /robust/walk-forward

설명: Walk-forward 검증

### GET /data-status

설명: 데이터 적재 상태 조회

### GET /data-ohlcv

설명: OHLCV 미리보기

쿼리

- symbol (필수)
- tf (기본 1d)
- source (선택)
- limit (기본 30)

---

## 4.4 Alpha Workspace API

기본 경로: /api/alpha

### Workspace CRUD

- GET /workspaces
- POST /workspaces
- GET /workspaces/{id}
- PATCH /workspaces/{id}
- DELETE /workspaces/{id}
- PATCH /workspaces/{id}/status
- PATCH /workspaces/{id}/goal-profile

### Workspace Chat

- GET /workspaces/{id}/chat
- POST /workspaces/{id}/chat

### Decision Log

- GET /workspaces/{id}/log

### Strategy Formalization

- POST /workspaces/{id}/formalize
- PATCH /workspaces/{id}/strategy-config/select

### Analytics Pipeline

- POST /workspaces/{id}/backtest
- POST /workspaces/{id}/regime
- POST /workspaces/{id}/trust
- POST /workspaces/{id}/auto-run
- POST /workspaces/{id}/briefing

주의

- /formalize 선행 없이 /backtest 호출 시 422 가능
- goalProfile 없이 /auto-run 호출 시 422 가능

---

## 4.5 AI/LLM API

### /api/ai

- POST /chat: 일반 AI 대화
- POST /extract: systemInstruction + text 기반 1회성 추출
- GET /models: 사용자별 사용 가능 모델/한도 조회 (인증 필요)

### /api/llm

- GET /providers: 프로바이더/모델 메타 조회
- POST /chat: provider/model 선택형 자유 질의

---

## 4.6 구독 API

기본 경로: /api/subscription

- GET /me: 내 구독 등급 조회 (FREE/STANDARD/PREMIUM)
- POST /confirm: Toss 결제 confirm 후 구독 활성화

POST /confirm 요청 필드

- paymentKey: string
- orderId: string
- amount: number (허용값: 9900, 19900)

---

## 5. 제출 제외 API (미구현 기능)

아래 API는 제출 범위에서 비제공입니다.

### 5.1 주문 제한 승인 큐

- /api/proposals
- /api/proposals/pending-count
- /api/proposals/{id}/approve
- /api/proposals/{id}/reject
- /api/alpha/workspaces/{id}/queue-orders
- /api/alpha/workspaces/{id}/orders

### 5.2 Developer 모드

- /api/alpha/workspaces/{id}/code
- /api/alpha/workspaces/{id}/changesets
- /api/alpha/workspaces/{id}/changesets/{csId}/keep
- /api/alpha/workspaces/{id}/changesets/{csId}/undo

### 5.3 알림

- /api/notifications
- /api/notifications/unread
- /api/notifications/count
- /api/notifications/{notificationId}/read
- /api/notifications/read-all

### 5.4 계좌 연결

- /api/broker/account (전체)
- /api/alpha/workspaces/{id}/broker-account

---

## 6. 상태 코드

공통적으로 사용되는 상태 코드는 다음과 같습니다.

- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Unprocessable Entity
- 500 Internal Server Error
- 502 Bad Gateway

---

## 7. 버전 이력

### submission-v1.0 (2026-06-01)

- 제출용 API 명세 신규 작성
- 미구현 4개 기능을 명시적으로 제외
- 실제 컨트롤러 기준으로 제공 API만 정리
