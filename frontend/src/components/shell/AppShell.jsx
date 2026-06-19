import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LeftSidebar from "./LeftSidebar";
import TopBar from "./TopBar";
import RightChatDock from "./RightChatDock";
import GuideDock from "./GuideDock";
import Footer from "../ui/Footer";
import TutorialOverlay from "../tutorial/TutorialOverlay";
import api from "../../api/axios";
import useStore from "../../store/useStore";

/**
 * VS Code 스타일 셸 wrapper.
 * - 좌측 52px Activity Bar
 * - 상단 44px (검색 + AI 토글)
 * - 좌측에 옵션 가이드 패널 (⋯ 토글)
 * - 우측 도크 채팅 (TopBar 의 AI 버튼이 토글, vscode 처럼 화면 분할)
 */
export default function AppShell({ children, hideChat = false }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const isDeveloper = loc.pathname.startsWith("/alpha/developer") || loc.pathname.startsWith("/vision_board");
  const isWorkspace = loc.pathname.startsWith("/alpha/w/");

  /* ── 앱 기동 시 세션 검증: 저장된 로그인 상태가 있으면 refresh 시도 ── */
  useEffect(() => {
    const { dbId: storedId, clearLogin, clearUser } = useStore.getState();
    if (!storedId) return;
    api.post("/auth/refresh").catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        clearLogin();
        clearUser();
        try { localStorage.removeItem("accessToken"); } catch {}
        navigate("/home", { replace: true });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [chatOpen, setChatOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [topCollapsed, setTopCollapsed] = useState(false);

  const toggleSidebar = () => setSidebarExpanded(o => {
    const next = !o;
    try { window.dispatchEvent(new CustomEvent("alpha:sidebar-changed", { detail: { expanded: next } })); } catch {}
    return next;
  });

  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener("alpha:open-chat", handler);
    return () => window.removeEventListener("alpha:open-chat", handler);
  }, []);

  useEffect(() => {
    const handler = () => toggleSidebar();
    window.addEventListener("alpha:toggle-sidebar", handler);
    return () => window.removeEventListener("alpha:toggle-sidebar", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.classList.toggle("chat-open", chatOpen);
    return () => document.body.classList.remove("chat-open");
  }, [chatOpen]);
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("aiDockWidth") || "0", 10);
    return saved >= 280 && saved <= 570 ? saved : 380;
  });
  const guideWidth = 320;

  const handleResize = (w) => {
    setChatWidth(w);
    localStorage.setItem("aiDockWidth", String(w));
  };

  const sidebarW = sidebarExpanded ? 240 : 52;
  const leftOffset = sidebarW + (guideOpen ? guideWidth : 0);
  const rightOffset = !hideChat && chatOpen ? chatWidth : 0;

  return (
    <div style={{ minHeight: "calc(100vh / var(--app-zoom, 1.1))", background: isDeveloper ? "#0f1117" : "#F8FAFC", ...(isDeveloper || isWorkspace ? { height: "calc(100vh / var(--app-zoom, 1.1))", overflow: "hidden" } : {}) }}>
      <LeftSidebar
        expanded={sidebarExpanded}
        onToggleExpanded={toggleSidebar}
        guideOpen={guideOpen}
        onToggleGuide={() => setGuideOpen(o => !o)}
        topCollapsed={topCollapsed}
        onExpandTop={() => setTopCollapsed(false)}
      />
      <GuideDock open={guideOpen} onClose={() => setGuideOpen(false)} width={guideWidth} sidebarWidth={sidebarW} />
      {!topCollapsed && (
        <TopBar
          onToggleChat={() => setChatOpen(o => !o)}
          chatOpen={chatOpen}
          rightOffset={rightOffset}
          leftOffset={leftOffset}
          onCollapse={() => setTopCollapsed(true)}
        />
      )}
      <main style={{
        "--alpha-top-h": topCollapsed ? "0px" : "44px",
        boxSizing: "border-box",
        ...(isWorkspace || isDeveloper ? {
          marginLeft: leftOffset,
          paddingTop: topCollapsed ? 0 : 44,
          marginRight: rightOffset,
          height: "calc(100vh / var(--app-zoom, 1.1))",
          overflow: "hidden",
          transition: "margin-left 0.18s ease, margin-right 0.18s ease",
        } : {
          position: "fixed",
          top: topCollapsed ? 0 : 44,
          left: leftOffset,
          right: rightOffset,
          bottom: 0,
          overflowY: "auto",
          transition: "top 0.18s ease, left 0.18s ease, right 0.18s ease",
        }),
      }}>
        {children}
        {!isDeveloper && !isWorkspace && <Footer />}
      </main>
      {!hideChat && (
        <RightChatDock
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          width={chatWidth}
          onResize={handleResize}
        />
      )}
      <TutorialOverlay />
    </div>
  );
}
