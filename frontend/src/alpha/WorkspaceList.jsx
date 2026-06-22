import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, ArrowRight, Star, BookOpen, ChevronRight, Zap, TrendingUp, Bitcoin, Layers, X } from "lucide-react";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import { useTheme, BRAND_GRADIENT } from "./ThemeContext";
import { useLanguage } from "../i18n/useLanguage";
import Toast from "../components/common/Toast";
import { listWorkspaces, createWorkspace, deleteWorkspace, updateWorkspaceStatus } from "./alphaApi";

const PRIMARY_KEY = "alpha.primaryWsId";
const MAX_LIVE = 3;

const STATUS_COLOR = {
  DRAFT:      { bar: "#94A3B8", bg: "#F1F5F9", text: "#475569" },
  GOAL_SET:   { bar: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" },
  FORMALIZED: { bar: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" },
  TESTED:     { bar: "#10B981", bg: "#ECFDF5", text: "#047857" },
  LIVE:       { bar: "#22C55E", bg: "#F0FDF4", text: "#16A34A" },
};

export default function WorkspaceList() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalName, setCreateModalName] = useState("");
  const [createModalError, setCreateModalError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [primaryTarget, setPrimaryTarget] = useState(null); // { id, name } — 대표 설정 확인 모달
  const [liveLimitOpen, setLiveLimitOpen] = useState(false); // LIVE 최대 개수 초과 경고 모달
  const [primaryId, setPrimaryId] = useState(() => {
    const v = localStorage.getItem(PRIMARY_KEY);
    return v ? Number(v) : null;
  });
  const [sortedPrimaryId, setSortedPrimaryId] = useState(() => {
    const v = localStorage.getItem(PRIMARY_KEY);
    return v ? Number(v) : null;
  });
  const [newlyPrimaryId, setNewlyPrimaryId] = useState(null); // 펄스 애니 대상
  const [wsFilter, setWsFilter] = useState("all");
  const [primaryToast, setPrimaryToast] = useState(null); // { name }
  const autoPromptedRef = useRef(false);

  const setPrimary = (id) => {
    setPrimaryId(id);
    try {
      localStorage.setItem(PRIMARY_KEY, String(id));
      localStorage.setItem("alpha.lastWsId", String(id));
      window.dispatchEvent(new CustomEvent("alpha:primary-change", { detail: { id } }));
    } catch (_) {}
  };

  const onConfirmPrimary = () => {
    if (!primaryTarget) return;
    const { id, name } = primaryTarget;
    setPrimary(id);
    setNewlyPrimaryId(id);
    setPrimaryToast({ name });
    setPrimaryTarget(null);
    // 카드가 금빛으로 빛난 뒤 위로 이동
    setTimeout(() => setSortedPrimaryId(id), 700);
    setTimeout(() => setNewlyPrimaryId(null), 1200);
  };

  const load = () => {
    listWorkspaces().then(setItems).catch(e => setErr(e?.response?.data?.error || e.message));
  };
  useEffect(load, []);

  const onCreate = (prefill = "") => {
    setCreateModalName(prefill);
    setCreateModalOpen(true);
  };

  const onConfirmCreate = async () => {
    const trimmed = createModalName.trim();
    if (!trimmed) return;
    const duplicate = (items || []).some(
      w => w.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCreateModalError(t("workspace.duplicate"));
      return;
    }
    setCreateModalError("");
    setCreateModalOpen(false);
    setCreating(true);
    try {
      const w = await createWorkspace(trimmed);
      navigate(`/alpha/w/${w.id}`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      if (e?.response?.status === 409) {
        setCreateModalOpen(true);
        setCreateModalError(msg);
      } else {
        alert(t("workspace.createFailed", { err: msg }));
      }
    } finally {
      setCreating(false);
    }
  };

  // WorkHome 의 + New Strategy Workspace 클릭 시 /alpha?new=1 로 이동 → 자동 prompt
  useEffect(() => {
    if (autoPromptedRef.current) return;
    const newParam = searchParams.get("new");
    if (newParam) {
      autoPromptedRef.current = true;
      setSearchParams({}, { replace: true });
      onCreate(newParam === "1" ? "" : decodeURIComponent(newParam));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onDelete = (id, name) => setDeleteTarget({ id, name });

  const onToggleLive = async (w) => {
    const next = w.status === "LIVE" ? "TESTED" : "LIVE";
    // LIVE 로 전환 시 최대 개수 제한 — 초과하면 팝업 띄우고 중단.
    if (next === "LIVE") {
      const liveCount = (items || []).filter(it => it.status === "LIVE").length;
      if (liveCount >= MAX_LIVE) { setLiveLimitOpen(true); return; }
    }
    // 낙관적 업데이트
    setItems(prev => (prev || []).map(it => it.id === w.id ? { ...it, status: next } : it));
    try {
      await updateWorkspaceStatus(w.id, next);
    } catch (e) {
      alert(t("workspace.statusChangeFailed", { err: e?.response?.data?.error || e.message }));
      load();
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteWorkspace(deleteTarget.id); load(); }
    catch (e) { alert(t("workspace.deleteFailed", { err: e?.response?.data?.error || e.message })); }
    finally { setDeleteTarget(null); }
  };

  const filteredItems = (items || []).filter(w => {
    if (wsFilter === "live") return w.status === "LIVE";
    if (wsFilter === "notlive") return w.status !== "LIVE";
    return true;
  }).slice().sort((a, b) => {
    if (a.id === sortedPrimaryId) return -1;
    if (b.id === sortedPrimaryId) return 1;
    return 0;
  });

  return (
    <div style={{ padding: "clamp(16px, 3vw, 36px) clamp(12px, 3vw, 40px) 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)" }}>
      <style>{`
        @keyframes liveBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
        @keyframes primaryPulse {
          0%   { box-shadow: 0 0 0px rgba(251,191,36,0);   transform: scale(1);    }
          30%  { box-shadow: 0 0 28px rgba(251,191,36,0.7), 0 0 60px rgba(251,191,36,0.35); transform: scale(1.012); }
          65%  { box-shadow: 0 0 18px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2);  transform: scale(1.006); }
          100% { box-shadow: 0 0 15px rgba(251,191,36,0.35),0 0 40px rgba(251,191,36,0.2);  transform: scale(1);    }
        }
      `}</style>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17, flexShrink: 0,
            background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
          }}>
            <Layers size={24} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {t("workspace.title")}
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {t("workspace.subtitle")}
            </p>
          </div>
        </div>
        <button onClick={() => onCreate()} disabled={creating}
          data-tutorial-id="tutorial-new-workspace"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 16px", borderRadius: 10,
            background: theme.accentGradient || theme.accent, color: "white", border: "none",
            fontSize: 13, fontWeight: 700, cursor: creating ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
          }}>
          <Plus size={16} /> {creating ? t("workspace.creating") : t("workspace.newWorkspace")}
        </button>
      </div>

      {err && (
        <div style={{
          padding: 12, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)",
          borderRadius: 10, color: theme.danger, fontSize: 13, margin: "16px 0",
        }}>{err}</div>
      )}

      {items === null && <p style={{ color: theme.textMuted, marginTop: 30 }}>{t("workspace.loading")}</p>}

      {items?.length === 0 && (
        <div style={{
          marginTop: 40, padding: 40, textAlign: "center",
          background: theme.panel, border: `1px dashed ${theme.panelBorder}`, borderRadius: 16,
        }}>
          <h3 style={{ margin: "0 0 6px", color: theme.text }}>{t("workspace.empty.heading")}</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 18px" }}>
            {t("workspace.empty.desc")}
          </p>
          <button onClick={() => onCreate()} style={{
            padding: "10px 20px", background: theme.accent, color: "white", border: "none",
            borderRadius: 10, fontWeight: 700, cursor: "pointer",
          }}>{t("workspace.empty.btn")}</button>
        </div>
      )}

      {/* ====== 필터 탭 ====== */}
      {items !== null && items.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          {[
            { key: "all",     label: t("workspace.filters.all"),     count: items.length },
            { key: "live",    label: t("workspace.filters.live"),    count: items.filter(w => w.status === "LIVE").length },
            { key: "notlive", label: t("workspace.filters.notlive"), count: items.filter(w => w.status !== "LIVE").length },
          ].map(({ key, label, count }) => {
            const active = wsFilter === key;
            return (
              <button key={key} onClick={() => setWsFilter(key)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 15px", borderRadius: 20, border: "none",
                background: active
                  ? "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)"
                  : "rgba(148,163,184,0.12)",
                color: active ? "white" : "#475569",
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: "pointer",
                boxShadow: active ? "0 3px 12px rgba(99,102,241,0.28)" : "none",
                transition: "all 0.15s",
              }}>
                {label}
                {count > 0 && (
                  <span style={{
                    background: active ? "rgba(255,255,255,0.25)" : "rgba(100,116,139,0.14)",
                    color: active ? "white" : "#64748B",
                    borderRadius: 10, padding: "0 6px",
                    fontSize: 11, fontWeight: 700, lineHeight: "18px",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ====== 내 워크스페이스 목록 ====== */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 24 }}>
        {filteredItems.length === 0 && wsFilter !== "all" && (
          <div style={{
            padding: 32, textAlign: "center",
            background: "white", border: "1px dashed #E2E8F0", borderRadius: 14,
            color: "#94A3B8", fontSize: 13, fontWeight: 500,
          }}>
            {wsFilter === "live" ? t("workspace.filters.noLive") : t("workspace.filters.noPreparing")}
          </div>
        )}
        {filteredItems.map(w => {
            const isPrimary = w.id === primaryId;
            const isNewlyPrimary = w.id === newlyPrimaryId;
            const sc = STATUS_COLOR[w.status] || STATUS_COLOR.DRAFT;
            return (
          <div key={w.id}
            style={{
              background: "#ffffff",
              border: isPrimary ? "1px solid #FDE68A" : "1px solid #E2E8F0",
              borderRadius: 14,
              display: "flex", alignItems: "stretch", width: "100%",
              boxShadow: isPrimary
                ? "0 0 15px rgba(251,191,36,0.35), 0 0 40px rgba(251,191,36,0.2), 0 0 80px rgba(251,191,36,0.1)"
                : "0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
              transition: "box-shadow 0.15s, transform 0.15s",
              animation: isNewlyPrimary ? "primaryPulse 0.9s ease forwards" : undefined,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = isPrimary ? "0 0 20px rgba(251,191,36,0.45), 0 0 55px rgba(251,191,36,0.25), 0 0 100px rgba(251,191,36,0.12)" : "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = isPrimary ? "0 0 15px rgba(251,191,36,0.35), 0 0 40px rgba(251,191,36,0.2), 0 0 80px rgba(251,191,36,0.1)" : "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {/* 본문 */}
            <div style={{ flex: 1, minWidth: 0, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              {/* 상태 아이콘 원형 */}
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: isPrimary ? "#FEF3C7" : w.status === "LIVE" ? "#F0FDF4" : "#F1F5F9",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "none",
              }}>
                <Layers size={18} color={isPrimary ? "#B45309" : w.status === "LIVE" ? "#22C55E" : "#94A3B8"} strokeWidth={2.2} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{w.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                    background: isPrimary ? "#FFF8E1" : sc.bg,
                    color: isPrimary ? "#1C1400" : sc.text,
                    border: `1px solid ${isPrimary ? "#FFBE0B" : sc.bar}55`,
                  }}>{t(`workspace.statusLabels.${w.status}`) || w.status}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    {t("workspace.modified")} {new Date(w.updatedAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => onToggleLive(w)}
                  title={w.status === "LIVE" ? t("workspace.liveDeactivate") : t("workspace.liveActivate")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 12px", borderRadius: 8,
                    background: w.status === "LIVE"
                      ? "linear-gradient(135deg,#86efac 0%,#22c55e 100%)"
                      : "#F0FDF4",
                    color: w.status === "LIVE" ? "white" : "#16A34A",
                    border: w.status === "LIVE" ? "none" : "1px solid #BBF7D0",
                    fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    boxShadow: w.status === "LIVE" ? "0 2px 8px rgba(34,197,94,0.30)" : "none",
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: w.status === "LIVE" ? "white" : "#22C55E",
                    boxShadow: w.status === "LIVE"
                      ? "0 0 0 2px rgba(255,255,255,0.45)"
                      : "0 0 0 2px rgba(34,197,94,0.20)",
                    animation: w.status === "LIVE" ? "liveBlink 1.4s ease-in-out infinite" : "none",
                    display: "inline-block",
                  }} />
                  LIVE
                </button>
                <button
                  onClick={() => { if (!isPrimary) setPrimaryTarget({ id: w.id, name: w.name }); }}
                  title={isPrimary ? t("workspace.primaryLabel") : t("workspace.setPrimary")}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                    minWidth: 92,
                    padding: "7px 12px", borderRadius: 8,
                    background: isPrimary
                      ? "linear-gradient(135deg,#fde68a 0%,#f59e0b 100%)"
                      : "white",
                    color: isPrimary ? "white" : "#475569",
                    border: isPrimary ? "none" : "1px solid #E2E8F0",
                    fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    boxShadow: isPrimary ? "0 2px 8px rgba(245,158,11,0.30)" : "none",
                  }}>
                  {/* 통통한 별 SVG — 선택 시 노란 채움, 비선택 시 노란 외곽선만 */}
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ display: "block" }}>
                    <path
                      d="M12 2.5l2.95 5.98 6.6.96-4.78 4.65 1.13 6.57L12 17.55l-5.9 3.11 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z"
                      fill={isPrimary ? "#FFFFFF" : "none"}
                      stroke={isPrimary ? "#FFFFFF" : "#F59E0B"}
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {isPrimary ? t("workspace.primaryLabel") : t("workspace.setPrimary")}
                </button>
                <button onClick={e => {
                  const btn = e.currentTarget;
                  btn.style.transform = "scale(0.94)";
                  btn.style.opacity = "0.8";
                  setTimeout(() => navigate(`/alpha/w/${w.id}`), 120);
                }} style={{
                  padding: "7px 14px",
                  background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
                  color: "white", border: "none", borderRadius: 8,
                  fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  boxShadow: "0 2px 8px rgba(99,102,241,0.25)",
                  transition: "transform 0.12s, opacity 0.12s",
                }}>{t("workspace.open")} <ArrowRight size={13} /></button>
                <button onClick={() => onDelete(w.id, w.name)} title="삭제" style={{
                  padding: "7px 8px", background: "transparent",
                  color: "#EF4444", border: "1px solid #FECACA",
                  borderRadius: 8, cursor: "pointer", display: "inline-flex",
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
            );
          })}
      </div>

      <CreateWorkspaceModal
        open={createModalOpen}
        name={createModalName}
        onChange={v => { setCreateModalName(v); setCreateModalError(""); }}
        onConfirm={onConfirmCreate}
        onClose={() => { setCreateModalOpen(false); setCreateModalError(""); }}
        error={createModalError}
      />
      <DeleteWorkspaceModal
        target={deleteTarget}
        onConfirm={onConfirmDelete}
        onClose={() => setDeleteTarget(null)}
        theme={theme}
      />
      <SetPrimaryModal
        target={primaryTarget}
        onConfirm={onConfirmPrimary}
        onClose={() => setPrimaryTarget(null)}
      />
      <LiveLimitModal
        open={liveLimitOpen}
        onClose={() => setLiveLimitOpen(false)}
      />
      {primaryToast && (
        <Toast
          type="success"
          title={t("workspace.primaryToast")}
          body={`"${primaryToast.name}"`}
          onClose={() => setPrimaryToast(null)}
        />
      )}
    </div>
  );
}

function LiveLimitModal({ open, onClose }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
      }}>
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)",
          borderBottom: "1px solid #FDE68A",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
          }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#78350F" }}>{t("workspace.liveLimit.title", { max: MAX_LIVE })}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#92400E" }}>{t("workspace.liveLimit.sub")}</p>
          </div>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
            {t("workspace.liveLimit.body", { max: MAX_LIVE })}
          </p>
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 10,
            background: "#FFFBEB", border: "1px solid #FDE68A",
            fontSize: 12.5, color: "#78350F", lineHeight: 1.65,
          }}>
            {t("workspace.liveLimit.tip")}
          </div>
        </div>
        <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 3px 10px rgba(245,158,11,0.3)",
          }}>{t("workspace.liveLimit.confirm")}</button>
        </div>
      </div>
    </div>
  );
}


function DeleteWorkspaceModal({ target, onConfirm, onClose, theme }) {
  const { t } = useLanguage();
  const [inputName, setInputName] = React.useState("");
  const [shake, setShake] = React.useState(false);

  if (!target) return null;

  const matched = inputName === target.name;

  const handleConfirm = () => {
    if (!matched) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    onConfirm();
  };

  const handleClose = () => {
    setInputName("");
    onClose();
  };

  return (
    <div onClick={handleClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        .delete-input-shake { animation: shake 0.45s ease; }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
      }}>
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)",
          borderBottom: "1px solid #FECACA",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg,#f87171,#ef4444)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
          }}>
            <Trash2 size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#7f1d1d" }}>{t("workspace.deleteModal.title")}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#991b1b" }}>{t("workspace.deleteModal.irreversible")}</p>
          </div>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
            {t("workspace.deleteModal.body", { name: target.name })}
          </p>
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 10,
            background: "#FEF2F2", border: "1px solid #FECACA",
            fontSize: 12.5, color: "#991b1b", lineHeight: 1.65,
          }}>
            {t("workspace.deleteModal.warning")}
          </div>
          <div style={{ marginTop: 20 }}>
            <label style={{ display: "block", fontSize: 12.5, color: "#6B7280", marginBottom: 6 }}>
              {t("workspace.deleteModal.inputLabel", { name: target.name })}
            </label>
            <input
              className={shake ? "delete-input-shake" : ""}
              value={inputName}
              onChange={e => setInputName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConfirm()}
              placeholder={target.name}
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", borderRadius: 10, fontSize: 13,
                border: `1.5px solid ${inputName.length > 0 && !matched ? "#f87171" : "#E2E8F0"}`,
                outline: "none", color: "#111827",
                background: inputName.length > 0 && !matched ? "#FEF2F2" : "white",
                transition: "border-color 0.2s, background 0.2s",
              }}
            />
            {inputName.length > 0 && !matched && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444" }}>
                {t("workspace.deleteModal.mismatch")}
              </p>
            )}
          </div>
        </div>
        <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={handleClose} style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid #E2E8F0", background: "white", color: "#374151",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{t("workspace.deleteModal.cancel")}</button>
          <button onClick={handleConfirm} style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: matched
              ? "linear-gradient(135deg,#f87171,#ef4444)"
              : "#FCA5A5",
            color: "white", fontSize: 13, fontWeight: 700,
            cursor: matched ? "pointer" : "not-allowed",
            boxShadow: matched ? "0 3px 10px rgba(239,68,68,0.3)" : "none",
            transition: "background 0.2s, box-shadow 0.2s",
          }}>{t("workspace.deleteModal.confirm")}</button>
        </div>
      </div>
    </div>
  );
}

function SetPrimaryModal({ target, onConfirm, onClose }) {
  const { t } = useLanguage();
  if (!target) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#ffffff", borderRadius: 20, width: "100%", maxWidth: 420,
        border: "none", overflow: "hidden",
        boxShadow: "0 0 12px rgba(251,191,36,0.3), 0 0 30px rgba(251,191,36,0.15)",
      }}>
        <div style={{
          padding: "24px 28px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #F1F5F9",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "#FEF3C7",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Star size={20} color="#B45309" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{t("workspace.primaryModal.title")}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748B" }}>{t("workspace.primaryModal.sub")}</p>
          </div>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
            {t("workspace.primaryModal.body", { name: target.name })}
          </p>
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 10,
            background: "#FFFBEB", border: "1px solid #FDE68A",
            fontSize: 12.5, color: "#78350F", lineHeight: 1.65,
          }}>
            {t("workspace.primaryModal.tip")}
          </div>
        </div>
        <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid #E2E8F0", background: "white", color: "#374151",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{t("workspace.primaryModal.cancel")}</button>
          <button
            onClick={onConfirm}
            onMouseEnter={e => e.currentTarget.style.background = "#FEF3C7"}
            onMouseLeave={e => e.currentTarget.style.background = "#FFFBEB"}
            style={{
              padding: "10px 20px", borderRadius: 10,
              border: "1px solid #FDE68A",
              background: "#FFFBEB",
              color: "#92400E", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>{t("workspace.primaryModal.confirm")}</button>
        </div>
      </div>
    </div>
  );
}
