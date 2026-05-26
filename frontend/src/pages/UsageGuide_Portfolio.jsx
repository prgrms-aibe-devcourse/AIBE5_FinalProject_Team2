import React, { useState } from "react";
import { Search, Github, BookOpen, AlertCircle, CheckCircle2, Link2, Upload, Star } from "lucide-react";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import home2Img from "../assets/home2.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const TEAL = "#0CA5A0";

const CONTENT = {
  ko: {
    badge:    "포트폴리오 관리 가이드",
    title:    "포트폴리오 관리 가이드",
    subtitle: "외부 플랫폼 연동 및 콘텐츠 최적화를 위한 종합 가이드",
    sec1:     "외부 플랫폼 연동 및 동기화",
    faq: [
      { q: "GitHub 연동 오류 해결 방법 (레포지토리/잔디 미업데이트)", a: "레포지토리가 불러와지지 않는 경우 GitHub 설정에서 ALPHA-HELIX 앱의 권한(Repository Access)을 확인해 주세요. Contribution Graph(잔디)가 업데이트되지 않는다면 이메일 주소가 GitHub 계정과 일치하는지 점검해야 합니다. 해결되지 않을 경우 연동을 해제한 후 재인증을 권장합니다." },
      { q: "기술 블로그 RSS 등록 방법 (벨로그, 티스토리, 워드프레스)", a: "본인의 블로그 주소를 입력하면 RSS 피드를 통해 최신 포스팅을 자동으로 불러옵니다. 벨로그(velog.io/@유저ID), 티스토리(유저ID.tistory.com) 등 각 플랫폼별 형식을 확인하여 등록해 주세요. 동기화는 최대 1시간 간격으로 이루어집니다." },
    ],
    sec2: "콘텐츠 업데이트 및 유지보수",
    cards: [
      { title: "대표 프로젝트 설정", desc: "자신 있는 결과물을 상단에 고정하여 클라이언트의 시선을 먼저 끌 수 있습니다." },
      { title: "링크 유효성 검사",   desc: "등록된 데모/배포 링크가 깨졌을 때 시스템이 알림을 보내며 정기 점검을 권장합니다." },
      { title: "업로드 제한",         desc: "이미지는 5MB, PDF는 20MB로 제한됩니다. 로딩 속도를 위해 최적화를 권장합니다." },
    ],
    sec3:        "신뢰성 검증 및 신고 시스템",
    reportTitle: "도용 포트폴리오 신고",
    reportDesc:  "타인의 결과물을 무단으로 도용한 경우를 발견하셨나요? 증빙 자료와 함께 신고하시면 운영진이 즉시 검토합니다.",
    reportLink:  "신고 가이드 보기 →",
    badgeTitle:  "신뢰도 배지 부여",
    badgeDesc:   "본인 인증 및 성공적인 협업 완료 시 부여됩니다.",
    falseTitle:  "허위 사실 기재 시 불이익",
    falseDesc:   "경력 위조 시 서비스 이용이 영구 제한될 수 있습니다.",
  },
  en: {
    badge:    "Portfolio Management Guide",
    title:    "Portfolio Management Guide",
    subtitle: "A comprehensive guide for external platform integration and content optimization",
    sec1:     "External Platform Integration & Sync",
    faq: [
      { q: "Fixing GitHub Sync Errors (Repository / Contribution Graph Not Updating)", a: "If repositories aren't loading, check ALPHA-HELIX app permissions (Repository Access) in GitHub Settings. If your Contribution Graph isn't updating, verify your email matches your GitHub account. If unresolved, try unlinking and re-authenticating." },
      { q: "How to Register Your Tech Blog RSS Feed (Velog, Tistory, WordPress)", a: "Enter your blog URL to auto-import the latest posts via RSS feed. Use the correct format for each platform: Velog (velog.io/@userID), Tistory (userID.tistory.com). Sync occurs every hour." },
    ],
    sec2: "Content Updates & Maintenance",
    cards: [
      { title: "Set Featured Project", desc: "Pin your best work to the top to catch clients' attention first." },
      { title: "Link Validity Check",  desc: "The system sends alerts when a registered demo/deploy link breaks. Regular checks are recommended." },
      { title: "Upload Limits",        desc: "Images are limited to 5 MB and PDFs to 20 MB. Optimization is recommended for loading speed." },
    ],
    sec3:        "Trust Verification & Report System",
    reportTitle: "Report Plagiarized Portfolio",
    reportDesc:  "Found someone using another person's work without permission? Submit a report with evidence and the operations team will review it immediately.",
    reportLink:  "View Report Guide →",
    badgeTitle:  "Trustworthiness Badge",
    badgeDesc:   "Awarded upon identity verification and successful collaboration completion.",
    falseTitle:  "Penalties for False Information",
    falseDesc:   "Falsifying experience may result in permanent service restriction.",
  },
  zh: {
    badge:    "作品集管理指南",
    title:    "作品集管理指南",
    subtitle: "外部平台连接及内容优化综合指南",
    sec1:     "外部平台连接与同步",
    faq: [
      { q: "修复 GitHub 同步错误（仓库/贡献图未更新）", a: "如果仓库无法加载，请在 GitHub 设置中检查 ALPHA-HELIX 应用权限（Repository Access）。如果贡献图未更新，请确认您的邮箱与 GitHub 账户一致。如仍未解决，建议解绑后重新认证。" },
      { q: "如何注册技术博客 RSS（Velog、Tistory、WordPress）", a: "输入您的博客地址，系统将通过 RSS 订阅自动导入最新文章。请按各平台格式注册：Velog（velog.io/@用户ID）、Tistory（用户ID.tistory.com）。同步间隔最长1小时。" },
    ],
    sec2: "内容更新与维护",
    cards: [
      { title: "设置代表项目", desc: "将最自信的成果固定在顶部，第一时间吸引客户注意。" },
      { title: "链接有效性检查", desc: "已注册的演示/部署链接失效时，系统会发送通知，建议定期检查。" },
      { title: "上传限制", desc: "图片限制为 5MB，PDF 限制为 20MB。建议优化以提升加载速度。" },
    ],
    sec3:        "可信度验证与举报系统",
    reportTitle: "举报抄袭作品集",
    reportDesc:  "发现有人未经授权使用他人成果？携带证据举报后，运营团队将立即审查。",
    reportLink:  "查看举报指南 →",
    badgeTitle:  "可信度徽章授予",
    badgeDesc:   "完成身份验证及成功协作后授予。",
    falseTitle:  "虚假信息处罚",
    falseDesc:   "伪造经历可能导致服务被永久限制。",
  },
};

export default function UsageGuide_Portfolio() {
  const [openFaq, setOpenFaq] = useState(null);
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
              <Star size={14} color="#2563EB" />
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
          {/* Section 1: 외부 플랫폼 연동 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec1}</h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {c.faq.map((item, i) => (
                <div key={i} style={{ background: "white", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
                  <button 
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: "100%", padding: "24px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#334155", fontFamily: F }}>{item.q}</span>
                    <span style={{ fontSize: 20, color: "#94A3B8" }}>{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: "0 24px 24px", fontSize: 14, color: "#64748B", lineHeight: 1.8 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 2: 콘텐츠 유지보수 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec2}</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {c.cards.map((card, i) => {
                const icons = [<Star />, <Link2 />, <Upload />];
                return (
                <div key={i} style={{ background: "white", padding: "32px", borderRadius: 20, border: "1.5px solid #E5E7EB", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 48, height: 48, background: "#F0FDFA", color: TEAL, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    {icons[i]}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", marginBottom: 10 }}>{card.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: 0 }}>{card.desc}</p>
                </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: 신뢰성 및 신고 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec3}</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 24, padding: "40px" }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#991B1B", marginBottom: 12 }}>{c.reportTitle}</h3>
                <p style={{ fontSize: 14, color: "#B91C1C", lineHeight: 1.7, marginBottom: 24 }}>
                  {c.reportDesc}
                </p>
                <button style={{ background: "none", border: "none", color: "#991B1B", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: 0 }}>{c.reportLink}</button>
              </div>
              
              <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 24, padding: "32px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <CheckCircle2 color={TEAL} size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>{c.badgeTitle}</h4>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{c.badgeDesc}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <AlertCircle color="#EF4444" size={24} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#EF4444", marginBottom: 2 }}>{c.falseTitle}</h4>
                    <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{c.falseDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
