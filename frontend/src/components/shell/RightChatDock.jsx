import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Send, ChevronRight } from "lucide-react";
import { chatWithAI, langInstruction } from "../../lib/aiClient";
import { useLanguage } from "../../i18n/LanguageContext";
import ModelPicker from "../ai/ModelPicker";
import { applyPatch as applyAlphaPatch } from "../../alpha/alphaApi";
import ChangeBar from "../../alpha/ChangeBar";

// ── 간단 마크다운 렌더링 (굵게, heli-patch / alpha-ezer-patch 블록 숨김)
function renderRichText(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/```(?:heli-patch|alpha-ezer-patch)[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return null;
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m;
  let key = 0;
  while ((m = regex.exec(cleaned)) !== null) {
    if (m.index > lastIndex) parts.push(cleaned.slice(lastIndex, m.index));
    parts.push(<strong key={`b${key++}`} style={{ fontWeight: 800, color: "#1e3a5f" }}>{m[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) parts.push(cleaned.slice(lastIndex));
  return parts;
}

/**
 * VS Code 우측 보조 사이드바 스타일의 도크형 채팅 패널.
 * - open / onClose 는 AppShell 에서 주입 (TopBar 의 토글 버튼이 컨트롤)
 */

const SYS = `너는 Alpha-Helix의 AI 동료 "Heli(헬리)"야. 차분하고 따뜻한 투자 파트너 톤.
이름을 굳이 매 답변마다 소개하지 말고 필요할 때만 가볍게 언급해. 말투는 자연스럽고 고객에게 동료처럼.
전략 설계·백테스트·리스크 관리·Regime·Trust Score·브리핑 해석을 도와. 핵심은 **굵게**, 답변은 3~6줄로 간결하게.

[Patch tool — 워크스페이스 라이브 수정]
사용자가 "적용/바꿔/설정해줘/고쳐줘/수정해줘" 같이 명시적으로 변경을 요청하면,
답변 마지막에 \`\`\`heli-patch 코드블록을 첨부해. 블록 안엔 다음 형식의 JSON 한 개만:
{
  "title": "한 줄 변경 요약",
  "ops": [
    { "target": "goalProfile|backtest|regime|trustScore|strategy|code", "path": "필드명", "value": <새 값> }
  ]
}
허용 필드 예:
- goalProfile.투자성향 ("보수적"|"중립"|"공격적"|"매우 공격적")
- goalProfile.월적립금 (숫자, 원)
- goalProfile.MDD허용 (숫자, %)
- goalProfile.기간 / goalProfile.초기투자금
- backtest.slippage_bps, backtest.fee_bps, backtest.initial_capital
- regime.method ("rule"|"hmm"), regime.smoothing, regime.n_states
- trustScore.weights.regime
- strategy.maxDrawdownPct 등
- code.<파일명>  (예: code.main) → value 는 해당 파일의 **새 전체 Python 코드 문자열**.
  코드 패치는 일부 함수만 짧게 바꿔도 되지만 반드시 그 파일 전체를 재작성한 결과를 넣어야 해.
  파일이 여러 개면 ops 에 여러 줄 추가하면 돼.
불확실하면 patch를 만들지 말고 질문으로 답해.
패치는 즉시 적용되고 화면 상단 바에서 [유지] / [실행 취소] 가능. VS Code Copilot처럼 사용자 승인이 보장돼.`;
const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export default function RightChatDock({ open, onClose, width = 380, onResize }) {
  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev) => {
      const next = Math.min(900, Math.max(280, startW + (startX - ev.clientX)));
      onResize && onResize(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const { lang } = useLanguage();
  const loc = useLocation();
  const wsMatch = loc?.pathname?.match(/^\/alpha\/w\/(\d+)/);
  const wsIdFromStorage = (typeof window !== "undefined") ? Number(localStorage.getItem("alpha.lastWsId")) || null : null;
  const wsIdInRoute = wsMatch ? Number(wsMatch[1]) : wsIdFromStorage;
  const [messages, setMessages] = useState([
    { role: "assistant", content: "안녕하세요, **Heli**예요. 전략·Backtest·Regime·Trust Score·코드까지 함께 다듬어 드릴게요. \"슬리피지 10bp로 적용해줘\" 결도 좋고, \"투자성향 공격적으로 바꿔줘\" 이렇게 말씀하셔도 바로 반영해 드려요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const scrollRef = useRef(null);
  const [textareaHeight, setTextareaHeight] = useState(72);
  const [inputHover, setInputHover] = useState(false);
  const [sendHover, setSendHover] = useState(false);

  const startVerticalResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = textareaHeight;
    const onMove = (ev) => {
      const next = Math.min(220, Math.max(48, startH + (startY - ev.clientY)));
      setTextareaHeight(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages(m => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const sys = `${SYS}\n${langInstruction(lang)}`;
      const reply = await chatWithAI(
        [...messages, { role: "user", content: text }].map(m => ({ role: m.role, text: m.content })),
        sys, model
      );
      const replyText = reply || "...";
      setMessages(m => [...m, { role: "assistant", content: replyText }]);

      // ─── heli-patch / alpha-ezer-patch 자동 적용
      try {
        const match = replyText.match(/```(?:heli-patch|alpha-ezer-patch)\s*([\s\S]*?)```/);
        if (match) {
          const routeMatch = (typeof window !== "undefined")
            ? window.location.pathname.match(/\/alpha\/w\/(\d+)/) : null;
          const wsIdFromRoute = routeMatch ? Number(routeMatch[1]) : null;
          const wsIdFromLs = (typeof window !== "undefined")
            ? Number(localStorage.getItem("alpha.lastWsId")) || null : null;
          const wsId = wsIdFromRoute || wsIdFromLs;
          if (!wsId) {
            setMessages(m => [...m, { role: "assistant", content: "⚠️ 적용할 워크스페이스를 찾을 수 없어요. 워크스페이스를 먼저 열어 주세요." }]);
          } else {
            const payload = JSON.parse(match[1].trim());
            const ops = Array.isArray(payload?.ops) ? payload.ops : [];
            const title = payload?.title || "Heli 패치";
            if (ops.length === 0) {
              setMessages(m => [...m, { role: "assistant", content: "⚠️ patch ops 가 비어있어 적용을 건너뛰었어요." }]);
            } else {
              const cs = await applyAlphaPatch(wsId, title, ops);
              window.dispatchEvent(new CustomEvent("alphaPatchApplied", { detail: { wsId, changeSet: cs } }));
              setMessages(m => [...m, { role: "assistant", content: `✅ 적용됨: **${cs.title}** (#${cs.id}) — 아래 바에서 **유지 / 실행 취소** 가능` }]);
            }
          }
        }
      } catch (pe) {
        setMessages(m => [...m, { role: "assistant", content: "⚠️ 패치 적용 실패: " + (pe?.response?.data?.error || pe.message || String(pe)) }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", content: "에러: " + (e.message || String(e)) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: open ? width : 0,
      background: "white", borderLeft: open ? "1px solid #E2E8F0" : "none",
      boxShadow: open ? "-8px 0 24px rgba(15,23,42,0.06)" : "none",
      display: "flex", flexDirection: "column",
      transition: "width 0.18s ease",
      overflow: open ? "visible" : "hidden", zIndex: 950, fontFamily: F,
    }}>
      {/* 좌측 리사이즈 핸들 */}
      {open && (
        <div
          onMouseDown={startResize}
          title="드래그해서 너비 조절"
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
            cursor: "col-resize", zIndex: 5,
            background: "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.25)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        />
      )}
      {/* 헤더 — Heli 브랜드 */}
      <div style={{
        height: 48, padding: "0 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 45%, #EDE9FE 100%)",
        borderBottom: "1px solid #C7D2FE",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #60a5fa 0%, #818cf8 55%, #c4b5fd 100%)",
            boxShadow: "0 2px 6px rgba(129,140,248,0.35)",
            color: "white", fontSize: 14, fontWeight: 800,
          }} title="Heli">⋯</div>
          <span style={{
            fontSize: 14, fontWeight: 800, letterSpacing: 0.2,
            background: "linear-gradient(135deg, #2563eb 0%, #6366f1 55%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>Heli</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", letterSpacing: 0.5 }}>AI</span>
          <ModelPicker value={model} onChange={setModel} compact />
        </div>
        <button onClick={onClose} title="닫기" style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "#94A3B8", padding: 4, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 메시지 */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: "14px 12px", background: "#F0F7FF",
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "85%", padding: "10px 12px", borderRadius: 12,
              fontSize: 13, lineHeight: 1.55,
              background: m.role === "user" ? "linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #8b5cf6 100%)" : "#FAFCFF",
              color: m.role === "user" ? "white" : "#0F172A",
              border: m.role === "assistant" ? "1px solid #BAE6FD" : "none",
              boxShadow: m.role === "assistant" ? "0 2px 8px rgba(186,230,253,0.30)" : "none",
              whiteSpace: "pre-wrap",
            }}>
              {m.role === "assistant" ? renderRichText(m.content) : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 12px", borderRadius: 12, fontSize: 13,
              background: "#FAFCFF", color: "#7DD3FC", border: "1px solid #BAE6FD",
              boxShadow: "0 2px 8px rgba(186,230,253,0.30)",
            }}>입력 중…</div>
          </div>
        )}
      </div>

      {/* Heli 라이브 패치 바 — 입력박스 바로 위 */}
      {wsIdInRoute && <ChangeBar wsId={wsIdInRoute} />}

      {/* 입력 */}
      <div
        onMouseEnter={() => setInputHover(true)}
        onMouseLeave={() => setInputHover(false)}
        style={{
          borderTop: "1px solid #BAE6FD",
          background: inputHover
            ? "linear-gradient(to bottom, #EFF6FF 0%, #F8FCFF 100%)"
            : "white",
          transition: "background 0.2s ease",
        }}
      >
        {/* 세로 리사이즈 핸들 */}
        <div
          onMouseDown={startVerticalResize}
          title="끌어서 세로 크기 조절"
          style={{
            height: 18, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "row-resize",
          }}
        >
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: inputHover ? "#93C5FD" : "#CBD5E1",
            transition: "background 0.2s ease",
          }} />
        </div>
        <div style={{ padding: "0 10px 10px", display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈) — 위쪽 회색 핸들을 끌어서 세로 크기 조절`}
            style={{
              flex: 1,
              height: textareaHeight,
              padding: "8px 10px",
              fontSize: 13, lineHeight: 1.5,
              border: "1.5px solid #BAE6FD",
              borderRadius: 10,
              resize: "none",
              outline: "none",
              fontFamily: F,
              background: inputHover ? "rgba(255,255,255,0.85)" : "#F8FCFF",
              color: "#1F2937",
              transition: "background 0.2s ease, border-color 0.2s ease",
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            onMouseEnter={() => setSendHover(true)}
            onMouseLeave={() => setSendHover(false)}
            style={{
              width: 50,
              height: textareaHeight,
              minHeight: 48,
              borderRadius: 10,
              border: "none",
              background: !input.trim() || loading
                ? "#E2E8F0"
                : sendHover
                  ? "linear-gradient(135deg, #7dd3fc 0%, #60a5fa 48%, #a78bfa 100%)"
                  : "linear-gradient(135deg, #bae6fd 0%, #7dd3fc 48%, #c4b5fd 100%)",
              color: !input.trim() || loading ? "#94A3B8" : "#0F172A",
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: F,
              flexShrink: 0,
              boxShadow: input.trim() && !loading
                ? sendHover
                  ? "0 6px 14px rgba(99,102,241,0.30)"
                  : "0 4px 12px rgba(125,211,252,0.30)"
                : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Send size={16} />
            <span>전송</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
