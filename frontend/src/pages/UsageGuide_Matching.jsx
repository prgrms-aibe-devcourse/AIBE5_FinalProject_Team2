import React from "react";
import { Search, Users, CheckCircle, Shield, ArrowRight, UserCheck, MessageCircle, FileCheck } from "lucide-react";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import home2Img from "../assets/home2.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const TEAL = "#0CA5A0";

const CONTENT = {
  ko: {
    badge:    "파트너십 및 팀 매칭 가이드",
    title:    "매칭 성공 가이드",
    subtitle: "면접 없는 빠른 매칭을 위한 선발 및 지원 가이드",
    sec1:     "[클라이언트용] 실패 없는 선발 가이드",
    sec1Desc: "면접이 생략되는 매칭 방식 특성상, 프로필에서 다음 항목들을 중점적으로 확인해야 합니다.",
    checklist: [
      { title: "기술 스택 일치 여부",   desc: "Java/Spring Boot 등 구체적인 기술 스택과 버전을 확인하세요." },
      { title: "GitHub 활동성",          desc: "최근 커밋 기록과 코드의 구조적 품질을 검토하는 것이 중요합니다." },
      { title: "유사 프로젝트 경험",     desc: "동종 업계나 유사한 기능을 구현한 경험이 있는지 체크하세요." },
      { title: "포트폴리오 완성도",      desc: "단순 나열이 아닌, 본인의 역할과 기여도가 명확한지 확인하세요." },
    ],
    sec2: "[파트너용] 매칭률 높이는 프로필 작성법",
    profileCards: [
      { title: "포트폴리오 가독성", desc: "본인의 역할(Role)과 성과를 수치화하여 명확히 기재하세요." },
      { title: "기술 채널 연동",   desc: "깔끔한 README와 블로그 기록은 전문성을 증명하는 가장 빠른 길입니다." },
      { title: "자기소개 전략",   desc: "협업 스타일과 가용 가능한 시간을 구체적으로 명시하여 신뢰를 얻으세요." },
    ],
    sec3: "매칭 프로세스 안내",
    steps: ["지원", "검토", "확정", "협업"],
  },
  en: {
    badge:    "Partnership & Team Matching Guide",
    title:    "Matching Success Guide",
    subtitle: "Selection and application guide for fast matching without interviews",
    sec1:     "[For Clients] Fail-Safe Selection Guide",
    sec1Desc: "Since interviews are skipped in this matching model, focus on these key areas when reviewing profiles.",
    checklist: [
      { title: "Tech Stack Match",             desc: "Verify the exact tech stack and version, e.g. Java/Spring Boot." },
      { title: "GitHub Activity",              desc: "Review recent commit history and structural code quality." },
      { title: "Similar Project Experience",   desc: "Check for experience in the same industry or implementing similar features." },
      { title: "Portfolio Completeness",       desc: "Look for clearly stated roles and contributions, not just a list." },
    ],
    sec2: "[For Partners] Profile Tips to Boost Matching Rate",
    profileCards: [
      { title: "Portfolio Readability", desc: "Quantify your role and achievements clearly." },
      { title: "Tech Channel Integration", desc: "Clean README files and blog posts are the fastest way to prove expertise." },
      { title: "Intro Strategy", desc: "State your collaboration style and availability specifically to build trust." },
    ],
    sec3: "Matching Process Overview",
    steps: ["Apply", "Review", "Confirm", "Collaborate"],
  },
  zh: {
    badge:    "合作伙伴与团队匹配指南",
    title:    "匹配成功指南",
    subtitle: "无需面试快速匹配的遴选与申请指南",
    sec1:     "【客户用】万无一失的遴选指南",
    sec1Desc: "由于该匹配方式省略了面试环节，需重点确认以下要点。",
    checklist: [
      { title: "技术栈匹配度",   desc: "请确认具体技术栈及版本，如 Java/Spring Boot 等。" },
      { title: "GitHub 活跃度", desc: "查看近期提交记录和代码结构质量非常重要。" },
      { title: "类似项目经验",   desc: "检查是否有同行业或类似功能的实现经验。" },
      { title: "作品集完整度",   desc: "确认不仅是简单罗列，而是明确说明了个人角色和贡献。" },
    ],
    sec2: "【合作伙伴用】提高匹配率的资料填写方法",
    profileCards: [
      { title: "作品集可读性", desc: "请将您的角色和成果数据化、清晰表述。" },
      { title: "技术渠道连接", desc: "整洁的 README 和博客记录是证明专业能力的最快方式。" },
      { title: "自我介绍策略", desc: "具体说明协作风格和可用时间，以建立信任。" },
    ],
    sec3: "匹配流程说明",
    steps: ["申请", "审查", "确认", "协作"],
  },
};

export default function UsageGuide_Matching() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: F }}>
      {/* Hero */}
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 20, padding: "6px 16px" }}>
              <Users size={14} color="#2563EB" />
              <span style={{ fontSize: 13, color: "#1E3A8A", fontWeight: 700 }}>{c.badge}</span>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <h1 style={{ color: "#0F172A", fontSize: 34, fontWeight: 900, margin: 0, lineHeight: 1.3 }}>{c.title}</h1>
          </div>
          <div>
            <p style={{ color: "#334155", fontSize: 16, margin: 0, fontWeight: 600 }}>{c.subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px", display: "flex", gap: 32 }}>
        <UsageGuideSidebar />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: 27 }}>
          {/* Section 1: 선발 가이드 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec1}</h2>
            </div>
            
            <div style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 24, padding: "40px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.7, marginBottom: 32 }}>
                {c.sec1Desc}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {c.checklist.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, padding: "20px", background: "#F8FAFC", borderRadius: 16 }}>
                    <div style={{ color: TEAL, fontWeight: 800 }}>✔</div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{item.title}</h4>
                      <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2: 작성법 가이드 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec2}</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {c.profileCards.map((card, i) => (
                <div key={i} style={{ background: "#F0FDFA", border: "1.5px solid #CCFBF1", padding: "32px", borderRadius: 24 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#134E4A", marginBottom: 12 }}>{card.title}</h3>
                  <p style={{ fontSize: 13, color: "#0F766E", lineHeight: 1.7, margin: 0 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: 프로세스 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec3}</h2>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {[
                { step: "01", label: c.steps[0], icon: <UserCheck /> },
                { step: "02", label: c.steps[1], icon: <Search /> },
                { step: "03", label: c.steps[2], icon: <FileCheck /> },
                { step: "04", label: c.steps[3], icon: <MessageCircle /> }
              ].map((item, i) => (
                <React.Fragment key={i}>
                  <div style={{ flex: 1, background: "white", border: "1.5px solid #E5E7EB", borderRadius: 20, padding: "24px", textAlign: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: TEAL, marginBottom: 12 }}>STEP {item.step}</div>
                    <div style={{ color: "#475569", marginBottom: 8, display: "flex", justifyContent: "center" }}>{item.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>{item.label}</div>
                  </div>
                  {i < 3 && <ArrowRight color="#CBD5E1" size={24} />}
                </React.Fragment>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
