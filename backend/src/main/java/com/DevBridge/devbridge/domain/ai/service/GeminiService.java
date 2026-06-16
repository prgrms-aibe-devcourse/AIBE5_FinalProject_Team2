package com.DevBridge.devbridge.domain.ai.service;

import com.DevBridge.devbridge.domain.ai.dto.AiChatRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

// 429 응답 본문에서 추출한 쿼터 정보
record Quota429Info(boolean isFreeTier, boolean isDailyQuota, boolean isPrepaymentDepleted, long retryDelayMs) {}

/**
 * Gemini API를 서버에서 직접 호출.
 * API 키는 application.properties → 환경변수(GEMINI_API_KEY)로 주입되며
 * 절대 클라이언트로 나가지 않는다.
 *
 * Context Caching: 동일한 system_instruction이 반복될 때 Gemini cachedContents API로
 * 한 번만 업로드하고 이후 요청에선 cache name만 참조한다. 캐시 불가(토큰 부족) 또는
 * 생성 실패 시 기존 방식(system_instruction 직접 전송)으로 자동 폴백한다.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final String apiKey;
    private final String model;
    private final String fallbackModel;
    private final String baseUrl;
    private final String cacheBaseUrl;
    private final RestClient restClient;

    // system_instruction 해시 → 캐시 항목 (앱 수명 동안 유지)
    private final ConcurrentHashMap<String, CachedEntry> promptCache = new ConcurrentHashMap<>();
    // Gemini Flash 기준 최소 캐시 토큰 1024 → chars/3 환산 최소 문자 수
    private static final int MIN_CACHE_CHARS = 3072;
    private static final long CACHE_TTL_SECONDS = 3600; // 1시간

    private record CachedEntry(String name, Instant expiresAt) {
        boolean isValid() {
            // 만료 2분 전부터 무효 처리 (갱신 여유)
            return Instant.now().isBefore(expiresAt.minusSeconds(120));
        }
    }

    // 레이트리밋 방지(RPM 초과 429 예방): 동시 호출 수 제한 + 호출 간 최소 간격.
    // 모든 Gemini 호출이 postGenerateContent 를 거치므로 여기 한 곳에서 전역 스로틀링된다.
    private final Semaphore geminiConcurrency = new Semaphore(4, true);
    private static final long MIN_CALL_GAP_MS = 120; // 호출 시작 간 최소 간격
    private volatile long lastCallAtMs = 0;

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
        // baseUrl 예: "https://generativelanguage.googleapis.com/v1beta/models"
        // cacheBaseUrl:  "https://generativelanguage.googleapis.com/v1beta/cachedContents"
        int modelsIdx = baseUrl.lastIndexOf("/models");
        this.cacheBaseUrl = (modelsIdx >= 0 ? baseUrl.substring(0, modelsIdx) : baseUrl) + "/cachedContents";
        this.restClient = RestClient.create();

        log.info(
            "Gemini configured. model={}, fallbackModel={}, apiKeyPresent={}, apiKeyLen={}, apiKeyTail={}",
            model,
            fallbackModel == null || fallbackModel.isBlank() ? "(none)" : fallbackModel,
            apiKey != null && !apiKey.isBlank(),
            apiKey == null ? 0 : apiKey.length(),
            apiKey == null || apiKey.length() < 4 ? "(none)" : apiKey.substring(apiKey.length() - 4)
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

        String systemInstruction = request.getSystemInstruction();

        Map<String, Object> body = new HashMap<>();
        body.put("contents", contents);
        applySystemInstruction(body, systemInstruction);

        // chat 응답 토큰 한도.
        // 일괄 입력 모드에선 등록폼 JSON + 7가지 협의 마크다운 + contractTerms JSON 모두 한 응답에 출력해야 해서
        // 충분히 32768 까지 허용. (8192 일 때도 contractTerms verbose 하게 쓰면 잘리는 사례 발견)
        // gemini-2.5-flash 는 최대 65536 까지 지원하므로 안전한 범위.
        body.put("generationConfig", Map.of(
                "temperature", 0.8,
                "maxOutputTokens", 32768
        ));

        return extractText(generateContent(body, systemInstruction));
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
    * 시스템 프롬프트 + 단일 user 프롬프트로 한 번 호출.
    * wantJson=true 일 때만 responseMimeType:application/json 을 붙인다.
    * briefing 등 평문 응답이 필요한 경우 wantJson=false 로 호출해야 한다.
     */
    public String oneShot(String systemInstruction, String userPrompt, boolean wantJson) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 백엔드 실행 환경에 키를 등록하세요.");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", userPrompt))
        )));
        applySystemInstruction(body, systemInstruction);

        Map<String, Object> genConfig = new HashMap<>();
        genConfig.put("temperature", 0.3);
        genConfig.put("maxOutputTokens", 65536);
        if (wantJson) {
            genConfig.put("responseMimeType", "application/json");
        }
        body.put("generationConfig", genConfig);

        return extractText(generateContent(body, systemInstruction));
    }

    public String oneShot(String systemInstruction, String userPrompt) {
        return oneShot(systemInstruction, userPrompt, true);
    }

    /**
     * body에 system_instruction 또는 cachedContent 중 하나를 설정한다.
     * 캐시 가능한 경우(토큰 충분 + 생성 성공) cachedContent를, 아니면 system_instruction을 직접 넣는다.
     */
    private void applySystemInstruction(Map<String, Object> body, String systemInstruction) {
        if (systemInstruction == null || systemInstruction.isBlank()) return;
        CachedEntry cache = getOrCreateCache(systemInstruction);
        if (cache != null) {
            body.put("cachedContent", cache.name());
        } else {
            body.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction.trim()))
            ));
        }
    }

    /**
     * 캐시를 사용한 body에서 폴백 모델용 body를 재구성한다.
     * cachedContent는 모델에 종속적이므로 폴백 모델에는 사용 불가 → system_instruction으로 대체.
     */
    private Map<String, Object> buildFallbackBody(Map<String, Object> body, String systemInstruction) {
        Map<String, Object> fb = new HashMap<>(body);
        fb.remove("cachedContent");
        if (systemInstruction != null && !systemInstruction.isBlank()) {
            fb.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction.trim()))
            ));
        }
        return fb;
    }

    /** 429 원인에 따른 사용자 친화적 메시지 생성 */
    private String buildQuotaMessage(Quota429Info info, String targetModel) {
        if (info.isPrepaymentDepleted()) {
            return String.format(
                "Gemini API 선불 크레딧이 소진되었습니다(%s). " +
                "AI Studio(https://aistudio.google.com/apikey)에서 크레딧을 충전하거나 " +
                "Google Cloud Console에서 결제를 활성화해 주세요.",
                targetModel);
        }
        if (info.isFreeTier() && info.isDailyQuota()) {
            return String.format(
                "Gemini API 무료 티어 일간 한도(%s)가 소진되었습니다. " +
                "Google Cloud Console에서 결제를 활성화하면 유료 한도(RPM 2,000+)가 적용됩니다. " +
                "참고: https://console.cloud.google.com/billing",
                targetModel);
        }
        if (info.isFreeTier()) {
            long waitSec = info.retryDelayMs() / 1000;
            return String.format("AI 요청 한도에 도달했습니다(%s 무료 티어). %d초 후 다시 시도해 주세요.", targetModel, waitSec);
        }
        return String.format("AI 요청이 너무 많습니다(%s). %d초 후 다시 시도해 주세요.", targetModel, info.retryDelayMs() / 1000);
    }

    /**
     * 429 응답 본문에서 쿼터 타입과 재시도 대기 시간 파싱.
     * JSON 파싱 대신 간단한 문자열 검색으로 Jackson 의존 없이 처리.
     */
    private Quota429Info parse429Info(HttpClientErrorException e) {
        try {
            String body = e.getResponseBodyAsString();
            boolean isFreeTier = body.contains("free_tier") || body.contains("FreeTier");
            boolean isDailyQuota = body.contains("PerDay") || body.contains("GenerateRequestsPerDay");
            boolean isPrepaymentDepleted = body.contains("prepayment") || body.contains("credits are depleted")
                    || body.contains("credits_depleted") || body.contains("RESOURCE_EXHAUSTED");

            long retryDelayMs = 5_000L;
            int rdIdx = body.indexOf("\"retryDelay\"");
            if (rdIdx >= 0) {
                // "retryDelay":"52.98s" 형식 파싱
                int start = body.indexOf("\"", rdIdx + 12) + 1;
                int end = body.indexOf("\"", start);
                if (start > 0 && end > start) {
                    String delayStr = body.substring(start, end).replace("s", "").trim();
                    try {
                        double seconds = Double.parseDouble(delayStr);
                        retryDelayMs = (long) (seconds * 1000);
                    } catch (NumberFormatException ignored) {}
                }
            }
            return new Quota429Info(isFreeTier, isDailyQuota, isPrepaymentDepleted, retryDelayMs);
        } catch (Exception ex) {
            return new Quota429Info(false, false, false, 5_000L);
        }
    }

    /** 동시 호출 제한(Semaphore) + 호출 간 최소 간격을 적용해 호출 → RPM 초과 429 를 예방. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> rateLimitedPost(String url, Map<String, Object> body) {
        boolean acquired = false;
        try {
            geminiConcurrency.acquire();
            acquired = true;
            synchronized (this) {
                long wait = (lastCallAtMs + MIN_CALL_GAP_MS) - System.currentTimeMillis();
                if (wait > 0) Thread.sleep(wait);
                lastCallAtMs = System.currentTimeMillis();
            }
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
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini 레이트리밋 대기 중 인터럽트", ie);
        } finally {
            if (acquired) geminiConcurrency.release();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> generateContent(Map<String, Object> body, String systemInstruction) {
        try {
            return postGenerateContent(model, body, true);
        } catch (HttpClientErrorException.TooManyRequests primary429) {
            if (fallbackModel == null || fallbackModel.isBlank() || fallbackModel.equals(model)) {
                Quota429Info info = parse429Info(primary429);
                throw new RuntimeException(buildQuotaMessage(info, model), primary429);
            }
            log.warn("Gemini 429 on primary model {}. Falling back to {}.", model, fallbackModel);
            try {
                // 캐시는 기본 모델에 묶여있으므로 폴백 모델엔 system_instruction 직접 전송
                return postGenerateContent(fallbackModel, buildFallbackBody(body, systemInstruction), false);
            } catch (HttpClientErrorException.TooManyRequests fallback429) {
                Quota429Info info = parse429Info(fallback429);
                throw new RuntimeException(buildQuotaMessage(info, fallbackModel), fallback429);
            }
        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            // 403(Forbidden) 또는 503(Unavailable) — fallback 모델로 재시도
            if ((status == 403 || status == 503)
                    && fallbackModel != null && !fallbackModel.isBlank() && !fallbackModel.equals(model)) {
                log.warn("Gemini HTTP {} on primary model {}. Falling back to {}.", status, model, fallbackModel);
                return postGenerateContent(fallbackModel, buildFallbackBody(body, systemInstruction), false);
            }
            if (status == 503) {
                throw new RuntimeException("Gemini 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.", e);
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
                return rateLimitedPost(url, body);
            } catch (HttpClientErrorException.TooManyRequests e) {
                Quota429Info info = parse429Info(e);
                log.warn("Gemini 429 on model={}. isFreeTier={}, isDailyQuota={}, retryDelayMs={}",
                        targetModel, info.isFreeTier(), info.isDailyQuota(), info.retryDelayMs());

                if (info.isPrepaymentDepleted()) {
                    // 선불 크레딧 소진 — 재시도해도 무의미, 즉시 실패
                    log.error("Gemini prepayment credits depleted on model {}.", targetModel);
                    throw e;
                }
                if (info.isFreeTier() && info.isDailyQuota()) {
                    // 일간 무료 한도 소진 — 재시도해도 무의미, 즉시 실패 → 상위 generateContent에서 fallback 모델로 전환
                    log.warn("Gemini free tier daily quota exhausted on model {}.", targetModel);
                    throw e;
                }

                if (attempt >= maxAttempts) {
                    throw e;
                }

                // RPM 한도: API가 알려준 retryDelay만큼만 기다린 후 1회 재시도 (최대 60s 캡)
                long waitMs = Math.min(info.retryDelayMs(), 60_000L);
                log.info("Gemini RPM 429 on model {}. Waiting {}ms before retry.", targetModel, waitMs);
                sleepMs(waitMs);
            }
        }

        throw new IllegalStateException("Gemini API 호출이 비정상 종료되었습니다.");
    }

    /**
     * system_instruction을 Gemini cachedContents API로 캐시하거나 기존 캐시를 반환한다.
     * 캐시 불가(토큰 부족) 또는 API 오류 시 null을 반환하며, 호출부에서 직접 전송으로 폴백한다.
     */
    @SuppressWarnings("unchecked")
    private CachedEntry getOrCreateCache(String systemInstruction) {
        if (systemInstruction == null || systemInstruction.length() < MIN_CACHE_CHARS) return null;

        String hash = sha256(systemInstruction);
        CachedEntry existing = promptCache.get(hash);
        if (existing != null && existing.isValid()) return existing;

        try {
            String modelWithPrefix = model.startsWith("models/") ? model : "models/" + model;
            Map<String, Object> cacheBody = new HashMap<>();
            cacheBody.put("model", modelWithPrefix);
            cacheBody.put("system_instruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction.trim()))
            ));
            cacheBody.put("contents", List.of());
            cacheBody.put("ttl", CACHE_TTL_SECONDS + "s");

            Map<String, Object> resp = restClient.post()
                    .uri(cacheBaseUrl + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(cacheBody)
                    .retrieve()
                    .onStatus(status -> status.isError(), (req, res) -> {
                        String errBody = new String(res.getBody().readAllBytes());
                        log.warn("Gemini cache creation failed: status={}, body={}", res.getStatusCode(), errBody);
                        throw new HttpClientErrorException(res.getStatusCode(), res.getStatusText(), res.getHeaders(), errBody.getBytes(), null);
                    })
                    .body(Map.class);

            if (resp == null || resp.get("name") == null) {
                log.warn("Gemini cache creation returned empty response, falling back to direct system_instruction");
                return null;
            }

            String name = (String) resp.get("name");
            String expireTimeStr = (String) resp.get("expireTime");
            Instant expiresAt = expireTimeStr != null
                    ? Instant.parse(expireTimeStr)
                    : Instant.now().plusSeconds(CACHE_TTL_SECONDS);

            CachedEntry entry = new CachedEntry(name, expiresAt);
            promptCache.put(hash, entry);
            log.info("Gemini context cache created: name={}, expiresAt={}, promptChars={}",
                    name, expiresAt, systemInstruction.length());
            return entry;
        } catch (Exception e) {
            log.warn("Gemini cache creation failed, using direct system_instruction: {}", e.getMessage());
            return null;
        }
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private void sleepMs(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini API 대기 중 인터럽트 발생.", e);
        }
    }
}
