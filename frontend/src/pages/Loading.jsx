import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Loading() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 7000);
    return () => clearTimeout(timer);
  }, [navigate]);
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* 배경 — 애니메이션 그라데이션 (영상 에셋 제거: 번들 경량화) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #0b1220 0%, #111a35 40%, #1e1b4b 70%, #0b1220 100%)',
        backgroundSize: '200% 200%',
        animation: 'loading-bg 12s ease infinite',
      }} />
      <style>{`@keyframes loading-bg { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }`}</style>

      {/* 중앙 텍스트 */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        userSelect: 'none',
      }}>
        <style>{`
          @keyframes loading-fadein {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <h1 style={{
          fontSize: '52px',
          fontWeight: '300',
          fontStyle: 'italic',
          color: 'rgba(255, 255, 255, 0.93)',
          fontFamily: "'Georgia', 'Times New Roman', serif",
          letterSpacing: '2px',
          lineHeight: 1.5,
          margin: 0,
          textShadow: '0 2px 24px rgba(0,0,0,0.55)',
          animation: 'loading-fadein 1.2s ease-out both',
        }}>
          Soaring toward
          <br />
          <span style={{
            background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: '600',
            fontStyle: 'normal',
          }}>
            new opportunities.
          </span>
        </h1>
        <p style={{
          marginTop: 22,
          fontSize: '15px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'Pretendard', sans-serif",
          fontWeight: 400,
          letterSpacing: '0.5px',
          animation: 'loading-fadein 1.6s ease-out 0.3s both',
        }}>
          새로운 기회를 찾아 날아가고 있습니다
        </p>
      </div>
    </div>
  );
}

export default Loading;
