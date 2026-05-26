import { useNavigate } from "react-router-dom";
import { Search, MessageCircle } from "lucide-react";

/**
 * 상단바 (사이드바 오른쪽, 메인 위, 높이 44 — 슬림).
 * - 왼쪽: 둥근 검색 입력 + 그 옆 보라 그라데이션 AI 토글
 * - 비로그인 시: 우측에 "로그인" 버튼
 */
export default function TopBar({ onToggleChat, chatOpen, rightOffset = 0, leftOffset = 52 }) {
  const nav = useNavigate();
  const isAuthed = !!localStorage.getItem("dbId");

  return (
    <div style={{
      position: "fixed", top: 0, right: rightOffset, height: 44,
      left: leftOffset,
      transition: "right 0.18s ease, left 0.18s ease",
      display: "flex", alignItems: "center", justifyContent: "flex-start",
      gap: 8, padding: "0 12px",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
      zIndex: 900,
    }}>
      {/* 검색 */}
      <div style={{
        width: 420, height: 32,
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 4px 0 14px",
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.06)",
      }}>
        <Search size={13} style={{ color: "#94A3B8" }} />
        <input
          type="text"
          placeholder="기능 검색 (예: 백테스트, 포트폴리오, 모델 변경…)"
          style={{
            flex: 1, height: "100%", border: "none", outline: "none",
            background: "transparent", fontSize: 12.5, color: "#0F172A",
          }}
        />
      </div>

      {/* AI 말풍선 */}
      <button
        onClick={onToggleChat}
        title={chatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)",
          color: "white",
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: chatOpen
            ? "0 4px 14px rgba(99,102,241,0.55), inset 0 0 0 2px rgba(255,255,255,0.4)"
            : "0 3px 10px rgba(99,102,241,0.35)",
          transition: "background 0.15s, box-shadow 0.15s, transform 0.05s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(99,102,241,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)";
          e.currentTarget.style.boxShadow = chatOpen
            ? "0 4px 14px rgba(99,102,241,0.55), inset 0 0 0 2px rgba(255,255,255,0.4)"
            : "0 3px 10px rgba(99,102,241,0.35)";
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <MessageCircle size={15} strokeWidth={2.2} />
      </button>

      {/* 비로그인 시 로그인 버튼 (우측 끝) */}
      {!isAuthed && (
        <button
          onClick={() => nav("/login")}
          style={{
            marginLeft: "auto",
            height: 30, padding: "0 16px", borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", cursor: "pointer",
            fontSize: 12.5, fontWeight: 700,
            boxShadow: "0 2px 6px rgba(59,130,246,0.3)",
            transition: "filter 0.15s, transform 0.05s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.95)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          로그인
        </button>
      )}
    </div>
  );
}
