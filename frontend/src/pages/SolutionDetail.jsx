import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Clock, CheckCircle2, MessageSquare, Bookmark, Share2, Info, Award, Calendar, ChevronDown, Bolt } from "lucide-react";
import AppHeader from "../components/AppHeader";

const F = "'Pretendard', sans-serif";
const FH = "'Plus Jakarta Sans', 'Pretendard', sans-serif";

/* ── Dummy Data ── */
const SOLUTION = {
  title: "AI 기반 콘텐츠 매칭 플랫폼",
  category: "중개 플랫폼: 구인구직",
  rating: 4.9,
  reviewCount: 128,
  updated: "2024년 10월 업데이트",
  heroImage: "https://raw.githubusercontent.com/jinhyenkim01/teasdfsdraehr/refs/heads/main/Gemini_Generated_Image_kvejuckvejuckvej.png",
  description: `이 솔루션은 인공지능 기반의 콘텐츠 매칭 엔진을 핵심으로, 기업의 콘텐츠 제작·유통·분석 전 과정을 자동화합니다.
자연어 처리(NLP)와 딥러닝 알고리즘을 활용하여 콘텐츠 소비 패턴을 분석하고, 최적의 콘텐츠를 적시에 적합한 사용자에게 전달합니다.`,
  techStack: ["React", "Node.js", "Python", "TensorFlow", "AWS", "PostgreSQL", "Docker", "Kubernetes"],
};

const PACKAGE_DATA = {
  standard: {
    price: "₩25,000,000~",
    description: "핵심 기능을 갖춘 스타트업용 실속형 패키지",
    period: "예상 기간: 4주",
    features: ["AI 콘텐츠 매칭 엔진 라이선스", "클라우드 인프라 구축 지원", "관리자 대시보드 커스텀 (기본)", "기술 지원 (6개월)"],
  },
  professional: {
    price: "₩55,000,000~",
    description: "고도화된 분석 기능과 최적화가 포함된 중견기업용",
    period: "예상 기간: 8주",
    features: ["Standard의 모든 기능 포함", "실시간 협업 필터링 알고리즘", "고성능 GPU 인프라 최적화", "보안 프로토콜 강화 (ISO 준수)", "기술 지원 (1년)"],
  },
  enterprise: {
    price: "별도 문의",
    description: "대규모 트래픽 및 커스텀 요구사항 대응",
    period: "예상 기간: 협의 필요",
    features: ["Professional의 모든 기능 포함", "커스텀 LLM 모델 미세 조정", "온프레미스 구축 지원", "24/7 전담 매니저 기술 지원", "무제한 사용자 라이선스"],
  },
};

const PORTFOLIOS = [
  {
    title: "글로벌 이커머스 AI 추천 시스템",
    desc: "대규모 상품 카탈로그에서 사용자 행동 패턴을 분석하여 개인화된 상품을 추천하는 AI 시스템을 구축했습니다.",
    tags: ["Python", "TensorFlow", "AWS"],
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA3qSXdJ_1jOb3BcN1o7vSJelxnt1J5Z0Vre62XlqJhTMfjOIiTdovK1eUeENOQO3C33A3pIqS9yBJh3tU64coftb4Y-OlIwL33O0aKzMqP4m6R2WX9CBgk1OcS3y1SsQgcW2U3AvQu8X6x3zFcUvR5cJ1wVFQfPVKt2Sxw9Q_uUCHCjfug-gHV0Hz6QA5nJ6dlIfqDEk4IvPjRE6zxz-g8qWdRaiZxrVO4UK7ypQvFt9KSpgX4nKWjcVt8thcKRPMRfMB-63Tk-k4",
  },
  {
    title: "실시간 콘텐츠 큐레이션 엔진",
    desc: "뉴스, 블로그, SNS 등 다양한 소스에서 실시간으로 콘텐츠를 수집·분류·추천하는 큐레이션 플랫폼을 개발했습니다.",
    tags: ["React", "Node.js", "ElasticSearch"],
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBnQzkyIlK3TvSbblFmJz9n4Gyc3RA9XWAyYFjRQ9p99seYHiDYWfYZQTNpc27xSNOzW1UB72pwtxsbF6QNV2o07IC-q1pEo-eajG21vFzSdfO7MbI8XPL_A12bqO7ocWHr3-Et1Or1Np8WfaE_nTepQNPnyac6Ap_UH3zVjZuEIM1Hp07ALZ90MFwMOYEGEFYn-pXfqOz3MtQ69TAjvtRWb-3Oo3DRYvZmGuzi8xuVednXXmHdtHtovOjpO_iruWe_hUL5f1pM8wE",
  },
];

const REVIEWS = [
  { user: "김태현", company: "스타트업 A", rating: 5, date: "2024.09.15", text: "매우 만족스러운 결과물이었습니다. 기술력이 뛰어나고 커뮤니케이션도 원활했습니다." },
  { user: "이수진", company: "중견기업 B", rating: 5, date: "2024.08.22", text: "프로젝트 일정을 정확히 준수하며 높은 품질의 결과물을 제공했습니다. 추가 요청사항도 빠르게 반영해주었습니다." },
  { user: "박민수", company: "대기업 C", rating: 4, date: "2024.07.10", text: "전반적으로 만족스러웠으나 초기 설정 과정에서 약간의 지연이 있었습니다. 그 외에는 모든 부분이 훌륭했습니다." },
];

const STEPS = [
  { num: 1, title: "도입 신청", desc: "홈페이지에서 도입 신청 폼을 제출해주세요. 담당 매니저가 확인 후 24시간 이내에 연락드립니다." },
  { num: 2, title: "요구사항 분석", desc: "전담 매니저와 함께 비즈니스 요구사항을 분석하고 최적의 솔루션 구성을 설계합니다." },
  { num: 3, title: "계약 및 착수", desc: "서비스 범위와 일정을 확정하고 계약을 체결합니다. 이후 프로젝트가 시작됩니다." },
  { num: 4, title: "개발 및 테스트", desc: "애자일 방법론 기반으로 개발을 진행하며, 정기적으로 진행 상황을 공유합니다." },
  { num: 5, title: "런칭 및 사후 지원", desc: "최종 검수 후 서비스를 런칭하고, 안정화 기간 동안 집중 지원을 제공합니다." },
];

const FAQS = [
  { q: "추가 기능 개발, 맞춤 개발도 가능한가요?", a: "네, 가능합니다. ALPHA-HELIX는 기업별 요구사항에 맞춘 커스터마이징 및 추가 기능 개발을 지원합니다. [커스텀 요청] 버튼을 통해 상세 내용을 남겨주시면 담당 매니저가 확인 후 상담을 도와드립니다." },
  { q: "구매 이후 절차가 어떻게 되나요?", a: "상담 신청 이후 ALPHA-HELIX 매니저가 연락을 드려 미팅 일정을 조율합니다. 파트너와 상세 요구사항을 논의하고 계약을 체결한 뒤 프로젝트가 시작됩니다. 모든 과정은 안심 계약 시스템을 통해 투명하게 관리됩니다." },
];

const TABS = [
  { id: "intro", label: "솔루션 소개" },
  { id: "portfolio", label: "포트폴리오" },
  { id: "pricing", label: "금액 정보" },
  { id: "review", label: "리뷰" },
  { id: "process", label: "진행 절차" },
  { id: "faq", label: "FAQ" },
];

const SCROLL_OFFSET = 140; 

export default function SolutionDetail() {
  const _navigate = useNavigate();
  const [activePackage, setActivePackage] = useState("standard");
  const [openFaqIndex, setOpenIndex] = useState(null);
  const [activeSection, setActiveSection] = useState("intro");
  
  const sectionRefs = {
    intro: useRef(null),
    portfolio: useRef(null),
    pricing: useRef(null),
    review: useRef(null),
    process: useRef(null),
    faq: useRef(null),
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: `-${SCROLL_OFFSET + 20}px 0px -70% 0px`,
      threshold: 0,
    };

    const callback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);
    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const handleTabClick = (sectionId) => {
    const element = sectionRefs[sectionId].current;
    if (element) {
      setActiveSection(sectionId);
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const sectionStyle = {
    scrollMarginTop: SCROLL_OFFSET + "px",
  };

  const pkg = PACKAGE_DATA[activePackage];

  return (
    <div style={{ fontFamily: F, background: "#f7f9fb", minHeight: "100vh" }}>
      <AppHeader />
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
            <section>
              <div style={{ borderRadius: 16, overflow: "hidden", height: 320, background: "#eceef0", marginBottom: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <img src={SOLUTION.heroImage} alt={SOLUTION.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#004ac6", letterSpacing: 1, textTransform: "uppercase" }}>
                {SOLUTION.category}
              </span>
              <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: FH, margin: "8px 0 12px", letterSpacing: -0.5 }}>
                {SOLUTION.title}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#6B7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={16} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontWeight: 700, color: "#111827" }}>{SOLUTION.rating}</span>
                  <span>({SOLUTION.reviewCount}개 리뷰)</span>
                </span>
                <span>•</span>
                <span>{SOLUTION.updated}</span>
              </div>
            </section>

            <div style={{
              position: "sticky", top: 58, zIndex: 40,
              background: "rgba(247,249,251,0.97)", backdropFilter: "blur(12px)",
              display: "flex", gap: 24, borderBottom: "1px solid rgba(195,198,215,0.3)",
              overflowX: "auto", margin: "0 -4px",
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    padding: "16px 4px", fontSize: 14, fontWeight: 700,
                    color: activeSection === tab.id ? "#004ac6" : "#4B5563",
                    background: "none", border: "none",
                    borderBottom: activeSection === tab.id ? "2px solid #004ac6" : "2px solid transparent",
                    cursor: "pointer", whiteSpace: "nowrap", fontFamily: F,
                    transition: "all 0.2s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <section id="intro" ref={sectionRefs.intro} style={sectionStyle}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                솔루션 소개
              </h3>
              <p style={{ fontSize: 16, color: "#4B5563", lineHeight: 1.8, whiteSpace: "pre-line" }}>
                {SOLUTION.description}
              </p>
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#111827" }}>기술 스택</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SOLUTION.techStack.map((t) => (
                    <span key={t} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "#EFF6FF", color: "#2563EB" }}>{t}</span>
                  ))}
                </div>
              </div>
            </section>

            <section id="portfolio" ref={sectionRefs.portfolio} style={sectionStyle}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                포트폴리오
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
                {PORTFOLIOS.map((p, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 20, overflow: "hidden", border: "1px solid #F3F4F6" }}>
                    <div style={{ aspectRatio: "16/10", overflow: "hidden" }}>
                      <img src={p.image} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: 20 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{p.title}</h4>
                      <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: 12 }}>{p.desc}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {p.tags.map((t) => (
                          <span key={t} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#F3F4F6", color: "#6B7280" }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="pricing" ref={sectionRefs.pricing} style={sectionStyle}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                금액 정보
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                {Object.entries(PACKAGE_DATA).map(([key, pkg]) => (
                  <div key={key} style={{ background: "white", borderRadius: 16, padding: 20, border: key === "professional" ? "2px solid #2563EB" : "1px solid #F3F4F6", position: "relative" }}>
                    {key === "professional" && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(90deg, #42C8F7, #2563EB)", color: "white", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>추천</div>}
                    <h4 style={{ fontSize: 12, fontWeight: 800, color: "#004ac6", textTransform: "uppercase", marginBottom: 6 }}>{key}</h4>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, fontFamily: FH }}>{pkg.price}</div>
                    <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>{pkg.description}</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {pkg.features.map((f, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                          <CheckCircle2 size={14} color="#004ac6" style={{ marginTop: 2, flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section id="review" ref={sectionRefs.review} style={sectionStyle}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                리뷰
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {REVIEWS.map((r, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 20, padding: 24, border: "1px solid #F3F4F6" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#2563EB" }}>{r.user[0]}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.user}</div>
                          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{r.company}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{r.date}</span>
                    </div>
                    <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={16} fill={s <= r.rating ? "#F59E0B" : "none"} color={s <= r.rating ? "#F59E0B" : "#E5E7EB"} />)}
                    </div>
                    <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.7 }}>{r.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="process" ref={sectionRefs.process} style={sectionStyle}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                진행 절차
              </h3>
              {STEPS.map((step, i) => (
                <div key={step.num} style={{ display: "flex", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #42C8F7, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 14 }}>{step.num}</div>
                    {i < STEPS.length - 1 && <div style={{ width: 2, flex: 1, background: "#E5E7EB", minHeight: 30 }} />}
                  </div>
                  <div style={{ paddingBottom: 24 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{step.title}</h4>
                    <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </section>

            <section id="faq" ref={sectionRefs.faq} style={{ ...sectionStyle, marginBottom: 40 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: FH, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 4, height: 28, background: "#004ac6", borderRadius: 999 }} />
                자주 묻는 질문
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {FAQS.map((faq, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 16, border: "1px solid #F3F4F6", overflow: "hidden" }}>
                    <button onClick={() => setOpenIndex(openFaqIndex === i ? null : i)} style={{ width: "100%", padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", background: "none", cursor: "pointer", fontFamily: F }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: "#004ac6", fontWeight: 800 }}>Q</span>
                        <span style={{ fontSize: 15, fontWeight: 700, textAlign: "left" }}>{faq.q}</span>
                      </div>
                      <ChevronDown size={20} color="#9CA3AF" style={{ transform: openFaqIndex === i ? "rotate(180deg)" : "none", transition: "0.3s" }} />
                    </button>
                    {openFaqIndex === i && (
                      <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F9FAFB", fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>
                        <div style={{ display: "flex", gap: 12, paddingTop: 12 }}>
                          <span style={{ color: "#6B7280", fontWeight: 800 }}>A</span>
                          <p style={{ margin: 0 }}>{faq.a}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ position: "sticky", top: 70, height: "fit-content" }}>
            <div style={{ background: "white", borderRadius: 20, padding: 20, border: "1px solid rgba(195,198,215,0.3)", boxShadow: "0 10px 40px rgba(37,99,235,0.05)", marginBottom: 16 }}>
              <div style={{ display: "flex", padding: 3, background: "#eceef0", borderRadius: 14, gap: 3, marginBottom: 20 }}>
                {["standard", "professional", "enterprise"].map((key) => (
                  <button key={key} onClick={() => setActivePackage(key)} style={{ flex: 1, padding: "10px 0", fontSize: 11, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", background: activePackage === key ? "white" : "transparent", color: activePackage === key ? "#004ac6" : "#6B7280", boxShadow: activePackage === key ? "0 2px 8px rgba(0,0,0,0.06)" : "none" }}>{key.toUpperCase()}</button>
                ))}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FH, marginBottom: 6 }}>{pkg.price}</div>
              <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>{pkg.description}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {pkg.features.map((f, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                    <CheckCircle2 size={14} color="#004ac6" style={{ marginTop: 2, flexShrink: 0 }} />{f}
                  </li>
                ))}
              </ul>
              <button style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "linear-gradient(90deg, #42C8F7, #2563EB)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>신청하기</button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid #F3F4F6", fontSize: 11, color: "#6B7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Bolt size={12} /> {pkg.period}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><Share2 size={12} /> 공유하기</span>
              </div>
            </div>
            <div style={{ background: "white", borderRadius: 20, padding: 20, border: "1px solid rgba(195,198,215,0.3)", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 10px", border: "2px solid #F3F4F6" }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3qSXdJ_1jOb3BcN1o7vSJelxnt1J5Z0Vre62XlqJhTMfjOIiTdovK1eUeENOQO3C33A3pIqS9yBJh3tU64coftb4Y-OlIwL33O0aKzMqP4m6R2WX9CBgk1OcS3y1SsQgcW2U3AvQu8X6x3zFcUvR5cJ1wVFQfPVKt2Sxw9Q_uUCHCjfug-gHV0Hz6QA5nJ6dlIfqDEk4IvPjRE6zxz-g8qWdRaiZxrVO4UK7ypQvFt9KSpgX4nKWjcVt8thcKRPMRfMB-63Tk-k4" alt="Partner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>NextGen AI Lab</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 12, background: "white", color: "#004ac6", border: "1px solid #004ac6", cursor: "pointer" }}>포트폴리오 보기</button>
                <button style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 12, background: "#F3F4F6", color: "#374151", border: "none", cursor: "pointer" }}>문의하기</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
