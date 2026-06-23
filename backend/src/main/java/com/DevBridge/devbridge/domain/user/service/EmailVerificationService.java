package com.DevBridge.devbridge.domain.user.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 이메일 인증코드 발송/검증 서비스.
 * - 인증코드는 메모리에 (email → CodeEntry) 형태로 저장 (시연용, 재기동 시 휘발).
 * - 만료 시간은 application.properties 의 app.verify.code-ttl-minutes 로 제어.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private final JavaMailSender mailSender;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> verifiedStore = new ConcurrentHashMap<>();
    private static final long VERIFIED_TTL_SECONDS = 30 * 60L;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    /** 인증 메일 사본(BCC) 수신 주소(콤마 다중). 운영 관리자 모니터링용. 빈 값이면 미사용. */
    @Value("${app.mail.admin-copy:yeonalee.researcher@gmail.com}")
    private String adminCopy;

    @Value("${app.verify.code-ttl-minutes:5}")
    private int ttlMinutes;

    @PostConstruct
    void logConfig() {
        if (fromAddress == null || fromAddress.isBlank()) {
            log.warn("[EmailVerification] MAIL_USERNAME 환경변수가 비어있습니다. 메일 발송이 실패할 수 있어요.");
        } else {
            log.info("[EmailVerification] 발신자: {}, TTL: {}분", fromAddress, ttlMinutes);
        }
    }

    /** 6자리 코드 생성 + 발송 + 저장. */
    public void sendCode(String toEmail) {
        String code = String.format("%06d", random.nextInt(1_000_000));
        long expiresAt = Instant.now().getEpochSecond() + ttlMinutes * 60L;
        store.put(toEmail.toLowerCase(), new CodeEntry(code, expiresAt));

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromAddress);
        msg.setTo(toEmail);
        msg.setSubject("[Alpha-Helix] 이메일 인증번호 안내");
        msg.setText(
                "안녕하세요, Alpha-Helix 입니다.\n\n" +
                "요청하신 이메일 인증번호는 아래와 같습니다.\n\n" +
                "  ▶ 인증번호: " + code + "\n\n" +
                "이 코드는 " + ttlMinutes + "분 동안 유효합니다.\n" +
                "본인이 요청하지 않았다면 이 메일을 무시해주세요.\n\n" +
                "— Alpha-Helix 팀"
        );
        String[] bcc = java.util.Arrays.stream(adminCopy.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
        if (bcc.length > 0) msg.setBcc(bcc);
        mailSender.send(msg);
        log.info("[EmailVerification] {} 로 인증코드 발송 완료 (BCC: {})", toEmail, bcc.length > 0 ? String.join(",", bcc) : "없음");
    }

    /** 코드 검증. 일치하면 store에서 제거하고 verifiedStore에 30분 등록 후 true. */
    public boolean verifyCode(String email, String code) {
        if (email == null || code == null) return false;
        CodeEntry entry = store.get(email.toLowerCase());
        if (entry == null) return false;
        if (Instant.now().getEpochSecond() > entry.expiresAt) {
            store.remove(email.toLowerCase());
            return false;
        }
        boolean ok = entry.code.equals(code);
        if (ok) {
            store.remove(email.toLowerCase());
            verifiedStore.put(email.toLowerCase(), Instant.now().getEpochSecond() + VERIFIED_TTL_SECONDS);
        }
        return ok;
    }

    /** Google OAuth 등 외부 인증으로 이미 검증된 이메일을 30분간 인증 완료 상태로 등록. */
    public void markVerified(String email) {
        verifiedStore.put(email.toLowerCase(), Instant.now().getEpochSecond() + VERIFIED_TTL_SECONDS);
    }

    /** 인증 완료 여부 확인 후 소비(1회용). 미인증·만료 시 false. */
    public boolean consumeVerified(String email) {
        if (email == null) return false;
        Long expiresAt = verifiedStore.remove(email.toLowerCase());
        if (expiresAt == null) return false;
        return Instant.now().getEpochSecond() <= expiresAt;
    }

    private record CodeEntry(String code, long expiresAt) {}
}
