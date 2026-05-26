import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, TrendingUp, Sparkles, ArrowRight, Pencil, Check, X, ShieldCheck, Activity } from "lucide-react";
import { listWorkspaces, getWorkspace, runBriefing, getMySlogan, updateMySlogan } from "../alpha/alphaApi";
import { useTheme } from "../alpha/ThemeContext";

/**
 * WorkHome — 실제 백엔드(alpha_workspace) 데이터를 읽어 "오늘의 전략 상태 요약"을 표시.
 * - listWorkspaces → 각 워크스페이스 getWorkspace → last_trust_json 읽음 (Trust Score · Status)
 * - 첫 워크스페이스에서 runBriefing 실행 → Today's Living Briefing 요약 렌더링
 * - + New Strategy Workspace → 이름 입력 후 실제 행 생성 → /strategy/:id
 */
const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function healthFromTrust(t) {
  if (t == null) return { label: "미측정", color: "#94A3B8", bg: "#F1F5F9", gradient: "linear-gradient(90deg,#CBD5E1,#E2E8F0)" };
  if (t >= 75)   return { label: "Stable",  color: "#10B981", bg: "#ECFDF5", gradient: "linear-gradient(90deg,#10B981,#34D399)" };
  if (t >= 60)   return { label: "Normal",  color: "#3B82F6", bg: "#EFF6FF", gradient: "linear-gradient(90deg,#3B82F6,#60A5FA)" };
  return               { label: "Caution", color: "#F59E0B", bg: "#FFFBEB", gradient: "linear-gradient(90deg,#F59E0B,#FCD34D)" };
}

export default function WorkHome() {
  const nav = useNavigate();
  const { theme } = useTheme();
  const username = (typeof window !== "undefined" && (localStorage.getItem("username") || localStorage.getItem("dbName"))) || "trader";
  const [strategies, setStrategies] = useState([]); // [{ id, name, trust, status, color, label, goal, progress }]
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await listWorkspaces();
        const fulls = await Promise.all(list.map(w => getWorkspace(w.id).catch(() => null)));
        const items = (fulls.filter(Boolean)).map(w => {
          const trust = (w.lastTrust && typeof w.lastTrust === "object") ? (w.lastTrust.trust_score ?? null) : null;
          const h = healthFromTrust(trust);
          const goal = (w.goalProfile && typeof w.goalProfile === "object")
            ? (w.goalProfile.목표 || w.goalProfile.goal || w.goalProfile.summary || null) : null;
          return { id: w.id, name: w.name, trust, status: w.status, label: h.label, color: h.color, bg: h.bg, gradient: h.gradient, goal };
        });
        setStrategies(items);

        // 첫 워크스페이스에서 오늘의 브리핑 시도 (실패해도 페이지 렌더링은 계속)
        if (items.length > 0) {
          try {
            const b = await runBriefing(items[0].id);
            setBriefing(b);
          } catch (_) { /* ignore */ }
        }
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const firstGoal = strategies.find(s => s.goal)?.goal;
  const firstWs = strategies[0];
  const [slogan, setSlogan] = useState("");
  const [editGoal, setEditGoal] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMySlogan().then(setSlogan).catch(() => {});
  }, []);

  const startEdit = () => {
    setDraft(slogan || firstGoal || "");
    setEditGoal(true);
  };
  const saveEdit = async () => {
    const next = draft.trim();
    setSaving(true);
    try {
      const saved = await updateMySlogan(next);
      setSlogan(saved);
    } catch (e) {
      alert("저장 실패: " + (e?.response?.data?.error || e.message));
    } finally {
      setSaving(false);
      setEditGoal(false);
    }
  };

  // 워크스페이스 생성은 /alpha 페이지의 + 새 워크스페이스 흐름과 동일하게 맞춤:
  // /alpha 로 이동 + ?new=1 쿼리로 자동 prompt 열림 (WorkspaceList 에서 처리)
  const onNewWs = () => nav("/alpha?new=1");

  return (
    <div style={{
      padding: "36px 40px 80px",
      background: "#F8FAFC",
      minHeight: "calc(100vh - 44px)",
      fontFamily: F,
      color: "#0F172A",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17, flexShrink: 0,
            background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
          }}>
            <TrendingUp size={24} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {greeting()}, {username}
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              오늘의 전략 상태 요약
            </p>
          </div>
        </div>
      </div>

      {/* 상단 2-column 카드 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
        marginBottom: 36,
      }}>
        {/* Freedom Goal Card */}
        <section style={cardStyle}>
          <div style={cardHeader}>
            <span style={{ ...iconBubble, color: "#10B981", background: "#ECFDF5" }}>
              <TrendingUp size={18} />
            </span>
            <h3 style={cardTitle}>Freedom Goal</h3>
          </div>
          <div style={{ fontSize: 16, color: "#64748B", margin: "6px 0 18px", paddingLeft: 36, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flexShrink: 0 }}>목표:</span>
            {editGoal ? (
              <>
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditGoal(false); }}
                  disabled={saving}
                  style={{
                    flex: 1, padding: "6px 10px", borderRadius: 8,
                    border: "1px solid #CBD5E1", fontSize: 16, color: "#0F172A",
                    outline: "none", background: "white",
                  }}
                  autoFocus
                />
                <button onClick={saveEdit} disabled={saving} title="저장" style={iconBtn("#10B981")}>
                  <Check size={14} />
                </button>
                <button onClick={() => setEditGoal(false)} disabled={saving} title="취소" style={iconBtn("#94A3B8")}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span style={{ color: "#0F172A", flex: 1, wordBreak: "break-all" }}>
                  {slogan || firstGoal || (loading ? "로딩 중…" : "아직 설정되지 않은 슬로건 — 연필을 눌러 투자의 최종 목표를 적어보세요")}
                </span>
                <button onClick={startEdit} title="수정" style={iconBtn("#64748B")}>
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>
          <div style={{ paddingLeft: 36 }}>
            <button onClick={() => nav("/vision_board")}
              style={{
                background: "transparent", border: "none",
                color: theme.accent, fontSize: 13, fontWeight: 700,
                cursor: "pointer", padding: 0,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
              비전 보드 보기 <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Today's Living Briefing */}
        <section style={cardStyle}>
          <div style={cardHeader}>
            <span style={{ ...iconBubble, color: "#6366f1", background: "#EEF2FF" }}>
              <Sparkles size={18} />
            </span>
            <h3 style={cardTitle}>Today's Living Briefing</h3>
          </div>
          <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.65, margin: "8px 0 18px", paddingLeft: 36, whiteSpace: "pre-wrap" }}>
            {briefing?.briefing
              ? (briefing.briefing.split(/\n+/).map(s => s.trim().replace(/["""'']/g, "").replace(/,\s*$/, "")).find(l => l.length >= 10) || briefing.briefing.slice(0, 160))
              : (loading ? "브리핑을 불러오는 중…" : "워크스페이스를 생성하고 Trust Score를 한번이라도 실행하면 AI 브리핑이 표시됩니다.")}
          </p>
          <button onClick={() => strategies[0] && nav(`/alpha/w/${strategies[0].id}?tab=briefing`)}
            style={{
              marginLeft: 36, background: "transparent", border: "none",
              color: theme.accent, fontSize: 13, fontWeight: 700,
              cursor: strategies[0] ? "pointer" : "not-allowed",
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: 0, opacity: strategies[0] ? 1 : 0.4,
            }}>
            전체 브리핑 보기 <ArrowRight size={14} />
          </button>
        </section>
      </div>

      {/* Strategy Health Cards */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0F172A" }}>
          Strategy Health Cards
        </h2>
        <button onClick={onNewWs}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: theme.accentGradient || theme.accent, color: "white", border: "none",
            padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
          }}
          onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.05)"}
          onMouseLeave={e => e.currentTarget.style.filter = "none"}
        >
          <Plus size={15} /> New Strategy Workspace
        </button>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16,
      }}>
        {err && (
          <div style={{ gridColumn: "1/-1", padding: 14, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13 }}>
            워크스페이스 불러오기 실패: {err}
          </div>
        )}
        {!err && !loading && strategies.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 28, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 12, textAlign: "center", color: "#64748B", fontSize: 14 }}>
            아직 전략 워크스페이스가 없습니다. 오른쪽 위 <b>+ New Strategy Workspace</b> 버튼으로 시작해보세요.
          </div>
        )}
        {loading && strategies.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 20, color: "#94A3B8", fontSize: 13 }}>로딩 중…</div>
        )}
        {strategies.map(s => {
          return (
            <div key={s.id} onClick={() => nav(`/alpha/w/${s.id}`)}
              style={{
                background: "white", border: "1px solid #E2E8F0",
                borderRadius: 14, cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s",
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,23,42,0.10)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "0 1px 4px rgba(15,23,42,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ padding: "16px 18px 18px" }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </div>
                </div>
                {s.goal && (
                  <div style={{
                    fontSize: 12, color: "#64748B", marginBottom: 12, lineHeight: 1.5,
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {s.goal}
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Trust Score</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{s.trust ?? "—"}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: "#F1F5F9", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 999, background: s.gradient,
                      width: s.trust != null ? `${Math.min(s.trust, 100)}%` : "0%",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: s.bg, color: s.color,
                  padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                }}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  border: "1px solid #E2E8F0",
  borderRadius: 14,
  padding: "22px 24px",
};
const cardHeader = { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 };
const cardTitle = { fontSize: 17, fontWeight: 700, margin: 0, color: "#0F172A" };
const iconBubble = {
  width: 28, height: 28, borderRadius: 8,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const iconBtn = (color) => ({
  width: 26, height: 26, borderRadius: 6,
  border: "1px solid #E2E8F0", background: "white", color,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
});
