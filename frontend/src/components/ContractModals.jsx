import React, { useState } from "react";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ─── 공통 스타일 ─────────────────────────────────────── */
const OVERLAY = { position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 };
const CARD    = { background: "white", width: "min(640px, 92%)", maxHeight: "78%", borderRadius: 20, overflowY: "auto", fontFamily: F, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.22)" };
const CARD_INLINE = { background: "white", borderRadius: 16, fontFamily: F, display: "flex", flexDirection: "column" };
const HEADER  = { padding: "16px 20px 14px", borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, background: "white", zIndex: 2, flexShrink: 0, borderRadius: "20px 20px 0 0" };
const BODY    = { padding: "20px 24px", flex: 1 };
const FOOTER  = { padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", gap: 12, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "white", zIndex: 2, flexShrink: 0, borderRadius: "0 0 20px 20px" };
const IN      = { width: "100%", padding: "8px 11px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: F, color: "#374151", outline: "none", boxSizing: "border-box", background: "#FAFAFA" };
const TA      = { ...IN, minHeight: 68, resize: "vertical", display: "block" };

function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* ─── 공통 배지 ─────────────────────────────────────── */
function Badge({ children, color = "#F1F5F9", text = "#374151", icon }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 999, background: color, color: text, fontSize: 12, fontWeight: 600 }}>
      {icon && <span>{icon}</span>}{children}
    </span>
  );
}

function InlineToggleButton({ isEditing, onEdit, onSave, onSubmit }) {
  const [hovered, setHovered] = useState(false);
  const [acceptHovered, setAcceptHovered] = useState(false);
  const isSave = isEditing;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginTop: -2, marginLeft: "auto" }}>
      <button
        onClick={isSave ? onSave : onEdit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "9px 18px",
          borderRadius: 999,
          border: "none",
          background: isSave
            ? "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)"
            : hovered ? "#BFDBFE" : "#DBEAFE",
          color: isSave ? "#FFFFFF" : "#1e3a5f",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: F,
          boxShadow: isSave && hovered ? "0 8px 18px rgba(59,130,246,0.22)" : "none",
          transition: "background 0.15s, box-shadow 0.15s",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        {isSave ? "저장하기" : "수정하기"}
      </button>
      {onSubmit && (
        <button
          onClick={onSubmit}
          onMouseEnter={() => setAcceptHovered(true)}
          onMouseLeave={() => setAcceptHovered(false)}
          style={{
            padding: "9px 18px",
            borderRadius: 999,
            border: "none",
            background: acceptHovered
              ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
              : "linear-gradient(135deg, #34D399 0%, #10B981 100%)",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: F,
            boxShadow: acceptHovered ? "0 8px 18px rgba(16,185,129,0.30)" : "0 2px 6px rgba(16,185,129,0.18)",
            transition: "background 0.15s, box-shadow 0.15s",
          }}
        >
          ✓ 수락하기
        </button>
      )}
    </div>
  );
}

function ModuleTitle({ index, title, inline = false, required = false, description = null }) {
  // inline 모드(ProjectRegister 등 페이지 안에 직접 박혀 들어가는 경우): 제목 + (있으면) 설명 카드
  if (inline) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, fontFamily: F }}>
          {index}. {title}
          {required && <span style={{ color: "#EF4444", marginLeft: 6 }}>*</span>}
        </h2>
        {description && (
          <div style={{ background: "linear-gradient(135deg, #FEFCE8 0%, #ECFCCB 100%)", border: "1px solid #D9F99D", borderRadius: 10, padding: "8px 14px", display: "flex", gap: 8, alignItems: "flex-start", maxWidth: 420, marginRight: "auto" }}>
            <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>💡</span>
            <p style={{ margin: 0, fontSize: 12, color: "#3F6212", lineHeight: 1.55, fontFamily: F }}>{description}</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>
      {index}. {title}
    </h2>
  );
}

function ModuleStatusBadge({ status }) {
  if (status === "협의완료") return <Badge color="#DCFCE7" text="#16A34A" icon="✔">협의완료</Badge>;
  if (status === "확정") return <Badge color="#DCFCE7" text="#16A34A">확정</Badge>;
  if (status === "제안됨") return <Badge color="#DBEAFE" text="#1D4ED8">제안됨</Badge>;
  if (status === "논의 중") return <Badge color="#FEF3C7" text="#D97706">논의 중</Badge>;
  return <Badge color="#F1F5F9" text="#64748B">미확정</Badge>;
}
function StatusBadge({ confirmed }) {
  return confirmed
    ? <Badge color="#DCFCE7" text="#16A34A" icon="✔">작업자 확인 완료</Badge>
    : <Badge color="#FEF3C7" text="#D97706" icon="⏱">작업자 확인대기</Badge>;
}
function ClientBadge({ confirmed }) {
  return confirmed
    ? <Badge color="#DCFCE7" text="#16A34A" icon="✔">의뢰자 확인완료</Badge>
    : <Badge color="#FEF3C7" text="#D97706" icon="⏱">의뢰자 확인 대기</Badge>;
}
function SectionTitle({ bar, children, barColor = "#3B82F6" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {bar && <div style={{ width: 4, height: 22, borderRadius: 3, background: barColor }} />}
      <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{children}</span>
    </div>
  );
}
function InfoBox({ children }) {
  return (
    <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 16, flexShrink: 0, color: "#0EA5E9" }}>ℹ</span>
      <div style={{ margin: 0, fontSize: 13, color: "#0369A1", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

/* ─── 수정 모드 헬퍼 ─────────────────────────────────── */
function ELabel({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 9 }}>{children}</div>;
}
function EditList({ label, items, onChange, placeholder = "내용 입력" }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <ELabel>{label}</ELabel>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {list.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={item ?? ""}
              onChange={e => { const n = [...list]; n[i] = e.target.value; onChange(n); }}
              style={{ ...IN, flex: 1 }} placeholder={placeholder} />
            <button onClick={() => onChange(list.filter((_, j) => j !== i))}
              style={{ width: 30, height: 34, borderRadius: 7, border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontSize: 16, fontFamily: F, flexShrink: 0 }}>×</button>
          </div>
        ))}
        <button onClick={() => onChange([...list, ""])}
          style={{ padding: "7px 0", borderRadius: 8, border: "1.5px dashed #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
          + 추가
        </button>
      </div>
    </div>
  );
}

/* ─── 버전 드롭다운 MetaFooter ───────────────────────── */
function MetaFooter({ versions, vIdx, onVersionChange }) {
  const [open, setOpen] = useState(false);
  const cur = versions[vIdx];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF", display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>👤 마지막 수정자: <strong style={{ color: "#6B7280" }}>{cur.modifier}</strong></span>
        <span>📅 {cur.date}</span>
      </div>
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
          {cur.label} <span style={{ fontSize: 9, marginTop: 1 }}>▾</span>
        </button>
        {open && (
          <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: "white", border: "1.5px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", zIndex: 999, minWidth: 200, overflow: "hidden" }}>
            {versions.map((v, i) => (
              <div key={i}
                onClick={() => { onVersionChange(i); setOpen(false); }}
                onMouseEnter={e => { if (i !== vIdx) e.currentTarget.style.background = "#F8FAFC"; }}
                onMouseLeave={e => { if (i !== vIdx) e.currentTarget.style.background = "white"; }}
                style={{ padding: "9px 14px", cursor: "pointer", background: i === vIdx ? "#EFF6FF" : "white", borderBottom: i < versions.length - 1 ? "1px solid #F1F5F9" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: i === vIdx ? "#2563EB" : "#374151" }}>{v.label}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{v.modifier}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{v.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ActionButtons (보기 ↔ 수정 모드) ──────────────── */
function ActionButtons({ isEditing, onEdit, onSave, onCancel, onSubmit, inline }) {
  const [hov, setHov] = useState(false);
  if (inline) return null;
  if (isEditing) {
    return (
      <div style={FOOTER}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: F }}>
          취소
        </button>
        <button onClick={onSave} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: hov ? "linear-gradient(135deg,#059669,#10B981)" : "linear-gradient(135deg,#34D399,#059669)", border: "none", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", fontFamily: F, transition: "all 0.15s", boxShadow: hov ? "0 4px 16px rgba(16,185,129,0.3)" : "none" }}>
          저장하기 ✓
        </button>
      </div>
    );
  }
  return (
    <div style={FOOTER}>
      <button onClick={onEdit}
        style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "#F9FAFB", border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: F }}
        onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
        onMouseLeave={e => e.currentTarget.style.background = "#F9FAFB"}>
        수정하기
      </button>
      <button onClick={onSubmit} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: hov ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "linear-gradient(135deg,#60a5fa,#3b82f6,#6366f1)", border: "none", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", fontFamily: F, transition: "all 0.15s", boxShadow: hov ? "0 4px 16px rgba(99,102,241,0.35)" : "none" }}>
        이 조건으로 제안하기 →
      </button>
    </div>
  );
}

/* ─── 버전 관리 훅 ───────────────────────────────────── */
function useVersioned(initDate, initModifier, initData, startEditing = false, value = null, onChange = null) {
  // 외부에서 value 가 들어오면 그걸 초기값으로 사용 (등록/수정 페이지에서 사용).
  // initData 의 모든 키는 반드시 살아있어야 한다 (modal 내부 .map() 호출이 깨지지 않도록).
  // - value 가 null/undefined → initData 통째 사용
  // - value 가 객체 → value 의 non-null 키만 덮어쓰기
  // - value 가 배열/원시값 → AI 가 잘못된 모양으로 넣은 케이스로 보고 initData 사용 (호환 보호)
  const seedData = (() => {
    if (value == null) return initData;
    if (typeof value !== "object" || Array.isArray(value)) {
      // 모양이 안 맞으면 초기값으로 폴백 (콘솔 경고)
       
      console.warn("[useVersioned] value 모양이 객체가 아님 → initData 로 폴백", value);
      return initData;
    }
    const merged = { ...initData };
    for (const k of Object.keys(value)) {
      if (value[k] !== null && value[k] !== undefined) merged[k] = value[k];
    }
    // initData 에 있는데 merged 에 같은 형태(배열/객체) 가 아닌 키는 기본값으로 되돌림 (안전망)
    for (const k of Object.keys(initData)) {
      const def = initData[k];
      const cur = merged[k];
      if (Array.isArray(def) && !Array.isArray(cur)) merged[k] = def;
      else if (def && typeof def === "object" && !Array.isArray(def) && (typeof cur !== "object" || Array.isArray(cur) || cur === null)) merged[k] = def;
    }
    return merged;
  })();
  const [versions, setVersions] = useState([{ label: "v1", date: initDate, modifier: initModifier, data: seedData }]);
  const [vIdx, setVIdx] = useState(0);
  const [isEditing, setIsEditing] = useState(startEditing);
  const [draft, setDraft] = useState(startEditing ? JSON.parse(JSON.stringify(seedData)) : null);
  const content   = versions[vIdx].data;
  const edit      = () => { setDraft(JSON.parse(JSON.stringify(content))); setIsEditing(true); };
  const cancel    = () => { setIsEditing(false); setDraft(null); };
  const save      = () => {
    const newData = JSON.parse(JSON.stringify(draft));
    const nv = { label: `v${versions.length + 1}`, date: nowStr(), modifier: "나", data: newData };
    const nVers = [...versions, nv];
    setVersions(nVers); setVIdx(nVers.length - 1);
    setIsEditing(false); setDraft(null);
    // 외부 onChange 가 있으면 부모 state 에도 반영
    if (typeof onChange === "function") {
      try { onChange(newData); } catch (e) { console.error("[useVersioned] onChange 호출 실패", e); }
    }
  };
  const changeVer = (i) => { setVIdx(i); setIsEditing(false); setDraft(null); };
  return { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer };
}

/* ─────────────────────────────────────────────────────────
   Modal 1: 작업 범위
───────────────────────────────────────────────────────── */
export function ScopeModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 14:20", "Eden",
    { included: ["GraphQL schema 설계", "API 구조 정리", "기존 REST API 일부 리팩토링"], excluded: ["프론트엔드 개발", "서버 배포", "운영 중 장애 대응"], memo: "레거시 시스템과의 연결을 고려한 설계 포함\n운영 환경 인프라 설정은 제외" },
    inline && !readOnly, value, onChange
  );
  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={1} title="작업 범위" inline={inline} required description={readOnly ? null : "프로젝트에서 어떤 작업이 포함되고 어떤 작업이 제외되는지를 명확히 정의합니다. 추후 분쟁을 막기 위한 핵심 항목입니다."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>포함 {content.included.length}개 · 제외 {content.excluded.length}개</span>
              {moduleStatus !== "협의완료" && (
                <>
                  <StatusBadge confirmed />
                  <ClientBadge confirmed={false} />
                </>
              )}
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <EditList label="포함 작업" items={draft.included} onChange={v => setDraft(d => ({...d, included: v}))} placeholder="포함 작업 입력" />
              <EditList label="제외 작업" items={draft.excluded} onChange={v => setDraft(d => ({...d, excluded: v}))} placeholder="제외 작업 입력" />
              <div><ELabel>추가 메모</ELabel><textarea value={draft.memo} onChange={e => setDraft(d => ({...d, memo: e.target.value}))} style={TA} /></div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", display: "inline-block" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>포함 작업</span>
                  </div>
                  <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {content.included.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><span style={{ fontSize: 10, color: "#2563EB" }}>✓</span></div>
                        <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#9CA3AF", display: "inline-block" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>제외 작업</span>
                  </div>
                  <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {content.excluded.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><span style={{ fontSize: 12, color: "#9CA3AF" }}>−</span></div>
                        <span style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#374151", display: "block", marginBottom: 10 }}>추가 메모</span>
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 16px" }}>
                  {content.memo.split("\n").map((line, i, arr) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < arr.length - 1 ? 8 : 0 }}>
                      <span style={{ color: "#D97706", fontSize: 13, flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Modal 2: 최종 전달 결과물 정의
───────────────────────────────────────────────────────── */
export function DeliverablesModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 14:40", "Eden",
    {
      deliverables: [{ icon: "📄", label: "API 설계 문서 PDF 1부" }, { icon: "📝", label: "GraphQL schema 파일" }, { icon: "🔗", label: "GitHub repository 링크" }, { icon: "📖", label: "간단한 적용 가이드 문서" }],
      formats: ["PDF", ".graphql 또는 .txt", "GitHub URL"],
      delivery: ["ALPHA-HELIX 채팅 첨부", "GitHub 링크 공유", "필요 시 ZIP 파일 별도 전달"],
      notes: ["전달물은 한글 설명 문서 포함", "배포본은 포함되지 않음"],
    }
  ,
    inline && !readOnly, value, onChange
  );
  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={2} title="최종 전달 결과물 정의" inline={inline} required description={readOnly ? null : "작업이 완료되었을 때 클라이언트에게 인도되는 산출물의 종류·형식·전달 방법을 구체적으로 정합니다."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge color="#DCFCE7" text="#16A34A" icon="✔">작업자 제안 준비 중</Badge>
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <div style={{ marginBottom: 18 }}>
                <ELabel>전달물 목록 (이모지 + 설명)</ELabel>
                {draft.deliverables.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
                    <input value={d.icon} onChange={e => { const n = [...draft.deliverables]; n[i] = {...n[i], icon: e.target.value}; setDraft(dd => ({...dd, deliverables: n})); }}
                      style={{ ...IN, width: 48, textAlign: "center", flexShrink: 0 }} placeholder="🔗" />
                    <input value={d.label} onChange={e => { const n = [...draft.deliverables]; n[i] = {...n[i], label: e.target.value}; setDraft(dd => ({...dd, deliverables: n})); }}
                      style={{ ...IN, flex: 1 }} placeholder="전달물 설명" />
                    <button onClick={() => setDraft(dd => ({...dd, deliverables: dd.deliverables.filter((_, j) => j !== i)}))}
                      style={{ width: 30, height: 34, borderRadius: 7, border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#EF4444", cursor: "pointer", fontSize: 16, fontFamily: F, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button onClick={() => setDraft(d => ({...d, deliverables: [...d.deliverables, { icon: "📎", label: "" }]}))}
                  style={{ padding: "7px 0", width: "100%", borderRadius: 8, border: "1.5px dashed #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>+ 추가</button>
              </div>
              <EditList label="파일 형식" items={draft.formats} onChange={v => setDraft(d => ({...d, formats: v}))} placeholder="파일 형식" />
              <EditList label="전달 방법" items={draft.delivery} onChange={v => setDraft(d => ({...d, delivery: v}))} placeholder="전달 방법" />
              <EditList label="추가 메모" items={draft.notes} onChange={v => setDraft(d => ({...d, notes: v}))} placeholder="추가 메모" />
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", display: "block", marginBottom: 12 }}>1. DELIVERABLES LIST</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {content.deliverables.map((d, i) => (
                    <div key={i} style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{d.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", lineHeight: 1.4 }}>{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", display: "block", marginBottom: 10 }}>2. FILE FORMATS</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {content.formats.map((f, i) => (<span key={i} style={{ padding: "6px 12px", borderRadius: 8, background: "#EFF6FF", color: "#2563EB", fontSize: 13, fontWeight: 600 }}>{f}</span>))}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", display: "block", marginBottom: 10 }}>3. DELIVERY METHOD</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {content.delivery.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#6B7280" }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", display: "block", marginBottom: 10 }}>4. ADDITIONAL NOTES</span>
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 16px" }}>
                  {content.notes.map((n, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < content.notes.length - 1 ? 6 : 0 }}>
                      <span style={{ color: "#D97706" }}>•</span>
                      <span style={{ fontSize: 13, color: "#92400E" }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Modal 3: 일정 및 마감일
───────────────────────────────────────────────────────── */
export function ScheduleModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 15:00", "Eden",
    {
      phases: [
        { num: "PHASE 01", title: "기획/설계", desc: "요구사항 상세 정의 및 UI/UX 와이어프레임 설계 확정", date: "2024.05.21", weeks: "3주 소요" },
        { num: "PHASE 02", title: "개발 1차", desc: "핵심 API 개발 및 주요 대시보드 기능 구현 완료", date: "2024.06.18", weeks: "3주 소요" },
        { num: "PHASE 03", title: "개발 2차", desc: "전체 모듈 통합 및 어드민 페이지, 푸시 연동 개발", date: "2024.07.09", weeks: "3주 소요" },
        { num: "PHASE 04", title: "최종 검수", desc: "QA 테스트, 버그 수정 및 실 서버 배포 준비", date: "2024.07.23", weeks: "3주 소요" },
      ],
      startDate: "2024.05.01", endDate: "2024.07.24", launchDate: "2024.08.01",
      reviewRules: [
        { label: "마일스톤별 검토 기간", value: "영업일 기준 3일 이내" },
        { label: "무상 수정 횟수", value: "총 3회 (디자인/기능 포함)" },
        { label: "피드백 지연 대응", value: "지연 일수만큼 자동 연장" },
      ],
    },
    inline && !readOnly, value, onChange
  );
  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={3} title="마감 일정 및 마일스톤" inline={inline} required description={readOnly ? null : "전체 일정과 단계별 마일스톤, 각 단계의 시작·종료일을 정합니다. 일정 지연 시 책임 기준이 됩니다."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge confirmed={false} />
              <ClientBadge confirmed />
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <div>
                <ELabel>마일스톤</ELabel>
                {draft.phases.map((p, i) => (
                  <div key={i} style={{ border: "1.5px solid #E5E7EB", borderRadius: 10, padding: "12px", marginBottom: 10, background: "#FAFAFA" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                      <input value={p.num} onChange={e => { const n=[...draft.phases]; n[i]={...n[i],num:e.target.value}; setDraft(d=>({...d,phases:n})); }} style={{ ...IN, width: 100 }} placeholder="PHASE 01" />
                      <input value={p.title} onChange={e => { const n=[...draft.phases]; n[i]={...n[i],title:e.target.value}; setDraft(d=>({...d,phases:n})); }} style={{ ...IN, flex:1 }} placeholder="단계명" />
                      <input value={p.weeks} onChange={e => { const n=[...draft.phases]; n[i]={...n[i],weeks:e.target.value}; setDraft(d=>({...d,phases:n})); }} style={{ ...IN, width: 90 }} placeholder="3주 소요" />
                      <button onClick={() => setDraft(d=>({...d,phases:d.phases.filter((_,j)=>j!==i)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                    </div>
                    <input value={p.desc} onChange={e => { const n=[...draft.phases]; n[i]={...n[i],desc:e.target.value}; setDraft(d=>({...d,phases:n})); }} style={{ ...IN, marginBottom: 7 }} placeholder="설명" />
                    <input value={p.date} onChange={e => { const n=[...draft.phases]; n[i]={...n[i],date:e.target.value}; setDraft(d=>({...d,phases:n})); }} style={{ ...IN, width: 140 }} placeholder="2024.05.21" />
                  </div>
                ))}
                <button onClick={() => setDraft(d=>({...d,phases:[...d.phases,{num:`PHASE 0${d.phases.length+1}`,title:"",desc:"",date:"",weeks:""}]}))}
                  style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 마일스톤 추가</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18 }}>
                {[["시작일","startDate"],["종료일","endDate"],["예상 런칭일","launchDate"]].map(([label,key])=>(
                  <div key={key}><ELabel>{label}</ELabel><input value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} style={IN} placeholder="YYYY.MM.DD" /></div>
                ))}
              </div>
              <div>
                <ELabel>검토 규칙</ELabel>
                {draft.reviewRules.map((r,i)=>(
                  <div key={i} style={{ display:"flex",gap:8,marginBottom:7 }}>
                    <input value={r.label} onChange={e=>{const n=[...draft.reviewRules];n[i]={...n[i],label:e.target.value};setDraft(d=>({...d,reviewRules:n}));}} style={{ ...IN,flex:1 }} placeholder="항목명" />
                    <input value={r.value} onChange={e=>{const n=[...draft.reviewRules];n[i]={...n[i],value:e.target.value};setDraft(d=>({...d,reviewRules:n}));}} style={{ ...IN,flex:1 }} placeholder="값" />
                    <button onClick={()=>setDraft(d=>({...d,reviewRules:d.reviewRules.filter((_,j)=>j!==i)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                  </div>
                ))}
                <button onClick={()=>setDraft(d=>({...d,reviewRules:[...d.reviewRules,{label:"",value:""}]}))}
                  style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 추가</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16 }}><span style={{fontSize:18}}>📅</span><span style={{fontSize:15,fontWeight:700,color:"#111827"}}>주요 마일스톤</span></div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24 }}>
                {content.phases.map((p,i)=>(
                  <div key={i} style={{ background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:14,padding:"16px 18px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                      <span style={{ fontSize:11,fontWeight:700,color:"#3B82F6",letterSpacing:"0.06em" }}>{p.num}</span>
                      <span style={{ fontSize:11,color:"#6B7280",background:"#EFF6FF",padding:"2px 8px",borderRadius:6 }}>{p.weeks}</span>
                    </div>
                    <p style={{ fontSize:14,fontWeight:700,color:"#111827",margin:"0 0 6px" }}>{p.title}</p>
                    <p style={{ fontSize:12,color:"#6B7280",margin:"0 0 10px",lineHeight:1.5 }}>{p.desc}</p>
                    <p style={{ fontSize:13,fontWeight:600,color:"#3B82F6",margin:0 }}>{p.date}</p>
                  </div>
                ))}
              </div>
              <div style={{ background:"#F8FAFC",borderRadius:14,padding:"16px 20px",marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><span style={{fontSize:15}}>⏱</span><span style={{fontSize:14,fontWeight:700,color:"#111827"}}>상세 일정</span></div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14 }}>
                  {[["시작일",content.startDate],["종료일",content.endDate],["예상 런칭일",content.launchDate]].map(([label,val],i)=>(
                    <div key={i}><p style={{fontSize:12,color:"#9CA3AF",margin:"0 0 4px"}}>{label}</p><p style={{fontSize:14,fontWeight:700,color:i===2?"#3B82F6":"#111827",margin:0}}>{val}</p></div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}><span style={{fontSize:15}}>✏️</span><span style={{fontSize:14,fontWeight:700,color:"#111827"}}>수정 및 검토 규칙</span></div>
                <div style={{ borderRadius:12,overflow:"hidden",border:"1px solid #E5E7EB" }}>
                  {content.reviewRules.map((r,i)=>(
                    <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 18px",background:i%2===0?"white":"#F8FAFC" }}>
                      <span style={{fontSize:13,color:"#374151"}}>{r.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"#111827"}}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Modal 4: 총 금액 및 정산 방식
───────────────────────────────────────────────────────── */
export function PaymentModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 15:30", "Eden",
    {
      total: "10,000,000",
      vatNote: "VAT 별도",
      stages: [
        { label: "계약금 (30%)", tag: "Initial", amount: "₩3,000,000", desc: "계약 후 3일 이내" },
        { label: "중도금 (40%)", tag: null, amount: "₩4,000,000", desc: "1차 산출물 검수 완료 후" },
        { label: "잔금 (30%)", tag: null, amount: "₩3,000,000", desc: "최종 납품 및 검수 완료 후" },
      ],
      bankName: "기업은행 123-456-7890",
      bankNote: "계좌 이체 · 일반 과세",
      extraPolicies: ["범위 외 요청: Man-month 실비 정산", "긴급 수정: 일괄 20% 할증 적용"],
    },
    inline && !readOnly, value, onChange
  );

  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={4} title="총 금액 및 정산 방식" inline={inline} required description={readOnly ? null : "계약 총액과 지급 방식(계약금·중도금·잔금 등)을 명확히 합니다. 단위와 부가세 포함 여부도 확인하세요."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge confirmed />
              <ClientBadge confirmed={false} />
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div><ELabel>총 계약금액 (원)</ELabel><input value={draft.total} onChange={e=>setDraft(d=>({...d,total:e.target.value}))} style={IN} placeholder="10,000,000" /></div>
                <div><ELabel>VAT 비고</ELabel><input value={draft.vatNote} onChange={e=>setDraft(d=>({...d,vatNote:e.target.value}))} style={IN} placeholder="VAT 별도" /></div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <ELabel>정산 단계</ELabel>
                {draft.stages.map((s,i)=>(
                  <div key={i} style={{ border:"1.5px solid #E5E7EB",borderRadius:10,padding:"12px",marginBottom:8,background:"#FAFAFA" }}>
                    <div style={{ display:"flex",gap:8,marginBottom:7 }}>
                      <input value={s.label} onChange={e=>{const n=[...draft.stages];n[i]={...n[i],label:e.target.value};setDraft(d=>({...d,stages:n}));}} style={{ ...IN,flex:1 }} placeholder="계약금 (30%)" />
                      <input value={s.tag||""} onChange={e=>{const n=[...draft.stages];n[i]={...n[i],tag:e.target.value||null};setDraft(d=>({...d,stages:n}));}} style={{ ...IN,width:90 }} placeholder="태그" />
                      <input value={s.amount} onChange={e=>{const n=[...draft.stages];n[i]={...n[i],amount:e.target.value};setDraft(d=>({...d,stages:n}));}} style={{ ...IN,width:120 }} placeholder="₩3,000,000" />
                      <button onClick={()=>setDraft(d=>({...d,stages:d.stages.filter((_,j)=>j!==i)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                    </div>
                    <input value={s.desc} onChange={e=>{const n=[...draft.stages];n[i]={...n[i],desc:e.target.value};setDraft(d=>({...d,stages:n}));}} style={IN} placeholder="지급 조건 설명" />
                  </div>
                ))}
                <button onClick={()=>setDraft(d=>({...d,stages:[...d.stages,{label:"",tag:null,amount:"",desc:""}]}))}
                  style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 단계 추가</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18 }}>
                <div><ELabel>은행/계좌</ELabel><input value={draft.bankName} onChange={e=>setDraft(d=>({...d,bankName:e.target.value}))} style={IN} placeholder="기업은행 123-456-7890" /></div>
                <div><ELabel>결제 비고</ELabel><input value={draft.bankNote} onChange={e=>setDraft(d=>({...d,bankNote:e.target.value}))} style={IN} placeholder="계좌 이체 · 일반 과세" /></div>
              </div>
              <EditList label="추가 비용 정책" items={draft.extraPolicies} onChange={v=>setDraft(d=>({...d,extraPolicies:v}))} placeholder="정책 항목" />
            </div>
          ) : (
            <div>
              <div style={{ background:"#F8FAFC",borderRadius:14,padding:"20px 22px",marginBottom:24,textAlign:"center" }}>
                <p style={{ fontSize:11,fontWeight:700,color:"#9CA3AF",letterSpacing:"0.08em",margin:"0 0 8px" }}>TOTAL CONTRACT AMOUNT</p>
                <p style={{ fontSize:28,fontWeight:800,color:"#111827",margin:"0 0 4px" }}>₩{content.total}</p>
                <p style={{ fontSize:13,color:"#9CA3AF",margin:0 }}>({content.vatNote})</p>
              </div>
              <div style={{ marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:14 }}>
                  <div style={{ width:3,height:18,borderRadius:2,background:"#3B82F6" }} />
                  <span style={{ fontSize:15,fontWeight:700,color:"#111827" }}>정산 단계 및 비율</span>
                </div>
                <div style={{ borderRadius:12,overflow:"hidden",border:"1px solid #E5E7EB" }}>
                  {content.stages.map((s,i)=>(
                    <div key={i} style={{ display:"flex",alignItems:"center",padding:"16px 18px",background:i%2===0?"white":"#F8FAFC",gap:10 }}>
                      <div>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:14,fontWeight:700,color:"#111827" }}>{s.label}</span>
                          {s.tag && <span style={{ fontSize:11,background:"#DBEAFE",color:"#1D4ED8",padding:"2px 8px",borderRadius:6,fontWeight:600 }}>{s.tag}</span>}
                        </div>
                        <p style={{ margin:"3px 0 0",fontSize:12,color:"#9CA3AF" }}>{s.desc}</p>
                      </div>
                      <span style={{ marginLeft:"auto",fontSize:16,fontWeight:800,color:"#111827" }}>{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                <div style={{ background:"#F8FAFC",borderRadius:12,padding:"14px 16px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                    <span style={{ fontSize:13 }}>🏦</span>
                    <span style={{ fontSize:13,fontWeight:700,color:"#374151" }}>결제 수단 및 증빙</span>
                  </div>
                  <p style={{ margin:"0 0 4px",fontSize:13,color:"#374151" }}>{content.bankName}</p>
                  <p style={{ margin:"0 0 8px",fontSize:12,color:"#6B7280" }}>{content.bankNote}</p>
                </div>
                <div style={{ background:"#F8FAFC",borderRadius:12,padding:"14px 16px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                    <span style={{ fontSize:13 }}>ℹ</span>
                    <span style={{ fontSize:13,fontWeight:700,color:"#374151" }}>추가 비용 정책</span>
                  </div>
                  {content.extraPolicies.map((t,i)=>(
                    <div key={i} style={{ display:"flex",gap:6,marginBottom:4 }}>
                      <span style={{ color:"#9CA3AF",fontSize:12 }}>•</span>
                      <span style={{ fontSize:12,color:"#6B7280" }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Modal 5: 수정 가능 범위
───────────────────────────────────────────────────────── */
export function RevisionModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 15:40", "Eden",
    {
      freeItems: [
        "단순 텍스트 문구 및 기배치 이미지의 교체",
        "색상, 폰트 스타일 등 단순 UI/UX 스타일 가이드 조정",
        "기존 기획안의 범주를 벗어나지 않는 마이너 업데이트",
      ],
      paidItems: [
        "최초 기획에 없던 신규 페이지 제작 및 대규모 기능 추가",
        "프로젝트 전체 디자인 컨셉 및 톤앤매너의 전면 재구축",
        "백엔드 로직의 근본적 변경 또는 DB 스키마 구조의 재설계",
      ],
      memo: "무상 수정 횟수는 총 3회로 제한됩니다. 횟수 초과 시 또는 유상 수정 기준에 해당하는 요청의 경우, 작업량 산정 후 별도의 추가 비용이 발생할 수 있습니다.",
    },
    inline && !readOnly, value, onChange
  );

  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={5} title="수정 가능 범위" inline={inline} required description={readOnly ? null : "작업 완료 후 가능한 수정 횟수와 추가 수정에 대한 비용·범위를 명시합니다."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8 }}>
              <StatusBadge confirmed />
              <ClientBadge confirmed={false} />
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <EditList label="무상 수정 범위" items={draft.freeItems} onChange={v=>setDraft(d=>({...d,freeItems:v}))} placeholder="무상 수정 항목" />
              <div style={{ marginTop: 14 }}>
                <EditList label="유상 수정 기준" items={draft.paidItems} onChange={v=>setDraft(d=>({...d,paidItems:v}))} placeholder="유상 수정 항목" />
              </div>
              <div style={{ marginTop: 14 }}>
                <ELabel>추가 메모</ELabel>
                <textarea value={draft.memo} onChange={e=>setDraft(d=>({...d,memo:e.target.value}))} style={TA} placeholder="추가 안내사항을 입력하세요" />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 24 }}>
                <SectionTitle bar barColor="#3B82F6">무상 수정 범위</SectionTitle>
                <div style={{ background:"#F8FAFC",borderRadius:12,padding:"16px 18px",display:"flex",flexDirection:"column",gap:12 }}>
                  {content.freeItems.map((item,i)=>(
                    <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                      <div style={{ width:22,height:22,borderRadius:"50%",background:"#2563EB",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                        <span style={{ color:"white",fontSize:11,fontWeight:700 }}>✓</span>
                      </div>
                      <span style={{ fontSize:14,color:"#374151",lineHeight:1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <SectionTitle bar barColor="#EF4444">유상 수정 기준</SectionTitle>
                <div style={{ background:"#F8FAFC",borderRadius:12,padding:"16px 18px",display:"flex",flexDirection:"column",gap:12 }}>
                  {content.paidItems.map((item,i)=>(
                    <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                      <div style={{ width:22,height:22,borderRadius:"50%",background:"#F3F4F6",border:"2px solid #D1D5DB",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                        <span style={{ color:"#9CA3AF",fontSize:14,lineHeight:1 }}>−</span>
                      </div>
                      <span style={{ fontSize:14,color:"#374151",lineHeight:1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <InfoBox><strong>추가 메모 및 유의사항</strong><br />{content.memo}</InfoBox>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────
   Modal 6: 완료 기준
───────────────────────────────────────────────────────── */
export function CompletionModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 15:50", "Eden",
    {
      steps: [
        { n: 1, title: "결과물 제출", desc: "작업자가 마일스톤 완료 후 결과물을 시스템에 업로드" },
        { n: 2, title: "상호 검수 및 수정", desc: "의뢰자의 피드백에 따른 오류 수정 및 보완 작업 진행" },
        { n: 3, title: "최종 승인 확정", desc: "모든 조건 충족 시 의뢰자가 최종 완료 버튼 클릭" },
      ],
      criteria: [
        "명세서 기반 기능 전수 동작",
        "주요 브라우저(Chrome, Safari) 호환성 확보",
        "코드 리뷰 인수인계 문서 포함",
      ],
      categories: [
        { n: 1, title: "API 명세서 전달", desc: "합의된 모든 핵심 및 부가 API의 스웨거(Swagger) 기반 명세서 전달 완료." },
        { n: 2, title: "기획/UI/UX 정밀 검수, 문서 첨부", desc: "요구사항 상세 정의서(PRD), UI/UX/Figma 디자인 파일 최종안 전달 완료." },
        { n: 3, title: "소스코드 리포지토리 전달", desc: "Github 프라이빗 리포지토리의 모든 개발 코드 및 배포 스크립트 최종 푸시 완료." },
        { n: 4, title: "운영 환경 테스트 완료", desc: "합의된 테스트 시나리오에 따른 QA 및 베타 테스터 결과 보고서 제출 및 버그 수정 완료." },
      ],
    },
    inline && !readOnly, value, onChange
  );

  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={6} title="완료 기준" inline={inline} required description={readOnly ? null : "어떤 조건이 충족되어야 '완료'로 인정할지 객관적인 기준을 정합니다."} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8 }}>
              <StatusBadge confirmed />
              <ClientBadge confirmed={false} />
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <div style={{ marginBottom: 14 }}>
                <ELabel>승인 프로세스 단계</ELabel>
                {draft.steps.map((s,i)=>(
                  <div key={i} style={{ display:"flex",gap:8,marginBottom:7 }}>
                    <input value={s.title} onChange={e=>{const n=[...draft.steps];n[i]={...n[i],title:e.target.value};setDraft(d=>({...d,steps:n}));}} style={{ ...IN,flex:1 }} placeholder="단계명" />
                    <input value={s.desc} onChange={e=>{const n=[...draft.steps];n[i]={...n[i],desc:e.target.value};setDraft(d=>({...d,steps:n}));}} style={{ ...IN,flex:2 }} placeholder="설명" />
                    <button onClick={()=>setDraft(d=>({...d,steps:d.steps.filter((_,j)=>j!==i)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                  </div>
                ))}
                <button onClick={()=>setDraft(d=>({...d,steps:[...d.steps,{n:d.steps.length+1,title:"",desc:""}]}))}
                  style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 단계 추가</button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <EditList label="완료 기준 정의" items={draft.criteria} onChange={v=>setDraft(d=>({...d,criteria:v}))} placeholder="기준 항목" />
              </div>
              <div>
                <ELabel>카테고리별 완료 기준</ELabel>
                {draft.categories.map((c,i)=>(
                  <div key={i} style={{ border:"1.5px solid #E5E7EB",borderRadius:10,padding:"10px",marginBottom:8,background:"#FAFAFA" }}>
                    <div style={{ display:"flex",gap:8,marginBottom:7 }}>
                      <input value={c.title} onChange={e=>{const n=[...draft.categories];n[i]={...n[i],title:e.target.value};setDraft(d=>({...d,categories:n}));}} style={{ ...IN,flex:1 }} placeholder="카테고리 제목" />
                      <button onClick={()=>setDraft(d=>({...d,categories:d.categories.filter((_,j)=>j!==i)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                    </div>
                    <textarea value={c.desc} onChange={e=>{const n=[...draft.categories];n[i]={...n[i],desc:e.target.value};setDraft(d=>({...d,categories:n}));}} style={{ ...TA,minHeight:50 }} placeholder="설명" />
                  </div>
                ))}
                <button onClick={()=>setDraft(d=>({...d,categories:[...d.categories,{n:d.categories.length+1,title:"",desc:""}]}))}
                  style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 카테고리 추가</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize:14,fontWeight:700,color:"#111827",display:"block",marginBottom:14 }}>결과 제출 승인 프로세스</span>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {content.steps.map((s,i)=>(
                    <div key={i} style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg, #1e3a5f 0%, #1D4ED8 100%)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <span style={{ color:"white",fontSize:14,fontWeight:700 }}>{s.n}</span>
                      </div>
                      <div style={{ paddingTop:5 }}>
                        <p style={{ margin:"0 0 3px",fontSize:13,fontWeight:700,color:"#111827" }}>{s.title}</p>
                        <p style={{ margin:0,fontSize:12,color:"#6B7280",lineHeight:1.5 }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize:14,fontWeight:700,color:"#111827",display:"block",marginBottom:12 }}>완료 기준 정의</span>
                <div style={{ background:"#F8FAFC",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10 }}>
                  {content.criteria.map((item,i)=>(
                    <div key={i} style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                      <div style={{ width:18,height:18,borderRadius:4,background:"#2563EB",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1 }}>
                        <span style={{ color:"white",fontSize:10,fontWeight:700 }}>✓</span>
                      </div>
                      <span style={{ fontSize:13,color:"#374151",lineHeight:1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span style={{ fontSize:14,fontWeight:700,color:"#111827",display:"block",marginBottom:12 }}>상세 카테고리별 완료 기준</span>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                  {content.categories.map((c,i)=>(
                    <div key={i} style={{ background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:12,padding:"12px 14px" }}>
                      <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:7 }}>
                        <span style={{ width:20,height:20,borderRadius:"50%",background:"#2563EB",color:"white",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>{c.n}</span>
                        <span style={{ fontSize:12,fontWeight:700,color:"#111827" }}>{c.title}</span>
                      </div>
                      <p style={{ margin:0,fontSize:11,color:"#6B7280",lineHeight:1.5 }}>{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Modal 7: 추가 특약 (선택)
───────────────────────────────────────────────────────── */
export function SpecialTermsModal({ onClose, onSubmit, showHeaderStatusBadge = true, moduleStatus = "논의 중", inline = false, value = null, onChange = null, readOnly = false }) {
  const { content, draft, setDraft, versions, vIdx, isEditing, edit, cancel, save, changeVer } = useVersioned(
    "2026.03.24 16:00", "Eden",
    {
      intro: "프로젝트의 원활한 진행과 상호 권리 보호를 위해 아래의 추가 특약 사항을 협의합니다.",
      terms: [
        {
          id: "nda", icon: "🛡", title: "보안 및 기밀 유지 (NDA)", enabled: true,
          items: [
            "프로젝트 관련 모든 내부 자료 및 산출물에 대한 제3자 유출 금지",
            "위반 시 발생한 실제 손해에 대한 배상 책임 부담",
          ],
        },
        {
          id: "ip", icon: "©", title: "지식재산권 귀속", enabled: true,
          items: [
            "최종 대금 지급 완료 시 산출물에 대한 모든 저작권은 의뢰인에게 귀속",
            "단, 작업자의 비상업적 목적 포트폴리오 활용 권한은 인정",
          ],
        },
        {
          id: "dispute", icon: "⚖", title: "분쟁 해결 및 관할", enabled: false,
          items: [
            "발생하는 분쟁은 상호 협의를 통해 해결함을 원칙으로 하되, 원만히 해결되지 않을 경우 서울중앙지방법원을 전합 관할로 합니다.",
          ],
        },
        {
          id: "other", icon: "···", title: "기타 특약", enabled: false,
          items: [
            "Communication: 계약 기간 내 상호 비방 금지 및 신의성실 원칙 준수",
            "Handover: 프로젝트 종료 후 인수인계 기간 최소 1주일 보장",
          ],
        },
      ],
    }
  ,
    inline && !readOnly, value, onChange
  );

  const toggleEnabled = (i) => setDraft(d => {
    const n = [...d.terms];
    n[i] = { ...n[i], enabled: !n[i].enabled };
    return { ...d, terms: n };
  });

  return (
    <div style={inline ? { display: "contents" } : OVERLAY}>
      <div style={inline ? CARD_INLINE : CARD}>
        <div style={inline ? { ...HEADER, border: "none", padding: "0 0 10px", position: "static", borderRadius: 0 } : HEADER}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ModuleTitle index={7} title="추가 특약 (선택)" inline={inline} description={readOnly ? null : "위 항목 외에 추가로 합의할 특약 사항을 자유롭게 적습니다. (선택 사항)"} />
              {!inline && showHeaderStatusBadge && <ModuleStatusBadge status={moduleStatus} />}
              {!inline && isEditing && <Badge color="#EFF6FF" text="#2563EB" icon="✏">수정 중</Badge>}
            </div>
            {inline ? (readOnly ? null : <InlineToggleButton isEditing={isEditing} onEdit={edit} onSave={save} onSubmit={onSubmit} />) : <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", padding: 0 }}>✕</button>}
          </div>
          {!inline && moduleStatus !== "협의완료" && (
            <div style={{ display: "flex", gap: 8 }}>
              <StatusBadge confirmed />
              <ClientBadge confirmed={false} />
            </div>
          )}
        </div>
        <div style={BODY}>
          {isEditing ? (
            <div>
              <div style={{ marginBottom: 14 }}>
                <ELabel>소개 문구</ELabel>
                <textarea value={draft.intro} onChange={e=>setDraft(d=>({...d,intro:e.target.value}))} style={TA} />
              </div>
              {draft.terms.map((term, ti) => (
                <div key={term.id} style={{ border:"1.5px solid #E5E7EB",borderRadius:12,padding:"12px",marginBottom:12,background:"#FAFAFA" }}>
                  <div style={{ display:"flex",gap:8,marginBottom:8,alignItems:"center" }}>
                    <input value={term.icon} onChange={e=>{const n=[...draft.terms];n[ti]={...n[ti],icon:e.target.value};setDraft(d=>({...d,terms:n}));}} style={{ ...IN,width:52,textAlign:"center" }} placeholder="아이콘" />
                    <input value={term.title} onChange={e=>{const n=[...draft.terms];n[ti]={...n[ti],title:e.target.value};setDraft(d=>({...d,terms:n}));}} style={{ ...IN,flex:1 }} placeholder="특약 제목" />
                    <button onClick={()=>toggleEnabled(ti)} style={{ padding:"6px 10px",borderRadius:7,border:`1.5px solid ${term.enabled?"#93C5FD":"#D1D5DB"}`,background:term.enabled?"#EFF6FF":"#F9FAFB",color:term.enabled?"#2563EB":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,fontFamily:F }}>
                      {term.enabled?"활성":"비활성"}
                    </button>
                    <button onClick={()=>setDraft(d=>({...d,terms:d.terms.filter((_,j)=>j!==ti)}))} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                  </div>
                  {term.items.map((item,ii)=>(
                    <div key={ii} style={{ display:"flex",gap:7,marginBottom:6 }}>
                      <input value={item} onChange={e=>{const n=[...draft.terms];n[ti].items[ii]=e.target.value;setDraft(d=>({...d,terms:n}));}} style={{ ...IN,flex:1 }} placeholder="조항 내용" />
                      <button onClick={()=>{const n=[...draft.terms];n[ti].items=n[ti].items.filter((_,j)=>j!==ii);setDraft(d=>({...d,terms:n}));}} style={{ width:30,height:36,borderRadius:7,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#EF4444",cursor:"pointer",fontSize:16,fontFamily:F,flexShrink:0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>{const n=[...draft.terms];n[ti].items=[...n[ti].items,""];setDraft(d=>({...d,terms:n}));}} style={{ padding:"5px 0",width:"100%",borderRadius:7,border:"1.5px dashed #D1D5DB",background:"#F9FAFB",color:"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 항목 추가</button>
                </div>
              ))}
              <button onClick={()=>setDraft(d=>({...d,terms:[...d.terms,{id:`term${Date.now()}`,icon:"📋",title:"",enabled:false,items:[""]}]}))}
                style={{ padding:"7px 0",width:"100%",borderRadius:8,border:"1.5px dashed #BFDBFE",background:"#EFF6FF",color:"#2563EB",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F }}>+ 특약 추가</button>
            </div>
          ) : (
            <div>
              <p style={{ margin:"0 0 18px",fontSize:13,color:"#6B7280",lineHeight:1.7 }}>{content.intro}</p>
              <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                {content.terms.map((term) => (
                  <div key={term.id} style={{ border:`1.5px solid ${term.enabled?"#BFDBFE":"#E5E7EB"}`,borderRadius:14,padding:"16px 18px",background:term.enabled?"#FAFEFF":"#FAFAFA" }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:32,height:32,borderRadius:9,background:term.enabled?"#EFF6FF":"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{term.icon}</div>
                        <span style={{ fontSize:14,fontWeight:700,color:"#111827" }}>{term.title}</span>
                      </div>
                      <span style={{ fontSize:11,padding:"3px 9px",borderRadius:20,fontWeight:700,background:term.enabled?"#DBEAFE":"#F3F4F6",color:term.enabled?"#1D4ED8":"#9CA3AF" }}>{term.enabled?"적용":"미적용"}</span>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                      {term.items.map((item, ii) => (
                        <div key={ii} style={{ display:"flex",gap:7 }}>
                          <span style={{ color:"#9CA3AF",fontSize:12,flexShrink:0 }}>•</span>
                          <span style={{ fontSize:12,color:"#6B7280",lineHeight:1.6 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!inline && <MetaFooter versions={versions} vIdx={vIdx} onVersionChange={changeVer} />}
        </div>
        <ActionButtons isEditing={isEditing} onEdit={edit} onSave={save} onCancel={cancel} onSubmit={onSubmit} inline={inline} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ContractModalLauncher: 7개 모달 버튼 목록
───────────────────────────────────────────────────────── */
export function ContractModalLauncher() {
  const [open, setOpen] = useState(null);

  const modalDefs = [
    { key: "scope",       label: "1. 작업 범위",             Component: ScopeModal },
    { key: "deliverable", label: "2. 최종 전달 결과물 정의",  Component: DeliverablesModal },
    { key: "schedule",    label: "3. 일정 및 마감일",         Component: ScheduleModal },
    { key: "payment",     label: "4. 총 금액 및 정산 방식",   Component: PaymentModal },
    { key: "revision",    label: "5. 수정 가능 범위",         Component: RevisionModal },
    { key: "completion",  label: "6. 완료 기준",              Component: CompletionModal },
    { key: "terms",       label: "7. 추가 특약 (선택)",       Component: SpecialTermsModal },
  ];

  const ActiveModal = modalDefs.find(m => m.key === open)?.Component;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {modalDefs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setOpen(key)}
            style={{
              padding: "12px 16px", borderRadius: 12,
              border: "1.5px solid #E5E7EB", background: "#F8FAFC",
              fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: "pointer", textAlign: "left",
              fontFamily: F, transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#1D4ED8"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#374151"; }}
          >
            <span>{label}</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>→</span>
          </button>
        ))}
      </div>

      {ActiveModal && <ActiveModal onClose={() => setOpen(null)} />}
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   외부에서 키로 모달 컴포넌트를 가져갈 수 있도록 매핑 export
   (read-only inline 뷰 등에서 사용)
───────────────────────────────────────────────────────── */
export const CONTRACT_MODAL_BY_KEY = {
  scope:       ScopeModal,
  deliverable: DeliverablesModal,
  schedule:    ScheduleModal,
  payment:     PaymentModal,
  revision:    RevisionModal,
  completion:  CompletionModal,
  terms:       SpecialTermsModal,
};

