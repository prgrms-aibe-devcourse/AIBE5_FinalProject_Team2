import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header_partner from "../components/Header_partner";
import PartnerBannerCard from "../components/PartnerBannerCard";
import useStore from "../store/useStore";
import { portfolioApi } from "../api";
import { profileApi } from "../api/profile.api";
import { toPortfolioCard } from "../lib/portfolio";

import tutoOnboard from "../assets/tuto_onboard.png";
import userGuide from "../assets/user_guide.png";
import tutoSolution from "../assets/tuto_solution.png";


const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ── GitHub 잔디 ─────────────────────────────────────────── */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["S","M","T","W","T","F","S"];
const GREEN = ["#ebedf0","#9be9a8","#40c463","#30a14e","#216e39"];

function generateMockContribData() {
  const weeks = [];
  for (let w = 0; w < 60; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      let level = 0;
      if (w < 35) {
        const r = Math.random();
        if (r > 0.15) level = Math.floor(Math.random() * 4) + 1;
      } else if (w < 42) {
        const r = Math.random();
        if (r > 0.6) level = Math.floor(Math.random() * 2) + 1;
      } else {
        const r = Math.random();
        if (r > 0.75) level = 1;
      }
      days.push(level);
    }
    weeks.push(days);
  }
  return weeks;
}

// GitHub API의 일별 contribution 배열을 60주 × 7일 그리드로 변환
function buildContribGrid(contributions) {
  const dateMap = {};
  contributions.forEach(({ date, level }) => { dateMap[date] = level; });
  const today = new Date();
  const dow = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const start = new Date(weekStart);
  start.setDate(weekStart.getDate() - 59 * 7);
  const weeks = [];
  for (let w = 0; w < 60; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const key = dt.toISOString().slice(0, 10);
      week.push(dateMap[key] ?? 0);
    }
    weeks.push(week);
  }
  return weeks;
}

function extractGithubUsername(url) {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/\s?#]+)/);
  return m ? m[1] : null;
}

// GitHub 데이터를 가져오는 훅: URL이 있으면 실제 API, 없거나 실패하면 mock으로 폴백
function useGithubData(githubUrl) {
  const username = extractGithubUsername(githubUrl);
  const [contribData, setContribData] = useState(generateMockContribData);
  const [skills, setSkills] = useState(null);
  const [totalCount, setTotalCount] = useState(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(json => {
        if (cancelled || !Array.isArray(json.contributions)) return;
        setContribData(buildContribGrid(json.contributions));
        const total = json.contributions.reduce((s, d) => s + (d.count || 0), 0);
        setTotalCount(total);
      })
      .catch(() => {});

    fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(repos => {
        if (cancelled || !Array.isArray(repos)) return;
        const counts = {};
        repos.forEach(r => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([l]) => l);
        if (sorted.length > 0) setSkills(sorted);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [username]);

  return { contribData, skills, totalCount, username };
}

function GithubEmptyState({ onConnect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🌲🐰🌿</div>
      <div style={{
        display: "inline-block", padding: "6px 14px", borderRadius: 99,
        background: "#F0FDF4", border: "1px solid #BBF7D0",
        fontSize: 12, fontWeight: 700, color: "#15803D", fontFamily: F, marginBottom: 14,
      }}>
        아직 잔디가 자라지 않았어요
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", fontFamily: F, marginBottom: 8, lineHeight: 1.4 }}>
        GitHub를 연결하고 나만의 숨속을 가꾸어보세요!
      </div>
      <div style={{ fontSize: 14, color: "#64748B", fontFamily: F, marginBottom: 22, lineHeight: 1.6, maxWidth: 480 }}>
        GitHub 저장소 URL을 등록하면 기여도 잔디와 주요 기술 스태이 자동으로 채워져요.<br/>
        AI 챗이 계정 설정을 도와드려요.
      </div>
      <button
        onClick={onConnect}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(99,102,241,0.45)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.30)"; }}
        style={{
          padding: "12px 26px", borderRadius: 999, border: "none",
          background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
          color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: F, boxShadow: "0 4px 14px rgba(99,102,241,0.30)",
          transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 8,
        }}
      >
        ✨ AI 챗으로 GitHub 등록하러 가기
      </button>
    </div>
  );
}

function GithubContrib({ data }) {
  const gap = 2;

  return (
    <div style={{ width: "100%" }}>
      {/* 월 레이블 — 레이블 컬럼 폭만큼 운공간 + 12개월 균등 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "16px repeat(12, 1fr)",
        marginBottom: 4, height: 14, columnGap: gap,
      }}>
        <div />
        {MONTHS.map((m, i) => (
          <div key={i} style={{
            fontSize: 11, color: "#64748B", fontFamily: F, fontWeight: 600,
            display: "flex", alignItems: "flex-end",
          }}>{m}</div>
        ))}
      </div>

      {/* 본체 그리드: 1열(요일 레이블) + 60열(주차) × 7행(요일) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "16px repeat(60, 1fr)",
        gap,
      }}>
        {DAYS.map((dayLabel, dayIdx) => (
          <div key={`row-${dayIdx}`} style={{ display: "contents" }}>
            <div style={{
              fontSize: 10, color: "#94A3B8", fontFamily: F,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              lineHeight: 1, paddingRight: 2,
            }}>{dayLabel}</div>
            {data.map((week, weekIdx) => (
              <div
                key={`${dayIdx}-${weekIdx}`}
                title="contributions"
                style={{
                  aspectRatio: "1/1",
                  borderRadius: 3,
                  background: GREEN[week[dayIdx]],
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 기술 태그 칩 (스킬) ──────────────────────────────────── */
const SKILL_COLORS = {
  JavaScript:{ bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  TypeScript:{ bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  React:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  Vue:      { bg: "#F0FDF4", border: "#86EFAC", text: "#166534" },
  Python:   { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  Java:     { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  Go:       { bg: "#E0F2FE", border: "#7DD3FC", text: "#0C4A6E" },
  Rust:     { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
  "C++":    { bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6" },
  C:        { bg: "#F8FAFC", border: "#CBD5E1", text: "#334155" },
  Kotlin:   { bg: "#FDF4FF", border: "#E9D5FF", text: "#6B21A8" },
  Swift:    { bg: "#FFF1F2", border: "#FECDD3", text: "#9F1239" },
  Ruby:     { bg: "#FFF1F2", border: "#FECACA", text: "#B91C1C" },
  PHP:      { bg: "#F0F4FF", border: "#C7D2FE", text: "#3730A3" },
  Shell:    { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
  HTML:     { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" },
  CSS:      { bg: "#EFF6FF", border: "#93C5FD", text: "#1E40AF" },
  Dart:     { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
  Scala:    { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  R:        { bg: "#F0F4FF", border: "#C7D2FE", text: "#3730A3" },
  AWS:      { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  Docker:   { bg: "#1E293B", border: "#1E293B", text: "#FFFFFF" },
  Kubernetes:{ bg: "#EFF6FF", border: "#93C5FD", text: "#1E40AF" },
  Terraform:{ bg: "#F5F3FF", border: "#C4B5FD", text: "#5B21B6" },
  "Node.js":{ bg: "#F0FDF4", border: "#86EFAC", text: "#166534" },
  Figma:    { bg: "#FFF0F3", border: "#FECDD3", text: "#BE123C" },
  "Data Analysis":{ bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  Dockerfile:{ bg: "#1E293B", border: "#1E293B", text: "#FFFFFF" },
  Jupyter:  { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  "Jupyter Notebook":{ bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  Spring:   { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" },
  "Spring Boot":{ bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" },
  SQL:      { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
  MySQL:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
};

function SkillTag({ label }) {
  const c = SKILL_COLORS[label] || { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
  return (
    <span style={{
      padding: "6px 16px", borderRadius: 99,
      background: c.bg, border: `1.5px solid ${c.border}`,
      fontSize: 13, fontWeight: 600, color: c.text, fontFamily: F,
    }}>{label}</span>
  );
}

/* ── Selected Projects ────────────────────────────────────── */
const PROJECTS = [];

function ProjectCard({ project, allSourceKeys = [] }) {
  const navigate = useNavigate();
  const [hov, setHov] = useState(false);
  const handleClick = () => {
    if (project.sourceKey) {
      navigate("/portfolio_project_preview", {
        state: {
          sourceKey: project.sourceKey,
          sourceKeys: allSourceKeys.length > 0 ? allSourceKeys : [project.sourceKey],
        },
      });
    } else {
      navigate("/portfolio_project_preview");
    }
  };
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={handleClick}
      style={{
        background: "white", borderRadius: 16,
        border: `1.5px solid ${hov ? "#BFDBFE" : "#F1F5F9"}`,
        padding: "22px 24px",
        boxShadow: hov ? "0 8px 24px rgba(59,130,246,0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "all 0.2s",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 180,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: project.titleColor, fontFamily: F, lineHeight: 1.4 }}>
          {project.title}
        </span>
        {project.company && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", fontFamily: F, flexShrink: 0, paddingTop: 2 }}>
            {project.company}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "#475569", fontFamily: F, lineHeight: 1.7, margin: 0, flex: 1 }}>
        {project.desc}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {project.tags.map(t => (
          <span key={t} style={{
            padding: "3px 10px", borderRadius: 6,
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: F,
          }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function SelectedProjects() {
  const [page, setPage] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const perPage = 3;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    portfolioApi
      .myAdded()
      .then((items) => {
        if (!alive) return;
        setProjects((items || []).map((item, index) => toPortfolioCard(item, index)));
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "포트폴리오를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const totalPages = Math.max(1, Math.ceil(projects.length / perPage));
  const visible = projects.slice(page * perPage, page * perPage + perPage);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontSize: 23, fontWeight: 800, fontFamily: F, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Selected Projects</span>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, margin: "0 0 16px" }}>
            저장된 포트폴리오 항목을 기준으로 자동 표시됩니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { icon: <ChevronLeft size={16} />, disabled: page === 0, onClick: () => setPage(p => Math.max(0, p - 1)) },
            { icon: <ChevronRight size={16} />, disabled: page >= totalPages - 1, onClick: () => setPage(p => Math.min(totalPages - 1, p + 1)) },
          ].map(({ icon, disabled, onClick }, i) => (
            <button key={i} onClick={onClick} disabled={disabled}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: "1.5px solid #E2E8F0", background: disabled ? "#F8FAFC" : "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
                color: disabled ? "#CBD5E1" : "#374151",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; } }}
              onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#E2E8F0"; } }}
            >{icon}</button>
          ))}
        </div>
      </div>

      {/* 3열 그리드 */}
      {loading ? (
        <div style={{ padding: "36px 0", textAlign: "center", color: "#94A3B8", fontFamily: F }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ padding: "36px 0", textAlign: "center", color: "#B91C1C", fontFamily: F }}>{error}</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: "36px 0", textAlign: "center", color: "#94A3B8", fontFamily: F }}>아직 추가된 포트폴리오가 없습니다.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {visible.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              allSourceKeys={projects.map((x) => x.sourceKey).filter(Boolean)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── New Steps ────────────────────────────────────────────── */
const NEW_STEPS_DATA = [
  {
    id: 1,
    thumbnail: tutoOnboard,
    imgBg: "#E8E0D8",
    imgContent: "For My Newbes⭐",
    title: "전략 만들기 튜토리얼",
    desc: "Goal-to-Strategy 첫 설계를 따라해보세요",
  },
  {
    id: 2,
    thumbnail: userGuide,
    imgBg: "#FEF9C3",
    title: "Trust Score 해석 가이드",
    desc: "Alpha-Helix Trust Score를 읽는 법을 한눈에 보세요",
  },
  {
    id: 3,
    thumbnail: tutoSolution,
    imgBg: "#E8E0D8",
    title: "Living Briefing 시작하기",
    desc: "매일 아침 AI 매니저 브리핑을 동쪽하세요",
  },
];

const NEW_STEPS_IMAGES = [
  null, // placeholder — will use colored bg
  null,
  null,
];

function NewStepCard({ step, onClick }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "white",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: hov ? "0 8px 24px rgba(59,130,246,0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-2px)" : "none",
        transition: "all 0.2s",
      }}
    >
      {/* ✅ 정사각형 썸네일 */}
      <div style={{
        width: "100%",
        height: 305,          // 원하는 썸네일 높이
        overflow: "hidden",
      }}>
        <img
          src={step.thumbnail}
          alt={step.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPostion:"center top",
          }}
        />
      </div>

      {/* 텍스트 영역 */}
      <div style={{ padding: "20px 22px" }}>
        <div style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#1E293B",
          marginBottom: 6
        }}>
          {step.title}
        </div>

        <p style={{
          fontSize: 14,
          color: "#94A3B8",
          marginBottom: 16
        }}>
          {step.desc}
        </p>

        <div style={{
          display: "flex",
          justifyContent: "space-between"
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#3B82F6"
          }}>
            GET STARTED
          </span>
          <span style={{ color: "#3B82F6" }}>→</span>
        </div>
      </div>
    </div>
  );
}

function NewSteps() {
  const navigate = useNavigate();
  const destinations = {
    1: "/onboarding",
    2: "/usage_guide",
    3: "/solution_market",
  };
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>🧩</span>
        <span style={{ fontSize: 23, fontWeight: 800, fontFamily: F, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>New Steps</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {NEW_STEPS_DATA.map(step => (
          <NewStepCard key={step.id} step={step} onClick={() => navigate(destinations[step.id])} />
        ))}
      </div>
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────── */
export default function Partner_Portfolio() {
  const navigate = useNavigate();
  const githubUrl = useStore(s => s.partnerProfileDetail?.githubUrl) || "";
  const { setPartnerProfileDetail } = useStore();
  const { contribData, skills, totalCount, username } = useGithubData(githubUrl);
  const hasGithub = !!extractGithubUsername(githubUrl);
  const baseSkills = skills && skills.length > 0 ? skills : Object.keys(SKILL_COLORS).slice(0, 9);
  // 사용자 GitHub에 실제로 올라가 있는 주요 스택을 항상 포함
  const EXTRA_SKILLS = ["Python", "Spring Boot", "AWS", "SQL"];
  const displaySkills = Array.from(new Set([...baseSkills, ...EXTRA_SKILLS]));

  // DB에서 프로필 데이터 로드 (githubUrl 포함)
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const data = await profileApi.getMyDetail();
        setPartnerProfileDetail(data);
      } catch (error) {
        console.error("프로필 데이터 로드 실패:", error);
      }
    };
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      <Header_partner />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ─── 파트너 배너 카드 ─── */}
        <PartnerBannerCard activePage="portfolio" />

        {/* ─── GitHub Contribution ─── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1.5px solid #F1F5F9",
          padding: "20px 32px",
          marginBottom: 28,
          marginLeft: -38, marginRight: -38,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          {hasGithub ? (
            <>
          {/* 헤더 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg height="20" width="20" viewBox="0 0 16 16" fill="#24292F">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span style={{ fontSize: 19.5, fontWeight: 800, fontFamily: F,
                background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                GitHub Contribution & Qualified Skill
              </span>
              {totalCount !== null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", fontFamily: F, marginLeft: 4,
                  padding: "3px 10px", borderRadius: 99, background: "#F0FDF4", border: "1px solid #BBF7D0",
                }}>
                  최근 1년 {totalCount.toLocaleString()} contributions
                </span>
              )}
            </div>
            <span onClick={() => window.open(githubUrl, "_blank")} style={{ fontSize: 15, color: "#3B82F6", cursor: "pointer", fontFamily: F, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowRight size={14} strokeWidth={2.5} /> {username ? `@${username}` : "Synced Github"}
            </span>
          </div>

          {/* 잔디 그래프 */}
          <div style={{ marginBottom: 24 }}>
            <GithubContrib data={contribData} />
          </div>

          {/* 기술 태그 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {displaySkills.map(skill => (
              <SkillTag key={skill} label={skill} />
            ))}
          </div>
            </>
          ) : (
            <GithubEmptyState onConnect={() => navigate("/aichat_portfolio", { state: { startAt: "github" } })} />
          )}
        </div>

        {/* ─── Selected Projects ─── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1.5px solid #F1F5F9",
          padding: "20px 32px",
          marginBottom: 28,
          marginLeft: -38, marginRight: -38,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <SelectedProjects />
        </div>

        {/* ─── New Steps ─── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1.5px solid #F1F5F9",
          padding: "20px 32px",
          marginBottom: 28,
          marginLeft: -38, marginRight: -38,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <NewSteps />


        </div>
      </div>

    </div>
  );
}
