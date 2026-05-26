/**
 * 대시보드용 — 파트너의 "내 지원 내역" 탭.
 * - GET /api/applications/me
 * - mode 에 따라 노출 status 가 달라진다.
 *   - "active"   : APPLIED  (검토 중)
 *   - "accepted" : ACCEPTED/CONTRACTED/IN_PROGRESS  (합격~진행 중)
 *   - "closed"   : COMPLETED/REJECTED/WITHDRAWN
 */
import { useEffect, useMemo, useState } from "react";
import { applicationsApi } from "../../api";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

const MODE_CONFIG = {
  active: {
    title: "지원 중인 프로젝트",
    desc: "검토 결과를 기다리고 있는 내 지원 내역입니다.",
    statuses: ["APPLIED"],
  },
  accepted: {
    title: "계약 대기 / 진행 중인 프로젝트",
    desc: "합격하여 계약을 진행 중이거나 작업 중인 프로젝트입니다.",
    statuses: ["ACCEPTED", "CONTRACTED", "IN_PROGRESS"],
  },
  closed: {
    title: "종료된 지원 내역",
    desc: "완료/거절/철회된 지원 내역입니다.",
    statuses: ["COMPLETED", "REJECTED", "WITHDRAWN"],
  },
};

const STATUS_LABEL = {
  APPLIED: "검토 중", ACCEPTED: "합격", REJECTED: "불합격",
  CONTRACTED: "계약 완료", IN_PROGRESS: "진행 중", COMPLETED: "완료", WITHDRAWN: "철회됨",
};
const STATUS_COLOR = {
  APPLIED:    { bg: "#EFF6FF", color: "#1D4ED8" },
  ACCEPTED:   { bg: "#F0FDF4", color: "#15803D" },
  REJECTED:   { bg: "#FEF2F2", color: "#B91C1C" },
  CONTRACTED: { bg: "#FFF7ED", color: "#C2410C" },
  IN_PROGRESS:{ bg: "#FEF9C3", color: "#854D0E" },
  COMPLETED:  { bg: "#F1F5F9", color: "#475569" },
  WITHDRAWN:  { bg: "#FEE2E2", color: "#B91C1C" },
};

export default function PartnerApplicationsTab({ mode = "active" }) {
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.active;
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    applicationsApi
      .myList()
      .then((list) => setApps(list || []))
      .catch((e) => setError(e?.response?.data?.message || e?.message || "불러오기 실패"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const visible = useMemo(
    () => (apps || []).filter((a) => cfg.statuses.includes(a.status)),
    [apps, cfg]
  );

  const handleWithdraw = async (id) => {
    if (!window.confirm("정말로 지원을 철회하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setBusyId(id);
      await applicationsApi.updateStatus(id, "WITHDRAWN");
      reload();
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "철회 실패");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 34, fontWeight: 900, margin: "0 0 8px", fontFamily: F,
          background: PRIMARY_GRAD, WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent", backgroundClip: "text",
          letterSpacing: "-0.5px", lineHeight: 1.2,
        }}>{cfg.title}</h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.6 }}>{cfg.desc}</p>
      </div>

      {loading && <Empty msg="불러오는 중..." />}
      {!loading && error && <Empty msg={error} tone="error" />}
      {!loading && !error && visible.length === 0 && <Empty msg="이 단계의 지원 내역이 없어요." />}
      {!loading && !error && visible.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              busy={busyId === a.id}
              canWithdraw={a.status === "APPLIED"}
              onWithdraw={() => handleWithdraw(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ msg, tone = "neutral" }) {
  const color = tone === "error" ? "#B91C1C" : "#64748B";
  return (
    <div style={{
      padding: "60px 20px", textAlign: "center", color, fontFamily: F, fontSize: 14,
      background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 16,
    }}>{msg}</div>
  );
}

function ApplicationCard({ app, busy, canWithdraw, onWithdraw }) {
  const statusColor = STATUS_COLOR[app.status] || { bg: "#F1F5F9", color: "#475569" };
  return (
    <div style={{
      padding: 22, background: "#fff", border: "1px solid #E2E8F0",
      borderRadius: 16, boxShadow: "0 1px 3px rgba(15,23,42,0.04)", fontFamily: F,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>{app.projectTitle || `프로젝트 #${app.projectId}`}</h3>
          {app.projectDesc && (
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 10px", lineHeight: 1.55 }}>
              {app.projectDesc.length > 140 ? app.projectDesc.slice(0, 140) + "…" : app.projectDesc}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#94A3B8", flexWrap: "wrap" }}>
            <span>지원일: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString("ko-KR") : "-"}</span>
            {app.projectOwnerUsername && <span>의뢰인: {app.projectOwnerUsername}</span>}
          </div>
        </div>
        <span style={{
          padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: statusColor.bg, color: statusColor.color, whiteSpace: "nowrap",
        }}>{STATUS_LABEL[app.status] || app.status}</span>
      </div>
      {app.message && (
        <div style={{
          marginTop: 12, padding: 12, background: "#F8FAFC", borderRadius: 10,
          fontSize: 13, color: "#475569", lineHeight: 1.55, whiteSpace: "pre-wrap",
        }}>{app.message}</div>
      )}
      {canWithdraw && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onWithdraw}
            disabled={busy}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #FECACA",
              background: "#fff", color: "#B91C1C", fontSize: 12, fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer", fontFamily: F,
              opacity: busy ? 0.5 : 1,
            }}
          >{busy ? "처리 중..." : "지원 철회"}</button>
        </div>
      )}
    </div>
  );
}
