"""
Feature engineering + XGBoost classifier predicting next-day direction (UP/DOWN).
Used as a probabilistic signal layer on top of rule-based strategies.

v2 개선사항 (ai_opt 브랜치):
  - 피처 확장: 13개 → 21개 (MA50/MA200 위치, 볼륨이상치, ATR, Bear Pressure, 장기 모멘텀)
  - Early stopping: eval_set 기반 과적합 방지 (n_estimators 200→400, lr 0.05→0.03)
  - predict_signal_for_yeonri(): 연리무한매수 전용 신호 통합 API
"""
from __future__ import annotations
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score

try:
    from xgboost import XGBClassifier
    _XGB_AVAILABLE = True
except Exception:  # pragma: no cover
    XGBClassifier = None  # type: ignore[assignment]
    _XGB_AVAILABLE = False

from app.config import MODEL_DIR


# ---------- Feature engineering ----------

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input: OHLCV DataFrame (Close 필수, High/Low/Volume 선택).
    Output: feature DataFrame with target y_next_up.

    v2: 21개 피처 (기존 13 + 신규 8)
      신규: above_ma50, above_ma200, trend_strength,
             vol_ratio_5, vol_ratio_60, atr_14_pct, bear_pressure, mom_60
    """
    out = pd.DataFrame(index=df.index)
    close = df["Close"]
    high = df.get("High", close) if isinstance(df, pd.DataFrame) else close
    low = df.get("Low", close) if isinstance(df, pd.DataFrame) else close
    vol = df.get("Volume", pd.Series(1.0, index=df.index)) if isinstance(df, pd.DataFrame) else pd.Series(1.0, index=df.index)

    # ── v1 피처 ────────────────────────────────────────────────
    out["ret_1"] = close.pct_change(1)
    out["ret_5"] = close.pct_change(5)
    out["ret_20"] = close.pct_change(20)

    sma20 = close.rolling(20).mean()
    sma60 = close.rolling(60).mean()
    sma200 = close.rolling(200).mean()
    out["sma_20_ratio"] = close / sma20 - 1
    out["sma_60_ratio"] = close / sma60 - 1
    out["sma_200_ratio"] = close / sma200 - 1

    out["vol_20"] = close.pct_change().rolling(20).std()
    out["vol_60"] = close.pct_change().rolling(60).std()

    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = -delta.where(delta < 0, 0).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    out["rsi_14"] = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12).mean()
    ema26 = close.ewm(span=26).mean()
    out["macd"] = ema12 - ema26
    out["macd_signal_diff"] = out["macd"] - out["macd"].ewm(span=9).mean()

    out["range_pct"] = (high - low) / close
    out["vol_ratio_20"] = vol / vol.rolling(20).mean()

    # ── v2 신규 피처 ────────────────────────────────────────────
    # MA50/MA200 위치: 연리 평단매수의 "추세 방향" 컨텍스트
    ma50 = close.rolling(50).mean()
    out["above_ma50"] = (close > ma50).astype(float)
    out["above_ma200"] = (close > sma200).astype(float)

    # 골든크로스 강도: MA50/MA200 비율 — 추세 동력
    out["trend_strength"] = (ma50 / sma200 - 1).clip(-0.5, 0.5)

    # 볼륨 이상치: 급등 전 볼륨 서지 (5일/60일 비율)
    out["vol_ratio_5"] = vol / vol.rolling(5).mean()
    out["vol_ratio_60"] = vol / vol.rolling(60).mean()

    # ATR(14) %: 레버리지 ETF 일중 변동폭
    tr = pd.concat([
        (high - low),
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    out["atr_14_pct"] = tr.rolling(14).mean() / close

    # Bear Pressure: 종가가 일중 범위 하단에 가까울수록 매도압력 강함
    hl_range = (high - low).replace(0, np.nan)
    out["bear_pressure"] = (high - close) / hl_range

    # 60일 모멘텀: 연리 분할매수 "평단 아래 매수" 효과와 직결
    out["mom_60"] = close.pct_change(60)

    # Target
    out["y_next_up"] = (close.shift(-1) > close).astype(int)

    return out.dropna()


FEATURE_COLS_V1 = [
    "ret_1", "ret_5", "ret_20",
    "sma_20_ratio", "sma_60_ratio", "sma_200_ratio",
    "vol_20", "vol_60",
    "rsi_14",
    "macd", "macd_signal_diff",
    "range_pct", "vol_ratio_20",
]

FEATURE_COLS = FEATURE_COLS_V1 + [
    "above_ma50", "above_ma200", "trend_strength",
    "vol_ratio_5", "vol_ratio_60",
    "atr_14_pct", "bear_pressure", "mom_60",
]


# ---------- Train ----------

def train_model(df: pd.DataFrame, ticker: str) -> dict:
    if not _XGB_AVAILABLE:
        return {
            "ticker": ticker.upper(), "error": "xgboost not installed",
            "samples": 0, "cv_avg": {}, "model_path": "",
        }
    feats = build_features(df)
    X = feats[FEATURE_COLS]
    y = feats["y_next_up"]

    tscv = TimeSeriesSplit(n_splits=5)
    cv_scores = []
    splits = list(tscv.split(X))

    for fold_i, (train_idx, test_idx) in enumerate(splits):
        is_last = (fold_i == len(splits) - 1)
        if is_last:
            # v2: early stopping — 마지막 폴드 test set을 검증으로 사용
            m = XGBClassifier(
                n_estimators=400, max_depth=4, learning_rate=0.03,
                subsample=0.85, colsample_bytree=0.85,
                eval_metric="logloss", random_state=42,
                early_stopping_rounds=30,
            )
            m.fit(
                X.iloc[train_idx], y.iloc[train_idx],
                eval_set=[(X.iloc[test_idx], y.iloc[test_idx])],
                verbose=False,
            )
        else:
            m = XGBClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.9, colsample_bytree=0.9,
                eval_metric="logloss", random_state=42,
            )
            m.fit(X.iloc[train_idx], y.iloc[train_idx])

        pred = m.predict(X.iloc[test_idx])
        cv_scores.append({
            "accuracy": float(accuracy_score(y.iloc[test_idx], pred)),
            "precision": float(precision_score(y.iloc[test_idx], pred, zero_division=0)),
            "recall": float(recall_score(y.iloc[test_idx], pred, zero_division=0)),
        })

    # 최종 모델: 마지막 20%를 holdout으로 early stopping
    split_pt = int(len(X) * 0.8)
    final = XGBClassifier(
        n_estimators=400, max_depth=4, learning_rate=0.03,
        subsample=0.85, colsample_bytree=0.85,
        eval_metric="logloss", random_state=42,
        early_stopping_rounds=30,
    )
    final.fit(
        X.iloc[:split_pt], y.iloc[:split_pt],
        eval_set=[(X.iloc[split_pt:], y.iloc[split_pt:])],
        verbose=False,
    )

    path = MODEL_DIR / f"xgb_{ticker.upper()}.joblib"
    joblib.dump({"model": final, "features": FEATURE_COLS, "version": 2}, path)

    avg = {k: round(np.mean([s[k] for s in cv_scores]), 4) for k in cv_scores[0]}
    return {
        "ticker": ticker.upper(),
        "samples": len(X),
        "cv_avg": avg,
        "model_path": str(path),
        "n_features": len(FEATURE_COLS),
        "best_iteration": getattr(final, "best_iteration", None),
    }


def load_model(ticker: str):
    path = MODEL_DIR / f"xgb_{ticker.upper()}.joblib"
    if not path.exists():
        return None
    return joblib.load(path)


def predict_proba_up(df: pd.DataFrame, ticker: str) -> dict | None:
    if not _XGB_AVAILABLE:
        return None
    bundle = load_model(ticker)
    if bundle is None:
        return None
    feats = build_features(df)
    if feats.empty:
        return None
    # v1/v2 저장 모델 혼재 환경 호환
    saved_features = bundle.get("features", FEATURE_COLS)
    available = [c for c in saved_features if c in feats.columns]
    X_latest = feats[available].iloc[[-1]]
    proba = float(bundle["model"].predict_proba(X_latest)[0][1])
    return {
        "proba_up": round(proba, 4),
        "as_of": str(feats.index[-1].date()),
        "model_version": bundle.get("version", 1),
        "n_features": len(available),
    }


def predict_signal_for_yeonri(
    df: pd.DataFrame,
    ticker: str,
    strong_down_threshold: float = 0.38,
) -> dict:
    """
    연리무한매수법 전용 XGBoost 오버레이 신호.

    연리 매수 로직과의 통합:
      - price <= avg_price (loc_avg 평단매수): 항상 실행 (이 함수 무관)
      - avg_price < price <= avg_price*(1+loc_offset) (loc_large):
          proba_up < strong_down_threshold → SKIP_LOC_LARGE (하락 예측 강함)
          그 외 → ALLOW_LOC_LARGE

    Parameters
    ----------
    strong_down_threshold : float
        이 미만이면 loc_large 매수를 건너뜀 (기본 0.38).
        0.0 으로 설정하면 XGBoost 오버레이 비활성화(항상 ALLOW).
    """
    result = predict_proba_up(df, ticker)
    if result is None:
        return {
            "signal": "NO_MODEL",
            "proba_up": None,
            "reason": "XGBoost 모델 없음 — 기본 연리 규칙 그대로 실행",
        }

    p = result["proba_up"]
    if p < strong_down_threshold:
        signal = "SKIP_LOC_LARGE"
        reason = (
            f"XGBoost 하락 확률 {(1-p)*100:.0f}% (상승 {p*100:.0f}%) → "
            f"loc_large 매수 대기 (평단 아래 loc_avg는 정상 실행)"
        )
    else:
        signal = "ALLOW_LOC_LARGE"
        reason = f"XGBoost 상승 확률 {p*100:.0f}% → loc_large 정상 실행"

    return {
        "signal": signal,
        "proba_up": p,
        "as_of": result.get("as_of"),
        "reason": reason,
    }
