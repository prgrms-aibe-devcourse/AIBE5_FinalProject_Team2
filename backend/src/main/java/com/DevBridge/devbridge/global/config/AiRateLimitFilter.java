package com.DevBridge.devbridge.global.config;

import com.DevBridge.devbridge.global.security.JwtAuthenticationFilter;
import com.DevBridge.devbridge.domain.user.entity.User;
import com.DevBridge.devbridge.domain.user.repository.UserRepository;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bucket4j 기반 Rate Limiter — AI 채팅 / 백테스트 등 고비용 엔드포인트 보호.
 *
 * 적용 대상:
 *  - POST /api/alpha/workspaces/{id}/chat         → AI 채팅 (Gemini 호출)
 *  - POST /api/alpha/workspaces/{id}/formalize    → LLM 전략 정형화
 *  - POST /api/alpha/workspaces/{id}/briefing     → Living Briefing
 *  - POST /api/alpha/workspaces/{id}/auto-run     → 전체 파이프라인 실행
 *
 * 한도: 사용자당 시간당 20회 (FREE), 60회 (PRO 등급은 추후 확장)
 * 인메모리: 운영에서는 Redis + Bucket4j JCache 연동 권장
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)   // JwtAuthenticationFilter(+10) 다음에 실행 — 그래야 request attribute(userId)가 채워진 상태
public class AiRateLimitFilter extends OncePerRequestFilter {

    @Value("${app.ratelimit.ai-chat.capacity:20}")
    private int capacity;

    @Value("${app.ratelimit.ai-chat.refill-tokens:20}")
    private int refillTokens;

    @Value("${app.ratelimit.ai-chat.refill-minutes:60}")
    private int refillMinutes;

    // 일일 상한 (티어 차등) — 시간당 버스트 한도 위에 하루 누적 한도를 겹쳐 지속 남용 방지.
    @Value("${app.ratelimit.ai-daily.free:100}")     private int dailyFree;
    @Value("${app.ratelimit.ai-daily.standard:200}") private int dailyStandard;
    @Value("${app.ratelimit.ai-daily.premium:400}")  private int dailyPremium;
    @Value("${app.ratelimit.ai-daily.expert:800}")   private int dailyExpert;

    private final UserRepository userRepo;
    public AiRateLimitFilter(UserRepository userRepo) { this.userRepo = userRepo; }

    /** userId → Bucket */
    private final Map<Long, Bucket> buckets = new ConcurrentHashMap<>();

    private static final String[] RATE_LIMITED_PATTERNS = {
        "/api/alpha/workspaces/",  // 하위 경로 중 아래 메서드만 체크
    };

    private static final String[] RATE_LIMITED_SUFFIXES = {
        "/chat", "/formalize", "/briefing", "/auto-run",
    };

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        String path = request.getRequestURI();
        if (!path.startsWith("/api/alpha/workspaces/")) return true;
        for (String suffix : RATE_LIMITED_SUFFIXES) {
            if (path.endsWith(suffix)) return false;
        }
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // 신원은 request attribute 에서 직접 읽는다. AuthContext.currentUserId() 는 RequestContextHolder 에 의존하는데
        // 서블릿 필터 단계에서는 (DispatcherServlet 진입 전이라) 아직 채워지지 않아 항상 null → 레이트리밋이 전원 무력화되던 버그.
        // JwtAuthenticationFilter(@Order +10)가 먼저 실행돼 이 attribute 를 채워둔다(@Order +20).
        Object uidAttr = request.getAttribute(JwtAuthenticationFilter.ATTR_USER_ID);
        Long userId = (uidAttr instanceof Long l) ? l : null;
        if (userId == null) {
            // 미인증 요청 — 대상 컨트롤러가 인증을 요구(401)하므로 여기서는 통과. (LLM 호출은 인증 통과 후에만 발생)
            chain.doFilter(request, response);
            return;
        }

        Bucket bucket = buckets.computeIfAbsent(userId, this::newBucket);
        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            long availableIn = bucket.getAvailableTokens();
            log.warn("Rate limit exceeded: userId={} path={}", userId, request.getRequestURI());
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                "{\"error\":\"AI 요청 한도를 초과했습니다 (시간당 " + capacity + "회 · 하루 " + dailyCapFor(userId) + "회). 잠시 후 다시 시도해주세요.\"," +
                "\"remaining\":" + availableIn + "}"
            );
        }
    }

    /** 구독 등급별 일일 AI 요청 상한. */
    private int dailyCapFor(Long userId) {
        try {
            User.UserType ut = userRepo.findById(userId).map(User::getUserType).orElse(User.UserType.FREE);
            if (ut == null) return dailyFree;
            return switch (ut) {
                case EXPERT -> dailyExpert;
                case PREMIUM -> dailyPremium;
                case STANDARD -> dailyStandard;
                default -> dailyFree;   // FREE
            };
        } catch (Exception e) { return dailyFree; }
    }

    private Bucket newBucket(Long userId) {
        // 시간당 버스트 + 하루 누적(티어 차등)을 같은 버킷에 겹쳐 둘 다 통과해야 허용.
        Bandwidth hourly = Bandwidth.classic(
            capacity, Refill.greedy(refillTokens, Duration.ofMinutes(refillMinutes)));
        int daily = dailyCapFor(userId);
        Bandwidth dailyLimit = Bandwidth.classic(
            daily, Refill.intervally(daily, Duration.ofDays(1)));
        return Bucket.builder().addLimit(hourly).addLimit(dailyLimit).build();
    }
}
