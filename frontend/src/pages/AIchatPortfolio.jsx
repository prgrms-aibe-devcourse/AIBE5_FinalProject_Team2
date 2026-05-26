import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header_partner from "../components/Header_partner";
import Header_client from "../components/Header_client";
import mascotIcon from "../assets/hero_check.png";
import heroStudent from "../assets/hero_student.png";
import { applicationsApi, portfolioApi, projectsApi } from "../api";
import { profileApi } from "../api/profile.api";
import { extractWithAI } from "../lib/aiClient";

// 다국어 인트로 선택 헬퍼: localStorage 의 devbridge_lang 을 읽어 lang 별 텍스트 반환
function _curLang() {
  try { return localStorage.getItem("devbridge_lang") || "en"; } catch { return "en"; }
}
function L(koText, dict) {
  const l = _curLang();
  return (l !== "ko" && dict && dict[l]) || koText;
}
import useStore from "../store/useStore";
import {
  parseGithubUrl,
  fetchGithubRepoSummary,
  generatePortfolioFromGithub,
  buildPortfolioPayloadFromGithub,
  pickThumbnailFromGithub,
} from "../lib/githubPortfolio";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

const Q_INTRO = `안녕하세요! 저는 포트폴리오 작성을 도와드리는 AI 매니저예요 🐣

진행하신 프로젝트나 GitHub 저장소를 알려주시면 **포트폴리오 상세 내용을 자동으로 채워드릴게요!**

──────────────────────

**어떤 방식으로 포트폴리오를 작성해 드릴까요?**

① **ALPHA-HELIX 프로젝트** 중에서 선택해 자동 생성
② **GitHub 저장소 URL** 을 주시면 코드를 분석해 자동 생성`;

const Q_INTRO_BY_LANG = {
  ko: null,
  en: `Hi! I'm Haenguni, your AI portfolio assistant 🐣

Tell me about a project or share a GitHub repo and I'll **auto-fill your portfolio details!**

──────────────────────

**How would you like to draft your portfolio?**

① Pick from your **ALPHA-HELIX projects** for auto-generation
② Provide a **GitHub repo URL** — I'll analyze the code`,
  zh: `您好！我是协助您填写作品集的 AI 幸运鸟 🐣

告诉我项目或 GitHub 仓库，我会**自动填写作品集详情**！

──────────────────────

**您希望以哪种方式创建作品集？**

① 从 **ALPHA-HELIX 项目** 中选择并自动生成
② 提供 **GitHub 仓库 URL**，我会分析代码`,
};

const Q_PROJECT = `좋아요! 진행/완료한 프로젝트 중에서 포트폴리오로 작성할 프로젝트를 골라주세요 📋

선택하시면 프로젝트 정보를 바탕으로 **비전 / 핵심 기능 / 기술적 도전 / 해결 과정**까지 한 번에 채워드려요 ✨`;

const Q_PROJECT_BY_LANG = {
  ko: null,
  en: `Great! Pick a project from your in-progress / completed list to turn into a portfolio entry 📋

I'll fill in **vision / key features / technical challenges / how you solved them** all at once ✨`,
  zh: `太好了！请从进行中 / 已完成的项目中选一个作为作品集 📋

我会一次性填写**愿景 / 核心功能 / 技术挑战 / 解决过程** ✨`,
};

const Q_ATTACHMENTS = `추가로 **첨부하실 데이터나 링크**가 있나요? 📎

예시자료(이미지/PDF), 참고 링크, 자세한 설명을 주시면 AI가 **더 정확하고 풍부한 포트폴리오**로 완성해드려요 ✨

아래에서 **파일 첨부**, **링크 추가**, 또는 **설명 입력**을 자유롭게 이용하세요. 다 끝나시면 **포트폴리오 생성하기** 버튼을 눌러주세요!`;

const Q_ATTACHMENTS_BY_LANG = {
  ko: null,
  en: `Anything else to **attach (data or links)**? 📎

Reference materials (images / PDFs), links, or extra notes will help the AI craft a **richer, more accurate portfolio** ✨

Use **Attach file**, **Add link**, or **Add description** below as needed. When done, click **Generate portfolio**!`,
  zh: `还需要附加**资料或链接**吗？📎

参考资料（图片 / PDF）、链接或详细说明会让 AI 生成**更丰富、更准确的作品集** ✨

请按需使用下方的**附件**、**添加链接** 或 **添加说明**。完成后点击**生成作品集**！`,
};

const Q_GITHUB = `GitHub 저장소 URL 을 알려주세요 🐙

예: https://github.com/yourname/your-repo

레포지토리의 README, 언어 통계, 주요 파일을 읽어와서 포트폴리오 상세페이지의 모든 항목을 자동으로 작성해드릴게요 💻`;

const Q_GITHUB_BY_LANG = {
  ko: null,
  en: `Please share your GitHub repo URL 🐙

e.g., https://github.com/yourname/your-repo

I'll read the README, language stats, and key files, then auto-fill every section of your portfolio detail page 💻`,
  zh: `请告诉我 GitHub 仓库 URL 🐙

例：https://github.com/yourname/your-repo

我会读取仓库的 README、语言统计与主要文件，自动填写作品集详情页的所有项目 💻`,
};

const Q_GITHUB_GATE = `안녕하세요! 저는 포트폴리오 작성을 도와드리는 AI 매니저예요 🐣

먼저 **대표 GitHub URL** 하나만 알려주시면, 프로필에 잔디부터 심어드릴게요 🌱

예: https://github.com/yourname

이미 등록되어 있다면 ‘건너뛰기’를 눌러주세요!`;

const Q_GITHUB_GATE_BY_LANG = {
  ko: null,
  en: `Hi! I'm Haenguni, your AI portfolio assistant 🐣

First, share your **main GitHub URL** so I can plant the contribution graph in your profile 🌱

e.g., https://github.com/yourname

If you've already registered it, click 'Skip'!`,
  zh: `您好！我是协助您填写作品集的 AI 幸运鸟 🐣

请先分享您的**主 GitHub URL**，我会在资料中种上贡献热图 🌱

例：https://github.com/yourname

如果已经注册，请点击"跳过"！`,
};

const DONE_MSG = `🎉 **포트폴리오 초안을 만들었어요!**

상세 페이지에서 직접 확인하시고, 필요한 부분만 수정해서 저장하시면 됩니다.`;

const DONE_MSG_BY_LANG = {
  ko: null,
  en: `🎉 **Portfolio draft created!**

Review it on the detail page, edit any sections you need, and save.`,
  zh: `🎉 **作品集初稿已生成！**

请在详情页检查，按需修改后保存。`,
};

function pushMessage(setter, role, text) {
  setter((prev) => [...prev, { role, text, time: new Date() }]);
}

function formatText(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i}>
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        )}
      </div>
    );
  });
}

export default function AIchatPortfolio() {
  const navigate = useNavigate();
  const location = useLocation();
  const startAt = location?.state?.startAt; // "github" 이면 처음부터 GitHub 단계로 진입
  const userRole = useStore((s) => s.userRole);
  const partnerProfileDetail = useStore((s) => s.partnerProfileDetail);
  const clientProfileDetail = useStore((s) => s.clientProfileDetail);
  // step 초기값: startAt === "github"면 깃헙 분석 단계로 직진, 아니면 게이트로 시작 (마운트 시 자동 스킵 결정)
  const [step, setStep] = useState(startAt === "github" ? "ASK_GITHUB" : "ASK_GITHUB_GATE");
  const [messages, setMessages] = useState(
    startAt === "github"
      ? [{ role: "bot", text: L(Q_GITHUB, Q_GITHUB_BY_LANG), time: new Date() }]
      : [{ role: "bot", text: L(Q_GITHUB_GATE, Q_GITHUB_GATE_BY_LANG), time: new Date() }]
  );
  const [gateInput, setGateInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState([]);
  const [githubInput, setGithubInput] = useState("");
  const [createdSourceKey, setCreatedSourceKey] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [attachments, setAttachments] = useState([]); // { kind: 'file'|'link'|'note', name, url?, size? }
  const [linkInput, setLinkInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [currentPayload, setCurrentPayload] = useState(null);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  // 헤더와 동일한 hero 이미지 source: profileApi.getMyDetail() → profileImageUrl
  const [dbHero, setDbHero] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await profileApi.getMyDetail();
        if (!cancelled) setDbHero(data?.profileImageUrl || null);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const isPartnerView = (userRole || "partner") === "partner";
  const userHero = (() => {
    const raw = dbHero
      || (isPartnerView ? partnerProfileDetail?.heroImage : clientProfileDetail?.heroImage);
    if (raw && /cdn\.Alpha-Helix\.com/i.test(raw)) return heroStudent;
    return raw || heroStudent;
  })();

  // 마운트 시: 이미 GitHub URL 등록한 사용자는 게이트 단계 스킵하고 바로 ASK_SOURCE로
  useEffect(() => {
    if (startAt === "github") return; // 깃헙 분석 직진 모드는 게이트 무관
    let alive = true;
    (async () => {
      try {
        const d = await profileApi.getMyDetail().catch(() => null);
        if (alive && d?.githubUrl && String(d.githubUrl).trim()) {
          // 이미 잔디 심은 사용자: 게이트 건너뛰고 본 단계로
          setStep("ASK_SOURCE");
          setMessages([{ role: "bot", text: L(Q_INTRO, Q_INTRO_BY_LANG), time: new Date() }]);
        }
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [startAt]);

  // 게이트 단계: GitHub URL 저장 후 ASK_SOURCE로 전환
  const submitGithubGate = async () => {
    const url = (gateInput || "").trim();
    if (!url) {
      pushMessage(setMessages, "bot", "GitHub URL을 입력하거나 ‘건너뛰기’를 눌러주세요.");
      return;
    }
    try {
      setBusy(true);
      const cur = await profileApi.getMyDetail().catch(() => ({}));
      await profileApi.saveMyDetail({ ...(cur || {}), githubUrl: url });
      pushMessage(setMessages, "user", `🔗 ${url}`);
      pushMessage(setMessages, "bot", "🌱 잔디를 심었어요! 이제 포트폴리오를 만들어볼까요?");
      setTimeout(() => {
        setStep("ASK_SOURCE");
        pushMessage(setMessages, "bot", L(Q_INTRO, Q_INTRO_BY_LANG));
      }, 600);
    } catch (e) {
      console.error(e);
      pushMessage(setMessages, "bot", "❗ GitHub URL 저장에 실패했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const skipGithubGate = () => {
    pushMessage(setMessages, "user", "건너뛰기");
    setStep("ASK_SOURCE");
    setTimeout(() => pushMessage(setMessages, "bot", L(Q_INTRO, Q_INTRO_BY_LANG)), 300);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const isPartner = (userRole || "partner") === "partner";

        // 기본 프로젝트 목록 (PortfolioAddManagementTab과 동일 패턴)
        let baseProjects = [];
        if (isPartner) {
          const apps = await applicationsApi.myList().catch(() => []);
          const relevant = (apps || []).filter((a) =>
            ["ACCEPTED", "CONTRACTED", "IN_PROGRESS", "COMPLETED"].includes((a.status || "").toUpperCase())
          );
          const ids = [...new Set(relevant.map((a) => a.projectId).filter(Boolean))];
          baseProjects = (await Promise.all(ids.map((id) => projectsApi.detail(id).catch(() => null)))).filter(Boolean);
        } else {
          const [ongoing, completed] = await Promise.all([
            projectsApi.myList(["IN_PROGRESS"]).catch(() => []),
            projectsApi.myList(["COMPLETED"]).catch(() => []),
          ]);
          const seenIds = new Set();
          baseProjects = [...(ongoing || []), ...(completed || [])].filter((p) => {
            if (!p || p.id == null || seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
          });
        }

        // 저장된 포트폴리오로 제목/태그 강화 (PortfolioAddManagementTab과 동일)
        const saved = await portfolioApi.myList().catch(() => []);
        const savedMap = new Map((saved || []).map((s) => [s.sourceKey, s]));
        const enriched = baseProjects.map((p) => {
          const s = savedMap.get(`project-${p.id}`);
          if (!s) return p;
          return {
            ...p,
            title: s.title || p.title,
            desc: s.workContent || s.vision || p.desc,
            tags: (s.techTags || []).map((t) => (String(t).startsWith("#") ? String(t) : `#${t}`)) || p.tags,
            period: s.period || p.period,
            role: s.role || p.role,
          };
        });

        if (alive) setProjects(enriched);
      } catch {
        // silent
      }
    })();
    return () => { alive = false; };
  }, [userRole]);

  const chooseDevBridge = () => {
    pushMessage(setMessages, "user", "ALPHA-HELIX 프로젝트로 작성할게요");
    setStep("ASK_PROJECT");
    setTimeout(() => pushMessage(setMessages, "bot", L(Q_PROJECT, Q_PROJECT_BY_LANG)), 400);
  };

  const chooseGithub = () => {
    pushMessage(setMessages, "user", "GitHub 저장소로 작성할게요");
    setStep("ASK_GITHUB");
    setTimeout(() => pushMessage(setMessages, "bot", L(Q_GITHUB, Q_GITHUB_BY_LANG)), 400);
  };

  const selectProject = (p) => {
    pushMessage(setMessages, "user", `📁 ${p.title || p.slogan || "프로젝트"}`);
    setSelectedProject(p);
    setStep("ASK_ATTACHMENTS");
    setTimeout(() => pushMessage(setMessages, "bot", L(Q_ATTACHMENTS, Q_ATTACHMENTS_BY_LANG)), 400);
  };

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;
    const items = arr.map((f) => ({ kind: "file", name: f.name, size: f.size, file: f }));
    setAttachments((prev) => [...prev, ...items]);
    items.forEach((it) => {
      pushMessage(setMessages, "user", `📎 파일 첨부: ${it.name} (${Math.ceil(it.size / 1024)} KB)`);
    });
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    setAttachments((prev) => [...prev, { kind: "link", name: url, url }]);
    pushMessage(setMessages, "user", `🔗 링크 추가: ${url}`);
    setLinkInput("");
  };

  const addNote = () => {
    const txt = noteInput.trim();
    if (!txt) return;
    setAttachments((prev) => [...prev, { kind: "note", name: txt }]);
    pushMessage(setMessages, "user", txt);
    setNoteInput("");
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const finalizeDevBridge = async () => {
    if (!selectedProject) return;
    const p = selectedProject;

    setBusy(true);
    pushMessage(setMessages, "bot", `🤖 선택하신 내용을 바탕으로 AI가 포트폴리오를 작성하고 있어요...`);

    try {
      // 첨부 링크 분류
      const allLinks = attachments.filter((a) => a.kind === "link");
      const githubLink = allLinks.find((a) => /github\.com/i.test(a.url || ""));
      const videoLink = allLinks.find((a) => /(youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|loom\.com)/i.test(a.url || ""));
      const liveLink = allLinks.find((a) => a !== githubLink && a !== videoLink);

      let githubSummary = null;
      if (githubLink) {
        const parsed = parseGithubUrl(githubLink.url);
        if (parsed) {
          try {
            githubSummary = await fetchGithubRepoSummary(parsed.owner, parsed.repo);
          } catch {
            // README 상세 실패는 무시
          }
        }
      }

      const linkLines = allLinks
        .map((a) => {
          if (a === githubLink) return `- [GitHub] ${a.url}`;
          if (a === videoLink) return `- [영상/데모 링크] ${a.url}`;
          if (a === liveLink) return `- [라이브 사이트] ${a.url}`;
          return `- ${a.url}`;
        })
        .join("\n");
      const fileLines = attachments
        .filter((a) => a.kind === "file")
        .map((a) => `- ${a.name} (${Math.ceil((a.size || 0) / 1024)} KB)`)
        .join("\n");
      const noteLines = attachments
        .filter((a) => a.kind === "note")
        .map((a) => `- ${a.name}`)
        .join("\n");

      const SYSTEM_PROMPT = `너는 프로젝트 정보와 첨부 자료를 읽고 한국어 포트폴리오 항목을 생성하는 전문가야.
반드시 아래 JSON 스키마를 그대로 따르고, **JSON만** 출력해. 마크다운 코드블록(\\\`\\\`\\\`)도 쓰지 마.

{
  "title": "프로젝트 제목 (한국어, 30자 이내)",
  "role": "맡은 역할 (예: Full-stack Developer)",
  "period": "개발 기간 (예: 3개월)",
  "workContent": "프로젝트 핵심 업무 한 단락 (200자 이내)",
  "vision": "프로젝트의 비전/문제의식 한 단락 (200자 이내)",
  "coreFeatures": [
    { "title": "핵심 기능 1", "desc": "한 줄 설명 (60자 이내)" },
    { "title": "핵심 기능 2", "desc": "한 줄 설명" },
    { "title": "핵심 기능 3", "desc": "한 줄 설명" }
  ],
  "technicalChallenge": "기술적 도전 한 단락 (200자 이내)",
  "solution": "해결 방법 한 단락 (200자 이내)",
  "techTags": ["기술스택1", "기술스택2", "기술스택3"]
}

규칙:
- 프로젝트 대표 정보, 첨부 링크, 사용자 메모, GitHub README를 종합해 자연스럽게 작성
- 정보가 부족하면 합리적 추정으로 채워
- techTags는 5~8개, 실제 스택 위주
- 어떤 경우에도 JSON 외 다른 텍스트 출력 금지`;

      const userMsg = [
        `[프로젝트 제목] ${p.title || p.slogan || ""}`,
        `[설명] ${p.desc || p.sloganSub || "(없음)"}`,
        p.role ? `[역할] ${p.role}` : null,
        Array.isArray(p.tags) && p.tags.length > 0 ? `[태그] ${p.tags.join(", ")}` : null,
        linkLines ? `\n[첨부 링크]\n${linkLines}` : null,
        fileLines ? `\n[첨부 파일]\n${fileLines}` : null,
        noteLines ? `\n[사용자 메모]\n${noteLines}` : null,
        githubSummary
          ? `\n[GitHub 저장소 요약]\n- 이름: ${githubSummary.fullName}\n- 설명: ${githubSummary.description}\n- 주 언어: ${githubSummary.primaryLanguage}\n- 전체 언어: ${githubSummary.languages.join(", ")}\n\n[README]\n${githubSummary.readme}`
          : null,
      ].filter(Boolean).join("\n");

      const reply = await extractWithAI(SYSTEM_PROMPT, userMsg);
      let ai = null;
      try {
        let s = String(reply || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const start = s.indexOf("{");
        const end = s.lastIndexOf("}");
        if (start >= 0 && end > start) s = s.slice(start, end + 1);
        ai = JSON.parse(s);
      } catch {
        throw new Error("AI 응답을 JSON으로 변환하지 못했습니다.");
      }

      const sourceKey = `project-${p.id}`;
      const techTags = (Array.isArray(ai.techTags) && ai.techTags.length > 0 ? ai.techTags : (p.tags || []))
        .map((t) => String(t).replace(/^#/, ""));

      const titleFinal = ai.title || p.title || p.slogan || "프로젝트";
      const githubReadmeThumb = githubSummary ? pickThumbnailFromGithub(githubSummary) : "";

      const payload = {
        sourceKey,
        sourceProjectId: p.id,
        title: titleFinal,
        period: ai.period || p.period || "",
        role: ai.role || p.role || "",
        thumbnailUrl: githubReadmeThumb,
        workContent: ai.workContent || p.desc || "",
        vision: ai.vision || "",
        coreFeatures: Array.isArray(ai.coreFeatures)
          ? ai.coreFeatures.map((f, i) => ({
              id: Date.now() + i,
              title: f?.title || "",
              desc: f?.desc || f?.description || "",
            }))
          : [],
        technicalChallenge: ai.technicalChallenge || "",
        solution: ai.solution || "",
        techTags,
        githubUrl: githubLink?.url || "",
        liveUrl: liveLink?.url || "",
        videoUrl: videoLink?.url || "",
        sections: {
          basicInfo: true,
          workContent: true,
          thumbnail: true,
          githubUrl: true,
          vision: true,
          coreFeatures: true,
          devHighlights: true,
          techStack: true,
          otherUrl: true,
        },
        isAdded: true,
        isPublic: true,
      };

      await portfolioApi.upsertBySource(sourceKey, payload);
      setCreatedSourceKey(sourceKey);
      setCurrentPayload(payload);

      setBusy(false);
      pushMessage(setMessages, "bot", `${L(DONE_MSG, DONE_MSG_BY_LANG)}\n\n**${_curLang() === "ko" ? "제목" : _curLang() === "zh" ? "标题" : "Title"}**: ${payload.title}\n**${_curLang() === "ko" ? "기술스택" : _curLang() === "zh" ? "技术栈" : "Tech Stack"}**: ${payload.techTags.join(", ")}`);
      setStep("DONE");
    } catch (e) {
      setBusy(false);
      pushMessage(setMessages, "bot", `❌ 포트폴리오 생성 중 오류가 발생했어요: ${e?.message || "알 수 없는 오류"}`);
    }
  };

  const submitGithub = async () => {
    const url = githubInput.trim();
    if (!url) return;

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      pushMessage(setMessages, "user", url);
      setGithubInput("");
      setTimeout(() => pushMessage(setMessages, "bot", "올바른 GitHub URL이 아니에요. 예: https://github.com/owner/repo"), 300);
      return;
    }

    pushMessage(setMessages, "user", url);
    setGithubInput("");
    setBusy(true);
    pushMessage(setMessages, "bot", `🔍 ${parsed.owner}/${parsed.repo} 저장소를 읽고 있어요...`);

    try {
      const summary = await fetchGithubRepoSummary(parsed.owner, parsed.repo);
      pushMessage(setMessages, "bot", `📖 README · 언어 통계 분석 완료. AI가 포트폴리오 항목을 작성하고 있어요...`);

      const ai = await generatePortfolioFromGithub(summary);

      const payload = buildPortfolioPayloadFromGithub(summary, ai);
      await portfolioApi.upsertBySource(payload.sourceKey, payload);

      setCreatedSourceKey(payload.sourceKey);
      setCurrentPayload(payload);
      setBusy(false);
      pushMessage(setMessages, "bot", `${L(DONE_MSG, DONE_MSG_BY_LANG)}\n\n**${_curLang() === "ko" ? "제목" : _curLang() === "zh" ? "标题" : "Title"}**: ${payload.title}\n**${_curLang() === "ko" ? "기술스택" : _curLang() === "zh" ? "技术栈" : "Tech Stack"}**: ${payload.techTags.join(", ")}`);
      setStep("DONE");
    } catch (e) {
      setBusy(false);
      setGithubInput(url);
      pushMessage(setMessages, "bot", `❌ 처리 중 오류가 발생했어요: ${e?.message || "알 수 없는 오류"}\n\nURL을 다시 확인하시고 분석 시작 버튼을 눌러 주세요.`);
    }
  };

  const submitRefine = async () => {
    const req = refineInput.trim();
    if (!req || !currentPayload || !createdSourceKey) return;

    pushMessage(setMessages, "user", req);
    setRefineInput("");
    setBusy(true);
    pushMessage(setMessages, "bot", `🔧 요청하신 내용을 반영해서 포트폴리오를 수정하고 있어요...`);

    const REFINE_PROMPT = `너는 한국어 포트폴리오를 수정하는 전문가야.
아래 "현재 포트폴리오 JSON"을 사용자의 "수정 요청"에 따라 갱신해서 **수정된 JSON 전체**를 반환해.
반드시 동일한 키 구조를 유지하고, **JSON만** 출력해. 마크다운 코드블록(\`\`\`)도 쓰지 마.

스키마: { "title", "role", "period", "workContent", "vision",
  "coreFeatures": [ { "title", "desc" } ],
  "technicalChallenge", "solution", "techTags": [string] }`;

    try {
      const currentJson = {
        title: currentPayload.title,
        role: currentPayload.role,
        period: currentPayload.period,
        workContent: currentPayload.workContent,
        vision: currentPayload.vision,
        coreFeatures: (currentPayload.coreFeatures || []).map((f) => ({ title: f.title, desc: f.desc })),
        technicalChallenge: currentPayload.technicalChallenge,
        solution: currentPayload.solution,
        techTags: currentPayload.techTags || [],
      };
      const userMsg = `[현재 포트폴리오 JSON]\n${JSON.stringify(currentJson, null, 2)}\n\n[수정 요청]\n${req}`;
      const reply = await extractWithAI(REFINE_PROMPT, userMsg);

      let ai = null;
      try {
        let s = String(reply || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const start = s.indexOf("{");
        const end = s.lastIndexOf("}");
        if (start >= 0 && end > start) s = s.slice(start, end + 1);
        ai = JSON.parse(s);
      } catch {
        throw new Error("AI 응답을 JSON으로 변환하지 못했습니다.");
      }

      const techTags = (Array.isArray(ai.techTags) && ai.techTags.length > 0
        ? ai.techTags
        : currentPayload.techTags || []
      ).map((t) => String(t).replace(/^#/, ""));

      const updated = {
        ...currentPayload,
        title: ai.title || currentPayload.title,
        role: ai.role || currentPayload.role,
        period: ai.period || currentPayload.period,
        workContent: ai.workContent || currentPayload.workContent,
        vision: ai.vision || currentPayload.vision,
        coreFeatures: Array.isArray(ai.coreFeatures)
          ? ai.coreFeatures.map((f, i) => ({
              id: Date.now() + i,
              title: f?.title || "",
              desc: f?.desc || f?.description || "",
            }))
          : currentPayload.coreFeatures,
        technicalChallenge: ai.technicalChallenge || currentPayload.technicalChallenge,
        solution: ai.solution || currentPayload.solution,
        techTags,
      };

      await portfolioApi.upsertBySource(createdSourceKey, updated);
      setCurrentPayload(updated);

      setBusy(false);
      pushMessage(
        setMessages,
        "bot",
        `✅ 수정 완료!\n\n**제목**: ${updated.title}\n**기술스택**: ${updated.techTags.join(", ")}\n\n추가로 더 수정하실 부분이 있으면 말씀해 주세요.`
      );
    } catch (e) {
      setBusy(false);
      pushMessage(setMessages, "bot", `❌ 수정 중 오류가 발생했어요: ${e?.message || "알 수 없는 오류"}`);
    }
  };

  const renderStepInput = () => {
    if (step === "ASK_GITHUB_GATE") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <InputRow
            value={gateInput}
            onChange={setGateInput}
            onSubmit={submitGithubGate}
            placeholder="https://github.com/사용자"
            buttonText="🌱 잔디 심기"
          />
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 24px 6px" }}>
            <button
              type="button"
              onClick={skipGithubGate}
              disabled={busy}
              style={{
                padding: "8px 14px", borderRadius: 10,
                border: "1px solid #E5E7EB", background: "white",
                color: "#374151", fontSize: 12, fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer", fontFamily: F,
              }}
              onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = "#FEF9C3"; e.currentTarget.style.color = "#713f12"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#374151"; }}
            >
              건너뛰기
            </button>
          </div>
        </div>
      );
    }
    if (step === "ASK_SOURCE") {
      return (
        <div style={{ padding: "16px 24px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ChipBtn onClick={chooseDevBridge} variant="primary">① ALPHA-HELIX 프로젝트로 작성</ChipBtn>
          <ChipBtn onClick={chooseGithub}>② GitHub 저장소로 작성</ChipBtn>
        </div>
      );
    }
    if (step === "ASK_PROJECT") {
      return (
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
          {projects.length === 0 && (
            <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: F }}>표시할 프로젝트가 없습니다.</div>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              style={{
                textAlign: "left", padding: "12px 16px",
                borderRadius: 12, border: "1.5px solid #E5E7EB",
                background: "white", cursor: "pointer", fontFamily: F,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.background = "#EFF6FF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{p.title || p.slogan || "프로젝트"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                {p.desc || p.sloganSub || "설명 없음"}
              </div>
            </button>
          ))}
        </div>
      );
    }
    if (step === "ASK_GITHUB") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <InputRow
            value={githubInput}
            onChange={setGithubInput}
            onSubmit={submitGithub}
            placeholder="https://github.com/사용자/저장소"
            buttonText="분석 시작"
          />
          {/* GitHub 등록만 하고 나가기 — 깃헙 URL만 저장하고 종료 */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 24px 6px" }}>
            <button
              type="button"
              onClick={async () => {
                const url = (githubInput || "").trim();
                if (!url) {
                  pushMessage(setMessages, "bot", "GitHub URL을 입력한 뒤 ‘등록만 하고 나가기’를 눌러주세요.");
                  return;
                }
                try {
                  setBusy(true);
                  // 프로필의 GitHub URL만 갱신: 기존 detail 조회 후 githubUrl만 덮어써서 저장
                  const cur = await profileApi.getMyDetail().catch(() => ({}));
                  await profileApi.saveMyDetail({ ...(cur || {}), githubUrl: url });
                  pushMessage(setMessages, "user", `🔗 GitHub 등록만 완료: ${url}`);
                  pushMessage(setMessages, "bot", "✅ GitHub URL이 프로필에 저장되었어요. 포트폴리오로 돌아갈게요!");
                  setTimeout(() => {
                    const back = (userRole || "partner") === "partner" ? "/partner_portfolio" : "/client_portfolio";
                    navigate(back);
                  }, 800);
                } catch (e) {
                  console.error(e);
                  pushMessage(setMessages, "bot", "❗ GitHub URL 저장에 실패했어요. 다시 시도해주세요.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              style={{
                padding: "8px 14px", borderRadius: 10,
                border: "1px solid #E5E7EB", background: "white",
                color: "#374151", fontSize: 12, fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer", fontFamily: F,
              }}
              onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = "#FEF9C3"; e.currentTarget.style.color = "#713f12"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#374151"; }}
            >
              등록만 하고 나가기
            </button>
          </div>
        </div>
      );
    }
    if (step === "ASK_ATTACHMENTS") {
      return (
        <div style={{ padding: "14px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 첨부 목록 */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {attachments.map((a, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 8,
                    background: "#EFF6FF", border: "1px solid #BFDBFE",
                    fontSize: 12, color: "#1E40AF", fontFamily: F, maxWidth: 320,
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.kind === "file" ? "📎 " : a.kind === "link" ? "🔗 " : "📝 "}{a.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    style={{ background: "none", border: "none", color: "#1E40AF", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* 파일 + 링크 한 줄 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 14px", borderRadius: 10,
                border: "1.5px solid #CBD5E1", background: "white",
                color: "#1E293B", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
              }}
            >
              📎 파일 첨부
            </button>
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="참고 링크 (URL) 입력 후 Enter"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: F, outline: "none",
              }}
            />
            <button
              type="button"
              onClick={addLink}
              style={{
                padding: "10px 14px", borderRadius: 10, border: "none",
                background: "#DBEAFE", color: "#1e3a5f",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
              }}
            >
              링크 추가
            </button>
          </div>

          {/* 메모 + 생성 한 줄 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="추가로 알려주실 내용 (선택)"
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: F, outline: "none",
              }}
            />
            <button
              type="button"
              onClick={addNote}
              style={{
                padding: "10px 14px", borderRadius: 10, border: "none",
                background: "#DBEAFE", color: "#1e3a5f",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
              }}
            >
              메모 추가
            </button>
            <button
              type="button"
              onClick={finalizeDevBridge}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: PRIMARY_GRAD, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
                boxShadow: "0 2px 10px rgba(99,102,241,0.30)", whiteSpace: "nowrap",
              }}
            >
              ✨ 포트폴리오 생성하기
            </button>
          </div>
        </div>
      );
    }
    if (step === "DONE") {
      return (
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ChipBtn
              variant="primary"
              onClick={() => navigate("/portfolio_detail_editor", {
                state: createdSourceKey
                  ? { projectId: createdSourceKey, returnTo: dashboardPath }
                  : { returnTo: dashboardPath },
              })}
            >
              포트폴리오 편집으로 이동
            </ChipBtn>
            <ChipBtn onClick={() => navigate(dashboardPath)}>대시보드로 돌아가기</ChipBtn>
          </div>

          <div style={{
            borderTop: "1px solid #E5E7EB", paddingTop: 14,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ fontSize: 13, color: "#475569", fontWeight: 600, fontFamily: F }}>
              💬 추가로 수정하실 내용이 있으면 말씀해 주세요
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); submitRefine(); } }}
                placeholder='예: "기술스택에 Redis 추가해줘", "비전을 좀 더 짧게 다듬어줘"'
                disabled={busy}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: F,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={submitRefine}
                disabled={busy || !refineInput.trim()}
                style={{
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: busy || !refineInput.trim() ? "#CBD5E1" : PRIMARY_GRAD,
                  color: "white", fontSize: 13, fontWeight: 700, fontFamily: F,
                  cursor: busy || !refineInput.trim() ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                전송
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isPartner = (userRole || "partner") === "partner";
  const dashboardPath = isPartner ? "/partner_dashboard?tab=portfolio_add" : "/client_portfolio";

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      {isPartner ? <Header_partner /> : <Header_client />}

      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "28px 20px 32px" }}>
        {/* 상단 배너 */}
        <div style={{
          background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
          border: "1.5px solid #DBEAFE", borderRadius: 18,
          padding: "20px 28px",
          display: "flex", alignItems: "center", gap: 20, marginBottom: 20,
        }}>
          <img src={mascotIcon} alt="AI 매니저" style={{ width: 60, height: 60, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1E40AF", margin: "0 0 4px", fontFamily: F }}>
              AI 매니저와 포트폴리오 자동 완성하기
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", margin: 0, fontFamily: F }}>
              ALPHA-HELIX 프로젝트나 GitHub 저장소를 알려주시면 포트폴리오 상세 내용을 자동으로 작성해드려요!
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "11px 22px", borderRadius: 999, border: "1px solid #C7D2FE",
              background: "linear-gradient(135deg, #EEF2FF 0%, #DBEAFE 50%, #E0E7FF 100%)",
              color: "#1E40AF", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0,
              boxShadow: "0 1px 2px rgba(99, 102, 241, 0.08)",
              transition: "all 0.18s ease",
            }}
          >
            ← 대시보드로 돌아가기
          </button>
        </div>

        {/* 채팅창 */}
        <div style={{
          background: "white", borderRadius: 18,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          overflow: "hidden", border: "1px solid #E5E7EB",
        }}>
          {/* 채팅 헤더 */}
          <div style={{
            padding: "14px 24px",
            background: "#FAFAFA",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <img
                src={heroStudent}
                alt="AI 매니저"
                style={{
                  width: 60, height: 60, borderRadius: "50%",
                  objectFit: "cover", background: "#EFF6FF",
                }}
              />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#1E3A8A", fontFamily: F, lineHeight: 1.2 }}>AI 매니저</div>
                <div style={{ fontSize: 15, color: "#22C55E", fontWeight: 600, fontFamily: F }}>● 온라인</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <PortfolioStepIndicator step={step} onJump={(target) => setStep(target)} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid #F1F5F9" }} />

          {/* 메시지 목록 */}
          <div style={{
            height: 700, overflowY: "auto",
            padding: "20px 24px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 10, alignItems: "flex-end",
              }}>
                {msg.role === "bot" && (
                  <img src={heroStudent} alt="bot" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} />
                )}
                <div style={{
                  maxWidth: "70%", padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  background: msg.role === "user" ? PRIMARY_GRAD : "#F8FAFC",
                  border: msg.role === "bot" ? "1px solid #E5E7EB" : "none",
                  color: msg.role === "user" ? "white" : "#111827",
                  fontSize: 16, fontFamily: F, lineHeight: 1.7,
                  boxShadow: msg.role === "user" ? "0 2px 10px rgba(99,102,241,0.25)" : "none",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {formatText(msg.text)}
                  <p style={{
                    fontSize: 12, margin: "6px 0 0",
                    color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                    textAlign: "right",
                  }}>
                    {msg.time.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <img
                    src={userHero}
                    alt="\ub098"
                    style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
                  />
                )}
              </div>
            ))}

            {busy && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <img src={heroStudent} alt="bot" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: "50%" }} />
                <div style={{
                  padding: "10px 16px", borderRadius: "4px 18px 18px 18px",
                  background: "#F8FAFC", border: "1px solid #E5E7EB",
                  display: "flex", gap: 5, alignItems: "center",
                }}>
                  <style>{`
                    @keyframes typingDot {
                      0%,80%,100% { transform: scale(0.7); opacity: 0.4; }
                      40% { transform: scale(1); opacity: 1; }
                    }
                  `}</style>
                  {[0, 1, 2].map((k) => (
                    <div key={k} style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#94A3B8",
                      animation: `typingDot 1.2s ease-in-out ${k * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 단계별 입력 영역 */}
          <div style={{ borderTop: "1px solid #F1F5F9" }}>
            {renderStepInput()}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipBtn({ children, onClick, variant }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px", borderRadius: 999,
        border: isPrimary ? "none" : "1.5px solid #CBD5E1",
        background: isPrimary ? PRIMARY_GRAD : "white",
        color: isPrimary ? "white" : "#1E293B",
        fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
        boxShadow: isPrimary ? "0 2px 10px rgba(99,102,241,0.30)" : "none",
        transition: "transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

function InputRow({ value, onChange, onSubmit, placeholder, buttonText }) {
  return (
    <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
        style={{
          flex: 1, padding: "12px 16px", borderRadius: 12,
          border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: F,
          outline: "none",
        }}
      />
      <button
        onClick={onSubmit}
        style={{
          padding: "12px 22px", borderRadius: 12, border: "none",
          background: PRIMARY_GRAD, color: "white",
          fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
          boxShadow: "0 2px 10px rgba(99,102,241,0.30)",
          whiteSpace: "nowrap",
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

function PortfolioStepIndicator({ step, onJump }) {
  const STEPS = [
    { key: "ASK_GITHUB_GATE", label: "잔디 심기" },
    { key: "ASK_SOURCE", label: "방식 선택" },
    { key: "ASK_PROJECT", label: "프로젝트 선택" },
    { key: "ASK_ATTACHMENTS", label: "첨부 자료" },
    { key: "DONE", label: "완료" },
  ];
  const currentIdx = useMemo(() => {
    if (step === "ASK_GITHUB_GATE") return 0;
    if (step === "ASK_SOURCE") return 1;
    if (step === "ASK_PROJECT" || step === "ASK_GITHUB") return 2;
    if (step === "ASK_ATTACHMENTS") return 3;
    if (step === "DONE") return 4;
    return 0;
  }, [step]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => onJump?.(s.key)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: active 
                  ? "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 50%, #6EE7B7 100%)" 
                  : done ? "#ECFDF5" : "#F1F5F9",
                color: active ? "#065F46" : done ? "#059669" : "#94A3B8",
                fontSize: 14, fontWeight: 700, fontFamily: F,
                border: "none", cursor: "pointer",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {i + 1}. {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div style={{ width: 16, height: 1.5, background: done ? "#6EE7B7" : "#CBD5E1" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
