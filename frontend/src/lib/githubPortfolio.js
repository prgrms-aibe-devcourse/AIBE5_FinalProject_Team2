import { extractWithAI } from "./aiClient";

export function parseGithubUrl(input) {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export async function fetchGithubRepoSummary(owner, repo) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = { Accept: "application/vnd.github+json" };

  const [repoRes, langRes, readmeRes] = await Promise.all([
    fetch(base, { headers }),
    fetch(`${base}/languages`, { headers }),
    fetch(`${base}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } }),
  ]);

  if (!repoRes.ok) {
    throw new Error(`GitHub 레포를 찾을 수 없습니다 (${repoRes.status})`);
  }

  const repoData = await repoRes.json();
  const languages = langRes.ok ? await langRes.json() : {};
  const readme = readmeRes.ok ? await readmeRes.text() : "";

  // README 이미지 URL 추출 (재용 가능한 졸 원본에서)
  const defaultBranch = repoData.default_branch || "main";
  const readmeImages = extractReadmeImages(readme || "", owner, repo, defaultBranch);

  // 제어문자 제거 + HTML 태그/링크 이미지 제거 + 연속 공백 압축
  const cleanedReadme = (readme || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return {
    owner,
    repo,
    fullName: repoData.full_name,
    description: repoData.description || "",
    homepage: repoData.homepage || "",
    htmlUrl: repoData.html_url,
    stars: repoData.stargazers_count || 0,
    topics: Array.isArray(repoData.topics) ? repoData.topics : [],
    primaryLanguage: repoData.language || "",
    languages: Object.keys(languages || {}),
    createdAt: repoData.created_at,
    updatedAt: repoData.updated_at,
    readme: cleanedReadme.slice(0, 2500),
    readmeImages,
  };
}

function extractReadmeImages(rawReadme, owner, repo, branch) {
  if (!rawReadme) return [];

  // 등장 순서를 보존하기 위해 위치(인덱스)와 함께 수집
  const found = []; // { url, pos }
  const mdRe = /!\[[^\]]*\]\((<?)([^)\s>]+)/g;
  const htmlRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = mdRe.exec(rawReadme))) found.push({ url: m[2], pos: m.index });
  while ((m = htmlRe.exec(rawReadme))) found.push({ url: m[1], pos: m.index });

  // 위치 순으로 정렬 (README 위에 나오는 이미지가 보통 hero)
  found.sort((a, b) => a.pos - b.pos);

  // 배지/뱃지/아이콘 같은 잡음 제외
  const JUNK_PATTERNS = [
    /img\.shields\.io/i,
    /shields\.io/i,
    /badge\.fury\.io/i,
    /travis-ci/i,
    /circleci/i,
    /codecov/i,
    /coveralls/i,
    /github\.com\/.+\/workflows\/.+\/badge/i,
    /\/badges?\//i,
    /badge\.svg/i,
    /-badge\./i,
    /npm.*\/v\//i,
    /license\.svg/i,
    /\bicon\b/i,
    /favicon/i,
    /sponsor/i,
    /\bbuy.*me.*coffee\b/i,
  ];

  const seen = new Set();
  const candidates = [];
  for (const { url, pos } of found) {
    const resolved = resolveImageUrl(url, owner, repo, branch);
    if (!resolved) continue;
    if (!/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(resolved)) continue;
    if (JUNK_PATTERNS.some((re) => re.test(resolved))) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    candidates.push({ url: resolved, pos });
  }

  if (candidates.length === 0) return [];

  // 점수: 위치(앞일수록 +) + 키워드 보너스 + 비-SVG 약간 가산
  const KEYWORDS = ["hero", "banner", "cover", "preview", "demo", "screenshot", "architecture", "diagram", "logo", "thumb"];
  return candidates
    .map(({ url, _pos }) => {
      const low = url.toLowerCase();
      // 위치 점수: 첫 번째가 100, 그다음 90, 80...
      const idx = candidates.findIndex((c) => c.url === url);
      let s = Math.max(0, 100 - idx * 10);
      KEYWORDS.forEach((k, i) => { if (low.includes(k)) s += (KEYWORDS.length - i); });
      if (!low.endsWith(".svg")) s += 2;
      return { url, score: s };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);
}

function resolveImageUrl(src, owner, repo, branch) {
  if (!src) return "";
  const trimmed = src.trim().replace(/^<|>$/g, "").split(/\s+/)[0];
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    // GitHub blob URL → raw URL 변환
    const blobMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
    if (blobMatch) return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  // 상대 경로 → raw.githubusercontent.com
  const path = trimmed.replace(/^\.?\//, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

export function pickThumbnailFromGithub(summary) {
  if (!summary || !Array.isArray(summary.readmeImages)) return "";
  return summary.readmeImages[0] || "";
}

const SYSTEM_PROMPT = `너는 GitHub 저장소 정보를 읽고 한국어 포트폴리오 항목을 생성하는 전문가야.
반드시 아래 JSON 스키마를 그대로 따르고, **JSON만** 출력해. 마크다운 코드블록(\`\`\`)도 쓰지 마.

{
  "title": "프로젝트 제목 (한국어, 30자 이내)",
  "role": "맡은 역할 (예: Full-stack Developer)",
  "period": "예상 개발 기간 (예: 3개월)",
  "workContent": "프로젝트 핵심 업무 한 단락 (200자 이내, 한국어)",
  "vision": "프로젝트의 비전/문제의식 한 단락 (200자 이내, 한국어)",
  "coreFeatures": [
    { "title": "핵심 기능 1", "desc": "한 줄 설명 (한국어, 60자 이내)" },
    { "title": "핵심 기능 2", "desc": "한 줄 설명" },
    { "title": "핵심 기능 3", "desc": "한 줄 설명" }
  ],
  "technicalChallenge": "기술적 도전 한 단락 (200자 이내, 한국어)",
  "solution": "해결 방법 한 단락 (200자 이내, 한국어)",
  "techTags": ["기술1", "기술2", "기술3"]
}

규칙:
- README 내용·언어 통계·topics를 종합해 자연스럽게 작성
- 정보가 부족하면 일반적이고 합리적인 추정으로 채워
- techTags는 실제 사용된 언어/프레임워크 위주로 5~8개
- 어떤 경우에도 JSON 외 다른 텍스트(설명, 인사, 코드블록) 출력 금지`;

function safeParseJson(text) {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function generatePortfolioFromGithub(summary) {
  const userMsg = `아래는 GitHub 저장소 정보야. 이 내용을 바탕으로 포트폴리오 JSON을 만들어줘.

[저장소] ${summary.fullName}
[설명] ${summary.description || "(없음)"}
[홈페이지] ${summary.homepage || "(없음)"}
[주 언어] ${summary.primaryLanguage || "(미상)"}
[전체 언어] ${summary.languages.join(", ") || "(미상)"}
[Topics] ${summary.topics.join(", ") || "(없음)"}
[Stars] ${summary.stars}

[README]
${summary.readme || "(README 없음)"}`;

  const reply = await extractWithAI(SYSTEM_PROMPT, userMsg);
  const parsed = safeParseJson(reply);
  if (!parsed) {
    throw new Error("AI 응답을 JSON으로 변환하지 못했습니다.");
  }
  return parsed;
}

export function buildPortfolioPayloadFromGithub(summary, ai) {
  const sourceKey = `github-${summary.owner}-${summary.repo}`;
  const techTags = (Array.isArray(ai.techTags) && ai.techTags.length > 0
    ? ai.techTags
    : summary.languages
  ).map((t) => String(t).replace(/^#/, ""));
  const titleFinal = ai.title || summary.repo;
  return {
    sourceKey,
    sourceProjectId: null,
    title: titleFinal,
    period: ai.period || "",
    role: ai.role || "",
    thumbnailUrl: pickThumbnailFromGithub(summary),
    workContent: ai.workContent || summary.description || "",
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
    githubUrl: summary.htmlUrl,
    liveUrl: summary.homepage || "",
    videoUrl: "",
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
}
