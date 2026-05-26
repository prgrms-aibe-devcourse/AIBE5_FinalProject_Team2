import React from "react";
import { ShieldCheck, AlertCircle, Trash2, Info, CheckCircle2, UserX, Clock, ArrowRight } from "lucide-react";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import home2Img from "../assets/home2.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const TEAL = "#0CA5A0";

const CONTENT = {
  ko: {
    badge:    "계정 및 이용 정책",
    title:    "투명한 커뮤니티 정책",
    subtitle: "플랫폼 이용 규칙과 사용자 보호를 위한 필수 정책 안내",
    sec1:     "수수료 및 정산 정책",
    feeQ:     "플랫폼 이용 수수료는 어떻게 되나요?",
    feeDesc:  "ALPHA-HELIX는 투명한 수수료 정책을 지향합니다. 프로젝트 매칭 시 최종 계약 금액의 10%(VAT 별도)가 수수료로 부과됩니다. 이 수수료는 에스크로 대금 보호, 전자계약 시스템 제공, 전담 매니저 중재 서비스 운영에 전액 사용됩니다.",
    feeTag1:  "FEE POLICY",
    feeTag2:  "기본 10% (VAT 별도)",
    sec2:         "신고 제도 및 서비스 제한",
    misconductTitle: "비매너 행위 및 허위 정보 신고",
    misconductDesc:  "허위 경력 기재, 무단 작업 중단, 결제 유도 직거래 제안 등 플랫폼 건전성을 해치는 행위 발견 시 즉시 신고해 주세요. 운영팀은 사실 확인 후 엄격한 제재를 가합니다.",
    processTitle: "운영팀 대응 프로세스",
    steps: ["신고 접수", "사실 확인 및 소명", "정책 기반 제재 (48시간 내)"],
    sec3:        "탈퇴 및 데이터 관리 정책",
    delTitle:    "계정 탈퇴 시 데이터 처리",
    delDesc:     "탈퇴 시 개인정보와 포트폴리오 원본 데이터는 즉시 삭제되어 복구가 불가능합니다. 단, 협업 이력 및 익명화된 평가 데이터는 통계 목적으로 보관될 수 있습니다.",
    delCheck1:   "원본 데이터: 즉시 삭제",
    delCheck2:   "협업 통계: 익명화 보관",
    destroyTitle: "데이터 파기 안내",
    destroyItems: [
      { label: "개인정보 (이름, 연락처)", status: "삭제됨", isGood: false },
      { label: "포트폴리오 파일",         status: "삭제됨", isGood: false },
      { label: "평가 통계",               status: "익명화 보관", isGood: true },
    ],
  },
  en: {
    badge:    "Account & Usage Policy",
    title:    "Transparent Community Policy",
    subtitle: "Essential policy guidance for platform usage rules and user protection",
    sec1:     "Fee & Settlement Policy",
    feeQ:     "How are platform usage fees charged?",
    feeDesc:  "ALPHA-HELIX pursues a transparent fee policy. A fee of 10% (excluding VAT) of the final contract amount is charged upon project matching. This fee is used entirely for escrow payment protection, electronic contract system, and dedicated manager mediation services.",
    feeTag1:  "FEE POLICY",
    feeTag2:  "Base 10% (VAT excluded)",
    sec2:         "Report System & Service Restrictions",
    misconductTitle: "Report Misconduct & False Information",
    misconductDesc:  "Report immediately if you discover behaviors harming platform integrity: falsifying experience, unauthorized work stoppage, proposing off-platform direct transactions. The operations team will impose strict sanctions after fact verification.",
    processTitle: "Operations Team Response Process",
    steps: ["Report Received", "Verification & Response", "Policy-Based Sanction (within 48h)"],
    sec3:        "Account Deletion & Data Management Policy",
    delTitle:    "Data Handling Upon Account Deletion",
    delDesc:     "Personal information and original portfolio data are immediately deleted upon withdrawal and cannot be recovered. However, collaboration history and anonymized evaluation data may be retained for statistical purposes.",
    delCheck1:   "Original data: immediately deleted",
    delCheck2:   "Collaboration statistics: anonymized retention",
    destroyTitle: "Data Destruction Guide",
    destroyItems: [
      { label: "Personal info (name, contact)", status: "Deleted",              isGood: false },
      { label: "Portfolio files",               status: "Deleted",              isGood: false },
      { label: "Evaluation statistics",         status: "Anonymized retention", isGood: true },
    ],
  },
  zh: {
    badge:    "账户与使用政策",
    title:    "透明的社区政策",
    subtitle: "平台使用规则与用户保护必要政策说明",
    sec1:     "费用与结算政策",
    feeQ:     "平台使用费用如何收取？",
    feeDesc:  "ALPHA-HELIX 致力于透明的费用政策。项目匹配时，按最终合同金额的10%（不含增值税）收取服务费。该费用全额用于资金托管保护、电子合同系统提供及专属经理仲裁服务运营。",
    feeTag1:  "FEE POLICY",
    feeTag2:  "基础 10%（不含增值税）",
    sec2:         "举报制度与服务限制",
    misconductTitle: "举报不当行为及虚假信息",
    misconductDesc:  "发现伪造经历、擅自停工、诱导平台外直接交易等损害平台健康的行为时，请立即举报。运营团队在核实事实后将予以严格制裁。",
    processTitle: "运营团队响应流程",
    steps: ["举报受理", "事实核查与说明", "基于政策的制裁（48小时内）"],
    sec3:        "注销与数据管理政策",
    delTitle:    "账户注销时的数据处理",
    delDesc:     "注销时，个人信息和作品集原始数据将立即删除且无法恢复。但协作记录及匿名化评估数据可能出于统计目的予以保留。",
    delCheck1:   "原始数据：立即删除",
    delCheck2:   "协作统计：匿名化保留",
    destroyTitle: "数据销毁说明",
    destroyItems: [
      { label: "个人信息（姓名、联系方式）", status: "已删除",   isGood: false },
      { label: "作品集文件",                  status: "已删除",   isGood: false },
      { label: "评估统计",                    status: "匿名化保留", isGood: true },
    ],
  },
};

export default function UsageGuide_Policy() {
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
              <ShieldCheck size={14} color="#2563EB" />
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
          {/* Section 1: 수수료 정책 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec1}</h2>
            </div>
            
            <div style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 24, padding: "40px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "start", gap: 24 }}>
                <div style={{ width: 56, height: 56, background: "#F0FDFA", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Info color={TEAL} size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>{c.feeQ}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.8, margin: "0 0 24px" }}>
                    {c.feeDesc}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ padding: "6px 14px", background: "#F0FDFA", color: TEAL, fontSize: 12, fontWeight: 700, borderRadius: 20 }}>{c.feeTag1}</span>
                    <span style={{ padding: "6px 14px", background: "#F1F5F9", color: "#64748B", fontSize: 12, fontWeight: 600, borderRadius: 20 }}>{c.feeTag2}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: 신고 및 제재 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec2}</h2>
            </div>
            
            <div style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 24, padding: "40px" }}>
              <div style={{ display: "flex", alignItems: "start", gap: 24 }}>
                <div style={{ width: 56, height: 56, background: "#FEF2F2", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertCircle color="#EF4444" size={28} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>{c.misconductTitle}</h3>
                  <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.8, marginBottom: 24 }}>
                    {c.misconductDesc}
                  </p>
                  <div style={{ background: "#F8FAFB", borderRadius: 16, padding: "24px", borderLeft: "4px solid #F87171" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", marginBottom: 8 }}>{c.processTitle}</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "#64748B" }}>{c.steps[0]}</span>
                      <ArrowRight size={12} color="#CBD5E1" />
                      <span style={{ fontSize: 12, color: "#64748B" }}>{c.steps[1]}</span>
                      <ArrowRight size={12} color="#CBD5E1" />
                      <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>{c.steps[2]}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: 데이터 관리 */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec3}</h2>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
              <div style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 24, padding: "32px" }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>{c.delTitle}</h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 24 }}>
                  {c.delDesc}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={18} color={TEAL} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{c.delCheck1}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={18} color={TEAL} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{c.delCheck2}</span>
                  </div>
                </div>
              </div>
              <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 24, padding: "32px", position: "relative", overflow: "hidden" }}>
                <Trash2 size={80} color="#E2E8F0" style={{ position: "absolute", right: -10, bottom: -10 }} />
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>{c.destroyTitle}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {c.destroyItems.map((item, i) => (
                    item.isGood
                      ? <div key={i} style={{ background: "#F0FDFA", padding: "12px 16px", borderRadius: 10, border: "1px solid #CCFBF1", fontSize: 12, color: TEAL, fontWeight: 700 }}>{item.label} - {item.status}</div>
                      : <div key={i} style={{ background: "white", padding: "12px 16px", borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", fontSize: 12, color: "#64748B" }}>{item.label} - <span style={{ color: "#EF4444", fontWeight: 700 }}>{item.status}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
