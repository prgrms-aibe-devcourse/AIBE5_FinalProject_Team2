import { useState } from "react";
import { ChevronLeft, LayoutGrid, List, RefreshCw, MoreVertical, ArrowRightLeft, Receipt, ShoppingCart } from "lucide-react";
import {
  BRAND, pnlColor, fmtKrw, fmtUsd, fmtPct, fmtSigned, acctLabel, acctCurrency,
  summarizeBalance, acctTotalKrw, FX_KRW_PER_USD,
} from "./util";
import StockOrderView from "./StockOrderView";

/** 종합 자산 — 개요(계좌별) → 계좌 상세(보유종목, 표/카드) → 종목 주문 */
export default function AssetsTab({ accountsData, loading, refreshing, onReload }) {
  const [view, setView] = useState({ name: "overview" });
  const [showKrw, setShowKrw] = useState(true);

  if (view.name === "detail") {
    return <AccountDetail data={view.data} showKrw={showKrw} onBack={() => setView({ name: "overview" })}
      onOrder={(pos) => setView({ name: "order", acct: view.data.acct, position: pos })} />;
  }
  if (view.name === "order") {
    return <StockOrderView acct={view.acct} position={view.position}
      onBack={() => setView({ name: "overview" })} onReload={onReload} />;
  }
  return <Overview accountsData={accountsData} loading={loading} refreshing={refreshing}
    onReload={onReload} showKrw={showKrw} setShowKrw={setShowKrw}
    onOpen={(d) => setView({ name: "detail", data: d })} />;
}

/** 원화/달러 토글 pill */
function CurrencyToggle({ showKrw, setShowKrw }) {
  const pill = { display: "flex", borderRadius: 999, overflow: "hidden", border: "1px solid #C7D2FE", background: "#EEF2FF" };
  const btn = (active) => ({
    padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
    background: active ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "transparent",
    color: active ? "white" : "#6366f1",
    transition: "background 0.15s",
  });
  return (
    <div style={pill}>
      <button style={btn(showKrw)} onClick={() => setShowKrw(true)}>₩ 원화</button>
      <button style={btn(!showKrw)} onClick={() => setShowKrw(false)}>$ 달러</button>
    </div>
  );
}

/** 이미지1 — 자산 개요(계좌별 카드) */
function Overview({ accountsData, loading, refreshing, onReload, onOpen, showKrw, setShowKrw }) {
  const totalKrw = accountsData.reduce((s, d) => s + acctTotalKrw(d.sum), 0);
  const totalUsd = totalKrw / FX_KRW_PER_USD;
  const pnlUsd = accountsData.reduce((s, d) => s + d.sum.pnl, 0);
  const costUsd = accountsData.reduce((s, d) => s + d.sum.cost, 0);
  const pnlKrw = pnlUsd * FX_KRW_PER_USD;
  const pct = costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0;

  const totalFmt = showKrw ? fmtKrw(totalKrw) : fmtUsd(totalUsd);
  const pnlFmt = showKrw
    ? `${pnlKrw >= 0 ? "+" : ""}${fmtKrw(pnlKrw)}`
    : `${pnlUsd >= 0 ? "+" : ""}${fmtUsd(Math.abs(pnlUsd))}`;

  return (
    <div>
      {/* 헤더 카드 */}
      <div style={{ background: BRAND, borderRadius: 18, padding: "22px 24px", color: "white", marginBottom: 18, boxShadow: "0 8px 24px rgba(99,102,241,0.28)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, opacity: 0.92, fontWeight: 600 }}>
            총 자산 ({showKrw ? "KRW" : "USD"} 환산)
          </div>
          <CurrencyToggle showKrw={showKrw} setShowKrw={setShowKrw} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5, margin: "4px 0 12px" }}>{totalFmt}</div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 14 }}>
          <div><span style={{ opacity: 0.85 }}>투자손익 </span><b>{pnlFmt}</b></div>
          <div><span style={{ opacity: 0.85 }}>수익률 </span><b>{fmtPct(pct)}</b></div>
        </div>
      </div>

      {/* 탭 행 + 새로고침 */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14, borderBottom: "1px solid #E2E8F0", paddingBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>계좌별</span>
        <span style={{ fontSize: 14, color: "#94A3B8" }}>종목별</span>
        <span style={{ fontSize: 14, color: "#94A3B8" }}>현금</span>
        <button onClick={onReload} title="새로고침" style={iconBtn}>
          <RefreshCw size={16} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
        {refreshing && <span style={{ fontSize: 11, color: "#94A3B8" }}>갱신 중…</span>}
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>

      {loading ? <div style={{ color: "#64748B", padding: 20 }}>불러오는 중…</div>
        : accountsData.length === 0 ? <div style={{ color: "#64748B", padding: 20, textAlign: "center" }}>등록된 계좌가 없습니다.</div>
          : accountsData.map((d, i) => <AccountCard key={i} data={d} showKrw={showKrw} onOpen={() => onOpen(d)} />)}
    </div>
  );
}

function AccountCard({ data, onOpen, showKrw }) {
  const { acct, sum, bal } = data;
  const totalKrw = acctTotalKrw(sum);
  const totalUsd = sum.mv + sum.cashUsd + sum.cashKrw / FX_KRW_PER_USD;
  const pnlKrw = sum.pnl * FX_KRW_PER_USD;
  const fail = !bal;

  const totalFmt = showKrw ? fmtKrw(totalKrw) : fmtUsd(totalUsd);
  const pnlFmt = showKrw
    ? `${pnlKrw >= 0 ? "+" : "-"}₩${Math.abs(Math.round(pnlKrw)).toLocaleString()}`
    : fmtSigned(sum.pnl);

  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, padding: "16px 18px", marginBottom: 12, background: "white", boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>{acctLabel(acct)}</span>
          {acct.env === "REAL" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FEE2E2", color: "#b91c1c" }}>REAL</span>}
        </div>
        <MoreVertical size={16} color="#CBD5E1" />
      </div>
      <div style={{ textAlign: "right", marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{totalFmt}</div>
        {fail ? <div style={{ fontSize: 12, color: "#f59e0b" }}>잔고 조회 실패</div>
          : <div style={{ fontSize: 13, fontWeight: 700, color: pnlColor(sum.pnl) }}>{pnlFmt} ({fmtPct(sum.pct)})</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <CardBtn icon={<Receipt size={14} />} label="거래내역" onClick={onOpen} />
        <CardBtn icon={<ArrowRightLeft size={14} />} label="잔고" onClick={onOpen} />
        <CardBtn icon={<ShoppingCart size={14} />} label="주식주문" onClick={onOpen} primary />
      </div>
    </div>
  );
}

const CardBtn = ({ icon, label, onClick, primary }) => (
  <button onClick={onClick} style={{
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "9px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    border: primary ? "none" : "1px solid #E2E8F0",
    background: primary ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#F8FAFC",
    color: primary ? "white" : "#475569",
  }}>{icon}{label}</button>
);

/** 이미지2/3/4 — 계좌 상세(보유종목 표/카드 토글) */
function AccountDetail({ data, onBack, onOrder, showKrw }) {
  const { acct, sum } = data;
  const [mode, setMode] = useState("card");

  const totalKrw = acctTotalKrw(sum);
  const totalUsd = sum.mv + sum.cashUsd + sum.cashKrw / FX_KRW_PER_USD;
  const pnlKrw = sum.pnl * FX_KRW_PER_USD;

  const totalFmt = showKrw ? fmtKrw(totalKrw) : fmtUsd(totalUsd);
  const pnlFmt = showKrw
    ? `${pnlKrw >= 0 ? "+" : "-"}₩${Math.abs(Math.round(pnlKrw)).toLocaleString()}`
    : fmtSigned(sum.pnl);
  const pnlPctColor = sum.pnl >= 0 ? "#bbf7d0" : "#fecaca";

  return (
    <div>
      <div style={{ background: BRAND, borderRadius: 18, padding: "18px 22px", color: "white", marginBottom: 14 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 13, opacity: 0.9, marginBottom: 8, padding: 0 }}>
          <ChevronLeft size={16} /> 계좌 목록
        </button>
        <div style={{ fontSize: 14, opacity: 0.92, fontWeight: 600 }}>{acctLabel(acct)}</div>
        <div style={{ fontSize: 28, fontWeight: 800, margin: "2px 0" }}>{totalFmt}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: pnlPctColor }}>{pnlFmt} ({fmtPct(sum.pct)})</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setMode("card")} title="카드 보기" style={{ ...iconBtn, color: mode === "card" ? "#4f46e5" : "#94A3B8", background: mode === "card" ? "#EEF2FF" : "transparent" }}><LayoutGrid size={17} /></button>
        <button onClick={() => setMode("table")} title="표 보기" style={{ ...iconBtn, color: mode === "table" ? "#4f46e5" : "#94A3B8", background: mode === "table" ? "#EEF2FF" : "transparent" }}><List size={17} /></button>
      </div>

      {sum.positions.length === 0
        ? <div style={{ color: "#64748B", padding: 24, textAlign: "center" }}>보유 종목이 없습니다.</div>
        : mode === "card"
          ? sum.positions.map((p, i) => <HoldingCard key={i} p={p} showKrw={showKrw} brokerType={acct.brokerType} onClick={() => onOrder(p)} />)
          : <HoldingTable positions={sum.positions} showKrw={showKrw} onRow={onOrder} />}
    </div>
  );
}

function HoldingCard({ p, showKrw, brokerType, onClick }) {
  const isKrw = p.currency === "KRW";
  const kind = brokerType === "BINANCE" ? "크립토" : isKrw ? "국내주식" : "해외주식";
  const nameLabel = p.name && p.name !== p.ticker ? p.name : p.ticker;
  const codeLabel = p.name && p.name !== p.ticker ? `(${p.ticker})` : "";

  // mv / pnl 표시: showKrw=true면 모두 ₩, false면 모두 $
  const mv = showKrw
    ? fmtKrw(isKrw ? p.mv : p.mv * FX_KRW_PER_USD)
    : fmtUsd(isKrw ? p.mv / FX_KRW_PER_USD : p.mv);
  const pnlVal = isKrw ? p.pnl : p.pnl;
  const pnlDisplay = showKrw
    ? `${pnlVal >= 0 ? "+" : "-"}₩${Math.abs(Math.round(isKrw ? pnlVal : pnlVal * FX_KRW_PER_USD)).toLocaleString()}`
    : fmtSigned(isKrw ? pnlVal / FX_KRW_PER_USD : pnlVal);

  return (
    <div onClick={onClick} style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 10, background: "white", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>
          {nameLabel}<span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginLeft: 4 }}>{codeLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{kind} · {p.qty}{brokerType === "BINANCE" ? "" : "주"}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{mv}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: pnlColor(p.pnl) }}>{pnlDisplay} ({fmtPct(p.pct)})</div>
      </div>
    </div>
  );
}

function HoldingTable({ positions, showKrw, onRow }) {
  const th = { padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" };
  const td = { padding: "10px", fontSize: 12.5, textAlign: "right", borderTop: "1px solid #F1F5F9", whiteSpace: "nowrap" };

  const fmt = (v, isKrw) => showKrw
    ? fmtKrw(isKrw ? v : v * FX_KRW_PER_USD)
    : fmtUsd(isKrw ? v / FX_KRW_PER_USD : v);

  const fmtPnl = (p) => {
    const isKrw = p.currency === "KRW";
    const val = showKrw
      ? (isKrw ? p.pnl : p.pnl * FX_KRW_PER_USD)
      : (isKrw ? p.pnl / FX_KRW_PER_USD : p.pnl);
    return showKrw
      ? `${val >= 0 ? "+" : "-"}₩${Math.abs(Math.round(val)).toLocaleString()}`
      : fmtSigned(val);
  };

  return (
    <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead><tr style={{ background: "#F8FAFC" }}>
          <th style={{ ...th, textAlign: "left" }}>종목명</th>
          <th style={th}>보유수량</th>
          <th style={th}>매수단가</th>
          <th style={th}>현재가</th>
          <th style={th}>평가금액</th>
          <th style={th}>평가손익(수익률)</th>
        </tr></thead>
        <tbody>{positions.map((p, i) => {
          const isKrw = p.currency === "KRW";
          return (
            <tr key={i} onClick={() => onRow(p)} style={{ cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <td style={{ ...td, textAlign: "left", fontWeight: 700, color: "#0f172a" }}>
                {p.name && p.name !== p.ticker ? p.name : p.ticker}
                <span style={{ fontSize: 10, marginLeft: 4, color: "#64748B", fontWeight: 500 }}>
                  {p.name && p.name !== p.ticker ? `(${p.ticker})` : ""}
                </span>
                {isKrw && <span style={{ fontSize: 10, marginLeft: 4, color: "#6366f1", fontWeight: 600 }}>KRW</span>}
              </td>
              <td style={td}>{p.qty}</td>
              <td style={td}>{fmt(p.avg, isKrw)}</td>
              <td style={td}>{fmt(p.now, isKrw)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{fmt(p.mv, isKrw)}</td>
              <td style={{ ...td, color: pnlColor(p.pnl), fontWeight: 700 }}>
                {fmtPnl(p)}<br /><span style={{ fontSize: 11 }}>({fmtPct(p.pct)})</span>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#64748B", cursor: "pointer" };
