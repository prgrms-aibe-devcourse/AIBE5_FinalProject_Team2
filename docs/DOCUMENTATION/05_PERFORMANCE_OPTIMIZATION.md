# ⚡ Your Personal Quant Manager - 성능 개선 가이드

**작성일**: 2026년 5월 24일  
**목표**: API 응답 < 200ms, 서버 처리량 1,000+ QPS  
**버전**: 1.0

---

## 📑 목차

1. [성능 측정 및 목표](#성능-측정-및-목표)
2. [백엔드 최적화](#백엔드-최적화)
3. [데이터베이스 최적화](#데이터베이스-최적화)
4. [프론트엔드 최적화](#프론트엔드-최적화)
5. [분석 엔진 최적화](#분석-엔진-최적화)
6. [인프라 확장](#인프라-확장)
7. [모니터링 및 경보](#모니터링-및-경보)

---

## 성능 측정 및 목표

### 현재 성과 (Baseline)

| 메트릭                  | 현재      | 목표     | 우선도  |
| ----------------------- | --------- | -------- | ------- |
| **API 응답 시간 (p95)** | 450ms     | < 200ms  | 🔴 높음 |
| **백테스트 속도**       | 2분 (5년) | < 30초   | 🔴 높음 |
| **동시 사용자**         | 100명     | 1,000명+ | 🟠 중간 |
| **일일 백테스트**       | 500건     | 5,000건+ | 🟠 중간 |
| **페이지 로딩**         | 3.2초     | < 1.5초  | 🟡 낮음 |
| **데이터 신선도**       | 30분      | < 15분   | 🟡 낮음 |

### 성능 목표 달성 계획

```
┌──────────────────────────────────────────┐
│  6월: 기본 최적화 (제거 + 캐싱)         │
│  └─ API 응답: 450ms → 250ms             │
│                                          │
│  7월: 데이터베이스 최적화 (인덱싱)      │
│  └─ API 응답: 250ms → 150ms             │
│                                          │
│  8월: 분산 처리 (큐, 비동기)            │
│  └─ 백테스트: 2분 → 30초                │
│                                          │
│  9월: 인프라 확장 (수평 확장)           │
│  └─ 동시 사용자: 100 → 1,000+          │
└──────────────────────────────────────────┘
```

---

## 백엔드 최적화

### 1️⃣ 불필요한 데이터 조회 제거 (N+1 문제)

#### 문제 상황

```java
// ❌ 나쁜 코드
@Service
public class StrategyService {
    public List<StrategyDTO> getMyStrategies(Long userId) {
        List<Strategy> strategies = strategyRepository.findByUserId(userId);

        List<StrategyDTO> dtos = new ArrayList<>();
        for (Strategy strategy : strategies) {
            // 🔴 반복되는 쿼리!
            List<Rule> rules = ruleRepository.findByStrategyId(strategy.getId());
            Strategy details = strategyRepository.findByIdWithDetails(strategy.getId());
            dtos.add(toDTO(strategy, rules, details));
        }
        return dtos;
    }
}

// 결과:
// 사용자가 10개 전략을 가지면:
// 1 + 10 + 10 = 21개 쿼리! ❌
```

#### 해결책 1: JOIN FETCH (즉시 로딩)

```java
@Repository
public interface StrategyRepository extends JpaRepository<Strategy, Long> {

    @Query("SELECT DISTINCT s FROM Strategy s " +
           "LEFT JOIN FETCH s.rules " +
           "LEFT JOIN FETCH s.performance " +
           "WHERE s.userId = ?1")
    List<Strategy> findByUserIdWithDetails(Long userId);
}

// 쿼리 수: 21 → 1 ✅
// 응답 시간: 500ms → 50ms ✅
```

#### 해결책 2: Projection (필요한 필드만)

```java
public interface StrategyProjection {
    Long getId();
    String getName();
    Double getTrustScore();
}

@Query("SELECT new com.example.StrategyDTO(s.id, s.name, s.trustScore) " +
       "FROM Strategy s WHERE s.userId = ?1")
List<StrategyDTO> findByUserIdOptimized(Long userId);

// 응답 시간: 50ms → 15ms ✅
```

#### 해결책 3: 배치 로딩

```java
@Entity
@Table(name = "strategies")
public class Strategy {

    @ManyToOne(fetch = FetchType.LAZY)
    @BatchSize(size = 20) // 20개씩 배치로 로드
    private User user;

    @OneToMany(fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    private List<Rule> rules;
}
```

---

### 2️⃣ 캐싱 전략 (Cache Layers)

#### 다층 캐싱 아키텍처

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│  L1: 브라우저 캐시           │
│  - 정적 자산 (CSS, JS, 이미지) │
│  - TTL: 7일                  │
└──────┬──────────────────────┘
       │ (캐시 미스)
┌──────▼──────────────────────┐
│  L2: CDN (Content Delivery)  │
│  - 프론트엔드 빌드 파일       │
│  - TTL: 1시간               │
└──────┬──────────────────────┘
       │
┌──────▼──────────────────────┐
│  L3: 애플리케이션 메모리     │
│  - @Cacheable(value="...")   │
│  - TTL: 5분                 │
└──────┬──────────────────────┘
       │
┌──────▼──────────────────────┐
│  L4: Redis (분산 캐시)       │
│  - 전략, 사용자 정보         │
│  - TTL: 30분                │
└──────┬──────────────────────┘
       │
┌──────▼──────────────────────┐
│  L5: 데이터베이스            │
│  - MySQL                     │
└──────────────────────────────┘
```

#### 구현 예시

```java
@Service
@EnableCaching
public class StrategyService {

    // 1️⃣ 메서드 레벨 캐싱
    @Cacheable(value = "strategies", key = "#strategyId")
    public StrategyDTO getStrategy(Long strategyId) {
        // 처음 호출 시만 DB 조회, 이후는 캐시에서
        return strategyRepository.findById(strategyId);
    }

    // 2️⃣ 캐시 갱신
    @CachePut(value = "strategies", key = "#result.id")
    public StrategyDTO updateStrategy(UpdateRequest req) {
        Strategy strategy = strategyRepository.findById(req.getId());
        // 수정 로직
        return strategy;
    }

    // 3️⃣ 캐시 제거
    @CacheEvict(value = "strategies", key = "#strategyId")
    public void deleteStrategy(Long strategyId) {
        strategyRepository.deleteById(strategyId);
    }
}
```

#### Redis 설정

```yaml
# application.yml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 1800000 # 30분

  redis:
    host: localhost
    port: 6379
    timeout: 2000
    lettuce:
      pool:
        max-active: 8
        max-idle: 8
        min-idle: 0
```

---

### 3️⃣ 데이터베이스 쿼리 최적화

#### 쿼리 분석 도구

```sql
-- 느린 쿼리 확인
SHOW VARIABLES LIKE 'slow_query%';
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5; -- 0.5초 이상

-- 이후 로그 분석
mysqldumpslow /var/log/mysql/slow.log
```

#### 인덱스 추가

```sql
-- ❌ 느린 쿼리
SELECT * FROM strategies
WHERE user_id = 1 AND status = 'ACTIVE'
ORDER BY created_at DESC;

-- 해결: 복합 인덱스 추가
CREATE INDEX idx_user_status_date
ON strategies(user_id, status, created_at DESC);

-- 성능 개선: 500ms → 10ms ✅
```

#### EXPLAIN 분석

```sql
-- 쿼리 실행 계획 확인
EXPLAIN SELECT * FROM strategies WHERE user_id = 1;

결과:
+----+-------------+-----------+------+---------------+------+---------+
| id | select_type | table     | type | key           | rows | Extra   |
+----+-------------+-----------+------+---------------+------+---------+
| 1  | SIMPLE      | strategies| ref  | idx_user_id   | 5    | NULL    |
+----+-------------+-----------+------+---------------+------+---------+

✅ type = ref (좋음, 인덱스 사용 중)
❌ type = ALL (나쁨, 전체 스캔)
```

---

### 4️⃣ 비동기 처리 (Async/CompletableFuture)

#### 문제: 느린 작업이 전체를 블로킹

```java
// ❌ 동기 처리 (느림)
@PostMapping("/strategies")
public ResponseEntity<?> createStrategy(@RequestBody CreateStrategyRequest req) {

    // 1️⃣ AI 분석 (2초)
    Strategy strategy = aiService.generateStrategy(req);

    // 2️⃣ 백테스트 (5초)
    BacktestResult result = analyticService.runBacktest(strategy);

    // 3️⃣ 신뢰도 계산 (1초)
    TrustScore score = trustScoreService.calculate(strategy, result);

    // 4️⃣ 저장 (0.5초)
    strategyRepository.save(strategy);

    // 총 8.5초 ❌
    return ResponseEntity.ok(strategy);
}
```

#### 해결책: 비동기 + 큐

```java
@Service
@Slf4j
public class StrategyService {

    @Autowired
    private Queue<StrategyTask> strategyQueue;

    // 1️⃣ 빠른 응답
    @PostMapping("/strategies")
    public ResponseEntity<?> createStrategy(CreateStrategyRequest req) {

        // 즉시 응답 (< 100ms)
        StrategyTask task = new StrategyTask(
            id = UUID.randomUUID(),
            request = req,
            status = "PROCESSING"
        );

        // 큐에 추가
        strategyQueue.add(task);
        strategyRepository.save(task.toStrategy()); // 초기 저장

        return ResponseEntity.accepted().body(
            new StrategyCreateResponse(task.id, "PROCESSING")
        );
    }

    // 2️⃣ 백그라운드 처리
    @Async
    public void processStrategy(StrategyTask task) {
        try {
            // AI 분석 (2초)
            Strategy strategy = aiService.generateStrategy(task.request);

            // 백테스트 (5초)
            BacktestResult result = analyticService.runBacktest(strategy);

            // 신뢰도 계산 (1초)
            TrustScore score = trustScoreService.calculate(strategy, result);

            // 완료 상태 저장
            strategy.setStatus("COMPLETED");
            strategyRepository.save(strategy);

            // 사용자에게 알림
            notificationService.notifyStrategyComplete(task.userId, strategy);

        } catch (Exception e) {
            log.error("Strategy processing failed", e);
            strategy.setStatus("FAILED");
            strategyRepository.save(strategy);
        }
    }
}

// 설정
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);      // 기본 스레드 수
        executor.setMaxPoolSize(20);       // 최대 스레드 수
        executor.setQueueCapacity(200);    // 대기 큐
        executor.setThreadNamePrefix("async-strategy-");
        executor.initialize();
        return executor;
    }
}

// 결과:
// 사용자 응답: 0.1초 ✅
// 백그라운드 처리: 병렬 진행
```

---

### 5️⃣ 배치 처리 (Spring Batch)

#### 사용 사례: 일일 포트폴리오 업데이트

```java
@Configuration
@EnableBatchProcessing
public class BatchConfig {

    // 1️⃣ Reader: 모든 활성 전략 읽기
    @Bean
    public ItemReader<Strategy> strategyReader() {
        return new RepositoryItemReader<Strategy>() {{
            setRepository(strategyRepository);
            setMethodName("findByStatus");
            setArguments(Arrays.asList("ACTIVE"));
            setPageSize(100); // 배치 크기
            setSort(Collections.singletonMap("id", Sort.Direction.ASC));
        }};
    }

    // 2️⃣ Processor: 백테스트 및 신뢰도 계산
    @Bean
    public ItemProcessor<Strategy, StrategyUpdate> strategyProcessor() {
        return strategy -> {
            BacktestResult result = analyticService.runBacktest(strategy);
            TrustScore score = trustScoreService.calculate(strategy, result);

            return new StrategyUpdate(
                strategy.getId(),
                result.getMetrics(),
                score.getScore()
            );
        };
    }

    // 3️⃣ Writer: 결과 저장
    @Bean
    public ItemWriter<StrategyUpdate> strategyWriter() {
        return updates -> {
            for (StrategyUpdate update : updates) {
                strategyRepository.updateMetrics(
                    update.strategyId,
                    update.metrics,
                    update.trustScore
                );
            }
        };
    }

    // 4️⃣ Job 정의
    @Bean
    public Job dailyStrategyUpdateJob(
            JobBuilderFactory jobBuilder,
            StepBuilderFactory stepBuilder) {

        return jobBuilder.get("dailyStrategyUpdate")
            .start(
                stepBuilder.get("updateStrategies")
                    .<Strategy, StrategyUpdate>chunk(100)
                    .reader(strategyReader())
                    .processor(strategyProcessor())
                    .writer(strategyWriter())
                    .build()
            )
            .build();
    }
}

// 스케줄러
@Component
@Slf4j
public class StrategyBatchScheduler {

    @Scheduled(cron = "0 2 * * *") // 매일 새벽 2시
    public void runDailyUpdate() {
        log.info("Starting daily strategy update job");
        jobLauncher.run(dailyStrategyUpdateJob, new JobParameters());
    }
}
```

---

## 데이터베이스 최적화

### 1️⃣ 인덱싱 전략

#### 자주 사용되는 쿼리 인덱스

```sql
-- User 관련
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_type ON users(user_type);

-- Strategy 관련
CREATE INDEX idx_strategy_user ON strategies(user_id);
CREATE INDEX idx_strategy_status_date ON strategies(status, created_at DESC);
CREATE INDEX idx_strategy_trust_score ON strategies(trust_score DESC);

-- Backtest 관련
CREATE INDEX idx_backtest_strategy ON backtests(strategy_id);
CREATE INDEX idx_backtest_status ON backtests(status);
CREATE INDEX idx_backtest_date ON backtests(completed_at DESC);

-- Trade 관련
CREATE INDEX idx_trade_strategy ON trades(strategy_id);
CREATE INDEX idx_trade_date ON trades(trade_date DESC);
```

#### 인덱스 모니터링

```sql
-- 사용되지 않는 인덱스 찾기
SELECT * FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA != 'mysql'
AND COUNT_READ = 0
ORDER BY COUNT_WRITE DESC;

-- 인덱스 크기 확인
SELECT
    object_schema,
    object_name,
    index_name,
    ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE stat_name = 'COUNT_READ'
ORDER BY stat_value DESC;
```

---

### 2️⃣ 쿼리 최적화

#### GROUP BY 최적화

```sql
-- ❌ 느린 쿼리 (전체 테이블 스캔)
SELECT user_id, COUNT(*) as trade_count
FROM trades
GROUP BY user_id;

-- ✅ 최적화 (인덱스 활용)
CREATE INDEX idx_trade_user ON trades(user_id);

SELECT user_id, COUNT(*) as trade_count
FROM trades
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY user_id;
```

#### LIMIT 최적화

```sql
-- ❌ 느린 쿼리 (큰 offset)
SELECT * FROM strategies
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 1000, 10; -- 1000개 스킵 후 10개 (1010개 조회)

-- ✅ 최적화 (책갈피 방식)
SELECT * FROM strategies
WHERE user_id = 1
AND created_at < ?last_timestamp
ORDER BY created_at DESC
LIMIT 10;
```

---

### 3️⃣ 분할 (Partitioning)

#### 시간 기반 분할

```sql
-- 큰 trades 테이블을 월별로 분할
ALTER TABLE trades
PARTITION BY RANGE (YEAR(created_at)*100 + MONTH(created_at)) (
    PARTITION p202601 VALUES LESS THAN (202602),
    PARTITION p202602 VALUES LESS THAN (202603),
    PARTITION p202603 VALUES LESS THAN (202604),
    PARTITION p202604 VALUES LESS THAN (202605),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- 효과:
// 2026년 5월 거래만 조회할 때
// 기존: 100GB 테이블 전체 스캔
// 분할 후: 1GB 파티션만 스캔 (100배 빠름!)
```

---

## 프론트엔드 최적화

### 1️⃣ 번들 크기 최소화

#### Code Splitting

```javascript
// 라우터 기반 분할
import { lazy } from "react";

const StrategyList = lazy(() => import("./pages/StrategyList"));
const StrategyDetail = lazy(() => import("./pages/StrategyDetail"));
const Portfolio = lazy(() => import("./pages/Portfolio"));

// 각 페이지는 필요할 때만 로드됨
// 초기 번들: 500KB (전체 2MB에서 1.5MB 감소)
```

#### 라이브러리 최적화

```javascript
// ❌ 전체 라이브러리 가져오기
import _ from "lodash";
const unique = _.uniq([1, 1, 2, 3]);

// ✅ 필요한 부분만
import { uniq } from "lodash-es";
const unique = uniq([1, 1, 2, 3]);

// 또는
import uniq from "lodash/uniq";
const unique = uniq([1, 1, 2, 3]);
```

### 2️⃣ 이미지 최적화

```javascript
// ✅ WebP + Fallback
<picture>
  <source srcSet="chart.webp" type="image/webp" />
  <img src="chart.png" alt="차트" />
</picture>;

// ✅ 동적 로딩
import { lazy } from "react";
const LargeChart = lazy(() => import("./LargeChart"));

// ✅ 이미지 크기 명시
<img src="avatar.jpg" alt="사진" width={100} height={100} />;
```

### 3️⃣ API 요청 최적화

```javascript
// ❌ 여러 요청
const user = await api.get("/api/users/me");
const strategies = await api.get("/api/strategies/me");
const portfolio = await api.get("/api/portfolio");

// ✅ 병렬 요청
const [user, strategies, portfolio] = await Promise.all([
  api.get("/api/users/me"),
  api.get("/api/strategies/me"),
  api.get("/api/portfolio"),
]);

// ✅ GraphQL 사용 (선택적)
const data = await gql`
  query {
    user {
      id
      email
    }
    strategies {
      id
      name
    }
    portfolio {
      value
    }
  }
`;
```

---

## 분석 엔진 최적화

### 1️⃣ 백테스트 병렬화

#### 현재: 순차 처리 (5년 = 2분)

```python
# analytics/app/backtest/backtest_engine.py

def run_backtest(strategy, data):
    """순차 처리 (느림)"""

    equity = []
    for i, date in enumerate(data.index):
        # 매 캔들마다 신호 계산 (느림)
        signal = calculate_signal(strategy, data[:i+1])
        position = execute_signal(signal)
        equity.append(position.value)

    return equity
```

#### 개선: VectorBT 사용 (벡터화)

```python
import vectorbt as vbt

def run_backtest_fast(strategy, data):
    """벡터화 처리 (빠름 - 10배)"""

    # 전체 데이터를 한 번에 처리
    prices = data['close'].values

    # VectorBT 계산 (NumPy 백엔드, 매우 빠름)
    portfolio = vbt.Portfolio.from_signals(
        prices=prices,
        entries=calculate_entries_vectorized(strategy, data),  # 벡터 연산
        exits=calculate_exits_vectorized(strategy, data),
        fees=0.1,
        freq='1D'
    )

    return portfolio

# 성능: 2분 → 12초 ✅
```

### 2️⃣ 데이터 캐싱

```python
from functools import lru_cache
import pandas as pd

@lru_cache(maxsize=128)
def get_historical_data(symbol, start_date, end_date):
    """
    주식 데이터 캐싱
    같은 데이터 조회 시 메모리에서 즉시 반환
    """
    return fetch_from_api(symbol, start_date, end_date)

# 사용
data = get_historical_data('AAPL', '2020-01-01', '2026-05-24')
# 첫 호출: API 조회 (1초)
# 두 번째 호출: 캐시 (1ms) - 1000배 빠름!
```

### 3️⃣ 비동기 분석

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

class AsyncBacktestEngine:
    def __init__(self, max_workers=4):
        self.executor = ProcessPoolExecutor(max_workers=max_workers)

    async def run_multiple_backtests(self, strategies, data):
        """여러 전략을 동시에 분석"""

        tasks = [
            asyncio.create_task(
                asyncio.to_thread(
                    self.run_backtest,
                    strategy,
                    data
                )
            )
            for strategy in strategies
        ]

        results = await asyncio.gather(*tasks)
        return results

# 사용
engine = AsyncBacktestEngine(max_workers=4)
results = asyncio.run(
    engine.run_multiple_backtests(strategies, data)
)

# 성능: 1전략 30초 × 4 = 120초
# 동시 처리: 4 전략 병렬 = 30초 ✅ (4배 빠름)
```

---

## 인프라 확장

### 1️⃣ 수평 확장 (Load Balancing)

```
                ┌─────────────────┐
                │    사용자        │
                └────────┬─────────┘
                         │
                ┌────────▼────────┐
                │  로드 밸런서    │
                │   Nginx         │
                └────────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     ┌──▼──┐         ┌──▼──┐         ┌──▼──┐
     │App1 │         │App2 │         │App3 │
     │:8080│         │:8081│         │:8082│
     └─────┘         └─────┘         └─────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼────┐
                    │MySQL    │
                    │(Primary) │
                    └─────────┘
```

#### Nginx 설정

```nginx
upstream backend {
    server app1:8080 weight=3;
    server app2:8081 weight=2;
    server app3:8082 weight=1;

    # 헬스 체크
    server app1:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2️⃣ 데이터베이스 복제 (Read Replicas)

```
                ┌─────────────┐
                │ 애플리케이션│
                └────┬────────┘
                     │
        ┌────────────┼─────────────┐
        │ 쓰기       │ 읽기        │
        ▼            ▼             ▼
    ┌─────────┐ ┌────────┐   ┌────────┐
    │ Primary │ │Replica1│   │Replica2│
    │(Master) │ │        │   │        │
    └─────────┘ └────────┘   └────────┘
        │           │            │
        └───────────┴────────────┘
         복제 (MySQL Replication)
```

#### Spring Boot 설정

```yaml
# 마스터 (쓰기)
spring:
  datasource:
    primary:
      url: jdbc:mysql://primary.example.com:3306/db
      username: root
      password: password
      hikari:
        maximum-pool-size: 10

    # 레플리카 (읽기)
    replica:
      url: jdbc:mysql://replica1.example.com:3306/db
      username: root
      password: password
      hikari:
        maximum-pool-size: 20
        read-only: true
```

#### 라우팅 로직

```java
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource dataSource() {
        DataSource primary = createPrimaryDataSource();
        DataSource replica = createReplicaDataSource();

        return new RoutingDataSource(primary, replica);
    }
}

@Component
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        // 트랜잭션이 읽기만 하면 레플리카 사용
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            return "replica";
        }
        return "primary";
    }
}
```

---

## 모니터링 및 경보

### 1️⃣ 성능 모니터링

#### Spring Boot Actuator + Micrometer

```yaml
management:
  endpoints:
    web:
      exposure:
        include: metrics,health,env,loggers
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
      slo:
        http.server.requests: 50ms,100ms,200ms,500ms,1s
```

#### 메트릭 확인

```
GET /actuator/metrics/http.server.requests

응답:
{
  "name": "http.server.requests",
  "measurements": [
    {
      "statistic": "COUNT",
      "value": 1234
    },
    {
      "statistic": "TOTAL_TIME",
      "value": 123456
    },
    {
      "statistic": "MAX",
      "value": 1234  // p95: 200ms ✅
    }
  ]
}
```

### 2️⃣ 로그 분석

```bash
# 느린 쿼리 찾기
grep "Executed in" backend/logs/app.log | \
  awk '{print $NF}' | \
  sort -rn | \
  head -10

# 에러 추적
grep "ERROR" backend/logs/app.log | \
  grep -o "StrategyService" | \
  sort | uniq -c | sort -rn
```

### 3️⃣ 알람 설정

```yaml
# Prometheus 알람 규칙
groups:
  - name: performance
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.2
        for: 5m
        annotations:
          summary: "API 응답 시간이 200ms 초과"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        annotations:
          summary: "에러율이 5% 초과"
```

---

## 체크리스트

### 6월 (Phase 1-2)

- [ ] N+1 쿼리 제거 (JOIN FETCH, Projection)
- [ ] Redis 캐싱 도입
- [ ] 인덱스 추가 (자주 사용되는 쿼리)
- [ ] API 응답: 450ms → 200ms
- [ ] 테스트: 부하 테스트 10k QPS 목표

### 7월

- [ ] 데이터베이스 레플리카 추가
- [ ] 비동기 처리 (백테스트 큐화)
- [ ] 백테스트: 2분 → 30초
- [ ] 모니터링: Prometheus + Grafana

### 8월~9월

- [ ] 수평 확장 (3개 인스턴스)
- [ ] CDN 도입
- [ ] API: < 150ms (p95)
- [ ] 동시 사용자: 1,000명+

---

**문서 작성**: 2026-05-24  
**상태**: DRAFT  
**다음 리뷰**: 2026년 6월 1일
