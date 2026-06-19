import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listProposals } from "../alphaApi";
import { acctLabel, FX_KRW_PER_USD } from "./util";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SIDE_KO = { BUY: "매수", SELL: "매도" };

/** 매매 내역: 국내/해외 + 계좌 드롭다운 + (당일체결/기간체결) + 필터 + 표 */
export default function TradesTab({ accountsData, initialAcctId }) {
  const accts = accountsData.map((d) => d.acct);
  const [region, setRegion] = useState("해외");
  const [acctId, setAcctId] = useState(initialAcctId ? String(initialAcctId) : "");
  const [mode, setMode] = useState("당일체결");
  const [fillKind, setFillKind] = useState("전체");
  const [sideKind, setSideKind] = useState("전체");
  const [curMode, setCurMode] = useState("원화");          // 기본값 원화
  const [day, setDay] = useState(todayStr());
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState(null);

  useEffect(() => { if (!acctId && accts.length) setAcctId(String(accts[0].id)); }, [accts, acctId]);
  useEffect(() => {
    let alive = true;
    listProposals().then((r) => alive && setOrders(Array.isArray(r) ? r : [])).catch(() => alive && setOrders([]));
    return () => { alive = false; };
  }, []);

  // USD 기준 가격 → 통화 설정에 따라 포맷
  const fmtPrice = (v) => {
    if (v == null) return "-";
    if (curMode === "원화") return `₩${Math.round(Number(v) * FX_KRW_PER_USD).toLocaleString("ko-KR")}`;
    return `$${Number(v).toFixed(2)}`;
  };

  const rows = useMemo(() => {
    if (!orders) return null;
    return orders
      .filter((p) => String(p.brokerAccountId) === String(acctId))
      .filter((p) => {
        const d = (p.createdAt || "").slice(0, 10);
        if (mode === "당일체결") return d === day;
        return (!from || d >= from) && (!to || d <= to);
      })
      .filter((p) => {
        const filled = p.status === "EXECUTED" || p.fillStatus === "FILLED";
        if (fillKind === "체결") return filled;
        if (fillKind === "미체결") return !filled;
        return true;
      })
      .filter((p) => sideKind === "전체" || SIDE_KO[p.side] === sideKind)
      .filter((p) => !q || String(p.ticker || "").toUpperCase().includes(q.toUpperCase()))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, acctId, mode, day, from, to, fillKind, sideKind, q]);

  const seg = (val, set, opts) => (
    <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
      {opts.map((o) => <button key={o} onClick={() => set(o)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: val === o ? "white" : "transparent", color: val === o ? "#4f46e5" : "#94a3b8" }}>{o}</button>)}
    </div>
  );
  const td = { padding: "9px 10px", fontSize: 12, textAlign: "right", borderTop: "1px solid #F1F5F9", whiteSpace: "nowrap" };
  const th = { padding: "8px 10px", fontSize: 10.5, color: "#94A3B8", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {seg(region, setRegion, ["국내", "해외"])}
        <select value={acctId} onChange={(e) => setAcctId(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 9, border: "1px solid #E2E8F0", background: "white", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          {accts.length === 0 && <option>계좌 없음</option>}
          {accts.map((a) => <option key={a.id} value={a.id}>{acctLabel(a)} (#{a.id})</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #E2E8F0", marginBottom: 14 }}>
        {["당일체결", "기간체결"].map((s) => (
          <button key={s} onClick={() => setMode(s)} style={{ padding: "8px 2px", background: "none", border: "none", borderBottom: `2px solid ${mode === s ? "#4f46e5" : "transparent"}`, color: mode === s ? "#0f172a" : "#94a3b8", fontSize: 14, fontWeight: mode === s ? 800 : 600, cursor: "pointer", marginBottom: -1 }}>{s}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap", background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
        {seg(curMode, setCurMode, ["원화", "외화"])}
        <span style={{ fontSize: 11.5, color: "#64748b" }}>체결</span>{seg(fillKind, setFillKind, ["전체", "체결", "미체결"])}
        <span style={{ fontSize: 11.5, color: "#64748b" }}>구분</span>{seg(sideKind, setSideKind, ["전체", "매수", "매도"])}
        {mode === "당일체결"
          ? <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={dateInput} />
          : <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} /><span style={{ color: "#94a3b8" }}>~</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} /></>}
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "white", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 9px", flex: 1, minWidth: 140 }}>
          <Search size={13} color="#94a3b8" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="종목검색" style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%", background: "transparent" }} />
        </div>
      </div>

      {rows === null ? <div style={{ color: "#64748b", padding: 20 }}>불러오는 중…</div>
        : rows.length === 0 ? <div style={{ color: "#64748b", padding: 40, textAlign: "center", fontWeight: 600 }}>조회할 내역(자료)이 없습니다.</div>
          : (
            <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, background: "white" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead><tr style={{ background: "#F8FAFC" }}>
                  <th style={{ ...th, textAlign: "left" }}>종목</th>
                  <th style={th}>주문구분</th>
                  <th style={th}>주문수량</th>
                  <th style={th}>주문단가</th>
                  <th style={th}>체결수량</th>
                  <th style={th}>체결단가</th>
                  <th style={th}>미체결수량</th>
                  <th style={th}>주문시간</th>
                </tr></thead>
                <tbody>{rows.map((p, i) => {
                  const filled = p.status === "EXECUTED" || p.fillStatus === "FILLED";
                  const qty = Number(p.qtyDecimal ?? p.qty ?? 0);
                  const limitPrice = p.limitPrice != null ? Number(p.limitPrice) : null;
                  const fillAvgPrice = p.fillAvgPrice != null ? Number(p.fillAvgPrice) : null;
                  const filledQty = p.filledQtyDecimal != null ? Number(p.filledQtyDecimal)
                                  : p.filledQty != null ? Number(p.filledQty) : null;
                  const remainQty = filledQty != null ? Math.max(0, qty - filledQty) : (filled ? 0 : qty);
                  const nameLabel = p.stockName ? `${p.stockName}(${p.ticker})` : p.ticker;
                  const ordPriceDisplay = limitPrice != null ? fmtPrice(limitPrice) : "시장가";
                  const fillPriceDisplay = fillAvgPrice != null
                    ? fmtPrice(fillAvgPrice)
                    : (filled && limitPrice != null ? fmtPrice(limitPrice) : "-");

                  return (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{nameLabel}</td>
                      <td style={{ ...td, color: p.side === "BUY" ? "#16a34a" : "#dc2626", fontWeight: 700 }}>{SIDE_KO[p.side] || p.side}</td>
                      <td style={td}>{qty}</td>
                      <td style={td}>{ordPriceDisplay}</td>
                      <td style={td}>{filledQty != null ? filledQty : (filled ? qty : 0)}</td>
                      <td style={{ ...td, fontWeight: fillPriceDisplay !== "-" ? 600 : undefined }}>{fillPriceDisplay}</td>
                      <td style={td}>{remainQty}</td>
                      <td style={td}>{p.createdAt ? new Date(p.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
    </div>
  );
}

const dateInput = { padding: "6px 8px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", fontSize: 12.5, color: "#0f172a" };
