import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AppShell from "./components/shell/AppShell";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
function WithGoogle({ children }) {
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

/** /partner_* 경로를 /client_* 로 보낼 때 쿼리스트링·해시까지 보존 */
function RedirectKeepQuery({ to }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.search}${loc.hash}`} replace />;
}

/**
 * AppShell 을 라우트 그룹의 부모로 두면, 그 안에서 navigate 해도
 * 사이드바 / TopBar / 채팅 도크 인스턴스가 언마운트되지 않아
 * 채팅창 열어둔 상태가 유지된다 (vscode 동작).
 */
function ShelledLayout() {
  return (
    <ThemeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </ThemeProvider>
  );
}
import ChatBot from "./components/ChatBot";
import Footer from "./components/ui/Footer";

// 페이지 컴포넌트를 lazy load → 라우트별 청크 분리, 초기 번들 최소화
const LandingPage           = lazy(() => import("./pages/LandingPage"));
const Partner_Home          = lazy(() => import("./pages/Partner_Home"));
const Home                  = lazy(() => import("./pages/Home"));
const Login                 = lazy(() => import("./pages/Login"));
const SolutionMarket        = lazy(() => import("./pages/SolutionMarket"));
const UsageGuide            = lazy(() => import("./pages/UsageGuide"));
const Pricing               = lazy(() => import("./pages/Pricing"));
const SubscriptionSuccess   = lazy(() => import("./pages/SubscriptionSuccess"));
const SubscriptionFail      = lazy(() => import("./pages/SubscriptionFail"));
const SubscriptionManage    = lazy(() => import("./pages/SubscriptionManage"));
const Signup                = lazy(() => import("./pages/Signup"));
const OAuthKakaoCallback    = lazy(() => import("./pages/OAuthKakaoCallback"));
const Mypage                = lazy(() => import("./pages/Mypage"));
const Loading               = lazy(() => import("./pages/Loading"));
const PartnerRegister       = lazy(() => import("./pages/PartnerRegister"));
const ClientRegister        = lazy(() => import("./pages/ClientRegister"));
const Client_Home           = lazy(() => import("./pages/Client_Home"));
const PartnerSearch         = lazy(() => import("./pages/PartnerSearch"));
const ClientSearch          = lazy(() => import("./pages/ClientSearch"));
const ProjectSearch         = lazy(() => import("./pages/ProjectSearch"));
const PartnerProfile        = lazy(() => import("./pages/PartnerProfile"));
const Client_Profile        = lazy(() => import("./pages/Client_Profile"));
const Partner_Portfolio     = lazy(() => import("./pages/Partner_Portfolio"));
const Client_Portfolio      = lazy(() => import("./pages/Client_Portfolio"));
const PortfolioDetailEditor = lazy(() => import("./pages/PortfolioDetailEditor"));
const PortfolioProjectPreview = lazy(() => import("./pages/PortfolioProjectPreview"));
const ProjectRegister       = lazy(() => import("./pages/ProjectRegister"));
const AIchatProject         = lazy(() => import("./pages/AIchatProject"));
const AIchatProfile         = lazy(() => import("./pages/AIchatProfile"));
const AIchatPortfolio       = lazy(() => import("./pages/AIchatPortfolio"));
const PartnerDashboard      = lazy(() => import("./pages/PartnerDashboard"));
const ClientDashboard       = lazy(() => import("./pages/ClientDashboard"));
const SolutionDetail        = lazy(() => import("./pages/SolutionDetail"));
const FindPassword          = lazy(() => import("./pages/FindPassword"));
const UsageGuide_Portfolio  = lazy(() => import("./pages/UsageGuide_Portfolio"));
const PartnerProfileView    = lazy(() => import("./pages/PartnerProfileView"));
const ClientProfileView     = lazy(() => import("./pages/ClientProfileView"));
const UsageGuide_Matching   = lazy(() => import("./pages/UsageGuide_Matching"));
const UsageGuide_Contract   = lazy(() => import("./pages/UsageGuide_Contract"));
const UsageGuide_Policy         = lazy(() => import("./pages/UsageGuide_Policy"));
const UsageGuide_ServicePolicy  = lazy(() => import("./pages/UsageGuide_ServicePolicy"));
const Onboarding                = lazy(() => import("./pages/Onboarding"));
const StreamChatPage        = lazy(() => import("./pages/StreamChatPage"));
const PrivacyPolicy         = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService        = lazy(() => import("./pages/TermsOfService"));
const TossPaymentSuccess    = lazy(() => import("./pages/TossPaymentSuccess"));
const TossPaymentFail       = lazy(() => import("./pages/TossPaymentFail"));
const BrokerSettings        = lazy(() => import("./pages/BrokerSettings"));
const AnalyticsLab          = lazy(() => import("./pages/AnalyticsLab"));
const WorkHome              = lazy(() => import("./pages/WorkHome"));
const StrategyWorkspace     = lazy(() => import("./pages/StrategyWorkspace"));
const VisionBoard           = lazy(() => import("./pages/VisionBoard"));
const NotificationsPage     = lazy(() => import("./pages/NotificationsPage"));

// ─── Alpha-Helix 세계 (전용 쉜 + 테마 + 8 MVP 기능)
import { ThemeProvider } from "./alpha/ThemeContext";
const AlphaShell      = lazy(() => import("./alpha/AlphaShell"));
const AlphaWorkspaceList = lazy(() => import("./alpha/WorkspaceList"));
const AlphaAccountPage   = lazy(() => import("./alpha/AccountPage"));
const AlphaProposalsPage = lazy(() => import("./alpha/ProposalsPage"));
const AlphaWorkspace  = lazy(() => import("./alpha/Workspace"));
const AlphaDeveloperLab = lazy(() => import("./alpha/DeveloperLab"));
const AlphaGuide        = lazy(() => import("./pages/AlphaGuide"));


function App() {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  // Footer 는 랜딩만 노출 (Alpha-Helix 설계 편한 공간 유지)
  const showFooter = false;
  // AppShell 이 RightChatDock 을 가지므로 전역 ChatBot 비활성화
  const showGlobalChat = false;

  return (
    <>
      <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontSize:14, color:"#6B7280" }}>Loading...</div>}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/partner_home" element={<RedirectKeepQuery to="/client_home" />} />
        {/* 셚 레이아웃: 네비게이션해도 LeftSidebar/TopBar/Chat 상태 유지 */}
        <Route element={<ShelledLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/workhome" element={<WorkHome />} />
          <Route path="/mypage" element={<Mypage />} />
          <Route path="/subscription/manage" element={<SubscriptionManage />} />
          <Route path="/vision_board" element={<VisionBoard />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/strategy" element={<StrategyWorkspace />} />
          <Route path="/strategy/:id" element={<StrategyWorkspace />} />
          <Route path="/client_home" element={<Client_Home />} />
          {/* 이용 가이드 계열 — LeftSidebar 공유 */}
          <Route path="/usage_guide" element={<UsageGuide />} />
          <Route path="/usage_guide/portfolio" element={<UsageGuide_Portfolio />} />
          <Route path="/usage_guide/matching" element={<UsageGuide_Matching />} />
          <Route path="/usage_guide/contract" element={<UsageGuide_Contract />} />
          <Route path="/usage_guide/policy" element={<UsageGuide_Policy />} />
          <Route path="/usage_guide/service_policy" element={<UsageGuide_ServicePolicy />} />
          <Route path="/alpha_guide" element={<AlphaGuide />} />
          {/* Alpha-Helix 세계 — 동일한 셚 공유 */}
          <Route path="/alpha" element={<AlphaShell />}>
            <Route index element={<AlphaWorkspaceList />} />
            <Route path="w/:id" element={<AlphaWorkspace />} />
            <Route path="account" element={<AlphaAccountPage />} />
            <Route path="proposals" element={<AlphaProposalsPage />} />
            <Route path="developer" element={<AlphaDeveloperLab />} />
          </Route>
        </Route>
        <Route path="/login" element={<WithGoogle><Login /></WithGoogle>} />
        <Route path="/solution_market" element={<SolutionMarket />} />
        <Route path="/solution_detail" element={<SolutionDetail />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/subscription/fail" element={<SubscriptionFail />} />
        <Route path="/signup" element={<WithGoogle><Signup /></WithGoogle>} />
        <Route path="/oauth/kakao/callback" element={<OAuthKakaoCallback />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/partner_register" element={<RedirectKeepQuery to="/client_register" />} />
        <Route path="/client_register" element={<ClientRegister />} />
        <Route path="/settings/broker" element={<BrokerSettings />} />
        <Route path="/analytics" element={<AnalyticsLab />} />
        <Route path="/partner_search" element={<RedirectKeepQuery to="/client_search" />} />
        <Route path="/client_search" element={<ClientSearch />} />
        <Route path="/partner_profile_view" element={<RedirectKeepQuery to="/client_profile_view" />} />
        <Route path="/client_profile_view" element={<ClientProfileView />} />
        <Route path="/project_search" element={<ProjectSearch />} />
        <Route path="/partner_profile" element={<RedirectKeepQuery to="/client_profile" />} />
        <Route path="/client_profile" element={<Client_Profile />} />
        <Route path="/partner_portfolio" element={<RedirectKeepQuery to="/client_portfolio" />} />
        <Route path="/client_portfolio" element={<Client_Portfolio />} />
        <Route path="/portfolio_detail_editor" element={<PortfolioDetailEditor />} />
        <Route path="/portfolio_project_preview" element={<PortfolioProjectPreview />} />
        <Route path="/project_register" element={<ProjectRegister />} />
        <Route path="/ai_chat_project" element={<AIchatProject />} />
        <Route path="/ai_chat_profile" element={<AIchatProfile />} />
        <Route path="/aichat_portfolio" element={<AIchatPortfolio />} />
        <Route path="/partner_dashboard" element={<RedirectKeepQuery to="/client_dashboard" />} />
        <Route path="/client_dashboard" element={<ClientDashboard />} />
        <Route path="/find-password" element={<FindPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/chat" element={<StreamChatPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/payments/toss/success" element={<TossPaymentSuccess />} />
        <Route path="/payments/toss/fail" element={<TossPaymentFail />} />
        </Routes>
      </Suspense>
      {showFooter && <Footer />}
      {!isLandingPage && showGlobalChat && <ChatBot />}
    </>
  );
}

export default App;
