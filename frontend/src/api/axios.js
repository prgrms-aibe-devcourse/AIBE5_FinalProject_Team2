/**
 * 글로벌 axios 인스턴스.
 * - baseURL: '/api' → dev에선 vite proxy(localhost:9091), 운영에선 같은 도메인.
 * - withCredentials: true → 백엔드가 set한 HttpOnly 쿠키(DEVBRIDGE_TOKEN)를 자동 전송.
 * - JWT는 더 이상 localStorage에 저장하지 않음 (XSS 방어). 인증 토큰은 전적으로 쿠키 의존.
 *
 * 레거시 호환:
 *   localStorage에 'accessToken'이 남아있는 경우(기존 로그인 세션 마이그레이션용)에 한해
 *   Authorization 헤더로 1회 전송. 백엔드도 헤더를 fallback으로 받음.
 *   사용자가 로그인 다시 하면 localStorage는 비어지고, 쿠키 인증으로 완전 전환.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Request 인터셉터: 레거시 호환 (구 세션의 localStorage 토큰만 헤더로 부착) ---
api.interceptors.request.use(
  (config) => {
    const legacy = localStorage.getItem('accessToken');
    if (legacy) {
      config.headers.Authorization = `Bearer ${legacy}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 발생해도 자동 redirect 시키지 않을 URL 패턴.
// 사용자 액션 중(폼 제출 등)에 강제 redirect 되면 입력 내용이 사라지므로 호출부가 처리하게 함.
const SILENT_401_PATTERNS = [
  /\/bank\//,            // 계좌 인증 전체 (send-code, verify-code, account)
  /\/interests(\/|\?|$)/,
  /\/applications(\/|\?|$)/,   // 대시보드 진입 시 병렬 호출 — 401 떠도 페이지 유지
  /\/applications\/me/,
  /\/projects\/me/,
  /\/projects\/\d+\/dashboard/,
  /\/projects\/\d+\/milestones/,
  /\/projects\/\d+\/escrows/,
  /\/projects\/\d+\/modules/,
  /\/projects\/\d+\/attachments/,
  /\/projects\/\d+\/meeting/,
  /\/chat\/token/,
  /\/profiles?\/me/,
  /\/auth\/me/,
];

// 자동 리다이렉트 안 시킬 현재 페이지 경로 패턴.
// 사용자가 의도적으로 들어온 페이지(대시보드 등)에선 401 만나도 강제로 /login 으로 보내지 않음.
const NO_REDIRECT_PATHS = [
  /^\/client_dashboard/,
  /^\/partner_dashboard/,
  /^\/project_register/,
  /^\/portfolio/,
  /^\/ai_chat/,
];

// --- Response 인터셉터: 공통 에러 처리 ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const reqUrl = error.config?.url || '';
      const silent = SILENT_401_PATTERNS.some(re => re.test(reqUrl));
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const onProtectedPage = NO_REDIRECT_PATHS.some(re => re.test(currentPath));

      if (silent || onProtectedPage) {
        // 조용히 실패 — 호출부가 .catch 로 처리. 사용자 페이지는 그대로 유지.
        return Promise.reject(error);
      }
      if (import.meta.env.DEV) {
        console.warn('[api] 401 Unauthorized - 토큰 만료/무효, 로그인 페이지로 이동');
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('dbId');     // 백엔드 User PK (숫자)
      localStorage.removeItem('userId');   // 구 키 정리 (마이그레이션)
      localStorage.removeItem('userType');
      // Zustand persist 상태도 같이 날려서 "토큰 없는데 로그인된 척" 상태 방지
      try {
        const raw = localStorage.getItem('devbridge-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state) {
            parsed.state.loginUser = null;
            parsed.state.loginType = null;
            parsed.state.userRole = null;
            localStorage.setItem('devbridge-storage', JSON.stringify(parsed));
          }
        }
      } catch { /* ignore */ }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

