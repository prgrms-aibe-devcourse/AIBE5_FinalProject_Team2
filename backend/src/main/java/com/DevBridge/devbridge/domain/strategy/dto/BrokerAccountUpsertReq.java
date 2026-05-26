package com.DevBridge.devbridge.domain.strategy.dto;

import com.DevBridge.devbridge.domain.strategy.entity.BrokerAccount;

public record BrokerAccountUpsertReq(
        BrokerAccount.Env env,
        BrokerAccount.BrokerType brokerType,
        // KIS 전용
        String appKey,
        String appSecret,
        String cano,
        String acntPrdtCd,
        // Binance 전용
        String binanceApiKey,
        String binanceApiSecret,
        BrokerAccount.BinanceMode binanceMode,
        // 공통
        Long maxOrderUsd,
        Long dailyOrderUsd
) {}
