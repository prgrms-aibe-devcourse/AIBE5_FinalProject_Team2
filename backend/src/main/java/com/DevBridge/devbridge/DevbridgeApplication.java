package com.DevBridge.devbridge;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvEntry;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

@SpringBootApplication
@EnableJpaAuditing
@EnableScheduling
@EnableAsync
public class DevbridgeApplication {
	public static void main(String[] args) {
		// 현재 디렉토리(backend/)에서 .env 탐색, 없으면 상위 디렉토리(프로젝트 루트)에서 재탐색
		Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
		Map<String, Object> envProps = new HashMap<>();
		for (DotenvEntry entry : dotenv.entries()) {
			envProps.put(entry.getKey(), entry.getValue());
		}
		if (envProps.isEmpty()) {
			Dotenv parentDotenv = Dotenv.configure().directory("../").ignoreIfMissing().load();
			for (DotenvEntry entry : parentDotenv.entries()) {
				envProps.put(entry.getKey(), entry.getValue());
			}
		}

		// .env 값을 JVM system property 로 등록.
		// → OS 환경변수보다 우선순위 높음 (만료된 OS 환경변수 GEMINI_API_KEY 등으로 인한 덮어쓰기 방지).
		envProps.forEach((k, v) -> {
			if (v != null && System.getProperty(k) == null) {
				System.setProperty(k, String.valueOf(v));
			}
		});

		// application-local.properties 의 모든 값을 JVM system property 로 강제 등록.
		// Spring property 우선순위: System property(#8) > OS env(#9) > application-{profile}.properties(#11).
		// → OS 환경변수에 박힌 만료/잘못된 키들로 인해 application-local.properties 값이 덮어쓰이는 문제 방지.
		// 운영에선 spring.profiles.active=prod 로 띄우면 application-local 자체가 로딩되지 않으므로 영향 없음.
		try (InputStream in = DevbridgeApplication.class.getResourceAsStream("/application-local.properties")) {
			if (in != null) {
				Properties localProps = new Properties();
				localProps.load(in);
				localProps.forEach((k, v) -> {
					String key = String.valueOf(k);
					String val = String.valueOf(v);
					if (!val.isBlank() && !val.startsWith("${")) {
						System.setProperty(key, val);
					}
				});
			}
		} catch (Exception ignored) { /* 로컬 파일 없으면 skip */ }

		SpringApplication app = new SpringApplication(DevbridgeApplication.class);
		app.setDefaultProperties(envProps);
		app.run(args);
	}
}