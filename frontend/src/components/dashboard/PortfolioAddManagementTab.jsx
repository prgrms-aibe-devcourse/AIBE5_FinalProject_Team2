import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applicationsApi, portfolioApi, projectsApi } from "../../api";
import { toPortfolioEditorSeed, toPortfolioRequest } from "../../lib/portfolio";
import mascotIcon from "../../assets/hero_check.png";
import { renderProjectOverview } from "../../lib/projectMarkdown";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const TITLE_MAP = {
  partner: "포트폴리오 추가 관리",
  client: "포트폴리오 관리",
};

/* ── 토글 스위치 컴포넌트 ── */
function ToggleSwitch({ on, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 42, height: 24, borderRadius: 99,
        background: on ? "#3B82F6" : "#D1D5DB",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: on ? 21 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
        transition: "left 0.2s",
      }} />
    </div>
  );
}

function projectToItem(project, group, extra = {}) {
  const sourceKey = `project-${project.id}`;
  return {
    id: sourceKey,
    sourceKey,
    sourceProjectId: project.id,
    group,
    badge: extra.badge || (group === "진행 중" ? "진행 중" : "완료"),
    badgeBg: extra.badgeBg || (group === "진행 중" ? "#EFF6FF" : "#ECFDF5"),
    badgeColor: extra.badgeColor || (group === "진행 중" ? "#3B82F6" : "#15803D"),
    title: project.title || project.slogan || "프로젝트",
    desc: project.desc || project.sloganSub || "설명이 아직 없습니다.",
    tags: Array.isArray(project.tags) ? project.tags : [],
    period: project.period || "협의",
  };
}

async function loadPartnerItems() {
  const apps = await applicationsApi.myList();
  const relevant = (apps || []).filter((app) => ["ACCEPTED", "CONTRACTED", "IN_PROGRESS", "COMPLETED"].includes((app.status || "").toUpperCase()));
  const uniqueProjectIds = [...new Set(relevant.map((app) => app.projectId).filter(Boolean))];
  const projects = await Promise.all(uniqueProjectIds.map((projectId) => projectsApi.detail(projectId).catch(() => null)));
  const projectMap = new Map(projects.filter(Boolean).map((project) => [project.id, project]));
  return relevant
    .map((app) => {
      const project = projectMap.get(app.projectId);
      if (!project) return null;
      const status = (app.status || "").toUpperCase();
      const group = status === "COMPLETED" ? "완료" : "진행 중";
      return projectToItem(project, group, {
        badge: status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "진행 중" : "계약 대기",
        badgeBg: status === "COMPLETED" ? "#ECFDF5" : status === "IN_PROGRESS" ? "#FEF3C7" : "#EFF6FF",
        badgeColor: status === "COMPLETED" ? "#15803D" : status === "IN_PROGRESS" ? "#B45309" : "#1D4ED8",
      });
    })
    .filter(Boolean);
}

async function loadClientItems() {
  const [ongoing, completed] = await Promise.all([
    projectsApi.myList(["IN_PROGRESS"]).catch(() => []),
    projectsApi.myList(["COMPLETED"]).catch(() => []),
  ]);
  const seen = new Set();
  const dedupe = (list) => (list || []).filter((p) => {
    if (!p || p.id == null || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return [
    ...dedupe(ongoing).map((project) => projectToItem(project, "진행 중")),
    ...dedupe(completed).map((project) => projectToItem(project, "완료", {
      badge: "완료",
      badgeBg: "#ECFDF5",
      badgeColor: "#15803D",
    })),
  ];
}

export default function PortfolioAddManagementTab({ viewer = "partner", dashboardPath = "/partner_dashboard" }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [githubItems, setGithubItems] = useState([]);
  const [addedMap, setAddedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      viewer === "partner" ? loadPartnerItems() : loadClientItems(),
      portfolioApi.myList().catch(() => []),
    ])
      .then(([baseItems, savedItems]) => {
        if (!alive) return;
        const savedMap = new Map((savedItems || []).map((item) => [item.sourceKey, item]));
        const merged = baseItems.map((item) => {
          const saved = savedMap.get(item.sourceKey);
          return {
            ...item,
            title: saved?.title || item.title,
            desc: saved?.workContent || saved?.vision || item.desc,
            tags: saved?.techTags?.map((tag) => (String(tag).startsWith("#") ? String(tag) : `#${tag}`)) || item.tags,
            period: saved?.period || item.period,
            role: saved?.role || item.role,
          };
        });
        setItems(merged);

        const baseKeys = new Set(merged.map((m) => m.sourceKey));
        const github = (savedItems || [])
          .filter((s) => !baseKeys.has(s.sourceKey) && String(s.sourceKey || "").startsWith("github-"))
          .map((s) => ({
            id: s.sourceKey,
            sourceKey: s.sourceKey,
            sourceProjectId: null,
            group: "GitHub",
            badge: "GitHub",
            badgeBg: "#F3F4F6",
            badgeColor: "#111827",
            title: s.title || "GitHub 프로젝트",
            desc: s.workContent || s.vision || "",
            tags: (s.techTags || []).map((tag) => (String(tag).startsWith("#") ? String(tag) : `#${tag}`)),
            period: s.period || "",
            role: s.role || "",
            githubUrl: s.githubUrl || "",
          }));
        setGithubItems(github);

        const allItems = [...merged, ...github];
        setAddedMap(Object.fromEntries(allItems.map((item) => [item.sourceKey, savedMap.get(item.sourceKey)?.isAdded ?? false])));
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "포트폴리오 관리 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [viewer]);

  const grouped = useMemo(() => ({
    ongoing: items.filter((item) => item.group === "진행 중"),
    completed: items.filter((item) => item.group === "완료"),
  }), [items]);

  const openEditor = (currentItem) => {
    const allItems = [...items, ...githubItems];
    const editorItems = allItems
      .filter((item) => addedMap[item.sourceKey] || item.sourceKey === currentItem.sourceKey)
      .map((item) => toPortfolioEditorSeed(item, { added: addedMap[item.sourceKey] || item.sourceKey === currentItem.sourceKey }));
    navigate("/portfolio_detail_editor", {
      state: {
        projectId: currentItem.sourceKey,
        addedProjects: editorItems,
        returnTo: dashboardPath,
      },
    });
  };

  const handleToggle = async (item, nextValue) => {
    try {
      setBusyKey(item.sourceKey);
      await portfolioApi.upsertBySource(item.sourceKey, toPortfolioRequest({
        ...item,
        sourceKey: item.sourceKey,
        sourceProjectId: item.sourceProjectId,
        workContent: item.desc,
        tags: item.tags,
        isAdded: nextValue,
      }));
      setAddedMap((prev) => ({ ...prev, [item.sourceKey]: nextValue }));
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "포트폴리오 토글 저장 실패");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px", fontFamily: F, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {TITLE_MAP[viewer] || "포트폴리오 추가 관리"}
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.6, fontFamily: F }}>
          진행 중이거나 완료된 프로젝트를 포트폴리오로 선택하고 상세 내용을 저장할 수 있습니다.
        </p>
      </div>

      <AIPortfolioBanner onClick={() => navigate("/aichat_portfolio")} />

      {loading && <EmptyState label="불러오는 중..." />}
      {!loading && error && <EmptyState label={error} tone="error" />}
      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {githubItems.length > 0 && (
            <SectionBlock
              title="GitHub 프로젝트"
              desc="GitHub 저장소 URL을 통해 AI가 자동 작성한 포트폴리오입니다. 상세 편집으로 내용을 다듬어주세요."
              items={githubItems}
              addedMap={addedMap}
              busyKey={busyKey}
              onToggle={handleToggle}
              onOpenEditor={openEditor}
            />
          )}
          <SectionBlock
            title="진행 중인 프로젝트"
            desc="현재 진행 중인 프로젝트들입니다. 상세 작성으로 포트폴리오 내용을 저장할 수 있습니다."
            items={grouped.ongoing}
            addedMap={addedMap}
            busyKey={busyKey}
            onToggle={handleToggle}
            onOpenEditor={openEditor}
          />
          <SectionBlock
            title="완료한 프로젝트"
            desc="이미 완료된 프로젝트들도 포트폴리오로 공개하고 수정할 수 있습니다."
            items={grouped.completed}
            addedMap={addedMap}
            busyKey={busyKey}
            onToggle={handleToggle}
            onOpenEditor={openEditor}
          />
        </div>
      )}
    </div>
  );
}

function AIPortfolioBanner({ onClick }) {
  return (
    <div
      style={{
        marginBottom: 28,
        padding: "20px 28px",
        borderRadius: 20,
        background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #E0E7FF 100%)",
        border: "1.5px solid #BFDBFE",
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: F,
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(59,130,246,0.15)",
          overflow: "hidden",
        }}
      >
        <img src={mascotIcon} alt="AI" style={{ width: 56, height: 56, objectFit: "contain" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", marginBottom: 4 }}>
          AI가 포트폴리오 내용 작성을 도와드릴게요.
        </div>
        <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
          진행한 프로젝트나 GitHub 저장소를 알려주시면 더 매력적인 포트폴리오 문구를 생성합니다.
        </div>
      </div>
      <button
        onClick={onClick}
        style={{
          flexShrink: 0,
          padding: "12px 22px",
          borderRadius: 12,
          border: "none",
          background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
          color: "white",
          fontWeight: 700,
          fontSize: 14,
          fontFamily: F,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(59,130,246,0.30)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(59,130,246,0.40)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.30)";
        }}
      >
        내용 작성 도움받기
      </button>
    </div>
  );
}

function EmptyState({ label, tone = "neutral" }) {
  return (
    <div style={{
      padding: "40px 20px",
      borderRadius: 16,
      background: "#F8FAFC",
      border: "1px dashed #CBD5E1",
      color: tone === "error" ? "#B91C1C" : "#94A3B8",
      textAlign: "center",
      fontFamily: F,
    }}>{label}</div>
  );
}

function SectionBlock({ title, desc, items, addedMap, busyKey, onToggle, onOpenEditor }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px", fontFamily: F, background: "linear-gradient(120deg, #2563EB 0%, #1D4ED8 28%, #3B82F6 58%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, lineHeight: 1.6, fontFamily: F }}>{desc}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState label="표시할 프로젝트가 없습니다." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <div key={item.sourceKey} style={{ padding: "20px 22px", background: "white", border: "1.5px solid #E2E8F0", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: item.badgeBg, color: item.badgeColor, fontFamily: F }}>
                      {item.badge}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{item.title}</span>
                  </div>
                  <div style={{ margin: "0 0 10px" }}>{renderProjectOverview(item.desc)}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {(item.tags || []).map((tag) => (
                      <span key={tag} style={{ padding: "3px 10px", borderRadius: 99, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12, color: "#475569", fontFamily: F }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>기간: {item.period || "협의"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                  <button
                    onClick={() => onOpenEditor(item)}
                    style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#DBEAFE", color: "#1E3A5F", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F }}
                  >상세 작성하기</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#64748B", fontFamily: F }}>
                      {busyKey === item.sourceKey ? "저장 중..." : "포트폴리오에 추가"}
                    </span>
                    <ToggleSwitch
                      on={addedMap[item.sourceKey]}
                      onChange={(v) => onToggle(item, v)}
                      disabled={busyKey === item.sourceKey}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}