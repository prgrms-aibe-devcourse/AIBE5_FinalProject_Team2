import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ChevronDown, Cpu } from "lucide-react";
import { useTheme } from "./ThemeContext";
import { listLlmProviders, llmChat } from "./alphaApi";

const MIN_W = 320;
const MAX_W = 720;

/**
 * VS Code Copilot 스타일 우측 채팅 도크.
 * - 우측 상단 토글 버튼 (열기/닫기)
 * - 좌측 가장자리 드래그 핸들 (폭 320~720px, localStorage 저장)
 * - LLM 프로바이더 + 모델 선택 (Claude Opus 4.7 / Sonnet 4.6,4.5 / GPT-4o / Sonar / Gemini)
 */
export default function ChatDock() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(localStorage.getItem("alpha.dock.open") === "true");
  const [width, setWidth] = useState(parseInt(localStorage.getItem("alpha.dock.width") || "380", 10));
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState(localStorage.getItem("alpha.llm.provider") || "");
  const [modelId, setModelId] = useState(localStorage.getItem("alpha.llm.model") || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    listLlmProviders().then(list => {
      setProviders(list);
      const stored = list.find(p => p.id === providerId && p.available);
      const fallback = list.find(p => p.available);
      if (!stored && fallback) {
        setProviderId(fallback.id);
        setModelId(fallback.models[0]?.id || "");
      }
    }).catch(() => setProviders([]));
  }, []);

  useEffect(() => { localStorage.setItem("alpha.dock.open", String(open)); }, [open]);
  useEffect(() => { localStorage.setItem("alpha.dock.width", String(width)); }, [width]);
  useEffect(() => {
    if (providerId) localStorage.setItem("alpha.llm.provider", providerId);
    if (modelId)    localStorage.setItem("alpha.llm.model", modelId);
  }, [providerId, modelId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 폭 조절 드래그 (좌측 핸들)
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX));
      setWidth(next);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const currentProvider = providers.find(p => p.id === providerId);
  const currentModel = currentProvider?.models?.find(m => m.id === modelId);

  const onSend = async () => {
    if (!input.trim() || busy) return;
    const t = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await llmChat({
        provider: providerId, model: modelId,
        system: "당신은 Alpha-Helix 퍼스널 퀀트 매니저입니다. 사용자의 투자 전략·리스크·시장상황 질문에 한국어로 차분하게 설명합니다. 매수/매도 직접 지시는 피하고, 항상 검토·시나리오·근거 중심으로 답합니다.",
        prompt: t,
      });
      setMessages(m => [...m, { role: "ai", text: r.reply, providerName: r.providerName, model: r.model }]);
    } catch (e) {
      setMessages(m => [...m, { role: "ai", text: `❌ 오류: ${e?.response?.data?.error || e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* 우측 상단 토글 버튼 (VS Code식) */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? "AI 채팅 닫기" : "AI 채팅 열기"}
        style={{
          position: "fixed",
          top: 14,
          right: open ? width + 14 : 14,
          zIndex: 1001,
          width: 36, height: 36, borderRadius: 8,
          background: open ? theme.accent : theme.panel,
          color: open ? "white" : theme.text,
          border: `1px solid ${open ? theme.accent : theme.panelBorder}`,
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "right 0.25s ease, background 0.2s",
          boxShadow: open ? "none" : "0 2px 6px rgba(0,0,0,0.12)",
        }}>
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>

      {/* 슬라이딩 패널 */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width, zIndex: 999,
        background: theme.panel, borderLeft: `1px solid ${theme.panelBorder}`,
        boxShadow: open ? "-8px 0 24px rgba(0,0,0,0.18)" : "none",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: draggingRef.current ? "none" : "transform 0.25s ease",
        display: "flex", flexDirection: "column",
        backdropFilter: "blur(14px)",
      }}>
        {/* 좌측 드래그 핸들 */}
        <div
          onMouseDown={() => {
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          title="드래그하여 폭 조절"
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
            cursor: "col-resize", background: "transparent", zIndex: 2,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.opacity = "0.5"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "1"; }}
        />

        {/* 헤더 */}
        <div style={{ padding: 14, borderBottom: `1px solid ${theme.panelBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: theme.text }}>
              💬 AI 퀀트 매니저
            </h3>
            <button onClick={() => setMessages([])}
              style={{ background: "transparent", border: `1px solid ${theme.panelBorder}`,
                color: theme.textMuted, fontSize: 11, padding: "3px 8px",
                borderRadius: 4, cursor: "pointer" }}>
              새 대화
            </button>
          </div>

          {/* 모델 선택 드롭다운 */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setPickerOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", background: theme.codeBg,
                border: `1px solid ${theme.panelBorder}`, borderRadius: 6,
                color: theme.text, fontSize: 12, cursor: "pointer", textAlign: "left",
              }}>
              <Cpu size={14} style={{ color: theme.accent }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentProvider ? currentProvider.displayName : "프로바이더 선택…"}
                {currentModel && <span style={{ color: theme.textMuted, marginLeft: 6 }}>· {currentModel.displayName}</span>}
              </span>
              <ChevronDown size={14} />
            </button>

            {pickerOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                background: theme.panel, border: `1px solid ${theme.panelBorder}`,
                borderRadius: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
                maxHeight: 360, overflowY: "auto", zIndex: 10,
              }}>
                {providers.map(p => (
                  <div key={p.id} style={{ padding: 6, opacity: p.available ? 1 : 0.45 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: theme.accent,
                      padding: "4px 6px", display: "flex", justifyContent: "space-between",
                    }}>
                      <span>{p.displayName}</span>
                      {!p.available && <span style={{ color: theme.danger, fontSize: 10 }}>키 미설정</span>}
                    </div>
                    {p.models.map(m => (
                      <button key={m.id} disabled={!p.available}
                        onClick={() => { setProviderId(p.id); setModelId(m.id); setPickerOpen(false); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "6px 10px",
                          background: (p.id === providerId && m.id === modelId) ? theme.accentSoft : "transparent",
                          color: theme.text, border: "none", cursor: p.available ? "pointer" : "not-allowed",
                          fontSize: 12, borderRadius: 4,
                        }}>
                        <div style={{ fontWeight: 600 }}>{m.displayName}</div>
                        <div style={{ fontSize: 10, color: theme.textMuted }}>{m.description}</div>
                      </button>
                    ))}
                  </div>
                ))}
                {providers.length === 0 && (
                  <div style={{ padding: 12, fontSize: 11, color: theme.textMuted }}>
                    프로바이더 정보 로딩 중…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 메시지 영역 */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: theme.textMuted, marginTop: 40, fontSize: 12, lineHeight: 1.6 }}>
              ✨ 무엇이든 물어보세요<br />
              <span style={{ fontSize: 11 }}>"VIX 25 임계값이 적절할까?"<br />
              "내 전략의 약점은?"<br />
              "오늘 시장이 왜 떨어졌어?"</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}>
              <div style={{
                maxWidth: "85%", padding: "8px 12px", borderRadius: 10,
                background: m.role === "user" ? theme.accent
                  : m.error ? "#7f1d1d" : theme.codeBg,
                color: m.role === "user" ? "white" : theme.text,
                fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {m.text}
                {m.providerName && (
                  <div style={{ marginTop: 6, fontSize: 9, opacity: 0.6 }}>
                    {m.providerName} · {m.model}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div style={{ fontSize: 11, color: theme.textMuted, padding: 8 }}>🤔 생각 중…</div>}
          <div ref={endRef} />
        </div>

        {/* 입력창 */}
        <div style={{ padding: 10, borderTop: `1px solid ${theme.panelBorder}`, display: "flex", gap: 6 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="메시지 입력…  (Enter 전송)" rows={2}
            style={{
              flex: 1, padding: 8, borderRadius: 6,
              border: `1px solid ${theme.panelBorder}`, background: theme.codeBg,
              color: theme.text, fontSize: 12, resize: "none", outline: "none",
              fontFamily: "inherit",
            }} />
          <button onClick={onSend} disabled={busy || !input.trim()}
            style={{
              padding: "0 12px", background: theme.accent, color: "white", border: "none",
              borderRadius: 6, cursor: busy ? "wait" : "pointer", fontWeight: 700,
              opacity: (busy || !input.trim()) ? 0.5 : 1,
            }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
