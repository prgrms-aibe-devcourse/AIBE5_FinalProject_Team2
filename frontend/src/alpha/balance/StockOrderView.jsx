import { useEffect, useState } from "react";
import { ChevronLeft, Loader, CheckCircle2 } from "lucide-react";
import { getBrokerQuote, createProposal, getDatasetPreview } from "../alphaApi";
import { BRAND, pnlColor, fmtUsd, fmtPct, acctLabel, acctCurrency } from "./util";
import CandleChart from "./CandleChart";

/** 이미지5/55 — 종목 주문(현재가 + 매수/매도 폼). 제출은 OrderProposal 생성(승인/자동체결 파이프라인). */
export default function StockOrderView({ acct, position, onBack, onReload }) {
  const ticker = position?.ticker;
  const cur = acctCurrency(acct.brokerType);
  const [quote, setQuote] = useState(null);
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("LIMIT"); // LIMIT | MARKET
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [candles, setCandles] = useState(null);

  useEffect(() => {
    let alive = true;
    setQuote(null);
    getBrokerQuote(acct.env, ticker, acct.brokerType)
      .then((q) => { if (alive) { setQuote(q); if (!price) setPrice(String(q?.last_price ?? position?.now ?? "")); } })
      .catch(() => { if (alive) setQuote({ last_price: position?.now || 0, err: true }); });
    // 캔들 차트용 OHLCV (실데이터 · 캐시) — KIS=US주식, Binance=크립토
    setCandles(null);
    const dsId = acct.brokerType === "BINANCE" ? "binance_crypto" : "yf_us_equity";
    const sym = acct.brokerType === "BINANCE" ? `${String(ticker).toUpperCase()}USDT`.replace(/USDTUSDT$/, "USDT") : ticker;
    getDatasetPreview(dsId, sym, 260)
      .then((r) => { if (alive) setCandles((r?.rows || []).map(x => ({ date: x.date || x.timestamp, open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume })).sort((a, b) => String(a.date).localeCompare(String(b.date)))); })
      .catch(() => { if (alive) setCandles([]); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, acct.env, acct.brokerType]);

  const last = Number(quote?.last_price ?? position?.now ?? 0);
  const chg = Number(quote?.change_rate_pct ?? 0);
  const amount = (Number(price) || 0) * (Number(qty) || 0);
  const isBuy = side === "BUY";

  const submit = async () => {
    if (!qty || Number(qty) <= 0) { setMsg({ type: "err", text: "수량을 입력하세요." }); return; }
    if (orderType === "LIMIT" && (!price || Number(price) <= 0)) { setMsg({ type: "err", text: "지정가를 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    try {
      await createProposal({
        brokerAccountId: Number(acct.id),
        ticker: String(ticker).toUpperCase(),
        side,
        qty: String(qty),
        ...(orderType !== "MARKET" && price ? { limitPrice: String(price) } : {}),
      });
      setMsg({ type: "ok", text: `${isBuy ? "매수" : "매도"} 주문 제안 생성 — '주문 제안' 큐에서 승인/자동체결됩니다.` });
      setQty("");
      onReload?.();
    } catch (e) {
      setMsg({ type: "err", text: "주문 생성 실패: " + (e?.response?.data?.error || e.message) });
    } finally { setBusy(false); }
  };

  const pct100 = (frac) => { /* 보유/가능 수량 기반 비율 — 매도 시 보유수량 기준 */
    if (!isBuy && position?.qty) setQty(String(Math.floor(position.qty * frac)));
  };

  const inputBox = { width: "100%", background: "#0d1117", border: "1px solid #2a3441", borderRadius: 8, color: "#E5E7EB", fontSize: 15, padding: "10px 12px", textAlign: "right" };
  const stepBtn = { width: 38, flexShrink: 0, background: "#1f2733", border: "1px solid #2a3441", borderRadius: 8, color: "#cbd5e1", fontSize: 18, cursor: "pointer" };

  return (
    <div>
      <div style={{ background: BRAND, borderRadius: 18, padding: "18px 22px", color: "white", marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 13, opacity: 0.9, marginBottom: 8, padding: 0 }}>
          <ChevronLeft size={16} /> 보유 종목
        </button>
        <div style={{ fontSize: 12.5, opacity: 0.9 }}>{acctLabel(acct)} · {position?.name || ticker}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>{quote ? fmtUsd(last) : "…"}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: chg >= 0 ? "#bbf7d0" : "#fecaca" }}>{fmtPct(chg)}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{cur}</span>
        </div>
        {position?.qty ? <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>보유 {position.qty} · 평가손익 <b style={{ color: position.pnl >= 0 ? "#bbf7d0" : "#fecaca" }}>{fmtUsd(position.pnl)} ({fmtPct(position.pct)})</b></div> : null}
      </div>

      {/* 캔들 차트 (증권사 스타일 · BB·MA·거래량·크로스헤어) */}
      <div style={{ background: "#161b22", border: "1px solid #2a3441", borderRadius: 14, padding: "14px 14px 10px", marginBottom: 14 }}>
        {candles === null
          ? <div style={{ padding: 36, textAlign: "center", color: "#64748b", fontSize: 12 }}>차트 불러오는 중…</div>
          : candles.length < 2
            ? <div style={{ padding: 36, textAlign: "center", color: "#64748b", fontSize: 12 }}>이 종목의 차트 데이터를 찾을 수 없습니다.</div>
            : <CandleChart data={candles} />}
      </div>

      <div style={{ background: "#161b22", border: "1px solid #2a3441", borderRadius: 14, padding: 18 }}>
        {/* 매수/매도 토글 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["BUY", "매수", "#dc2626"], ["SELL", "매도", "#2563eb"]].map(([v, label, c]) => (
            <button key={v} onClick={() => setSide(v)} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", fontSize: 14.5, fontWeight: 800, cursor: "pointer", background: side === v ? c : "#1f2733", color: side === v ? "white" : "#94a3b8" }}>{label}</button>
          ))}
        </div>

        {/* 주문유형 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["LIMIT", "지정가"], ["MARKET", "시장가"]].map(([v, label]) => (
            <button key={v} onClick={() => setOrderType(v)} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${orderType === v ? "#6366f1" : "#2a3441"}`, background: orderType === v ? "rgba(99,102,241,0.15)" : "transparent", color: orderType === v ? "#a5b4fc" : "#94a3b8", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
          ))}
        </div>

        {/* 단가 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>단가 ({cur})</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={stepBtn} onClick={() => setPrice((p) => String(Math.max(0, (Number(p) || 0) - 0.01).toFixed(2)))} disabled={orderType === "MARKET"}>−</button>
            <input style={{ ...inputBox, opacity: orderType === "MARKET" ? 0.5 : 1 }} value={orderType === "MARKET" ? "시장가" : price} disabled={orderType === "MARKET"} onChange={(e) => setPrice(e.target.value)} placeholder="단가 입력" inputMode="decimal" />
            <button style={stepBtn} onClick={() => setPrice((p) => String(((Number(p) || 0) + 0.01).toFixed(2)))} disabled={orderType === "MARKET"}>+</button>
          </div>
        </div>

        {/* 수량 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>수량</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={stepBtn} onClick={() => setQty((q) => String(Math.max(0, (Number(q) || 0) - 1)))}>−</button>
            <input style={inputBox} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="수량 입력" inputMode="decimal" />
            <button style={stepBtn} onClick={() => setQty((q) => String((Number(q) || 0) + 1))}>+</button>
          </div>
          {!isBuy && position?.qty ? (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[0.25, 0.5, 1].map((f) => <button key={f} onClick={() => pct100(f)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #2a3441", background: "transparent", color: "#94a3b8", fontSize: 11.5, cursor: "pointer" }}>{f === 1 ? "전량" : `${f * 100}%`}</button>)}
            </div>
          ) : null}
        </div>

        {/* 금액 */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#0d1117", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: "#94a3b8" }}>예상 금액</span>
          <b style={{ color: "#E5E7EB" }}>{fmtUsd(amount)} {cur}</b>
        </div>

        {msg && <div style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12.5, background: msg.type === "err" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)", color: msg.type === "err" ? "#fca5a5" : "#86efac" }}>{msg.type === "ok" && <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}{msg.text}</div>}

        <button onClick={submit} disabled={busy} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : "pointer", color: "white", background: busy ? "#475569" : (isBuy ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#3b82f6,#2563eb)"), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {busy && <Loader size={15} style={{ animation: "spin 1s linear infinite" }} />}
          {isBuy ? "매수 주문" : "매도 주문"}
        </button>
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 8, textAlign: "center" }}>주문은 OrderProposal 로 생성되어 안전게이트(매매 스위치·한도·kill-switch) 통과 후 체결됩니다.</div>
      </div>
    </div>
  );
}
