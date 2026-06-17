/**
 * 종합 계좌 잔고 (balance_account) — 삼성증권 mobile 레퍼런스 기반 3탭 구성
 *   1) 종합 자산  : 계좌별 자산 개요 → 계좌 상세(표/카드) → 종목 주문
 *   2) 잔고·손익  : 국내/해외 + 계좌 드롭다운 + (잔고/실현손익/실현손익추이) + 기간·원화/외화
 *   3) 매매 내역  : 당일/기간 체결 + 필터 + 표
 * 색상은 우리 웹 컨벤션(이익 초록/손실 빨강) + 브랜드 블루 헤더.
 * account 페이지(/alpha/account)는 별도로 브로커 등록/관리 전용 유지.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { CircleDollarSign } from "lucide-react";
import { listBrokerAccounts, getBrokerBalance, listProposals } from "./alphaApi";
import { summarizeBalance } from "./balance/util";
import AssetsTab from "./balance/AssetsTab";
import BalancePnlTab from "./balance/BalancePnlTab";
import TradesTab from "./balance/TradesTab";
import { useNotificationStore } from "../store/useNotificationStore";
import { brokerCache } from "./brokerCache";

const TABS = ["종합 자산", "잔고·손익", "매매 내역"];

export default function BalanceAccountPage() {
  const [tab, setTab] = useState("종합 자산");
  const [accountsData, setAccountsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 주문 체결 알림이 새로 오면 자동 재조회
  const orderFillCount = useNotificationStore(
    (s) => s.notifications.filter((n) => n.type === "order").length
  );
  const prevOrderFillCount = useRef(orderFillCount);

  const reload = useCallback(async () => {
    // 캐시된 계좌 목록이 있으면 즉시 표시 (스피너 없이)
    const cachedAccts = brokerCache.getAccounts();
    if (cachedAccts && cachedAccts.length > 0) {
      const cachedRes = cachedAccts.map((acct) => {
        const bal = brokerCache.getBalance(acct.env, acct.brokerType);
        return { acct, bal, sum: summarizeBalance(bal, acct.brokerType), pendingKrw: 0, pendingUsd: 0 };
      });
      setAccountsData(cachedRes);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [accts, allProposals] = await Promise.all([
        listBrokerAccounts(),
        listProposals().catch(() => []),
      ]);
      const list = Array.isArray(accts) ? accts : [];
      brokerCache.setAccounts(list);
      const res = await Promise.all(list.map(async (acct) => {
        try {
          const bal = await getBrokerBalance(acct.env, acct.brokerType);
          brokerCache.setBalance(acct.env, acct.brokerType, bal);
          return { acct, bal, sum: summarizeBalance(bal, acct.brokerType) };
        } catch {
          const cached = brokerCache.getBalance(acct.env, acct.brokerType);
          return { acct, bal: cached ?? null, sum: summarizeBalance(cached ?? null, acct.brokerType) };
        }
      }));

      // T+2 미결제 매도 대금 계산 (당일~2일 이내 EXECUTED 매도)
      // KIS는 체결 즉시 포지션이 사라지지만 예수금(prsm_deposit_amt)은 T+2 후 반영됨 → 총 자산 감소 방지
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 2);
      const pendingByAcct = {};
      for (const p of (Array.isArray(allProposals) ? allProposals : [])) {
        if (p.side !== "SELL" || p.status !== "EXECUTED") continue;
        if (new Date(p.executedAt || p.createdAt) < cutoff) continue;
        const price = Number(p.fillAvgPrice ?? p.limitPrice);
        const qty = Number(p.qtyDecimal ?? p.qty);
        if (!(price > 0) || !(qty > 0)) continue;
        const accId = String(p.brokerAccountId);
        if (!pendingByAcct[accId]) pendingByAcct[accId] = { krw: 0, usd: 0 };
        // 한국 종목: 티커가 숫자로만 구성 (예: "005930")
        if (/^\d+$/.test(p.ticker || "")) pendingByAcct[accId].krw += price * qty;
        else pendingByAcct[accId].usd += price * qty;
      }

      setAccountsData(res.map((item) => {
        const pend = pendingByAcct[String(item.acct.id)] ?? { krw: 0, usd: 0 };
        return { ...item, pendingKrw: pend.krw, pendingUsd: pend.usd };
      }));
    } catch { setAccountsData([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // 체결 알림 수가 늘어나면 잔고 자동 재조회
  useEffect(() => {
    if (orderFillCount > prevOrderFillCount.current) {
      reload();
    }
    prevOrderFillCount.current = orderFillCount;
  }, [orderFillCount, reload]);

  return (
    <div style={{ padding: "36px 40px 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)" }}>
      <style>{`@media (max-width:768px){ .bal-wrap{padding:16px 12px!important} }`}</style>
      <div className="bal-wrap">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 17, flexShrink: 0,
              background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
            }}>
              <CircleDollarSign size={24} color="white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 style={{
                margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
                background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>종합 계좌 잔고</h1>
              <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
                전 계좌(KIS·Binance)의 자산·손익·매매 내역을 한 곳에서 관리합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상단 탭 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 22, borderBottom: "1px solid #E2E8F0" }}>
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              padding: "10px 18px", background: "none", border: "none", cursor: "pointer",
              fontSize: 15, fontWeight: tab === tb ? 800 : 600,
              color: tab === tb ? "#4f46e5" : "#94a3b8",
              borderBottom: `3px solid ${tab === tb ? "#6366f1" : "transparent"}`, marginBottom: -1,
            }}>{tb}</button>
          ))}
        </div>

        {tab === "종합 자산" && <AssetsTab accountsData={accountsData} loading={loading} refreshing={refreshing} onReload={reload} />}
        {tab === "잔고·손익" && <BalancePnlTab accountsData={accountsData} refreshing={refreshing} />}
        {tab === "매매 내역" && <TradesTab accountsData={accountsData} />}
      </div>
    </div>
  );
}
