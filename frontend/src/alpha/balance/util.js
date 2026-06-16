/** 종합 계좌 잔고(balance_account) 공용 유틸 — 포맷·색상·환율·계좌 라벨 */

// 손익 색상(우리 웹 컨벤션: 이익=초록, 손실=빨강)
export const PROFIT = "#16a34a";
export const LOSS = "#dc2626";
export const pnlColor = (v) => (Number(v) >= 0 ? PROFIT : LOSS);

// 브랜드 헤더 그라데이션(좌측 네비/계좌 페이지와 통일)
export const BRAND = "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)";

// USD→KRW 환산(라이브 FX 미연동 → 표시용 상수). 종합 자산 KRW 합산에만 사용.
export const FX_KRW_PER_USD = 1370;

export const BROKER_NAME = { KIS: "한국투자증권", BINANCE: "Binance.US" };
export const ENV_LABEL = { MOCK: "모의", REAL: "실전" };

export const fmtKrw = (v) => `₩${Math.round(Number(v) || 0).toLocaleString()}`;
export const fmtUsd = (v, d = 2) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const fmtPct = (v) => `${Number(v) >= 0 ? "+" : ""}${(Number(v) || 0).toFixed(2)}%`;
export const fmtSigned = (v, cur = "$") => `${Number(v) >= 0 ? "+" : "-"}${cur}${Math.abs(Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// KIS 해외 포지션은 USD. 계좌 통화 추정.
export const acctCurrency = (brokerType) => (brokerType === "BINANCE" ? "USDT" : "USD");

// 계좌 표시 라벨: "한국투자증권 · 모의" 등
export const acctLabel = (a) => `${BROKER_NAME[a.brokerType] || a.brokerType} · ${ENV_LABEL[a.env] || a.env}`;

// 포지션 1건의 파생값 계산(매수금액·수익률 등). currency 필드 전달 (KRW 국내주식 지원).
export function derivePosition(p) {
  const qty = Number(p.qtyDecimal ?? p.qty ?? 0);
  const avg = Number(p.avg_price ?? 0);
  const now = Number(p.now_price ?? 0);
  let mv = Number(p.market_value);
  let pnl = Number(p.unrealized_pnl);
  const cost = avg * qty;
  if (!Number.isFinite(mv) || mv === 0) mv = (now > 0 ? now * qty : cost + (Number.isFinite(pnl) ? pnl : 0));
  if (!Number.isFinite(pnl)) pnl = mv - cost;
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  const currency = p.currency || "USD";
  return { ticker: p.ticker, name: p.name || p.ticker, qty, avg, now, mv, cost, pnl, pct, currency };
}

// 계좌 잔고 응답 → 총 평가금액(USD 환산) / 총 손익 / 예수금
// KRW 포지션은 FX_KRW_PER_USD 로 환산해 USD 기준으로 집계 (표시는 AssetsTab에서 통화별 분기)
export function summarizeBalance(bal, brokerType) {
  const positions = (bal?.positions || []).map(derivePosition).filter((d) => d.qty > 0 || d.mv > 0);
  const toUsd = (d) => d.currency === "KRW" ? 1 / FX_KRW_PER_USD : 1;
  const mv   = positions.reduce((s, d) => s + d.mv   * toUsd(d), 0);
  const pnl  = positions.reduce((s, d) => s + d.pnl  * toUsd(d), 0);
  const cost = positions.reduce((s, d) => s + d.cost * toUsd(d), 0);
  const cashUsd = Number(bal?.cash_usd || 0);
  const cashKrw = Number(bal?.cash_krw || 0);
  const pct = cost > 0 ? (pnl / cost) * 100 : 0;
  return { positions, mv, pnl, cost, pct, cashUsd, cashKrw, cur: acctCurrency(brokerType) };
}

// 계좌 자산을 KRW 로 환산(종합 자산 합산용)
export function acctTotalKrw(sum) {
  const usd = sum.mv + sum.cashUsd;
  return usd * FX_KRW_PER_USD + sum.cashKrw;
}
