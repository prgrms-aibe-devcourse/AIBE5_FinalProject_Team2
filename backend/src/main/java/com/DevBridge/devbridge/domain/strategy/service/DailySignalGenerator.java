package com.DevBridge.devbridge.domain.strategy.service;

import com.DevBridge.devbridge.domain.notification.service.EmailAlertService;
import com.DevBridge.devbridge.domain.ai.service.AlphaHelixService;
import com.DevBridge.devbridge.domain.strategy.entity.Strategy;
import com.DevBridge.devbridge.domain.ai.entity.AlphaWorkspace;
import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;
import com.DevBridge.devbridge.domain.strategy.entity.DailySignal;
import com.DevBridge.devbridge.domain.strategy.entity.OrderProposal;
import com.DevBridge.devbridge.domain.ai.repository.AlphaWorkspaceRepository;
import com.DevBridge.devbridge.domain.strategy.repository.BrokerAccountRepository;
import com.DevBridge.devbridge.domain.strategy.repository.DailySignalRepository;
import com.DevBridge.devbridge.domain.strategy.repository.OrderProposalRepository;
import com.DevBridge.devbridge.domain.strategy.repository.StrategyRepository;
import com.DevBridge.devbridge.global.security.AuthContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 매 평일 KST 22:30에 활성 전략 전체 백테스트 → 시그널 갱신 → 미발송 시그널 일괄 이메일.
 * 미국장 마감(KST 익일 새벽 6시)보다 앞서 발송되어 다음날 아침에 사용자가 행동할 수 있게 함.
 *
 * 추가 (Phase B-5): BUY 시그널이 발생한 전략의 user에게 BrokerAccount가 있고
 * tradingEnabled=true 면 PENDING OrderProposal 자동 생성. 사용자 승인 전엔 절대 전송 안 됨.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DailySignalGenerator {

    private final StrategyRepository strategyRepo;
    private final BacktestService backtestService;
    private final EmailAlertService emailAlertService;
    private final MarketDataService marketDataService;
    private final DailySignalRepository signalRepo;
    private final BrokerAccountRepository brokerAccountRepo;
    private final OrderProposalRepository proposalRepo;
    private final AlphaWorkspaceRepository alphaWsRepo;
    private final AlphaHelixService alphaService; // 자동 재실행용
    private final ObjectMapper om = new ObjectMapper();

    /** 매 평일 22:30 KST (월~금) */
    @Scheduled(cron = "0 30 22 * * MON-FRI", zone = "Asia/Seoul")
    public void runDaily() {
        log.info("[DailySignal] start");

        // 1) 시장 데이터 신선화 (혹시 07:00 잡이 실패했을 경우 대비)
        try { marketDataService.scheduledRefresh(); } catch (Exception e) {
            log.warn("[DailySignal] market refresh failed: {}", e.getMessage());
        }

        // 2) 활성 전략 전체 백테스트 → 시그널 upsert
        var actives = strategyRepo.findByActiveTrue();
        int ok = 0, fail = 0;
        for (var s : actives) {
            try {
                backtestService.runFor(s);
                ok++;
            } catch (Exception e) {
                fail++;
                log.warn("[DailySignal] {} failed: {}", s.getCode(), e.getMessage());
            }
        }
        log.info("[DailySignal] backtest done ok={} fail={}", ok, fail);

        // 3) 오늘자 미발송 시그널 일괄 이메일
        try {
            int sent = emailAlertService.dispatchPending(LocalDate.now());
            log.info("[DailySignal] dispatched {} signals", sent);
        } catch (Exception e) {
            log.error("[DailySignal] email dispatch failed: {}", e.getMessage());
        }

        // 4) BUY 시그널 → PENDING OrderProposal 자동 생성
        try {
            int created = createProposalsFor(LocalDate.now());
            log.info("[DailySignal] auto-proposals created={}", created);
        } catch (Exception e) {
            log.error("[DailySignal] proposal generation failed: {}", e.getMessage());
        }

        // 5) Alpha-Helix 워크스페이스(TESTED/LIVE) 자동 재실행: backtest+regime+trust+queue-orders
        try {
            int refreshed = refreshAlphaWorkspaces();
            log.info("[DailySignal] alpha workspaces refreshed={}", refreshed);
        } catch (Exception e) {
            log.error("[DailySignal] alpha refresh failed: {}", e.getMessage());
        }
    }

    /**
     * 활성 AlphaWorkspace(TESTED/LIVE) 각각을 소유자 권한으로 auto-run 재실행.
     * AuthContext는 해당 워크스페이스 user로 임시 설정. infinite_buying이면 queue-orders도 자동.
     */
    int refreshAlphaWorkspaces() {
        List<AlphaWorkspace> targets = alphaWsRepo.findByStatusIn(java.util.List.of("TESTED", "LIVE", "FORMALIZED"));
        int count = 0;
        for (AlphaWorkspace ws : targets) {
            if (ws.getStrategyConfigJson() == null) continue;
            try {
                Long wsUid = ws.getUser().getId();
                AuthContext.set(wsUid);
                alphaService.doAutoRun(ws.getId(), wsUid);
                count++;
            } catch (Exception e) {
                log.warn("[DailySignal] ws#{} auto-run failed: {}", ws.getId(), e.getMessage());
            } finally {
                AuthContext.clear();
            }
        }
        return count;
    }

    /**
     * 오늘자 BUY 시그널을 훑어 사용자의 활성 BrokerAccount(tradingEnabled=true) 1개에
     * PENDING OrderProposal 1건씩 생성. 같은 시그널로 중복 생성 방지.
     */
    int createProposalsFor(LocalDate asOf) {
        var todays = signalRepo.findByAsOfDate(asOf);
        int created = 0;
        for (DailySignal sig : todays) {
            if (sig.getSignal() != DailySignal.Signal.BUY) continue;

            var strategy = sig.getStrategy();
            Long userId = strategy.getUser().getId();

            // 사용자의 거래가능 계정 — REAL 우선, 없으면 MOCK
            BrokerAccount target = pickTradingAccount(userId);
            if (target == null) continue; // 거래 가능 계정 없음 → 스킵

            // 기본 수량: paramsJson.firstBuyShares (INFINITE_BUY) 또는 1
            int qty = parseFirstBuyShares(strategy.getParamsJson());

            // 중복 체크: 이 sourceSignalId로 이미 PENDING/APPROVED/EXECUTED 가 있으면 skip
            boolean dup = proposalRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .anyMatch(p -> sig.getId().equals(p.getSourceSignalId())
                            && !"REJECTED".equals(p.getStatus())
                            && !"EXPIRED".equals(p.getStatus())
                            && !"EXEC_FAILED".equals(p.getStatus()));
            if (dup) continue;

            proposalRepo.save(OrderProposal.builder()
                    .userId(userId)
                    .workspaceId(null) // Strategy↔Workspace 매핑은 별도 step에서. 일단 null.
                    .brokerAccountId(target.getId())
                    .ticker(strategy.getTicker())
                    .side("BUY")
                    .qty(qty)
                    .source("SIGNAL")
                    .sourceSignalId(sig.getId())
                    .rationale("[" + strategy.getCode() + "] " + safe(sig.getTitle()))
                    .status("PENDING")
                    .expiresAt(LocalDateTime.now().plusHours(24))
                    .build());
            created++;
        }
        return created;
    }

    private BrokerAccount pickTradingAccount(Long userId) {
        var accounts = brokerAccountRepo.findAllByUserIdOrderByEnvAsc(userId);
        // REAL 우선
        return accounts.stream()
                .filter(a -> Boolean.TRUE.equals(a.getTradingEnabled()))
                .sorted((a, b) -> {
                    boolean aReal = a.getEnv() == BrokerAccount.Env.REAL;
                    boolean bReal = b.getEnv() == BrokerAccount.Env.REAL;
                    return Boolean.compare(bReal, aReal);
                })
                .findFirst()
                .orElse(null);
    }

    private int parseFirstBuyShares(String paramsJson) {
        if (paramsJson == null || paramsJson.isBlank()) return 1;
        try {
            JsonNode node = om.readTree(paramsJson);
            int v = node.path("firstBuyShares").asInt(1);
            return Math.max(1, v);
        } catch (Exception e) {
            return 1;
        }
    }

    private String safe(String s) { return s == null ? "" : s; }
}
