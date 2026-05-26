import { useState, useEffect, useRef } from "react";
import { Plus, X, Upload, Sparkles, Trash2, Move } from "lucide-react";
import { useTheme } from "../alpha/ThemeContext";

/**
 * VisionBoard — 사용자의 "투자 비전 / 라이프 목표" 콜라주.
 * 이미지/메모 카드를 자유롭게 추가 → 본인 비전을 시각화.
 * 데이터는 localStorage("alpha.visionBoard")에 저장 (서버 연동은 추후).
 */

const STORAGE = "alpha.visionBoard";
const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function saveItems(items) {
  try { localStorage.setItem(STORAGE, JSON.stringify(items)); } catch (_) {}
}

export default function VisionBoard() {
  const { theme } = useTheme();
  const [items, setItems] = useState(loadItems);
  const [hovered, setHovered] = useState(null);
  const [adding, setAdding] = useState(null); // "image" | "memo" | null
  const [memoText, setMemoText] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { saveItems(items); }, [items]);

  const addImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      alert("이미지는 4MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setItems(prev => [
        { id: Date.now(), type: "image", src: reader.result, caption: "" },
        ...prev,
      ]);
      setAdding(null);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const addMemo = () => {
    const text = memoText.trim();
    if (!text) return;
    setItems(prev => [
      { id: Date.now(), type: "memo", text, color: pickColor() },
      ...prev,
    ]);
    setMemoText("");
    setAdding(null);
  };

  const removeItem = (id) => setItems(prev => prev.filter(x => x.id !== id));
  const updateCaption = (id, caption) =>
    setItems(prev => prev.map(x => x.id === id ? { ...x, caption } : x));

  return (
    <div style={{
      padding: "36px 40px 80px",
      background: "#F8FAFC",
      minHeight: "calc(100vh - 44px)",
      fontFamily: F,
      color: "#0F172A",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17, flexShrink: 0,
            background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
          }}>
            <Sparkles size={24} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              비전 보드
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              나의 투자 여정 · 자유 · 라이프 목표를 시각화해보세요
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} style={btnPrimary}>
            <Upload size={15} /> 이미지 추가
          </button>
          <button onClick={() => setAdding(adding === "memo" ? null : "memo")} style={btnSecondary}>
            <Plus size={15} /> 메모 추가
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={addImage} />
        </div>
      </div>

      {/* 메모 입력 */}
      {adding === "memo" && (
        <div style={{
          marginBottom: 24, padding: 16, borderRadius: 14,
          background: "linear-gradient(135deg,#FEF9C3 0%,#FFEDD5 100%)",
          border: "1px solid #FCD34D",
          boxShadow: "0 4px 16px rgba(252,211,77,0.2)",
        }}>
          <textarea
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
            placeholder="예: 5년 안에 월 500만원 현금흐름 달성 🚀"
            autoFocus
            rows={3}
            style={{
              width: "100%", padding: 12, borderRadius: 8,
              border: "1px solid #E5E7EB", fontSize: 14,
              fontFamily: F, resize: "vertical", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button onClick={() => { setAdding(null); setMemoText(""); }} style={btnGhost}>취소</button>
            <button onClick={addMemo} disabled={!memoText.trim()} style={{ ...btnPrimary, opacity: memoText.trim() ? 1 : 0.5 }}>
              메모 추가
            </button>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {items.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "100px 0", gap: 20,
        }}>
          <div style={{
            width: 100, height: 100, borderRadius: 28,
            background: "linear-gradient(135deg,#EFF6FF 0%,#FDF2F8 100%)",
            border: "1.5px solid rgba(168,139,250,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 48,
          }}>
            🎯
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
              아직 비전 보드가 비어있어요
            </div>
            <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6, maxWidth: 420 }}>
              이미지나 메모를 추가해서 당신의 투자 자유 비전을 시각화해보세요.<br/>
              여행지, 집, 자동차, 목표 금액 등 영감을 주는 이미지들을 모아두면 좋아요.
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 16,
        }}>
          {items.map(it => (
            <div
              key={it.id}
              onMouseEnter={() => setHovered(it.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                background: it.type === "memo" ? it.color : "white",
                border: "1px solid #E5E7EB",
                boxShadow: hovered === it.id
                  ? "0 12px 32px rgba(0,0,0,0.16)"
                  : "0 2px 10px rgba(0,0,0,0.06)",
                transform: hovered === it.id ? "translateY(-3px)" : "none",
                transition: "transform 0.18s, box-shadow 0.18s",
                minHeight: it.type === "memo" ? 160 : "auto",
                display: "flex", flexDirection: "column",
              }}
            >
              {it.type === "image" ? (
                <>
                  <img src={it.src} alt={it.caption || "vision"}
                    style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
                  <input
                    value={it.caption}
                    onChange={e => updateCaption(it.id, e.target.value)}
                    placeholder="캡션 추가..."
                    style={{
                      border: "none", padding: "10px 12px", fontSize: 13, color: "#0F172A",
                      fontFamily: F, outline: "none", background: "white", borderTop: "1px solid #F1F5F9",
                    }}
                  />
                </>
              ) : (
                <div style={{
                  padding: 18, fontSize: 15, lineHeight: 1.55, color: "#1F2937",
                  fontWeight: 600, fontFamily: F, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  flex: 1, display: "flex", alignItems: "center",
                }}>
                  {it.text}
                </div>
              )}

              {/* 삭제 버튼 */}
              <button
                onClick={() => removeItem(it.id)}
                style={{
                  position: "absolute", top: 8, right: 8,
                  width: 30, height: 30, borderRadius: 8, border: "none",
                  background: hovered === it.id ? "rgba(239,68,68,0.95)" : "rgba(255,255,255,0.85)",
                  color: hovered === it.id ? "white" : "#94A3B8",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: hovered === it.id ? 1 : 0,
                  transition: "opacity 0.15s, background 0.15s",
                  backdropFilter: "blur(4px)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MEMO_COLORS = [
  "linear-gradient(135deg,#FEF9C3 0%,#FDE68A 100%)",
  "linear-gradient(135deg,#DBEAFE 0%,#BFDBFE 100%)",
  "linear-gradient(135deg,#DCFCE7 0%,#BBF7D0 100%)",
  "linear-gradient(135deg,#FCE7F3 0%,#FBCFE8 100%)",
  "linear-gradient(135deg,#EDE9FE 0%,#DDD6FE 100%)",
  "linear-gradient(135deg,#FFEDD5 0%,#FED7AA 100%)",
];
function pickColor() {
  return MEMO_COLORS[Math.floor(Math.random() * MEMO_COLORS.length)];
}

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
  color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
  boxShadow: "0 3px 12px rgba(99,102,241,0.28)",
};

const btnSecondary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 10, border: "none",
  background: "#DBEAFE", color: "#1e3a5f", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 10,
  background: "white", color: "#374151",
  border: "1px solid #E5E7EB", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
