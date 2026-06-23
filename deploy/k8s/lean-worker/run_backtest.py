"""Lean 워커 엔트리포인트 — K8s Job Pod(=docker run) 가 실행: 백테스트 1회 → 결과 → 종료.

핵심: DinD 없이 **이 컨테이너(=Lean 엔진) 안에서 launcher 를 직접 구동**한다.
  1) env(주문) 읽기 → 2) kis_backtest 로 프로젝트(main.py+데이터) 빌드
  → 3) workdir config.json 을 우리 알고리즘으로 덮어쓰고 dotnet launcher 직접 시동
  → 4) stdout 의 STATISTICS 파싱 → 5) BE 콜백 POST(있으면) + stdout 출력.

데이터: app.data.get_history (POLYGON_API_KEY 있으면 Polygon, 없으면 yfinance 폴백).
전략: DSL 프리셋은 codegen, stateful(무한매수법 등)은 kis_backtest.codegen.raw_algos 의 손작성 템플릿.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

LAUNCHER_DIR = "/Lean/Launcher/bin/Debug"
LAUNCHER_DLL = f"{LAUNCHER_DIR}/QuantConnect.Lean.Launcher.dll"
WORKDIR_CONFIG = Path(LAUNCHER_DIR) / "config.json"  # launcher 가 기본으로 읽는 config


def _env(k, d=""):
    return os.environ.get(k, d)


def post_result(url, token, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Internal-Token", token or "")
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"[worker] callback {url} -> {r.status}", flush=True)


def build_project(spec):
    """kis_backtest 로 프로젝트(main.py + 데이터 CSV + 워크스페이스) 빌드."""
    import app.lean  # noqa: F401  sys.path 주입(kis_backtest)
    import kis_backtest.strategies.preset  # noqa: F401  preset 등록
    from kis_backtest.strategies.registry import StrategyRegistry
    from kis_backtest.codegen.generator import LeanCodeGenerator, CodeGenConfig
    from kis_backtest.codegen.raw_algos import RAW_ALGOS, render_raw_algo, raw_algo_meta, render_custom
    from kis_backtest.lean.project_manager import LeanProjectManager
    from kis_backtest.lean.data_converter import DataConverter
    from kis_backtest.core.converters import from_definition
    from app.data.yf_client import get_history
    import pandas as pd

    sid, symbols = spec["strategy_id"], spec["symbols"]
    start, end, market = spec["start_date"], spec["end_date"], spec.get("market", "us")
    params = spec.get("param_overrides") or {}
    cap = float(spec.get("initial_capital", 100_000_000.0))
    is_raw = sid in RAW_ALGOS
    custom_src = params.get("main_py")  # IDE/Claude 자유 작성 Lean main.py (있으면 최우선)
    # raw-algo(무한매수법 등 stateful)·custom 은 레지스트리/codegen 우회.
    definition = None if (is_raw or custom_src) else (
        StrategyRegistry.build_with_params(sid, **params) if params else StrategyRegistry.build(sid))

    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")
    span = (datetime.now() - start_dt).days
    period = ("1y" if span <= 370 else "2y" if span <= 740 else "5y" if span <= 1850
              else "10y" if span <= 3700 else "max")
    data_dict = {}
    for sym in symbols:
        df = get_history(sym, period=period, interval="1d").reset_index().rename(columns={
            "Date": "date", "Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"})
        df["date"] = pd.to_datetime(df["date"])
        df = df[(df["date"] >= start_dt) & (df["date"] <= end_dt)].copy()
        if df.empty:
            raise ValueError(f"No OHLCV for {sym} {start}~{end}")
        data_dict[sym] = df
        src = df["source"].iloc[0] if "source" in df.columns and len(df) else "?"
        print(f"[worker] data {sym}: {len(df)} bars (source={src})", flush=True)

    run_id = f"{sid}-{uuid.uuid4().hex[:8]}"
    mt = "us" if market == "us" else "krx"
    cur = "USD" if market == "us" else "KRW"
    strat_name = ("사용자 전략" if custom_src else
                  raw_algo_meta(sid).get("name", sid) if is_raw else definition.name)
    project = LeanProjectManager.create_project(
        run_id=run_id, symbols=symbols, start_date=start, end_date=end, initial_capital=cap,
        strategy_type=sid, strategy_params=params, strategy_id=sid, strategy_name=strat_name,
        market_type=mt, currency=cur)
    # 이미지의 완전한 Lean 데이터 트리(/Lean/Data: map_files·factor_files·market-hours·symbol-properties 완비)에
    # 우리 데이터를 써넣는다. 커스텀 PythonData(USEquity)가 여기 CSV 를 직접 읽음.
    lean_daily = Path("/Lean/Data") / "equity" / ("usa" if mt == "us" else "krx") / "daily"
    lean_daily.mkdir(parents=True, exist_ok=True)
    DataConverter.export(data_dict, str(lean_daily), market_type=mt)
    if custom_src:
        code = render_custom(custom_src, market=mt)
    elif is_raw:
        code = render_raw_algo(sid, symbols, start, end, cap, market=mt, params=params)
    else:
        schema = from_definition(definition)
        code = LeanCodeGenerator(schema, CodeGenConfig(market=mt, initial_capital=cap)).generate(symbols, start, end)
    (project.project_dir / "main.py").write_text(code, encoding="utf-8")
    return project


def _parse_statistics(stdout):
    """엔진 stdout 의 'STATISTICS:: <name> <value>' 라인 → dict."""
    stats = {}
    for line in stdout.splitlines():
        i = line.find("STATISTICS::")
        if i < 0:
            continue
        rest = line[i + len("STATISTICS::"):].strip()
        parts = rest.rsplit(None, 1)   # 마지막 토큰=값, 앞=이름
        if len(parts) == 2:
            stats[parts[0].strip()] = parts[1].strip()
    return stats


def run_engine(project):
    """오븐 직접 시동 — workdir config.json 을 우리 알고리즘으로 덮어쓰고 dotnet launcher 실행(DinD 없음).

    (이전: --config 가 무시되고 기본 config.json(BasicTemplate, C#)이 읽혀 우리 전략이 안 돌던 문제 →
     기본 config.json 자체를 우리 것으로 덮어써 확실히 우리 전략이 돌게 한다. 컨테이너는 임시라 안전.)
    """
    main_py = project.project_dir / "main.py"
    src = main_py.read_text(encoding="utf-8")
    m = re.search(r"class\s+(\w+)\s*\(\s*QCAlgorithm", src) or re.search(r"class\s+(\w+)\s*\(", src)
    algo = m.group(1) if m else "main"
    # 절대경로 필수: launcher 는 cwd=/Lean/Launcher/bin/Debug 에서 돌아 상대경로면 main.py/데이터를 못 찾음.
    ws_data = Path("/Lean/Data")   # 이미지의 완전한 데이터 트리(map_files 등) + build_project 가 우리 데이터 주입함
    results = (project.project_dir / "backtests").resolve()
    results.mkdir(exist_ok=True)
    # 기본 config.json(엔진이 요구하는 완전한 핸들러 세트)을 보존하고, 알고리즘/데이터 값만 surgical 치환.
    # (미니멀 config 로 통째 덮어쓰면 엔진이 필수 키 부재로 SIGABRT(exit -6) → 기본 유지가 안정.)
    text = WORKDIR_CONFIG.read_text(encoding="utf-8")

    def _set(t, key, val):
        pat = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"[^"]*"')
        if pat.search(t):
            return pat.sub(lambda mm: mm.group(1) + '"' + val + '"', t, count=1)
        return re.sub(r'\{', '{\n  "' + key + '": "' + val + '",', t, count=1)  # 없으면 추가

    text = _set(text, "algorithm-language", "Python")
    text = _set(text, "algorithm-type-name", algo)
    text = _set(text, "algorithm-location", str(main_py.resolve()))
    text = _set(text, "data-folder", str(ws_data) + "/")
    text = _set(text, "results-destination-folder", str(results))
    WORKDIR_CONFIG.write_text(text, encoding="utf-8")
    print(f"[worker] engine start: algo={algo} data={ws_data}", flush=True)
    p = subprocess.run(["dotnet", LAUNCHER_DLL], cwd=LAUNCHER_DIR,
                       capture_output=True, text=True, timeout=int(_env("TIMEOUT_SEC", "1800")))
    out = p.stdout or ""
    err = p.stderr or ""
    print(out[-4500:], flush=True)
    if err.strip():
        print("[worker] STDERR(tail):\n" + err[-3000:], flush=True)
    if p.returncode != 0:
        raise RuntimeError(f"lean engine exit {p.returncode}: {(err[-600:] or out[-600:]).strip()}")
    stats = _parse_statistics(out)
    if not stats:
        raise RuntimeError("엔진은 끝났으나 STATISTICS 파싱 0 — config/알고리즘 확인 필요")
    return {"statistics": stats}


def main():
    job_id = _env("LEAN_JOB_ID", "local-test")
    callback, token = _env("BE_CALLBACK_URL"), _env("BE_INTERNAL_TOKEN")
    spec = {
        "strategy_id": _env("STRATEGY_ID", "sma_crossover"),
        "symbols": json.loads(_env("SYMBOLS", '["SPY"]')),
        "start_date": _env("START_DATE", "2023-01-01"),
        "end_date": _env("END_DATE", "2024-01-01"),
        "market": _env("MARKET", "us"),
        "param_overrides": json.loads(_env("PARAM_OVERRIDES", "null")),
    }
    print(f"[worker] job={job_id} spec={spec} polygon={'Y' if _env('POLYGON_API_KEY') else 'N'}", flush=True)
    try:
        project = build_project(spec)
        result = run_engine(project)
        result["success"] = True
        print("[worker] RESULT " + json.dumps(result.get("statistics", {}))[:1000], flush=True)
        if callback:
            post_result(callback, token, {"jobId": job_id, "status": "DONE", "result": result})
        return 0
    except Exception as e:  # noqa: BLE001
        print(f"[worker] ERROR {type(e).__name__}: {e}", flush=True)
        if callback:
            try:
                post_result(callback, token, {"jobId": job_id, "status": "ERROR", "error": str(e)})
            except Exception:
                pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
