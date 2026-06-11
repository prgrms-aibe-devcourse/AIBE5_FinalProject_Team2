/**
 * 종합 계좌 잔고 (balance_account) — 삼성증권 mobile 레퍼런스 기반 3탭 구성
 *   1) 종합 자산  : 계좌별 자산 개요 → 계좌 상세(표/카드) → 종목 주문
 *   2) 잔고·손익  : 국내/해외 + 계좌 드롭다운 + (잔고/실현손익/실현손익추이) + 기간·원화/외화
 *   3) 매매 내역  : 당일/기간 체결 + 필터 + 표
 * 색상은 우리 웹 컨벤션(이익 초록/손실 빨강) + 브랜드 블루 헤더.
 * account 페이지(/alpha/account)는 별도로 브로커 등록/관리 전용 유지.
 */
import { useEffect, useState, useCallback } from "react";
import { CircleDollarSign } from "lucide-react";
import { listBrokerAccounts, getBrokerBalance } from "./alphaApi";
import { summarizeBalance } from "./balance/util";
import AssetsTab from "./balance/AssetsTab";
import BalancePnlTab from "./balance/BalancePnlTab";
import TradesTab from "./balance/TradesTab";

const TABS = ["종합 자산", "잔고·손익", "매매 내역"];

export default function BalanceAccountPage() {
  const [tab, setTab] = useState("종합 자산");
  const [accountsData, setAccountsData] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const accts = await listBrokerAccounts();
      const list = Array.isArray(accts) ? accts : [];
      const res = await Promise.all(list.map(async (acct) => {
        try { const bal = await getBrokerBalance(acct.env, acct.brokerType); return { acct, bal, sum: summarizeBalance(bal, acct.brokerType) }; }
        catch { return { acct, bal: null, sum: summarizeBalance(null, acct.brokerType) }; }
      }));
      setAccountsData(res);
    } catch { setAccountsData([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

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

        {tab === "종합 자산" && <AssetsTab accountsData={accountsData} loading={loading} onReload={reload} />}
        {tab === "잔고·손익" && <BalancePnlTab accountsData={accountsData} />}
        {tab === "매매 내역" && <TradesTab accountsData={accountsData} />}
      </div>
    </div>
  );
}
