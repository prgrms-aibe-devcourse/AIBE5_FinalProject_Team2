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

## 🏗️ 시스템 아키텍처

> **3개의 독립 프로세스**가 협력합니다. 비유하면 **식당** — 홀(Frontend)에서 주문받고, 주방(Backend)이 조리를 지휘하고, 무거운 계산은 특수 조리실(Analytics)에 맡깁니다.

![System Architecture](docs/ARCHITECTURE_DIAGRAM.png)

```
Frontend (React · Vite · :5173)           — 브라우저에서 도는 화면
   │   · VSCode급 웹 IDE(DeveloperLab) + 트레이딩/계좌/승인 UI
   │   REST(/api) · 로그인은 JWT HttpOnly 쿠키
   ▼
Backend (Spring Boot 4 · Java 21 · :8080/:9091)   — 두뇌·지휘자
   │   · 도메인 드리븐: strategy / ai / user / payment / notification / global
   │   HTTP + 내부 토큰(ANALYTICS_INTERNAL_TOKEN) · Resilience4j CB+Retry
   ▼
Analytics (FastAPI · Python 3.11 · :8001)   — 무거운 수학 전담 (127.0.0.1 only)
       · vectorbt 백테스트 · XGBoost 시그널 · SHAP · Trust Score · Regime(HMM) · Lean
```

| 프로세스 | 책임 | 핵심 |
|---|---|---|
| **Frontend** | VSCode급 웹 IDE + 트레이딩 UI | `DeveloperLab`(Monaco 에디터·터미널·Git), `AccountPage`(브로커 계좌), `ProposalsPage`(주문 승인), Alpha Workspace 7탭(Config·Report·Regime·Trust·Briefing·Log) |
| **Backend** | 도메인 로직 + 실주문 안전게이트 | `strategy`(전략·백테스트·시그널·브로커), `ai`(멀티 LLM 라우팅·쿼터), `user`(JWT 인증), `payment`(Toss 구독), `notification`(SSE 알림) |
| **Analytics** | 무거운 수치계산 | vectorbt·XGBoost·HMM·SHAP·Walk-Forward·Trust Score — 외부 비공개(내부 토큰 필수) |

- **통신**: 브라우저↔BE = REST + JWT 쿠키 / BE↔Analytics = 내부 HTTP + `ANALYTICS_INTERNAL_TOKEN`(Analytics는 `127.0.0.1`에만 바인딩)
- **회복탄력성**: `AnalyticsClient`가 Resilience4j Circuit Breaker + Retry로 감싸, 사이드카 다운 시 시그널 없이도 빠르게 폴백

---

## 🚀 배포 토폴로지

> 서울 리전 EC2 단일 호스트(**Docker Compose**) + **Cloudflare** 엣지 + **EKS** Lean 온디맨드. `app_alpha/main` 푸시 → GitHub Actions가 EC2에 자동 배포(약 1.5분).

![Deployment Topology](docs/DEPLOY_DIAGRAM.png)

```
사용자 ─HTTPS─► Cloudflare (DDoS 엣지 · TLS Full Strict)
                     │  (오리진 80/443은 Cloudflare 대역만 허용 → 우회 직타 차단)
                     ▼
   EC2 (ap-northeast-2) · Docker Compose · systemd
     ├─ frontend  (Nginx :80, 정적 React 서빙 + /api 리버스 프록시)
     ├─ backend   (Spring Boot :9091)
     ├─ analytics (FastAPI :8001, 내부 전용)
     ├─ MySQL 8   (Flyway 마이그레이션)
     └─ claude CLI 컨테이너 (헤드리스 Claude Code 에이전트)
                     │  (대량/정밀 Lean 백테스트는 온디맨드로 분리)
                     ▼
   EKS · Lean 멀티노드 (테넌트별 Pod 격리 · Cluster Autoscaler)
```

- **전송 보안 3겹**: ① 엣지(Cloudflare DDoS/WAF) → ② 전송(TLS **Full Strict** — CF Origin CA 인증서로 CF↔오리진까지 암호화·검증) → ③ 오리진 방화벽(보안그룹이 80/443을 Cloudflare IP 대역만 허용)
- **CI/CD**: `git push app_alpha/main` → `deploy.yml`(GitHub Actions) → SSH → `git reset` + `docker compose up --build`

---

## 🗄 데이터 모델 (ERD)

> MySQL 8 (`alphahelix_db`) · **25 테이블** · 도메인별(USER·AI·STRATEGY·PAYMENT·NOTIFICATION) · Flyway 관리(`ddl-auto=validate`). 원본 스키마: [`docs/erd_alpha_helix.dbml`](docs/erd_alpha_helix.dbml) (dbdiagram.io 호환)

![ERD](docs/ERD.png)

---

## 📊 우리가 담당하는 거래 영역

증권거래의 가치사슬은 **주문진입 → 매칭 → 청산 → 결제 → 보관** 5단계입니다. Alpha-Helix는 그중 **"주문이 거래소에 닿기 직전까지의 의사결정·리스크·라우팅"** 을 책임지고, **실제 체결·청산·보관은 거래소/브로커(KIS·Binance)** 에 위임합니다.

```
┌──────────────── Alpha-Helix가 담당 (Own) ────────────────┐   ┌──── 브로커/거래소 (Delegate) ────┐
 전략 생성 → AI 시그널 → OrderProposal(제안) → 9단계 리스크 게이트 │   │  주문 접수 → 매칭(Matching)       │
 → BrokerRouter(KIS/Binance) → 주문 제출(API) → 체결 폴링 → 잔고 │   │  → 체결 → 청산(Clearing)          │
 → 불변 감사로그(OrderExecutionAudit)                          │   │  → 결제(Settlement) → 보관(Custody)│
└───────────────────────────────────────────────────────────┘   └─────────────────────────────────┘
                              ▲ 경계: ProposalExecutionService ↔ Broker 인터페이스
```

| 단계 | 담당 | 설명 |
|---|---|---|
| 전략·시그널 생성 | **우리** | 백테스트 + XGBoost 확률 + SHAP 설명 |
| 주문 제안(OrderProposal) | **우리** | PENDING 큐 + HMAC 이메일 승인 + TTL |
| 리스크 게이트 | **우리** | 실주문 직전 **단일 검문소 9관문**(kill-switch·한도·손실서킷·이중체결방지) |
| 브로커 라우팅·주문 제출 | **우리** | `BrokerRouter`가 KIS(미국주식)·Binance(크립토)로 API 호출 |
| 체결 폴링·잔고 스냅샷 | **우리** | `OrderFillService`가 체결 상태/평균가/잔고 동기화 |
| **매칭·체결·청산·결제·보관** | **거래소/브로커** | KIS·Binance가 실제 주문 체결과 자산 보관을 처리 |

→ **"우리는 '무엇을·얼마나·언제·안전한가'를 결정해 주문을 보내는 데까지. 실제 사고팔리고 보관되는 건 거래소."**

### 🧩 거래소 개념 ↔ Alpha-Helix 한눈 매핑

> 일반적인 **증권거래소 아키텍처의 각 구성요소**가 Alpha-Helix에서 **어떤 컴포넌트로 구현되는지** 1:1 매핑입니다. (개념 출처: [📄 vol2-ch13-stock-exchange.md](docs/system-design/vol2-ch13-stock-exchange.md))

![최종 통합 아키텍처](docs/ARCHITECTURE_DIAGRAM.png)

| # | 거래소 아키텍처 | Alpha-Helix 구현 | 상세 설명 | 📄 문서 · 💻 코드 |
|---|---|---|---|---|
| ① | **클라이언트 게이트웨이** (인증·rate limit) | `JwtAuthenticationFilter` + `AiRateLimitFilter` (Bucket4j) | 거래소가 주문 전 회원·한도를 확인하듯, 모든 보호 요청은 HttpOnly 쿠키 JWT를 검증하고, 비싼 AI 호출은 유저당 시간 20회·등급별 일일 한도(토큰버킷)로 차단. 인증 통과한 요청만 도메인 로직으로 진입한다. | [📄](docs/ARCHITECTURE.md) · [💻 Jwt](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/global/security/JwtAuthenticationFilter.java) · [💻 RateLimit](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/global/config/AiRateLimitFilter.java) |
| ② | **주문 관리자 + 상태기계** | `OrderProposal` 생명주기 (PENDING→APPROVED→EXECUTED…) + 24h TTL | 거래소 OMS처럼 모든 주문은 `OrderProposal` 엔티티의 상태기계(PENDING→APPROVED→EXECUTED, 분기로 REJECTED/EXPIRED/EXEC_FAILED)로 추적된다. HMAC 이메일 승인 링크 + 24h TTL이며, 만료분은 `OrderProposalExpiryJob`이 자동 정리한다. | [📄](docs/ARCHITECTURE.md) · [💻 OrderProposal](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/entity/OrderProposal.java) |
| ③ | **위험 점검** (사전 한도) | 1건/일일 USD 캡 · 손실 서킷브레이커 · 등급 캡 · MOCK→REAL 게이트 | 거래소 Pre-Trade Risk Check처럼, 실주문 직전 `ProposalExecutionService` **단일 검문소**가 9개 관문(kill-switch·1건/일일 USD·KRW 한도·손실 서킷·SELL 실보유 클램프)을 강제한다. MOCK 14일+5체결+실패율<30% 졸업게이트 통과 후에만 REAL로 승격된다. | [📄](docs/ARCHITECTURE.md) · [💻 ProposalExecution](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/broker/ProposalExecutionService.java) |
| ④ | **시퀀서** (정확히 1회) | `claimForExecution` 원자적 상태전이 (compare-and-set) | 거래소 시퀀서가 주문을 정확히 한 번 처리하듯, `claimForExecution`이 `UPDATE … WHERE status='PENDING'` 원자적 CAS로 상태를 전이시켜 — 동시 요청이 같은 제안을 2번 체결하는 사고를 차단한다. | [📄](docs/ARCHITECTURE.md) · [💻 Repository](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/repository/OrderProposalRepository.java) |
| ⑤ | **체결 엔진** (matching) | 실거래=진짜 거래소 / 검증=백테스트 fill (수수료+슬리피지+T+1) | 실제 매칭·체결은 **거래소(KIS/Binance)가 담당** — 우리는 관여하지 않는다. 대신 백테스트에서 체결을 시뮬레이션: vectorbt가 수수료 0.25%·슬리피지 0.1%·look-ahead 방지(다음봉 체결)로 현실적 fill을 재현하고, Lean은 부분체결·거래소 개장시간까지 정밀 모델링한다. | [📄](docs/퀀트엔진_가이드.md) · [💻 vbt_engine](https://github.com/ryu-han-kr/Alpha/blob/main/analytics/app/backtest/vbt_engine.py) · [💻 Backtest](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/BacktestService.java) |
| ⑥ | **이벤트 소싱** (불변 로그) | `OrderExecutionAudit` · `AlphaDecisionLog` (append-only) | 거래소가 모든 주문 이벤트를 불변 기록하듯, 실주문 시도(성공/실패 모두)는 `OrderExecutionAudit`에, AI·전략 의사결정은 `AlphaDecisionLog`에 append-only로 남겨 사후 감사·재현이 가능하다. | [📄](docs/ARCHITECTURE.md) · [💻 Audit](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/entity/OrderExecutionAudit.java) · [💻 DecisionLog](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/ai/entity/AlphaDecisionLog.java) |
| ⑦ | **시장 데이터 피드** | `MarketDataService` (Stooq · Binance klines) | 거래소 Market Data Feed처럼, `MarketDataService`가 백테스트용 일봉을 미국주식=Stooq, 크립토=Binance klines에서 수집·캐시한다(2일 이상 오래되면 외부 갱신). | [📄](docs/ARCHITECTURE.md) · [💻 MarketData](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/MarketDataService.java) |
| ⑧ | **네트워크 보안** (public/private) | `ANALYTICS_INTERNAL_TOKEN` · Cloudflare Full(Strict) · CORS | 거래소의 public(고객망)/private(내부 매칭망) 분리처럼, Analytics는 `127.0.0.1` 바인딩 + 내부 토큰으로 외부 직접 접근을 차단하고, 엣지는 Cloudflare(DDoS)+TLS Full Strict(CF↔오리진 암호화), CORS는 우리 도메인만 허용한다. | [📄](docs/ARCHITECTURE.md) · [💻 WebConfig](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/global/config/WebConfig.java) · [💻 AnalyticsClient](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/AnalyticsClient.java) |
| ⑨ | **코로케이션 / 자원 격리** | EKS 멀티노드 K8s Job (쿼터·빈패킹) | 거래소 코로케이션이 참여자별 자원을 격리하듯, Lean 백테스트는 테넌트별 K8s 네임스페이스+ResourceQuota+Pod limits로 격리하고, BE 스케줄러가 등급 쿼터로 공정 배분(oldest-first), K8s가 Pod를 노드에 빈패킹한다. | [📄](docs/LEAN_K8S_V2.md) · [💻 Dispatcher](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanK8sDispatcher.java) · [💻 Manifest](https://github.com/ryu-han-kr/Alpha/blob/main/backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanJobManifestRenderer.java) |

---

## 🔄 퀀트 엔진 플로우

```
사용자 (자연어 목표 입력)
   │  "5년 안에 월 300 현금흐름, 중립 성향, MDD 25%…"
   ▼
AlphaHelixService (Gemini 2.5-flash)         ← 목표 8항목 → Goal Profile(JSON)
   │  formalize → 전략 후보 3개 제안
   ▼
Alpha Workspace ──┬─ Config   전략 파라미터
                  ├─ Report   백테스트            ◄── vectorbt + 9전략 (수수료 0.25%·슬리피지 0.1%)
                  ├─ Regime   시장 국면            ◄── 5-State HMM / rule
                  ├─ Trust    신뢰도 점수          ◄── Walk-Forward + 국면견고성 + 파라미터 섭동
                  ├─ Briefing 일일 시황·팟캐스트    ◄── Perplexity 실뉴스 + Gemini (등급별 2/3/4회)
                  └─ Log      의사결정 기록
   ▼
MarketDataService    일봉 수집 (미국=Stooq · 크립토=Binance klines)
   ▼
DailySignalGenerator (평일 22:30 KST)         ← XGBoost up-probability + SHAP
   │  BUY 시그널 → OrderProposal(PENDING) 큐잉 (08:30 장전 제안)
   ▼
OrderProposalService    JWT 인증 승인 엔드포인트 (TTL 24h · 만료 자동 정리)
   ▼
사용자 승인  /  autoExecute 계좌면 자동
   ▼
ProposalExecutionService  ★ 실주문 직전 단일 검문소 (9개 안전관문)
   ▼
BrokerRouter ──► KIS (미국주식·정수)  /  Binance (크립토 현물 SPOT·분수)
   ▼
OrderFillService (3분 폴링)   체결 상태·평균가 → 잔고 스냅샷 동기화
```

---

## 🧭 4대 엔진 상세 & 아키텍처 매핑

> 각 엔진의 **풀스택 흐름(FE↔BE↔Engine, 코드 실측)** 과, 그 흐름이 **전체 아키텍처에서 어느 컴포넌트를 어떤 순서로 지나는지**(`eN_1 → eN_2 → …` 오버레이)를 한 쌍으로 제공합니다.

### ① 퀀트 엔진 / Developer IDE — 자연어→formalize→백테스트→배포
![Engine 1 · Quant/IDE 흐름](docs/ENGINE_1_QUANT.png)
![Engine 1 · 아키텍처 경로](docs/engine1_archi.png)

### ② Analytics 엔진 — Workspace 탭↔AnalyticsClient↔FastAPI 모듈
![Engine 2 · Analytics 흐름](docs/ENGINE_2_ANALYTICS.png)
![Engine 2 · 아키텍처 경로](docs/engine2_archi.png)

### ③ 매수매도 주문체결 + 결제 엔진 — 9관문·CAS·KIS/Binance·Toss
![Engine 3 · 주문체결/결제 흐름](docs/ENGINE_3_ORDER.png)
![Engine 3 · 아키텍처 경로](docs/engine3_archi.png)

### ④ Lean 엔진 — EXPERT 게이트→영속 큐→EKS Job→per-job HMAC 콜백
![Engine 4 · Lean 흐름](docs/ENGINE_4_LEAN.png)
![Engine 4 · 아키텍처 경로](docs/engine4_archi.png)

---

## 🧠 Analytics 엔진 상세

### 백테스트 — vectorbt (9전략)

look-ahead 편향 제거(`fshift(1)`: 오늘 신호 → 내일 체결), 수수료 0.25% + 슬리피지 0.1% 반영. 출력 = `stats`(총수익·연환산·MDD·Sharpe·Sortino·Calmar·승률·거래수) + `equity_curve` + 일별 수익률(QuantStats용).

| 전략 | 신호 규칙 | 기본값 |
|---|---|---|
| `buy_and_hold` | 첫날 매수 후 보유 | — |
| `sma_cross` | SMA(fast) > SMA(slow) | 20 / 60 |
| `rsi_meanrev` | RSI < low 매수 / > high 매도 | 14 · 30 · 70 |
| `macd` | MACD line × signal 교차 | 12 / 26 / 9 |
| `momentum_12_1` | 12개월 − 1개월 수익 > 0 | 252 / 21 |
| `vix_risk_off` | VIX ≤ threshold 동안만 보유 | 25.0 |
| `infinite_buying` | **무한매수법** — 자본 분할 + 평단 익절 사이클 | 라오어 / 연리 |
| `value_rebalancing` | **밸류 리밸런싱(VR)** — V값 밴드(±20%) 이탈 시 Pool에서 분할 매수/매도 | 10영업일 · 기대 2% |
| `momentum_rotation` | **모멘텀 로테이션** — 절대모멘텀 게이트(룩백−skip>0)로 보유/현금 (멀티자산 풀 로테이션은 별도 엔드포인트) | 252 / 21 |

**무한매수법(라오어 vs 연리 대표)**: 자본을 N등분해 매일 분할매수, 평단 대비 익절%면 매도 후 사이클 리셋. 연리 변형은 익절 +13%·1주 남김·사다리타기 0.5배 재매수로 실제 운용을 재현.

### AI 시그널 — XGBoost + SHAP

- **21개 피처(v2)**: v1 13개(`ret_1/5/20`·`sma_20/60/200_ratio`·`vol_20/60`·`rsi_14`·`macd`·`macd_signal_diff`·`range_pct`·`vol_ratio_20`) + 추가 8개(`above_ma50/200`·`trend_strength`·`vol_ratio_5/60`·`atr_14_pct`·`bear_pressure`·`mom_60`)
- **라벨**: 내일 종가 상승 여부 / **학습**: TimeSeriesSplit 5-fold(시계열 누수 방지), 매일 22:30 KST 재학습 → `xgb_{TICKER}.joblib`
- **추론**: `predict_proba` → 상승 확률(0~1) / **설명**: SHAP TreeExplainer로 "왜 이 확률인가" Top 영향 피처 시각화
- 데이터 부족 시 `None` 반환(조용한 실패, 선택적)

### 시장 국면 — Regime v2 (5-State HMM)

| 국면 | 의미 |
|---|---|
| `bull_quiet` | 상승(안정) |
| `bull_volatile` | 상승(불안정) |
| `sideways` | 횡보 |
| `bear` | 하락 |
| `high_vol_unstable` | 고변동 불안정 |

`hmmlearn` GaussianHMM(`ret`·`vol20`·`mom60` 피처). 표본 부족·fit 실패 시 **rule-based로 폴백**하며 응답에 실제 사용 method를 정직하게 표기. 국면별 성과는 `shrink_sharpe`로 소표본 보정.

### 신뢰도 — Trust Score (0~100)

| 하위 점수 | 측정 |
|---|---|
| **Generalization** | IS vs OOS Sharpe 일관성 (과적합 탐지) |
| **Regime Robustness** | 최악 국면 Sharpe |
| **Parameter Stability** | 파라미터 섭동 ×4의 표준편차 |
| **Risk Control** | MDD·VaR 통제 |
| **Statistical Significance** | PSR(Probabilistic Sharpe Ratio) |

`Walk-Forward`(IS=252일/OOS=63일 슬라이딩)로 미래 일반화를 검증하고, 5개 하위점수 가중합 − 과적합 페널티로 종합.

### 리포트 — QuantStats Tearsheet

CAGR·Sharpe·Sortino·Calmar·MDD·VaR·CVaR·승률 등 상세 HTML 리포트를 생성해 `/reports/{file}.html`로 정적 서빙.

---

## ⚡ OrderProposal 파이프라인 & 9개 안전관문

모든 실주문은 **반드시 `ProposalExecutionService` 단일 검문소**를 통과하며, 하나라도 걸리면 발사 취소 + 불변 감사로그(`OrderExecutionAudit`) 기록.

| # | 관문 | 막는 것 |
|---|---|---|
| 1 | PENDING 상태 확인 | 이미 처리·만료된 제안 거부 |
| 2 | 만료(TTL) 검사 | `expiresAt` 지난 제안 → EXPIRED |
| 3 | **글로벌 Kill-Switch** | `TRADING_KILL_SWITCH=true` 시 **REAL 주문 전면 차단**(MOCK 통과) |
| 4 | 매매 활성 스위치 | 계좌 `tradingEnabled` 꺼지면 자동체결 안 함 |
| 5 | 1건당 USD 한도 | `maxOrderUsd` 초과 거부 |
| 6 | 일일 누적 USD 한도 | 하루 합계 `dailyOrderUsd` 초과 거부 |
| 7 | KRW 일일 한도(KIS) | 원화 매수/매도 일일 한도(USD→KRW 근사 환산) |
| 8 | 손실 서킷브레이커 | 미실현 손실이 한도 밑이면 추가 BUY 차단 |
| 9 | **CAS 이중체결 차단** | `claimForExecution` 원자적 상태 전환 → 같은 제안 2번 체결 사고 차단 |

추가로 **SELL 실보유 클램프**(거래소 실보유분까지만 매도, 가상수량 과매도 차단)와 **MOCK→REAL 졸업게이트**(`PromotionGate`: REAL키 검증 + MOCK 5체결 + 실패율<30%) 적용.

| 항목 | KIS (미국주식) | Binance (크립토 현물) |
|---|---|---|
| 수량 | 정수(`qty`) | 분수(`qtyDecimal`) |
| 주문타입 | LIMIT · LOC · MARKET | LIMIT · MARKET |
| 거래소 코드 | NYSE / NASD / AMEX | 페어(BTCUSDT 등) |
| 인증 | 토큰 23h 캐시 + 브라우저 UA | **HMAC 서명**(비밀키 미전송) |
| 범위 | 미국주식 | **현물(SPOT)만** — 선물(FUTURES) 차단 |

---

## 🐳 Lean CLI — 정밀 백테스트 & 멀티테넌트 클라우드

vectorbt가 "빠른 근사"라면, **Lean(QuantConnect 엔진)** 은 "정밀": 거래소 개장시간·부분체결·다종목·세금까지 반영합니다. **EXPERT 등급**에서 활성화됩니다.

### 로컬 Lean CLI

```
<workspace>/
├── lean.json          # organization-id = "0"×32 (더미) → QuantConnect 로그인 우회·로컬 실행
├── data/equity/usa/daily/*.csv   # 일봉 (YYYYMMDD,O,H,L,C,V · 헤더 없음)
└── projects/<run_id>/
    ├── main.py        # codegen이 생성한 QCAlgorithm 파이썬 코드
    ├── config.json    # 전략·기간·종목·파라미터
    └── result/        # --output 결과 (Algorithm.json)
```

1. `LeanProjectManager`가 워크스페이스 세팅 → `DataConverter`가 CSV 주입
2. `LeanCodeGenerator`가 `StrategyDefinition` → `main.py`(QCAlgorithm) 생성
3. `LeanExecutor`가 `quantconnect/lean` 컨테이너로 `lean backtest` 실행(`/Lean/Data` 마운트), stdout 한 줄씩 SSE 중계
4. `ResultFormatter`가 Lean JSON → 우리 표준 양식(통계·자산곡선)으로 변환

### 클라우드 멀티테넌트 배포 (v2 · Kubernetes)

> **핵심: 각 백테스트 = 1개의 K8s Job → Pod → 컨테이너.** 테넌트 A와 B는 **네임스페이스 + ResourceQuota + Pod limits**로 완전 격리됩니다.

```
사용자 ─► POST /api/lean/jobs/submit (Spring BE = 컨트롤 플레인)
            │
   ┌────────┴── BE 스케줄러 (순수함수, 단위테스트됨) ───────────┐
   │  MySQL lean_job (영속 큐·진실원천)                          │
   │  pickDispatchable(): 등급 쿼터(EXPERT 4) + 전역캡(6)        │
   │                      + 공정 배분(oldest-first, 독식 방지)    │
   │  LeanJobManifestRenderer → K8s Job YAML 렌더 + per-job HMAC │
   │  LeanK8sDispatcher → kubectl apply                          │
   └────────┬───────────────────────────────────────────────────┘
            ▼
   Kubernetes (EKS · on-demand)
     ├─ Namespace: lean-tenant-<uid>      ← 테넌트 격리 단위
     │    └─ ResourceQuota: pods=4 (EXPERT)
     ├─ Job → Pod → lean-worker 컨테이너
     │    ├─ Image: quantconnect/lean + kis_backtest + run_backtest.py
     │    ├─ limits: cpu 4 / memory 8Gi (초과 시 OOM-kill)
     │    ├─ activeDeadlineSeconds: 1800 (30분 타임아웃)
     │    └─ env: LEAN_JOB_ID · SYMBOLS · BE_CALLBACK_URL · BE_INTERNAL_TOKEN(HMAC)
     └─ Cluster Autoscaler: 대기 Pod → 노드 증설 / idle → 축소
            │
            ▼  결과 콜백 (per-job HMAC 인증)
   POST /api/lean/jobs/{id}/result → BE가 status=DONE, resultJson 저장 → FE 차트
```

**멀티테넌시 격리 메커니즘 (테넌트 A ↔ B)**

| 계층 | 메커니즘 |
|---|---|
| **데이터** | `lean-tenant-A` vs `lean-tenant-B` 네임스페이스 — Secret/ConfigMap 분리 |
| **계산** | Pod별 독립 컨테이너 — 별도 PID·Network·Filesystem(EmptyDir) |
| **자원** | Pod limits(4 CPU·8Gi) + ResourceQuota(pods=4) — 초과 시 OOM-kill·대기 |
| **스케줄링** | BE 스케줄러의 등급 쿼터 — 한도 넘으면 K8s 진입 전 QUEUED 대기(독식 방지) |
| **결과 반환** | per-job HMAC 토큰 — 다른 job 토큰으로 타 job 결과 호출 거부 |

- **워커**: 컨테이너 안에서 codegen으로 `main.py` 생성 → 커스텀 `PythonData(USEquity)`로 `/Lean/Data` CSV 직접 읽음 → `dotnet` Lean 엔진 직접 실행(DinD 없음) → 결과를 BE로 콜백
- **무한매수법 같은 stateful 전략**: DSL codegen 대신 raw-algo 경로로 QCAlgorithm 템플릿을 직접 렌더해 분할매수·물타기·익절 사다리까지 재현
- **토폴로지**: out-of-cluster BE + 노드 인스턴스 역할 기반 kubeconfig + 공개 콜백 — EKS 라이브에서 다수 Pod 동시·쿼터·실제 Lean 결과까지 검증

> **v1(현재 경량)**: 단일 Analytics 호스트의 노드 풀 + 인메모리 잡 큐(슬롯 제한)로 동작. **v2(K8s)**: 영속 큐 + 강한 격리 + 자동 확장으로 진화.

---

## 🛠️ 기술 스택

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
![Google Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-191919?style=for-the-badge&logo=anthropic&logoColor=white)
![Perplexity](https://img.shields.io/badge/Perplexity-20808D?style=for-the-badge&logo=perplexity&logoColor=white)

**Infra**  
![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Toss Payments](https://img.shields.io/badge/Toss_Payments-0064FF?style=for-the-badge&logo=toss&logoColor=white)

---

## 🔐 보안 설계

> **3겹 + 1 방어선**: ① 엣지(Cloudflare)가 DDoS를 막고 → ② 전송(TLS)이 도청을 막고 → ③ 앱(인증·요청제한)이 남용을 막고 → ④ 자금 안전장치가 잘못된 실주문을 막습니다.

| 항목 | 설명 |
|---|---|
| **엣지 — Cloudflare** | DDoS 흡수 · 봇 차단 · 진짜 오리진 IP 은닉. 오리진 보안그룹은 80/443을 **Cloudflare 대역만 허용**(우회 직타 차단) |
| **전송 — TLS Full Strict** | CF Origin CA 인증서로 **CF↔오리진 구간까지 암호화 + 인증서 검증** |
| **JWT HttpOnly 쿠키** | `HttpOnly; Secure(prod); SameSite=Lax` — XSS 토큰 탈취 방지 |
| **거래소 키 AES-GCM** | KIS/Binance 시크릿 DB 평문 저장 금지. `APP_CRYPTO_KEY`(기본값 없음) |
| **JWT 승인 + TTL** | OrderProposal 승인은 JWT 인증 엔드포인트(`/api/proposals/{id}/approve`) + TTL 24h 자동 만료 (`OrderProposalExpiryJob`) |
| **MOCK → REAL 게이트** | 모든 주문은 MOCK 선행, 명시 승인 후에만 실주문 |
| **글로벌 Kill-Switch** | `TRADING_KILL_SWITCH=true` 시 모든 REAL 주문 즉시 거부 |
| **Rate Limiting** | AI 채팅 유저당 시간 20회(Bucket4j) + 등급별 일일 한도 |
| **Analytics 내부 토큰** | `127.0.0.1` 바인딩 + `ANALYTICS_INTERNAL_TOKEN`으로 외부 직접 접근 차단 |

---

## 💳 구독 플랜

| 플랜 | 가격 | 핵심 |
|---|---|---|
| **Free** | ₩0 | Gemini/GPT-4o mini · 백테스트 무제한 · Regime/Trust 기본 (LIVE 브리핑 미제공) |
| **Standard** | ₩9,900/월 | 증권 계좌 1개 · 자동매매 · AI 토큰 500k · **Perplexity 일일 시황·팟캐스트 2회** |
| **Premium** | ₩19,900/월 | 증권 계좌 3개 · 퀀트 IDE(vectorbt) · AI 토큰 무제한 · **브리핑 3회** |
| **Expert** | ₩39,900/월 | 증권 계좌 무제한 · 퀀트 IDE(**LEAN** + vectorbt) · 커스텀 팩터 · **브리핑 4회** |

Toss Payments v1 결제 연동 · `VALID_PLANS` 금액 화이트리스트로 위변조 방지.

---

## ⚙️ 로컬 실행

### 사전 준비
- JDK 21 · Node 20+ · Python 3.11 · MySQL 8
- `backend/src/main/resources/application-local.properties` 생성 (템플릿: `application.properties`)
- `analytics/.env` 생성 (템플릿: `analytics/.env.example`)

```bash
# 1) DB
mysql -uroot -p1234 -e "CREATE DATABASE alphahelix_db CHARACTER SET utf8mb4;"

# 2) Backend (:8080)
cd backend && ./gradlew bootRun --args="--spring.profiles.active=local"

# 3) Analytics (:8001)
cd analytics && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --port 8001 --reload

# 4) Frontend (:5173)
cd frontend && npm install && npm run dev
```

**헬스 체크**: `http://localhost:8080/actuator/health` → `{"status":"UP"}`

---

## 📁 디렉터리 구조

```
.
├── backend/    Spring Boot REST API (Java 21)
│   └── domain/  strategy · ai · user · payment · notification · global
├── analytics/  FastAPI AI 사이드카 (Python)
│   └── app/    backtest(vectorbt) · models(xgb) · explain(shap) · metrics(quantstats) · robust(walkforward·regime·trust) · lean
├── frontend/   React + Vite
│   └── src/    alpha(Workspace·계좌·Proposals·브리핑) · pages · components · store · i18n
├── deploy/     Docker Compose · Nginx · systemd · 배포 가이드
└── docs/       아키텍처 · 엔진 설명 · Lean 플랜 · ERD · 다이어그램
```

---

## 라이선스

본 리포지토리는 교육·발표 목적의 팀 프로젝트입니다.  
**AIBE5 — Team2 · Alpha-Helix**
