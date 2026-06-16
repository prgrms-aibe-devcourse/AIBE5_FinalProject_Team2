import { useEffect, useMemo, useState } from "react";
import { listProposals } from "../alphaApi";
import { pnlColor, fmtPct, FX_KRW_PER_USD, acctLabel, BROKER_NAME, ENV_LABEL } from "./util";

const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/** 이미지6 — 잔고·손익: 국내/해외 + 계좌 드롭다운 + (잔고/실현손익/실현손익추이) + 기간·원화/외화 */
export default function BalancePnlTab({ accountsData }) {
  const [region, setRegion] = useState("해외");           // 국내 | 해외 (우리 자산은 대부분 해외)
  const [acctId, setAcctId] = useState("");
  const [sub, setSub] = useState("실현손익");             // 잔고 | 실현손익 | 실현손익추이
  const [curMode, setCurMode] = useState("외화");          // 외화 | 원화
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState(null);

  // region 필터: 국내=(없음/KIS국내), 해외=KIS해외+Binance. 현재 시스템은 전부 해외.
  const accts = accountsData.map((d) => d.acct);
  useEffect(() => { if (!acctId && accts.length) setAcctId(String(accts[0].id)); }, [accts, acctId]);

  useEffect(() => {
    let alive = true;
    listProposals().then((r) => { if (alive) setOrders(Array.isArray(r) ? r : []); }).catch(() => alive && setOrders([]));
    return () => { alive = false; };
  }, []);

  const acct = accts.find((a) => String(a.id) === String(acctId));
  const data = accountsData.find((d) => String(d.acct.id) === String(acctId));
  const fx = curMode === "원화" ? FX_KRW_PER_USD : 1;
  const unit = curMode === "원화" ? "₩" : "$";
  const fmtMoney = (v) => `${v < 0 ? "-" : ""}${unit}${Math.abs((Number(v) || 0) * fx).toLocaleString(undefined, { maximumFractionDigits: curMode === "원화" ? 0 : 2 })}`;

  // 선택 계좌의 체결 주문 → FIFO 청산 + 기간 필터
  const realized = useMemo(() => {
    if (!orders || !acct) return { total: 0, byTicker: [], closed: [] };
    const list = orders
      .filter((p) => String(p.brokerAccountId) === String(acct.id) && (p.status === "EXECUTED" || p.fillStatus === "FILLED"))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const lots = {}; const closed = [];
    for (const o of list) {
      const t = o.ticker; const qty = Number(o.qtyDecimal ?? o.qty); const price = Number(o.limitPrice);
      if (!t || !(qty > 0) || !(price >= 0)) continue;
      if (o.side === "BUY") (lots[t] = lots[t] || []).push({ qty, price, stockName: o.stockName });
      else if (o.side === "SELL") {
        let remain = qty; const q = lots[t] || [];
        const sn = o.stockName || (q[0] && q[0].stockName) || null;
        while (remain > 1e-9 && q.length) {
          const lot = q[0]; const m = Math.min(remain, lot.qty);
          closed.push({ ticker: t, stockName: sn || lot.stockName || null, qty: m, buy: lot.price, sell: price, pnl: (price - lot.price) * m, date: (o.createdAt || "").slice(0, 10) });
          lot.qty -= m; remain -= m; if (lot.qty <= 1e-9) q.shift();
        }
      }
    }
    const inRange = closed.filter((c) => (!from || c.date >= from) && (!to || c.date <= to));
    const byMap = {};
    for (const c of inRange) {
      byMap[c.ticker] = byMap[c.ticker] || { ticker: c.ticker, stockName: c.stockName || null, pnl: 0, qty: 0, sellAmt: 0, buyAmt: 0 };
      if (!byMap[c.ticker].stockName && c.stockName) byMap[c.ticker].stockName = c.stockName;
      byMap[c.ticker].pnl += c.pnl; byMap[c.ticker].qty += c.qty; byMap[c.ticker].sellAmt += c.sell * c.qty; byMap[c.ticker].buyAmt += c.buy * c.qty;
    }
    const byTicker = Object.values(byMap).map((r) => ({ ...r, sellAvg: r.sellAmt / r.qty, buyAvg: r.buyAmt / r.qty, pct: r.buyAmt > 0 ? (r.pnl / r.buyAmt) * 100 : 0 }));
    return { total: inRange.reduce((s, c) => s + c.pnl, 0), byTicker, closed: inRange };
  }, [orders, acct, from, to]);

  const seg = (val, set, opts) => (
    <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
      {opts.map((o) => <button key={o} onClick={() => set(o)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: val === o ? "white" : "transparent", color: val === o ? "#4f46e5" : "#94a3b8", boxShadow: val === o ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{o}</button>)}
    </div>
  );

  return (
    <div>
      {/* 국내/해외 + 계좌 드롭다운 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {seg(region, setRegion, ["국내", "해외"])}
        <select value={acctId} onChange={(e) => setAcctId(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 9, border: "1px solid #E2E8F0", background: "white", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          {accts.length === 0 && <option>계좌 없음</option>}
          {accts.map((a) => <option key={a.id} value={a.id}>{acctLabel(a)} (#{a.id})</option>)}
        </select>
      </div>

      {/* 세부 탭 */}
      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #E2E8F0", marginBottom: 14 }}>
        {["잔고", "실현손익", "실현손익추이"].map((s) => (
          <button key={s} onClick={() => setSub(s)} style={{ padding: "8px 2px", background: "none", border: "none", borderBottom: `2px solid ${sub === s ? "#4f46e5" : "transparent"}`, color: sub === s ? "#0f172a" : "#94a3b8", fontSize: 14, fontWeight: sub === s ? 800 : 600, cursor: "pointer", marginBottom: -1 }}>{s}</button>
        ))}
      </div>

      {/* 필터: 외화/원화 + 기간 */}
      {sub !== "잔고" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap", background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
          {seg(curMode, setCurMode, ["외화", "원화"])}
          <span style={{ fontSize: 12, color: "#64748b" }}>기간</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
          <span style={{ color: "#94a3b8" }}>~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} />
        </div>
      )}

      {!data ? <div style={{ color: "#64748b", padding: 20 }}>계좌를 선택하세요.</div>
        : sub === "잔고" ? <BalanceSub data={data} />
          : sub === "실현손익" ? <RealizedSub realized={realized} fmtMoney={fmtMoney} />
            : <TrendSub realized={realized} fmtMoney={fmtMoney} />}
    </div>
  );
}

function BalanceSub({ data }) {
  const td = { padding: "10px", fontSize: 12.5, textAlign: "right", borderTop: "1px solid #F1F5F9" };
  const th = { padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "right" };
  if (!data.sum.positions.length) return <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>보유 종목이 없습니다.</div>;
  return (
    <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead><tr style={{ background: "#F8FAFC" }}><th style={{ ...th, textAlign: "left" }}>종목명</th><th style={th}>보유수량</th><th style={th}>매수단가</th><th style={th}>현재가</th><th style={th}>평가금액</th><th style={th}>평가손익</th></tr></thead>
        <tbody>{data.sum.positions.map((p, i) => {
          const isKrw = p.currency === "KRW";
          const f = (v) => isKrw
            ? `₩${Math.round(v).toLocaleString("ko-KR")}`
            : `$${Number(v).toFixed(2)}`;
          const fPnl = (v) => isKrw
            ? `${v >= 0 ? "+" : "-"}₩${Math.abs(Math.round(v)).toLocaleString("ko-KR")}`
            : `${v >= 0 ? "+" : ""}$${Number(v).toFixed(2)}`;
          const nameLabel = p.name && p.name !== p.ticker ? p.name : p.ticker;
          const codeLabel = p.name && p.name !== p.ticker ? ` (${p.ticker})` : "";
          return (
            <tr key={i}>
              <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>
                {nameLabel}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>{codeLabel}</span>
                {isKrw && <span style={{ fontSize: 10, marginLeft: 4, color: "#6366f1", fontWeight: 600 }}>KRW</span>}
              </td>
              <td style={td}>{p.qty}</td>
              <td style={td}>{f(p.avg)}</td>
              <td style={td}>{f(p.now)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{f(p.mv)}</td>
              <td style={{ ...td, color: pnlColor(p.pnl), fontWeight: 700 }}>
                {fPnl(p.pnl)}<br /><span style={{ fontSize: 11 }}>({fmtPct(p.pct)})</span>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function RealizedSub({ realized, fmtMoney }) {
  const td = { padding: "10px", fontSize: 12.5, textAlign: "right", borderTop: "1px solid #F1F5F9" };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 4px 16px" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>실현손익</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: pnlColor(realized.total) }}>{fmtMoney(realized.total)}</span>
      </div>
      {realized.byTicker.length === 0 ? <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>해당 기간 실현손익 내역이 없습니다.</div> : (
        <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr style={{ background: "#F8FAFC" }}><th style={{ padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "left" }}>종목명</th><th style={{ padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "right" }}>순손익금액(수익률)</th><th style={{ padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "right" }}>매도평균가</th><th style={{ padding: "8px 10px", fontSize: 11, color: "#94A3B8", fontWeight: 700, textAlign: "right" }}>매수평균가</th></tr></thead>
            <tbody>{realized.byTicker.map((r, i) => {
              const nameLabel = r.stockName ? r.stockName : r.ticker;
              const codeLabel = r.stockName ? ` (${r.ticker})` : "";
              return (
                <tr key={i}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>
                    {nameLabel}<span style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>{codeLabel}</span>
                  </td>
                  <td style={{ ...td, color: pnlColor(r.pnl), fontWeight: 700 }}>{fmtMoney(r.pnl)}<br /><span style={{ fontSize: 11 }}>({fmtPct(r.pct)})</span></td>
                  <td style={td}>${r.sellAvg.toFixed(2)}</td>
                  <td style={td}>${r.buyAvg.toFixed(2)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrendSub({ realized, fmtMoney }) {
  // 청산 내역을 일자순 누적 → 막대 추이
  const sorted = [...realized.closed].sort((a, b) => (a.date < b.date ? -1 : 1));
  let acc = 0; const pts = sorted.map((c) => { acc += c.pnl; return { date: c.date, cum: acc, pnl: c.pnl }; });
  if (pts.length === 0) return <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>해당 기간 실현손익 추이가 없습니다.</div>;
  const max = Math.max(1, ...pts.map((p) => Math.abs(p.cum)));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 4px 16px" }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>실현손익 추이 (누적)</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: pnlColor(acc) }}>{fmtMoney(acc)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, padding: "0 4px", borderBottom: "1px solid #E2E8F0" }}>
        {pts.map((p, i) => (
          <div key={i} title={`${p.date}: 누적 ${fmtMoney(p.cum)}`} style={{ flex: 1, minWidth: 6, height: `${(Math.abs(p.cum) / max) * 100}%`, background: p.cum >= 0 ? "#16a34a" : "#dc2626", borderRadius: "3px 3px 0 0", alignSelf: p.cum >= 0 ? "flex-end" : "flex-start" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#94a3b8", marginTop: 6 }}>
        <span>{pts[0].date}</span><span>{pts[pts.length - 1].date}</span>
      </div>
    </div>
  );
}

const dateInput = { padding: "6px 8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", fontSize: 12.5, color: "#0f172a" };
