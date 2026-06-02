# 금융 및 통계 용어 사전

> **작성일**: 2026년 5월 26일  
> **대상 프로젝트**: Alpha-Helix (포트폴리오 관리 + 백테스팅 + 매칭 플랫폼)  
> **범위**: 프론트엔드, 백엔드, Analytics 전체 시스템에서 사용되는 금융/통계 개념

---

## 목차

1. [성과 지표 (Performance Metrics)](#1-성과-지표-performance-metrics)
2. [위험 지표 (Risk Metrics)](#2-위험-지표-risk-metrics)
3. [기술적 분석 (Technical Analysis)](#3-기술적-분석-technical-analysis)
4. [자산배분 (Portfolio Allocation)](#4-자산배분-portfolio-allocation)
5. [고급 분석 기법 (Advanced Techniques)](#5-고급-분석-기법-advanced-techniques)
6. [투자 전략 (Investment Strategies)](#6-투자-전략-investment-strategies)
7. [데이터 소스 (Data Sources)](#7-데이터-소스-data-sources)
8. [분포 모델 (Distribution Models)](#8-분포-모델-distribution-models)
9. [시스템 개념 (System Concepts)](#9-시스템-개념-system-concepts)
10. [프론트엔드 금융 용어 (Frontend Finance Terms)](#10-프론트엔드-금융-용어-frontend-finance-terms)

---

## 1. 성과 지표 (Performance Metrics)

### 1.1 CAGR (Compound Annual Growth Rate) - 연환산 수익률

**정의**: 초기 투자액이 매년 복리로 성장할 때의 연평균 수익률

**공식**:
$$\text{CAGR} = \left(\frac{\text{최종값}}{\text{초기값}\right)^{\frac{1}{n}} - 1$$

여기서 $n$은 연수

**특징**:

- 투자 기간이 1년 이상인 경우 의미 있음
- 단기 변동성을 무시하고 평균 성장률만 표시
- 복리 효과를 고려한 객관적 수익률 지표

**사용 사례**:

- 포트폴리오 연간 성장률 평가
- 전략별 성과 비교
- 백테스트 결과 분석

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.2 Sharpe Ratio - 샤프 지수

**정의**: 단위 위험(변동성)당 추가 수익을 나타내는 위험조정 수익률 지표

**공식**:
$$\text{Sharpe Ratio} = \frac{\mu - r_f}{\sigma}$$

- $\mu$: 전략 수익률의 평균
- $r_f$: 무위험 이율 (보통 0으로 가정)
- $\sigma$: 수익률의 표준편차

**해석**:

- **> 1.0**: 우수한 전략 (우수함)
- **0.5 ~ 1.0**: 양호한 전략
- **< 0.5**: 개선 필요
- **음수**: 무위험 자산 이하의 성과

**특징**:

- 위험을 고려한 수익률 평가
- 서로 다른 변동성의 전략 비교에 유용
- 극단적 손실에 덜 민감 (분산 사용)

**코드 위치**: `analytics/app/metrics/quantstats_report.py`, `analytics/strategy/helpers.py`

---

### 1.3 Sortino Ratio - 소르티노 지수

**정의**: Sharpe Ratio의 개선 버전으로, 하방 편차(downside deviation)만 위험으로 간주

**공식**:
$$\text{Sortino Ratio} = \frac{\mu - r_f}{\sigma_d}$$

- $\sigma_d$: 하방 편차 (음수 수익률의 표준편차만 계산)

**특징**:

- 상향 변동성은 위험으로 보지 않음
- Sharpe Ratio보다 전략의 진정한 위험을 더 잘 반영
- 손실에 더 민감한 평가

**사용 사례**:

- 변동성 있는 전략 평가
- 손실 회피적 투자자 관점의 성과 평가

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.4 Calmar Ratio - 칼마 지수

**정의**: 최대 낙폭 대비 연환산 수익률의 비율

**공식**:
$$\text{Calmar Ratio} = \frac{\text{CAGR}}{|\text{Max Drawdown}|}$$

**특징**:

- 수익 효율성을 직접적으로 평가
- 역사적 최악의 손실과의 상관관계 반영
- 극단적 손실 기반 수익성 평가

**해석**:

- **> 0.5**: 우수한 전략
- **< 0.1**: 위험대비 수익이 낮음

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.5 Information Ratio - 정보비율

**정의**: 벤치마크 대비 초과 수익을 추적 오차로 나눈 값

**공식**:
$$\text{IR} = \frac{\mu_{\text{전략}} - \mu_{\text{벤치마크}}}{\sigma(\text{초과수익})}$$

**특징**:

- 벤치마크와의 상대 성과 평가
- 액티브 펀드 매니저의 능력 평가
- 양수: 벤치마크 초과 수익

**사용 사례**:

- SPY 대비 전략 성과 평가
- 액티브 관리의 부가가치 평가

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.6 Alpha (알파)

**정의**: 벤치마크 수익률을 초과한 초과 수익

**공식**:
$$R_{\text{포트폴리오}} = \alpha + \beta \cdot R_{\text{벤치마크}} + \epsilon$$

**해석**:

- **양수 Alpha**: 벤치마크를 초과하는 성과 (투자 능력 입증)
- **음수 Alpha**: 벤치마크 대비 미흡한 성과

**특징**:

- Jensen's Alpha로도 불림
- 리스크 팩터를 제거한 순수 성과 평가

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.7 Beta (베타)

**정의**: 벤치마크 수익률 변화에 대한 포트폴리오의 민감도

**공식**:
$$\beta = \frac{\text{Cov}(R_{\text{포트폴리오}}, R_{\text{벤치마크}})}{\text{Var}(R_{\text{벤치마크}})}$$

**해석**:

- **$\beta = 1$**: 벤치마크와 동일한 수익 변동
- **$\beta > 1$**: 벤치마크보다 변동성 큼 (공격적)
- **$\beta < 1$**: 벤치마크보다 변동성 작음 (방어적)
- **$\beta < 0$**: 벤치마크와 반대 움직임

**사용 사례**:

- TQQQ의 경우 QQQ 대비 $\beta \approx 3$ (3배 레버리지)
- 포트폴리오 시스템 리스크 평가

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 1.8 Win Rate - 승률

**정의**: 양수 수익을 기록한 거래/기간의 비율

**공식**:
$$\text{Win Rate} (\%) = \frac{\text{양수 수익 일수}}{\text{전체 거래 일수}} \times 100$$

**특징**:

- 거래 방향성의 정확도 표시
- 높은 승률이 항상 좋은 전략은 아님 (손실 규모도 고려)
- Profit Factor = 평균 이익 / 평균 손실로 보정 필요

**사용 사례**:

- 전략 기초 수익성 평가
- 거래 특성 파악

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

## 2. 위험 지표 (Risk Metrics)

### 2.1 Volatility (변동성) - σ

**정의**: 수익률의 표준편차 (얼마나 변동하는가)

**공식**:
$$\sigma = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(r_i - \bar{r})^2}$$

**특징**:

- 일일 변동성을 연환산: $\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$
- 높은 변동성 = 높은 위험
- 정규분포 가정 (극단값 과소평가 가능)

**사용 사례**:

- 포트폴리오 리스크 규모 파악
- VIX: S&P 500의 30일 변동성 예상치

**코드 위치**: `analytics/app/metrics/quantstats_report.py`, `analytics/strategy/main.py`

---

### 2.2 Max Drawdown (최대낙폭) - MDD

**정의**: 누적 수익 곡선에서 최고점으로부터 최저점까지의 하락률

**공식**:
$$\text{MDD} = \frac{\text{최저값} - \text{최고값}}{\text{최고값}}$$

**특징**:

- 역사적 최악의 손실 규모
- 항상 음수 또는 0
- 심리적 견딜 수 있는 한도를 나타냄

**사용 사례**:

- Calmar Ratio 계산에 사용
- 전략 수용 가능성 판단

**코드 위치**: `analytics/app/metrics/quantstats_report.py`, `analytics/strategy/helpers.py`

---

### 2.3 VaR (Value at Risk) - 위험가치

**정의**: 주어진 신뢰도에서 일정 기간 내 최대 손실 가능성

**공식**:
$$P(L > \text{VaR}_{\alpha}) = \alpha$$

예시: 99% 신뢰도에서 1일 VaR = -5%는 "99% 확률로 하루 손실이 5% 이하"

**특징**:

- 정규분포 가정 (극단값 과소추정)
- 극단 손실의 빈도는 알 수 없음
- Basel III 규제 지표로 사용

**사용 사례**:

- 포트폴리오 최악 시나리오 손실 평가
- 자본 배분

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 2.4 CVaR (Conditional VaR) / Expected Shortfall (ES)

**정의**: VaR를 초과한 손실의 기댓값 (조건부 기댓값)

**공식**:
$$\text{CVaR}_{\alpha} = E[L | L > \text{VaR}_{\alpha}]$$

예시: 99% CVaR = -7%는 "최악 1%의 경우 평균 -7% 손실"

**특징**:

- VaR보다 극단 손실 위험을 더 잘 반영
- 극단값에 더 민감
- 규제상 VaR보다 우월

**사용 사례**:

- 극단적 시장 변화 대비
- 리스크 제한 설정

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

### 2.5 Best Day / Worst Day

**정의**: 전체 기간 중 최고 수익률 날과 최저 수익률 날

**특징**:

- 전략의 극단값 표현
- 최고/최저 시나리오 파악
- 투자자 심리 영향도 측정

**사용 사례**:

- 전략 특성 파악
- 투자자 선호도 평가

**코드 위치**: `analytics/app/metrics/quantstats_report.py`

---

## 3. 기술적 분석 (Technical Analysis)

### 3.1 SMA (Simple Moving Average) - 단순이동평균

**정의**: 최근 N일 종가의 산술평균

**공식**:
$$\text{SMA}_n = \frac{1}{n}\sum_{i=0}^{n-1} P_i$$

**특징**:

- 모든 데이터에 동일한 가중치
- 느리지만 안정적
- 최근 데이터 민감도 낮음

**사용 사례**:

- 추세 파악
- SMA Cross: SMA(20) > SMA(60) → 매수 신호

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 3.2 EMA (Exponential Moving Average) - 지수이동평균

**정의**: 최근 데이터에 더 높은 가중치를 부여하는 이동평균

**공식**:
$$\text{EMA}_t = \alpha \cdot P_t + (1-\alpha) \cdot \text{EMA}_{t-1}$$

- $\alpha = \frac{2}{n+1}$: 평활 계수

**특징**:

- 최근 가격 변화에 빠르게 반응
- SMA보다 신속한 신호

**코드 위치**: `analytics/strategy/helpers.py`

---

### 3.3 RSI (Relative Strength Index) - 상대강도지수

**정의**: 일정 기간 상승폭과 하강폭의 상대적 강도

**공식**:
$$\text{RSI} = 100 - \frac{100}{1 + RS}$$
$$\text{RS} = \frac{\text{평균 상승폭}}{\text{평균 하강폭}}$$

**해석**:

- **70 이상**: 과매수 (상승 과열, 조정 신호)
- **30 이하**: 과매도 (하락 과열, 반등 신호)
- **50 근처**: 중립

**특징**:

- 범위: 0 ~ 100
- 평균 기간: 14일 (기본값)

**사용 사례**:

- 평균회귀 전략
- Bounce 신호 포착

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 3.4 MACD (Moving Average Convergence Divergence)

**정의**: 단기 EMA와 장기 EMA의 차이와 신호선의 관계

**구성**:

- MACD Line = EMA(12) - EMA(26)
- Signal Line = EMA(MACD, 9)
- Histogram = MACD - Signal Line

**신호**:

- MACD > Signal: 매수
- MACD < Signal: 매도
- Histogram 부호 전환: 추세 변화 신호

**특징**:

- 추세 추종 지표
- 지연 없음
- 횡보장에서는 거짓 신호

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 3.5 Momentum - 모멘텀

**정의**: 일정 기간 가격 변화의 누적 수익률

**공식**:
$$\text{Momentum} = \frac{P_t - P_{t-n}}{P_{t-n}}$$

또는 로그 수익률: $\ln(P_t / P_{t-n})$

**특징**:

- 추세 강도 측정
- 12개월 모멘텀이 미래 1개월 수익 예측

**사용 사례**:

- Momentum Strategy: 상승 추세 종목 매수
- 상승/하락장 식별

**코드 위치**: `analytics/strategy/main.py`

---

## 4. 자산배분 (Portfolio Allocation)

### 4.1 Kelly Criterion - 켈리 공식

**정의**: 장기 자산 증가를 최대화하는 최적 배팅 분수

**공식** (연속 케이스):
$$f^* = \frac{\mu}{\sigma^2}$$

- $\mu$: 기댓값 (평균 초과수익)
- $\sigma^2$: 분산

**특징**:

- 이론적 최대 성장률: $\log(f^*) = \frac{\mu^2}{2\sigma^2}$
- 극단값에 매우 민감 (데이터 노이즈에 약함)
- Fractional Kelly: $f_{실제} = f^* \times \text{분수}$ (보수적)

**사용 사례**:

- 다중 자산 포트폴리오 비중 결정
- TQQQ/SOXL 배분: 켈리 공식 적용 후 $1/4$ 이상 보수적 적용

**코드 위치**: `analytics/strategy/risk_control.py` - `KellyPositionSizer`

---

### 4.2 Risk Parity - 리스크 패리티

**정의**: 각 자산의 포트폴리오 리스크 기여도가 같도록 배분

**목적함수**:
$$\min \sum_{i=1}^{n} \left(\text{RC}_i - \frac{1}{n}\right)^2$$

- $\text{RC}_i = w_i \cdot \frac{\partial \sigma_p}{\partial w_i}$: 자산 i의 리스크 기여도

**특징**:

- 고변동성 자산 비중 감소
- 저변동성 자산 비중 증가
- 다각화 효과 최대화

**사용 사례**:

- TQQQ (고변동성) vs SOXL 비중 자동 조절
- 레버리지 ETF 포트폴리오 최적화

**코드 위치**: `analytics/strategy/risk_control.py` - `RiskBudgetAllocator`

---

### 4.3 Volatility Targeting - 변동성 타겟팅

**정의**: 목표 변동성에 맞게 포트폴리오 규모(레버리지)를 동적 조정

**공식**:
$$\text{포지션 스케일} = \frac{\sigma_{목표}}{\sigma_{실현}}$$

- $\sigma_{목표}$: 목표 변동성 (예: 30%)
- $\sigma_{실현}$: 최근 실현 변동성

**특징**:

- 시간에 따라 자동 레버리징/디레버징
- 저변동성 구간에서 수익률 향상
- 고변동성 구간에서 손실 제한

**사용 사례**:

- 레버리지 ETF 비중 계절성 조정
- 일정한 위험도 유지

**코드 위치**: `analytics/strategy/risk_control.py` - `RiskBudgetAllocator`

---

### 4.4 Position Sizing - 포지션 규모 결정

**관련 개념**:

1. **고정 분수법 (Fixed Fractional)**: 자본의 고정 비율 배팅
2. **켈리 기반**: 켈리 공식으로 계산
3. **변동성 기반**: 최근 변동성에 따라 조정

**특징**:

- 과도한 레버리지 방지
- 연쇄 손실 방지
- 심리적 안정성

**코드 위치**: `analytics/strategy/risk_control.py`

---

## 5. 고급 분석 기법 (Advanced Techniques)

### 5.1 HMM (Hidden Markov Model) - 히든 마르코프 모델

**정의**: 직접 관측 불가능한 숨겨진 상태가 관측값을 생성한다고 가정하는 확률 모델

**구성 요소**:

- **숨겨진 상태**: Bull, Bear, Sideways 등
- **전이행렬 (A)**: 상태 간 전환 확률
- **방출확률 (B)**: 각 상태에서 관측값(수익률) 생성 확률
- **초기확률 (π)**: 첫 상태 확률 분포

**특징**:

- Viterbi 알고리즘으로 최적 상태 시퀀스 추정
- 경로의존성 고려
- 역사적 상태 전환 학습

**사용 사례**:

- 시장 국면 탐지 (bull/bear/sideways)
- 국면별 전략 파라미터 조정

**코드 위치**: `analytics/strategy/helpers.py` - `BayesianRegimeDetector`

---

### 5.2 Regime Detection - 국면 탐지

**정의**: 현재 시장의 경제적 상태를 분류

**전형적 분류**:

1. **Bull Quiet**: MA200 위, 양의 추세, 저변동성 (이상적)
2. **Bull Volatile**: MA200 위, 양의 추세, 고변동성 (경고)
3. **Bear**: MA200 아래, 음의 추세
4. **Sideways**: 명확한 방향성 없음
5. **High Vol Unstable**: 극단 변동성 (위험)

**측정 지표**:

- MA200 추세: 200일 단순이동평균 대비 현재가
- 기울기: 20일 기울기 (추세 강도)
- 변동성: 60일 연환산 변동성

**특징**:

- 단순 HMM보다 빠른 계산
- 규칙 기반 접근
- 해석 용이

**사용 사례**:

- 국면별 포지션 사이징 조정
- Bear/Crisis 상황에서 자동 포지션 축소
- 전략 노출도 제어

**코드 위치**: `analytics/app/robust/regime.py`, `analytics/strategy/main.py`

---

### 5.3 Walk Forward Validation (WFV) - 워크포워드 검증

**정의**: 시간 순서를 유지하면서 반복적으로 최적화 및 검증하는 백테스트 방법

**프로세스**:

```
구간 1: [Train: 504일 | Test: 63일]
            ↓
        파라미터 최적화 (IS) → 미래 성과 평가 (OOS)
            ↓
구간 2: [Train: 504일 (이전 + 새로운) | Test: 63일 (새로운)]
            ↓
        반복...
```

**주요 메트릭**:

- **IS Sharpe**: 훈련 구간 성과
- **OOS Sharpe**: 테스트 구간 성과
- **Overfit Index**: $(IS - OOS) / IS \times 100\%$ (과적합 정도)

**특징**:

- 미래 성과 예측력 높음
- 데이터 스누핑 바이어스 제거
- 현실적 성과 평가

**해석 가이드**:

- Overfit Index < 20%: 안정적 (권장)
- 20% ~ 50%: 주의
- > 50%: 과적합 위험

**사용 사례**:

- 전략 검증
- 파라미터 최적화 신뢰도 평가

**코드 위치**: `analytics/strategy/helpers.py` - `WalkForwardValidator`

---

### 5.4 Bootstrap Resampling - 부트스트랩 재표본추출

**정의**: 원래 데이터에서 복원추출로 새로운 표본을 반복 생성하여 통계량의 분포 추정

**프로세스**:

```
원본 데이터: [r₁, r₂, ..., rₙ]
    ↓
1000회 반복 (각각 복원추출):
    표본 1: [r₃, r₁, r₁, r₅, ...] → Sharpe 계산
    표본 2: [r₂, r₄, r₃, r₂, ...] → Sharpe 계산
    ...
    ↓
Sharpe 분포: 평균, 신뢰구간 추정
```

**특징**:

- 분포 가정 불필요 (비모수)
- 신뢰구간 추정
- 극단값 처리 능력

**사용 사례**:

- Kelly 분수의 95% 신뢰구간 계산
- 성과 불확실성 정량화

**코드 위치**: `analytics/strategy/helpers.py`, `analytics/strategy/risk_control.py`

---

### 5.5 Correlation Stress Test - 상관관계 스트레스 테스트

**정의**: 극단 시장 환경에서 자산 간 상관관계 붕괴(correlation breakdown) 시뮬레이션

**시나리오**:

1. **Normal Correlation**: 평상시 상관관계
2. **Crisis Correlation**: 2008년 금융위기 등 극단 상황의 상관관계

**평상시**: $\rho_{\text{TQQQ}, \text{SOXL}} = 0.85$ (다각화 이익)  
**위기 시**: $\rho_{\text{TQQQ}, \text{SOXL}} = 0.95$ (다각화 이익 감소)

**지표**:

- Diversification Ratio = $\frac{\sum w_i \sigma_i}{\sigma_p}$ (다각화 효과)
- 위기 시 급락

**특징**:

- 포트폴리오 최악 시나리오 평가
- 다각화의 허점 파악

**사용 사례**:

- 극단 손실 대비
- 위기 시 리스크 제한

**코드 위치**: `analytics/strategy/helpers.py` - `CorrelationStressTest`

---

### 5.6 Monte Carlo Simulation - 몬테카를로 시뮬레이션

**정의**: 난수를 이용한 반복 실험으로 복잡한 시스템의 결과 분포 추정

**프로세스**:

```
1. 수익률 분포 추정 (평균, 분산, 첨도)
2. 난수 생성 (정규분포, Student-t 등)
3. 미래 경로 시뮬레이션
4. 결과 분포 분석
```

**특징**:

- 비선형 효과 반영 (레버리지 감쇠)
- 극단값 포착
- 유연한 분포 모델

**사용 사례**:

- 레버리지 ETF 장기 성과 예측
- 포트폴리오 극단값 분석

**코드 위치**: `analytics/strategy/helpers.py` - `FatTailSynthesizer`

---

### 5.7 Deflated Sharpe Ratio (DSR) - 보정된 샤프 지수

**정의**: 다중 백테스트 편향을 고려하여 보정한 Sharpe Ratio

**공식**:
$$\text{DSR} = \Phi\left(\frac{\text{SR} - E[\max \text{SR}]}{\sigma[\text{SR}]}\right)$$

**특징**:

- N개 파라미터 세트 중 최고값의 우연성 제거
- 통계적으로 유의미한 성과 여부 판단
- 과적합 편향 제거

**해석**:

- **DSR > 0.5**: 통계적 유의성 높음
- **DSR < 0.2**: 우연일 가능성 높음

**코드 위치**: `analytics/strategy/helpers.py`

---

## 6. 투자 전략 (Investment Strategies)

### 6.1 Buy and Hold - 매수 후 보유

**정의**: 초기 매수 후 장기간 보유하는 전략

**특징**:

- 시장 상황에 관계없이 지속 보유
- 거래 비용 최소
- 시장 타이밍 불필요

**성과 벤치마크**:

- 장기 기준 대부분의 적극적 전략을 이기는 기준

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 6.2 SMA Cross - SMA 교차 전략

**정의**: 단기 SMA가 장기 SMA를 위에서 아래로 교차할 때 신호 발생

**규칙**:

- **매수**: SMA(20) > SMA(60) (황금 교차)
- **매도**: SMA(20) < SMA(60) (사망 교차)

**특징**:

- 추세 추종 전략
- 지연 신호 (횡보장에서 손실)
- 변동성 낮음

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 6.3 RSI Mean Reversion - RSI 평균회귀 전략

**정의**: RSI 극단값 반전을 거래하는 전략

**규칙**:

- **매수**: RSI < 30 (과매도)
- **매도**: RSI > 70 (과매수)
- **청산**: 반대 신호

**특징**:

- 횡보장에 강함
- 추세장에서는 손실
- 빈번한 거래

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 6.4 Momentum Strategy - 모멘텀 전략

**정의**: 상승 추세 종목을 매수하는 "탄승(追乘)" 전략

**규칙**:

- **매수**: 12개월 누적수익률 - 1개월 누적수익률 > 0
- **매도**: 반대 신호

**특징**:

- 추세 강도 기반
- 학술적으로 실증됨 (Jegadeesh & Titman)
- 모멘텀 붕괴 위험 (Momentum crash)

**사용 사례**:

- Alpha-Helix의 핵심 전략 중 하나

**코드 위치**: `analytics/app/backtest/vbt_engine.py`, `analytics/strategy/main.py`

---

### 6.5 VIX Risk-Off - VIX 기반 위험회피 전략

**정의**: VIX 수준에 따라 포지션 조정

**규칙**:

- **포지션 유지**: VIX ≤ 25 (정상)
- **포지션 축소**: VIX > 25 (경고)
- **포지션 청산**: VIX > 40 (극한)

**특징**:

- 시장 불안정성에 민감
- 극단 손실 제한
- 기회 손실 가능

**코드 위치**: `analytics/app/backtest/vbt_engine.py`

---

### 6.6 DCA (Dollar Cost Averaging) - 정액매수

**정의**: 가격에 상관없이 일정한 금액을 주기적으로 매수

**특징**:

- 매수 평균가 낮춤 (변동성 높을수록 효과)
- 심리적 편향 제거
- 시간 분산

**수학적 근거**:

- 조화평균 > 산술평균 (가격 변동 클수록 이득)

**사용 사례**:

- 정기 적립식 펀드
- Alpha-Helix "무한매수" 모듈

**코드 위치**: `analytics/strategy/main.py` - `_apply_dca_logic()`

---

### 6.7 Circuit Breaker - 서킷브레이커

**정의**: 극단적 손실 상황에서 모든 거래를 중단하는 안전장치

**트리거**:

- **Drawdown Halt**: 누적 손실이 -35% 이하 (기본값)
- **Recovery Threshold**: 복구 후 재시작

**특징**:

- 심리적 안정성
- 극단 손실 제한 (Hard Floor)
- 시장 기회 상실 가능

**코드 위치**: `analytics/strategy/risk_control.py` - `DrawdownCircuitBreaker`

---

## 7. 데이터 소스 (Data Sources)

### 7.1 Polygon.io

**제공 데이터**:

- OHLCV (Open, High, Low, Close, Volume) 일봉
- 미국 주식 및 ETF
- 역사적 데이터 제공

**사용 심볼** (Alpha-Helix):

```
레버리지 ETF: TQQQ, SOXL, UPRO, QLD, TNA, LABU
벤치마크:    SPY, QQQ
채권/방어:   TLT, GLD, SHY, SCHD
```

**수집 주기**: 매일 06:00 UTC (미국 종가 확정 후)

**코드 위치**: `analytics/app/data/polygon_client.py`, `analytics/app/data/collector.py`

---

### 7.2 FRED (Federal Reserve Economic Data)

**제공 데이터**:

- 미국 경제 거시 지표
- 금리, 물가, 실업률 등
- 무료 API

**수집 지표** (Alpha-Helix):
| 심볼 | 설명 | 빈도 |
|---|---|---|
| FEDFUNDS | 기준금리 | 월간 |
| DGS10 | 10년물 국채 수익률 | 일간 |
| DGS2 | 2년물 국채 수익률 | 일간 |
| T10Y2Y | 10Y-2Y 스프레드 (수익률곡선) | 일간 |
| VIXCLS | VIX 지수 | 일간 |
| CPIAUCSL | CPI (소비자물가) | 월간 |
| UNRATE | 실업률 | 월간 |
| DCOILWTICO | WTI 원유 가격 | 일간 |

**수집 주기**: 매일 07:00 UTC

**코드 위치**: `analytics/app/data/fred_client.py`, `analytics/app/data/collector.py`

---

### 7.3 Binance

**제공 데이터**:

- OHLCV 암호화폐
- 1분봉 ~ 일봉
- 실시간 데이터

**수집 심볼** (Alpha-Helix):

```
BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, DOGEUSDT
```

**수집 주기**: 매 1시간

**코드 위치**: `analytics/app/data/binance_client.py`, `analytics/app/data/collector.py`

---

### 7.4 Yahoo Finance (Fallback)

**제공 데이터**:

- OHLCV
- 무료 API

**역할**: Polygon 미수집 기간의 보완용

**코드 위치**: `analytics/app/data/yf_client.py`

---

## 8. 분포 모델 (Distribution Models)

### 8.1 Student-t Distribution (Fat-Tail)

**정의**: 정규분포보다 꼬리가 두꺼운 분포 (극단값 발생 빈도 높음)

**공식**:
$$f(x; \nu) = \frac{\Gamma\left(\frac{\nu+1}{2}\right)}{\sqrt{\nu\pi}\,\Gamma\left(\frac{\nu}{2}\right)}\left(1+\frac{x^2}{\nu}\right)^{-\frac{\nu+1}{2}}$$

**파라미터**:

- $\nu$ (자유도): 작을수록 꼬리 굵음
  - $\nu = \infty$: 정규분포
  - $\nu = 5$: 중간 수준
  - $\nu = 4$: 지수 수준 (Alpha-Helix 기본값)

**특징**:

- 극단값(검은 백조) 포착
- 첨도(kurtosis) 높음
- VaR 과소평가 방지

**사용 사례**:

- TQQQ 합성 시뮬레이션
- 극한 손실 시나리오

**코드 위치**: `analytics/strategy/helpers.py` - `FatTailSynthesizer`

---

### 8.2 Volatility Decay (변동성 감쇠)

**정의**: 레버리지 ETF의 일일 복리 구조로 인한 장기 수익 손실

**공식**:
$$E[R_{\text{3x}}] = 3 \cdot E[R] - \frac{1}{2} \cdot 3^2 \cdot \sigma^2$$

여기서:

- $E[R]$: 기초 자산 기댓값
- $\sigma^2$: 기초 자산 분산
- 감쇠항: $\frac{9}{2}\sigma^2$

**예시**:

- QQQ가 연 10% 수익, 연 20% 변동성
- TQQQ 기댓값 = $3 \times 10\% - \frac{1}{2} \times 9 \times 4\% = 30\% - 18\% = 12\%$

**특징**:

- 변동성 높을수록 감쇠 크음
- 횡보장에서 손실 가중
- 장기 보유 시 주목

**코드 위치**: `analytics/strategy/helpers.py` - `FatTailSynthesizer.generate_single()`

---

## 9. 시스템 개념 (System Concepts)

### 9.1 Confidence Scoring System - 신뢰도 평가 시스템

**정의**: 신호의 품질을 정량화하여 포지션 크기를 결정

**구성 요소**:

1. **HMM 신뢰도**: 현재 레짐이 맞을 확률
2. **신호 강도**: 기술적 신호의 명확성
3. **리스크 환경**: VIX, 변동성 등

**점수 범위**: 0.0 ~ 1.0

**사용처**:

- Kelly 비중 × 신뢰도 = 최종 포지션
- 낮은 신뢰도 시 자동 축소

**코드 위치**: `analytics/strategy/risk_control.py` - `ConfidenceScoringSystem`

---

### 9.2 VIX Multiplier Engine - VIX 승수 엔진

**정의**: VIX 수준에 따라 포지션 크기를 동적 조정

**로직**:

```
VIX ≤ 15: 승수 1.2 (저위험)
15 < VIX ≤ 25: 승수 1.0 (정상)
25 < VIX ≤ 35: 승수 0.6 (경고)
VIX > 35: 승수 0.2 (극한)
```

**특징**:

- 시장 두려움 반영
- 자동 리스크 관리

**코드 위치**: `analytics/strategy/risk_control.py` - `VixMultiplierEngine`

---

### 9.3 Integrated Risk Pipeline - 통합 리스크 파이프라인

**정의**: 신뢰도, VIX, 레짐, 서킷브레이커를 종합 평가

**프로세스**:

```
신호 생성
  ↓
신뢰도 평가 (HMM)
  ↓
VIX 승수 적용
  ↓
레짐 필터 (Bear/Crisis 차단)
  ↓
포지션 축소 (서킷브레이커)
  ↓
최종 포지션 결정
```

**특징**:

- 다층 방어 구조
- 극단 손실 제한
- 신호 강화

**코드 위치**: `analytics/strategy/risk_control.py` - `IntegratedRiskPipeline`

---

## 10. 프론트엔드 금융 용어 (Frontend Finance Terms)

### 10.1 Portfolio (포트폴리오)

**정의**: 사용자가 만든 투자 포트폴리오 관리 공간

**구성**:

- 포트폴리오 이름 및 설명
- 보유 자산 리스트
- 성과 지표 (Sharpe, MDD, CAGR)
- 포트폴리오 편집 (권한 있을 때)

**코드 위치**: `frontend/src/pages/Partner_Portfolio.jsx`, `Client_Portfolio.jsx`

---

### 10.2 Project Matching (프로젝트 매칭)

**정의**: 클라이언트 프로젝트와 파트너를 자동 연결

**매칭 기준**:

- 스킬 일치도
- 경험 수준
- 포트폴리오 평가
- 위치/시간대

**데이터베이스**: `user_interest_partners`, `user_interest_projects`

**코드 위치**: `frontend/src/pages/ClientSearch.jsx`, `PartnerSearch.jsx`

---

### 10.3 Risk Management (리스크 관리)

**프론트엔드 기능**:

1. **Broker Settings**: 거래소 설정
2. **Portfolio Risk**: 포트폴리오 구성 위험도
3. **Drawdown Alert**: 낙폭 경고 설정

**코드 위치**: `frontend/src/pages/BrokerSettings.jsx`

---

### 10.4 Analytics Lab (분석 실험실)

**기능**:

- 전략 백테스트
- 파라미터 최적화
- 성과 분석
- 레짐 분석

**코드 위치**: `frontend/src/pages/AnalyticsLab.jsx`

---

### 10.5 Strategy Workspace (전략 작업 공간)

**기능**:

- 직관적 전략 구성
- 신호 생성 및 검증
- 리스크 제어 설정
- 실시간 신호 모니터링

**코드 위치**: `frontend/src/pages/StrategyWorkspace.jsx`

---

## 부록: 공식 모음

### A. 수익률 계산

| 개념          | 공식                                  |
| ------------- | ------------------------------------- |
| 일일 수익률   | $r_t = \frac{P_t - P_{t-1}}{P_{t-1}}$ |
| 누적 수익률   | $R = \prod_{t=1}^{n}(1 + r_t) - 1$    |
| 로그 수익률   | $\ln(P_t / P_{t-1})$                  |
| 연환산 수익률 | $r_{annual} = (1 + r)^{252} - 1$      |

### B. 위험 계산

| 개념          | 공식                                                 |
| ------------- | ---------------------------------------------------- |
| 표준편차      | $\sigma = \sqrt{\frac{1}{n}\sum(r_i - \bar{r})^2}$   |
| 연환산 변동성 | $\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$ |
| 공분산        | $\text{Cov}(X,Y) = E[(X-\mu_X)(Y-\mu_Y)]$            |
| 상관계수      | $\rho = \frac{\text{Cov}(X,Y)}{\sigma_X \sigma_Y}$   |

### C. 포트폴리오 수학

| 개념              | 공식                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| 포트폴리오 수익률 | $R_p = \sum w_i r_i$                                                                   |
| 포트폴리오 분산   | $\sigma_p^2 = \sum w_i^2 \sigma_i^2 + 2\sum_{i<j} w_i w_j \rho_{ij} \sigma_i \sigma_j$ |
| 포트폴리오 변동성 | $\sigma_p = \sqrt{\sigma_p^2}$                                                         |

---

## 참고자료

### 학술 논문

- Jegadeesh & Titman (1993): "Returns to Buying Winners and Selling Losers" (Momentum)
- Markowitz (1952): "Portfolio Selection" (MPT)
- Sharpe (1966): "Mutual Fund Performance" (Sharpe Ratio)
- Qian (2005): "Risk Parity Fundamentals" (Risk Parity)

### 도서

- "Advances in Financial Machine Learning" (López de Prado)
- "The Intelligent Investor" (Graham)
- "Fooled by Randomness" (Taleb)

### 라이브러리

- **QuantStats**: 성과 메트릭
- **VectorBT**: 백테스팅
- **Hmmlearn**: HMM
- **Scipy/NumPy**: 수치 계산

---

## 용어 색인 (Alphabetical)

- **Alpha**: 벤치마크 초과 수익 (1.6)
- **Beta**: 벤치마크 민감도 (1.7)
- **Bootstrap**: 재표본추출 (5.4)
- **Buy and Hold**: 매수 후 보유 (6.1)
- **CAGR**: 연환산 수익률 (1.1)
- **Calmar Ratio**: 칼마 지수 (1.4)
- **Circuit Breaker**: 서킷브레이커 (6.7)
- **Correlation Stress Test**: 상관관계 스트레스 (5.5)
- **CVaR**: 조건부 위험가치 (2.4)
- **DCA**: 정액매수 (6.6)
- **Deflated Sharpe Ratio**: 보정된 샤프 (5.7)
- **Drawdown**: 최대낙폭 (2.2)
- **EMA**: 지수이동평균 (3.2)
- **Expected Shortfall**: CVaR (2.4)
- **Fat Tail**: 꼬리 두꺼운 분포 (8.1)
- **HMM**: 히든 마르코프 모델 (5.1)
- **Information Ratio**: 정보비율 (1.5)
- **Kelly Criterion**: 켈리 공식 (4.1)
- **MACD**: 이동평균 수렴확산 (3.4)
- **Max Drawdown**: 최대낙폭 (2.2)
- **Momentum**: 모멘텀 (3.5, 6.4)
- **Monte Carlo**: 몬테카를로 시뮬레이션 (5.6)
- **Regime Detection**: 국면 탐지 (5.2)
- **Risk Parity**: 리스크 패리티 (4.2)
- **RSI**: 상대강도지수 (3.3)
- **Sharpe Ratio**: 샤프 지수 (1.2)
- **SMA**: 단순이동평균 (3.1)
- **Sortino Ratio**: 소르티노 지수 (1.3)
- **Student-t**: 스튜던트-t 분포 (8.1)
- **VaR**: 위험가치 (2.3)
- **Volatility**: 변동성 (2.1)
- **Volatility Decay**: 변동성 감쇠 (8.2)
- **Volatility Targeting**: 변동성 타겟팅 (4.3)
- **Walk Forward Validation**: 워크포워드 검증 (5.3)
- **Win Rate**: 승률 (1.8)

---

**마지막 수정**: 2026년 5월 26일  
**작성자**: AI 분석 에이전트  
**버전**: 1.0
