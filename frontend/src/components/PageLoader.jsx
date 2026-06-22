const F = "'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

export default function PageLoader({ message = "불러오는 중..." }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0b1220 0%, #111a35 40%, #1e1b4b 70%, #0b1220 100%)",
      backgroundSize: "200% 200%",
      animation: "pl-bg 10s ease infinite",
      zIndex: 9999,
    }}>
      <style>{`
        @keyframes pl-bg {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pl-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pl-fade {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: "3px solid rgba(96,165,250,0.15)",
        borderTop: "3px solid #60a5fa",
        borderRight: "3px solid rgba(167,139,250,0.5)",
        animation: "pl-spin 0.85s linear infinite",
      }} />

      <p style={{
        marginTop: 22,
        fontSize: 13,
        fontFamily: F,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: "0.4px",
        animation: "pl-fade 2s ease-in-out infinite",
        margin: "22px 0 0",
      }}>
        {message}
      </p>
    </div>
  );
}
