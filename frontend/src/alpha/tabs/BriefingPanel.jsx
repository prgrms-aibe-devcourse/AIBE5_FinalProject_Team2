import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { runBriefing, listWorkspaces, getWorkspace } from "../alphaApi";
import { Volume2, FileText, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export default function BriefingPanel({ id }) {
  const { theme } = useTheme();
  const [briefing, setBriefing] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const userName = (typeof window !== "undefined" && (localStorage.getItem("username") || localStorage.getItem("dbName"))) || "User";

  const BRIEFING_COOLDOWN_MS = 3 * 60 * 60 * 1000;
  const cacheKey = `alpha.briefing.cache.${id}`;

  const loadStrategies = async () => {
    try {
      const list = await listWorkspaces();
      const fulls = await Promise.all(
        list.map(w => getWorkspace(w.id).catch(() => ({ id: w.id, name: w.name, status: w.status, lastTrust: null })))
      );
      const result = fulls.map(w => {
        const trust = (w.lastTrust && typeof w.lastTrust === "object") ? (w.lastTrust.trust_score ?? null) : null;
        const prevKey = `alpha.trust.prev.${w.id}`;
        const prevRaw = localStorage.getItem(prevKey);
        const prevTrust = prevRaw != null && !isNaN(Number(prevRaw)) ? Number(prevRaw) : null;
        const delta = (trust != null && prevTrust != null) ? (trust - prevTrust) : null;
        return { id: w.id, name: w.name, status: w.status, trust, prevTrust, delta };
      });
      setStrategies(result);
      result.forEach(s => {
        if (s.trust != null) localStorage.setItem(`alpha.trust.prev.${s.id}`, String(s.trust));
      });
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const refreshBriefing = async () => {
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const age = Date.now() - (cached.generatedAt || 0);
        if (age < BRIEFING_COOLDOWN_MS) {
          const remainMin = Math.ceil((BRIEFING_COOLDOWN_MS - age) / 60000);
          const h = Math.floor(remainMin / 60);
          const m = remainMin % 60;
          alert(`Living Briefing은 3시간에 한 번만 생성됩니다.\n다음 가능 시간까지 약 ${h > 0 ? `${h}시간 ` : ""}${m}분 남았습니다.`);
          return;
        }
      }
    } catch (_) {}

    setBusy(true);
    setErr(null);
    try {
      const b = await runBriefing(id).catch(e => ({ briefing: null, error: e?.response?.data?.error || e.message }));
      setBriefing(b);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ...b, generatedAt: Date.now() }));
      } catch (_) {}
      await loadStrategies();
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        setBriefing(cached);
      }
    } catch (_) {}
    loadStrategies();
    /* eslint-disable-next-line */
  }, [id]);

  const onListen = () => {
    const text = briefing?.briefing;
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>\-]/g, ""));
      u.lang = "ko-KR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (_) {}
  };

  const recommendedChecks = useMemo(() => {
    const text = briefing?.briefing || "";
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const picked = lines.filter(l => /^[•·\-]/.test(l) || /권장|체크|확인|점검/.test(l));
    const cleaned = picked.map(l => l.replace(/^[•·\-\s]+/, "").replace(/^권장\s*체크\s*[:：]?\s*/, ""));
    const uniq = Array.from(new Set(cleaned)).filter(l => l.length >= 6 && l.length <= 80);
    if (uniq.length === 0) {
      const fallback = [];
      const warn = strategies.find(s => s.trust != null && s.trust < 60);
      if (warn) fallback.push(`${warn.name} 파라미터 재검토`);
      const dropped = strategies.find(s => s.delta != null && s.delta < 0);
      if (dropped) fallback.push(`${dropped.name} Trust Score 하락 원인 확인`);
      fallback.push("현재 국면에서 방어 전략 우선순위 유지");
      return fallback;
    }
    return uniq.slice(0, 5);
  }, [briefing, strategies]);

  const today = (() => {
    const d = briefing?.generatedAt ? new Date(briefing.generatedAt) : new Date();
    if (isNaN(d.getTime())) return briefing?.generatedAt || "";
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  })();

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const briefingHeadline = (() => {
    const text = briefing?.briefing || "";
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    return lines.find(l => l.length >= 10 && l.length <= 200) || text.slice(0, 160);
  })();

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: theme.text, letterSpacing: -0.4 }}>Living Briefing</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.textMuted }}>매일 업데이트되는 전략 상태 브리핑</p>
        </div>
        <button onClick={refreshBriefing} disabled={busy} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8, border: `1px solid ${theme.panelBorder}`,
          background: "white", color: theme.text, fontSize: 12.5, fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
        }}>
          <RefreshCw size={13} /> {busy ? "생성 중…" : "새로고침"}
        </button>
      </div>

      {err && (
        <div style={{
          padding: 12, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)",
          borderRadius: 10, color: theme.danger, fontSize: 13, marginBottom: 12,
        }}>{err}</div>
      )}

      <div style={briefCardStyle(theme)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: theme.text }}>Today</h2>
          <span style={{ fontSize: 12, color: theme.textMuted }}>{today}</span>
        </div>
        <div style={{ fontSize: 14, color: theme.textMuted, marginBottom: 14 }}>
          {greet}, {userName}.
        </div>
        <div style={{
          background: "#F1F5F9", borderRadius: 10, padding: "14px 16px",
          fontSize: 14, color: theme.text, lineHeight: 1.7, marginBottom: 14,
          whiteSpace: "pre-wrap",
        }}>
          {briefing?.briefing
            ? briefingHeadline
            : (busy ? "AI 매니저가 오늘의 브리핑을 작성 중입니다…" : "새로고침을 눌러 오늘의 브리핑을 생성하세요.")}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onListen} disabled={!briefing?.briefing} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 8, border: "none",
            background: briefing?.briefing ? "#0F172A" : "#94A3B8",
            color: "white", fontSize: 13, fontWeight: 600,
            cursor: briefing?.briefing ? "pointer" : "not-allowed",
          }}>
            <Volume2 size={14} /> Listen Briefing
          </button>
          <button onClick={() => alert(briefing?.briefing || "브리핑이 아직 없습니다.")} disabled={!briefing?.briefing}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 8,
              border: "1px solid #E5E7EB", background: "white", color: theme.text,
              fontSize: 13, fontWeight: 600, cursor: briefing?.briefing ? "pointer" : "not-allowed",
            }}>
            <FileText size={14} /> Read Full Briefing
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <div style={briefCardStyle(theme)}>
          <h3 style={briefCardTitle(theme)}>Strategy Health</h3>
          {strategies.length === 0 && (
            <div style={{ fontSize: 13, color: theme.textMuted }}>워크스페이스가 없습니다.</div>
          )}
          {strategies.map(s => {
            const lvl = healthLevel(s.trust);
            return (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <lvl.Icon size={17} color={lvl.color} />
                  <span style={{ fontSize: 13.5, color: theme.text, fontWeight: 600 }}>{s.name}</span>
                </div>
                <span style={{ fontSize: 13, color: lvl.color, fontWeight: 700 }}>{lvl.label}</span>
              </div>
            );
          })}
        </div>

        <div style={briefCardStyle(theme)}>
          <h3 style={briefCardTitle(theme)}>Trust Score Changes</h3>
          {strategies.filter(s => s.trust != null).length === 0 && (
            <div style={{ fontSize: 13, color: theme.textMuted }}>아직 Trust Score 기록이 없습니다. 워크스페이스에서 Trust Score를 실행해 주세요.</div>
          )}
          {strategies.filter(s => s.trust != null).map(s => (
            <div key={s.id} style={{ padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, color: theme.text, fontWeight: 600 }}>{s.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: theme.text }}>
                  {s.prevTrust != null && <><span style={{ color: theme.textMuted }}>{s.prevTrust}</span><span style={{ color: theme.textMuted }}>→</span></>}
                  <span style={{ fontWeight: 700 }}>{s.trust}</span>
                  {s.delta != null && (s.delta < 0
                    ? <TrendingDown size={15} color="#DC2626" />
                    : s.delta > 0 ? <TrendingUp size={15} color="#10B981" /> : null)}
                </div>
              </div>
              {s.delta != null && s.delta !== 0 && (
                <div style={{ fontSize: 12, color: s.delta < 0 ? "#DC2626" : "#10B981", marginTop: 2 }}>
                  {s.delta > 0 ? `+${s.delta}` : s.delta}
                </div>
              )}
              {s.delta == null && s.trust != null && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>첫 측정 — 다음 새로고침 시 변화량 표시</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...briefCardStyle(theme), marginTop: 18 }}>
        <h3 style={briefCardTitle(theme)}>Recommended Checks</h3>
        {recommendedChecks.map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, marginBottom: 8,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "#E2E8F0", color: "#475569",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flex: "0 0 auto",
            }}>{i + 1}</span>
            <span style={{ fontSize: 13.5, color: theme.text }}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function briefCardStyle(theme) {
  return {
    background: "white",
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 14,
    padding: "20px 22px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  };
}
function briefCardTitle(theme) {
  return { margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: theme.text };
}
function healthLevel(trust) {
  if (trust == null) return { label: "미측정", color: "#94A3B8", Icon: AlertTriangle };
  if (trust >= 75)   return { label: "Stable",  color: "#10B981", Icon: TrendingUp };
  if (trust >= 60)   return { label: "Normal",  color: "#3B82F6", Icon: TrendingUp };
  return                    { label: "Caution", color: "#F59E0B", Icon: AlertTriangle };
}
