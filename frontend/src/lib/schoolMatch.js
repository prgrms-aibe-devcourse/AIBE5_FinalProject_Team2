/**
 * 학교 도메인 ↔ 학교명 (한/영 alias) 매칭 유틸.
 * AIchatProfile 의 이메일 인증 + PartnerProfile/ClientProfile 의 retroactive
 * 인증 마크 표기 양쪽에서 공용으로 사용.
 *
 * 사용 흐름:
 *   1) 사용자가 학교 이메일 인증 → UserProfileDetail.verifiedEmail 저장.
 *   2) Profile 화면 렌더 시 educations 배열의 각 항목 schoolName 을
 *      verifiedEmail 도메인의 aliases 로 매칭 → 매칭되면 인증 마크.
 *      (entry 자체에 저장된 verifiedSchool 플래그가 없어도 동작)
 */

export const SCHOOL_DOMAIN_MAP = {
  "korea.ac.kr":  { name: "고려대학교",     type: "대학교(4년)", aliases: ["고려대학교", "고려대", "korea university", "ku"] },
  "snu.ac.kr":    { name: "서울대학교",     type: "대학교(4년)", aliases: ["서울대학교", "서울대", "seoul national university", "snu"] },
  "yonsei.ac.kr": { name: "연세대학교",     type: "대학교(4년)", aliases: ["연세대학교", "연세대", "yonsei university"] },
  "kaist.ac.kr":  { name: "KAIST",          type: "대학교(4년)", aliases: ["kaist", "한국과학기술원"] },
  "postech.ac.kr":{ name: "POSTECH",        type: "대학교(4년)", aliases: ["postech", "포항공과대학교", "포스텍"] },
  "hanyang.ac.kr":{ name: "한양대학교",     type: "대학교(4년)", aliases: ["한양대학교", "한양대", "hanyang university"] },
  "skku.edu":     { name: "성균관대학교",   type: "대학교(4년)", aliases: ["성균관대학교", "성균관대", "sungkyunkwan university", "skku"] },
  "sogang.ac.kr": { name: "서강대학교",     type: "대학교(4년)", aliases: ["서강대학교", "서강대", "sogang university"] },
  "cau.ac.kr":    { name: "중앙대학교",     type: "대학교(4년)", aliases: ["중앙대학교", "중앙대", "chung-ang university", "chungang university"] },
  "khu.ac.kr":    { name: "경희대학교",     type: "대학교(4년)", aliases: ["경희대학교", "경희대", "kyung hee university", "kyunghee university"] },
  "unist.ac.kr":  { name: "UNIST",          type: "대학교(4년)", aliases: ["unist", "울산과학기술원"] },
  "ewha.ac.kr":   { name: "이화여자대학교", type: "대학교(4년)", aliases: ["이화여자대학교", "이화여대", "ewha womans university", "ewha university"] },
};

export function lookupSchoolByEmail(email) {
  const domain = String(email || "").split("@")[1]?.toLowerCase() || "";
  if (SCHOOL_DOMAIN_MAP[domain]) return { ...SCHOOL_DOMAIN_MAP[domain], domain };
  if (domain.endsWith(".ac.kr")) {
    const base = domain.split(".")[0];
    return { name: base.toUpperCase() + "대학교", type: "대학교(4년)", aliases: [base], domain };
  }
  return { name: domain, type: "대학교(4년)", aliases: [domain], domain };
}

const normSchoolName = (raw) =>
  String(raw || "").toLowerCase().replace(/\s+/g, "").replace(/대학교|대학원|university/g, "");

/** schoolName 이 verifiedEmail 의 도메인 aliases 와 매칭되는지 */
export function isSchoolMatch(schoolName, verifiedEmail) {
  if (!schoolName || !verifiedEmail) return false;
  const sch = lookupSchoolByEmail(verifiedEmail);
  const aliases = (sch.aliases && sch.aliases.length ? sch.aliases : [sch.name]).map(normSchoolName);
  const norm = normSchoolName(schoolName);
  if (!norm) return false;
  return aliases.some((a) => a && (norm.includes(a) || a.includes(norm)));
}

/**
 * educations 배열에 retroactive 하게 인증 마크 적용.
 * 항목 자체의 verifiedSchool 이 이미 true 면 보존, false/없음이면
 * verifiedEmail 매칭으로 동적 적용.
 */
export function applyVerifiedSchool(educations, verifiedEmail, verifiedEmailType) {
  if (!Array.isArray(educations)) return educations || [];
  if (!verifiedEmail || verifiedEmailType !== "school") return educations;
  return educations.map((e) => {
    if (e?.verifiedSchool) return e;
    if (isSchoolMatch(e?.schoolName, verifiedEmail)) {
      return { ...e, verifiedSchool: true, verifiedEmail };
    }
    return e;
  });
}
