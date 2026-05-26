import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header_partner from "../components/Header_partner";
import { portfolioApi } from "../api";
import { toPortfolioPreviewProject } from "../lib/portfolio";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

/* ─ 공통 GitHub 링크 버튼 ─ */
function GithubLinkButton({ url }) {
  const isValid = !!url && url !== "#" && /^https?:\/\//.test(url);
  const handleClick = e => {
    if (!isValid) {
      e.preventDefault();
      alert("GitHub Repository URL이 등록되지 않았어요.\n포트폴리오 편집 화면의 [Tech Stack & Links] → [GitHub Repository]에 주소를 입력해주세요.");
    }
  };
  return (
    <a
      href={isValid ? url : "#"}
      target={isValid ? "_blank" : undefined}
      rel={isValid ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      style={{ textDecoration: "none", display: "inline-block", marginTop: 8 }}
    >
      <button style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 36px", borderRadius: 99,
        background: isValid ? PRIMARY_GRAD : "#CBD5E1",
        border: "none", cursor: isValid ? "pointer" : "not-allowed",
        color: "white", fontSize: 16, fontWeight: 700, fontFamily: F,
        boxShadow: isValid ? "0 6px 20px rgba(59,130,246,0.35)" : "none",
        opacity: isValid ? 1 : 0.85,
        transition: "all 0.2s",
      }}
      onMouseEnter={e => { if (isValid) e.currentTarget.style.boxShadow = "0 8px 28px rgba(59,130,246,0.5)"; }}
      onMouseLeave={e => { if (isValid) e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.35)"; }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="white">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        {isValid ? "View Source Code on GitHub →" : "GitHub URL 미등록"}
      </button>
    </a>
  );
}

/* ── 기본 프로젝트 데이터 (스크린샷 기준) ───────────────────── */
const DEFAULT_PROJECTS = [
  {
    id: 1,
    emoji: "🔗 🤝",
    title: "ALPHA-HELIX - AI Freelancer Marketplace",
    subtitle: "Full-Stack Development Project (React + Vite + Java Spring)",
    videoUrl: "#",
    videoLabel: "Watch full video on Google Drive ↗",
    description: `ALPHA-HELIX is a modern AI-powered freelancer marketplace that intelligently connects clients with skilled development partners. By combining an AI chatbot consultant, smart partner matching, and a structured contract negotiation system, we transform the often-complex process of outsourcing into a streamlined, trustworthy collaboration experience.`,
    type: "standard",
    visible: true,
    sections: {
      video: true,
      description: true,
      coreFeatures: true,
      keyPages: true,
      devHighlights: true,
      techDetails: true,
    },
    coreFeatures: [
      { title: "AI Chatbot Consultant", desc: "Smart project scoping via conversational AI" },
      { title: "Partner Matching", desc: "Filter and search developers by skill & location" },
      { title: "Contract Negotiation", desc: "7-section structured contract workflow" },
      { title: "Dual Dashboard", desc: "Separate client & partner management views" },
      { title: "Portfolio Showcase", desc: "Rich project portfolio with live preview" },
      { title: "Social Authentication", desc: "Kakao / Google OAuth 2.0 login" },
    ],
    keyPages: [
      { num: 1, title: "Landing Page", desc: "Hero section introducing ALPHA-HELIX's value proposition with animated UI and CTAs." },
      { num: 2, title: "Partner Search", desc: "Advanced filtering by category, skill, location and work style with card-based results." },
      { num: 3, title: "Client Dashboard", desc: "Project management hub with contract negotiation modals and AI chatbot integration." },
      { num: 4, title: "Partner Dashboard", desc: "Incoming project overview, contract review panel, and profile management." },
      { num: 5, title: "Portfolio Editor", desc: "Drag-and-drop portfolio builder with rich project detail pages and live preview." },
      { num: 6, title: "AI Chat (Project / Profile)", desc: "Dual-mode AI assistant for project consultation and developer recommendation." },
    ],
    devHighlights: [
      { title: "Modern Build Tooling", desc: "Vite 7.x provides instant HMR and optimized production builds" },
      { title: "Component Architecture", desc: "Custom reusable components following single responsibility principle" },
      { title: "Advanced State Management", desc: "Zustand with localStorage persistence for user preferences" },
      { title: "API Integration Patterns", desc: "OAuth 2.0 flows, RESTful API consumption, and real-time data fetching" },
      { title: "Performance Optimization", desc: "Render optimization with React hooks; route-based code splitting" },
    ],
    techDetails: [
      {
        title: "AI Chatbot Integration",
        items: [
          "Streaming response UI with typed text animation using React state",
          "Context-aware prompt chaining for project scoping conversations",
        ],
      },
      {
        title: "Contract Negotiation System",
        items: [
          "7-modal workflow with in-place edit mode and version history (useVersioned hook)",
          "Zustand-based shared state between ClientDashboard and PartnerDashboard",
        ],
      },
    ],
    githubUrl: "https://github.com/yeona-lee-researcher/aibe5Frontend",
    quickLinkLabel: "Selected Main Project",
    quickLinkSubs: ["Core Features", "Key Pages & Features", "Development Highlights", "Technical Implementation Details"],
  },
  {
    id: 2,
    emoji: "🧬 🤖",
    title: "Alpha-Helix - End-to-End Quantitative Research & Trading System",
    subtitle: "Personal Side Project • Comprehensive Full-Stack Quant Lifecycle",
    description: `This single, large-scale project contains three tightly integrated modules to demonstrate true "full-stack" capability across the entire quant lifecycle, from data ingestion to research and live execution.`,
    type: "modular",
    visible: true,
    sections: { description: true, modules: true },
    modules: [
      {
        num: 1,
        codeName: '"Chronos"',
        moduleName: "Datalake Governing the time of data",
        goal: "Build an automated, high-quality data pipeline that becomes the foundation for all quantitative research (emphasizing data-engineering skill).",
        capabilities: [
          { title: "Automated ingestion", desc: "Use Airflow to automatically collect historical market and on-chain data every day and store it in object storage such as S3." },
          { title: "Data quality management", desc: "Integrate Great Expectations into the pipeline to automatically validate missing values, outliers, and schema." },
          { title: "Efficient storage & access", desc: "Leverage Parquet and DuckDB so that even very large datasets can be queried at lightning speed." },
        ],
      },
      {
        num: 2,
        codeName: '"Hermes"',
        moduleName: "Real-time Signal Engine Delivering the market's signals",
        goal: "Receive market data in real time, analyze it, and generate meaningful trading signals with minimal latency (emphasizing ML engineering / algorithmic trading skill).",
        capabilities: [
          { title: "Asynchronous data processing", desc: "Use asyncio and WebSocket to ingest data from multiple exchanges simultaneously in a non-blocking fashion." },
          { title: "Real-time feature extraction", desc: "Use Redis as a state store and compute rolling microstructure features (e.g., OFI, realized volatility) directly on the stream." },
          { title: "Message-queue architecture", desc: "Employ Redis Pub/Sub to decouple ingestion, feature extraction, and signal generation for scalability." },
        ],
      },
      {
        num: 3,
        codeName: '"Athena"',
        moduleName: "Strategy & Insight Dashboard Finding wisdom in data",
        goal: "Discover new alpha strategies using the datalake and signal engine, and analyze/monitor their performance in an intuitive way (emphasizing quant strategy skill).",
        capabilities: [
          { title: "Regime-based strategies", desc: "Use ML models such as HMM to classify the market into regimes (trend / range / high-vol) and automatically switch strategies." },
          { title: "Systematic experiment management", desc: "Adopt MLflow to record parameters, performance metrics, and result charts for a large number of backtests." },
          { title: "Interactive dashboard", desc: "Build Streamlit/Dash dashboards to monitor current regime state, recommended strategies, and key indicators." },
        ],
      },
    ],
    githubUrl: "https://github.com/yeona-lee-researcher/alpha-helix",
    quickLinkLabel: "Secondary Showcase",
    quickLinkSubs: ["Module 1", "Module 2", "Module 3"],
  },
  {
    id: 3,
    emoji: "🎆 🗺️",
    title: "Festory - 축제 정보 통합 플랫폼",
    subtitle: "Full-stack Developer & Tech Lead • React + Node.js + MongoDB",
    videoUrl: "https://drive.google.com/file/d/1Hb3Dz2ghEP2GhYKnRotzG8tpa6KQ_tzS/view",
    videoLabel: "Watch full video on Google Drive ↗",
    description: `전국의 다양한 축제 정보를 한 곳에서 확인하고 공유할 수 있는 통합 플랫폼입니다. 사용자 위치 기반 추천 시스템과 실시간 축제 정보 업데이트 기능을 구현하여 사용자 경험을 극대화했습니다.`,
    type: "standard",
    visible: true,
    sections: {
      video: true,
      description: true,
      coreFeatures: true,
      keyPages: true,
      devHighlights: true,
      techDetails: true,
    },
    coreFeatures: [
      { title: "전국 축제 통합 검색", desc: "지역/기간/카테고리 필터로 원하는 축제를 빠르게 찾기" },
      { title: "위치 기반 추천", desc: "Google Maps API로 현재 위치 근처 진행 중인 축제 자동 추천" },
      { title: "실시간 업데이트", desc: "WebSocket 기반 축제 일정/프로그램 변경 실시간 반영" },
      { title: "소셜 리뷰 & 평점", desc: "축제별 후기/사진 공유 및 몀셔 표시" },
      { title: "관심 축제 알림", desc: "출시 축제 리마인더 및 취소/변경 알림 푸시 알림" },
      { title: "축제 일정 캘린더", desc: "관심 축제 캡터 및 개인 캘린더 연동" },
    ],
    keyPages: [
      { num: 1, title: "홈 / 탐색 페이지", desc: "지면 근처·인기 축제를 카드 형태로 표시하고 다양한 시각화로 둘러보기 제공." },
      { num: 2, title: "지도 뷰", desc: "Google Maps 기반 마커 클러스터링으로 면 단위·시/군/구 단위 축제 밀집도 시각화." },
      { num: 3, title: "축제 상세 페이지", desc: "일정/프로그램/위치/후기/사진을 한 페이지에 집약·제공." },
      { num: 4, title: "관심 축제 대시보드", desc: "좋아요한 축제 모아보기, D-day 카운튰, 알림 설정." },
      { num: 5, title: "커뮤니티 / 리뷰", desc: "축제별 후기 피드, 사진 공유, 멀웹 신고 관리." },
      { num: 6, title: "관리자 페이지", desc: "축제 등록/수정/멀웹 처리 등 운영 툴." },
    ],
    devHighlights: [
      { title: "Geo Query 최적화", desc: "MongoDB 2dsphere 인덱스로 위치 기반 축제 검색 응답속도 평균 80% 개선" },
      { title: "캠싱 전략", desc: "Redis로 인기 축제·자주 조회되는 지역 데이터를 캠싱하여 트래픽 부하 관리" },
      { title: "컴포넌트 아키텍처", desc: "React 재사용 캴포넌트 설계로 필터/카드/지도를 독립적으로 조합" },
      { title: "실시간 업데이트", desc: "WebSocket으로 주서 축제 재고/일정 변동을 클라이언트에 즉시 반영" },
      { title: "프로그레시브 로딩", desc: "대형 이미지/지도 타일을 지연 로드하여 초기 렌더링 최적화" },
    ],
    techDetails: [
      {
        title: "위치 기반 추천 파이프라인",
        items: [
          "사용자 좌표를 매개로 MongoDB $geoNear 집계로 단일 쿼리 안에서 거리/관심사/날짜 점수를 합산",
          "점수 상위 N건을 Redis Sorted Set으로 캐싱하여 재조회는 O(log N)으로 응답",
        ],
      },
      {
        title: "실시간 축제 업데이트 시스템",
        items: [
          "Express 서버에 Socket.IO 네임스페이스를 축제별로 할당해 구독/구독해제 부하 최소화",
          "관리자가 축제 정보 수정 시 DB 변경 스트림(Change Streams)을 구독 중인 클라이언트에게만 반영",
        ],
      },
    ],
    githubUrl: "https://github.com/yeona-lee-researcher/festory",
    quickLinkLabel: "Side Showcase",
    quickLinkSubs: ["Core Features", "Key Pages & Features", "Development Highlights", "Technical Implementation Details"],
  },
];

/* ── 비디오 썸네일 ─────────────────────────────────────────── */
function toEmbedUrl(url) {
  if (!url || typeof url !== "string") return null;
  // Google Drive: /file/d/{id}/view → /file/d/{id}/preview
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/i);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  // YouTube
  const yt =
    url.match(/youtube\.com\/watch\?v=([\w-]+)/i) ||
    url.match(/youtu\.be\/([\w-]+)/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/* ─ 썸네일 이미지 컴포넌트 ─ */
function ThumbnailImage({ thumbnailUrl }) {
  if (!thumbnailUrl) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}>
        <img
          src={thumbnailUrl}
          alt="Project thumbnail"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>
    </div>
  );
}

function VideoThumbnail({ videoUrl, videoLabel }) {
  const embedUrl = toEmbedUrl(videoUrl);
  if (embedUrl) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{
          borderRadius: 16, overflow: "hidden",
          background: "#000",
          position: "relative", paddingTop: "56.25%", /* 16:9 */
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}>
          <iframe
            src={embedUrl}
            title="Project video"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%",
              border: 0,
            }}
          />
        </div>
        {videoLabel && videoUrl && videoUrl !== "#" && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#3B82F6", fontFamily: F, textDecoration: "none", fontWeight: 500 }}>
              {videoLabel}
            </a>
          </div>
        )}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)",
        position: "relative", height: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        cursor: "pointer",
      }}>
        {/* 배경 파티클 효과 느낌 */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 40%, rgba(99,102,241,0.3) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 60%, rgba(139,92,246,0.2) 0%, transparent 60%)" }} />
        {/* 텍스트 */}
        <div style={{ position: "relative", textAlign: "center", color: "white", padding: "0 40px" }}>
          <p style={{ fontSize: 18, fontWeight: 700, fontFamily: F, fontStyle: "italic", lineHeight: 1.5, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
            "Connecting great ideas with the people who build them — ALPHA-HELIX."
          </p>
        </div>
        {/* 재생 버튼 */}
        <div style={{
          position: "absolute",
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(255,255,255,0.25)",
          border: "2px solid rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            width: 0, height: 0,
            borderTop: "10px solid transparent",
            borderBottom: "10px solid transparent",
            borderLeft: "16px solid white",
            marginLeft: 4,
          }} />
        </div>
      </div>
      {videoLabel && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a href={videoUrl} style={{ fontSize: 13, color: "#3B82F6", fontFamily: F, textDecoration: "none", fontWeight: 500 }}>
            {videoLabel}
          </a>
        </div>
      )}
    </div>
  );
}

/* ── 표준 프로젝트 섹션 ────────────────────────────────────── */
function StandardProjectSection({ project }) {
  const anchorId = `project-${project.id}`;
  const sections = project.sections || {};
  
  // 에디터에서 온 데이터도 처리할 수 있도록 안전하게 기본값 설정
  const safeProject = {
    emoji: project.emoji || "📝",
    title: project.title || "프로젝트",
    subtitle: project.subtitle || project.desc || "",
    videoUrl: project.videoUrl || "#",
    videoLabel: project.videoLabel || "영상 보기",
    description: project.description || project.workContent || project.vision || "",
    coreFeatures: Array.isArray(project.coreFeatures) && project.coreFeatures.length > 0 
      ? project.coreFeatures 
      : [],
    keyPages: Array.isArray(project.keyPages) ? project.keyPages : [],
    devHighlights: Array.isArray(project.devHighlights) ? project.devHighlights : [],
    techDetails: Array.isArray(project.techDetails) ? project.techDetails : [],
    githubUrl: project.githubUrl || project.liveUrl || "",
    ...project,
  };

  return (
    <div id={anchorId} style={{ marginBottom: 64 }}>
      {/* 프로젝트 제목 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{safeProject.emoji}</span>
        <h2 style={{ fontSize: 26, fontWeight: 900, fontFamily: F, margin: 0, lineHeight: 1.3, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {safeProject.title}
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: F, fontStyle: "italic", margin: "0 0 20px" }}>
        {safeProject.subtitle}
      </p>

      {/* 썸네일 */}
      {sections.thumbnail !== false && safeProject.thumbnailUrl && (
        <ThumbnailImage thumbnailUrl={safeProject.thumbnailUrl} />
      )}

      {/* 비디오 */}
      {sections.video !== false && safeProject.videoUrl && safeProject.videoUrl !== "#" && (
        <VideoThumbnail videoUrl={safeProject.videoUrl} videoLabel={safeProject.videoLabel} />
      )}

      {/* 설명 */}
      {sections.description !== false && safeProject.description && (
        <p style={{ fontSize: 15, color: "#374151", fontFamily: F, lineHeight: 1.8, marginBottom: 28 }}>
          {safeProject.description}
        </p>
      )}

      {/* 핵심 기능 */}
      {sections.coreFeatures !== false && safeProject.coreFeatures.length > 0 && (
        <div id={`${anchorId}-core`} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: F, margin: "0 0 16px", background: "linear-gradient(120deg, #2563EB 0%, #1D4ED8 28%, #3B82F6 58%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Core Features
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
            {project.coreFeatures.map((cf, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 7 }} />
                <span style={{ fontSize: 14, color: "#374151", fontFamily: F, lineHeight: 1.6 }}>
                  <strong style={{ color: "#1E293B" }}>{cf.title}:</strong> {cf.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주요 페이지 */}
      {sections.keyPages !== false && safeProject.keyPages.length > 0 && (
        <div id={`${anchorId}-pages`} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: F, margin: "0 0 16px", background: "linear-gradient(120deg, #2563EB 0%, #1D4ED8 28%, #3B82F6 58%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Key Pages &amp; Features
          </h3>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
            background: "#F8FAFC", borderRadius: 16, padding: "20px 24px",
            border: "1px solid #E2E8F0",
          }}>
            {safeProject.keyPages.map((kp) => (
              <div key={kp.num} style={{ padding: "4px 0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 4 }}>
                  {kp.num}. {kp.title}
                </div>
                <p style={{ fontSize: 13, color: "#64748B", fontFamily: F, margin: 0, lineHeight: 1.6 }}>
                  {kp.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 개발 하이라이트 */}
      {sections.devHighlights !== false && safeProject.devHighlights.length > 0 && (
        <div id={`${anchorId}-dev`} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: F, margin: "0 0 16px", background: "linear-gradient(120deg, #2563EB 0%, #1D4ED8 28%, #3B82F6 58%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Development Highlights
          </h3>
          <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px 24px", border: "1px solid #E2E8F0" }}>
            {safeProject.devHighlights.map((dh, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < safeProject.devHighlights.length - 1 ? 10 : 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontSize: 14, color: "#374151", fontFamily: F, lineHeight: 1.65 }}>
                  <strong style={{ color: "#1E293B" }}>{dh.title}:</strong> {dh.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기술 구현 상세 */}
      {sections.techDetails !== false && safeProject.techDetails.length > 0 && (
        <div id={`${anchorId}-tech`} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, fontFamily: F, margin: "0 0 16px", background: "linear-gradient(120deg, #2563EB 0%, #1D4ED8 28%, #3B82F6 58%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Technical Implementation Details
          </h3>
          <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px 24px", border: "1px solid #E2E8F0" }}>
            {safeProject.techDetails.map((td, i) => (
              <div key={i} style={{ marginBottom: i < safeProject.techDetails.length - 1 ? 18 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
                  {td.title}:
                </div>
                {td.title === "Tech Stack" ? (
                  <div style={{ fontSize: 13, color: "#3B82F6", fontFamily: F, lineHeight: 2, flexWrap: "wrap", display: "flex", gap: "0 12px" }}>
                    {td.items.map((item, j) => (
                      <span key={j}>{item}</span>
                    ))}
                  </div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {td.items.map((item, j) => (
                      <li key={j} style={{ fontSize: 13, color: "#3B82F6", fontFamily: F, marginBottom: 4, lineHeight: 1.6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GitHub 버튼 */}
      <GithubLinkButton url={safeProject.githubUrl} />
    </div>
  );
}

/* ── 모듈형 프로젝트 섹션 ─────────────────────────────────── */
function ModularProjectSection({ project }) {
  const anchorId = `project-${project.id}`;
  const { sections } = project;

  return (
    <div id={anchorId} style={{ marginBottom: 64 }}>
      {/* 프로젝트 제목 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{project.emoji}</span>
        <h2 style={{ fontSize: 26, fontWeight: 900, fontFamily: F, margin: 0, lineHeight: 1.3, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {project.title}
        </h2>
      </div>
      <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: F, fontStyle: "italic", margin: "0 0 20px" }}>
        {project.subtitle}
      </p>

      {/* 소개 박스 */}
      {sections.description && (
        <div style={{
          background: "#F8FAFC", borderRadius: 16, padding: "20px 24px",
          border: "1px solid #E2E8F0", marginBottom: 24,
        }}>
          <p style={{ fontSize: 15, color: "#374151", fontFamily: F, lineHeight: 1.8, margin: 0 }}>
            {project.description}
          </p>
        </div>
      )}

      {/* 모듈들 */}
      {sections.modules && project.modules.map((mod) => (
        <div
          key={mod.num}
          id={`${anchorId}-module${mod.num}`}
          style={{
            background: "#F8FAFC", borderRadius: 16, padding: "22px 24px",
            border: "1px solid #E2E8F0", marginBottom: 20,
          }}
        >
          {/* 모듈 헤더 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{
              background: "#EEF2FF", border: "1px solid #C7D2FE",
              borderRadius: 8, padding: "3px 10px",
              fontSize: 11, fontWeight: 800, color: "#4338CA",
              fontFamily: F, letterSpacing: "0.06em",
            }}>
              MODULE {mod.num}
            </span>
            <h4 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F, margin: 0 }}>
              {mod.codeName} {mod.moduleName}
            </h4>
          </div>
          {/* Goal */}
          <p style={{ fontSize: 13, color: "#475569", fontFamily: F, fontStyle: "italic", lineHeight: 1.6, marginBottom: 14 }}>
            <em>Goal:</em> {mod.goal}
          </p>
          {/* KEY CAPABILITIES */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", fontFamily: F, letterSpacing: "0.08em", marginBottom: 8 }}>
            KEY CAPABILITIES:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mod.capabilities.map((cap, ci) => (
              <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontSize: 14, color: "#374151", fontFamily: F, lineHeight: 1.65 }}>
                  <strong style={{ color: "#1E293B" }}>{cap.title}:</strong> {cap.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* GitHub 버튼 */}
      <GithubLinkButton url={project.githubUrl} />
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────── */
export default function PortfolioProjectPreview() {
  const location = useLocation();
  const navigate = useNavigate();

  const fromEditor = location.state?.fromEditor || false;
  const singleProject = location.state?.project;
  const multiProjects = location.state?.projects;
  const sourceKey = location.state?.sourceKey;
  const sourceKeys = Array.isArray(location.state?.sourceKeys) ? location.state.sourceKeys : null;
  // 타인 프로필에서 넘어온 경우: 해당 유저의 portfolioItems(원본 DTO 배열)과 username을 받는다
  const passedItems = Array.isArray(location.state?.portfolioItems) ? location.state.portfolioItems : null;
  const targetUsername = location.state?.username || null;

  const [fetchedProject, setFetchedProject] = useState(null);
  const [fetchedProjects, setFetchedProjects] = useState(null);
  const [_loading, setLoading] = useState(!!sourceKey || !!sourceKeys);
  const [_error, setError] = useState(null);

  useEffect(() => {
    // 1) 타인 프로필에서 원본 items를 받은 경우: 네트워크 없이 그대로 사용
    if (passedItems && passedItems.length > 0) {
      const keyMatch = (it, k) => String(it.sourceKey ?? it.id) === String(k);
      if (sourceKeys && sourceKeys.length > 0) {
        const ordered = sourceKeys
          .map((k) => passedItems.find((it) => keyMatch(it, k)))
          .filter(Boolean)
          .map((it) => toPortfolioPreviewProject(it));
        setFetchedProjects(ordered.length > 0 ? ordered : passedItems.map(toPortfolioPreviewProject));
      } else if (sourceKey) {
        const found = passedItems.find((it) => keyMatch(it, sourceKey));
        setFetchedProject(toPortfolioPreviewProject(found || passedItems[0]));
      } else {
        setFetchedProjects(passedItems.map(toPortfolioPreviewProject));
      }
      setLoading(false);
      return;
    }

    // 2) username이 있으면 해당 유저의 공개 포트폴리오를 fetch 후 sourceKey(s)로 필터
    if (targetUsername) {
      let alive = true;
      setLoading(true);
      setError(null);
      portfolioApi.byUsername(targetUsername)
        .then((items) => {
          if (!alive) return;
          const list = Array.isArray(items) ? items : [];
          if (list.length === 0) { setFetchedProjects([]); return; }
          const keyMatch = (it, k) => String(it.sourceKey ?? it.id) === String(k);
          if (sourceKeys && sourceKeys.length > 0) {
            const ordered = sourceKeys
              .map((k) => list.find((it) => keyMatch(it, k)))
              .filter(Boolean)
              .map((it) => toPortfolioPreviewProject(it));
            setFetchedProjects(ordered.length > 0 ? ordered : list.map(toPortfolioPreviewProject));
          } else if (sourceKey) {
            const found = list.find((it) => keyMatch(it, sourceKey));
            setFetchedProject(toPortfolioPreviewProject(found || list[0]));
          } else {
            setFetchedProjects(list.map(toPortfolioPreviewProject));
          }
        })
        .catch((e) => {
          if (!alive) return;
          setError(e?.response?.data?.message || e?.message || "포트폴리오를 불러오지 못했습니다.");
        })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }

    // 3) 본인 포트폴리오(기존 동작): /me/by-source — targetUsername이 없을 때만 실행
    // 다중 프로젝트 fetch (Selected Projects에서 카드 클릭한 케이스)
    if (sourceKeys && sourceKeys.length > 0) {
      let alive = true;
      setLoading(true);
      setError(null);
      Promise.all(
        sourceKeys.map((k) => portfolioApi.getBySource(k).catch(() => null))
      )
        .then((items) => {
          if (!alive) return;
          const valid = items.filter(Boolean).map((it) => toPortfolioPreviewProject(it));
          setFetchedProjects(valid);
        })
        .catch((e) => {
          if (!alive) return;
          setError(e?.response?.data?.message || e?.message || "포트폴리오를 불러오지 못했습니다.");
        })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }

    // 단일 프로젝트 fetch
    if (!sourceKey) return;
    let alive = true;
    setLoading(true);
    setError(null);
    portfolioApi
      .getBySource(sourceKey)
      .then((item) => {
        if (!alive) return;
        setFetchedProject(toPortfolioPreviewProject(item));
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "포트폴리오를 불러오지 못했습니다.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sourceKey, sourceKeys?.join(","), targetUsername, passedItems?.length]);

  const projects = fetchedProjects && fetchedProjects.length > 0
    ? fetchedProjects
    : fetchedProject
      ? [fetchedProject]
      : singleProject
        ? [singleProject]
        : (multiProjects || (targetUsername ? [] : DEFAULT_PROJECTS));

  const visibleProjects = projects.filter(p => p.visible !== false);

  const scrollToProject = (projectId, anchor) => {
    const targetId = anchor
      ? `project-${projectId}-${anchor}`
      : `project-${projectId}`;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "white", fontFamily: F }}>
      <Header_partner />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 12px 80px" }}>

        {/* 뒤로가기 (에디터에서 온 경우) */}
        {fromEditor && (
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "1.5px solid #E2E8F0",
              borderRadius: 10, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: "pointer", fontFamily: F, marginBottom: 24,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
          >
            ← 편집으로 돌아가기
          </button>
        )}

        {/* 페이지 타이틀 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 4, height: 28, background: PRIMARY_GRAD, borderRadius: 2, flexShrink: 0 }} />
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1E293B", fontFamily: F, margin: 0 }}>Projects</h1>
        </div>

        {/* 2단 레이아웃 */}
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>

          {/* 왼쪽: QUICK LINKS 사이드바 */}
          <div style={{
            width: 300, flexShrink: 0,
            background: "white", borderRadius: 18,
            border: "1.5px solid #E2E8F0",
            padding: "20px 0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            position: "sticky", top: 88,
            maxHeight: "calc(100vh - 100px)", overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.12em", padding: "0 24px 12px", fontFamily: F }}>
              QUICK LINKS
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {visibleProjects.map((proj, pi) => (
                <div key={proj.id}>
                  {/* 프로젝트 항목 */}
                  <button
                    onClick={() => scrollToProject(proj.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: pi === 0 ? "8px 24px 4px" : "14px 24px 4px",
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: F,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>
                        {proj.emoji?.split(" ")[0]}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", lineHeight: 1.4 }}>
                        {pi + 1}. {proj.title.length > 34 ? proj.title.substring(0, 34) + "…" : proj.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, marginTop: 2, paddingLeft: 22 }}>
                      {proj.quickLinkLabel}
                    </div>
                  </button>
                  {/* 서브 링크 */}
                  <div style={{ paddingLeft: 48, paddingBottom: 8 }}>
                    {proj.quickLinkSubs?.map((sub, si) => {
                      const label = typeof sub === "string" ? sub : sub.label;
                      const anchor = typeof sub === "string"
                        ? sub.toLowerCase().replace(/ /g, "-").replace(/[&]/g, "").replace(/--/g, "-")
                        : sub.anchor;
                      return (
                        <button
                          key={si}
                          onClick={() => scrollToProject(proj.id, anchor)}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            background: "none", border: "none", cursor: "pointer",
                            padding: "4px 0",
                            fontSize: 12, color: "#60A5FA", fontFamily: F,
                            fontWeight: 500,
                            transition: "color 0.1s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = "#3B82F6"}
                          onMouseLeave={e => e.currentTarget.style.color = "#60A5FA"}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 오른쪽: 프로젝트 상세 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {visibleProjects.map((proj) => (
              proj.type === "modular"
                ? <ModularProjectSection key={proj.id} project={proj} />
                : <StandardProjectSection key={proj.id} project={proj} />
            ))}

            {/* 푸터 */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 24, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, margin: 0 }}>
                © 2024 ALPHA-HELIX. Built with passion for technology.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
