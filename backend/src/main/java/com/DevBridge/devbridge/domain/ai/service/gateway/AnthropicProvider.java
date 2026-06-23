package com.DevBridge.devbridge.domain.ai.service.gateway;

import com.DevBridge.devbridge.domain.ai.dto.AiChatRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.time.Duration;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Anthropic Claude (Messages API).
 * https://docs.anthropic.com/en/api/messages
 *
 * 환경변수 ANTHROPIC_API_KEY 필요. 키 없으면 isAvailable=false → 게이트웨이가 거부.
 */
@Slf4j
@Component("aiAnthropicProvider")
public class AnthropicProvider implements AiProvider {

    private final String apiKey;
    private final String baseUrl;
    private final RestClient http;
    private final ObjectMapper om = new ObjectMapper();

    public AnthropicProvider(@Value("${anthropic.api.key:}") String apiKey,
                              @Value("${anthropic.api.url:https://api.anthropic.com}") String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        // DDIA 8장(부분 실패 격리): read 타임아웃이 없으면 LLM 이 응답을 안 끊을 때 톰캣 워커가
        // 영구 점유 → 스레드풀 고갈(연쇄 장애). connect 10s / read 120s 명시.
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofSeconds(10));
        rf.setReadTimeout(Duration.ofSeconds(120));
        this.http = RestClient.builder().requestFactory(rf).build();
    }

    @Override public String providerKey() { return "ANTHROPIC"; }

    @Override public boolean isAvailable() { return apiKey != null && !apiKey.isBlank(); }

    @Override
    public Result chat(String modelId, AiChatRequest req) {
        ensureKey();
        List<Map<String, Object>> messages = new ArrayList<>();
        if (req.getHistory() != null) {
            for (var m : req.getHistory()) {
                String role = m.getRole();
                if (role == null) role = "user";
                role = role.equalsIgnoreCase("model") || role.equalsIgnoreCase("bot") ? "assistant"
                       : role.equalsIgnoreCase("assistant") ? "assistant" : "user";
                messages.add(Map.of("role", role, "content", m.getText() == null ? "" : m.getText()));
            }
        }
        if (messages.isEmpty()) {
            messages.add(Map.of("role", "user", "content", "안녕"));
        }
        return call(modelId, req.getSystemInstruction(), messages, 4096);
    }

    @Override
    public Result oneShot(String modelId, String systemInstruction, String userPrompt, boolean wantJson) {
        ensureKey();
        String prompt = wantJson
                ? userPrompt + "\n\n반드시 JSON 객체 하나만 반환하라. 코드펜스, 설명, 주석 금지."
                : userPrompt;
        List<Map<String, Object>> messages = List.of(Map.of("role", "user", "content", prompt));
        return call(modelId, systemInstruction, messages, 8192);
    }

    private Result call(String modelId, String system, List<Map<String, Object>> messages, int maxTokens) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", modelId);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);
        if (system != null && !system.isBlank()) body.put("system", system);

        // 최초 1회 + 429(Too Many Requests) 지수 백오프 재시도 2회.
        // 전체 브리핑이 여러 LIVE 워크스페이스를 잇따라 생성할 때 일시적 폭주를 흡수(429 노출 방지 안전망).
        final int maxAttempts = 3;
        HttpClientErrorException last429 = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String raw = http.post()
                        .uri(baseUrl + "/v1/messages")
                        .header("x-api-key", apiKey)
                        .header("anthropic-version", "2023-06-01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
                JsonNode json = om.readTree(raw);
                JsonNode contents = json.path("content");
                StringBuilder out = new StringBuilder();
                if (contents.isArray()) {
                    for (JsonNode c : contents) {
                        if ("text".equals(c.path("type").asText())) out.append(c.path("text").asText());
                    }
                }
                long tIn = json.path("usage").path("input_tokens").asLong(0);
                long tOut = json.path("usage").path("output_tokens").asLong(0);
                return new Result(out.toString(), tIn, tOut);
            } catch (HttpClientErrorException e) {
                if (e.getStatusCode().value() == 429 && attempt < maxAttempts) {
                    last429 = e;
                    long waitMs = 1500L * (1L << (attempt - 1));   // 1.5s, 3s
                    log.warn("[Anthropic] 429 — {}회차, {}ms 대기 후 재시도", attempt, waitMs);
                    try { Thread.sleep(waitMs); }
                    catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                    continue;
                }
                log.warn("[Anthropic] HTTP {} body={}", e.getStatusCode(), e.getResponseBodyAsString());
                throw new RuntimeException("Anthropic API 호출 실패: " + e.getStatusCode());
            } catch (Exception e) {
                log.warn("[Anthropic] error: {}", e.getMessage());
                throw new RuntimeException("Anthropic API 호출 실패: " + e.getMessage());
            }
        }
        throw new RuntimeException("Anthropic API 호출 실패: "
                + (last429 != null ? last429.getStatusCode() : "429 재시도 소진"));
    }

    private void ensureKey() {
        if (!isAvailable()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
        }
    }
}
