package com.DevBridge.devbridge.domain.strategy.entity;

import com.DevBridge.devbridge.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 사용자별 브로커 API 자격증명 + 매매 한도.
 * brokerType: KIS(한국투자증권) | BINANCE (스팟/선물)
 * appsecret / apiSecret은 평문 저장 금지 — 항상 CryptoService로 암호화 후 저장.
 *
 * env: MOCK(모의투자/테스트넷) | REAL(실전/메인넷).
 */
@Entity
@Table(name = "BROKER_ACCOUNT", uniqueConstraints = {
        @UniqueConstraint(name = "uq_broker_user_type_env", columnNames = {"user_id", "broker_type", "env"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@EntityListeners(AuditingEntityListener.class)
public class BrokerAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    @Builder.Default
    private Env env = Env.MOCK;

    /** 브로커 유형: KIS(기본) | BINANCE */
    @Enumerated(EnumType.STRING)
    @Column(name = "broker_type", nullable = false, length = 16)
    @Builder.Default
    private BrokerType brokerType = BrokerType.KIS;

    // ── KIS 전용 필드 (brokerType=KIS 일 때만 사용) ───────────────────────────

    /** KIS appkey */
    @Column(name = "app_key", length = 100)
    private String appKey;

    /** KIS appsecret — 반드시 CryptoService.encrypt() 후 저장 */
    @Column(name = "app_secret_enc", columnDefinition = "TEXT")
    private String appSecretEnc;

    /** 종합계좌번호 8자리 */
    @Column(name = "cano", length = 16)
    private String cano;

    /** 상품코드 2자리 (보통 "01") */
    @Column(name = "acnt_prdt_cd", length = 4)
    private String acntPrdtCd;

    // ── Binance 전용 필드 (brokerType=BINANCE 일 때만 사용) ───────────────────

    /** Binance API Key */
    @Column(name = "binance_api_key", length = 100)
    private String binanceApiKey;

    /** Binance API Secret — CryptoService.encrypt() 후 저장 */
    @Column(name = "binance_api_secret_enc", columnDefinition = "TEXT")
    private String binanceApiSecretEnc;

    /** SPOT / FUTURES — Binance 계정 모드 */
    @Enumerated(EnumType.STRING)
    @Column(name = "binance_mode", length = 16)
    @Builder.Default
    private BinanceMode binanceMode = BinanceMode.SPOT;

    /** 1건당 최대 주문금액 (USD) — 0이면 무제한 */
    @Column(name = "max_order_usd")
    @Builder.Default
    private Long maxOrderUsd = 5_000L;

    /** 일일 누적 최대 주문금액 (USD) */
    @Column(name = "daily_order_usd")
    @Builder.Default
    private Long dailyOrderUsd = 20_000L;

    /** 사용자 직접 ON/OFF 가능한 마스터 스위치. false면 모든 승인 거부. */
    @Column(name = "trading_enabled", nullable = false)
    @Builder.Default
    private Boolean tradingEnabled = false;

    /** 마지막 연결 테스트 성공 시각 (잔고조회로 검증) */
    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Env {
        MOCK,  // 모의투자(KIS) / 테스트넷(Binance: https://testnet.binance.vision)
        REAL   // 실전투자(KIS) / 메인넷(Binance)
    }

    public enum BrokerType {
        KIS,    // 한국투자증권
        BINANCE // Binance Spot + Futures
    }

    public enum BinanceMode {
        SPOT,    // 현물 거래
        FUTURES  // USDT 마진 선물 (fapi.binance.com)
    }
}
