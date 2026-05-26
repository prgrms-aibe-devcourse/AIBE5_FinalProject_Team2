import React, { useState } from "react";
import {
  ChevronDown, ChevronUp, CheckCircle2, Search,
  FileText, Users, CreditCard, ShieldCheck, MessageSquare,
  Star, HelpCircle, BookOpen, Zap, PlayCircle,
} from "lucide-react";
import useStore from "../store/useStore";
import home2Img from "../assets/home2.png";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

/* ── 클라이언트 스텝 메타 (아이콘/색상만, 텍스트는 translations에서) ── */
const CLIENT_STEPS = [
  {
    step: 1,
    icon: <FileText size={22} color="#3b82f6" />,
    title: "회원가입 & 클라이언트 등록",
    desc: "ALPHA-HELIX에 가입 후 '클라이언트'로 등록합니다. 회사명, 담당자 정보, 원하는 서비스 분야를 입력하면 맞춤형 파트너 추천이 시작됩니다.",
    tips: ["이메일 또는 카카오 소셜 로그인 지원", "등록 즉시 파트너 검색 가능", "프로필 완성도 높을수록 추천 정확도 향상"],
    color: "#DBEAFE",
  },
  {
    step: 2,
    icon: <Search size={22} color="#8b5cf6" />,
    title: "프로젝트 등록 또는 파트너 탐색",
    desc: "원하는 IT 프로젝트를 직접 등록하거나, 솔루션 마켓에서 검증된 파트너의 패키지 솔루션을 탐색할 수 있습니다.",
    tips: ["AI 기반 프로젝트 요구사항 분석 지원", "카테고리/기술스택/예산 필터 제공", "포트폴리오로 파트너 역량 사전 확인"],
    color: "#EDE9FE",
  },
  {
    step: 3,
    icon: <MessageSquare size={22} color="#10b981" />,
    title: "파트너와 협의 & 계약 체결",
    desc: "관심 있는 파트너에게 프로젝트를 제안하고 채팅으로 상세 내용을 협의합니다. 합의 후 작업 범위·일정·금액을 포함한 계약서를 디지털로 체결합니다.",
    tips: ["실시간 채팅 메시지 & 파일 공유", "7개 항목 체계적 계약 협의", "전자 계약으로 법적 효력 보장"],
    color: "#D1FAE5",
  },
  {
    step: 4,
    icon: <CreditCard size={22} color="#f59e0b" />,
    title: "안전 결제 & 프로젝트 진행",
    desc: "ALPHA-HELIX 에스크로 결제로 선금을 안전하게 예치합니다. 파트너가 작업을 진행하는 동안 대시보드에서 진행 현황을 실시간으로 확인할 수 있습니다.",
    tips: ["에스크로 보호로 분쟁 시 환불 보장", "단계별 결제 옵션 선택 가능", "카드/계좌이체/가상계좌 지원"],
    color: "#FEF3C7",
  },
  {
    step: 5,
    icon: <ShieldCheck size={22} color="#ef4444" />,
    title: "납품 확인 & 리뷰 작성",
    desc: "결과물을 수령하고 만족스러우면 최종 승인 후 잔금을 지급합니다. 마지막으로 파트너에 대한 솔직한 리뷰를 남겨 다른 클라이언트에게 도움을 주세요.",
    tips: ["무제한 수정 요청 기간 협의 가능", "수령 후 14일 내 이의 제기 가능", "우수 파트너 리뷰는 공식 배지 수여"],
    color: "#FEE2E2",
  },
];

/* ── 파트너 이용 가이드 ──────────────────────────── */
const PARTNER_STEPS = [
  {
    step: 1,
    icon: <Users size={22} color="#3b82f6" />,
    title: "파트너 프로필 등록",
    desc: "기술 스택, 경력, 전문 분야를 상세히 작성합니다. 프로필이 완성도가 높을수록 AI 추천 시스템에서 클라이언트에게 먼저 노출됩니다.",
    tips: ["GitHub/노션 포트폴리오 링크 첨부", "전문 분야 최대 5개 선택", "ALPHA-HELIX 파트너 뱃지 획득 조건 안내"],
    color: "#DBEAFE",
  },
  {
    step: 2,
    icon: <BookOpen size={22} color="#8b5cf6" />,
    title: "포트폴리오 & 솔루션 등록",
    desc: "과거 프로젝트 포트폴리오를 업로드하고, 솔루션 마켓에 패키지 솔루션을 등록하여 수동적 수주 채널을 만드세요.",
    tips: ["이미지·영상·PDF 포트폴리오 지원", "솔루션 패키지 가격은 자유 설정", "소개 영상 등록 시 노출 우선순위 2배"],
    color: "#EDE9FE",
  },
  {
    step: 3,
    icon: <Zap size={22} color="#10b981" />,
    title: "프로젝트 제안 수신 & 검토",
    desc: "클라이언트가 프로젝트를 등록하면 조건에 맞는 프로젝트가 알림으로 도착합니다. 관심 있는 프로젝트에 제안서를 발송하세요.",
    tips: ["AI 매칭으로 내 스택과 맞는 프로젝트 자동 추천", "제안서 템플릿 제공", "평균 응답률 높은 파트너에게 추가 노출"],
    color: "#D1FAE5",
  },
  {
    step: 4,
    icon: <MessageSquare size={22} color="#f59e0b" />,
    title: "클라이언트 협의 & 계약",
    desc: "채팅으로 프로젝트 상세 내용을 협의하고, 작업 범위·일정·금액 등 7개 항목을 기반으로 계약을 체결합니다.",
    tips: ["계약 템플릿으로 빠른 협의 진행", "분쟁 예방을 위한 작업 범위 명확화 가이드 제공", "계약 후 자동 일정 관리 캘린더 생성"],
    color: "#FEF3C7",
  },
  {
    step: 5,
    icon: <CreditCard size={22} color="#ef4444" />,
    title: "프로젝트 수행 & 정산",
    desc: "대시보드에서 진행 상황을 클라이언트와 공유하며 프로젝트를 완료합니다. 납품 승인 후 2영업일 이내에 정산금이 지급됩니다.",
    tips: ["단계별 납품으로 중간 정산 가능", "정산 수수료 5.5% (VAT 포함)", "연간 수주 3,000만원 이상 시 수수료 할인"],
    color: "#FEE2E2",
  },
];

/* ── FAQ 아이템 ──────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      border: open ? "1.5px solid #3b82f6" : "1.5px solid #E5E7EB",
      overflow: "hidden",
      transition: "border 0.2s",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "18px 22px",
          background: "none", border: "none",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", fontFamily: F,
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left" }}>
          <HelpCircle size={17} color={open ? "#3b82f6" : "#9CA3AF"} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: open ? "#1E3A5F" : "#374151" }}>{q}</span>
        </div>
        {open ? <ChevronUp size={18} color="#3b82f6" style={{ flexShrink: 0 }} /> : <ChevronDown size={18} color="#9CA3AF" style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: "0 22px 18px 49px", fontSize: 14, color: "#6B7280", lineHeight: 1.75 }}>
          {a}
        </div>
      )}
    </div>
  );
}

/* ── Step 카드 ──────────────────────────── */
function StepCard({ item }) {
  return (
    <div style={{
      display: "flex",
      gap: 20,
      background: "white",
      borderRadius: 16,
      border: "1.5px solid #E5E7EB",
      padding: "24px 26px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      {/* 스텝 번호 + 아이콘 */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: item.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 8,
        }}>
          {item.icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>STEP {item.step}</span>
      </div>

      {/* 내용 */}
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>
          {item.title}
        </h3>
        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, margin: "0 0 14px" }}>
          {item.desc}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {item.tips.map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 size={13} color="#10B981" />
              <span style={{ fontSize: 12.5, color: "#374151", fontWeight: 500 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ──────────────────────────── */
export default function UsageGuide() {
  const { userRole } = useStore();
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState("client"); // "client" | "partner"
  const [faqSearch, setFaqSearch] = useState("");

  // 현재 언어의 번역 데이터와 메타(아이콘/색상)를 합쳐서 스텝 배열 생성
  const tr = translations[lang]?.usageGuide || translations.en?.usageGuide;
  const mergeSteps = (meta, trSteps) =>
    meta.map((m, i) => ({
      ...m,
      title: trSteps?.[i]?.title ?? m.title,
      desc:  trSteps?.[i]?.desc  ?? m.desc,
      tips:  trSteps?.[i]?.tips  ?? m.tips,
    }));
  const steps = activeTab === "client"
    ? mergeSteps(CLIENT_STEPS, tr?.clientSteps)
    : mergeSteps(PARTNER_STEPS, tr?.partnerSteps);

  const faqList = (tr?.faq?.questions || []).map((q, i) => ({
    q,
    a: tr?.faq?.answers?.[i] ?? "",
  }));

  const filteredFaq = faqList.filter(f =>
    !faqSearch || f.q.includes(faqSearch) || f.a.includes(faqSearch)
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: F }}>
      {/* 히어로 */}
      <div style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.01) 100%), url(${home2Img}) center/cover no-repeat`,
        padding: "80px 40px 72px",
        textAlign: "center",
      }}>
        <div style={{
          maxWidth: 920,
          margin: "0 auto",
          background: "rgba(255,255,255,0.64)",
          border: "1px solid rgba(255,255,255,0.86)",
          borderRadius: 20,
          padding: "24px 24px 22px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}>

          <h1 style={{
            fontSize: 34, fontWeight: 900, color: "#0F172A", margin: "0 0 14px", lineHeight: 1.3,
          }}>
            {t("usageGuide.heroTitle")}
          </h1>
          <p style={{ color: "#334155", fontSize: 16, margin: 0, fontWeight: 600 }}>
            {t("usageGuide.heroSubtitle")}
          </p>

          {/* 빠른 접근 카드 */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 16,
            marginTop: 24, flexWrap: "wrap",
          }}>
            {[
              { icon: <PlayCircle size={18} />, label: t("usageGuide.quickCards.startVideo"), sub: t("usageGuide.quickCards.duration") },
              { icon: <FileText size={18} />, label: t("usageGuide.quickCards.contractGuide"), sub: t("usageGuide.quickCards.pdfDownload") },
              { icon: <Star size={18} />, label: t("usageGuide.quickCards.partnerTips"), sub: t("usageGuide.quickCards.bestCases") },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.58)",
                border: "1px solid rgba(148,163,184,0.30)",
                borderRadius: 12, padding: "14px 22px",
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                transition: "background 0.15s",
              }}>
                <span style={{ color: "#2563EB" }}>{item.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 사이드바 + 메인 콘텐츠 */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px", display: "flex", gap: 32 }}>
        <UsageGuideSidebar />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: 48 }}>
          {/* 탭 선택 */}
          <div style={{
            background: "white",
            borderRadius: 16,
            border: "1.5px solid #E5E7EB",
            display: "flex",
            overflow: "hidden",
          }}>
            {[
              { key: "client", label: t("usageGuide.tabs.client"), sub: t("usageGuide.tabs.clientDesc") },
              { key: "partner", label: t("usageGuide.tabs.partner"), sub: t("usageGuide.tabs.partnerDesc") },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "20px 40px",
                  background: activeTab === tab.key ? "#EFF6FF" : "white",
                  border: "none",
                  borderBottom: activeTab === tab.key ? "3px solid #3b82f6" : "3px solid transparent",
                  cursor: "pointer",
                  fontFamily: F,
                  textAlign: "center",
                }}
              >
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: activeTab === tab.key ? "#3b82f6" : "#374151",
                }}>{tab.label}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{tab.sub}</div>
              </button>
            ))}
          </div>

          {/* 단계별 가이드 */}
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>
              {activeTab === "client" ? t("usageGuide.howToUse.clientTitle") : t("usageGuide.howToUse.partnerTitle")}
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 28px" }}>
              {t("usageGuide.howToUse.desc")}
            </p>

            {/* 진행 바 */}
            <div style={{
              display: "flex", alignItems: "center",
              marginBottom: 36, overflowX: "auto", paddingBottom: 4,
            }}>
              {steps.map((s, idx) => (
                <React.Fragment key={s.step}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    minWidth: 60,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "linear-gradient(135deg, #60a5fa, #6366f1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontSize: 13, fontWeight: 800,
                    }}>{s.step}</div>
                    <span style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: "center", maxWidth: 56 }}>
                      {s.title.split(" ")[0]}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: "#E5E7EB", minWidth: 30 }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 스텝 카드 목록 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {steps.map(item => (
                <StepCard key={item.step} item={item} />
              ))}
            </div>
          </div>

          {/* FAQ 섹션 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <HelpCircle size={22} color="#3b82f6" />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>{t("usageGuide.faq.title")}</h2>
            </div>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px" }}>
              {t("usageGuide.faq.subtitle")}
            </p>

            {/* FAQ 검색 */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <Search size={16} color="#9CA3AF" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder={t("usageGuide.faq.placeholder")}
                style={{
                  width: "100%", padding: "12px 16px 12px 40px",
                  borderRadius: 10, border: "1.5px solid #E5E7EB",
                  fontSize: 14, fontFamily: F, background: "#F9FAFB",
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredFaq.length > 0 ? filteredFaq.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              )) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                  <HelpCircle size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 14 }}>{t("usageGuide.faq.noResult")}</p>
                </div>
              )}
            </div>

            {/* 고객센터 배너 */}
            <div style={{
              marginTop: 40,
              background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
              border: "1px solid #DBEAFE",
              borderRadius: 16,
              padding: "28px 32px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 48,
            }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#1E3A5F", margin: "0 0 6px" }}>
                  {t("usageGuide.support.title")}
                </p>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
                  {t("usageGuide.support.hours")}
                </p>
              </div>
              <button style={{
                padding: "12px 24px",
                background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                color: "white", border: "none",
                borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: F,
              }}>
                {t("usageGuide.support.contact")}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
