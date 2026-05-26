/**
 * ALPHA-HELIX 이력서 HTML 생성기
 * partnerData + portfolioItems → 인쇄용 HTML 문자열 반환
 * 브라우저 window.print() → PDF 저장
 */

const DEV_LEVEL_KO = {
  JUNIOR_1_3Y: "주니어 개발자",
  MIDDLE_3_5Y: "미들 개발자",
  SENIOR_5_7Y: "시니어 개발자",
  EXPERT_7Y_PLUS: "엑스퍼트 개발자",
};
const DEV_LEVEL_EN = {
  JUNIOR_1_3Y: "Junior Developer",
  MIDDLE_3_5Y: "Mid-level Developer",
  SENIOR_5_7Y: "Senior Developer",
  EXPERT_7Y_PLUS: "Expert Developer",
};

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function portfolioLink(sourceKey) {
  const origin = (typeof window !== "undefined" && window.location?.origin) || "";
  return `${origin}/portfolio_project_preview?sourceKey=${encodeURIComponent(sourceKey)}`;
}

// ── 영문 HTML ────────────────────────────────────────────────────
function buildEnHtml(data, logoUrl) {
  const {
    name, username, shortBio,
    devLevel, serviceField,
    skills = [], careers = [], educations = [],
    certifications = [], awards = [], portfolioItems = [],
  } = data;

  const displayName = name || (username ? `@${username}` : "ALPHA-HELIX User");
  const roleLabel = DEV_LEVEL_EN[devLevel] || (serviceField || "Developer");
  const email = username ? `${username}@Alpha-Helix.io` : "";
  const website = username ? `Alpha-Helix.io/@${username}` : "Alpha-Helix.io";

  const portfolioRows = portfolioItems.map((p) => {
    const tags = Array.isArray(p.techTags) ? p.techTags.join(", ") : "";
    const link = p.sourceKey ? portfolioLink(p.sourceKey) : "";
    const role = esc(p.role || p.period || "");
    return `
      <tr>
        <td style="padding:5px 0 5px 20px; vertical-align:top;">
          <strong style="font-size:10.5pt;">${esc(p.title)}</strong>
          ${role ? `<span style="color:#666; font-style:italic; margin-left:8px;">${role}</span>` : ""}
          <br/>
          ${tags ? `<span style="color:#3060a0; font-size:9pt;">Tech: ${esc(tags)}</span>` : ""}
        </td>
        <td style="padding:5px 0; text-align:right; vertical-align:top; font-size:8.5pt; white-space:nowrap;">
          ${link ? `<a href="${link}" style="color:#3060a0;">${link}</a>` : ""}
        </td>
      </tr>`;
  }).join("");

  const careerRows = careers.map((c) => {
    const company = esc(c.companyName || c.company || "");
    const jobTitle = esc(c.jobTitle || c.role || "");
    const period = c.startDate
      ? `${c.startDate.replace(/-/g, ".")} – ${c.isCurrent ? "Present" : (c.endDate || "").replace(/-/g, ".")}`
      : esc(c.period || "");
    const desc = esc(c.description || c.desc || "");
    return `
      <div style="margin-bottom:10px; padding-left:20px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-weight:700; font-size:10.5pt;">${company}</span>
          <span style="font-size:9pt; color:#888;">${period}</span>
        </div>
        <div style="font-size:9.5pt; color:#3060a0; font-style:italic;">${jobTitle}</div>
        ${desc ? `<div style="font-size:9pt; color:#555; margin-top:3px;">○ ${desc}</div>` : ""}
      </div>`;
  }).join("");

  const eduRows = educations.map((e) => {
    const school = esc(e.schoolName || e.school || "");
    const degree = esc(e.degree || "");
    const major = esc(e.major || "");
    const period = e.startYear
      ? `${e.startYear}–${e.endYear || "Present"}`
      : esc(e.period || "");
    return `
      <div style="margin-bottom:8px; padding-left:20px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:700; font-size:10.5pt;">${school}</span>
          <span style="font-size:9pt; color:#888;">${period}</span>
        </div>
        <div style="font-size:9pt; color:#555;">${[degree, major].filter(Boolean).join(", ")}</div>
      </div>`;
  }).join("");

  const skillItems = skills.map((s) => {
    const sname = esc(s.name || s.skillName || s);
    const level = esc(s.level || "");
    return `${sname}${level ? ` (${level})` : ""}`;
  }).join(",  ");

  const certRows = [...certifications, ...awards].map((c) => {
    const title = esc(c.name || c.title || "");
    const issuer = esc(c.issuer || c.issuingOrganization || "");
    const year = esc(c.year || c.issuedYear || "");
    const desc = esc(c.description || "");
    return `
      <div style="padding-left:20px; margin-bottom:6px;">
        <strong>${title}</strong>${issuer ? `, <em>${issuer}</em>` : ""}${year ? `, ${year}` : ""}
        ${desc ? `<br/><span style="font-size:9pt; color:#555;">○ ${desc}</span>` : ""}
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>ALPHA-HELIX Resume - ${esc(displayName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman','Georgia',serif; color:#2d2d2d; font-size:10pt; line-height:1.5; background:white; }
  .page { max-width:210mm; margin:0 auto; padding:18mm 20mm 18mm 25mm; }
  .section { margin-bottom:14px; }
  .section-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .section-bar { width:30px; height:4px; background:#1a3a6e; border-radius:1px; flex-shrink:0; }
  .section-title { font-size:13pt; font-weight:600; color:#3060a0; font-family:'Times New Roman',serif; }
  hr.rule { border:none; border-top:1px solid #ccc; margin:4px 0 8px; }
  @media print {
    .page { padding:14mm 18mm 14mm 22mm; }
    a { color:#3060a0 !important; }
  }
</style>
</head><body>
<div class="page">

  <!-- ── HEADER ── -->
  <div style="position:relative; min-height:80px; margin-bottom:22px;">
    <!-- ALPHA-HELIX Logo Box (top-right, where photo would go) -->
    <div style="position:absolute; top:0; right:0; width:90px; height:56px; border:1.5px solid #90bcd8; display:flex; align-items:center; justify-content:center; padding:6px; background:#f8fbff;">
      <img src="${esc(logoUrl)}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display='none'"/>
    </div>
    <!-- Name -->
    <h1 style="font-size:28pt; font-weight:400; font-family:'Times New Roman',serif; letter-spacing:0.5px; margin-bottom:10px;">${esc(displayName)}</h1>
    <!-- Contact (right, below logo box) -->
    <div style="position:absolute; top:68px; right:0; text-align:right; font-size:9pt; line-height:1.7; color:#555;">
      <div>Seoul, South Korea</div>
      <div>${esc(roleLabel)}</div>
      <div>✉ ${esc(email)}</div>
      <div>🌐 ${esc(website)}</div>
    </div>
    <!-- Bio -->
    ${shortBio ? `<p style="font-size:9.5pt; color:#555; max-width:360px; font-style:italic;">${esc(shortBio)}</p>` : ""}
  </div>

  <!-- ── PORTFOLIOS ── -->
  ${portfolioItems.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">Portfolios</span>
    </div>
    <hr class="rule"/>
    <p style="font-size:8.5pt; color:#777; margin-bottom:6px;">Selected projects registered on ALPHA-HELIX. Click links to view project details.</p>
    <table style="width:100%; border-collapse:collapse;">
      ${portfolioRows}
    </table>
  </div>` : ""}

  <!-- ── SKILLS ── -->
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">Skills</span>
    </div>
    <hr class="rule"/>
    <div style="padding-left:20px; font-size:9.5pt;">${skillItems}</div>
  </div>` : ""}

  <!-- ── WORK EXPERIENCE ── -->
  ${careers.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">Work Experience</span>
    </div>
    <hr class="rule"/>
    ${careerRows}
  </div>` : ""}

  <!-- ── EDUCATION ── -->
  ${educations.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">Education</span>
    </div>
    <hr class="rule"/>
    ${eduRows}
  </div>` : ""}

  <!-- ── CERTIFICATIONS & HONORS ── -->
  ${(certifications.length + awards.length > 0) ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">Honors, Awards &amp; Certifications</span>
    </div>
    <hr class="rule"/>
    ${certRows}
  </div>` : ""}

  <!-- ── FOOTER ── -->
  <div style="margin-top:18px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:8pt; color:#aaa; text-align:center;">
    Generated by <strong style="color:#3B82F6;">ALPHA-HELIX</strong> · ${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}
  </div>

</div>
</body></html>`;
}

// ── 한글 HTML ────────────────────────────────────────────────────
function buildKoHtml(data, logoUrl) {
  const {
    name, username, shortBio,
    devLevel, serviceField,
    skills = [], careers = [], educations = [],
    certifications = [], awards = [], portfolioItems = [],
  } = data;

  const displayName = name || (username ? `@${username}` : "ALPHA-HELIX 사용자");
  const roleLabel = DEV_LEVEL_KO[devLevel] || (serviceField || "개발자");
  const email = username ? `${username}@Alpha-Helix.io` : "";
  const website = username ? `Alpha-Helix.io/@${username}` : "Alpha-Helix.io";

  const portfolioRows = portfolioItems.map((p) => {
    const tags = Array.isArray(p.techTags) ? p.techTags.join(", ") : "";
    const link = p.sourceKey ? portfolioLink(p.sourceKey) : "";
    const role = esc(p.role || p.period || "");
    return `
      <tr>
        <td style="padding:5px 0 5px 20px; vertical-align:top;">
          <strong style="font-size:10.5pt;">${esc(p.title)}</strong>
          ${role ? `<span style="color:#666; font-style:italic; margin-left:8px;">${role}</span>` : ""}
          <br/>
          ${tags ? `<span style="color:#3060a0; font-size:9pt;">기술스택: ${esc(tags)}</span>` : ""}
        </td>
        <td style="padding:5px 0; text-align:right; vertical-align:top; font-size:8.5pt; white-space:nowrap;">
          ${link ? `<a href="${link}" style="color:#3060a0;">${link}</a>` : ""}
        </td>
      </tr>`;
  }).join("");

  const careerRows = careers.map((c) => {
    const company = esc(c.companyName || c.company || "");
    const jobTitle = esc(c.jobTitle || c.role || "");
    const period = c.startDate
      ? `${c.startDate.replace(/-/g, ".")} – ${c.isCurrent ? "현재" : (c.endDate || "").replace(/-/g, ".")}`
      : esc(c.period || "");
    const desc = esc(c.description || c.desc || "");
    return `
      <div style="margin-bottom:10px; padding-left:20px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-weight:700; font-size:10.5pt;">${company}</span>
          <span style="font-size:9pt; color:#888;">${period}</span>
        </div>
        <div style="font-size:9.5pt; color:#3060a0; font-style:italic;">${jobTitle}</div>
        ${desc ? `<div style="font-size:9pt; color:#555; margin-top:3px;">○ ${desc}</div>` : ""}
      </div>`;
  }).join("");

  const eduRows = educations.map((e) => {
    const school = esc(e.schoolName || e.school || "");
    const degree = esc(e.degree || "");
    const major = esc(e.major || "");
    const period = e.startYear
      ? `${e.startYear}–${e.endYear || "현재"}`
      : esc(e.period || "");
    return `
      <div style="margin-bottom:8px; padding-left:20px;">
        <div style="display:flex; justify-content:space-between;">
          <span style="font-weight:700; font-size:10.5pt;">${school}</span>
          <span style="font-size:9pt; color:#888;">${period}</span>
        </div>
        <div style="font-size:9pt; color:#555;">${[degree, major].filter(Boolean).join(" · ")}</div>
      </div>`;
  }).join("");

  const skillItems = skills.map((s) => {
    const sname = esc(s.name || s.skillName || s);
    const level = esc(s.level || "");
    return `${sname}${level ? ` (${level})` : ""}`;
  }).join(",  ");

  const certRows = [...certifications, ...awards].map((c) => {
    const title = esc(c.name || c.title || "");
    const issuer = esc(c.issuer || c.issuingOrganization || "");
    const year = esc(c.year || c.issuedYear || "");
    const desc = esc(c.description || "");
    return `
      <div style="padding-left:20px; margin-bottom:6px;">
        <strong>${title}</strong>${issuer ? `, <em>${issuer}</em>` : ""}${year ? `, ${year}` : ""}
        ${desc ? `<br/><span style="font-size:9pt; color:#555;">○ ${desc}</span>` : ""}
      </div>`;
  }).join("");

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<title>ALPHA-HELIX 이력서 - ${esc(displayName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Malgun Gothic','Apple SD Gothic Neo','Nanum Gothic',sans-serif; color:#2d2d2d; font-size:10pt; line-height:1.6; background:white; }
  .page { max-width:210mm; margin:0 auto; padding:18mm 20mm 18mm 25mm; }
  .section { margin-bottom:14px; }
  .section-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .section-bar { width:30px; height:4px; background:#1a3a6e; border-radius:1px; flex-shrink:0; }
  .section-title { font-size:13pt; font-weight:700; color:#3060a0; }
  hr.rule { border:none; border-top:1px solid #ccc; margin:4px 0 8px; }
  @media print {
    .page { padding:14mm 18mm 14mm 22mm; }
    a { color:#3060a0 !important; }
  }
</style>
</head><body>
<div class="page">

  <!-- ── 헤더 ── -->
  <div style="position:relative; min-height:80px; margin-bottom:22px;">
    <!-- ALPHA-HELIX 로고 박스 (우상단) -->
    <div style="position:absolute; top:0; right:0; width:90px; height:56px; border:1.5px solid #90bcd8; display:flex; align-items:center; justify-content:center; padding:6px; background:#f8fbff;">
      <img src="${esc(logoUrl)}" style="max-width:100%; max-height:100%; object-fit:contain;" onerror="this.style.display='none'"/>
    </div>
    <!-- 이름 -->
    <h1 style="font-size:28pt; font-weight:700; margin-bottom:10px;">${esc(displayName)}</h1>
    <!-- 연락처 -->
    <div style="position:absolute; top:68px; right:0; text-align:right; font-size:9pt; line-height:1.7; color:#555;">
      <div>서울특별시, 대한민국</div>
      <div>${esc(roleLabel)}</div>
      <div>✉ ${esc(email)}</div>
      <div>🌐 ${esc(website)}</div>
    </div>
    <!-- 자기소개 -->
    ${shortBio ? `<p style="font-size:9.5pt; color:#555; max-width:360px; font-style:italic;">${esc(shortBio)}</p>` : ""}
  </div>

  <!-- ── 포트폴리오 (선발 프로젝트) ── -->
  ${portfolioItems.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">포트폴리오</span>
    </div>
    <hr class="rule"/>
    <p style="font-size:8.5pt; color:#777; margin-bottom:6px;">ALPHA-HELIX에 등록된 포트폴리오 입력 기준으로 자동 표시됩니다. 링크를 클릭하면 상세 내용을 확인할 수 있습니다.</p>
    <table style="width:100%; border-collapse:collapse;">
      ${portfolioRows}
    </table>
  </div>` : ""}

  <!-- ── 기술 스택 ── -->
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">기술 스택</span>
    </div>
    <hr class="rule"/>
    <div style="padding-left:20px; font-size:9.5pt;">${skillItems}</div>
  </div>` : ""}

  <!-- ── 경력 ── -->
  ${careers.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">경력</span>
    </div>
    <hr class="rule"/>
    ${careerRows}
  </div>` : ""}

  <!-- ── 학력 ── -->
  ${educations.length > 0 ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">학력</span>
    </div>
    <hr class="rule"/>
    ${eduRows}
  </div>` : ""}

  <!-- ── 수상 및 자격증 ── -->
  ${(certifications.length + awards.length > 0) ? `
  <div class="section">
    <div class="section-head">
      <div class="section-bar"></div>
      <span class="section-title">수상 및 자격증</span>
    </div>
    <hr class="rule"/>
    ${certRows}
  </div>` : ""}

  <!-- ── 푸터 ── -->
  <div style="margin-top:18px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:8pt; color:#aaa; text-align:center;">
    <strong style="color:#3B82F6;">ALPHA-HELIX</strong>에서 생성된 이력서 · ${today}
  </div>

</div>
</body></html>`;
}

/**
 * 이력서 HTML을 새 창에서 열고 인쇄 다이얼로그를 자동 실행합니다.
 * @param {object} partnerData  - PartnerBannerCard의 partnerData prop
 * @param {string} lang         - "ko" | "en"
 * @param {string} logoUrl      - ALPHA-HELIX 로고 절대 URL (window.location.origin + importedPath)
 */
export function openResumePrintWindow(partnerData, lang, logoUrl) {
  const html = lang === "ko"
    ? buildKoHtml(partnerData, logoUrl)
    : buildEnHtml(partnerData, logoUrl);

  const win = window.open("", "_blank");
  if (!win) {
    alert("팝업 차단이 감지되었습니다. 팝업을 허용해주세요.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // 이미지 로딩 대기 후 인쇄 다이얼로그
  win.onload = () => {
    setTimeout(() => win.print(), 400);
  };
  // fallback
  setTimeout(() => {
    try { win.print(); } catch { /* 이미 인쇄됨 */ }
  }, 1200);
}
