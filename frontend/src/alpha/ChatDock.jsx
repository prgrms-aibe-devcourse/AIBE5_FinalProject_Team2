import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ChevronDown, Cpu } from "lucide-react";
import { useTheme } from "./ThemeContext";
import { listLlmProviders, llmChat } from "./alphaApi";
import heliBase  from "../assets/heli_ai_base.png";
import heliWait  from "../assets/heli_ai_wait.png";
import heliHello from "../assets/heli_ai_hello.png";
import heliSorry from "../assets/heli_ai_sorry.png";

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

  // 워크스페이스 페이지에서 도크가 비어있으면 헬리가 먼저 인사 + 8가지 질문 안내
  useEffect(() => {
    const isWorkspace = /\/alpha\/ws\//.test(window.location.pathname);
    if (!isWorkspace) return;
    if (messages.length > 0) return;
    setMessages([{
      role: "ai",
      text:
        "안녕하세요! Alpha-Helix의 퍼스널 퀀트 매니저예요. 🌱\n" +
        "투자 전략을 만들기 전에, 8가지만 함께 정리해볼게요. 천천히 답해주셔도 좋아요.\n\n" +
        "먼저 두 가지부터 여쭤볼게요.\n\n" +
        "**1) 투자의 최종 목표는 무엇인가요?**\n" +
        "예) \"5년 안에 월 300만원 현금흐름\", \"10년 뒤 1억 시드\", \"은퇴자금 마련\"\n\n" +
        "**2) 투자 기간(목표 시점까지)은 대략 몇 년 정도로 보시나요?**\n" +
        "예) \"3년\", \"5년\", \"10년 이상\"\n\n" +
        "편하게 답해주시면 이어서 나머지 6가지도 한 단계씩 여쭤볼게요.",
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
              <img src={heliHello} alt="heli" style={{ width: 110, height: 110, objectFit: "contain", marginBottom: 12 }} />
              <div style={{ textAlign: "center", color: theme.textMuted, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                안녕하세요! 퀀트 매니저 Heli예요 👋
              </div>
              <div style={{ textAlign: "center", color: theme.textMuted, fontSize: 11, lineHeight: 1.7 }}>
                "VIX 25 임계값이 적절할까?"<br />
                "내 전략의 약점은?"<br />
                "오늘 시장이 왜 떨어졌어?"
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10, alignItems: "flex-end", gap: 6,
              }}>
                {m.role === "ai" && (
                  <img
                    src={m.error ? heliSorry : heliBase}
                    alt="heli"
                    style={{
                      width: 44, height: 44,
                      objectFit: "contain",
                      flexShrink: 0,
                      alignSelf: "flex-end",
                      background: "transparent",
                      imageRendering: "auto",
                    }}
                  />
                )}
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
            ))
          )}

          {/* "한 번에 끝내기" 배너 — 사용자가 아직 한 마디도 안 했고 Heli 인사말만 있을 때 노출 */}
          {messages.length > 0 && messages.every(m => m.role === "ai") && (
            <div style={{
              margin: "4px 0 12px 50px",
              padding: "14px 16px",
              background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%)",
              border: "2px solid #3b82f6", borderRadius: 12,
              boxShadow: "0 3px 10px rgba(59,130,246,0.12)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#1e3a8a", marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <span>한 번에 끝내기 — 예시 양식 자동 채우기</span>
              </div>
              <div style={{ fontSize: 11, color: "#1e40af", marginBottom: 10, lineHeight: 1.55 }}>
                버튼을 누르면 아래 입력창에 8가지 질문에 대한 <b>예시 답변</b>이 자동으로 채워집니다.
                그대로 전송하거나 원하는 값으로 수정한 뒤 보내면 Goal Profile이 생성됩니다.
              </div>
              <button
                onClick={() => {
                  const example =
                    "⭐ 한 번에 답변드릴게요\n" +
                    "1) 목표: 5년 안에 월 300만원 현금흐름 만들기\n" +
                    "2) 투자기간(년): 5\n" +
                    "3) 초기 투자금(원): 500000000\n" +
                    "4) 월 적립금(원): 1000000\n" +
                    "5) 투자성향(보수적/중립/공격적): 중립\n" +
                    "6) MDD 허용(%): 25\n" +
                    "7) 관심자산(예: QQQ, SCHD): SPY, QQQ, SCHD, GLD\n" +
                    "8) 전략방향(추세추종/평균회귀/모멘텀/변동성조절/무한매수/잘모름): 추세추종 + 변동성조절\n" +
                    "9) 하루 최대 매수 한도(원): 2000000\n" +
                    "10) 하루 최대 매도 한도(원): 2000000";
                  setInput(example);
                }}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)",
                  color: "white", fontWeight: 700, fontSize: 12,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
                }}>
                <span style={{ fontSize: 14 }}>⭐</span> 예시 양식 입력창에 채우기
              </button>
            </div>
          )}
          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
              <img src={heliWait} alt="heli-wait" style={{ width: 36, height: 36, objectFit: "contain" }} />
              <style>{`
                @keyframes heliShimmer {
                  0%   { background-position: 0% 50%; }
                  100% { background-position: 200% 50%; }
                }
                @keyframes heliDot {
                  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                  40%           { transform: translateY(-3px); opacity: 1; }
                }
              `}</style>
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: "linear-gradient(90deg, #93c5fd 0%, #c4b5fd 25%, #a78bfa 50%, #c4b5fd 75%, #93c5fd 100%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "heliShimmer 2s linear infinite",
              }}>
                Heli가 생각 중
              </span>
              <span style={{ display: "inline-flex", gap: 3, marginLeft: 1 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: "linear-gradient(135deg, #93c5fd 0%, #c4b5fd 100%)",
                    animation: `heliDot 1.2s ease-in-out ${i * 0.18}s infinite`,
                  }} />
                ))}
              </span>
            </div>
          )}
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
