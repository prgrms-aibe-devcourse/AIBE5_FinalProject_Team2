"""Raw-algo Lean 템플릿 — DSL codegen 으로 표현 불가한 stateful 전략.

StrategyRegistry(=DSL 프리셋)와 분리한 별도 카탈로그. 단순 entry/exit DSL 로는
분할매수·물타기·익절 사다리 같은 상태머신을 못 담으므로, 손작성 Lean QCAlgorithm
템플릿을 직접 생성한다. v1 runner 와 v2 워커가 공통으로 이 모듈을 사용(단일 소스).

데이터는 codegen 과 동일한 커스텀 PythonData(USEquity/KRXEquity)로 /Lean/Data 의 우리 CSV 를
직접 읽는다 — 표준 AddEquity 는 map_files·네이티브 포맷을 요구해 주입 CSV 로는 실패하기 때문.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# raw-algo 식별자 집합 — runner/worker 가 codegen 대신 이 경로로 분기.
RAW_ALGOS = {"infinite_buying"}


# ── 무한매수법 Lean 알고리즘 헤더(파라미터 주입). 본문은 dict·중괄호가 많아 .format 안 함. ──
INF_HEADER = '''from AlgorithmImports import *
from datetime import datetime

# 무한매수법(Infinite Buying) — vectorbt run_infinite_buying() 의 의사결정 로직(분할매수·물타기·
# 익절·restart 사다리)을 Lean QCAlgorithm(Initialize/OnData)으로 포팅. Lean 이 실행·체결·통계 담당.
# 데이터: 커스텀 PythonData(USEquity/KRXEquity)로 /Lean/Data 의 우리 CSV 직접 읽기.
P = {params}
TICKERS = {tickers}
WEIGHTS = {weights}
MKT = "{mkt}"
CUR = "{cur}"
START = ({sy}, {sm}, {sd})
END = ({ey}, {em}, {ed})
CASH = {cap}
'''

# 커스텀 PythonData(USEquity/KRXEquity) — codegen·raw-algo·자유코드(custom) 공용.
# /Lean/Data 의 우리 CSV 를 직접 읽는다(표준 AddEquity 는 map_files·네이티브 포맷 필요 → 회피).
# 전역 P·CUR 에 의존하지 않아 어떤 알고리즘에도 안전하게 프리펜드 가능.
DATA_CLASSES = '''

class USEquity(PythonData):
    def GetSource(self, config, date, isLive):
        sym = config.Symbol.Value.lower()
        return SubscriptionDataSource("/Lean/Data/equity/usa/daily/" + sym + ".csv", SubscriptionTransportMedium.LocalFile, FileFormat.Csv)
    def Reader(self, config, line, date, isLive):
        if not line.strip():
            return None
        d = USEquity(); d.Symbol = config.Symbol
        try:
            c = line.split(",")
            d.Time = datetime.strptime(c[0], "%Y%m%d")
            d.Value = float(c[4])
            d["Open"] = float(c[1]); d["High"] = float(c[2]); d["Low"] = float(c[3]); d["Close"] = float(c[4]); d["Volume"] = int(c[5])
        except Exception:
            return None
        return d


class KRXEquity(PythonData):
    def GetSource(self, config, date, isLive):
        sym = config.Symbol.Value.lower()
        return SubscriptionDataSource("/Lean/Data/equity/krx/daily/" + sym + ".csv", SubscriptionTransportMedium.LocalFile, FileFormat.Csv)
    def Reader(self, config, line, date, isLive):
        if not line.strip():
            return None
        d = KRXEquity(); d.Symbol = config.Symbol
        try:
            c = line.split(",")
            d.Time = datetime.strptime(c[0], "%Y%m%d")
            d.Value = float(c[4])
            d["Open"] = float(c[1]); d["High"] = float(c[2]); d["Low"] = float(c[3]); d["Close"] = float(c[4]); d["Volume"] = int(c[5]) if len(c) > 5 and c[5] else 0
        except Exception:
            return None
        return d
'''

# 무한매수법 전용 수수료 모델(전역 P·CUR 참조 — 무한 조립에만 사용).
INF_FEE_MODEL = '''

class InfFeeModel(FeeModel):
    def GetOrderFee(self, parameters):
        v = abs(parameters.Order.GetValue(parameters.Security))
        return OrderFee(CashAmount(v * float(P["fees"]), CUR))
'''

INF_BODY = '''

class Algorithm(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(START[0], START[1], START[2])
        self.SetEndDate(END[0], END[1], END[2])
        self.SetCash(CASH)
        self.split = float(P["split"])
        self.tp = float(P["take_profit_pct"]) / 100.0
        self.loc_offset = float(P["loc_offset_pct"]) / 100.0
        self.leave = float(P["leave_shares"])
        self.compound = bool(P["compound"])
        self.restart = float(P["restart_buy_fraction"])
        self.fees = float(P["fees"])
        self.slip = float(P["slippage"])
        data_class = USEquity if MKT == "us" else KRXEquity
        self.symbols = []
        for t in TICKERS:
            sym = self.AddData(data_class, t, Resolution.Daily).Symbol
            self.symbols.append(sym)
            self.Securities[sym].SetFeeModel(InfFeeModel())
        total = float(self.Portfolio.Cash)
        if WEIGHTS:
            wsum = sum(max(0.0, WEIGHTS.get(str(s.Value), 0.0)) for s in self.symbols) or 1.0
            alloc = {s: total * (max(0.0, WEIGHTS.get(str(s.Value), 0.0)) / wsum) for s in self.symbols}
        else:
            alloc = {s: total / len(self.symbols) for s in self.symbols}
        self.st = {}
        for s in self.symbols:
            a = alloc[s]
            self.st[s] = {"cash": a, "qty": 0.0, "cost": 0.0, "avg": 0.0,
                          "cycle": 0.0, "budget": a / self.split, "cycles": 0}

    def OnData(self, data):
        for s in self.symbols:
            if not data.ContainsKey(s):
                continue
            bar = data[s]
            if bar is None:
                continue
            price = float(bar.Close)
            if price <= 0:
                continue
            self.Securities[s].SetMarketPrice(bar)
            st = self.st[s]
            # 1) 익절: 평단 대비 +tp% → leave 남기고 매도 + 사이클 리셋(+연아 restart 사다리)
            if st["qty"] > 0 and st["avg"] > 0 and price >= st["avg"] * (1.0 + self.tp):
                sell_qty = float(int(max(0.0, st["qty"] - self.leave)))
                if sell_qty > 0:
                    frac = sell_qty / st["qty"]
                    net = sell_qty * price * (1.0 - self.slip) * (1.0 - self.fees)
                    self.MarketOrder(s, -sell_qty)
                    st["cash"] += net
                    st["cost"] -= st["cost"] * frac
                    st["qty"] -= sell_qty
                    if st["qty"] <= 1e-9:
                        st["qty"] = 0.0; st["cost"] = 0.0; st["avg"] = 0.0
                    st["cycle"] = 0.0
                    st["cycles"] += 1
                    if self.compound and st["cash"] > 0:
                        st["budget"] = st["cash"] / self.split
                    if self.restart > 0 and st["cash"] > 0:
                        seed = min(st["budget"] * self.restart, st["cash"])
                        bp = price * (1.0 + self.slip)
                        qb = float(int((seed * (1.0 - self.fees)) / bp))
                        if qb > 0:
                            self.MarketOrder(s, qb)
                            st["cost"] += seed * (1.0 - self.fees)
                            st["qty"] += qb
                            st["avg"] = st["cost"] / st["qty"]
                            st["cash"] -= seed
                            st["cycle"] = self.restart
                    continue
            # 2) 매수: 평단 이하 → 1분할(평단매수), 평단~평단*(1+offset) → 0.5분할(물타기)
            if st["cycle"] >= self.split:
                continue
            if st["avg"] <= 0 or price <= st["avg"]:
                bf = 1.0
            elif price <= st["avg"] * (1.0 + self.loc_offset):
                bf = 0.5
            else:
                continue
            amount = st["budget"] * bf
            if amount > st["cash"]:
                amount = st["cash"]
            if amount <= 0:
                continue
            bp = price * (1.0 + self.slip)
            qb = float(int((amount * (1.0 - self.fees)) / bp))
            if qb <= 0:
                continue
            self.MarketOrder(s, qb)
            st["cost"] += amount * (1.0 - self.fees)
            st["qty"] += qb
            st["avg"] = st["cost"] / st["qty"]
            st["cash"] -= amount
            st["cycle"] += bf
'''


# FE 슬라이더/표시용 파라미터 정의(DSL 프리셋의 PARAM_DEFINITIONS 와 동형).
INF_PARAM_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "variant": {"default": "laoer", "type": "enum", "options": ["laoer", "yeona"],
                "description": "변형 — laoer(전량익절·복리) / yeona(연아무한매수법: 1주 남김·고정일매수·사다리)"},
    "split": {"default": 40, "min": 5, "max": 100, "type": "int", "description": "분할 횟수(원금/split)"},
    "take_profit_pct": {"default": 10.0, "min": 2, "max": 30, "type": "float", "description": "평단 대비 익절 트리거 %"},
    "loc_offset_pct": {"default": 15.0, "min": 0, "max": 30, "type": "float", "description": "평단보다 비싸도 물타기 허용 상단 %"},
    "leave_shares": {"default": 0.0, "min": 0, "max": 100, "type": "float", "description": "익절 시 남길 수량(연아=1)"},
    "restart_buy_fraction": {"default": 0.0, "min": 0.0, "max": 1.0, "type": "float", "description": "익절 후 보통가 재매수 분할(연아 사다리=0.5)"},
}

_CATALOG: Dict[str, Dict[str, Any]] = {
    "infinite_buying": {
        "id": "infinite_buying",
        "name": "무한매수법",
        "category": "composite",
        "description": "분할매수·물타기·익절 사다리 (laoer/연아 variant) — Lean raw-algo(상태머신).",
        "tags": ["infinite_buying", "split", "dca", "yeona", "raw_algo"],
        "raw_algo": True,
        "param_defs": INF_PARAM_DEFINITIONS,
    },
}


def _infinite_params(params: dict):
    """variant(연아/laoer) 기본값 + 사용자 오버라이드 머지 → (p_dict, variant)."""
    variant = str(params.get("variant", "laoer")).lower()
    if variant in ("yeonri", "yeona", "연리", "연아"):
        d = dict(split=40, take_profit_pct=13.0, loc_offset_pct=10.0, leave_shares=1.0,
                 compound=False, restart_buy_fraction=0.5, fees=0.0025, slippage=0.001)
    else:
        d = dict(split=40, take_profit_pct=10.0, loc_offset_pct=15.0, leave_shares=0.0,
                 compound=True, restart_buy_fraction=0.0, fees=0.0025, slippage=0.001)
    for k in list(d.keys()):
        if params.get(k) is not None:
            d[k] = params[k]
    return d, variant


def render_infinite_buying(symbols: List[str], start: str, end: str, cap: float,
                           params: dict, market: str = "us") -> str:
    """무한매수법 → Lean QCAlgorithm main.py 소스 생성."""
    p, _variant = _infinite_params(params or {})
    weights = (params or {}).get("ticker_weights")
    sy, sm, sd = (int(x) for x in start.split("-"))
    ey, em, ed = (int(x) for x in end.split("-"))
    mkt = "us" if market == "us" else "krx"
    cur = "USD" if mkt == "us" else "KRW"
    header = INF_HEADER.format(params=repr(p), tickers=repr(list(symbols)),
                               weights=repr(weights), mkt=mkt, cur=cur,
                               sy=sy, sm=sm, sd=sd, ey=ey, em=em, ed=ed, cap=repr(float(cap)))
    code = header + DATA_CLASSES + INF_FEE_MODEL + INF_BODY
    compile(code, "<infinite_buying>", "exec")  # 생성 즉시 문법 검증
    return code


# 자유 코드(custom) 경로 — IDE/Claude 가 쓴 Lean QCAlgorithm main.py 를 그대로 실행.
# 규약: 우리 주입 데이터를 읽으려면 알고가 self.AddData(USEquity, ticker, Resolution.Daily) 를 써야 한다
#       (표준 AddEquity 는 map_files 필요 → 데이터 0건). USEquity/KRXEquity 가 소스에 없으면 자동 프리펜드.
CUSTOM_HEADER = '''from AlgorithmImports import *
from datetime import datetime
'''


def render_custom(main_py: str, market: str = "us") -> str:
    """IDE/Claude 자유 작성 Lean main.py → 실행 가능 소스.

    USEquity 데이터 클래스가 없으면 헤더+DATA_CLASSES 를 프리펜드해 우리 /Lean/Data CSV 를 읽게 한다.
    이미 정의돼 있으면(사용자가 자체 데이터 처리) 손대지 않는다.
    """
    src = main_py or ""
    if "class USEquity" not in src:
        src = CUSTOM_HEADER + DATA_CLASSES + "\n" + src
    if "class " not in src or "QCAlgorithm" not in src:
        raise ValueError("custom main.py 에 QCAlgorithm 서브클래스가 없습니다")
    compile(src, "<custom_lean>", "exec")  # 문법 검증(실패 시 명확한 에러)
    return src


def render_raw_algo(strategy_id: str, symbols: List[str], start: str, end: str,
                    cap: float, market: str = "us", params: Optional[dict] = None) -> str:
    """raw-algo id → Lean main.py 소스. 미지원 id 는 명확히 실패."""
    params = params or {}
    if strategy_id == "infinite_buying":
        return render_infinite_buying(symbols, start, end, cap, params, market=market)
    raise ValueError(f"unknown raw-algo: {strategy_id} (지원: {sorted(RAW_ALGOS)})")


def raw_algo_meta(strategy_id: str) -> Dict[str, Any]:
    """raw-algo 메타(name/category/description). 미등록이면 빈 dict."""
    return _CATALOG.get(strategy_id, {})


def raw_algo_catalog() -> List[Dict[str, Any]]:
    """FE 목록 합류용 — DSL 프리셋과 동형({id,name,category,description,tags,params})."""
    out = []
    for meta in _CATALOG.values():
        out.append({
            "id": meta["id"], "name": meta["name"], "category": meta["category"],
            "description": meta["description"], "tags": meta.get("tags", []),
            "raw_algo": True, "params": meta.get("param_defs", {}),
        })
    return out
