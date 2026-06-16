package com.DevBridge.devbridge.domain.user.controller;

import com.DevBridge.devbridge.domain.user.service.EmailVerificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/verify")
@RequiredArgsConstructor
public class EmailVerificationController {

    private final EmailVerificationService service;

    /** body: { "email": "..." } */
    @PostMapping("/send-code")
    public ResponseEntity<?> sendCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || !email.contains("@")) {
            return ResponseEntity.badRequest().body(Map.of("error", "유효한 이메일이 필요해요."));
        }
        try {
            service.sendCode(email);
            return ResponseEntity.ok(Map.of("ok", true, "message", "인증번호를 발송했어요."));
        } catch (Exception e) {
            log.error("[Verify] 메일 발송 실패", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "메일 발송 실패: " + e.getMessage()));
        }
    }

    /** body: { "email": "...", "code": "123456" } */
    @PostMapping("/check-code")
    public ResponseEntity<?> checkCode(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String code = body.get("code");
        boolean ok = service.verifyCode(email, code);
        if (!ok) {
            return ResponseEntity.status(400).body(Map.of("ok", false, "error", "인증번호가 일치하지 않거나 만료되었어요."));
        }
        return ResponseEntity.ok(Map.of("ok", true, "message", "인증 완료!"));
    }

    /** Google OAuth 회원가입 시 사용. body: { "googleToken": "..." } — Google userinfo로 이메일 검증 후 30분 인증 완료 상태 등록. */
    @PostMapping("/google-verify")
    public ResponseEntity<?> googleVerify(@RequestBody Map<String, String> body) {
        String googleToken = body.get("googleToken");
        if (googleToken == null || googleToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Google 토큰이 필요해요."));
        }
        try {
            var headers = new org.springframework.http.HttpHeaders();
            headers.set("Authorization", "Bearer " + googleToken);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> info = new org.springframework.web.client.RestTemplate()
                    .exchange("https://www.googleapis.com/oauth2/v3/userinfo",
                            org.springframework.http.HttpMethod.GET,
                            new org.springframework.http.HttpEntity<>(headers),
                            java.util.Map.class)
                    .getBody();
            if (info == null) throw new RuntimeException("Google userinfo 응답 없음");
            Object email = info.get("email");
            if (email == null || String.valueOf(email).isBlank()) throw new RuntimeException("이메일 정보 없음");
            Object verified = info.get("email_verified");
            boolean isVerified = Boolean.TRUE.equals(verified) || "true".equalsIgnoreCase(String.valueOf(verified));
            if (!isVerified) throw new RuntimeException("이메일 미인증 Google 계정");
            service.markVerified(String.valueOf(email));
            return ResponseEntity.ok(Map.of("ok", true, "email", String.valueOf(email)));
        } catch (Exception e) {
            log.error("[Verify] Google 이메일 인증 실패", e);
            return ResponseEntity.status(401).body(Map.of("error", "Google 인증 실패: " + e.getMessage()));
        }
    }
}
