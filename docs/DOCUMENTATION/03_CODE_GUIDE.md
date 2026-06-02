# 💻 Your Personal Quant Manager - 코드 설명서

**대상**: 초보 개발자, 주니어 엔지니어  
**목표**: 프로젝트 구조를 이해하고 코드를 빠르게 파악  
**버전**: 1.0  
**작성일**: 2026년 5월 24일

---

## 📑 목차

1. [프로젝트 구조](#프로젝트-구조)
2. [기술 스택 이해](#기술-스택-이해)
3. [주요 패턴과 규칙](#주요-패턴과-규칙)
4. [코드 흐름 예시](#코드-흐름-예시)
5. [자주 하는 작업](#자주-하는-작업)
6. [디버깅 팁](#디버깅-팁)
7. [더 배우기](#더-배우기)

---

## 프로젝트 구조

### 폴더 구조 (전체 뷰)

```
Programmers_final/
├── backend/              # Java Spring Boot 백엔드
│   └── src/main/java/com/DevBridge/devbridge/
│       ├── user/         # 사용자 (인증, 프로필)
│       ├── profile/      # 프로필 상세 (클라이언트, 파트너)
│       ├── strategy/     # 투자 전략 관리
│       ├── analytics/    # 분석 관련 (백테스트)
│       ├── payment/      # 결제 (Toss, 은행)
│       ├── project/      # 프로젝트 (외주)
│       ├── matching/     # AI 매칭
│       ├── chat/         # 실시간 채팅
│       ├── entity/       # 데이터베이스 엔티티 (JPA)
│       ├── dto/          # 데이터 전달 객체
│       ├── service/      # 비즈니스 로직
│       ├── repository/   # 데이터베이스 접근
│       └── config/       # 설정 파일
│
├── frontend/             # React 프론트엔드
│   └── src/
│       ├── components/   # 재사용 가능한 UI 컴포넌트
│       ├── pages/        # 페이지 (각 화면)
│       ├── store/        # 상태 관리 (Zustand)
│       ├── api/          # API 호출 로직
│       └── assets/       # 이미지, 비디오
│
└── analytics/            # Python 분석 엔진
    └── app/
        ├── backtest/     # 백테스트 엔진
        ├── data/         # 데이터 처리
        ├── metrics/      # 성과 지표 계산
        ├── explain/      # SHAP 설명
        ├── robust/       # 강건성 검증
        └── models/       # AI 모델
```

### 간단한 도식 (아키텍처)

```
┌─────────────────────────────────┐
│      사용자 (브라우저)          │
└───────────────┬─────────────────┘
                │
         ┌──────▼──────┐
         │  Frontend   │
         │  (React)    │
         └──────┬──────┘
                │ HTTP API
         ┌──────▼──────────────┐
         │  Backend            │
         │  (Spring Boot)       │
         │  - 사용자 관리       │
         │  - 전략 관리         │
         │  - 주문 처리         │
         └──────┬──────────────┘
                │
        ┌───────┴────────┬──────────────┐
        │                │              │
    ┌───▼───┐     ┌──────▼──────┐  ┌──▼────────┐
    │ MySQL │     │ Redis Cache │  │ Python    │
    │ DB    │     │ (빠른 조회) │  │ Analytics │
    └───────┘     └─────────────┘  │ (분석)    │
                                    └──────────┘
```

---

## 기술 스택 이해

### 백엔드 (Java Spring Boot)

#### 1. Spring Boot란?

**쉽게 말해**: 자동차 공장이라고 생각하면 됩니다.

- 재료 (자동차 부품)들을 넣으면
- 자동으로 조립해서 (설정 자동화)
- 완성된 자동차 (웹 애플리케이션)를 만들어줍니다.

#### 2. 주요 계층 (Layer)

백엔드는 위에서 아래로 이렇게 쌓여 있습니다:

```
┌─────────────────────────┐
│  Controller (진입점)     │ ← HTTP 요청을 받음
│  예: ProfileController   │
├─────────────────────────┤
│  Service (비즈니스 로직) │ ← 실제 일을 처리 (계산, 검증)
│  예: ProfileService      │
├─────────────────────────┤
│  Repository (데이터)     │ ← 데이터베이스에 저장/조회
│  예: ProfileRepository   │
├─────────────────────────┤
│  Entity (테이블)         │ ← 데이터베이스의 테이블 구조
│  예: UserEntity          │
├─────────────────────────┤
│  DTO (데이터 형식)       │ ← 통신할 때 데이터 형식
│  예: ProfileDTO          │
└─────────────────────────┘
```

#### 3. 요청이 오면 어떻게 될까?

**사용자가 프로필을 조회할 때**:

```
1️⃣ 브라우저에서 요청
   GET /api/users/me

2️⃣ Controller가 받음
   UserController.getMyProfile()

3️⃣ Service에게 위임 (실제 로직)
   UserService.getMyProfile()

4️⃣ Repository에서 데이터 조회
   UserRepository.findById(userId)

5️⃣ 데이터베이스에서 가져옴
   MySQL: SELECT * FROM users WHERE id = ?

6️⃣ 결과를 DTO로 변환 (보안, 간결성)
   User → UserDTO (민감한 정보 제외)

7️⃣ JSON으로 브라우저에 응답
   { "id": 1, "email": "user@example.com", ... }
```

### 프론트엔드 (React)

#### 1. React란?

**쉽게 말해**: LEGO 블록 조립소입니다.

- 작은 블록(컴포넌트)들을 만들고
- 이를 조합해서 (레이아웃)
- 완성된 화면(페이지)을 만듭니다.

#### 2. 폴더 구조

```
frontend/src/
├── components/
│   ├── Button.jsx          # 버튼 컴포넌트 (재사용)
│   ├── Card.jsx            # 카드 컴포넌트
│   └── Form.jsx            # 폼 컴포넌트
│
├── pages/
│   ├── HomePage.jsx        # 홈 페이지
│   ├── StrategyPage.jsx    # 전략 페이지
│   └── ProfilePage.jsx     # 프로필 페이지
│
├── store/
│   └── appStore.js         # 전역 상태 (로그인 유저 정보 등)
│
├── api/
│   └── client.js           # API 통신 (axios)
│
└── main.jsx                # 진입점
```

#### 3. 데이터 흐름

```
┌──────────────────┐
│   API 호출       │ ← api/client.js에서
│ GET /api/users/me│
└────────┬─────────┘
         │
    ┌────▼──────────┐
    │ 응답받음       │
    │ { id, name }   │
    └────┬──────────┘
         │
    ┌────▼────────────────┐
    │ 상태 업데이트       │
    │ store.setUser()     │
    └────┬────────────────┘
         │
    ┌────▼──────────────┐
    │ 컴포넌트 재렌더링 │
    │ 화면 업데이트     │
    └────────────────────┘
```

### 분석 엔진 (Python)

#### 1. 역할

- **백테스트**: 과거 데이터로 전략 성과 계산
- **성능 지표**: Sharpe Ratio, Max Drawdown 등 계산
- **설명**: SHAP 값으로 "왜"를 설명
- **강건성**: 몬테카를로 시뮬레이션

#### 2. 주요 라이브러리

| 라이브러리     | 역할       | 예시                       |
| -------------- | ---------- | -------------------------- |
| **VectorBT**   | 백테스트   | 포트폴리오 가치 시뮬레이션 |
| **XGBoost**    | 머신러닝   | 신호 예측                  |
| **SHAP**       | 설명가능성 | 각 변수의 중요도           |
| **QuantStats** | 성과 분석  | Sharpe Ratio 계산          |

---

## 주요 패턴과 규칙

### 명명 규칙 (Naming Convention)

#### 백엔드 (Java)

```java
// ✅ 클래스: PascalCase (파일명과 같음)
public class UserProfile { }
public class StrategyService { }

// ✅ 메서드: camelCase
public UserProfile getUserProfile() { }
public void updateStrategy() { }

// ✅ 상수: UPPER_SNAKE_CASE
public static final String DATABASE_URL = "...";
private static final int MAX_RETRIES = 3;

// ✅ 변수: camelCase
private String userName;
private int portfolioValue;
```

#### 프론트엔드 (JavaScript/React)

```javascript
// ✅ 컴포넌트: PascalCase
function UserProfile() {}
function StrategyCard() {}

// ✅ 파일: kebab-case
user - profile.jsx;
strategy - card.jsx;

// ✅ 함수/변수: camelCase
const getUserProfile = () => {};
const portfolioValue = 1000000;

// ✅ 상수: UPPER_SNAKE_CASE
const API_URL = "http://localhost:8080";
const MAX_RETRIES = 3;
```

### 요청/응답 패턴

#### 표준 응답 형식

```json
{
  "success": true,
  "message": "작업 완료",
  "data": {
    // 실제 데이터
  },
  "timestamp": "2026-05-24T10:30:00Z"
}
```

#### 에러 응답

```json
{
  "success": false,
  "message": "사용자를 찾을 수 없습니다",
  "errorCode": "USER_NOT_FOUND",
  "timestamp": "2026-05-24T10:30:00Z"
}
```

---

## 코드 흐름 예시

### 예시 1: 전략 생성하기

**사용자 입력**:

```
"배당금으로 생활비를 충당하고 싶어"
```

**데이터가 흐르는 경로**:

```
1️⃣ Frontend (React)
   ┌─────────────────────────────────────────┐
   │ StrategyCreatePage.jsx                  │
   │                                         │
   │ 사용자가 텍스트 입력                    │
   │ "배당금으로 생활비를..."                │
   │                                         │
   │ → 버튼 클릭 (handleCreateStrategy)     │
   └────────────────────┬────────────────────┘
                        │ API 호출
                        │ POST /api/strategies
                        │ { goalDescription: "..." }
                        ▼

2️⃣ Backend (Spring Boot)
   ┌─────────────────────────────────────────┐
   │ StrategyController.createStrategy()     │
   │                                         │
   │ @PostMapping("/strategies")             │
   │ public ResponseEntity create() { }      │
   └────────────────────┬────────────────────┘
                        │ Service 호출
                        ▼
   ┌─────────────────────────────────────────┐
   │ StrategyService.generateStrategy()      │
   │                                         │
   │ 1. LLM API 호출 (Google Gemini)        │
   │    → AI가 전략 규칙 생성                │
   │                                         │
   │ 2. 검증                                 │
   │    → 규칙이 타당한가?                  │
   │                                         │
   │ 3. 저장 (Repository)                    │
   │    → 데이터베이스에 저장               │
   └────────────────────┬────────────────────┘
                        │ Repository 호출
                        ▼
   ┌─────────────────────────────────────────┐
   │ StrategyRepository.save()               │
   │                                         │
   │ MySQL에 저장:                           │
   │ INSERT INTO strategies (...)            │
   │ VALUES (...)                            │
   └────────────────────┬────────────────────┘
                        │ 결과 반환
                        ▼

3️⃣ Response (JSON)
   ┌─────────────────────────────────────────┐
   │ {                                       │
   │   "success": true,                      │
   │   "data": {                             │
   │     "id": 101,                          │
   │     "name": "배당 성장 전략",          │
   │     "rules": { ... }                    │
   │   }                                     │
   │ }                                       │
   └─────────────────────────────────────────┘
```

### 예시 2: 백테스트 실행하기

**흐름**:

```
1️⃣ Frontend에서 요청
   POST /api/backtests
   {
     "strategyId": 101,
     "startDate": "2020-01-01",
     "endDate": "2026-05-24"
   }

2️⃣ Backend가 받아서 Python에 위임
   StrategyService.runBacktest()
   → Python FastAPI 호출
   POST http://localhost:8001/backtest

3️⃣ Python 분석 엔진
   VectorBT 라이브러리 사용:
   - 과거 주가 데이터 로드
   - 매매 신호 생성 (진입/청산)
   - 포트폴리오 가치 계산 (매 거래마다)
   - 성과 지표 계산:
     * Total Return: 152.3%
     * Sharpe Ratio: 1.87
     * Max Drawdown: -18.2%

4️⃣ 결과를 Backend에 반환
   {
     "backtestId": "bt_001",
     "status": "COMPLETED",
     "metrics": { ... }
   }

5️⃣ Frontend에 응답
   화면에 차트와 지표 표시
```

---

## 자주 하는 작업

### 작업 1: 새로운 API 엔드포인트 추가

**상황**: "사용자의 관심 전략 목록을 조회하는 API"를 추가하고 싶습니다.

**단계**:

```
1️⃣ DTO 생성
   file: dto/StrategyDTO.java

   public class StrategyDTO {
       private Long id;
       private String name;
       private Double trustScore;
       // ... getter/setter
   }

2️⃣ Repository 메서드 추가
   file: repository/StrategyRepository.java

   @Query("SELECT s FROM Strategy s WHERE s.userId = ?1")
   List<Strategy> findByUserId(Long userId);

3️⃣ Service에 비즈니스 로직 추가
   file: service/StrategyService.java

   public List<StrategyDTO> getMyStrategies(Long userId) {
       List<Strategy> strategies = repository.findByUserId(userId);
       return strategies.stream()
           .map(this::toDTO)
           .collect(Collectors.toList());
   }

4️⃣ Controller에 엔드포인트 추가
   file: controller/StrategyController.java

   @GetMapping("/strategies/me")
   public ResponseEntity<?> getMyStrategies() {
       Long userId = getCurrentUserId();
       List<StrategyDTO> strategies = service.getMyStrategies(userId);
       return ResponseEntity.ok(new ApiResponse(true, strategies));
   }

5️⃣ 테스트
   - Postman이나 curl로 테스트
   GET http://localhost:8080/api/strategies/me

   응답:
   {
     "success": true,
     "data": [
       { "id": 1, "name": "배당 전략", "trustScore": 87.5 },
       { "id": 2, "name": "모멘텀 전략", "trustScore": 82.3 }
     ]
   }
```

### 작업 2: 프론트엔드 페이지 추가

**상황**: 사용자의 전략 목록을 보여주는 페이지를 만들고 싶습니다.

**단계**:

```
1️⃣ API 클라이언트 함수 추가
   file: src/api/strategyApi.js

   export const getMyStrategies = async () => {
       const response = await axios.get('/api/strategies/me');
       return response.data.data;
   };

2️⃣ 컴포넌트 생성
   file: src/components/StrategyCard.jsx

   export function StrategyCard({ strategy }) {
       return (
           <div className="card">
               <h3>{strategy.name}</h3>
               <p>신뢰도: {strategy.trustScore}점</p>
               <button>자세히 보기</button>
           </div>
       );
   }

3️⃣ 페이지 생성
   file: src/pages/StrategyListPage.jsx

   import { useEffect, useState } from 'react';
   import { getMyStrategies } from '../api/strategyApi';
   import { StrategyCard } from '../components/StrategyCard';

   export function StrategyListPage() {
       const [strategies, setStrategies] = useState([]);

       useEffect(() => {
           // 페이지 로드 시 데이터 가져오기
           getMyStrategies().then(setStrategies);
       }, []);

       return (
           <div>
               <h1>내 전략 목록</h1>
               {strategies.map(s => (
                   <StrategyCard key={s.id} strategy={s} />
               ))}
           </div>
       );
   }

4️⃣ 라우터에 등록
   file: src/main.jsx

   import { StrategyListPage } from './pages/StrategyListPage';

   <Router>
       <Routes>
           <Route path="/strategies" element={<StrategyListPage />} />
       </Routes>
   </Router>

5️⃣ 테스트
   - 브라우저에서 http://localhost:3000/strategies 방문
   - 전략 목록 표시됨
```

### 작업 3: 데이터베이스 쿼리 최적화

**상황**: 사용자의 전략 조회가 느립니다.

**확인 및 개선**:

```
1️⃣ 현재 코드 분석
   file: repository/StrategyRepository.java

   @Query("SELECT s FROM Strategy s WHERE s.userId = ?1")
   List<Strategy> findByUserId(Long userId);

   ⚠️ 문제: 모든 필드를 조회 (불필요한 필드도)

2️⃣ 개선 1: 필요한 필드만 조회 (Projection)

   @Query("SELECT new com.DevBridge.devbridge.dto.StrategyDTO(" +
          "s.id, s.name, s.trustScore) " +
          "FROM Strategy s WHERE s.userId = ?1")
   List<StrategyDTO> findByUserIdOptimized(Long userId);

3️⃣ 개선 2: N+1 문제 해결 (Eager Loading)

   @Query("SELECT DISTINCT s FROM Strategy s " +
          "LEFT JOIN FETCH s.rules " +
          "WHERE s.userId = ?1")
   List<Strategy> findByUserIdWithRules(Long userId);

4️⃣ 개선 3: 인덱스 추가
   file: entity/Strategy.java

   @Entity
   @Table(indexes = @Index(name = "idx_user_id", columnList = "user_id"))
   public class Strategy { }

5️⃣ 성능 테스트
   - 개선 전: 500ms
   - 개선 후: 50ms ✅
```

---

## 디버깅 팁

### 팁 1: 로그 찍기

#### Backend (Java)

```java
// 자동으로 Logger 주입
@Slf4j  // Lombok 라이브러리
public class UserService {
    public User getUser(Long id) {
        log.info("Fetching user with id: {}", id);  // ℹ️ 정보

        User user = repository.findById(id);
        if (user == null) {
            log.warn("User not found: {}", id);      // ⚠️ 경고
        }

        log.debug("User details: {}", user);         // 🐛 디버그
        return user;
    }
}

// 실행하면 콘솔에 출력됨:
// [INFO] Fetching user with id: 1
// [DEBUG] User details: User(id=1, name=john, ...)
```

#### Frontend (JavaScript)

```javascript
export function StrategyList() {
  useEffect(() => {
    console.log("Component mounted");

    getMyStrategies()
      .then((data) => {
        console.log("Strategies loaded:", data);
      })
      .catch((error) => {
        console.error("Error loading strategies:", error);
      });
  }, []);
}

// 브라우저 개발자 도구 (F12)에서 확인
```

### 팁 2: API 테스트 도구

#### Postman 사용

```
1️⃣ Postman 열기 (또는 Insomnia)

2️⃣ 요청 작성
   Method: GET
   URL: http://localhost:8080/api/strategies/me
   Headers: Authorization: Bearer <token>

3️⃣ Send 버튼 클릭

4️⃣ 응답 확인
   Status: 200 OK
   Response: { "success": true, "data": [...] }
```

#### curl 명령어 (터미널)

```bash
# 전략 목록 조회
curl -X GET http://localhost:8080/api/strategies/me \
  -H "Authorization: Bearer <token>"

# 새 전략 생성
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "배당 전략", "description": "..."}'
```

### 팁 3: 브라우저 개발자 도구

```
1️⃣ F12를 눌러서 개발자 도구 열기

2️⃣ Network 탭에서:
   - API 호출 기록 확인
   - 요청/응답 본문 확인
   - 상태 코드 확인 (200, 400, 500 등)

3️⃣ Console 탭에서:
   - JavaScript 에러 확인
   - console.log() 메시지 확인

4️⃣ Application 탭에서:
   - 로컬 스토리지 확인
   - 쿠키 확인 (JWT 토큰)
```

### 팁 4: 흔한 에러와 해결책

| 에러                          | 원인                            | 해결책                                 |
| ----------------------------- | ------------------------------- | -------------------------------------- |
| **401 Unauthorized**          | JWT 토큰 없음 또는 만료         | 다시 로그인하거나 토큰 갱신            |
| **404 Not Found**             | 엔드포인트 존재 안 함           | URL 확인, 컨트롤러 매핑 확인           |
| **500 Internal Server Error** | 백엔드 에러                     | 서버 로그 확인 (`log.error()`)         |
| **CORS 에러**                 | 프론트엔드와 백엔드 도메인 다름 | 백엔드의 CORS 설정 확인                |
| **Connection refused**        | 서버가 안 떠있음                | 백엔드 서버 시작 (`./gradlew bootRun`) |

---

## 더 배우기

### 추천 학습 순서

```
1단계: 기본 개념
   └─ Java 기초 (변수, 클래스, 메서드)
   └─ HTTP 통신 (GET, POST, 요청/응답)
   └─ REST API 개념

2단계: 프레임워크
   └─ Spring Boot 튜토리얼
   └─ React 기초
   └─ 데이터베이스 (SQL)

3단계: 실전
   └─ 이 프로젝트의 코드 읽기
   └─ 작은 기능 추가해보기
   └─ 버그 고쳐보기

4단계: 심화
   └─ 테스트 코드 작성 (JUnit, Jest)
   └─ 성능 최적화
   └─ 클라우드 배포
```

### 유용한 자료

| 주제         | 추천 자료                                | 난이도 |
| ------------ | ---------------------------------------- | ------ |
| Spring Boot  | [공식 가이드](https://spring.io/guides)  | 초급   |
| React        | [React 공식 튜토리얼](https://react.dev) | 초급   |
| 데이터베이스 | W3Schools SQL                            | 초급   |
| REST API     | RESTful API Design                       | 중급   |
| 클린 코드    | "Clean Code" 책                          | 중급   |

### 도움이 될 만한 커맨드들

```bash
# 백엔드 실행
cd backend
./gradlew bootRun

# 프론트엔드 실행
cd frontend
npm install
npm run dev

# 데이터베이스 접속
mysql -u root -p

# 로그 확인
tail -f backend/build/logs/app.log

# 테스트 실행
./gradlew test
npm test
```

---

### 마지막 조언

> **"처음부터 모든 것을 이해하려고 하지 마세요."**

1. **작은 부분부터 시작**: 한 컴포넌트 또는 한 엔드포인트부터
2. **동작을 먼저 본다**: 코드를 수정했을 때 어떻게 변하는지 보기
3. **로그를 믿는다**: 무엇이 일어나는지 로그를 보고 이해하기
4. **질문하기**: 이해 안 되는 것은 꼭 물어보기
5. **반복하기**: 같은 패턴을 여러 번 보면 자연스럽게 이해됨

---

**문서 작성**: 2026-05-24  
**대상**: 초보자, 주니어  
**난이도**: ⭐⭐⭐☆☆ (중하)
