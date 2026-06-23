package com.DevBridge.devbridge.domain.ai.service.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Perplexity Sonar — 웹검색 기반 답변. 환경변수 PERPLEXITY_API_KEY 필요. */
@Component
public class PerplexityProvider implements LlmProvider {
    private static final Logger log = LoggerFactory.getLogger(PerplexityProvider.class);
    private static final String API_URL = "https://api.perplexity.ai/chat/completions";

    private final String apiKey;
    private final RestClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    public PerplexityProvider(@Value("${perplexity.api.key:}") String apiKey) {
        this.apiKey = apiKey;
        // sonar-pro 딥서치는 60~90초까지 걸릴 수 있어 read timeout 을 넉넉히 두되,
        // 프론트 axios(200s) 보다는 작게 해 '백엔드는 성공했는데 프론트가 먼저 끊는' 레이스를 방지.
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofSeconds(15));
        rf.setReadTimeout(Duration.ofSeconds(120));
        this.client = RestClient.builder().requestFactory(rf).build();
    }

    // 비용 최적화 설정 — Living Briefing 기본 모델/출력상한/검색 최신성.
    @Value("${app.briefing.perplexity-model:sonar}") private String briefingModel;
    @Value("${perplexity.max-tokens:3500}") private int maxTokens;
    @Value("${perplexity.recency:week}") private String recency;
    /** Living Briefing 기본 모델(기본 sonar — sonar-pro 대비 비용 약 1/5). */
    public String briefingModel() { return briefingModel; }

    @Override public String id() { return "perplexity"; }
    @Override public String displayName() { return "Perplexity Sonar"; }
    @Override public boolean available() { return apiKey != null && !apiKey.isBlank(); }
    @Override public List<ModelInfo> models() {
        return List.of(
            new ModelInfo("sonar-pro",       "Sonar Pro",       "고품질 웹검색 답변"),
            new ModelInfo("sonar",           "Sonar",           "기본 검색 답변"),
            new ModelInfo("sonar-reasoning", "Sonar Reasoning", "추론 + 검색")
        );
    }

    /** 검색 결과 1건 (실시간 뉴스 출처). */
    public record Source(String title, String url, String snippet, String date) {}

    /** Perplexity 응답 — 본문 + 웹검색 출처 목록 + 토큰 사용량. */
    public record Answer(String content, List<Source> sources, long tokensIn, long tokensOut) {}

    @Override
    public String oneShot(String systemInstruction, String userPrompt, String model) {
        return ask(systemInstruction, userPrompt, model).content();
    }

    /**
     * 본문 + 실시간 검색 출처(search_results)를 함께 반환한다.
     * Living Briefing 처럼 "신뢰소스 인용 링크"가 필요한 경우 사용.
     */
    public Answer ask(String systemInstruction, String userPrompt, String model) {
        if (!available()) throw new IllegalStateException("PERPLEXITY_API_KEY 가 설정되지 않았습니다.");
        String useModel = (model == null || model.isBlank()) ? "sonar-pro" : model;

        var messages = new ArrayList<Map<String, Object>>();
        if (systemInstruction != null && !systemInstruction.isBlank()) {
            messages.add(Map.of("role", "system", "content", systemInstruction));
        }
        messages.add(Map.of("role", "user", "content", userPrompt));

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", useModel);
        body.put("messages", messages);
        body.put("temperature", 0.3);
        if (maxTokens > 0) body.put("max_tokens", maxTokens);                                   // 출력 상한 → 비용·지연 절감
        if (recency != null && !recency.isBlank()) body.put("search_recency_filter", recency);  // 최신 뉴스로 검색 집중

        // 일시 오류(429·5xx·네트워크 블립)로 브리핑이 Gemini 폴백(시장데이터 없음)으로 떨어지는 걸 막기 위해
        // 최대 3회 재시도(0.9s·1.8s 백오프). 최종 실패 시에만 throw → 호출측(doBriefing)이 폴백/캐시유지 판단.
        RuntimeException lastErr = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                String response = client.post()
                    .uri(API_URL)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

                JsonNode root = mapper.readTree(response);
                String content = root.path("choices").path(0).path("message").path("content").asText("(빈 응답)");
                long tIn  = root.path("usage").path("prompt_tokens").asLong(0);
                long tOut = root.path("usage").path("completion_tokens").asLong(0);
                return new Answer(content, parseSources(root), tIn, tOut);
            } catch (Exception e) {
                lastErr = new RuntimeException("Perplexity 호출 실패: " + e.getMessage());
                log.warn("Perplexity 호출 실패 (시도 {}/3): {}", attempt, e.getMessage());
                if (attempt < 3) {
                    try { Thread.sleep(900L * attempt); }
                    catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            }
        }
        log.error("Perplexity 호출 최종 실패(3회)", lastErr);
        throw lastErr;
    }

    /** search_results(제목·URL·스니펫·날짜) 우선, 없으면 citations(URL만) 로 폴백. */
    private List<Source> parseSources(JsonNode root) {
        List<Source> out = new ArrayList<>();
        JsonNode sr = root.path("search_results");
        if (sr.isArray() && sr.size() > 0) {
            for (JsonNode n : sr) {
                String url = n.path("url").asText("");
                if (url.isBlank()) continue;
                out.add(new Source(
                    n.path("title").asText(""),
                    url,
                    n.path("snippet").asText(""),
                    n.path("date").asText("")
                ));
            }
            return out;
        }
        JsonNode cites = root.path("citations");
        if (cites.isArray()) {
            for (JsonNode n : cites) {
                String url = n.asText("");
                if (!url.isBlank()) out.add(new Source("", url, "", ""));
            }
        }
        return out;
    }
}
