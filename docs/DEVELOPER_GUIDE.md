# Alpha-Helix 개발자 완벽 가이드

> **작성일**: 2026년 5월 26일  
> **대상**: 신규 개발자, 프로젝트 매니저, 분석가  
> **목표**: 시스템 전체 이해 및 빠른 온보딩

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [개발 환경 설정](#3-개발-환경-설정)
4. [주요 폴더 구조](#4-주요-폴더-구조)
5. [핵심 개념 이해](#5-핵심-개념-이해)
6. [개발 워크플로우](#6-개발-워크플로우)
7. [배포 가이드](#7-배포-가이드)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. 프로젝트 개요

### 1.1 Alpha-Helix란?

Alpha-Helix는 **포트폴리오 관리 + 백테스팅 + 프리랜서 매칭 플랫폼** 입니다.

**세 가지 핵심 모듈**:

1. **포트폴리오 관리**: 개인/기관의 투자 자산 관리, 성과 분석
2. **백테스팅 & 분석**: 투자 전략 검증, 파라미터 최적화
3. **프리랜서 매칭**: IT 프로젝트와 파트너 자동 연결

### 1.2 기본 사용자 흐름

```
파트너 (투자자)
  ├─ 포트폴리오 등록 → 성과 분석
  ├─ 전략 백테스트 → 실제 거래
  └─ 프로젝트 참여 (추가 수익)

클라이언트 (프로젝트 의뢰자)
  ├─ 프로젝트 등록
  ├─ 파트너 매칭
  └─ 진행 상황 추적
```

### 1.3 주요 특징

- **99개 금융 지표**: Sharpe, Sortino, Calmar, Kelly, Risk Parity 등
- **머신러닝**: XGBoost + SHAP 설명가능성
- **실시간 신호**: 매일 22:30 KST 자동 신호 생성
- **다중 자산 지원**: ETF, 암호화폐, 매크로 지표
- **엔터프라이즈**: 2단계 인증, 은행 검증, 규제 준수

---

## 2. 기술 스택

### 2.1 프론트엔드

```
React 18.3                       (UI 라이브러리)
├─ Vite                          (번들러)
├─ Tailwind CSS                  (스타일링)
├─ JSConfig (JS 모듈)            (경로 별칭)
├─ i18n (다국어)                 (영어, 한국어 지원)
├─ zustand/pinia                 (상태 관리)
└─ axios                         (HTTP 클라이언트)
```

**주요 라이브러리**:

- `chart.js` / `recharts`: 차트 시각화
- `shadcn/ui`: UI 컴포넌트
- `stream-chat-react`: 실시간 채팅

### 2.2 백엔드

```
Spring Boot 3.x                  (프레임워크)
├─ Gradle                        (빌드 도구)
├─ JPA/Hibernate                 (ORM)
├─ Spring Security               (인증/인가)
└─ Toss Payments API             (결제)
```

**주요 라이브러리**:

- Spring Web: REST API
- Spring Data JPA: 데이터 접근
- Lombok: 보일러플레이트 감소
- JWT: 토큰 기반 인증

### 2.3 Analytics 엔진

```
Python 3.10+                     (프로그래밍 언어)
├─ FastAPI                       (웹 프레임워크)
├─ pandas                        (데이터 처리)
├─ numpy                         (수치 계산)
├─ quantstats                    (성과 메트릭)
├─ vectorbt                      (백테스팅)
├─ hmmlearn                      (HMM 국면 탐지)
├─ xgboost                       (머신러닝)
├─ shap                          (설명가능성)
└─ scikit-learn                  (전처리, 최적화)
```

### 2.4 데이터베이스 & 인프라

```
PostgreSQL 14+                   (관계형 DB)
├─ TimescaleDB 확장              (시계열 최적화)
├─ PostGIS                       (지리 공간)
└─ pgAdmin                       (관리 도구)

외부 API:
├─ Polygon.io                    (주식 OHLCV)
├─ FRED                          (매크로 지표)
├─ Binance                       (암호화폐)
├─ Yahoo Finance                 (Fallback)
└─ Toss Payments                 (결제)
```

**인프라**:

```
AWS / GCP / 온프레미스
├─ Docker                        (컨테이너)
├─ Docker Compose                (오케스트레이션)
├─ Nginx                         (리버스 프록시)
├─ Systemd                       (서비스 관리)
└─ GitHub Actions                (CI/CD)
```

---

## 3. 개발 환경 설정

### 3.1 전제 조건

```bash
# 필수 설치
- Node.js 18+
- Python 3.10+
- Java 17 (JDK)
- PostgreSQL 14+
- Git

# 선택사항
- Docker & Docker Compose
- VS Code + 확장 프로그램
```

### 3.2 프론트엔드 설정

```bash
# 저장소 클론
cd ProgrammersFinal/frontend

# 의존성 설치
npm install

# 개발 서버 시작 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 프리뷰 (빌드 결과 확인)
npm run preview
```

**env 파일** (`.env`):

```
VITE_API_URL=http://localhost:8080
VITE_ANALYTICS_URL=http://localhost:8000
VITE_STREAM_KEY=your_stream_io_key
```

### 3.3 백엔드 설정

```bash
# 저장소 클론
cd ProgrammersFinal/backend

# Gradle 래퍼 권한 설정 (Linux/Mac)
chmod +x gradlew

# 빌드
./gradlew build

# 개발 서버 시작 (http://localhost:8080)
./gradlew bootRun

# 테스트 실행
./gradlew test
```

**application.properties**:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/devbridge
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
```

### 3.4 Analytics 설정

```bash
# 저장소 클론
cd ProgrammersFinal/analytics

# 가상환경 생성
python -m venv venv

# 활성화 (Windows)
venv\Scripts\activate

# 활성화 (Linux/Mac)
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 시작 (http://localhost:8000)
uvicorn app.main:app --reload --port 8000

# API 문서
# http://localhost:8000/docs (Swagger)
# http://localhost:8000/redoc (ReDoc)
```

**requirements.txt**:

```
fastapi==0.104.1
uvicorn==0.24.0
pandas==2.1.0
numpy==1.24.0
quantstats==0.3.2
vectorbt==0.25.0
hmmlearn==0.3.0
xgboost==2.0.0
shap==0.43.0
scikit-learn==1.3.0
```

### 3.5 데이터베이스 설정

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE devbridge;
CREATE USER devbridge_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE devbridge TO devbridge_user;

# TimescaleDB 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb;

# 마이그레이션 실행
cd backend
./gradlew flywayMigrate
```

### 3.6 Docker Compose (선택사항)

```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

**docker-compose.yml**:

```yaml
version: "3.8"
services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_DB: devbridge
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  analytics:
    build: ./analytics
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
```

---

## 4. 주요 폴더 구조

### 4.1 프론트엔드 구조

```
frontend/
├── src/
│   ├── pages/               # 페이지 컴포넌트 (50개+)
│   │   ├── Login.jsx
│   │   ├── PartnerProfile.jsx
│   │   ├── AnalyticsLab.jsx
│   │   ├── StrategyWorkspace.jsx
│   │   └── ...
│   ├── components/          # 재사용 컴포넌트
│   │   ├── Header/
│   │   ├── Modal/
│   │   ├── Chart/
│   │   ├── ai/              # AI 챗봇
│   │   ├── dashboard/       # 대시보드
│   │   └── ...
│   ├── api/                 # API 클라이언트
│   │   ├── auth.js
│   │   ├── portfolio.js
│   │   ├── analytics.js
│   │   └── ...
│   ├── store/               # 상태 관리 (Zustand)
│   ├── lib/                 # 유틸리티
│   ├── i18n/                # 다국어
│   └── assets/              # 이미지, 폰트
├── vite.config.js           # Vite 설정
├── tailwind.config.js       # Tailwind 설정
└── package.json
```

### 4.2 백엔드 구조

```
backend/src/main/java/com/DevBridge/devbridge/
├── entity/                  # JPA 엔티티
│   ├── User.java
│   ├── Project.java
│   ├── PartnerProfile.java
│   ├── Portfolio.java
│   └── ...
├── repository/              # Spring Data JPA
│   ├── UserRepository.java
│   ├── ProjectRepository.java
│   └── ...
├── service/                 # 비즈니스 로직
│   ├── UserService.java
│   ├── ProjectService.java
│   ├── PortfolioService.java
│   └── ...
├── controller/              # REST API
│   ├── AuthController.java
│   ├── ProjectController.java
│   ├── AnalyticsController.java
│   └── ...
├── security/                # Spring Security
│   ├── JwtTokenProvider.java
│   └── SecurityConfig.java
├── dto/                     # Data Transfer Object
│   ├── UserDto.java
│   ├── ProjectDto.java
│   └── ...
├── config/                  # 설정
│   ├── DatabaseConfig.java
│   └── CorsConfig.java
└── DevelopersBootApplication.java
```

### 4.3 Analytics 구조

```
analytics/
├── app/
│   ├── main.py              # FastAPI 진입점
│   ├── config.py            # 설정
│   ├── data/
│   │   ├── collector.py     # 데이터 수집 (스케줄러)
│   │   ├── polygon_client.py
│   │   ├── fred_client.py
│   │   ├── binance_client.py
│   │   ├── yf_client.py
│   │   ├── market_db.py     # DB 접근
│   │   └── ...
│   ├── backtest/
│   │   ├── vbt_engine.py    # VectorBT 엔진 (6 전략)
│   │   ├── futures_engine.py
│   │   ├── infinite_buying.py
│   │   └── ...
│   ├── strategy/
│   │   ├── main.py          # Alpha-Helix 핵심 전략
│   │   ├── helpers.py       # HMM, Kelly, WalkForward
│   │   ├── risk_control.py  # 위험 관리 시스템
│   │   └── ...
│   ├── metrics/
│   │   ├── quantstats_report.py  # 성과 메트릭
│   │   └── ...
│   ├── models/
│   │   ├── xgboost_*.py     # ML 예측
│   │   └── ...
│   ├── robust/
│   │   ├── regime.py        # 국면 탐지
│   │   └── ...
│   ├── explain/             # SHAP 설명
│   └── ...
├── strategy/
│   ├── main.py
│   ├── helpers.py
│   ├── risk_control.py
│   └── ...
├── migrate_timescaledb.py   # DB 마이그레이션
├── requirements.txt         # 의존성
└── app/__init__.py
```

---

## 5. 핵심 개념 이해

### 5.1 포트폴리오 평가

**관련 파일**:

- `backend/src/main/java/.../entity/Portfolio.java`
- `analytics/app/metrics/quantstats_report.py`

**프로세스**:

```python
# 사용자가 포트폴리오 조회
portfolio = Portfolio.find(user_id)
tickers = [asset.ticker for asset in portfolio.assets]

# 각 자산의 수익률 계산
returns = {}
for ticker in tickers:
    price_data = market_db.get_price(ticker, period="3y")
    returns[ticker] = price_data['Close'].pct_change()

# 포트폴리오 수익률 (가중 평균)
portfolio_returns = sum(asset.weight * returns[asset.ticker]
                       for asset in portfolio.assets)

# 성과 메트릭 계산
metrics = compute_metrics(portfolio_returns, benchmark_returns=spy_returns)
# → {cagr, sharpe, sortino, calmar, mdd, var, cvar, alpha, beta, ...}
```

### 5.2 전략 백테스트

**관련 파일**:

- `analytics/app/backtest/vbt_engine.py`
- `analytics/strategy/main.py`

**프로세스**:

```python
# 1. 파라미터 입력
params = BacktestParams(
    strategy="sma_cross",
    sma_fast=20,
    sma_slow=60,
    initial_capital=100000,
)

# 2. 가격 데이터 로드
prices = market_db.get_price("TQQQ", start="2020-01-01")

# 3. 신호 생성
signals = _signals(prices, params)  # Bool 시리즈

# 4. VectorBT 포지션 계산
pf = vbt.Portfolio.from_signals(prices, signals, ...)

# 5. 성과 평가
result = {
    "total_return": pf.total_return(),
    "cagr": compute_cagr(pf.total_return(), years),
    "sharpe": pf.stats()['Sharpe Ratio'],
    "max_drawdown": pf.stats()['Max Drawdown'],
    ...
}
```

### 5.3 신호 생성 (매일 22:30 KST)

**관련 파일**:

- `analytics/app/main.py` - `/signals/today` 엔드포인트
- `analytics/strategy/main.py` - `AlphaHelixStrategy` 클래스

**프로세스**:

```python
# 1. Spring Boot 스케줄러에서 호출
POST /api/analytics/signals/today

# 2. 각 티커에 대해:
for ticker in ["TQQQ", "SOXL", "UPRO", ...]:

    # 2a. 가격 데이터 로드
    prices = market_db.get_price(ticker, period="2y")

    # 2b. 국면 탐지
    regime = detect_regime(prices)  # bull_quiet, bear, etc.

    # 2c. 기술적 신호
    signal = compute_momentum_signal(prices, vix)  # -1, 0, 1

    # 2d. 신뢰도 점수
    confidence = ConfidenceScoringSystem().compute_confidence(signal, regime)

    # 2e. ML 예측
    xgb_proba = xgb_model.predict(features)  # 상승 확률

    # 2f. SHAP 설명
    shap_values = explainer.shap_values(features)  # Top 3 피처

    # 2g. 신호 저장
    signal_record = {
        "ticker": ticker,
        "signal": signal,
        "confidence": confidence,
        "regime": regime,
        "ml_proba": xgb_proba,
        "explanation": shap_values,
        "timestamp": now,
    }
    database.save(signal_record)

# 3. Frontend에 반환
return signals_list
```

### 5.4 파트너-프로젝트 매칭

**관련 파일**:

- `backend/src/main/java/.../service/MatchingService.java`
- `frontend/src/pages/ClientSearch.jsx`

**매칭 알고리즘**:

```
클라이언트가 프로젝트 등록
  ↓
필요 스킬 태그 지정
  ↓
Backend에서 매칭 요청
  ↓
알고리즘:
  1. 필요 스킬을 모두 보유한 파트너 필터
  2. 경험 수준 일치도 계산
  3. 포트폴리오 평점 고려
  4. 이전 프로젝트 성공률 고려
  5. 상호 관심도 확인
  ↓
Top 5-10 파트너 제안
  ↓
클라이언트가 선택 → 계약 진행
```

---

## 6. 개발 워크플로우

### 6.1 기능 추가 (예: 새로운 위험 지표)

**시나리오**: "Information Ratio" 지표 추가

**Step 1: Analytics 계층**

```python
# analytics/app/metrics/quantstats_report.py

def compute_metrics(returns: pd.Series, benchmark: pd.Series | None = None) -> dict:
    ...
    out["information_ratio"] = _f(
        qs.stats.information_ratio(returns, benchmark)
    )
    return out
```

**Step 2: API 레이어**

```python
# analytics/app/main.py

@app.post("/backtest")
def backtest(req: BacktestRequest):
    ...
    result["risk_metrics"] = compute_metrics(...)
    # information_ratio이 자동으로 포함됨
    return result
```

**Step 3: 백엔드**

```java
// backend/.../dto/MetricsDto.java

@Data
public class MetricsDto {
    private Double informationRatio;
    // getters/setters
}

// backend/.../controller/AnalyticsController.java

@GetMapping("/portfolio/{id}/metrics")
public MetricsDto getMetrics(@PathVariable Long id) {
    // Analytics API 호출
    return analyticsService.getMetrics(id);
}
```

**Step 4: 프론트엔드**

```jsx
// frontend/src/api/analytics.js

export const getPortfolioMetrics = async (portfolioId) => {
  const response = await api.get(`/portfolio/${portfolioId}/metrics`);
  return response.data;
};

// frontend/src/pages/AnalyticsLab.jsx

const MetricsPanel = () => {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    getPortfolioMetrics(id).then((m) => {
      setMetrics(m);
    });
  }, [id]);

  return (
    <div>
      <p>Information Ratio: {metrics?.informationRatio}</p>
    </div>
  );
};
```

### 6.2 버그 수정 워크플로우

```
1. 버그 리포트 수신
   - 증상: "포트폴리오 Sharpe 값이 음수가 나옴"
   - 재현: TQQQ만 보유한 포트폴리오

2. 원인 파악
   - analytics/app/metrics/quantstats_report.py 확인
   - Sharpe 계산: μ/σ
   - 평균 수익률이 음수인 경우 발생

3. 수정
   - NaN 체크 강화
   - 표준편차 0 처리
   - 테스트 케이스 추가

4. 테스트
   - Unit test: test_metrics.py
   - Integration test: POST /backtest
   - UI 확인

5. 배포
   - Git commit & push
   - CI/CD 파이프라인
   - Production 반영
```

### 6.3 Git 워크플로우

```bash
# Feature 브랜치 생성
git checkout -b feature/information-ratio

# 작업
vim analytics/app/metrics/quantstats_report.py
git add .
git commit -m "feat: add information ratio calculation"

# Pull Request
git push origin feature/information-ratio
# → GitHub PR 생성 → 코드 리뷰 → 승인

# Main 브랜치에 머지
git checkout main
git pull origin main
git merge feature/information-ratio
git push origin main

# Main 브랜치 배포 자동 트리거 (CI/CD)
```

---

## 7. 배포 가이드

### 7.1 개발 환경 배포

```bash
# 모든 서비스 재시작
docker-compose restart

# 로그 확인
docker-compose logs backend analytics frontend
```

### 7.2 스테이징 배포

```bash
# 스테이징 브랜치
git checkout staging
git pull origin staging

# 빌드
cd frontend && npm run build
cd ../backend && ./gradlew build
cd ../analytics && pip install -r requirements.txt

# 테스트
npm run test
./gradlew test
pytest

# 스테이징 배포
docker-compose -f docker-compose.staging.yml up -d
```

### 7.3 프로덕션 배포

```bash
# 릴리스 태그
git tag v1.0.0
git push origin v1.0.0

# 프로덕션 빌드
git checkout v1.0.0
docker build -f Dockerfile.prod -t alpha-helix:v1.0.0 .

# 푸시 (Docker Registry)
docker push registry.example.com/alpha-helix:v1.0.0

# 프로덕션 배포
kubectl apply -f k8s/deployment.yaml
# 또는
docker-compose -f docker-compose.prod.yml up -d
```

### 7.4 데이터 마이그레이션

```bash
# 백업
pg_dump -U postgres devbridge > backup_20260526.sql

# 마이그레이션 실행
cd backend
./gradlew flywayMigrate

# 검증
psql -U postgres devbridge -c "\dt"
```

---

## 8. 트러블슈팅

### 8.1 프론트엔드 이슈

**증상**: "Module not found" 에러

```
해결:
1. node_modules 삭제: rm -rf node_modules
2. 재설치: npm install
3. 캐시 삭제: npm cache clean --force
4. 개발 서버 재시작: npm run dev
```

**증상**: CORS 에러

```
해결:
1. backend CORS 설정 확인
   - src/main/java/.../config/CorsConfig.java
2. API URL 확인
   - VITE_API_URL = http://localhost:8080
3. 브라우저 캐시 삭제
```

### 8.2 백엔드 이슈

**증상**: "Connection refused" (DB)

```
해결:
1. PostgreSQL 실행 확인: sudo systemctl status postgresql
2. DB 생성 확인: psql -l
3. 연결 문자열 확인: application.properties
4. 포트 확인: lsof -i :5432
```

**증상**: "Gradle build 실패"

```
해결:
1. Gradle 캐시 삭제: ./gradlew clean
2. 의존성 다시 다운로드: ./gradlew build
3. JDK 버전 확인: java -version (17+ 필요)
```

### 8.3 Analytics 이슈

**증상**: "ImportError: No module named 'quantstats'"

```
해결:
1. 가상환경 활성화 확인
   - Windows: venv\Scripts\activate
   - Linux/Mac: source venv/bin/activate
2. 재설치: pip install quantstats --upgrade
3. 의존성 전체: pip install -r requirements.txt
```

**증상**: "Connection to PostgreSQL failed"

```
해결:
1. DB 연결 문자열 확인: config.py
2. 포트 확인: psql -U postgres -h localhost
3. 방화벽 확인: sudo ufw allow 5432
```

### 8.4 데이터 이슈

**증상**: "No data for ticker TQQQ"

```
해결:
1. Polygon API 키 확인: .env
2. 수동 수집 실행:
   cd analytics
   python -c "from app.data.collector import collect_us_ohlcv; collect_us_ohlcv(['TQQQ'])"
3. DB 확인: SELECT * FROM ohlcv WHERE symbol = 'TQQQ'
```

**증상**: "FRED 데이터 누락"

```
해결:
1. FRED API 키 확인
2. 시리즈 ID 확인: https://fred.stlouisfed.org/
3. 수동 수집: python -c "from app.data.collector import collect_macro"
```

---

## 참고자료

### 학습 자료

- [React 공식 문서](https://react.dev)
- [Spring Boot 가이드](https://spring.io/projects/spring-boot)
- [FastAPI 튜토리얼](https://fastapi.tiangolo.com)
- [PostgreSQL 문서](https://www.postgresql.org/docs)

### 프로젝트 문서

- `docs/FINANCIAL_STATISTICS_GLOSSARY.md`: 금융 용어 사전
- `docs/SYSTEM_ARCHITECTURE.md`: 시스템 아키텍처
- `backend/docs/ERD_current.md`: 데이터베이스 스키마
- `README.md`: 프로젝트 개요

### 연락처

- 백엔드: backend-team@example.com
- 프론트엔드: frontend-team@example.com
- Analytics: analytics-team@example.com
- DevOps: devops@example.com

---

**마지막 수정**: 2026년 5월 26일  
**버전**: 1.0  
**관리자**: Alpha-Helix Development Team
