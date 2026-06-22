import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Layers, MessageSquare, BarChart3, ShieldCheck, Inbox,
  Activity, Sparkles, Wallet, TrendingUp, CheckCircle2,
  ArrowRight, Play, AlertTriangle, Clock, Zap,
  BookOpen, Settings, ChevronRight,
} from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
const ACCENT = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";
const SECTION_COLOR = "#3b82f6";

/* ── 섹션 메타 (label은 번역에서 가져옴) ─────────────────────────────────── */
const SECTIONS = [
  { id: "overview",   sectionKey: "overview",  Icon: Sparkles },
  { id: "workspace",  sectionKey: "workspace", Icon: Layers },
  { id: "goal-chat",  sectionKey: "goalChat",  Icon: MessageSquare },
  { id: "config",     sectionKey: "config",    Icon: Settings },
  { id: "backtest",   sectionKey: "backtest",  Icon: BarChart3 },
  { id: "trust",      sectionKey: "trust",     Icon: ShieldCheck },
  { id: "orders",     sectionKey: "orders",    Icon: Inbox },
];

/* ── 기능 카드 아이콘/컬러 (번역에서 label/desc 가져옴) ─────────────────── */
const FEATURE_ICONS = [
  { Icon: MessageSquare, color: "#3b82f6" },
  { Icon: Layers,        color: "#8b5cf6" },
  { Icon: BarChart3,     color: "#06b6d4" },
  { Icon: Activity,      color: "#f59e0b" },
  { Icon: ShieldCheck,   color: "#10b981" },
  { Icon: TrendingUp,    color: "#ec4899" },
  { Icon: Inbox,         color: "#6366f1" },
  { Icon: Wallet,        color: "#0ea5e9" },
  { Icon: Sparkles,      color: "#a78bfa" },
  { Icon: Zap,           color: "#f97316" },
];

/* ── 주문 플로우 아이콘 (번역에서 step/desc/color 가져옴) ─────────────────── */
const FLOW_ICONS = [Activity, Inbox, Clock, Play, CheckCircle2, Wallet];

/* ── 공통 스타일 헬퍼 ────────────────────────────────────────────────────── */
const SectionTitle = ({ icon: Icon, title, accent = SECTION_COLOR }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: `linear-gradient(135deg, ${accent}22, ${accent}11)`,
      border: `1px solid ${accent}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon size={18} color={accent} />
    </div>
    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>{title}</h2>
  </div>
);

const Card = ({ children, style }) => (
  <div style={{
    background: "white", border: "1.5px solid #E5E7EB", borderRadius: 14,
    padding: "24px 28px", ...style,
  }}>{children}</div>
);

const StepBadge = ({ n, color = SECTION_COLOR }) => (
  <div style={{
    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
    background: `linear-gradient(135deg, ${color}, ${color}CC)`,
    color: "white", fontSize: 12, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 2px 8px ${color}44`,
  }}>{n}</div>
);

const Tag = ({ children, color = "#3b82f6" }) => (
  <span style={{
    display: "inline-block", fontSize: 11, fontWeight: 700,
    padding: "3px 10px", borderRadius: 999,
    background: `${color}15`, color,
  }}>{children}</span>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 1: Overview */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionOverview() {
  const { t } = useLanguage();
  const features = t("guide.overview.features");
  const flow = t("guide.overview.flow");

  return (
    <section id="overview" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={Sparkles} title={t("guide.sections.overview")} accent="#6366f1" />

      <Card style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 15, color: "#334155", lineHeight: 1.8, margin: "0 0 16px" }}>
          {t("guide.overview.intro")}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Tag color="#3b82f6">Spring Boot 4.0</Tag>
          <Tag color="#06b6d4">FastAPI (vectorbt)</Tag>
          <Tag color="#10b981">React 18 + Vite</Tag>
          <Tag color="#8b5cf6">Gemini 2.5-flash</Tag>
          <Tag color="#f59e0b">MySQL 8</Tag>
          <Tag color="#ec4899">KIS OpenAPI</Tag>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {Array.isArray(features) && features.map(({ label, desc }, i) => {
          const { Icon, color } = FEATURE_ICONS[i] || { Icon: Sparkles, color: "#6366f1" };
          return (
            <div key={i} style={{
              background: "white", border: "1.5px solid #E5E7EB", borderRadius: 12,
              padding: "16px 18px", display: "flex", gap: 14,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "#64748B", lineHeight: 1.55 }}>{desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Card style={{ marginTop: 20, background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", border: "1px solid #BFDBFE" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 10 }}>{t("guide.overview.flowLabel")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {Array.isArray(flow) && flow.map((step, i, arr) => (
            <React.Fragment key={i}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20,
                background: "white", color: "#3b82f6", border: "1px solid #BFDBFE",
                boxShadow: "0 1px 4px rgba(59,130,246,0.1)",
              }}>{step}</span>
              {i < arr.length - 1 && <ArrowRight size={12} color="#94A3B8" />}
            </React.Fragment>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 2: 첫 워크스페이스 */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionWorkspace() {
  const { t } = useLanguage();
  const steps = t("guide.workspace.steps");

  return (
    <section id="workspace" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={Layers} title={t("guide.sections.workspace")} accent="#3b82f6" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.isArray(steps) && steps.map((s, i) => (
          <Card key={i} style={{ display: "flex", gap: 16 }}>
            <StepBadge n={i + 1} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7, marginBottom: s.sub?.length ? 10 : 0 }}>{s.desc}</div>
              {Array.isArray(s.sub) && s.sub.map((sub, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                  <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.6 }}>{sub}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 3: Goal Chat */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionGoalChat() {
  const { t } = useLanguage();
  const stratTypes = t("guide.goalChat.stratTypes");
  const fields = t("guide.goalChat.fields");
  const examples = t("guide.goalChat.examples");

  return (
    <section id="goal-chat" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={MessageSquare} title={t("guide.sections.goalChat")} accent="#8b5cf6" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
          {t("guide.goalChat.intro")}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>{t("guide.goalChat.stratTypesLabel")}</div>
          {Array.isArray(stratTypes) && stratTypes.map(([name, desc], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0F172A" }}>{name}</span>
              <span style={{ fontSize: 11, color: "#64748B" }}>{desc}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 12 }}>{t("guide.goalChat.fieldsLabel")}</div>
          {Array.isArray(fields) && fields.map(([field, desc], i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #F1F5F9" }}>
              <code style={{ fontSize: 11, color: "#6366f1", fontFamily: "monospace", whiteSpace: "nowrap", background: "#F5F3FF", padding: "1px 5px", borderRadius: 4 }}>{field}</code>
              <span style={{ fontSize: 11.5, color: "#64748B" }}>{desc}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>{t("guide.goalChat.examplesLabel")}</div>
        {Array.isArray(examples) && examples.map((ex, i) => (
          <Card key={i} style={{ marginBottom: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <MessageSquare size={14} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.6, marginBottom: 6 }}>"{ex.input}"</div>
                <Tag color="#8b5cf6">{ex.tag}</Tag>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.7 }}>
            {t("guide.goalChat.tip")}
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 4: 전략 카드 편집 */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionConfig() {
  const { t } = useLanguage();
  const editables = t("guide.config.editables");
  const states = t("guide.config.states");

  return (
    <section id="config" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={Settings} title={t("guide.sections.config")} accent="#06b6d4" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
          {t("guide.config.intro")}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>{t("guide.config.editableLabel")}</div>
          {Array.isArray(editables) && editables.map(({ label, desc, color }, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ width: 3, height: "auto", borderRadius: 2, background: color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "#64748B" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10 }}>{t("guide.config.statesLabel")}</div>
          {Array.isArray(states) && states.map(({ status, desc, color }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                background: `${color}15`, color, border: `1px solid ${color}30`, whiteSpace: "nowrap",
              }}>{status}</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>{desc}</span>
            </div>
          ))}
          <Card style={{ marginTop: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#14532d", marginBottom: 6 }}>{t("guide.config.formalizeLabel")}</div>
            <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.65 }}>
              {t("guide.config.formalizeDesc")}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 5: 백테스트 리포트 */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionBacktest() {
  const { t } = useLanguage();
  const metrics = t("guide.backtest.metrics");

  return (
    <section id="backtest" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={BarChart3} title={t("guide.sections.backtest")} accent="#06b6d4" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
          {t("guide.backtest.intro")}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
        {Array.isArray(metrics) && metrics.map((m, i) => (
          <div key={i} style={{ background: "white", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{m.name}</div>
              <code style={{ fontSize: 10, color: m.color, background: `${m.color}15`, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{m.key}</code>
            </div>
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 8 }}>{m.desc}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{t("guide.backtest.goodBenchmark")}: {m.good}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 10 }}>
            <Play size={13} style={{ marginRight: 6 }} />{t("guide.backtest.tearsheetLabel")}
          </div>
          <div style={{ fontSize: 12.5, color: "#1e40af", lineHeight: 1.7 }}>
            {t("guide.backtest.tearsheetDesc")}
          </div>
        </Card>
        <Card style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d", marginBottom: 10 }}>
            <BarChart3 size={13} style={{ marginRight: 6 }} />{t("guide.backtest.curveLabel")}
          </div>
          <div style={{ fontSize: 12.5, color: "#166534", lineHeight: 1.7 }}>
            {t("guide.backtest.curveDesc")}
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 6: Trust Score */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionTrustScore() {
  const { t } = useLanguage();
  const subScores = t("guide.trust.subScores");
  const tiers = t("guide.trust.tiers");

  return (
    <section id="trust" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={ShieldCheck} title={t("guide.sections.trust")} accent="#10b981" />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
          {t("guide.trust.intro")}
        </div>
      </Card>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 12 }}>{t("guide.trust.subScoresLabel")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.isArray(subScores) && subScores.map((s, i) => (
            <Card key={i} style={{ display: "flex", gap: 16, padding: "16px 20px" }}>
              <div style={{ textAlign: "center", width: 48, flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.weight}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>{t("guide.trust.weightLabel")}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {Array.isArray(tiers) && tiers.map((tier, i) => (
          <div key={i} style={{
            flex: 1, background: tier.bg, border: `1.5px solid ${tier.color}30`, borderRadius: 12,
            padding: "16px 18px", textAlign: "center",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
              background: "white", border: `1px solid ${tier.color}30`, borderRadius: 999,
              padding: "4px 12px",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: tier.color, display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>{tier.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: tier.color, marginBottom: 4 }}>{tier.range}{t("guide.trust.pointSuffix")}</div>
            <div style={{ fontSize: 11.5, color: "#64748B" }}>{tier.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 섹션 7: 주문 제안 승인 큐 */
/* ─────────────────────────────────────────────────────────────────────────── */
function SectionOrders() {
  const { t } = useLanguage();
  const flow = t("guide.orders.flow");

  return (
    <section id="orders" style={{ scrollMarginTop: 80 }}>
      <SectionTitle icon={Inbox} title={t("guide.sections.orders")} accent="#6366f1" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.8 }}>
          {t("guide.orders.intro")}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {Array.isArray(flow) && flow.map((f, i) => {
          const FlowIcon = FLOW_ICONS[i] || Inbox;
          return (
            <Card key={i} style={{ display: "flex", gap: 16, padding: "16px 20px" }}>
              <StepBadge n={i + 1} color={f.color} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <FlowIcon size={14} color={f.color} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{f.step}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card style={{ background: "#FFF5F5", border: "1px solid #FECACA" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", marginBottom: 8 }}>
            {t("guide.orders.killSwitchTitle")}
          </div>
          <div style={{ fontSize: 12, color: "#991b1b", lineHeight: 1.65 }}>
            {t("guide.orders.killSwitchDesc")}
          </div>
        </Card>
        <Card style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4c1d95", marginBottom: 8 }}>
            {t("guide.orders.ttlTitle")}
          </div>
          <div style={{ fontSize: 12, color: "#5b21b6", lineHeight: 1.65 }}>
            {t("guide.orders.ttlDesc")}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 14, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 6 }}>
          {t("guide.orders.pathTitle")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#1e40af" }}>{t("guide.orders.pathSidebar")}</span>
          <ChevronRight size={12} color="#94A3B8" />
          <Tag color="#6366f1">{t("guide.orders.pathQueue")}</Tag>
          <ChevronRight size={12} color="#94A3B8" />
          <span style={{ fontSize: 12, color: "#1e40af" }}>{t("guide.orders.pathOr")}</span>
          <ChevronRight size={12} color="#94A3B8" />
          <code style={{ fontSize: 11, color: "#3b82f6", background: "#DBEAFE", padding: "2px 7px", borderRadius: 4 }}>/alpha/proposals</code>
        </div>
      </Card>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 메인 컴포넌트 */
/* ─────────────────────────────────────────────────────────────────────────── */
const guideStyles = `
.guide-layout { display: flex; gap: 36px; }
.guide-sidebar { width: 220px; flex-shrink: 0; }
.guide-content { flex: 1; min-width: 0; }
@media (max-width: 1024px) {
  .guide-layout { flex-direction: column; }
  .guide-sidebar { width: 100%; position: static !important; }
}
`;

export default function AlphaGuide() {
  const location = useLocation();
  const { t } = useLanguage();
  const sectionRefs = useRef({});
  const [activeSection, setActiveSection] = useState("overview");

  // 해시 기반 자동 스크롤
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash && sectionRefs.current[hash]) {
      setTimeout(() => {
        sectionRefs.current[hash]?.scrollIntoView({ behavior: "smooth" });
        setActiveSection(hash);
      }, 100);
    }
  }, [location.hash]);

  // Intersection Observer로 사이드바 현재 섹션 하이라이트
  useEffect(() => {
    const observers = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-60px 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scrollTo = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth" });
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: F }}>
      <style>{guideStyles}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #1d4ed8 50%, #0ea5e9 100%)",
        padding: "clamp(32px, 6vw, 72px) clamp(16px, 4vw, 40px) clamp(28px, 5vw, 64px)", textAlign: "center",
      }}>
        <div style={{
          maxWidth: 760, margin: "0 auto",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20, padding: "36px 40px",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16,
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 20, padding: "6px 16px" }}>
            <BookOpen size={14} color="#93c5fd" />
            <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>{t("guide.badge")}</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "white", margin: "0 0 12px", lineHeight: 1.2 }}>
            {t("guide.title")}
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: 0 }}>
            {t("guide.subtitle")}
          </p>
        </div>
      </div>

      {/* ── 본문 (사이드 nav + 섹션 콘텐츠) ──────────────────────────────── */}
      <div className="guide-layout" style={{
        maxWidth: 1140, width: "100%", margin: "0 auto", padding: "48px 20px 80px",
        boxSizing: "border-box",
      }}>
        {/* 사이드 nav */}
        <nav className="guide-sidebar" style={{ position: "sticky", top: 80, height: "fit-content" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
            {t("guide.toc")}
          </div>
          {SECTIONS.map(({ id, sectionKey, Icon }) => {
            const active = activeSection === id;
            const label = t(`guide.sections.${sectionKey}`);
            return (
              <button key={id} onClick={() => scrollTo(id)} style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9,
                padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "#EFF6FF" : "transparent",
                color: active ? "#1d4ed8" : "#64748B",
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                borderLeft: `2px solid ${active ? "#3b82f6" : "transparent"}`,
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#334155"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748B"; } }}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* 섹션 콘텐츠 */}
        <main className="guide-content" style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          {[
            { id: "overview",  Component: SectionOverview },
            { id: "workspace", Component: SectionWorkspace },
            { id: "goal-chat", Component: SectionGoalChat },
            { id: "config",    Component: SectionConfig },
            { id: "backtest",  Component: SectionBacktest },
            { id: "trust",     Component: SectionTrustScore },
            { id: "orders",    Component: SectionOrders },
          ].map(({ id, Component }) => (
            <div key={id} ref={el => sectionRefs.current[id] = el}>
              <Component />
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
