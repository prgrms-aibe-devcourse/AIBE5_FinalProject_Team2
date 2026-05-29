import React, { useState, useEffect, useCallback } from "react";
import {
  GitBranch, Github, Link2, Unlink, RefreshCw, ExternalLink,
  GitCommit, AlertCircle, CheckCircle2, Loader, Search,
} from "lucide-react";
import {
  getGitStatus, connectGit, disconnectGit, listGitRepos,
  getWorkspaceGitStatus, linkWorkspaceRepo, unlinkWorkspaceRepo,
  listWorkspaceCommits,
} from "./alphaApi";

/**
 * Developer Studio Git Panel — 사이드 패널.
 *
 * 흐름:
 *  1. PAT 미연결 → 연결 폼
 *  2. PAT 연결됨, 워크스페이스 미링크 → repo picker
 *  3. 링크 완료 → 커밋 히스토리
 */
export default function GitPanel({ workspaceId, onOpenCommit }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalStatus, setGlobalStatus] = useState(null);  // { connected, username }
  const [wsStatus, setWsStatus] = useState(null);          // { repoFullName, branch, branches }
  const [commits, setCommits] = useState([]);
  const [stage, setStage] = useState("init"); // init|connect|repos|commits

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const g = await getGitStatus();
      setGlobalStatus(g);
      if (!g.connected) { setStage("connect"); setLoading(false); return; }
      if (workspaceId == null) { setStage("connect"); setLoading(false); return; }
      const ws = await getWorkspaceGitStatus(workspaceId);
      setWsStatus(ws);
      if (!ws.repoFullName) {
        setStage("repos");
      } else {
        setStage("commits");
        const cs = await listWorkspaceCommits(workspaceId, ws.branch, 30);
        setCommits(cs || []);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "#cbd5e1" }}>
      <Header onRefresh={refresh} loading={loading} username={globalStatus?.username} />
      {error && <ErrorBanner msg={error} />}
      {loading && <CenterMsg><Loader size={16} className="spin" /> 로딩 중…</CenterMsg>}
      {!loading && stage === "connect" && (
        <ConnectForm onConnect={async (tok) => { await connectGit(tok); refresh(); }}
                     onDisconnect={globalStatus?.connected ? async () => { await disconnectGit(); refresh(); } : null}
                     username={globalStatus?.username} />
      )}
      {!loading && stage === "repos" && (
        <RepoPicker workspaceId={workspaceId} onLinked={refresh} />
      )}
      {!loading && stage === "commits" && (
        <CommitList wsStatus={wsStatus} commits={commits}
                    onUnlink={async () => { await unlinkWorkspaceRepo(workspaceId); refresh(); }}
                    onOpenCommit={onOpenCommit}
                    onBranchChange={async (br) => {
                      await linkWorkspaceRepo(workspaceId, wsStatus.repoFullName, br);
                      refresh();
                    }} />
      )}
    </div>
  );
}

// ───────────────────────────── Header

function Header({ onRefresh, loading, username }) {
  return (
    <div style={{
      padding: "8px 12px", display: "flex", alignItems: "center", gap: 6,
      borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
    }}>
      <Github size={14} color="#60a5fa" />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
        Git
      </div>
      {username && (
        <div style={{ fontSize: 10.5, color: "#64748b", marginLeft: 4 }}>· {username}</div>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={onRefresh} disabled={loading} title="새로고침"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: 2 }}>
        <RefreshCw size={12} className={loading ? "spin" : ""} />
      </button>
    </div>
  );
}

// ───────────────────────────── PAT 연결 폼

function ConnectForm({ onConnect, onDisconnect, username }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!token.trim()) return;
    setBusy(true); setErr(null);
    try { await onConnect(token.trim()); setToken(""); }
    catch (e) { setErr(e?.response?.data?.error || "연결 실패"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: 14, fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#e2e8f0" }}>GitHub 연결</div>
      {username ? (
        <div style={{ fontSize: 11.5, color: "#10b981", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={12} /> {username} 로 연결됨
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
          Personal Access Token 으로 GitHub repo 와 연동하면, 워크스페이스마다 커밋 히스토리/diff/push 를 IDE 안에서 직접 관리할 수 있습니다.
        </div>
      )}
      {!username && (
        <>
          <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 4 }}>
            토큰 발급: github.com → Settings → Developer settings → Personal access tokens (classic) → scope: <code>repo</code>
          </div>
          <div style={{
            fontSize: 10.5, color: "#93c5fd",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 6, padding: "6px 8px", marginBottom: 8, lineHeight: 1.5,
          }}>
            ⓘ GitHub 계정이 없다면{" "}
            <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer"
               style={{ color: "#60a5fa", textDecoration: "underline" }}>
              github.com
            </a>
            에서 먼저 가입해주세요. 우리 서비스 가입 이메일과 GitHub 이메일은 같지 않아도 됩니다.
          </div>
          <input
            type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx" disabled={busy}
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{
              width: "100%", padding: "7px 9px", background: "#0f1117",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              color: "#e2e8f0", fontSize: 11.5, marginBottom: 8, boxSizing: "border-box",
            }}
          />
          <button onClick={submit} disabled={busy || !token.trim()}
            style={{
              width: "100%", padding: "7px 12px", background: "#60a5fa",
              border: "none", borderRadius: 6, color: "#0f1117", fontWeight: 700,
              fontSize: 11.5, cursor: busy ? "wait" : "pointer", opacity: busy || !token.trim() ? 0.5 : 1,
            }}>
            {busy ? "검증 중…" : "연결"}
          </button>
          {err && <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444" }}>{err}</div>}
        </>
      )}
      {username && onDisconnect && (
        <button onClick={onDisconnect}
          style={{
            width: "100%", marginTop: 8, padding: "6px 12px", background: "transparent",
            border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, color: "#ef4444",
            fontSize: 11, cursor: "pointer",
          }}>
          <Unlink size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
          연결 해제
        </button>
      )}
    </div>
  );
}

// ───────────────────────────── Repo Picker

function RepoPicker({ workspaceId, onLinked }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setRepos(await listGitRepos());
      } catch (e) {
        setErr(e?.response?.data?.error || "repo 목록 로드 실패");
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = repos.filter(r => !q || r.fullName.toLowerCase().includes(q.toLowerCase()));

  const link = async (repo) => {
    setLinking(repo.fullName);
    try {
      await linkWorkspaceRepo(workspaceId, repo.fullName, repo.defaultBranch);
      onLinked();
    } catch (e) { setErr(e?.response?.data?.error || "링크 실패"); }
    finally { setLinking(null); }
  };

  if (loading) return <CenterMsg><Loader size={14} className="spin" /> repo 로딩…</CenterMsg>;
  if (err) return <ErrorBanner msg={err} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "10px 12px 6px", fontSize: 11.5, color: "#e2e8f0", fontWeight: 700 }}>
        이 워크스페이스에 연결할 repo
      </div>
      <div style={{ padding: "0 10px 8px", display: "flex", alignItems: "center", gap: 4 }}>
        <Search size={12} color="#64748b" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색"
          style={{
            flex: 1, padding: "4px 8px", background: "#0f1117",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
            color: "#e2e8f0", fontSize: 11, boxSizing: "border-box",
          }} />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.map(r => (
          <div key={r.fullName} onClick={() => link(r)}
            style={{
              padding: "8px 12px", cursor: linking === r.fullName ? "wait" : "pointer",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              opacity: linking === r.fullName ? 0.5 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#e2e8f0", fontWeight: 600 }}>
              {r.isPrivate ? "🔒" : "📂"} {r.fullName}
            </div>
            <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
              {r.defaultBranch} · {r.updatedAt?.slice(0, 10)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 14, fontSize: 11, color: "#64748b", textAlign: "center" }}>repo 없음</div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Commit List

function CommitList({ wsStatus, commits, onUnlink, onOpenCommit, onBranchChange }) {
  const [showBranches, setShowBranches] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* 헤더: repo + branch */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#e2e8f0", fontWeight: 600 }}>
          <Link2 size={12} color="#60a5fa" />
          {wsStatus.repoFullName}
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setShowBranches(s => !s)}
            style={{
              padding: "2px 6px", background: "rgba(96,165,250,0.1)",
              border: "1px solid rgba(96,165,250,0.3)", borderRadius: 4,
              color: "#60a5fa", fontSize: 10.5, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 3,
            }}>
            <GitBranch size={10} /> {wsStatus.branch}
          </button>
          <button onClick={onUnlink} title="연결 해제"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}>
            <Unlink size={11} />
          </button>
        </div>
        {showBranches && wsStatus.branches?.length > 0 && (
          <div style={{ marginTop: 4, padding: 4, background: "#0f1117", borderRadius: 4, maxHeight: 120, overflow: "auto" }}>
            {wsStatus.branches.map(b => (
              <div key={b} onClick={() => { onBranchChange(b); setShowBranches(false); }}
                style={{
                  padding: "3px 6px", fontSize: 10.5, cursor: "pointer", borderRadius: 3,
                  color: b === wsStatus.branch ? "#60a5fa" : "#cbd5e1",
                  background: b === wsStatus.branch ? "rgba(96,165,250,0.12)" : "transparent",
                }}>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 커밋 리스트 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {commits.length === 0 && (
          <div style={{ padding: 14, fontSize: 11, color: "#64748b", textAlign: "center" }}>커밋 없음</div>
        )}
        {commits.map(c => (
          <div key={c.sha} onClick={() => onOpenCommit?.(c)}
            style={{
              padding: "8px 12px", cursor: "pointer",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.06)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <GitCommit size={11} color="#60a5fa" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11.5, color: "#e2e8f0", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={c.message}>
                  {c.message?.split("\n")[0]}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {c.authorName} · {fmtAgo(c.authoredAt)} · <code>{c.sha?.slice(0, 7)}</code>
                </div>
              </div>
              <a href={c.htmlUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: "#64748b", flexShrink: 0 }} title="GitHub에서 보기">
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── helpers

function CenterMsg({ children }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      gap: 6, fontSize: 11.5, color: "#64748b",
    }}>{children}</div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      margin: 10, padding: "8px 10px",
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 6, fontSize: 11, color: "#fca5a5",
      display: "flex", alignItems: "flex-start", gap: 6,
    }}>
      <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>{msg}</div>
    </div>
  );
}

function fmtAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
