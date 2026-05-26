// 썸네일이 없을 때 SVG 데이터 URL을 자동으로 생성한다.
// 의존성 없이 순수 SVG → base64 인코딩.

const PALETTES = [
  ["#60a5fa", "#3b82f6", "#6366f1"], // 0: blue/indigo (ALPHA-HELIX 기본)
  ["#f472b6", "#ec4899", "#a855f7"], // 1: pink/purple
  ["#34d399", "#10b981", "#0d9488"], // 2: green/teal
  ["#fbbf24", "#f97316", "#ef4444"], // 3: amber/red
  ["#a78bfa", "#8b5cf6", "#6366f1"], // 4: purple/indigo
  ["#22d3ee", "#0ea5e9", "#3b82f6"], // 5: cyan/blue
  ["#1e293b", "#334155", "#475569"], // 6: slate (다크)
  ["#fb7185", "#f43f5e", "#e11d48"], // 7: rose
];

const STYLES = ["gradient", "geometric", "dark"];

function pickPalette(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title, maxLen = 16) {
  const t = String(title || "Project").trim();
  if (t.length <= maxLen) return [t];
  const words = t.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length === 1 && cur.length > maxLen) cur = cur.slice(0, maxLen - 1) + "…";
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function svgToDataUrl(svg) {
  const utf8 = unescape(encodeURIComponent(svg));
  const b64 = typeof window !== "undefined" && window.btoa
    ? window.btoa(utf8)
    : Buffer.from(utf8, "binary").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

function buildThumbnailSvg(title, techTags, options = {}) {
  const W = 1200;
  const H = 630;
  const palette = options.palette || pickPalette(title);
  const [c1, c2, c3] = palette;
  const style = options.style || "gradient";
  const lines = wrapTitle(title);
  const tags = (Array.isArray(techTags) ? techTags : [])
    .slice(0, 4)
    .map((t) => String(t).replace(/^#/, ""));

  // 배경
  let bg = "";
  if (style === "geometric") {
    bg = `
      <rect width="${W}" height="${H}" fill="${c1}"/>
      <polygon points="0,0 ${W},0 ${W},${H * 0.55} 0,${H * 0.85}" fill="${c2}"/>
      <polygon points="0,${H * 0.7} ${W * 0.6},${H} 0,${H}" fill="${c3}" opacity="0.85"/>
      <circle cx="${W * 0.85}" cy="${H * 0.78}" r="180" fill="rgba(255,255,255,0.10)"/>
      <circle cx="${W * 0.78}" cy="${H * 0.78}" r="90" fill="rgba(255,255,255,0.14)"/>`;
  } else if (style === "dark") {
    bg = `
      <rect width="${W}" height="${H}" fill="#0f172a"/>
      <rect width="${W}" height="${H}" fill="url(#g)" opacity="0.55"/>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#dots)"/>
      <line x1="0" y1="${H - 6}" x2="${W}" y2="${H - 6}" stroke="${c1}" stroke-width="6"/>`;
  } else {
    bg = `
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <circle cx="1050" cy="540" r="160" fill="rgba(255,255,255,0.10)"/>
      <circle cx="120" cy="120" r="70" fill="rgba(255,255,255,0.08)"/>`;
  }

  const titleY = lines.length > 1 ? 270 : 310;
  const lineHeight = 78;
  const titleSvg = lines
    .map(
      (ln, i) =>
        `<text x="60" y="${titleY + i * lineHeight}" font-family="Pretendard, -apple-system, sans-serif" font-weight="800" font-size="68" fill="white">${escapeXml(ln)}</text>`
    )
    .join("");

  let tagsSvg = "";
  let xCursor = 60;
  const tagY = 470;
  for (const t of tags) {
    const w = Math.min(260, t.length * 18 + 40);
    tagsSvg += `<rect x="${xCursor}" y="${tagY}" rx="22" ry="22" width="${w}" height="44" fill="rgba(255,255,255,0.22)" />`;
    tagsSvg += `<text x="${xCursor + w / 2}" y="${tagY + 30}" font-family="Pretendard, -apple-system, sans-serif" font-weight="600" font-size="22" fill="white" text-anchor="middle">${escapeXml(t)}</text>`;
    xCursor += w + 14;
    if (xCursor > W - 200) break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="rgba(255,255,255,0.10)"/>
    </pattern>
  </defs>
  ${bg}
  <text x="60" y="130" font-family="Pretendard, -apple-system, sans-serif" font-weight="700" font-size="26" fill="rgba(255,255,255,0.85)" letter-spacing="3">ALPHA-HELIX PORTFOLIO</text>
  ${titleSvg}
  ${tagsSvg}
</svg>`;
}

/**
 * 단일 자동 썸네일 생성 (기존 호환).
 */
export function generateAutoThumbnail(title, techTags = []) {
  return svgToDataUrl(buildThumbnailSvg(title, techTags));
}

/**
 * 3개의 서로 다른 스타일/팔레트 썸네일 후보를 생성.
 * @returns {{ id: string, label: string, dataUrl: string }[]}
 */
export function generateThumbnailVariants(title, techTags = []) {
  const basePaletteIdx = (() => {
    let h = 0;
    const s = String(title || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % PALETTES.length;
  })();

  const variants = [
    {
      id: "gradient",
      label: "그라데이션",
      palette: PALETTES[basePaletteIdx],
      style: "gradient",
    },
    {
      id: "geometric",
      label: "지오메트릭",
      palette: PALETTES[(basePaletteIdx + 2) % PALETTES.length],
      style: "geometric",
    },
    {
      id: "dark",
      label: "다크 미니멀",
      palette: PALETTES[(basePaletteIdx + 4) % PALETTES.length],
      style: "dark",
    },
  ];

  return variants.map((v) => ({
    id: v.id,
    label: v.label,
    dataUrl: svgToDataUrl(buildThumbnailSvg(title, techTags, { palette: v.palette, style: v.style })),
  }));
}

