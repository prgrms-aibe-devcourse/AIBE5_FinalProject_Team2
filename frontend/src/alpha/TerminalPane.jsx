import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

const SHELLS = [
  { id: "powershell", label: "PowerShell" },
  { id: "bash", label: "Bash" },
  { id: "cmd", label: "Cmd" },
];

/**
 * Developer Studio 로컬 터미널.
 * 백엔드 /ws/terminal(WebSocket, app.terminal.enabled + loopback 게이트)에 붙어 실제 셸을 구동.
 * 파이프 기반이라 풀 PTY(vim 등)는 제한 — lean/git/python 등 명령 실행용.
 */
export default function TerminalPane() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);
  const [shell, setShell] = useState("powershell");
  const [connected, setConnected] = useState(false);

  // xterm 1회 초기화
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace",
      theme: { background: "#0d1117", foreground: "#cbd5e1", cursor: "#60a5fa" },
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try { fit.fit(); } catch { /* noop */ }
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => { try { fit.fit(); } catch { /* noop */ } };
    window.addEventListener("resize", onResize);

    // 입력 → WS (+ 로컬 에코; 파이프 셸은 TTY 에코가 없음)
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data === "\r" ? "\n" : data);
        term.write(data === "\r" ? "\r\n" : data);
      }
    });

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
    };
  }, []);

  // 셸 변경 시 (재)연결
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
    term.reset();
    term.write(`\x1b[90m[${shell} 연결 중…]\x1b[0m\r\n`);

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/terminal?shell=${shell}`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); try { fitRef.current?.fit(); } catch { /* noop */ } };
    ws.onmessage = (e) => { if (typeof e.data === "string") term.write(e.data); };
    ws.onclose = () => { setConnected(false); term.write("\r\n\x1b[90m[연결 종료]\x1b[0m\r\n"); };
    ws.onerror = () => term.write("\r\n\x1b[31m[WS 오류 — app.terminal.enabled / 로컬 접속 확인]\x1b[0m\r\n");

    return () => { try { ws.close(); } catch { /* noop */ } };
  }, [shell]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {SHELLS.map(s => (
          <button key={s.id} onClick={() => setShell(s.id)}
            style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 5, cursor: "pointer",
              border: "1px solid " + (shell === s.id ? "#60a5fa" : "rgba(255,255,255,0.1)"),
              background: shell === s.id ? "rgba(96,165,250,0.15)" : "transparent",
              color: shell === s.id ? "#60a5fa" : "#94a3b8",
            }}>{s.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 9, color: connected ? "#10B981" : "#64748b" }}>
          {connected ? "● 연결됨" : "○ 끊김"}
        </span>
      </div>
      <div ref={containerRef} className="dark-scroll" style={{ flex: 1, minHeight: 0, padding: 4, overflow: "hidden" }} />
    </div>
  );
}
