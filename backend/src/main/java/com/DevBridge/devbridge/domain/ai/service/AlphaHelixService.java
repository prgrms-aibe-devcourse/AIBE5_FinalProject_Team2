package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.notification.service.NotificationService;
import com.DevBridge.devbridge.domain.ai.service.GeminiService;
import com.DevBridge.devbridge.domain.strategy.service.AnalyticsClient;
import com.DevBridge.devbridge.domain.ai.repository.AlphaWorkspaceRepository;
import com.DevBridge.devbridge.domain.ai.repository.AlphaDecisionLogRepository;
import com.DevBridge.devbridge.domain.ai.repository.AlphaChatMessageRepository;
import com.DevBridge.devbridge.domain.strategy.entity.Strategy;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.ai.dto.AiChatRequest;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.notification.entity.*;
import com.DevBridge.devbridge.domain.payment.entity.*;
import com.DevBridge.devbridge.domain.strategy.entity.*;
import com.DevBridge.devbridge.domain.ai.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.notification.repository.*;
import com.DevBridge.devbridge.domain.payment.repository.*;
import com.DevBridge.devbridge.domain.strategy.repository.*;
import com.DevBridge.devbridge.domain.ai.repository.*;
import com.DevBridge.devbridge.domain.ai.service.gateway.AiGatewayService;
import com.DevBridge.devbridge.domain.ai.service.llm.PerplexityProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Alpha-Helix 핵심 비즈니스 로직.
 * AlphaWorkspaceController / AlphaStrategyController / AlphaAnalyticsController
 * 세 컨트롤러에서 공유하는 서비스 계층.
 *
 * Task 12: GeminiService 직접 호출 → AiGatewayService(쿼터 관리) 로 통합.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@lombok.Getter
public class AlphaHelixService {

    // 백테스트 병렬 실행 풀 — 개선제안 변형(안정/공격)·전후 비교를 동시에 호출해 대기시간 단축.
    // backtestMetricsSafe 는 외부 HTTP(analytics) + 순수계산이라 DB/트랜잭션 없이 스레드 안전.
    private final ExecutorService backtestPool = Executors.newFixedThreadPool(4);

    // ── repositories ──────────────────────────────────────────────────────────
    public final AlphaWorkspaceRepository workspaceRepo;
    public final AlphaChatMessageRepository chatRepo;
    public final AlphaDecisionLogRepository logRepo;
    public final UserRepository userRepo;
    public final BrokerAccountRepository brokerAccountRepo;
    public final OrderProposalRepository orderProposalRepo;
    // ── services ──────────────────────────────────────────────────────────────
    private final GeminiService gemini;          // fallback (anonymous)
    private final AiGatewayService gateway;      // 쿼터 관리 통합 (Task 12)
    public  final AnalyticsClient analytics;
    private final NotificationService notificationService;
    private final PerplexityProvider perplexity; // Living Briefing 실뉴스 엔진(웹검색+인용)
    public final ObjectMapper om = new ObjectMapper();

    /** self-injection: doAutoRun에서 내부 @Transactional 메서드를 프록시 통해 호출하기 위함 */
    @Autowired @Lazy
    private AlphaHelixService self;

    public static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String DEFAULT_MODEL = "gemini-2.5-flash";

    // ═══════════════════════════════════════════ Task 12 — AI 통합 호출 ══════

    /**
     * 인증된 사용자는 AiGatewayService(쿼터·로그), 미인증은 GeminiService fallback.
     * AlphaHelix 엔드포인트는 항상 인증 필수이므로 uid == null 은 오지 않는다.
     */
    public String callAi(Long uid, String systemInstruction, String userInput) {
        return callAi(uid, systemInstruction, userInput, null);
    }

    public String callAi(Long uid, String systemInstruction, String userInput, String feature) {
        if (uid != null) {
            return gateway.oneShot(uid, DEFAULT_MODEL, systemInstruction, userInput, false, feature);
        }
        return gemini.oneShot(systemInstruction, userInput);
    }

    // ═══════════════════════════════════════════ Workspace 공통 헬퍼 ══════════

    public Map<String, Object> toSummary(AlphaWorkspace w) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("status", w.getStatus());
        m.put("brokerAccountId", w.getBrokerAccountId());
        m.put("updatedAt", w.getUpdatedAt());
        return m;
    }

    public Map<String, Object> toFull(AlphaWorkspace w) {
        Map<String, Object> m = toSummary(w);
        m.put("goalProfile",    parseOrNull(w.getGoalProfileJson()));
        m.put("strategyConfig", parseOrNull(w.getStrategyConfigJson()));
        m.put("lastBacktest",   parseOrNull(w.getLastBacktestJson()));
        m.put("lastTrust",      parseOrNull(w.getLastTrustJson()));
        m.put("lastRegime",     parseOrNull(w.getLastRegimeJson()));
        m.put("lastReport",     parseOrNull(w.getLastReportJson()));
        m.put("codeJson",       w.getCodeJson());
        if (w.getBrokerAccountId() != null) {
            brokerAccountRepo.findById(w.getBrokerAccountId()).ifPresent(ba -> {
                Map<String, Object> bm = new HashMap<>();
                bm.put("id",             ba.getId());
                bm.put("env",            ba.getEnv().name());
                bm.put("cano",           ba.getCano());
                bm.put("tradingEnabled", ba.getTradingEnabled());
                m.put("brokerAccount", bm);
            });
        }
        return m;
    }

    public Object parseOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        try { return om.readValue(s, Object.class); }
        catch (Exception e) { return s; }
    }

    public void recordLog(Long wid, String actor, String type, String summary, String payload) {
        try {
            logRepo.save(AlphaDecisionLog.builder()
                    .workspaceId(wid).actor(actor).eventType(type)
                    .summary(summary).payloadJson(payload).build());
        } catch (Exception e) {
            log.warn("recordLog fail: {}", e.getMessage());
        }
    }

    /**
     * Decision Log 카드형 타임라인 응답.
     * filter: all | accepted | hold | rejected | pending
     */
    public Map<String, Object> buildDecisionTimeline(Long workspaceId, String filter) {
        String f = filter == null ? "all" : filter.trim().toLowerCase();
        if (f.isBlank()) f = "all";

        List<AlphaDecisionLog> logs = logRepo.findByWorkspaceIdOrderByCreatedAtAsc(workspaceId);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (AlphaDecisionLog l : logs) {
            Map<String, Object> payload = parsePayloadMap(l.getPayloadJson());
            String status = inferDecisionStatus(l, payload);
            if (!matchFilter(f, status)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", l.getId());
            row.put("eventType", l.getEventType());
            row.put("actor", l.getActor());
            row.put("createdAt", l.getCreatedAt());
            row.put("summary", l.getSummary());
            row.put("status", status);
            row.put("statusLabel", statusLabel(status));
            row.put("category", eventCategory(l.getEventType()));
            row.put("title", titleFromLog(l, payload));
            row.put("aiReason", payload.get("aiReason"));
            row.put("options", payload.get("options"));
            row.put("userChoice", payload.get("userChoice"));
            row.put("userNote", payload.get("userNote"));
            row.put("payload", payload);
            rows.add(row);
        }

        rows.sort((a, b) -> {
            LocalDateTime ta = (LocalDateTime) a.get("createdAt");
            LocalDateTime tb = (LocalDateTime) b.get("createdAt");
            if (ta == null && tb == null) return 0;
            if (ta == null) return 1;
            if (tb == null) return -1;
            return tb.compareTo(ta);
        });

        int accepted = 0, hold = 0, rejected = 0, pending = 0;
        for (Map<String, Object> row : rows) {
            String status = String.valueOf(row.get("status"));
            switch (status) {
                case "ACCEPTED" -> accepted++;
                case "HOLD" -> hold++;
                case "REJECTED" -> rejected++;
                case "PENDING" -> pending++;
                default -> {
                }
            }
        }

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("all", rows.size());
        counts.put("accepted", accepted);
        counts.put("hold", hold);
        counts.put("rejected", rejected);
        counts.put("pending", pending);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("workspaceId", workspaceId);
        out.put("filter", f);
        out.put("counts", counts);
        out.put("items", rows);
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayloadMap(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) return new LinkedHashMap<>();
        try {
            Object parsed = om.readValue(payloadJson, Object.class);
            if (parsed instanceof Map<?, ?> m) {
                Map<String, Object> out = new LinkedHashMap<>();
                for (Map.Entry<?, ?> e : m.entrySet()) {
                    out.put(String.valueOf(e.getKey()), e.getValue());
                }
                return out;
            }
            return new LinkedHashMap<>(Map.of("raw", parsed));
        } catch (Exception e) {
            return new LinkedHashMap<>(Map.of("raw", payloadJson));
        }
    }

    private boolean matchFilter(String filter, String status) {
        return switch (filter) {
            case "accepted" -> "ACCEPTED".equals(status);
            case "hold" -> "HOLD".equals(status);
            case "rejected" -> "REJECTED".equals(status);
            case "pending" -> "PENDING".equals(status);
            default -> true;
        };
    }

    private String inferDecisionStatus(AlphaDecisionLog log, Map<String, Object> payload) {
        String fromPayload = upperOrNull(payload.get("decisionStatus"));
        if (fromPayload != null) return normalizeDecision(fromPayload);

        String decision = upperOrNull(payload.get("decision"));
        if (decision != null) return normalizeDecision(decision);

        String summary = log.getSummary() == null ? "" : log.getSummary();
        if (summary.contains("변경 유지")) return "ACCEPTED";
        if (summary.contains("보류")) return "HOLD";
        if (summary.contains("실행취소")) return "REJECTED";

        if ("IMPROVE_PROPOSAL".equals(log.getEventType())) return "PENDING";
        return "NONE";
    }

    private String normalizeDecision(String raw) {
        return switch (raw) {
            case "APPROVED", "ACCEPT", "ACCEPTED", "KEEP", "KEPT", "수락" -> "ACCEPTED";
            case "HOLD", "PENDING", "DEFER", "보류" -> "HOLD";
            case "REJECT", "REJECTED", "UNDO", "UNDONE", "거절", "취소" -> "REJECTED";
            default -> "NONE";
        };
    }

    private String upperOrNull(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return null;
        return s.toUpperCase(Locale.ROOT);
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "ACCEPTED" -> "수락";
            case "HOLD" -> "보류";
            case "REJECTED" -> "거절";
            case "PENDING" -> "대기";
            default -> "-";
        };
    }

    private String eventCategory(String eventType) {
        if (eventType == null) return "기타";
        return switch (eventType) {
            case "IMPROVE_PROPOSAL", "PATCH_COMPARE", "PARAM_CHANGED", "USER_REVISION" -> "리스크 관리 파라미터";
            case "STRATEGY_PROPOSED" -> "전략 제안";
            case "BACKTEST_RUN" -> "백테스트";
            case "TRUST_COMPUTED" -> "신뢰도 검증";
            case "REGIME_ANALYZED" -> "레짐 분석";
            case "GOAL_DEFINED" -> "목표 설정";
            case "USER_DECISION" -> "사용자 의사결정";
            default -> "기타";
        };
    }

    private String titleFromLog(AlphaDecisionLog log, Map<String, Object> payload) {
        Object t = payload.get("title");
        if (t != null && !String.valueOf(t).isBlank()) return String.valueOf(t);
        String summary = log.getSummary() == null ? "" : log.getSummary().trim();
        if (!summary.isBlank()) return summary;
        return log.getEventType();
    }

    // ═══════════════════════════════════════════ JSON 헬퍼 ════════════════════

    public JsonNode getActiveStrategy(JsonNode cfg) {
        if (cfg == null || cfg.isMissingNode() || cfg.isNull()) return cfg;
        if (cfg.has("candidates") && cfg.get("candidates").isArray()) {
            String selId = cfg.path("selectedId").asText(null);
            JsonNode arr = cfg.get("candidates");
            if (selId != null) {
                for (JsonNode c : arr) {
                    if (selId.equals(c.path("id").asText())) return c;
                }
            }
            if (arr.size() > 0) return arr.get(0);
        }
        return cfg;
    }

    public boolean hasAllGoalKeys(String json) {
        try {
            JsonNode g = om.readTree(json);
            return g.hasNonNull("goal")
                && g.hasNonNull("horizon_years")
                && g.hasNonNull("monthly_contribution_krw")
                && g.hasNonNull("risk_tolerance")
                && g.hasNonNull("max_drawdown_target_pct")
                && g.path("assets").isArray() && g.path("assets").size() > 0
                && g.hasNonNull("initial_strategy_direction");
        } catch (Exception e) { return false; }
    }

    public boolean isAutoRunReady(String goalProfileJson) {
        try {
            JsonNode g = om.readTree(goalProfileJson);
            return g.path("assets").isArray() && g.path("assets").size() > 0
                && !g.path("initial_strategy_direction").asText("").isBlank();
        } catch (Exception e) { return false; }
    }

    public String extractJsonBlock(String text) {
        if (text == null) return null;
        int s = text.indexOf("```json");
        if (s < 0) s = text.indexOf("```");
        if (s >= 0) {
            int contentStart = text.indexOf('\n', s);
            if (contentStart >= 0) {
                int e = text.indexOf("```", contentStart + 1);
                if (e >= 0) {
                    String body = text.substring(contentStart + 1, e).trim();
                    try { om.readTree(body); return body; } catch (Exception ignored) {}
                }
            }
        }
        int objStart = text.indexOf('{');
        if (objStart < 0) return null;
        int depth = 0; boolean inStr = false; char prev = 0;
        for (int i = objStart; i < text.length(); i++) {
            char c = text.charAt(i);
            if (inStr) {
                if (c == '"' && prev != '\\') inStr = false;
            } else {
                if (c == '"') inStr = true;
                else if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        String body = text.substring(objStart, i + 1).trim();
                        try { om.readTree(body); return body; }
                        catch (Exception ignored) { return null; }
                    }
                }
            }
            prev = c;
        }
        return null;
    }

    public String extractFirstJsonArray(String text) {
        if (text == null) return null;
        String block = extractJsonBlock(text);
        if (block != null && block.trim().startsWith("[")) {
            try { om.readTree(block); return block; } catch (Exception ignored) {}
        }
        int s = text.indexOf('[');
        if (s < 0) return null;
        int depth = 0; boolean inStr = false; char prev = 0;
        for (int i = s; i < text.length(); i++) {
            char c = text.charAt(i);
            if (inStr) { if (c == '"' && prev != '\\') inStr = false; prev = c; continue; }
            if (c == '"') { inStr = true; prev = c; continue; }
            if (c == '[') depth++;
            else if (c == ']') {
                depth--;
                if (depth == 0) {
                    String candidate = text.substring(s, i + 1);
                    try { om.readTree(candidate); return candidate; }
                    catch (Exception ex) { return null; }
                }
            }
            prev = c;
        }
        return null;
    }

    public String extractFirstJson(String text) {
        if (text == null) return null;
        String block = extractJsonBlock(text);
        if (block != null) return block;
        int s = text.indexOf('{');
        if (s < 0) return null;
        int depth = 0;
        for (int i = s; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) {
                    String candidate = text.substring(s, i + 1);
                    try { om.readTree(candidate); return candidate; }
                    catch (Exception ex) { return null; }
                }
            }
        }
        return null;
    }

    public static String normalizeTicker(String t) {
        if (t == null || t.isBlank()) return "SPY";
        String up = t.trim().toUpperCase();
        return switch (up) {
            case "BTC", "BITCOIN" -> "BTC-USD";
            case "ETH", "ETHEREUM" -> "ETH-USD";
            case "VIX" -> "^VIX";
            default -> up;
        };
    }

    // ═══════════════════════════════════════════ Chat ════════════════════════

    /**
     * Goal-to-Strategy AI 채팅 처리.
     * @return {reply, goalProfileExtracted, autoRunReady}
     */
    @Transactional
    public Map<String, Object> processChat(AlphaWorkspace ws, Long uid, String userText) {
        Long id = ws.getId();
        chatRepo.save(AlphaChatMessage.builder().workspaceId(id).role("user").text(userText).build());

        var history = chatRepo.findByWorkspaceIdOrderByCreatedAtAsc(id);
        StringBuilder ctx = new StringBuilder();
        // 현재 워크스페이스 상태(목표/선택 전략/백테스트 수치)를 컨텍스트 맨 앞에 주입한다.
        // 이미 전략이 있으면 분석·개선 요청에 답할 수 있게 하고, '전략 코드가 없다'는 헛답을 막는다.
        // (신규/빈 워크스페이스는 빈 문자열이라 기존 목표수집 온보딩 동작에 영향이 없다.)
        ctx.append(buildWorkspaceStateContext(ws));
        int start = Math.max(0, history.size() - 12);
        for (int i = start; i < history.size(); i++) {
            var m = history.get(i);
            ctx.append("[").append(m.getRole()).append("] ").append(m.getText()).append("\n");
        }

        String system = """
            너는 Alpha-Helix의 퍼스널 퀀트 매니저다. 사용자의 '삶의 목표'를 듣고 투자 전략 설계 조건 8가지를 한 단계씩 수집한다.
            반드시 한국어로, 친근하지만 구체적으로 답한다.

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            🔎 분석가 모드 (이미 전략/백테스트가 있는 경우 — 아래 목표수집보다 우선)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            컨텍스트에 '현재 워크스페이스 상태'(선택 전략·백테스트 수치)가 주어졌고, 사용자가 그 전략의
            분석·수익률/승률 개선·지표 추가를 물으면 → 목표 8가지 수집을 다시 시작하지 말고,
            주어진 수치(MDD·Sharpe·승률·거래수 등)를 근거로 구체적으로 진단하고 개선안을 제안하라.
            이 상태 정보가 있으면 절대 "로드된 전략(코드)이 없다"는 식으로 답하지 않는다.
            (목표가 아직 없는 신규 워크스페이스면 아래 목표수집 모드로 진행한다.)

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ⚠️ 절대 규칙 (위반 금지)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            ① 사용자가 명시적으로 답하지 않은 항목은 절대 임의로 채우지 않는다.
            ② 8가지가 전부 사용자 발화로 확인되기 전까지는 절대 JSON을 출력하지 않는다.
            ③ 매 응답은 반드시 (a) 빠진 항목 질문 / (b) 확인+다음 질문 / (c) 8가지 확인 후 JSON 정리 중 하나.
            ④ 응답은 반드시 마크다운 굵게 **...** 와 줄바꿈을 활용한 가독성 좋은 형태.

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            수집해야 할 8가지 항목
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            1) goal (목표) — "투자의 최종 목표는?" / 예: 5년 안에 월 300만원 현금흐름
            2) horizon_years (투자기간) — "목표 시점까지 몇 년?" / 예: 3 / 5 / 10+
            3) initial_capital_krw (초기 투자금 KRW) — "처음 시드는 얼마?" / 예: 1,000,000 / 5,000,000 / 30,000,000
            4) monthly_contribution_krw (월 적립금 KRW) — "매달 얼마씩?" / 예: 500,000 / 1,000,000 / 3,000,000
            5) risk_tolerance (투자성향) — 보수적 / 중립 / 공격적
            6) max_drawdown_target_pct (MDD 허용 %) — 예: 15 / 25 / 40
            7) assets (관심자산 배열) — 예: ["QQQ","SCHD","GLD"]
            8) initial_strategy_direction (초기 전략방향) — 추세추종 / 평균회귀 / 모멘텀 / 변동성조절 / 무한매수 / 잘모름

            선택 항목 (사용자가 언급하면 함께 기록):
            - daily_buy_limit_krw / daily_sell_limit_krw / cash_pct
            - cash_pct: asset_allocation 합 + cash_pct = 100 유지 (매우 중요)

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            무한매수법(라오어식) 인식 가이드
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            사용자가 "무한매수법","라오어","분할매수","40분할","LOC","평단매수" 등 언급 시
            initial_strategy_direction = "infinite_buying" 으로 기록.
            infinite_buying 확정 시 추가 수집: split_count / daily_buy_split_ratio / big_buy_premium_pct / take_profit_pct.

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            8가지 모두 확인된 직후 — 정확히 이 형식으로만 출력
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            조건을 정리해 보겠습니다 ✨

            ```json
            {
              "goal": "...",
              "horizon_years": 5,
              "initial_capital_krw": 5000000,
              "monthly_contribution_krw": 1000000,
              "risk_tolerance": "중립",
              "max_drawdown_target_pct": 25,
              "assets": ["QQQ","SCHD"],
              "asset_allocation": {"QQQ": 60, "SCHD": 40},
              "cash_pct": 0,
              "initial_strategy_direction": "추세추종 + 변동성조절"
            }
            ```

            이 조건으로 전략 후보 3개를 만들어볼게요. 상단 **Goal → Strategy** 버튼을 눌러주세요.

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            복잡한 전략 발화에 대한 구조화 응답 규칙
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            사용자가 한 번에 여러 규칙을 묶어서 설명하면 반드시 3개 섹션 헤더 사용:

            ## 🧠 AI가 이해한 전략
            ## ❓ 확인이 필요한 규칙
            ## ▶ 다음 단계

            [BTN:라벨|액션] 토큰은 프론트가 버튼으로 변환한다. 액션: next / ask_more / formalize

            금융투자 권유가 아니라 교육·시뮬레이션이라는 점을 가끔 환기시켜라.
            """;

        String reply;
        try {
            reply = callAi(uid, system, ctx.toString(), "workspace_chat");
        } catch (Exception e) {
            log.error("AI chat fail", e);
            reply = "(AI 응답 실패: " + e.getMessage() + ")";
        }
        chatRepo.save(AlphaChatMessage.builder().workspaceId(id).role("model").text(reply).build());

        String extracted = extractJsonBlock(reply);
        if (extracted != null && hasAllGoalKeys(extracted)) {
            ws.setGoalProfileJson(extracted);
            if ("DRAFT".equals(ws.getStatus())) ws.setStatus("GOAL_SET");
            workspaceRepo.save(ws);
            recordLog(id, "AI", "GOAL_DEFINED", "Goal Profile 추출 완료", extracted);
        } else {
            extracted = null;
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("reply", reply);
        resp.put("goalProfileExtracted", extracted != null);
        resp.put("autoRunReady", extracted != null && isAutoRunReady(extracted));
        return resp;
    }

    /**
     * 채팅 컨텍스트용 — 워크스페이스의 현재 전략/백테스트/목표/국면/신뢰도 요약(코드가 아님).
     * 상태가 하나도 없으면(신규 워크스페이스) 빈 문자열을 반환해 목표수집 온보딩에 영향을 주지 않는다.
     * 백테스트는 stats 만 추려 넣는다(equity_curve 같은 대용량 배열은 제외).
     */
    private String buildWorkspaceStateContext(AlphaWorkspace ws) {
        StringBuilder sb = new StringBuilder();
        try {
            String gj = ws.getGoalProfileJson();
            if (gj != null && !gj.isBlank()) {
                JsonNode g = om.readTree(gj);
                java.util.List<String> p = new java.util.ArrayList<>();
                if (g.hasNonNull("goal")) p.add("목표=\"" + g.get("goal").asText() + "\"");
                if (g.hasNonNull("horizon_years")) p.add("기간=" + g.get("horizon_years").asText() + "년");
                if (g.hasNonNull("initial_capital_krw")) p.add("초기금=" + g.get("initial_capital_krw").asText() + "원");
                if (g.hasNonNull("monthly_contribution_krw")) p.add("월적립=" + g.get("monthly_contribution_krw").asText() + "원");
                if (g.hasNonNull("risk_tolerance")) p.add("성향=" + g.get("risk_tolerance").asText());
                if (g.hasNonNull("max_drawdown_target_pct")) p.add("MDD목표=" + g.get("max_drawdown_target_pct").asText() + "%");
                if (g.has("assets") && !g.get("assets").isNull()) p.add("관심자산=" + g.get("assets").toString());
                if (g.hasNonNull("initial_strategy_direction")) p.add("전략방향=" + g.get("initial_strategy_direction").asText());
                if (!p.isEmpty()) sb.append("• 목표 프로필: ").append(String.join(", ", p)).append("\n");
            }
        } catch (Exception ignore) { }
        try {
            String sj = ws.getStrategyConfigJson();
            if (sj != null && !sj.isBlank()) {
                JsonNode active = getActiveStrategy(om.readTree(sj));
                if (active != null && !active.isMissingNode()) {
                    String name = active.path("strategy_name").asText(active.path("strategy_type").asText(""));
                    StringBuilder line = new StringBuilder();
                    if (!name.isBlank()) line.append("• 선택 전략: ").append(name);
                    JsonNode params = active.has("params") ? active.get("params")
                            : (active.has("parameters") ? active.get("parameters") : null);
                    if (params != null && params.isObject()) {
                        java.util.List<String> ps = new java.util.ArrayList<>();
                        var it = params.fields();
                        int n = 0;
                        while (it.hasNext() && n < 8) { var e = it.next(); ps.add(e.getKey() + "=" + e.getValue().asText()); n++; }
                        if (!ps.isEmpty()) line.append(" (파라미터: ").append(String.join(", ", ps)).append(")");
                    }
                    if (line.length() > 0) sb.append(line).append("\n");
                }
            }
        } catch (Exception ignore) { }
        try {
            String bj = ws.getLastBacktestJson();
            if (bj != null && !bj.isBlank()) {
                JsonNode s = om.readTree(bj).path("stats");
                if (s.isObject()) {
                    java.util.List<String> p = new java.util.ArrayList<>();
                    if (s.hasNonNull("total_return_pct")) p.add("총수익률 " + s.get("total_return_pct").asText() + "%");
                    if (s.hasNonNull("annualized_return_pct")) p.add("연환산 " + s.get("annualized_return_pct").asText() + "%");
                    if (s.hasNonNull("max_drawdown_pct")) p.add("MDD " + s.get("max_drawdown_pct").asText() + "%");
                    if (s.hasNonNull("sharpe")) p.add("Sharpe " + s.get("sharpe").asText());
                    if (s.hasNonNull("sortino")) p.add("Sortino " + s.get("sortino").asText());
                    if (s.hasNonNull("calmar")) p.add("Calmar " + s.get("calmar").asText());
                    if (s.hasNonNull("win_rate_pct")) p.add("승률 " + s.get("win_rate_pct").asText() + "%");
                    if (s.hasNonNull("trades")) p.add("거래수 " + s.get("trades").asText());
                    if (!p.isEmpty()) sb.append("• 최근 백테스트: ").append(String.join(", ", p)).append("\n");
                }
            }
        } catch (Exception ignore) { }
        try {
            String rj = ws.getLastRegimeJson();
            if (rj != null && !rj.isBlank()) {
                JsonNode r = om.readTree(rj);
                String label = r.path("current_label").asText(r.path("label").asText(""));
                if (!label.isBlank()) sb.append("• 시장국면(Regime): ").append(label).append("\n");
            }
        } catch (Exception ignore) { }
        try {
            String tj = ws.getLastTrustJson();
            if (tj != null && !tj.isBlank()) {
                JsonNode t = om.readTree(tj);
                JsonNode sc = t.has("trust_score") ? t.get("trust_score")
                        : (t.has("score") ? t.get("score") : t.get("overall"));
                if (sc != null && !sc.isNull()) sb.append("• Trust Score: ").append(sc.asText()).append("\n");
            }
        } catch (Exception ignore) { }

        if (sb.length() == 0) return "";
        return "\n[현재 워크스페이스 상태 — 사용자가 \"지금 보고 있는/이 전략\"이라고 하면 아래를 가리킨다]\n"
                + sb + "\n";
    }

    // ═══════════════════════════════════════════ Formalize ═══════════════════

    /**
     * Goal Profile → Strategy 후보 3개 생성.
     * @return strategyConfig envelope map
     */
    @Transactional
    public Map<String, Object> doFormalize(AlphaWorkspace ws, Long uid) throws Exception {
        // ── ver1 MVP: AI 자유선택 → '고정 3전략 큐레이션 + goal profile→파라미터 결정론 매핑' ──
        // strategy_type·assets 는 코드 고정(전부 실엔진: infinite_buying·momentum_rotation(MACD)·value_rebalancing),
        // parameters 만 goal profile 로 가변. (과거: LLM 이 strategy_type/assets/params 자유선택 →
        //  유령타입(trend_volatility_control 등)이 조용히 SMA/SPY 로 강등 · value_rebalancing 누락 · 같은 goal 에도 비결정)
        JsonNode g;
        try { g = om.readTree(ws.getGoalProfileJson() == null ? "{}" : ws.getGoalProfileJson()); }
        catch (Exception e) { g = om.createObjectNode(); }

        List<Map<String, Object>> candidates = new ArrayList<>();
        candidates.add(buildFixedCandidate("cand-1", "TQQQ·SOXL 무한매수법", "infinite_buying",
                List.of("TQQQ", "SOXL"), "공격",
                "레버리지 ETF(나스닥100 3x·반도체 3x) 라오어식 LOC 분할매수 — 떨어질수록 분할매수, 평단 +익절% 도달 시 전량익절·복리 재투자.", g));
        candidates.add(buildFixedCandidate("cand-2", "섹터 모멘텀 로테이션", "momentum_rotation",
                List.of("QQQ", "XLK", "XLF", "XLE", "XLV", "XLY", "TLT", "GLD", "SCHD", "BIL"), "중립",
                "멀티자산 상대강도 랭킹 로테이션 — 매월 12-1 모멘텀 상위 N개를 동일가중 보유, 약세장은 현금성 자산으로 대피.", g));
        candidates.add(buildFixedCandidate("cand-3", "QLD 밸류 리밸런싱", "value_rebalancing",
                List.of("QLD"), "보수",
                "목표가치 밴드 이탈 시 비중을 복원하는 변동성 통제형 — 하락 시 저가매수, 상승 시 차익실현.", g));
        String selectedId = pickSelectedCandidate(g);

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("candidates", candidates);
        envelope.put("selectedId", selectedId);
        String envelopeJson = om.writeValueAsString(envelope);

        ws.setStrategyConfigJson(envelopeJson);
        if (!"LIVE".equals(ws.getStatus())) ws.setStatus("FORMALIZED"); // LIVE 운용 중이면 강등 금지
        workspaceRepo.save(ws);
        recordLog(ws.getId(), "AI", "STRATEGY_PROPOSED",
                "Strategy 후보 " + candidates.size() + "개 생성", envelopeJson);

        return Map.of("strategyConfig", envelopeJson, "candidates", candidates);
    }

    /** 고정 전략 후보 1개 생성(strategy_type·assets 고정, parameters 는 goal profile 결정론 매핑). */
    private Map<String, Object> buildFixedCandidate(String id, String name, String strategyType,
                                                    List<String> assets, String riskTone, String rationale, JsonNode g) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id", id);
        c.put("strategy_name", name);
        c.put("strategy_type", strategyType);
        c.put("assets", assets);
        c.put("parameters", deriveParams(strategyType, g));
        c.put("rationale", rationale);
        c.put("risk_tone", riskTone);
        return c;
    }

    /** risk_tolerance → 공격성 인덱스(보수 0 · 중립 1 · 공격 2). */
    private int aggrIndex(JsonNode g) {
        String rt = g.path("risk_tolerance").asText("중립");
        if (rt.contains("공격") || rt.toLowerCase().contains("aggress")) return 2;
        if (rt.contains("보수") || rt.toLowerCase().contains("conserv")) return 0;
        return 1;
    }

    /** goal profile → 전략별 parameters 결정론 매핑. strategy_type 은 절대 불변. */
    private Map<String, Object> deriveParams(String strategyType, JsonNode g) {
        int a = aggrIndex(g);
        Map<String, Object> p = new LinkedHashMap<>();
        double initCap = g.path("initial_capital_krw").asDouble(
                g.path("monthly_contribution_krw").asDouble(0) * 12);
        switch (strategyType) {
            case "infinite_buying" -> {
                int[] split = {40, 30, 20};
                double[] tp = {8.0, 10.0, 12.0};
                double[] loc = {15.0, 12.0, 10.0};
                p.put("split", g.path("split_count").asInt(split[a]));
                p.put("take_profit_pct", g.path("take_profit_pct").asDouble(tp[a]));
                p.put("loc_offset_pct", g.path("big_buy_premium_pct").asDouble(loc[a]));
                if (initCap > 0) p.put("initial_capital", initCap);
            }
            case "momentum_rotation" -> {
                int[] lookback = {252, 252, 126};   // 보수 길게 / 공격 짧게
                int[] topn = {4, 3, 2};             // 공격일수록 집중
                int[] reb = {63, 21, 21};           // 보수 분기 / 중립·공격 월간
                String[] cash = {"SHY", "BIL", "BIL"};
                p.put("lookback_days", lookback[a]);
                p.put("skip_recent_days", 21);
                p.put("top_n", topn[a]);
                p.put("rebalance_days", reb[a]);
                p.put("abs_momentum_gate", a <= 1);  // 보수·중립 게이트 ON, 공격 OFF(풀노출)
                p.put("cash_asset", cash[a]);
            }
            case "value_rebalancing" -> {
                int[] rd = {20, 10, 5};
                double[] band = {0.25, 0.20, 0.15};
                double[] er = {0.01, 0.02, 0.03};
                double[] pool = {0.40, 0.50, 0.60};
                p.put("rebalance_days", rd[a]);
                p.put("band_pct", band[a]);
                p.put("expected_return", er[a]);
                p.put("pool_target_pct", pool[a]);
                p.put("initial_pool_pct", pool[a]);
                if (initCap > 0) p.put("initial_capital", initCap);
            }
            default -> { /* 화이트리스트 밖: 파라미터 없음(하위호환) */ }
        }
        return p;
    }

    /** initial_strategy_direction / risk_tolerance 로 기본 선택 후보 결정. */
    private String pickSelectedCandidate(JsonNode g) {
        String dir = g.path("initial_strategy_direction").asText("");
        if (dir.contains("무한매수") || dir.toLowerCase().contains("infinite")) return "cand-1";
        if (dir.contains("모멘텀") || dir.toLowerCase().contains("momentum")) return "cand-2";
        if (dir.contains("변동성") || dir.contains("평균회귀") || dir.contains("리밸런싱")) return "cand-3";
        int a = aggrIndex(g);
        return a == 2 ? "cand-1" : (a == 0 ? "cand-3" : "cand-2");
    }

    // ═══════════════════════════════════════════ Backtest ════════════════════

    /**
     * @param customParams 사용자가 코드에서 편집한 파라미터 (없으면 null or empty)
     * @return raw JSON string of backtest result
     */
    @Transactional
    public String doBacktest(AlphaWorkspace ws, String period, Map<String, Object> customParams) throws Exception {
        JsonNode cfg = getActiveStrategy(om.readTree(ws.getStrategyConfigJson()));
        String stype = cfg.path("strategy_type").asText("moving_average_timing");
        String pickedPeriod = (period != null && !period.isBlank()) ? period.trim() : "5y";
        if (customParams == null) customParams = Map.of();

        if ("infinite_buying".equals(stype)) {
            List<String> tickers = new ArrayList<>();
            if (cfg.path("assets").isArray()) {
                for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
            }
            if (tickers.isEmpty()) tickers = List.of("TQQQ", "SOXL");

            Map<String, Object> ibExtra = new HashMap<>();
            ibExtra.put("period", pickedPeriod);
            JsonNode pms = cfg.path("parameters");
            if (pms.path("split").isNumber()) ibExtra.put("split", pms.path("split").asInt());
            if (pms.path("take_profit_pct").isNumber())
                ibExtra.put("take_profit_pct", pms.path("take_profit_pct").asDouble());
            if (pms.path("loc_offset_pct").isNumber())
                ibExtra.put("loc_offset_pct", pms.path("loc_offset_pct").asDouble());
            if (pms.path("initial_capital").isNumber())
                ibExtra.put("initial_capital", pms.path("initial_capital").asDouble());
            // 직접 지정(달력) 기간 — customParams 로 전달되면 [start,end] 구간만 백테스트
            if (customParams.get("start") != null) ibExtra.put("start", String.valueOf(customParams.get("start")));
            if (customParams.get("end") != null) ibExtra.put("end", String.valueOf(customParams.get("end")));
            // 최적화/코드 편집 파라미터 오버라이드(스윕 가능) — cfg.parameters 보다 우선
            for (String k : new String[]{"split", "take_profit_pct", "loc_offset_pct", "initial_capital"}) {
                if (customParams.get(k) != null) ibExtra.put(k, customParams.get(k));
            }

            JsonNode ib = analytics.infiniteBuying(tickers, ibExtra);
            ws.setLastBacktestJson(ib.toString());
            ws.setCodeJson(null); // 백테스트 후 DeveloperLab이 최신 strategyConfig로 코드 재생성하도록 초기화
            if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED"); // LIVE 운용 중이면 강등 금지
            workspaceRepo.save(ws);
            {
                Map<String, Object> ibPayload = new LinkedHashMap<>();
                String ibTitle = String.join(",", tickers) + " 무한매수법 백테스트 완료";
                ibPayload.put("title", ibTitle);
                ibPayload.put("strategy", "infinite_buying");
                JsonNode ibRm = ib.path("risk_metrics");
                if (!ibRm.isMissingNode() && ibRm.isObject()) {
                    Map<String, Object> ibmmap = new LinkedHashMap<>();
                    for (String mk : List.of("return_pct","mdd_pct","vol_pct","sharpe","win_rate_pct","trades")) {
                        if (ibRm.has(mk)) ibmmap.put(mk, ibRm.get(mk).asDouble());
                    }
                    ibPayload.put("metrics", ibmmap);
                }
                String ibPayloadJson = null;
                try { ibPayloadJson = om.writeValueAsString(ibPayload); } catch (Exception ignored) {}
                recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN", ibTitle, ibPayloadJson);
            }
            try {
                notificationService.create(ws.getUser(), Notification.NotificationType.BACKTEST_COMPLETE,
                        "백테스트 완료",
                        String.join(", ", tickers) + " 무한매수법 백테스트가 완료되었습니다.",
                        "WORKSPACE", ws.getId());
            } catch (Exception e) {
                log.warn("[Backtest] 알림 전송 실패 (무시): {}", e.getMessage());
            }
            return ib.toString();
        }

        if ("value_rebalancing".equals(stype)) {
            List<String> tickers = new ArrayList<>();
            if (cfg.path("assets").isArray()) {
                for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
            }
            if (tickers.isEmpty()) tickers = List.of("QLD");

            Map<String, Object> vrExtra = new HashMap<>();
            vrExtra.put("period", pickedPeriod);
            JsonNode pms = cfg.path("parameters");
            if (pms.path("rebalance_days").isNumber())  vrExtra.put("rebalance_days",  pms.path("rebalance_days").asInt());
            if (pms.path("expected_return").isNumber()) vrExtra.put("expected_return", pms.path("expected_return").asDouble());
            if (pms.path("band_pct").isNumber())        vrExtra.put("band_pct",        pms.path("band_pct").asDouble());
            if (pms.path("pool_target_pct").isNumber()) vrExtra.put("pool_target_pct", pms.path("pool_target_pct").asDouble());
            if (pms.path("initial_pool_pct").isNumber())vrExtra.put("initial_pool_pct",pms.path("initial_pool_pct").asDouble());
            if (pms.path("initial_capital").isNumber()) vrExtra.put("initial_capital", pms.path("initial_capital").asDouble());
            if (customParams.get("start") != null) vrExtra.put("start", String.valueOf(customParams.get("start")));
            if (customParams.get("end") != null)   vrExtra.put("end",   String.valueOf(customParams.get("end")));
            // 최적화/코드 편집 파라미터 오버라이드(스윕 가능) — cfg.parameters 보다 우선
            for (String k : new String[]{"rebalance_days", "expected_return", "band_pct", "pool_target_pct", "initial_pool_pct", "initial_capital"}) {
                if (customParams.get(k) != null) vrExtra.put(k, customParams.get(k));
            }

            JsonNode vr = analytics.valueRebalancing(tickers, vrExtra);
            ws.setLastBacktestJson(vr.toString());
            ws.setCodeJson(null);
            if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED");
            workspaceRepo.save(ws);
            {
                Map<String, Object> vrPayload = new LinkedHashMap<>();
                String vrTitle = String.join(",", tickers) + " 밸류 리밸런싱 백테스트 완료";
                vrPayload.put("title", vrTitle);
                vrPayload.put("strategy", "value_rebalancing");
                JsonNode vrRm = vr.path("risk_metrics");
                if (!vrRm.isMissingNode() && vrRm.isObject()) {
                    Map<String, Object> vrmmap = new LinkedHashMap<>();
                    for (String mk : List.of("return_pct","mdd_pct","vol_pct","sharpe","win_rate_pct","trades")) {
                        if (vrRm.has(mk)) vrmmap.put(mk, vrRm.get(mk).asDouble());
                    }
                    vrPayload.put("metrics", vrmmap);
                }
                String vrPayloadJson = null;
                try { vrPayloadJson = om.writeValueAsString(vrPayload); } catch (Exception ignored) {}
                recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN", vrTitle, vrPayloadJson);
            }
            try {
                notificationService.create(ws.getUser(), Notification.NotificationType.BACKTEST_COMPLETE,
                        "백테스트 완료",
                        String.join(", ", tickers) + " 밸류 리밸런싱 백테스트가 완료되었습니다.",
                        "WORKSPACE", ws.getId());
            } catch (Exception e) {
                log.warn("[Backtest] 알림 전송 실패 (무시): {}", e.getMessage());
            }
            return vr.toString();
        }

        if ("momentum_rotation".equals(stype)) {
            List<String> tickers = new ArrayList<>();
            if (cfg.path("assets").isArray()) {
                for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
            }
            if (tickers.size() < 2) tickers = List.of("QQQ","XLK","XLF","XLE","XLV","XLY","TLT","GLD","SCHD","BIL");

            Map<String, Object> momExtra = new HashMap<>();
            momExtra.put("period", pickedPeriod);
            JsonNode pms = cfg.path("parameters");
            if (pms.path("lookback_days").isNumber())      momExtra.put("lookback_days",     pms.path("lookback_days").asInt());
            if (pms.path("skip_recent_days").isNumber())   momExtra.put("skip_recent_days",  pms.path("skip_recent_days").asInt());
            if (pms.path("top_n").isNumber())              momExtra.put("top_n",             pms.path("top_n").asInt());
            if (pms.path("rebalance_days").isNumber())     momExtra.put("rebalance_days",    pms.path("rebalance_days").asInt());
            if (pms.path("abs_momentum_gate").isBoolean()) momExtra.put("abs_momentum_gate", pms.path("abs_momentum_gate").asBoolean());
            if (pms.path("cash_asset").isTextual())        momExtra.put("cash_asset",        pms.path("cash_asset").asText());
            if (pms.path("initial_capital").isNumber())    momExtra.put("initial_capital",   pms.path("initial_capital").asDouble());
            if (customParams.get("start") != null) momExtra.put("start", String.valueOf(customParams.get("start")));
            if (customParams.get("end") != null)   momExtra.put("end",   String.valueOf(customParams.get("end")));
            for (String k : new String[]{"lookback_days", "skip_recent_days", "top_n", "rebalance_days", "initial_capital"}) {
                if (customParams.get(k) != null) momExtra.put(k, customParams.get(k));
            }

            JsonNode mom = analytics.momentumRotation(tickers, momExtra);
            ws.setLastBacktestJson(mom.toString());
            ws.setCodeJson(null);
            if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED");
            workspaceRepo.save(ws);
            {
                Map<String, Object> momPayload = new LinkedHashMap<>();
                String momTitle = "섹터 모멘텀 로테이션 백테스트 완료";
                momPayload.put("title", momTitle);
                momPayload.put("strategy", "momentum_rotation");
                JsonNode momRm = mom.path("risk_metrics");
                if (!momRm.isMissingNode() && momRm.isObject()) {
                    Map<String, Object> mmmap = new LinkedHashMap<>();
                    for (String mk : List.of("return_pct","mdd_pct","vol_pct","sharpe","win_rate_pct","trades")) {
                        if (momRm.has(mk)) mmmap.put(mk, momRm.get(mk).asDouble());
                    }
                    momPayload.put("metrics", mmmap);
                }
                String momPayloadJson = null;
                try { momPayloadJson = om.writeValueAsString(momPayload); } catch (Exception ignored) {}
                recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN", momTitle, momPayloadJson);
            }
            try {
                notificationService.create(ws.getUser(), Notification.NotificationType.BACKTEST_COMPLETE,
                        "백테스트 완료", "섹터 모멘텀 로테이션 백테스트가 완료되었습니다.",
                        "WORKSPACE", ws.getId());
            } catch (Exception e) {
                log.warn("[Backtest] 알림 전송 실패 (무시): {}", e.getMessage());
            }
            return mom.toString();
        }

        String ticker = cfg.path("assets").isArray() && cfg.path("assets").size() > 0
                ? normalizeTicker(cfg.path("assets").get(0).asText("SPY")) : "SPY";
        String pyStrategy = switch (stype) {
            default -> "sma_cross";
        };

        Map<String, Object> extra = new HashMap<>();
        extra.put("period", pickedPeriod);
        // 사용자 커스텀 파라미터 (코드 편집에서 추출) 우선 적용
        if (!customParams.isEmpty()) {
            if (customParams.containsKey("sma_fast"))    extra.put("sma_fast",    customParams.get("sma_fast"));
            if (customParams.containsKey("sma_slow"))    extra.put("sma_slow",    customParams.get("sma_slow"));
            if (customParams.containsKey("rsi_period"))  extra.put("rsi_period",  customParams.get("rsi_period"));
            if (customParams.containsKey("rsi_low"))     extra.put("rsi_low",     customParams.get("rsi_low"));
            if (customParams.containsKey("rsi_high"))    extra.put("rsi_high",    customParams.get("rsi_high"));
            if (customParams.containsKey("macd_fast"))   extra.put("macd_fast",   customParams.get("macd_fast"));
            if (customParams.containsKey("macd_slow"))   extra.put("macd_slow",   customParams.get("macd_slow"));
            if (customParams.containsKey("macd_signal")) extra.put("macd_signal", customParams.get("macd_signal"));
            if (customParams.containsKey("ticker"))      ticker = normalizeTicker((String) customParams.get("ticker"));
        } else {
            int maw = cfg.path("parameters").path("ma_window").asInt(0);
            if (maw > 0) extra.put("sma_slow", maw);
        }

        JsonNode bt = analytics.backtest(ticker, pyStrategy, extra);
        ws.setLastBacktestJson(bt.toString());
        ws.setCodeJson(null); // 백테스트 후 DeveloperLab이 최신 strategyConfig로 코드 재생성하도록 초기화
        if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED"); // LIVE 운용 중이면 강등 금지
        workspaceRepo.save(ws);
        {
            Map<String, Object> btPayload = new LinkedHashMap<>();
            btPayload.put("title", ticker + " / " + pyStrategy + " 백테스트 완료");
            btPayload.put("ticker", ticker);
            btPayload.put("strategy", pyStrategy);
            JsonNode rm = bt.path("risk_metrics");
            if (!rm.isMissingNode() && rm.isObject()) {
                Map<String, Object> mmap = new LinkedHashMap<>();
                for (String mk : List.of("return_pct","mdd_pct","vol_pct","sharpe","win_rate_pct","trades")) {
                    if (rm.has(mk)) mmap.put(mk, rm.get(mk).asDouble());
                }
                btPayload.put("metrics", mmap);
            }
            String btPayloadJson = null;
            try { btPayloadJson = om.writeValueAsString(btPayload); } catch (Exception ignored) {}
            recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN",
                    ticker + " / " + pyStrategy + " 백테스트 완료", btPayloadJson);
        }
        try {
            notificationService.create(ws.getUser(), Notification.NotificationType.BACKTEST_COMPLETE,
                    "백테스트 완료",
                    ticker + " 백테스트가 완료되었습니다. 결과를 확인해보세요.",
                    "WORKSPACE", ws.getId());
        } catch (Exception e) {
            log.warn("[Backtest] 알림 전송 실패 (무시): {}", e.getMessage());
        }
        return bt.toString();
    }

    // ═══════════════════════════════════ P3: 전략 개선 제안서 ═══════════════════════
    // 진단 + 선택지(기존 유지 / 안정형 / 공격형) + 각 선택지의 "전후" 백테스트 비교(수익률·MDD·변동성·샤프).
    // LLM 은 진단 + 변형 파라미터만 제안하고, 실제 성과는 vectorbt 백테스트로 측정한다(추정치 아님).

    /** 사용자가 코드에서 추출해 보낸 현재 파라미터를 기준으로 개선 제안서를 만든다. (비영속) */
    public Map<String, Object> doImproveProposal(AlphaWorkspace ws, Long uid,
                                                 String period, Map<String, Object> currentParams) {
        if (currentParams == null) currentParams = new LinkedHashMap<>();
        String pickedPeriod = (period != null && !period.isBlank()) ? period.trim() : "5y";
        JsonNode cfg = safeCfg(ws, currentParams);
        String stype = cfg.path("strategy_type").asText("moving_average_timing");

        // 1) 베이스라인(현재) 백테스트 — 비영속
        Map<String, Object> baseMetrics = backtestMetricsSafe(cfg, stype, pickedPeriod, currentParams);

        // 2) LLM: 진단 + 안정/공격 변형 파라미터(JSON)
        JsonNode llm = askImprovementLlm(uid, stype, currentParams, baseMetrics,
                ws.getGoalProfileJson(), ws.getLastTrustJson());
        String diagnosis = llm.path("diagnosis").asText(
                "현재 전략의 성과를 기준으로 변동성·낙폭을 줄이는 안정형과 수익을 더 추구하는 공격형 두 방향을 비교합니다.");

        // 3) 변형 파라미터 정제(조정 키만, 숫자만, sma_fast<sma_slow 보정) + 변형 백테스트(병렬)
        Map<String, Object> stableParams = mergeVariant(currentParams, llm.path("stable").path("params"));
        Map<String, Object> aggParams    = mergeVariant(currentParams, llm.path("aggressive").path("params"));
        // 안정형·공격형 백테스트를 동시에 실행 → 순차 2회 대기를 1회 시간으로 단축
        CompletableFuture<Map<String, Object>> stableF =
                CompletableFuture.supplyAsync(() -> backtestMetricsSafe(cfg, stype, pickedPeriod, stableParams), backtestPool);
        CompletableFuture<Map<String, Object>> aggF =
                CompletableFuture.supplyAsync(() -> backtestMetricsSafe(cfg, stype, pickedPeriod, aggParams), backtestPool);
        Map<String, Object> stableMetrics = stableF.join();
        Map<String, Object> aggMetrics    = aggF.join();

        // 4) 옵션 조립
        List<Map<String, Object>> options = new ArrayList<>();
        options.add(improveOption("keep", "기존 유지", "neutral",
                "현재 파라미터를 그대로 유지합니다.", currentParams, currentParams, baseMetrics));
        options.add(improveOption("stable", "안정형 조정", "stable",
                llm.path("stable").path("summary").asText("변동성과 낙폭을 줄이는 보수적 조정."),
                currentParams, stableParams, stableMetrics));
        options.add(improveOption("aggressive", "공격형 조정", "aggressive",
                llm.path("aggressive").path("summary").asText("수익률을 더 추구하는 공격적 조정."),
                currentParams, aggParams, aggMetrics));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("diagnosis", diagnosis);
        out.put("strategyType", stype);
        out.put("period", pickedPeriod);
        out.put("metricKeys", List.of("return_pct", "mdd_pct", "vol_pct", "sharpe"));
        out.put("options", options);
        Map<String, Object> logPayload = new LinkedHashMap<>();
        logPayload.put("title", "리스크 조정 제안");
        logPayload.put("aiReason", diagnosis);
        logPayload.put("strategyType", stype);
        logPayload.put("period", pickedPeriod);
        logPayload.put("options", options);
        try {
            recordLog(ws.getId(), "SYSTEM", "IMPROVE_PROPOSAL",
                    "전략 개선 제안서 생성(" + stype + ")", om.writeValueAsString(logPayload));
        } catch (Exception e) {
            recordLog(ws.getId(), "SYSTEM", "IMPROVE_PROPOSAL", "전략 개선 제안서 생성(" + stype + ")", null);
        }
        return out;
    }

    /**
     * P4: Claude 패치의 "전후" 효과를 같은 비교 포맷으로 측정.
     * before/after 파라미터(코드 상수 추출본)로 각각 실측 백테스트해 변경 전·후 메트릭을 반환한다.
     * (코드 로직만 바뀌고 파라미터 상수가 그대로면 두 컬럼이 동일 — paramsChanged=false 로 표시)
     */
    public Map<String, Object> doCompareBacktest(AlphaWorkspace ws, Map<String, Object> before,
                                                 Map<String, Object> after, String period) {
        if (before == null) before = new LinkedHashMap<>();
        if (after == null) after = new LinkedHashMap<>();
        String p = (period != null && !period.isBlank()) ? period.trim() : "5y";
        JsonNode cfgB = safeCfg(ws, before);
        JsonNode cfgA = safeCfg(ws, after);
        // 변경 전·후 백테스트를 동시에 실행 → 순차 2회 대기를 1회 시간으로 단축
        final String stypeB = cfgB.path("strategy_type").asText("moving_average_timing");
        final String stypeA = cfgA.path("strategy_type").asText("moving_average_timing");
        final Map<String, Object> beforeP = before, afterP = after;
        CompletableFuture<Map<String, Object>> beforeF =
                CompletableFuture.supplyAsync(() -> backtestMetricsSafe(cfgB, stypeB, p, beforeP), backtestPool);
        CompletableFuture<Map<String, Object>> afterF =
                CompletableFuture.supplyAsync(() -> backtestMetricsSafe(cfgA, stypeA, p, afterP), backtestPool);
        Map<String, Object> beforeM = beforeF.join();
        Map<String, Object> afterM  = afterF.join();
        List<Map<String, Object>> changes = paramChanges(before, after);

        List<Map<String, Object>> options = new ArrayList<>();
        options.add(improveOption("before", "변경 전", "neutral", "Claude 편집 이전 상태.", before, before, beforeM));
        options.add(improveOption("after", "변경 후", "stable", "Claude 편집 이후 상태.", before, after, afterM));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", p);
        out.put("metricKeys", List.of("return_pct", "mdd_pct", "vol_pct", "sharpe"));
        out.put("paramsChanged", !changes.isEmpty());
        out.put("changes", changes);
        out.put("options", options);
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", "패치 전후 성능 비교");
            payload.put("aiReason", "코드/파라미터 변경 전후 성능 차이를 동일 조건에서 비교했습니다.");
            payload.put("period", p);
            payload.put("changes", changes);
            payload.put("options", options);
            recordLog(ws.getId(), "SYSTEM", "PATCH_COMPARE", "Claude 패치 전후 백테스트 비교",
                    om.writeValueAsString(payload));
        } catch (Exception e) {
            recordLog(ws.getId(), "SYSTEM", "PATCH_COMPARE", "Claude 패치 전후 백테스트 비교", null);
        }
        return out;
    }

    /** strategyConfigJson 이 비어도 동작하도록 안전한 cfg 확보(없으면 customParams.ticker 기준 기본 전략). */
    private JsonNode safeCfg(AlphaWorkspace ws, Map<String, Object> currentParams) {
        try {
            String raw = ws.getStrategyConfigJson();
            if (raw != null && !raw.isBlank()) return getActiveStrategy(om.readTree(raw));
        } catch (Exception ignore) { /* fall through to default */ }
        Map<String, Object> def = new LinkedHashMap<>();
        boolean macd = currentParams.containsKey("macd_fast") && !currentParams.containsKey("sma_fast");
        def.put("strategy_type", macd ? "momentum_rotation" : "moving_average_timing");
        Object t = currentParams.get("ticker");
        def.put("assets", List.of(t != null ? String.valueOf(t) : "SPY"));
        return om.valueToTree(def);
    }

    /** 변형 파라미터를 백테스트해 정규화 메트릭을 반환. 실패 시 {available:false}. (비영속) */
    private Map<String, Object> backtestMetricsSafe(JsonNode cfg, String stype, String period,
                                                    Map<String, Object> params) {
        try {
            JsonNode bt = runBacktestRaw(cfg, stype, period, params);
            return extractMetrics(bt);
        } catch (Exception e) {
            log.warn("[improve] 변형 백테스트 실패: {}", e.getMessage());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("available", false);
            m.put("error", e.getMessage());
            return m;
        }
    }

    /** doBacktest 와 동일한 전략/티커 해석을 쓰되 영속화하지 않고 결과 JsonNode 만 반환. */
    private JsonNode runBacktestRaw(JsonNode cfg, String stype, String period, Map<String, Object> customParams) {
        if (customParams == null) customParams = Map.of();
        if ("infinite_buying".equals(stype)) {
            List<String> tickers = new ArrayList<>();
            if (cfg.path("assets").isArray()) for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
            if (tickers.isEmpty()) tickers = List.of("TQQQ", "SOXL");
            Map<String, Object> ib = new HashMap<>();
            ib.put("period", period);
            JsonNode pms = cfg.path("parameters");
            putNum(ib, "split", customParams.containsKey("split") ? customParams.get("split") : (pms.path("split").isNumber() ? pms.path("split").asInt() : null));
            putNum(ib, "take_profit_pct", customParams.containsKey("take_profit_pct") ? customParams.get("take_profit_pct") : (pms.path("take_profit_pct").isNumber() ? pms.path("take_profit_pct").asDouble() : null));
            putNum(ib, "loc_offset_pct", pms.path("loc_offset_pct").isNumber() ? pms.path("loc_offset_pct").asDouble() : null);
            return analytics.infiniteBuying(tickers, ib);
        }
        if ("value_rebalancing".equals(stype)) {
            List<String> tickers = new ArrayList<>();
            if (cfg.path("assets").isArray()) for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
            if (tickers.isEmpty()) tickers = List.of("QLD");
            Map<String, Object> vr = new HashMap<>();
            vr.put("period", period);
            JsonNode pms = cfg.path("parameters");
            putNum(vr, "rebalance_days",   pms.path("rebalance_days").isNumber()   ? pms.path("rebalance_days").asInt()    : null);
            putNum(vr, "expected_return",  pms.path("expected_return").isNumber()  ? pms.path("expected_return").asDouble(): null);
            putNum(vr, "band_pct",         pms.path("band_pct").isNumber()         ? pms.path("band_pct").asDouble()       : null);
            putNum(vr, "pool_target_pct",  pms.path("pool_target_pct").isNumber()  ? pms.path("pool_target_pct").asDouble(): null);
            putNum(vr, "initial_pool_pct", pms.path("initial_pool_pct").isNumber() ? pms.path("initial_pool_pct").asDouble(): null);
            return analytics.valueRebalancing(tickers, vr);
        }
        String ticker = cfg.path("assets").isArray() && cfg.path("assets").size() > 0
                ? normalizeTicker(cfg.path("assets").get(0).asText("SPY")) : "SPY";
        String pyStrategy = "momentum_rotation".equals(stype) ? "momentum_rotation" : "sma_cross";
        Map<String, Object> extra = new HashMap<>();
        extra.put("period", period);
        for (String k : List.of("sma_fast", "sma_slow", "rsi_period", "rsi_low", "rsi_high",
                "macd_fast", "macd_slow", "macd_signal", "vix_threshold")) {
            if (customParams.containsKey(k)) extra.put(k, customParams.get(k));
        }
        if (customParams.get("ticker") != null) ticker = normalizeTicker(String.valueOf(customParams.get("ticker")));
        return analytics.backtest(ticker, pyStrategy, extra);
    }

    /** 백테스트 결과 JsonNode → 비교용 정규화 메트릭(수익률·CAGR·MDD·변동성·샤프·승률·거래수). */
    private Map<String, Object> extractMetrics(JsonNode bt) {
        JsonNode rm = bt.path("risk_metrics");
        JsonNode st = bt.path("stats");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("available", true);
        m.put("return_pct", firstNum(st.path("total_return_pct"), rm.path("cagr_pct")));
        m.put("cagr_pct",   numOrNull(rm.path("cagr_pct")));
        m.put("mdd_pct",    firstNum(st.path("max_drawdown_pct"), rm.path("max_drawdown_pct")));
        m.put("vol_pct",    numOrNull(rm.path("volatility_pct")));
        m.put("sharpe",     firstNum(st.path("sharpe"), rm.path("sharpe")));
        m.put("win_rate_pct", firstNum(st.path("win_rate_pct"), rm.path("win_rate_pct")));
        m.put("trades",     st.path("trades").isNumber() ? st.path("trades").asInt() : null);
        return m;
    }

    private Map<String, Object> improveOption(String key, String label, String tone, String summary,
                                              Map<String, Object> base, Map<String, Object> params,
                                              Map<String, Object> metrics) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("key", key);
        o.put("label", label);
        o.put("tone", tone);
        o.put("summary", summary);
        o.put("params", params);
        o.put("changes", paramChanges(base, params));
        o.put("metrics", metrics);
        return o;
    }

    /** base→params 사이에 바뀐 파라미터만 {param,label,from,to} 리스트로. */
    private List<Map<String, Object>> paramChanges(Map<String, Object> base, Map<String, Object> params) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (params == null) return out;
        for (Map.Entry<String, Object> e : params.entrySet()) {
            Object from = base.get(e.getKey());
            Object to = e.getValue();
            if (to != null && (from == null || !String.valueOf(from).equals(String.valueOf(to)))) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("param", e.getKey());
                c.put("label", e.getKey().toUpperCase());
                c.put("from", from);
                c.put("to", to);
                out.add(c);
            }
        }
        return out;
    }

    /** 현재 파라미터 + LLM 변형(조정 키만, 숫자만, sma_fast<sma_slow 보정). ticker 변경은 무시. */
    private Map<String, Object> mergeVariant(Map<String, Object> current, JsonNode variant) {
        Map<String, Object> merged = new LinkedHashMap<>(current);
        if (variant != null && variant.isObject()) {
            for (String k : List.of("sma_fast", "sma_slow", "rsi_period", "rsi_low", "rsi_high",
                    "macd_fast", "macd_slow", "macd_signal", "vix_threshold", "split", "take_profit_pct")) {
                JsonNode v = variant.path(k);
                if (v.isNumber()) merged.put(k, v.numberValue());
            }
        }
        // sma_fast < sma_slow 보정
        Object f = merged.get("sma_fast"), s = merged.get("sma_slow");
        if (f instanceof Number && s instanceof Number && ((Number) f).doubleValue() >= ((Number) s).doubleValue()) {
            merged.put("sma_slow", ((Number) f).intValue() * 2); // 안전한 분리
        }
        return merged;
    }

    private JsonNode askImprovementLlm(Long uid, String stype, Map<String, Object> params,
                                       Map<String, Object> baseMetrics, String goalJson, String trustJson) {
        String adjustable = "infinite_buying".equals(stype)
                ? "split, take_profit_pct"
                : "momentum_rotation".equals(stype)
                    ? "macd_fast, macd_slow, macd_signal"
                    : "sma_fast, sma_slow (sma_fast < sma_slow 필수), rsi_period, rsi_low, rsi_high";
        String sys = "당신은 퀀트 전략 분석가입니다. 주어진 전략 파라미터와 백테스트 성과를 보고, "
                + "변동성·낙폭을 줄이는 '안정형'과 수익률을 더 추구하는 '공격형' 두 변형의 파라미터를 제안하세요. "
                + "오직 아래 JSON 스키마로만, 코드펜스 없이 답하세요:\n"
                + "{\"diagnosis\":\"한국어 2~3문장 진단\",\"stable\":{\"summary\":\"한 문장\",\"params\":{조정한 키만}},"
                + "\"aggressive\":{\"summary\":\"한 문장\",\"params\":{조정한 키만}}}\n"
                + "조정 가능한 키: " + adjustable + ". 정수/실수 값만. ticker 는 바꾸지 마세요.";
        String user = "전략유형: " + stype + "\n현재 파라미터: " + safeJson(params)
                + "\n베이스라인 성과: " + safeJson(baseMetrics)
                + "\n목표: " + (goalJson == null ? "{}" : tail(goalJson, 600))
                + "\n신뢰도(Trust): " + (trustJson == null ? "{}" : tail(trustJson, 400));
        try {
            String raw = gateway.oneShot(uid, DEFAULT_MODEL, sys, user, true, "improve_proposal");
            JsonNode n = parseLlmJson(raw);
            if (n != null && n.isObject()) return n;
        } catch (Exception e) {
            log.warn("[improve] LLM 호출 실패, 룰베이스 폴백: {}", e.getMessage());
        }
        return ruleBasedVariants(stype, params);
    }

    /** LLM 실패/미설정 시 룰베이스 변형(안정형=느리게/보수, 공격형=빠르게/민감). */
    private JsonNode ruleBasedVariants(String stype, Map<String, Object> params) {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("diagnosis", "AI 응답을 사용할 수 없어 룰베이스로 변형을 제안합니다. 안정형은 신호를 느리게(휩쏘 감소), 공격형은 빠르게(추세 조기 포착) 조정합니다.");
        Map<String, Object> stableP = new LinkedHashMap<>(), aggP = new LinkedHashMap<>();
        if (params.get("sma_fast") instanceof Number && params.get("sma_slow") instanceof Number) {
            int sf = ((Number) params.get("sma_fast")).intValue(), ss = ((Number) params.get("sma_slow")).intValue();
            stableP.put("sma_fast", Math.max(5, (int) Math.round(sf * 1.5))); stableP.put("sma_slow", (int) Math.round(ss * 1.5));
            aggP.put("sma_fast", Math.max(3, (int) Math.round(sf * 0.6)));    aggP.put("sma_slow", Math.max(10, (int) Math.round(ss * 0.7)));
        } else if (params.get("macd_fast") instanceof Number) {
            int mf = ((Number) params.get("macd_fast")).intValue(), msl = num(params.get("macd_slow"), 26);
            stableP.put("macd_fast", mf + 4); stableP.put("macd_slow", msl + 8);
            aggP.put("macd_fast", Math.max(3, mf - 4)); aggP.put("macd_slow", Math.max(10, msl - 8));
        }
        root.put("stable", Map.of("summary", "신호를 느리게 해 변동성·낙폭을 줄입니다.", "params", stableP));
        root.put("aggressive", Map.of("summary", "신호를 빠르게 해 수익 기회를 더 잡습니다.", "params", aggP));
        return om.valueToTree(root);
    }

    private JsonNode parseLlmJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        int i = s.indexOf('{'), j = s.lastIndexOf('}');
        if (i >= 0 && j > i) s = s.substring(i, j + 1);
        try { return om.readTree(s); } catch (Exception e) { return null; }
    }

    private String safeJson(Object o) {
        try { return om.writeValueAsString(o); } catch (Exception e) { return String.valueOf(o); }
    }
    private void putNum(Map<String, Object> m, String k, Object v) { if (v != null) m.put(k, v); }
    private Double numOrNull(JsonNode n) { return n != null && n.isNumber() ? n.asDouble() : null; }
    private Object firstNum(JsonNode a, JsonNode b) {
        if (a != null && a.isNumber()) return a.numberValue();
        if (b != null && b.isNumber()) return b.numberValue();
        return null;
    }
    private int num(Object o, int dflt) { return o instanceof Number ? ((Number) o).intValue() : dflt; }
    private static String tail(String s, int n) { return s == null ? "" : (s.length() > n ? s.substring(s.length() - n) : s); }

    /** 백테스트 JSON에서 핵심 지표만 추출 (equity_curve·ticker_series 등 대용량 필드 제외). */
    private String summarizeBacktestJson(String json) {
        if (json == null || json.isBlank()) return "없음";
        try {
            JsonNode root = om.readTree(json);
            java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
            for (String key : new String[]{"stats", "risk_metrics"}) {
                JsonNode node = root.path(key);
                if (node.isObject()) { out.put(key, node); break; }
            }
            for (String key : new String[]{"strategy", "ticker", "period", "sessions"}) {
                JsonNode node = root.path(key);
                if (!node.isMissingNode() && !node.isNull()) out.put(key, node);
            }
            return om.writeValueAsString(out);
        } catch (Exception e) {
            return tail(json, 500);
        }
    }

    /** Trust JSON에서 score·component 요약만 추출. */
    private String summarizeTrustJson(String json) {
        if (json == null || json.isBlank()) return "없음";
        try {
            JsonNode root = om.readTree(json);
            java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
            for (String key : new String[]{"trust_score", "score", "overall", "grade", "components", "reasons", "summary"}) {
                JsonNode node = root.path(key);
                if (!node.isMissingNode() && !node.isNull()) out.put(key, node);
            }
            return om.writeValueAsString(out);
        } catch (Exception e) {
            return tail(json, 500);
        }
    }

    // ═══════════════════════════════════════════ Regime ══════════════════════

    @Transactional
    /** workspace strategy_type → analytics python 전략 키 (IB/VR 은 진짜 전용 엔진으로 라우팅). */
    private String pyStrategyOf(String stype) {
        return switch (stype) {
            case "infinite_buying"   -> "infinite_buying";
            case "value_rebalancing" -> "value_rebalancing";
            case "momentum_rotation" -> "momentum_rotation";
            default                  -> "sma_cross";
        };
    }

    /** IB/VR 전략이면 cfg.parameters 의 상태기반 파라미터를 options 에 실어 Trust/Regime 이 진짜 전략으로 돌게 한다. */
    private void putStrategyParams(Map<String, Object> opts, String stype, JsonNode cfg) {
        JsonNode pms = cfg.path("parameters");
        if ("infinite_buying".equals(stype)) {
            if (pms.path("split").isNumber())           opts.put("split", pms.path("split").asInt());
            if (pms.path("take_profit_pct").isNumber()) opts.put("take_profit_pct", pms.path("take_profit_pct").asDouble());
            if (pms.path("loc_offset_pct").isNumber())  opts.put("loc_offset_pct", pms.path("loc_offset_pct").asDouble());
        } else if ("value_rebalancing".equals(stype)) {
            if (pms.path("rebalance_days").isNumber())   opts.put("rebalance_days", pms.path("rebalance_days").asInt());
            if (pms.path("expected_return").isNumber())  opts.put("expected_return", pms.path("expected_return").asDouble());
            if (pms.path("band_pct").isNumber())         opts.put("band_pct", pms.path("band_pct").asDouble());
            if (pms.path("pool_target_pct").isNumber())  opts.put("pool_target_pct", pms.path("pool_target_pct").asDouble());
            if (pms.path("initial_pool_pct").isNumber()) opts.put("initial_pool_pct", pms.path("initial_pool_pct").asDouble());
        }
    }

    public String doRegime(AlphaWorkspace ws) throws Exception {
        return doRegime(ws, null);
    }

    /**
     * Regime 분석. options 가 null/빈 맵이면 rule-based + 10y 기본 동작.
     * 지원 키: method("rule"|"hmm"), smoothing(int), n_states(int), period(String).
     */
    @Transactional
    public String doRegime(AlphaWorkspace ws, Map<String, Object> options) throws Exception {
        JsonNode cfg = getActiveStrategy(om.readTree(ws.getStrategyConfigJson()));
        String ticker = normalizeTicker(cfg.path("assets").get(0).asText("SPY"));
        String stype = cfg.path("strategy_type").asText("moving_average_timing");
        Map<String, Object> opts = options == null ? new HashMap<>() : new HashMap<>(options);
        opts.put("strategy", pyStrategyOf(stype));     // per_regime 백테스트가 진짜 전략(IB/VR 포함)으로
        putStrategyParams(opts, stype, cfg);
        JsonNode out = analytics.regime(ticker, opts);
        ws.setLastRegimeJson(out.toString());
        workspaceRepo.save(ws);
        String method = options == null ? "rule" : String.valueOf(options.getOrDefault("method", "rule"));
        recordLog(ws.getId(), "SYSTEM", "REGIME_ANALYZED", "Regime 분석 완료 (method=" + method + ")", null);
        return out.toString();
    }

    // ═══════════════════════════════════════════ Trust ═══════════════════════

    @Transactional
    public String doTrust(AlphaWorkspace ws) throws Exception {
        return doTrust(ws, null);
    }

    /**
     * Trust Score 계산. options 가 null/빈 맵이면 엔진 기본값 사용.
     * 지원 키: weights(Map), overfit_penalty_max(int), wf_train(int), wf_test(int),
     *           mdd_target_pct(double), period(String)
     */
    @Transactional
    public String doTrust(AlphaWorkspace ws, Map<String, Object> options) throws Exception {
        JsonNode cfg = getActiveStrategy(om.readTree(ws.getStrategyConfigJson()));
        String ticker = normalizeTicker(cfg.path("assets").get(0).asText("SPY"));
        String stype = cfg.path("strategy_type").asText("moving_average_timing");
        String pyStrategy = pyStrategyOf(stype);
        Map<String, Object> opts = options == null ? new HashMap<>() : new HashMap<>(options);
        putStrategyParams(opts, stype, cfg);           // IB/VR 이면 진짜 전략 파라미터 전달 → SMA 대용 제거
        JsonNode trust = analytics.trustScore(ticker, pyStrategy, opts);
        ws.setLastTrustJson(trust.toString());
        workspaceRepo.save(ws);
        recordLog(ws.getId(), "SYSTEM", "TRUST_COMPUTED",
                "Trust Score = " + trust.path("trust_score").asInt(0), trust.toString());
        return trust.toString();
    }

    // ═══════════════════════════════════════════ Queue Orders ════════════════

    @Transactional
    public Map<String, Object> doQueueOrders(AlphaWorkspace ws, Long uid) throws Exception {
        JsonNode cfg = getActiveStrategy(om.readTree(ws.getStrategyConfigJson()));
        String stype = cfg.path("strategy_type").asText("");
        if (!"infinite_buying".equals(stype)) {
            throw new IllegalStateException("현재는 infinite_buying 전략만 자동 주문 큐를 지원합니다");
        }

        Long brokerId = ws.getBrokerAccountId();
        if (brokerId == null) {
            var mock = brokerAccountRepo.findByUserIdAndBrokerTypeAndEnv(uid, BrokerAccount.BrokerType.KIS, BrokerAccount.Env.MOCK);
            if (mock.isEmpty()) {
                throw new IllegalStateException(
                        "MOCK BrokerAccount가 없습니다. 먼저 모의투자 계좌를 등록하세요");
            }
            brokerId = mock.get().getId();
        }

        List<String> tickers = new ArrayList<>();
        if (cfg.path("assets").isArray())
            for (JsonNode a : cfg.path("assets")) tickers.add(normalizeTicker(a.asText()));
        if (tickers.isEmpty()) tickers = List.of("TQQQ", "SOXL");

        Map<String, Object> ibExtra = new HashMap<>();
        JsonNode pms = cfg.path("parameters");
        if (pms.path("split").isNumber()) ibExtra.put("split", pms.path("split").asInt());
        if (pms.path("take_profit_pct").isNumber())
            ibExtra.put("take_profit_pct", pms.path("take_profit_pct").asDouble());
        if (pms.path("loc_offset_pct").isNumber())
            ibExtra.put("loc_offset_pct", pms.path("loc_offset_pct").asDouble());
        if (pms.path("initial_capital").isNumber())
            ibExtra.put("initial_capital", pms.path("initial_capital").asDouble());

        JsonNode plan = analytics.infiniteBuyingPlan(tickers, ibExtra);
        List<Map<String, Object>> queued = new ArrayList<>();
        int created = 0;
        final Long finalBrokerId = brokerId;

        if (plan.path("plans").isArray()) {
            for (JsonNode p : plan.path("plans")) {
                String tk = p.path("ticker").asText();
                String side = p.path("side").asText();
                double price = p.path("price").asDouble(0);
                double qty = p.path("qty").asDouble(0);
                int intQty = (int) Math.floor(qty);
                if (intQty <= 0) continue;

                OrderProposal op = OrderProposal.builder()
                        .userId(uid)
                        .workspaceId(ws.getId())
                        .brokerAccountId(finalBrokerId)
                        .ticker(tk)
                        .side(side)
                        .qty(intQty)
                        .limitPrice(price > 0 ? java.math.BigDecimal.valueOf(price) : null)
                        .source("SIGNAL")
                        .status("PENDING")
                        .rationale("무한매수법 " + p.path("reason").asText() + " @ " + price)
                        .expiresAt(LocalDateTime.now().plusHours(24))
                        .build();
                orderProposalRepo.save(op);
                created++;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", op.getId());
                row.put("ticker", tk);
                row.put("side", side);
                row.put("qty", intQty);
                row.put("price", price);
                row.put("reason", p.path("reason").asText());
                queued.add(row);
            }
        }

        recordLog(ws.getId(), "SYSTEM", "ORDERS_QUEUED",
                "무한매수법 주문 " + created + "건 큐잉 (PENDING)", plan.toString());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("brokerAccountId", finalBrokerId);
        resp.put("asOf", plan.path("as_of").asText());
        resp.put("created", created);
        resp.put("orders", queued);
        resp.put("summary", om.convertValue(plan.path("summary"), Map.class));
        return resp;
    }

    // ═══════════════════════════════════════════ Briefing ════════════════════

    public Map<String, Object> doBriefing(AlphaWorkspace ws, Long uid) throws Exception {
        List<String> tickers = extractTickers(ws);
        String[] session = usMarketSession();           // [kind, 한글 라벨]
        String sessionKind = session[0], sessionLabel = session[1];

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("generatedAt", LocalDateTime.now().format(TS));
        resp.put("references", buildRegimeReferences(ws));

        // 1) Perplexity 실뉴스 구조화 브리핑 (키가 설정된 경우)
        if (perplexity.available()) {
            try {
                PerplexityProvider.Answer ans = perplexity.ask(
                        briefingSystemPrompt(),
                        briefingUserPrompt(ws, tickers, sessionKind, sessionLabel),
                        "sonar-pro");

                gateway.logExternalUsage(uid, "sonar-pro", ans.tokensIn(), ans.tokensOut(), true, null, "briefing_perplexity");
                Map<String, Object> sections = parseSections(ans.content());
                if (sections != null && !sections.isEmpty()) {
                    sections.put("sessionLabel", sessionLabel);
                    sections.putIfAbsent("disclaimer", "본 브리핑은 교육 목적의 참고 정보이며 투자 권유가 아닙니다.");
                    resp.put("sections", sections);
                } else {
                    resp.put("briefing", ans.content());   // JSON 파싱 실패 → 평문 폴백
                }
                resp.put("liveNews", toLiveNews(ans.sources()));
                recordLog(ws.getId(), "AI", "BRIEFING", "Living Briefing 생성 (Perplexity·" + sessionKind + ")", null);
                try {
                    notificationService.create(ws.getUser(), Notification.NotificationType.BRIEFING_GENERATED,
                            "Living Briefing 도착",
                            sessionLabel + " 브리핑이 생성되었습니다. 지금 확인해보세요.",
                            "WORKSPACE", ws.getId());
                } catch (Exception e) {
                    log.warn("[Briefing] 알림 전송 실패 (무시): {}", e.getMessage());
                }
                return resp;
            } catch (Exception e) {
                log.warn("Perplexity 브리핑 실패 → Gemini 폴백: {}", e.getMessage());
                gateway.logExternalUsage(uid, "sonar-pro", 0, 0, false, e.getMessage(), "briefing_perplexity");
            }
        }

        // 2) 폴백 — Gemini (실뉴스 없이 전략정보 기반 평문)
        String system = """
            너는 사용자의 퍼스널 퀀트 매니저다. 다음 정보를 보고 오늘의 브리핑을
            한국어로 자연스럽게 작성하라. 4~6문장. 읽기 좋게.

            출력 항목:
            - 오늘의 한 줄 헤드라인
            - 전략 건강 상태(GOOD / WATCH / WARNING)
            - 현재 시장 국면 추정
            - Trust Score 변화 코멘트
            - 권장 체크 1가지
            - 면책 한 줄("교육 목적, 투자 권유 아님")
            """;
        String input = "Goal Profile:\n" + tail(ws.getGoalProfileJson(), 800)
                + "\n\nStrategy Config:\n" + tail(ws.getStrategyConfigJson(), 800)
                + "\n\nLast Backtest:\n" + summarizeBacktestJson(ws.getLastBacktestJson())
                + "\n\nLast Trust:\n" + summarizeTrustJson(ws.getLastTrustJson());
        String text = callAi(uid, system, input, "briefing_fallback");
        recordLog(ws.getId(), "AI", "BRIEFING", "Living Briefing 생성 (fallback)", null);
        try {
            notificationService.create(ws.getUser(), Notification.NotificationType.BRIEFING_GENERATED,
                    "Living Briefing 도착",
                    sessionLabel + " 브리핑이 생성되었습니다. 지금 확인해보세요.",
                    "WORKSPACE", ws.getId());
        } catch (Exception e) {
            log.warn("[Briefing] 알림 전송 실패 (무시): {}", e.getMessage());
        }
        resp.put("briefing", text);
        return resp;
    }

    /** 美 동부시간 기준 세션 분류 → [kind, 한글 라벨]. (정규장 09:30~16:00 ET) */
    private String[] usMarketSession() {
        java.time.ZonedDateTime ny = java.time.ZonedDateTime.now(java.time.ZoneId.of("America/New_York"));
        java.time.DayOfWeek d = ny.getDayOfWeek();
        if (d == java.time.DayOfWeek.SATURDAY || d == java.time.DayOfWeek.SUNDAY) {
            return new String[]{"WEEKEND", "주말 브리핑 · 지난주 마감 + 다음주 전망"};
        }
        int mins = ny.getHour() * 60 + ny.getMinute();
        int open = 9 * 60 + 30, close = 16 * 60;
        if (mins < open)  return new String[]{"PRE",      "개장 전 브리핑 · 밤사이 이슈 + 오늘 전망"};
        if (mins < close) return new String[]{"INTRADAY", "장중 브리핑 · 실시간 시황"};
        return new String[]{"CLOSE", "마감 브리핑 · 오늘 결과 + 키워드"};
    }

    /** 워크스페이스 설정에서 관심 종목(티커) 추출 (최대 12). */
    private List<String> extractTickers(AlphaWorkspace ws) {
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String json : new String[]{ws.getStrategyConfigJson(), ws.getGoalProfileJson()}) {
            if (json == null || json.isBlank()) continue;
            try {
                JsonNode root = om.readTree(json);
                for (String key : new String[]{"assets", "tickers", "symbols", "universe"}) {
                    JsonNode arr = root.path(key);
                    if (arr.isArray()) {
                        for (JsonNode n : arr) {
                            String v = n.isObject() ? n.path("ticker").asText(n.path("symbol").asText("")) : n.asText("");
                            if (!v.isBlank()) out.add(v.trim().toUpperCase());
                        }
                    }
                }
            } catch (Exception ignore) {}
            // 자유서술 텍스트의 대문자 티커 보조 추출 (예: TQQQ, SOXL)
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\b[A-Z]{2,5}\\b").matcher(json);
            while (m.find() && out.size() < 12) {
                String tk = m.group();
                if (!COMMON_WORDS.contains(tk)) out.add(tk);
            }
        }
        List<String> list = new ArrayList<>(out);
        return list.size() > 12 ? new ArrayList<>(list.subList(0, 12)) : list;
    }
    private static final java.util.Set<String> COMMON_WORDS = java.util.Set.of(
        "GOOD", "WATCH", "JSON", "TRUE", "FALSE", "NULL", "USD", "KRW", "ETF",
        "AND", "THE", "FOR", "MOCK", "REAL", "BUY", "SELL", "KIS", "LOC", "API");

    private String briefingSystemPrompt() {
        return """
            너는 미국 증시 전문 퍼스널 브리핑 진행자다. Bloomberg, CNBC, Reuters, WSJ,
            MarketWatch, Yahoo Finance 등 신뢰도 높은 미국 금융 매체의 '최신' 보도를 웹검색해
            사용자 포트폴리오에 맞춘 브리핑을 만든다.

            규칙:
            - 반드시 한국어로, 초보 투자자도 이해하기 쉽게 풀어서 설명한다(전문용어는 짧게 풀이).
            - 수치·사실은 검색된 실제 보도에 근거한다. 모르면 추측하지 말고 비운다.
            - 출력은 아래 JSON 객체 '하나'만. 코드펜스(```)나 설명문 없이 JSON만 출력한다.

            JSON 스키마:
            {
              "headline": "오늘의 한 줄 헤드라인",
              "health": "GOOD | WATCH | WARNING",
              "regime": "현재 시장 국면 한 구절 (예: 위험회피·고변동성)",
              "keywords": ["오늘의 핵심 키워드 3~6개"],
              "marketSummary": "전체 시황을 2~4문장으로 쉽게 요약",
              "indices": [
                {"name": "S&P 500", "value": "수치", "change": "+/-x.xx%", "comment": "한 줄"},
                {"name": "나스닥", "value": "", "change": "", "comment": ""},
                {"name": "다우", "value": "", "change": "", "comment": ""}
              ],
              "sectors": [{"name": "섹터명", "comment": "한 줄 동향"}],
              "holdings": [{"ticker": "종목", "comment": "오늘 이 종목 관련 이슈/움직임을 쉽게", "sentiment": "긍정 | 중립 | 부정"}],
              "healthComment": "전략 건강 상태 코멘트",
              "regimeComment": "시장 국면이 이 전략에 주는 의미",
              "trustComment": "Trust Score 관련 코멘트",
              "recommendation": "오늘 확인하면 좋은 체크포인트 1가지",
              "disclaimer": "교육 목적, 투자 권유 아님",
              "radioScript": "위 내용을 친근한 라디오 진행자 말투로 풀어쓴 음성용 스크립트. 핵심만 담아 또박또박, 약 1500~2500자. 인사로 시작해 전체시황→섹터→내 종목→오늘의 체크 순서로 자연스럽게 이어서."
            }
            """;
    }

    private String briefingUserPrompt(AlphaWorkspace ws, List<String> tickers, String sessionKind, String sessionLabel) {
        String focus = switch (sessionKind) {
            case "PRE"      -> "지금은 미국 장 개장 전이다. 밤사이(전일 마감 이후) 발생한 이슈, 선물·프리마켓 동향, 오늘 개장 전망에 초점을 맞춰라.";
            case "INTRADAY" -> "지금은 미국 장중이다. 실시간 지수·섹터 움직임과 장중 주요 뉴스에 초점을 맞춰라.";
            case "CLOSE"    -> "지금은 미국 장 마감 직후다. 오늘 마감 결과(종가·등락), 하루를 움직인 키워드와 이유에 초점을 맞춰라.";
            default          -> "지금은 주말이다. 지난 주 마감 요약과 다음 주 일정(실적·지표·FOMC 등) 전망에 초점을 맞춰라.";
        };
        String tk = tickers.isEmpty() ? "(설정된 종목 없음 — 전체 미국 증시 위주로)" : String.join(", ", tickers);
        return "세션: " + sessionLabel + "\n" + focus
                + "\n\n사용자 포트폴리오 종목: " + tk
                + "\n\n[전략 컨텍스트]"
                + "\nGoal Profile: " + tail(ws.getGoalProfileJson(), 800)
                + "\nStrategy Config: " + tail(ws.getStrategyConfigJson(), 800)
                + "\nLast Backtest: " + summarizeBacktestJson(ws.getLastBacktestJson())
                + "\nLast Trust: " + summarizeTrustJson(ws.getLastTrustJson())
                + "\n\n위 종목들과 미국 증시 전반의 '가장 최신' 이슈를 신뢰소스에서 검색해 스키마대로 JSON만 출력하라.";
    }
    private String nz(String s) { return (s == null || s.isBlank()) ? "(없음)" : s; }

    /** Perplexity 본문에서 JSON 객체를 견고하게 추출 → Map. 실패 시 null. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseSections(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        int fence = s.indexOf("```");
        if (fence >= 0) {
            int nl = s.indexOf('\n', fence);
            int lastFence = s.lastIndexOf("```");
            if (nl >= 0 && lastFence > nl) s = s.substring(nl + 1, lastFence);
        }
        int a = s.indexOf('{'), b = s.lastIndexOf('}');
        if (a < 0 || b <= a) return null;
        try {
            JsonNode node = om.readTree(s.substring(a, b + 1));
            if (!node.isObject()) return null;
            return (Map<String, Object>) om.convertValue(node, Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** 검색 출처 → 프론트 liveNews ([{title,url}]) 최대 8건. */
    private List<Map<String, Object>> toLiveNews(List<PerplexityProvider.Source> sources) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (sources == null) return out;
        for (PerplexityProvider.Source src : sources) {
            if (src.url() == null || src.url().isBlank()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", src.title());
            m.put("url", src.url());
            out.add(m);
            if (out.size() >= 8) break;
        }
        return out;
    }

    /**
     * 브리핑의 시장국면 분석 근거가 되는 실재 출처 링크(≥5). 공통 매크로/레짐 출처 +
     * 전략 관심자산에 따른 특화 출처를 함께 제공한다. (실재하는 안정적 URL만 사용)
     */
    private List<Map<String, Object>> buildRegimeReferences(AlphaWorkspace ws) {
        List<Map<String, Object>> refs = new ArrayList<>();
        refs.add(ref("FRED — 거시경제 데이터(금리·CPI·실업)", "https://fred.stlouisfed.org/", "거시 레짐 판단의 1차 원천 데이터"));
        refs.add(ref("CME FedWatch — 기준금리 확률", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", "통화정책 레짐(완화/긴축) 기대"));
        refs.add(ref("CBOE VIX — 변동성 지수", "https://www.cboe.com/tradable_products/vix/", "고변동성·불안정 국면 식별"));
        refs.add(ref("TradingView — 글로벌 마켓 오버뷰", "https://www.tradingview.com/markets/", "추세/국면 시각화 및 비교"));
        refs.add(ref("Investing.com — 경제 캘린더", "https://www.investing.com/economic-calendar/", "이벤트 리스크(FOMC·CPI 등)"));
        refs.add(ref("Yahoo Finance — 마켓", "https://finance.yahoo.com/markets/", "지수·섹터 일별 동향"));

        // 전략 관심자산 기반 특화 출처
        String ctx = ((ws.getGoalProfileJson() == null ? "" : ws.getGoalProfileJson())
                + " " + (ws.getStrategyConfigJson() == null ? "" : ws.getStrategyConfigJson())).toUpperCase();
        if (ctx.contains("BTC") || ctx.contains("ETH") || ctx.contains("USDT") || ctx.contains("CRYPTO") || ctx.contains("코인") || ctx.contains("암호")) {
            refs.add(ref("CoinGecko — 암호화폐 시황", "https://www.coingecko.com/", "암호화폐 변동성·도미넌스 레짐"));
        }
        if (ctx.contains("TQQQ") || ctx.contains("QQQ") || ctx.contains("SOXL") || ctx.contains("NASDAQ") || ctx.contains("기술") || ctx.contains("반도체")) {
            refs.add(ref("Nasdaq — 마켓 액티비티", "https://www.nasdaq.com/market-activity", "나스닥·기술/반도체 국면"));
        }
        if (ctx.contains("KOSPI") || ctx.contains("코스피") || ctx.contains("005930") || ctx.contains("삼성")) {
            refs.add(ref("KRX — 한국거래소 시장정보", "https://global.krx.co.kr/", "국내 증시 국면"));
        }
        return refs;
    }

    private Map<String, Object> ref(String title, String url, String why) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("url", url);
        m.put("why", why);
        return m;
    }

    // ═══════════════════════════════════════════ Auto-Run ════════════════════

    /**
     * formalize → backtest → regime → trust → (infinite_buying) queue-orders 순차 실행.
     * 각 단계 실패는 catch해서 결과에 error로 넣고 계속 진행.
     *
     * 성능: 외곽 @Transactional 을 두지 않는다. 각 단계는 self.doXxx 의 자체 트랜잭션으로 동작하므로,
     * 긴 외부호출(analytics 30~120s × 4) 전체를 하나의 DB 커넥션이 점유(~5분)하던 문제를 없앤다.
     * (ws 는 JSON 문자열 필드만 사용 — LAZY 관계 접근 없음. 각 단계 후 findById 로 최신 상태 reload)
     */
    public Map<String, Object> doAutoRun(Long wsId, Long uid) {
        AlphaWorkspace ws = workspaceRepo.findByIdAndUserId(wsId, uid)
                .orElseThrow(() -> new NoSuchElementException("Workspace not found"));

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("startedAt", LocalDateTime.now().format(TS));
        List<String> steps = new ArrayList<>();

        // 1) formalize
        if (ws.getStrategyConfigJson() == null) {
            try {
                self.doFormalize(ws, uid);
                ws = workspaceRepo.findById(wsId).orElse(ws); // reload after save
                steps.add("formalize");
            } catch (Exception e) {
                report.put("formalizeError", e.getMessage());
                return saveReport(ws, report);
            }
        } else {
            steps.add("formalize:cached");
        }

        JsonNode active;
        try {
            active = getActiveStrategy(om.readTree(ws.getStrategyConfigJson()));
        } catch (Exception e) {
            report.put("error", "strategyConfig 파싱 실패: " + e.getMessage());
            return saveReport(ws, report);
        }

        String stype = active.path("strategy_type").asText("");
        report.put("strategyType", stype);
        report.put("strategyName", active.path("strategy_name").asText(""));
        report.put("assets", om.convertValue(active.path("assets"), List.class));
        report.put("parameters", om.convertValue(active.path("parameters"), Map.class));

        // 2) backtest
        try {
            String btJson = self.doBacktest(ws, null, null);
            report.put("backtest", om.readTree(btJson));
            ws = workspaceRepo.findById(wsId).orElse(ws);
            steps.add("backtest");
        } catch (Exception e) {
            report.put("backtestError", e.getMessage());
        }

        // 3) regime
        try {
            String rgJson = self.doRegime(ws);
            report.put("regime", om.readTree(rgJson));
            ws = workspaceRepo.findById(wsId).orElse(ws);
            steps.add("regime");
        } catch (Exception e) {
            report.put("regimeError", e.getMessage());
        }

        // 4) trust
        try {
            String trJson = self.doTrust(ws);
            report.put("trust", om.readTree(trJson));
            ws = workspaceRepo.findById(wsId).orElse(ws);
            steps.add("trust");
        } catch (Exception e) {
            report.put("trustError", e.getMessage());
        }

        // 5) infinite_buying → queue-orders
        if ("infinite_buying".equals(stype)) {
            try {
                Map<String, Object> orders = self.doQueueOrders(ws, uid);
                report.put("orders", orders);
                steps.add("queue-orders");
            } catch (Exception e) {
                report.put("ordersError", e.getMessage());
            }
        }

        report.put("steps", steps);
        report.put("finishedAt", LocalDateTime.now().format(TS));
        recordLog(wsId, "SYSTEM", "AUTO_RUN",
                "통합 파이프라인 실행: " + String.join(", ", steps), null);
        return saveReport(ws, report);
    }

    private Map<String, Object> saveReport(AlphaWorkspace ws, Map<String, Object> report) {
        try {
            ws.setLastReportJson(om.writeValueAsString(report));
            workspaceRepo.save(ws);
        } catch (Exception e) {
            log.warn("saveReport failed: {}", e.getMessage());
        }
        return report;
    }
}
