package com.DevBridge.devbridge.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 전역 CORS + 업로드 파일 정적 서빙.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.upload.public-base:/files}")
    private String publicBase;

    /**
     * 콤마 구분 origin 리스트. 운영에선 CORS_ALLOWED_ORIGINS 환경변수로 주입.
     * 로컬 fallback: dev 서버 주소.
     */
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOriginsCsv;

    private String[] resolveOrigins() {
        if (allowedOriginsCsv == null || allowedOriginsCsv.isBlank()) {
            return new String[]{"http://localhost:5173", "http://127.0.0.1:5173"};
        }
        return java.util.Arrays.stream(allowedOriginsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = resolveOrigins();
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        // 업로드 파일 다운로드용 (FE에서 <a href> 또는 fetch로 직접 받음)
        registry.addMapping(publicBase + "/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "HEAD", "OPTIONS")
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        String location = root.toUri().toString(); // file:/.../uploads/
        registry.addResourceHandler(publicBase + "/**")
                .addResourceLocations(location)
                .setCachePeriod(3600);
    }
}


