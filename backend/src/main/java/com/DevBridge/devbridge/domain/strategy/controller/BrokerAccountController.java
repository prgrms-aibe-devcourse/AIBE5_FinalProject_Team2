package com.DevBridge.devbridge.domain.strategy.controller;

import com.DevBridge.devbridge.domain.strategy.dto.BrokerAccountDto;
import com.DevBridge.devbridge.domain.strategy.dto.BrokerAccountUpsertReq;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.DevBridge.devbridge.domain.payment.service.CryptoService;
import com.DevBridge.devbridge.domain.strategy.service.broker.BinanceApiClient;
import com.DevBridge.devbridge.domain.strategy.service.broker.KisApiClient;
import com.DevBridge.devbridge.domain.strategy.service.broker.PromotionGateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 사용자별 KIS API 자격증명 관리.
 * - POST/PUT: 키 등록/갱신 (appsecret은 즉시 암호화)
 * - GET: 마스킹된 정보 + 한도/스위치 상태
 * - DELETE: 등록 해제
 * - POST /test: KIS 토큰 발급으로 키 유효성 검증 (KisApiClient 구현 후 활성화)
 * - PATCH /trading-enabled: 매매 ON/OFF 토글
 */
@RestController
@RequestMapping("/api/broker/account")
@RequiredArgsConstructor
@Slf4j
public class BrokerAccountController {

    private final BrokerAccountRepository brokerRepo;
    private final PromotionGateService promotionGate;
    private final UserRepository userRepo;
    private final CryptoService crypto;
    private final KisApiClient kis;
    private final BinanceApiClient binance;

    @GetMapping
    public ResponseEntity<?> getMine() {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        var list = brokerRepo.findAllByUserIdOrderByEnvAsc(uid)
                .stream().map(BrokerAccountDto::from).toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> upsert(@RequestBody BrokerAccountUpsertReq req) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();

        BrokerAccount.BrokerType brokerType = req.brokerType() != null ? req.brokerType() : BrokerAccount.BrokerType.KIS;
        BrokerAccount.Env env = req.env() != null ? req.env() : BrokerAccount.Env.MOCK;

        // 브로커 타입별 유효성 검증
        if (brokerType == BrokerAccount.BrokerType.KIS) {
            var bad = validateKis(req);
            if (bad != null) return bad;
        } else if (brokerType == BrokerAccount.BrokerType.BINANCE) {
            var bad = validateBinance(req);
            if (bad != null) return bad;
        }

        BrokerAccount b = brokerRepo.findByUserIdAndBrokerTypeAndEnv(uid, brokerType, env).orElseGet(() -> {
            User u = userRepo.findById(uid).orElseThrow();
            return BrokerAccount.builder().user(u).brokerType(brokerType).env(env).build();
        });
        b.setEnv(env);
        b.setBrokerType(brokerType);

        if (brokerType == BrokerAccount.BrokerType.KIS) {
            b.setAppKey(stripAllWhitespace(req.appKey()));
            b.setAppSecretEnc(crypto.encrypt(stripAllWhitespace(req.appSecret())));
            b.setCano(req.cano().trim());
            b.setAcntPrdtCd(req.acntPrdtCd().trim());
        } else {
            b.setBinanceApiKey(stripAllWhitespace(req.binanceApiKey()));
            b.setBinanceApiSecretEnc(crypto.encrypt(stripAllWhitespace(req.binanceApiSecret())));
            b.setBinanceMode(req.binanceMode() != null ? req.binanceMode() : BrokerAccount.BinanceMode.SPOT);
        }

        if (req.maxOrderUsd() != null && req.maxOrderUsd() >= 0) b.setMaxOrderUsd(req.maxOrderUsd());
        if (req.dailyOrderUsd() != null && req.dailyOrderUsd() >= 0) b.setDailyOrderUsd(req.dailyOrderUsd());
        b.setLastVerifiedAt(null);
        b.setTradingEnabled(env == BrokerAccount.Env.MOCK);
        brokerRepo.save(b);
        return ResponseEntity.ok(BrokerAccountDto.from(b));
    }

    @PatchMapping("/trading-enabled")
    @Transactional
    public ResponseEntity<?> setTradingEnabled(
            @RequestParam("env") BrokerAccount.Env env,
            @RequestParam(value = "brokerType", required = false) BrokerAccount.BrokerType brokerType,
            @RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        Boolean enabled = body.get("enabled") instanceof Boolean v ? v : null;
        if (enabled == null) return ResponseEntity.badRequest().body(Map.of("error", "enabled(boolean) 필수"));

        if (brokerType == null) brokerType = BrokerAccount.BrokerType.KIS; // 하위호환
        BrokerAccount b = brokerRepo.findByUserIdAndBrokerTypeAndEnv(uid, brokerType, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();

        boolean isReal = env == BrokerAccount.Env.REAL;
        if (enabled && isReal && b.getLastVerifiedAt() == null) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", "먼저 /test로 키 유효성을 검증해야 합니다."));
        }
        if (enabled && isReal && b.getBrokerType() == BrokerAccount.BrokerType.KIS) {
            var gate = promotionGate.evaluate(uid, b);
            if (!gate.passed()) {
                return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                        .body(Map.of(
                                "error", "승격 게이트 미충족",
                                "summary", gate.summary(),
                                "checks", gate.checks()
                        ));
            }
        }
        b.setTradingEnabled(enabled);
        return ResponseEntity.ok(BrokerAccountDto.from(b));
    }

    /**
     * 한도(maxOrderUsd / dailyOrderUsd) 만 부분 수정.
     * 주문 승인 모달에서 "1건당 한도 초과" 에러를 만났을 때, 키 재입력 없이 즉시 한도만 조정하기 위한 가벼운 PATCH.
     * body 예: { "maxOrderUsd": 200000, "dailyOrderUsd": 200000 } (둘 중 하나만 보내도 OK)
     */
    @PatchMapping("/limits")
    @Transactional
    public ResponseEntity<?> patchLimits(@RequestParam("env") BrokerAccount.Env env,
                                         @RequestBody Map<String, Object> body) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();
        Long max = toLong(body.get("maxOrderUsd"));
        Long daily = toLong(body.get("dailyOrderUsd"));
        if (max == null && daily == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "maxOrderUsd 또는 dailyOrderUsd 중 최소 1개 필요"));
        }
        if (max != null) {
            if (max < 0) return ResponseEntity.badRequest().body(Map.of("error", "maxOrderUsd는 0 이상이어야 합니다"));
            // REAL 계정은 안전을 위해 1건당 50,000 USD 상한 강제
            if (env == BrokerAccount.Env.REAL && max > 50_000L) {
                return ResponseEntity.badRequest().body(Map.of("error", "실전계좌 1건당 한도는 최대 USD 50,000 까지 가능합니다"));
            }
            b.setMaxOrderUsd(max);
        }
        if (daily != null) {
            if (daily < 0) return ResponseEntity.badRequest().body(Map.of("error", "dailyOrderUsd는 0 이상이어야 합니다"));
            if (env == BrokerAccount.Env.REAL && daily > 200_000L) {
                return ResponseEntity.badRequest().body(Map.of("error", "실전계좌 일일 누적 한도는 최대 USD 200,000 까지 가능합니다"));
            }
            b.setDailyOrderUsd(daily);
        }
        brokerRepo.save(b);
        return ResponseEntity.ok(BrokerAccountDto.from(b));
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(String.valueOf(v).trim()); } catch (Exception e) { return null; }
    }

    /** REAL 계정 승격 게이트 현황 조회 (UI 체크리스트용) */
    @GetMapping("/promotion-gate")
    public ResponseEntity<?> promotionGate(@RequestParam("env") BrokerAccount.Env env) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();
        var gate = promotionGate.evaluate(uid, b);
        return ResponseEntity.ok(Map.of(
                "env", b.getEnv().name(),
                "passed", gate.passed(),
                "summary", gate.summary(),
                "checks", gate.checks()
        ));
    }

    @PostMapping("/test")
    @Transactional
    public ResponseEntity<?> testConnection(@RequestParam("env") BrokerAccount.Env env) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        BrokerAccount b = brokerRepo.findByUserIdAndEnv(uid, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();
        try {
            kis.getAccessToken(b);
            Map<String, Object> bal = kis.getOverseasBalance(b);
            b.setLastVerifiedAt(java.time.LocalDateTime.now());
            brokerRepo.save(b);
            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "env", b.getEnv().name(),
                    "cash_usd", bal.get("cash_usd"),
                    "cash_krw", bal.getOrDefault("cash_krw", 0.0),
                    "positions", bal.get("positions"),
                    "verified_at", b.getLastVerifiedAt()
            ));
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            // 키 불일치(서버 APP_CRYPTO_KEY 변경 등)는 KIS 문제가 아니라 재등록 필요 케이스
            if (msg.contains("decrypt failed") || msg.contains("key mismatch") || msg.contains("tampered")) {
                log.warn("[broker/test] DECRYPT FAIL user={} env={} — APP_CRYPTO_KEY mismatch", uid, env);
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "저장된 키를 복호화할 수 없습니다 (서버 암호화 키 변경). 계좌를 삭제 후 다시 등록해 주세요.",
                        "code", "DECRYPT_FAILED",
                        "requireReregister", true
                ));
            }
            // KIS 측 인증 거부 → EGW00105 (유효하지 않은 AppSecret), EGW00104 (유효하지 않은 AppKey) 등
            String friendly = friendlyKisError(msg, env);
            log.warn("[broker/test] failed user={} env={} : {}", uid, env, msg);
            kis.invalidateToken(b);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of(
                            "error", friendly,
                            "raw", msg.length() > 400 ? msg.substring(0, 400) : msg
                    ));
        }
    }

    /** KIS 원본 에러 메시지를 사용자 친화 문구로 변환. */
    private static String friendlyKisError(String raw, BrokerAccount.Env env) {
        String envLabel = env == BrokerAccount.Env.REAL ? "실전" : "모의";
        String otherLabel = env == BrokerAccount.Env.REAL ? "모의" : "실전";
        if (raw.contains("EGW00105") || raw.contains("유효하지 않은 AppSecret")) {
            return envLabel + " AppSecret이 KIS 서버에서 거부되었습니다. ① 발급받은 환경(" + envLabel + ")이 맞는지 ("
                    + otherLabel + " 키를 잘못 넣으셨을 가능성), ② AppSecret 전체(180자+)를 한 번에 복사했는지, "
                    + "③ 재발급된 키인지 확인해 주세요. [KIS 코드: EGW00105]";
        }
        if (raw.contains("EGW00104") || raw.contains("유효하지 않은 AppKey")) {
            return envLabel + " AppKey가 KIS 서버에서 거부되었습니다. KIS 개발자센터에서 " + envLabel
                    + " 환경 키를 정확히 복사했는지 확인해 주세요. [KIS 코드: EGW00104]";
        }
        if (raw.contains("EGW00121") || raw.contains("기간이 만료된")) {
            return envLabel + " AppKey/AppSecret이 만료되었습니다. KIS 개발자센터에서 재발급 후 다시 등록해 주세요. [KIS 코드: EGW00121]";
        }
        if (raw.contains("EGW00201") || raw.contains("초당")) {
            return "KIS 호출 빈도 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요. [KIS 코드: EGW00201]";
        }
        if (raw.contains("403")) {
            return envLabel + " 키 인증이 거부되었습니다. " + envLabel + " 환경 키가 맞는지 확인해 주세요.";
        }
        if (raw.contains("CANO") || raw.contains("계좌번호")) {
            return "종합계좌번호(CANO) 또는 상품코드가 올바르지 않습니다. KIS 계좌 정보를 다시 확인해 주세요.";
        }
        return "KIS 연결 실패: " + (raw.length() > 200 ? raw.substring(0, 200) + "..." : raw);
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<?> remove(@RequestParam("env") BrokerAccount.Env env,
                                    @RequestParam(value = "brokerType", required = false) BrokerAccount.BrokerType brokerType) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        if (brokerType == null) brokerType = BrokerAccount.BrokerType.KIS; // 하위호환
        brokerRepo.findByUserIdAndBrokerTypeAndEnv(uid, brokerType, env).ifPresent(brokerRepo::delete);
        return ResponseEntity.noContent().build();
    }

    // ── Binance 전용 엔드포인트 ────────────────────────────────────────────────

    /**
     * Binance 연결 테스트: ping + 잔고 조회로 검증.
     */
    @PostMapping("/binance/test")
    @Transactional
    public ResponseEntity<?> testBinance(
            @RequestParam("env") BrokerAccount.Env env,
            @RequestParam(value = "mode", defaultValue = "SPOT") BrokerAccount.BinanceMode mode) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        BrokerAccount b = brokerRepo.findByUserIdAndBrokerTypeAndEnv(uid, BrokerAccount.BrokerType.BINANCE, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();

        try {
            boolean pong = binance.ping(b);
            if (!pong) throw new RuntimeException("Binance server ping failed");

            Map<String, Object> balance;
            if (mode == BrokerAccount.BinanceMode.FUTURES) {
                balance = binance.getFuturesBalance(b);
            } else {
                balance = binance.getSpotBalance(b);
            }
            b.setLastVerifiedAt(java.time.LocalDateTime.now());
            brokerRepo.save(b);
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "env", env.name(),
                "mode", mode.name(),
                "balance", balance,
                "verified_at", b.getLastVerifiedAt()
            ));
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            log.warn("[binance/test] failed user={} env={}: {}", uid, env, msg);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", friendlyBinanceError(msg),
                                 "raw", msg.length() > 400 ? msg.substring(0, 400) : msg));
        }
    }

    /** Binance 잔고 조회 (인증된 계정만). */
    @GetMapping("/binance/balance")
    public ResponseEntity<?> binanceBalance(
            @RequestParam("env") BrokerAccount.Env env,
            @RequestParam(value = "mode", defaultValue = "SPOT") BrokerAccount.BinanceMode mode) {
        Long uid = AuthContext.currentUserId();
        if (uid == null) return unauthorized();
        BrokerAccount b = brokerRepo.findByUserIdAndBrokerTypeAndEnv(uid, BrokerAccount.BrokerType.BINANCE, env).orElse(null);
        if (b == null) return ResponseEntity.notFound().build();
        if (!Boolean.TRUE.equals(b.getTradingEnabled()) && b.getLastVerifiedAt() == null) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(Map.of("error", "Binance 계정을 먼저 /binance/test로 검증하세요."));
        }
        try {
            Map<String, Object> balance = (mode == BrokerAccount.BinanceMode.FUTURES)
                    ? binance.getFuturesBalance(b)
                    : binance.getSpotBalance(b);
            return ResponseEntity.ok(balance);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", friendlyBinanceError(e.getMessage())));
        }
    }

    private static String friendlyBinanceError(String raw) {
        if (raw == null) return "Binance API 오류";
        if (raw.contains("-2014") || raw.contains("API-key format invalid"))
            return "Binance API Key 형식이 올바르지 않습니다. 발급된 API Key를 다시 확인해 주세요.";
        if (raw.contains("-1100") || raw.contains("Illegal characters"))
            return "파라미터에 허용되지 않는 문자가 포함되어 있습니다.";
        if (raw.contains("-1121") || raw.contains("Invalid symbol"))
            return "유효하지 않은 심볼입니다.";
        if (raw.contains("-2015") || raw.contains("Invalid API-key"))
            return "Binance API Key가 유효하지 않거나 만료되었습니다. API 권한(읽기/거래)을 확인해 주세요.";
        if (raw.contains("-1022") || raw.contains("Signature"))
            return "서명 검증 실패 — API Secret가 올바르지 않거나 시스템 시각이 맞지 않습니다.";
        return "Binance API 오류: " + (raw.length() > 200 ? raw.substring(0, 200) + "..." : raw);
    }

    private static ResponseEntity<?> validateKis(BrokerAccountUpsertReq r) {
        if (isBlank(r.appKey())) return ResponseEntity.badRequest().body(Map.of("error", "appKey 필수"));
        if (isBlank(r.appSecret())) return ResponseEntity.badRequest().body(Map.of("error", "appSecret 필수"));
        if (isBlank(r.cano()) || !r.cano().matches("\\d{6,12}"))
            return ResponseEntity.badRequest().body(Map.of("error", "cano(종합계좌번호) 형식 오류"));
        if (isBlank(r.acntPrdtCd()) || !r.acntPrdtCd().matches("\\d{2,4}"))
            return ResponseEntity.badRequest().body(Map.of("error", "acntPrdtCd(상품코드) 형식 오류"));
        if (r.appKey().length() < 20 || r.appSecret().length() < 30)
            return ResponseEntity.badRequest().body(Map.of("error", "appKey/appSecret 길이가 비정상입니다. KIS 발급값을 다시 확인하세요."));
        return null;
    }

    private static ResponseEntity<?> validateBinance(BrokerAccountUpsertReq r) {
        if (isBlank(r.binanceApiKey())) return ResponseEntity.badRequest().body(Map.of("error", "binanceApiKey 필수"));
        if (isBlank(r.binanceApiSecret())) return ResponseEntity.badRequest().body(Map.of("error", "binanceApiSecret 필수"));
        if (r.binanceApiKey().length() < 20)
            return ResponseEntity.badRequest().body(Map.of("error", "Binance API Key 길이가 비정상입니다."));
        return null;
    }

    private static ResponseEntity<?> validate(BrokerAccountUpsertReq r) {
        return validateKis(r); // 하위호환 (기본 KIS)
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    /** 줄바꿈 / 탭 / 공백 / zero-width-space(U+200B) 등 모든 보이지 않는 문자 제거. */
    private static String stripAllWhitespace(String s) {
        if (s == null) return null;
        return s.replaceAll("[\\s\\u200B\\u00A0]", "");
    }

    private static ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증이 필요합니다."));
    }
}
