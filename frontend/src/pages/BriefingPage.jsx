import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, RefreshCw, ShieldCheck, Activity, ArrowRight,
  AlertCircle, Clock, Globe, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, Radio, Square, Newspaper, Layers, Briefcase,
} from "lucide-react";
import { listWorkspaces, getWorkspace, runBriefing } from "../alpha/alphaApi";
import { useTheme } from "../alpha/ThemeContext";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const COOLDOWN_MS = 3 * 60 * 60 * 1000;
const cacheKey = (id) => `alpha.briefing.cache.${id}`;

// ── 자동 생성 시간창(미국장 ET 기준) ───────────────────────────────────────
// 대표 3회: 개장 09:30 / 마감 16:00 / 개장+7h 16:30
// 그 외 2회: 개장+2h 11:30 / 마감-1h 15:00
// 페이지 진입 시 "현재 시각 이하의 가장 최근 창" 이후로 캐시가 오래됐을 때만 재생성 →
// 매 방문마다 다중 생성으로 Anthropic 429 가 나던 문제 방지.
const PRIMARY_WINDOWS = [9 * 60 + 30, 16 * 60, 16 * 60 + 30];
const OTHER_WINDOWS   = [11 * 60 + 30, 15 * 60];

// ET(America/New_York) 기준 시각 파츠 — Intl 이 DST 를 자동 처리.
function etParts(d) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false,
    weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(p.hour, 10);
  if (hour === 24) hour = 0;
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: wdMap[p.weekday] ?? 0, minutes: hour * 60 + parseInt(p.minute, 10) };
}

// 마지막 생성(epoch) 이후 새 시간창이 지났으면 true. 주말·첫 창 이전이면 false(캐시 유지).
function shouldRegen(isPrimary, lastGenTs) {
  const now = etParts(new Date());
  if (now.weekday === 0 || now.weekday === 6) return false;   // 주말 자동생성 안 함
  const windows = (isPrimary ? PRIMARY_WINDOWS : OTHER_WINDOWS).slice().sort((a, b) => a - b);
  let win = -1;
  for (const w of windows) { if (now.minutes >= w) win = w; }
  if (win < 0) return false;                                   // 오늘 첫 창 이전
  if (!lastGenTs) return true;
  const gen = etParts(new Date(lastGenTs));
  if (gen.day !== now.day) return true;                        // 다른 날 생성분
  return gen.minutes < win;                                    // 같은 날, 이 창 이전 생성분
}

const HEALTH_CONFIG = {
  GOOD:    { color: "#15803D", bg: "#DCFCE7", border: "#86EFAC", label: "✅ GOOD" },
  WATCH:   { color: "#B45309", bg: "#FEF9C3", border: "#FCD34D", label: "⚠️ WATCH" },
  WARNING: { color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5", label: "🔴 WARNING" },
};

function extractAssets(cfg) {
  if (!cfg) return [];
  const cand = cfg.assets || cfg.tickers || cfg.symbols || cfg.universe || cfg.portfolio?.assets || [];
  let arr = [];
  if (Array.isArray(cand)) arr = cand.map(x => (typeof x === "string" ? x : x?.ticker || x?.symbol || "")).filter(Boolean);
  else if (typeof cand === "string") arr = cand.split(/[,\s/]+/).filter(Boolean);
  return Array.from(new Set(arr)); // 중복 티커 제거 (React key 중복 방지)
}

function extractKeywords(cfg) {
  if (!cfg || typeof cfg !== "object") return [];
  const out = new Set();
  const push = (v) => { if (typeof v === "string" && v.trim() && v.length <= 30) out.add(v.trim()); };
  push(cfg.strategy_type); push(cfg.style); push(cfg.regime); push(cfg.timeframe);
  push(cfg.benchmark); push(cfg.rebalance); push(cfg.signal_type);
  if (Array.isArray(cfg.tags)) cfg.tags.forEach(push);
  if (Array.isArray(cfg.factors)) cfg.factors.forEach(push);
  return Array.from(out).slice(0, 8);
}

// TTS 전달 전 마크다운 문법·인용번호 제거 — 화면 표시는 MarkdownLite가 담당
function stripRefs(text) {
  if (!text) return "";
  return String(text)
    .replace(/\s*\[\d+\]/g, "")           // [1] 인용번호
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")  // **굵게**
    .replace(/\*([^*\n]+)\*/g, "$1")      // *기울임*
    .replace(/`([^`\n]+)`/g, "$1")        // `코드`
    .replace(/^#{1,6}\s+/gm, "")          // # 제목
    .replace(/^[-*+]\s+/gm, "")           // - 목록 기호
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// 경량 인라인 마크다운: **굵게**, `코드`, [1] 인용마커 → 위첨자
function MarkdownLite({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d+\])/g);
  return parts.map((p, i) => {
    const b = p.match(/^\*\*([^*\n]+)\*\*$/);
    if (b) return <strong key={i} style={{ fontWeight: 800 }}>{b[1]}</strong>;
    const c = p.match(/^`([^`\n]+)`$/);
    if (c) return <code key={i} style={{ background: "#E2E8F0", borderRadius: 4, padding: "1px 5px", fontSize: "0.9em" }}>{c[1]}</code>;
    const cite = p.match(/^\[(\d+)\]$/);
    if (cite) return <sup key={i} style={{ color: "#6366F1", fontWeight: 700, fontSize: "0.7em", margin: "0 1px" }}>[{cite[1]}]</sup>;
    return <React.Fragment key={i}>{p.split("\n").map((line, j, arr) => j < arr.length - 1 ? <React.Fragment key={j}>{line}<br /></React.Fragment> : line)}</React.Fragment>;
  });
}

// 타이프라이터 훅
function useTypewriter(text, speed = 28) {
  const [displayed, setDisplayed] = useState("");
  const prevRef = useRef("");
  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    if (prevRef.current === text) return;
    prevRef.current = text;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

// 카드 간 '한 번에 한 개만 재생' 보장 — 현재 재생 중인 카드의 컨트롤 객체를 모듈 레벨로 추적.
// ── 라디오 음성(TTS) 설정 (localStorage 영속) ───────────────────────────
const VOICE_KEY = "alpha.radio.voicePref"; // { voiceURI, lang, rate, pitch }
function loadVoicePref() {
  try { return JSON.parse(localStorage.getItem(VOICE_KEY)) || {}; } catch (_) { return {}; }
}
function saveVoicePref(p) {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(p)); } catch (_) {}
}
// 프리셋(다미/앨리/이든/크리스)별 속도·톤 저장 — 각 이름마다 사용자가 맞춘 값을 기억.
const TUNES_KEY = "alpha.radio.presetTunes"; // { presetKey: { rate, pitch } }
function loadPresetTunes() {
  try { return JSON.parse(localStorage.getItem(TUNES_KEY)) || {}; } catch (_) { return {}; }
}
function savePresetTunes(t) {
  try { localStorage.setItem(TUNES_KEY, JSON.stringify(t)); } catch (_) {}
}
function allVoices() {
  return (typeof window !== "undefined" && window.speechSynthesis) ? (window.speechSynthesis.getVoices() || []) : [];
}
// 저장된 voiceURI 우선 → 없으면 해당 언어의 'Natural/Online/Neural'(고품질) 우선 → 그 언어 → 아무거나
function resolveVoice(pref) {
  const vs = allVoices();
  if (!vs.length) return null;
  if (pref && pref.voiceURI) { const v = vs.find(x => x.voiceURI === pref.voiceURI); if (v) return v; }
  const want = ((pref && pref.lang) || "ko").slice(0, 2).toLowerCase();
  const byLang = vs.filter(v => (v.lang || "").toLowerCase().startsWith(want));
  const pool = byLang.length ? byLang : vs;
  return pool.find(v => /natural|online|neural/i.test(v.name)) || pool[0];
}
// 음성 이름으로 성별 추정 — 브라우저 TTS 는 성별 메타가 없어 이름 키워드 휴리스틱.
function voiceGender(v) {
  const n = (((v && v.name) || "") + " " + ((v && v.voiceURI) || "")).toLowerCase();
  if (/female|여성|woman|heami|yuna|sora|nanami|kyoko|mizuki|aria|zira|hazel|samantha|jenny|michelle|nuri|seoyeon|jihye|sun-?hi/i.test(n)) return "female";
  if (/\bmale\b|남성|\bman\b|david|mark|\bguy\b|ryan|injoon|in-?joon|hyunsu|brian|george|james|daniel|fred|aaron/i.test(n)) return "male";
  return "unknown";
}
// 성별(여/남) + 언어필터에 맞는 최적 음성 — 'Natural/Online/Neural'(고품질) 우선.
function pickVoiceFor(voices, gender, langFilter) {
  const pool = voices.filter(v => langFilter === "all" ? true : (v.lang || "").toLowerCase().startsWith(langFilter));
  const base = pool.length ? pool : voices;
  const matches = base.filter(v => voiceGender(v) === gender);
  const ranked = (matches.length ? matches : base).slice().sort((a, b) =>
    (/natural|online|neural/i.test(a.name) ? 0 : 1) - (/natural|online|neural/i.test(b.name) ? 0 : 1));
  return ranked[0] || null;
}

let currentRadio = null;

// 10분 라디오 — 브라우저 TTS(SpeechSynthesis). 긴 스크립트는 문장단위로 끊어
// 재생(크롬의 ~15초 끊김 우회). ko-KR 음성 자동 선택. 다른 카드 재생 시 이전 카드 상태도 정상 종료.
function useRadio(script) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  // 렌더마다 동일한 안정적 상태 컨테이너 (모듈레벨 소유권 비교용)
  const ctrlRef = useRef(null);
  if (!ctrlRef.current) ctrlRef.current = { chunks: [], idx: 0, stopped: false, setPlaying: null };
  const ctrl = ctrlRef.current;
  ctrl.setPlaying = setPlaying;

  const pickVoice = () => (supported ? resolveVoice(loadVoicePref()) : null);

  const speakNext = () => {
    if (ctrl.stopped || currentRadio !== ctrl) return;
    if (ctrl.idx >= ctrl.chunks.length) { ctrl.setPlaying(false); if (currentRadio === ctrl) currentRadio = null; return; }
    const pref = loadVoicePref();
    const u = new SpeechSynthesisUtterance(ctrl.chunks[ctrl.idx]);
    const v = resolveVoice(pref);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = pref.lang || "ko-KR"; }
    u.rate = pref.rate || 1.02; u.pitch = pref.pitch || 1.0;
    u.onend = () => { if (currentRadio !== ctrl) return; ctrl.idx++; speakNext(); };
    u.onerror = () => { ctrl.setPlaying(false); if (currentRadio === ctrl) currentRadio = null; };
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    ctrl.stopped = true;
    if (currentRadio === ctrl) currentRadio = null;
    if (supported) window.speechSynthesis.cancel();
    ctrl.setPlaying(false);
  };

  // 언마운트 시: 이 카드가 재생 중일 때만 정지 (다른 카드 재생을 끊지 않음)
  useEffect(() => () => {
    if (currentRadio === ctrl) { currentRadio = null; if (supported) window.speechSynthesis.cancel(); }
  }, [supported]);

  const play = () => {
    if (!supported || !script) return;
    // 다른 카드가 재생 중이면 먼저 그 카드 상태를 정상 종료
    if (currentRadio && currentRadio !== ctrl) {
      const prev = currentRadio;
      prev.stopped = true;
      if (prev.setPlaying) prev.setPlaying(false);
    }
    ctrl.chunks = stripRefs(String(script)).split(/(?<=[.!?。…])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    ctrl.idx = 0;
    ctrl.stopped = false;
    currentRadio = ctrl;                 // 소유권을 cancel 이전에 선점 → 이전 카드 onend 가 무시됨
    window.speechSynthesis.cancel();
    setPlaying(true);
    // 일부 브라우저는 첫 getVoices()가 빈 배열 → 약간 지연 후 시작
    if (!pickVoice()) setTimeout(speakNext, 120); else speakNext();
  };

  return { supported, playing, play, stop };
}

// 카운트다운 타이머
function Countdown({ generatedAt }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const update = () => setLeft(Math.max(0, COOLDOWN_MS - (Date.now() - generatedAt)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [generatedAt]);
  if (left <= 0) return <span style={{ fontSize: 11, color: "#22C55E", fontWeight: 600 }}>갱신 가능</span>;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span style={{ fontSize: 11, color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 3 }}>
      <Clock size={10} />
      {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")} 후 갱신
    </span>
  );
}

// 등락 방향 색/아이콘
function changeTone(change) {
  const s = String(change ?? "");
  const neg = /[-▼]/.test(s) || /하락|down/i.test(s);
  const pos = /[+▲]/.test(s) || /상승|up/i.test(s);
  if (neg && !pos) return { color: "#DC2626", Icon: TrendingDown };
  if (pos) return { color: "#16A34A", Icon: TrendingUp };
  return { color: "#64748B", Icon: Minus };
}

// 종목 코멘트 정서 색
const SENTIMENT = {
  긍정: { color: "#16A34A", dot: "#22C55E" }, positive: { color: "#16A34A", dot: "#22C55E" },
  부정: { color: "#DC2626", dot: "#EF4444" }, negative: { color: "#DC2626", dot: "#EF4444" },
  중립: { color: "#64748B", dot: "#94A3B8" }, neutral: { color: "#64748B", dot: "#94A3B8" },
};

// 섹션 소제목
function SectionTitle({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "#334155", margin: "16px 0 9px" }}>
      <Icon size={14} color="#6366F1" /> {children}
    </div>
  );
}

// 라디오 음성/언어 설정 팝업 (라디오 버튼 우클릭으로 열림)
function RadioSettingsPopup({ onClose }) {
  const initPref = loadVoicePref();
  const [voices, setVoices] = useState(allVoices());
  const [pref, setPref] = useState({
    voiceURI: initPref.voiceURI || "", lang: initPref.lang || "ko",
    rate: initPref.rate || 1.02, pitch: initPref.pitch || 1.0,
  });
  const [langFilter, setLangFilter] = useState(
    (initPref.lang || "ko").startsWith("en") ? "en" : "ko"
  );
  const [activePreset, setActivePreset] = useState(initPref.preset || "");
  const [tunes, setTunes] = useState(loadPresetTunes());

  useEffect(() => {
    const load = () => setVoices(allVoices());
    load();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
      return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch (_) {} };
    }
  }, []);

  const filtered = voices.filter(v => langFilter === "all" ? true : (v.lang || "").toLowerCase().startsWith(langFilter));

  const apply = (next) => { const merged = { ...pref, ...next }; setPref(merged); saveVoicePref(merged); };

  // 음성 프리셋 — 이름(다미·앨리·이든·크리스). 누르면 그 목소리(성별 매칭) + 저장된 속도·톤 적용.
  // 한·영 모두 자연스러운 이름이라 langFilter=en 이면 같은 성별의 영어 음성으로 매칭된다.
  const PRESETS = [
    { key: "dami",  label: "다미",   gender: "female", rate: 1.12, pitch: 1.12 },
    { key: "ellie", label: "앨리",   gender: "female", rate: 0.96, pitch: 1.02 },
    { key: "eden",  label: "이든",   gender: "male",   rate: 1.10, pitch: 0.96 },
    { key: "chris", label: "크리스", gender: "male",   rate: 0.92, pitch: 0.86 },
  ];
  const applyPreset = (p) => {
    const v = pickVoiceFor(voices, p.gender, langFilter);
    const tune = tunes[p.key] || { rate: p.rate, pitch: p.pitch };   // 저장된 튠 우선, 없으면 기본
    setActivePreset(p.key);
    const merged = { ...pref, rate: tune.rate, pitch: tune.pitch, preset: p.key };
    if (v) { merged.voiceURI = v.voiceURI; merged.lang = (v.lang || "ko").slice(0, 2); }
    setPref(merged); saveVoicePref(merged);
  };
  // 슬라이더 조절 — 활성 프리셋이 있으면 그 프리셋의 속도·톤으로 저장(다음에 그 이름 누르면 복원).
  const tuneRatePitch = (next) => {
    const merged = { ...pref, ...next };
    setPref(merged); saveVoicePref(merged);
    if (activePreset) {
      const t = { ...tunes, [activePreset]: { rate: merged.rate, pitch: merged.pitch } };
      setTunes(t); savePresetTunes(t);
    }
  };

  const preview = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const v = resolveVoice(pref);
    const isEn = (v?.lang || pref.lang || "ko").toLowerCase().startsWith("en");
    const u = new SpeechSynthesisUtterance(isEn
      ? "Hello, this is your personal market radio briefing."
      : "안녕하세요, 오늘의 라디오 브리핑입니다. 이 음성으로 들려드릴게요.");
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = pref.rate; u.pitch = pref.pitch;
    window.speechSynthesis.speak(u);
  };

  const LANGS = [["ko", "한국어"], ["en", "English"], ["all", "전체"]];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 430, maxWidth: "92vw", maxHeight: "84vh", overflow: "auto", background: "white", borderRadius: 16, padding: "20px 22px", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
            <Radio size={16} color="#7C3AED" /> 라디오 음성·언어 설정
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#94A3B8", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* 언어 필터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {LANGS.map(([k, label]) => (
            <button key={k} onClick={() => setLangFilter(k)} style={{
              flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              border: langFilter === k ? "1.5px solid #7C3AED" : "1px solid #E2E8F0",
              background: langFilter === k ? "#F3E8FF" : "white", color: langFilter === k ? "#6D28D9" : "#64748B",
            }}>{label}</button>
          ))}
        </div>

        {/* 음성 프리셋 — 이름 칩(한 줄). 누르면 그 목소리 + 저장된 속도/톤 적용 */}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>음성 프리셋</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {PRESETS.map(p => {
            const active = activePreset === p.key;
            const cur = pickVoiceFor(voices, p.gender, langFilter);
            return (
              <button key={p.key} onClick={() => applyPreset(p)}
                title={cur ? cur.name : "해당 성별 음성이 없어 속도·톤만 적용돼요"}
                style={{
                  flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 999, whiteSpace: "nowrap",
                  fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  background: active ? "linear-gradient(135deg,#a78bfa,#6366f1)" : "rgba(124,58,237,0.07)",
                  color: active ? "#fff" : "#6D28D9",
                  border: `1px solid ${active ? "transparent" : "rgba(124,58,237,0.2)"}`,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* 음성 목록 */}
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>음성 ({filtered.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 210, overflow: "auto", marginBottom: 14 }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 2px", lineHeight: 1.5 }}>
              이 언어의 음성이 시스템에 없어요. '전체'에서 고르거나, Edge/OS에 음성을 설치하면 나타나요.
            </div>
          )}
          {filtered.map(v => {
            const sel = pref.voiceURI === v.voiceURI;
            const nice = /natural|online|neural/i.test(v.name);
            return (
              <button key={v.voiceURI} onClick={() => apply({ voiceURI: v.voiceURI, lang: (v.lang || "ko").slice(0, 2) })} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", width: "100%",
                padding: "8px 11px", borderRadius: 9, cursor: "pointer",
                border: sel ? "1.5px solid #7C3AED" : "1px solid #E2E8F0", background: sel ? "#FAF5FF" : "white",
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{v.name}</span>
                  {nice && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#15803D", background: "#DCFCE7", borderRadius: 5, padding: "1px 5px" }}>추천</span>}
                  <span style={{ display: "block", fontSize: 10.5, color: "#94A3B8" }}>{v.lang}{v.localService ? "" : " · online"}</span>
                </span>
                {sel && <span style={{ color: "#7C3AED", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* 속도 / 톤 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
            말하기 속도 — {pref.rate.toFixed(2)}x
            <input type="range" min="0.7" max="1.5" step="0.02" value={pref.rate} onChange={e => apply({ rate: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "#7C3AED" }} />
          </label>
          <label style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
            톤(피치) — {pref.pitch.toFixed(2)}
            <input type="range" min="0.6" max="1.4" step="0.02" value={pref.pitch} onChange={e => apply({ pitch: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "#7C3AED" }} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={preview} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#a78bfa,#6366f1)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>▶ 미리듣기</button>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid #E2E8F0", background: "white", color: "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>완료</button>
        </div>
        <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 10, lineHeight: 1.5 }}>
          💡 위 <b>프리셋</b>을 누르면 목소리·속도·톤이 한 번에 맞춰져요. 직접 고르려면 아래 음성과 슬라이더를 조절하세요. (브라우저 무료 음성)
        </div>
      </div>
    </div>
  );
}

// 브리핑 카드 컴포넌트
function BriefingCard({ s, briefingData, busy, onRefresh, onNavigate, t, isPrimary = false }) {
  const [showRefs, setShowRefs] = useState(false);
  const [showVoiceCfg, setShowVoiceCfg] = useState(false);
  const [radioHover, setRadioHover] = useState(false);
  const [showScript, setShowScript] = useState(false);
  // 대표(representative)는 항상 펼침. 그 외 LIVE 는 기본 접힘(배너만) — 클릭으로 펼침.
  const [expanded, setExpanded] = useState(isPrimary);
  useEffect(() => { if (isPrimary) setExpanded(true); }, [isPrimary]);
  const sections = briefingData?.sections;
  const health = sections?.health ? HEALTH_CONFIG[sections.health] : null;
  const twHeadline = useTypewriter(sections?.headline || "");
  const cleanScript = stripRefs(sections?.radioScript);
  const radio = useRadio(cleanScript);

  // 배열 + 원소 가드 (Perplexity JSON 이 null/비객체 원소를 줄 수 있어 렌더 크래시 방지)
  const indices = (Array.isArray(sections?.indices) ? sections.indices : []).filter(x => x && typeof x === "object");
  const sectors = (Array.isArray(sections?.sectors) ? sections.sectors : []).filter(x => x && typeof x === "object");
  const holdings = (Array.isArray(sections?.holdings) ? sections.holdings : []).filter(x => x && typeof x === "object");
  const keywords = (Array.isArray(sections?.keywords) ? sections.keywords : []).filter(Boolean);

  return (
    <section style={{
      background: "white",
      border: "1px solid #E2E8F0",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(15,23,42,0.07)",
    }}>
      {/* 카드 헤더 — 다크 */}
      <div style={{
        padding: "16px 22px",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
      }}>
        <div onClick={() => { if (!isPrimary) setExpanded(v => !v); }}
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: isPrimary ? "default" : "pointer" }}>
          {isPrimary ? (
            <span title="대표 전략" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: "#fde047", background: "rgba(253,224,71,0.15)", border: "1px solid rgba(253,224,71,0.35)", borderRadius: 999, padding: "2px 8px", flexShrink: 0 }}>⭐ 대표</span>
          ) : (
            expanded
              ? <ChevronUp size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              : <ChevronDown size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
          )}
          {s.status === "LIVE" && (
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: "#22C55E",
              display: "inline-block", animation: "briefPulse 1.8s ease-in-out infinite",
              boxShadow: "0 0 0 3px rgba(34,197,94,0.25)",
            }} />
          )}
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "white" }}>{s.name}</h2>
          {s.status === "LIVE" && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#4ADE80", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 999, padding: "2px 7px" }}>
              LIVE
            </span>
          )}
          {s.trust != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#93C5FD", background: "rgba(147,197,253,0.15)", borderRadius: 999, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <ShieldCheck size={10} /> {s.trust}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {sections?.radioScript && radio.supported && (
            <div
              style={{ position: "relative", display: "inline-flex" }}
              onMouseEnter={() => setRadioHover(true)}
              onMouseLeave={() => setRadioHover(false)}
            >
              <button
                onClick={radio.playing ? radio.stop : radio.play}
                onContextMenu={(e) => { e.preventDefault(); setShowVoiceCfg(true); }}
                title="우클릭 → TTS 음성·언어 설정"
                style={{
                  position: "relative",
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 13px", borderRadius: 8,
                  border: radioHover ? "1px solid #fde047" : "1px solid rgba(255,255,255,0.15)",
                  background: radio.playing ? "rgba(239,68,68,0.85)" : "rgba(124,58,237,0.55)",
                  color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  transition: "border-color .2s",
                }}
              >
                {radio.playing ? <><Square size={11} /> 정지</> : <><Radio size={12} /> 10분 라디오</>}
                {/* 노란 그라데이션 코너 액센트 (호버 시 버튼 끝짝) */}
                <span style={{
                  position: "absolute", top: -4, right: -4, width: 13, height: 13, borderRadius: "50%",
                  background: "radial-gradient(circle at 70% 30%, #fef08a, #f59e0b)",
                  opacity: radioHover ? 1 : 0, transition: "opacity .2s",
                  boxShadow: "0 0 8px rgba(245,158,11,0.8)", pointerEvents: "none",
                }} />
              </button>
              {/* 호버 툴팁 */}
              {radioHover && (
                <span style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, whiteSpace: "nowrap", zIndex: 30,
                  background: "linear-gradient(135deg,#1f2937,#374151)", color: "#fde047",
                  fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                }}>
                  🟡 우클릭 → TTS 음성·언어 설정
                </span>
              )}
              {showVoiceCfg && <RadioSettingsPopup onClose={() => setShowVoiceCfg(false)} />}
            </div>
          )}
          <button onClick={onRefresh} disabled={busy} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
            background: busy ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)",
            color: "white", fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer",
            transition: "background 0.2s",
          }}>
            <RefreshCw size={11} style={{ animation: busy ? "briefSpin 0.9s linear infinite" : "none" }} />
            {busy ? t("briefing.generating") : (sections ? t("briefing.regenerate") : t("briefing.generate"))}
          </button>
          <button onClick={onNavigate} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 8, border: "none",
            background: "rgba(99,102,241,0.55)", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            워크스페이스 <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* 에러 — 접힘 상태에서도 항상 표시 */}
      {briefingData?.error && (
        <div style={{ margin: "14px 22px 0", padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10, color: "#991B1B", fontSize: 13 }}>
          ⚠ {briefingData.error}
        </div>
      )}

      {/* 대표=항상 펼침 / 그 외 LIVE=접힘 시 본문 숨김(배너만) */}
      {expanded && (
      <>
      {/* 에셋/키워드 chips */}
      {(s.assets.length > 0 || s.keywords.length > 0) && (
        <div style={{ padding: "10px 22px 0", display: "flex", flexWrap: "wrap", gap: 5 }}>
          {s.assets.slice(0, 8).map(a => (
            <span key={`a-${a}`} style={{ fontSize: 11.5, fontWeight: 700, color: "#0369A1", background: "#E0F2FE", borderRadius: 6, padding: "3px 8px" }}>{a}</span>
          ))}
          {s.keywords.map(k => (
            <span key={`k-${k}`} style={{ fontSize: 11.5, fontWeight: 600, color: "#5B21B6", background: "#EDE9FE", borderRadius: 6, padding: "3px 8px" }}>#{k}</span>
          ))}
        </div>
      )}

      {/* 생성 전 빈 상태 */}
      {!briefingData && !busy && (
        <div style={{ padding: "28px 22px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
          <Sparkles size={22} style={{ marginBottom: 8, opacity: 0.35, display: "block", margin: "0 auto 8px" }} />
          버튼을 눌러 AI가 실시간 시황을 분석하도록 하세요
        </div>
      )}

      {/* 생성 중 로딩 */}
      {busy && !sections && (
        <div style={{ padding: "28px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6366F1", fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={16} style={{ animation: "briefSpin 0.9s linear infinite" }} />
            Perplexity로 실시간 뉴스 수집 후 AI가 브리핑을 작성 중입니다…
          </div>
          <div style={{ marginTop: 10, height: 4, borderRadius: 999, background: "#F1F5F9", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg,#6366F1,#A78BFA)", borderRadius: 999, animation: "briefBar 1.2s ease-in-out infinite alternate" }} />
          </div>
        </div>
      )}

      {/* 구조화된 섹션 출력 */}
      {sections && (
        <div style={{ padding: "18px 22px 0" }}>
          {/* 세션 + 헤드라인 */}
          {sections.sessionLabel && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#F3E8FF", border: "1px solid #E9D5FF", borderRadius: 999, padding: "3px 11px", marginBottom: 10 }}>
              <Clock size={11} /> {sections.sessionLabel}
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", lineHeight: 1.3, marginBottom: 14, minHeight: 30 }}>
            {twHeadline || sections.headline}
          </div>

          {/* 상태 배지 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {health && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "5px 13px", borderRadius: 999,
                color: health.color, background: health.bg, border: `1px solid ${health.border}`,
              }}>
                {health.label}
              </span>
            )}
            {sections.regime && (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999,
                color: "#1E40AF", background: "#EFF6FF", border: "1px solid #BFDBFE",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <Activity size={11} /> {sections.regime}
              </span>
            )}
          </div>

          {/* 오늘의 키워드 */}
          {keywords.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {keywords.map((k, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 700, color: "#3730A3", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 7, padding: "4px 10px" }}>
                  # {k}
                </span>
              ))}
            </div>
          )}

          {/* 현재 시황 요약 */}
          {sections.marketSummary && (
            <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#F8FAFC,#F1F5F9)", borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 14, color: "#0F172A", lineHeight: 1.75 }}>
              <MarkdownLite text={sections.marketSummary} />
            </div>
          )}

          {/* 전체 증시 (지수) */}
          {indices.length > 0 && (
            <>
              <SectionTitle icon={Newspaper}>전체 증시</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 9 }}>
                {indices.map((ix, i) => {
                  const tone = changeTone(ix.change);
                  return (
                    <div key={i} style={{ padding: "11px 13px", background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{ix.name}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
                        {ix.value && <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{ix.value}</span>}
                        {ix.change && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12.5, fontWeight: 700, color: tone.color }}>
                            <tone.Icon size={12} /> {ix.change}
                          </span>
                        )}
                      </div>
                      {ix.comment && <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>{ix.comment}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 섹터별 */}
          {sectors.length > 0 && (
            <>
              <SectionTitle icon={Layers}>섹터별 동향</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {sectors.map((sec, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 13px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#4338CA", flexShrink: 0, minWidth: 64 }}>{sec.name}</span>
                    <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}><MarkdownLite text={sec.comment} /></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 내 종목별 */}
          {holdings.length > 0 && (
            <>
              <SectionTitle icon={Briefcase}>내 포트폴리오 종목별</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {holdings.map((h, i) => {
                  const sent = SENTIMENT[h.sentiment] || SENTIMENT.중립;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "10px 13px", background: "#FFFFFF", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 74 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: sent.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0369A1" }}>{h.ticker}</span>
                      </span>
                      <span style={{ fontSize: 13, color: sent.color, lineHeight: 1.55 }}><MarkdownLite text={h.comment} /></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 라디오 스크립트 (접기/펼치기) */}
          {sections.radioScript && (
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setShowScript(v => !v)} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 700, color: "#7C3AED",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}>
                {showScript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <Radio size={13} /> 라디오 스크립트 {radio.supported ? "" : "(이 브라우저는 음성재생 미지원 — 읽기만)"}
              </button>
              {showScript && (
                <div style={{ marginTop: 8, padding: "13px 15px", background: "#FAF5FF", border: "1px solid #E9D5FF", borderRadius: 10, fontSize: 13, color: "#3B0764", lineHeight: 1.8 }}>
                  <MarkdownLite text={sections.radioScript} />
                </div>
              )}
            </div>
          )}

          {/* 전략/Trust 보조 코멘트 */}
          {(sections.healthComment || sections.regimeComment || sections.trustComment || sections.recommendation) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, margin: "16px 0 0" }}>
              {sections.healthComment && (
                <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>전략 상태</div>
                  <div style={{ fontSize: 13, color: "#0F172A", lineHeight: 1.55 }}><MarkdownLite text={sections.healthComment} /></div>
                </div>
              )}
              {sections.regimeComment && (
                <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>시장 국면</div>
                  <div style={{ fontSize: 13, color: "#0F172A", lineHeight: 1.55 }}><MarkdownLite text={sections.regimeComment} /></div>
                </div>
              )}
              {sections.trustComment && (
                <div style={{ padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Trust Score</div>
                  <div style={{ fontSize: 13, color: "#0F172A", lineHeight: 1.55 }}><MarkdownLite text={sections.trustComment} /></div>
                </div>
              )}
              {sections.recommendation && (
                <div style={{ padding: "12px 14px", background: "#F0FDF4", borderRadius: 10, border: "1px solid #86EFAC" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>✅ 오늘의 체크포인트</div>
                  <div style={{ fontSize: 13, color: "#14532D", lineHeight: 1.55, fontWeight: 600 }}><MarkdownLite text={sections.recommendation} /></div>
                </div>
              )}
            </div>
          )}

          {sections.disclaimer && (
            <div style={{ fontSize: 11, color: "#94A3B8", margin: "14px 0", fontStyle: "italic" }}>
              ⚠ {sections.disclaimer}
            </div>
          )}
        </div>
      )}

      {/* Fallback 평문 브리핑 */}
      {!sections && briefingData?.briefing && (
        <div style={{ margin: "14px 22px 0", padding: "12px 16px", background: "#F8FAFC", borderRadius: 10, fontSize: 13.5, color: "#0F172A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          <MarkdownLite text={briefingData.briefing} />
        </div>
      )}

      {/* Perplexity 실시간 뉴스 출처 */}
      {Array.isArray(briefingData?.liveNews) && briefingData.liveNews.length > 0 && (
        <div style={{ margin: "14px 22px", padding: "11px 14px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0369A1", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
            <Globe size={12} /> 실시간 뉴스 출처 (Perplexity)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {briefingData.liveNews.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "baseline", gap: 7, textDecoration: "none", padding: "1px 0",
              }}>
                <span style={{ fontSize: 11, color: "#0EA5E9", flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, color: "#2563EB", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title || n.url} ↗
                  </span>
                  {n.title && <span style={{ fontSize: 10.5, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.url}</span>}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 분석 근거 출처 (접기/펼치기) */}
      {Array.isArray(briefingData?.references) && briefingData.references.length > 0 && (
        <div style={{ margin: "0 22px 14px" }}>
          <button onClick={() => setShowRefs(r => !r)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11.5, color: "#64748B", fontWeight: 600,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            {showRefs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            📚 분석 근거 출처 ({briefingData.references.length})
          </button>
          {showRefs && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {briefingData.references.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "baseline", gap: 7, textDecoration: "none",
                  padding: "6px 10px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #E2E8F0",
                }}>
                  <span style={{ fontSize: 11, color: "#64748B", flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>{r.title} ↗</span>
                    {r.why && <span style={{ fontSize: 10.5, color: "#64748B", marginTop: 1 }}>{r.why}</span>}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 푸터 — 생성 시각 + 카운트다운 */}
      {briefingData?.generatedAt && (
        <div style={{ padding: "8px 22px 14px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#CBD5E1" }}>
            {new Date(typeof briefingData.generatedAt === "number"
              ? briefingData.generatedAt
              : Date.parse(briefingData.generatedAt)
            ).toLocaleString()} 생성
          </span>
          <Countdown generatedAt={typeof briefingData.generatedAt === "number"
            ? briefingData.generatedAt
            : Date.parse(briefingData.generatedAt)} />
        </div>
      )}
      </>
      )}
    </section>
  );
}

export default function BriefingPage() {
  const nav = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const username = (typeof window !== "undefined" &&
    (localStorage.getItem("username") || localStorage.getItem("dbName"))) || "trader";

  const [strategies, setStrategies] = useState([]);
  const [briefings, setBriefings] = useState({});
  const [busyIds, setBusyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  // 대표 워크스페이스 — WorkspaceList 와 동일 키/이벤트(localStorage "alpha.primaryWsId").
  const [primaryId, setPrimaryId] = useState(() => {
    const v = localStorage.getItem("alpha.primaryWsId");
    return v ? Number(v) : null;
  });
  useEffect(() => {
    const onPrimary = (e) => setPrimaryId(e?.detail?.id ?? (Number(localStorage.getItem("alpha.primaryWsId")) || null));
    window.addEventListener("alpha:primary-change", onPrimary);
    return () => window.removeEventListener("alpha:primary-change", onPrimary);
  }, []);

  const setBusy = (id, val) =>
    setBusyIds(prev => { const s = new Set(prev); val ? s.add(id) : s.delete(id); return s; });

  const generateOne = async (wsId) => {
    setBusy(wsId, true);
    try {
      const b = await runBriefing(wsId);
      const rec = { ...b, generatedAt: Date.now() };
      setBriefings(prev => ({ ...prev, [wsId]: rec }));
      try { localStorage.setItem(cacheKey(wsId), JSON.stringify(rec)); } catch (_) {}
    } catch (e) {
      setBriefings(prev => ({ ...prev, [wsId]: { error: e?.response?.data?.error || e.message } }));
    } finally {
      setBusy(wsId, false);
    }
  };

  const loadAll = async () => {
    setLoading(true); setErr(null);
    try {
      const list = await listWorkspaces();
      const fulls = await Promise.all(list.map(w => getWorkspace(w.id).catch(() => null)));
      const items = fulls.filter(Boolean).map(w => {
        const cfg = w.strategyConfig || {};
        const trust = (w.lastTrust && typeof w.lastTrust === "object") ? (w.lastTrust.trust_score ?? null) : null;
        const goal = (w.goalProfile && typeof w.goalProfile === "object") ? (w.goalProfile.목표 || w.goalProfile.goal || null) : null;
        return { id: w.id, name: w.name, status: w.status, assets: extractAssets(cfg), keywords: extractKeywords(cfg), trust, goal };
      });
      setStrategies(items);

      // 캐시 복원
      const cached = {};
      items.forEach(s => {
        try {
          const raw = localStorage.getItem(cacheKey(s.id));
          if (raw) cached[s.id] = JSON.parse(raw);
        } catch (_) {}
      });
      setBriefings(cached);

      // 캐시 없거나 만료된 워크스페이스만 자동 생성. 표시 대상(LIVE 우선)에 한정하고,
      // 각 ~1분 걸리는 Perplexity 호출이 동시에 폭주하지 않도록 '순차'(await)로 한 개씩 실행.
      const liveItems = items.filter(s => s.status === "LIVE");
      const target = liveItems.length > 0 ? liveItems : items;
      // 시간창 게이팅: 대표 3회/그 외 2회 창을 넘겼고 캐시가 그 창 이전일 때만 생성.
      const stale = target.filter(s => {
        const b = cached[s.id];
        const ts = b?.generatedAt ? (typeof b.generatedAt === "number" ? b.generatedAt : Date.parse(b.generatedAt)) : 0;
        return shouldRegen(s.id === primaryId, ts);
      });
      for (let i = 0; i < stale.length; i++) {
        await generateOne(stale[i].id);   // 순차: 한 번에 하나씩 (동시 폭주 방지)
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshOne = (wsId) => {
    const existing = briefings[wsId];
    const generatedAt = existing?.generatedAt;
    const ts = typeof generatedAt === "number" ? generatedAt : Date.parse(generatedAt);
    if (ts && Date.now() - ts < COOLDOWN_MS) {
      const remainMin = Math.ceil((COOLDOWN_MS - (Date.now() - ts)) / 60000);
      const h = Math.floor(remainMin / 60), m = remainMin % 60;
      const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
      alert(t("briefing.cooldownAlert", { time }));
      return;
    }
    generateOne(wsId);
  };

  useEffect(() => { loadAll(); }, []);

  const liveOnly = strategies.filter(s => s.status === "LIVE");
  const baseList = liveOnly.length > 0 ? liveOnly : strategies;
  // 대표를 맨 앞으로 정렬 (대표=펼침, 나머지=접힘).
  const showList = [...baseList].sort((a, b) =>
    (b.id === primaryId ? 1 : 0) - (a.id === primaryId ? 1 : 0));

  return (
    <div style={{ padding: "36px 40px 80px", background: "#F1F5F9", minHeight: "calc(100vh - 44px)", fontFamily: F, color: "#0F172A" }}>
      <style>{`
        @keyframes briefSpin { to { transform: rotate(360deg); } }
        @keyframes briefPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); } 60% { box-shadow: 0 0 0 7px rgba(34,197,94,0); } }
        @keyframes briefBar { from { transform: translateX(-30%); } to { transform: translateX(80%); } }
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28 }}>
        <div style={{
          width: 54, height: 54, borderRadius: 17, flexShrink: 0,
          background: "linear-gradient(135deg,#a78bfa 0%,#6366f1 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
        }}>
          <Sparkles size={24} color="white" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
            background: "linear-gradient(90deg,#6366f1 0%,#a78bfa 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {t("briefing.title")}
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
            {t("briefing.subtitle", { name: username })}
          </p>
        </div>
        <button onClick={loadAll} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 14px", borderRadius: 9, border: "1px solid #E5E7EB",
          background: "white", color: "#0F172A", fontSize: 13, fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
        }}>
          <RefreshCw size={14} style={{ animation: loading ? "briefSpin 0.9s linear infinite" : "none" }} />
          {loading ? t("briefing.loading") : t("briefing.refresh")}
        </button>
      </div>

      {err && (
        <div style={{ padding: "12px 16px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {!loading && strategies.length === 0 && (
        <div style={{ padding: 28, background: "white", border: "1px solid #E2E8F0", borderRadius: 16, textAlign: "center" }}>
          <AlertCircle size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, color: "#475569", marginBottom: 14 }}>{t("briefing.noWorkspace")}</div>
          <button onClick={() => nav("/alpha?new=1")} style={{
            padding: "10px 18px", borderRadius: 9, border: "none",
            background: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <ArrowRight size={14} /> {t("briefing.createWorkspace")}
          </button>
        </div>
      )}

      {!loading && strategies.length > 0 && liveOnly.length === 0 && (
        <div style={{ padding: "12px 16px", background: "#FEF9C3", border: "1px solid #FCD34D", borderRadius: 10, color: "#713f12", fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
          {t("briefing.noLive")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
        {showList.map(s => (
          <BriefingCard
            key={s.id}
            s={s}
            briefingData={briefings[s.id]}
            busy={busyIds.has(s.id)}
            onRefresh={() => handleRefreshOne(s.id)}
            onNavigate={() => nav(`/alpha/w/${s.id}`)}
            t={t}
            isPrimary={s.id === primaryId}
          />
        ))}
      </div>
    </div>
  );
}
