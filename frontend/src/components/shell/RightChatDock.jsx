import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Send, ChevronRight } from "lucide-react";
import heliBase  from "../../assets/heli_ai_base.png";
import heliWait  from "../../assets/heli_ai_wait.png";
import heliSorry from "../../assets/heli_ai_sorry.png";
import heliFace  from "../../assets/heli_face.png";
import { chatWithAI, langInstruction } from "../../lib/aiClient";
import { useLanguage } from "../../i18n/LanguageContext";
import ModelPicker from "../ai/ModelPicker";
import { applyPatch as applyAlphaPatch, getWorkspace, formalize } from "../../alpha/alphaApi";
import ChangeBar from "../../alpha/ChangeBar";

// 골 프로필이 "전략 카드 만들기"를 제안할 만큼 채워졌는지 판단
const GOAL_REQUIRED = ["horizon_years", "initial_capital_krw", "monthly_contribution_krw", "risk_tolerance", "max_drawdown_target_pct"];
function goalProfileReady(gp) {
  if (!gp || typeof gp !== "object") return false;
  const filled = GOAL_REQUIRED.filter(k => {
    const v = gp[k];
    return v !== undefined && v !== null && v !== "" && !(typeof v === "number" && Number.isNaN(v));
  });
  return filled.length >= 4; // 5개 중 4개 이상이면 제안
}

function renderRichText(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/```(?:heli-patch|alpha-ezer-patch)[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return null;
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0, m, key = 0;
  while ((m = regex.exec(cleaned)) !== null) {
    if (m.index > lastIndex) parts.push(cleaned.slice(lastIndex, m.index));
    parts.push(<strong key={`b${key++}`} style={{ fontWeight: 700, color: "#3b5bdb" }}>{m[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) parts.push(cleaned.slice(lastIndex));
  return parts;
}

const SYS = `너는 Alpha-Helix의 AI 동료 "Heli(헬리)"야. 차분하고 따뜻한 투자 파트너 톤.
이름을 굳이 매 답변마다 소개하지 말고 필요할 때만 가볍게 언급해. 말투는 자연스럽고 고객에게 동료처럼.
전략 설계·백테스트·리스크 관리·Regime·Trust Score·브리핑 해석을 도와. 핵심은 **굵게**, 답변은 3~6줄로 간결하게.

[Patch tool — 워크스페이스 라이브 수정]
다음 두 경우에 반드시 답변 마지막에 \`\`\`heli-patch 블록을 첨부해:
① 사용자가 "적용/바꿔/설정해줘/고쳐줘/수정해줘" 같이 명시적으로 변경을 요청할 때
② 사용자가 투자 목표 정보(목표·기간·초기금·적립금·성향·MDD·관심자산·전략방향 중 2개 이상)를 제공할 때 — 명시적 "저장해줘" 없어도 즉시 goalProfile에 반영해. 확인 후 "목표 프로필 저장됨" 안내.
블록 안엔 다음 형식의 JSON 한 개만:
{
  "title": "한 줄 변경 요약",
  "ops": [
    { "target": "goalProfile|backtest|regime|trustScore|strategy|code", "path": "필드명", "value": <새 값> }
  ]
}
허용 필드 (★ goalProfile 키는 반드시 아래 영문 키를 그대로 사용. 한글 키 금지):
- goalProfile.goal                       (문자열: 한 줄 목표)
- goalProfile.horizon_years              (숫자: 투자기간 연수)
- goalProfile.initial_capital_krw        (숫자: 초기 투자금, 원)
- goalProfile.monthly_contribution_krw   (숫자: 월 적립금, 원)
- goalProfile.risk_tolerance             ("보수적"|"중립"|"공격적"|"매우 공격적")
- goalProfile.max_drawdown_target_pct    (숫자: MDD 허용 %, 예: 25)
- goalProfile.daily_buy_limit_krw / goalProfile.daily_sell_limit_krw (숫자, 원)
- goalProfile.assets_of_interest         (문자열 또는 배열: 예 "TQQQ, SOXL")
- goalProfile.strategy_direction         ("추세추종"|"평균회귀"|"모멘텀"|"변동성조절"|"무한매수"|"잘모름")
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

function HeliAvatar({ src, size = 36 }) {
  return (
    <img src={src} alt="heli" style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
  );
}

export default function RightChatDock({ open, onClose, width = 380, onResize }) {
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
  const [textareaHeight, setTextareaHeight] = useState(72);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef(null);

  // Workspace.jsx 의 현재 탭을 추적 (전략 카드 탭일 때만 "한 번에 끝내기" 배너 노출)
  const [activeTab, setActiveTab] = useState(() =>
    (typeof window !== "undefined" ? localStorage.getItem("alpha.activeTab") : null) || "config"
  );
  useEffect(() => {
    const onTab = (e) => setActiveTab(e?.detail?.tab || "config");
    window.addEventListener("alpha:tabChanged", onTab);
    return () => window.removeEventListener("alpha:tabChanged", onTab);
  }, []);

  const fillExampleAnswer = () => {
    const example =
      "⭐ 한 번에 답변드릴게요\n" +
      "1) 목표: 5년 안에 월 300만원 현금흐름 만들기\n" +
      "2) 투자기간(년): 5\n" +
      "3) 초기 투자금(원): 500000000\n" +
      "4) 월 적립금(원): 1000000\n" +
      "5) 투자성향(보수적/중립/공격적): 중립\n" +
      "6) MDD 허용(%): 25\n" +
      "7) 관심자산(예: QQQ, SCHD): SPY, QQQ, SCHD, GLD\n" +
      "8) 전략방향(추세추종/평균회귀/모멘텀/변동성조절/무한매수/잘모름): 추세추종 + 변동성조절";
    setInput(example);
  };

  // 사용자가 한 번이라도 답하면 배너 자동 숨김
  const showOnboardingBanner =
    activeTab === "config" &&
    !!wsIdInRoute &&
    !messages.some((m) => m.role === "user");

  // 채팅 메시지 안의 액션 버튼 클릭 핸들러
  const runMessageAction = async (action) => {
    if (!action?.id || !action?.wsId) return;
    if (action.id === "formalize") {
      setMessages(m => [...m, { role: "assistant", content: "전략 카드 후보를 생성하고 있어요…" }]);
      try {
        await formalize(action.wsId);
        window.dispatchEvent(new CustomEvent("alpha:tabChanged", { detail: { tab: "strategy" } }));
        window.dispatchEvent(new CustomEvent("alphaWorkspaceReload", { detail: { wsId: action.wsId } }));
        setMessages(m => [...m, { role: "assistant", content: "✅ 전략 카드 후보가 만들어졌어요. **전략 탭**에서 확인해 주세요." }]);
      } catch (e) {
        setMessages(m => [...m, { role: "assistant", content: "⚠️ 전략 카드 생성 실패: " + (e?.response?.data?.error || e.message || String(e)) }]);
      }
    }
  };

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    const onMove = (ev) => {
      onResize && onResize(Math.min(900, Math.max(280, startW + (startX - ev.clientX))));
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

  const startVerticalResize = (e) => {
    e.preventDefault();
    const startY = e.clientY, startH = textareaHeight;
    const onMove = (ev) => {
      setTextareaHeight(Math.min(220, Math.max(48, startH + (startY - ev.clientY))));
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

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages(m => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    if (scrollRef.current) setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
    try {
      const sys = `${SYS}\n${langInstruction(lang)}`;
      const reply = await chatWithAI(
        [...messages, { role: "user", content: text }].map(m => ({ role: m.role, text: m.content })),
        sys, model
      );
      const replyText = reply || "...";
      // 패치 코드블록은 사용자에게 노출하지 않음 (자동 적용 후 안내 메시지만 표시)
      const displayText = replyText
        .replace(/```(?:heli-patch|alpha-ezer-patch)\s*[\s\S]*?```/g, "")
        .replace(/```json\s*([\s\S]*?)```/g, (full, body) =>
          (body.includes('"ops"') && body.includes('"target"')) ? "" : full
        )
        .trim() || "...";
      setMessages(m => [...m, { role: "assistant", content: displayText }]);
      if (scrollRef.current) setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);

      try {
        // 1) heli-patch / alpha-ezer-patch 코드블록 우선 매칭
        // 2) 그게 없으면 일반 ```json 블록 중에서도 ops 배열을 가진 것을 fallback 으로 인정
        let blockBody = null;
        const tagged = replyText.match(/```(?:heli-patch|alpha-ezer-patch)\s*([\s\S]*?)```/);
        if (tagged) {
          blockBody = tagged[1].trim();
        } else {
          const jsonBlocks = [...replyText.matchAll(/```json\s*([\s\S]*?)```/g)];
          for (const m of jsonBlocks) {
            const body = m[1].trim();
            if (body.includes('"ops"') && body.includes('"target"')) {
              blockBody = body;
              break;
            }
          }
        }

        if (blockBody) {
          const routeMatch = (typeof window !== "undefined")
            ? window.location.pathname.match(/\/alpha\/w\/(\d+)/) : null;
          const wsId = (routeMatch ? Number(routeMatch[1]) : null)
            || ((typeof window !== "undefined") ? Number(localStorage.getItem("alpha.lastWsId")) || null : null);
          if (!wsId) {
            setMessages(m => [...m, { role: "assistant", content: "⚠️ 적용할 워크스페이스를 찾을 수 없어요. 워크스페이스를 먼저 열어 주세요." }]);
          } else {
            // LLM이 만든 JSON은 trailing comma / 스마트따옴표 같은 사소한 흠이 잦음 → 1차 복구 후 재시도
            const tryParse = (s) => { try { return [JSON.parse(s), null]; } catch (e) { return [null, e]; } };
            let payload, parseErr;
            [payload, parseErr] = tryParse(blockBody);
            if (!payload) {
              const repaired = blockBody
                .replace(/,(\s*[}\]])/g, "$1")        // trailing comma 제거
                .replace(/[\u201C\u201D]/g, '"')      // 스마트 큰따옴표
                .replace(/[\u2018\u2019]/g, "'");     // 스마트 작은따옴표
              [payload, parseErr] = tryParse(repaired);
            }
            if (!payload) {
              throw new Error(
                "Heli가 만든 패치 JSON이 깨졌어요 (" + (parseErr?.message || "parse error") + "). " +
                "보통 코드 패치처럼 긴 문자열이 들어갈 때 줄바꿈/따옴표 escape를 빠뜨려서 발생해요. " +
                "변경을 좀 더 작게 쪼개서 다시 요청해 보세요."
              );
            }
            const ops = Array.isArray(payload?.ops) ? payload.ops : [];
            const title = payload?.title || "Heli 패치";
            if (ops.length === 0) {
              setMessages(m => [...m, { role: "assistant", content: "⚠️ patch ops 가 비어있어 적용을 건너뛰었어요." }]);
            } else {
              const cs = await applyAlphaPatch(wsId, title, ops);
              window.dispatchEvent(new CustomEvent("alphaPatchApplied", { detail: { wsId, changeSet: cs } }));
              window.dispatchEvent(new CustomEvent("alphaWorkspaceReload", { detail: { wsId } }));
              setMessages(m => [...m, { role: "assistant", content: `✅ 적용됨: **${cs.title}** (#${cs.id}) — 아래 바에서 **유지 / 실행 취소** 가능` }]);

              // goalProfile 패치였으면 완성도 체크 → 충분히 채워졌으면 다음 액션 제안
              const touchedGoal = ops.some(o => o?.target === "goalProfile");
              if (touchedGoal) {
                try {
                  const ws = await getWorkspace(wsId);
                  if (goalProfileReady(ws?.goalProfile) && !ws?.strategy) {
                    setMessages(m => [...m, {
                      role: "assistant",
                      content: "목표 프로필이 충분히 채워졌어요. 이 정보로 **전략 카드 후보**를 만들어 볼까요?",
                      actions: [
                        { id: "formalize", label: "🚀 전략 카드 만들기", wsId },
                      ],
                    }]);
                  }
                } catch (_) { /* 조회 실패는 조용히 무시 */ }
              }
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
      position: "fixed", right: 0, top: 0, bottom: 0,
      width: open ? width : 0,
      background: "#f5f7ff",
      borderLeft: open ? "1px solid #e8eeff" : "none",
      boxShadow: open ? "-4px 0 24px rgba(74,123,247,0.08)" : "none",
      display: "flex", flexDirection: "column",
      transition: "width 0.18s ease",
      overflow: "hidden",
      zIndex: 950, fontFamily: F,
    }}>
      <style>{`
        @keyframes heliBounce {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
        .heli-loading-img { animation: heliBounce 0.9s ease-in-out infinite; }
        @keyframes heliFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes bubbleFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .heli-loading-float { animation: heliFloat 0.9s ease-in-out infinite; }
        .heli-loading-bubble { animation: bubbleFadeIn 0.3s ease; }
        .heli-send-btn { transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease !important; }
        .heli-send-btn:not(:disabled):hover { opacity: 0.88 !important; transform: scale(1.05) !important; }
      `}</style>

      {/* 리사이즈 핸들 */}
      {open && (
        <div onMouseDown={startResize} style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
          cursor: "col-resize", zIndex: 5,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,123,247,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        />
      )}

      {/* 헤더 */}
      <div style={{
        height: 52, padding: "0 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #4a7bf7 0%, #6c63ff 100%)",
        flexShrink: 0, zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.88)",
              border: "2px solid rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              <img src={heliFace} alt="Heli" style={{ width: 30, height: 30, objectFit: "contain" }} />
            </div>
            <span style={{
              position: "absolute", bottom: 0, right: 0,
              width: 8, height: 8, borderRadius: "50%",
              background: "#4ade80", border: "1.5px solid white",
              boxShadow: "0 0 5px #4ade80",
            }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", letterSpacing: 0.1 }}>Heli</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", padding: "2px 7px", borderRadius: 99 }}>AI</span>
          <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20 }}>
            <ModelPicker value={model} onChange={setModel} compact glass />
          </div>
        </div>
        <button onClick={onClose} title="닫기" style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.8)", padding: 4, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto",
        padding: "20px 16px",
        display: "flex", flexDirection: "column", gap: 20,
        background: "#fafbff",
      }}>
        {messages.map((m, i) => {
          const isError = m.role === "assistant" && (m.content?.startsWith("에러:") || m.content?.startsWith("⚠️"));
          return (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-start",
              gap: 10,
            }}>
              {m.role === "assistant" && (
                <HeliAvatar src={isError ? heliSorry : heliBase} size={36} />
              )}
              <div style={{
                maxWidth: "78%", padding: "12px 16px",
                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                ...(m.role === "assistant" ? {
                  background: "#ffffff",
                  border: "1px solid #e8eeff",
                  borderRadius: "4px 16px 16px 16px",
                  boxShadow: "0 2px 8px rgba(74,123,247,0.06)",
                  color: "#1e293b",
                } : {
                  background: "linear-gradient(135deg, #4a7bf7, #6c63ff)",
                  borderRadius: "16px 4px 16px 16px",
                  boxShadow: "0 4px 12px rgba(74,123,247,0.25)",
                  color: "white",
                }),
              }}>
                {m.role === "assistant" ? renderRichText(m.content) : m.content}
                {m.role === "assistant" && Array.isArray(m.actions) && m.actions.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {m.actions.map((a, ai) => (
                      <button
                        key={ai}
                        onClick={() => runMessageAction(a)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 999,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "white",
                          background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                          boxShadow: "0 4px 12px rgba(59,130,246,0.28)",
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* "한 번에 끝내기" 배너 — 전략 카드 탭 + 사용자가 아직 답하지 않은 첫 진입 시 */}
        {showOnboardingBanner && (
          <div style={{
            margin: "0 0 0 46px",
            padding: "16px 18px",
            background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%)",
            border: "2px solid #3b82f6",
            borderRadius: 14,
            boxShadow: "0 3px 10px rgba(59,130,246,0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#1e3a8a", marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <span>한 번에 끝내기 — 예시 양식 자동 채우기</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#1e40af", marginBottom: 12, lineHeight: 1.6 }}>
              버튼을 누르면 <b>8가지 질문에 대한 예시 답변</b>이 아래 입력창에 자동으로 채워집니다.
              그대로 전송하거나 원하는 값으로 수정한 뒤 보내면 바로 Goal Profile이 생성됩니다.
            </div>
            <button
              onClick={fillExampleAnswer}
              style={{
                padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)",
                color: "white", fontWeight: 700, fontSize: 12.5,
                display: "inline-flex", alignItems: "center", gap: 6,
                boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
              }}>
              <span style={{ fontSize: 15 }}>⭐</span> 예시 양식 입력창에 채우기
            </button>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <img
              src={heliWait} alt="heli"
              className="heli-loading-float"
              style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }}
            />
            <div className="heli-loading-bubble" style={{
              padding: "12px 16px",
              background: "#ffffff",
              border: "1px solid #e8eeff",
              borderRadius: "4px 16px 16px 16px",
              boxShadow: "0 2px 8px rgba(74,123,247,0.06)",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#4a7bf7", display: "inline-block",
                  animation: `dotBounce 1.2s infinite`,
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ChangeBar */}
      {wsIdInRoute && <ChangeBar wsId={wsIdInRoute} />}

      {/* 입력 영역 */}
      <div style={{
        padding: "12px 16px 16px",
        borderTop: "1px solid #e8eeff",
        background: "white",
        flexShrink: 0,
      }}>
        {/* 세로 리사이즈 핸들 */}
        <div onMouseDown={startVerticalResize} style={{
          height: 14, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "row-resize", marginBottom: 8,
        }}>
          <div style={{ width: 36, height: 3, borderRadius: 2, background: "#e2e8f0" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="메시지를 입력하세요 (Enter 전송)"
            style={{
              flex: 1, height: textareaHeight, padding: "10px 14px",
              fontSize: 13, lineHeight: 1.5,
              border: `1.5px solid ${inputFocused ? "#4a7bf7" : "#e0e8ff"}`,
              borderRadius: 16, resize: "none", outline: "none",
              fontFamily: F,
              background: "#f5f7ff",
              color: "#1e293b",
              transition: "border-color 0.15s ease",
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="heli-send-btn"
            style={{
              width: 44, height: 44,
              borderRadius: 12, border: "none",
              background: !input.trim() || loading
                ? "#e2e8f0"
                : "linear-gradient(135deg, #4a7bf7, #6c63ff)",
              cursor: !input.trim() || loading ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: input.trim() && !loading ? "0 4px 12px rgba(74,123,247,0.3)" : "none",
            }}
          >
            <Send size={18} color={!input.trim() || loading ? "#94a3b8" : "white"} />
          </button>
        </div>
      </div>
    </aside>
  );
}
