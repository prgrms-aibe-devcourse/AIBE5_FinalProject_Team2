import React from "react";
import {
    CreditCard,
    ShieldCheck,
    FileText,
    AlertCircle,
    CheckCircle2,
    DollarSign,
    Scale,
    ArrowRight,
} from "lucide-react";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import home2Img from "../assets/home2.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const TEAL = "#0CA5A0";

const CONTENT = {
  ko: {
    badge:       "외주 계약 및 결제 가이드",
    title:       "안전한 계약과 투명한 결제",
    subtitle:    "금전적 보호와 법적 안전을 위한 ALPHA-HELIX의 시스템 안내",
    sec1:        "에스크로 대금 보호 시스템",
    escrowTitle: "왜 에스크로가 필요한가요?",
    escrowDesc:  "클라이언트가 결제한 대금은 ALPHA-HELIX가 안전하게 보관하며, 파트너가 결과물을 최종 납품하고 클라이언트가 승인한 후에 비로소 정산이 이루어집니다. 이는 대금 미지급이나 선금 먹튀 문제를 원천적으로 방지합니다.",
    check1:      "선금 예치로 신뢰도 확보",
    check2:      "최종 승인 시 자동 정산 시스템",
    sec2:        "표준 계약서 작성 항목",
    contractItems: ["작업 범위 및 산출물", "최종 마감 기한", "단계별 대금 지급", "지체 상금 규정", "하자 보수 범위", "지식 재산권 귀속"],
    sec3:          "분쟁 조정 및 해결 정책",
    arbitTitle:    "객관적 중재 시스템",
    arbitDesc:     "작업 결과물이 계약 내용과 상이할 경우, ALPHA-HELIX 중재팀이 개입하여 계약서와 결과물을 대조합니다. 필요 시 외부 전문가 자문을 통해 공정한 해결책을 제시합니다.",
    warningTitle:  "주의사항",
    warnings: [
      "플랫폼 외부 직거래 시 보호가 불가능합니다.",
      "구두 합의가 아닌 반드시 '채팅/계약서'로 증거를 남기세요.",
      "작업 시작 전 계약 내용을 꼼꼼히 확인하세요.",
    ],
  },
  en: {
    badge:       "Contract & Payment Guide",
    title:       "Secure Contracts & Transparent Payments",
    subtitle:    "ALPHA-HELIX's system guide for financial protection and legal safety",
    sec1:        "Escrow Payment Protection System",
    escrowTitle: "Why is Escrow Necessary?",
    escrowDesc:  "ALPHA-HELIX safely holds the client's payment until the partner delivers the final product and the client approves it. This prevents non-payment and upfront scam issues.",
    check1:      "Advance deposit builds trust",
    check2:      "Automatic settlement upon final approval",
    sec2:        "Standard Contract Items",
    contractItems: ["Scope of Work & Deliverables", "Final Deadline", "Stage-by-Stage Payment", "Late Penalty Rules", "Defect Warranty Scope", "IP Rights Assignment"],
    sec3:          "Dispute Resolution Policy",
    arbitTitle:    "Objective Mediation System",
    arbitDesc:     "If the deliverable differs from the contract terms, ALPHA-HELIX's mediation team intervenes to compare the contract with the deliverable. External expert consultation is used to provide a fair resolution if needed.",
    warningTitle:  "Important Notes",
    warnings: [
      "No protection is provided for transactions outside the platform.",
      "Always keep evidence in 'Chat / Contract' — verbal agreements are not accepted.",
      "Carefully review contract terms before starting work.",
    ],
  },
  zh: {
    badge:       "外包合同与付款指南",
    title:       "安全合同与透明付款",
    subtitle:    "ALPHA-HELIX 金融保护与法律安全系统指南",
    sec1:        "资金托管保护系统",
    escrowTitle: "为什么需要资金托管？",
    escrowDesc:  "客户的付款由 ALPHA-HELIX 安全保管，直到合作伙伴完成最终交付并经客户确认后才结算。这从根本上防止了欠款和预付款诈骗问题。",
    check1:      "预付款托管建立信任",
    check2:      "最终确认时自动结算",
    sec2:        "标准合同条款",
    contractItems: ["工作范围及交付物", "最终截止日期", "分阶段付款", "违约金规定", "瑕疵担保范围", "知识产权归属"],
    sec3:          "纠纷调解与解决政策",
    arbitTitle:    "客观仲裁系统",
    arbitDesc:     "如交付物与合同内容不符，ALPHA-HELIX 仲裁团队将介入，对照合同与交付物进行比较。必要时通过外部专家咨询提供公正解决方案。",
    warningTitle:  "注意事项",
    warnings: [
      "平台外直接交易不受保护。",
      "请务必在\u201c聊天/合同\u201d中留存证据，不接受口头协议。",
      "开始工作前请仔细确认合同内容。",
    ],
  },
};

export default function UsageGuide_Contract() {
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
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            background: "rgba(255,255,255,0.72)", border: "1px solid rgba(148,163,184,0.35)",
                            borderRadius: 20, padding: "6px 16px",
                        }}>
                            <CreditCard size={14} color="#2563EB" />
                            <span style={{ fontSize: 13, color: "#1E3A8A", fontWeight: 700 }}>{c.badge}</span>
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <h1 style={{ color: "#0F172A", fontSize: 34, fontWeight: 900, margin: 0, lineHeight: 1.3 }}>
                            {c.title}
                        </h1>
                    </div>
                    <div>
                        <p style={{ color: "#334155", fontSize: 16, margin: 0, fontWeight: 600 }}>
                            {c.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px", display: "flex", gap: 32 }}>
                <UsageGuideSidebar />

                <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: 27 }}>
                    {/* Section 1: 에스크로 결제 */}
                    <section>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec1}</h2>
                        </div>

                        <div style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 24, padding: "40px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                            <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", marginBottom: 16 }}>{c.escrowTitle}</h3>
                                    <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.8, margin: "0 0 24px" }}>
                                        {c.escrowDesc}
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <CheckCircle2 size={18} color={TEAL} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{c.check1}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <CheckCircle2 size={18} color={TEAL} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{c.check2}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    width: 240, height: 240, background: "#F0FDFA", borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <DollarSign size={80} color={TEAL} strokeWidth={1.5} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: 표준 계약서 */}
                    <section>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec2}</h2>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                            {c.contractItems.map((item, i) => (
                                <div key={i} style={{
                                    background: "white", padding: "20px", borderRadius: 12,
                                    border: "1.5px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12,
                                }}>
                                    <FileText size={18} color="#94A3B8" />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section 3: 분쟁 조정 */}
                    <section>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 4, height: 24, background: TEAL, borderRadius: 2 }} />
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: 0 }}>{c.sec3}</h2>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24 }}>
                            <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 24, padding: "32px" }}>
                                <Scale size={32} color="#64748B" style={{ marginBottom: 16 }} />
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>{c.arbitTitle}</h3>
                                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, margin: 0 }}>
                                    {c.arbitDesc}
                                </p>
                            </div>
                            <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 24, padding: "32px" }}>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#991B1B", marginBottom: 12 }}>{c.warningTitle}</h3>
                                <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                                    {c.warnings.map((text, i) => (
                                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                            <AlertCircle size={16} color="#EF4444" style={{ marginTop: 2 }} />
                                            <span style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.5, fontWeight: 500 }}>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
