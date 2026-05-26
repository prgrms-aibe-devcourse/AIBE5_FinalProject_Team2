import { useState, useEffect } from "react";
import { Scale } from "lucide-react";
import UsageGuideSidebar from "../components/UsageGuideSidebar";
import home2Img from "../assets/home2.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const BLUE = "#2563EB";

const CONTENT = {
  ko: {
    badge:    "서비스 정책",
    title:    "투명한 서비스 정책",
    subtitle: "개인정보처리방침 및 이용약관 — ALPHA-HELIX의 신뢰 기반",
    tab_privacy: "개인정보처리방침 (Privacy Policy)",
    tab_terms:   "서비스 이용약관 (Terms of Service)",
    viewPrivacy: "↗ 개인정보처리방침 전체보기",
    viewTerms:   "↗ 서비스 이용약관 전체보기",
    privacyNotice: "본 서비스는 Google API 서비스 사용자 데이터 정책을 준수하며, Google API를 통해 획득한 정보를 다른 앱에 공유하거나 상업적 광고 목적으로 제3자에게 제공하지 않습니다.",
    p1t: "1. 수집하는 개인정보 항목",
    p1s1: "Google 계정 정보 (OAuth 로그인 시)",
    p1s1d: "이메일 주소, 프로필 이름 및 사진, 계정 고유 ID",
    p1s2: "Google Calendar 데이터 (일정 연동 시)",
    p1s2d1: "캘린더 일정 목록 및 상세 내용",
    p1s2d2: "일정 생성·수정·삭제 권한, 캘린더 ID 및 타임존",
    p1s3: "서비스 이용 과정에서 수집되는 정보",
    p1s3d1: "닉네임, 전문 분야, 소개글 등 프로필 정보 (사용자 직접 입력)",
    p1s3d2: "프로젝트 등록 정보, 포트폴리오 자료, 서비스 이용 기록",
    p2t: "2. 개인정보의 이용 목적",
    p2i1: "Google 계정 정보: 서비스 로그인, 사용자 식별, 알림 발송",
    p2i2: "Google Calendar 권한: IT 인재 매칭 과정에서 면접 일정을 자동으로 등록하고 관리하기 위한 목적으로만 사용됩니다.",
    p2i3: "프로필 정보: 파트너·클라이언트 매칭, 프로젝트 추천 및 검색",
    p2i4: "이용 기록: 서비스 품질 개선 및 문제 해결",
    p3t: "3. 데이터 보관 및 파기",
    p3i1: "사용자가 서비스 탈퇴를 요청하거나 개인정보 이용 동의를 철회할 경우, 수집된 데이터는 지체 없이 파기합니다.",
    p3i2: "Google Calendar 데이터는 해당 세션의 일정 처리 완료 후 서버에 별도 저장하지 않습니다.",
    p4t: "4. 제3자 제공 및 공유 금지",
    p4warn: "중요",
    p4warnDesc: "본 서비스는 Google API를 통해 획득한 정보를 다른 앱에 공유하거나 상업적인 광고 목적으로 제3자에게 제공하지 않습니다.",
    p4i1: "수집된 개인정보는 본 방침에 명시된 목적 이외에는 사용되지 않습니다.",
    p4i2: "법령에 의한 요청이 있는 경우에만 예외적으로 제공할 수 있습니다.",
    p5t: "5. Google API 서비스 사용자 데이터 정책 준수",
    p5desc: "본 서비스는 Google API 서비스 사용자 데이터 정책을 준수합니다. Google 사용자 데이터를 광고 제공 또는 제3자에게 판매하지 않습니다.",
    p5link: "Google API 서비스 사용자 데이터 정책",
    contactTitle: "문의",
    contactPrivacy: "개인정보 관련 문의:",
    contactTerms: "약관 관련 문의:",
    t1t: "제1조 (목적)",
    t1desc: "본 약관은 ALPHA-HELIX가 제공하는 IT 인재 매칭 플랫폼 서비스의 이용 조건 및 사용자와 서비스 간의 권리·의무 사항을 규정합니다.",
    t2t: "제2조 (서비스 개요)",
    t2i1: "클라이언트와 IT 파트너 간 매칭 중개",
    t2i2: "프로젝트 등록 및 제안서 관리",
    t2i3: "Google Calendar 연동을 통한 면접 일정 관리",
    t2i4: "AI 기반 프로젝트 및 프로필 작성 지원, 계약·채팅 등 진행 도구",
    t3t: "제3조 (Google API 및 캘린더 권한 사용)",
    t3notice: "본 서비스는 Google API 서비스 사용자 데이터 정책을 준수합니다. Google API를 통해 획득한 정보는 면접 일정 관리 목적으로만 사용됩니다.",
    t3i1: "캘린더 데이터는 광고, 제3자 공유, 상업적 목적으로 활용되지 않습니다.",
    t3i2: "사용자는 언제든지 Google 계정 설정에서 캘린더 접근 권한을 취소할 수 있습니다.",
    t4t: "제4조 (사용자의 의무)",
    t4intro: "다음 행위를 금지합니다:",
    t4i1: "타인의 정보 도용 또는 허위 정보 등록",
    t4i2: "서비스 정상 운영을 방해하는 행위",
    t4i3: "저작권 등 지식재산권 침해",
    t4i4: "스팸 발송 또는 상업적 무단 광고 행위",
    t5t: "제5조 (개인정보 처리)",
    t5desc: "사용자의 개인정보는 개인정보처리방침에 따라 처리됩니다.",
    t5link: "개인정보처리방침",
  },
  en: {
    badge:    "Service Policy",
    title:    "Transparent Service Policy",
    subtitle: "Privacy Policy & Terms of Service — The trust foundation of ALPHA-HELIX",
    tab_privacy: "Privacy Policy",
    tab_terms:   "Terms of Service",
    viewPrivacy: "↗ View Full Privacy Policy",
    viewTerms:   "↗ View Full Terms of Service",
    privacyNotice: "This service complies with Google API Services User Data Policy. Information obtained through Google APIs will not be shared with other apps or provided to third parties for commercial advertising purposes.",
    p1t: "1. Personal Information Collected",
    p1s1: "Google Account Information (OAuth Login)",
    p1s1d: "Email address, profile name and photo, account unique ID",
    p1s2: "Google Calendar Data (when calendar sync is enabled)",
    p1s2d1: "List of calendar events and details",
    p1s2d2: "Event creation/edit/delete permissions, calendar ID and timezone",
    p1s3: "Information Collected During Service Use",
    p1s3d1: "Profile information such as nickname, expertise, bio (user-provided)",
    p1s3d2: "Project registration data, portfolio materials, service usage records",
    p2t: "2. Purpose of Using Personal Information",
    p2i1: "Google Account Info: Service login, user identification, notification delivery",
    p2i2: "Google Calendar Permission: Used solely to automatically register and manage interview schedules in the IT talent matching process.",
    p2i3: "Profile Info: Partner/client matching, project recommendation and search",
    p2i4: "Usage Records: Service quality improvement and issue resolution",
    p3t: "3. Data Retention & Disposal",
    p3i1: "If a user requests withdrawal or revokes consent, collected data will be destroyed without delay.",
    p3i2: "Google Calendar data is not stored separately on the server after the session's scheduling is completed.",
    p4t: "4. No Third-Party Sharing",
    p4warn: "Important",
    p4warnDesc: "This service does not share information obtained through Google APIs with other apps or provide it to third parties for commercial advertising purposes.",
    p4i1: "Collected personal information is not used beyond the purposes stated in this policy.",
    p4i2: "Exceptions may apply only when required by law.",
    p5t: "5. Compliance with Google API Services User Data Policy",
    p5desc: "This service complies with the Google API Services User Data Policy. Google user data will not be sold to advertisers or third parties.",
    p5link: "Google API Services User Data Policy",
    contactTitle: "Contact",
    contactPrivacy: "Privacy inquiries:",
    contactTerms: "Terms inquiries:",
    t1t: "Article 1 (Purpose)",
    t1desc: "These Terms govern the conditions of use of the IT talent matching platform service provided by ALPHA-HELIX and the rights, obligations, and responsibilities between users and the service.",
    t2t: "Article 2 (Service Overview)",
    t2i1: "Matching mediation between clients and IT partners",
    t2i2: "Project registration and proposal management",
    t2i3: "Interview schedule management via Google Calendar integration",
    t2i4: "AI-based project and profile writing support, contract/chat tools",
    t3t: "Article 3 (Use of Google API & Calendar Permissions)",
    t3notice: "This service complies with Google API Services User Data Policy. Information obtained through Google APIs is used solely for interview schedule management.",
    t3i1: "Calendar data is not used for advertising, third-party sharing, or commercial purposes.",
    t3i2: "Users can revoke calendar access permissions at any time in Google account settings.",
    t4t: "Article 4 (User Obligations)",
    t4intro: "The following actions are prohibited:",
    t4i1: "Misusing others' information or registering false information",
    t4i2: "Interfering with normal service operation",
    t4i3: "Infringing on intellectual property rights such as copyright",
    t4i4: "Sending spam or unauthorized commercial advertising",
    t5t: "Article 5 (Personal Data Processing)",
    t5desc: "User's personal information is processed in accordance with the Privacy Policy.",
    t5link: "Privacy Policy",
  },
  zh: {
    badge:    "服务政策",
    title:    "透明的服务政策",
    subtitle: "隐私政策与服务条款 — ALPHA-HELIX的信任基础",
    tab_privacy: "隐私政策 (Privacy Policy)",
    tab_terms:   "服务条款 (Terms of Service)",
    viewPrivacy: "↗ 查看完整隐私政策",
    viewTerms:   "↗ 查看完整服务条款",
    privacyNotice: "本服务遵守 Google API 服务用户数据政策，不会将通过 Google API 获取的信息与其他应用共享，也不会出于商业广告目的向第三方提供。",
    p1t: "1. 收集的个人信息项目",
    p1s1: "Google 账户信息（OAuth 登录时）",
    p1s1d: "电子邮件地址、个人资料名称及照片、账户唯一 ID",
    p1s2: "Google 日历数据（启用日历同步时）",
    p1s2d1: "日历事件列表及详细内容",
    p1s2d2: "事件创建/编辑/删除权限、日历 ID 及时区",
    p1s3: "服务使用过程中收集的信息",
    p1s3d1: "昵称、专业领域、简介等个人资料（用户自行输入）",
    p1s3d2: "项目注册信息、作品集资料、服务使用记录",
    p2t: "2. 个人信息的使用目的",
    p2i1: "Google 账户信息：服务登录、用户识别、通知发送",
    p2i2: "Google 日历权限：仅用于在IT人才匹配过程中自动注册和管理面试日程。",
    p2i3: "个人资料信息：合作伙伴/客户匹配、项目推荐及搜索",
    p2i4: "使用记录：服务质量改进及问题解决",
    p3t: "3. 数据保留与销毁",
    p3i1: "用户申请注销或撤回个人信息使用同意时，所收集的数据将立即销毁。",
    p3i2: "Google 日历数据在当次会话日程处理完成后不会单独存储于服务器。",
    p4t: "4. 禁止向第三方提供及共享",
    p4warn: "重要",
    p4warnDesc: "本服务不会将通过 Google API 获取的信息与其他应用共享，也不会出于商业广告目的向第三方提供。",
    p4i1: "所收集的个人信息不得用于本政策规定目的以外的用途。",
    p4i2: "仅在法律要求时，方可例外提供。",
    p5t: "5. 遵守 Google API 服务用户数据政策",
    p5desc: "本服务遵守 Google API 服务用户数据政策。Google 用户数据不会出售给广告商或第三方。",
    p5link: "Google API 服务用户数据政策",
    contactTitle: "联系方式",
    contactPrivacy: "隐私相关咨询：",
    contactTerms: "条款相关咨询：",
    t1t: "第1条（目的）",
    t1desc: "本条款旨在规定 ALPHA-HELIX 提供的 IT 人才匹配平台服务的使用条件，以及用户与服务之间的权利、义务及责任事项。",
    t2t: "第2条（服务概述）",
    t2i1: "客户与IT合作伙伴之间的匹配中介",
    t2i2: "项目注册及提案管理",
    t2i3: "通过 Google 日历集成管理面试日程",
    t2i4: "基于AI的项目及个人资料撰写支持、合同·聊天等进行工具",
    t3t: "第3条（Google API 及日历权限使用）",
    t3notice: "本服务遵守 Google API 服务用户数据政策。通过 Google API 获取的信息仅用于面试日程管理目的。",
    t3i1: "日历数据不用于广告、第三方共享或商业目的。",
    t3i2: "用户随时可在 Google 账户设置中撤销日历访问权限。",
    t4t: "第4条（用户义务）",
    t4intro: "禁止以下行为：",
    t4i1: "盗用他人信息或注册虚假信息",
    t4i2: "妨碍服务正常运营的行为",
    t4i3: "侵犯版权等知识产权",
    t4i4: "发送垃圾邮件或未经授权的商业广告",
    t5t: "第5条（个人信息处理）",
    t5desc: "用户的个人信息依据隐私政策进行处理。",
    t5link: "隐私政策",
  },
};

export default function UsageGuide_ServicePolicy() {
  const { lang } = useLanguage();
  const c = CONTENT[lang] || CONTENT.ko;
  const [activeTab, setActiveTab] = useState("privacy");

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "서비스 정책 | ALPHA-HELIX";
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: F }}>
      {/* Hero Banner */}
      <div style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.01) 100%), url(${home2Img}) center/cover no-repeat`,
        padding: "80px 40px 72px",
        textAlign: "center",
      }}>
        <div style={{
          maxWidth: 920, margin: "0 auto",
          background: "rgba(255,255,255,0.64)",
          border: "1px solid rgba(255,255,255,0.86)",
          borderRadius: 20, padding: "24px 24px 22px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 20, padding: "6px 16px" }}>
              <Scale size={14} color="#2563EB" />
              <span style={{ fontSize: 13, color: "#1E3A8A", fontWeight: 700 }}>{c.badge}</span>
            </div>
          </div>
          <h1 style={{ color: "#0F172A", fontSize: 34, fontWeight: 900, margin: "0 0 14px", lineHeight: 1.3 }}>{c.title}</h1>
          <p style={{ color: "#334155", fontSize: 16, margin: 0, fontWeight: 600 }}>{c.subtitle}</p>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px 80px", display: "flex", gap: 32 }}>
        <UsageGuideSidebar />

        <main style={{ flex: 1, minWidth: 0 }}>
          {/* 탭 */}
          <div style={{
            display: "flex", gap: 0,
            borderBottom: "2px solid #E5E7EB", marginBottom: 28,
          }}>
            {[
              { key: "privacy", label: c.tab_privacy },
              { key: "terms",   label: c.tab_terms },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "13px 28px", fontSize: 15, fontWeight: activeTab === tab.key ? 700 : 500,
                  color: activeTab === tab.key ? "#2563EB" : "#64748B",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: activeTab === tab.key ? "2px solid #2563EB" : "2px solid transparent",
                  marginBottom: -2, fontFamily: F, transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{
            background: "white", borderRadius: 20, padding: "40px 48px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB",
          }}>
            {activeTab === "privacy" ? <PrivacyContent c={c} lang={lang} /> : <TermsContent c={c} lang={lang} />}
          </div>

          {/* 전체보기 링크 */}
          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8,
              border: "1.5px solid #DBEAFE", background: "#EFF6FF",
              color: "#1D4ED8", fontSize: 14, fontWeight: 600,
              textDecoration: "none", fontFamily: F,
            }}>
              {c.viewPrivacy}
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8,
              border: "1.5px solid #E0E7FF", background: "#F5F3FF",
              color: "#4338CA", fontSize: 14, fontWeight: 600,
              textDecoration: "none", fontFamily: F,
            }}>
              {c.viewTerms}
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 17, fontWeight: 800, color: "#111827",
        margin: "0 0 14px", fontFamily: F,
        paddingBottom: 10, borderBottom: "1.5px solid #F3F4F6",
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.85, fontFamily: F }}>
        {children}
      </div>
    </div>
  );
}

function SubTitle({ children }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", margin: "12px 0 5px" }}>
      {children}
    </p>
  );
}

function PrivacyContent({ c, lang }) {
  return (
    <div>
      <div style={{
        padding: "14px 18px", background: "#EFF6FF", borderRadius: 10,
        borderLeft: "4px solid #3B82F6", marginBottom: 32,
        fontSize: 14, color: "#1E3A5F", lineHeight: 1.75,
      }}>
        <strong>Google API </strong>{c.privacyNotice}
      </div>

      <Section title={c.p1t}>
        <SubTitle>{c.p1s1}</SubTitle>
        <ul><li>{c.p1s1d}</li></ul>
        <SubTitle>{c.p1s2}</SubTitle>
        <ul>
          <li>{c.p1s2d1}</li>
          <li>{c.p1s2d2}</li>
        </ul>
        <SubTitle>{c.p1s3}</SubTitle>
        <ul>
          <li>{c.p1s3d1}</li>
          <li>{c.p1s3d2}</li>
        </ul>
      </Section>

      <Section title={c.p2t}>
        <ul>
          <li><strong>Google {lang === "ko" ? "계정 정보" : lang === "zh" ? "账户信息" : "Account Info"}</strong>: {c.p2i1.split(": ")[1] || c.p2i1}</li>
          <li><strong>Google Calendar</strong>: {c.p2i2}</li>
          <li><strong>{lang === "ko" ? "프로필 정보" : lang === "zh" ? "个人资料信息" : "Profile Info"}</strong>: {c.p2i3.includes(": ") ? c.p2i3.split(": ")[1] : c.p2i3}</li>
          <li><strong>{lang === "ko" ? "이용 기록" : lang === "zh" ? "使用记录" : "Usage Records"}</strong>: {c.p2i4.includes(": ") ? c.p2i4.split(": ")[1] : c.p2i4}</li>
        </ul>
      </Section>

      <Section title={c.p3t}>
        <ul>
          <li>{c.p3i1}</li>
          <li>{c.p3i2}</li>
        </ul>
      </Section>

      <Section title={c.p4t}>
        <div style={{ padding: "14px 18px", background: "#FEF2F2", borderRadius: 10, borderLeft: "4px solid #EF4444", marginBottom: 14 }}>
          <strong style={{ color: "#DC2626", fontSize: 14 }}>{c.p4warn}</strong>
          <p style={{ margin: "6px 0 0", color: "#7F1D1D", fontSize: 14, lineHeight: 1.7 }}>{c.p4warnDesc}</p>
        </div>
        <ul>
          <li>{c.p4i1}</li>
          <li>{c.p4i2}</li>
        </ul>
      </Section>

      <Section title={c.p5t}>
        <p>
          {c.p5desc.split(c.p5link)[0]}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "underline" }}>
            {c.p5link}
          </a>
          {c.p5desc.split(c.p5link)[1]}
        </p>
      </Section>

      <Section title={c.contactTitle}>
        <p>{c.contactPrivacy} <a href="mailto:hylee132@gmail.com" style={{ color: "#2563EB" }}>hylee132@gmail.com</a></p>
      </Section>
    </div>
  );
}

function TermsContent({ c, _lang }) {
  return (
    <div>
      <Section title={c.t1t}><p>{c.t1desc}</p></Section>

      <Section title={c.t2t}>
        <ul>
          <li>{c.t2i1}</li>
          <li>{c.t2i2}</li>
          <li>{c.t2i3}</li>
          <li>{c.t2i4}</li>
        </ul>
      </Section>

      <Section title={c.t3t}>
        <div style={{ padding: "14px 18px", background: "#EFF6FF", borderRadius: 10, borderLeft: "4px solid #3B82F6", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#1E3A5F", lineHeight: 1.7 }}>
            <strong>Google API </strong>{c.t3notice}
          </p>
        </div>
        <ul>
          <li>{c.t3i1}</li>
          <li>{c.t3i2}</li>
        </ul>
      </Section>

      <Section title={c.t4t}>
        <p>{c.t4intro}</p>
        <ul>
          <li>{c.t4i1}</li>
          <li>{c.t4i2}</li>
          <li>{c.t4i3}</li>
          <li>{c.t4i4}</li>
        </ul>
      </Section>

      <Section title={c.t5t}>
        <p>
          {c.t5desc.split(c.t5link)[0]}
          <a href="/privacy" style={{ color: "#2563EB", textDecoration: "underline" }}>{c.t5link}</a>
          {c.t5desc.split(c.t5link)[1]}
        </p>
      </Section>

      <Section title={c.contactTitle}>
        <p>{c.contactTerms} <a href="mailto:hylee132@gmail.com" style={{ color: "#2563EB" }}>hylee132@gmail.com</a></p>
      </Section>
    </div>
  );
}
