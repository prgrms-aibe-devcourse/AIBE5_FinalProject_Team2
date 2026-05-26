/**
 * 진행 프로젝트 관리 탭 — 실시간 백엔드 연동 컴포넌트.
 * Client / Partner 대시보드 공용. role 으로 분기.
 * 기존 ProjectDetailDash 디자인 완전 유지 + 실 DB 연결.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  projectsApi,
  applicationsApi,
  dashboardApi,
  milestonesApi,
  escrowsApi,
  paymentMethodsApi,
  projectModulesApi,
  projectAttachmentsApi,
} from "../../api";
import { loadTossPayments, makeOrderId, makeCustomerKey } from "../../lib/tossPayments";
import useStore from "../../store/useStore";
import {
  ScopeModal,
  DeliverablesModal,
  ScheduleModal,
  PaymentModal,
  RevisionModal as RevisionModuleModal,
  CompletionModal,
  SpecialTermsModal,
} from "../ContractModals";
import { renderProjectOverview } from "../../lib/projectMarkdown";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

const MS_STATUS_LABEL = {
  PENDING: "결제 대기", IN_PROGRESS: "작업 중", SUBMITTED: "납품 검수 중",
  REVISION_REQUESTED: "수정 요청", APPROVED: "정산 완료", COMPLETED: "정산 완료",
};
const MS_STATUS_COLOR = {
  PENDING: "#94A3B8", IN_PROGRESS: "#3B82F6", SUBMITTED: "#7C3AED",
  REVISION_REQUESTED: "#EF4444", APPROVED: "#16A34A", COMPLETED: "#16A34A",
};
const ESCROW_STYLES = {
  "결제 대기":        { bg: "#FFF7ED", border: "#FED7AA", color: "#C2410C", icon: "🕐" },
  "에스크로 보관 중": { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8", icon: "🔒" },
  "납품 검수 중":     { bg: "#F5F3FF", border: "#DDD6FE", color: "#5B21B6", icon: "🔍" },
  "정산 완료":        { bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D", icon: "✅" },
  "수정 요청":        { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: "⚠️" },
  "환불됨":           { bg: "#F8FAFC", border: "#E2E8F0", color: "#64748B", icon: "↩" },
};
const CONTRACT_LABELS = {
  scope:       "작업 범위",
  deliverable: "최종 전달물 정의서",
  schedule:    "마감 일정 및 마일스톤",
  payment:     "총 금액",
  revision:    "수정 가능 범위",
  completion:  "완료 기준",
  terms:       "추가 특약 (선택)",
};
const CONTRACT_KEYS = ["scope","deliverable","schedule","payment","revision","completion","terms"];
const MODULE_KEY_MAP = {
  requirements: "scope", design: "deliverable", api: "schedule",
  auth: "payment", recommendation: "revision", qa: "completion", deploy: "terms",
};

const _isAgreementCompleted = (s) => s === "확정" || s === "협의완료";

function statusStyle(s) {
  if (s === "논의 중")  return { bg: "#FEF3C7", text: "#D97706" };
  if (s === "제안됨")   return { bg: "#DBEAFE", text: "#1D4ED8" };
  if (s === "확정")     return { bg: "#DCFCE7", text: "#16A34A" };
  if (s === "협의완료") return { bg: "#DCFCE7", text: "#16A34A" };
  return { bg: "#F1F5F9", text: "#64748B" };
}

const escrowDisplayStatus = (escrow, msStatus) => {
  if (!escrow) return "결제 대기";
  if (escrow.status === "RELEASED") return "정산 완료";
  if (escrow.status === "DEPOSITED" && msStatus === "SUBMITTED") return "납품 검수 중";
  if (escrow.status === "DEPOSITED") return "에스크로 보관 중";
  if (escrow.status === "REFUNDED") return "환불됨";
  if (msStatus === "REVISION_REQUESTED") return "수정 요청";
  return "결제 대기";
};

const krw = (n) => "₩" + Number(n || 0).toLocaleString("ko-KR");
const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.getFullYear() + "." + String(d.getMonth()+1).padStart(2,"0") + "." + String(d.getDate()).padStart(2,"0");
};
const fmtDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.getFullYear() + "년 " + (d.getMonth()+1) + "월 " + d.getDate() + "일 · "
       + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
};
const calcDDay = (deadline) => {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline) - new Date()) / (1000*60*60*24));
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return "D-DAY";
  return `D-${diff}`;
};

/* ════════════════════════════════════════════════════════ */
export default function ProjectManageTabLive({
  role = "CLIENT",
  initialSelectedId = null,
  onGoSchedule,
  onOpenProjectMeeting,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      let projects = [];
      if (role === "CLIENT") {
        const list = await projectsApi.myList();
        // 클라이언트는 본인이 등록한 프로젝트 중 "계약 협의 시작 이후" 단계의 프로젝트를 모두 노출.
        // - IN_PROGRESS/COMPLETED : 진행 중 / 완료 카드
        // - CLOSED                 : 계약 세부 협의 미팅 단계 → "시작 전" 뱃지로 구분 표시.
        // - RECRUITING 은 "시작 전 프로젝트" 탭에서 별도 관리.
        const ALLOW = new Set(["IN_PROGRESS","COMPLETED","CLOSED","진행중","완료"]);
        projects = (list || []).filter((p) => ALLOW.has(p.status)).map((p) => ({
          id: p.id, title: p.title, status: p.status,
          description: p.desc, budgetAmount: p.budgetAmount, deadline: p.deadline,
        }));
      } else {
        const apps = await applicationsApi.myList?.() || [];
        const seen = new Set();
        for (const app of apps) {
          const appStatus = app.status || app.applicationStatus;
          // 작성자가 🚀 버튼을 눌러 IN_PROGRESS 로 보장된 application 만 카드 표시.
          if (!["IN_PROGRESS","COMPLETED"].includes(appStatus)) continue;
          const pid = app.projectId;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          projects.push({
            id: pid,
            title: app.projectTitle || `프로젝트 #${pid}`,
            status: app.projectStatus || "IN_PROGRESS",
            deadline: app.deadline,
          });
        }
      }
      const enriched = await Promise.all(projects.map(async (p) => {
        try {
          const ms = await milestonesApi.list(p.id);
          const total = ms.length;
          const done = ms.filter((m) => m.status === "APPROVED" || m.status === "COMPLETED").length;
          const isProjectDone = p.status === "COMPLETED" || p.status === "완료";
          const progress = isProjectDone ? 100 : (total === 0 ? 0 : Math.round((done/total)*100));
          return { ...p, milestoneCount: total, milestoneDone: done, progress, milestones: ms };
        } catch {
          const isProjectDone = p.status === "COMPLETED" || p.status === "완료";
          return { ...p, milestoneCount:0, milestoneDone:0, progress: isProjectDone ? 100 : 0, milestones:[] };
        }
      }));
      setItems(enriched);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [role]);

  useEffect(() => { reload(); }, [reload]);

  if (selectedId != null) {
    return (
      <ProjectDetailLive
        projectId={selectedId} role={role}
        projects={items}
        onBack={() => { setSelectedId(null); reload(); }}
        onGoSchedule={onGoSchedule}
        onOpenProjectMeeting={onOpenProjectMeeting}
      />
    );
  }

  const inProgress = items.filter(p => p.status !== "COMPLETED" && p.status !== "완료");
  const completed  = items.filter(p => p.status === "COMPLETED" || p.status === "완료");

  const SectionHeading = ({ title, sub, gradient }) => (
    <div style={{ marginBottom:20 }}>
      <h2 style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.02em", margin:"0 0 4px", fontFamily:F,
        background: gradient,
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
        {title}
      </h2>
      <p style={{ fontSize:13, color:"#64748B", margin:0, fontFamily:F }}>{sub}</p>
    </div>
  );

  return (
    <div>
      {loading && <div style={{ padding:60, textAlign:"center", color:"#94A3B8", fontFamily:F }}>불러오는 중…</div>}
      {!loading && items.length === 0 && (
        <div style={{ padding:60, textAlign:"center", color:"#64748B", fontFamily:F,
          background:"#F8FAFC", borderRadius:16, border:"1px dashed #CBD5E1" }}>
          현재 프로젝트가 없습니다.
        </div>
      )}

      {/* ── 진행 중 섹션 ── */}
      {inProgress.length > 0 && (
        <div style={{ marginBottom:36 }}>
          <SectionHeading
            title="전략 검증 관리 대시보드"
            sub={role==="CLIENT" ? "내가 설계한 전략의 백테스트 진행 상황과 Trust Score 검증을 관리합니다." : "내가 운용 중인 전략의 검증 단계와 리포트를 관리합니다."}
            gradient="linear-gradient(120deg,#2563EB 0%,#1D4ED8 28%,#3B82F6 58%,#6366F1 100%)"
          />
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {inProgress.map((p) => (
              <ProjectSummaryCard key={p.id} project={p} role={role}
                onOpen={() => setSelectedId(p.id)}
                onMessage={() => onOpenProjectMeeting?.(p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── 완료 섹션 ── */}
      {completed.length > 0 && (
        <div>
          <SectionHeading
            title="완료한 프로젝트 대시보드"
            sub={role==="CLIENT" ? "성공적으로 마무리한 프로젝트 내역을 확인하세요. 제출물과 정산 내역이 보관되어 있습니다." : "완료한 프로젝트의 마일스톤 및 정산 내역을 확인할 수 있습니다."}
            gradient="linear-gradient(120deg,#16A34A 0%,#15803D 40%,#22C55E 100%)"
          />
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {completed.map((p) => (
              <ProjectSummaryCard key={p.id} project={p} role={role}
                onOpen={() => setSelectedId(p.id)}
                onMessage={() => onOpenProjectMeeting?.(p.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 목록 카드 ── */
function ProjectSummaryCard({ project, role, onOpen, onMessage }) {
  const isCompleted = project.status === "COMPLETED" || project.status === "완료";
  const isPreContract = project.status === "CLOSED" || project.status === "RECRUITING";
  const color = isCompleted ? "#16A34A" : isPreContract ? "#94A3B8" : project.progress >= 70 ? "#3B82F6" : "#F59E0B";
  // 완료된 프로젝트가 아니면 D-Day 뱃지. 마지막 마일스톤 endDate 우선 (협의된 일정),
  // 없으면 deadline 컬럼 fallback (등록시 입력값, 종종 과거 값이라 후순위).
  const lastMs = Array.isArray(project.milestones) ? project.milestones[project.milestones.length - 1] : null;
  const effectiveDeadline = lastMs?.endDate || project.deadline;
  const dday = !isCompleted ? calcDDay(effectiveDeadline) : null;
  const badgeLabel = isCompleted ? "완료" : isPreContract ? "시작 전" : "진행 중";
  const badgeBg    = isCompleted ? "#F0FDF4" : isPreContract ? "#F1F5F9" : "#EFF6FF";
  const badgeColor = isCompleted ? "#16A34A" : isPreContract ? "#64748B" : "#3B82F6";
  return (
    <div style={{ border: isCompleted ? "1.5px solid #86EFAC" : "1.5px solid #F1F5F9",
      borderRadius:16, padding:"22px 24px",
      background: isCompleted ? "#F0FDF4" : "white",
      boxShadow: isCompleted ? "0 2px 8px rgba(22,163,74,0.10)" : "0 2px 8px rgba(0,0,0,0.05)",
      display:"flex", gap:20, alignItems:"flex-start" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
          <span style={{ padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700,
            background:badgeBg, color:badgeColor, fontFamily:F }}>
            {badgeLabel}
          </span>
          {dday && (
            <span style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:700,
              background:"#F0FFF4", border:"1px solid #BBF7D0", color:"#16A34A", fontFamily:F }}>
              {dday}
            </span>
          )}
          <span style={{ fontSize:17, fontWeight:800, color:"#1E293B", fontFamily:F }}>{project.title}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#374151", fontFamily:F }}>
            마일스톤 {project.milestoneDone} / {project.milestoneCount} 완료
          </span>
          <span style={{ fontSize:18, fontWeight:800, color, fontFamily:F }}>{project.progress}%</span>
        </div>
        <div style={{ width:"100%", height:8, borderRadius:99, background:"#F1F5F9", marginBottom:14, overflow:"hidden" }}>
          <div style={{ width:`${project.progress}%`, height:"100%", borderRadius:99, background:color, transition:"width 0.4s" }} />
        </div>
        {(project.milestones||[]).map((m) => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", marginBottom:6,
            borderRadius:8, background:"#F8FAFC", border:"1px solid #F1F5F9" }}>
            <span style={{ width:22, height:22, borderRadius:"50%", display:"inline-flex", alignItems:"center",
              justifyContent:"center", background:MS_STATUS_COLOR[m.status]||"#CBD5E1", color:"white", fontSize:11, fontWeight:700 }}>
              {m.status==="APPROVED"||m.status==="COMPLETED"?"✓":m.seq}
            </span>
            <span style={{ flex:1, fontSize:13, color:"#1E293B", fontFamily:F, fontWeight:600 }}>{m.title}</span>
            <span style={{ fontSize:11, fontWeight:700, color:MS_STATUS_COLOR[m.status]||"#94A3B8", fontFamily:F }}>
              {MS_STATUS_LABEL[m.status]||m.status}
            </span>
          </div>
        ))}
      </div>
      <div style={{ width:160, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>
        <button onClick={onMessage} style={{ width:"100%", padding:"10px 0", borderRadius:10,
          border:"1px solid #E5E7EB", background:"white", fontSize:13, fontWeight:600,
          color:"#374151", cursor:"pointer", fontFamily:F }}>
          {role==="CLIENT"?"파트너 메시지":"클라이언트 메시지"}
        </button>
        <button onClick={onOpen} style={{ width:"100%", padding:"12px 0", borderRadius:10,
          border:"none", background:PRIMARY_GRAD, fontSize:13, fontWeight:700, color:"white",
          cursor:"pointer", fontFamily:F, boxShadow:"0 3px 10px rgba(99,102,241,0.28)" }}>
          관리 상세 →
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   상세 패널 — 기존 ProjectDetailDash 디자인 복원 + 실 DB
═══════════════════════════════════════════════════════════ */
function ProjectDetailLive({ projectId, role, _projects, onBack, onGoSchedule, onOpenProjectMeeting }) {
  const [data, setData] = useState(null);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [fileTab, setFileTab] = useState("files");
  const [expandedAttachId, setExpandedAttachId] = useState(null);
  const [payOpen, setPayOpen] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(null);
  const [reviseOpen, setReviseOpen] = useState(null);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [escrowDetailIdx, setEscrowDetailIdx] = useState(null);
  const [revisionWithdrawnIds, setRevisionWithdrawnIds] = useState(new Set()); // 철회 후 시스템카드용
  const [contractModalKey, setContractModalKey] = useState(null); // 계약 세부협의 모달

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [d, mods] = await Promise.all([
        dashboardApi.fetch(projectId),
        projectModulesApi.list(projectId).catch(() => []),
      ]);
      setData(d);
      const modMap = {};
      (mods||[]).forEach((m) => {
        const ckey = MODULE_KEY_MAP[m.moduleKey] || m.moduleKey;
        modMap[ckey] = { status: m.status || "미확정", data: m.data || "" };
      });
      CONTRACT_KEYS.forEach((k) => { if (!modMap[k]) modMap[k] = { status: "미확정", data: "" }; });
      setModules(modMap);
    } catch (e) {
      setErr(e?.response?.data?.message || "불러오기에 실패했습니다.");
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const handleApprove = async (m) => {
    if (!window.confirm(`'${m.title}' 마일스톤을 승인할까요? 에스크로가 정산됩니다.`)) return;
    try { await milestonesApi.approve(projectId, m.id); showToast("✓ 승인 완료"); reload(); }
    catch (e) { showToast(e?.response?.data?.message || "승인 실패"); }
  };

  if (loading) return <div style={{ padding:60, textAlign:"center", color:"#94A3B8", fontFamily:F }}>불러오는 중…</div>;
  if (err||!data) return (
    <div style={{ padding:24, fontFamily:F }}>
      <button onClick={onBack} style={backBtnStyle}>← 목록으로</button>
      <div style={{ marginTop:24, color:"#EF4444" }}>{err||"데이터 없음"}</div>
    </div>
  );

  const { project, milestones=[], escrows=[], attachments=[], meeting } = data;
  const files = attachments.filter(a => a.kind==="FILE");
  const links = attachments.filter(a => a.kind==="LINK");
  const totalAmount = milestones.reduce((s,m) => s+(m.amount||0), 0);
  // project.budgetAmount 는 원 단위 (ProjectRegister/AIchatProject 통일).
  const budgetAmountWon = Number(project.budgetAmount || 0);
  // D-Day 우선순위: 마지막 마일스톤 endDate (협의된 진짜 일정) > 프로젝트 deadline 컬럼 (등록시 입력값, 종종 과거)
  const lastMs = milestones[milestones.length - 1];
  const effectiveDeadline = lastMs?.endDate || project.deadline || project.deadlineDate;
  const dday = calcDDay(effectiveDeadline);
  const phases = buildPhases(milestones);
  // 활성 마일스톤: IN_PROGRESS / SUBMITTED / REVISION_REQUESTED 중 가장 빠른 것.
  // 없으면 첫 PENDING (= 진행 시작 안 한 첫 단계). 모두 완료된 경우만 마지막 마일스톤.
  const currentMs = milestones.find(m => m.status==="IN_PROGRESS"||m.status==="SUBMITTED"||m.status==="REVISION_REQUESTED")
    || milestones.find(m => m.status==="PENDING")
    || milestones[milestones.length-1];
  const currentProgress = milestones.length===0 ? 0
    : Math.round((milestones.filter(m=>m.status==="APPROVED"||m.status==="COMPLETED").length/milestones.length)*100);

  return (
    <div style={{ position:"relative", fontFamily:F }}>
      {/* breadcrumb + 제목 헤더 */}
      <div style={{ marginBottom:20 }}>
        {/* 목록으로 돌아가기 + 미팅으로 이동 버튼 (한 줄) */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:12 }}>
          <button onClick={onBack}
            onMouseEnter={e => { e.currentTarget.style.background="#EFF6FF"; e.currentTarget.style.color="#1E40AF"; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#3B82F6"; }}
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px 4px 6px",
              borderRadius:8, border:"1px solid #BFDBFE", background:"transparent",
              color:"#3B82F6", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:F,
              transition:"background 0.12s, color 0.12s" }}>
            <span style={{ fontSize:15, lineHeight:1 }}>‹</span> 목록으로 돌아가기
          </button>
          <button
            onClick={() => onOpenProjectMeeting?.(projectId)}
            onMouseEnter={e => { e.currentTarget.style.background="linear-gradient(135deg,#3b82f6,#2563eb,#4f46e5)"; e.currentTarget.style.boxShadow="0 4px 14px rgba(99,102,241,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.background=PRIMARY_GRAD; e.currentTarget.style.boxShadow="0 3px 10px rgba(99,102,241,0.28)"; }}
            style={{ padding:"10px 18px", borderRadius:10, border:"none", background:PRIMARY_GRAD,
              color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:F,
              boxShadow:"0 3px 10px rgba(99,102,241,0.28)", transition:"background 0.15s,box-shadow 0.15s",
              whiteSpace:"nowrap", flexShrink:0 }}>
            미팅으로 이동하기
          </button>
        </div>
        {/* breadcrumb 줄 + D-Day 뱃지 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:12 }}>
          <div style={{ fontSize:13.5, color:"#94A3B8", fontFamily:F }}>
            <span style={{ cursor:"pointer", color:"#3B82F6" }} onClick={onBack}>Dashboard</span>{" / "}
            <span>Project Progress</span>
          </div>
          {dday && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px",
              borderRadius:99, background:"#F0FFF4", border:"1px solid #BBF7D0" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#22C55E", display:"inline-block" }} />
              <span style={{ fontSize:12.5, fontWeight:700, color:"#16A34A", fontFamily:F }}>
                진행 중 · {dday}
              </span>
            </div>
          )}
        </div>
        {/* 프로젝트 제목 — Header Alpha-Helix 그라데이션 */}
        <h2 style={{ fontSize:23, fontWeight:900, margin:"0 0 6px", fontFamily:F,
          background:"linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          display:"inline-block", letterSpacing:"-0.3px" }}>
          {project.title}
        </h2>
      </div>

      {/* 프로젝트 개요 — full-width (DB desc 마크다운 렌더) */}
      {project.description && (
        <div style={{ border:"1.5px solid #E5E7EB", borderRadius:14, padding:"22px 26px", background:"white", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:4, height:24, borderRadius:3, background:"#3B82F6" }} />
            <span style={{ fontSize:17, fontWeight:800, color:"#1E293B", fontFamily:F }}>프로젝트 개요</span>
          </div>
          {renderProjectOverview(project.description)}
          {Array.isArray(project.tags) && project.tags.length > 0 && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #F1F5F9" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:4, height:18, borderRadius:3, background:"#3B82F6" }} />
                <span style={{ fontSize:15.5, fontWeight:800, color:"#1E293B", fontFamily:F }}>필요 기술 스택</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {project.tags.map((t, i) => (
                  <span key={i} style={{ padding:"6px 12px", borderRadius:99, background:"#EFF6FF",
                    color:"#1D4ED8", fontSize:14, fontWeight:700, fontFamily:F, border:"1px solid #BFDBFE" }}>
                    {String(t).startsWith("#") ? t : `#${t}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:18, alignItems:"flex-start" }}>
        {/* ── 왼쪽 메인: 7가지 세부협의사항만 (PM/에스크로와 같은 시작 Y) ── */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:16 }}>

          {/* 7가지 세부협의사항 탭 (확정된 모듈 데이터를 read-only inline 렌더) */}
          <ContractModulesPanel modules={modules} />

        </div>

        {/* ── 오른쪽 사이드바 ── */}
        <div style={{ width:296, flexShrink:0, display:"flex", flexDirection:"column", gap:16 }}>

          {/* Project Meeting */}
          <div style={{ border:"1.5px solid #F1F5F9", borderRadius:14, padding:"12px 14px", background:"white" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:16, fontWeight:800, color:"#1E293B", fontFamily:F }}>Project Meeting</span>
              {meeting?.frequencyLabel && (
                <span style={{ fontSize:13, color:"#94A3B8", fontFamily:F }}>{meeting.frequencyLabel}</span>
              )}
            </div>
            {meeting?.nextAt ? (
              <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:6, fontSize:14, color:"#374151", fontFamily:F }}>
                  <span style={{ flexShrink:0 }}>📅</span><span>{fmtDateTime(meeting.nextAt)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"flex-start", gap:6, fontSize:14, color:"#374151", fontFamily:F }}>
                  <span style={{ flexShrink:0 }}>📍</span><span>{meeting.locationLabel}</span>
                </div>
                {meeting.agenda && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:6, fontSize:14, color:"#64748B", fontFamily:F, lineHeight:1.4 }}>
                    <span style={{ flexShrink:0 }}>📋</span><span>{meeting.agenda}</span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize:13, color:"#94A3B8", fontFamily:F, margin:"0 0 12px" }}>예정된 미팅이 없습니다.</p>
            )}
            <button onClick={() => onGoSchedule?.()}
              onMouseEnter={e => e.currentTarget.style.background="linear-gradient(135deg,#c7d2fe,#a5b4fc)"}
              onMouseLeave={e => e.currentTarget.style.background="linear-gradient(135deg,#f1f5f9,#e0e7ff)"}
              style={{ width:"100%", padding:"8px 0", borderRadius:7, border:"none",
                background:"linear-gradient(135deg,#f1f5f9,#e0e7ff)", fontSize:15, fontWeight:600,
                color:"#374151", cursor:"pointer", fontFamily:F,
                display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                transition:"background 0.15s" }}>
              스케줄 캘린더 이동
            </button>
          </div>

          {/* 에스크로 현황 */}
          <div style={{ border:"1.5px solid #BFDBFE", borderRadius:14, padding:"12px 14px",
            background:"linear-gradient(160deg,#EFF6FF,#F5F3FF)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
              <span style={{ fontSize:16 }}>🔒</span>
              <h4 style={{ fontSize:15, fontWeight:800, color:"#1E293B", margin:0, fontFamily:F }}>에스크로 현황</h4>
            </div>
            {milestones.map((ms, i) => {
              const esc = escrows.find(e => e.milestoneId===ms.id);
              const eDisplayStatus = escrowDisplayStatus(esc, ms.status);
              const es = ESCROW_STYLES[eDisplayStatus] || ESCROW_STYLES["결제 대기"];
              return (
                <div key={ms.id} onClick={() => setEscrowDetailIdx(i)}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(239,246,255,0.8)"; e.currentTarget.style.borderRadius="8px"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderRadius="0"; }}
                  style={{ cursor:"pointer", padding:"6px 3px", transition:"background 0.15s",
                    borderBottom:i<milestones.length-1?"1px solid #E0EAFF":"none" }}>
                  <div style={{ fontSize:13, color:"#64748B", fontFamily:F, marginBottom:4, lineHeight:1.4 }}>
                    {ms.title}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:es.color, background:es.bg,
                      border:`1px solid ${es.border}`, borderRadius:99, padding:"2px 8px", fontFamily:F }}>
                      {es.icon} {eDisplayStatus}
                    </span>
                    <span style={{ fontSize:14, fontWeight:700, color:"#1E293B", fontFamily:F }}>
                      {krw(esc?.amount||ms.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop:"1px solid #BFDBFE", marginTop:8, paddingTop:6,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#374151", fontFamily:F }}>총 계약금</span>
              <span style={{ fontSize:15, fontWeight:800, color:"#1D4ED8", fontFamily:F }}>
                {krw(totalAmount || budgetAmountWon)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 마일스톤 진행도 + Phase stepper */}
      <div style={{ border:"1.5px solid #E5E7EB", borderRadius:14, padding:"20px 22px", background:"white", marginTop:24 }}>
        {currentMs && (
          <>
        <h3 style={{ fontSize:18, fontWeight:800, color:"#1E293B", margin:"0 0 6px", fontFamily:F }}>
          {currentMs.seq}번째 마일스톤 ✅ {currentMs.title}
        </h3>
        {currentMs.description && (
          <p style={{ fontSize:14.5, color:"#64748B", margin:"0 0 14px", fontFamily:F, lineHeight:1.6 }}>
            {currentMs.description}
          </p>
        )}
          </>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:4, height:22, borderRadius:3, background:"#3B82F6" }} />
            <span style={{ fontSize:16, fontWeight:800, color:"#1E293B", fontFamily:F }}>Progress Status</span>
          </div>
          <span style={{ fontSize:19.5, fontWeight:800, color:"#1E293B", fontFamily:F }}>{currentProgress}%</span>
        </div>
        <div style={{ width:"100%", height:8, borderRadius:99, background:"#F1F5F9", marginBottom:24, overflow:"hidden" }}>
          <div style={{ width:`${currentProgress}%`, height:"100%", borderRadius:99,
        background:"linear-gradient(90deg,#60a5fa,#3b82f6)" }} />
        </div>
        {/* Phase stepper */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", position:"relative" }}>
          <div style={{ position:"absolute", top:17, left:"10%", right:"10%", height:2, background:"#E2E8F0", zIndex:0 }} />
          {phases.map(ph => (
        <div key={ph.num} style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1, position:"relative", zIndex:1 }}>
          <div style={{ width:34, height:34, borderRadius:"50%",
            background: ph.status==="done"?"#3B82F6":ph.status==="active"?"white":"#F1F5F9",
            border: ph.status==="active"?"2.5px solid #3B82F6":ph.status==="done"?"none":"2px solid #E2E8F0",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14.5, fontWeight:700,
            color: ph.status==="done"?"white":ph.status==="active"?"#3B82F6":"#94A3B8",
            boxShadow:(ph.status==="done"||ph.status==="active")?"0 2px 8px rgba(59,130,246,0.18)":"none" }}>
            {ph.num}
          </div>
          <span style={{ fontSize:13.5, fontWeight:ph.status==="active"?700:500,
            color:ph.status==="active"?"#3B82F6":ph.status==="done"?"#374151":"#94A3B8",
            fontFamily:F, marginTop:6, textAlign:"center" }}>{ph.label}</span>
          <span style={{ fontSize:12.5, color:"#94A3B8", fontFamily:F, marginTop:2 }}>{ph.date}</span>
        </div>
          ))}
        </div>
      </div>

      {/* 마일스톤 진행 */}
      <div style={{ border:"1.5px solid #F1F5F9", borderRadius:14, padding:"20px 22px", background:"white", marginTop:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:4, height:22, borderRadius:3, background:"#3B82F6" }} />
            <span style={{ fontSize:19, fontWeight:800, color:"#1E293B", fontFamily:F }}>마일스톤 진행</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {milestones.map((ms) => {
        const esc = escrows.find(e => e.milestoneId===ms.id);
        const eDisplayStatus = escrowDisplayStatus(esc, ms.status);
        const es = ESCROW_STYLES[eDisplayStatus] || ESCROW_STYLES["결제 대기"];
        const msLabel = MS_STATUS_LABEL[ms.status] || ms.status;
        const msColor = MS_STATUS_COLOR[ms.status] || "#94A3B8";
        return (
          <div key={ms.id} style={{
            border:"1.5px solid "+(eDisplayStatus==="정산 완료"?"#BBF7D0":eDisplayStatus==="납품 검수 중"?"#C4B5FD":"#F1F5F9"),
            borderRadius:10, padding:"14px 18px", background:"white" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ padding:"2px 8px", borderRadius:6, fontSize:12.5, fontWeight:700,
            background:eDisplayStatus==="정산 완료"?"#F0FDF4":"#EFF6FF",
            border:"1px solid "+(eDisplayStatus==="정산 완료"?"#BBF7D0":"#BFDBFE"),
            color:eDisplayStatus==="정산 완료"?"#16A34A":"#3B82F6", fontFamily:F }}>
            {eDisplayStatus==="정산 완료"?"완료":"진행 중"}
              </span>
              <span style={{ fontSize:15.5, fontWeight:700, color:"#1E293B", fontFamily:F }}>{ms.title}</span>
            </div>
            <div style={{ fontSize:13.5, color:"#64748B", fontFamily:F, display:"flex", gap:14, flexWrap:"wrap" }}>
              <span>시작일: <strong style={{ color:"#374151" }}>{fmtDate(ms.startDate)}</strong></span>
              <span>마감일: <strong style={{ color:"#374151" }}>{fmtDate(ms.endDate)}</strong></span>
              {ms.submittedAt && <span style={{ color:"#7C3AED" }}>납품: {fmtDate(ms.submittedAt)}</span>}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0, marginLeft:8 }}>
            <span style={{ fontSize:13.5, fontWeight:700, color:msColor, fontFamily:F, minWidth:70, textAlign:"right" }}>
              {/* REVISION_REQUESTED + CLIENT 일 때는 버튼이 상태레이블을 대체하므로 텍스트 숨김 */}
              {!(role==="CLIENT" && ms.status==="REVISION_REQUESTED") && msLabel}
            </span>
            {/* 역할별 액션 버튼 */}
            {role==="CLIENT" && ms.status==="SUBMITTED" && (
              <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setReviseOpen(ms)} style={{ padding:"6px 12px", borderRadius:8,
              border:"1px solid #FECACA", background:"white", color:"#DC2626",
              fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:F }}>수정 요청</button>
            <button onClick={() => handleApprove(ms)} style={{ padding:"6px 12px", borderRadius:8,
              border:"none", background:PRIMARY_GRAD, color:"white",
              fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:F }}>승인</button>
              </div>
            )}
            {role==="CLIENT" && ms.status==="REVISION_REQUESTED" && (
              <button
            onClick={async () => {
              try {
                await milestonesApi.cancelRevision?.(projectId, ms.id);
                setRevisionWithdrawnIds(prev => new Set([...prev, ms.id]));
                showToast("✅ 수정 요청이 철회되었습니다."); reload();
              } catch { showToast("수정 철회에 실패했습니다."); }
            }}
            style={{ padding:"6px 14px", borderRadius:8, border:"none",
              background:"#FEF3C7", color:"#92400E", fontWeight:700, fontSize:12,
              cursor:"pointer", fontFamily:F }}>
            수정 철회
              </button>
            )}
            {role==="CLIENT" && (!esc || esc?.status==="PENDING") && ms.status!=="SUBMITTED" && ms.status!=="APPROVED" && ms.status!=="COMPLETED" && (
              <button onClick={() => setPayOpen(esc
                ? { ...esc, projectId }
                : { projectId, milestoneId: ms.id, amount: ms.amount, status: "PENDING" })}
            onMouseEnter={e => { e.currentTarget.style.background="linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%)"; e.currentTarget.style.boxShadow="0 4px 12px rgba(134,239,172,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)"; e.currentTarget.style.boxShadow="0 1px 4px rgba(187,247,208,0.4)"; }}
            style={{ padding:"6px 16px", borderRadius:8, border:"none",
              background:"linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)",
              color:"#166534", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:F,
              boxShadow:"0 1px 4px rgba(187,247,208,0.4)", transition:"all 0.18s" }}>결제하기</button>
            )}
            {role==="PARTNER" && (ms.status==="IN_PROGRESS"||ms.status==="REVISION_REQUESTED") && (
              <button onClick={() => setSubmitOpen(ms)} style={{ padding:"6px 14px", borderRadius:8,
            border:"none", background:PRIMARY_GRAD, color:"white",
            fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:F }}>
            {ms.status==="REVISION_REQUESTED"?"재제출":"제출하기"}
              </button>
            )}
            {(ms.status==="APPROVED"||ms.status==="COMPLETED") && (
              <span style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #BBF7D0",
            background:"white", color:"#15803D", fontWeight:600, fontSize:12, fontFamily:F }}>
            ✅ 완료
              </span>
            )}
          </div>
            </div>
            {/* 완료 기준 */}
            {ms.completionCriteria && (
          <div style={{ marginBottom:10, padding:10, borderRadius:8, background:"#FFFBEB", border:"1px solid #FDE68A" }}>
            <div style={{ fontSize:12.5, fontWeight:800, color:"#92400E", marginBottom:3 }}>완료 기준</div>
            <div style={{ fontSize:13.5, color:"#713F12", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{ms.completionCriteria}</div>
          </div>
            )}
            {/* 제출 메모 */}
            {ms.submittedAt && ms.submissionNote && (
          <div style={{ marginBottom:8, padding:10, borderRadius:8, background:"#F0F9FF", border:"1px solid #BFDBFE" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#1E40AF", marginBottom:3 }}>
              📤 제출 ({fmtDate(ms.submittedAt)})
            </div>
            <div style={{ fontSize:12, color:"#1E293B", lineHeight:1.6 }}>{ms.submissionNote}</div>
            {ms.submissionFileUrl && (
              <a href={ms.submissionFileUrl} target="_blank" rel="noreferrer"
            style={{ display:"inline-block", marginTop:5, fontSize:12, color:"#2563EB",
              fontWeight:600, textDecoration:"underline" }}>📎 제출 파일 열기</a>
            )}
          </div>
            )}
            {/* 수정 요청 사유 */}
            {ms.revisionReason && (
          <div style={{ marginBottom:8, padding:10, borderRadius:8, background:"#FEF2F2", border:"1px solid #FECACA" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#991B1B", marginBottom:3 }}>⚠️ 수정 요청 사유</div>
            <div style={{ fontSize:12, color:"#7F1D1D", lineHeight:1.6 }}>{ms.revisionReason}</div>
          </div>
            )}
            {/* 수정 철회 시스템 카드 (철회 직후 로컴 상태) */}
            {revisionWithdrawnIds.has(ms.id) && (
          <div style={{ marginBottom:8, padding:10, borderRadius:8, background:"#F0FDF4", border:"1px solid #86EFAC" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#15803D", marginBottom:3 }}>✅ 수정 철회됨</div>
            <div style={{ fontSize:12, color:"#166534", lineHeight:1.6 }}>수정 요청이 철회되었습니다. 파트너에게 수정 철회가 안내됩니다.</div>
          </div>
            )}
            {/* 에스크로 상태 바 */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"8px 12px", borderRadius:8, background:es.bg, border:"1px solid "+es.border }}>
          <span style={{ fontSize:13.5, fontWeight:700, color:es.color, fontFamily:F,
            display:"flex", alignItems:"center", gap:5 }}>
            {es.icon} {eDisplayStatus}
            <span style={{ fontWeight:500, color:"#64748B", marginLeft:6, fontSize:12.5 }}>
              {krw(esc?.amount||ms.amount)}원
            </span>
          </span>
          {eDisplayStatus==="결제 대기" && (
            <span style={{ fontSize:12.5, color:"#94A3B8", fontFamily:F }}>🕐 클라이언트 결제 대기 중...</span>
          )}
          {eDisplayStatus==="에스크로 보관 중" && (
            <span style={{ fontSize:12.5, fontWeight:600, color:"#1D4ED8", fontFamily:F }}>🔒 에스크로 확인됨 — 납품 후 정산</span>
          )}
          {eDisplayStatus==="납품 검수 중" && (
            <span style={{ fontSize:12.5, fontWeight:600, color:"#5B21B6", fontFamily:F }}>🔍 납품 제출 완료 — 검수 중...</span>
          )}
          {eDisplayStatus==="정산 완료" && (
            <span style={{ fontSize:12.5, fontWeight:700, color:"#15803D", fontFamily:F }}>
              ✅ {krw(esc?.amount||ms.amount)}원 정산 완료
            </span>
          )}
            </div>
          </div>
        );
          })}
        </div>
      </div>

      {/* Files / Links */}
      <div style={{ border:"1.5px solid #F1F5F9", borderRadius:14, padding:"20px 22px", background:"white", marginTop:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", gap:0 }}>
        {[["files","Files"],["links","External Links"]].map(([key,label]) => (
          <button key={key} onClick={() => setFileTab(key)}
            style={{ padding:"4px 16px 10px", border:"none", background:"none",
          fontSize:15.5, fontWeight:600, cursor:"pointer", fontFamily:F,
          color:fileTab===key?"#3B82F6":"#94A3B8",
          borderBottom:fileTab===key?"2.5px solid #3B82F6":"2.5px solid transparent" }}>
            {label}
          </button>
        ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => setAddFileOpen(true)}
          style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #BFDBFE",
            background:"#EFF6FF", color:"#1E40AF", fontSize:12.5, fontWeight:700,
            cursor:"pointer", fontFamily:F }}>+ 파일 업로드</button>
        <button onClick={() => setAddLinkOpen(true)}
          style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #DDD6FE",
            background:"#F5F3FF", color:"#5B21B6", fontSize:12.5, fontWeight:700,
            cursor:"pointer", fontFamily:F }}>+ 링크 추가</button>
          </div>
        </div>
        {fileTab==="files" ? (
          <div>
        <div style={{ display:"grid", gridTemplateColumns:"1.8fr 1.2fr 0.7fr 0.6fr 52px",
          padding:"8px 12px", borderBottom:"1px solid #F1F5F9" }}>
          {["파일명","설명","날짜","크기","다운로드"].map(h => (
            <span key={h} style={{ fontSize:12.5, fontWeight:700, color:"#94A3B8",
          fontFamily:F, letterSpacing:"0.05em" }}>{h}</span>
          ))}
        </div>
        {files.length===0 && <div style={{ padding:"16px 12px", color:"#94A3B8", fontSize:13, fontFamily:F }}>첨부 파일이 없습니다.</div>}
        {files.map((f,i) => {
          const isExp = expandedAttachId === f.id;
          const fmtSize = f.sizeBytes
            ? f.sizeBytes >= 1024*1024
          ? (f.sizeBytes/1024/1024).toFixed(1)+" MB"
          : (f.sizeBytes/1024).toFixed(0)+" KB"
            : "-";
          const preview = f.notes ? (f.notes.length > 20 ? f.notes.slice(0,20)+"…" : f.notes) : "-";
          return (
            <div key={f.id} style={{ borderBottom:i<files.length-1?"1px solid #F8FAFC":"none" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.8fr 1.2fr 0.7fr 0.6fr 52px",
            padding:"13px 12px", alignItems:"center" }}>
            <button onClick={() => setExpandedAttachId(isExp ? null : f.id)}
              style={{ display:"flex", alignItems:"center", gap:8, fontSize:14.5,
            color:"#1E293B", fontFamily:F, background:"none", border:"none",
            cursor:"pointer", padding:0, textAlign:"left" }}>
              <span style={{ fontSize:17 }}>📄</span>
              <span>{f.name}</span>
            </button>
            <span
              title={f.notes || ""}
              style={{ fontSize:13, color: f.notes ? "#475569" : "#CBD5E1",
            fontFamily:F, cursor: f.notes ? "help" : "default",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {preview}
            </span>
            <span style={{ fontSize:13, color:"#475569", fontFamily:F }}>{fmtDate(f.createdAt)}</span>
            <span style={{ fontSize:13, color:"#475569", fontFamily:F }}>{fmtSize}</span>
            <button
              title="다운로드"
              onClick={() => {
            const token = localStorage.getItem("accessToken");
            fetch(`/api/projects/${f.projectId}/attachments/${f.id}/download`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
              .then(async res => {
                if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              showToast(err.message || "다운로드에 실패했습니다.");
              return;
                }
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = blobUrl;
                anchor.download = f.name;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(blobUrl);
              })
              .catch(() => showToast("다운로드에 실패했습니다."));
              }}
              style={{ display:"flex", alignItems:"center",
            justifyContent:"center", width:48, height:40, borderRadius:8,
            background:"#F1F5F9", color:"#475569", border:"none", cursor:"pointer",
            fontSize:16, transition:"background 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background="#DBEAFE"; e.currentTarget.style.color="#1D4ED8"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#F1F5F9"; e.currentTarget.style.color="#475569"; }}>
              ⬇
            </button>
          </div>
            </div>
          );
        })}
          </div>
        ) : (
          <div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 0.8fr 0.8fr 40px",
          padding:"8px 12px", borderBottom:"1px solid #F1F5F9" }}>
          {["링크 이름","날짜","열기",""].map(h => (
            <span key={h} style={{ fontSize:12.5, fontWeight:700, color:"#94A3B8",
          fontFamily:F, letterSpacing:"0.05em" }}>{h}</span>
          ))}
        </div>
        {links.length===0 && <div style={{ padding:"16px 12px", color:"#94A3B8", fontSize:13, fontFamily:F }}>등록된 링크가 없습니다.</div>}
        {links.map((lk,i) => {
          const isExp = expandedAttachId === lk.id;
          return (
            <div key={lk.id} style={{ borderBottom:i<links.length-1?"1px solid #F8FAFC":"none" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 0.8fr 0.8fr 40px",
            padding:"13px 12px", alignItems:"center" }}>
            <button onClick={() => setExpandedAttachId(isExp ? null : lk.id)}
              style={{ display:"flex", alignItems:"center", gap:8, fontSize:14.5,
            color:"#3B82F6", fontFamily:F, fontWeight:600, background:"none",
            border:"none", cursor:"pointer", padding:0, textAlign:"left" }}>
              <span style={{ fontSize:16 }}>🔗</span>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            textDecoration:lk.notes?"underline dotted":"none", textUnderlineOffset:3 }}>
            {lk.name}
              </span>
            </button>
            <span style={{ fontSize:14, color:"#475569", fontFamily:F }}>{fmtDate(lk.createdAt)}</span>
            <a href={lk.url} target="_blank" rel="noreferrer"
              style={{ fontSize:13, color:"#3B82F6", fontFamily:F, fontWeight:600, textDecoration:"none" }}>
              열기 ↗
            </a>
            <button onClick={() => { navigator.clipboard.writeText(lk.url); showToast("✓ 링크가 복사되었습니다."); }}
              title="링크 복사"
              style={{ display:"flex", alignItems:"center", justifyContent:"center",
            width:32, height:32, borderRadius:8, background:"#F1F5F9",
            color:"#475569", border:"none", cursor:"pointer", fontSize:15,
            transition:"background 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background="#DDD6FE"; e.currentTarget.style.color="#5B21B6"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#F1F5F9"; e.currentTarget.style.color="#475569"; }}>
              📋
            </button>
          </div>
          {isExp && lk.notes && (
            <div style={{ margin:"0 12px 10px", padding:"10px 14px", borderRadius:8,
              background:"#F8FAFC", border:"1px solid #E2E8F0", fontSize:13,
              color:"#475569", fontFamily:F, lineHeight:1.6 }}>
              {lk.notes}
            </div>
          )}
            </div>
          );
        })}
          </div>
        )}
      </div>

      {/* 에스크로 상세 팝업 */}
      {escrowDetailIdx !== null && (() => {
        const ms = milestones[escrowDetailIdx];
        if (!ms) return null;
        const esc = escrows.find(e => e.milestoneId===ms.id);
        const eDisplayStatus = escrowDisplayStatus(esc, ms.status);
        const es = ESCROW_STYLES[eDisplayStatus]||ESCROW_STYLES["결제 대기"];
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1100,
            display:"flex", alignItems:"center", justifyContent:"center" }}
            onClick={() => setEscrowDetailIdx(null)}>
            <div style={{ background:"white", borderRadius:20, padding:"28px 32px", width:400,
              maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ fontSize:18, fontWeight:800, color:"#1E293B", margin:0, fontFamily:F }}>에스크로 상세</h3>
                <button onClick={() => setEscrowDetailIdx(null)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#94A3B8" }}>×</button>
              </div>
              <div style={{ padding:"14px 16px", borderRadius:12, background:es.bg,
                border:"1px solid "+es.border, marginBottom:16 }}>
                <div style={{ fontSize:15, fontWeight:700, color:es.color, fontFamily:F, marginBottom:4 }}>
                  {es.icon} {eDisplayStatus}
                </div>
                <div style={{ fontSize:22, fontWeight:900, color:"#1E293B", fontFamily:F }}>
                  {krw(esc?.amount||ms.amount)}
                </div>
              </div>
              <div style={{ fontSize:14, color:"#475569", fontFamily:F, lineHeight:1.8 }}>
                <div><strong>마일스톤:</strong> {ms.title}</div>
                {esc?.paymentTxId && <div><strong>거래 ID:</strong> {esc.paymentTxId}</div>}
              </div>
              {role==="CLIENT" && (!esc || esc?.status==="PENDING") && (
                <button onClick={() => { setEscrowDetailIdx(null); setPayOpen(esc
                  ? { ...esc, projectId }
                  : { projectId, milestoneId: ms.id, amount: ms.amount, status: "PENDING" }); }}
                  onMouseEnter={e => { e.currentTarget.style.background="linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%)"; e.currentTarget.style.boxShadow="0 6px 18px rgba(134,239,172,0.55)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(187,247,208,0.5)"; }}
                  style={{ width:"100%", marginTop:16, padding:"12px 0", borderRadius:10, border:"none",
                    background:"linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)",
                    color:"#166534", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:F,
                    boxShadow:"0 2px 8px rgba(187,247,208,0.5)", transition:"all 0.18s" }}>결제하기</button>
              )}
            </div>
          </div>
        );
      })()}

      {addFileOpen && (
        <AddFileModal projectId={projectId}
          onClose={() => setAddFileOpen(false)}
          onSuccess={() => { setAddFileOpen(false); reload(); showToast("✓ 파일이 추가되었습니다."); }}
          onToast={showToast} />
      )}
      {addLinkOpen && (
        <AddLinkModal projectId={projectId}
          onClose={() => setAddLinkOpen(false)}
          onSuccess={() => { setAddLinkOpen(false); reload(); showToast("✓ 링크가 추가되었습니다."); }}
          onToast={showToast} />
      )}
      {payOpen && (
        <EscrowPayModal escrow={payOpen} onClose={() => setPayOpen(null)}
          onSuccess={() => { setPayOpen(null); reload(); showToast("✓ 결제가 완료되었습니다."); }}
          onToast={showToast} />
      )}
      {submitOpen && (
        <MilestoneSubmitModal milestone={submitOpen} projectId={projectId}
          onClose={() => setSubmitOpen(null)}
          onSuccess={() => { setSubmitOpen(null); reload(); showToast("✓ 제출되었습니다."); }}
          onToast={showToast} />
      )}
      {reviseOpen && (
        <RevisionModal milestone={reviseOpen} projectId={projectId}
          onClose={() => setReviseOpen(null)}
          onSuccess={() => { setReviseOpen(null); reload(); showToast("수정 요청을 전달했습니다."); }}
          onToast={showToast} />
      )}
      {contractModalKey && (
        <ContractItemModal
          contractKey={contractModalKey}
          label={CONTRACT_LABELS[contractModalKey]}
          currentStatus={modules[contractModalKey]?.status || "미확정"}
          currentData={modules[contractModalKey]?.data || ""}
          projectId={projectId}
          onClose={() => setContractModalKey(null)}
          onSuccess={(key, status, data) => {
            setModules(prev => ({ ...prev, [key]: { status, data } }));
            setContractModalKey(null);
            showToast("✓ 협의 상태가 업데이트되었습니다.");
          }}
          onToast={showToast} />
      )}
      {toast && <Toast message={toast} />}
    </div>
  );
}

/* ── 7가지 세부협의사항 탭 패널 ──────────────────────────
   확정된 7개 모듈 데이터(read-only)를 탭 인터페이스로 보여줌.
   modules: { scope, deliverable, schedule, payment, revision, completion, terms } - 각각 { status, data: JSON 문자열 }
*/
const CONTRACT_TABS = [
  { key: "scope",       label: "1. 작업 범위",       Component: ScopeModal,         valueKey: "scope" },
  { key: "deliverable", label: "2. 전달 결과물",     Component: DeliverablesModal,  valueKey: "deliverable" },
  { key: "schedule",    label: "3. 일정",            Component: ScheduleModal,      valueKey: "schedule" },
  { key: "payment",     label: "4. 결제",            Component: PaymentModal,       valueKey: "payment" },
  { key: "revision",    label: "5. 수정",            Component: RevisionModuleModal, valueKey: "revision" },
  { key: "completion",  label: "6. 완료",            Component: CompletionModal,    valueKey: "completion" },
  { key: "terms",       label: "7. 특약",            Component: SpecialTermsModal,  valueKey: "terms" },
];

function ContractModulesPanel({ modules }) {
  const [activeKey, setActiveKey] = useState("scope");
  const parsed = useMemo(() => {
    const out = {};
    CONTRACT_TABS.forEach(({ key }) => {
      const raw = modules?.[key]?.data;
      if (!raw) { out[key] = null; return; }
      if (typeof raw === "object") { out[key] = raw; return; }
      try { out[key] = JSON.parse(raw); }
      catch { out[key] = null; }
    });
    return out;
  }, [modules]);

  const ActiveTab = CONTRACT_TABS.find(t => t.key === activeKey) || CONTRACT_TABS[0];
  const Component = ActiveTab.Component;
  const value = parsed[ActiveTab.key];

  return (
    <div style={{ border:"1.5px solid #E5E7EB", borderRadius:14, padding:"20px 22px", background:"white" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{ width:4, height:22, borderRadius:3, background:"#3B82F6" }} />
        <span style={{ fontSize:16, fontWeight:800, color:"#1E293B", fontFamily:F }}>7가지 세부 협의사항</span>
      </div>
      {/* 탭 바 — 7개 탭이 항상 한줄에 들어가도록 균등분배 (스크롤 X) */}
      <div style={{ display:"flex", gap:0, borderBottom:"1.5px solid #E5E7EB", marginBottom:18 }}>
        {CONTRACT_TABS.map(t => {
          const active = t.key === activeKey;
          return (
            <button key={t.key} onClick={() => setActiveKey(t.key)}
              style={{ flex:1, padding:"11px 8px", border:"none", background:"transparent",
                fontSize:15, fontWeight:active?800:600, fontFamily:F,
                color:active?"#1D4ED8":"#64748B", cursor:"pointer",
                borderBottom:active?"2.5px solid #3B82F6":"2.5px solid transparent",
                marginBottom:-1.5, whiteSpace:"nowrap", transition:"color 0.12s",
                textAlign:"center" }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {/* 활성 탭 콘텐츠 (read-only inline) */}
      <div style={{ background:"#FAFBFC", border:"1px solid #F1F5F9", borderRadius:12, padding:"18px 20px" }}>
        <Component
          inline
          readOnly
          showHeaderStatusBadge={false}
          onClose={() => {}}
          value={value ?? null}
          onChange={() => {}}
        />
      </div>
    </div>
  );
}

/* ── Phase stepper 계산 ── */
function buildPhases(milestones) {
  if (!milestones.length) {
    return [
      { num:1, label:"Planning",    date:"", status:"active" },
      { num:2, label:"Development", date:"", status:"idle" },
      { num:3, label:"Review",      date:"", status:"idle" },
      { num:4, label:"Complete",    date:"", status:"idle" },
    ];
  }
  const total = milestones.length;
  const done = milestones.filter(m => m.status==="APPROVED"||m.status==="COMPLETED").length;
  const pct = done / total;
  const phaseDates = [
    fmtDate(milestones[0]?.startDate),
    fmtDate(milestones[Math.max(0,Math.floor(total*0.25))]?.startDate),
    fmtDate(milestones[Math.max(0,Math.floor(total*0.75))]?.endDate),
    fmtDate(milestones[total-1]?.endDate),
  ];
  const activeIdx = pct===0?0:pct<0.5?1:pct<1?2:3;
  return ["Planning","Development","Review","Complete"].map((label, i) => ({
    num:i+1, label, date:phaseDates[i],
    status: i < activeIdx ? "done" : i===activeIdx ? "active" : "idle",
  }));
}

/* ════════════════════════════════════════════════════════
   모달들
═══════════════════════════════════════════════════════════ */
function EscrowPayModal({ escrow, onClose, onSuccess, onToast }) {
  // 결제 모드: real(토스페이먼츠 v2 위젯) | mock(개발용 즉시 보관)
  const [payMode, setPayMode] = useState("real");
  const [methods, setMethods] = useState([]);
  const [pmId, setPmId] = useState(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState(null);

  const widgetsRef = useRef(null);    // TossPayments widgets 인스턴스
  const escrowIdRef = useRef(escrow?.id || null);
  const dbId = useStore(s => s.dbId);
  const username = useStore(s => s.username);
  const loginUser = useStore(s => s.loginUser); // 이메일

  // mock 모드용 결제수단 목록 로드
  useEffect(() => {
    paymentMethodsApi.list()
      .then((list) => {
        setMethods(list);
        const def = list.find(m => m.isDefault) || list[0];
        if (def) setPmId(def.id);
      })
      .catch(() => setMethods([]))
      .finally(() => setLoadingMethods(false));
  }, []);

  // 에스크로 row 가 아직 없으면 먼저 생성 후 id 반환. (멱등 — 캐시)
  const ensureEscrowId = useCallback(async () => {
    if (escrowIdRef.current) return escrowIdRef.current;
    if (escrow?.id) { escrowIdRef.current = escrow.id; return escrow.id; }
    if (!escrow?.milestoneId) throw new Error("milestoneId 누락");
    const created = await escrowsApi.create(escrow.projectId, {
      milestoneId: escrow.milestoneId,
      amount: escrow.amount,
    });
    if (!created?.id) throw new Error("에스크로 생성 실패");
    escrowIdRef.current = created.id;
    return created.id;
  }, [escrow]);

  // 실결제 모드 진입 시 v2 위젯 마운트:
  //  1) SDK 로드
  //  2) widgets({ customerKey }) 인스턴스 생성
  //  3) setAmount({ currency:"KRW", value })
  //  4) renderPaymentMethods({ selector:"#toss-payment-method", variantKey:"DEFAULT" })
  //  5) renderAgreement({ selector:"#toss-agreement", variantKey:"AGREEMENT" })
  // 위젯이 활성화된 모든 결제수단(카드/토스페이/삼성페이/계좌이체/PayPal/가상계좌 등)을 자동 표시.
  useEffect(() => {
    if (payMode !== "real") return;
    let cancelled = false;
    setWidgetReady(false);
    setWidgetError(null);

    (async () => {
      try {
        const tp = await loadTossPayments();
        if (cancelled) return;
        // customerKey: 비회원이면 ANONYMOUS, 회원이면 USER-{id}
        const customerKey = dbId
          ? makeCustomerKey(dbId)
          : (window.TossPayments?.ANONYMOUS ?? "ANONYMOUS");
        const widgets = tp.widgets({ customerKey });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: "KRW", value: escrow.amount });
        await widgets.renderPaymentMethods({
          selector: "#toss-payment-method",
          variantKey: "DEFAULT",
        });
        await widgets.renderAgreement({
          selector: "#toss-agreement",
          variantKey: "AGREEMENT",
        });
        if (!cancelled) setWidgetReady(true);
      } catch (e) {
        if (!cancelled) setWidgetError(e?.message || "결제 위젯 로드 실패");
      }
    })();

    return () => {
      cancelled = true;
      // 위젯 정리: 마운트된 div 비우기
      const pm = document.getElementById("toss-payment-method");
      const ag = document.getElementById("toss-agreement");
      if (pm) pm.innerHTML = "";
      if (ag) ag.innerHTML = "";
      widgetsRef.current = null;
    };
    // 금액/모드 바뀌면 재생성. dbId 는 한 번 로드 후 안바뀌므로 deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMode, escrow?.amount]);

  // v2 위젯 결제 요청 — 위젯이 자동으로 사용자가 선택한 수단(카드/PayPal/...)으로 결제창 띄움.
  const handleTossPay = async () => {
    if (!widgetsRef.current) return onToast?.("결제 위젯이 준비되지 않았어요.");
    if (!escrow?.projectId) return onToast?.("프로젝트 정보가 없습니다.");
    setSubmitting(true);
    try {
      const escrowId = await ensureEscrowId();
      const orderId = makeOrderId(escrowId);
      sessionStorage.setItem("toss_pending_escrow", JSON.stringify({
        projectId: escrow.projectId,
        escrowId,
        amount: escrow.amount,
        orderId,
        returnTo: window.location.pathname + window.location.search,
      }));
      const origin = window.location.origin;
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: `에스크로 #${escrowId}`,
        successUrl: `${origin}/payments/toss/success`,
        failUrl:    `${origin}/payments/toss/fail`,
        customerEmail: loginUser || undefined,
        customerName:  username  || undefined,
      });
      // 정상 흐름: 위젯이 결제창으로 리다이렉트 → 아래 라인 도달 안 함
    } catch (e) {
      onToast?.(e?.message || "결제 요청에 실패했습니다.");
      setSubmitting(false);
    }
  };

  const handleMockPay = async () => {
    if (!pmId) return onToast?.("결제 수단을 선택해 주세요.");
    if (!escrow?.projectId) return onToast?.("프로젝트 정보가 없습니다.");
    setSubmitting(true);
    try {
      const escrowId = await ensureEscrowId();
      await escrowsApi.payMock(escrow.projectId, escrowId, { paymentMethodId: pmId });
      onSuccess?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || e?.message || "결제에 실패했습니다.");
    } finally { setSubmitting(false); }
  };

  const handlePay = () => (payMode === "real" ? handleTossPay() : handleMockPay());
  const payDisabled = submitting
    || (payMode === "real" && (!widgetReady || !!widgetError))
    || (payMode === "mock" && !pmId);

  return (
    <ModalShell onClose={onClose} title="에스크로 결제">
      <div style={{ padding:16, borderRadius:12, background:"#F0F9FF", border:"1px solid #BFDBFE", marginBottom:16 }}>
        <div style={{ fontSize:12, color:"#475569", marginBottom:4 }}>결제 금액</div>
        <div style={{ fontSize:28, fontWeight:900, color:"#1E40AF" }}>{krw(escrow.amount)}</div>
        <div style={{ fontSize:11, color:"#64748B", marginTop:6 }}>
          ✓ 에스크로 보관 후 마일스톤 승인 시 파트너에게 정산됩니다.
        </div>
      </div>

      {/* 결제 모드 토글 */}
      <label style={modalLabel}>결제 방식</label>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[
          { key:"real", label:"실결제 (토스 v2 위젯)" },
          { key:"mock", label:"개발용 즉시 보관" },
        ].map(opt => (
          <button key={opt.key} type="button" onClick={() => setPayMode(opt.key)}
            style={{ flex:1, padding:"10px 0", borderRadius:10, fontSize:13, fontWeight:700,
              border: payMode===opt.key ? "2px solid #3B82F6" : "1px solid #E5E7EB",
              background: payMode===opt.key ? "#EFF6FF" : "white",
              color: payMode===opt.key ? "#1E40AF" : "#475569",
              cursor:"pointer", fontFamily:F }}>
            {opt.label}
          </button>
        ))}
      </div>

      {payMode === "real" && (
        <>
          {/* 토스 v2 위젯이 결제수단 UI(카드/토스페이/삼성페이/계좌이체/PayPal/가상계좌 등) 를 자동 렌더링 */}
          <div id="toss-payment-method" style={{ marginBottom:8, minHeight:120 }} />
          <div id="toss-agreement" style={{ marginBottom:12 }} />
          {!widgetReady && !widgetError && (
            <div style={{ padding:16, textAlign:"center", color:"#94A3B8", fontSize:13 }}>
              결제 위젯 불러오는 중…
            </div>
          )}
          {widgetError && (
            <div style={{ padding:14, borderRadius:10, background:"#FEF2F2", border:"1px solid #FECACA",
              color:"#991B1B", fontSize:13, marginBottom:12 }}>
              {widgetError}
            </div>
          )}
          <div style={{ padding:10, borderRadius:8, background:"#F8FAFC", border:"1px solid #E2E8F0",
            fontSize:11, color:"#64748B", marginBottom:16, lineHeight:1.5 }}>
            토스가 활성화된 결제수단을 자동으로 보여줍니다. PayPal 은 docs 테스트 키로 즉시 사용 가능합니다.
            테스트 키 환경에서는 실제 청구가 발생하지 않습니다.
          </div>
        </>
      )}

      {payMode === "mock" && (
        <>
          <label style={modalLabel}>결제 수단</label>
          {loadingMethods && <div style={{ padding:20, textAlign:"center", color:"#94A3B8" }}>불러오는 중…</div>}
          {!loadingMethods && methods.length===0 && (
            <div style={{ padding:16, borderRadius:10, background:"#FEF3C7", border:"1px solid #FDE68A",
              color:"#92400E", fontSize:13, marginBottom:12 }}>
              등록된 카드가 없습니다. 마이페이지에서 카드를 먼저 등록해 주세요.
            </div>
          )}
          {!loadingMethods && methods.length>0 && (
            <select value={pmId||""} onChange={e => setPmId(Number(e.target.value))}
              style={{ width:"100%", padding:"12px 14px", marginBottom:20, borderRadius:10,
                border:"1px solid #E5E7EB", fontSize:14, fontFamily:F }}>
              {methods.map(m => (
                <option key={m.id} value={m.id}>
                  {m.brand} •••• {m.last4} ({m.holderName}){m.isDefault?" · 기본":""}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handlePay} disabled={payDisabled}
          style={{ ...primaryBtnStyle, flex:1.4, padding:"14px 0", fontSize:14,
            opacity:payDisabled?0.6:1, cursor:payDisabled?"not-allowed":"pointer" }}>
          {submitting?"결제 중…":`${krw(escrow.amount)} 결제`}
        </button>
      </div>
    </ModalShell>
  );
}

function MilestoneSubmitModal({ milestone, projectId, onClose, onSuccess, onToast }) {
  const [note, setNote] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragHover, setDragHover] = useState(false);
  const [boxHover, setBoxHover] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const pickFiles = (fl) => {
    if (!fl || fl.length === 0) return;
    setFile(fl[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragHover(false);
    pickFiles(e.dataTransfer?.files);
  };

  const handleSubmit = async () => {
    if (!file) return onToast?.("필수 파일을 첨부해 주세요.");
    if (!note.trim()) return onToast?.("제출 메모를 입력해 주세요.");
    setSubmitting(true);
    try {
      // 1) 파일 업로드 → 첨부 ID/URL 확보
      let uploadedUrl = fileUrl.trim() || null;
      try {
        setUploading(true);
        const att = await projectAttachmentsApi.upload(projectId, file, { name: file.name });
        if (att?.url) uploadedUrl = att.url;
        else if (att?.id) uploadedUrl = `/api/projects/${projectId}/attachments/${att.id}/download`;
      } finally { setUploading(false); }
      // 2) 마일스톤 제출
      await milestonesApi.submit(projectId, milestone.id, { note: note.trim(), fileUrl: uploadedUrl });
      onSuccess?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || "제출에 실패했습니다.");
    } finally { setSubmitting(false); }
  };

  const dropActive = dragHover || boxHover;

  return (
    <ModalShell onClose={onClose} title={`마일스톤 제출 — ${milestone.title}`}>
      {milestone.completionCriteria && (
        <div style={{ padding:12, borderRadius:10, marginBottom:14, background:"#FFFBEB", border:"1px solid #FDE68A" }}>
          <div style={{ fontSize:12.5, fontWeight:800, color:"#92400E", marginBottom:4 }}>완료 기준</div>
          <div style={{ fontSize:13.5, color:"#713F12", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{milestone.completionCriteria}</div>
        </div>
      )}

      {/* 파일 첨부 (필수) — 연하늘-파스텔 그라데이션 + hover */}
      <label style={modalLabel}>파일 첨부 <span style={{ color:"#EF4444" }}>*</span></label>
      <input ref={inputRef} type="file" style={{ display:"none" }}
        onChange={e => pickFiles(e.target.files)} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragHover(true); }}
        onDragLeave={() => setDragHover(false)}
        onDrop={onDrop}
        onMouseEnter={() => setBoxHover(true)}
        onMouseLeave={() => setBoxHover(false)}
        style={{
          padding: "26px 16px", borderRadius: 14, marginBottom: 14, cursor: "pointer",
          border: `2px dashed ${dropActive ? "#7DD3FC" : "#BAE6FD"}`,
          background: dropActive
            ? "linear-gradient(135deg, #DBEAFE 0%, #E0F2FE 50%, #EDE9FE 100%)"
            : "linear-gradient(135deg, #F0F9FF 0%, #F0F4FF 100%)",
          textAlign: "center", fontFamily: F, transition: "all 0.18s",
          boxShadow: dropActive ? "0 6px 16px rgba(125,211,252,0.30)" : "none",
        }}>
        {file ? (
          <>
            <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF", marginBottom: 2 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {file.size >= 1024 * 1024
                ? (file.size / 1024 / 1024).toFixed(1) + " MB"
                : (file.size / 1024).toFixed(0) + " KB"} · 변경하려면 다시 클릭
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📎</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E40AF", marginBottom: 2 }}>
              클릭 또는 드래그하여 파일 첨부
            </div>
            <div style={{ fontSize: 12, color: "#64748B" }}>모든 형식 지원 · 최대 50MB</div>
          </>
        )}
      </div>

      <label style={modalLabel}>제출 메모 <span style={{ color:"#EF4444" }}>*</span></label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
        placeholder="작업 완료 내용 / 검토 시 봐야 할 부분 / 알려진 이슈 등"
        style={{ width:"100%", padding:12, borderRadius:10, border:"1px solid #E5E7EB",
          fontSize:13, fontFamily:F, resize:"vertical", marginBottom:14, boxSizing:"border-box" }} />
      <label style={modalLabel}>산출물 URL (선택)</label>
      <input value={fileUrl} onChange={e => setFileUrl(e.target.value)}
        placeholder="https://… (Figma / GitHub / Drive 등)"
        style={{ width:"100%", padding:"12px 14px", marginBottom:20, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box" }} />
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handleSubmit} disabled={submitting || uploading}
          style={{ ...primaryBtnStyle, flex:1.4, padding:"14px 0", fontSize:14,
            opacity:(submitting || uploading)?0.6:1 }}>
          {uploading ? "업로드 중…" : submitting ? "제출 중…" : "제출"}
        </button>
      </div>
    </ModalShell>
  );
}

function RevisionModal({ milestone, projectId, onClose, onSuccess, onToast }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return onToast?.("수정 사유를 입력해 주세요.");
    setSubmitting(true);
    try {
      await milestonesApi.requestRevision(projectId, milestone.id, reason.trim());
      onSuccess?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || "요청에 실패했습니다.");
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell onClose={onClose} title={`수정 요청 — ${milestone.title}`}>
      <label style={modalLabel}>수정 사유 *</label>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={5}
        placeholder="어떤 부분을 보완해 주셔야 하는지 구체적으로 적어 주세요."
        style={{ width:"100%", padding:12, borderRadius:10, border:"1px solid #E5E7EB",
          fontSize:13, fontFamily:F, resize:"vertical", marginBottom:20, boxSizing:"border-box" }} />
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ flex:1.4, padding:"14px 0", borderRadius:10, border:"1px solid #FECACA",
            background:"white", color:"#DC2626", fontWeight:700, fontSize:14,
            cursor:"pointer", fontFamily:F, opacity:submitting?0.6:1 }}>
          {submitting?"처리 중…":"수정 요청 보내기"}
        </button>
      </div>
    </ModalShell>
  );
}

const CONTRACT_STATUS_OPTIONS = ["미확정", "논의 중", "제안됨", "확정", "협의완료"];

function ContractItemModal({ contractKey, label, currentStatus, currentData, projectId, onClose, onSuccess, onToast }) {
  const [selected, setSelected] = useState(currentStatus);
  const [editData, setEditData] = useState((() => {
    if (!currentData) return "";
    try { const p = JSON.parse(currentData); return p.text || p.content || currentData; }
    catch { return currentData; }
  })());
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (selected === currentStatus && editData === (() => {
      if (!currentData) return "";
      try { const p = JSON.parse(currentData); return p.text || p.content || currentData; }
      catch { return currentData; }
    })()) return onClose();
    setSubmitting(true);
    try {
      const dataPayload = editData.trim() ? JSON.stringify({ text: editData.trim() }) : undefined;
      await projectModulesApi.upsert(projectId, contractKey, { status: selected, data: dataPayload });
      onSuccess(contractKey, selected, dataPayload || currentData);
    } catch (e) {
      onToast?.(e?.response?.data?.message || "상태 업데이트에 실패했습니다.");
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell onClose={onClose} title={`세부 협의 — ${label}`}>
      {/* 협의 내용 영역 */}
      <label style={{ ...modalLabel, marginBottom:6 }}>협의 내용</label>
      <textarea value={editData} onChange={e => setEditData(e.target.value)} rows={4}
        placeholder="협의된 내용을 입력하세요. (범위, 금액, 조건 등)"
        style={{ width:"100%", padding:"12px 14px", marginBottom:18, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box",
          resize:"vertical", lineHeight:1.6, color:"#1E293B" }} />
      {/* 상태 선택 */}
      <label style={{ ...modalLabel, marginBottom:8 }}>협의 상태</label>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {CONTRACT_STATUS_OPTIONS.map(opt => {
          const _ss = statusStyle(opt);
          const isActive = selected === opt;
          return (
            <button key={opt} onClick={() => setSelected(opt)}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 14px", borderRadius:9,
                border: isActive ? "2px solid #3B82F6" : "1.5px solid #E5E7EB",
                background: isActive ? "#EFF6FF" : "white",
                cursor:"pointer", fontFamily:F, transition:"all 0.12s" }}>
              <span style={{ fontSize:13.5, fontWeight:isActive?700:500,
                color: isActive ? "#1E40AF" : "#374151", fontFamily:F }}>
                {opt}
              </span>
              {isActive && <span style={{ fontSize:14, color:"#3B82F6" }}>✓</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handleSave} disabled={submitting}
          style={{ ...primaryBtnStyle, flex:1.4, padding:"14px 0", fontSize:14,
            opacity:submitting?0.6:1 }}>
          {submitting ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1100,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:F }}
      onClick={onClose}>
      <div style={{ background:"white", borderRadius:20, padding:28, width:"100%", maxWidth:480,
        maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:"0 0 18px", fontSize:22, fontWeight:900, fontFamily:F,
          background:PRIMARY_GRAD, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Toast({ message }) {
  return (
    <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
      background:"rgba(15,23,42,0.92)", color:"white", padding:"12px 20px", borderRadius:10,
      fontSize:14, fontWeight:600, zIndex:1200, fontFamily:F, boxShadow:"0 10px 30px rgba(0,0,0,0.25)" }}>
      {message}
    </div>
  );
}

const backBtnStyle = { background:"none", border:"none", color:"#64748B",
  fontSize:13, fontWeight:600, cursor:"pointer", padding:0, fontFamily:F };
const primaryBtnStyle = { padding:"8px 16px", borderRadius:10, border:"none",
  background:PRIMARY_GRAD, color:"white", fontWeight:700, fontSize:13,
  cursor:"pointer", fontFamily:F, boxShadow:"0 2px 8px rgba(99,102,241,0.25)" };
const ghostBtn = { flex:1, padding:"14px 0", borderRadius:10, border:"1px solid #E5E7EB",
  background:"white", color:"#374151", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:F };
const modalLabel = { display:"block", fontSize:12, fontWeight:700, color:"#475569",
  marginBottom:6, fontFamily:F };

function AddFileModal({ projectId, onClose, onSuccess, onToast }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const onPickFile = (f) => {
    if (!f) return;
    setFile(f);
    if (!name.trim()) setName(f.name);
  };
  const handleSubmit = async () => {
    if (!file) return onToast?.("업로드할 파일을 선택해 주세요.");
    setSubmitting(true);
    try {
      const finalName = name.trim() || file.name;
      await projectAttachmentsApi.upload(projectId, file, {
        name: finalName,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || "파일 업로드에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ModalShell onClose={onClose} title="파일 업로드">
      <label style={modalLabel}>파일 첨부 <span style={{color:"#EF4444"}}>*</span></label>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.background="#EFF6FF"; e.currentTarget.style.borderColor="#3B82F6"; }}
        onDragLeave={e => { e.currentTarget.style.background="#F8FAFC"; e.currentTarget.style.borderColor="#CBD5E1"; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.background="#F8FAFC"; e.currentTarget.style.borderColor="#CBD5E1"; onPickFile(e.dataTransfer.files?.[0]); }}
        style={{ marginBottom:14, padding:"22px 16px", borderRadius:12, border:"2px dashed #CBD5E1",
          background:"#F8FAFC", textAlign:"center", cursor:"pointer", transition:"all 0.15s" }}>
        <input ref={fileInputRef} type="file" style={{display:"none"}}
          onChange={e => onPickFile(e.target.files?.[0])} />
        {file ? (
          <div>
            <div style={{ fontSize:24, marginBottom:6 }}>📄</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", marginBottom:2 }}>{file.name}</div>
            <div style={{ fontSize:11, color:"#64748B" }}>{(file.size/1024).toFixed(1)} KB · 클릭해서 변경</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#475569", marginBottom:2 }}>클릭 또는 드래그하여 파일 첨부</div>
            <div style={{ fontSize:11, color:"#94A3B8" }}>모든 형식 지원</div>
          </div>
        )}
      </div>

      <label style={modalLabel}>파일 이름 (선택)</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="비우면 원본 파일명을 사용합니다"
        style={{ width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box" }} />
      <label style={modalLabel}>설명 (선택)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
        placeholder="파일에 대한 간단한 설명을 입력하세요."
        style={{ width:"100%", padding:"12px 14px", marginBottom:20, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box",
          resize:"vertical", lineHeight:1.5 }} />
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ ...primaryBtnStyle, flex:1.4, padding:"14px 0", fontSize:14, opacity:submitting?0.6:1 }}>
          {submitting ? "업로드 중…" : "파일 업로드"}
        </button>
      </div>
    </ModalShell>
  );
}

function AddLinkModal({ projectId, onClose, onSuccess, onToast }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!name.trim()) return onToast?.("링크 이름을 입력해 주세요.");
    if (!url.trim()) return onToast?.("URL을 입력해 주세요.");
    setSubmitting(true);
    try {
      await projectAttachmentsApi.create(projectId, { kind: "LINK", name: name.trim(), url: url.trim(), notes: notes.trim()||undefined });
      onSuccess?.();
    } catch (e) { onToast?.(e?.response?.data?.message || "링크 추가에 실패했습니다."); }
    finally { setSubmitting(false); }
  };
  return (
    <ModalShell onClose={onClose} title="링크 추가">
      <label style={modalLabel}>링크 이름 *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="예) Figma 디자인 시안"
        style={{ width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box" }} />
      <label style={modalLabel}>URL *</label>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://figma.com/…"
        style={{ width:"100%", padding:"12px 14px", marginBottom:14, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box" }} />
      <label style={modalLabel}>설명 (선택)</label>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
        placeholder="링크에 대한 간단한 설명을 입력하세요."
        style={{ width:"100%", padding:"12px 14px", marginBottom:20, borderRadius:10,
          border:"1px solid #E5E7EB", fontSize:13, fontFamily:F, boxSizing:"border-box",
          resize:"vertical", lineHeight:1.5 }} />
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} disabled={submitting} style={ghostBtn}>취소</button>
        <button onClick={handleSubmit} disabled={submitting}
          style={{ ...primaryBtnStyle, flex:1.4, padding:"14px 0", fontSize:14, opacity:submitting?0.6:1 }}>
          {submitting ? "추가 중…" : "링크 추가"}
        </button>
      </div>
    </ModalShell>
  );
}
