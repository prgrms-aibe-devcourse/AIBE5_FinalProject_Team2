import { useState, useEffect, useMemo } from "react";
import {
  X, Search, Settings as SettingsIcon, Palette, Layout, Bell, Globe,
  Keyboard, Code, Sparkles, ShieldCheck, User, Maximize2,
} from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

/**
 * VS Code 스타일 설정 모달
 * - 좌측: 카테고리 트리
 * - 우측: 설정 항목 패널
 * - 상단: 검색 + 사용자/작업영역 탭
 * - localStorage 에 키별로 저장 (ah.settings.*)
 *
 * Theme 변경은 LeftSidebar 가 가진 ThemePalette 와는 별도 — 여기는 일반 환경설정만.
 */

const CATEGORIES = [
  {
    key: "general",
    label: "일반",
    Icon: SettingsIcon,
    sub: [
      { key: "startup", label: "시작" },
      { key: "language", label: "언어" },
    ],
  },
  {
    key: "editor",
    label: "텍스트 편집기",
    Icon: Code,
    sub: [
      { key: "font", label: "글꼴" },
      { key: "format", label: "서식" },
      { key: "minimap", label: "미니맵" },
    ],
  },
  {
    key: "workbench",
    label: "워크벤치",
    Icon: Layout,
    sub: [
      { key: "layout", label: "레이아웃" },
      { key: "appearance", label: "모양" },
    ],
  },
  { key: "window", label: "창", Icon: Maximize2 },
  { key: "chat", label: "채팅 / AI", Icon: Sparkles },
  { key: "notify", label: "알림", Icon: Bell },
  { key: "shortcut", label: "바로 가기 키", Icon: Keyboard },
  { key: "security", label: "보안", Icon: ShieldCheck },
  { key: "account", label: "계정", Icon: User },
];

// 설정 정의 (key: localStorage 키, type, default, options 등)
const SETTINGS = [
  // general / startup
  { cat: "general", group: "시작", key: "ah.startup.openLastWs", label: "마지막 워크스페이스 자동 열기",
    desc: "앱 시작 시 마지막으로 사용한 Alpha-Helix 워크스페이스를 자동으로 엽니다.",
    type: "boolean", def: true },
  { cat: "general", group: "시작", key: "ah.startup.showLanding", label: "랜딩 페이지 표시",
    desc: "로그인 후에도 랜딩 페이지를 먼저 보여줍니다.", type: "boolean", def: false },

  // general / language
  { cat: "general", group: "언어", key: "ah.lang.code", label: "표시 언어",
    desc: "UI 표시 언어를 변경합니다. 일부 화면은 재진입 후 반영됩니다.",
    type: "select", def: "ko",
    options: [
      { value: "ko", label: "한국어" },
      { value: "en", label: "English" },
      { value: "jp", label: "日本語" },
      { value: "zh", label: "中文" },
    ],
    syncWith: "language",
  },

  // editor / font
  { cat: "editor", group: "글꼴", key: "ah.editor.fontSize", label: "글꼴 크기 (px)",
    desc: "코드/텍스트 편집 영역의 기본 글꼴 크기입니다.", type: "number", def: 14, min: 10, max: 28 },
  { cat: "editor", group: "글꼴", key: "ah.editor.fontFamily", label: "글꼴",
    desc: "편집기에서 사용할 글꼴을 지정합니다.", type: "string", def: "JetBrains Mono, Consolas, monospace" },
  { cat: "editor", group: "글꼴", key: "ah.editor.variableFonts", label: "변수 글꼴 사용 허용",
    desc: "편집기에서 가변 글꼴(variable fonts) 사용을 허용합니다.", type: "boolean", def: true },

  // editor / format
  { cat: "editor", group: "서식", key: "ah.editor.tabSize", label: "Tab 크기",
    desc: "한 Tab 이 차지하는 공백 수입니다.", type: "number", def: 2, min: 1, max: 8 },
  { cat: "editor", group: "서식", key: "ah.editor.insertSpaces", label: "Tab → 공백 변환",
    desc: "Tab 입력 시 공백 문자로 변환합니다.", type: "boolean", def: true },
  { cat: "editor", group: "서식", key: "ah.editor.wordWrap", label: "자동 줄바꿈",
    desc: "긴 줄을 화면 너비에 맞춰 자동으로 줄바꿈합니다.", type: "boolean", def: false },

  // editor / minimap
  { cat: "editor", group: "미니맵", key: "ah.editor.minimap", label: "미니맵 표시",
    desc: "편집기 우측에 미니맵을 표시합니다.", type: "boolean", def: true },

  // workbench / layout
  { cat: "workbench", group: "레이아웃", key: "ah.workbench.compact", label: "컴팩트 모드",
    desc: "좌측 사이드바와 상단바를 더 좁게 표시합니다.", type: "boolean", def: false },
  { cat: "workbench", group: "레이아웃", key: "ah.workbench.guideAutoOpen", label: "이용 가이드 자동 열기",
    desc: "처음 방문 시 이용 가이드 도크를 자동으로 엽니다.", type: "boolean", def: false },

  // workbench / appearance
  { cat: "workbench", group: "모양", key: "ah.workbench.density", label: "표시 밀도",
    desc: "리스트/카드의 여백 밀도를 조절합니다.",
    type: "select", def: "comfortable",
    options: [
      { value: "compact", label: "Compact (조밀)" },
      { value: "comfortable", label: "Comfortable (보통)" },
      { value: "spacious", label: "Spacious (여유)" },
    ] },

  // window
  { cat: "window", group: null, key: "ah.window.openInNewTab", label: "외부 링크 새 탭으로 열기",
    desc: "외부 사이트 링크를 새 탭에서 엽니다.", type: "boolean", def: true },

  // chat / ai
  { cat: "chat", group: null, key: "ah.chat.streaming", label: "AI 응답 스트리밍",
    desc: "AI 답변을 토큰 단위로 실시간 표시합니다.", type: "boolean", def: true },
  { cat: "chat", group: null, key: "ah.chat.sendOnEnter", label: "Enter 로 전송",
    desc: "끄면 Shift+Enter 가 전송이 됩니다.", type: "boolean", def: true },
  { cat: "chat", group: null, key: "ah.chat.model", label: "기본 AI 모델",
    desc: "전략 챗에서 기본으로 사용할 모델입니다.",
    type: "select", def: "gemini-2.0-flash",
    options: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (빠름)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (정확)" },
    ] },

  // notify
  { cat: "notify", group: null, key: "ah.notify.desktop", label: "데스크톱 알림",
    desc: "백테스트 완료/주문 체결 등 알림을 데스크톱에 띄웁니다.", type: "boolean", def: false },
  { cat: "notify", group: null, key: "ah.notify.sound", label: "알림 소리",
    desc: "주요 이벤트 발생 시 소리 알림을 사용합니다.", type: "boolean", def: false },

  // shortcut (조회용)
  { cat: "shortcut", group: null, key: "__readonly__shortcuts", label: "주요 단축키", type: "info",
    desc: "Ctrl+K: 명령 팔레트 / Ctrl+B: 사이드바 토글 / Ctrl+/: AI 채팅 토글 / Ctrl+,: 설정" },

  // security
  { cat: "security", group: null, key: "ah.security.lockOnIdle", label: "유휴 시 자동 잠금",
    desc: "10분간 활동이 없으면 화면을 잠그고 다시 로그인하도록 요구합니다.", type: "boolean", def: false },
  { cat: "security", group: null, key: "ah.security.maskKeys", label: "API 키 마스킹",
    desc: "API/시크릿 키를 표시할 때 일부만 보입니다.", type: "boolean", def: true },

  // account (info only)
  { cat: "account", group: null, key: "__readonly__account", label: "계정 정보", type: "info",
    desc: "프로필 보기에서 상세한 계정 정보를 확인할 수 있습니다." },
];

function readVal(s) {
  try {
    const raw = localStorage.getItem(s.key);
    if (raw === null || raw === undefined) return s.def;
    if (s.type === "boolean") return raw === "true";
    if (s.type === "number") { const n = Number(raw); return Number.isFinite(n) ? n : s.def; }
    return raw;
  } catch { return s.def; }
}

function writeVal(s, v) {
  try { localStorage.setItem(s.key, String(v)); } catch (_) {}
}

export default function SettingsModal({ open, onClose }) {
  const [activeCat, setActiveCat] = useState("general");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("user"); // user | workspace
  const [tick, setTick] = useState(0); // re-render trigger
  const lang = (() => { try { return useLanguage(); } catch { return null; } })();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS.filter(s => s.cat === activeCat);
    return SETTINGS.filter(s =>
      (s.label && s.label.toLowerCase().includes(q)) ||
      (s.desc && s.desc.toLowerCase().includes(q)) ||
      (s.key && s.key.toLowerCase().includes(q))
    );
  }, [activeCat, query, tick]);

  if (!open) return null;

  const onChange = (s, v) => {
    writeVal(s, v);
    // 언어 동기화
    if (s.syncWith === "language" && lang?.setLang) {
      try { lang.setLang(v); } catch (_) {}
    }
    setTick(t => t + 1);
  };

  // 그룹별로 묶기
  const grouped = visible.reduce((acc, s) => {
    const g = s.group || "_";
    (acc[g] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)", zIndex: 4000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1180px, 96vw)", height: "min(780px, 92vh)",
          background: "#1E1E1E", color: "#CCCCCC",
          borderRadius: 10, boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "'Inter','Pretendard',-apple-system,'Segoe UI',sans-serif",
          border: "1px solid #3C3C3C",
        }}
      >
        {/* 타이틀바 */}
        <div style={{
          height: 36, background: "#252526", borderBottom: "1px solid #3C3C3C",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px", flex: "0 0 auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#CCCCCC" }}>
            <SettingsIcon size={14} />
            <span>설정</span>
          </div>
          <button onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 4, border: "none",
              background: "transparent", color: "#CCCCCC", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#3C3C3C"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <X size={16} />
          </button>
        </div>

        {/* 검색바 + 탭 */}
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid #3C3C3C",
          background: "#252526", flex: "0 0 auto",
        }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#858585" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="설정 검색"
              style={{
                width: "100%", padding: "7px 10px 7px 32px",
                background: "#3C3C3C", border: "1px solid #3C3C3C", color: "#CCCCCC",
                borderRadius: 3, fontSize: 13, outline: "none",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#007ACC"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#3C3C3C"}
            />
          </div>
          <div style={{ display: "flex", gap: 4, fontSize: 12 }}>
            {[
              { k: "user", label: "사용자" },
              { k: "workspace", label: "작업 영역" },
            ].map(t => (
              <button key={t.k} onClick={() => setScope(t.k)}
                style={{
                  padding: "5px 12px", border: "none", cursor: "pointer",
                  background: "transparent", color: scope === t.k ? "#FFFFFF" : "#858585",
                  borderBottom: scope === t.k ? "2px solid #007ACC" : "2px solid transparent",
                  fontSize: 12, fontWeight: scope === t.k ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
            <div style={{ marginLeft: "auto", color: "#858585", fontSize: 11, alignSelf: "center" }}>
              {scope === "workspace" ? "작업 영역 설정은 현재 미사용 — 사용자 설정만 적용됩니다." : ""}
            </div>
          </div>
        </div>

        {/* 본문 — 좌측 카테고리 + 우측 패널 */}
        <div style={{ display: "flex", flex: "1 1 0", minHeight: 0 }}>
          {/* 좌측 카테고리 */}
          <div style={{
            width: 240, background: "#252526", borderRight: "1px solid #3C3C3C",
            overflowY: "auto", padding: "8px 0", flex: "0 0 auto",
          }}>
            {CATEGORIES.map(c => {
              const active = activeCat === c.key && !query;
              return (
                <div key={c.key}>
                  <button onClick={() => { setActiveCat(c.key); setQuery(""); }}
                    style={{
                      width: "100%", textAlign: "left", border: "none",
                      background: active ? "#37373D" : "transparent",
                      color: active ? "#FFFFFF" : "#CCCCCC",
                      padding: "6px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 13, fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#2A2D2E"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <c.Icon size={14} />
                    <span>{c.label}</span>
                  </button>
                  {active && c.sub && c.sub.map(sb => (
                    <div key={sb.key} style={{
                      padding: "4px 12px 4px 34px", fontSize: 12, color: "#858585",
                    }}>
                      {sb.label}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* 우측 설정 패널 */}
          <div style={{
            flex: "1 1 0", overflowY: "auto", padding: "20px 28px", background: "#1E1E1E",
            minWidth: 0,
          }}>
            {!query && (
              <h2 style={{
                fontSize: 22, fontWeight: 600, color: "#FFFFFF", margin: "0 0 18px",
              }}>
                {CATEGORIES.find(c => c.key === activeCat)?.label}
              </h2>
            )}
            {query && (
              <div style={{ fontSize: 13, color: "#858585", marginBottom: 14 }}>
                검색 결과: <b style={{ color: "#CCCCCC" }}>{visible.length}</b>건
              </div>
            )}

            {visible.length === 0 && (
              <div style={{ color: "#858585", fontSize: 13 }}>일치하는 설정이 없습니다.</div>
            )}

            {Object.entries(grouped).map(([gName, items]) => (
              <div key={gName} style={{ marginBottom: 24 }}>
                {gName !== "_" && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#858585",
                    textTransform: "uppercase", letterSpacing: 0.5, margin: "8px 0 12px",
                    borderBottom: "1px solid #3C3C3C", paddingBottom: 6,
                  }}>
                    {gName}
                  </div>
                )}
                {items.map(s => (
                  <SettingRow key={s.key} s={s} value={readVal(s)} onChange={(v) => onChange(s, v)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ s, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", marginBottom: 4 }}>
        {s.label}
      </div>
      {s.desc && (
        <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.55, marginBottom: 8 }}>
          {s.desc}
        </div>
      )}
      {s.type === "boolean" && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#CCCCCC", fontSize: 13 }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "#007ACC", cursor: "pointer" }} />
          <span>{value ? "사용함" : "사용 안 함"}</span>
        </label>
      )}
      {s.type === "number" && (
        <input type="number" value={value} min={s.min} max={s.max}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle(180)} />
      )}
      {s.type === "string" && (
        <input type="text" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle(420)} />
      )}
      {s.type === "select" && (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle(260)}>
          {s.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {s.type === "info" && (
        <div style={{
          fontSize: 12, color: "#CCCCCC", background: "#252526",
          border: "1px solid #3C3C3C", padding: "8px 12px", borderRadius: 4,
          fontFamily: "'JetBrains Mono', Consolas, monospace",
        }}>{s.desc}</div>
      )}
    </div>
  );
}

function inputStyle(w) {
  return {
    width: w, padding: "6px 10px",
    background: "#3C3C3C", border: "1px solid #3C3C3C", color: "#CCCCCC",
    borderRadius: 3, fontSize: 13, outline: "none",
  };
}
