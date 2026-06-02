package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.ai.service.GeminiService;
import com.DevBridge.devbridge.domain.strategy.service.AnalyticsClient;
import com.DevBridge.devbridge.domain.ai.repository.AlphaWorkspaceRepository;
import com.DevBridge.devbridge.domain.ai.repository.AlphaDecisionLogRepository;
import com.DevBridge.devbridge.domain.ai.repository.AlphaChatMessageRepository;
import com.DevBridge.devbridge.domain.strategy.entity.Strategy;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.ai.dto.AiChatRequest;
import com.DevBridge.devbridge.domain.user.entity.*;
import com.DevBridge.devbridge.domain.client.entity.*;
import com.DevBridge.devbridge.domain.project.entity.*;
import com.DevBridge.devbridge.domain.chat.entity.*;
import com.DevBridge.devbridge.domain.notification.entity.*;
import com.DevBridge.devbridge.domain.payment.entity.*;
import com.DevBridge.devbridge.domain.strategy.entity.*;
import com.DevBridge.devbridge.domain.ai.entity.*;
import com.DevBridge.devbridge.domain.user.repository.*;
import com.DevBridge.devbridge.domain.client.repository.*;
import com.DevBridge.devbridge.domain.project.repository.*;
import com.DevBridge.devbridge.domain.chat.repository.*;
import com.DevBridge.devbridge.domain.notification.repository.*;
import com.DevBridge.devbridge.domain.payment.repository.*;
import com.DevBridge.devbridge.domain.strategy.repository.*;
import com.DevBridge.devbridge.domain.ai.repository.*;
import com.DevBridge.devbridge.domain.ai.service.gateway.AiGatewayService;
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
        if (uid != null) {
            return gateway.oneShot(uid, DEFAULT_MODEL, systemInstruction, userInput, false);
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
        int start = Math.max(0, history.size() - 12);
        for (int i = start; i < history.size(); i++) {
            var m = history.get(i);
            ctx.append("[").append(m.getRole()).append("] ").append(m.getText()).append("\n");
        }

        String system = """
            너는 Alpha-Helix의 퍼스널 퀀트 매니저다. 사용자의 '삶의 목표'를 듣고 투자 전략 설계 조건 8가지를 한 단계씩 수집한다.
            반드시 한국어로, 친근하지만 구체적으로 답한다.

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
            reply = callAi(uid, system, ctx.toString());
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

    // ═══════════════════════════════════════════ Formalize ═══════════════════

    /**
     * Goal Profile → Strategy 후보 3개 생성.
     * @return strategyConfig envelope map
     */
    @Transactional
    public Map<String, Object> doFormalize(AlphaWorkspace ws, Long uid) throws Exception {
        String system = """
            너는 사용자 목표(JSON)를 받아 **deterministic 백테스트가 가능한** 전략 config 후보 3개를 제시한다.
            각 후보는 아래 7개 템플릿 중 서로 다른 strategy_type을 고른 보수/중립/공격 톤으로 다양하게 구성하라:
              - buy_hold
              - moving_average_timing
              - momentum_rotation
              - vix_risk_off
              - trend_volatility_control
              - dividend_tilt
              - infinite_buying    // 라오어식 무한매수법. 사용자가 '무한매수','라오어','LOC','분할매수','평단' 언급 or 레버리지ETF+월현금흐름 → 반드시 후보에 포함.

            infinite_buying 선택 시 parameters:
              {"split": 40, "take_profit_pct": 10, "loc_offset_pct": 15, "initial_capital": <원금 KRW>}
            assets는 반드시 2개 이상 (예: ["TQQQ","SOXL"]).

            반드시 코드블록 없이 **순수 JSON 배열만** 출력하라. 길이는 정확히 3.
            각 원소:
            {
              "strategy_name": "...",
              "strategy_type": "...",
              "assets": ["..."],
              "rules": { ... },
              "parameters": {
                "ma_window": 120,
                "vix_threshold": 25,
                "rebalance_frequency": "monthly|weekly|daily",
                "max_drawdown_target": 20
              },
              "rationale": "한국어 1~2문장",
              "risk_tone": "보수|중립|공격"
            }

            assets 미명시 시 risk_tolerance 기준: 보수→SPY+SCHD+SHY, 중립→QQQ+SCHD, 공격→TQQQ+SOXL+QLD.
            암호화폐: "BTC-USD" / "ETH-USD" 형식.
            """;

        String result;
        try {
            result = callAi(uid, system, ws.getGoalProfileJson());
        } catch (RuntimeException e) {
            // GeminiService가 무료 티어 소진 등 구체적 메시지를 담아 RuntimeException으로 전달
            log.warn("Gemini call failed on doFormalize. userId={}, msg={}", uid, e.getMessage());
            throw new RuntimeException("정형화 실패: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("LLM 호출 실패: " + e.getMessage(), e);
        }

        String arrayJson = extractFirstJsonArray(result);
        List<Map<String, Object>> candidates = new ArrayList<>();
        try {
            if (arrayJson != null) {
                JsonNode arr = om.readTree(arrayJson);
                for (int i = 0; i < arr.size() && i < 3; i++) {
                    Map<String, Object> cand = om.convertValue(arr.get(i), Map.class);
                    cand.put("id", "cand-" + (i + 1));
                    candidates.add(cand);
                }
            }
            if (candidates.isEmpty()) {
                String obj = extractFirstJson(result);
                if (obj != null) {
                    Map<String, Object> cand = om.readValue(obj, Map.class);
                    cand.put("id", "cand-1");
                    candidates.add(cand);
                }
            }
        } catch (Exception e) {
            log.error("formalize parse fail", e);
        }

        if (candidates.isEmpty()) {
            throw new RuntimeException("LLM 응답을 파싱하지 못했습니다: " + result);
        }

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("candidates", candidates);
        envelope.put("selectedId", candidates.get(0).get("id"));
        String envelopeJson = om.writeValueAsString(envelope);

        ws.setStrategyConfigJson(envelopeJson);
        if (!"LIVE".equals(ws.getStatus())) ws.setStatus("FORMALIZED"); // LIVE 운용 중이면 강등 금지
        workspaceRepo.save(ws);
        recordLog(ws.getId(), "AI", "STRATEGY_PROPOSED",
                "Strategy 후보 " + candidates.size() + "개 생성", envelopeJson);

        return Map.of("strategyConfig", envelopeJson, "candidates", candidates);
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

            JsonNode ib = analytics.infiniteBuying(tickers, ibExtra);
            ws.setLastBacktestJson(ib.toString());
            if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED"); // LIVE 운용 중이면 강등 금지
            workspaceRepo.save(ws);
            recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN",
                    String.join(",", tickers) + " 무한매수법 백테스트 완료", null);
            return ib.toString();
        }

        String ticker = cfg.path("assets").isArray() && cfg.path("assets").size() > 0
                ? normalizeTicker(cfg.path("assets").get(0).asText("SPY")) : "SPY";
        String pyStrategy = switch (stype) {
            case "momentum_rotation" -> "macd";
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
        if (!"LIVE".equals(ws.getStatus())) ws.setStatus("TESTED"); // LIVE 운용 중이면 강등 금지
        workspaceRepo.save(ws);
        recordLog(ws.getId(), "SYSTEM", "BACKTEST_RUN",
                ticker + " / " + pyStrategy + " 백테스트 완료", null);
        return bt.toString();
    }

    // ═══════════════════════════════════════════ Regime ══════════════════════

    @Transactional
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
        JsonNode out = analytics.regime(ticker, options);
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
        String pyStrategy = "momentum_rotation".equals(stype) ? "macd" : "sma_cross";
        JsonNode trust = analytics.trustScore(ticker, pyStrategy, options);
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
        String system = """
            너는 사용자의 퍼스널 퀀트 매니저다. 다음 정보를 보고 오늘의 Morning Briefing을
            한국어로 자연스럽게 작성하라. 4~6문장. 카드 형태로 읽기 좋게.

            출력 항목:
            - 오늘의 한 줄 헤드라인
            - 전략 건강 상태(GOOD / WATCH / WARNING)
            - 현재 시장 국면 추정
            - Trust Score 변화 코멘트
            - 권장 체크 1가지
            - 면책 한 줄("교육 목적, 투자 권유 아님")
            """;
        String input = "Goal Profile:\n" + ws.getGoalProfileJson()
                + "\n\nStrategy Config:\n" + ws.getStrategyConfigJson()
                + "\n\nLast Backtest:\n" + ws.getLastBacktestJson()
                + "\n\nLast Trust:\n" + ws.getLastTrustJson();

        String text = callAi(uid, system, input);
        recordLog(ws.getId(), "AI", "BRIEFING", "Living Briefing 생성", null);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("briefing", text);
        resp.put("references", buildRegimeReferences(ws));
        resp.put("generatedAt", LocalDateTime.now().format(TS));
        return resp;
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
     */
    @Transactional
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
