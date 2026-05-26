package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.ai.dto.AiChatRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Gemini API를 서버에서 직접 호출.
 * API 키는 application.properties → 환경변수(GEMINI_API_KEY)로 주입되며
 * 절대 클라이언트로 나가지 않는다.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final String apiKey;
    private final String model;
    private final String fallbackModel;
    private final String baseUrl;
    private final RestClient restClient;

    public GeminiService(
            @Value("${gemini.api.key}") String apiKey,
            @Value("${gemini.api.model}") String model,
            @Value("${gemini.api.fallback-model:}") String fallbackModel,
            @Value("${gemini.api.url}") String baseUrl
    ) {
        this.apiKey = apiKey;
        this.model = model;
    this.fallbackModel = fallbackModel;
        this.baseUrl = baseUrl;
        this.restClient = RestClient.create();

    log.info(
        "Gemini configured. model={}, fallbackModel={}, apiKeyPresent={}",
        model,
        fallbackModel == null || fallbackModel.isBlank() ? "(none)" : fallbackModel,
        apiKey != null && !apiKey.isBlank()
    );
    }

    public String chat(AiChatRequest request) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 백엔드 실행 환경에 키를 등록하세요.");
        }

        // Gemini contents 형식으로 변환 (history가 null이면 빈 대화로 처리 - NPE 방어)
        List<AiChatRequest.Message> history = request.getHistory() != null ? request.getHistory() : List.of();
        List<Map<String, Object>> contents = history.stream()
                .map(m -> {
                    Map<String, Object> content = new HashMap<>();
                    // Gemini는 역할을 오직 'user' 또는 'model'만 허용함 (그 외는 400 Bad Request)
                    String role = m.getRole();
                    if (role == null || role.equalsIgnoreCase("bot") || role.equalsIgnoreCase("assistant")) {
                        role = "model";
                    } else if (role.equalsIgnoreCase("user")) {
                        role = "user";
                    }
                    content.put("role", role.toLowerCase());
                    content.put("parts", List.of(Map.of("text", m.getText())));
                    return content;
                })
                .toList();

        Map<String, Object> body = new HashMap<>();
        body.put("contents", contents);

        // 시스템 프롬프트 (페이지별 역할 지시)
        if (request.getSystemInstruction() != null && !request.getSystemInstruction().trim().isEmpty()) {
            body.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", request.getSystemInstruction().trim()))
            ));
        }

        // chat 응답 토큰 한도.
        // 일괄 입력 모드에선 등록폼 JSON + 7가지 협의 마크다운 + contractTerms JSON 모두 한 응답에 출력해야 해서
        // 충분히 32768 까지 허용. (8192 일 때도 contractTerms verbose 하게 쓰면 잘리는 사례 발견)
        // gemini-2.5-flash 는 최대 65536 까지 지원하므로 안전한 범위.
        body.put("generationConfig", Map.of(
                "temperature", 0.8,
                "maxOutputTokens", 32768
        ));

        Map<String, Object> response = generateContent(body);

        return extractText(response);
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<String, Object> response) {
        try {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                log.warn("Gemini 응답에 candidates 없음. raw={}", response);
                return "(응답이 비어 있습니다)";
            }
            Map<String, Object> cand0 = candidates.get(0);
            Object finishReason = cand0.get("finishReason");
            Map<String, Object> content = (Map<String, Object>) cand0.get("content");
            List<Map<String, Object>> parts = content == null ? null : (List<Map<String, Object>>) content.get("parts");

            if (parts == null || parts.isEmpty()) {
                log.warn("Gemini 응답 parts 비어있음. finishReason={}, candidate={}", finishReason, cand0);
                if ("MAX_TOKENS".equals(String.valueOf(finishReason))) {
                    return "(응답이 비어 있습니다: MAX_TOKENS - 출력 토큰 한도 초과)";
                }
                if ("SAFETY".equals(String.valueOf(finishReason))) {
                    return "(응답이 비어 있습니다: SAFETY - 안전 필터 차단)";
                }
                return "(응답이 비어 있습니다: finishReason=" + finishReason + ")";
            }
            return (String) parts.get(0).get("text");
        } catch (Exception e) {
            log.error("Gemini 응답 파싱 실패. raw={}", response, e);
            return "(응답 파싱 실패)";
        }
    }

    /** API 키가 설정되었는지 확인 (LLM 라우터에서 available 표시용) */
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
    * 시스템 프롬프트 + 단일 user 프롬프트로 한 번 호출. (매칭 점수 계산 등 단발성 작업용)
    * JSON 응답 안정성은 유지하되 토큰 사용량은 과하지 않게 제한한다.
     */
    public String oneShot(String systemInstruction, String userPrompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 백엔드 실행 환경에 키를 등록하세요.");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userPrompt))
        )));

        if (systemInstruction != null && !systemInstruction.trim().isEmpty()) {
            body.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction.trim()))
            ));
        }

        body.put("generationConfig", Map.of(
                "temperature", 0.3,
                // gemini-2.5 시리즈 출력 한도 최대치(약 65k). 긴 CV도 끝까지 받기 위해 풀로 사용.
                "maxOutputTokens", 65536,
                "responseMimeType", "application/json"
                // 주의: gemini-2.5-pro 는 thinking 모드가 강제이므로 thinkingBudget=0 을 주면 400.
                // flash는 0 허용이지만, pro 폴백/메인 동시 지원을 위해 thinkingConfig 자체를 보내지 않는다.
        ));

        Map<String, Object> response = generateContent(body);

        return extractText(response);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> generateContent(Map<String, Object> body) {
        try {
            return postGenerateContent(model, body, true);
        } catch (HttpClientErrorException.TooManyRequests primary429) {
            if (fallbackModel == null || fallbackModel.isBlank() || fallbackModel.equals(model)) {
                throw primary429;
            }
            log.warn("Gemini 429 on primary model {}. Falling back to {}.", model, fallbackModel);
            return postGenerateContent(fallbackModel, body, false);
        } catch (HttpClientErrorException e) {
            // 403(Forbidden) - 모델 접근 불가 시 fallback으로 재시도
            if (e.getStatusCode().value() == 403
                    && fallbackModel != null && !fallbackModel.isBlank() && !fallbackModel.equals(model)) {
                log.warn("Gemini 403 on primary model {}. Falling back to {}.", model, fallbackModel);
                return postGenerateContent(fallbackModel, body, false);
            }
            throw e;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postGenerateContent(String targetModel, Map<String, Object> body, boolean allowRetry) {
        String url = baseUrl + "/" + targetModel + ":generateContent?key=" + apiKey;
        int maxAttempts = allowRetry ? 2 : 1;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return restClient.post()
                        .uri(url)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .onStatus(status -> status.isError(), (req, res) -> {
                            String errBody = new String(res.getBody().readAllBytes());
                            log.error("Gemini API Error: Status={}, Body={}", res.getStatusCode(), errBody);
                            throw new HttpClientErrorException(res.getStatusCode(), res.getStatusText(), res.getHeaders(), errBody.getBytes(), null);
                        })
                        .body(Map.class);
            } catch (HttpClientErrorException.TooManyRequests e) {
                if (attempt >= maxAttempts) {
                    throw e;
                }

                log.warn("Gemini 429 on model {}. Retrying once after backoff.", targetModel);
                sleepBeforeRetry();
            }
        }

        throw new IllegalStateException("Gemini API 호출이 비정상 종료되었습니다.");
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(800L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini API 재시도 대기 중 인터럽트가 발생했습니다.", e);
        }
    }
}
