/**
 * Google Drive 공유 링크를 직접 이미지 URL로 변환
 * @param {string} url - Google Drive 링크
 * @returns {string} - 변환된 URL 또는 원본 URL
 */
function convertGoogleDriveUrl(url) {
  if (!url) return url;
  // Google Drive 공유 링크: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return url;
}

/**
 * 실제 유효한 썸네일 URL인지 확인 (placeholder 제외)
 */
function isValidThumbnailUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\/.+/.test(url)) return false;
  // placeholder URL 제외
  if (url.includes('example.com/image.jpg')) return false;
  if (url === 'https://example.com/image.jpg') return false;
  return true;
}

export function normalizeSourceKey(rawKey, fallbackProjectId) {
  if (rawKey) return String(rawKey);
  if (fallbackProjectId != null) return `project-${fallbackProjectId}`;
  return `free-${Date.now()}`;
}

export function toPortfolioEditorSeed(project, overrides = {}) {
  // sourceProjectId 는 'projects' 테이블의 FK 만 받음.
  // project.id 는 호출자에 따라 portfolios 테이블의 PK 일 수도 있어 fallback 에서 제외.
  // (portfolioApi.myList() 결과를 넘길 때 portfolio_id 를 sourceProjectId 로 쓰는
  //  회귀가 있어서, 백엔드에서 'project id=N 못 찾음' 에러를 일으킨 이력 있음.)
  const sourceProjectId = project?.sourceProjectId ?? project?.projectId ?? null;
  const sourceKey = normalizeSourceKey(project?.sourceKey, project?.sourceProjectId ?? project?.projectId ?? project?.id);

  return {
    id: sourceKey,
    sourceKey,
    sourceProjectId,
    group: project?.group || "완료",
    badge: project?.badge || (project?.isAdded ? "포트폴리오 등록" : "프로젝트"),
    badgeBg: project?.badgeBg || "#EFF6FF",
    badgeColor: project?.badgeColor || "#3B82F6",
    title: project?.title || project?.slogan || "제목 없음",
    desc: project?.desc || project?.workContent || project?.vision || "설명이 아직 없습니다.",
    tags: Array.isArray(project?.tags)
      ? project.tags
      : Array.isArray(project?.techTags)
      ? project.techTags.map((tag) => (String(tag).startsWith("#") ? String(tag) : `#${tag}`))
      : [],
    period: project?.period || "협의",
    endDate: project?.endDate || project?.deadline || null,
    added: project?.isAdded ?? true,
    ...overrides,
  };
}

export function toPortfolioRequest(item) {
  // thumbnailUrl: data: URL은 DB 저장 불가 (VARCHAR 500 제한) → 빈 문자열로 대체
  // Google Drive 공유 링크는 직접 이미지 URL로 변환
  // placeholder URL은 저장하지 않음
  const rawThumb = item.thumbnailUrl || "";
  let thumbnailUrl = rawThumb.startsWith("data:") ? "" : rawThumb;
  if (thumbnailUrl && isValidThumbnailUrl(thumbnailUrl)) {
    thumbnailUrl = convertGoogleDriveUrl(thumbnailUrl);
  } else {
    thumbnailUrl = ""; // 유효하지 않은 URL은 빈 문자열로
  }

  return {
    sourceKey: item.sourceKey,
    sourceProjectId: item.sourceProjectId ?? null,
    title: item.title || "",
    period: item.period || "",
    role: item.role || "",
    thumbnailUrl,
    workContent: item.workContent || "",
    vision: item.vision || "",
    coreFeatures: Array.isArray(item.coreFeatures) ? item.coreFeatures : [],
    technicalChallenge: item.technicalChallenge || "",
    solution: item.solution || "",
    techTags: Array.isArray(item.techTags)
      ? item.techTags
      : Array.isArray(item.tags)
      ? item.tags.map((tag) => String(tag).replace(/^#/, ""))
      : [],
    githubUrl: item.githubUrl || "",
    liveUrl: item.liveUrl || "",
    videoUrl: item.videoUrl || "",
    sections: item.sections || {},
    isAdded: item.isAdded ?? item.added ?? true,
    isPublic: item.isPublic ?? true,
  };
}

export function toPortfolioCard(item, index = 0) {
  const fallbackColors = ["#F97316", "#3B82F6", "#10B981", "#6366F1"];
  const techTags = Array.isArray(item.techTags) ? item.techTags : [];
  const _sections = (item.sections && typeof item.sections === "object") ? item.sections : {};
  
  // 실제 유효한 URL이 있는지 확인
  const hasRealThumbnail = isValidThumbnailUrl(item.thumbnailUrl);
  
  return {
    id: item.id || item.sourceKey,
    sourceKey: item.sourceKey || item.id,
    title: item.title || "제목 없음",
    titleColor: fallbackColors[index % fallbackColors.length],
    company: item.role || "",
    desc: item.workContent || item.vision || "포트폴리오 설명이 아직 없습니다.",
    tags: techTags,
    thumbnailUrl: hasRealThumbnail ? convertGoogleDriveUrl(item.thumbnailUrl) : null,
  };
}

/**
 * DB의 PortfolioItem(Response) → PortfolioProjectPreview 페이지가 기대하는 project 형식으로 변환.
 */
export function toPortfolioPreviewProject(item) {
  if (!item) return null;
  const sections = (item.sections && typeof item.sections === "object") ? item.sections : {};
  const techTags = Array.isArray(item.techTags) ? item.techTags : [];
  const coreFeatures = Array.isArray(item.coreFeatures)
    ? item.coreFeatures.map((f) => ({
        title: f?.title || "",
        desc: f?.desc || f?.description || "",
      }))
    : [];

  // 실제 유효한 thumbnailUrl이 있는지 확인 (placeholder 제외)
  const hasRealThumbnail = isValidThumbnailUrl(item.thumbnailUrl);
  const effectiveSections = {
    ...sections,
    thumbnail: hasRealThumbnail ? (sections.thumbnail !== false) : false,
  };

  return {
    id: item.sourceKey || item.id,
    emoji: "📁",
    title: item.title || "제목 없음",
    subtitle: item.role || item.period || "",
    videoUrl: item.videoUrl || "#",
    videoLabel: item.videoUrl ? "Watch full video ↗" : "",
    description: item.workContent || item.vision || "",
    type: "standard",
    visible: true,
    sections: {
      thumbnail: effectiveSections.thumbnail,
      video: !!item.videoUrl && (sections.video !== false),
      description: (sections.workContent !== false) || (sections.vision !== false),
      coreFeatures: (sections.coreFeatures !== false) && coreFeatures.length > 0,
      keyPages: false,
      devHighlights: (sections.devHighlights !== false) && (!!item.technicalChallenge || !!item.solution || !!item.vision),
      techDetails: (sections.techStack !== false) && techTags.length > 0,
    },
    coreFeatures,
    keyPages: [],
    devHighlights: [
      ...(item.vision ? [{ title: "Vision", desc: item.vision }] : []),
      ...(item.technicalChallenge ? [{ title: "Technical Challenge", desc: item.technicalChallenge }] : []),
      ...(item.solution ? [{ title: "Solution", desc: item.solution }] : []),
    ],
    techDetails: techTags.length > 0
      ? [{ title: "Tech Stack", items: techTags }]
      : [],
    techStack: techTags,
    githubUrl: item.githubUrl || "",
    liveUrl: item.liveUrl || "",
    thumbnailUrl: hasRealThumbnail ? convertGoogleDriveUrl(item.thumbnailUrl) : null,
    quickLinkLabel: item.role || item.period || "Project Detail",
    quickLinkSubs: [
      ...((sections.coreFeatures !== false) && coreFeatures.length > 0 ? [{ label: "Core Features", anchor: "core" }] : []),
      ...((sections.devHighlights !== false) && (!!item.technicalChallenge || !!item.solution || !!item.vision) ? [{ label: "Development Highlights", anchor: "dev" }] : []),
      ...((sections.techStack !== false) && techTags.length > 0 ? [{ label: "Technical Implementation Details", anchor: "tech" }] : []),
    ],
  };
}