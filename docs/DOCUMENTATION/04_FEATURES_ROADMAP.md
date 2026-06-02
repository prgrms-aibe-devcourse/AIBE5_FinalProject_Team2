# 🚀 Your Personal Quant Manager - 추가 기능 로드맵

**작성일**: 2026년 5월 24일  
**우선순위 기준**: 비즈니스 임팩트 × 구현 난이도  
**버전**: 1.0

---

## 📑 목차

1. [Phase별 기능 로드맵](#phase별-기능-로드맵)
2. [세부 기능 명세](#세부-기능-명세)
3. [우선순위 매트릭스](#우선순위-매트릭스)
4. [기술 부채 해결](#기술-부채-해결)
5. [고객 요청 기능](#고객-요청-기능)

---

## Phase별 기능 로드맵

### 📍 Phase 1: MVP (2026년 6월) - ✅ 완료

**목표**: 핵심 기능 완성

- ✅ 사용자 인증 및 프로필
- ✅ 전략 생성 (AI 기반)
- ✅ 백테스트 기본
- ✅ 신뢰도 계산

---

### 📍 Phase 2: Trust & Explain (2026년 7월) - 🔄 진행 중

**목표**: 신뢰도와 설명가능성 고도화

#### 2.1 고급 강건성 검증

**기능**: 여러 종류의 강건성 테스트

**세부사항**:

```
- Walk-Forward Analysis (시간 윈도우 변경)
- Out-of-Sample 테스트 (데이터 분리)
- Parameter Sensitivity (파라미터 변화 영향)
- Regime Analysis (시장 상태별 성과)
```

**예상 효과**:

- Trust Score 정확성 향상
- 과적합 탐지율 개선
- 사용자 신뢰도 ↑

**담당팀**: Analytics  
**예상 기간**: 2주  
**복잡도**: ⭐⭐⭐⭐

---

#### 2.2 SHAP 기반 설명 고도화

**기능**: 더 자세한 거래별 설명

**세부사항**:

```
- Feature Importance 시각화
- Partial Dependence Plot
- SHAP Waterfall Plot
- 거래별 상세 설명 (Why 이 거래가 발생했나?)
```

**예상 효과**:

- 사용자 이해도 ↑↑
- NPS 점수 개선
- "AI를 신뢰한다"는 비율 ↑

**담당팀**: Analytics  
**예상 기간**: 3주  
**복잡도**: ⭐⭐⭐⭐⭐

---

#### 2.3 의사결정 로그 시스템

**기능**: 사용자의 모든 투자 결정 추적

**세부사항**:

```
기록할 정보:
- 전략 선택 (CHOOSE / SKIP / MODIFY)
- AI 추천 vs 사용자 결정 비교
- 의사결정 시점의 시장 상태
- 결과 (수익/손실)
- 사용자 만족도 평가

활용:
- 사용자 투자 성향 분석
- AI 모델 개선 (페드백 루프)
- 사용자의 "의사결정 점수" 계산
```

**구현**:

```json
{
  "decisionId": "dec_20260601_001",
  "userId": 1,
  "strategyId": 101,
  "decision": "IMPLEMENT",
  "aiRecommendation": "IMPLEMENT",
  "userNotes": "Trust Score가 높아서 실행",
  "userRating": 8,
  "timestamp": "2026-06-01T10:00:00Z",

  // 3개월 후 결과
  "result": {
    "actualReturn": 18.5,
    "satisfactionScore": 9,
    "followThroughRate": 1.0
  }
}
```

**예상 효과**:

- 사용자 행동 데이터 축적
- AI 모델 개선 가능
- 커뮤니티 기능의 기반

**담당팀**: Backend  
**예상 기간**: 2주  
**복잡도**: ⭐⭐⭐

---

### 📍 Phase 3: Community (2026년 8월)

**목표**: 커뮤니티 기능으로 사용자 확대

#### 3.1 전략 공유 및 검색

**기능**:

- 검증된 전략을 커뮤니티에 공유
- 다른 사용자의 전략 검색 및 분석
- 공유된 전략의 성과 비교

**구현 상세**:

```
프로필 페이지:
┌──────────────────────────────────┐
│ john_investor의 전략 포트폴리오  │
├──────────────────────────────────┤
│ 공개 전략 (5개)                   │
│  - 배당 성장 전략       [공개]   │
│    신뢰도: 87점, 수익: +23%      │
│    팔로우: 342명                 │
│                                  │
│  - 모멘텀 추종 전략     [공개]   │
│    신뢰도: 82점, 수익: +18%      │
│    팔로우: 156명                 │
├──────────────────────────────────┤
│ 비공개 전략 (3개)                 │
│  [자신만 볼 수 있음]              │
└──────────────────────────────────┘

검색 기능:
- 신뢰도 순 정렬 (최신순)
- 수익률 순 정렬
- 위험도별 필터 (보수적 → 공격적)
- 팔로우 수 순 정렬
```

**데이터 구조**:

```java
@Entity
public class StrategyShare {
    @Id
    private Long id;

    @ManyToOne
    private User creator;

    @ManyToOne
    private Strategy strategy;

    @Enumerated(EnumType.STRING)
    private VisibilityLevel visibility; // PUBLIC, PRIVATE, FRIENDS

    private Long followerCount;
    private LocalDateTime sharedAt;

    // 통계
    private Double avgUserSatisfaction;
    private Integer totalImplementations;
    private Double communityTrustScore;
}
```

**API 엔드포인트**:

```
GET /api/strategies/community?sort=trust_score&limit=10
  → 신뢰도 높은 전략들 조회

GET /api/users/{userId}/strategies?visibility=PUBLIC
  → 특정 사용자의 공개 전략 조회

POST /api/strategies/{strategyId}/follow
  → 전략 팔로우

GET /api/strategies/{strategyId}/performance-distribution
  → 이 전략을 사용한 사람들의 성과 분포
  {
    "avgReturn": 18.5,
    "users": 342,
    "distribution": {
      "negative": 0.08,
      "positive": 0.92,
      "percentile_25": 8.2,
      "percentile_50": 18.5,
      "percentile_75": 28.3
    }
  }
```

**예상 효과**:

- 사용자 확대 (입소문)
- 플랫폼 粘着性 ↑
- 신뢰도 높은 전략 발굴

**담당팀**: Full-Stack  
**예상 기간**: 3주  
**복잡도**: ⭐⭐⭐⭐

---

#### 3.2 사용자 평가 시스템

**기능**:

- 전략 작성자에 대한 평가 및 뱃지
- "신뢰할 수 있는 전략 작성자" 인증

**뱃지 시스템**:

```
🏆 Trust Builder (신뢰 구축자)
   - 조건: 공개 전략의 평균 신뢰도 > 85점
   - 효과: 프로필에 배지 표시

💎 High Performer (고성과자)
   - 조건: 공개 전략들의 평균 수익률 > 20%
   - 효과: 커뮤니티 검색에서 우선 표시

👥 Community Leader (커뮤니티 리더)
   - 조건: 팔로워 1,000명 이상
   - 효과: 위크엔드 뉴스레터 추천

✨ Top Analyst (상위 분석가)
   - 조건: 신뢰도 + 수익률 + 팔로워 종합 점수 상위 1%
   - 효과: 특별 권한 (베타 기능 조기 접근)
```

---

#### 3.3 댓글 및 토론 기능

**기능**:

- 전략에 대한 피드백
- 전문가 의견 교환
- 사용자 간 아이디어 공유

```
API:
POST /api/strategies/{strategyId}/comments
  { "content": "이 전략 좋네요. 베타가 0.85라서 ...", "rating": 5 }

GET /api/strategies/{strategyId}/comments?sort=helpful&limit=10
  → 도움이 된다고 평가된 댓글순

PUT /api/comments/{commentId}/helpful
  → 댓글을 "도움됨"으로 표시
```

---

### 📍 Phase 4: Advanced (2026년 9월~)

#### 4.1 실시간 자동매매 연동

**기능**: API를 통한 실제 거래 자동화

**아키텍처**:

```
┌─────────────────────────┐
│   사용자 (웹 또는 앱)   │
│  "배당 전략 실행 GO"    │
└────────────┬────────────┘
             │
        ┌────▼─────┐
        │ Backend   │ ← 전략 신호 관리
        └────┬─────┘
             │
    ┌────────┴──────────┐
    │                   │
┌───▼───┐          ┌───▼────┐
│ KB증권│          │ Toss   │
│ Open  │          │ API    │
│ API   │          │        │
└───────┘          └────────┘
    │
    └─────→ 실제 거래 주문
```

**구현 상세**:

```python
# analytics/app/trading/auto_trader.py

class AutoTrader:
    def __init__(self, api_keys: Dict):
        self.kb_api = KBSecuritiesAPI(api_keys['kb'])
        self.toss_api = TossAPI(api_keys['toss'])

    async def execute_strategy(self,
                              strategy_id: int,
                              signal: TradingSignal):
        """
        전략 신호에 따라 자동 거래 실행
        """

        # 1. 유효성 검증
        validation = await self.validate_signal(signal)
        if not validation.is_valid:
            logger.warning(f"Invalid signal: {validation.reason}")
            return

        # 2. 거래 주문 생성
        order = await self.create_order(
            symbol=signal.symbol,
            quantity=signal.quantity,
            side=signal.side,  # BUY / SELL
            strategy_id=strategy_id
        )

        # 3. 거래 실행
        result = await self.kb_api.place_order(order)

        # 4. 결과 기록
        await self.log_trade(
            order_id=result.order_id,
            status=result.status,
            price=result.price,
            strategy_id=strategy_id
        )

        # 5. 실시간 모니터링 시작
        await self.monitor_position(order_id=result.order_id)
```

**예상 효과**:

- 사용자 편의성 극대화
- 수수료 수익 증대
- 프리미엄 구독 유도

**담당팀**: Backend + Analytics  
**예상 기간**: 4주  
**복잡도**: ⭐⭐⭐⭐⭐

---

#### 4.2 기관용 포트폴리오 관리

**기능**:

- 다중 포트폴리오 관리
- 팀 협업 (여러 매니저)
- 대규모 백테스트

**구현**:

```
사용 시나리오:
투자펀드 "Alpha Growth Fund"
├─ 포트폴리오 1: 공격적 성장 (매니저: 김철수)
│  └─ 할당액: $5M, 목표 수익률: 20%
├─ 포트폴리오 2: 안정적 배당 (매니저:이영희)
│  └─ 할당액: $3M, 목표 수익률: 8%
└─ 포트폴리오 3: 신흥시장 (매니저:박민준)
   └─ 할당액: $2M, 목표 수익률: 15%

대시보드:
- 전체 포트폴리오 성과: +18.5%
- 각 포트폴리오별 성과 추적
- 팀원 간 성과 비교
- 공동 리뷰 미팅 (댓글 기능)
```

---

#### 4.3 알고리즘 트레이딩 고도화

**기능**:

- 머신러닝 기반 신호 개선
- 강화학습 포트폴리오 최적화
- 실시간 시장 분석

**기술**:

```
신호 생성 개선:
├─ Traditional: RSI, MA, Momentum
├─ ML: XGBoost, LightGBM, Neural Network
└─ Ensemble: 여러 모델의 앙상블

포트폴리오 최적화:
├─ Modern Portfolio Theory (기본)
├─ Reinforcement Learning (고급)
└─ Risk Parity (분산 투자)
```

---

## 세부 기능 명세

### 기능 1: A/B 테스트 프레임워크

**배경**: 새 기능이 정말 도움이 되는지 확인 필요

**구현**:

```javascript
// Frontend: React 컴포넌트 조건부 렌더링
export function StrategyExplanation({ strategy }) {
    const { isVariantB } = useABTest('explanation_format');

    return isVariantB ?
        <AdvancedExplanation strategy={strategy} /> :
        <BasicExplanation strategy={strategy} />;
}

// Backend: 사용자별 할당 관리
@Component
public class ABTestService {
    public boolean isUserInVariant(Long userId, String test, String variant) {
        // 사용자 ID의 해시값으로 결정성 있게 할당
        int hash = (userId + test).hashCode();
        return (hash % 100) < 50; // 50% A, 50% B
    }
}

// 분석:
- 메트릭: 전략 실행율, NPS, 시간 체류
- 기간: 2주
- 결과: "고급 설명"이 +12% 실행율 향상 → 배포
```

---

### 기능 2: 포트폴리오 자동 리밸런싱

**배경**: 사용자가 자산배분을 자동으로 유지하고 싶음

**구현**:

```
설정 페이지:
├─ 목표 자산배분: 주식 60%, 채권 30%, 현금 10%
├─ 리밸런싱 주기: 월 1회 / 분기 1회
├─ 편차 허용범위: ±5%
└─ 자동 실행: YES / 승인 후 실행

프로세스:
1. 매월 1일에 자동 계산
   현재: 주식 65%, 채본 28%, 현금 7%
   → 목표: 60%, 30%, 10%

2. 필요한 조정:
   - 주식 매도 5%
   - 채권 매수 2%
   - 현금 흡수 3%

3. 통지:
   "리밸런싱 제안: 주식 $100k 매도, 채권 $40k 매수"
   [자동 실행] [수동 검토] [거절]

4. 실행 후 기록:
   - 거래 내역
   - 비용 (수수료)
   - 새로운 자산배분
```

---

### 기능 3: 실시간 알림 (Notification System)

**배경**: 중요한 이벤트를 놓치지 않으려면

**구현**:

```
알림 유형:

1. 전략 신호 알림
   📊 "배당 성장 전략" - 매수 신호 발생
   AAPL에 100주 매수 제안 (예상 배당 $3.20)
   [지금 실행] [나중에] [거절]

2. 가격 알림
   🔴 삼성전자 - 하한가 급락
   현재: 70,000원 (어제 대비 -12%)

3. 포트폴리오 알림
   ⚠️ 포트폴리오 낙폭 경보
   오늘 -3.5% (월 목표: -2% 이내)
   [리밸런싱 제안 보기]

4. 커뮤니티 알림
   👍 john_investor가 당신의 댓글을 좋아합니다
   "배당락 시점의 매도 판단이 정확하네요!"

구현 기술:
- Web Socket: 실시간 연결
- Push Notification: 모바일 앱
- Email: 중요 이벤트
- SMS: 긴급 상황
```

---

### 기능 4: 성과 분석 대시보드

**배경**: 사용자가 자신의 성과를 깊이 있게 분석하고 싶음

**구현**:

```
대시보드 섹션:

1. 요약 (Summary)
   ┌────────────────────┐
   │ 전체 수익률: +23.5% │
   │ 연 수익률: +18.2%  │
   │ 최대 낙폭: -12.5%  │
   │ 신뢰도: 87점       │
   └────────────────────┘

2. 시간대별 성과 (Performance by Period)
   ┌─────────────────────────────┐
   │ 년도별 수익률                 │
   │ 2024: +5.3% | 2025: +12.1% │
   │ 2026: +18.5% (현재)          │
   │                             │
   │ 분기별 수익률                 │
   │ Q1: +3.2% | Q2: +4.8% ...  │
   └─────────────────────────────┘

3. 자산별 기여도 (Attribution by Asset)
   ┌──────────────────────────┐
   │ 전체 수익: +23.5%        │
   │                          │
   │ AAPL: +8.2% (기여도 35%) │
   │ JNJ:  +6.1% (기여도 26%) │
   │ MSFT: +4.2% (기여도 18%) │
   │ 기타: +5.0% (기여도 21%) │
   └──────────────────────────┘

4. 손익 분석 (Risk-Return Analysis)
   산점도:
   Y축: 수익률
   X축: 변동성
   └─ 포트폴리오 위치 + 비교 벤치마크

5. 거래 분석 (Trade Analysis)
   ├─ 총 거래: 142건
   ├─ 승리: 84건 (59.2%)
   ├─ 패배: 58건 (40.8%)
   ├─ 평균 수익: +3.2%
   ├─ 평균 손실: -1.8%
   └─ 수익/손실 비율: 1.78
```

---

## 우선순위 매트릭스

```
        영향도 ↑
         크다
           │
    높음   │ Phase 2 (SHAP)
         ├────────────────── Phase 3 (커뮤니티)
    중간  │       Phase 2 (의사결정)
         │
    낮음  │           자동매매   기관용
           ├──────┬──────┬────────┬──────→ 구현 난이도
          쉬움  중간  어려움  매우어려움
```

**우선순위**:

1. 🔴 **매우 높음** (6월~7월)
   - SHAP 설명 고도화
   - 의사결정 로그
   - 강건성 테스트 고도화

2. 🟠 **높음** (8월)
   - 전략 공유 기능
   - 커뮤니티 검색
   - 알림 시스템

3. 🟡 **중간** (9월~)
   - 자동매매 연동
   - 실시간 자동 리밸런싱
   - 기관용 기능

4. 🟢 **낮음** (나중)
   - 고급 ML 모델
   - 국제 주식 지원
   - 암호화폐 지원

---

## 기술 부채 해결

### 1. 테스트 커버리지 개선

**현황**: 백엔드 40%, 프론트엔드 35%  
**목표**: 80% 이상

**계획**:

- 단위 테스트 (JUnit, Jest)
- 통합 테스트 (TestContainers)
- 가시적 테스트 (Cypress)
- 성능 테스트

**예상 기간**: 4주

---

### 2. 코드 리팩토링

**대상**: Service 클래스들 (비대한 메서드들)

**예시**: UserService.java (500+ 줄)

```java
// Before: 하나의 큰 메서드
public User updateProfile(UpdateProfileRequest req) {
    // 유효성 검증 (50줄)
    // 비즈니스 로직 (100줄)
    // 저장 (20줄)
    // 통지 (30줄)
    ...
}

// After: 작은 메서드들로 분리
public User updateProfile(UpdateProfileRequest req) {
    validate(req);
    User user = applyChanges(req);
    persist(user);
    notifyIfNeeded(user);
    return user;
}
```

**예상 기간**: 3주

---

### 3. 문서화 개선

**현황**: 많은 메서드에 주석 부족  
**목표**: 모든 Public API에 JavaDoc

**도구**: SonarQube, Javadoc

---

### 4. 의존성 최신화

**목표**:

- Spring Boot 3.4 → 3.5로 업그레이드
- React 19 지속 유지
- 보안 패치 적용

---

## 고객 요청 기능

### 🗣️ 요청 1: "암호화폐도 지원해줬으면..."

**현황**: 한국 주식만 지원  
**요청**: 비트코인, 이더리움 등

**계획**:

- Phase 5 (2026년 10월)
- Binance API 통합
- 암호화폐 24시간 거래 지원
- 변동성 높은 자산 위험도 경고

---

### 🗣️ 요청 2: "다른 사람 전략으로 자동 거래하고 싶어"

**현황**: 내 전략만 자동 거래  
**요청**: 유명 트레이더의 전략을 따라가기

**계획**: "Follow Strategy" 기능

```
1. 커뮤니티에서 전략 선택
2. "Copy to My Portfolio" 버튼
3. 자동으로 같은 거래 실행
4. 성과 비교 추적
```

---

### 🗣️ 요청 3: "모바일 앱이 필요해"

**현황**: 웹만 지원  
**요청**: iOS/Android 앱

**계획**:

- React Native 또는 Flutter로 크로스 플랫폼
- Phase 6 (2026년 11월)
- Push 알림
- 오프라인 지원

---

### 🗣️ 요청 4: "AI가 자동으로 포트폴리오를 리밸런싱해주면..."

**현황**: 사용자가 수동으로 결정  
**요청**: AI가 제안하고 자동 실행

**계획**: "Smart Rebalancing"

```
1. AI가 분석
   - 현재 시장 상황
   - 포트폴리오 상태
   - 사용자 목표

2. 제안
   "주식 5% 매도, 채권 3% 매수 추천
    근거: 변동성 상승 예상, 안정성 강화"

3. 승인/거절
   사용자 선택 또는 자동 (프리미엄)

4. 실행 및 기록
```

---

## 마무리

**핵심 메시지**:

> "우리는 기능을 추가하는 게 아니라, **신뢰를 구축**하고 있습니다."

- 모든 새 기능은 **Trust Score** 또는 **NPS**를 높이는 방향으로
- 복잡하기보다 **명확한** 기능을 선택
- 사용자 요청을 **경청**하고 **우선순위 매트릭스**에 반영

---

**문서 작성**: 2026-05-24  
**상태**: DRAFT  
**다음 검토**: 2026년 6월 중순
