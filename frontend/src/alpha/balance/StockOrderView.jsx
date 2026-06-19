import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader, CheckCircle2 } from "lucide-react";
import { getBrokerQuote, createProposal, getDatasetPreview, getKrDailyChart } from "../alphaApi";
import { BRAND, fmtUsd, fmtPct, acctLabel, acctCurrency } from "./util";
import CandleChart from "./CandleChart";
import { TICKER_LIST, CRYPTO_LIST, ORDER_TYPES, LIMIT_SUB_TYPES } from "../stockList";

const isKrTicker = (tk) => /^\d+$/.test(String(tk));

/** 이미지5/55 — 종목 주문(현재가 + 매수/매도 폼). 제출은 OrderProposal 생성(승인/자동체결 파이프라인). */
export default function StockOrderView({ acct, position, onBack, onReload }) {
  const cur = acctCurrency(acct.brokerType);
  const stockList = acct.brokerType === "BINANCE" ? CRYPTO_LIST : TICKER_LIST;

  const [ticker, setTicker] = useState(position?.ticker || "");
  const [tickerInput, setTickerInput] = useState(position?.ticker || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quote, setQuote] = useState(null);
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("LIMIT");
  const [kisSubType, setKisSubType] = useState("정규장");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [candles, setCandles] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Autocomplete: derived from tickerInput vs confirmed ticker
  const suggestions = (showSuggestions && tickerInput && ticker !== tickerInput)
    ? stockList.filter(s => {
        const q = tickerInput.toLowerCase();
        return s.value.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Quote + candle fetch
  useEffect(() => {
    if (!ticker) { setQuote(null); setCandles([]); return; }
    let alive = true;
    setQuote(null);
    getBrokerQuote(acct.env, ticker, acct.brokerType)
      .then((q) => { if (alive) { setQuote(q); if (!price) setPrice(String(q?.last_price ?? position?.now ?? "")); } })
      .catch(() => { if (alive) setQuote({ last_price: position?.now || 0, err: true }); });

    setCandles(null);
    if (acct.brokerType === "BINANCE") {
      const sym = `${String(ticker).toUpperCase()}USDT`.replace(/USDTUSDT$/, "USDT");
      getDatasetPreview("binance_crypto", sym, 120)
        .then((r) => {
          if (alive) setCandles(
            (r?.rows || [])
              .map(x => ({ date: x.date || x.timestamp, open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume }))
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          );
        })
        .catch(() => { if (alive) setCandles([]); });
    } else if (isKrTicker(ticker)) {
      // 국내주식: KIS API 직접 호출 (yfinance 의존 없음)
      getKrDailyChart(acct.env, ticker, 100)
        .then((rows) => { if (alive) setCandles(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (alive) setCandles([]); });
    } else {
      getDatasetPreview("yf_us_equity", ticker, 120)
        .then((r) => {
          if (alive) setCandles(
            (r?.rows || [])
              .map(x => ({ date: x.date, open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume }))
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          );
        })
        .catch(() => { if (alive) setCandles([]); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, acct.env, acct.brokerType]);

  const confirmTicker = (val) => {
    const v = val.trim().toUpperCase();
    setTickerInput(v);
    setTicker(v);
    setShowSuggestions(false);
  };

  const last = Number(quote?.last_price ?? position?.now ?? 0);
  const chg = Number(quote?.change_rate_pct ?? 0);
  const amount = (Number(price) || 0) * (Number(qty) || 0);
  const isBuy = side === "BUY";
  const isKis = acct.brokerType !== "BINANCE";
  const accentColor = isBuy ? "#ef4444" : "#3b82f6";

  const submit = async () => {
    if (!ticker) { setMsg({ type: "err", text: "종목을 입력하세요." }); return; }
    if (!qty || Number(qty) <= 0) { setMsg({ type: "err", text: "수량을 입력하세요." }); return; }
    if (orderType === "LIMIT" && (!price || Number(price) <= 0)) { setMsg({ type: "err", text: "지정가를 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    const rationaleText = rationale.trim()
      || `${orderType === "LIMIT" ? `지정가(${kisSubType})` : orderType === "MARKET" ? "시장가" : "LOC"} 수동 제안`;
    try {
      await createProposal({
        brokerAccountId: Number(acct.id),
        ticker: String(ticker).toUpperCase(),
        stockName: position?.name && position.name !== ticker ? position.name : undefined,
        side,
        qty: String(qty),
        orderType,
        ...(orderType !== "MARKET" && price ? { limitPrice: String(price) } : {}),
        rationale: rationaleText,
      });
      setMsg({ type: "ok", text: `${isBuy ? "매수" : "매도"} 주문 제안 생성 — '주문 제안' 큐에서 승인/자동체결됩니다.` });
      setQty("");
      setRationale("");
      onReload?.();
    } catch (e) {
      setMsg({ type: "err", text: "주문 생성 실패: " + (e?.response?.data?.error || e.message) });
    } finally { setBusy(false); }
  };

  const pct100 = (frac) => {
    if (!isBuy && position?.qty) setQty(String(Math.floor(position.qty * frac)));
  };

  const inputBox = {
    width: "100%", background: "#0d1117", border: "1px solid #2a3441",
    borderRadius: 8, color: "#E5E7EB", fontSize: 15, padding: "10px 12px", textAlign: "right",
  };
  const stepBtn = {
    width: 38, flexShrink: 0, background: "#1f2733", border: "1px solid #2a3441",
    borderRadius: 8, color: "#cbd5e1", fontSize: 18, cursor: "pointer",
  };
  const pillStyle = (active) => ({
    padding: "4px 11px", borderRadius: 6, fontSize: 11, fontWeight: 600,
    cursor: "pointer", transition: "all 0.12s", border: "none",
    background: active ? (isBuy ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)") : "#1f2733",
    color: active ? (isBuy ? "#fca5a5" : "#93c5fd") : "#64748b",
    outline: active ? `1px solid ${isBuy ? "#ef4444" : "#3b82f6"}` : "1px solid #2a3441",
  });

  return (
    <div>
      {/* 헤더 (종목 정보 + 티커 입력) */}
      <div style={{ background: BRAND, borderRadius: 18, padding: "18px 22px", color: "white", marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 13, opacity: 0.9, marginBottom: 8, padding: 0 }}>
          <ChevronLeft size={16} /> 보유 종목
        </button>
        <div style={{ fontSize: 12.5, opacity: 0.9 }}>
          {acctLabel(acct)}{position ? ` · ${position?.name || ticker}` : " · 새 주문"}
        </div>

        {/* 종목 검색 (position 없을 때만) */}
        {!position && (
          <div style={{ position: "relative", marginTop: 8, marginBottom: 2 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                ref={inputRef}
                value={tickerInput}
                onChange={(e) => { setTickerInput(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (suggestions.length > 0) confirmTicker(suggestions[0].value);
                    else confirmTicker(tickerInput);
                  }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                onFocus={() => { if (tickerInput && ticker !== tickerInput) setShowSuggestions(true); }}
                placeholder={acct.brokerType === "BINANCE" ? "심볼 (예: BTC)" : "종목코드/이름 (예: 삼성전자, AAPL)"}
                style={{ flex: 1, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "white", fontSize: 14, padding: "8px 12px", outline: "none" }}
              />
              <button onClick={() => confirmTicker(tickerInput)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.92)", color: "#4f46e5", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                조회
              </button>
            </div>

            {/* 자동완성 드롭다운 */}
            {suggestions.length > 0 && (
              <div ref={dropdownRef} style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 66, zIndex: 50,
                background: "white", borderRadius: 10, overflow: "hidden",
                boxShadow: "0 8px 28px rgba(0,0,0,0.22)", border: "1px solid rgba(99,102,241,0.2)",
              }}>
                {suggestions.map((s, i) => (
                  <div key={s.value}
                    onMouseDown={(e) => { e.preventDefault(); confirmTicker(s.value); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 14px", cursor: "pointer", fontSize: 13,
                      borderBottom: i < suggestions.length - 1 ? "1px solid #F1F5F9" : "none",
                      background: "white",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                  >
                    <span style={{ color: "#0F172A", fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: "#94A3B8", fontSize: 12, fontFamily: "monospace" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>{!ticker ? "—" : quote ? fmtUsd(last) : "…"}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: chg >= 0 ? "#bbf7d0" : "#fecaca" }}>
            {ticker && quote ? fmtPct(chg) : ""}
          </span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{cur}</span>
        </div>
        {position?.qty && (
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            보유 {position.qty} · 평가손익 <b style={{ color: position.pnl >= 0 ? "#bbf7d0" : "#fecaca" }}>{fmtUsd(position.pnl)} ({fmtPct(position.pct)})</b>
          </div>
        )}
      </div>

      {/* 캔들 차트 */}
      <div style={{ background: "#161b22", border: "1px solid #2a3441", borderRadius: 14, padding: "14px 14px 10px", marginBottom: 14 }}>
        {!ticker
          ? <div style={{ padding: 36, textAlign: "center", color: "#64748b", fontSize: 12 }}>종목을 입력하면 차트가 표시됩니다.</div>
          : candles === null
          ? <div style={{ padding: 36, textAlign: "center", color: "#64748b", fontSize: 12 }}>차트 불러오는 중…</div>
          : candles.length < 2
            ? <div style={{ padding: 36, textAlign: "center", color: "#64748b", fontSize: 12 }}>이 종목의 차트 데이터를 찾을 수 없습니다.</div>
            : <CandleChart data={candles} />}
      </div>

      {/* 주문 폼 */}
      <div style={{ background: "#161b22", border: "1px solid #2a3441", borderRadius: 14, padding: 18 }}>

        {/* 매수/매도 토글 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["BUY", "매수", "#dc2626"], ["SELL", "매도", "#2563eb"]].map(([v, label, c]) => (
            <button key={v} onClick={() => setSide(v)} style={{
              flex: 1, padding: "11px 0", borderRadius: 9, border: "none",
              fontSize: 14.5, fontWeight: 800, cursor: "pointer",
              background: side === v ? c : "#1f2733",
              color: side === v ? "white" : "#94a3b8",
            }}>{label}</button>
          ))}
        </div>

        {/* 주문유형 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {ORDER_TYPES.map(({ value, label }) => (
              <button key={value} onClick={() => { setOrderType(value); if (value === "LIMIT") setKisSubType("정규장"); }}
                style={{
                  flex: 1, padding: "6px 4px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${orderType === value ? "#6366f1" : "#2a3441"}`,
                  background: orderType === value ? "rgba(99,102,241,0.15)" : "transparent",
                  color: orderType === value ? "#a5b4fc" : "#94a3b8",
                  transition: "all 0.12s",
                }}>{label}</button>
            ))}
          </div>
          {/* KIS 지정가 서브타입 */}
          {orderType === "LIMIT" && isKis && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {LIMIT_SUB_TYPES.map(st => (
                <button key={st} onClick={() => setKisSubType(st)} style={pillStyle(kisSubType === st)}>{st}</button>
              ))}
            </div>
          )}
        </div>

        {/* 단가 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>단가 ({cur})</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={stepBtn} onClick={() => setPrice((p) => String(Math.max(0, (Number(p) || 0) - 1)))} disabled={orderType === "MARKET"}>−</button>
            <input
              style={{ ...inputBox, opacity: orderType === "MARKET" ? 0.5 : 1 }}
              value={orderType === "MARKET" ? "시장가" : price}
              disabled={orderType === "MARKET"}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="단가 입력"
              inputMode="decimal"
            />
            <button style={stepBtn} onClick={() => setPrice((p) => String((Number(p) || 0) + 1))} disabled={orderType === "MARKET"}>+</button>
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
          {!isBuy && position?.qty && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[0.25, 0.5, 1].map((f) => (
                <button key={f} onClick={() => pct100(f)} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6,
                  border: "1px solid #2a3441", background: "transparent",
                  color: "#94a3b8", fontSize: 11.5, cursor: "pointer",
                }}>{f === 1 ? "전량" : `${f * 100}%`}</button>
              ))}
            </div>
          )}
        </div>

        {/* 예상 금액 */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#0d1117", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: "#94a3b8" }}>예상 금액</span>
          <b style={{ color: "#E5E7EB" }}>{fmtUsd(amount)} {cur}</b>
        </div>

        {/* 사유 */}
        <div style={{ marginBottom: 14 }}>
          <input
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="사유 (선택) — 예: 기술적 지표 기반 매수 판단"
            style={{ ...inputBox, fontSize: 12.5, textAlign: "left", color: "#E5E7EB" }}
          />
        </div>

        {msg && (
          <div style={{
            padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12.5,
            background: msg.type === "err" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
            color: msg.type === "err" ? "#fca5a5" : "#86efac",
          }}>
            {msg.type === "ok" && <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />}
            {msg.text}
          </div>
        )}

        <button onClick={submit} disabled={busy} style={{
          width: "100%", padding: 14, borderRadius: 10, border: "none",
          fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : "pointer", color: "white",
          background: busy ? "#475569" : (isBuy ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#3b82f6,#2563eb)"),
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {busy && <Loader size={15} style={{ animation: "spin 1s linear infinite" }} />}
          {isBuy ? "매수 주문" : "매도 주문"}
        </button>
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 8, textAlign: "center" }}>
          주문은 OrderProposal 로 생성되어 안전게이트(매매 스위치·한도·kill-switch) 통과 후 체결됩니다.
        </div>
      </div>
    </div>
  );
}
