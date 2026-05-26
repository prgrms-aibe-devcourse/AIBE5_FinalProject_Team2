/**
 * 프로젝트 desc / detailContent 의 markdown 을 React 노드로 렌더.
 * - ## H3 (큰 섹션)
 * - ### H4 (서브)
 * - **bold**
 * - "- " / "* " bullet
 * - "---" hr
 * - 그 외 텍스트는 단락
 *
 * 아울러 contractTerms 가 desc 끝에 잘못 붙어있는 경우 (`## 세부 협의`,
 * `### 1. 작업 범위` 등 마커 이후) 잘라냄. contractTerms 는 별도 섹션이라
 * 프로젝트 개요에 포함되면 안 됨.
 */
import React from "react";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function renderInline(s, keyPrefix = "") {
  // **bold**
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={`${keyPrefix}b${i}`} style={{ color: "#1E293B", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}t${i}`}>{p}</span>
  );
}

export function renderProjectOverview(raw) {
  if (!raw) return null;
  let text = String(raw);
  // contractTerms 잔여 컷
  const cutMarkers = [
    /\n[-*]{3,}\s*\n+##\s*세부\s*협의/,
    /\n##\s*세부\s*협의/,
    /\n###\s*1\.\s*작업\s*범위/,
  ];
  for (const re of cutMarkers) {
    const m = text.match(re);
    if (m) { text = text.slice(0, m.index).trim(); break; }
  }
  const lines = text.split(/\r?\n/);
  const out = [];
  let buf = [];
  const flushPara = () => {
    if (buf.length === 0) return;
    const joined = buf.join(" ").trim();
    if (joined) {
      out.push(
        <p key={`p${out.length}`} style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.8, fontFamily: F, fontSize: 15 }}>
          {renderInline(joined, `p${out.length}`)}
        </p>
      );
    }
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushPara(); continue; }
    if (line.startsWith("### ")) {
      flushPara();
      out.push(
        <h4 key={`h${out.length}`} style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", margin: "14px 0 6px", fontFamily: F }}>
          {renderInline(line.slice(4), `h${out.length}`)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      flushPara();
      out.push(
        <h3 key={`H${out.length}`} style={{ fontSize: 16, fontWeight: 800, color: "#1D4ED8", margin: "16px 0 8px", fontFamily: F }}>
          {renderInline(line.slice(3), `H${out.length}`)}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushPara();
      const items = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      i--;
      out.push(
        <ul key={`ul${out.length}`} style={{ margin: "0 0 12px", paddingLeft: 20, color: "#475569", lineHeight: 1.8, fontFamily: F, fontSize: 15 }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: 4 }}>{renderInline(it, `ul${out.length}_${j}`)}</li>)}
        </ul>
      );
    } else if (/^[-*_]{3,}$/.test(line)) {
      flushPara();
      out.push(<hr key={`hr${out.length}`} style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "16px 0" }} />);
    } else {
      buf.push(line);
    }
  }
  flushPara();
  return out.length ? <div>{out}</div> : <p style={{ margin: 0, color: "#94A3B8", fontFamily: F }}>(설명 없음)</p>;
}
