package com.DevBridge.devbridge.global.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 요청 상관관계 ID(correlation id) — 한 HTTP 요청을 모든 로그에서(그리고 Analytics 사이드카까지)
 * 하나의 ID 로 추적할 수 있게 한다. 분산 시스템의 부분 실패를 추적하는 가장 기본적인 장치다(DDIA 1·8장).
 *
 * <p>동작:
 * <ul>
 *   <li>들어오는 {@code X-Request-Id} 가 있으면 그대로 사용(상류 추적 유지), 없으면 새로 생성</li>
 *   <li>SLF4J {@link MDC} 에 넣어 모든 로그 라인에 자동 부착(application.properties 의 logging.pattern.level)</li>
 *   <li>응답 헤더로도 반환 — 사용자가 오류 문의 시 이 ID 를 제시하면 로그를 바로 찾는다</li>
 *   <li>{@code AnalyticsClient} 가 이 값을 {@code X-Request-Id} 헤더로 전파 → Python 로그와 이어진다</li>
 * </ul>
 *
 * <p>⚠️ MDC 는 ThreadLocal 이다. 스레드 풀 재사용 시 다음 요청으로 ID 가 새지 않도록
 * 반드시 {@code finally} 에서 제거한다. (학습 09장 원리 80: set 은 항상 finally clear 와 짝)
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)   // JwtAuthenticationFilter(+10)보다도 먼저 — 인증/그 외 모든 로그에 reqId 가 찍히도록
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "reqId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String reqId = request.getHeader(HEADER);
        if (reqId == null || reqId.isBlank()) {
            reqId = UUID.randomUUID().toString().substring(0, 8);   // 짧게 — 로그 가독성
        }
        MDC.put(MDC_KEY, reqId);
        response.setHeader(HEADER, reqId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);   // ThreadLocal 오염 방지(필수)
        }
    }
}
