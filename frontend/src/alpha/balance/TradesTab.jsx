import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { listProposals, getBrokerQuote } from "../alphaApi";
import { acctLabel } from "./util";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const SIDE_KO = { BUY: "매수", SELL: "매도" };
const isDomestic = (ticker) => /^\d{6}$/.test(ticker ?? "");

// 국내 주요 종목 이름 (stockName이 null인 기존 주문 대비 fallback)
const KR_NAMES = {
  "005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER",
  "005380": "현대차", "000270": "기아", "006400": "삼성SDI",
  "051910": "LG화학", "035720": "카카오", "105560": "KB금융",
  "055550": "신한지주", "028260": "삼성물산", "207940": "삼성바이오로직스",
  "003670": "포스코홀딩스", "068270": "셀트리온", "096770": "SK이노베이션",
  "034730": "SK", "012330": "현대모비스", "066570": "LG전자",
  "032830": "삼성생명", "018260": "삼성에스디에스", "003550": "LG",
  "017670": "SK텔레콤", "030200": "KT", "015760": "한국전력",
  "011200": "HMM", "009150": "삼성전기", "000100": "유한양행",
};

/** 국내: KRW 그대로, 해외: USD */
const fmtPrice = (v, ticker) => {
  if (v == null) return "-";
  if (isDomestic(ticker))
    return `₩${Math.round(Number(v)).toLocaleString("ko-KR")}`;
  return `$${Number(v).toFixed(2)}`;
};

/** 종목 표시명: stockName → KR_NAMES → ticker */
const stockLabel = (p) => {
  const name = p.stockName || KR_NAMES[p.ticker];
  return name ? `${name}(${p.ticker})` : p.ticker;
};

/** 매매 내역: 계좌 드롭다운 + 국내/해외/전체 필터 + (당일체결/기간체결) + 표 */
export default function TradesTab({ accountsData, initialAcctId }) {
  const accts = accountsData.map((d) => d.acct);
  const [acctId, setAcctId] = useState(initialAcctId ? String(initialAcctId) : "");
  const [mode, setMode] = useState("당일체결");
  const [market, setMarket] = useState("전체");   // 전체 | 국내 | 해외
  const [fillKind, setFillKind] = useState("전체");
  const [sideKind, setSideKind] = useState("전체");
  const [day, setDay] = useState(todayStr());
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState(null);
  const [quoteCache, setQuoteCache] = useState({});

  useEffect(() => { if (!acctId && accts.length) setAcctId(String(accts[0].id)); }, [accts, acctId]);
  useEffect(() => {
    let alive = true;
    listProposals().then((r) => alive && setOrders(Array.isArray(r) ? r : [])).catch(() => alive && setOrders([]));
    return () => { alive = false; };
  }, []);

  // 체결된 시장가 주문 중 fillAvgPrice 없는 건 → 현재 시세 조회 (해외만 실제 조회됨)
  useEffect(() => {
    if (!orders || !acctId) return;
    const acctData = accountsData.find((d) => String(d.acct.id) === String(acctId));
    if (!acctData) return;
    const { env, brokerType } = acctData.acct;
    const tickers = [...new Set(
      orders
        .filter((p) => String(p.brokerAccountId) === String(acctId)
          && (p.status === "EXECUTED" || p.fillStatus === "FILLED")
          && p.fillAvgPrice == null && p.limitPrice == null && p.ticker)
        .map((p) => p.ticker)
    )];
    if (!tickers.length) return;
    let alive = true;
    (async () => {
      const results = {};
      await Promise.all(tickers.map(async (ticker) => {
        try {
          const res = await getBrokerQuote(env, ticker, brokerType);
          if (res?.last_price > 0) results[ticker] = Number(res.last_price);
        } catch (_) {}
      }));
      if (alive) setQuoteCache((prev) => ({ ...prev, ...results }));
    })();
    return () => { alive = false; };
  }, [orders, acctId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!orders) return null;
    return orders
      .filter((p) => String(p.brokerAccountId) === String(acctId))
      .filter((p) => {
        if (market === "국내") return isDomestic(p.ticker);
        if (market === "해외") return !isDomestic(p.ticker);
        return true;
      })
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
      .filter((p) => !q || String(p.ticker || "").toUpperCase().includes(q.toUpperCase())
        || String(p.stockName || KR_NAMES[p.ticker] || "").includes(q))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, acctId, market, mode, day, from, to, fillKind, sideKind, q]);

  const seg = (val, set, opts) => (
    <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
      {opts.map((o) => <button key={o} onClick={() => set(o)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: val === o ? "white" : "transparent", color: val === o ? "#4f46e5" : "#94a3b8" }}>{o}</button>)}
    </div>
  );
  const td = { padding: "9px 10px", fontSize: 12, textAlign: "right", borderTop: "1px solid #F1F5F9", whiteSpace: "nowrap" };
  const th = { padding: "8px 10px", fontSize: 10.5, color: "#94A3B8", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div>
      {/* 계좌 선택 */}
      <div style={{ marginBottom: 12 }}>
        <select value={acctId} onChange={(e) => setAcctId(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 9, border: "1px solid #E2E8F0", background: "white", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          {accts.length === 0 && <option>계좌 없음</option>}
          {accts.map((a) => <option key={a.id} value={a.id}>{acctLabel(a)} (#{a.id})</option>)}
        </select>
      </div>

      {/* 당일/기간 탭 */}
      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #E2E8F0", marginBottom: 14 }}>
        {["당일체결", "기간체결"].map((s) => (
          <button key={s} onClick={() => setMode(s)} style={{ padding: "8px 2px", background: "none", border: "none", borderBottom: `2px solid ${mode === s ? "#4f46e5" : "transparent"}`, color: mode === s ? "#0f172a" : "#94a3b8", fontSize: 14, fontWeight: mode === s ? 800 : 600, cursor: "pointer", marginBottom: -1 }}>{s}</button>
        ))}
      </div>

      {/* 필터 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap", background: "#F8FAFC", padding: "10px 12px", borderRadius: 10 }}>
        {seg(market, setMarket, ["전체", "국내", "해외"])}
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
                  const cachedPrice = quoteCache[p.ticker];
                  const ordPriceDisplay = limitPrice != null ? fmtPrice(limitPrice, p.ticker) : "시장가";
                  const fillPriceDisplay = fillAvgPrice != null
                    ? fmtPrice(fillAvgPrice, p.ticker)
                    : filled && limitPrice != null ? fmtPrice(limitPrice, p.ticker)
                    : filled && cachedPrice != null ? `${fmtPrice(cachedPrice, p.ticker)} *`
                    : "-";

                  return (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{stockLabel(p)}</td>
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
