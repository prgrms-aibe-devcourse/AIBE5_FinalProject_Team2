package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 부하 최소화 스케줄링 코어({@link LeanScheduler}) 단위 테스트 — 멀티테넌트 쿼터·전역캡·공정성.
 * 워커/DB 없이 순수 함수만 검증(부하 최소화 두뇌).
 */
class LeanSchedulerTest {

    /** 등급 캡: EXPERT 4 · PREMIUM 2 · STANDARD 1 · 그 외(FREE/null) 0. */
    private final Function<String, Integer> cap = t ->
            "EXPERT".equals(t) ? 4 : "PREMIUM".equals(t) ? 2 : "STANDARD".equals(t) ? 1 : 0;

    private static LeanJob job(long id, long userId, String tier) {
        LeanJob j = new LeanJob();
        j.setId(id);
        j.setUserId(userId);
        j.setTier(tier);
        j.setStatus("QUEUED");
        return j;
    }

    @Test
    void expert_under_cap_all_dispatch() {
        var q = List.of(job(1, 7, "EXPERT"), job(2, 7, "EXPERT"), job(3, 7, "EXPERT"));
        var picked = LeanScheduler.pickDispatchable(q, Map.of(), 0, cap, 6);
        assertThat(picked).extracting(LeanJob::getId).containsExactly(1L, 2L, 3L);
    }

    @Test
    void tenant_at_cap_is_skipped_others_pass() {
        // user7(EXPERT) 이미 4개 실행 중 → 자기 잡은 건너뜀, user8(STANDARD)은 통과
        var q = List.of(job(1, 7, "EXPERT"), job(2, 8, "STANDARD"));
        var picked = LeanScheduler.pickDispatchable(q, Map.of(7L, 4), 4, cap, 10);
        assertThat(picked).extracting(LeanJob::getId).containsExactly(2L);
    }

    @Test
    void global_cap_blocks_even_under_tenant_cap() {
        // 전역이 이미 캡(6) → 테넌트 한도가 남아도 아무것도 배정 안 함(백프레셔)
        var q = List.of(job(1, 7, "EXPERT"), job(2, 8, "EXPERT"));
        var picked = LeanScheduler.pickDispatchable(q, Map.of(), 6, cap, 6);
        assertThat(picked).isEmpty();
    }

    @Test
    void free_or_unknown_tier_never_dispatched() {
        var q = List.of(job(1, 9, "FREE"), job(2, 9, null));
        var picked = LeanScheduler.pickDispatchable(q, Map.of(), 0, cap, 6);
        assertThat(picked).isEmpty();
    }

    @Test
    void fairness_oldest_first_within_caps() {
        // user7(EXPERT cap4) 3개 실행 중(1칸 남음): 잡1 배정·잡2 스킵(한도). user8(STANDARD) 잡3 배정.
        var q = List.of(job(1, 7, "EXPERT"), job(2, 7, "EXPERT"), job(3, 8, "STANDARD"));
        var picked = LeanScheduler.pickDispatchable(q, new HashMap<>(Map.of(7L, 3)), 3, cap, 6);
        assertThat(picked).extracting(LeanJob::getId).containsExactly(1L, 3L);
    }

    @Test
    void global_cap_limits_total_even_with_many_tenants() {
        // 4 테넌트(각 EXPERT) 각 1잡, 전역캡 2 → 오래된 순 2개만
        var q = List.of(job(1, 1, "EXPERT"), job(2, 2, "EXPERT"), job(3, 3, "EXPERT"), job(4, 4, "EXPERT"));
        var picked = LeanScheduler.pickDispatchable(q, Map.of(), 0, cap, 2);
        assertThat(picked).extracting(LeanJob::getId).containsExactly(1L, 2L);
    }

    // ── 콜백 유실/행 안전망(findTimedOut): deadline+grace 초과한 RUNNINGISH 잡만 마감 대상 ──

    private static LeanJob dispatched(long id, String tier, java.time.LocalDateTime dispatchedAt) {
        LeanJob j = job(id, 1, tier);
        j.setStatus("DISPATCHED");
        j.setDispatchedAt(dispatchedAt);
        return j;
    }

    @Test
    void findTimedOut_flags_only_jobs_past_deadline_plus_grace() {
        java.time.LocalDateTime now = java.time.LocalDateTime.of(2026, 6, 18, 12, 0, 0);
        java.util.function.Function<String, Integer> timeout = t -> 600;  // 모든 등급 600s 가정
        int grace = 120;                                                  // 한계 = 720s
        // A: 700s 전 dispatch → 720 미만 → 살아있음. B: 800s 전 → 초과 → 마감 대상.
        var runningish = List.of(
                dispatched(1, "STANDARD", now.minusSeconds(700)),
                dispatched(2, "STANDARD", now.minusSeconds(800)));
        var timedOut = LeanScheduler.findTimedOut(
                runningish, LeanJob::getDispatchedAt, timeout, grace, now);
        assertThat(timedOut).extracting(LeanJob::getId).containsExactly(2L);
    }

    @Test
    void findTimedOut_skips_zero_timeout_and_null_start() {
        java.time.LocalDateTime now = java.time.LocalDateTime.of(2026, 6, 18, 12, 0, 0);
        var noStart = dispatched(1, "STANDARD", null);                    // 기준시각 없음 → 스킵
        var freeTier = dispatched(2, "FREE", now.minusSeconds(99999));    // timeout<=0 → 스킵
        var timedOut = LeanScheduler.findTimedOut(
                List.of(noStart, freeTier), LeanJob::getDispatchedAt,
                t -> "FREE".equals(t) ? 0 : 600, 120, now);
        assertThat(timedOut).isEmpty();
    }

    // ── K8s Job.status 기반 정밀 재조정(reconcileFromK8s) ──

    @Test
    void reconcileFromK8s_failed_always_errors() {
        // 인자 = (failed, active, currentStatus)
        assertThat(LeanScheduler.reconcileFromK8s(1, 0, "DISPATCHED")).isEqualTo("ERROR");
        assertThat(LeanScheduler.reconcileFromK8s(1, 1, "RUNNING")).isEqualTo("ERROR");
    }

    @Test
    void reconcileFromK8s_active_promotes_dispatched_to_running() {
        assertThat(LeanScheduler.reconcileFromK8s(0, 1, "DISPATCHED")).isEqualTo("RUNNING");
        // 이미 RUNNING 이면 변경 없음(중복 save 방지)
        assertThat(LeanScheduler.reconcileFromK8s(0, 1, "RUNNING")).isNull();
    }

    @Test
    void reconcileFromK8s_success_or_idle_no_change() {
        // 성공(failed=0·active=0)은 콜백이 진실원천(결과 JSON 보유) → 여기선 건드리지 않음
        assertThat(LeanScheduler.reconcileFromK8s(0, 0, "RUNNING")).isNull();
        assertThat(LeanScheduler.reconcileFromK8s(0, 0, "DISPATCHED")).isNull();
    }
}
