package com.DevBridge.devbridge.domain.strategy.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Lean 멀티테넌트 백테스트 잡 — 영속 큐의 한 행.
 *
 * <p>BE 스케줄러가 등급별 쿼터 안에서 공정하게 골라 무상태 워커(analytics)에 배정한다.
 * 인메모리 풀과 달리 DB 영속이라 재시작에도 살아남고, 여러 워커/호스트가 같은 큐를 공유할 수 있다(멀티테넌트·수평확장 토대).
 *
 * <p>Lifecycle: {@code QUEUED → DISPATCHED → RUNNING → (DONE | ERROR) | CANCELLED}
 */
@Entity
@Table(name = "lean_job", indexes = {
        @Index(name = "idx_lj_status", columnList = "status"),
        @Index(name = "idx_lj_user_status", columnList = "user_id, status"),
        @Index(name = "idx_lj_opt", columnList = "opt_id"),
        @Index(name = "idx_lj_created", columnList = "created_at"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LeanJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 테넌트(소유자) — 멀티테넌시·쿼터·격리의 기준. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 제출 시점 구독 등급 스냅샷(FREE/STANDARD/PREMIUM/EXPERT). 쿼터(동시 한도) 산정 기준. */
    @Column(nullable = false, length = 16)
    private String tier;

    /** BACKTEST | OPTIMIZE_CHILD */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String kind = "BACKTEST";

    /** 최적화 자식이면 그룹 id(파라미터 스윕 묶음), 단일 백테스트면 null. */
    @Column(name = "opt_id", length = 32)
    private String optId;

    /** QUEUED | DISPATCHED | RUNNING | DONE | ERROR | CANCELLED */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "QUEUED";

    /** 배정된 워커 식별자(분산 실행 추적) — 워커 base URL. */
    @Column(name = "worker_id", length = 64)
    private String workerId;

    /** 워커(analytics)가 반환한 실행 job_id — 상태 폴링/결과 회수에 사용. */
    @Column(name = "worker_job_id", length = 64)
    private String workerJobId;

    // ── 백테스트 사양 ──
    @Column(name = "strategy_id", nullable = false, length = 64)
    private String strategyId;

    /** 종목 JSON 배열 — 예: ["SPY"] */
    @Column(name = "symbols_json", columnDefinition = "TEXT")
    private String symbolsJson;

    @Column(name = "start_date", length = 10)
    private String startDate;

    @Column(name = "end_date", length = 10)
    private String endDate;

    @Column(length = 8)
    @Builder.Default
    private String market = "us";

    /** 파라미터 오버라이드 JSON. */
    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson;

    // ── 결과 ──
    @Lob
    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    private String resultJson;

    @Column(length = 1000)
    private String error;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;
}
