import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Editor, { DiffEditor } from "@monaco-editor/react";
import {
  Play, Rocket, Terminal, BarChart3, Code2, Loader, Boxes, Save, Bot,
  FolderOpen, Database, FileCode, ChevronDown, ChevronRight, X,
  ShoppingCart, AlertCircle, CheckCircle2, GitBranch, FilePlus, FolderPlus,
  ExternalLink, Send, Plus, Lightbulb, Settings, BookOpen, PanelLeftOpen, Lock,
} from "lucide-react";
import SettingsModal from "../components/shell/SettingsModal";
import { useTheme } from "./ThemeContext";
import claudeBotImg from "../assets/claude_bot.png";
import {
  getWorkspace, listWorkspaces, createWorkspace, selectStrategyCandidate, runBacktest, runRegime, runTrust, saveCode, queueOrders,
  getDataStatus, getDataPreview, getDatasetsCatalog, getDatasetPreview, leanBacktestStart, leanBacktestStatus, leanListStrategies, getLeanHealth,
  runClaudeAgentStart, runClaudeAgentStatus, resetClaudeSession, runImproveProposal, runCompareBacktest,
  getWorkspaceGitStatus, getWorkspaceFileTree, pullWorkspaceFile, deleteWorkspaceFile,
  listBrokerAccounts, getBinanceBalance, getWorkspaceCommit,
  linkWorkspaceBroker, updateWorkspaceStatus, setBrokerTrading, setBrokerAutoExecute,
  getDeveloperAccess, getBrokerBalance,
} from "./alphaApi";
import GitPanel from "./GitPanel";
import TerminalTabs from "./TerminalTabs";
import { TrendLineChart, SubIndicatorChart, calcSMA, calcEMA, calcBollinger } from "./tabs/helpers";
import RepoExplorer from "./RepoExplorer";
import claudeBot from "../assets/claude_bot.png";
import { ClaudeKeyBadge } from "./ClaudeKeyConnect";

// ── 언어 감지 ─────────────────────────────────────────────────────────────────
function detectLang(fileName) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  return {
    py:"python", js:"javascript", jsx:"javascript", ts:"typescript", tsx:"typescript",
    java:"java", md:"markdown", json:"json", yaml:"yaml", yml:"yaml",
    html:"html", css:"css", sh:"bash", txt:"plaintext", sql:"sql",
    rs:"rust", go:"go", rb:"ruby", cpp:"cpp", c:"c", cs:"csharp",
  }[ext] || "plaintext";
}

// ── 파일 트리 빌더 (flat list → 재귀 트리) ────────────────────────────────────
function buildTree(entries) {
  const root = { children: {}, files: [] };
  for (const entry of entries) {
    const parts = entry.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) node.children[parts[i]] = { children: {}, files: [] };
      node = node.children[parts[i]];
    }
    node.files.push({ name: parts[parts.length - 1], path: entry.path });
  }
  return root;
}

// ── 재귀 트리 노드 컴포넌트 ───────────────────────────────────────────────────
function RepoTreeNode({ name, node, depth, onOpen, activePath, modifiedSet, fetching }) {
  const [open, setOpen] = useState(depth < 2);
  const dirs = useMemo(
    () => Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b)),
    [node.children]
  );
  const files = useMemo(
    () => [...node.files].sort((a, b) => a.name.localeCompare(b.name)),
    [node.files]
  );
  const childDepth = name ? depth + 1 : depth;
  const indent = childDepth * 12 + 8;

  return (
    <div>
      {name && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display:"flex", alignItems:"center", gap:4,
            padding:`4px 8px 4px ${8 + depth * 12}px`,
            cursor:"pointer", userSelect:"none", color:"#9CA3AF", fontSize:11, fontWeight:600,
          }}
        >
          {open ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
          <FolderOpen size={11} color="#60a5fa" style={{flexShrink:0}}/>
          {name}
        </div>
      )}
      {(open || !name) && (
        <>
          {dirs.map(([dir, child]) => (
            <RepoTreeNode key={dir} name={dir} node={child} depth={childDepth}
              onOpen={onOpen} activePath={activePath} modifiedSet={modifiedSet} fetching={fetching}/>
          ))}
          {files.map(f => {
            const isActive = f.path === activePath;
            const isModified = modifiedSet.has(f.path);
            const isFetching = f.path === fetching;
            return (
              <div key={f.path}
                onClick={() => !isFetching && onOpen(f.path)}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:`3px 8px 3px ${indent}px`,
                  cursor: isFetching ? "wait" : "pointer",
                  background: isActive ? "rgba(96,165,250,0.1)" : "transparent",
                  color: isActive ? "#e2e8f0" : "#6B7280", fontSize:11,
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
              >
                {isFetching
                  ? <Loader size={10} style={{animation:"spin 1s linear infinite",flexShrink:0}}/>
                  : <FileCode size={10} color={isActive ? "#93c5fd" : "#60a5fa"} style={{flexShrink:0}}/>
                }
                <span style={{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {f.name}
                </span>
                {isModified && (
                  <span style={{width:6, height:6, borderRadius:999, background:"#60a5fa", flexShrink:0}}/>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── 코드 생성 유틸 ─────────────────────────────────────────────────────────────
function generateCodeFromConfig(cfg) {
  if (!cfg) return null;
  const stype   = cfg.strategy_type || "moving_average_timing";
  const assets  = cfg.assets || ["SPY"];
  const params  = cfg.parameters || {};
  const name    = cfg.strategy_name || "My Strategy";
  const ticker  = assets[0] || "SPY";
  const smFast  = params.sma_fast || 20;
  const smSlow  = params.ma_window || params.sma_slow || 60;
  const mFast   = params.macd_fast || 12;
  const mSlow   = params.macd_slow || 26;
  const mSig    = params.macd_signal || 9;
  const rPeriod = params.rsi_period || 14;
  const rLow    = params.rsi_low || 30;
  const rHigh   = params.rsi_high || 70;
  const vix     = params.vix_threshold || 25;
  // 무한매수(IB) / 밸류리밸런싱(VR) 파라미터 — 최적화 스윕 대상
  const ibSplit = params.split || 40;
  const ibTp    = params.take_profit_pct ?? 10.0;
  const ibLoc   = params.loc_offset_pct ?? 15.0;
  const vrRd    = params.rebalance_days || 10;
  const vrEr    = params.expected_return ?? 0.02;
  const vrBand  = params.band_pct ?? 0.20;
  const vrPool  = params.pool_target_pct ?? 0.50;
  const vrIpool = params.initial_pool_pct ?? 0.50;
  const initCap = params.initial_capital ?? 10000;
  // 모멘텀 로테이션(momentum_rotation) 파라미터 — 멀티자산 상대강도 랭킹
  const momLookback = params.lookback_days || 252;
  const momSkip     = params.skip_recent_days || 21;
  const momTopN     = params.top_n || 3;
  const momReb      = params.rebalance_days || 21;
  const momCash     = params.cash_asset || "BIL";
  const tickersList = assets.map(a => `"${a}"`).join(", ");
  const clsName = name.replace(/[^a-zA-Z0-9]/g, "").replace(/^[0-9]/, "S") || "Strategy";

  if (stype === "momentum_rotation") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: 모멘텀 로테이션 (Momentum Rotation · 멀티자산 상대강도 랭킹)
TICKERS          = [${tickersList}]
LOOKBACK_DAYS    = ${momLookback}      # 룩백 (12-1 모멘텀, ≈12개월)
SKIP_RECENT_DAYS = ${momSkip}       # 최근 제외 (≈1개월)
TOP_N            = ${momTopN}        # 보유 종목 수 (동일가중)
REBALANCE_DAYS   = ${momReb}       # 리밸런싱 주기 (영업일)
CASH_ASSET       = "${momCash}"      # 약세장 대피 자산 (절대모멘텀<=0)

# 핵심 로직 (실행 엔진: AlphaHelix analytics · vectorbt 기반)
#   1) 매 REBALANCE_DAYS 마다 각 자산의 12-1 모멘텀(LOOKBACK 수익률 − 최근 SKIP 수익률) 계산
#   2) 모멘텀 상위 TOP_N 자산을 동일가중(1/TOP_N) 보유, 나머지 전량 매도
#   3) 절대모멘텀<=0 자산은 CASH_ASSET 으로 대피(리스크오프). 시그널 1bar shift(룩어헤드 방지)
def run(prices):
    # ... 12-1 모멘텀 랭킹 / top-N 리밸런싱 / 현금 게이트 (엔진 내부 구현) ...
    pass
`;
  }

  if (stype === "rsi_meanrev") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: RSI 평균회귀
TICKER       = "${ticker}"
BENCHMARK    = "SPY"
RSI_PERIOD   = ${rPeriod}
RSI_LOW      = ${rLow}
RSI_HIGH     = ${rHigh}

from AlgorithmImports import *

class ${clsName}(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(10_000)
        self.symbol = self.AddEquity(TICKER, Resolution.Daily).Symbol
        self.SetBenchmark(BENCHMARK)
        self.rsi = self.RSI(self.symbol, RSI_PERIOD, Resolution.Daily)
        self.SetWarmUp(RSI_PERIOD + 5)

    def OnData(self, data):
        if self.IsWarmingUp or not self.rsi.IsReady:
            return
        val = self.rsi.Current.Value
        if val < RSI_LOW:
            if not self.Portfolio[self.symbol].IsLong:
                self.SetHoldings(self.symbol, 1.0)
        elif val > RSI_HIGH:
            if self.Portfolio[self.symbol].IsLong:
                self.Liquidate()
`;
  }

  if (stype === "vix_risk_off") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: VIX 리스크 오프
TICKER          = "${ticker}"
BENCHMARK       = "SPY"
VIX_THRESHOLD   = ${vix}

from AlgorithmImports import *

class ${clsName}(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(10_000)
        self.symbol = self.AddEquity(TICKER, Resolution.Daily).Symbol
        self.vix    = self.AddEquity("VXX", Resolution.Daily).Symbol
        self.SetBenchmark(BENCHMARK)

    def OnData(self, data):
        if not data.ContainsKey(self.vix):
            return
        vix_val = data[self.vix].Close
        if vix_val <= VIX_THRESHOLD:
            if not self.Portfolio[self.symbol].IsLong:
                self.SetHoldings(self.symbol, 1.0)
        else:
            if self.Portfolio[self.symbol].IsLong:
                self.Liquidate()
`;
  }

  if (stype === "infinite_buying") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: 무한매수법 (Infinite Buying · LOC 분할매수)
TICKERS         = [${tickersList}]
SPLIT           = ${ibSplit}        # 분할 횟수 — 시드를 N등분해 매 거래일 1/N 매수
TAKE_PROFIT_PCT = ${ibTp}        # 평단 대비 익절 목표 수익률(%)
LOC_OFFSET_PCT  = ${ibLoc}        # 종가 대비 추가매수 지정가 오프셋(%)
INITIAL_CAPITAL = ${initCap}

# 핵심 로직 (실행 엔진: AlphaHelix analytics · vectorbt 기반)
#   1) 매 거래일 시드의 1/SPLIT 만큼 분할 매수 (LOC 지정가 = 종가×(1-LOC_OFFSET_PCT/100))
#   2) 평단가 대비 +TAKE_PROFIT_PCT 도달 시 전량 익절 → 사이클 리셋
#   3) 시드 소진 시 추가매수 중단, 익절 신호 대기
def run(prices):
    for ticker in TICKERS:
        seed_per_buy = INITIAL_CAPITAL / SPLIT
        # ... 분할매수 / 평단 추적 / 익절 사이클 (엔진 내부 구현) ...
        pass
`;
  }

  if (stype === "value_rebalancing") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: 밸류 리밸런싱 (Value Rebalancing)
TICKERS          = [${tickersList}]
REBALANCE_DAYS   = ${vrRd}        # 리밸런싱 주기(거래일)
EXPECTED_RETURN  = ${vrEr}      # 주기당 목표 수익률(밸류 밴드 중심)
BAND_PCT         = ${vrBand}      # 허용 밴드 폭(±, 비율)
POOL_TARGET_PCT  = ${vrPool}      # 목표 풀(주식) 비중
INITIAL_POOL_PCT = ${vrIpool}      # 초기 풀 비중
INITIAL_CAPITAL  = ${initCap}

# 핵심 로직 (실행 엔진: AlphaHelix analytics · vectorbt 기반)
#   1) REBALANCE_DAYS 마다 목표가치 = 직전가치×(1+EXPECTED_RETURN) 산정
#   2) 평가액이 목표가치×(1±BAND_PCT) 밴드를 벗어나면 풀 비중을 POOL_TARGET_PCT 로 복원
#   3) 하락 시 저가매수(풀 확대), 상승 시 차익실현(풀 축소)
def run(prices):
    for ticker in TICKERS:
        target = INITIAL_CAPITAL * INITIAL_POOL_PCT
        # ... 주기적 밴드 이탈 점검 / 비중 복원 (엔진 내부 구현) ...
        pass
`;
  }

  return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: SMA 크로스오버
TICKER       = "${ticker}"
BENCHMARK    = "SPY"
SMA_FAST     = ${smFast}
SMA_SLOW     = ${smSlow}

from AlgorithmImports import *

class ${clsName}(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(10_000)
        self.symbol   = self.AddEquity(TICKER, Resolution.Daily).Symbol
        self.SetBenchmark(BENCHMARK)
        self.sma_fast = self.SMA(self.symbol, SMA_FAST, Resolution.Daily)
        self.sma_slow = self.SMA(self.symbol, SMA_SLOW, Resolution.Daily)
        self.SetWarmUp(SMA_SLOW + 10)

    def OnData(self, data):
        if self.IsWarmingUp:
            return
        if not all([self.sma_fast.IsReady, self.sma_slow.IsReady]):
            return
        if self.sma_fast.Current.Value > self.sma_slow.Current.Value:
            if not self.Portfolio[self.symbol].IsLong:
                self.SetHoldings(self.symbol, 1.0)
        elif self.sma_fast.Current.Value < self.sma_slow.Current.Value:
            if self.Portfolio[self.symbol].IsLong:
                self.Liquidate()

    def OnEndOfAlgorithm(self):
        self.Log(f"[DONE] 포트폴리오 최종 가치: ${"{"}self.Portfolio.TotalPortfolioValue:,.0f{"}"}")
`;
}

// ── 코드에서 파라미터 추출 ─────────────────────────────────────────────────────
function parseParamsFromCode(code) {
  if (!code) return {};
  const result = {};
  const extract = (re, key, toNum = true) => {
    const m = code.match(re);
    if (m) result[key] = toNum ? parseFloat(m[1]) : m[1];
  };
  extract(/^\s*SMA_FAST\s*=\s*([\d.]+)/m,    "sma_fast");
  extract(/^\s*SMA_SLOW\s*=\s*([\d.]+)/m,    "sma_slow");
  extract(/^\s*RSI_PERIOD\s*=\s*([\d.]+)/m,  "rsi_period");
  extract(/^\s*RSI_LOW\s*=\s*([\d.]+)/m,     "rsi_low");
  extract(/^\s*RSI_HIGH\s*=\s*([\d.]+)/m,    "rsi_high");
  extract(/^\s*MACD_FAST\s*=\s*([\d.]+)/m,   "macd_fast");
  extract(/^\s*MACD_SLOW\s*=\s*([\d.]+)/m,   "macd_slow");
  extract(/^\s*MACD_SIGNAL\s*=\s*([\d.]+)/m, "macd_signal");
  extract(/^\s*VIX_THRESHOLD\s*=\s*([\d.]+)/m,"vix_threshold");
  // 무한매수(IB) / 밸류리밸런싱(VR) — 최적화 스윕 대상
  extract(/^\s*SPLIT\s*=\s*([\d.]+)/m,            "split");
  extract(/^\s*TAKE_PROFIT_PCT\s*=\s*([\d.]+)/m,  "take_profit_pct");
  extract(/^\s*LOC_OFFSET_PCT\s*=\s*([\d.]+)/m,   "loc_offset_pct");
  extract(/^\s*REBALANCE_DAYS\s*=\s*([\d.]+)/m,   "rebalance_days");
  extract(/^\s*EXPECTED_RETURN\s*=\s*([\d.]+)/m,  "expected_return");
  extract(/^\s*BAND_PCT\s*=\s*([\d.]+)/m,         "band_pct");
  extract(/^\s*POOL_TARGET_PCT\s*=\s*([\d.]+)/m,  "pool_target_pct");
  extract(/^\s*INITIAL_POOL_PCT\s*=\s*([\d.]+)/m, "initial_pool_pct");
  // 모멘텀 로테이션
  extract(/^\s*LOOKBACK_DAYS\s*=\s*([\d.]+)/m,     "lookback_days");
  extract(/^\s*SKIP_RECENT_DAYS\s*=\s*([\d.]+)/m,  "skip_recent_days");
  extract(/^\s*TOP_N\s*=\s*([\d.]+)/m,             "top_n");
  extract(/^\s*TICKER\s*=\s*"([^"]+)"/m,     "ticker", false);
  return result;
}

// parseParamsFromCode 의 역함수 — 선택한 파라미터 값을 코드의 상수에 그대로 반영(P3 적용).
function applyParamsToCode(code, params) {
  if (!code || !params) return code;
  let out = code;
  const repl = (constName, val) => {
    if (val == null) return;
    const re = new RegExp(`^(\\s*${constName}\\s*=\\s*)[\\d.]+`, "m");
    if (re.test(out)) out = out.replace(re, `$1${val}`);
  };
  repl("SMA_FAST", params.sma_fast);   repl("SMA_SLOW", params.sma_slow);
  repl("RSI_PERIOD", params.rsi_period); repl("RSI_LOW", params.rsi_low); repl("RSI_HIGH", params.rsi_high);
  repl("MACD_FAST", params.macd_fast); repl("MACD_SLOW", params.macd_slow); repl("MACD_SIGNAL", params.macd_signal);
  repl("VIX_THRESHOLD", params.vix_threshold);
  repl("SPLIT", params.split); repl("TAKE_PROFIT_PCT", params.take_profit_pct); repl("LOC_OFFSET_PCT", params.loc_offset_pct);
  repl("REBALANCE_DAYS", params.rebalance_days); repl("EXPECTED_RETURN", params.expected_return); repl("BAND_PCT", params.band_pct);
  repl("POOL_TARGET_PCT", params.pool_target_pct); repl("INITIAL_POOL_PCT", params.initial_pool_pct);
  repl("LOOKBACK_DAYS", params.lookback_days); repl("SKIP_RECENT_DAYS", params.skip_recent_days); repl("TOP_N", params.top_n);
  return out;
}

// ── 에쿼티 커브 변환 ──────────────────────────────────────────────────────────
function convertEquityCurve(curve) {
  if (!curve || curve.length < 2) return [];
  const base = curve[0].value || 10000;
  return curve.map(d => ({
    v: Math.round((d.value / base) * 100),
    t: (d.date || "").slice(2, 7).replace("-", "."),
  }));
}

const FILE_META = {
  main: { name: "main.py", lang: "python" },
};

const PLACEHOLDER_CODE = `# ── AlphaHelix Quant Developer IDE ──────────────────────────
# 워크스페이스가 선택되지 않았습니다.
#
# 사용 방법:
#  1. 왼쪽 'Alpha-Helix' 탭에서 워크스페이스를 만들고
#     Goal → Strategy 설정을 완료하세요.
#  2. 설정 완료 후 이 화면으로 돌아오면
#     전략 코드가 자동으로 로드됩니다.
#  3. 파라미터를 수정하고 'Run Backtest'를 실행하세요.
`;

const DATASETS = [
  {
    id:"us_daily", name:"US_Stock_Daily", desc:"미국 주식 일봉 (2010~2024)", rows:"48,320",
    cols:["date","ticker","open","high","low","close","volume","adj_close"],
    preview:[
      {date:"2024-12-31",ticker:"TQQQ",open:"82.40",high:"84.20",low:"81.90",close:"83.15",volume:"12,480,000",adj_close:"83.15"},
      {date:"2024-12-31",ticker:"SOXL",open:"31.20",high:"32.10",low:"30.85",close:"31.75",volume:"8,320,000", adj_close:"31.75"},
      {date:"2024-12-31",ticker:"SPY", open:"592.10",high:"594.30",low:"591.40",close:"593.22",volume:"62,400,000",adj_close:"593.22"},
      {date:"2024-12-30",ticker:"TQQQ",open:"81.50",high:"82.80",low:"80.90",close:"82.40",volume:"9,840,000", adj_close:"82.40"},
    ],
  },
  {
    id:"kospi", name:"KOSPI_Daily", desc:"KOSPI 구성 종목 일봉 (2015~2024)", rows:"31,200",
    cols:["date","code","name","open","high","low","close","volume"],
    preview:[
      {date:"2024-12-31",code:"005930",name:"삼성전자",  open:"53,200",high:"54,100",low:"53,000",close:"53,800",volume:"14,820,000"},
      {date:"2024-12-31",code:"000660",name:"SK하이닉스",open:"198,000",high:"201,000",low:"197,500",close:"200,500",volume:"3,240,000"},
    ],
  },
  {
    id:"crypto", name:"Crypto_1Min", desc:"BTC/ETH 1분봉 (2020~2024)", rows:"2,100,000",
    cols:["timestamp","symbol","open","high","low","close","volume"],
    preview:[
      {timestamp:"2024-12-31 23:59",symbol:"BTC/USDT",open:"94,820.5",high:"94,850.0",low:"94,800.0",close:"94,840.0",volume:"18.240"},
      {timestamp:"2024-12-31 23:59",symbol:"ETH/USDT",open:"3,386.0", high:"3,390.0", low:"3,384.5", close:"3,388.0", volume:"142.80"},
    ],
  },
  {
    id:"my_kis", name:"MyPortfolio_KIS", desc:"내 한투 계좌 보유 현황 (실시간)", rows:"실시간",
    cols:["ticker","qty","avg_price","current","pnl","pnl_pct"],
    preview:[
      {ticker:"TQQQ",    qty:"1,240",avg_price:"$42.30",current:"$83.15",pnl:"+$50,499",pnl_pct:"+96.6%"},
      {ticker:"SOXL",    qty:"860",  avg_price:"$18.40",current:"$31.75",pnl:"+$11,481",pnl_pct:"+72.6%"},
    ],
  },
  {
    id:"my_binance", name:"MyPortfolio_Binance", desc:"내 Binance 계좌 보유 현황 (실시간)", rows:"실시간",
    cols:["asset","free","locked","total"],
    liveBinance:true,
    preview:[],
  },
];

// 실제 수집 현황(/api/analytics/data-status)을 데이터셋 카드로 변환.
// 하드코딩 대신 DB에 실제 적재된 polygon/binance 행 수·종목·기간을 보여준다.
function buildDatasetsFromStatus(status, fallback) {
  const stats = (status && status.collection_stats) || [];
  if (!stats.length) return fallback;
  const fmt = (n) => Number(n || 0).toLocaleString();
  const day = (s) => (s ? String(s).slice(0, 10) : "?");
  const bySrc = {};
  for (const s of stats) {
    const src = s.source || "?";
    const g = bySrc[src] || (bySrc[src] = { rows: 0, symbols: new Set(), tfs: new Set(), oldest: null, latest: null });
    g.rows += s.total_rows || 0;
    if (s.symbol) g.symbols.add(s.symbol);
    if (s.tf) g.tfs.add(s.tf);
    if (s.oldest && (!g.oldest || s.oldest < g.oldest)) g.oldest = s.oldest;
    if (s.latest && (!g.latest || s.latest > g.latest)) g.latest = s.latest;
  }
  const META = {
    polygon: { id: "us_daily", name: "US_Stock_Daily", label: "미국 주식 일봉 · Polygon.io" },
    binance: { id: "crypto",   name: "Crypto_OHLCV",   label: "암호화폐 · Binance" },
    yfinance:{ id: "yf",       name: "YFinance_Daily",  label: "주식 일봉 · yfinance" },
    kis:     { id: "kis_ohlcv",name: "KIS_OHLCV",       label: "국내/해외 · KIS" },
  };
  const cards = [];
  for (const [src, g] of Object.entries(bySrc)) {
    const m = META[src] || { id: src, name: src, label: src };
    const tfs = [...g.tfs];
    cards.push({
      id: m.id, name: m.name, source: src, live: true,
      symbols: [...g.symbols].sort(),
      tf: tfs.includes("1d") ? "1d" : (tfs[0] || "1d"),
      rows: fmt(g.rows),
      desc: `${m.label} · ${g.symbols.size}종목 · ${tfs.join("/") || "1d"} (${day(g.oldest)}~${day(g.latest)})`,
      cols: ["ts", "symbol", "open", "high", "low", "close", "volume"],
      preview: [],
    });
  }
  cards.sort((a, b) => a.name.localeCompare(b.name));
  // 내 데이터(KIS/Binance 실시간) 카드는 fallback 그대로 유지
  for (const id of ["my_kis", "my_binance"]) {
    const card = (fallback || []).find((d) => d.id === id);
    if (card) cards.push(card);
  }
  return cards;
}

// ── SVG 차트 ──────────────────────────────────────────────────────────────────
function SparkChart({ data, bench = [] }) {
  const [W, H] = [560, 150];
  const pad = { t:10, r:10, b:24, l:36 };
  const cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  const allV = [...data.map(d=>d.v), ...(bench.length ? bench.map(d=>d.v) : [])];
  if (allV.length === 0) return null;
  const mn = Math.min(...allV)-5, mx = Math.max(...allV)+5;
  const tx = i => (i/(data.length-1))*cW;
  const ty = v => cH - ((v-mn)/(mx-mn))*cH;
  const pathD = arr => arr.map((d,i)=>`${i?"L":"M"}${tx(i).toFixed(1)},${ty(d.v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} style={{overflow:"visible"}}>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0,0.33,0.66,1].map((r,i)=>(<line key={i} x1={0} y1={cH*r} x2={cW} y2={cH*r} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>))}
        {bench.length > 0 && <path d={pathD(bench)} fill="none" stroke="#4B5563" strokeWidth={1.5} strokeDasharray="4 2"/>}
        <path d={pathD(data)} fill="none" stroke="#60a5fa" strokeWidth={2.2}/>
        {data.filter((_,i)=>i%3===0).map((d)=>{
          const idx=data.indexOf(d);
          return <text key={idx} x={tx(idx)} y={cH+16} textAnchor="middle" fill="#4B5563" fontSize={9}>{d.t}</text>;
        })}
        {[mn,(mn+mx)/2,mx].map((v,i)=>(<text key={i} x={-4} y={ty(v)+4} textAnchor="end" fill="#4B5563" fontSize={9}>{Math.round(v)}</text>))}
        <rect x={cW-110} y={-6} width={8} height={8} rx={2} fill="#60a5fa"/>
        <text x={cW-98} y={2} fill="#6B7280" fontSize={9}>전략</text>
      </g>
    </svg>
  );
}

function MetricCard({label,value,color="#60a5fa"}) {
  return (
    <div style={{padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
      <div style={{fontSize:9,color:"#4B5563",marginBottom:2}}>{label}</div>
      <div style={{fontSize:15,fontWeight:800,color}}>{value}</div>
    </div>
  );
}

// ── DataTableView ─────────────────────────────────────────────────────────────
const IDE_DS_THEME = {
  accent: "#60a5fa", text: "#e5e7eb", textMuted: "#94a3b8",
  panel: "#161b22", panelBorder: "rgba(255,255,255,0.12)", panelAlt: "rgba(96,165,250,0.12)",
};

function DataTableView({ datasetId, datasets }) {
  const list = (datasets && datasets.length) ? datasets : DATASETS;
  const ds = list.find(d=>d.id===datasetId);
  const [rows, setRows] = useState(ds?.preview || []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [viewMode, setViewMode] = useState("table");   // "table" | "chart"
  const [selectedSym, setSelectedSym] = useState(null);
  const [chartRows, setChartRows] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // 심볼 선택 초기화: 데이터셋이 바뀌면 첫 번째 심볼로 리셋
  useEffect(() => {
    if (ds?.symbols?.length) setSelectedSym(ds.symbols[0]);
    else setSelectedSym(null);
  }, [ds?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 테이블 데이터 로드
  useEffect(() => {
    if (ds && ds.liveBinance) {
      let alive = true;
      setLoading(true); setErr(null);
      (async () => {
        try {
          const accts = await listBrokerAccounts();
          const bn = (accts || []).find(a => a.brokerType === "BINANCE");
          if (!bn) { if (alive) { setRows([]); setErr("Binance 계좌 미등록 — 계좌관리에서 등록하세요."); } return; }
          const bal = await getBinanceBalance(bn.env, bn.binanceMode || "SPOT");
          const balances = (bal && bal.balances) || [];
          const f = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 8 });
          if (alive) setRows(balances.map(b => {
            const free = Number(b.free) || 0, locked = Number(b.locked) || 0;
            return { asset: b.asset, free: f(free), locked: f(locked), total: f(free + locked) };
          }));
        } catch (e) {
          if (alive) setErr("Binance 잔고 로드 실패 — 계좌 검증(연결 테스트) 상태를 확인하세요.");
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }
    if (!ds || !ds.live) { setRows(ds?.preview || []); return; }
    const sym = selectedSym || (ds.symbols && ds.symbols[0]);
    if (!sym) { setRows([]); return; }
    let alive = true;
    setLoading(true); setErr(null);
    getDataPreview(sym, ds.tf || "1d", ds.source, 30)
      .then(res => {
        if (!alive) return;
        const data = (res && res.data) || [];
        setRows(data.slice().reverse().map(r => ({
          ts: String(r.ts || "").slice(0, 19),
          symbol: r.symbol,
          open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume,
        })));
      })
      .catch(() => { if (alive) setErr("미리보기 로드 실패 — Analytics 사이드카 / 수집 현황을 확인하세요."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ds?.id, selectedSym]); // eslint-disable-line react-hooks/exhaustive-deps

  // 차트 데이터 로드 (200봉)
  useEffect(() => {
    if (!ds?.live || ds?.liveBinance) return;
    const sym = selectedSym || (ds.symbols && ds.symbols[0]);
    if (!sym) return;
    let alive = true;
    setChartLoading(true);
    getDataPreview(sym, ds.tf || "1d", ds.source, 200)
      .then(res => {
        if (!alive) return;
        const data = ((res && res.data) || []).slice().sort((a, b) => String(a.ts) < String(b.ts) ? -1 : 1);
        setChartRows(data);
      })
      .catch(() => {})
      .finally(() => { if (alive) setChartLoading(false); });
    return () => { alive = false; };
  }, [ds?.id, selectedSym]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ds) return null;
  const cols = ds.cols || ["ts","symbol","open","high","low","close","volume"];
  const symList = ds.symbols || [];
  const isLiveOhlcv = ds.live && !ds.liveBinance;

  // 차트 시리즈 구성: 종가 + SMA 20/50
  const closePts = chartRows.map(r => ({ x: new Date(r.ts || r.date), y: Number(r.close) }));
  const closeVals = closePts.map(p => p.y);
  const sma20Vals = calcSMA(closeVals, 20);
  const sma50Vals = calcSMA(closeVals, 50);
  const chartSeries = closePts.length > 1 ? [
    { name: `${selectedSym || ""} Close`, color: "#60a5fa",  points: closePts },
    { name: "SMA 20",  color: "#f59e0b", points: closePts.map((p, i) => ({ x: p.x, y: sma20Vals[i] })).filter(p => p.y != null) },
    { name: "SMA 50",  color: "#a78bfa", points: closePts.map((p, i) => ({ x: p.x, y: sma50Vals[i] })).filter(p => p.y != null) },
  ] : [];

  // 가격 변화율 계산 (차트 헤더용)
  const latestClose = closePts.length ? closePts[closePts.length - 1].y : null;
  const prevClose   = closePts.length > 1 ? closePts[closePts.length - 2].y : null;
  const changePct   = (latestClose && prevClose) ? ((latestClose - prevClose) / prevClose * 100) : null;

  return (
    <div style={{flex:1,overflow:"auto",padding:"16px 20px",background:"#0f1117"}}>
      {/* ── 헤더 ─────────────────────────────────────── */}
      <div style={{marginBottom:12,display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"white",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {ds.name}
            {(ds.live || ds.liveBinance) && (
              <span style={{fontSize:8,padding:"1px 6px",borderRadius:999,background:"rgba(16,185,129,0.15)",color:"#10B981",fontWeight:700}}>
                {ds.liveBinance ? "LIVE" : "LIVE DB"}
              </span>
            )}
          </div>
          <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>{ds.desc}  ·  {ds.rows} rows  ·  {cols.length} cols</div>
        </div>

        {/* 심볼 드롭다운 (multi-symbol 데이터셋) */}
        {isLiveOhlcv && symList.length > 1 && (
          <select
            value={selectedSym || ""}
            onChange={e => setSelectedSym(e.target.value)}
            style={{
              background:"#161b22", color:"#e2e8f0", border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:6, padding:"4px 8px", fontSize:11, cursor:"pointer",
            }}
          >
            {symList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* 차트 / 테이블 토글 */}
        {isLiveOhlcv && (
          <div style={{display:"flex",borderRadius:6,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)"}}>
            {["chart","table"].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding:"4px 12px", fontSize:10, fontWeight:700, cursor:"pointer", border:"none",
                background: viewMode === mode ? "#60a5fa" : "transparent",
                color: viewMode === mode ? "#000" : "#6B7280",
              }}>
                {mode === "chart" ? "📈 차트" : "🗂 테이블"}
              </button>
            ))}
          </div>
        )}

        {/* 컬럼 배지 */}
        {!isLiveOhlcv && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {cols.map(c=>(
              <span key={c} style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:"rgba(96,165,250,0.1)",color:"#60a5fa",fontFamily:"monospace"}}>{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── 차트 뷰 ──────────────────────────────────── */}
      {viewMode === "chart" && isLiveOhlcv && (
        <div style={{background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",padding:"14px 16px",marginBottom:12}}>
          {/* 현재가 헤더 */}
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10}}>
            <span style={{fontSize:18,fontWeight:800,color:"#e2e8f0",fontFamily:"monospace"}}>
              {latestClose != null ? latestClose.toLocaleString(undefined, {maximumFractionDigits:4}) : "—"}
            </span>
            {changePct != null && (
              <span style={{fontSize:12,fontWeight:700,color: changePct >= 0 ? "#10B981" : "#EF4444"}}>
                {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
              </span>
            )}
            <span style={{fontSize:10,color:"#4B5563",marginLeft:"auto"}}>
              {selectedSym}  ·  {ds.tf || "1d"}  ·  {chartRows.length}봉
            </span>
          </div>

          {chartLoading ? (
            <div style={{textAlign:"center",padding:"40px 0",color:"#4B5563",fontSize:11}}>차트 로딩 중…</div>
          ) : chartSeries.length > 0 ? (
            <TrendLineChart
              series={chartSeries}
              theme={IDE_DS_THEME}
              height={220}
              toggleable
              initialHidden={["SMA 50"]}
            />
          ) : (
            <div style={{textAlign:"center",padding:"40px 0",color:"#4B5563",fontSize:11}}>
              데이터 없음 — Analytics 사이드카가 실행 중인지 확인하세요.
            </div>
          )}
        </div>
      )}

      {/* ── 테이블 뷰 ────────────────────────────────── */}
      {(viewMode === "table" || !isLiveOhlcv) && (
        <>
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",width:"100%",fontSize:11.5}}>
              <thead>
                <tr>
                  {cols.map(c=>(
                    <th key={c} style={{padding:"6px 12px",textAlign:"left",color:"#4B5563",fontWeight:700,
                      borderBottom:"1px solid rgba(255,255,255,0.08)",background:"#161b22",whiteSpace:"nowrap"}}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row,i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
                    {cols.map(c=>(
                      <td key={c} style={{padding:"5px 12px",color:"#9CA3AF",borderBottom:"1px solid rgba(255,255,255,0.04)",
                        fontFamily:"'Fira Code',monospace",whiteSpace:"nowrap",fontSize:11}}>{String(row[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10,fontSize:10,color:"#2d3748"}}>
            {loading ? "실제 DB에서 미리보기 로딩 중…"
              : err ? err
              : ds.liveBinance ? `* 실시간 Binance 잔고 ${rows.length}개 자산 (0 잔고 제외)`
              : ds.live ? `* 최근 ${rows.length}행 (실제 수집 데이터 · source=${ds.source})  |  전체 ${ds.rows} rows 적재됨`
              : `* 상위 ${rows.length}행 미리보기`}
          </div>
        </>
      )}
    </div>
  );
}

// ── #7 최적화 위저드 (파라미터 그리드 백테스트 설정 → Launch) ──
const OPT_PARAM_LABEL = { sma_fast:"SMA_FAST", sma_slow:"SMA_SLOW", rsi_period:"RSI_PERIOD", rsi_low:"RSI_LOW", rsi_high:"RSI_HIGH", macd_fast:"MACD_FAST", macd_slow:"MACD_SLOW", macd_signal:"MACD_SIGNAL", vix_threshold:"VIX_THRESHOLD", split:"SPLIT", take_profit_pct:"TAKE_PROFIT_PCT", loc_offset_pct:"LOC_OFFSET_PCT", rebalance_days:"REBALANCE_DAYS", expected_return:"EXPECTED_RETURN", band_pct:"BAND_PCT", pool_target_pct:"POOL_TARGET_PCT", initial_pool_pct:"INITIAL_POOL_PCT" };
const OPT_METRICS = [["sharpe","샤프 지수"],["total_return_pct","총 수익률"],["annualized_return_pct","연환산 수익률"],["max_drawdown_pct","MDD (낮을수록 좋음)"]];
const OPT_CONSTRAINT_METRICS = [["max_drawdown_pct","MDD(%)"],["sharpe","샤프"],["total_return_pct","총수익률(%)"],["annualized_return_pct","CAR(%)"],["volatility_pct","변동성(%)"]];

function OptimizeWizardView({ baseParams, busy, progress, onLaunch }) {
  const numericKeys = Object.entries(baseParams || {}).filter(([k,v]) => typeof v === "number" && k !== "ticker").map(([k])=>k);
  const mkRow = (k, i) => {
    const v = baseParams[k];
    // 소수/작은 값(band_pct=0.2, expected_return=0.02 등)은 분수 그리드, 정수형(SMA 윈도우 등)은 정수 그리드
    if (!Number.isInteger(v) || Math.abs(v) < 5) {
      const span = Math.max(Math.abs(v) * 0.5, 0.02);
      const r = (x) => Math.round(x * 1000) / 1000;
      return { name: k, enabled: i < 2, min: r(Math.max(0, v - span)), max: r(v + span), step: r(Math.max(span / 2, 0.005)) };
    }
    const span = Math.max(2, Math.round(Math.abs(v) * 0.5));
    return { name: k, enabled: i < 2, min: Math.max(1, v - span), max: v + span, step: Math.max(1, Math.round(span / 2)) };
  };
  const [rows, setRows] = useState(() => numericKeys.map(mkRow));
  const [metric, setMetric] = useState("sharpe");
  const [period, setPeriod] = useState("5y");
  const [nodeTier, setNodeTier] = useState("O4");          // 컴퓨트 노드(표시·QC식)
  const [constraints, setConstraints] = useState([]);      // 다중 제약 [{metric,op,value}]
  const [optStrategy, setOptStrategy] = useState("grid");  // 최적화 전략(현재 Grid Search)
  const [openSec, setOpenSec] = useState({ params:true, nodes:true });
  const updC = (i, patch) => setConstraints(cs => cs.map((c,j)=> j===i?{...c,...patch}:c));
  const setRow = (i, patch) => setRows(prev => prev.map((r,j)=> j===i?{...r,...patch}:r));
  const enabled = rows.filter(r=>r.enabled);
  const comboCount = enabled.length ? enabled.reduce((acc,r)=>{ const n = r.step>0 ? Math.floor((Number(r.max)-Number(r.min))/Number(r.step))+1 : 0; return acc * Math.max(0,n); }, 1) : 0;
  const launch = () => {
    const params = rows.filter(r=>r.enabled).slice(0,2).map(r=>({name:r.name, min:Number(r.min), max:Number(r.max), step:Number(r.step)}));
    if (!params.length) { alert("최소 1개 파라미터를 선택하세요."); return; }
    if (params.some(p=>!(p.step>0) || p.max<p.min)) { alert("범위/스텝 값을 확인하세요(step>0, max≥min)."); return; }
    const cons = constraints.filter(c=>c.metric && c.value!=="" && _fin(c.value)).map(c=>({metric:c.metric, op:c.op, value:Number(c.value)}));
    onLaunch({ params, metric, metricLabel:(OPT_METRICS.find(m=>m[0]===metric)||[])[1]||metric, period, optStrategy, nodeTier, constraints: cons,
               constraint: cons.find(c=>c.metric==="max_drawdown_pct"&&c.op==="<=") ? { max_drawdown_pct: cons.find(c=>c.metric==="max_drawdown_pct"&&c.op==="<=").value } : null });
  };
  const estSec = Math.round(comboCount * 1.5);
  const estLabel = estSec >= 60 ? `${Math.floor(estSec/60)}분 ${estSec%60}초` : `${estSec}초`;
  const card = { background:"#161b22", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"14px 16px", marginBottom:12 };
  const lbl = { fontSize:10.5, color:"#94A3B8", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10 };
  const inp = { width:58, background:"#0d1117", border:"1px solid rgba(255,255,255,0.12)", borderRadius:5, color:"#E5E7EB", fontSize:11.5, padding:"3px 6px", textAlign:"center" };

  return (
    <div className="dark-scroll" style={{flex:1, minHeight:0, overflow:"auto", background:"#0f1117"}}>
    <div style={{padding:"24px 32px 64px", color:"#E5E7EB", maxWidth:720, fontFamily:"'Inter',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <BarChart3 size={20} color="#F59E0B"/>
        <span style={{fontSize:18,fontWeight:800}}>최적화 (파라미터 그리드)</span>
      </div>
      <div style={{fontSize:12,color:"#94A3B8",marginBottom:18}}>
        파라미터 범위를 스윕하며 백테스트를 반복 실행해 견고성·민감도를 평가합니다. (기존 vectorbt 엔진으로 실제 백테스트)
      </div>

      <div style={card}>
        <div onClick={()=>setOpenSec(s=>({...s,params:!s.params}))} style={{...lbl, marginBottom:openSec.params?10:0, cursor:"pointer", display:"flex", alignItems:"center", gap:6}}>
          <span style={{transform:openSec.params?"rotate(90deg)":"none", transition:"transform .15s", display:"inline-block", fontSize:9}}>▶</span> 파라미터 &amp; 범위 · 제약
        </div>
        {openSec.params && (numericKeys.length===0 ? (
          <div style={{fontSize:12,color:"#fbbf24",lineHeight:1.6}}>코드에서 스윕 가능한 숫자 파라미터(SMA_FAST 등)를 찾지 못했습니다. main.py 상단에 <code>SMA_FAST = 20</code> 형태로 정의하세요.</div>
        ) : (
          <>
            <div style={{display:"grid",gridTemplateColumns:"22px 1fr 60px 60px 60px",gap:8,alignItems:"center",fontSize:9.5,color:"#64748B",fontWeight:700,marginBottom:6,paddingLeft:2}}>
              <span/><span>파라미터</span><span style={{textAlign:"center"}}>MIN</span><span style={{textAlign:"center"}}>MAX</span><span style={{textAlign:"center"}}>STEP</span>
            </div>
            {rows.map((r,i)=>(
              <div key={r.name} style={{display:"grid",gridTemplateColumns:"22px 1fr 60px 60px 60px",gap:8,alignItems:"center",marginBottom:7}}>
                <input type="checkbox" checked={r.enabled} onChange={e=>setRow(i,{enabled:e.target.checked})} style={{accentColor:"#F59E0B",width:15,height:15}}/>
                <span style={{fontSize:12,fontFamily:"monospace",color:r.enabled?"#E5E7EB":"#64748B"}}>{OPT_PARAM_LABEL[r.name]||r.name} <span style={{color:"#64748B"}}>={baseParams[r.name]}</span></span>
                <input style={inp} value={r.min} disabled={!r.enabled} onChange={e=>setRow(i,{min:e.target.value})}/>
                <input style={inp} value={r.max} disabled={!r.enabled} onChange={e=>setRow(i,{max:e.target.value})}/>
                <input style={inp} value={r.step} disabled={!r.enabled} onChange={e=>setRow(i,{step:e.target.value})}/>
              </div>
            ))}
            <div style={{fontSize:10.5,color:"#64748B",marginTop:8}}>최대 2개까지 사용(2개면 2D 히트맵). 선택 {Math.min(enabled.length,2)}개 · 예상 백테스트 <b style={{color: comboCount>64?"#f87171":"#93c5fd"}}>{comboCount}</b>회{comboCount>64?" (64회 이하로 줄이세요)":""}</div>
          </>
        ))}
      </div>

      <div style={{...card, display:"flex", gap:24, alignItems:"center", flexWrap:"wrap"}}>
        <div><div style={lbl}>최적화 전략</div>
          <select value={optStrategy} onChange={e=>setOptStrategy(e.target.value)} style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:12,padding:"5px 8px"}}>
            <option value="grid">Grid Search</option>
          </select>
          <div style={{fontSize:9.5,color:"#64748B",marginTop:4}}>{metric==="max_drawdown_pct"?"Min":"Max"} of {(OPT_METRICS.find(m=>m[0]===metric)||[])[1]||metric}</div>
        </div>
        <div><div style={lbl}>목표 지표</div>
          <select value={metric} onChange={e=>setMetric(e.target.value)} style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:12,padding:"5px 8px"}}>
            {OPT_METRICS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><div style={lbl}>기간</div>
          <select value={period} onChange={e=>setPeriod(e.target.value)} style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:12,padding:"5px 8px"}}>
            {["1y","3y","5y","10y"].map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* 제약 조건 (Constraints) — 다중·임의 지표 (QC식) */}
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:constraints.length?8:4}}>
          <div style={{...lbl,marginBottom:0}}>제약 조건 (Constraints)</div>
          <button onClick={()=>setConstraints(cs=>[...cs,{metric:"max_drawdown_pct",op:"<=",value:30}])}
            style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,0.14)",background:"transparent",color:"#cbd5e1",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ 제약 추가</button>
        </div>
        {constraints.length===0
          ? <div style={{fontSize:10.5,color:"#64748B"}}>제약 없음 — 모든 조합이 최적 후보. 예: MDD ≤ 30, 샤프 ≥ 1.0 (모두 만족하는 조합만 best).</div>
          : constraints.map((c,i)=>{
              const sel = {background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:11.5,padding:"4px 6px"};
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <select value={c.metric} onChange={e=>updC(i,{metric:e.target.value})} style={sel}>{OPT_CONSTRAINT_METRICS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
                  <select value={c.op} onChange={e=>updC(i,{op:e.target.value})} style={sel}><option value="<=">≤</option><option value=">=">≥</option></select>
                  <input value={c.value} onChange={e=>updC(i,{value:e.target.value})} style={{...inp,width:72}}/>
                  <button onClick={()=>setConstraints(cs=>cs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
                </div>
              );
            })
        }
      </div>

      {/* 예상 백테스트 수 & 컴퓨트 노드 (QC식) */}
      <div style={card}>
        <div onClick={()=>setOpenSec(s=>({...s,nodes:!s.nodes}))} style={{...lbl, marginBottom:openSec.nodes?10:0, cursor:"pointer", display:"flex", alignItems:"center", gap:6}}>
          <span style={{transform:openSec.nodes?"rotate(90deg)":"none", transition:"transform .15s", display:"inline-block", fontSize:9}}>▶</span> 예상 백테스트 수 &amp; 컴퓨트 노드
        </div>
        {openSec.nodes && (<>
        <div style={{fontSize:12,color:"#cbd5e1",marginBottom:12}}>예상 <b style={{color: comboCount>64?"#f87171":"#93c5fd"}}>{comboCount}</b>회 · 약 <b style={{color:"#93c5fd"}}>{estLabel}</b> <span style={{fontSize:10.5,color:"#64748B"}}>(조합당 ~1.5s · 우리 클라우드 분석 서버에서 순차 실행)</span></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {[["O2","L2-4 · 2CPU 4GB","2 vCPU · 4GB","무료/STANDARD"],["O4","L4-8 · 4CPU 8GB","4 vCPU · 8GB","STANDARD"],["O8","L8-16 · 8CPU 16GB","8 vCPU · 16GB","PREMIUM"]].map(([id,name,spec,plan])=>{
            const on = nodeTier===id;
            return (
              <div key={id} onClick={()=>setNodeTier(id)} style={{flex:"1 1 150px",minWidth:140,padding:"11px 13px",borderRadius:9,cursor:"pointer",
                border:`1.5px solid ${on?"#F59E0B":"rgba(255,255,255,0.1)"}`,background:on?"rgba(245,158,11,0.08)":"transparent"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:800,color:on?"#fbbf24":"#cbd5e1"}}>{name}</span>
                  <span style={{fontSize:8.5,fontWeight:700,padding:"1px 6px",borderRadius:999,background:"rgba(167,139,250,0.15)",color:"#c4b5fd"}}>{plan}</span>
                </div>
                <div style={{fontSize:10,color:"#64748B"}}>{spec}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:10,color:"#64748B",marginTop:8,lineHeight:1.5}}>* 현재는 단일 분석 서버에서 순차 실행됩니다. 고성능·병렬 노드(잡큐)는 PREMIUM 클라우드 컴퓨트 로드맵입니다.</div>
        </>)}
      </div>

      {busy && (
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#94A3B8",marginBottom:4}}>최적화 진행 {progress.done}/{progress.total}</div>
          <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress.total?Math.round(progress.done/progress.total*100):0}%`,background:"linear-gradient(90deg,#F59E0B,#D97706)",transition:"width .2s"}}/>
          </div>
        </div>
      )}

      <button onClick={launch} disabled={busy || comboCount===0 || comboCount>64}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,width:"100%",padding:"12px",borderRadius:9,border:"none",
          background: busy||comboCount===0||comboCount>64 ? "rgba(245,158,11,0.3)" : "linear-gradient(135deg,#F59E0B,#D97706)",
          color:"white",fontSize:13.5,fontWeight:800,cursor: busy||comboCount===0||comboCount>64 ? "not-allowed":"pointer"}}>
        {busy ? <Loader size={14} style={{animation:"spin 1s linear infinite"}}/> : <BarChart3 size={14}/>}
        {busy ? "실행 중…" : `Launch Optimization (${comboCount}회 백테스트)`}
      </button>
    </div>
    </div>
  );
}

// ── #8 최적화 결과 — 모든 조합 에쿼티 오버레이 (최적=하이라이트) ──
function OptEquityOverlay({ combos, best, height = 220 }) {
  const valid = (combos || []).filter(c => Array.isArray(c.equity) && c.equity.length > 1);
  if (!valid.length) return null;
  const W = 720, PADL = 46, PADR = 10, PADT = 10, PADB = 18;
  const norm = (c) => { const v0 = Number(c.equity[0].value) || 1; return c.equity.map(p => (Number(p.value) / v0) * 100); };
  const bestKey = best ? JSON.stringify(best.params) : null;
  let yMin = Infinity, yMax = -Infinity;
  const series = valid.map(c => { const ys = norm(c); ys.forEach(y => { if (y < yMin) yMin = y; if (y > yMax) yMax = y; }); return { ys, isBest: bestKey && JSON.stringify(c.params) === bestKey }; });
  if (!isFinite(yMin)) return null;
  const pad = (yMax - yMin) * 0.05 || 1; yMin -= pad; yMax += pad;
  const plotW = W - PADL - PADR, plotH = height - PADT - PADB;
  const xAt = (i, len) => PADL + (len <= 1 ? 0 : (i / (len - 1)) * plotW);
  const yAt = (v) => PADT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const path = (ys) => ys.map((y, i) => `${i === 0 ? "M" : "L"} ${xAt(i, ys.length).toFixed(1)} ${yAt(y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block" }}>
      {Array.from({ length: 5 }, (_, k) => { const v = yMin + (yMax - yMin) * k / 4; const y = yAt(v); return <g key={k}><line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke={DASH.border} strokeWidth={0.5} /><text x={PADL - 5} y={y + 3} textAnchor="end" fontSize={8.5} fill={DASH.muted}>{v.toFixed(0)}</text></g>; })}
      {series.filter(s => !s.isBest).map((s, i) => <path key={i} d={path(s.ys)} fill="none" stroke="#475569" strokeWidth={0.8} opacity={0.45} />)}
      {series.filter(s => s.isBest).map((s, i) => <path key={"b" + i} d={path(s.ys)} fill="none" stroke={DASH.blue} strokeWidth={2.2} />)}
      <text x={W - PADR} y={PADT + 9} textAnchor="end" fontSize={9} fill={DASH.blue}>━ 최적 조합 · 시작=100 정규화</text>
    </svg>
  );
}

// ── #8 최적화 히트맵 (지표 1개, p1×p2 그리드) ──
function OptHeatmap({ combos, p1, p2, a1, a2, metric, label, best, lowerBetter }) {
  const [tip, setTip] = useState(null); // {x,y,text} 커서 추적 플로팅 툴팁
  const valOf = (c) => { const v = Number(c.stats?.[metric]); return Number.isFinite(v) ? v : null; };
  const scored = combos.map(valOf).filter(v => v != null);
  const mn = scored.length ? Math.min(...scored) : 0, mx = scored.length ? Math.max(...scored) : 1;
  const colorFor = (s) => { if (s == null) return "#1f2937"; let t = mx === mn ? 0.5 : (s - mn) / (mx - mn); if (lowerBetter) t = 1 - t; return `hsl(${Math.round(t * 125)},62%,42%)`; };
  const findCombo = (v1, v2) => combos.find(c => c.params[p1] === v1 && (p2 ? c.params[p2] === v2 : true));
  const isPct = String(metric).includes("pct");
  const fmt = (s) => s == null ? "—" : (isPct ? s.toFixed(1) : s.toFixed(2));
  return (
    <div style={{ ...dashCard, marginBottom: 0, flex: "1 1 210px", minWidth: 196 }}>
      <div style={{ fontSize: 10.5, color: "#cbd5e1", fontWeight: 700, marginBottom: 8 }}>{label}{lowerBetter ? " ↓우수" : " ↑우수"}</div>
      <div style={{ overflow: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
          <tbody>
            {p2 ? a2.slice().reverse().map(v2 => (
              <tr key={v2}>
                <td style={{ fontSize: 9, color: DASH.muted, paddingRight: 5, textAlign: "right", fontFamily: "monospace" }}>{v2}</td>
                {a1.map(v1 => { const c = findCombo(v1, v2); const isBest = best && c && c.params[p1] === best.params[p1] && c.params[p2] === best.params[p2]; const v = c ? valOf(c) : null; return <td key={v1} onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,text:`${fmt(v)} : (${v1}, ${v2})`})} onMouseLeave={()=>setTip(null)} style={{ background: colorFor(v), width: 38, height: 26, textAlign: "center", fontSize: 7.5, color: "#fff", borderRadius: 3, outline: isBest ? "2px solid #fff" : "none", cursor:"crosshair" }}>{fmt(v)}</td>; })}
              </tr>
            )) : (
              <tr>{a1.map(v1 => { const c = findCombo(v1); const isBest = best && c && c.params[p1] === best.params[p1]; const v = c ? valOf(c) : null; return <td key={v1} onMouseMove={e=>setTip({x:e.clientX,y:e.clientY,text:`${fmt(v)} : (${v1})`})} onMouseLeave={()=>setTip(null)} style={{ background: colorFor(v), width: 44, height: 34, textAlign: "center", fontSize: 8.5, color: "#fff", borderRadius: 3, outline: isBest ? "2px solid #fff" : "none", cursor:"crosshair" }}>{fmt(v)}</td>; })}</tr>
            )}
            <tr><td />{a1.map(v1 => <td key={v1} style={{ fontSize: 8.5, color: DASH.muted, textAlign: "center", fontFamily: "monospace", paddingTop: 2 }}>{v1}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 8.5, color: "#64748b", marginTop: 4 }}>↔ {OPT_PARAM_LABEL[p1] || p1}{p2 ? ` · ↕ ${OPT_PARAM_LABEL[p2] || p2}` : ""}</div>
      {tip && <div style={{position:"fixed",left:tip.x+12,top:tip.y+12,zIndex:9999,background:"#0b0e14",border:`1px solid ${DASH.border}`,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:700,color:"#E5E7EB",pointerEvents:"none",whiteSpace:"nowrap",boxShadow:"0 4px 14px rgba(0,0,0,0.5)"}}>{tip.text}</div>}
    </div>
  );
}

const OPT_HEATMAP_METRICS = [["sharpe", "샤프 지수"], ["max_drawdown_pct", "MDD"], ["annualized_return_pct", "CAR(연환산)"], ["total_return_pct", "총 수익률"]];

function OptimizeResultView({ results, busy, progress, onApply, onOpenCombo, comboFull, onCloseCombo }) {
  const [hidden, setHidden] = useState({});       // 차트 표시/숨김 (Parameter Chart 토글)
  const [minSharpe, setMinSharpe] = useState(""); // 필터: 최소 Sharpe
  const [hideErr, setHideErr] = useState(false);  // 필터: 오류 조합 숨김
  const [pq, setPq] = useState("");               // 필터: 파라미터 검색
  if (!results) {
    return <div style={{padding:"40px 32px",color:"#94A3B8",fontSize:13,fontFamily:"'Inter',sans-serif"}}>
      {busy ? `최적화 실행 중…  ${progress.done}/${progress.total} 백테스트` : "최적화 위저드(🎯)에서 'Launch Optimization' 을 누르세요."}
    </div>;
  }
  const { metric, metricLabel, p1, p2, a1, a2, combos, best, flat, bestFull, runtime } = results;
  const lowerBetter = metric === "max_drawdown_pct";
  const fmt = (s)=> s==null?"—":(String(metric).includes("pct")? s.toFixed(1)+"%" : s.toFixed(2));
  const sortedRows = [...combos].sort((a,b)=> (a.score==null)-(b.score==null) || (lowerBetter ? (a.score-b.score) : (b.score-a.score)));
  const fmtMs = (ms)=> ms==null?"—":(ms>=1000?(ms/1000).toFixed(1)+"s":Math.round(ms)+"ms");
  const rt = runtime || {};
  const filteredRows = sortedRows.filter(c => {
    if (hideErr && c.stats?.error) return false;
    if (minSharpe!=="" && _fin(minSharpe) && !(Number(c.stats?.sharpe) >= Number(minSharpe))) return false;
    if (pq) { const txt = Object.entries(c.params).map(([k,v])=>`${OPT_PARAM_LABEL[k]||k}=${v}`).join(" ").toLowerCase(); if (!txt.includes(pq.toLowerCase())) return false; }
    return true;
  });

  return (
    <div style={{flex:1, minHeight:0, overflow:"auto", padding:"18px 24px 40px", color:DASH.text, background:DASH.bg, fontFamily:"'Inter',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <BarChart3 size={18} color="#F59E0B"/>
        <span style={{fontSize:17,fontWeight:800}}>최적화 결과</span>
        {busy && <span style={{fontSize:11,color:"#F59E0B"}}>· 실행 중 {progress.done}/{progress.total}</span>}
      </div>

      {/* 통계 바 (QC식) */}
      <div style={{display:"flex",flexWrap:"wrap",gap:0,marginBottom:14,padding:"4px 0",borderTop:`1px solid ${DASH.border}`,borderBottom:`1px solid ${DASH.border}`}}>
        <KpiCell label="완료" value={`${rt.completed ?? "—"}`} color={DASH.green}/>
        <KpiCell label="실패" value={`${rt.failed ?? 0}`} color={rt.failed?DASH.red:"#cbd5e1"}/>
        <KpiCell label="총 조합" value={`${rt.total ?? combos.length}`}/>
        <KpiCell label="실행 중" value={`${busy?1:0}`} color={busy?DASH.amber:"#cbd5e1"}/>
        <KpiCell label="대기열" value={`${busy?Math.max(0,(progress.total||0)-(progress.done||0)):0}`}/>
        <KpiCell label="평균 소요" value={fmtMs(rt.avgMs)}/>
        <KpiCell label="총 런타임" value={fmtMs(rt.totalMs)}/>
        <KpiCell label="Consumed" value={rt.consumed!=null?`$${rt.consumed.toFixed(3)}`:"—"} sub={rt.nodeTier?`${rt.nodeTier} node`:null} color={DASH.violet}/>
        <KpiCell label="목표 지표" value={metricLabel} color={DASH.amber}/>
      </div>

      {/* 설정(Configuration) 스트립 */}
      <div style={{...dashCard, display:"flex", flexWrap:"wrap", gap:"4px 22px", fontSize:11.5}}>
        <span style={{color:DASH.muted}}>최적화 전략 <b style={{color:DASH.text}}>Grid Search · {lowerBetter?"Min":"Max"} of {metricLabel}</b></span>
        <span style={{color:DASH.muted}}>{OPT_PARAM_LABEL[p1]||p1} <b style={{color:DASH.text}}>[{a1[0]} ~ {a1[a1.length-1]}]</b></span>
        {p2 && <span style={{color:DASH.muted}}>{OPT_PARAM_LABEL[p2]||p2} <b style={{color:DASH.text}}>[{a2[0]} ~ {a2[a2.length-1]}]</b></span>}
        <span style={{color:DASH.muted}}>기간 <b style={{color:DASH.text}}>{results.period||"—"}</b></span>
      </div>

      {flat && (
        <div style={{...dashCard, borderColor:"rgba(245,158,11,0.4)", background:"rgba(245,158,11,0.08)", color:"#fbbf24", fontSize:12.5, lineHeight:1.6}}>
          ⚠️ 모든 조합의 결과가 동일합니다. 선택한 전략이 스윕한 파라미터(<b>{[p1,p2].filter(Boolean).join(", ")}</b>)를 <b>사용하지 않을 가능성</b>이 큽니다.
          예: 무한매수(IB)·밸류리밸런싱(VR) 전략은 SMA/RSI 파라미터를 쓰지 않습니다. 해당 전략의 실제 파라미터로 스윕하세요.
        </div>
      )}

      {best && (
        <div style={{...dashCard, borderColor:"rgba(74,222,128,0.3)", background:"rgba(34,197,94,0.06)", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10.5,color:DASH.muted,fontWeight:700,marginBottom:4}}>최적 파라미터</div>
            <div style={{fontSize:14,fontWeight:800,fontFamily:"monospace"}}>
              {Object.entries(best.params).map(([k,v])=>`${OPT_PARAM_LABEL[k]||k}=${v}`).join("  ·  ")}
            </div>
            <div style={{fontSize:11.5,color:"#cbd5e1",marginTop:5}}>
              {metricLabel} <b style={{color:"#4ade80"}}>{fmt(best.score)}</b>
              {best.stats && <> · 수익 {fmt(best.stats.total_return_pct)} · Sharpe {best.stats.sharpe?.toFixed?.(2) ?? "—"} · MDD {best.stats.max_drawdown_pct?.toFixed?.(1) ?? "—"}%</>}
            </div>
          </div>
          <button onClick={()=>onApply(best.params)} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#16a34a,#15803d)",color:"white",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
            <CheckCircle2 size={14}/> 이 파라미터 적용
          </button>
        </div>
      )}

      {/* Parameter Chart 토글 (QC식 차트 선택 — 표시/숨김) */}
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:10.5,color:DASH.muted,fontWeight:700}}>Parameter Chart</span>
        {[["equity","에쿼티 오버레이"], ...OPT_HEATMAP_METRICS].map(([k,l])=>(
          <button key={k} onClick={()=>setHidden(h=>({...h,[k]:!h[k]}))} style={{padding:"3px 10px",borderRadius:999,fontSize:10.5,fontWeight:700,cursor:"pointer",border:`1px solid ${!hidden[k]?DASH.blue:"rgba(255,255,255,0.14)"}`,background:!hidden[k]?"rgba(96,165,250,0.15)":"transparent",color:!hidden[k]?"#93c5fd":DASH.muted}}>{l}</button>
        ))}
      </div>

      {/* 모든 조합 에쿼티 오버레이 */}
      {!hidden.equity && combos.some(c=>Array.isArray(c.equity)&&c.equity.length>1) && (
        <div style={dashCard}><div style={dashCardTitle}>📈 조합별 전략 에쿼티 ({combos.length}개 · 최적 강조)</div><OptEquityOverlay combos={combos} best={best}/></div>
      )}

      {/* 다중 히트맵 (샤프 / MDD / CAR / 총수익률) */}
      {OPT_HEATMAP_METRICS.some(([m])=>!hidden[m]) && (
      <div style={{marginBottom:14}}>
        <div style={{...dashCardTitle, marginBottom:8}}>🔥 파라미터 민감도 히트맵 {p2?`(${OPT_PARAM_LABEL[p1]||p1} × ${OPT_PARAM_LABEL[p2]||p2})`:`(${OPT_PARAM_LABEL[p1]||p1} 스윕)`}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          {OPT_HEATMAP_METRICS.filter(([m])=>!hidden[m]).map(([m,lbl])=>(
            <OptHeatmap key={m} combos={combos} p1={p1} p2={p2} a1={a1} a2={a2||[null]} metric={m} label={lbl} best={best} lowerBetter={m==="max_drawdown_pct"}/>
          ))}
        </div>
        <div style={{fontSize:9.5,color:"#64748b",marginTop:6}}>흰 테두리 = 목표지표({metricLabel}) 기준 최적 조합. 색이 고르면 견고(파라미터 둔감), 한쪽만 진하면 과최적화 위험.</div>
      </div>
      )}

      {/* 백테스트 목록 — 필터 + PSR + 행클릭 풀리포트 */}
      <div style={dashCard}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <div style={dashCardTitle} >백테스트 목록 ({filteredRows.length}/{sortedRows.length}) <span style={{fontWeight:400,color:"#64748b"}}>· 행 클릭 → 풀 리포트</span></div>
          <div style={{flex:1}}/>
          <input value={pq} onChange={e=>setPq(e.target.value)} placeholder="파라미터 검색" style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:11,padding:"4px 8px",width:130}}/>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#cbd5e1",whiteSpace:"nowrap"}}>Sharpe ≥ <input value={minSharpe} onChange={e=>setMinSharpe(e.target.value)} style={{background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#E5E7EB",fontSize:11,padding:"4px 6px",width:50,textAlign:"center"}}/></label>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#cbd5e1",cursor:"pointer"}}><input type="checkbox" checked={hideErr} onChange={e=>setHideErr(e.target.checked)} style={{accentColor:"#F59E0B",width:13,height:13}}/> 오류 숨김</label>
        </div>
        <DashTable
          onRowClick={onOpenCombo ? (c)=>onOpenCombo(c.params) : undefined}
          columns={[
            {label:"파라미터",align:"left",render:c=>Object.entries(c.params).map(([k,v])=>`${OPT_PARAM_LABEL[k]||k}=${v}`).join(", ")},
            {label:metricLabel,render:c=>fmt(c.score),color:()=>DASH.blue},
            {label:"수익률",render:c=>c.stats?.total_return_pct!=null?c.stats.total_return_pct.toFixed(1)+"%":(c.stats?.error?"오류":"—"),color:c=>signColor(c.stats?.total_return_pct)},
            {label:"Sharpe",render:c=>c.stats?.sharpe?.toFixed?.(2) ?? "—"},
            {label:"PSR",render:c=>c.stats?.psr_pct!=null?c.stats.psr_pct.toFixed(0)+"%":"—",color:()=>DASH.violet},
            {label:"MDD",render:c=>c.stats?.max_drawdown_pct!=null?c.stats.max_drawdown_pct.toFixed(1)+"%":"—",color:()=>DASH.amber},
            {label:"소요",render:c=>fmtMs(c.ms),color:()=>DASH.muted},
          ]}
          rows={filteredRows}/>
      </div>

      {/* 행 클릭한 조합의 풀 백테스트 리포트 (인라인) */}
      {comboFull && (
        <div style={{...dashCard, padding:0, overflow:"hidden", borderColor:"rgba(96,165,250,0.35)"}}>
          <div style={{...dashCardTitle, padding:"12px 16px 0", display:"flex", alignItems:"center", gap:8}}>
            <span>🔍 선택 조합 백테스트 — {Object.entries(comboFull.params||{}).map(([k,v])=>`${OPT_PARAM_LABEL[k]||k}=${v}`).join(" · ")}</span>
            <div style={{flex:1}}/>
            <button onClick={onCloseCombo} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:13}}>✕ 닫기</button>
          </div>
          {comboFull.loading
            ? <div style={{padding:"24px 16px",color:DASH.muted,fontSize:12.5}}>백테스트 실행 중…</div>
            : comboFull.error
              ? <div style={{padding:"24px 16px",color:"#fca5a5",fontSize:12.5}}>오류: {comboFull.error}</div>
              : <BacktestReportView btResult={comboFull.result} />}
        </div>
      )}

      {/* 최적 파라미터 적용 풀 백테스트 → 리치 대시보드 재사용 */}
      {bestFull && best && (
        <div style={{...dashCard, padding:0, overflow:"hidden"}}>
          <div style={{...dashCardTitle, padding:"12px 16px 0"}}>🏆 최적 파라미터 적용 백테스트 — {Object.entries(best.params).map(([k,v])=>`${OPT_PARAM_LABEL[k]||k}=${v}`).join(" · ")}</div>
          <BacktestReportView btResult={bestFull} />
        </div>
      )}
    </div>
  );
}

// ── LiveDashboard — 배포 완료 후 실시간 잔고 + 컨트롤 ──
function LiveDashboard({ wsId, done, strategyName, autoRestart, onStop }) {
  const [liveEq, setLiveEq] = useState([]);
  const [bal, setBal] = useState(null);
  const [confirmLiq, setConfirmLiq] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const fetchBal = () => getBrokerBalance(done.env, done.brokerType).then(b => {
      setBal(b);
      const val = b?.net_assets ?? b?.cash_usd ?? null;
      if (val != null) setLiveEq(prev => [...prev.slice(-288), { date: new Date().toISOString(), value: Number(val) }]);
    }).catch(() => {});
    fetchBal();
    const t = setInterval(fetchBal, 5000);
    return () => clearInterval(t);
  }, [done.env, done.brokerType]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await setBrokerTrading(done.env, false, done.brokerType);
      await updateWorkspaceStatus(wsId, "IDLE");
      onStop();
    } catch (e) { setStopping(false); }
  };

  const handleLiquidate = async () => {
    setConfirmLiq(false);
    try { await setBrokerTrading(done.env, false, done.brokerType); } catch (e) {}
  };

  const LD_THEME = { accent:"#10b981", text:"#e5e7eb", textMuted:"#94a3b8", panel:"#161b22", panelBorder:"rgba(255,255,255,0.12)", panelAlt:"rgba(16,185,129,0.12)" };
  const eqSeries = liveEq.length > 1
    ? [{ name: "자산", color: "#10b981", width: 2, points: liveEq.map(d => ({ x: new Date(d.date), y: d.value })) }]
    : [];
  const lastVal = liveEq.length ? liveEq[liveEq.length - 1].value : null;

  return (
    <div style={{padding:"22px 28px",color:"#E5E7EB",maxWidth:760,fontFamily:"'Inter',sans-serif"}}>
      {/* 확인 다이얼로그 */}
      {confirmLiq && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#161b22",borderRadius:14,border:"1px solid rgba(239,68,68,0.35)",padding:"28px 36px",maxWidth:400,textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#e5e7eb",marginBottom:10}}>포지션 전량 청산?</div>
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:22,lineHeight:1.6}}>모든 보유 포지션을 시장가로 청산하고 매매 스위치를 끕니다.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={() => setConfirmLiq(false)} style={{padding:"8px 20px",borderRadius:7,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"#cbd5e1",cursor:"pointer",fontWeight:700,fontSize:12}}>취소</button>
              <button onClick={handleLiquidate} style={{padding:"8px 20px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#dc2626,#b91c1c)",color:"white",cursor:"pointer",fontWeight:800,fontSize:12}}>청산</button>
            </div>
          </div>
        </div>
      )}
      {/* 헤더 */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Rocket size={18} color="#4ade80"/>
        <span style={{fontSize:17,fontWeight:800}}>라이브 대시보드</span>
        <span style={{fontSize:11.5,color:"#64748b"}}>{strategyName}</span>
        <span style={{fontSize:10,padding:"3px 9px",borderRadius:999,background:"rgba(34,197,94,0.15)",color:"#4ade80",fontWeight:700,marginLeft:"auto",flexShrink:0}}>● LIVE</span>
        <button onClick={() => setConfirmLiq(true)}
          style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>
          Liquidate
        </button>
        <button onClick={handleStop} disabled={stopping}
          style={{padding:"6px 14px",borderRadius:7,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#fca5a5",fontSize:11.5,fontWeight:700,cursor:stopping?"not-allowed":"pointer",opacity:stopping?0.6:1}}>
          {stopping ? "중지 중…" : "Stop"}
        </button>
      </div>
      {/* KPI 바 */}
      <div style={{display:"flex",gap:0,background:"#12161d",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",marginBottom:14,overflow:"hidden"}}>
        {[
          { label:"계좌", value:`${done.brokerType} [${done.env}]`, color:"#94a3b8" },
          { label:"순자산", value: lastVal != null ? `$${Number(lastVal).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}` : "조회 중…", color:"#4ade80" },
          { label:"예수금", value: bal?.cash_krw ? `₩${Number(bal.cash_krw).toLocaleString()}` : bal?.cash_usd != null ? `$${Number(bal.cash_usd).toLocaleString()}` : "—", color:"#60a5fa" },
          { label:"보유종목", value: bal ? `${(bal.positions||[]).length}종목` : "—", color:"#a78bfa" },
          { label:"자동체결", value: done.autoExec ? "ON" : "OFF", color: done.autoExec ? "#4ade80" : "#64748b" },
          { label:"폴링", value:"5초", color:"#64748b" },
        ].map((k,i)=>(
          <div key={i} style={{padding:"10px 16px",borderRight:"1px solid rgba(255,255,255,0.06)",flex:1,minWidth:80}}>
            <div style={{fontSize:12.5,fontWeight:800,color:k.color,whiteSpace:"nowrap"}}>{k.value}</div>
            <div style={{fontSize:9.5,color:"#4B5563",fontWeight:600,textTransform:"uppercase",marginTop:3}}>{k.label}</div>
          </div>
        ))}
      </div>
      {/* 라이브 에쿼티 차트 */}
      <div style={{background:"#161b22",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:10.5,color:"#94a3b8",fontWeight:700,marginBottom:8}}>📈 실시간 자산 추이 (5초 갱신)</div>
        {eqSeries.length > 0
          ? <TrendLineChart series={eqSeries} theme={LD_THEME} height={140}/>
          : <div style={{textAlign:"center",color:"#4B5563",padding:"28px 0",fontSize:11}}>자산 데이터 수집 중…</div>}
      </div>
      {/* 보유 포지션 */}
      {(bal?.positions || []).length > 0 && (
        <div style={{background:"#161b22",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10.5,color:"#94a3b8",fontWeight:700,marginBottom:8}}>📦 보유 포지션</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {(bal.positions).slice(0,16).map((p,i)=>(
              <span key={i} style={{fontSize:10.5,padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.06)",color:"#cbd5e1"}}>
                {p.ticker} <b>{p.qtyDecimal ?? p.qty ?? ""}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* 안내 */}
      <div style={{fontSize:10.5,color:"#4B5563",marginTop:14,lineHeight:1.6}}>
        ⚠️ {done.env === "REAL" ? "실거래: 전역 kill-switch·1건/일일 한도 적용." : "모의(MOCK): 자본 위험 없음."}{autoRestart ? " · 자동 재가동 ON." : ""} Stop은 워크스페이스를 IDLE로 전환합니다.
      </div>
    </div>
  );
}

// ── BacktestReportView ────────────────────────────────────────────────────────
// ── Deploy to Live 위저드 (우리 KIS/Binance 자동체결 파이프라인 연결) ──
function DeployWizardView({ wsId, strategyName }) {
  const [accts, setAccts] = useState([]);
  const [selId, setSelId] = useState("");
  const [autoExec, setAutoExec] = useState(true);
  const [autoRestart, setAutoRestart] = useState(true);
  const [notifOrder, setNotifOrder] = useState(true);
  const [notifInsight, setNotifInsight] = useState(true);
  const [show, setShow] = useState({ data: false, cash: false, hold: false });
  const [bal, setBal] = useState(null);
  const [balLoading, setBalLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  const [deployStage, setDeployStage] = useState(null);

  useEffect(() => {
    listBrokerAccounts().then(r => {
      const list = Array.isArray(r) ? r : [];
      setAccts(list);
      const first = list.find(a => a.env === "MOCK") || list[0];
      if (first) setSelId(String(first.id));
    }).catch(() => setAccts([]));
  }, []);

  const sel = accts.find(a => String(a.id) === String(selId));
  const isReal = sel?.env === "REAL";
  const assetClass = sel?.brokerType === "BINANCE" ? "암호화폐(현물)" : "해외주식·ETF";
  const acctName = (a) => `${a.env === "MOCK" ? "Paper Trading · 모의" : `${a.brokerType} · 실거래`} (${a.accountAlias || a.accountNumber || "#" + a.id})`;

  // Show 토글 시 잔고 lazy fetch
  useEffect(() => {
    if (!sel || !(show.cash || show.hold) || bal) return;
    setBalLoading(true);
    getBrokerBalance(sel.env, sel.brokerType).then(setBal).catch(() => setBal({ err: true })).finally(() => setBalLoading(false));
  }, [sel, show.cash, show.hold, bal]);
  useEffect(() => { setBal(null); setShow({ data: false, cash: false, hold: false }); }, [selId]);

  const deploy = async () => {
    if (!wsId || !sel) { setErr("배포할 계좌를 선택하세요."); return; }
    setBusy(true); setErr(null);
    try {
      setDeployStage("requesting");
      await linkWorkspaceBroker(wsId, sel.id);
      setDeployStage("logging_in");
      await updateWorkspaceStatus(wsId, "LIVE");
      setDeployStage("initializing");
      await setBrokerTrading(sel.env, true, sel.brokerType);
      if (autoExec) await setBrokerAutoExecute(sel.env, true, sel.brokerType);
      setDeployStage("deployed");
      await new Promise(r => setTimeout(r, 1800));
      setDeployStage(null);
      setDone({ env: sel.env, brokerType: sel.brokerType, autoExec });
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "배포 실패");
      setDeployStage(null);
    } finally { setBusy(false); }
  };

  const card = { background: "#161b22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 12, overflow: "hidden" };
  const rowS = { display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" };
  const rowLbl = { display: "flex", alignItems: "center", gap: 8, width: 150, flexShrink: 0, fontSize: 12.5, color: "#cbd5e1", fontWeight: 600 };

  if (done) {
    return <LiveDashboard wsId={wsId} done={done} strategyName={strategyName} autoRestart={autoRestart} onStop={() => setDone(null)} />;
  }

  const DEPLOY_STAGES = [
    { id: "requesting",   label: "Requesting New Live Trading Deployment" },
    { id: "logging_in",  label: "Logging into Brokerage" },
    { id: "initializing",label: "Initializing Algorithm" },
    { id: "deployed",    label: "Successfully Deployed" },
  ];
  const stageOrder = DEPLOY_STAGES.map(s => s.id);

  return (
    <div style={{ padding: "22px 32px", color: "#E5E7EB", maxWidth: 760, fontFamily: "'Inter',sans-serif", position: "relative" }}>
      {/* ═ 배포 단계별 오버레이 모달 ═ */}
      {deployStage && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid rgba(124,58,237,0.35)",padding:"32px 40px",minWidth:380,maxWidth:480,boxShadow:"0 0 60px rgba(124,58,237,0.18)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
              <Rocket size={17} color="#a78bfa"/>
              <span style={{fontSize:15,fontWeight:800,color:"#e5e7eb"}}>라이브 배포 진행 중…</span>
            </div>
            {DEPLOY_STAGES.map((step, idx) => {
              const curIdx = stageOrder.indexOf(deployStage);
              const stepIdx = stageOrder.indexOf(step.id);
              const isDone = deployStage === "deployed" || stepIdx < curIdx;
              const isActive = deployStage !== "deployed" && stepIdx === curIdx;
              return (
                <div key={step.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:idx<3?"1px solid rgba(255,255,255,0.06)":"none"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                    background:isDone?"rgba(34,197,94,0.15)":isActive?"rgba(96,165,250,0.15)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${isDone?"rgba(74,222,128,0.45)":isActive?"rgba(96,165,250,0.45)":"rgba(255,255,255,0.1)"}`}}>
                    {isDone ? <CheckCircle2 size={14} color="#4ade80"/>
                      : isActive ? <Loader size={12} color="#60a5fa" style={{animation:"spin 1s linear infinite"}}/>
                      : <span style={{fontSize:10,fontWeight:800,color:"#4B5563"}}>{idx+1}</span>}
                  </div>
                  <span style={{fontSize:13,color:isDone?"#4ade80":isActive?"#e5e7eb":"#475569",fontWeight:isDone||isActive?700:400}}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Rocket size={20} color="#a78bfa" /><span style={{ fontSize: 18, fontWeight: 800 }}>Deploy Live</span>
          <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{strategyName || "전략"}</span>
        </div>
        <button onClick={deploy} disabled={busy || !sel}
          style={{ padding: "8px 22px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 800, cursor: busy || !sel ? "not-allowed" : "pointer", color: "white", background: busy || !sel ? "rgba(124,58,237,0.3)" : (isReal ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#7c3aed,#6d28d9)") }}>
          {busy ? "배포 중…" : "Deploy"}
        </button>
      </div>

      <div style={card}>
        {/* Brokerage */}
        <div style={rowS}>
          <div style={rowLbl}>🏦 Brokerage</div>
          {accts.length === 0
            ? <div style={{ fontSize: 12, color: "#fbbf24" }}>등록된 계좌 없음 — '종합 계좌 잔고'에서 KIS/Binance 등록</div>
            : <select value={selId} onChange={e => setSelId(e.target.value)} style={{ flex: 1, background: "#0d1117", border: `1px solid ${isReal ? "#f87171" : "rgba(255,255,255,0.14)"}`, borderRadius: 8, color: "#E5E7EB", fontSize: 13, padding: "9px 11px", fontWeight: 600 }}>
                {accts.map(a => <option key={a.id} value={a.id}>{acctName(a)}</option>)}
              </select>}
        </div>
        {sel && <div style={{ ...rowS, paddingTop: 6, paddingBottom: 10 }}>
          <div style={rowLbl} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isReal ? "rgba(248,113,113,0.15)" : "rgba(96,165,250,0.15)", color: isReal ? "#f87171" : "#93c5fd" }}>{sel.env}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(99,102,241,0.12)", color: "#a5b4fc" }}>{assetClass}</span>
            {sel.tradingEnabled ? <span style={{ fontSize: 10, color: "#4ade80" }}>매매 ON</span> : <span style={{ fontSize: 10, color: "#64748B" }}>매매 OFF</span>}
          </div>
        </div>}

        {/* Node */}
        <div style={rowS}>
          <div style={rowLbl}>🖧 Node</div>
          <div style={{ fontSize: 12.5, color: "#e2e8f0" }}>AlphaHelix 클라우드 노드 <span style={{ color: "#64748B", fontSize: 11 }}>· analytics(c6i) · 관리형 실행</span></div>
        </div>

        {/* Data Provider */}
        <div style={rowS}>
          <div style={rowLbl}>🗄 Data Provider</div>
          <div style={{ flex: 1, fontSize: 12, color: "#94A3B8" }}>1개 선택됨</div>
          <button onClick={() => setShow(s => ({ ...s, data: !s.data }))} style={linkBtn}>{show.data ? "숨기기" : "표시"}</button>
        </div>
        {show.data && <div style={{ ...rowS, paddingTop: 0, color: "#cbd5e1", fontSize: 12 }}><div style={rowLbl} /><div>{sel?.brokerType === "BINANCE" ? "Binance 공개 API · yfinance(보조)" : "yfinance / Polygon(설정 시) · KIS 시세"}</div></div>}

        {/* Cash State */}
        <div style={rowS}>
          <div style={rowLbl}>💵 예수금(Cash)</div>
          <div style={{ flex: 1, fontSize: 12, color: "#94A3B8" }}>{show.cash ? (balLoading ? "조회 중…" : bal?.err ? "조회 실패" : `${bal?.cash_usd != null ? "$" + Number(bal.cash_usd).toLocaleString() : ""}${bal?.cash_krw ? " · ₩" + Number(bal.cash_krw).toLocaleString() : ""}` || "—") : "라이브 계좌 예수금"}</div>
          <button onClick={() => setShow(s => ({ ...s, cash: !s.cash }))} style={linkBtn}>{show.cash ? "숨기기" : "표시"}</button>
        </div>

        {/* Holdings State */}
        <div style={rowS}>
          <div style={rowLbl}>📦 보유 종목</div>
          <div style={{ flex: 1, fontSize: 12, color: "#94A3B8" }}>{show.hold ? (balLoading ? "조회 중…" : bal?.err ? "조회 실패" : `${(bal?.positions || []).length}종목 보유`) : "라이브 계좌 포지션"}</div>
          <button onClick={() => setShow(s => ({ ...s, hold: !s.hold }))} style={linkBtn}>{show.hold ? "숨기기" : "표시"}</button>
        </div>
        {show.hold && (bal?.positions || []).length > 0 && <div style={{ ...rowS, paddingTop: 0, flexWrap: "wrap" }}><div style={rowLbl} /><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{(bal.positions).slice(0, 12).map((p, i) => <span key={i} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>{p.ticker} {p.qtyDecimal ?? p.qty ?? ""}</span>)}</div></div>}

        {/* Notifications */}
        <div style={{ ...rowS, alignItems: "flex-start" }}>
          <div style={{ ...rowLbl, paddingTop: 2 }}>🔔 알림</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={chkLbl}><input type="checkbox" checked={notifOrder} onChange={e => setNotifOrder(e.target.checked)} style={chkBox} /> 체결 알림(Order Events)</label>
            <label style={chkLbl}><input type="checkbox" checked={notifInsight} onChange={e => setNotifInsight(e.target.checked)} style={chkBox} /> 시그널 알림(Insights)</label>
          </div>
        </div>

        {/* Auto restart */}
        <div style={rowS}>
          <div style={rowLbl}>♻️ 자동 재가동</div>
          <label style={chkLbl}><input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} style={chkBox} /> 장 시작 시 시그널 스케줄 자동 유지</label>
        </div>

        {/* 체결 방식 */}
        <div style={{ ...rowS, borderBottom: "none" }}>
          <div style={rowLbl}>⚡ 체결 방식</div>
          <label style={chkLbl}><input type="checkbox" checked={autoExec} onChange={e => setAutoExec(e.target.checked)} style={chkBox} /> 자동 체결 (안전게이트 통과 시 자동 주문)</label>
        </div>
      </div>

      {/* 안전 게이트 / note */}
      <div style={{ ...card, padding: "12px 16px", borderColor: isReal ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)", background: isReal ? "rgba(248,113,113,0.06)" : "#161b22" }}>
        <div style={{ fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.7 }}>
          {isReal
            ? "⚠️ 실거래(REAL): 전역 kill-switch · 1건/일일 한도 · 손실 서킷브레이커가 모든 주문에 적용됩니다. REAL 졸업 게이트(2주+20회) 통과 계좌만 권장."
            : "🧪 모의(MOCK): 자본 위험 없음. 한도·게이트는 검증 목적 동일 적용. 라이브 거래는 위험을 수반합니다."}
        </div>
      </div>

      {err && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>⚠ {err}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 10.5, color: "#64748B", lineHeight: 1.6 }}>Deploy = 워크스페이스 LIVE + 계좌 연결 + 매매 스위치 ON{autoExec ? " + 자동 체결" : ""}. 라이브 배포 시 약관에 동의합니다.</div>
        <button onClick={deploy} disabled={busy || !sel}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "11px 26px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 800, cursor: busy || !sel ? "not-allowed" : "pointer", color: "white", background: busy || !sel ? "rgba(124,58,237,0.3)" : (isReal ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#7c3aed,#6d28d9)"), boxShadow: busy || !sel ? "none" : "0 3px 12px rgba(109,40,217,0.4)" }}>
          {busy ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Rocket size={14} />}
          {busy ? "배포 중…" : (isReal ? "실거래 배포" : "모의 배포")}
        </button>
      </div>
    </div>
  );
}
const linkBtn = { background: "none", border: "none", color: "#60a5fa", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 };
const chkLbl = { display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12.5, color: "#cbd5e1" };
const chkBox = { accentColor: "#a78bfa", width: 15, height: 15 };

// ── QC급 백테스트 대시보드 — 공통 팔레트 + 포맷터 ──
const DASH = { bg:"#0f1117", panel:"#161b22", border:"rgba(255,255,255,0.08)", text:"#E5E7EB", muted:"#94A3B8", green:"#22c55e", red:"#ef4444", blue:"#60a5fa", amber:"#f59e0b", violet:"#a78bfa" };
const _fin = (v) => v != null && Number.isFinite(Number(v));
const fmtMoney = (v, d=2) => !_fin(v) ? "N/A" : `${Number(v)<0?"-":""}$${Math.abs(Number(v)).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})}`;
const fmtMoneyK = (v) => { if(!_fin(v)) return "N/A"; const a=Math.abs(Number(v)),sg=Number(v)<0?"-":""; if(a>=1e9)return `${sg}$${(a/1e9).toFixed(2)}B`; if(a>=1e6)return `${sg}$${(a/1e6).toFixed(2)}M`; if(a>=1e3)return `${sg}$${(a/1e3).toFixed(1)}K`; return `${sg}$${a.toFixed(0)}`; };
const fmtPctS = (v, sign=true) => !_fin(v) ? "N/A" : `${sign&&Number(v)>0?"+":""}${Number(v).toFixed(2)}%`;
const fmtN = (v, d=2) => !_fin(v) ? "N/A" : Number(v).toFixed(d);
const signColor = (v) => !_fin(v) ? DASH.text : (Number(v) >= 0 ? DASH.green : DASH.red);

// 상단 KPI 셀 (QC 메트릭바)
function KpiCell({ label, value, sub, color }) {
  return (
    <div style={{padding:"9px 16px 9px 0", minWidth:104}}>
      <div style={{fontSize:19,fontWeight:800,color:color||DASH.text,fontVariantNumeric:"tabular-nums",lineHeight:1.1,whiteSpace:"nowrap"}}>{value}</div>
      <div style={{fontSize:10,color:DASH.muted,fontWeight:600,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
      {sub != null && <div style={{fontSize:9.5,color:color||DASH.muted,marginTop:1}}>{sub}</div>}
    </div>
  );
}
function StatLine({ label, value, color }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
      <span style={{fontSize:11.5,color:DASH.muted}}>{label}</span>
      <b style={{fontSize:12,color:color||DASH.text,fontVariantNumeric:"tabular-nums"}}>{value}</b>
    </div>
  );
}
const dashCard = { background:DASH.panel, border:`1px solid ${DASH.border}`, borderRadius:12, padding:"14px 16px", marginBottom:14 };
const dashCardTitle = { fontSize:11,color:"#cbd5e1",fontWeight:700,marginBottom:10 };
const segBtn = (on) => ({ padding:"3px 10px", borderRadius:5, border:"none", cursor:"pointer", fontSize:10.5, fontWeight:700, background:on?DASH.blue:"transparent", color:on?"#fff":DASH.muted });

// 일별 수익률 막대 (양=초록 / 음=빨강)
function ReturnsBars({ data, height=80 }) {
  const pts = (data||[]).filter(d=>d && d.ret_pct!=null);
  if (pts.length < 2) return null;
  const W=720, PADL=40, PADR=8, PADT=6, PADB=14;
  const mx = Math.max(0.01, ...pts.map(d=>Math.abs(d.ret_pct)));
  const plotW=W-PADL-PADR, plotH=height-PADT-PADB;
  const xAt=i=>PADL+(i/(pts.length-1))*plotW;
  const yAt=v=>PADT+(1-(v+mx)/(2*mx))*plotH;
  const bw=Math.max(0.6,(plotW/pts.length)*0.7);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {[mx,-mx].map((v,k)=><text key={k} x={PADL-5} y={yAt(v)+3} textAnchor="end" fontSize={8.5} fill={DASH.muted}>{v.toFixed(1)}%</text>)}
      <line x1={PADL} x2={W-PADR} y1={yAt(0)} y2={yAt(0)} stroke={DASH.border} strokeWidth={0.8}/>
      {pts.map((d,i)=>{ const v=d.ret_pct; return <rect key={i} x={xAt(i)-bw/2} y={Math.min(yAt(0),yAt(v))} width={bw} height={Math.max(0.4,Math.abs(yAt(v)-yAt(0)))} fill={v>=0?DASH.green:DASH.red} opacity={0.7}><title>{`${d.date}: ${v.toFixed(2)}%`}</title></rect>; })}
    </svg>
  );
}

// 낙폭(드로다운) 영역 차트
function DrawdownArea({ data, height=150 }) {
  const pts=(data||[]).filter(d=>d && d.dd_pct!=null);
  if(pts.length<2) return null;
  const W=720,PADL=44,PADR=10,PADT=10,PADB=20;
  const mn=Math.min(-0.01,...pts.map(d=>d.dd_pct));
  const plotW=W-PADL-PADR, plotH=height-PADT-PADB;
  const xAt=i=>PADL+(i/(pts.length-1))*plotW;
  const yAt=v=>PADT+(1-(v-mn)/(0-mn))*plotH;
  const line=pts.map((p,i)=>`${i===0?"M":"L"} ${xAt(i).toFixed(1)} ${yAt(p.dd_pct).toFixed(1)}`).join(" ");
  const area=`M ${xAt(0)} ${yAt(0)} ${line.slice(1)} L ${xAt(pts.length-1)} ${yAt(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {Array.from({length:5},(_,k)=>{ const v=mn*(1-k/4); const y=yAt(v); return <g key={k}><line x1={PADL} x2={W-PADR} y1={y} y2={y} stroke={DASH.border} strokeWidth={0.5}/><text x={PADL-5} y={y+3} textAnchor="end" fontSize={8.5} fill={DASH.muted}>{v.toFixed(1)}%</text></g>; })}
      <path d={area} fill="rgba(239,68,68,0.18)"/>
      <path d={line} fill="none" stroke="#ef4444" strokeWidth={1.4}/>
    </svg>
  );
}

// 월별 수익률 히트맵 (연 × 12개월 + 연간합)
function MonthlyHeatmap({ months }) {
  const data=(months||[]).filter(m=>m && m.ret_pct!=null);
  if(!data.length) return null;
  const years=[...new Set(data.map(m=>m.year))].sort();
  const byYM={}; data.forEach(m=>{byYM[`${m.year}-${m.month}`]=m.ret_pct;});
  const mx=Math.max(1,...data.map(m=>Math.abs(m.ret_pct)));
  const color=v=>{ if(v==null) return "transparent"; const t=Math.min(1,Math.abs(v)/mx); const a=0.14+t*0.62; return v>=0?`rgba(34,197,94,${a})`:`rgba(239,68,68,${a})`; };
  const yearTotal=y=>{ const ms=data.filter(m=>m.year===y); return (ms.reduce((acc,m)=>acc*(1+m.ret_pct/100),1)-1)*100; };
  const cell={padding:"5px 3px",fontSize:9.5,textAlign:"center",fontVariantNumeric:"tabular-nums"};
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"separate",borderSpacing:2,width:"100%",minWidth:560}}>
        <thead><tr><th style={{...cell,color:DASH.muted}}/>{Array.from({length:12},(_,i)=><th key={i} style={{...cell,color:DASH.muted}}>{i+1}</th>)}<th style={{...cell,color:DASH.muted,fontWeight:700}}>연간</th></tr></thead>
        <tbody>{years.map(y=>(
          <tr key={y}>
            <td style={{...cell,color:DASH.muted,fontWeight:700}}>{y}</td>
            {Array.from({length:12},(_,mi)=>{ const v=byYM[`${y}-${mi+1}`]; return <td key={mi} style={{...cell,background:color(v),color:v==null?DASH.muted:"#fff",borderRadius:3}} title={v==null?"":`${y}-${mi+1}: ${v.toFixed(2)}%`}>{v==null?"":v.toFixed(1)}</td>; })}
            {(()=>{const yt=yearTotal(y);return <td style={{...cell,fontWeight:800,color:yt>=0?DASH.green:DASH.red}}>{yt.toFixed(1)}</td>;})()}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// 일별 수익률 분포 히스토그램
function ReturnsHistogram({ data, height=150 }) {
  const vals=(data||[]).map(d=>d?.ret_pct).filter(v=>_fin(v));
  if(vals.length<5) return null;
  const mn=Math.min(...vals), mx=Math.max(...vals); const span=(mx-mn)||1;
  const bins=21, w=span/bins, counts=new Array(bins).fill(0);
  vals.forEach(v=>{ let b=Math.floor((v-mn)/w); b=Math.max(0,Math.min(bins-1,b)); counts[b]++; });
  const cmax=Math.max(...counts,1);
  const W=720,PADL=28,PADR=10,PADT=8,PADB=18; const plotW=W-PADL-PADR, plotH=height-PADT-PADB, bw=plotW/bins;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {counts.map((c,i)=>{ const bl=mn+i*w; const h=(c/cmax)*plotH; return <rect key={i} x={PADL+i*bw+0.5} y={PADT+plotH-h} width={bw-1} height={h} fill={bl>=0?DASH.green:DASH.red} opacity={0.6}><title>{`${bl.toFixed(2)}%~${(bl+w).toFixed(2)}%: ${c}일`}</title></rect>; })}
      <line x1={PADL} x2={W-PADR} y1={PADT+plotH} y2={PADT+plotH} stroke={DASH.border}/>
      {mn<0&&mx>0&&(()=>{const zx=PADL+((0-mn)/span)*plotW;return <line x1={zx} x2={zx} y1={PADT} y2={PADT+plotH} stroke={DASH.muted} strokeDasharray="3 3" strokeWidth={0.8}/>;})()}
      <text x={PADL} y={height-5} fontSize={8.5} fill={DASH.muted}>{mn.toFixed(1)}%</text>
      <text x={W-PADR} y={height-5} textAnchor="end" fontSize={8.5} fill={DASH.muted}>{mx.toFixed(1)}%</text>
    </svg>
  );
}

// 공통 머니 약식 포맷 (차트 축용)
const _fmtMoneyAxis = (v) => { const a=Math.abs(Number(v)||0); const s=Number(v)<0?"-":""; return a>=1e9?`${s}$${(a/1e9).toFixed(1)}B`:a>=1e6?`${s}$${(a/1e6).toFixed(0)}M`:a>=1e3?`${s}$${(a/1e3).toFixed(0)}K`:`${s}$${a.toFixed(0)}`; };

// 보유평가액 + 현금 스택 영역 (QC Holdings) — holdings/cash 각 [{date,value}]
function HoldingsCashArea({ holdings, cash, height=160 }) {
  const h=(holdings||[]).filter(d=>d&&d.value!=null), c=(cash||[]).filter(d=>d&&d.value!=null);
  const n=Math.min(h.length,c.length);
  if(n<2) return null;
  const W=720,PADL=54,PADR=10,PADT=10,PADB=18;
  const tot=Array.from({length:n},(_,i)=>(+h[i].value||0)+(+c[i].value||0));
  const mx=Math.max(1,...tot), plotW=W-PADL-PADR, plotH=height-PADT-PADB;
  const xAt=i=>PADL+(i/(n-1))*plotW, yAt=v=>PADT+(1-v/mx)*plotH;
  const cashTop=i=>+c[i].value||0, holdTop=i=>(+c[i].value||0)+(+h[i].value||0);
  const areaPath=(topFn,botFn)=>{ let up=""; for(let i=0;i<n;i++) up+=`${i===0?"M":"L"} ${xAt(i).toFixed(1)} ${yAt(topFn(i)).toFixed(1)} `; let dn=""; for(let i=n-1;i>=0;i--) dn+=`L ${xAt(i).toFixed(1)} ${yAt(botFn(i)).toFixed(1)} `; return up+dn+"Z"; };
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {Array.from({length:4},(_,k)=>{const v=mx*(1-k/3);const y=yAt(v);return <g key={k}><line x1={PADL} x2={W-PADR} y1={y} y2={y} stroke={DASH.border} strokeWidth={0.5}/><text x={PADL-5} y={y+3} textAnchor="end" fontSize={8} fill={DASH.muted}>{_fmtMoneyAxis(v)}</text></g>;})}
      <path d={areaPath(cashTop,()=>0)} fill="rgba(148,163,184,0.28)"/>
      <path d={areaPath(holdTop,cashTop)} fill="rgba(96,165,250,0.30)"/>
      <path d={Array.from({length:n},(_,i)=>`${i===0?"M":"L"} ${xAt(i).toFixed(1)} ${yAt(holdTop(i)).toFixed(1)}`).join(" ")} fill="none" stroke="#60a5fa" strokeWidth={1.2}/>
    </svg>
  );
}

// 투자비중(Exposure) 라인 — 롱온리 레버리지/마진 프록시 겸용. data=[{date,exposure_pct}]
function ExposureLine({ data, height=130 }) {
  const pts=(data||[]).filter(d=>d&&d.exposure_pct!=null);
  if(pts.length<2) return null;
  const W=720,PADL=40,PADR=10,PADT=10,PADB=18;
  const mx=Math.max(100,...pts.map(d=>d.exposure_pct)), plotW=W-PADL-PADR, plotH=height-PADT-PADB;
  const xAt=i=>PADL+(i/(pts.length-1))*plotW, yAt=v=>PADT+(1-v/mx)*plotH;
  const line=pts.map((p,i)=>`${i===0?"M":"L"} ${xAt(i).toFixed(1)} ${yAt(p.exposure_pct).toFixed(1)}`).join(" ");
  const area=`M ${xAt(0)} ${yAt(0)} ${line.slice(1)} L ${xAt(pts.length-1)} ${yAt(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {[0,25,50,75,100].filter(v=>v<=mx).map((v,k)=>{const y=yAt(v);return <g key={k}><line x1={PADL} x2={W-PADR} y1={y} y2={y} stroke={DASH.border} strokeWidth={0.5}/><text x={PADL-5} y={y+3} textAnchor="end" fontSize={8} fill={DASH.muted}>{v}%</text></g>;})}
      <path d={area} fill="rgba(167,139,250,0.16)"/>
      <path d={line} fill="none" stroke="#a78bfa" strokeWidth={1.4}/>
    </svg>
  );
}

// 종목별 거래대금 트리맵 (QC Assets Sales Volume) — items=[{ticker,total,buy,sell}]
function AssetsVolumeTreemap({ items, height=170 }) {
  const data=(items||[]).filter(d=>d&&d.total>0).sort((a,b)=>b.total-a.total);
  if(!data.length) return null;
  const W=720, sum=data.reduce((s,d)=>s+d.total,0);
  const horiz=W>=height; let off=0;
  const rects=data.map(d=>{ const frac=d.total/sum; let r; if(horiz){const dw=W*frac; r={d,x:off,y:0,w:dw,h:height}; off+=dw;} else {const dh=height*frac; r={d,x:0,y:off,w:W,h:dh}; off+=dh;} return r; });
  const palette=["#60a5fa","#a78bfa","#34d399","#f59e0b","#f87171","#22d3ee","#c084fc","#fbbf24","#4ade80","#fb7185"];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {rects.map((r,i)=>(
        <g key={i}>
          <rect x={r.x+1} y={r.y+1} width={Math.max(0,r.w-2)} height={Math.max(0,r.h-2)} fill={palette[i%palette.length]} opacity={0.82} rx={3}><title>{`${r.d.ticker}: ${_fmtMoneyAxis(r.d.total)} (매수 ${_fmtMoneyAxis(r.d.buy)} / 매도 ${_fmtMoneyAxis(r.d.sell)})`}</title></rect>
          {r.w>42&&r.h>22&&<text x={r.x+9} y={r.y+19} fontSize={12.5} fontWeight={800} fill="#0b0e14">{r.d.ticker}</text>}
          {r.w>64&&r.h>38&&<text x={r.x+9} y={r.y+34} fontSize={9.5} fill="#0b0e14">{_fmtMoneyAxis(r.d.total)}</text>}
        </g>
      ))}
    </svg>
  );
}

// 포트폴리오 회전율(Turnover) 월별 막대 — orders 월 거래대금 ÷ 월말 equity
function TurnoverBars({ orders, equityCurve, height=110 }) {
  const ords=(orders||[]).filter(o=>o&&o.date&&o.value!=null);
  const eq=(equityCurve||[]).filter(d=>d&&d.value!=null);
  if(ords.length<1||eq.length<2) return null;
  const ym=s=>String(s).slice(0,7);
  const vol={}; ords.forEach(o=>{ const k=ym(o.date); vol[k]=(vol[k]||0)+Math.abs(+o.value||0); });
  const eqEnd={}; eq.forEach(d=>{ eqEnd[ym(d.date)]=+d.value||0; });
  const data=Object.keys(vol).sort().map(m=>({ m, turn: eqEnd[m]? (vol[m]/eqEnd[m])*100 : 0 }));
  if(data.length<1) return null;
  const W=720,PADL=40,PADR=8,PADT=8,PADB=22;
  const mx=Math.max(1,...data.map(d=>d.turn)), plotW=W-PADL-PADR, plotH=height-PADT-PADB;
  const bw=Math.max(1,(plotW/data.length)*0.7), xAt=i=>PADL+((i+0.5)/data.length)*plotW, yAt=v=>PADT+(1-v/mx)*plotH;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{display:"block"}}>
      {[mx,mx/2,0].map((v,k)=>{const y=yAt(v);return <g key={k}><line x1={PADL} x2={W-PADR} y1={y} y2={y} stroke={DASH.border} strokeWidth={0.5}/><text x={PADL-5} y={y+3} textAnchor="end" fontSize={8} fill={DASH.muted}>{v.toFixed(0)}%</text></g>;})}
      {data.map((d,i)=><rect key={i} x={xAt(i)-bw/2} y={yAt(d.turn)} width={bw} height={Math.max(0.5,PADT+plotH-yAt(d.turn))} fill="#22d3ee" opacity={0.6}><title>{`${d.m}: 회전율 ${d.turn.toFixed(1)}%`}</title></rect>)}
    </svg>
  );
}

// 범용 표 (orders / trades) — onRowClick 시 행 클릭 가능
function DashTable({ columns, rows, empty="자료 없음", onRowClick }) {
  if(!rows || !rows.length) return <div style={{color:DASH.muted,fontSize:12,padding:"24px 0",textAlign:"center"}}>{empty}</div>;
  const th={padding:"7px 10px",fontSize:10,color:DASH.muted,fontWeight:700,textAlign:"right",whiteSpace:"nowrap",borderBottom:`1px solid ${DASH.border}`};
  const td={padding:"7px 10px",fontSize:11.5,textAlign:"right",whiteSpace:"nowrap",borderBottom:"1px solid rgba(255,255,255,0.04)",fontVariantNumeric:"tabular-nums"};
  return (
    <div style={{overflowX:"auto",maxHeight:440,overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:Math.max(560,columns.length*100)}}>
        <thead><tr>{columns.map((c,i)=><th key={i} style={{...th,textAlign:c.align||"right"}}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r,ri)=>(
          <tr key={ri} onClick={onRowClick?()=>onRowClick(r):undefined} style={onRowClick?{cursor:"pointer"}:undefined}
              onMouseEnter={onRowClick?e=>e.currentTarget.style.background="rgba(96,165,250,0.08)":undefined}
              onMouseLeave={onRowClick?e=>e.currentTarget.style.background="transparent":undefined}>
            {columns.map((c,ci)=>{ const cell=c.render?c.render(r):r[c.key]; return <td key={ci} style={{...td,textAlign:c.align||"right",color:c.color?c.color(r):DASH.text}}>{cell}</td>; })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function BacktestReportView({ btResult, code, strategyName }) {
  const [sub, setSub] = useState("overview");
  const [subInd, setSubInd] = useState({ rsi: false, macd: false, stoch: false });
  const [chartMode, setChartMode] = useState("equity"); // equity | return
  const [range, setRange] = useState("all");             // 1m | 3m | 6m | 1y | all
  const [activeChart, setActiveChart] = useState("equity"); // 차트 탭(equity/drawdown/benchmark/margin/exposure/turnover)
  if (!btResult?.stats) {
    return (
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"#4B5563"}}>
        <BarChart3 size={32} color="#2d3748"/>
        <div style={{fontSize:13,fontWeight:600}}>백테스트 결과 없음</div>
        <div style={{fontSize:11}}>상단의 <span style={{color:"#60a5fa",fontWeight:700}}>Run Backtest</span> 버튼을 눌러 실행하세요</div>
      </div>
    );
  }
  const s = btResult.stats;
  const rm = btResult.risk_metrics || {};
  const bhm = btResult.buy_and_hold_metrics || {};
  const IDE_THEME = { accent:"#60a5fa", text:"#e5e7eb", textMuted:"#94a3b8", panel:"#161b22", panelBorder:"rgba(255,255,255,0.12)", panelAlt:"rgba(96,165,250,0.12)" };

  // ── 시리즈 ──
  const eqPts = (btResult.equity_curve || []).map((d, i) => ({ x: d.date ? new Date(d.date) : i, y: Number(d.value) }));
  const eqVals = eqPts.map((p) => p.y);
  const eqDates = eqPts.map((p) => p.x);
  const benchPts = (btResult.benchmark_curve || []).map((d, i) => ({ x: d.date ? new Date(d.date) : i, y: Number(d.value) }));
  // 보강 필드(analytics) 부재 시 equity_curve 에서 파생 — Lean·구캐시 결과도 리치하게(그레이스풀)
  const derived = useMemo(() => {
    const ec = (btResult.equity_curve || []).filter(d => d && d.value != null);
    if (ec.length < 2) return {};
    const dd = [], rd = []; let peak = -Infinity;
    for (let i = 0; i < ec.length; i++) {
      const v = Number(ec[i].value); peak = Math.max(peak, v);
      dd.push({ date: ec[i].date, dd_pct: peak > 0 ? (v / peak - 1) * 100 : 0 });
      if (i > 0) { const pv = Number(ec[i - 1].value); rd.push({ date: ec[i].date, ret_pct: pv > 0 ? (v / pv - 1) * 100 : 0 }); }
    }
    const mmap = {};
    rd.forEach(r => { const ym = String(r.date || "").slice(0, 7); if (ym) (mmap[ym] = mmap[ym] || []).push(r.ret_pct); });
    const monthly = Object.entries(mmap).map(([ym, arr]) => { const [y, m] = ym.split("-"); return { year: +y, month: +m, ret_pct: (arr.reduce((a, x) => a * (1 + x / 100), 1) - 1) * 100 }; });
    return { dd, rd, monthly };
  }, [btResult.equity_curve]);
  const ddData = btResult.drawdown_curve || derived.dd;
  const rdData = btResult.returns_daily || derived.rd;
  const mrData = btResult.monthly_returns || derived.monthly;
  const mkS = (arr, name, color, width, extra) => ({ name, color, width, ...extra, points: eqPts.map((p, i) => ({ x: p.x, y: arr[i] })) });
  const bbIde = eqVals.length >= 20 ? calcBollinger(eqVals, 20, 2) : null;
  const ideSeries = eqPts.length > 1 ? [
    { name: "에쿼티", color: "#60a5fa", width: 2, points: eqPts },
    ...(benchPts.length > 1 ? [{ name: "벤치마크(B&H)", color: "#94a3b8", width: 1.4, dash: "5 3", opacity: 0.85, points: benchPts }] : []),
    ...(eqVals.length >= 20 ? [mkS(calcSMA(eqVals, 20), "SMA 20", "#10b981", 1.4)] : []),
    ...(eqVals.length >= 50 ? [mkS(calcSMA(eqVals, 50), "SMA 50", "#f59e0b", 1.4)] : []),
    ...(eqVals.length >= 120 ? [mkS(calcSMA(eqVals, 120), "SMA 120", "#ef4444", 1.4)] : []),
    ...(eqVals.length >= 20 ? [mkS(calcEMA(eqVals, 20), "EMA 20", "#8b5cf6", 1.4)] : []),
    ...(bbIde ? [mkS(bbIde.upper, "BB 상단", "#94a3b8", 1, { dash: "4 3", opacity: 0.8 }), mkS(bbIde.lower, "BB 하단", "#94a3b8", 1, { dash: "4 3", opacity: 0.8 })] : []),
  ] : [];

  // ── 다중 차트 탭 (Lean extra_charts 포함) ──
  const extraCharts = btResult.extra_charts || {};
  const mkExtraS = (arr, name, color) => (arr || []).length > 1
    ? [{ name, color, width: 2, points: (arr || []).map((d, i) => ({ x: d.date ? new Date(Number(d.date) < 1e10 ? d.date : Number(d.date) * 1000) : i, y: Number(d.value) })) }]
    : [];
  const benchmarkSeries  = mkExtraS(extraCharts.benchmark, "벤치마크",           "#94a3b8");
  const marginSeries     = mkExtraS(extraCharts.margin,    "포트폴리오 마진",      "#f59e0b");
  const exposureSeries   = mkExtraS(extraCharts.exposure,  "익스포저(롱비율)",     "#10b981");
  const turnoverSeries   = mkExtraS(extraCharts.turnover,  "포트폴리오 턴오버",    "#a78bfa");
  const ddSeries = (ddData || []).length > 1
    ? [{ name: "낙폭", color: "#ef4444", width: 2, points: (ddData || []).map((d, i) => ({ x: d.date ? new Date(d.date) : i, y: Number(d.dd_pct) })) }]
    : [];
  const CHART_TABS = [
    { id: "equity",   label: "전략 에쿼티",       series: ideSeries,       avail: ideSeries.length > 1 },
    { id: "drawdown", label: "낙폭",              series: ddSeries,        avail: ddSeries.length > 0 },
    { id: "benchmark",label: "벤치마크",           series: benchmarkSeries, avail: benchmarkSeries.length > 0 },
    { id: "margin",   label: "포트폴리오 마진",    series: marginSeries,    avail: marginSeries.length > 0 },
    { id: "exposure", label: "익스포저",           series: exposureSeries,  avail: exposureSeries.length > 0 },
    { id: "turnover", label: "턴오버",             series: turnoverSeries,  avail: turnoverSeries.length > 0 },
  ];
  const activeChartTab = CHART_TABS.find(t => t.id === activeChart && t.avail) || CHART_TABS.find(t => t.avail) || CHART_TABS[0];

  // ── KPI (보강 필드 없으면 equity_curve 에서 파생) ──
  const endEq = _fin(s.end_equity) ? s.end_equity : (eqVals.length ? eqVals[eqVals.length-1] : null);
  const startEq = _fin(s.start_equity) ? s.start_equity : (eqVals.length ? eqVals[0] : null);
  const netProfit = _fin(s.net_profit) ? s.net_profit : (_fin(endEq)&&_fin(startEq) ? endEq-startEq : null);
  const period = `${s.start || ""} – ${s.end || ""}`;
  const engineLabel = s.engine === "lean" ? `Lean · QC${s.run_id ? " · "+s.run_id : ""}` : "vectorbt";
  const trades = Array.isArray(btResult.trades) && btResult.trades.length ? btResult.trades : null;
  const recentTrades = !trades && Array.isArray(btResult.recent_trades) && btResult.recent_trades.length ? btResult.recent_trades : null;
  const orders = Array.isArray(btResult.orders) ? btResult.orders : null;

  const KPIS = [
    { label:"최종 자산", value: fmtMoneyK(endEq) },
    { label:"순손익", value: fmtMoneyK(netProfit), color: signColor(netProfit) },
    { label:"총 수익률", value: fmtPctS(s.total_return_pct), color: signColor(s.total_return_pct) },
    { label:"연환산(CAR)", value: fmtPctS(s.annualized_return_pct), color: signColor(s.annualized_return_pct) },
    { label:"샤프", value: fmtN(s.sharpe), color: DASH.blue },
    { label:"MDD", value: fmtPctS(s.max_drawdown_pct,false), color: DASH.amber },
    { label:"승률", value: fmtPctS(s.win_rate_pct,false), color: DASH.blue },
    { label:"거래수", value: _fin(s.trades)?`${s.trades}회`:"N/A", color: "#cbd5e1" },
  ];
  // QC 상단바 추가 KPI — 데이터 있을 때만 (단일종목 엔진엔 holdings/unrealized 신규 emit)
  if (_fin(s.holdings_value_end)) KPIS.push({ label:"보유평가액", value: fmtMoneyK(s.holdings_value_end) });
  if (_fin(s.unrealized_pnl))     KPIS.push({ label:"미실현손익", value: fmtMoneyK(s.unrealized_pnl), color: signColor(s.unrealized_pnl) });
  if (_fin(s.total_fees))         KPIS.push({ label:"수수료", value: fmtMoneyK(s.total_fees), color: DASH.red });
  if (_fin(s.psr_pct))            KPIS.push({ label:"PSR", value: fmtPctS(s.psr_pct,false), color: DASH.violet });
  if (_fin(s.volume))             KPIS.push({ label:"거래대금", value: fmtMoneyK(s.volume) });
  if (_fin(s.capacity_usd))       KPIS.push({ label:"Capacity≈", value: fmtMoneyK(s.capacity_usd), color: DASH.muted });

  // ── 차트 모드(자산/수익률) · 기간 프리셋(1M/3M/6M/1Y/전체) ──
  const lastDate = eqDates.length ? eqDates[eqDates.length-1] : null;
  const rangeCutoff = (() => {
    if (range==="all" || !(lastDate instanceof Date)) return null;
    const mo = {"1m":1,"3m":3,"6m":6,"1y":12}[range] || 0;
    const c = new Date(lastDate); c.setMonth(c.getMonth()-mo); return c;
  })();
  const inRange = (x) => !rangeCutoff || !(x instanceof Date) || x >= rangeCutoff;
  const afterCut = (arr) => !rangeCutoff ? arr : (arr||[]).filter(d => { const dt = d?.date ? new Date(d.date) : null; return !dt || dt >= rangeCutoff; });
  const toReturn = (pts) => { const base = (pts||[]).find(p=>_fin(p.y)); const b0 = base ? base.y : null; return (pts||[]).map(p => ({ x:p.x, y: (_fin(p.y)&&b0) ? (p.y/b0-1)*100 : null })); };
  const baseSeries = chartMode==="return"
    ? ideSeries.filter(s2 => s2.name==="에쿼티" || s2.name.startsWith("벤치마크")).map(s2 => ({...s2, points: toReturn(s2.points)}))
    : ideSeries;
  const visSeries = baseSeries.map(s2 => ({...s2, points: s2.points.filter(p => inRange(p.x))}));
  const ddVis = afterCut(ddData), rdVis = afterCut(rdData);
  const holdingsCurve = btResult.holdings_curve, cashCurve = btResult.cash_curve, exposureCurve = btResult.exposure_curve;
  const assetsVolume = Array.isArray(btResult.assets_volume) && btResult.assets_volume.length
    ? btResult.assets_volume
    : (orders ? Object.values(orders.reduce((acc,o)=>{ const t=o.ticker||"ASSET"; (acc[t]=acc[t]||{ticker:t,buy:0,sell:0,total:0}); const v=Math.abs(+o.value||0); acc[t].total+=v; if(o.side==="SELL") acc[t].sell+=v; else acc[t].buy+=v; return acc; },{})) : null);

  const TABS = [["overview","개요"],["report","리포트"],["orders","주문"],["trades","체결"],["logs","로그"],["code","코드"]];

  return (
    <div className="dark-scroll" style={{flex:1, minHeight:0, overflow:"auto", background:DASH.bg}}>
      {/* ═ 상단 KPI 메트릭 바 ═ */}
      <div style={{borderBottom:`1px solid ${DASH.border}`,background:"#12161d",padding:"4px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0 2px"}}>
          <BarChart3 size={15} color={DASH.blue}/>
          <span style={{fontSize:13,fontWeight:800,color:"white"}}>{strategyName || btResult.ticker || "백테스트"} 결과</span>
          <span style={{fontSize:10,color:"#4B5563"}}>{period} · {engineLabel}{btResult.strategy?` · ${btResult.strategy}`:""}</span>
          <span style={{fontSize:9,padding:"2px 8px",borderRadius:999,background:"rgba(16,185,129,0.15)",color:"#10B981",fontWeight:700}}>완료</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",alignItems:"flex-end"}}>
          {KPIS.map((k,i)=><KpiCell key={i} {...k}/>)}
        </div>
      </div>

      {/* ═ 서브탭 ═ */}
      <div style={{display:"flex",gap:2,padding:"0 16px",borderBottom:`1px solid ${DASH.border}`,background:"#12161d"}}>
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setSub(id)} style={{padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:12.5,fontWeight:sub===id?800:600,color:sub===id?"#fff":DASH.muted,borderBottom:`2px solid ${sub===id?DASH.blue:"transparent"}`,marginBottom:-1}}>{label}</button>
        ))}
      </div>

      <div style={{padding:"16px 20px 40px"}}>
        {/* ───── 개요 ───── */}
        {sub==="overview" && <>
          {CHART_TABS.some(t=>t.avail) && (
            <div style={{...dashCard, position:"relative"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8,flexWrap:"wrap"}}>
                {/* 차트 선택 탭바 */}
                <div style={{display:"flex",gap:0,overflow:"hidden",borderRadius:6,border:"1px solid rgba(255,255,255,0.1)"}}>
                  {CHART_TABS.filter(t=>t.avail).map(t=>(
                    <button key={t.id} onClick={()=>setActiveChart(t.id)}
                      style={{padding:"4px 11px",border:"none",borderRight:"1px solid rgba(255,255,255,0.07)",
                        cursor:"pointer",fontSize:10.5,fontWeight:activeChartTab.id===t.id?800:500,
                        background:activeChartTab.id===t.id?"rgba(96,165,250,0.18)":"transparent",
                        color:activeChartTab.id===t.id?"#60a5fa":"#64748b",whiteSpace:"nowrap"}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={()=>{
                    const w = window.open("","_blank","width=1280,height=720");
                    const canvas = document.querySelector(".ide-equity-chart canvas");
                    if(canvas){ const img = new Image(); img.src=canvas.toDataURL(); w.document.body.style.cssText="margin:0;background:#0f1117"; w.document.body.appendChild(img); }
                    else w.close();
                  }}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:5,
                    background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.25)",
                    color:"#60a5fa",fontSize:10.5,fontWeight:700,cursor:"pointer",flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(96,165,250,0.22)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(96,165,250,0.1)";}}>
                  <ExternalLink size={10}/> 전체보기
                </button>
              </div>
              <div className="ide-equity-chart">
                {activeChartTab.id==="equity" && (
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:6,padding:2}}>
                      {[["equity","자산"],["return","수익률"]].map(([k,l])=><button key={k} onClick={()=>setChartMode(k)} style={segBtn(chartMode===k)}>{l}</button>)}
                    </div>
                    <div style={{display:"flex",gap:2,background:"#0d1117",borderRadius:6,padding:2}}>
                      {["1m","3m","6m","1y","all"].map(r=><button key={r} onClick={()=>setRange(r)} style={segBtn(range===r)}>{r==="all"?"전체":r.toUpperCase()}</button>)}
                    </div>
                  </div>
                )}
                {activeChartTab.id==="equity"
                  ? <TrendLineChart key={`equity-${chartMode}-${range}`} series={visSeries} theme={IDE_THEME} height={250} toggleable initialHidden={["EMA 20","BB 상단","BB 하단","SMA 120"]}/>
                  : activeChartTab.series.length > 0
                    ? <TrendLineChart key={activeChartTab.id} series={activeChartTab.series} theme={IDE_THEME} height={250} toggleable initialHidden={["EMA 20","BB 상단","BB 하단","SMA 120"]}/>
                    : <div style={{textAlign:"center",color:"#4B5563",padding:24,fontSize:11}}>데이터 없음</div>}
              </div>
              {activeChartTab.id==="equity" && <>
                {rdData && rdData.length > 1 && <>
                  <div style={{fontSize:10.5,color:DASH.muted,fontWeight:700,margin:"12px 0 2px"}}>일별 수익률</div>
                  <ReturnsBars data={rdData}/>
                </>}
                <div style={{display:"flex",gap:7,alignItems:"center",margin:"12px 0 2px",flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:DASH.muted,fontWeight:700}}>보조지표</span>
                  {[["rsi","RSI"],["macd","MACD"],["stoch","Stochastic"]].map(([k,lbl])=>(
                    <button key={k} type="button" onClick={()=>setSubInd(v=>({...v,[k]:!v[k]}))} style={{padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700,cursor:"pointer",border:`1px solid ${subInd[k]?DASH.blue:"rgba(255,255,255,0.14)"}`,background:subInd[k]?DASH.blue:"transparent",color:subInd[k]?"#fff":DASH.muted}}>{lbl}</button>
                  ))}
                </div>
                {subInd.rsi && <SubIndicatorChart kind="rsi" values={eqVals} dates={eqDates} theme={IDE_THEME}/>}
                {subInd.macd && <SubIndicatorChart kind="macd" values={eqVals} dates={eqDates} theme={IDE_THEME}/>}
                {subInd.stoch && <SubIndicatorChart kind="stoch" values={eqVals} dates={eqDates} theme={IDE_THEME}/>}
              </>}
            </div>
          )}

          {/* QC Holdings/Cash + Exposure (per-bar 보유/현금/노출 — 엔진 신규 emit) */}
          {(holdingsCurve?.length > 1 || cashCurve?.length > 1) && (
            <div style={dashCard}>
              <div style={{...dashCardTitle, display:"flex", alignItems:"center", gap:12}}>
                <span>💰 보유평가액 · 현금 추이</span>
                <span style={{fontSize:9.5,color:"#60a5fa"}}>■ 보유</span><span style={{fontSize:9.5,color:"#94a3b8"}}>■ 현금</span>
              </div>
              <HoldingsCashArea holdings={holdingsCurve} cash={cashCurve}/>
            </div>
          )}
          {exposureCurve?.length > 1 && (
            <div style={dashCard}>
              <div style={dashCardTitle}>📊 투자비중(Exposure) · 롱온리 레버리지/마진 프록시</div>
              <ExposureLine data={exposureCurve}/>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {ddVis && ddVis.length > 1 && <div style={dashCard}><div style={dashCardTitle}>📉 낙폭(Drawdown)</div><DrawdownArea data={ddVis}/></div>}
            {rdVis && rdVis.length > 4 && <div style={dashCard}><div style={dashCardTitle}>📊 일별 수익률 분포</div><ReturnsHistogram data={rdVis}/></div>}
          </div>

          {orders && orders.length > 0 && <div style={dashCard}><div style={dashCardTitle}>🔄 포트폴리오 회전율(Turnover · 월별 거래대금÷월말자산)</div><TurnoverBars orders={orders} equityCurve={btResult.equity_curve}/></div>}

          {assetsVolume && assetsVolume.length > 0 && <div style={dashCard}><div style={dashCardTitle}>🟦 종목별 거래대금 (Assets Sales Volume)</div><AssetsVolumeTreemap items={assetsVolume}/></div>}

          {mrData && mrData.length > 0 && <div style={dashCard}><div style={dashCardTitle}>🗓 월별 수익률 (%)</div><MonthlyHeatmap months={mrData}/></div>}

          {/* 종합 스탯 그리드 */}
          <div style={dashCard}>
            <div style={dashCardTitle}>📋 종합 통계</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0 28px"}}>
              <div>
                <StatLine label="시작 자산" value={fmtMoney(startEq)}/>
                <StatLine label="최종 자산" value={fmtMoney(endEq)}/>
                <StatLine label="순손익" value={fmtMoney(netProfit)} color={signColor(netProfit)}/>
                <StatLine label="총 수익률" value={fmtPctS(s.total_return_pct)} color={signColor(s.total_return_pct)}/>
                <StatLine label="연환산(CAR)" value={fmtPctS(s.annualized_return_pct)} color={signColor(s.annualized_return_pct)}/>
                <StatLine label="벤치마크 수익률" value={fmtPctS(s.benchmark_return_pct ?? bhm.cagr_pct)} color={signColor(s.benchmark_return_pct)}/>
              </div>
              <div>
                <StatLine label="샤프 지수" value={fmtN(s.sharpe)} color={DASH.blue}/>
                <StatLine label="소르티노" value={fmtN(s.sortino)} color={DASH.blue}/>
                <StatLine label="칼마 지수" value={fmtN(s.calmar ?? rm.calmar)} color={DASH.blue}/>
                <StatLine label="변동성(연)" value={fmtPctS(s.volatility_pct ?? rm.volatility_pct,false)}/>
                <StatLine label="MDD" value={fmtPctS(s.max_drawdown_pct,false)} color={DASH.amber}/>
                <StatLine label="PSR (SR>0 확률)" value={fmtPctS(s.psr_pct,false)} color={DASH.violet}/>
              </div>
              <div>
                <StatLine label="총 거래수" value={_fin(s.trades)?`${s.trades}회`:"N/A"}/>
                <StatLine label="승률" value={fmtPctS(s.win_rate_pct,false)}/>
                <StatLine label="Profit Factor" value={fmtN(s.profit_factor)} color={DASH.violet}/>
                <StatLine label="평균 익절 / 손절" value={`${fmtPctS(s.avg_win_pct)} / ${fmtPctS(s.avg_loss_pct)}`}/>
                <StatLine label="최고 / 최악일" value={`${fmtPctS(s.best_day_pct ?? rm.best_day_pct)} / ${fmtPctS(s.worst_day_pct ?? rm.worst_day_pct)}`}/>
                <StatLine label="총 수수료 / 거래대금" value={`${fmtMoneyK(s.total_fees)} / ${fmtMoneyK(s.volume)}`}/>
                {_fin(s.holdings_value_end) && <StatLine label="보유평가액 / 현금" value={`${fmtMoneyK(s.holdings_value_end)} / ${fmtMoneyK(s.cash_end)}`}/>}
                {_fin(s.capacity_usd) && <StatLine label="Capacity (≈일ADV×1%)" value={fmtMoneyK(s.capacity_usd)} color={DASH.muted}/>}
              </div>
            </div>
          </div>
        </>}

        {/* ───── 리포트 (전략 vs Buy&Hold + 리스크) ───── */}
        {sub==="report" && (
          <div style={dashCard}>
            <div style={dashCardTitle}>📑 리스크·성과 리포트 (전략 vs 단순보유)</div>
            {Object.keys(rm).length===0 && Object.keys(bhm).length===0
              ? <div style={{color:DASH.muted,fontSize:12,padding:"16px 0"}}>리스크 지표가 없습니다(구버전 캐시일 수 있음). 백테스트를 다시 실행하세요.</div>
              : <DashTable
                  columns={[
                    {label:"지표",key:"k",align:"left",color:()=>DASH.muted},
                    {label:"전략",key:"strat",color:r=>r.sign?signColor(r._sv):DASH.text},
                    {label:"단순보유(B&H)",key:"bh",color:()=>"#cbd5e1"},
                  ]}
                  rows={[
                    {k:"연환산(CAR)",_sv:rm.cagr_pct,sign:1,strat:fmtPctS(rm.cagr_pct),bh:fmtPctS(bhm.cagr_pct)},
                    {k:"샤프",strat:fmtN(rm.sharpe),bh:fmtN(bhm.sharpe)},
                    {k:"소르티노",strat:fmtN(rm.sortino),bh:fmtN(bhm.sortino)},
                    {k:"칼마",strat:fmtN(rm.calmar),bh:fmtN(bhm.calmar)},
                    {k:"MDD",strat:fmtPctS(rm.max_drawdown_pct,false),bh:fmtPctS(bhm.max_drawdown_pct,false)},
                    {k:"변동성(연)",strat:fmtPctS(rm.volatility_pct,false),bh:fmtPctS(bhm.volatility_pct,false)},
                    {k:"승률",strat:fmtPctS(rm.win_rate_pct,false),bh:fmtPctS(bhm.win_rate_pct,false)},
                    {k:"최고일",strat:fmtPctS(rm.best_day_pct),bh:fmtPctS(bhm.best_day_pct)},
                    {k:"최악일",strat:fmtPctS(rm.worst_day_pct),bh:fmtPctS(bhm.worst_day_pct)},
                    {k:"VaR 95%",strat:fmtPctS(rm.var_95_pct,false),bh:fmtPctS(bhm.var_95_pct,false)},
                    {k:"CVaR 95%",strat:fmtPctS(rm.cvar_95_pct,false),bh:fmtPctS(bhm.cvar_95_pct,false)},
                    ...(rm.alpha!=null||rm.beta!=null?[
                      {k:"알파 (vs SPY)",strat:fmtN(rm.alpha),bh:"—"},
                      {k:"베타 (vs SPY)",strat:fmtN(rm.beta),bh:"—"},
                      {k:"정보비율(IR)",strat:fmtN(rm.information_ratio),bh:"—"},
                    ]:[]),
                  ]}/>}
            <div style={{fontSize:10.5,color:DASH.muted,marginTop:10,lineHeight:1.6}}>전략 수익률(수수료·슬리피지 반영)에 대한 QuantStats 리스크 지표. 벤치마크는 SPY 단순보유.</div>
          </div>
        )}

        {/* ───── 주문 ───── */}
        {sub==="orders" && (
          <div style={dashCard}>
            <div style={dashCardTitle}>🧾 주문 내역 {orders?`(${orders.length}건${btResult.orders_truncated?" · 1000건 초과 일부 생략":""})`:""}</div>
            <DashTable
              columns={[
                {label:"일시",key:"date",align:"left"},
                {label:"구분",key:"side",align:"center",color:r=>r.side==="BUY"?DASH.red:DASH.blue},
                {label:"종목",key:"ticker",align:"left"},
                {label:"수량",render:r=>fmtN(r.qty,4)},
                {label:"단가",render:r=>fmtMoney(r.price)},
                {label:"금액",render:r=>fmtMoney(r.value)},
                {label:"수수료",render:r=>fmtMoney(r.fee)},
              ]}
              rows={orders}
              empty={btResult.strategy==="infinite_buying"||btResult.strategy==="value_rebalancing"?"이 엔진은 주문 단위 기록을 제공하지 않습니다. '체결' 탭을 확인하세요.":"주문 내역이 없습니다."}/>
          </div>
        )}

        {/* ───── 체결(트레이드) ───── */}
        {sub==="trades" && (
          <div style={dashCard}>
            <div style={dashCardTitle}>💱 체결(라운드트립) {trades?`(${trades.length}건)`:recentTrades?`(최근 ${recentTrades.length}건)`:""}</div>
            {trades ? (
              <DashTable
                columns={[
                  {label:"진입일",key:"entry_date",align:"left"},
                  {label:"청산일",key:"exit_date",align:"left"},
                  {label:"수량",render:r=>fmtN(r.qty,4)},
                  {label:"진입가",render:r=>fmtMoney(r.entry_price)},
                  {label:"청산가",render:r=>fmtMoney(r.exit_price)},
                  {label:"손익",render:r=>fmtMoney(r.pnl),color:r=>signColor(r.pnl)},
                  {label:"수익률",render:r=>fmtPctS(r.return_pct),color:r=>signColor(r.return_pct)},
                  {label:"상태",key:"status",align:"center",color:()=>DASH.muted},
                ]}
                rows={trades}/>
            ) : recentTrades ? (
              <DashTable
                columns={Object.keys(recentTrades[0]).map((k)=>({label:k,key:k,align:typeof recentTrades[0][k]==="number"?"right":"left",render:r=>typeof r[k]==="number"?fmtN(r[k],4):String(r[k])}))}
                rows={recentTrades}/>
            ) : <div style={{color:DASH.muted,fontSize:12,padding:"24px 0",textAlign:"center"}}>체결 내역이 없습니다.</div>}
          </div>
        )}

        {/* ───── 로그 ───── */}
        {sub==="logs" && (
          <div style={{...dashCard, fontFamily:"'JetBrains Mono',monospace"}}>
            <div style={{...dashCardTitle,fontFamily:"'Inter',sans-serif"}}>📜 실행 로그</div>
            <pre style={{margin:0,fontSize:11.5,lineHeight:1.8,color:"#cbd5e1",whiteSpace:"pre-wrap"}}>{[
              `[엔진]   ${engineLabel}`,
              `[종목]   ${btResult.ticker || (btResult.tickers||[]).join(", ") || "—"}   [전략] ${btResult.strategy || "—"}`,
              `[기간]   ${period}`,
              `[자본]   ${fmtMoney(startEq)} → ${fmtMoney(endEq)}  (${fmtPctS(s.net_profit_pct ?? s.total_return_pct)})`,
              `[성과]   총수익 ${fmtPctS(s.total_return_pct)} · CAR ${fmtPctS(s.annualized_return_pct)} · Sharpe ${fmtN(s.sharpe)} · MDD ${fmtPctS(s.max_drawdown_pct,false)}`,
              `[거래]   주문 ${orders?orders.length:"—"}건 · 체결 ${trades?trades.length:(recentTrades?recentTrades.length:"—")}건 · 승률 ${fmtPctS(s.win_rate_pct,false)}`,
              `[비용]   수수료 ${fmtMoney(s.total_fees)} · 거래대금 ${fmtMoney(s.volume)}`,
              btResult.orders_truncated ? `⚠ 주문 1000건 초과 — 표시 일부 생략(통계는 전체 반영)` : ``,
              `✓ 백테스트 완료`,
            ].filter(Boolean).join("\n")}</pre>
          </div>
        )}

        {/* ───── 코드 ───── */}
        {sub==="code" && (
          <div style={{...dashCard, padding:0, overflow:"hidden"}}>
            <div style={{...dashCardTitle, padding:"12px 16px 0"}}>🐍 실행 전략 코드 {code?"(main.py · 읽기전용)":""}</div>
            {code ? (
              <pre style={{margin:0,padding:"10px 16px 16px",fontSize:11.5,lineHeight:1.65,color:"#cbd5e1",fontFamily:"'JetBrains Mono',monospace",overflow:"auto",maxHeight:520,whiteSpace:"pre"}}>{code}</pre>
            ) : <div style={{color:DASH.muted,fontSize:12,padding:"24px 16px"}}>코드를 불러올 수 없습니다.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 코드 해설 주피터 노트북 — main.py 를 모듈/블록별 셀로 분해 + 설명 ──
const NB_PARAM_DESC = {
  TICKER:"대상 종목 티커", TICKERS:"대상 종목 목록", BENCHMARK:"성과 비교 기준(벤치마크)",
  SMA_FAST:"단기 이동평균 기간(거래일)", SMA_SLOW:"장기 이동평균 기간(거래일)",
  RSI_PERIOD:"RSI 계산 기간", RSI_LOW:"과매도 진입 기준", RSI_HIGH:"과매수 청산 기준",
  MACD_FAST:"MACD 단기 EMA", MACD_SLOW:"MACD 장기 EMA", MACD_SIGNAL:"시그널선 EMA 기간",
  VIX_THRESHOLD:"VIX 위험회피 임계값",
  SPLIT:"분할 매수 횟수(시드 N등분)", TAKE_PROFIT_PCT:"평단 대비 익절 목표(%)", LOC_OFFSET_PCT:"종가 대비 추가매수 지정가 오프셋(%)",
  REBALANCE_DAYS:"리밸런싱 주기(거래일)", EXPECTED_RETURN:"주기당 목표 수익률", BAND_PCT:"허용 밴드 폭(±)",
  POOL_TARGET_PCT:"목표 풀(주식) 비중", INITIAL_POOL_PCT:"초기 풀 비중", INITIAL_CAPITAL:"초기 자본금",
};

function buildNotebookCells(code) {
  if (!code) return [];
  const kind = /SPLIT\s*=/.test(code) ? "ib" : /REBALANCE_DAYS\s*=/.test(code) ? "vr"
    : /RSI_PERIOD\s*=/.test(code) ? "rsi" : /MACD_/.test(code) ? "macd"
    : /VIX_THRESHOLD\s*=/.test(code) ? "vix" : "sma";
  // 빈 줄 기준 블록 분할
  const blocks = []; let cur = [];
  for (const ln of code.split("\n")) {
    if (ln.trim() === "") { if (cur.length) { blocks.push(cur.join("\n")); cur = []; } }
    else cur.push(ln);
  }
  if (cur.length) blocks.push(cur.join("\n"));

  return blocks.map((t) => {
    if (/def\s+Initialize/.test(t) || /class\s+\w+\s*\(/.test(t))
      return { title:"초기화 (Initialize)", icon:"🚀", code:t, md:"알고리즘 시작 시 한 번 호출됩니다. 백테스트 기간·초기자본·대상 종목을 등록하고, 사용할 기술적 지표를 생성한 뒤 지표가 충분한 데이터로 준비되도록 `SetWarmUp` 을 설정합니다." };
    if (/def\s+OnData/.test(t)) {
      const md = kind==="rsi" ? "매 거래일 새 데이터마다 호출되는 매매 로직입니다. RSI 가 과매도(`RSI_LOW`) 아래로 내려가면 매수, 과매수(`RSI_HIGH`) 위로 올라가면 청산합니다 — 평균회귀 전략."
        : kind==="macd" ? "매 거래일 호출됩니다. MACD 선이 시그널선을 **상향 돌파**하면 매수, **하향 돌파**하면 청산하는 추세추종 로직입니다."
        : kind==="vix" ? "매 거래일 호출됩니다. VIX 가 임계값 이하(안정장)면 매수 포지션을 유지하고, 초과(위험장)면 전량 청산해 손실을 회피합니다."
        : "매 거래일 새 데이터마다 호출되는 핵심 매매 로직입니다. 단기 이동평균이 장기 이동평균 위로 올라가면(**골든크로스**) 매수, 아래로 내려가면(**데드크로스**) 청산합니다.";
      return { title:"매매 로직 (OnData)", icon:"📈", code:t, md };
    }
    if (/def\s+OnEndOfAlgorithm/.test(t))
      return { title:"종료 처리 (OnEndOfAlgorithm)", icon:"🏁", code:t, md:"백테스트가 끝날 때 호출됩니다. 최종 포트폴리오 가치를 로그로 남겨 결과를 확인합니다." };
    if (/def\s+run/.test(t)) {
      const md = kind==="ib" ? "무한매수법의 핵심 실행 로직입니다. 매 거래일 시드를 `SPLIT` 등분한 금액으로 분할 매수하고, 평단가 대비 `TAKE_PROFIT_PCT` 도달 시 전량 익절한 뒤 사이클을 반복합니다. (실제 시뮬레이션은 AlphaHelix analytics 의 vectorbt 기반 엔진이 수행)"
        : "밸류 리밸런싱의 핵심 실행 로직입니다. `REBALANCE_DAYS` 마다 목표가치를 갱신하고, 평가액이 밴드(±`BAND_PCT`)를 벗어나면 풀(주식) 비중을 `POOL_TARGET_PCT` 로 복원합니다 — 하락 시 저가매수, 상승 시 차익실현.";
      return { title:"백테스트 실행 로직 (run)", icon:"⚡", code:t, md };
    }
    if (t.trim().split("\n").every(l => /^\s*(from|import)\s/.test(l)))
      return { title:"라이브러리 임포트", icon:"📦", code:t, md:"전략 작성에 필요한 라이브러리를 불러옵니다. QuantConnect LEAN 환경의 `AlgorithmImports` 는 `QCAlgorithm`·기술적 지표·주문 API 등 모든 클래스를 제공합니다." };
    if (/^\s*[A-Z_]{2,}\s*=/m.test(t)) {
      const consts = [];
      t.split("\n").forEach(l => { const m = l.match(/^\s*([A-Z_]{2,})\s*=\s*(.+?)\s*$/); if (m) consts.push([m[1], m[2].replace(/\s*#.*$/, "").trim()]); });
      const stratName = (t.match(/전략 유형:\s*(.+)/) || [])[1];
      const md = [
        stratName ? `**전략 유형: ${stratName.trim()}**` : "전략의 핵심 파라미터를 정의합니다.",
        "아래 값들이 바로 **최적화(Optimization) 위저드에서 스윕**되는 대상입니다 — 범위를 바꿔 견고성을 검증할 수 있습니다.",
        ...consts.filter(([k]) => NB_PARAM_DESC[k]).map(([k, v]) => `- \`${k} = ${v}\` — ${NB_PARAM_DESC[k]}`),
      ].join("\n");
      return { title:"파라미터 · 설정", icon:"⚙️", code:t, md };
    }
    if (t.trim().split("\n").every(l => l.trim() === "" || l.trim().startsWith("#")))
      return { title:"설명 주석", icon:"📝", code:t, md:"전략의 동작 원리를 설명하는 주석입니다." };
    return { title:"코드 블록", icon:"🔹", code:t, md:"" };
  });
}

// 라이트 마크다운(굵게 / 인라인코드 / 불릿) 렌더
function NbMarkdown({ text }) {
  const renderInline = (s) => {
    const out = []; const re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let last = 0, m, key = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) out.push(<b key={key++} style={{ color:"#e2e8f0" }}>{tok.slice(2, -2)}</b>);
      else out.push(<code key={key++} style={{ background:"rgba(255,255,255,0.08)", padding:"1px 5px", borderRadius:4, fontSize:11, color:"#a5b4fc", fontFamily:"monospace" }}>{tok.slice(1, -1)}</code>);
      last = m.index + tok.length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  return (
    <div style={{ fontSize:12, color:"#cbd5e1", lineHeight:1.7 }}>
      {String(text).split("\n").map((l, i) =>
        l.trim().startsWith("- ")
          ? <div key={i} style={{ display:"flex", gap:6, marginTop:2 }}><span style={{ color:DASH.violet }}>•</span><span>{renderInline(l.trim().slice(2))}</span></div>
          : <div key={i} style={{ marginTop: i ? 3 : 0 }}>{renderInline(l)}</div>
      )}
    </div>
  );
}

function NotebookView({ code, strategyName }) {
  const cells = React.useMemo(() => buildNotebookCells(code), [code]);
  if (!code) return <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#4B5563", fontSize:13 }}>코드가 없습니다. 워크스페이스를 선택하세요.</div>;
  return (
    <div className="dark-scroll" style={{ flex:1, overflow:"auto", background:DASH.bg, padding:"20px 24px 50px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <BookOpen size={16} color={DASH.violet}/>
        <span style={{ fontSize:15, fontWeight:800, color:"white" }}>{strategyName || "전략"} · 코드 해설 노트북</span>
      </div>
      <div style={{ fontSize:11.5, color:DASH.muted, marginBottom:18, lineHeight:1.6 }}>전략 코드를 모듈(셀) 단위로 나눠 한 블록씩 설명합니다. Jupyter 노트북처럼 위에서 아래로 읽으며 전략 동작을 이해하세요.</div>
      {cells.map((c, i) => (
        <div key={i} style={{ marginBottom:16, border:`1px solid ${DASH.border}`, borderRadius:10, overflow:"hidden", background:DASH.panel }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderBottom:`1px solid ${DASH.border}`, background:"#12161d" }}>
            <span style={{ fontSize:13 }}>{c.icon}</span>
            <span style={{ fontSize:12.5, fontWeight:800, color:"#e2e8f0" }}>{c.title}</span>
            <span style={{ marginLeft:"auto", fontSize:9.5, color:"#475569", fontFamily:"monospace" }}>셀 {i + 1}</span>
          </div>
          <div style={{ display:"flex", gap:10, padding:"10px 14px" }}>
            <span style={{ fontSize:9.5, color:"#475569", fontFamily:"monospace", flexShrink:0, paddingTop:2 }}>In[{i + 1}]</span>
            <pre style={{ margin:0, flex:1, fontSize:11.5, lineHeight:1.6, color:"#cbd5e1", fontFamily:"'JetBrains Mono',monospace", overflow:"auto", whiteSpace:"pre" }}>{c.code}</pre>
          </div>
          {c.md && (
            <div style={{ padding:"10px 14px 12px 38px", borderTop:"1px solid rgba(255,255,255,0.04)", background:"rgba(167,139,250,0.05)" }}>
              <NbMarkdown text={c.md}/>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 오픈소스 데이터셋 카탈로그 브라우저 (QuantConnect Datasets 스타일) ──
function DatasetsBrowser() {
  const [catalog, setCatalog] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(null);          // 선택된 데이터셋
  const [symbol, setSymbol] = React.useState("");
  const [preview, setPreview] = React.useState(null);  // {columns, rows}
  const [pvLoading, setPvLoading] = React.useState(false);
  const [pvErr, setPvErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    getDatasetsCatalog().then(r => alive && setCatalog(r)).catch(() => alive && setErr("카탈로그 로드 실패 — Analytics 사이드카 확인"));
    return () => { alive = false; };
  }, []);

  const loadPreview = React.useCallback((ds, sym) => {
    setSel(ds); setPreview(null); setPvErr(null);
    if (!ds.live) { setPvErr(`'${ds.source}' 커넥터 준비중 — 라이브 소스(노란 배지)에서 미리보기 가능합니다.`); return; }
    setPvLoading(true);
    const useSym = (sym ?? symbol) || (ds.sample_symbols || [])[0] || "";
    setSymbol(useSym);
    getDatasetPreview(ds.id, useSym, 30)
      .then(r => setPreview(r))
      .catch(e => setPvErr("미리보기 실패: " + (e?.response?.data?.error || e?.message || "")))
      .finally(() => setPvLoading(false));
  }, [symbol]);

  const datasets = (catalog?.datasets || []).filter(d => {
    if (!q) return true;
    const s = (d.name + " " + d.source + " " + d.asset_class + " " + (d.sample_symbols || []).join(" ")).toLowerCase();
    return s.includes(q.toLowerCase());
  });
  const liveCount = (catalog?.datasets || []).filter(d => d.live).length;

  const badge = (txt, color, bg) => <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, color, background: bg }}>{txt}</span>;

  return (
    <div className="dark-scroll" style={{ flex: 1, overflow: "auto", background: DASH.bg, padding: "20px 24px 50px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Database size={16} color={DASH.green} />
        <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>데이터셋 카탈로그</span>
        {catalog && <span style={{ fontSize: 11, color: DASH.muted }}>· {catalog.datasets.length}개 소스 · 라이브 {liveCount}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: DASH.muted, marginBottom: 14, lineHeight: 1.6 }}>오픈소스 시장 데이터를 한 곳에서 탐색합니다. <b style={{ color: "#fde68a" }}>라이브</b> 소스는 클릭 시 실데이터 미리보기(캐시), <b style={{ color: "#64748b" }}>준비중</b>은 로드맵입니다.</div>

      {err && <div style={{ color: DASH.red, fontSize: 12, padding: 16 }}>{err}</div>}
      {!catalog && !err && <div style={{ color: DASH.muted, fontSize: 12, padding: 16 }}>카탈로그 불러오는 중…</div>}

      {catalog && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* 카탈로그 그리드 */}
          <div style={{ flex: "1 1 420px", minWidth: 320 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: DASH.panel, border: `1px solid ${DASH.border}`, borderRadius: 8, padding: "6px 10px", marginBottom: 12 }}>
              <Database size={13} color={DASH.muted} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="소스·자산군·심볼 검색 (예: 크립토, AAPL, FRED)" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: DASH.text, fontSize: 12 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10 }}>
              {datasets.map(d => (
                <div key={d.id} onClick={() => loadPreview(d, (d.sample_symbols || [])[0])}
                  style={{ border: `1px solid ${sel?.id === d.id ? DASH.blue : DASH.border}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", background: sel?.id === d.id ? "rgba(96,165,250,0.07)" : DASH.panel, transition: "border .15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0", flex: 1, lineHeight: 1.2 }}>{d.name}</span>
                    {d.live ? badge("라이브", "#1c1917", "#fde68a") : badge("준비중", "#94a3b8", "rgba(148,163,184,0.15)")}
                  </div>
                  <div style={{ fontSize: 10, color: DASH.muted, marginBottom: 6 }}>{d.source}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {badge(d.asset_class, "#a5b4fc", "rgba(99,102,241,0.12)")}
                    {badge(d.market, "#7dd3fc", "rgba(14,165,233,0.12)")}
                    {badge(d.interval, "#cbd5e1", "rgba(255,255,255,0.06)")}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5 }}>{d.description}</div>
                  <div style={{ fontSize: 9.5, color: "#475569", marginTop: 6 }}>📅 {d.coverage} · ⚖ {d.license}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 미리보기 패널 */}
          <div style={{ flex: "1 1 360px", minWidth: 300, position: "sticky", top: 0 }}>
            <div style={{ ...dashCard, marginBottom: 0 }}>
              {!sel ? <div style={{ color: DASH.muted, fontSize: 12, padding: "30px 0", textAlign: "center" }}>← 데이터셋을 선택하면 실데이터 미리보기가 표시됩니다.</div> : <>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0", marginBottom: 2 }}>{sel.name}</div>
                <div style={{ fontSize: 10.5, color: DASH.muted, marginBottom: 10 }}>{sel.source} · {sel.asset_class}</div>
                {sel.live && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    <input value={symbol} onChange={e => setSymbol(e.target.value)} onKeyDown={e => e.key === "Enter" && loadPreview(sel, symbol)}
                      placeholder="심볼" style={{ flex: 1, minWidth: 120, background: "#0d1117", border: `1px solid ${DASH.border}`, borderRadius: 7, color: DASH.text, fontSize: 12, padding: "6px 9px" }} />
                    <button onClick={() => loadPreview(sel, symbol)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: DASH.blue, color: "#06121f", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>미리보기</button>
                  </div>
                )}
                {(sel.sample_symbols || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {sel.sample_symbols.map(s => <button key={s} onClick={() => loadPreview(sel, s)} disabled={!sel.live}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, border: `1px solid ${DASH.border}`, background: symbol === s ? "rgba(96,165,250,0.15)" : "transparent", color: sel.live ? "#cbd5e1" : "#475569", cursor: sel.live ? "pointer" : "not-allowed" }}>{s}</button>)}
                  </div>
                )}
                {pvLoading && <div style={{ color: DASH.muted, fontSize: 12, padding: 16 }}>실데이터 불러오는 중…</div>}
                {pvErr && <div style={{ color: "#fbbf24", fontSize: 11.5, padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8, lineHeight: 1.5 }}>{pvErr}</div>}
                {preview && preview.rows && (
                  <div style={{ overflowX: "auto", border: `1px solid ${DASH.border}`, borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr>{preview.columns.map(c => <th key={c} style={{ padding: "6px 8px", textAlign: "right", color: DASH.muted, fontWeight: 700, borderBottom: `1px solid ${DASH.border}`, whiteSpace: "nowrap" }}>{c}</th>)}</tr></thead>
                      <tbody>{preview.rows.map((r, i) => <tr key={i}>{preview.columns.map(c => <td key={c} style={{ padding: "5px 8px", textAlign: "right", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.04)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{typeof r[c] === "number" ? r[c].toLocaleString() : String(r[c] ?? "")}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {preview && <div style={{ fontSize: 9.5, color: "#475569", marginTop: 6 }}>최근 {preview.rows?.length || 0}행 · 실데이터(캐시 60분 TTL)</div>}
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 백테스트/Lean 실행 진행 팝업 (QC식 Requesting→Launching→Waiting) ──
function RunProgressOverlay({ engine }) {
  const [sec, setSec] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => setSec(s => Math.round((s + 0.1) * 10) / 10), 100); return () => clearInterval(t); }, []);
  const steps = ["요청 전송 (Requesting)", "엔진 실행 (Launching)", "결과 대기 (Waiting for Results)"];
  const active = sec < 0.8 ? 0 : (engine === "lean" ? (sec < 4 ? 1 : 2) : (sec < 1.6 ? 1 : 2));
  return (
    <div style={{ position: "fixed", top: "44%", left: "56%", transform: "translate(-50%,-50%)", zIndex: 9999, width: 348, background: DASH.panel, border: `1px solid ${DASH.border}`, borderRadius: 14, padding: "18px 22px", boxShadow: "0 16px 48px rgba(0,0,0,0.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: DASH.muted, marginBottom: 14, lineHeight: 1.5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fbbf24", flexShrink: 0 }} />
        {engine === "lean" ? "Lean · QuantConnect 엔진" : "vectorbt 엔진"} · AlphaHelix 클라우드 노드에서 실행 중
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", opacity: i <= active ? 1 : 0.4 }}>
          {i < active ? <CheckCircle2 size={16} color="#4ade80" /> : i === active ? <Loader size={16} color="#60a5fa" style={{ animation: "spin 1s linear infinite" }} /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #475569" }} />}
          <span style={{ fontSize: 12.5, color: i <= active ? "#e2e8f0" : "#64748B", fontWeight: i === active ? 700 : 500 }}>{s}</span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${DASH.border}`, fontSize: 11, color: DASH.muted }}>
        <Loader size={11} style={{ animation: "spin 1s linear infinite" }} /> {sec.toFixed(1)}s 경과
      </div>
    </div>
  );
}

// ── 에디터 설정 읽기 (localStorage ah.editor.*) ──────────────────────────────
function readEditorOpts(tabSizeDefault = 4) {
  const ls = (key, def) => { try { const v = localStorage.getItem(key); return v === null ? def : v; } catch { return def; } };
  const bool = (key, def) => ls(key, String(def)) === "true";
  const num  = (key, def) => { const n = Number(ls(key, def)); return Number.isFinite(n) && n > 0 ? n : def; };
  return {
    fontSize:   num("ah.editor.fontSize", 13),
    fontFamily: ls("ah.editor.fontFamily", "'Fira Code','Cascadia Code','Consolas',monospace"),
    tabSize:    num("ah.editor.tabSize", tabSizeDefault),
    insertSpaces: bool("ah.editor.insertSpaces", true),
    wordWrap:   bool("ah.editor.wordWrap", false) ? "on" : "off",
    minimap:    { enabled: bool("ah.editor.minimap", true), scale: 1 },
    lineNumbers: bool("ah.editor.lineNumbers", true) ? "on" : "off",
    fontLigatures: true,
    scrollBeyondLastLine: false,
    renderLineHighlight: "gutter",
    bracketPairColorization: { enabled: true },
    smoothScrolling: true,
    cursorBlinking: "phase",
    formatOnPaste: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: false },
  };
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
// ── ClaudeDiffView (Claude 에이전트 변경 before/after · Monaco diff) ──────────────
// ── Claude Code 식 인라인 diff: before/after → 빨강/초록 라인(+N −M) ──
// LCS 기반(공통 prefix/suffix 트림으로 큰 파일도 가볍게). 카드용 컴팩트 출력.
function diffLines(before, after) {
  const a = String(before == null ? "" : before).split("\n");
  const b = String(after == null ? "" : after).split("\n");
  if (!before) return { rows: b.map(s => ({ t: "add", s })), added: b.length, removed: 0 };
  // 공통 prefix / suffix 트림 → LCS 대상 축소
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
  let ai = a.length - 1, bi = b.length - 1;
  while (ai >= lo && bi >= lo && a[ai] === b[bi]) { ai--; bi--; }
  const midA = a.slice(lo, ai + 1), midB = b.slice(lo, bi + 1);
  const rows = [];
  let added = 0, removed = 0;
  for (let k = Math.max(0, lo - 2); k < lo; k++) rows.push({ t: "ctx", s: a[k] });
  const n = midA.length, m = midB.length;
  if (n * m > 400000) {            // 너무 크면 블록 치환(LCS 생략)
    for (let k = 0; k < n; k++) { rows.push({ t: "del", s: midA[k] }); removed++; }
    for (let k = 0; k < m; k++) { rows.push({ t: "add", s: midB[k] }); added++; }
  } else if (n || m) {
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { rows.push({ t: "ctx", s: midA[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ t: "del", s: midA[i] }); i++; removed++; }
      else { rows.push({ t: "add", s: midB[j] }); j++; added++; }
    }
    while (i < n) { rows.push({ t: "del", s: midA[i] }); i++; removed++; }
    while (j < m) { rows.push({ t: "add", s: midB[j] }); j++; added++; }
  }
  for (let k = ai + 1; k < Math.min(a.length, ai + 3); k++) rows.push({ t: "ctx", s: a[k] });
  return { rows, added, removed };
}

// 긴 ctx 구간을 "⋯ N줄" 로 접고 전체 행 수 상한 적용.
function collapseDiffRows(rows, cap) {
  const folded = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].t === "ctx") {
      let j = i; while (j < rows.length && rows[j].t === "ctx") j++;
      const run = rows.slice(i, j);
      if (run.length > 5) { folded.push(run[0], run[1], { t: "gap", count: run.length - 4 }, run[run.length - 2], run[run.length - 1]); }
      else folded.push(...run);
      i = j;
    } else { folded.push(rows[i]); i++; }
  }
  return folded.length <= cap ? { rows: folded, hidden: 0 } : { rows: folded.slice(0, cap), hidden: folded.length - cap };
}

// 채팅 안 파일 변경 카드 — Claude Code CLI 의 Edit + 빨강/초록 diff 모양.
function InlineDiffCard({ change }) {
  const [open, setOpen] = useState(true);
  const { rows, added, removed } = useMemo(() => diffLines(change.before, change.after), [change.before, change.after]);
  const { rows: shown, hidden } = useMemo(() => collapseDiffRows(rows, 120), [rows]);
  const isNew = !change.before;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, overflow: "hidden", background: "#0d1017", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", background: "#161b22", cursor: "pointer", borderBottom: open ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
        {isNew ? <FilePlus size={12} color="#3fb950" /> : <FileCode size={12} color="#d97757" />}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.filename || change.path}</span>
        {added > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#3fb950" }}>+{added}</span>}
        {removed > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#f85149" }}>−{removed}</span>}
        {open ? <ChevronDown size={13} color="#6B7280" /> : <ChevronRight size={13} color="#6B7280" />}
      </div>
      {open && (
        <div style={{ overflowX: "auto", padding: "4px 0", maxHeight: 320, overflowY: "auto" }}>
          {shown.map((r, i) => {
            if (r.t === "gap") return (
              <div key={i} style={{ padding: "2px 10px", fontSize: 10.5, color: "#4b5563", background: "rgba(255,255,255,0.02)" }}>⋯ {r.count}줄 변경 없음</div>
            );
            const bg = r.t === "add" ? "rgba(63,185,80,0.13)" : r.t === "del" ? "rgba(248,81,73,0.13)" : "transparent";
            const fg = r.t === "add" ? "#aff5b4" : r.t === "del" ? "#ffb4b0" : "#7c8aa0";
            const sign = r.t === "add" ? "+" : r.t === "del" ? "−" : " ";
            return (
              <div key={i} style={{ display: "flex", background: bg, fontSize: 11.5, lineHeight: 1.55, minWidth: "max-content" }}>
                <span style={{ width: 16, flexShrink: 0, textAlign: "center", color: fg, opacity: 0.8, userSelect: "none" }}>{sign}</span>
                <span style={{ color: fg, whiteSpace: "pre", paddingRight: 12 }}>{r.s || " "}</span>
              </div>
            );
          })}
          {hidden > 0 && (
            <div style={{ padding: "4px 10px", fontSize: 10.5, color: "#6B7280" }}>… +{hidden}줄 — 전체는 <b style={{ color: "#d97757" }}>🔀 Claude diff</b> 탭에서</div>
          )}
        </div>
      )}
    </div>
  );
}

// 스트리밍 진행 한 줄 → Claude Code 식 활동 표시(도구 호출/말풍선/단계).
function ActivityLine({ content, type }) {
  const s = (content || "").trim();
  if (type === "error") return (
    <div style={{ fontSize: 11.5, color: "#fca5a5", lineHeight: 1.5, paddingLeft: 2 }}>⚠️ {s.replace(/^(error[:：]?\s*)/i, "")}</div>
  );
  if (s.startsWith("💬")) return (
    <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.replace(/^💬\s*/, "")}</div>
  );
  if (s.startsWith("💭")) return (
    <div style={{ fontSize: 11.5, color: "#6B7280", fontStyle: "italic", lineHeight: 1.5 }}>{s}</div>
  );
  if (s.startsWith("▸") || s.startsWith("🤖")) return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#d97757", lineHeight: 1.5, paddingTop: 2 }}>{s}</div>
  );
  if (s.startsWith("✓")) return (
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#34d399", lineHeight: 1.5 }}>{s}</div>
  );
  // 도구 호출(✏️/📝/📖/🔍/🔧 …) → 좌측 액센트 칩
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 9px", borderRadius: 7,
      background: "rgba(217,119,87,0.09)", borderLeft: "2px solid rgba(217,119,87,0.6)",
      fontSize: 11.5, color: "#c7d0dd", fontFamily: "ui-monospace,monospace", lineHeight: 1.45 }}>{s}</div>
  );
}

// 경량 인라인 마크다운 렌더러 — **굵게** · `코드` · *기울임* 을 JSX 로 (Claude 응답이 raw 로 ** 노출되던 것 해결).
function renderMd(text) {
  if (text == null) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} style={{ fontWeight: 700, color: "#fff" }}>{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} style={{ background: "rgba(255,255,255,0.09)", padding: "1px 5px", borderRadius: 4, fontFamily: "ui-monospace,monospace", fontSize: "0.92em" }}>{p.slice(1, -1)}</code>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

// Claude 'spark' 마크 — 가는 광선이 방사하는 Claude Code 로고(이모지 ✳ 대체).
// 4개 주광선(상하좌우) 길게 + 그 사이 보조광선 짧게 → Claude 특유의 스파클.
function ClaudeSpark({ size = 22, color = "#D97757" }) {
  const c = size / 2;
  const sw = Math.max(1, size * 0.052);
  const N = 16;
  const inner = c * 0.12;
  const rays = [];
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 / N) * i - Math.PI / 2;
    const long = i % 4 === 0;
    const r1 = c * (long ? 0.97 : 0.55);
    rays.push(
      <line key={i}
        x1={c + Math.cos(a) * inner} y1={c + Math.sin(a) * inner}
        x2={c + Math.cos(a) * r1} y2={c + Math.sin(a) * r1}
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {rays}
    </svg>
  );
}

// Claude Code CLI 시작화면의 픽셀 마스코트(주황) — 빈 화면 하단에 표시.
function ClaudePixelMascot({ size = 52 }) {
  // 사용자가 제공한 공식 Claude Code 봇 이미지(claude_bot.png).
  return <img src={claudeBot} alt="Claude" style={{ width: size, height: "auto", display: "block", flexShrink: 0 }} />;
}

function ClaudeDiffView({ changes, onMeasure, measuring }) {
  if (!changes || changes.length === 0) {
    return (
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"#4B5563"}}>
        <img src={claudeBotImg} alt="Claude" style={{width:30,height:30,objectFit:"contain",opacity:0.6}} />
        <div style={{fontSize:13,fontWeight:600}}>Claude 변경 내역 없음</div>
      </div>
    );
  }
  return (
    <div style={{flex:1,overflow:"auto",background:"#0f1117"}}>
      {/* P4: 이 패치의 전후 효과를 같은 비교 포맷으로 측정 */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",
        borderBottom:"1px solid rgba(255,255,255,0.08)",background:"#12161f",position:"sticky",top:0,zIndex:2}}>
        <span style={{fontSize:11.5,color:"#94a3b8",flex:1}}>Claude 패치의 실제 성과 영향을 백테스트로 확인하세요.</span>
        <button onClick={()=>onMeasure&&onMeasure(changes)} disabled={measuring}
          style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:"none",
            background:measuring?"rgba(245,158,11,0.2)":"linear-gradient(135deg,#F59E0B,#D97706)",
            color:"#fff",fontSize:11.5,fontWeight:800,cursor:measuring?"wait":"pointer"}}>
          {measuring ? <Loader size={12} style={{animation:"spin 1s linear infinite"}}/> : <BarChart3 size={12}/>}
          변경 효과 측정 (전후 백테스트)
        </button>
      </div>
      {changes.map((c, i) => (
        <div key={c.path || i} style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#161b22"}}>
            <FileCode size={13} color="#d97757"/>
            <span style={{fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{c.filename || c.path}</span>
            <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:"rgba(217,119,87,0.16)",color:"#d97757",fontWeight:700}}>Claude 편집</span>
          </div>
          <DiffEditor
            height={Math.min(440, Math.max(160, ((c.after || "").split("\n").length + 2) * 19))}
            language={detectLang(c.filename || c.path || "main.py")}
            original={c.before || ""}
            modified={c.after || ""}
            theme="vs-dark"
            options={{ readOnly:true, renderSideBySide:true, minimap:{enabled:false}, fontSize:13.5, scrollBeyondLastLine:false, automaticLayout:true }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DeveloperLab() {
  useTheme();
  const [searchParams] = useSearchParams();

  // 사이드바 확장 상태 — AppShell 이벤트와 동기화
  const [sidebarExpanded, setSidebarExpanded] = useState(
    () => localStorage.getItem("alpha.sidebar.expanded") !== "false"
  );
  useEffect(() => {
    const handler = (e) => setSidebarExpanded(e.detail?.expanded ?? (localStorage.getItem("alpha.sidebar.expanded") !== "false"));
    window.addEventListener("alpha:sidebar-changed", handler);
    return () => window.removeEventListener("alpha:sidebar-changed", handler);
  }, []);

  // IDE 마운트 시 스크롤 비활성화, 언마운트 시 복원
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // 에디터 설정 — 설정 모달 변경 시 즉시 반영
  const [editorOpts, setEditorOpts] = useState(() => readEditorOpts());
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.key?.startsWith("ah.editor.")) setEditorOpts(readEditorOpts());
    };
    window.addEventListener("ah:settingsChanged", handler);
    return () => window.removeEventListener("ah:settingsChanged", handler);
  }, []);
  const sidePanelScrollRef = useRef(null);
  const logScrollRef = useRef(null);

  // ── IDE 설정 모달 ──
  const [ideSettingsOpen, setIdeSettingsOpen] = useState(false);

  // ── 워크스페이스 ──
  const [wsId, setWsId] = useState(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [btResult, setBtResult] = useState(null);
  // 백테스트 엔진 선택: vectorbt(빠름·Docker불필요) | lean(정밀·QuantConnect Docker)
  const [engine, setEngine] = useState("vectorbt");
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const [leanStrategies, setLeanStrategies] = useState([]);
  const [leanStrategyId, setLeanStrategyId] = useState("sma_crossover");
  const engineMenuRef = useRef(null);
  const leanJobRef = useRef(null);   // 현재 폴링 중인 Lean job_id (새 실행 시 이전 폴링 취소)
  const [leanHealth, setLeanHealth] = useState(null);  // Lean 실행환경 준비 상태(Docker/CLI/이미지)
  const [leanChannel, setLeanChannel] = useState("master"); // "master" | "foundation"
  // 실행 위치(로컬 자가호스팅 / 클라우드 관리형) + 구독 티어 게이팅
  const [execLoc, setExecLoc] = useState("cloud");     // "cloud" | "local"
  const [userTier, setUserTier] = useState(null);      // FREE | STANDARD | PREMIUM
  const [leanGateOpen, setLeanGateOpen] = useState(false); // 클라우드 Lean PREMIUM 게이트 모달
  useEffect(() => { getDeveloperAccess().then(a => setUserTier(a?.userType || null)).catch(() => {}); }, []);
  const cloudAllowed = userTier === "PREMIUM" || userTier === "EXPERT";  // 클라우드 관리형 컴퓨트 = PREMIUM 이상(EXPERT 포함)
  // Claude Code 에이전트 입력
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [claudeReq, setClaudeReq] = useState("");
  const [claudeBusy, setClaudeBusy] = useState(false);
  const claudeJobRef = useRef(null);          // 현재 폴링 중인 Claude job (새 실행 시 취소)
  const [claudeDiff, setClaudeDiff] = useState(null);  // { changes:[{path,filename,before,after}] }
  const [claudeDockW, setClaudeDockW] = useState(380); // 우측 Claude 도크 너비
  const [claudeMessages, setClaudeMessages] = useState([]); // 도크 내 대화(VSCode Claude Code 식): {role,content,...}
  const [claudeInputH, setClaudeInputH] = useState(90);    // 입력창 세로 높이(상단 핸들 드래그로 조절)
  const claudeScrollRef = useRef(null);
  useEffect(() => { if (claudeScrollRef.current) claudeScrollRef.current.scrollTop = claudeScrollRef.current.scrollHeight; }, [claudeMessages, claudeBusy]);
  // P3: 전략 개선 제안서
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveBusy, setImproveBusy] = useState(false);
  const [improveData, setImproveData] = useState(null);
  const [improveErr, setImproveErr] = useState(null);
  const [improveApplied, setImproveApplied] = useState(null);
  // #7/#8 최적화 — 파라미터 그리드 백테스트(기존 vectorbt 백테스트를 그리드로 반복)
  const [optBusy, setOptBusy] = useState(false);
  const [optProgress, setOptProgress] = useState({ done: 0, total: 0 });
  const [optResults, setOptResults] = useState(null); // { metric, metricLabel, p1, p2, combos:[{params,stats,score}], best }
  const [optComboFull, setOptComboFull] = useState(null); // 표 행클릭 → 해당 조합 풀 백테스트 결과
  // P4: Claude 패치 전후 효과 측정
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [compareErr, setCompareErr] = useState(null);
  const [queueMsg, setQueueMsg] = useState(null);
  const [wsList, setWsList] = useState([]);
  const [wsCandidates, setWsCandidates] = useState([]);   // 현재 워크스페이스의 전략 후보(3개)
  const [wsSelectedId, setWsSelectedId] = useState(null);  // 선택된 후보 id
  const [wsSwitchBusy, setWsSwitchBusy] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const wsDropdownRef = useRef(null);

  // ── 워크스페이스 코드 (기존) ──
  const [fileContents, setFileContents] = useState({ main: PLACEHOLDER_CODE });
  const [strategyName, setStrategyName] = useState("AlphaHelix Developer");

  // ── GitHub 레포 파일 트리 (신규) ──
  const [repoFiles, setRepoFiles]       = useState([]);   // [{path, sha, size}]
  const [fileCache, setFileCache]       = useState({});   // {path: 원본 content}
  const [repoContents, setRepoContents] = useState({});   // {path: 현재 에디터 content}
  const [fetchingFile, setFetchingFile] = useState(null); // 현재 fetch 중인 path
  const [localFolders, setLocalFolders]   = useState(new Set());
  const [deletedFiles, setDeletedFiles]   = useState(new Set());
  const [selectedPath, setSelectedPath]   = useState(null);
  const [newFileTrigger, setNewFileTrigger] = useState(null);

  // modified = 변경됐거나 새로 생성된 파일 (fileCache에 없으면 신규)
  const modifiedFiles = useMemo(() => {
    const out = {};
    for (const [path, content] of Object.entries(repoContents)) {
      const isNew = fileCache[path] === undefined;
      const isChanged = !isNew && content !== fileCache[path];
      if (isNew || isChanged) out[path] = content;
    }
    return out;
  }, [repoContents, fileCache]);

  const modifiedSet = useMemo(() => new Set(Object.keys(modifiedFiles)), [modifiedFiles]);

  const repoTree = useMemo(
    () => repoFiles.length > 0 ? buildTree(repoFiles) : null,
    [repoFiles]
  );

  // ── IDE 탭 ──
  const [openTabs, setOpenTabs] = useState([
    { id:"tab_main", name:"main.py", type:"code", fileKey:"main" },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab_main");

  // ── 사이드 패널 ──
  const [sidePanel, setSidePanel] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("panel");
    if (p === "data") return "data";
    if (p === "report" || p === "console" || p === "code") return null;
    return "explorer";
  });

  useEffect(() => {
    const p = searchParams.get("panel");
    if (p === "data") { setSidePanel("data"); }
    else if (p === "explorer" || !p) { setSidePanel("explorer"); }
    else if (p === "code") { setSidePanel(null); }
    else if (p === "report") {
      setSidePanel(null);
      setOpenTabs(prev => {
        if (prev.find(t => t.type === "report")) return prev;
        const reportId = `tab_report_sidebar`;
        const next = [...prev, { id: reportId, name: "📊 백테스트 결과", type: "report" }];
        setActiveTabId(reportId);
        return next;
      });
    } else if (p === "console") {
      setSidePanel(null);
      setTimeout(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (sidePanelScrollRef.current) sidePanelScrollRef.current.scrollTop = 0;
    if (logScrollRef.current) logScrollRef.current.scrollTop = 0;
  }, [sidePanel]);

  const [folderOpen, setFolderOpen] = useState(true);

  // 데이터셋: 실제 수집 현황(/api/analytics/data-status)으로 동적 구성 (실패 시 하드코딩 폴백)
  const [datasets, setDatasets] = useState(DATASETS);
  useEffect(() => {
    let alive = true;
    getDataStatus()
      .then(st => { if (alive) setDatasets(buildDatasetsFromStatus(st, DATASETS)); })
      .catch(() => { /* 폴백 유지 */ });
    return () => { alive = false; };
  }, []);
  const [dataGroupOpen, setDataGroupOpen] = useState(true);
  const [myDataOpen, setMyDataOpen] = useState(true);

  // ── 사이드 패널 너비 ──
  const [sidePanelW, setSidePanelW] = useState(() => {
    const v = Number(localStorage.getItem("ah.workbench.sidePanelWidth"));
    return Number.isFinite(v) && v >= 160 && v <= 400 ? v : 220;
  });
  const sideDragRef = useRef(null);
  const handleSideResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startW = sidePanelW;
    const onMove = (ev) => setSidePanelW(Math.min(420, Math.max(140, startW + ev.clientX - startX)));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidePanelW]);

  // 액티비티바(아이콘 열) 가로 리사이즈 — 사용자가 폭 조절 가능. 넓힐수록 탐색기가 오른쪽으로 밀림.
  const [actBarW, setActBarW] = useState(() => {
    const v = Number(localStorage.getItem("ah.workbench.actBarWidth"));
    return Number.isFinite(v) && v >= 44 && v <= 120 ? v : 56;
  });
  const handleActResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX, startW = actBarW;
    let latest = startW;
    const onMove = (ev) => { latest = Math.min(120, Math.max(44, startW + ev.clientX - startX)); setActBarW(latest); };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem("ah.workbench.actBarWidth", String(latest)); } catch (_) {}
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actBarW]);

  // ── 하단 콘솔 ──
  const [bottomH, setBottomH] = useState(180);
  const [runStatus, setRunStatus] = useState("idle");
  const [logLines, setLogLines] = useState([]);
  const [consoleTab, setConsoleTab] = useState("log"); // "log" | "terminal"
  const logEndRef = useRef(null);
  const timerRefs = useRef([]);

  useEffect(() => { if (logLines.length > 0) logEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [logLines]);

  // ── 파일 트리 로드 ──
  const loadFileTree = useCallback(async (id) => {
    if (!id) return;
    try {
      const tree = await getWorkspaceFileTree(id);
      setRepoFiles(Array.isArray(tree) ? tree : []);
    } catch { setRepoFiles([]); }
  }, []);

  // wsId 변경 시 레포 연결 여부 확인 후 파일 트리 로드
  useEffect(() => {
    if (!wsId) { setRepoFiles([]); setFileCache({}); setRepoContents({}); return; }
    getWorkspaceGitStatus(wsId)
      .then(ws => { if (ws.connected) return getWorkspaceFileTree(wsId); return []; })
      .then(tree => setRepoFiles(Array.isArray(tree) ? tree : []))
      .catch(() => setRepoFiles([]));
  }, [wsId]);

  // ── 레포 파일 열기 ──
  const openRepoFile = useCallback(async (filePath) => {
    const tabId = `tab_repo_${filePath}`;
    if (openTabs.find(t => t.id === tabId)) { setActiveTabId(tabId); return; }
    const fileName = filePath.split("/").pop();
    const lang = detectLang(fileName);

    // 캐시에 있으면 바로 탭 열기
    if (fileCache[filePath] !== undefined) {
      if (repoContents[filePath] === undefined) {
        setRepoContents(prev => ({ ...prev, [filePath]: fileCache[filePath] }));
      }
      setOpenTabs(prev => [...prev, { id:tabId, name:fileName, type:"repoFile", filePath, lang }]);
      setActiveTabId(tabId);
      return;
    }

    setFetchingFile(filePath);
    try {
      const data = await pullWorkspaceFile(wsId, filePath);
      setFileCache(prev => ({ ...prev, [filePath]: data.content }));
      setRepoContents(prev => ({ ...prev, [filePath]: data.content }));
      setOpenTabs(prev => [...prev, { id:tabId, name:fileName, type:"repoFile", filePath, lang }]);
      setActiveTabId(tabId);
    } catch {
      setLogLines(prev => [...prev, {
        type:"error", msg:`파일 로드 실패: ${filePath}`, ts:new Date().toLocaleTimeString(),
      }]);
    } finally {
      setFetchingFile(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, openTabs, fileCache, repoContents]);

  // push 성공 후 fileCache 갱신 (더 이상 modified 아님)
  const onGitPushComplete = useCallback((pushedPaths) => {
    setFileCache(prev => {
      const updated = { ...prev };
      for (const path of pushedPaths) {
        if (repoContents[path] !== undefined) updated[path] = repoContents[path];
      }
      return updated;
    });
  }, [repoContents]);

  // pull 시 현재 열려있는 repo 파일들 갱신
  const onGitPullAll = useCallback(async () => {
    if (!wsId) return;
    await loadFileTree(wsId);
    // 이미 열린 repo 파일 내용 갱신
    const repoPaths = openTabs.filter(t => t.type === "repoFile").map(t => t.filePath);
    for (const path of repoPaths) {
      try {
        const data = await pullWorkspaceFile(wsId, path);
        setFileCache(prev => ({ ...prev, [path]: data.content }));
        setRepoContents(prev => ({ ...prev, [path]: data.content }));
      } catch { /* ignore */ }
    }
    // pull 후 파일 트리가 보이도록 탐색기로 전환
    setSidePanel("explorer");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, openTabs]);

  // ── 레포 파일/폴더 생성 ──
  const handleRepoCreate = useCallback((fullPath, type) => {
    if (type === 'folder') {
      setLocalFolders(prev => new Set([...prev, fullPath]));
    } else {
      setRepoContents(prev => ({ ...prev, [fullPath]: '' }));
      setRepoFiles(prev => prev.find(f => f.path === fullPath) ? prev : [...prev, { path: fullPath, sha: '', size: 0 }]);
      const tabId = `tab_repo_${fullPath}`;
      const fileName = fullPath.split('/').pop();
      const lang = detectLang(fileName);
      setOpenTabs(prev => prev.find(t => t.id === tabId) ? prev : [
        ...prev, { id: tabId, name: fileName, type: 'repoFile', filePath: fullPath, lang }
      ]);
      setActiveTabId(tabId);
    }
  }, []);

  // ── 레포 파일/폴더 삭제 ──
  const handleRepoDelete = useCallback((path, type) => {
    const pathsToDelete = type === 'folder'
      ? repoFiles.filter(f => f.path.startsWith(path + '/')).map(f => f.path)
      : [path];
    for (const p of pathsToDelete) {
      const existing = repoFiles.find(f => f.path === p);
      if (existing && existing.sha) {
        setDeletedFiles(prev => new Set([...prev, p]));
      }
      setRepoFiles(prev => prev.filter(f => f.path !== p));
      setRepoContents(prev => { const n = {...prev}; delete n[p]; return n; });
      setFileCache(prev => { const n = {...prev}; delete n[p]; return n; });
      const tabId = `tab_repo_${p}`;
      setOpenTabs(prev => {
        const next = prev.filter(t => t.id !== tabId);
        if (activeTabId === tabId && next.length > 0) setActiveTabId(next[next.length - 1].id);
        return next;
      });
    }
    if (type === 'folder') setLocalFolders(prev => { const n = new Set(prev); n.delete(path); return n; });
  }, [repoFiles, activeTabId]);

  // ── 레포 파일/폴더 이름 변경 ──
  const handleRepoRename = useCallback((oldPath, newPath) => {
    setRepoFiles(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath } : f));
    setRepoContents(prev => {
      const n = { ...prev };
      if (n[oldPath] !== undefined) { n[newPath] = n[oldPath]; delete n[oldPath]; }
      return n;
    });
    if (fileCache[oldPath] !== undefined) {
      setDeletedFiles(prev => new Set([...prev, oldPath]));
      setFileCache(prev => { const n = { ...prev }; delete n[oldPath]; return n; });
    }
    const oldTabId = `tab_repo_${oldPath}`;
    const newTabId = `tab_repo_${newPath}`;
    const newName = newPath.split('/').pop();
    const lang = detectLang(newName);
    setOpenTabs(prev => prev.map(t => t.id === oldTabId
      ? { ...t, id: newTabId, name: newName, filePath: newPath, lang }
      : t
    ));
    if (activeTabId === oldTabId) setActiveTabId(newTabId);
  }, [fileCache, activeTabId]);

  // ── 워크스페이스 로드 ──
  const loadWorkspace = useCallback((id) => {
    setWsLoading(true);
    getWorkspace(id)
      .then(data => {
        setWsId(id);
        localStorage.setItem("alpha.lastWsId", id);
        setStrategyName(data.name || "AlphaHelix Strategy");
        setBtResult(null);
        // 전략 후보(3개) + 선택 id 추출 — 워크스페이스 패널의 전략 트리에 사용
        try {
          const cfg0 = data.strategyConfig
            ? (typeof data.strategyConfig === "string" ? JSON.parse(data.strategyConfig) : data.strategyConfig)
            : null;
          const cands = Array.isArray(cfg0?.candidates) ? cfg0.candidates : [];
          setWsCandidates(cands);
          setWsSelectedId(cfg0?.selectedId ?? cfg0?.selected_id ?? (cands[0]?.id ?? null));
        } catch { setWsCandidates([]); setWsSelectedId(null); }
        if (data.codeJson) {
          try { setFileContents(JSON.parse(data.codeJson)); } catch { /* ignore */ }
        } else if (data.strategyConfig) {
          const env = typeof data.strategyConfig === "string"
            ? JSON.parse(data.strategyConfig) : data.strategyConfig;
          // ⚠️ envelope({candidates, selectedId}) 에는 strategy_type/assets 가 top-level 에 없다.
          // 반드시 '선택된 후보'를 codegen 에 넘겨야 전략별(무한매수/모멘텀/추세변동성) 올바른 코드가 나온다.
          // (과거 버그: envelope 전체를 넘겨 cfg.strategy_type=undefined → 무조건 SMA/SPY default 로 떨어짐)
          const cands = Array.isArray(env?.candidates) ? env.candidates : [];
          const selId = env?.selectedId ?? env?.selected_id ?? cands[0]?.id;
          const selected = cands.find(c => c.id === selId) || cands[0] || env;
          const code = generateCodeFromConfig(selected);
          setFileContents({ main: code });
          if (code) { saveCode(id, JSON.stringify({ main: code })).catch(() => {}); }
        }
      })
      .catch(() => {
        localStorage.removeItem("alpha.lastWsId");
        setWsId(null);
      })
      .finally(() => setWsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 워크스페이스 패널 액션: 전환 / 추가 / 전략후보 선택 ──
  const handleSwitchWorkspace = useCallback((id) => {
    if (!id || String(id) === String(wsId)) return;
    setOpenTabs([{ id:"tab_main", name:"main.py", type:"code", fileKey:"main" }]);
    setActiveTabId("tab_main");
    loadWorkspace(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, loadWorkspace]);

  const handleAddWorkspace = useCallback(async () => {
    const name = window.prompt("새 워크스페이스 이름");
    if (!name || !name.trim()) return;
    try {
      const w = await createWorkspace(name.trim());
      const r = await listWorkspaces();
      setWsList(Array.isArray(r) ? r : (r?.content || []));
      handleSwitchWorkspace(w.id);
    } catch (e) {
      alert("워크스페이스 생성 실패: " + (e?.response?.data?.error || e.message));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSwitchWorkspace]);

  const handleSelectCandidate = useCallback(async (candidateId) => {
    if (!wsId || !candidateId || candidateId === wsSelectedId) return;
    setWsSwitchBusy(true);
    try {
      await selectStrategyCandidate(wsId, candidateId);
      // 선택된 후보로 즉시 코드 재생성 + 저장 → 전략별(무한매수/모멘텀/추세변동성) 올바른 코드 반영.
      // (codeJson 캐시가 이전 후보 코드로 남아있어도 여기서 덮어써서 stale 방지)
      const cand = wsCandidates.find(c => c.id === candidateId);
      if (cand) {
        const code = generateCodeFromConfig(cand);
        if (code) { setFileContents({ main: code }); await saveCode(wsId, JSON.stringify({ main: code })).catch(() => {}); }
      }
      loadWorkspace(wsId);
    } catch (e) {
      alert("전략 선택 실패: " + (e?.response?.data?.error || e.message));
    } finally { setWsSwitchBusy(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, wsSelectedId, wsCandidates, loadWorkspace]);

  useEffect(() => {
    const id = localStorage.getItem("alpha.lastWsId");
    if (id) loadWorkspace(id);
    else setWsLoading(false);
    listWorkspaces().then(r => setWsList(Array.isArray(r) ? r : (r?.content || []))).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onReload = (e) => {
      const patchedId = e?.detail?.wsId ? Number(e.detail.wsId) : null;
      if (!patchedId || patchedId === Number(wsId)) {
        const targetId = patchedId || wsId;
        if (targetId) loadWorkspace(targetId);
      }
    };
    window.addEventListener("alphaWorkspaceReload", onReload);
    return () => window.removeEventListener("alphaWorkspaceReload", onReload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // Lean 엔진 선택 시 preset 전략 목록 1회 로드 (lazy)
  useEffect(() => {
    if (engine !== "lean" || leanStrategies.length > 0) return;
    leanListStrategies()
      .then(r => {
        const list = Array.isArray(r?.strategies) ? r.strategies : [];
        setLeanStrategies(list);
        if (list.length && !list.some(s => s.id === leanStrategyId)) setLeanStrategyId(list[0].id);
      })
      .catch(() => { /* 503/오프라인 — 기본 전략값 유지 */ });
  }, [engine, leanStrategies.length, leanStrategyId]);

  // 엔진 셀렉터 바깥 클릭 시 닫기
  useEffect(() => {
    if (!engineMenuOpen) return;
    const onDown = (e) => { if (engineMenuRef.current && !engineMenuRef.current.contains(e.target)) setEngineMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [engineMenuOpen]);

  // Lean 엔진 선택 중에는 실행환경 준비 상태(Docker/lean CLI/이미지)를 10초마다 조회.
  // (engineMenuOpen 에 묶으면 Lean 선택 시 드롭다운이 닫혀 폴링이 멈춤 → 배지 박스는 engine==="lean" 동안 항상 보이므로 그 조건으로 폴링)
  useEffect(() => {
    if (engine !== "lean") return;
    let alive = true;
    const fetchHealth = () => getLeanHealth()
      .then(h => { if (alive) setLeanHealth(h); })
      .catch(() => { if (alive) setLeanHealth({ analytics: false, ready: false }); });
    fetchHealth();
    const id = setInterval(fetchHealth, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [engine]);

  // Heli(RightChatDock)가 현재 에디터 코드를 알 수 있도록 라이브 스냅샷 공유.
  // → dev studio 에서 "이 코드 고쳐줘" 했을 때 Heli 가 현재 코드를 베이스로 code 패치를 만든다.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__alphaLiveCode = { wsId: wsId ? Number(wsId) : null, files: fileContents };
    }
  }, [wsId, fileContents]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!wsDropdownOpen) return;
    const handler = (e) => { if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target)) setWsDropdownOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [wsDropdownOpen]);

  // ── 탭 관리 ──
  const openFile = useCallback((fileKey) => {
    const tabId = `tab_${fileKey}`;
    setOpenTabs(prev => prev.find(t=>t.id===tabId) ? prev : [...prev, {id:tabId, name:FILE_META[fileKey].name, type:"code", fileKey}]);
    setActiveTabId(tabId);
  }, []);

  const openDataset = useCallback((ds) => {
    const tabId = `tab_data_${ds.id}`;
    setOpenTabs(prev => prev.find(t=>t.id===tabId) ? prev : [...prev, {id:tabId, name:ds.name, type:"data", datasetId:ds.id}]);
    setActiveTabId(tabId);
  }, []);

  const handleOpenDatasets = useCallback(() => {
    const id = "tab_datasets";
    setOpenTabs(prev => prev.find(t=>t.id===id) ? prev : [...prev, { id, name:"🗂 데이터셋 카탈로그", type:"datasets" }]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback((tabId, e) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t=>t.id!==tabId);
      if (activeTabId===tabId && next.length>0) setActiveTabId(next[next.length-1].id);
      return next;
    });
  }, [activeTabId]);

  // ── 코드 저장 ──
  const handleSave = useCallback(async () => {
    if (!wsId) { alert("워크스페이스가 없습니다. Alpha-Helix 탭에서 먼저 전략을 설정하세요."); return; }
    try {
      await saveCode(wsId, JSON.stringify(fileContents));
      setLogLines(prev => [...prev, {type:"success", msg:"코드가 저장되었습니다.", ts:new Date().toLocaleTimeString()}]);
    } catch {
      setLogLines(prev => [...prev, {type:"error", msg:"저장 실패", ts:new Date().toLocaleTimeString()}]);
    }
  }, [wsId, fileContents]);

  // ── 백테스트 실행 ──
  const handleRunBacktest = useCallback(async () => {
    if (runStatus === "running") return;
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setRunStatus("running");
    setLogLines([{ type:"info", msg:"백테스트 준비 중...", ts: new Date().toLocaleTimeString() }]);

    if (!wsId) {
      setRunStatus("idle");
      setLogLines([{ type:"error", msg:"워크스페이스가 없습니다.", ts: new Date().toLocaleTimeString() }]);
      return;
    }

    const activeContent = openTabs.find(t=>t.id===activeTabId);
    const currentCode = (activeContent?.fileKey && fileContents[activeContent.fileKey])
      || fileContents.main || "";
    const customParams = parseParamsFromCode(currentCode);
    const ticker = customParams.ticker || "SPY";

    const t0 = Date.now();
    setLogLines([
      { type:"info", msg:`[vectorbt] 백테스트 시작  ticker=${ticker}  period=5y`, ts: new Date().toLocaleTimeString() },
      { type:"info", msg:`[param] ${JSON.stringify(customParams)}`, ts: new Date().toLocaleTimeString() },
      { type:"info", msg:`[data] OHLCV 로드 중… (Polygon→yfinance 폴백)`, ts: new Date().toLocaleTimeString() },
    ]);

    try {
      const result = await runBacktest(wsId, "5y", customParams);
      setBtResult(result);
      setRunStatus("done");
      const stats = result.stats || {};
      const ec = result.equity_curve || [];
      const ts = new Date().toLocaleTimeString();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const f1 = (v) => (v == null ? "N/A" : v.toFixed(1));
      const f2 = (v) => (v == null ? "N/A" : v.toFixed(2));
      setLogLines(prev => [...prev,
        { type:"info",    msg:`[data] OHLCV ${ec.length || "?"} bars 로드 완료 (${stats.start || "?"} ~ ${stats.end || "?"})`, ts },
        { type:"info",    msg:`[cost] 수수료 0.25% + 슬리피지 0.1% 반영 · 신호 fshift(1) anti-look-ahead`, ts },
        { type:"info",    msg:`[engine] vectorbt Portfolio.from_signals 시뮬레이션 완료`, ts },
        { type:"success", msg:`[done] 백테스트 완료 (${elapsed}s)`, ts },
        { type:"trade",   msg:`총수익 ${f1(stats.total_return_pct)}%  ·  연환산 ${f1(stats.annualized_return_pct)}%  ·  Sharpe ${f2(stats.sharpe)}`, ts },
        { type:"trade",   msg:`거래 ${stats.trades ?? "?"}회  ·  승률 ${f1(stats.win_rate_pct)}%  ·  MDD ${f1(stats.max_drawdown_pct)}%`, ts },
        { type:"info",    msg:`▶ '📊 백테스트 결과' 탭에서 수익률 커브 + 메트릭 확인`, ts },
      ]);
      const reportId = `tab_report_${Date.now()}`;
      setOpenTabs(prev => {
        const filtered = prev.filter(t => t.type !== "report");
        const withReport = [...filtered, { id: reportId, name: "📊 백테스트 결과", type: "report" }];
        // 3번째 탭: 코드 해설 노트북 (없으면 추가)
        return withReport.some(t => t.type === "notebook") ? withReport : [...withReport, { id: "tab_notebook", name: "📓 코드 해설", type: "notebook" }];
      });
      setActiveTabId(reportId);
    } catch (e) {
      setRunStatus("idle");
      const msg = e?.response?.data?.error || e?.message || "알 수 없는 오류";
      setLogLines([{ type:"error", msg:`백테스트 실패: ${msg}`, ts: new Date().toLocaleTimeString() }]);
    }
  }, [runStatus, wsId, fileContents, activeTabId, openTabs]);

  // ── Lean (QuantConnect) 백테스트 실행 — 비동기 잡 시작 + 진행 폴링 ──
  const handleRunLean = useCallback(async () => {
    if (runStatus === "running") return;
    // 클라우드 관리형 Lean = PREMIUM 게이팅. 로컬(자가호스팅)은 본인 Docker 로 실행.
    if (execLoc === "cloud" && !cloudAllowed) {
      setLeanGateOpen(true);
      return;
    }
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setRunStatus("running");
    if (!wsId) {
      setRunStatus("idle");
      setLogLines([{ type:"error", msg:"워크스페이스가 없습니다.", ts: new Date().toLocaleTimeString() }]);
      return;
    }

    const activeContent = openTabs.find(t=>t.id===activeTabId);
    const currentCode = (activeContent?.fileKey && fileContents[activeContent.fileKey]) || fileContents.main || "";
    const customParams = parseParamsFromCode(currentCode);
    const ticker = customParams.ticker || "SPY";
    // Lean 은 명시적 YYYY-MM-DD 필요 → 최근 2년 범위
    const endD = new Date();
    const startD = new Date(); startD.setFullYear(startD.getFullYear() - 2);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const startDate = fmt(startD), endDate = fmt(endD);
    const sName = leanStrategies.find(s=>s.id===leanStrategyId)?.name || leanStrategyId;
    const nowTs = () => new Date().toLocaleTimeString();

    setLogLines([
      { type:"info", msg:`[Lean·QuantConnect] 백테스트 시작  strategy=${leanStrategyId} (${sName})`, ts: nowTs() },
      { type:"info", msg:`[Lean] symbols=[${ticker}]  market=us  range ${startDate} ~ ${endDate}`, ts: nowTs() },
    ]);

    // 1) 잡 시작
    let jobId;
    try {
      const startResp = await leanBacktestStart({
        strategyId: leanStrategyId, symbols: [ticker], startDate, endDate,
        market: "us", paramOverrides: customParams,
      });
      jobId = startResp.job_id;
      leanJobRef.current = jobId;
    } catch (e) {
      setRunStatus("idle");
      const ts = nowTs();
      if (e?.response?.status === 503) {
        const d = e.response.data || {};
        setLogLines([
          { type:"error", msg:`[Lean] 비활성: ${d.error || "Lean 엔진이 꺼져 있습니다."}`, ts },
          { type:"warn",  msg:`[hint] ${d.hint || "application-{profile}.properties 에 app.lean.enabled=true + analytics 사이드카에 Docker/quantconnect-lean 이미지 필요"}`, ts },
          { type:"info",  msg:`[tip] vectorbt 엔진은 Docker 없이 즉시 실행됩니다 — 엔진 셀렉터에서 전환하세요.`, ts },
        ]);
      } else {
        const msg = e?.response?.data?.error || e?.message || "알 수 없는 오류";
        setLogLines(prev => [...prev, { type:"error", msg:`Lean 시작 실패: ${msg}`, ts }]);
      }
      return;
    }
    setLogLines(prev => [...prev, { type:"info", msg:`[Lean] 잡 시작됨 job=${jobId} · 진행 폴링 중…`, ts: nowTs() }]);

    // 2) 진행 폴링 (1.5s 간격, since 커서로 증분 로그)
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let cursor = 0;
    const MAX_POLLS = 420; // ~10.5분 안전 상한
    for (let i = 0; i < MAX_POLLS; i++) {
      if (leanJobRef.current !== jobId) return; // 새 실행이 시작돼 이 폴링은 취소
      await sleep(1500);
      let st;
      try {
        st = await leanBacktestStatus(jobId, cursor);
      } catch { continue; } // 일시적 폴링 오류는 다음 주기에 재시도
      if (leanJobRef.current !== jobId) return;

      const newLogs = Array.isArray(st.logs) ? st.logs : [];
      if (newLogs.length > 0) {
        const ts = nowTs();
        setLogLines(prev => [...prev, ...newLogs.map(l => ({
          type: l.type === "phase" ? "info" : (l.type || "info"),
          msg:  l.type === "phase" ? `▸ ${l.msg}` : l.msg,
          ts,
        }))]);
      }
      if (typeof st.next === "number") cursor = st.next;

      if (st.status === "done" && st.result) {
        leanJobRef.current = null;
        const resp = st.result;
        // Lean 통계는 정규화(0~1) → 리포트 패널 퍼센트 스케일로 변환
        const ls = resp.statistics || {};
        const pct = (v) => (v == null ? null : v * 100);
        const stats = {
          total_return_pct:      pct(ls.total_return_pct),
          annualized_return_pct: pct(ls.cagr),
          sharpe:                ls.sharpe_ratio,
          sortino:               ls.sortino_ratio,
          profit_factor:         ls.profit_factor,
          total_fees:            ls.total_commission,
          max_drawdown_pct:      pct(ls.max_drawdown_pct),
          win_rate_pct:          pct(ls.win_rate),
          trades:                ls.num_trades,
          start: startDate, end: endDate, engine: "lean", run_id: resp.run_id,
        };
        const equity = (resp.equity_curve || []).map(v => (typeof v === "number" ? { value: v } : v));
        setBtResult({ stats, equity_curve: equity });
        setRunStatus("done");
        const ts = nowTs();
        const elapsed = resp.elapsed_seconds != null ? Number(resp.elapsed_seconds).toFixed(1) : "?";
        const f1 = (v) => (v == null ? "N/A" : v.toFixed(1));
        const f2 = (v) => (v == null ? "N/A" : v.toFixed(2));
        setLogLines(prev => [...prev,
          { type:"success", msg:`[done] Lean 백테스트 완료 run_id=${resp.run_id} (${elapsed}s)`, ts },
          { type:"trade",   msg:`총수익 ${f1(stats.total_return_pct)}%  ·  CAGR ${f1(stats.annualized_return_pct)}%  ·  Sharpe ${f2(stats.sharpe)}`, ts },
          { type:"trade",   msg:`거래 ${stats.trades ?? "?"}회  ·  승률 ${f1(stats.win_rate_pct)}%  ·  MDD ${f1(stats.max_drawdown_pct)}%`, ts },
          { type:"info",    msg:`▶ '📊 백테스트 결과' 탭에서 메트릭 확인`, ts },
        ]);
        const reportId = `tab_report_${Date.now()}`;
        setOpenTabs(prev => { const filtered = prev.filter(t => t.type !== "report"); return [...filtered, { id: reportId, name: "📊 백테스트 결과", type: "report" }]; });
        setActiveTabId(reportId);
        return;
      }
      if (st.status === "error") {
        leanJobRef.current = null;
        setRunStatus("idle");
        setLogLines(prev => [...prev, { type:"error", msg:`Lean 실패: ${st.error || "알 수 없는 오류"}`, ts: nowTs() }]);
        return;
      }
    }
    // 폴링 상한 초과 (백그라운드 잡은 계속될 수 있음)
    if (leanJobRef.current === jobId) {
      leanJobRef.current = null;
      setRunStatus("idle");
      setLogLines(prev => [...prev, { type:"warn", msg:`[Lean] 폴링 시간 초과 — 백그라운드 실행은 계속될 수 있음 (job=${jobId})`, ts: nowTs() }]);
    }
  }, [runStatus, wsId, fileContents, activeTabId, openTabs, leanStrategyId, leanStrategies, execLoc, cloudAllowed]);

  // ── P3: 전략 개선 제안서 (진단 + 선택지 + 전후 백테스트 비교) ──
  const handleImproveProposal = useCallback(async () => {
    if (improveBusy) return;
    setImproveOpen(true); setImproveErr(null); setImproveData(null); setImproveApplied(null);
    if (!wsId) { setImproveErr("워크스페이스가 없습니다."); return; }
    const activeContent = openTabs.find(t=>t.id===activeTabId);
    const currentCode = (activeContent?.fileKey && fileContents[activeContent.fileKey]) || fileContents.main || "";
    const customParams = parseParamsFromCode(currentCode);
    setImproveBusy(true);
    try {
      const data = await runImproveProposal(wsId, customParams, "5y");
      setImproveData(data);
    } catch (e) {
      setImproveErr(e?.response?.data?.error || e?.message || "개선 제안 생성 실패");
    } finally { setImproveBusy(false); }
  }, [improveBusy, wsId, openTabs, activeTabId, fileContents]);

  const handleApplyOption = useCallback((option) => {
    if (!option || !option.params) return;
    const fileKey = (openTabs.find(t=>t.id===activeTabId)?.fileKey) || "main";
    const baseCode = fileContents[fileKey] || fileContents.main || "";
    const newCode = applyParamsToCode(baseCode, option.params);
    const nextContents = { ...fileContents, [fileKey]: newCode };
    setFileContents(nextContents);
    setImproveApplied(option.key);
    if (wsId) saveCode(wsId, JSON.stringify(nextContents)).catch(()=>{});
    setImproveOpen(false);
    // 적용된 파라미터로 바로 백테스트해 결과 확인
    setTimeout(() => { handleRunBacktest(); }, 120);
  }, [openTabs, activeTabId, fileContents, wsId, handleRunBacktest]);

  // ── P4: Claude 패치 전후 효과 측정 (같은 비교 포맷) ──
  const handleMeasureClaudeChange = useCallback(async (changes) => {
    if (!changes || changes.length === 0) return;
    // 코드 파일 변경 우선(main 우선), 없으면 첫 변경
    const target = changes.find(c => /\.py$/.test(c.filename || c.path || "") || (c.path === "main"))
      || changes.find(c => (c.path || "").includes("main")) || changes[0];
    const before = parseParamsFromCode(target.before || "");
    const after = parseParamsFromCode(target.after || "");
    setCompareOpen(true); setCompareErr(null); setCompareData(null); setCompareBusy(true);
    if (!wsId) { setCompareErr("워크스페이스가 없습니다."); setCompareBusy(false); return; }
    try {
      const data = await runCompareBacktest(wsId, before, after, "5y");
      setCompareData(data);
    } catch (e) {
      setCompareErr(e?.response?.data?.error || e?.message || "효과 측정 실패");
    } finally { setCompareBusy(false); }
  }, [wsId]);

  // ── Claude Code 에이전트 (헤드리스 claude CLI · 단계별 스트리밍 + diff) ──
  const handleClaudeAgent = useCallback(async () => {
    if (claudeBusy) return;
    const req = claudeReq.trim();
    if (!wsId) { setClaudeMessages(prev => [...prev, { role:"error", content:"워크스페이스가 없습니다." }]); return; }
    if (!req) return;
    setClaudeBusy(true);
    setClaudeReq("");
    // 대화는 도크 안에 누적 (VSCode Claude Code 식). 콘솔로 보내지 않는다.
    setClaudeMessages(prev => [...prev, { role:"user", content:req }]);

    // 1) 잡 시작
    let jobId;
    try {
      const s = await runClaudeAgentStart(wsId, req);
      jobId = s.jobId;
      claudeJobRef.current = jobId;
    } catch (e) {
      setClaudeBusy(false);
      if (e?.response?.status === 503) {
        const d = e.response.data || {};
        setClaudeMessages(prev => [...prev, { role:"error", content:`Claude 에이전트 비활성: ${d.error || "꺼져 있음"} ${d.hint ? "("+d.hint+")" : ""}` }]);
      } else if (e?.response?.status === 402) {
        setClaudeMessages(prev => [...prev, { role:"error", content: e.response.data?.error || "Quant Developer IDE(Claude)는 STANDARD 구독부터입니다." }]);
      } else {
        setClaudeMessages(prev => [...prev, { role:"error", content:`Claude 시작 실패: ${e?.response?.data?.error || e?.message}` }]);
      }
      return;
    }

    // 2) 단계별 진행 폴링 (1s 간격, since 커서) → 대화에 진행 단계 누적
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let cursor = 0;
    const MAX_POLLS = 220; // ~3.5분 안전 상한
    for (let i = 0; i < MAX_POLLS; i++) {
      if (claudeJobRef.current !== jobId) return;
      await sleep(1000);
      let st;
      try { st = await runClaudeAgentStatus(wsId, jobId, cursor); }
      catch { continue; }
      if (claudeJobRef.current !== jobId) return;

      const newLogs = Array.isArray(st.logs) ? st.logs : [];
      if (newLogs.length) {
        setClaudeMessages(prev => [...prev, ...newLogs.map(l => ({ role:"progress", type: l.type || "info", content: l.msg }))]);
      }
      if (typeof st.next === "number") cursor = st.next;

      if (st.status === "done" && st.result) {
        claudeJobRef.current = null;
        setClaudeBusy(false);
        const r = st.result;
        const narr = (r.narration || "").trim();
        let summary = "";
        if (r.hasChanges) {
          const files = (r.changedFiles || []).join(", ");
          summary = `✓ ${(r.changedFiles||[]).length}개 파일 편집 적용 (${files}) — '🔀 Claude diff' 탭 + 상단 'Heli 변경' 바에서 [유지]/[실행취소]`;
          const changes = Array.isArray(r.changes) ? r.changes : [];
          if (changes.length) {
            const diffId = `tab_diff_${Date.now()}`;
            setClaudeDiff({ changes });
            setOpenTabs(prev => { const filtered = prev.filter(t => t.type !== "diff"); return [...filtered, { id: diffId, name: `🔀 Claude diff (${changes.length})`, type: "diff" }]; });
            setActiveTabId(diffId);
          }
          window.dispatchEvent(new CustomEvent("alphaPatchApplied", { detail: { wsId: Number(wsId), changeSet: { id: r.changeSetId, title: r.changeSetTitle } } }));
          window.dispatchEvent(new CustomEvent("alphaWorkspaceReload", { detail: { wsId: Number(wsId) } }));
        }
        setClaudeMessages(prev => [...prev, {
          role:"assistant",
          content: narr || (r.hasChanges ? "" : "코드 변경 없이 답변했어요."),
          summary,
          changes: r.hasChanges && Array.isArray(r.changes) ? r.changes : [],
        }]);
        // 도크는 닫지 않는다 — 대화 계속.
        return;
      }
      if (st.status === "error") {
        claudeJobRef.current = null;
        setClaudeBusy(false);
        setClaudeMessages(prev => [...prev, { role:"error", content:`Claude 실패: ${st.error || "알 수 없는 오류"}` }]);
        return;
      }
    }
    if (claudeJobRef.current === jobId) {
      claudeJobRef.current = null;
      setClaudeBusy(false);
      setClaudeMessages(prev => [...prev, { role:"error", content:`Claude 폴링 시간 초과 (job=${jobId})` }]);
    }
  }, [claudeBusy, claudeReq, wsId]);

  // ── 주문 큐 ──
  const handleQueueOrders = useCallback(async () => {
    if (!wsId) { alert("워크스페이스가 없습니다."); return; }
    if (!btResult) { alert("먼저 백테스트를 실행하세요."); return; }
    try {
      const result = await queueOrders(wsId);
      const count = result?.count ?? result?.orders?.length ?? "?";
      setQueueMsg(`✓ ${count}건의 주문이 큐에 추가되었습니다`);
      setTimeout(() => setQueueMsg(null), 4000);
    } catch (e) {
      alert(`큐 추가 실패: ${e?.response?.data?.error || e?.message}`);
    }
  }, [wsId, btResult]);

  const handleDeploy = useCallback(() => {
    if (!wsId) { alert("워크스페이스를 먼저 선택하세요."); return; }
    const id = "tab_deploy";
    setOpenTabs(prev => prev.find(t=>t.id===id) ? prev : [...prev, { id, name:"🚀 Deploy to Live", type:"deploy" }]);
    setActiveTabId(id);
  }, [wsId]);

  // ── #7 최적화 위저드 열기 ──
  const handleOpenOptimize = useCallback(() => {
    if (!wsId) { alert("워크스페이스를 먼저 선택하세요."); return; }
    const id = "tab_optimize";
    setOpenTabs(prev => prev.find(t=>t.id===id) ? prev : [...prev, { id, name:"🎯 최적화", type:"optimize" }]);
    setActiveTabId(id);
  }, [wsId]);

  // ── 코드 해설 노트북 탭 열기 ──
  const handleOpenNotebook = useCallback(() => {
    if (!wsId) { alert("워크스페이스를 먼저 선택하세요."); return; }
    const id = "tab_notebook";
    setOpenTabs(prev => prev.find(t=>t.id===id) ? prev : [...prev, { id, name:"📓 코드 해설", type:"notebook" }]);
    setActiveTabId(id);
  }, [wsId]);

  // ── #7/#8 최적화 실행: 파라미터 그리드로 백테스트 반복 → 결과 탭 ──
  const handleLaunchOptimize = useCallback(async (config) => {
    if (optBusy || !wsId) return;
    const { params, metric, metricLabel, period, constraint, constraints, nodeTier } = config;
    const active = openTabs.find(t=>t.id===activeTabId);
    const base = parseParamsFromCode((active?.fileKey && fileContents[active.fileKey]) || fileContents.main || "");
    // 그리드 좌표 생성
    const axis = (p) => {
      const out = []; const step = p.step > 0 ? p.step : 1;
      for (let v = p.min; v <= p.max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
      return out;
    };
    const p1 = params[0], p2 = params[1] || null;
    const a1 = axis(p1), a2 = p2 ? axis(p2) : [null];
    const combos = [];
    for (const v1 of a1) for (const v2 of a2) combos.push({ [p1.name]: v1, ...(p2 ? { [p2.name]: v2 } : {}) });
    if (combos.length === 0) { alert("파라미터 범위가 비어 있습니다."); return; }
    if (combos.length > 64) { alert(`조합이 ${combos.length}개로 너무 많습니다. 범위/스텝을 조정해 64개 이하로 줄이세요.`); return; }

    setOptBusy(true);
    setOptProgress({ done: 0, total: combos.length });
    setOpenTabs(prev => prev.find(t=>t.id==="tab_optresult") ? prev : [...prev, { id:"tab_optresult", name:"📈 최적화 결과", type:"optresult" }]);
    setActiveTabId("tab_optresult");
    const results = [];
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = now();
    let sumMs = 0;
    for (let i = 0; i < combos.length; i++) {
      const cp = { ...base, ...combos[i] };
      const ts = now();
      try {
        const r = await runBacktest(wsId, period || "5y", cp);
        const s = r?.stats || {};
        const raw = Number(s[metric]);
        results.push({ params: combos[i], stats: s, score: Number.isFinite(raw) ? raw : null, equity: r?.equity_curve || null, ms: now() - ts });
      } catch (e) {
        results.push({ params: combos[i], stats: { error: e?.response?.data?.error || e.message }, score: null, equity: null, ms: now() - ts });
      }
      sumMs += results[i].ms || 0;
      setOptProgress({ done: i + 1, total: combos.length });
    }
    const totalMs = now() - t0;
    const valid = results.filter(r => r.score != null);
    // 제약 조건(다중·임의 지표) 만족 조합만 best 후보로(만족 조합이 있을 때만 적용)
    let pool = valid;
    const consList = Array.isArray(constraints) && constraints.length ? constraints
      : (constraint?.max_drawdown_pct != null ? [{ metric:"max_drawdown_pct", op:"<=", value:constraint.max_drawdown_pct }] : []);
    if (consList.length) {
      const passes = (r) => consList.every(c => {
        const raw = r.stats?.[c.metric];
        if (raw == null || !Number.isFinite(Number(raw))) return true; // 값 없으면 관대하게 통과
        const v = c.metric === "max_drawdown_pct" ? Math.abs(Number(raw)) : Number(raw);
        return c.op === "<=" ? v <= c.value : v >= c.value;
      });
      const ok = valid.filter(passes);
      if (ok.length) pool = ok;
    }
    const best = pool.length
      ? pool.reduce((a, b) => (metric === "max_drawdown_pct" ? (a.score <= b.score ? a : b) : (a.score >= b.score ? a : b)))
      : null;
    // 결과가 전부 동일한지(스윕 파라미터가 전략에 영향 없음 — 예: 무한매수가 SMA 파라미터 미사용) 판정
    const uniqScores = new Set(valid.map(r => Math.round(r.score * 1e6)));
    const flat = valid.length > 1 && uniqScores.size === 1;
    // 최적 파라미터로 풀 백테스트(에쿼티 커브 + 전체 스탯) 1회 더 실행 → 결과 대시보드 하단에 표시
    let bestFull = null;
    if (best) {
      try { bestFull = await runBacktest(wsId, period || "5y", { ...base, ...best.params }); } catch { /* keep null */ }
    }
    const validCount = valid.length;
    const NODE_RATE = { O2:0.15, O4:0.30, O8:0.60 }[nodeTier] || 0.30; // $/hour (QC식 요율)
    const consumed = +(NODE_RATE * (totalMs / 3600000)).toFixed(4);     // 노드 요율 × 런타임(시간)
    const runtime = { totalMs, avgMs: combos.length ? sumMs / combos.length : 0, completed: validCount, failed: combos.length - validCount, total: combos.length, consumed, nodeTier: nodeTier || "O4" };
    setOptResults({ metric, metricLabel, p1: p1.name, p2: p2?.name || null, a1, a2: p2 ? a2 : null, combos: results, best, flat, bestFull, runtime, period: period || "5y", constraints: consList, base });
    setOptBusy(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optBusy, wsId, openTabs, activeTabId, fileContents]);

  // 최적화 결과의 best 파라미터를 코드에 적용
  const applyOptParams = useCallback((paramsObj) => {
    setFileContents(prev => {
      let code = prev.main || "";
      const MAP = { sma_fast:"SMA_FAST", sma_slow:"SMA_SLOW", rsi_period:"RSI_PERIOD", rsi_low:"RSI_LOW", rsi_high:"RSI_HIGH", macd_fast:"MACD_FAST", macd_slow:"MACD_SLOW", macd_signal:"MACD_SIGNAL", vix_threshold:"VIX_THRESHOLD", split:"SPLIT", take_profit_pct:"TAKE_PROFIT_PCT", loc_offset_pct:"LOC_OFFSET_PCT", rebalance_days:"REBALANCE_DAYS", expected_return:"EXPECTED_RETURN", band_pct:"BAND_PCT", pool_target_pct:"POOL_TARGET_PCT", initial_pool_pct:"INITIAL_POOL_PCT" };
      for (const [k, v] of Object.entries(paramsObj)) {
        const CONST = MAP[k]; if (!CONST) continue;
        code = code.replace(new RegExp(`^(\\s*${CONST}\\s*=\\s*)[\\d.]+`, "m"), `$1${v}`);
      }
      const next = { ...prev, main: code };
      if (wsId) saveCode(wsId, JSON.stringify(next)).catch(()=>{});
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  // 최적화 결과 표에서 조합 행 클릭 → 그 파라미터로 풀 백테스트 1회 실행 → 인라인 리포트
  const handleOpenCombo = useCallback(async (comboParams) => {
    if (!wsId || !optResults) return;
    setOptComboFull({ loading: true, params: comboParams });
    try {
      const base = optResults.base || parseParamsFromCode(fileContents.main || "");
      const full = await runBacktest(wsId, optResults.period || "5y", { ...base, ...comboParams });
      setOptComboFull({ loading: false, params: comboParams, result: full });
    } catch (e) {
      setOptComboFull({ loading: false, params: comboParams, error: e?.response?.data?.error || e.message });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, optResults, fileContents]);

  const activeTab = openTabs.find(t=>t.id===activeTabId);
  // 우측 Claude 도크 너비 드래그 리사이즈 (왼쪽으로 끌면 넓어짐)
  const handleClaudeDockResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = claudeDockW;
    const onMove = (ev) => setClaudeDockW(Math.max(260, Math.min(680, startW + (startX - ev.clientX))));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  }, [claudeDockW]);

  // 입력창 세로 높이 드래그 (위로 끌면 커짐)
  const handleClaudeInputResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = claudeInputH;
    const onMove = (ev) => setClaudeInputH(Math.max(40, Math.min(380, startH + (startY - ev.clientY))));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
  }, [claudeInputH]);

  // 하단 콘솔/터미널 패널 높이 드래그 리사이즈 (위로 끌면 커짐)
  const handleBottomResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomH;
    const onMove = (ev) => setBottomH(Math.max(90, Math.min(720, startH + (startY - ev.clientY))));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
  }, [bottomH]);

  const logColor = {info:"#9CA3AF",trade:"#60a5fa",warn:"#F59E0B",success:"#10B981",error:"#EF4444"};

  return (
    <div style={{
      height: "calc(100vh / var(--app-zoom, 1.1) - var(--alpha-top-h, 44px))", display:"flex", flexDirection:"column",
      background:"#0f1117", fontFamily:"'Inter',-apple-system,sans-serif", overflow:"hidden",
    }}>

      {/* ═══ 헤더바 ═══════════════════════════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"0 14px",
        height:44, flexShrink:0, background:"#161b22",
        borderBottom:"1px solid rgba(255,255,255,0.08)",
      }}>
        <Code2 size={14} color="#60a5fa" style={{flexShrink:0}}/>
        {/* 사이드바 접기/펼치기 토글 */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("alpha:toggle-sidebar"))}
          title={sidebarExpanded ? "사이드바 접기" : "사이드바 펼치기"}
          style={{display:"flex",alignItems:"center",justifyContent:"center",width:26,height:26,
            borderRadius:5,border:"none",background:"transparent",cursor:"pointer",
            color:"rgba(255,255,255,0.5)",flexShrink:0,padding:0}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.color="white";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>
          <PanelLeftOpen size={14} style={{transform: sidebarExpanded ? "scaleX(-1)" : "scaleX(1)", transition:"transform 0.2s"}}/>
        </button>
        <div ref={wsDropdownRef} style={{position:"relative",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"white",
              maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {strategyName}
          </span>
          {wsList.length > 1 && (
            <button onClick={() => setWsDropdownOpen(o => !o)} title="전략 전환"
              style={{display:"flex",alignItems:"center",padding:"2px 4px",borderRadius:4,
                background:"transparent",border:"1px solid rgba(255,255,255,0.12)",
                color:"#9CA3AF",cursor:"pointer",flexShrink:0}}>
              <ChevronDown size={12} color={wsDropdownOpen ? "#60a5fa" : "#9CA3AF"} />
            </button>
          )}
          {wsDropdownOpen && (
            <div style={{
              position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200,
              background:"#1e2433",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:8,padding:4,minWidth:200,
              boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {wsList.map(ws => (
                <button key={ws.id}
                  onClick={() => { loadWorkspace(ws.id); setWsDropdownOpen(false); }}
                  style={{
                    display:"block",width:"100%",textAlign:"left",
                    padding:"7px 10px",borderRadius:5,border:"none",
                    background: ws.id === wsId ? "rgba(96,165,250,0.15)" : "transparent",
                    color: ws.id === wsId ? "#60a5fa" : "#D1D5DB",
                    fontSize:12,fontWeight: ws.id === wsId ? 700 : 400,cursor:"pointer",
                  }}
                  onMouseEnter={e => { if (ws.id !== wsId) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (ws.id !== wsId) e.currentTarget.style.background = "transparent"; }}
                >
                  {ws.name || `전략 #${ws.id}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <span style={{fontSize:9,padding:"1px 7px",borderRadius:999,
          background:"rgba(99,102,241,0.2)",color:"#a5b4fc",fontWeight:700,flexShrink:0}}>
          Expert Mode
        </span>
        {runStatus==="done"&&(
          <span style={{fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:999,
            background:"rgba(16,185,129,0.15)",color:"#10B981"}}>백테스트 완료</span>
        )}
        {runStatus==="running"&&(
          <span style={{fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:999,
            background:"rgba(245,158,11,0.15)",color:"#F59E0B",display:"flex",alignItems:"center",gap:3}}>
            <Loader size={9} style={{animation:"spin 1s linear infinite"}}/>실행 중</span>
        )}
        <div style={{flex:1}}/>
        {queueMsg && (
          <span style={{fontSize:10,padding:"2px 9px",borderRadius:999,
            background:"rgba(16,185,129,0.15)",color:"#10B981",fontWeight:600}}>{queueMsg}</span>
        )}
        <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"monospace"}}>{activeTab?.name||""}</span>
        <button onClick={() => setClaudeOpen(o => !o)} title="Claude Code 에이전트로 코드 편집"
          style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:5,
            background: claudeOpen ? "rgba(217,119,87,0.16)" : "transparent",
            border:"1px solid rgba(217,119,87,0.4)",color:"#d97757",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          <ClaudePixelMascot size={16} /> Claude
        </button>
        <button onClick={handleSave}
          style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:5,
            background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
            color:"rgba(255,255,255,0.88)",fontSize:12,fontWeight:600,cursor:"pointer"}}>
          <Save size={10}/> 저장
        </button>
        <button onClick={handleQueueOrders} disabled={!btResult}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:btResult?"linear-gradient(135deg,#7c3aed,#4f46e5)":"rgba(109,40,217,0.15)",
            border:"none",color:btResult?"white":"#6B7280",fontSize:12,fontWeight:700,
            cursor:btResult?"pointer":"not-allowed",
            boxShadow:btResult?"0 2px 8px rgba(109,40,217,0.35)":"none"}}>
          <ShoppingCart size={11}/> 주문 큐
        </button>
        {/* 백테스트 엔진 셀렉터 (vectorbt | Lean·QC) */}
        <div ref={engineMenuRef} style={{position:"relative",flexShrink:0}}>
          <button onClick={()=>setEngineMenuOpen(o=>!o)} title="백테스트 엔진 선택"
            style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",borderRadius:6,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.12)",
              color:"#cbd5e1",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            <Boxes size={12} color={engine==="lean"?"#a78bfa":"#60a5fa"}/>
            {engine==="lean" ? "Lean · QC" : "vectorbt"}
            <ChevronDown size={11} color={engineMenuOpen?"#60a5fa":"#6B7280"}/>
          </button>
          {engineMenuOpen && (
            <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:300,
              background:"#1e2433",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,
              padding:5,minWidth:236,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
              <div style={{fontSize:9,color:"#6B7280",fontWeight:700,padding:"3px 8px 5px"}}>백테스트 엔진</div>
              <button onClick={()=>{setEngine("vectorbt");setEngineMenuOpen(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"6px 8px",borderRadius:6,
                  border:"none",marginBottom:2,cursor:"pointer",
                  background:engine==="vectorbt"?"rgba(96,165,250,0.12)":"transparent"}}>
                <div style={{fontSize:11,fontWeight:700,color:engine==="vectorbt"?"#cbd5e1":"#9CA3AF"}}>vectorbt <span style={{fontSize:9,color:"#10B981"}}>· 빠름</span></div>
                <div style={{fontSize:9,color:"#6B7280"}}>Docker 불필요 · 즉시 실행</div>
              </button>
              <button onClick={()=>{setEngine("lean");setEngineMenuOpen(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"6px 8px",borderRadius:6,
                  border:"none",cursor:"pointer",
                  background:engine==="lean"?"rgba(167,139,250,0.12)":"transparent"}}>
                <div style={{fontSize:11,fontWeight:700,color:engine==="lean"?"#cbd5e1":"#9CA3AF"}}>Lean · QuantConnect <span style={{fontSize:9,color:"#a78bfa"}}>· 정밀</span></div>
                <div style={{fontSize:9,color:"#6B7280"}}>실제 체결 시뮬 · Docker 필요</div>
              </button>
              {engine==="lean" && leanHealth && (
                <div style={{margin:"5px 2px 2px",padding:"6px 8px",borderRadius:6,background:"rgba(255,255,255,0.03)"}}>
                  <div style={{fontSize:9,color:"#6B7280",fontWeight:700,marginBottom:5}}>실행 환경</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {[["활성",leanHealth.enabled],["Docker",leanHealth.docker],["lean CLI",leanHealth.lean_cli],["이미지",leanHealth.image]].map(([label,ok]) => (
                      <span key={label} style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:999,
                        background: ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
                        color: ok ? "#10B981" : "#EF4444"}}>{ok ? "✓" : "✗"} {label}</span>
                    ))}
                  </div>
                  {!leanHealth.ready && (
                    <div style={{fontSize:9,color:"#F59E0B",marginTop:6,lineHeight:1.5}}>
                      {leanHealth.analytics === false ? "analytics 사이드카 연결 불가 · " : ""}
                      {leanHealth.enabled === false ? "app.lean.enabled=true 필요 · " : ""}
                      {leanHealth.docker === false ? "Docker Desktop 실행 필요 · " : ""}
                      {leanHealth.docker && leanHealth.image === false ? `docker pull ${leanHealth.image_name || "quantconnect/lean:latest"} · ` : ""}
                      {leanHealth.lean_cli === false ? "pip install lean · " : ""}
                      준비 후 Lean 실행 가능
                    </div>
                  )}
                </div>
              )}
              {engine==="lean" && leanStrategies.length>0 && (
                <>
                  <div style={{height:1,background:"rgba(255,255,255,0.08)",margin:"5px 0"}}/>
                  <div style={{fontSize:9,color:"#6B7280",fontWeight:700,padding:"2px 8px 4px"}}>Lean 전략</div>
                  <div style={{maxHeight:172,overflow:"auto"}}>
                    {leanStrategies.map(s => (
                      <button key={s.id} onClick={()=>{setLeanStrategyId(s.id);setEngineMenuOpen(false);}}
                        style={{display:"flex",alignItems:"baseline",gap:6,width:"100%",textAlign:"left",
                          padding:"5px 8px",borderRadius:5,border:"none",cursor:"pointer",
                          background:s.id===leanStrategyId?"rgba(167,139,250,0.15)":"transparent"}}>
                        <span style={{fontSize:11,fontWeight:s.id===leanStrategyId?700:400,color:s.id===leanStrategyId?"#a78bfa":"#D1D5DB"}}>{s.name || s.id}</span>
                        <span style={{fontSize:9,color:"#4B5563",fontFamily:"monospace"}}>{s.id}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {/* Claude — Run Backtest 바로 왼쪽 */}
        <button onClick={() => setClaudeOpen(o => !o)} title="Claude Code 에이전트로 코드 편집"
          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:6,
            background: claudeOpen
              ? "linear-gradient(135deg,#ea580c,#f97316,#fb923c)"
              : "linear-gradient(135deg,#c2410c,#ea580c,#f97316)",
            border:"none",color:"white",fontSize:12,fontWeight:700,cursor:"pointer",
            boxShadow: claudeOpen ? "0 2px 12px rgba(249,115,22,0.65)" : "0 2px 8px rgba(234,88,12,0.45)",
            transition:"background 0.18s,box-shadow 0.18s"}}
          onMouseEnter={e=>{
            e.currentTarget.style.background="linear-gradient(135deg,#9a3412,#c2410c,#ea580c)";
            e.currentTarget.style.boxShadow="0 3px 14px rgba(194,65,12,0.7)";
          }}
          onMouseLeave={e=>{
            e.currentTarget.style.background=claudeOpen
              ?"linear-gradient(135deg,#ea580c,#f97316,#fb923c)"
              :"linear-gradient(135deg,#c2410c,#ea580c,#f97316)";
            e.currentTarget.style.boxShadow=claudeOpen?"0 2px 12px rgba(249,115,22,0.65)":"0 2px 8px rgba(234,88,12,0.45)";
          }}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:18,height:18,borderRadius:4,background:"rgba(0,0,0,0.28)",flexShrink:0}}>
            <img src={claudeBotImg} alt="Claude" style={{width:13,height:13,objectFit:"contain"}} />
          </span>
          Claude
        </button>
        <button onClick={engine==="lean" ? handleRunLean : handleRunBacktest} disabled={runStatus==="running"}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:runStatus==="running"?"rgba(96,165,250,0.12)":(engine==="lean"?"linear-gradient(135deg,#7c3aed,#6d28d9)":"linear-gradient(135deg,#1d4ed8,#2563eb)"),
            border:"none",color:"white",fontSize:12,fontWeight:700,
            cursor:runStatus==="running"?"wait":"pointer",
            boxShadow:runStatus==="running"?"none":(engine==="lean"?"0 2px 8px rgba(124,58,237,0.35)":"0 2px 8px rgba(37,99,235,0.35)")}}>
          {runStatus==="running"
            ?<><Loader size={11} style={{animation:"spin 1s linear infinite"}}/>실행 중…</>
            :<><Play size={11}/>{engine==="lean" ? "Run Lean" : "Run Backtest"}</>}
        </button>
        <button onClick={handleOpenOptimize} disabled={optBusy}
          title="파라미터 그리드 백테스트로 견고성·민감도 최적화"
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:optBusy?"rgba(34,197,94,0.18)":"linear-gradient(135deg,#15803d,#16a34a,#22c55e)",border:"none",
            color:"white",fontSize:12,fontWeight:700,cursor:optBusy?"wait":"pointer",
            boxShadow:optBusy?"none":"0 2px 8px rgba(34,197,94,0.35)",
            transition:"background 0.18s,box-shadow 0.18s"}}
          onMouseEnter={e=>{ if(!optBusy){ e.currentTarget.style.background="linear-gradient(135deg,#14532d,#15803d,#16a34a)"; e.currentTarget.style.boxShadow="0 3px 12px rgba(22,163,74,0.55)"; }}}
          onMouseLeave={e=>{ if(!optBusy){ e.currentTarget.style.background="linear-gradient(135deg,#15803d,#16a34a,#22c55e)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(34,197,94,0.35)"; }}}>
          {optBusy ? <Loader size={11} style={{animation:"spin 1s linear infinite"}}/> : <Lightbulb size={11}/>}
          최적화 개선
        </button>
        <button onClick={handleDeploy}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",
            color:"white",fontSize:12,fontWeight:700,cursor:"pointer",
            boxShadow:"0 2px 8px rgba(109,40,217,0.35)"}}>
          <Rocket size={11}/>Deploy to Live
        </button>
      </div>

      {/* Claude 에이전트 입력 → 우측 도크로 이동 (바디 내부 마지막 컬럼) */}

      {/* ═══ 바디 ════════════════════════════════════════════════════════════ */}
      <div style={{flex:1, minHeight:0, display:"flex", overflow:"hidden"}}>

        {/* ── Activity Bar ─────────────────────────────────────────────────── */}
        <div style={{
          width:actBarW, flexShrink:0, background:"#161b22",
          borderRight:"1px solid rgba(255,255,255,0.06)",
          display:"flex", flexDirection:"column", alignItems:"center",
          paddingTop:6, gap:2, position:"relative",
        }}>
          {/* 가로 리사이즈 핸들 */}
          <div onMouseDown={handleActResizeMouseDown}
            style={{position:"absolute",top:0,right:0,width:8,height:"100%",cursor:"col-resize",zIndex:10,
              display:"flex",alignItems:"center",justifyContent:"center",background:"transparent"}}
            onMouseEnter={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.45)";}}
            onMouseLeave={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.15)";}}>
            <div style={{width:3,height:32,borderRadius:2,background:"rgba(255,255,255,0.15)",transition:"background 0.15s"}}/>
          </div>
          {[
            { icon:<Boxes size={24}/>,      title:"워크스페이스",   tutId:"tutorial-dev-workspace", act: sidePanel==="workspace", fn: ()=>setSidePanel(p=>p==="workspace"?null:"workspace") },
            { icon:<FolderOpen size={24}/>, title:"파일 탐색기",   tutId:"tutorial-dev-explorer", act: sidePanel==="explorer", fn: ()=>setSidePanel(p=>p==="explorer"?null:"explorer") },
            { icon:<FileCode size={24}/>,   title:"코드만 보기",   tutId:"tutorial-dev-code",     act: sidePanel===null,        fn: ()=>setSidePanel(null) },
            { icon:<Database size={24}/>,   title:"데이터 탐색기", tutId:"tutorial-dev-data",     act: sidePanel==="data",     fn: ()=>setSidePanel(p=>p==="data"?null:"data") },
            { icon:<GitBranch size={24}/>,  title:"GitHub 연결",   tutId:"tutorial-dev-git",      act: sidePanel==="git",      fn: ()=>setSidePanel(p=>p==="git"?null:"git") },
            { icon:<BarChart3 size={24}/>,  title:"백테스트 결과", tutId:"tutorial-dev-report",   act: openTabs.some(t=>t.type==="report")&&activeTab?.type==="report",
              fn: ()=>{ const t=openTabs.find(tt=>tt.type==="report"); if(t) setActiveTabId(t.id); else handleRunBacktest(); } },
            { icon:<Terminal size={24}/>,   title:"LEAN 엔진 / 콘솔", tutId:"tutorial-dev-console", act: sidePanel==="engine", fn: ()=>setSidePanel(p=>p==="engine"?null:"engine") },
          ].map((b,i)=>(
            <button key={i} title={b.title} onClick={b.fn} data-tutorial-id={b.tutId || undefined} style={{
              width:"100%", height:44, borderRadius:6, border:"none",
              background: b.act ? "rgba(96,165,250,0.16)" : "transparent",
              color: b.act ? "#60a5fa" : "#9CA3AF",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              transition:"color 0.12s, background 0.12s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#E5E7EB"; e.currentTarget.style.background="rgba(255,255,255,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.color=b.act?"#60a5fa":"#9CA3AF"; e.currentTarget.style.background=b.act?"rgba(96,165,250,0.16)":"transparent";}}
            >{b.icon}</button>
          ))}
          <div style={{flex:1}}/>
          <div style={{width:28, height:1, background:"rgba(0,122,204,0.4)", margin:"4px auto"}}/>
          <button
            title="IDE AI 어시스턴트 CLI 설정"
            onClick={() => setIdeSettingsOpen(true)}
            style={{
              width:"100%", height:44, borderRadius:6, border:"none",
              background: ideSettingsOpen ? "rgba(0,122,204,0.22)" : "transparent",
              color: ideSettingsOpen ? "#60AAFF" : "#4B7FC4",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              transition:"color 0.12s, background 0.12s",
              marginBottom:6,
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#93C5FD"; e.currentTarget.style.background="rgba(0,122,204,0.20)";}}
            onMouseLeave={e=>{e.currentTarget.style.color=ideSettingsOpen?"#60AAFF":"#4B7FC4"; e.currentTarget.style.background=ideSettingsOpen?"rgba(0,122,204,0.22)":"transparent";}}
          >
            <Settings size={22}/>
          </button>
        </div>

        {/* ── Side Panel ───────────────────────────────────────────────────── */}
        {sidePanel && (
          <div style={{
            width:sidePanelW, flexShrink:0, background:"#1a1f2a",
            borderRight:"1px solid rgba(255,255,255,0.06)",
            display:"flex", flexDirection:"column", overflow:"hidden",
            position:"relative",
          }}>
            <div ref={sideDragRef} onMouseDown={handleSideResizeMouseDown}
              style={{position:"absolute",top:0,right:0,width:8,height:"100%",cursor:"col-resize",zIndex:10,
                display:"flex",alignItems:"center",justifyContent:"center",background:"transparent"}}
              onMouseEnter={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.45)";}}
              onMouseLeave={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.15)";}}>
              <div style={{width:3,height:32,borderRadius:2,background:"rgba(255,255,255,0.15)",transition:"background 0.15s"}}/>
            </div>

            {sidePanel!=="git" && (
              <div style={{
                padding:"6px 8px 6px 12px", fontSize:9, fontWeight:700, color:"#CBD5E1",
                letterSpacing:"0.08em", textTransform:"uppercase", flexShrink:0,
                borderBottom:"1px solid rgba(255,255,255,0.05)",
                display:"flex", alignItems:"center",
              }}>
                <span style={{flex:1}}>
                  {sidePanel==="workspace" ? "워크스페이스"
                    : sidePanel==="engine" ? "LEAN 엔진"
                    : sidePanel==="explorer" ? (repoTree ? "레포지토리" : "탐색기")
                    : "데이터 브라우저"}
                </span>
                {sidePanel==="explorer" && repoTree && (
                  <>
                    <button
                      onClick={() => setNewFileTrigger({ type:'file', parentPath: selectedPath && !repoFiles.find(f=>f.path===selectedPath) ? selectedPath : (selectedPath?.includes('/') ? selectedPath.split('/').slice(0,-1).join('/') : '') })}
                      title="새 파일"
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"center",
                        width:20, height:20, borderRadius:4, border:"none",
                        background:"transparent", color:"#4B5563", cursor:"pointer",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background="rgba(96,165,250,0.15)"; e.currentTarget.style.color="#60a5fa"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#4B5563"; }}
                    >
                      <FilePlus size={13}/>
                    </button>
                    <button
                      onClick={() => setNewFileTrigger({ type:'folder', parentPath: selectedPath && !repoFiles.find(f=>f.path===selectedPath) ? selectedPath : (selectedPath?.includes('/') ? selectedPath.split('/').slice(0,-1).join('/') : '') })}
                      title="새 폴더"
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"center",
                        width:20, height:20, borderRadius:4, border:"none",
                        background:"transparent", color:"#4B5563", cursor:"pointer",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background="rgba(96,165,250,0.15)"; e.currentTarget.style.color="#60a5fa"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#4B5563"; }}
                    >
                      <FolderPlus size={13}/>
                    </button>
                  </>
                )}
              </div>
            )}

            <div ref={sidePanelScrollRef} className="dark-scroll" style={{flex:1, overflow:"auto", display:sidePanel==="git"?"flex":"block", flexDirection:"column"}}>

              {/* ── Workspace ── */}
              {sidePanel==="workspace" && (
                <div>
                  <div style={{padding:"8px 10px"}}>
                    <button onClick={handleAddWorkspace}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,width:"100%",
                        padding:"7px 10px",borderRadius:7,border:"1px dashed rgba(96,165,250,0.5)",
                        background:"rgba(96,165,250,0.08)",color:"#93c5fd",fontSize:11.5,fontWeight:700,cursor:"pointer"}}>
                      <Plus size={13}/> 새 워크스페이스
                    </button>
                  </div>
                  {wsList.length===0 && (
                    <div style={{padding:"4px 14px 10px", fontSize:11, color:"#94A3B8", lineHeight:1.5}}>
                      워크스페이스가 없습니다.<br/>위 버튼으로 추가하세요.
                    </div>
                  )}
                  {wsList.map(w => {
                    const isCur = String(w.id) === String(wsId);
                    return (
                      <div key={w.id}>
                        <div onClick={()=>{ if(!isCur) handleSwitchWorkspace(w.id); }}
                          style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",
                            cursor:isCur?"default":"pointer",userSelect:"none",
                            background:isCur?"rgba(96,165,250,0.12)":"transparent",
                            color:isCur?"#e2e8f0":"#CBD5E1",fontSize:12,fontWeight:isCur?700:500}}
                          onMouseEnter={e=>{ if(!isCur) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e=>{ if(!isCur) e.currentTarget.style.background="transparent"; }}>
                          {isCur?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                          <Boxes size={13} color={isCur?"#60a5fa":"#64748B"} style={{flexShrink:0}}/>
                          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.name || `전략 #${w.id}`}</span>
                        </div>
                        {isCur && (wsCandidates.length>0 ? wsCandidates.map(c=>{
                          const sel = c.id === wsSelectedId;
                          const label = c.strategy_name || c.strategy_type || c.id;
                          return (
                            <div key={c.id} onClick={()=>handleSelectCandidate(c.id)}
                              title={c.description || label}
                              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px 5px 28px",cursor:"pointer",
                                background:sel?"rgba(124,58,237,0.14)":"transparent",
                                color:sel?"#c4b5fd":"#94A3B8",fontSize:11.5,fontWeight:sel?700:500}}
                              onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                              onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background="transparent"; }}>
                              <FileCode size={12} color={sel?"#a78bfa":"#64748B"} style={{flexShrink:0}}/>
                              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}{c.risk_tone?` · ${c.risk_tone}`:""}</span>
                              {wsSwitchBusy && sel ? <Loader size={11} style={{animation:"spin 1s linear infinite"}}/> : (sel && <CheckCircle2 size={12} color="#a78bfa"/>)}
                            </div>
                          );
                        }) : (
                          <div style={{padding:"4px 8px 6px 28px", fontSize:10.5, color:"#64748B", lineHeight:1.5}}>
                            전략 후보 없음 — 전략 카드 탭에서<br/>Goal → Strategy 로 생성하세요.
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── LEAN Engine ── */}
              {sidePanel==="engine" && (
                <div style={{padding:"4px 0"}}>
                  <div style={{padding:"6px 12px 4px", fontSize:10, color:"#94A3B8", fontWeight:700}}>백테스트 엔진</div>
                  {[["vectorbt","vectorbt","빠른 벡터 시뮬레이션 (기본·py엔진)"],["lean","Lean (QuantConnect)","정밀 이벤트 기반 · Docker 필요"]].map(([val,label,desc])=>{
                    const on = engine===val;
                    const accent = val==="lean" ? "#a78bfa" : "#60a5fa";
                    return (
                      <div key={val} onClick={()=>setEngine(val)}
                        style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 12px",cursor:"pointer",
                          background:on?(val==="lean"?"rgba(167,139,250,0.12)":"rgba(96,165,250,0.12)"):"transparent"}}
                        onMouseEnter={e=>{ if(!on) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e=>{ if(!on) e.currentTarget.style.background="transparent"; }}>
                        <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${on?accent:"#475569"}`,marginTop:1,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {on && <div style={{width:6,height:6,borderRadius:"50%",background:accent}}/>}
                        </div>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:on?700:500,color:on?"#e2e8f0":"#CBD5E1"}}>{label}</div>
                          <div style={{fontSize:10,color:"#64748B",marginTop:2,lineHeight:1.4}}>{desc}</div>
                        </div>
                      </div>
                    );
                  })}

                  {/* ── 실행 위치 (로컬 자가호스팅 / 클라우드 관리형) ── */}
                  <div style={{padding:"10px 12px 4px", fontSize:10, color:"#94A3B8", fontWeight:700}}>실행 위치 (Execution)</div>
                  {[
                    ["cloud","☁️ 클라우드 (관리형)","우리 서버가 실행 — 노트북 성능 무관 · Lean·대규모 최적화·자동 백테스트","PREMIUM","#a78bfa"],
                    ["local","💻 로컬 (자가호스팅)","내 환경의 analytics/Docker 에서 실행 · 개발자·셀프호스트","STANDARD","#60a5fa"],
                  ].map(([val,label,desc,plan,accent])=>{
                    const on = execLoc===val;
                    const locked = val==="cloud" && !cloudAllowed;
                    return (
                      <div key={val} onClick={()=>{ if(locked){ alert("클라우드 관리형 컴퓨트는 PREMIUM 구독에서 사용할 수 있습니다.\n노트북 성능과 무관하게 우리 서버가 Lean·대규모 최적화·자동 백테스트를 실행합니다. (로컬 엔진은 STANDARD 에서 본인 환경으로 실행)"); return; } setExecLoc(val); }}
                        style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 12px",cursor:locked?"not-allowed":"pointer",opacity:locked?0.6:1,
                          background:on?"rgba(167,139,250,0.10)":"transparent"}}
                        onMouseEnter={e=>{ if(!on&&!locked) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e=>{ if(!on) e.currentTarget.style.background="transparent"; }}>
                        <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${on?accent:"#475569"}`,marginTop:1,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {on && <div style={{width:6,height:6,borderRadius:"50%",background:accent}}/>}
                        </div>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:12,fontWeight:on?700:500,color:on?"#e2e8f0":"#CBD5E1"}}>{label}</span>
                            <span style={{fontSize:8.5,fontWeight:700,padding:"1px 6px",borderRadius:999,background:plan==="PREMIUM"?"rgba(167,139,250,0.18)":"rgba(96,165,250,0.15)",color:plan==="PREMIUM"?"#c4b5fd":"#93c5fd"}}>{plan}{plan==="PREMIUM"?"":"+"}</span>
                            {locked && <span style={{fontSize:9,color:"#fbbf24"}}>🔒 업그레이드</span>}
                          </div>
                          <div style={{fontSize:10,color:"#64748B",marginTop:2,lineHeight:1.4}}>{desc}</div>
                        </div>
                      </div>
                    );
                  })}
                  {execLoc==="cloud" && (
                    <div style={{margin:"4px 12px 0",fontSize:9.5,color:"#a5b4fc",lineHeight:1.5}}>현재 {userTier||"…"} · 백테스트는 항상 우리 분석 서버에서 실행됩니다(브라우저 아님).</div>
                  )}

                  {engine==="lean" && (
                    <div style={{margin:"8px 12px 6px",padding:"10px",borderRadius:8,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(167,139,250,0.18)"}}>
                      {/* LEAN ENGINE 헤더 */}
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                        <span style={{fontSize:10,color:"#a78bfa",fontWeight:800,letterSpacing:"0.08em"}}>⇌ LEAN ENGINE</span>
                      </div>
                      {/* 채널 드롭다운 (QC의 master v17731 드롭다운) */}
                      <select value={leanChannel} onChange={e=>setLeanChannel(e.target.value)}
                        style={{width:"100%",background:"#0d1117",border:"1px solid rgba(167,139,250,0.35)",
                          borderRadius:5,color:"#c4b5fd",fontSize:11,padding:"5px 7px",marginBottom:7,cursor:"pointer"}}>
                        <option value="master">master (최신 안정)</option>
                        <option value="foundation">foundation (LTS)</option>
                      </select>
                      {/* 버전 번호 표시 */}
                      <div style={{fontSize:10,color:"#94a3b8",marginBottom:7,fontFamily:"monospace"}}>
                        {leanHealth?.version?.build && leanHealth.version.build !== "latest"
                          ? `${leanChannel} v${leanHealth.version.build}`
                          : `${leanChannel} (latest)`}
                        {" · "}<span style={{color:"#64748b"}}>{leanHealth?.image_name || "quantconnect/lean:latest"}</span>
                      </div>
                      {/* Always use Master Branch 체크박스 */}
                      <label style={{display:"flex",alignItems:"center",gap:6,fontSize:10.5,cursor:"pointer",color:"#94a3b8",marginBottom:8}}>
                        <input type="checkbox" checked={leanChannel==="master"}
                          onChange={e=>setLeanChannel(e.target.checked?"master":"foundation")}
                          style={{accentColor:"#a78bfa",width:12,height:12}}/>
                        항상 Master Branch 사용
                      </label>
                      {/* 환경 상태 칩 */}
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {[["Docker",leanHealth?.docker],["CLI",leanHealth?.lean_cli],["이미지",leanHealth?.image],["준비",leanHealth?.ready]].map(([l,ok])=>(
                          <span key={l} style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:999,
                            background:ok?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.12)",color:ok?"#4ade80":"#f87171"}}>{ok?"✓":"✕"} {l}</span>
                        ))}
                      </div>
                      {!leanHealth?.ready && <div style={{fontSize:10,color:"#fbbf24",marginTop:7,lineHeight:1.6}}>Lean 미준비 — Docker + analytics venv 의 lean CLI 설치가 필요합니다.</div>}
                    </div>
                  )}
                  {engine==="lean" && leanStrategies.length>0 && (
                    <>
                      <div style={{padding:"4px 12px", fontSize:10, color:"#94A3B8", fontWeight:700}}>Lean 전략 프리셋</div>
                      {leanStrategies.map(s=>(
                        <div key={s.id} onClick={()=>setLeanStrategyId(s.id)}
                          style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px 5px 16px",cursor:"pointer",
                            background:s.id===leanStrategyId?"rgba(167,139,250,0.12)":"transparent",
                            color:s.id===leanStrategyId?"#c4b5fd":"#94A3B8",fontSize:11.5,fontWeight:s.id===leanStrategyId?700:500}}
                          onMouseEnter={e=>{ if(s.id!==leanStrategyId) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e=>{ if(s.id!==leanStrategyId) e.currentTarget.style.background="transparent"; }}>
                          <Boxes size={12} color={s.id===leanStrategyId?"#a78bfa":"#64748B"} style={{flexShrink:0}}/>
                          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name||s.id}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{padding:"8px 12px", fontSize:10, color:"#64748B", lineHeight:1.5, borderTop:"1px solid rgba(255,255,255,0.05)", marginTop:6}}>
                    💡 콘솔/터미널 실행 로그는 하단 <b style={{color:"#94A3B8"}}>CONSOLE</b>·<b style={{color:"#94A3B8"}}>TERMINAL</b> 탭에서 확인하세요.
                  </div>
                </div>
              )}

              {/* ── Explorer ── */}
              {sidePanel==="explorer" && (
                <div>
                  {repoTree ? (
                    <RepoExplorer
                      repoFiles={repoFiles}
                      modifiedFiles={modifiedFiles}
                      deletedFiles={deletedFiles}
                      localFolders={localFolders}
                      onOpenFile={openRepoFile}
                      activeFilePath={activeTab?.filePath}
                      fetchingFile={fetchingFile}
                      onCreate={handleRepoCreate}
                      onDelete={handleRepoDelete}
                      onRename={handleRepoRename}
                      triggerNew={newFileTrigger}
                      onTriggerNewDone={() => setNewFileTrigger(null)}
                      selectedPath={selectedPath}
                      onSelect={setSelectedPath}
                    />
                  ) : (
                    /* 워크스페이스 기본 — 선택 전략의 실행/백테스트/최적화 */
                    <>
                      <div onClick={()=>setFolderOpen(v=>!v)}
                        style={{display:"flex",alignItems:"center",gap:4,
                          padding:"5px 8px",cursor:"pointer",userSelect:"none",
                          color:"#F1F5F9",fontSize:11,fontWeight:700}}>
                        {folderOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                        <FolderOpen size={12} color="#60a5fa" style={{flexShrink:0}}/>
                        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{strategyName || "MY_STRATEGY"}</span>
                      </div>
                      {folderOpen && (
                        <>
                          <div style={{padding:"4px 8px 2px 26px", fontSize:9, color:"#64748B", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em"}}>실행</div>
                          {Object.entries(FILE_META).map(([key,meta])=>(
                            <div key={key} onClick={()=>openFile(key)}
                              style={{display:"flex", alignItems:"center", gap:6, padding:"4px 8px 4px 30px", cursor:"pointer",
                                background:activeTab?.fileKey===key&&activeTab?.type==="code"?"rgba(96,165,250,0.1)":"transparent",
                                color:activeTab?.fileKey===key&&activeTab?.type==="code"?"#e2e8f0":"#CBD5E1", fontSize:11.5}}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                              onMouseLeave={e=>e.currentTarget.style.background=activeTab?.fileKey===key&&activeTab?.type==="code"?"rgba(96,165,250,0.1)":"transparent"}>
                              <FileCode size={12} color="#60a5fa" style={{flexShrink:0}}/>
                              {meta.name}
                            </div>
                          ))}
                          <div style={{padding:"6px 8px 2px 26px", fontSize:9, color:"#64748B", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em"}}>분석 · 배포</div>
                          {[
                            { icon:<BarChart3 size={12} color="#F59E0B"/>, label:"백테스트 결과", active: activeTab?.type==="report",
                              fn:()=>{ const t=openTabs.find(tt=>tt.type==="report"); if(t) setActiveTabId(t.id); else handleRunBacktest(); } },
                            { icon:<BookOpen size={12} color="#a78bfa"/>,  label:"코드 해설", active: activeTab?.type==="notebook", fn:handleOpenNotebook },
                            { icon:<Lightbulb size={12} color="#F59E0B"/>, label:"최적화 개선", active:false, fn:handleImproveProposal },
                            { icon:<Rocket size={12} color="#a78bfa"/>,    label:"Deploy to Live", active: activeTab?.type==="deploy", fn:handleDeploy },
                          ].map((n,i)=>(
                            <div key={i} onClick={n.fn}
                              style={{display:"flex", alignItems:"center", gap:6, padding:"4px 8px 4px 30px", cursor:"pointer",
                                background:n.active?"rgba(96,165,250,0.1)":"transparent", color:n.active?"#e2e8f0":"#CBD5E1", fontSize:11.5}}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                              onMouseLeave={e=>e.currentTarget.style.background=n.active?"rgba(96,165,250,0.1)":"transparent"}>
                              {n.icon}{n.label}
                            </div>
                          ))}
                        </>
                      )}
                      <div style={{padding:"10px 12px 4px", fontSize:10, color:"#94A3B8"}}>
                        Git 패널에서 레포지토리를 연결하면<br/>실제 파일 트리가 표시됩니다.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Data Browser ── */}
              {sidePanel==="data" && (
                <div>
                  <div onClick={handleOpenDatasets}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"7px 9px",margin:"0 0 6px",
                      cursor:"pointer",userSelect:"none",borderRadius:7,
                      background:activeTab?.type==="datasets"?"rgba(96,165,250,0.12)":"rgba(96,165,250,0.06)",
                      border:`1px solid ${activeTab?.type==="datasets"?"#60a5fa":"rgba(96,165,250,0.2)"}`,
                      color:"#bfdbfe",fontSize:11.5,fontWeight:700}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(96,165,250,0.16)"}
                    onMouseLeave={e=>e.currentTarget.style.background=activeTab?.type==="datasets"?"rgba(96,165,250,0.12)":"rgba(96,165,250,0.06)"}>
                    <span style={{fontSize:13}}>🗂</span>
                    오픈소스 카탈로그 열기
                    <span style={{marginLeft:"auto",fontSize:8.5,padding:"1px 5px",borderRadius:999,background:"rgba(253,230,138,0.2)",color:"#fde68a"}}>NEW</span>
                  </div>
                  <div onClick={()=>setDataGroupOpen(v=>!v)}
                    style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",
                      cursor:"pointer",userSelect:"none",color:"#F1F5F9",fontSize:11,fontWeight:700}}>
                    {dataGroupOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                    <Database size={12} color="#10B981" style={{flexShrink:0}}/>
                    기본 제공 데이터셋
                  </div>
                  {dataGroupOpen && datasets.filter(d=>d.id!=="my_kis"&&d.id!=="my_binance").map(ds=>(
                    <div key={ds.id}
                      onClick={()=>openDataset(ds)}
                      style={{padding:"4px 8px 4px 26px",cursor:"pointer",fontSize:11.5,
                        background:activeTab?.datasetId===ds.id?"rgba(16,185,129,0.1)":"transparent",
                        color:activeTab?.datasetId===ds.id?"#e2e8f0":"#CBD5E1"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                      onMouseLeave={e=>e.currentTarget.style.background=
                        activeTab?.datasetId===ds.id?"rgba(16,185,129,0.1)":"transparent"}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10}}>📊</span>
                        <span>{ds.name}</span>
                      </div>
                      <div style={{fontSize:9,color:"#374151",marginLeft:15,marginTop:1}}>{ds.rows} rows</div>
                    </div>
                  ))}
                  <div onClick={()=>setMyDataOpen(v=>!v)}
                    style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",
                      cursor:"pointer",userSelect:"none",color:"#F1F5F9",fontSize:11,fontWeight:700,marginTop:4}}>
                    {myDataOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                    <Database size={12} color="#60a5fa" style={{flexShrink:0}}/>
                    내 데이터 (KIS API)
                  </div>
                  {myDataOpen && datasets.filter(d=>d.id==="my_kis"||d.id==="my_binance").map(ds=>(
                    <div key={ds.id}
                      onClick={()=>openDataset(ds)}
                      style={{padding:"4px 8px 4px 26px",cursor:"pointer",fontSize:11.5,
                        background:activeTab?.datasetId===ds.id?"rgba(96,165,250,0.1)":"transparent",
                        color:activeTab?.datasetId===ds.id?"#e2e8f0":"#CBD5E1"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                      onMouseLeave={e=>e.currentTarget.style.background=
                        activeTab?.datasetId===ds.id?"rgba(96,165,250,0.1)":"transparent"}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:10}}>📊</span>
                        <span>{ds.name}</span>
                        <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,
                          background:"rgba(16,185,129,0.15)",color:"#10B981"}}>실시간</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Git Panel ── */}
              {sidePanel==="git" && (
                <GitPanel
                  workspaceId={wsId}
                  modifiedFiles={modifiedFiles}
                  onPushComplete={onGitPushComplete}
                  onPullAll={onGitPullAll}
                  onRepoLinked={() => {
                    if (wsId) loadFileTree(wsId);
                    setSidePanel("explorer"); // 연결 후 파일 트리 자동 표시
                  }}
                  onRepoUnlinked={() => { setRepoFiles([]); setFileCache({}); setRepoContents({}); }}
                  fileContents={fileContents}
                  onPullComplete={(contents) => {
                    setFileContents(contents);
                    setOpenTabs(prev => prev.find(t=>t.id==="tab_main") ? prev
                      : [...prev, { id:"tab_main", name:"main.py", type:"code", fileKey:"main" }]);
                    setActiveTabId("tab_main");
                  }}
                  onOpenCommit={(c) => {
                    const tabId = `tab_commit_${c.sha}`;
                    setOpenTabs(prev => prev.find(t=>t.id===tabId) ? prev : [
                      ...prev, { id:tabId, name:c.sha?.slice(0,7), type:"commit", commit:c }
                    ]);
                    setActiveTabId(tabId);
                  }}
                  deletedFiles={[...deletedFiles]}
                  onDeleteComplete={(paths) => setDeletedFiles(prev => {
                    const next = new Set(prev);
                    paths.forEach(p => next.delete(p));
                    return next;
                  })}
                />
              )}
            </div>
          </div>
        )}

        {/* ── 메인 영역 ─────────────────────────────────────────────────────── */}
        <div style={{flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden"}}>

          {/* 탭 바 */}
          <div style={{
            display:"flex", alignItems:"center", flexShrink:0,
            background:"#161b22", borderBottom:"1px solid rgba(255,255,255,0.07)",
            overflowX:"auto", minHeight:34,
          }}>
            {openTabs.map(tab=>(
              <div key={tab.id} onClick={()=>setActiveTabId(tab.id)}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"0 14px", height:34, flexShrink:0, cursor:"pointer",
                  background:activeTabId===tab.id?"#0f1117":"transparent",
                  borderBottom:activeTabId===tab.id?"2px solid #60a5fa":"2px solid transparent",
                  color:activeTabId===tab.id?"#e2e8f0":"#4B5563",
                  fontSize:11.5, fontWeight:activeTabId===tab.id?600:400,
                  borderRight:"1px solid rgba(255,255,255,0.05)",
                }}>
                {tab.type==="code"&&<FileCode size={10} color="#60a5fa"/>}
                {tab.type==="repoFile"&&<FileCode size={10} color="#93c5fd"/>}
                {tab.type==="data"&&<Database size={10} color="#10B981"/>}
                {tab.type==="datasets"&&<Database size={10} color="#60a5fa"/>}
                {tab.type==="report"&&<BarChart3 size={10} color="#F59E0B"/>}
                {tab.type==="notebook"&&<BookOpen size={10} color="#a78bfa"/>}
                {tab.type==="deploy"&&<Rocket size={10} color="#a78bfa"/>}
                {(tab.type==="optimize"||tab.type==="optresult")&&<BarChart3 size={10} color="#F59E0B"/>}
                <span style={{whiteSpace:"nowrap"}}>{tab.name}</span>
                {/* dirty indicator */}
                {tab.type==="repoFile" && modifiedSet.has(tab.filePath) && (
                  <span style={{width:5,height:5,borderRadius:999,background:"#60a5fa",flexShrink:0}}/>
                )}
                <X size={10}
                  onClick={(e)=>closeTab(tab.id,e)}
                  style={{opacity:activeTabId===tab.id?0.5:0,cursor:"pointer",marginLeft:2}}
                  onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                  onMouseLeave={e=>e.currentTarget.style.opacity=activeTabId===tab.id?"0.5":"0"}
                />
              </div>
            ))}
            {openTabs.length===0 && (
              <div style={{padding:"0 16px",fontSize:11,color:"#2d3748"}}>
                탐색기에서 파일을 클릭하여 여세요
              </div>
            )}
          </div>

          {/* 에디터 / 데이터뷰 / 리포트 */}
          <div style={{flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column"}}>

            {/* 워크스페이스 코드 파일 */}
            {activeTab?.type==="code" && (
              <Editor
                key={activeTab.fileKey}
                height="100%"
                defaultLanguage="python"
                value={fileContents[activeTab.fileKey]||""}
                onChange={v=>setFileContents(prev=>({...prev,[activeTab.fileKey]:v??""}))}
                theme="vs-dark"
                options={editorOpts}
              />
            )}
            {/* GitHub 레포 파일 */}
            {activeTab?.type==="repoFile" && (
              <Editor
                key={activeTab.filePath}
                height="100%"
                defaultLanguage={activeTab.lang || "plaintext"}
                value={repoContents[activeTab.filePath] || ""}
                onChange={v => setRepoContents(prev => ({ ...prev, [activeTab.filePath]: v ?? "" }))}
                theme="vs-dark"
                options={{ ...editorOpts, tabSize: editorOpts.tabSize !== 4 ? editorOpts.tabSize : 2 }}
              />
            )}

            {activeTab?.type==="data" && <DataTableView datasetId={activeTab.datasetId} datasets={datasets}/>}
            {activeTab?.type==="datasets" && <DatasetsBrowser/>}
            {runStatus==="running" && <RunProgressOverlay engine={engine}/>}
            {/* ── 클라우드 Lean PREMIUM 게이트 모달 (브리핑 쿨다운 모달과 동일 스타일) ── */}
            {leanGateOpen && (
              <div onClick={() => setLeanGateOpen(false)} style={{
                position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 3000, backdropFilter: "blur(4px)",
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: "white", borderRadius: 20, width: "100%", maxWidth: 440,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
                }}>
                  <div style={{
                    padding: "24px 28px 20px",
                    background: "linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%)",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                      background: "linear-gradient(135deg,#a78bfa,#6366f1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                    }}>
                      <Lock size={22} color="white" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>PREMIUM 구독이 필요해요</h2>
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#475569" }}>클라우드 관리형 Lean 백테스트</p>
                    </div>
                  </div>
                  <div style={{ padding: "24px 28px" }}>
                    <div style={{
                      background: "linear-gradient(135deg,#f5f3ff,#ede9fe)",
                      borderRadius: 12, padding: "16px 20px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <Rocket size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: "#4c1d95", fontWeight: 600 }}>
                        클라우드 관리형 Lean 백테스트는 <span style={{ fontWeight: 800, color: "#6d28d9" }}>PREMIUM</span> 구독에서 사용할 수 있습니다
                      </span>
                    </div>
                    <p style={{ margin: "14px 0 0", fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
                      • 우리 서버가 실행하므로 노트북 성능과 무관합니다.<br />
                      • STANDARD 는 '로컬(자가호스팅)' 엔진으로 본인 Docker 에서 Lean 을 실행하거나, 클라우드 vectorbt 백테스트를 사용하세요.<br />
                      엔진 패널에서 실행 위치를 '로컬' 로 바꾸면 본인 환경에서 실행합니다.
                    </p>
                  </div>
                  <div style={{ padding: "0 28px 24px", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => setLeanGateOpen(false)} style={{
                      padding: "10px 28px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg,#a78bfa 0%,#6366f1 100%)",
                      color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 3px 10px rgba(99,102,241,0.3)",
                    }}>확인</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab?.type==="report" && <BacktestReportView btResult={btResult} code={fileContents.main} strategyName={strategyName}/>}
            {activeTab?.type==="notebook" && <NotebookView code={fileContents.main} strategyName={strategyName}/>}
            {activeTab?.type==="deploy" && <DeployWizardView wsId={wsId} strategyName={strategyName}/>}
            {activeTab?.type==="optimize" && <OptimizeWizardView baseParams={parseParamsFromCode(fileContents.main||"")} busy={optBusy} progress={optProgress} onLaunch={handleLaunchOptimize}/>}
            {activeTab?.type==="optresult" && <OptimizeResultView results={optResults} busy={optBusy} progress={optProgress} onApply={applyOptParams} onOpenCombo={handleOpenCombo} comboFull={optComboFull} onCloseCombo={()=>setOptComboFull(null)}/>}
            {activeTab?.type==="diff" && <ClaudeDiffView changes={claudeDiff?.changes || []} onMeasure={handleMeasureClaudeChange} measuring={compareBusy}/>}
            {activeTab?.type==="commit" && (
              <CommitDiffView commit={activeTab.commit} workspaceId={wsId} />
            )}

            {!activeTab && (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",color:"#2d3748",gap:10}}>
                <Code2 size={36} color="#1f2937"/>
                <div style={{fontSize:13,color:"#374151"}}>좌측 탐색기에서 파일을 열거나 데이터셋을 선택하세요</div>
                <div style={{fontSize:11,color:"#2d3748"}}>Run Backtest → 완료 후 📊 Report 탭이 자동 생성됩니다</div>
              </div>
            )}
          </div>

          {/* ── 하단 콘솔 ─────────────────────────────────────────────────── */}
          <div style={{
            height:bottomH, flexShrink:0,
            background:"#0d1117", borderTop:"1px solid rgba(255,255,255,0.07)",
            display:"flex", flexDirection:"column", overflow:"hidden",
          }}>
            {/* 리사이즈 핸들 — 마우스 가까이 가면 파란 선, 위로 드래그하면 콘솔/터미널 영역 커짐 */}
            <div onMouseDown={handleBottomResizeMouseDown}
              style={{height:12, flexShrink:0, cursor:"ns-resize", background:"#0d1117",
                display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:5}}
              onMouseEnter={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.45)";}}
              onMouseLeave={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.18)";}}>
              <div style={{width:36,height:3,borderRadius:2,background:"rgba(255,255,255,0.18)",transition:"background 0.15s"}}/>
            </div>
            <div style={{
              display:"flex", alignItems:"center",
              borderBottom:"1px solid rgba(255,255,255,0.06)",
              padding:"0 12px", flexShrink:0, background:"#161b22",
            }}>
              <button onClick={()=>setConsoleTab("log")}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
                background:"none",border:"none",borderBottom:consoleTab==="log"?"2px solid #60a5fa":"2px solid transparent",
                color:consoleTab==="log"?"#60a5fa":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:-1}}>
                <Terminal size={10}/>CONSOLE
                {runStatus==="running"&&(
                  <span style={{width:6,height:6,borderRadius:999,background:"#F59E0B",animation:"pulse 1s ease-in-out infinite"}}/>
                )}
                {runStatus==="done"&&(
                  <span style={{width:6,height:6,borderRadius:999,background:"#10B981"}}/>
                )}
              </button>
              <button onClick={()=>setConsoleTab("terminal")}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
                background:"none",border:"none",borderBottom:consoleTab==="terminal"?"2px solid #60a5fa":"2px solid transparent",
                color:consoleTab==="terminal"?"#60a5fa":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:-1}}>
                <Terminal size={10}/>TERMINAL
              </button>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:2}}>
                {consoleTab==="log" && (
                  <button onClick={()=>setLogLines([])} title="콘솔 지우기"
                    style={{background:"none",border:"none",color:"#4B5563",cursor:"pointer",
                      fontSize:10,padding:"3px 8px"}}>Clear</button>
                )}
                <button onClick={()=>setBottomH(h=>h===180?320:180)} title="콘솔 크기"
                  style={{background:"none",border:"none",color:"#2d3748",cursor:"pointer",
                    fontSize:9,padding:"3px 6px"}}>
                  {bottomH===180?"↑":"↓"}
                </button>
              </div>
            </div>
            {consoleTab==="terminal" ? (
              <div style={{flex:1,minHeight:0,overflow:"hidden"}}>
                <TerminalTabs/>
              </div>
            ) : (
              <div ref={logScrollRef} className="dark-scroll" style={{flex:1,overflow:"auto",padding:"6px 14px",
                fontFamily:"'Fira Code','Cascadia Code',monospace",fontSize:12.5}}>
                {logLines.length===0&&runStatus==="idle"&&(
                  <div style={{color:"#2d3748",marginTop:4}}>
                    ▶  Run Backtest 클릭 → LEAN 엔진 로그 / TERMINAL 탭에서 bash·powershell·cmd 실행.
                  </div>
                )}
                {logLines.map((line,i)=>(
                  <div key={i} style={{display:"flex",gap:10,marginBottom:1}}>
                    <span style={{color:"#2d3748",flexShrink:0}}>{line.ts}</span>
                    <span style={{color:logColor[line.type]||"#9CA3AF"}}>{line.msg}</span>
                  </div>
                ))}
                {runStatus==="running"&&(
                  <div style={{color:"#374151",marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                    <Loader size={9} style={{animation:"spin 1s linear infinite"}}/>처리 중…
                  </div>
                )}
                <div ref={logEndRef}/>
              </div>
            )}
          </div>

        </div>

        {/* ═══ Claude Code 에이전트 우측 도크 (리사이즈 가능) ═══ */}
        {claudeOpen && (
          <>
            <div onMouseDown={handleClaudeDockResizeMouseDown}
              style={{width:12, flexShrink:0, cursor:"col-resize", background:"#0f1117",
                display:"flex",alignItems:"center",justifyContent:"center",zIndex:6}}
              onMouseEnter={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.45)";}}
              onMouseLeave={e=>{e.currentTarget.firstChild.style.background="rgba(255,255,255,0.15)";}}>
              <div style={{width:3,height:32,borderRadius:2,background:"rgba(255,255,255,0.15)",transition:"background 0.15s"}}/>
            </div>
            <div style={{width:claudeDockW, flexShrink:0, background:"#12161f",
              borderLeft:"1px solid rgba(255,255,255,0.08)", display:"flex", flexDirection:"column", overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,padding:"9px 12px",
                borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:800,color:"#e5e7eb",flex:1,display:"inline-flex",alignItems:"center",gap:7}}>
                  <img src={claudeBotImg} alt="Claude" style={{width:18,height:18,objectFit:"contain",flexShrink:0}} /> Claude Code
                </span>
                {claudeBusy && <Loader size={13} color="#d97757" style={{animation:"spin 1s linear infinite"}}/>}
                {claudeMessages.length > 0 && !claudeBusy && (
                  <button
                    onClick={async () => { try { if (wsId) await resetClaudeSession(wsId); } catch { /* noop */ } setClaudeMessages([]); }}
                    title="새 대화 (이 워크스페이스의 Claude 세션 맥락 초기화)"
                    style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:7,
                      border:"1px solid rgba(217,119,87,0.35)",background:"transparent",color:"#d97757",
                      fontSize:11,fontWeight:700,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(217,119,87,0.12)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <Plus size={12}/>새 대화
                  </button>
                )}
                {/* 컴팩트 연동 상태 칩 — 클릭하면 CLI(키) 관리 모달 */}
                <ClaudeKeyBadge />
                <X size={15} onClick={()=>setClaudeOpen(false)} style={{color:"#6B7280",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#e5e7eb"} onMouseLeave={e=>e.currentTarget.style.color="#6B7280"}/>
              </div>
              {/* 대화 — VSCode Claude Code 식, 도크 안에 누적 */}
              <div ref={claudeScrollRef} style={{flex:1, minHeight:0, overflowY:"auto", padding:"4px 12px 8px",
                display:"flex", flexDirection:"column", gap:9}}>
                {claudeMessages.length === 0 && (
                  <div style={{display:"flex", flexDirection:"column",
                    alignItems:"center", padding:"20px 18px 12px", textAlign:"center"}}>
                    {/* 상단 워드마크 — ClaudeSpark(공식 로고) + 텍스트 */}
                    <div style={{display:"flex", alignItems:"center", gap:9, marginBottom:16}}>
                      <ClaudeSpark size={26} />
                      <span style={{fontSize:20, fontWeight:600, color:"#e7e2da", fontFamily:"Georgia,'Times New Roman',serif", letterSpacing:0.2}}>Claude Code</span>
                    </div>
                    {/* 픽셀봇 마스코트 — 워드마크 바로 아래 */}
                    <img src={claudeBotImg} alt="Claude" style={{width:72, height:72, objectFit:"contain", marginBottom:4}} />
                    <div style={{marginTop:12, fontSize:12.5, color:"#8a93a3", lineHeight:1.7, maxWidth:300}}>
                      요청하면 <span style={{color:"#d97757",fontWeight:700}}>현재 전략 코드를 직접 편집</span>합니다 —<br/>
                      변경은 <span style={{color:"#d97757",fontWeight:700}}>🔀 Claude diff</span> 탭에서 확인하세요.
                    </div>
                    <div style={{marginTop:8, fontSize:11.5, color:"#5b6677"}}>
                      <b style={{color:"#8a93a3"}}>Enter</b> 전송 · <b style={{color:"#8a93a3"}}>Shift+Enter</b> 줄바꿈
                    </div>
                  </div>
                )}
                {claudeMessages.map((m, i) => {
                  if (m.role === "user") return (
                    <div key={i} style={{alignSelf:"flex-end", maxWidth:"88%", background:"linear-gradient(135deg,#d97757,#c2562f)",
                      color:"#fff", padding:"8px 12px", borderRadius:"12px 4px 12px 12px", fontSize:12.5, lineHeight:1.55, whiteSpace:"pre-wrap"}}>{m.content}</div>
                  );
                  if (m.role === "assistant") return (
                    <div key={i} style={{alignSelf:"flex-start", maxWidth:"94%", width:(m.changes&&m.changes.length)?"94%":undefined, display:"flex", flexDirection:"column", gap:7}}>
                      {m.content && <div style={{background:"#1b2130", color:"#e5e7eb", padding:"9px 12px",
                        borderRadius:"4px 12px 12px 12px", fontSize:12.5, lineHeight:1.6, whiteSpace:"pre-wrap"}}>{m.content}</div>}
                      {(m.changes || []).map((c, ci) => <InlineDiffCard key={ci} change={c} />)}
                      {m.summary && <div style={{fontSize:11.5, color:"#34d399", fontWeight:600, lineHeight:1.5}}>{m.summary}</div>}
                    </div>
                  );
                  if (m.role === "error") return (
                    <div key={i} style={{alignSelf:"flex-start", maxWidth:"92%", background:"rgba(248,113,113,0.12)", color:"#fca5a5",
                      border:"1px solid rgba(248,113,113,0.3)", padding:"8px 11px", borderRadius:8, fontSize:12, lineHeight:1.5}}>⚠️ {m.content}</div>
                  );
                  return <ActivityLine key={i} content={m.content} type={m.type} />;
                })}
                {claudeBusy && (
                  <div style={{fontSize:11.5, color:"#d97757", display:"flex", alignItems:"center", gap:6}}>
                    <Loader size={12} style={{animation:"spin 1s linear infinite"}}/> 작업 중…
                  </div>
                )}
              </div>
              {/* 입력 — Enter 전송 / Shift+Enter 줄바꿈 */}
              <div style={{padding:"0 12px 12px", flexShrink:0, borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                {/* 드래그 핸들 — 위/아래로 끌어 입력창 높이 조절 */}
                <div onMouseDown={handleClaudeInputResizeMouseDown} title="드래그해서 입력창 높이 조절"
                  style={{height:14, margin:"0 -12px 2px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"ns-resize"}}
                  onMouseEnter={e=>{ const b=e.currentTarget.firstChild; if(b) b.style.background="rgba(217,119,87,0.6)"; }}
                  onMouseLeave={e=>{ const b=e.currentTarget.firstChild; if(b) b.style.background="rgba(255,255,255,0.18)"; }}>
                  <div style={{width:36, height:3, borderRadius:2, background:"rgba(255,255,255,0.18)", transition:"background 0.15s ease"}}/>
                </div>
                <div style={{display:"flex", gap:7, alignItems:"flex-end"}}>
                  <textarea
                    value={claudeReq}
                    onChange={e=>setClaudeReq(e.target.value)}
                    onKeyDown={e=>{ if(e.nativeEvent.isComposing) return; if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleClaudeAgent(); } }}
                    placeholder="Claude에게 요청하세요…  코드를 직접 작성·수정합니다"
                    disabled={claudeBusy}
                    style={{flex:1, boxSizing:"border-box", resize:"none", background:"#0f1117", color:"#e5e7eb",
                      border:"1px solid rgba(217,119,87,0.3)", borderRadius:10, padding:"9px 11px",
                      fontSize:12.5, fontFamily:"inherit", lineHeight:1.5, outline:"none", height:claudeInputH, minHeight:40}}/>
                  <button onClick={handleClaudeAgent} disabled={claudeBusy||!claudeReq.trim()}
                    title="전송 (Enter)"
                    style={{width:40, height:40, borderRadius:10, border:"none", flexShrink:0,
                      background:(claudeBusy||!claudeReq.trim())?"rgba(125,211,252,0.25)":"#7DD3FC",
                      cursor:(claudeBusy||!claudeReq.trim())?"not-allowed":"pointer",
                      display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s ease"}}
                    onMouseEnter={e=>{ if(!claudeBusy&&claudeReq.trim()) e.currentTarget.style.background="#38BDF8"; }}
                    onMouseLeave={e=>{ if(!claudeBusy&&claudeReq.trim()) e.currentTarget.style.background="#7DD3FC"; }}>
                    {claudeBusy ? <Loader size={15} color="#d97757" style={{animation:"spin 1s linear infinite"}}/> : <Send size={16} color="#fff"/>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {improveOpen && (
        <ImproveProposalModal
          busy={improveBusy} data={improveData} err={improveErr} applied={improveApplied}
          onApply={handleApplyOption} onClose={()=>setImproveOpen(false)} />
      )}
      {compareOpen && (
        <PatchCompareModal
          busy={compareBusy} data={compareData} err={compareErr} onClose={()=>setCompareOpen(false)} />
      )}
      <SettingsModal
        open={ideSettingsOpen}
        onClose={() => setIdeSettingsOpen(false)}
        initialCat="ide"
      />

      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

/* ───── P3: 전략 개선 제안서 모달 ───── */
const IMPROVE_METRICS = [
  { key: "return_pct", label: "수익률", unit: "%", better: "high", dec: 1, signed: true },
  { key: "mdd_pct",    label: "최대낙폭(MDD)", unit: "%", better: "high", dec: 1, signed: false },
  { key: "vol_pct",    label: "변동성", unit: "%", better: "low",  dec: 1, signed: false },
  { key: "sharpe",     label: "샤프지수", unit: "",  better: "high", dec: 2, signed: false },
];
const TONE = {
  neutral:    { bg: "#1e2533", border: "#374151", text: "#cbd5e1", accent: "#94a3b8" },
  stable:     { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.45)", text: "#6ee7b7", accent: "#10b981" },
  aggressive: { bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.45)", text: "#f9a8d4", accent: "#ec4899" },
};
function fmtMetric(v, m) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = Number(v).toFixed(m.dec);
  return (m.signed && Number(v) > 0 ? "+" : "") + s + m.unit;
}
function metricDelta(variantV, baseV, m) {
  if (variantV == null || baseV == null) return null;
  const d = Number(variantV) - Number(baseV);
  if (Math.abs(d) < (m.dec === 2 ? 0.01 : 0.05)) return { text: "≈", color: "#6b7280" };
  const improved = m.better === "high" ? d > 0 : d < 0;
  return { text: (d > 0 ? "▲" : "▼") + Math.abs(d).toFixed(m.dec), color: improved ? "#34d399" : "#f87171" };
}
function ImproveProposalModal({ busy, data, err, applied, onApply, onClose }) {
  const options = data?.options || [];
  const baseline = options.find(o => o.key === "keep")?.metrics || {};
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 4000, background: "rgba(8,11,18,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(940px, 96vw)", maxHeight: "90vh", overflow: "auto", background: "#12161f",
        border: "1px solid rgba(245,158,11,0.35)", borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        display: "flex", flexDirection: "column",
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9, padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0,
          background: "linear-gradient(135deg,#1b2130,#161b24)", zIndex: 2,
        }}>
          <Lightbulb size={18} color="#F59E0B" />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", flex: 1 }}>전략 개선 제안서</span>
          <X size={18} onClick={onClose} style={{ color: "#94a3b8", cursor: "pointer" }} />
        </div>

        <div style={{ padding: 18 }}>
          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", justifyContent: "center", color: "#cbd5e1", fontSize: 13.5 }}>
              <Loader size={18} color="#F59E0B" style={{ animation: "spin 1s linear infinite" }} />
              진단 분석 + 안정형·공격형 전후 백테스트 측정 중… (수 초)
            </div>
          )}
          {!busy && err && (
            <div style={{ padding: 16, borderRadius: 10, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)", color: "#fca5a5", fontSize: 13 }}>
              ⚠️ {err}
            </div>
          )}
          {!busy && !err && data && (
            <>
              {/* 진단 */}
              <div style={{ marginBottom: 16, padding: "13px 15px", borderRadius: 11, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#FBBF24", letterSpacing: 0.4, marginBottom: 5 }}>🩺 진단</div>
                <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{data.diagnosis}</div>
              </div>

              {/* 선택지 카드 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 16 }}>
                {options.map(opt => {
                  const t = TONE[opt.tone] || TONE.neutral;
                  const isApplied = applied === opt.key;
                  return (
                    <div key={opt.key} style={{ background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: t.text }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.5, minHeight: 32 }}>{opt.summary}</div>
                      {/* 변경 파라미터 */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(opt.changes || []).length === 0
                          ? <div style={{ fontSize: 11, color: "#6b7280" }}>· 변경 없음(현재값)</div>
                          : opt.changes.map((c, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "ui-monospace,monospace" }}>
                              {c.label}: <span style={{ color: "#94a3b8" }}>{String(c.from ?? "—")}</span> → <span style={{ color: t.accent, fontWeight: 700 }}>{String(c.to)}</span>
                            </div>
                          ))}
                      </div>
                      {opt.key === "keep" ? (
                        <div style={{ marginTop: "auto", padding: "7px 0", textAlign: "center", fontSize: 11.5, color: "#6b7280", fontWeight: 700 }}>현재 기준</div>
                      ) : (
                        <button onClick={() => onApply(opt)} disabled={opt.metrics && opt.metrics.available === false}
                          style={{ marginTop: "auto", padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                            background: isApplied ? "#334155" : t.accent, color: "#fff", fontSize: 12, fontWeight: 800 }}>
                          {isApplied ? "✓ 적용됨" : "이 안 적용 + 백테스트"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 전후 비교표 */}
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 0.4, marginBottom: 7 }}>📊 변경 전후 비교 (실제 백테스트 · {data.period || "5y"})</div>
              <div style={{ overflowX: "auto", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#1a1f2a" }}>
                      <th style={{ textAlign: "left", padding: "9px 12px", color: "#94a3b8", fontWeight: 700 }}>지표</th>
                      {options.map(o => {
                        const t = TONE[o.tone] || TONE.neutral;
                        return <th key={o.key} style={{ textAlign: "right", padding: "9px 12px", color: t.text, fontWeight: 800 }}>{o.label}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {IMPROVE_METRICS.map(m => (
                      <tr key={m.key} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "9px 12px", color: "#cbd5e1", fontWeight: 600 }}>{m.label}</td>
                        {options.map(o => {
                          const mv = o.metrics || {};
                          const v = mv[m.key];
                          const unavailable = mv.available === false;
                          const d = o.key === "keep" ? null : metricDelta(v, baseline[m.key], m);
                          return (
                            <td key={o.key} style={{ padding: "9px 12px", textAlign: "right", color: unavailable ? "#6b7280" : "#f1f5f9", fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>
                              {unavailable ? "—" : fmtMetric(v, m)}
                              {d && <span style={{ marginLeft: 6, fontSize: 10.5, color: d.color, fontWeight: 700 }}>{d.text}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                · 성과는 추정이 아니라 <b style={{ color: "#94a3b8" }}>실제 vectorbt 백테스트</b> 결과입니다(수수료 0.25% + 슬리피지 0.1% 반영).
                <br />· <b style={{ color: "#94a3b8" }}>적용</b>하면 에디터 코드의 파라미터 상수가 바뀌고 즉시 백테스트로 확인합니다. 마음에 안 들면 되돌리세요.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───── P4: Claude 패치 전후 효과 비교 모달 (같은 비교 포맷 재사용) ───── */
function PatchCompareModal({ busy, data, err, onClose }) {
  const options = data?.options || [];
  const before = options.find(o => o.key === "before")?.metrics || {};
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 4000, background: "rgba(8,11,18,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(680px, 96vw)", maxHeight: "90vh", overflow: "auto", background: "#12161f",
        border: "1px solid rgba(245,158,11,0.35)", borderRadius: 16, boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg,#1b2130,#161b24)" }}>
          <BarChart3 size={18} color="#F59E0B" />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", flex: 1 }}>Claude 패치 — 변경 전후 효과</span>
          <X size={18} onClick={onClose} style={{ color: "#94a3b8", cursor: "pointer" }} />
        </div>
        <div style={{ padding: 18 }}>
          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "36px 0", justifyContent: "center", color: "#cbd5e1", fontSize: 13.5 }}>
              <Loader size={18} color="#F59E0B" style={{ animation: "spin 1s linear infinite" }} /> 변경 전·후 백테스트 측정 중…
            </div>
          )}
          {!busy && err && (
            <div style={{ padding: 16, borderRadius: 10, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.35)", color: "#fca5a5", fontSize: 13 }}>⚠️ {err}</div>
          )}
          {!busy && !err && data && (
            <>
              {data.paramsChanged === false && (
                <div style={{ marginBottom: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(148,163,184,0.10)", border: "1px solid rgba(148,163,184,0.3)", color: "#cbd5e1", fontSize: 12.5, lineHeight: 1.6 }}>
                  ℹ️ 파라미터 상수(SMA·RSI·MACD) 변경은 감지되지 않았습니다. 로직만 바뀐 변경의 효과는 <b style={{ color: "#a78bfa" }}>Lean 백테스트</b>로 확인하세요.
                </div>
              )}
              {(data.changes || []).length > 0 && (
                <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {data.changes.map((c, i) => (
                    <span key={i} style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: "#cbd5e1", background: "#1a1f2a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "4px 9px" }}>
                      {c.label}: {String(c.from ?? "—")} → <span style={{ color: "#34d399", fontWeight: 700 }}>{String(c.to)}</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ overflowX: "auto", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#1a1f2a" }}>
                      <th style={{ textAlign: "left", padding: "9px 12px", color: "#94a3b8", fontWeight: 700 }}>지표</th>
                      {options.map(o => {
                        const t = TONE[o.tone] || TONE.neutral;
                        return <th key={o.key} style={{ textAlign: "right", padding: "9px 12px", color: t.text, fontWeight: 800 }}>{o.label}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {IMPROVE_METRICS.map(m => (
                      <tr key={m.key} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td style={{ padding: "9px 12px", color: "#cbd5e1", fontWeight: 600 }}>{m.label}</td>
                        {options.map(o => {
                          const mv = o.metrics || {};
                          const v = mv[m.key];
                          const unavailable = mv.available === false;
                          const d = o.key === "before" ? null : metricDelta(v, before[m.key], m);
                          return (
                            <td key={o.key} style={{ padding: "9px 12px", textAlign: "right", color: unavailable ? "#6b7280" : "#f1f5f9", fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>
                              {unavailable ? "—" : fmtMetric(v, m)}
                              {d && <span style={{ marginLeft: 6, fontSize: 10.5, color: d.color, fontWeight: 700 }}>{d.text}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                · 실제 vectorbt 백테스트({data.period || "5y"}) 기준 · <b style={{ color: "#94a3b8" }}>변경 후</b> 컬럼의 색은 변경 전 대비 개선(녹)/악화(적).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───── CommitDiffView ───── */
function CommitDiffView({ commit, workspaceId }) {
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [selFile, setSelFile] = React.useState(null);

  React.useEffect(() => {
    if (!commit?.sha) return;
    setLoading(true); setErr(null); setDetail(null); setSelFile(null);
    getWorkspaceCommit(workspaceId, commit.sha)
      .then(d => { setDetail(d); if (d.files?.length) setSelFile(d.files[0]); })
      .catch(e => setErr(e.message || "커밋 정보 로드 실패"))
      .finally(() => setLoading(false));
  }, [commit?.sha, workspaceId]);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#94a3b8",fontSize:13}}>
      커밋 로드 중…
    </div>
  );
  if (err) return (
    <div style={{padding:16,color:"#f87171",fontSize:13}}>{err}</div>
  );
  if (!detail) return null;

  const statusColor = { added:"#34d399", modified:"#60a5fa", removed:"#f87171", renamed:"#f59e0b" };
  const statusLabel = { added:"A", modified:"M", removed:"D", renamed:"R" };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <code style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace"}}>{detail.sha?.slice(0,7)}</code>
          {detail.htmlUrl && (
            <a href={detail.htmlUrl} target="_blank" rel="noreferrer"
               style={{color:"#60a5fa",display:"flex",alignItems:"center",gap:3,fontSize:11}}>
              <ExternalLink size={11}/> GitHub
            </a>
          )}
        </div>
        <div style={{fontSize:12.5,color:"#e2e8f0",fontWeight:600,marginBottom:4,lineHeight:1.4}}>
          {detail.message}
        </div>
        <div style={{display:"flex",gap:10,fontSize:11,color:"#64748b"}}>
          <span>{detail.authorName}</span>
          <span>{detail.authoredAt ? new Date(detail.authoredAt).toLocaleString("ko-KR") : ""}</span>
          <span style={{color:"#34d399"}}>+{detail.additions}</span>
          <span style={{color:"#f87171"}}>-{detail.deletions}</span>
        </div>
      </div>

      {/* Body: file list + diff */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* File list */}
        <div style={{width:220,borderRight:"1px solid rgba(255,255,255,0.08)",overflowY:"auto",flexShrink:0}}>
          {(detail.files || []).map(f => (
            <div key={f.filename}
                 onClick={() => setSelFile(f)}
                 style={{
                   padding:"6px 10px",cursor:"pointer",fontSize:11,
                   background: selFile?.filename === f.filename ? "rgba(96,165,250,0.12)" : "transparent",
                   borderLeft: selFile?.filename === f.filename ? "2px solid #60a5fa" : "2px solid transparent",
                   display:"flex",alignItems:"center",gap:6,
                 }}>
              <span style={{
                fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:3,
                background: statusColor[f.status] || "#64748b", color:"#0f172a",flexShrink:0
              }}>{statusLabel[f.status] || "?"}</span>
              <span style={{color:"#cbd5e1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.filename}>
                {f.filename.split("/").pop()}
              </span>
            </div>
          ))}
        </div>

        {/* Diff panel */}
        <div style={{flex:1,overflow:"auto"}}>
          {selFile ? <DiffPatchView file={selFile}/> : (
            <div style={{color:"#64748b",fontSize:12,padding:16}}>파일을 선택하세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───── DiffPatchView ───── */
function DiffPatchView({ file }) {
  if (!file) return null;

  const statusColor = { added:"#34d399", modified:"#60a5fa", removed:"#f87171", renamed:"#f59e0b" };

  const lines = file.patch ? file.patch.split("\n") : [];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* File header */}
      <div style={{
        padding:"6px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",
        display:"flex",alignItems:"center",gap:8,flexShrink:0,
        background:"rgba(0,0,0,0.2)"
      }}>
        <span style={{
          fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,
          background: statusColor[file.status] || "#64748b", color:"#0f172a"
        }}>{file.status?.toUpperCase()}</span>
        <span style={{fontSize:11,color:"#e2e8f0",fontFamily:"monospace"}}>{file.filename}</span>
        <span style={{fontSize:10,color:"#34d399",marginLeft:"auto"}}>+{file.additions}</span>
        <span style={{fontSize:10,color:"#f87171"}}>-{file.deletions}</span>
        {file.blobUrl && (
          <a href={file.blobUrl} target="_blank" rel="noreferrer"
             style={{color:"#60a5fa",display:"flex",alignItems:"center",gap:2,fontSize:10}}>
            <ExternalLink size={10}/>
          </a>
        )}
      </div>

      {/* Diff lines */}
      {lines.length === 0 ? (
        <div style={{color:"#64748b",fontSize:11,padding:12}}>diff 없음 (바이너리 또는 빈 파일)</div>
      ) : (
        <div style={{overflowY:"auto",flex:1,fontFamily:"monospace",fontSize:11.5}}>
          {lines.map((line, i) => {
            let bg = "transparent", color = "#cbd5e1";
            if (line.startsWith("+") && !line.startsWith("+++")) { bg="rgba(52,211,153,0.10)"; color="#86efac"; }
            else if (line.startsWith("-") && !line.startsWith("---")) { bg="rgba(248,113,113,0.10)"; color="#fca5a5"; }
            else if (line.startsWith("@@")) { bg="rgba(96,165,250,0.08)"; color="#93c5fd"; }
            else if (line.startsWith("+++") || line.startsWith("---")) { color="#64748b"; }
            return (
              <div key={i} style={{
                background:bg, color, padding:"1px 12px", whiteSpace:"pre-wrap", wordBreak:"break-all",
                lineHeight:1.6, borderLeft: line.startsWith("+") && !line.startsWith("+++") ? "2px solid #34d399"
                  : line.startsWith("-") && !line.startsWith("---") ? "2px solid #f87171"
                  : "2px solid transparent"
              }}>{line || " "}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
