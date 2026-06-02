package com.DevBridge.devbridge.global.security;

import com.DevBridge.devbridge.domain.user.controller.AuthController;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 추출 우선순위:
 *   1) HttpOnly 쿠키 (DEVBRIDGE_TOKEN) — 새로운 표준
 *   2) Authorization: Bearer <token> 헤더 — 레거시 호환
 *
 * 검증 통과 시 request attribute에 다음 값 설정:
 *   - "auth.userId" (Long)
 *   - "auth.userType" (String)
 * 실패해도 요청은 그대로 통과 (인증이 필요한 컨트롤러에서 attribute 체크).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ATTR_USER_ID = "auth.userId";
    public static final String ATTR_USER_TYPE = "auth.userType";

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && !token.isBlank()) {
            try {
                var claims = jwtUtil.parse(token);
                Object uid = claims.get("uid");
                Object type = claims.get("type");
                if (uid instanceof Number n) {
                    request.setAttribute(ATTR_USER_ID, n.longValue());
                    if (type != null) {
                        request.setAttribute(ATTR_USER_TYPE, type.toString());
                    }
                    // Spring Security SecurityContext에도 인증 정보 등록
                    // → .anyRequest().authenticated() 체크를 통과하게 함
                    var auth = new UsernamePasswordAuthenticationToken(
                            n.longValue(), null, List.of());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                // 토큰 파싱 실패: 익명 요청으로 통과
                log.debug("JWT parse failed: {}", e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // 1순위: HttpOnly 쿠키
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (AuthController.AUTH_COOKIE_NAME.equals(c.getName())) {
                    String v = c.getValue();
                    if (v != null && !v.isBlank()) return v.trim();
                }
            }
        }
        // 2순위: Authorization 헤더 (레거시 호환)
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        return null;
    }
}

