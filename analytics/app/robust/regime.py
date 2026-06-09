"""
Market Regime detection.

지원 알고리즘 (method 파라미터):
  - "rule" (default, Free)  : MA200 추세 + 60일 변동성 분위수 컷 → 5분류
  - "hmm"  (Pro)            : Gaussian HMM (hmmlearn) — 학술 표준, sklearn API
                              상태 수 n_states 가변 (3~5), 상태별 평균수익·변동성으로 자동 라벨링

공통 후처리:
  - smoothing (Viterbi-style minimum-run filter): N일 미만 지속 라벨은 직전 라벨로 흡수.
    rule-based의 깜빡임 + HMM의 짧은 outlier state를 동시에 완화.

5분류 라벨:
  - bull_quiet      : 추세 위 + 변동성 정상
  - bull_volatile   : 추세 위 + 변동성 높음 (반등 구간 / 급락 직전 경고)
  - bear            : 추세 아래 + 변동성 정상
  - sideways        : 방향성 없음
  - high_vol_unstable: 변동성 극단 + 하락/횡보

참고 학술 / 오픈 레포:
  - Hamilton (1989) Markov Switching
  - Adams & MacKay (2007) BOCPD
  - hmmlearn (BSD-3, https://github.com/hmmlearn/hmmlearn)
  - statsmodels.tsa.regime_switching.MarkovRegression
"""
from __future__ import annotations
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd

from app.backtest.vbt_engine import BacktestParams, run_backtest

REGIME_LABELS = ["bull_quiet", "bull_volatile", "bear", "sideways", "high_vol_unstable"]

REGIME_LABELS_KO = {
    "bull_quiet": "상승장(안정)",
    "bull_volatile": "상승장(불안정)",
    "bear": "하락장",
    "sideways": "횡보장",
    "high_vol_unstable": "고변동성 불안정장",
}

# Bayesian shrinkage prior for Sharpe credibility weighting.
# 짧은 표본의 극단 Sharpe(예: 10일 하락장에서 -6.25)를 0 쪽으로 끌어당겨
# 표본 크기에 비례하는 통계적 신뢰도를 반영한다.
# SR_eff = SR_obs × T / (T + T0)   (Lo 2002 + James-Stein shrinkage 변형)
# T0=60(약 3개월)이면: 30일 표본 → 가중치 0.33, 252일 → 0.81, 1000일 → 0.94
SHARPE_SHRINKAGE_PRIOR = 60


def shrink_sharpe(sharpe_obs: float, days: int, prior: int = SHARPE_SHRINKAGE_PRIOR) -> tuple[float, float]:
    """Return (effective_sharpe, sample_weight) — weight ∈ (0, 1]."""
    if days <= 0:
        return 0.0, 0.0
    w = days / (days + prior)
    return float(sharpe_obs) * w, w


def classify_regimes(
    close: pd.Series,
    method: str = "rule",
    smoothing: int = 0,
    n_states: int = 4,
    causal: bool = False,
) -> pd.Series:
    """
    국면 라벨 시리즈 반환 (close index와 정렬).

    Parameters
    ----------
    method : "rule" | "hmm"
        - "rule": expanding 분위수 컷 기반 5분류 (기본, 빠름, 인과적, 해석 가능)
        - "hmm" : Gaussian HMM (hmmlearn) — 학술 표준, 부드러운 상태 전이
    smoothing : int
        Viterbi-style minimum-run filter. N일 미만 지속 라벨은 직전 라벨로 흡수.
        0/1이면 비활성. 권장: 5
    n_states : int
        HMM 상태 수 (3~5). rule-based에서는 무시.
    causal : bool
        HMM 전용. True 면 워크포워드 expanding 재디코딩으로 룩어헤드를 제거한 '실시간 국면 라벨'을
        만든다(느림). False(기본)는 전체표본 fit(빠름, 사후분석) — 결과의 attrs['hmm_causal']로 표기.
    """
    hmm_causal = None
    if method == "hmm":
        raw, effective_method = _hmm_regimes(close, n_states=n_states, causal=causal)
        if effective_method == "hmm":
            hmm_causal = bool(raw.attrs.get("hmm_causal", causal))
    else:
        raw, effective_method = _rule_regimes(close), "rule"

    if smoothing and smoothing > 1:
        raw = _smooth_states(raw, min_run=int(smoothing))  # 새 Series 반환 → attrs 재설정 필요
    # 실제로 사용된 방법을 기록한다(HMM 요청이 표본부족/fit실패로 rule 로 폴백되면 "rule").
    raw.attrs["effective_method"] = effective_method
    if hmm_causal is not None:
        raw.attrs["hmm_causal"] = hmm_causal
    return raw


def _rule_regimes(close: pd.Series) -> pd.Series:
    """
    분류 규칙 (우선순위 순):
    1. MA200 위 + slope 양 + vol < 75th → bull_quiet
    2. MA200 위 + slope 양 + vol >= 75th → bull_volatile
    3. MA200 아래 + slope 음 + vol < 75th → bear
    4. MA200 아래 + slope 음 + vol >= 75th → high_vol_unstable
    5. 횡보 + vol >= 80th → high_vol_unstable
    6. 나머지 → sideways
    """
    ma200 = close.rolling(200, min_periods=100).mean()
    ma200_smooth = ma200.ewm(span=10, adjust=False).mean()
    slope = ma200_smooth.diff(10)

    ret = close.pct_change()
    vol60 = ret.rolling(60, min_periods=20).std() * np.sqrt(252)

    # 인과적(no look-ahead): 시점 t 의 임계값은 t 까지의 변동성 분포만 사용 (expanding 분위수).
    # 전체구간 .quantile() 은 미래 데이터로 임계값을 정하는 룩어헤드라 '실시간 국면 라벨'로는 부적합.
    # ⚠️ 변동성 임계값(min_periods=120)은 MA200(min_periods=100)보다 늦게 확정된다. 그 100~120 구간은
    #    MA200 은 유효한데 임계값만 NaN → high-vol 분기가 구조적으로 누락(라벨 편향)된다. 따라서 아래에서
    #    vol_q75.isna() 구간을 '국면 미확정(NaN)'으로 명시 처리한다(거짓 라벨 대신 정직한 미확정).
    vol_q75 = vol60.expanding(min_periods=120).quantile(0.75)
    vol_q80 = vol60.expanding(min_periods=120).quantile(0.80)
    vol_high_75 = vol60 >= vol_q75
    vol_high_80 = vol60 >= vol_q80

    is_above_ma = close > ma200
    is_bull_trend = is_above_ma & (slope > 0)
    is_bear_trend = ~is_above_ma & (slope < 0)

    regime = pd.Series("sideways", index=close.index, dtype="object")
    regime[is_bull_trend & ~vol_high_75] = "bull_quiet"
    regime[is_bull_trend & vol_high_75] = "bull_volatile"
    regime[is_bear_trend & ~vol_high_75] = "bear"
    regime[is_bear_trend & vol_high_75] = "high_vol_unstable"
    regime[~is_bull_trend & ~is_bear_trend & vol_high_80] = "high_vol_unstable"
    # MA200 또는 변동성 임계값이 아직 확정 안 된 워밍업 구간 → 국면 미확정(편향 방지)
    regime[ma200.isna() | vol_q75.isna()] = np.nan
    return regime


def _smooth_states(s: pd.Series, min_run: int) -> pd.Series:
    """
    Viterbi-style minimum-run smoothing.
    연속 run length < min_run인 segment를 직전 segment 라벨로 흡수.
    rule-based의 깜빡임 (1~2일 깜빡이는 high_vol → bull) 제거.
    """
    if min_run <= 1:
        return s
    arr = s.values.copy()
    n = len(arr)
    i = 0
    last_valid: Optional[Any] = None
    # 먼저 첫 valid 라벨 찾기
    while i < n and (arr[i] is None or (isinstance(arr[i], float) and np.isnan(arr[i]))):
        i += 1
    if i >= n:
        return s
    last_valid = arr[i]
    while i < n:
        if arr[i] is None or (isinstance(arr[i], float) and np.isnan(arr[i])):
            i += 1
            continue
        j = i
        while j < n and arr[j] == arr[i]:
            j += 1
        run_len = j - i
        if run_len < min_run and last_valid is not None and last_valid != arr[i]:
            arr[i:j] = last_valid
        else:
            last_valid = arr[i]
        i = j
    return pd.Series(arr, index=s.index, dtype="object")


# ── HMM 모델/라벨 캐시: 동일 (데이터, n_states, causal) 반복 호출 시 재학습 회피 ──
# Trust Score 1회가 per_regime_stats 를 부르고 /regime 도 같은 ticker 를 또 부르면 중복 학습이 생긴다.
# random_state=42 로 결과가 결정적이라 캐시가 안전하다.
_HMM_CACHE: dict = {}
_HMM_CACHE_MAX = 64


def _hmm_cache_key(close: pd.Series, n_states: int, causal: bool) -> tuple:
    idx = close.index
    return (
        str(idx[0]) if len(idx) else "",
        str(idx[-1]) if len(idx) else "",
        int(len(close)),
        round(float(close.iloc[-1]), 6) if len(close) else 0.0,
        int(n_states),
        bool(causal),
    )


def _hmm_label_map(rets, vols, vol_median, zero_band) -> dict:
    """state index → 의미 라벨. 넘겨받는 통계가 과거-only면 라벨 매핑도 인과적이다."""
    label_map = {}
    for s, (r, v) in enumerate(zip(rets, vols)):
        is_high_vol = v > vol_median
        if abs(r) <= zero_band:
            label_map[s] = "high_vol_unstable" if is_high_vol else "sideways"
        elif r > 0:
            label_map[s] = "bull_volatile" if is_high_vol else "bull_quiet"
        else:
            label_map[s] = "high_vol_unstable" if is_high_vol else "bear"
    return label_map


def _hmm_regimes(
    close: pd.Series,
    n_states: int = 4,
    causal: bool = False,
    refit_every: int = 21,
    min_train: int = 252,
) -> tuple[pd.Series, str]:
    """
    Gaussian HMM 기반 국면 분류 (Pro). 피처: log return, rolling vol(20d), momentum(60d).

    causal=False (기본): 전체표본 fit+predict (빠름, **사후분석용**). 시점 t 라벨이 미래 데이터로
        추정된 파라미터로 디코딩되므로 '실시간 라벨'로 쓰면 룩어헤드. labels.attrs['hmm_causal']=False
        로 이 사실을 정직하게 표기한다.
    causal=True: 워크포워드 expanding 재디코딩. 경계 end 마다 [:end] 만으로 fit 하고 **다음 구간
        [end:end+refit_every) 를 OOS 예측**(end ≤ i 이므로 인과적). 라벨 매핑도 [:end] 과거통계로만
        수행 → 미래정보 누설 0. [0:min_train) 은 학습 이력 부족이라 NaN(미확정). labels.attrs['hmm_causal']=True

    requires: hmmlearn (BSD-3)
    """
    try:
        from hmmlearn.hmm import GaussianHMM
    except ImportError as e:
        raise ImportError(
            "HMM 모드는 hmmlearn 패키지가 필요합니다. `pip install hmmlearn` 후 서비스 재시작하세요."
        ) from e

    n_states = max(2, min(int(n_states), 6))

    ckey = _hmm_cache_key(close, n_states, causal)
    hit = _HMM_CACHE.get(ckey)
    if hit is not None:
        lab = hit[0].copy()
        lab.attrs["hmm_causal"] = hit[2]
        return lab, hit[1]

    log_close = np.log(close.astype(float))
    ret = log_close.diff()
    vol20 = ret.rolling(20).std()
    mom60 = log_close.diff(60)
    feats = pd.DataFrame({"ret": ret, "vol": vol20, "mom": mom60}).dropna()
    if len(feats) < n_states * 30:
        # 표본 부족 → rule 폴백 (캐시하지 않음)
        return _rule_regimes(close), "rule"

    vals = feats.values.astype(float)
    n = len(feats)

    def _mapping(h_arr: np.ndarray, end: int) -> dict:
        rets = [float(feats["ret"].values[:end][h_arr == s].mean()) if (h_arr == s).any() else 0.0
                for s in range(n_states)]
        vols = [float(feats["vol"].values[:end][h_arr == s].mean()) if (h_arr == s).any() else 0.0
                for s in range(n_states)]
        vol_median = sorted(vols)[len(vols) // 2] if vols else 0.0
        zero_band = float(feats["ret"].values[:end].std()) * 0.05
        return _hmm_label_map(rets, vols, vol_median, zero_band)

    try:
        if not causal:
            mu = vals.mean(axis=0)
            sd = vals.std(axis=0) + 1e-9
            Xn = (vals - mu) / sd
            model = GaussianHMM(n_components=n_states, covariance_type="full",
                                n_iter=200, tol=1e-3, random_state=42)
            model.fit(Xn)
            hidden = model.predict(Xn)
            lmap = _mapping(hidden, n)
            arr = np.array([lmap[h] for h in hidden], dtype=object)
            hmm_causal = False
        else:
            arr = np.empty(n, dtype=object)
            arr[:] = np.nan
            end = max(int(min_train), n_states * 30)
            while end < n:
                Xtr = vals[:end]
                mu = Xtr.mean(axis=0)
                sd = Xtr.std(axis=0) + 1e-9
                model = GaussianHMM(n_components=n_states, covariance_type="full",
                                    n_iter=100, tol=1e-3, random_state=42)
                model.fit((Xtr - mu) / sd)
                lmap = _mapping(model.predict((Xtr - mu) / sd), end)   # 과거-only 라벨매핑
                hi = min(end + int(refit_every), n)
                h_pred = model.predict((vals[end:hi] - mu) / sd)       # OOS 예측(인과적)
                for k, i in enumerate(range(end, hi)):
                    arr[i] = lmap[h_pred[k]]
                end = hi
            hmm_causal = True
    except Exception:
        return _rule_regimes(close), "rule"

    labels = pd.Series(arr, index=feats.index, dtype="object").reindex(close.index)
    labels.attrs["hmm_causal"] = hmm_causal
    if len(_HMM_CACHE) >= _HMM_CACHE_MAX:
        _HMM_CACHE.pop(next(iter(_HMM_CACHE)))
    _HMM_CACHE[ckey] = (labels.copy(), "hmm", hmm_causal)
    return labels, "hmm"


def per_regime_stats(
    close: pd.Series,
    params: BacktestParams,
    method: str = "rule",
    smoothing: int = 0,
    n_states: int = 4,
    ticker: Optional[str] = None,
    period: Optional[str] = None,
    causal: bool = False,
) -> Dict[str, Any]:
    """Run full backtest, then split equity returns by regime label and compute summary per regime."""
    regimes_raw = classify_regimes(close, method=method, smoothing=smoothing, n_states=n_states, causal=causal)
    # HMM 요청이 표본부족/fit실패로 rule 로 폴백됐는지 실제 사용 방법을 가져온다(dropna 전에 읽음).
    effective_method = regimes_raw.attrs.get("effective_method", method)
    # HMM 라벨의 인과성(룩어헤드 제거 여부)도 정직하게 노출한다(method=hmm 일 때만 의미).
    hmm_causal = regimes_raw.attrs.get("hmm_causal", None)
    regimes = regimes_raw.dropna()
    bt = run_backtest(close, params)

    eq = pd.Series({pd.to_datetime(p["date"]): p["value"] for p in bt["equity_curve"]})
    eq = eq.sort_index()
    eq_ret = eq.pct_change().dropna()
    common = eq_ret.index.intersection(regimes.index)
    eq_ret = eq_ret.loc[common]
    reg = regimes.loc[common]

    out: Dict[str, Any] = {}
    for label in REGIME_LABELS:
        r = eq_ret[reg == label]
        if len(r) < 5:
            out[label] = {"days": int(len(r)), "note": "샘플 부족"}
            continue
        cum = (1 + r).prod() - 1
        ann = (1 + cum) ** (252 / len(r)) - 1 if len(r) > 0 else 0
        sharpe = (r.mean() / r.std() * np.sqrt(252)) if r.std() > 0 else 0
        roll_max = (1 + r).cumprod().cummax()
        dd = ((1 + r).cumprod() / roll_max - 1).min()
        win_rate = float((r > 0).mean() * 100)
        eff_sharpe, sample_w = shrink_sharpe(sharpe, len(r))
        out[label] = {
            "days": int(len(r)),
            "label_ko": REGIME_LABELS_KO.get(label, label),
            "cumulative_return_pct": round(float(cum) * 100, 2),
            "annualized_return_pct": round(float(ann) * 100, 2),
            "sharpe": round(float(sharpe), 2),
            "effective_sharpe": round(float(eff_sharpe), 2),
            "sample_weight": round(float(sample_w), 3),
            "max_drawdown_pct": round(float(dd) * 100, 2),
            "win_rate_pct": round(win_rate, 2),
        }

    # 프론트엔드 호환: bull_quiet + bull_volatile → 합산 "bull" 키
    bull_r = eq_ret[reg.isin(["bull_quiet", "bull_volatile"])]
    if len(bull_r) >= 5:
        cum_b = (1 + bull_r).prod() - 1
        ann_b = (1 + cum_b) ** (252 / len(bull_r)) - 1
        sh_b = (bull_r.mean() / bull_r.std() * np.sqrt(252)) if bull_r.std() > 0 else 0
        roll_max_b = (1 + bull_r).cumprod().cummax()
        dd_b = ((1 + bull_r).cumprod() / roll_max_b - 1).min()
        eff_b, sw_b = shrink_sharpe(sh_b, len(bull_r))
        out["bull"] = {
            "days": int(len(bull_r)),
            "label_ko": "상승장",
            "cumulative_return_pct": round(float(cum_b) * 100, 2),
            "annualized_return_pct": round(float(ann_b) * 100, 2),
            "sharpe": round(float(sh_b), 2),
            "effective_sharpe": round(float(eff_b), 2),
            "sample_weight": round(float(sw_b), 3),
            "max_drawdown_pct": round(float(dd_b) * 100, 2),
            "win_rate_pct": round(float((bull_r > 0).mean() * 100), 2),
        }
    else:
        out["bull"] = {"days": int(len(bull_r)), "note": "샘플 부족"}

    # 취약 regime: effective_sharpe(표본 가중치 적용 후) 기준으로 선정 — bull 합산 키 제외
    valid = {k: v for k, v in out.items()
             if "effective_sharpe" in v and k not in ("bull",)}
    weak = min(valid, key=lambda k: valid[k]["effective_sharpe"]) if valid else None

    # 현재 레짐
    current = regimes.iloc[-1] if not regimes.empty else "sideways"
    current_ko = REGIME_LABELS_KO.get(current, current)

    # 분석 지수/ticker 정보
    analyzed_ticker = ticker.upper() if ticker else "종목"

    # ─────────────── 자세한 자연어 요약 ───────────────
    narrative_parts: list[str] = []
    ticker_str = f"{analyzed_ticker} " if ticker else ""

    narrative_parts.append(
        f"▶ {ticker_str}시장 국면 분석 결과\n\n"
        f"이 분석은 200일 이동평균선(MA200)과 60일 변동성을 기준으로 시장 상황을 5가지 국면으로 "
        f"자동 분류한 결과입니다. "
        f"200일 이동평균선은 지난 200거래일의 평균 주가로, 장기 추세의 방향을 나타냅니다 — "
        f"주가가 이 선 위에 있으면 장기 상승 추세, 아래에 있으면 장기 하락 추세로 판단합니다. "
        f"60일 변동성은 하루하루 주가가 얼마나 크게 흔들리는지를 나타내는 지표로, "
        f"높을수록 시장이 불안정하고 예측하기 어렵다는 것을 의미합니다."
    )

    dist = {k: int((regimes_raw == k).sum()) for k in REGIME_LABELS}
    total_analyzed = sum(dist.values())
    if total_analyzed > 0:
        top_regimes = sorted(dist.items(), key=lambda x: x[1], reverse=True)[:3]
        top_str = "、".join(
            f"{REGIME_LABELS_KO.get(k, k)}({v}일, {v / total_analyzed * 100:.0f}%)"
            for k, v in top_regimes if v > 0
        )
        narrative_parts.append(
            f"\n\n분석 기간 동안 가장 많이 나타난 국면은 {top_str} 순이었습니다. "
            f"이 분포는 이 전략이 실제로 어떤 시장 환경에서 주로 운용되어 왔는지를 보여줍니다."
        )

    if valid:
        items_sorted = sorted(valid.items(), key=lambda kv: kv[1].get("effective_sharpe", 0))
        worst_k, worst_v = items_sorted[0]
        best_k, best_v = items_sorted[-1]
        worst_ko = REGIME_LABELS_KO.get(worst_k, worst_k)
        best_ko = REGIME_LABELS_KO.get(best_k, best_k)

        regime_descs = {
            "bull_quiet": "주가가 장기 상승 추세에 있으면서 변동성도 낮은 가장 이상적인 투자 환경",
            "bull_volatile": "주가는 상승 중이지만 일일 등락이 커서 급락 위험도 공존하는 불안정한 상승 구간",
            "bear": "주가가 장기 하락 추세에 있어 매수 포지션에 불리한 환경",
            "sideways": "뚜렷한 방향 없이 횡보하며 추세 추종 전략의 신호 오류(휩쏘)가 많아지는 구간",
            "high_vol_unstable": "변동성이 극단적으로 높고 하락 위험이 매우 큰 시장 불안정 구간",
        }

        narrative_parts.append(
            f"\n\n이 전략의 국면별 성과를 살펴보면, {best_ko} 구간에서 "
            f"Sharpe {best_v.get('sharpe', 0):.2f}, 누적 수익 {best_v.get('cumulative_return_pct', 0):.1f}%"
            f"로 가장 좋은 성과를 기록했습니다. "
            f"{best_ko}란 {regime_descs.get(best_k, best_ko)}을(를) 뜻하며, "
            f"이 전략이 그 환경에 특히 잘 맞음을 시사합니다."
        )
        narrative_parts.append(
            f"\n반면 {worst_ko} 구간에서는 Sharpe {worst_v.get('sharpe', 0):.2f}, "
            f"MDD {worst_v.get('max_drawdown_pct', 0):.1f}%로 가장 약한 성과를 보였습니다. "
            f"{worst_ko}란 {regime_descs.get(worst_k, worst_ko)}입니다. "
            f"이 구간에서는 포지션 규모를 줄이거나 손절 기준을 강화하는 것이 도움이 됩니다."
        )

    advice_map = {
        "bull_quiet": (
            "현재는 전략 운용에 가장 유리한 환경입니다. 장기 상승 추세가 안정적으로 유지되고 있어 "
            "전략의 신호에 적극적으로 따를 수 있는 시기입니다. 단, 언제든 국면이 바뀔 수 있으므로 "
            "손절 기준은 항상 유지하세요."
        ),
        "bull_volatile": (
            "상승 추세이지만 변동성이 높아 주의가 필요합니다. "
            "갑작스러운 급락이 올 수 있으므로 손절 기준을 명확히 하고, 레버리지 사용은 자제하세요. "
            "수익이 나고 있더라도 익절 기준을 낮추어 이익을 먼저 확보하는 전략이 유효합니다."
        ),
        "bear": (
            "현재 시장은 장기 하락 추세입니다. 매수 전략의 경우 손실이 확대될 수 있으므로, "
            "포지션 규모를 대폭 줄이거나 현금 비중을 늘리는 것을 고려하세요. "
            "하락장에서도 수익을 낼 수 있는 인버스 ETF나 현금 보유 비중 확대 전략을 병행할 수 있습니다."
        ),
        "sideways": (
            "뚜렷한 방향이 없는 횡보 구간입니다. 추세 추종 전략의 경우 잦은 매매 신호(휩쏘)로 "
            "거래 비용이 과도하게 발생할 수 있습니다. "
            "명확한 추세가 형성될 때까지 관망하거나, 거래 빈도를 줄이는 전략이 비용을 아낄 수 있습니다."
        ),
        "high_vol_unstable": (
            "시장이 극도로 불안정한 상태입니다. 하루에도 수 퍼센트의 급등락이 반복될 수 있습니다. "
            "레버리지를 즉시 줄이고, 안전 자산(채권, 현금 등)으로 일시 이동하는 것을 강력히 권장합니다. "
            "이 구간에서의 매수는 단기적으로 큰 손실로 이어질 위험이 높습니다."
        ),
    }
    advice = advice_map.get(current, "현재 시장 상황을 면밀히 모니터링하세요.")
    narrative_parts.append(
        f"\n\n💡 현재 국면 ({current_ko}) — {advice}"
    )

    narrative = "".join(narrative_parts)

    # ─────────────── 레짐 타임라인 (주간 샘플링) ───────────────
    regime_timeline = []
    try:
        close_aligned = close.reindex(regimes_raw.index)
        step = max(1, len(regimes_raw) // 500)
        for dt, regime_val in regimes_raw.iloc[::step].items():
            close_val = close_aligned.get(dt) if hasattr(close_aligned, 'get') else None
            if close_val is None and dt in close_aligned.index:
                close_val = close_aligned.loc[dt]
            if regime_val is not None and not (isinstance(regime_val, float) and np.isnan(regime_val)):
                regime_timeline.append({
                    "date": str(dt.date()) if hasattr(dt, 'date') else str(dt)[:10],
                    "regime": str(regime_val),
                    "close": round(float(close_val), 4) if close_val is not None and not np.isnan(float(close_val)) else None,
                })
    except Exception:
        regime_timeline = []

    return {
        "per_regime": out,
        "weak_regime": weak,
        "weakest_regime": weak,
        "current_regime": current,
        "current_regime_ko": current_ko,
        "headline": narrative,
        "narrative": narrative,
        "method": effective_method,                  # 실제 사용된 방법(폴백 반영)
        "method_requested": method,                  # 요청된 방법
        "hmm_fallback": bool(method == "hmm" and effective_method != "hmm"),
        "hmm_causal": hmm_causal,                    # HMM 라벨 인과성(True=룩어헤드 제거, False=전체표본 사후, None=rule)
        "smoothing": int(smoothing or 0),
        "n_states": int(n_states),
        "regime_distribution": {k: int((reg == k).sum()) for k in REGIME_LABELS},
        "ticker": analyzed_ticker,
        "period": period or "",
        "regime_timeline": regime_timeline,
        "analysis_basis": "MA200 (200일 이동평균) + Vol60 (60일 실현 변동성)",
    }
