import { useState, useEffect, useRef } from "react";
import { Send, ChevronRight } from "lucide-react";
import { chatWithAI, langInstruction } from "../../lib/aiClient";
import { useLanguage } from "../../i18n/LanguageContext";
import ModelPicker from "../ai/ModelPicker";

/**
 * VS Code 우측 보조 사이드바 스타일의 도크형 채팅 패널.
 * - open / onClose 는 AppShell 에서 주입 (TopBar 의 토글 버튼이 컨트롤)
 */

const SYS = `너는 Alpha-Helix의 AI 매니저야. 투자 전략 설계·백테스트·리스크 관리·Living Briefing 해석을 도와줘. 핵심은 **굵게**, 답변은 3~6줄로 간결하게.`;
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
  const [messages, setMessages] = useState([
    { role: "assistant", content: "안녕하세요! Alpha-Helix AI 매니저입니다. 전략 설계나 백테스트에 대해 무엇이든 물어보세요." },
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
      setMessages(m => [...m, { role: "assistant", content: reply || "..." }]);
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
      {/* 헤더 */}
      <div style={{
        height: 44, padding: "0 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(to bottom, #EFF6FF 0%, #ffffff 100%)",
        borderBottom: "1px solid #BAE6FD",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>AI 매니저</span>
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
              {m.content}
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
