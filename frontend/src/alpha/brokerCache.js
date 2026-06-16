/**
 * 브로커 데이터 인메모리 캐시 (stale-while-revalidate).
 *
 * 페이지 재진입 시 이전 데이터를 즉시 표시하고 백그라운드에서 갱신.
 * 새로고침/브라우저 탭 전환에는 cache hit, KIS API 호출은 최소화.
 */

const BALANCE_TTL  = 60_000;  // 60s
const ACCOUNTS_TTL = 60_000;  // 60s
const ORDERS_TTL   = 30_000;  // 30s (주문 내역은 더 짧게)

const store = {};

function _set(key, data) {
  if (data == null) { delete store[key]; return; }
  store[key] = { data, ts: Date.now() };
}

function _get(key, ttl) {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) return null;
  return entry.data;
}

function _del(key) { delete store[key]; }

const balanceKey = (env, brokerType = "KIS") => `balance:${env}:${brokerType}`;
const ordersKey  = (env) => `orders:${env}`;
const ACCOUNTS_KEY = "accounts";

export const brokerCache = {
  // 잔고
  getBalance:       (env, brokerType) => _get(balanceKey(env, brokerType), BALANCE_TTL),
  setBalance:       (env, brokerType, data) => _set(balanceKey(env, brokerType), data),
  invalidateBalance:(env, brokerType) => _del(balanceKey(env, brokerType)),

  // 당일 주문
  getOrders:  (env) => _get(ordersKey(env), ORDERS_TTL),
  setOrders:  (env, data) => _set(ordersKey(env), data),

  // 계좌 목록
  getAccounts: () => _get(ACCOUNTS_KEY, ACCOUNTS_TTL),
  setAccounts: (data) => _set(ACCOUNTS_KEY, data),

  // 액션(테스트/삭제/upsert) 후 관련 캐시 무효화
  invalidateAll: () => Object.keys(store).forEach(k => _del(k)),
};
