import { useEffect, useState } from "react";
import { Undo2, Check, X } from "lucide-react";
import { keepPatch, undoPatch } from "./alphaApi";

/**
 * Alpha Ezer 라이브 패치 알림 바.
 * - window 이벤트 "alphaPatchApplied" { detail:{ wsId, changeSet } } 수신 시 표시
 * - [유지] / [실행 취소] 버튼
 * - 액션 후 window 이벤트 "alphaWorkspaceReload" dispatch → Workspace가 reload()
 */
export default function ChangeBar({ wsId }) {
  const [cs, setCs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const onApplied = (e) => {
      const d = e?.detail;
      if (!d || Number(d.wsId) !== Number(wsId)) return;
      setCs(d.changeSet);
      setMsg(null);
      window.dispatchEvent(new CustomEvent("alphaWorkspaceReload", { detail: { wsId } }));
    };
    window.addEventListener("alphaPatchApplied", onApplied);
    return () => window.removeEventListener("alphaPatchApplied", onApplied);
  }, [wsId]);

  if (!cs) return null;

  const onKeep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await keepPatch(wsId, cs.id);
      setMsg("✅ 유지됨");
      setTimeout(() => setCs(null), 1200);
    } catch (e) {
      setMsg("⚠️ " + (e?.response?.data?.error || e.message));
    } finally { setBusy(false); }
  };

  const onUndo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await undoPatch(wsId, cs.id);
      window.dispatchEvent(new CustomEvent("alphaWorkspaceReload", { detail: { wsId } }));
      setMsg("↩️ 되돌림");
      setTimeout(() => setCs(null), 1200);
    } catch (e) {
      setMsg("⚠️ " + (e?.response?.data?.error || e.message));
    } finally { setBusy(false); }
  };

  const opsSummary = Array.isArray(cs.ops)
    ? cs.ops.map(o => `${o.target}.${o.path}=${JSON.stringify(o.value)}`).join(", ")
    : "";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 18px",
      background: "linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 50%, #EDE9FE 100%)",
      borderBottom: "1px solid #C7D2FE",
      fontSize: 13,
    }}>
      <span style={{
        fontWeight: 700,
        background: "linear-gradient(135deg, #2563eb 0%, #6366f1 55%, #8b5cf6 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
      }}>Heli 변경</span>
      <span style={{ color: "#1e3a5f", fontWeight: 600 }}>{cs.title}</span>
      <span style={{ color: "#475569", fontSize: 11.5, opacity: 0.85, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opsSummary}</span>
      {msg && <span style={{ color: "#0f172a", fontSize: 12 }}>{msg}</span>}
      <button onClick={onKeep} disabled={busy} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "6px 12px", borderRadius: 8, border: "none",
        background: "#DBEAFE", color: "#1e3a5f", fontSize: 12, fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
      }}>
        <Check size={13} /> 유지
      </button>
      <button onClick={onUndo} disabled={busy} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
        background: "white", color: "#374151", fontSize: 12, fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
      }}>
        <Undo2 size={13} /> 실행 취소
      </button>
      <button onClick={() => setCs(null)} title="닫기" style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "#94A3B8", padding: 4, display: "inline-flex",
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
