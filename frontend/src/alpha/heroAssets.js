// Alpha-Helix 사용자 아바타(Hero) 자산 인덱스
// LeftSidebar 드롭다운/ChatPanel 어시스턴트 아바타에서 공통 사용
import hero from "../assets/hero.png";
import heroDefault from "../assets/hero_default.png";
import heroCheck from "../assets/hero_check.png";
import heroMeeting from "../assets/hero_meeting.png";
import heroMoney from "../assets/hero_money.png";
import heroStudent from "../assets/hero_student.png";
import heroTeacher from "../assets/hero_teacher.png";
import heroVacation from "../assets/hero_vacation.png";

export const HEROES = [
  { key: "default",  label: "기본",    src: heroDefault },
  { key: "meeting",  label: "미팅",    src: heroMeeting },
  { key: "money",    label: "수익",    src: heroMoney },
  { key: "vacation", label: "휴가",    src: heroVacation },
  { key: "student",  label: "학생",    src: heroStudent },
  { key: "teacher",  label: "선생님",  src: heroTeacher },
  { key: "check",    label: "체크",    src: heroCheck },
  { key: "classic",  label: "클래식",  src: hero },
];

const LS_KEY = "alpha.heroKey";

export function getCurrentHeroKey() {
  try { return localStorage.getItem(LS_KEY) || "default"; }
  catch { return "default"; }
}

export function getCurrentHeroSrc() {
  const k = getCurrentHeroKey();
  return (HEROES.find(h => h.key === k) || HEROES[0]).src;
}

export function setCurrentHeroKey(key) {
  try {
    localStorage.setItem(LS_KEY, key);
    window.dispatchEvent(new CustomEvent("alpha:hero-change", { detail: { key } }));
  } catch { /* ignore */ }
}

// 어시스턴트(AI 매니저) 전용 아바타 — 항상 teacher 고정
export const ASSISTANT_HERO_SRC = heroTeacher;
