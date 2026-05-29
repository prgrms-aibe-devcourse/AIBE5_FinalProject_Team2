import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";
import { fetchChat, sendChat, runAutoPipeline } from "../alphaApi";
import { ASSISTANT_HERO_SRC } from "../heroAssets";
import { Send, Loader2, RefreshCw, Play } from "lucide-react";

// ─── 인라인 마크다운 렌더 ───────────────────────────────────────────
function renderInlineMarkdown(text) {
  if (text == null) return null;
  const s = String(text);
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  const parts = s.split(re);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} style={{
        fontFamily: "monospace", background: "rgba(0,0,0,0.06)",
        padding: "1px 5px", borderRadius: 4, fontSize: "0.92em",
      }}>{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
      return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// ─── JSON 시맨틱 하이라이트 ──────────────────────────────────────────
function highlightJson(code) {
  const parts = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let last = 0; let m; let key = 0;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) parts.push(<span key={`p${key++}`}>{code.slice(last, m.index)}</span>);
    if (m[1]) {
      const isKey = !!m[2];
      parts.push(<span key={`p${key++}`} style={{ color: isKey ? "#60a5fa" : "#86efac" }}>{m[1]}</span>);
      if (isKey) parts.push(<span key={`p${key++}`}>{m[2]}</span>);
    } else if (m[3]) {
      parts.push(<span key={`p${key++}`} style={{ color: "#fcd34d" }}>{m[3]}</span>);
    } else if (m[4]) {
      parts.push(<span key={`p${key++}`} style={{ color: "#c084fc" }}>{m[4]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < code.length) parts.push(<span key={`p${key++}`}>{code.slice(last)}</span>);
  return parts;
}

// ─── balanced { ··· } 영역 탐색 ────────────────────────────────────
function findBareJsonRanges(s) {
  const ranges = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0; let inStr = false; let esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const body = s.slice(i, j + 1);
          if (/"\s*:\s*/.test(body) && body.length >= 8) ranges.push({ start: i, end: j + 1, body });
          i = j;
          break;
        }
      }
    }
  }
  return ranges;
}

// ─── 구조화 응답 섹션 헤더 ──────────────────────────────────────────
const STRUCT_SECTIONS = [
  { re: /^##\s*🧠\s*AI가\s*이해한\s*전략\s*$/, key: "understand", title: "🧠 AI가 이해한 전략", bg: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "#93c5fd", color: "#1e3a8a" },
  { re: /^##\s*❓\s*확인이\s*필요한\s*규칙\s*$/, key: "questions", title: "❓ 확인이 필요한 규칙", bg: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "#fbbf24", color: "#78350f" },
  { re: /^##\s*▶\s*다음\s*단계\s*$/, key: "next", title: "▶ 다음 단계", bg: "linear-gradient(135deg,#ede9fe,#ddd6fe)", border: "#a78bfa", color: "#4c1d95" },
];

function detectStructured(text) {
  const lines = String(text).split("\n");
  const sections = [];
  let cur = null;
  const preamble = [];
  for (const ln of lines) {
    const trimmed = ln.trim();
    const hit = STRUCT_SECTIONS.find((h) => h.re.test(trimmed));
    if (hit) {
      if (cur) sections.push(cur);
      cur = { ...hit, body: [] };
    } else if (cur) {
      cur.body.push(ln);
    } else {
      preamble.push(ln);
    }
  }
  if (cur) sections.push(cur);
  if (sections.length === 0) return null;
  return {
    preamble: preamble.join("\n").trim(),
    sections: sections.map((s) => ({ ...s, body: s.body.join("\n").trim() })),
  };
}

function renderBodyWithButtons(body, onAction) {
  if (!body) return null;
  const re = /\[BTN:([^|\]]+)\|([a-z_]+)\]/g;
  const out = [];
  let last = 0; let m; let k = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last)
      out.push(<span key={`bt-${k++}`}>{renderInlineMarkdown(body.slice(last, m.index))}</span>);
    const label = m[1].trim();
    const action = m[2].trim();
    out.push(
      <button key={`b-${k++}`}
        onClick={(e) => { e.preventDefault(); onAction && onAction(action, label); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          margin: "4px 6px 4px 0", padding: "7px 14px",
          fontSize: 12, fontWeight: 800, cursor: "pointer",
          background: "linear-gradient(135deg,#dbeafe 0%,#e0e7ff 50%,#ede9fe 100%)",
          color: "#1e3a8a", border: "1px solid #c7d2fe", borderRadius: 999,
          boxShadow: "0 2px 6px rgba(99,102,241,0.18)",
        }}
      >{label}</button>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length)
    out.push(<span key={`bt-${k++}`}>{renderInlineMarkdown(body.slice(last))}</span>);
  return out;
}

function StructuredAssistantMessage({ data, onAction }) {
  const [collapsed, setCollapsed] = useState({ understand: true, questions: true });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.preamble && (
        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {renderInlineMarkdown(data.preamble)}
        </div>
      )}
      {data.sections.map((sec) => {
        const isNext = sec.key === "next";
        const isCollapsed = isNext ? false : !!collapsed[sec.key];
        return (
          <div key={sec.key} style={{ background: sec.bg, border: `1px solid ${sec.border}`, borderRadius: 12, overflow: "hidden" }}>
            {isNext ? (
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: sec.color, marginBottom: 8 }}>{sec.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: sec.color, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {renderBodyWithButtons(sec.body, onAction)}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [sec.key]: !c[sec.key] }))}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontSize: 13, fontWeight: 800, color: sec.color,
                  }}
                >
                  <span>{sec.title}</span>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>{isCollapsed ? "▼ 펼치기" : "▲ 접기"}</span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding: "0 14px 12px 14px", fontSize: 13, lineHeight: 1.6, color: sec.color, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {renderBodyWithButtons(sec.body, onAction)}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderAssistantMessage(text, opts = {}) {
  if (text == null) return null;
  const structured = detectStructured(String(text));
  if (structured) return <StructuredAssistantMessage data={structured} onAction={opts.onAction} />;
  const s = String(text);
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  const matches = [];
  let m;
  while ((m = re.exec(s)) !== null)
    matches.push({ start: m.index, end: m.index + m[0].length, lang: m[1] || "code", code: m[2].replace(/\n$/, "") });
  const bare = findBareJsonRanges(s);
  for (const r of bare) {
    if (matches.some(x => r.start >= x.start && r.end <= x.end)) continue;
    matches.push({ start: r.start, end: r.end, lang: "json", code: r.body });
  }
  matches.sort((a, b) => a.start - b.start);
  const out = [];
  let last = 0; let key = 0;
  for (const x of matches) {
    if (x.start > last) out.push(<span key={`t-${key++}`}>{renderInlineMarkdown(s.slice(last, x.start))}</span>);
    if (x.lang === "json") { last = x.end; continue; }
    out.push(
      <div key={`c-${key++}`} style={{
        marginTop: 8, marginBottom: 8,
        background: "#1e293b", color: "#f1f5f9",
        borderRadius: 10, padding: "12px 14px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 12.5, lineHeight: 1.65,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        overflowX: "auto", maxWidth: "100%",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          display: "inline-block", fontSize: 10, marginBottom: 6, padding: "2px 8px",
          borderRadius: 4, letterSpacing: 0.6, fontWeight: 700,
          background: "#334155", color: "white", textTransform: "uppercase",
        }}>{x.lang}</div>
        <div>{x.code}</div>
      </div>
    );
    last = x.end;
  }
  if (last < s.length) out.push(<span key={`t-${key++}`}>{renderInlineMarkdown(s.slice(last))}</span>);
  let visible = "";
  let lastV = 0;
  for (const x of matches) {
    if (x.start > lastV) visible += s.slice(lastV, x.start);
    if (x.lang !== "json") visible += "x";
    lastV = x.end;
  }
  if (lastV < s.length) visible += s.slice(lastV);
  if (!visible.replace(/\s/g, "")) return null;
  return out;
}

// ─── AutoRunCard ────────────────────────────────────────────────────
function Metric({ label, value }) {
  return (
    <div style={{ padding: 6, background: "#00000010", borderRadius: 6, textAlign: "center" }}>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function AutoRunCard({ theme, busy, report, error, onRetry }) {
  const fmtPct = (v) => (v == null ? "—" : (v * 100).toFixed(2) + "%");
  const fmtNum = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
  const bt = report?.backtest || {};
  const rg = report?.regime || {};
  const tr = report?.trust || {};
  const orders = report?.orders;
  return (
    <div style={{
      marginTop: 10, padding: 14, borderRadius: 10,
      background: theme.panel, border: `1px solid ${theme.panelBorder}`, color: theme.text, fontSize: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>🚀 통합 자동 파이프라인 결과</b>
        <button onClick={onRetry} disabled={busy} style={{
          padding: "6px 12px", fontSize: 11, borderRadius: 8, cursor: busy ? "wait" : "pointer",
          background: busy
            ? "linear-gradient(135deg,#fde68a 0%,#fbbf24 100%)"
            : (report ? "linear-gradient(135deg,#86efac 0%,#22c55e 100%)" : theme.accent),
          color: busy ? "#78350f" : "white", border: "none", fontWeight: 700,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: report && !busy ? "0 3px 10px rgba(34,197,94,0.30)" : "none",
        }}>
          {busy ? <Loader2 size={12} className="ah-spin" /> : (report ? <RefreshCw size={12} /> : <Play size={12} />)}
          {busy ? "실행 중…" : (report ? "다시 실행" : "실행")}
        </button>
      </div>
      {error && <div style={{ color: "#ef4444", marginBottom: 8 }}>❌ {error}</div>}
      {busy && !report && <div style={{ color: theme.textMuted }}>formalize → backtest → regime → trust 순차 실행 중...</div>}
      {report && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 11, color: theme.textMuted }}>
            전략: <b style={{ color: theme.text }}>{report.strategyName || "—"}</b>
            {" · "}타입: {report.strategyType || "—"}
            {" · "}자산: {(report.assets || []).join(", ") || "—"}
            {report.steps && <> · 단계: {report.steps.join(" → ")}</>}
          </div>
          {bt.summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <Metric label="CAGR" value={fmtPct(bt.summary.cagr)} />
              <Metric label="Sharpe" value={fmtNum(bt.summary.sharpe)} />
              <Metric label="MDD" value={fmtPct(bt.summary.mdd)} />
              <Metric label="Final" value={bt.summary.final_value != null ? `$${Math.round(bt.summary.final_value).toLocaleString()}` : "—"} />
            </div>
          )}
          {rg.current && (
            <div style={{ padding: 8, background: theme.accentSoft, borderRadius: 6 }}>
              📊 Regime: <b>{rg.current}</b>
              {rg.recommendation && <> — {rg.recommendation}</>}
            </div>
          )}
          {tr.score != null && (
            <div style={{ padding: 8, background: theme.accentSoft, borderRadius: 6 }}>
              🛡️ Trust Score: <b>{fmtNum(tr.score, 1)} / 100</b>
              {tr.grade && <> ({tr.grade})</>}
            </div>
          )}
          {orders && Array.isArray(orders) && orders.length > 0 && (
            <div style={{ padding: 8, background: "#10b98122", borderRadius: 6 }}>
              💼 자동 주문 큐: <b>{orders.length}건</b> 생성됨 (Proposals 탭에서 승인)
            </div>
          )}
          {(report.backtestError || report.regimeError || report.trustError || report.ordersError) && (
            <div style={{ fontSize: 11, color: "#f59e0b" }}>
              ⚠️ 일부 단계 실패: {[
                report.backtestError && "backtest",
                report.regimeError && "regime",
                report.trustError && "trust",
                report.ordersError && "orders",
              ].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ChatPanel (default export) ─────────────────────────────────────
export default function ChatPanel({ id, ws, onChange }) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoRunBusy, setAutoRunBusy] = useState(false);
  const [autoReport, setAutoReport] = useState(null);
  const [autoError, setAutoError] = useState(null);
  const [inputHeight, setInputHeight] = useState(160);
  const dragRef = useRef(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);

  const load = () => fetchChat(id).then(setMessages);
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const storageKey = `alpha.initPrompt.${id}`;
    const initPrompt = sessionStorage.getItem(storageKey);
    if (!initPrompt) return;
    sessionStorage.removeItem(storageKey);
    setTimeout(async () => {
      try {
        setBusy(true);
        setMessages(m => [...m, { role: "user", text: initPrompt, _local: true }]);
        await sendChat(id, initPrompt);
        await load();
        onChange();
      } catch { /* noop */ } finally { setBusy(false); }
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, autoReport]);

  const triggerAutoRun = async () => {
    if (autoRunBusy) return;
    setAutoRunBusy(true);
    setAutoError(null);
    try {
      const rep = await runAutoPipeline(id);
      setAutoReport(rep);
      onChange();
    } catch (e) {
      setAutoError(e?.response?.data?.error || e.message);
    } finally {
      setAutoRunBusy(false);
    }
  };

  const sendNow = async (t) => {
    if (!t || !t.trim() || busy) return;
    const msg = t.trim();
    setBusy(true);
    setMessages(m => [...m, { role: "user", text: msg, _local: true }]);
    try {
      const resp = await sendChat(id, msg);
      await load();
      onChange();
      if (resp?.autoRunReady) setTimeout(() => triggerAutoRun(), 300);
    } catch (e) {
      alert("전송 실패: " + (e?.response?.data?.error || e.message));
    } finally {
      setBusy(false);
    }
  };

  const onSend = async () => {
    if (!text.trim() || busy) return;
    const t = text.trim();
    setText("");
    await sendNow(t);
  };

  const onAssistantAction = (action, label) => {
    const MSG = {
      next: "네, 위에 정리된 내용대로 다음 단계로 진행해 주세요.",
      ask_more: "혹시 더 확인이 필요한 부분이 있으면 추가로 질문해 주세요.",
      formalize: "전략 카드로 정리해 주세요.",
    };
    sendNow(MSG[action] || label || "다음 단계로 진행해 주세요.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 24px", minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: theme.textMuted, marginTop: 40, fontSize: 16, padding: "0 16px" }}>
            💬 삶의 목표를 자유롭게 말해주세요<br />
            <span style={{ fontSize: 13, opacity: 0.85 }}>예: "5년 안에 월 300만원 현금흐름이 필요해. MDD는 20% 이하면 좋겠고 QQQ랑 SCHD를 섞고 싶어"</span>
          </div>
        )}
        {messages.map((m, i) => {
          const rendered = m.role === "user" ? renderInlineMarkdown(m.text) : renderAssistantMessage(m.text, { onAction: onAssistantAction });
          const txt = (m.text || "").replace(/```[\s\S]*?```/g, "").replace(/\{[\s\S]*?\}/g, "").trim();
          const isEmpty = m.role !== "user" && (rendered == null || (Array.isArray(rendered) && rendered.length === 0) || !txt);
          if (isEmpty) return null;
          return (
            <div key={i} style={{
              display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-end", gap: 6, marginBottom: 12,
            }}>
              {m.role !== "user" && (
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: "white",
                  border: "1px solid " + theme.panelBorder,
                  flex: "0 0 auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  marginRight: -2, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img src={ASSISTANT_HERO_SRC} alt="AI"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              )}
              <div style={{
                maxWidth: "82%", padding: "10px 14px", borderRadius: 12,
                background: m.role === "user" ? theme.accent : theme.panel,
                color: m.role === "user" ? "white" : theme.text,
                border: m.role === "user" ? "none" : `1px solid ${theme.panelBorder}`,
                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{rendered}</div>
            </div>
          );
        })}
        {messages.filter(m => m.role === "user").length === 0 && messages.length > 0 && (
          <div style={{
            margin: "16px auto 4px", padding: "10px 14px", maxWidth: 520,
            background: "#F0F9FF", border: "1px solid #BAE6FD",
            borderRadius: 10, textAlign: "left",
            fontSize: 12, color: "#0c4a6e", lineHeight: 1.55,
          }}>
            💡 처음이라면 <b>전략 카드 탭</b>의 「⭐ 예시 양식 입력창에 채우기」 버튼을 눌러보세요.
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div
        ref={dragRef}
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = inputHeight;
          const onMove = (ev) => {
            const dy = ev.clientY - startY;
            const next = Math.max(80, Math.min(600, startH - dy));
            setInputHeight(next);
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
        title="끌어서 입력창 세로 크기 조절"
        style={{
          flexShrink: 0, height: 10, cursor: "row-resize",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderTop: `1px solid ${theme.panelBorder}`,
          background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.06) 100%)",
        }}
      >
        <div style={{
          width: 60, height: 4, borderRadius: 999,
          background: "linear-gradient(90deg,#cbd5e1,#a5b4fc,#cbd5e1)",
          opacity: 0.7,
        }} />
      </div>
      <div style={{ display: "flex", gap: 10, padding: 12, flexShrink: 0, alignItems: "stretch" }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈) — 위쪽 회색 핸들을 끌어서 세로 크기 조절"
          rows={6}
          data-ai-chat-input="1"
          style={{
            flex: 1, padding: "12px 14px", borderRadius: 12,
            border: `1px solid ${theme.panelBorder}`, background: "#ffffff", color: theme.text,
            fontSize: 14, resize: "none", height: inputHeight, outline: "none",
            fontFamily: "inherit", lineHeight: 1.55,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
          }} />
        <button
          onClick={onSend}
          disabled={busy}
          onMouseEnter={(e) => {
            if (busy) return;
            e.currentTarget.style.background = "linear-gradient(135deg,#bae6fd 0%,#a5b4fc 50%,#c4b5fd 100%)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(165,180,252,0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg,#dbeafe 0%,#e0e7ff 50%,#ede9fe 100%)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 3px 10px rgba(165,180,252,0.30)";
          }}
          style={{
            minWidth: 88, padding: "0 22px",
            background: "linear-gradient(135deg,#dbeafe 0%,#e0e7ff 50%,#ede9fe 100%)",
            color: "#1e3a8a", border: "1px solid #c7d2fe",
            borderRadius: 14, cursor: busy ? "wait" : "pointer", fontWeight: 800, fontSize: 14,
            display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            boxShadow: "0 3px 10px rgba(165,180,252,0.30)",
            transition: "transform .15s ease, box-shadow .15s ease, background .2s ease",
          }}>
          {busy ? <Loader2 size={18} className="ah-spin" /> : <Send size={18} />}
          <span style={{ fontSize: 12, fontWeight: 700 }}>{busy ? "전송중" : "전송"}</span>
        </button>
        <style>{`@keyframes ah-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.ah-spin{animation:ah-spin 1s linear infinite}`}</style>
      </div>
      {ws.goalProfile && (
        <div style={{
          marginTop: 8, padding: 10, background: theme.accentSoft,
          borderRadius: 8, fontSize: 11, color: theme.text,
        }}>
          ✅ Goal Profile이 추출되었습니다. <b>Strategy 탭</b>에서 정형화하세요.
        </div>
      )}
      {(autoRunBusy || autoReport || autoError) && (
        <AutoRunCard
          theme={theme}
          busy={autoRunBusy}
          report={autoReport ?? ws.lastReport}
          error={autoError}
          onRetry={triggerAutoRun}
        />
      )}
    </div>
  );
}
