package com.DevBridge.devbridge.domain.payment.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;

/**
 * 토스페이먼츠 웹훅 수신.
 * HMAC-SHA256 서명 검증 후 이벤트를 로깅. 구독 상태 변경 등 필요한 처리는 이 핸들러에서 추가.
 *
 * 토스 대시보드 > 개발자 센터 > 웹훅에 URL 등록 필요:
 *   - 운영: https://your-domain.com/api/payments/toss/webhook
 */
@Slf4j
@RestController
@RequestMapping("/api/payments/toss")
@RequiredArgsConstructor
public class TossWebhookController {

    @Value("${tosspayments.webhook-secret:}")
    private String webhookSecret;

    private final ObjectMapper om = new ObjectMapper();

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestHeader(value = "X-Toss-Signature", required = false) String signature,
                                     @RequestBody String rawBody) {
        if (webhookSecret != null && !webhookSecret.isBlank()) {
            if (signature == null || !verifyHmac(rawBody, signature)) {
                log.warn("[TossWebhook] 서명 검증 실패");
                return ResponseEntity.status(401).body(Map.of("message", "invalid signature"));
            }
        }

        try {
            JsonNode body = om.readTree(rawBody);
            String eventType = body.path("eventType").asText("");
            String paymentKey = body.path("data").path("paymentKey").asText("");
            String status     = body.path("data").path("status").asText("");
            log.info("[TossWebhook] eventType={} status={} paymentKey={}", eventType, status, paymentKey);
        } catch (Exception ex) {
            log.warn("[TossWebhook] 처리 오류: {}", ex.getMessage());
        }

        return ResponseEntity.ok(Map.of("ok", true));
    }

    private boolean verifyHmac(String body, String signatureHex) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).equalsIgnoreCase(signatureHex);
        } catch (Exception e) {
            log.warn("[TossWebhook] HMAC 계산 실패: {}", e.getMessage());
            return false;
        }
    }
}
