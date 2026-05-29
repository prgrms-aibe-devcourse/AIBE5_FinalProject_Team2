import api from "../api/axios";

// Workspace
export const listWorkspaces      = () => api.get("/alpha/workspaces").then(r => r.data);
export const createWorkspace     = (name) => api.post("/alpha/workspaces", { name }).then(r => r.data);
export const getWorkspace        = (id) => api.get(`/alpha/workspaces/${id}`).then(r => r.data);
export const deleteWorkspace     = (id) => api.delete(`/alpha/workspaces/${id}`);
export const updateWorkspaceName = (id, name) => api.patch(`/alpha/workspaces/${id}`, { name }).then(r => r.data);
export const updateWorkspaceStatus = (id, status) => api.patch(`/alpha/workspaces/${id}/status`, { status }).then(r => r.data);
export const updateGoalProfile   = (id, patch) => api.patch(`/alpha/workspaces/${id}/goal-profile`, patch).then(r => r.data);

/** brokerAccountId: number | null */
export const linkWorkspaceBroker = (id, brokerAccountId) =>
  api.patch(`/alpha/workspaces/${id}/broker-account`, { brokerAccountId }).then(r => r.data);

// Chat
export const fetchChat           = (id) => api.get(`/alpha/workspaces/${id}/chat`).then(r => r.data);
export const sendChat            = (id, text) => api.post(`/alpha/workspaces/${id}/chat`, { text }).then(r => r.data);

// Pipeline
export const formalize           = (id) => api.post(`/alpha/workspaces/${id}/formalize`).then(r => r.data);
export const selectStrategyCandidate = (id, candidateId) =>
  api.patch(`/alpha/workspaces/${id}/strategy-config/select`, { candidateId }).then(r => r.data);
export const runBacktest         = (id, period, customParams) => {
  if (customParams && Object.keys(customParams).length > 0) {
    return api.post(`/alpha/workspaces/${id}/backtest`, { period: period || "5y", customParams }).then(r => r.data);
  }
  return api.post(`/alpha/workspaces/${id}/backtest`, null, period ? { params: { period } } : undefined).then(r => r.data);
};
export const runRegime           = (id, options) => api.post(`/alpha/workspaces/${id}/regime`, options || {}, { timeout: 120000 }).then(r => r.data);
export const runTrust            = (id, options) => api.post(`/alpha/workspaces/${id}/trust`, options || {}, { timeout: 120000 }).then(r => r.data);
export const runBriefing         = (id) => api.post(`/alpha/workspaces/${id}/briefing`).then(r => r.data);
export const runAutoPipeline     = (id) => api.post(`/alpha/workspaces/${id}/auto-run`).then(r => r.data);
export const saveCode            = (id, codeJson) =>
  api.patch(`/alpha/workspaces/${id}/code`, { codeJson }).then(r => r.data);
export const queueOrders         = (id) =>
  api.post(`/alpha/workspaces/${id}/queue-orders`).then(r => r.data);

// Decision Log
export const fetchDecisionLog    = (id) => api.get(`/alpha/workspaces/${id}/log`).then(r => r.data);

// Alpha Ezer Live Patch (ChangeSet)
export const applyPatch          = (id, title, ops) =>
  api.post(`/alpha/workspaces/${id}/changesets`, { title, ops }).then(r => r.data);
export const keepPatch           = (id, csId) =>
  api.post(`/alpha/workspaces/${id}/changesets/${csId}/keep`).then(r => r.data);
export const undoPatch           = (id, csId) =>
  api.post(`/alpha/workspaces/${id}/changesets/${csId}/undo`).then(r => r.data);
export const listChangeSets      = (id, status) =>
  api.get(`/alpha/workspaces/${id}/changesets`, status ? { params: { status } } : {}).then(r => r.data);

// LLM Multi-Provider Router (Claude / OpenAI / Perplexity / Gemini)
export const listLlmProviders    = () => api.get("/llm/providers").then(r => r.data);
export const llmChat             = ({ provider, model, system, prompt }) =>
  api.post("/llm/chat", { provider, model, system, prompt }).then(r => r.data);

// Broker (한국투자증권 KIS) — env: "MOCK" | "REAL" 필수
export const listBrokerAccounts  = () => api.get("/broker/account").then(r => r.data); // [BrokerAccountDto]
export const upsertBrokerAccount = (body) => api.post("/broker/account", body).then(r => r.data); // body.env 포함
export const deleteBrokerAccount = (env, brokerType = "KIS") => api.delete("/broker/account", { params: { env, brokerType } });
export const testBrokerAccount   = (env) => api.post("/broker/account/test", null, { params: { env } }).then(r => r.data);
export const setBrokerTrading    = (env, enabled) => api.patch("/broker/account/trading-enabled", { enabled }, { params: { env } }).then(r => r.data);
/** 한도(maxOrderUsd / dailyOrderUsd) 만 부분 수정. body 예: { maxOrderUsd: 200000 } */
export const patchBrokerLimits   = (env, body) => api.patch("/broker/account/limits", body, { params: { env } }).then(r => r.data);
export const getPromotionGate    = (env) => api.get("/broker/account/promotion-gate", { params: { env } }).then(r => r.data);

// Binance 전용
export const testBinanceAccount  = (env, mode = "SPOT") => api.post("/broker/account/binance/test", null, { params: { env, mode } }).then(r => r.data);
export const getBinanceBalance   = (env, mode = "SPOT") => api.get("/broker/account/binance/balance", { params: { env, mode } }).then(r => r.data);

export const getBrokerBalance     = (env) => api.get("/broker/balance", { params: { env } }).then(r => r.data);
export const previewBrokerOrder   = (env, body) => api.post("/broker/orders/preview", body, { params: { env } }).then(r => r.data);
export const placeBrokerOrder     = (env, body) => api.post("/broker/orders/place", body, { params: { env } }).then(r => r.data);
export const getBrokerOrdersToday = (env) => api.get("/broker/orders/today", { params: { env } }).then(r => r.data);
export const getBrokerQuote       = (env, ticker) => api.get("/broker/quote", { params: { env, ticker } }).then(r => r.data);
export const getBrokerWsKey       = (env) => api.post("/broker/ws-key", null, { params: { env } }).then(r => r.data);

// OrderProposal — 자동주문 승인 큐
export const listProposals       = (status) => api.get("/proposals", { params: status ? { status } : {} }).then(r => r.data);
export const getPendingCount     = () => api.get("/proposals/pending-count").then(r => r.data);
export const createProposal      = (body) => api.post("/proposals", body).then(r => r.data);
export const approveProposal     = (id) => api.post(`/proposals/${id}/approve`).then(r => r.data);
export const rejectProposal      = (id, reason) => api.post(`/proposals/${id}/reject`, { reason }).then(r => r.data);

// Developer Studio Git 연동
export const getGitStatus            = () => api.get("/alpha/git/status").then(r => r.data);
export const connectGit              = (token) => api.post("/alpha/git/connect", { token }).then(r => r.data);
export const disconnectGit           = () => api.delete("/alpha/git/connect").then(r => r.data);
export const listGitRepos            = () => api.get("/alpha/git/repos").then(r => r.data);
export const getWorkspaceGitStatus   = (id) => api.get(`/alpha/workspaces/${id}/git/status`).then(r => r.data);
export const linkWorkspaceRepo       = (id, repoFullName, branch) =>
  api.post(`/alpha/workspaces/${id}/git/link`, { repoFullName, branch }).then(r => r.data);
export const unlinkWorkspaceRepo     = (id) => api.delete(`/alpha/workspaces/${id}/git/link`).then(r => r.data);
export const listWorkspaceCommits    = (id, branch, perPage = 30) =>
  api.get(`/alpha/workspaces/${id}/git/commits`, { params: { branch, perPage } }).then(r => r.data);
export const getWorkspaceCommit      = (id, sha) =>
  api.get(`/alpha/workspaces/${id}/git/commits/${sha}`).then(r => r.data);
export const compareWorkspaceRefs    = (id, base, head) =>
  api.get(`/alpha/workspaces/${id}/git/compare`, { params: { base, head } }).then(r => r.data);
export const pushWorkspaceFiles      = (id, body) =>
  api.post(`/alpha/workspaces/${id}/git/push`, body).then(r => r.data);
export const pullWorkspaceFile       = (id, path = "main.py") =>
  api.get(`/alpha/workspaces/${id}/git/file`, { params: { path } }).then(r => r.data);
export const deleteWorkspaceFile     = (id, path, message) =>
  api.delete(`/alpha/workspaces/${id}/git/file`, { params: { path, message } }).then(r => r.data);
export const getWorkspaceFileTree    = (id, branch) =>
  api.get(`/alpha/workspaces/${id}/git/tree`, branch ? { params: { branch } } : {}).then(r => r.data);
export const createWorkspacePr       = (id, body) =>
  api.post(`/alpha/workspaces/${id}/git/pr`, body).then(r => r.data);

// 무한매수법 (InfiniteBuying) 구독 관리
export const listInfiniteBuying      = () => api.get("/broker/infinite-buying").then(r => r.data);
export const createInfiniteBuying    = (body) => api.post("/broker/infinite-buying", body).then(r => r.data);
export const setInfiniteBuyingActive = (id, active) => api.patch(`/broker/infinite-buying/${id}/active`, { active }).then(r => r.data);
export const resetInfiniteBuying     = (id) => api.patch(`/broker/infinite-buying/${id}/reset`).then(r => r.data);
export const deleteInfiniteBuying    = (id) => api.delete(`/broker/infinite-buying/${id}`);
export const runNowInfiniteBuying    = (id) => api.post(`/broker/infinite-buying/${id}/run-now`).then(r => r.data);
