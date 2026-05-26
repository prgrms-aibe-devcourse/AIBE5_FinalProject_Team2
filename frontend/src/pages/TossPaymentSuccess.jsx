import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { escrowsApi } from "../api";

/**
 * 토스페이먼츠 결제창에서 결제 성공 시 successUrl 로 리다이렉트되는 페이지.
 * 쿼리스트링: paymentKey, orderId, amount
 * sessionStorage 의 toss_pending_escrow 에서 projectId/escrowId 를 복원해 백엔드 confirm 호출.
 */
export default function TossPaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "confirming", message: "결제 승인 중입니다..." });

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));

    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("toss_pending_escrow") || "null"); }
    catch { /* ignore parse error */ }

    if (!paymentKey || !orderId || !amount || !pending?.projectId || !pending?.escrowId) {
      // 비동기로 setState 실행 → set-state-in-effect 경고 회피
      Promise.resolve().then(() => setState({ status: "error", message: "결제 정보가 올바르지 않습니다." }));
      return;
    }

    escrowsApi.pgConfirm(pending.projectId, pending.escrowId, { paymentKey, orderId, amount })
      .then(() => {
        setState({ status: "success", message: "결제가 승인되었습니다. 잠시 후 이동합니다." });
        sessionStorage.removeItem("toss_pending_escrow");
        const back = pending.returnTo || "/";
        setTimeout(() => navigate(back, { replace: true }), 1500);
      })
      .catch((e) => {
        const msg = e?.response?.data?.message || e?.message || "결제 승인에 실패했습니다.";
        setState({ status: "error", message: msg });
      });
  }, [params, navigate]);

  const isOk = state.status === "success";
  const isErr = state.status === "error";
  const color = isOk ? "#10B981" : isErr ? "#EF4444" : "#3B82F6";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F8FAFC", fontFamily: "'Pretendard',sans-serif" }}>
      <div style={{ background: "white", borderRadius: 20, padding: "40px 48px", width: 480, maxWidth: "90%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{isOk ? "✅" : isErr ? "❌" : "⏳"}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 12 }}>
          {isOk ? "결제 완료" : isErr ? "결제 실패" : "결제 처리 중"}
        </h2>
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
          {state.message}
        </p>
        {isErr && (
          <button onClick={() => {
            let back = "/";
            try { back = JSON.parse(sessionStorage.getItem("toss_pending_escrow") || "{}").returnTo || "/"; }
            catch { /* ignore parse error */ }
            navigate(back, { replace: true });
          }}
            style={{ padding: "12px 28px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #60a5fa, #6366f1)", color: "white",
              fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            돌아가기
          </button>
        )}
      </div>
    </div>
  );
}
