# 프로젝트 컴포넌트 상세 분석

> **작성일**: 2026년 5월 26일  
> **대상**: 아키텍처 리뷰, 성능 최적화, 확장 계획  
> **범위**: 각 모듈의 상세 구현 및 상호작용

---

## 목차

1. [프론트엔드 컴포넌트](#1-프론트엔드-컴포넌트)
2. [백엔드 서비스](#2-백엔드-서비스)
3. [Analytics 엔진](#3-analytics-엔진)
4. [데이터 흐름 상세](#4-데이터-흐름-상세)
5. [성능 최적화](#5-성능-최적화)
6. [보안 고려사항](#6-보안-고려사항)
7. [확장 가능성](#7-확장-가능성)

---

## 1. 프론트엔드 컴포넌트

### 1.1 페이지 계층 구조

```
홈 (Home.jsx / LandingPage.jsx)
├── 비인증
│   ├── Login.jsx (이메일/비밀번호)
│   ├── Signup.jsx (회원가입)
│   ├── FindPassword.jsx (비밀번호 찾기)
│   └── OAuthKakaoCallback.jsx (소셜 로그인)
│
└── 인증 후
    ├── Partner 경로
    │   ├── Partner_Home.jsx
    │   ├── PartnerProfile.jsx (프로필 수정)
    │   ├── PartnerProfileView.jsx (공개 프로필)
    │   ├── Partner_Portfolio.jsx (포트폴리오)
    │   ├── PartnerSearch.jsx (파트너 검색)
    │   └── PartnerDashboard.jsx (통계)
    │
    ├── Client 경로
    │   ├── Client_Home.jsx
    │   ├── ClientProfile.jsx (프로필 수정)
    │   ├── ClientProfileView.jsx (공개 프로필)
    │   ├── Client_Portfolio.jsx
    │   ├── ClientSearch.jsx (클라이언트 검색)
    │   ├── ProjectRegister.jsx (프로젝트 생성)
    │   ├── ProjectSearch.jsx (프로젝트 검색)
    │   └── ClientDashboard.jsx
    │
    ├── 분석 경로
    │   ├── AnalyticsLab.jsx (백테스트)
    │   ├── StrategyWorkspace.jsx (전략 빌더)
    │   └── AlphaGuide.jsx (가이드)
    │
    ├── 매칭 경로
    │   ├── ProjectRegister.jsx
    │   ├── PartnerSearch.jsx
    │   └── ProjectSearch.jsx
    │
    ├── 부가 기능
    │   ├── PortfolioDetailEditor.jsx (포트폴리오 편집)
    │   ├── PortfolioProjectPreview.jsx (프로젝트 미리보기)
    │   ├── StreamChatPage.jsx (실시간 채팅)
    │   ├── NotificationsPage.jsx (알림)
    │   ├── BrokerSettings.jsx (거래소 설정)
    │   ├── SubscriptionManage.jsx (구독)
    │   └── Mypage.jsx (개인정보)
    │
    └── AI 기능
        ├── ChatBot.jsx (일반 챗봇)
        ├── AIchatPortfolio.jsx (포트폴리오 분석)
        ├── AIchatProfile.jsx (프로필 분석)
        └── AIchatProject.jsx (프로젝트 분석)
```

### 1.2 컴포넌트별 기능 분석

#### Partner_Portfolio.jsx

**책임**: 파트너 포트폴리오 표시 및 관리

```jsx
// 주요 기능
export const Partner_Portfolio = () => {
  const [portfolios, setPortfolios] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState({});

  useEffect(() => {
    // 1. 사용자의 포트폴리오 목록 로드
    fetchPortfolios(userId).then(setPortfolios);

    // 2. 각 포트폴리오의 성과 지표 로드
    portfolios.forEach((p) => {
      fetchMetrics(p.id).then((metrics) => {
        setSelectedMetrics((prev) => ({
          ...prev,
          [p.id]: metrics,
        }));
      });
    });
  }, []);

  return <PortfolioGrid portfolios={portfolios} metrics={selectedMetrics} />;
};
```

**API 호출**:

- `GET /api/portfolios` → 사용자 포트폴리오 목록
- `GET /api/portfolios/{id}/metrics` → 성과 지표
- `PUT /api/portfolios/{id}` → 수정

#### AnalyticsLab.jsx

**책임**: 전략 백테스트 및 파라미터 최적화

```jsx
export const AnalyticsLab = () => {
  const [strategy, setStrategy] = useState("sma_cross");
  const [params, setParams] = useState({
    sma_fast: 20,
    sma_slow: 60,
  });
  const [results, setResults] = useState(null);

  const handleBacktest = async () => {
    // Analytics 엔진 호출
    const response = await post("/api/analytics/backtest", {
      ticker: "TQQQ",
      strategy,
      params,
      period: "3y",
    });
    setResults(response.data);
  };

  return (
    <div>
      <BacktestForm strategy={strategy} params={params} />
      <button onClick={handleBacktest}>Backtest</button>
      {results && <ResultsChart results={results} />}
    </div>
  );
};
```

**API 호출**:

- `POST /api/analytics/backtest` → 백테스트 실행
- `GET /api/analytics/strategies` → 전략 목록

#### ChatBot.jsx

**책임**: AI 기반 일반 질의응답

```jsx
export const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    // 사용자 메시지 추가
    setMessages((prev) => [...prev, { role: "user", content: input }]);

    // AI 응답 요청
    const response = await post("/api/ai/chat", {
      message: input,
      context: "general",
    });

    // AI 메시지 추가
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: response.data.reply },
    ]);
    setInput("");
  };

  return <ChatWindow messages={messages} onSend={handleSend} />;
};
```

**특징**:

- 실시간 스트리밍 응답
- 이전 대화 맥락 고려
- 포트폴리오, 프로젝트 컨텍스트 활용 가능

### 1.3 상태 관리 (Zustand)

```javascript
// src/store/authStore.js
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  login: (userData) => set({ user: userData, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// src/store/portfolioStore.js
export const usePortfolioStore = create((set) => ({
  portfolios: [],
  selectedPortfolio: null,

  setPortfolios: (portfolios) => set({ portfolios }),
  selectPortfolio: (id) => set({ selectedPortfolio: id }),
}));
```

### 1.4 API 클라이언트 구조

```javascript
// src/api/index.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// 요청 인터셉터 (토큰 자동 추가)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 (에러 처리)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 → 로그인 페이지로 이동
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// src/api/portfolio.js
export const getPortfolios = () => api.get("/portfolios");
export const getMetrics = (id) => api.get(`/portfolios/${id}/metrics`);
export const updatePortfolio = (id, data) => api.put(`/portfolios/${id}`, data);
```

---

## 2. 백엔드 서비스

### 2.1 도메인 계층 (Entity)

```java
// User (로그인 사용자)
@Entity
public class User {
    @Id private Long id;
    @Column(unique = true) private String email;
    private String username;
    private String password; // BCrypt 해시
    private UserType userType; // PARTNER, CLIENT
    private String bankName;
    private String bankAccountNumber;
    private Boolean bankVerified; // 1원 인증 완료 여부

    // 1:1 관계
    @OneToOne(mappedBy = "user") PartnerProfile partnerProfile;
    @OneToOne(mappedBy = "user") ClientProfile clientProfile;

    // 1:N 관계
    @OneToMany(mappedBy = "creator") List<Project> projects;
    @OneToMany(mappedBy = "user") List<Portfolio> portfolios;
}

// PartnerProfile (투자자 프로필)
@Entity
public class PartnerProfile {
    @Id private Long id;
    @OneToOne private User user;
    private String bio;
    private Double hourlyRate;
    @OneToOne(mappedBy = "partner") PartnerProfileStats stats;
}

// ClientProfile (의뢰자 프로필)
@Entity
public class ClientProfile {
    @Id private Long id;
    @OneToOne private User user;
    private String companyName;
    private String industry;
    private BigDecimal budget;
    @OneToOne(mappedBy = "client") ClientProfileStats stats;
}

// Portfolio (투자 포트폴리오)
@Entity
public class Portfolio {
    @Id private Long id;
    @ManyToOne private User owner;
    private String name;
    private String description;
    private Boolean isPublic;

    @OneToMany(mappedBy = "portfolio") List<PortfolioAsset> assets;
    @OneToOne(mappedBy = "portfolio") PortfolioStats stats;
}

// PortfolioAsset (포트폴리오 구성 자산)
@Entity
public class PortfolioAsset {
    @Id private Long id;
    @ManyToOne private Portfolio portfolio;
    private String ticker;
    private Double weight;
    private BigDecimal entryPrice;
    private Integer quantity;
}

// PortfolioStats (포트폴리오 통계 - 캐시)
@Entity
public class PortfolioStats {
    @Id private Long id;
    @OneToOne private Portfolio portfolio;
    private Double cagr;
    private Double sharpe;
    private Double sortino;
    private Double calmar;
    private Double maxDrawdown;
    private Double volatility;
    private Double alpha;
    private Double beta;
    private LocalDateTime lastUpdated;
}

// Project (매칭 프로젝트)
@Entity
public class Project {
    @Id private Long id;
    @ManyToOne private User creator; // 클라이언트
    private String title;
    private String description;
    private BigDecimal budget;
    private LocalDate deadline;
    private ProjectStatus status;

    @OneToMany(mappedBy = "project") List<ProjectSkill> requiredSkills;
    @OneToMany(mappedBy = "project") List<ProjectTag> tags;
}

// UserInterestPartner / UserInterestProject (관심 목록)
@Entity
public class UserInterestPartner {
    @Id private Long id;
    @ManyToOne private User user;
    @ManyToOne private PartnerProfile partner;
    private LocalDateTime createdAt;
}
```

### 2.2 서비스 계층 (비즈니스 로직)

```java
// PortfolioService
@Service
public class PortfolioService {

    @Autowired
    private PortfolioRepository portfolioRepository;
    @Autowired
    private AnalyticsService analyticsService;
    @Autowired
    private PortfolioStatsRepository statsRepository;

    // 포트폴리오 생성
    public Portfolio createPortfolio(CreatePortfolioRequest req, Long userId) {
        Portfolio p = new Portfolio();
        p.setName(req.getName());
        p.setOwner(userService.findById(userId));
        p.setAssets(new ArrayList<>());
        return portfolioRepository.save(p);
    }

    // 성과 지표 조회 (캐시 또는 실시간 계산)
    public PortfolioStatsDto getMetrics(Long portfolioId) {
        Portfolio p = portfolioRepository.findById(portfolioId).orElseThrow();

        // 캐시 확인 (30분 이내)
        PortfolioStats cached = statsRepository.findByPortfolioId(portfolioId);
        if (cached != null && cached.getLastUpdated().isAfter(LocalDateTime.now().minusMinutes(30))) {
            return toDto(cached);
        }

        // Analytics API 호출 (실시간 계산)
        PortfolioStatsDto metrics = analyticsService.computeMetrics(p);

        // 캐시 갱신
        PortfolioStats stats = new PortfolioStats();
        stats.setPortfolio(p);
        stats.setCagr(metrics.getCagr());
        stats.setSharpe(metrics.getSharpe());
        stats.setLastUpdated(LocalDateTime.now());
        statsRepository.save(stats);

        return metrics;
    }

    // 포트폴리오 수정
    public Portfolio updatePortfolio(Long portfolioId, UpdatePortfolioRequest req) {
        Portfolio p = portfolioRepository.findById(portfolioId).orElseThrow();
        p.setName(req.getName());
        p.setDescription(req.getDescription());
        return portfolioRepository.save(p);
    }
}

// AnalyticsService
@Service
public class AnalyticsService {

    @Autowired
    private RestTemplate restTemplate;

    private static final String ANALYTICS_URL = "http://localhost:8000";

    // Analytics 엔진 호출
    public BacktestResult runBacktest(BacktestRequest req) {
        HttpEntity<BacktestRequest> entity = new HttpEntity<>(req);
        ResponseEntity<BacktestResult> response = restTemplate.exchange(
            ANALYTICS_URL + "/backtest",
            HttpMethod.POST,
            entity,
            BacktestResult.class
        );
        return response.getBody();
    }

    // 포트폴리오 성과 계산
    public PortfolioStatsDto computeMetrics(Portfolio portfolio) {
        List<String> tickers = portfolio.getAssets().stream()
            .map(PortfolioAsset::getTicker)
            .collect(Collectors.toList());

        ComputeMetricsRequest req = new ComputeMetricsRequest();
        req.setTickers(tickers);

        HttpEntity<ComputeMetricsRequest> entity = new HttpEntity<>(req);
        ResponseEntity<PortfolioStatsDto> response = restTemplate.exchange(
            ANALYTICS_URL + "/portfolio/metrics",
            HttpMethod.POST,
            entity,
            PortfolioStatsDto.class
        );
        return response.getBody();
    }

    // 신호 생성
    public List<SignalDto> generateSignals(List<String> tickers) {
        HttpEntity<?> entity = new HttpEntity<>(new HttpHeaders());
        ResponseEntity<List<SignalDto>> response = restTemplate.exchange(
            ANALYTICS_URL + "/signals/today?tickers=" + String.join(",", tickers),
            HttpMethod.GET,
            entity,
            new ParameterizedTypeReference<List<SignalDto>>() {}
        );
        return response.getBody();
    }
}

// MatchingService
@Service
public class MatchingService {

    @Autowired
    private PartnerProfileRepository partnerRepository;
    @Autowired
    private ProjectRepository projectRepository;

    // 프로젝트에 맞는 파트너 추천
    public List<PartnerMatchDto> findMatchingPartners(Long projectId) {
        Project project = projectRepository.findById(projectId).orElseThrow();
        Set<String> requiredSkills = project.getRequiredSkills().stream()
            .map(ProjectSkill::getSkill)
            .collect(Collectors.toSet());

        // SQL: 필요 스킬을 모두 보유한 파트너
        List<PartnerProfile> candidates = partnerRepository
            .findPartnersWithSkills(requiredSkills);

        // 점수 계산
        List<PartnerMatchDto> matches = candidates.stream()
            .map(partner -> {
                double score = calculateMatchScore(partner, project);
                return new PartnerMatchDto(partner, score);
            })
            .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
            .limit(10)
            .collect(Collectors.toList());

        return matches;
    }

    private double calculateMatchScore(PartnerProfile partner, Project project) {
        double score = 0.0;

        // 스킬 일치도 (40%)
        int matchedSkills = countMatchedSkills(partner, project);
        int totalSkills = project.getRequiredSkills().size();
        score += (matchedSkills / (double) totalSkills) * 40;

        // 경험 수준 (20%)
        score += partner.getStats().getCompletedProjects() > 10 ? 20 : 10;

        // 평점 (20%)
        score += partner.getStats().getAverageRating() / 5 * 20;

        // 성공률 (20%)
        score += partner.getStats().getSuccessRate() * 20;

        return score;
    }
}
```

### 2.3 컨트롤러 계층 (REST API)

```java
@RestController
@RequestMapping("/api")
public class PortfolioController {

    @Autowired
    private PortfolioService portfolioService;

    // 포트폴리오 목록
    @GetMapping("/portfolios")
    public ResponseEntity<List<PortfolioDto>> getPortfolios(@RequestUser Long userId) {
        List<Portfolio> portfolios = portfolioService.getByUserId(userId);
        return ResponseEntity.ok(portfolios.stream()
            .map(this::toDto)
            .collect(Collectors.toList()));
    }

    // 포트폴리오 생성
    @PostMapping("/portfolios")
    public ResponseEntity<PortfolioDto> createPortfolio(
        @RequestBody CreatePortfolioRequest req,
        @RequestUser Long userId
    ) {
        Portfolio portfolio = portfolioService.createPortfolio(req, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(portfolio));
    }

    // 포트폴리오 성과 지표
    @GetMapping("/portfolios/{id}/metrics")
    public ResponseEntity<PortfolioStatsDto> getMetrics(@PathVariable Long id) {
        PortfolioStatsDto stats = portfolioService.getMetrics(id);
        return ResponseEntity.ok(stats);
    }
}

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @Autowired
    private AnalyticsService analyticsService;

    // 백테스트
    @PostMapping("/backtest")
    public ResponseEntity<BacktestResult> backtest(@RequestBody BacktestRequest req) {
        BacktestResult result = analyticsService.runBacktest(req);
        return ResponseEntity.ok(result);
    }

    // 신호 생성
    @GetMapping("/signals/today")
    public ResponseEntity<List<SignalDto>> generateSignals(
        @RequestParam List<String> tickers
    ) {
        List<SignalDto> signals = analyticsService.generateSignals(tickers);
        return ResponseEntity.ok(signals);
    }
}

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;
    @Autowired
    private MatchingService matchingService;

    // 프로젝트 생성
    @PostMapping
    public ResponseEntity<ProjectDto> createProject(
        @RequestBody CreateProjectRequest req,
        @RequestUser Long userId
    ) {
        Project project = projectService.create(req, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(project));
    }

    // 파트너 추천
    @GetMapping("/{id}/matching")
    public ResponseEntity<List<PartnerMatchDto>> getMatchingPartners(
        @PathVariable Long id
    ) {
        List<PartnerMatchDto> matches = matchingService.findMatchingPartners(id);
        return ResponseEntity.ok(matches);
    }
}
```

### 2.4 보안 설정

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf().disable()
            .cors().and()
            .authorizeRequests()
                .antMatchers("/auth/**").permitAll()
                .antMatchers("/public/**").permitAll()
                .anyRequest().authenticated()
                .and()
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthFilter() {
        return new JwtAuthenticationFilter(jwtTokenProvider);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## 3. Analytics 엔진

### 3.1 백테스트 엔진 상세

```python
# analytics/app/backtest/vbt_engine.py

def run_backtest(
    close: pd.Series,
    params: BacktestParams,
    vix: Optional[pd.Series] = None,
) -> Dict:
    """
    VectorBT 기반 백테스트 엔진

    파라미터:
        close: 종가 시계열
        params: 백테스트 파라미터
        vix: VIX 시계열 (optional)

    반환값:
        {
            'total_return': float,
            'cagr_pct': float,
            'sharpe': float,
            'sortino': float,
            'calmar': float,
            'max_drawdown_pct': float,
            'volatility_pct': float,
            'win_rate_pct': float,
            'best_day_pct': float,
            'worst_day_pct': float,
            'trades': List[Dict],
        }
    """

    # 1. 신호 생성
    signals = _signals(close, params, vix)  # Boolean 시계열

    # 2. VectorBT Portfolio 생성
    pf = vbt.Portfolio.from_signals(
        close=close,
        entries=signals,  # 매수 신호
        exits=~signals,   # 매도 신호
        init_cash=params.initial_capital,
        fees=params.fees,
        freq='1D',
    )

    # 3. 성과 계산
    total_return_pct = pf.total_return() * 100
    trades_info = pf.trades.records

    # 4. 추가 메트릭 (QuantStats)
    returns = pf.returns()
    benchmark_returns = close.pct_change()
    metrics = compute_metrics(returns, benchmark=benchmark_returns)

    result = {
        'total_return_pct': total_return_pct,
        'trades_count': len(trades_info),
        'portfolio_value': float(pf.final_value()),
        'trades': [
            {
                'entry_date': trade.entry_date,
                'exit_date': trade.exit_date,
                'entry_price': trade.entry_price,
                'exit_price': trade.exit_price,
                'pnl_pct': (trade.exit_price - trade.entry_price) / trade.entry_price * 100,
            }
            for trade in trades_info
        ],
    }
    result.update(metrics)

    return result
```

### 3.2 국면 탐지 (HMM) 상세

```python
# analytics/strategy/helpers.py

class BayesianRegimeDetector:
    """
    히든 마르코프 모델 기반 국면 탐지

    상태:
        - bull_quiet: 상승장 + 저변동성 (이상적)
        - bull_volatile: 상승장 + 고변동성 (경고)
        - bear: 하락장
        - sideways: 횡보장
        - high_vol_unstable: 극단 변동성 (위험)
    """

    def __init__(self, n_states: int = 4):
        self.n_states = n_states
        self.model = GaussianHMM(n_components=n_states)

    def fit(self, returns: pd.Series):
        """HMM 학습"""
        X = returns.dropna().values.reshape(-1, 1)
        self.model.fit(X)
        return self

    def predict(self, returns: pd.Series) -> pd.Series:
        """국면 예측 (Viterbi 알고리즘)"""
        X = returns.dropna().values.reshape(-1, 1)
        states = self.model.predict(X)

        # 상태 레이블 할당
        labels = self._label_states(returns[returns.notna().values])
        regime = pd.Series(
            [labels[s] for s in states],
            index=returns[returns.notna()].index
        )
        return regime

    def _label_states(self, returns: pd.Series) -> Dict[int, str]:
        """상태별 레이블 할당 (평균, 변동성 기반)"""
        labels = {}
        means = self.model.means_.flatten()
        variances = self.model.covars_.flatten()

        # 우산의에 따라 정렬
        sorted_indices = np.argsort(means)[::-1]  # 내림차순

        for rank, idx in enumerate(sorted_indices):
            if rank == 0:
                labels[idx] = "bull_quiet" if variances[idx] < np.mean(variances) else "bull_volatile"
            elif rank == len(sorted_indices) - 1:
                labels[idx] = "bear"
            else:
                labels[idx] = "sideways"

        return labels
```

### 3.3 Kelly 포지션 사이징 상세

```python
# analytics/strategy/risk_control.py

class KellyPositionSizer:
    """
    Kelly Criterion 기반 포지션 결정

    켈리 공식: f* = (p*b - q) / b

    여기서:
        p: 승률 (이기는 거래 비율)
        b: 배율 (평균 이익 / 평균 손실)
        q: 패율 (1 - p)

    연속 케이스 (정규분포):
        f* = μ / σ²

    주의:
        - 과도한 레버리지로 인한 파산 위험
        - Fractional Kelly (f* × 0.25) 권장
        - Bootstrap 신뢰구간으로 범위 추정
    """

    def multi_asset_kelly(self, returns_df: pd.DataFrame) -> Dict[str, float]:
        """
        다중 자산 켈리 최적화

        포트폴리오 켈리:
            f* = Σ⁻¹ · μ (벡터 형태)

        공분산 행렬이 singular인 경우:
            - Ridge 정규화 적용: Σ' = Σ + λI
        """

        ret = returns_df.dropna()
        mu = ret.mean().values          # 기댓값
        cov = ret.cov().values          # 공분산
        n = len(mu)

        # Ridge 정규화 (λ = 0.01)
        cov_reg = cov + 0.01 * np.eye(n)

        # 최적 포지션: f* = Σ⁻¹ · μ
        try:
            f_star = np.linalg.solve(cov_reg, mu)
        except np.linalg.LinAlgError:
            return {t: 0.0 for t in returns_df.columns}

        # Fractional Kelly (보수적: 1/4)
        f_frac = np.clip(f_star * self.fraction, 0.0, self.max_weight)

        # 합계 정규화 (합 = 1)
        f_total = f_frac.sum()
        if f_total > 1.0:
            f_frac /= f_total

        return {t: round(float(w), 4) for t, w in zip(returns_df.columns, f_frac)}
```

---

## 4. 데이터 흐름 상세

### 4.1 포트폴리오 생성 → 평가 → 표시

```
사용자 (Frontend)
  ↓ "포트폴리오 생성" 클릭
Frontend: PortfolioForm 입력
  ↓ POST /api/portfolios
Backend: PortfolioController.createPortfolio()
  ├─ User 조회
  ├─ Portfolio 엔티티 생성
  ├─ Database 저장
  └─ DTO 반환
  ↓
Frontend: 포트폴리오 목록 갱신
  ↓
사용자가 포트폴리오 클릭 → "성과 지표 조회"
  ↓ GET /api/portfolios/{id}/metrics
Backend: PortfolioService.getMetrics()
  ├─ 캐시 확인 (30분 이내)
  │  ├─ Hit: 캐시된 데이터 반환
  │  └─ Miss: ↓
  ├─ AnalyticsService.computeMetrics() 호출
  │  └─ POST http://localhost:8000/metrics
  ├─ Analytics 엔진
  │  ├─ 각 자산 수익률 로드
  │  ├─ QuantStats 계산
  │  └─ 메트릭 반환: {cagr, sharpe, ...}
  ├─ Database 캐시 저장
  └─ Frontend 반환
  ↓
Frontend: MetricsPanel 렌더링
  └─ 성과 지표 시각화 (차트)
```

### 4.2 전략 백테스트 흐름

```
사용자 (Analytics Lab)
  ↓ 파라미터 입력 + Backtest 클릭
Frontend: BacktestForm
  └─ {strategy: "sma_cross", sma_fast: 20, sma_slow: 60, ...}
  ↓ POST /api/analytics/backtest
Backend: AnalyticsController.backtest()
  └─ RestTemplate.postForObject()
  ↓ POST http://localhost:8000/backtest
Analytics: app/main.py@app.post("/backtest")
  ├─ 파라미터 파싱
  ├─ 데이터 로드: market_db.get_price(ticker, period)
  ├─ VectorBT 엔진 실행
  │  ├─ 신호 생성
  │  ├─ 포트폴리오 구성
  │  └─ 성과 계산
  ├─ QuantStats 메트릭 계산
  │  └─ {cagr, sharpe, sortino, calmar, mdd, ...}
  ├─ 거래 기록 생성
  └─ JSON 반환
  ↓
Backend: ResponseEntity 받음 → Frontend 반환
  ↓
Frontend: 결과 시각화
  ├─ 누적 수익 곡선
  ├─ 거래 기록 테이블
  ├─ 성과 지표 대시보드
  └─ 리스크 분석
```

### 4.3 일일 신호 생성 (22:30 KST)

```
Spring Boot Scheduler
  ↓ @Scheduled(cron = "0 30 22 * * *")  // 매일 22:30
Backend: AnalyticsController.generateSignals()
  └─ AnalyticsService.generateSignals(tickers)
  ↓ GET http://localhost:8000/signals/today?tickers=TQQQ,SOXL,...
Analytics: app/main.py@app.post("/signals/today")
  ├─ 각 티커에 대해 루프:
  │  ├─ 가격 데이터 로드 (2년)
  │  ├─ 국면 탐지 (HMM)
  │  ├─ 기술적 신호 (Momentum)
  │  ├─ 신뢰도 평가
  │  ├─ VIX 승수 적용
  │  ├─ ML 예측 (XGBoost)
  │  ├─ SHAP 설명
  │  └─ SignalBundle 생성
  ├─ 포지션 결정 (Kelly + Risk Parity)
  └─ 신호 리스트 반환: [{ticker, signal, confidence, ...}, ...]
  ↓
Backend: 신호 데이터 저장
  └─ Database: signal_records 테이블 INSERT
  ↓
Frontend: Dashboard 갱신
  ├─ 오늘의 신호 표시
  ├─ 추천 포지션 가중치 제시
  └─ 위험 평가 표시
```

---

## 5. 성능 최적화

### 5.1 프론트엔드 최적화

```javascript
// 1. 코드 분할 (Code Splitting)
const AnalyticsLab = lazy(() => import("./pages/AnalyticsLab.jsx"));
const StrategyWorkspace = lazy(() => import("./pages/StrategyWorkspace.jsx"));

// 2. 캐싱 (API 응답)
const usePortfolioMetrics = (portfolioId) => {
  return useQuery(
    ["portfolioMetrics", portfolioId],
    () => fetchMetrics(portfolioId),
    {
      staleTime: 30 * 60 * 1000, // 30분 캐시
      cacheTime: 60 * 60 * 1000, // 1시간 메모리 유지
    },
  );
};

// 3. 메모이제이션
const MetricsChart = React.memo(({ data }) => {
  return <Chart data={data} />;
});

// 4. 가상 스크롤 (대량 데이터)
import { FixedSizeList } from "react-window";

const TradesList = ({ trades }) => (
  <FixedSizeList height={600} itemCount={trades.length} itemSize={50}>
    {({ index, style }) => <div style={style}>{trades[index].id}</div>}
  </FixedSizeList>
);
```

### 5.2 백엔드 최적화

```java
// 1. 캐싱 (PortfolioStats)
@Cacheable(value = "portfolioStats", key = "#portfolioId",
           cacheManager = "cacheManager")
public PortfolioStatsDto getMetrics(Long portfolioId) {
    // 캐시 30분 유지
}

// 2. 배치 처리 (다중 포트폴리오)
public Map<Long, PortfolioStatsDto> getMetricsBatch(List<Long> portfolioIds) {
    // N+1 쿼리 문제 해결: JPA fetch join
    return portfolioRepository.findByIdsWithStats(portfolioIds).stream()
        .collect(Collectors.toMap(
            Portfolio::getId,
            this::computeStatsFromCache
        ));
}

// 3. 인덱싱 (Database)
@Entity
@Table(indexes = {
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_ticker_date", columnList = "ticker, date"),
})
public class OhlcvData {
    // ...
}

// 4. 페이징 (대량 조회)
@GetMapping("/portfolios")
public ResponseEntity<Page<PortfolioDto>> getPortfolios(
    @PageableDefault(size = 20) Pageable pageable,
    @RequestUser Long userId
) {
    Page<Portfolio> page = portfolioRepository.findByOwnerIdOrderByCreatedAtDesc(userId, pageable);
    return ResponseEntity.ok(page.map(this::toDto));
}
```

### 5.3 Analytics 최적화

```python
# 1. 병렬 처리 (다중 시각)
from concurrent.futures import ThreadPoolExecutor

def generate_signals_parallel(tickers: List[str]) -> List[SignalDto]:
    signals = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(generate_single_signal, ticker): ticker
            for ticker in tickers
        }
        for future in futures:
            signals.append(future.result())
    return signals

# 2. 벡터화 (NumPy)
# 느린 루프:
returns = []
for i in range(len(prices)):
    returns.append((prices[i] - prices[i-1]) / prices[i-1])

# 빠른 벡터화:
returns = np.diff(prices) / prices[:-1]

# 3. 캐싱 (Redis)
import redis

redis_client = redis.Redis(host='localhost', port=6379)

def get_price_cached(ticker: str, period: str) -> pd.DataFrame:
    cache_key = f"{ticker}:{period}"
    cached = redis_client.get(cache_key)
    if cached:
        return pd.read_json(cached)

    df = market_db.get_price(ticker, period)
    redis_client.setex(cache_key, 3600, df.to_json())  # 1시간 캐시
    return df

# 4. 데이터 로딩 최적화
# SQL 커서 스트리밍 (대용량)
def stream_ohlcv_data(ticker: str):
    for chunk in market_db.stream(ticker, chunksize=1000):
        yield chunk
```

---

## 6. 보안 고려사항

### 6.1 인증 & 인가

```python
# FastAPI 보안
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthCredential

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthCredential = Depends(security)):
    token = credentials.credentials
    user = decode_jwt(token)  # JWT 디코딩
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

@app.post("/backtest")
async def backtest(req: BacktestRequest, user: User = Depends(verify_token)):
    # 인증된 사용자만 실행
    return run_backtest_engine(req)
```

### 6.2 데이터 암호화

```python
# 민감한 데이터 암호화 (AES-256)
from cryptography.fernet import Fernet

cipher_suite = Fernet(encryption_key)

def encrypt_bank_account(account_number: str) -> str:
    return cipher_suite.encrypt(account_number.encode()).decode()

def decrypt_bank_account(encrypted: str) -> str:
    return cipher_suite.decrypt(encrypted.encode()).decode()
```

### 6.3 입력 검증

```java
// Spring Bean Validation
@Entity
public class Portfolio {
    @NotBlank(message = "이름은 필수입니다")
    @Length(min = 1, max = 100)
    private String name;

    @NotNull(message = "설명은 필수입니다")
    private String description;
}

@RestController
public class PortfolioController {
    @PostMapping("/portfolios")
    public ResponseEntity<PortfolioDto> create(
        @Valid @RequestBody CreatePortfolioRequest req
    ) {
        // 자동 검증
    }
}
```

### 6.4 SQL 인젝션 방지

```python
# ORM 사용 (SQL 주입 자동 방지)
from sqlalchemy import select

# 위험: 직접 쿼리
# query = f"SELECT * FROM portfolios WHERE owner_id = {user_id}"
# 안전: 파라미터화 쿼리
query = select(Portfolio).where(Portfolio.owner_id == user_id)
```

---

## 7. 확장 가능성

### 7.1 새로운 데이터 소스 추가

```python
# 1. 새로운 클라이언트 생성
class KrInvestingClient:
    """한국 투자 API 클라이언트"""

    def get_daily_bars(self, symbol: str, start: str, end: str) -> pd.DataFrame:
        response = requests.get(f"https://api.kinvesting.com/daily/{symbol}",
                               params={"start": start, "end": end})
        data = response.json()
        return pd.DataFrame(data)

# 2. 수집 스케줄러에 등록
def collect_kr_stocks():
    symbols = ["005930", "051910"]  # Samsung, LG Chem
    for sym in symbols:
        try:
            df = kr_client.get_daily_bars(sym, start_date, end_date)
            market_db.upsert_ohlcv(df, tf="1d")
        except Exception as e:
            log.warning("collect_kr_stocks %s error: %s", sym, e)

# 3. 스케줄러 태스크 추가
scheduler.add_job(collect_kr_stocks, "cron", hour=15, minute=0)  # 15:00 UTC
```

### 7.2 새로운 전략 추가

```python
# 1. 전략 클래스 생성
class MeanReversionStrategy(BaseStrategy):
    """평균회귀 전략"""

    def compute_signal(self, prices: pd.Series, params: StrategyParams) -> pd.Series:
        # Z-score 계산
        sma = prices.rolling(20).mean()
        std = prices.rolling(20).std()
        z_score = (prices - sma) / std

        # 신호: z < -2 (과매도) → 매수
        signal = (z_score < -2).astype(int)
        return signal

# 2. 엔드포인트에 등록
STRATEGY_REGISTRY = {
    "buy_and_hold": BuyAndHoldStrategy,
    "sma_cross": SMAStrategy,
    "mean_reversion": MeanReversionStrategy,  # 신규
}

# 3. Frontend에서 선택 가능
<select name="strategy">
    <option value="mean_reversion">Mean Reversion</option>
</select>
```

### 7.3 새로운 위험 지표 추가

```python
# 1. 계산 함수 추가
def compute_ulcer_index(returns: pd.Series, lookback: int = 252) -> float:
    """Ulcer Index - 지속된 낙폭 측정"""
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.rolling(window=lookback).max()
    drawdown = (cumulative - running_max) / running_max * 100
    ulcer_index = np.sqrt(np.mean(np.square(drawdown[drawdown < 0])))
    return ulcer_index

# 2. QuantStats 리포트에 추가
def compute_metrics(returns: pd.Series, benchmark: pd.Series | None = None) -> dict:
    out = {...}
    out["ulcer_index"] = _f(compute_ulcer_index(returns))
    return out

# 3. API 응답에 포함
@app.get("/portfolio/metrics")
def get_metrics(portfolio_id: int):
    metrics = compute_metrics(returns)
    # ulcer_index가 자동으로 포함됨
    return metrics
```

---

**마지막 수정**: 2026년 5월 26일  
**버전**: 1.0  
**담당**: Architecture Review Team
