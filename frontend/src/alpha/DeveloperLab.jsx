import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  Play, Rocket, Terminal, BarChart3, Code2, Loader, Save,
  FolderOpen, Database, FileCode, ChevronDown, ChevronRight, X,
  ShoppingCart, AlertCircle, CheckCircle2, GitBranch, FilePlus, FolderPlus,
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import {
  getWorkspace, listWorkspaces, runBacktest, runRegime, runTrust, saveCode, queueOrders,
  getWorkspaceGitStatus, getWorkspaceFileTree, pullWorkspaceFile, deleteWorkspaceFile,
} from "./alphaApi";
import GitPanel from "./GitPanel";
import RepoExplorer from "./RepoExplorer";

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
  const clsName = name.replace(/[^a-zA-Z0-9]/g, "").replace(/^[0-9]/, "S") || "Strategy";

  if (stype === "momentum_rotation") {
    return `# AlphaHelix Strategy: ${name}
# ════════════════════════════════════════════════════════
# 전략 유형: MACD 모멘텀
TICKER       = "${ticker}"
BENCHMARK    = "SPY"
MACD_FAST    = ${mFast}
MACD_SLOW    = ${mSlow}
MACD_SIGNAL  = ${mSig}

from AlgorithmImports import *

class ${clsName}(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(10_000)
        self.symbol = self.AddEquity(TICKER, Resolution.Daily).Symbol
        self.SetBenchmark(BENCHMARK)
        self.macd = self.MACD(self.symbol, MACD_FAST, MACD_SLOW, MACD_SIGNAL, MovingAverageType.Exponential, Resolution.Daily)
        self.SetWarmUp(MACD_SLOW + MACD_SIGNAL + 5)

    def OnData(self, data):
        if self.IsWarmingUp or not self.macd.IsReady:
            return
        if self.macd.Current.Value > self.macd.Signal.Current.Value:
            if not self.Portfolio[self.symbol].IsLong:
                self.SetHoldings(self.symbol, 1.0)
        elif self.macd.Current.Value < self.macd.Signal.Current.Value:
            if self.Portfolio[self.symbol].IsLong:
                self.Liquidate()
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
  extract(/^\s*TICKER\s*=\s*"([^"]+)"/m,     "ticker", false);
  return result;
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

const PLACEHOLDER_CODE = `# ── AlphaHelix Developer Studio ──────────────────────────
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
];

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
function DataTableView({ datasetId }) {
  const ds = DATASETS.find(d=>d.id===datasetId);
  if (!ds) return null;
  return (
    <div style={{flex:1,overflow:"auto",padding:"16px 20px",background:"#0f1117"}}>
      <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"white"}}>{ds.name}</div>
          <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>{ds.desc}  ·  {ds.rows} rows  ·  {ds.cols.length} cols</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
          {ds.cols.map(c=>(
            <span key={c} style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:"rgba(96,165,250,0.1)",color:"#60a5fa",fontFamily:"monospace"}}>{c}</span>
          ))}
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",fontSize:11.5}}>
          <thead>
            <tr>
              {ds.cols.map(c=>(
                <th key={c} style={{padding:"6px 12px",textAlign:"left",color:"#4B5563",fontWeight:700,
                  borderBottom:"1px solid rgba(255,255,255,0.08)",background:"#161b22",whiteSpace:"nowrap"}}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ds.preview.map((row,i)=>(
              <tr key={i} style={{background:i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
                {ds.cols.map(c=>(
                  <td key={c} style={{padding:"5px 12px",color:"#9CA3AF",borderBottom:"1px solid rgba(255,255,255,0.04)",
                    fontFamily:"'Fira Code',monospace",whiteSpace:"nowrap",fontSize:11}}>{row[c]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── BacktestReportView ────────────────────────────────────────────────────────
function BacktestReportView({ btResult }) {
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
  const chartData = convertEquityCurve(btResult.equity_curve || []);
  const fmtPct = (v) => v == null ? "N/A" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  const fmtNum = (v, d=2) => v == null ? "N/A" : v.toFixed(d);
  const period = `${s.start || ""} – ${s.end || ""}`;
  return (
    <div style={{flex:1,overflow:"auto",padding:"20px",background:"#0f1117"}}>
      <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <BarChart3 size={16} color="#60a5fa"/>
        <span style={{fontSize:14,fontWeight:800,color:"white"}}>백테스트 리포트</span>
        <span style={{fontSize:10,color:"#4B5563"}}>{period} · vectorbt</span>
        <span style={{fontSize:9,padding:"2px 8px",borderRadius:999,background:"rgba(16,185,129,0.15)",color:"#10B981",fontWeight:700}}>완료</span>
      </div>
      {chartData.length > 1 && (
        <div style={{marginBottom:16,background:"rgba(255,255,255,0.02)",borderRadius:12,
          border:"1px solid rgba(255,255,255,0.06)",padding:"14px 16px"}}>
          <div style={{fontSize:10,color:"#4B5563",fontWeight:700,marginBottom:8}}>포트폴리오 수익률 커브</div>
          <SparkChart data={chartData}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:16}}>
        <MetricCard label="총 수익률"    value={fmtPct(s.total_return_pct)}      color={s.total_return_pct >= 0 ? "#10B981" : "#EF4444"}/>
        <MetricCard label="연환산 수익률" value={fmtPct(s.annualized_return_pct)} color={s.annualized_return_pct >= 0 ? "#10B981" : "#EF4444"}/>
        <MetricCard label="샤프 지수"    value={fmtNum(s.sharpe)}                color="#60a5fa"/>
        <MetricCard label="MDD"          value={fmtPct(s.max_drawdown_pct)}      color="#F59E0B"/>
        <MetricCard label="승률"         value={fmtPct(s.win_rate_pct)}          color="#60a5fa"/>
        <MetricCard label="총 거래 횟수" value={`${s.trades ?? "N/A"}회`}        color="#9CA3AF"/>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function DeveloperLab() {
  useTheme();
  const [searchParams] = useSearchParams();
  const sidePanelScrollRef = useRef(null);
  const logScrollRef = useRef(null);

  // ── 워크스페이스 ──
  const [wsId, setWsId] = useState(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [btResult, setBtResult] = useState(null);
  const [queueMsg, setQueueMsg] = useState(null);
  const [wsList, setWsList] = useState([]);
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
  const [dataGroupOpen, setDataGroupOpen] = useState(true);
  const [myDataOpen, setMyDataOpen] = useState(true);

  // ── 사이드 패널 너비 ──
  const [sidePanelW, setSidePanelW] = useState(220);
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

  // ── 하단 콘솔 ──
  const [bottomH, setBottomH] = useState(180);
  const [runStatus, setRunStatus] = useState("idle");
  const [logLines, setLogLines] = useState([]);
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
    setWsId(id);
    localStorage.setItem("alpha.lastWsId", id);
    getWorkspace(id)
      .then(data => {
        setStrategyName(data.name || "AlphaHelix Strategy");
        setBtResult(null);
        if (data.codeJson) {
          try { setFileContents(JSON.parse(data.codeJson)); } catch { /* ignore */ }
        } else if (data.strategyConfig) {
          const cfg = typeof data.strategyConfig === "string"
            ? JSON.parse(data.strategyConfig) : data.strategyConfig;
          const code = generateCodeFromConfig(cfg);
          setFileContents({ main: code });
        }
      })
      .catch(() => {})
      .finally(() => setWsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    setLogLines([
      { type:"info", msg:`[vectorbt] 백테스트 시작  ticker=${ticker}`, ts: new Date().toLocaleTimeString() },
      { type:"info", msg:`[PARAM] ${JSON.stringify(customParams)}`, ts: new Date().toLocaleTimeString() },
    ]);

    try {
      const result = await runBacktest(wsId, "5y", customParams);
      setBtResult(result);
      setRunStatus("done");
      const stats = result.stats || {};
      const ts = new Date().toLocaleTimeString();
      setLogLines([
        { type:"success", msg:`[DONE] 백테스트 완료`, ts },
        { type:"trade",   msg:`총 수익률: ${stats.total_return_pct?.toFixed(1)}%  /  연환산: ${stats.annualized_return_pct?.toFixed(1)}%`, ts },
        { type:"trade",   msg:`거래 ${stats.trades}회  /  승률 ${stats.win_rate_pct?.toFixed(1)}%`, ts },
        { type:"info",    msg:`Sharpe ${stats.sharpe?.toFixed(2)}  /  MDD ${stats.max_drawdown_pct?.toFixed(1)}%`, ts },
      ]);
      const reportId = `tab_report_${Date.now()}`;
      setOpenTabs(prev => {
        const filtered = prev.filter(t => t.type !== "report");
        return [...filtered, { id: reportId, name: "📊 백테스트 결과", type: "report" }];
      });
      setActiveTabId(reportId);
    } catch (e) {
      setRunStatus("idle");
      const msg = e?.response?.data?.error || e?.message || "알 수 없는 오류";
      setLogLines([{ type:"error", msg:`백테스트 실패: ${msg}`, ts: new Date().toLocaleTimeString() }]);
    }
  }, [runStatus, wsId, fileContents, activeTabId, openTabs]);

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
    alert("배포 전 체크리스트:\n\n✓ 백테스트 완료 확인\n✓ Trust Score ≥ 70\n⚠ KIS 모의계좌 연동 필요\n\n[계좌·주문] 탭에서 KIS 계좌를 먼저 등록하세요.");
  }, []);

  const activeTab = openTabs.find(t=>t.id===activeTabId);
  const logColor = {info:"#9CA3AF",trade:"#60a5fa",warn:"#F59E0B",success:"#10B981",error:"#EF4444"};

  return (
    <div style={{
      height:"calc(100vh - 52px)", display:"flex", flexDirection:"column",
      background:"#0f1117", fontFamily:"'Inter',-apple-system,sans-serif", overflow:"hidden",
    }}>

      {/* ═══ 헤더바 ═══════════════════════════════════════════════════════════ */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"0 14px",
        height:44, flexShrink:0, background:"#161b22",
        borderBottom:"1px solid rgba(255,255,255,0.08)",
      }}>
        <Code2 size={14} color="#60a5fa" style={{flexShrink:0}}/>
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
        <span style={{fontSize:9,color:"#2d3748",fontFamily:"monospace"}}>{activeTab?.name||""}</span>
        <button onClick={handleSave}
          style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:5,
            background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
            color:"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer"}}>
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
        <button onClick={handleRunBacktest} disabled={runStatus==="running"}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:runStatus==="running"?"rgba(96,165,250,0.12)":"linear-gradient(135deg,#1d4ed8,#2563eb)",
            border:"none",color:"white",fontSize:12,fontWeight:700,
            cursor:runStatus==="running"?"wait":"pointer",
            boxShadow:runStatus==="running"?"none":"0 2px 8px rgba(37,99,235,0.35)"}}>
          {runStatus==="running"
            ?<><Loader size={11} style={{animation:"spin 1s linear infinite"}}/>실행 중…</>
            :<><Play size={11}/>Run Backtest</>}
        </button>
        <button onClick={handleDeploy}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 13px",borderRadius:6,
            background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",
            color:"white",fontSize:12,fontWeight:700,cursor:"pointer",
            boxShadow:"0 2px 8px rgba(109,40,217,0.35)"}}>
          <Rocket size={11}/>Deploy to Live
        </button>
      </div>

      {/* ═══ 바디 ════════════════════════════════════════════════════════════ */}
      <div style={{flex:1, minHeight:0, display:"flex", overflow:"hidden"}}>

        {/* ── Activity Bar ─────────────────────────────────────────────────── */}
        <div style={{
          width:36, flexShrink:0, background:"#161b22",
          borderRight:"1px solid rgba(255,255,255,0.06)",
          display:"flex", flexDirection:"column", alignItems:"center",
          paddingTop:6, gap:2,
        }}>
          {[
            { icon:<FolderOpen size={20}/>, title:"파일 탐색기",   act: sidePanel==="explorer", fn: ()=>setSidePanel(p=>p==="explorer"?null:"explorer") },
            { icon:<FileCode size={20}/>,   title:"코드만 보기",   act: sidePanel===null,        fn: ()=>setSidePanel(null) },
            { icon:<Database size={20}/>,   title:"데이터 탐색기", act: sidePanel==="data",     fn: ()=>setSidePanel(p=>p==="data"?null:"data") },
            { icon:<GitBranch size={20}/>,  title:"GitHub 연결",   act: sidePanel==="git",      fn: ()=>setSidePanel(p=>p==="git"?null:"git") },
            { icon:<BarChart3 size={20}/>,  title:"백테스트 결과", act: openTabs.some(t=>t.type==="report")&&activeTab?.type==="report",
              fn: ()=>{ const t=openTabs.find(tt=>tt.type==="report"); if(t) setActiveTabId(t.id); else handleRunBacktest(); } },
            { icon:<Terminal size={20}/>,   title:"콘솔 / 터미널", act: false,                   fn: ()=>logEndRef.current?.scrollIntoView({behavior:"smooth"}) },
          ].map((b,i)=>(
            <button key={i} title={b.title} onClick={b.fn} style={{
              width:36, height:36, borderRadius:6, border:"none",
              background: b.act ? "rgba(96,165,250,0.12)" : "transparent",
              color: b.act ? "#60a5fa" : "#4B5563",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              transition:"color 0.12s, background 0.12s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#9CA3AF"; e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
            onMouseLeave={e=>{e.currentTarget.style.color=b.act?"#60a5fa":"#4B5563"; e.currentTarget.style.background=b.act?"rgba(96,165,250,0.12)":"transparent";}}
            >{b.icon}</button>
          ))}
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
              style={{position:"absolute",top:0,right:0,width:4,height:"100%",cursor:"col-resize",zIndex:10,background:"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(96,165,250,0.35)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            />

            {sidePanel!=="git" && (
              <div style={{
                padding:"6px 8px 6px 12px", fontSize:9, fontWeight:700, color:"#4B5563",
                letterSpacing:"0.08em", textTransform:"uppercase", flexShrink:0,
                borderBottom:"1px solid rgba(255,255,255,0.05)",
                display:"flex", alignItems:"center",
              }}>
                <span style={{flex:1}}>
                  {sidePanel==="explorer" ? (repoTree ? "레포지토리" : "탐색기") : "데이터 브라우저"}
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

            <div ref={sidePanelScrollRef} style={{flex:1, overflow:"auto", display:sidePanel==="git"?"flex":"block", flexDirection:"column"}}>

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
                    /* 워크스페이스 기본 파일 */
                    <>
                      <div onClick={()=>setFolderOpen(v=>!v)}
                        style={{display:"flex",alignItems:"center",gap:4,
                          padding:"5px 8px",cursor:"pointer",userSelect:"none",
                          color:"#9CA3AF",fontSize:11,fontWeight:700}}>
                        {folderOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                        <FolderOpen size={12} color="#60a5fa" style={{flexShrink:0}}/>
                        MY_STRATEGY
                      </div>
                      {folderOpen && Object.entries(FILE_META).map(([key,meta])=>(
                        <div key={key} onClick={()=>openFile(key)}
                          style={{
                            display:"flex", alignItems:"center", gap:6,
                            padding:"4px 8px 4px 26px", cursor:"pointer",
                            background:activeTab?.fileKey===key&&activeTab?.type==="code"
                              ?"rgba(96,165,250,0.1)":"transparent",
                            color:activeTab?.fileKey===key&&activeTab?.type==="code"
                              ?"#e2e8f0":"#6B7280",
                            fontSize:11.5,
                          }}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                          onMouseLeave={e=>e.currentTarget.style.background=
                            activeTab?.fileKey===key&&activeTab?.type==="code"?"rgba(96,165,250,0.1)":"transparent"}>
                          <FileCode size={12} color="#60a5fa" style={{flexShrink:0}}/>
                          {meta.name}
                        </div>
                      ))}
                      <div style={{padding:"10px 12px 4px", fontSize:10, color:"#374151"}}>
                        Git 패널에서 레포지토리를 연결하면<br/>파일 트리가 여기에 표시됩니다.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Data Browser ── */}
              {sidePanel==="data" && (
                <div>
                  <div onClick={()=>setDataGroupOpen(v=>!v)}
                    style={{display:"flex",alignItems:"center",gap:4,padding:"5px 8px",
                      cursor:"pointer",userSelect:"none",color:"#9CA3AF",fontSize:11,fontWeight:700}}>
                    {dataGroupOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                    <Database size={12} color="#10B981" style={{flexShrink:0}}/>
                    기본 제공 데이터셋
                  </div>
                  {dataGroupOpen && DATASETS.filter(d=>d.id!=="my_kis").map(ds=>(
                    <div key={ds.id} onClick={()=>openDataset(ds)}
                      style={{padding:"4px 8px 4px 26px",cursor:"pointer",fontSize:11.5,
                        background:activeTab?.datasetId===ds.id?"rgba(16,185,129,0.1)":"transparent",
                        color:activeTab?.datasetId===ds.id?"#e2e8f0":"#6B7280"}}
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
                      cursor:"pointer",userSelect:"none",color:"#9CA3AF",fontSize:11,fontWeight:700,marginTop:4}}>
                    {myDataOpen?<ChevronDown size={11}/>:<ChevronRight size={11}/>}
                    <Database size={12} color="#60a5fa" style={{flexShrink:0}}/>
                    내 데이터 (KIS API)
                  </div>
                  {myDataOpen && DATASETS.filter(d=>d.id==="my_kis").map(ds=>(
                    <div key={ds.id} onClick={()=>openDataset(ds)}
                      style={{padding:"4px 8px 4px 26px",cursor:"pointer",fontSize:11.5,
                        background:activeTab?.datasetId===ds.id?"rgba(96,165,250,0.1)":"transparent",
                        color:activeTab?.datasetId===ds.id?"#e2e8f0":"#6B7280"}}
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
                {tab.type==="report"&&<BarChart3 size={10} color="#F59E0B"/>}
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
                options={{
                  fontSize:13, fontFamily:"'Fira Code','Cascadia Code','Consolas',monospace",
                  fontLigatures:true, minimap:{enabled:true,scale:1},
                  scrollBeyondLastLine:false, lineNumbers:"on", tabSize:4,
                  renderLineHighlight:"gutter", bracketPairColorization:{enabled:true},
                  smoothScrolling:true, cursorBlinking:"phase", formatOnPaste:true,
                  suggestOnTriggerCharacters:true,
                  quickSuggestions:{other:true,comments:false,strings:false},
                }}
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
                options={{
                  fontSize:13, fontFamily:"'Fira Code','Cascadia Code','Consolas',monospace",
                  fontLigatures:true, minimap:{enabled:true,scale:1},
                  scrollBeyondLastLine:false, lineNumbers:"on", tabSize:2,
                  renderLineHighlight:"gutter", bracketPairColorization:{enabled:true},
                  smoothScrolling:true, cursorBlinking:"phase", formatOnPaste:true,
                  suggestOnTriggerCharacters:true,
                  quickSuggestions:{other:true,comments:false,strings:false},
                }}
              />
            )}

            {activeTab?.type==="data" && <DataTableView datasetId={activeTab.datasetId}/>}
            {activeTab?.type==="report" && <BacktestReportView btResult={btResult}/>}

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
            <div style={{
              display:"flex", alignItems:"center",
              borderBottom:"1px solid rgba(255,255,255,0.06)",
              padding:"0 12px", flexShrink:0, background:"#161b22",
            }}>
              <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
                background:"none",border:"none",borderBottom:"2px solid #60a5fa",
                color:"#60a5fa",fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:-1}}>
                <Terminal size={10}/>CONSOLE
                {runStatus==="running"&&(
                  <span style={{width:6,height:6,borderRadius:999,background:"#F59E0B",animation:"pulse 1s ease-in-out infinite"}}/>
                )}
                {runStatus==="done"&&(
                  <span style={{width:6,height:6,borderRadius:999,background:"#10B981"}}/>
                )}
              </button>
              <div style={{marginLeft:"auto"}}>
                <button onClick={()=>setBottomH(h=>h===180?320:180)}
                  style={{background:"none",border:"none",color:"#2d3748",cursor:"pointer",fontSize:9,padding:"3px 6px"}}>
                  {bottomH===180?"↑":"↓"}
                </button>
              </div>
            </div>
            <div ref={logScrollRef} style={{flex:1,overflow:"auto",padding:"6px 14px",
              fontFamily:"'Fira Code','Cascadia Code',monospace",fontSize:11}}>
              {logLines.length===0&&runStatus==="idle"&&(
                <div style={{color:"#2d3748",marginTop:4}}>
                  ▶  Run Backtest 클릭 → 로그가 실시간 스트리밍됩니다.
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
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
