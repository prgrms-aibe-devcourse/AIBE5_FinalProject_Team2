package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * Lean v2 K8s 디스패처 — 렌더된 매니페스트를 {@code kubectl apply} 로 클러스터에 적용(K3).
 *
 * <p>flag {@code app.lean.k8s.enabled} 가 켜지고 kubectl+클러스터가 있을 때만 동작.
 * 테넌트 네임스페이스+ResourceQuota 를 멱등 보장한 뒤 백테스트 Job 을 생성한다.
 * (프로덕션에선 fabric8 Java 클라이언트로 교체 가능 — 인터페이스 동일.)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LeanK8sDispatcher {

    private final LeanJobManifestRenderer renderer;

    @Value("${app.lean.k8s.kubectl:kubectl}")
    private String kubectl;

    /** 테넌트 ns+quota → secret(콜백토큰·Polygon) → 백테스트 Job apply. 반환 = K8s Job 이름. */
    public String dispatch(LeanJob job) throws Exception {
        kubectlApply(renderer.renderNamespaceQuota(job));   // 멱등(이미 있으면 unchanged)
        kubectlApply(renderer.renderSecret(job));           // 워커 콜백 인증·데이터 시크릿(테넌트별, 멱등)
        kubectlApply(renderer.renderJob(job));
        return "lean-bt-" + job.getId();
    }

    /** K8s Job 상태 스냅샷 — succeeded/failed/active 개수. found=false 면 잡이 없거나 조회 실패. */
    public record JobPhase(int succeeded, int failed, int active, boolean found) {}

    /**
     * kubectl 로 K8s Job 상태 조회(재조정용). 없거나(ttl 삭제) 오류면 {@code found=false} 반환(예외 없음).
     * jsonpath 로 succeeded|failed|active 를 한 번에 뽑아 파싱한다(필드 없으면 빈 문자열 → 0).
     */
    public JobPhase jobPhase(String namespace, String jobName) {
        if (namespace == null || jobName == null) return new JobPhase(0, 0, 0, false);
        try {
            ProcessBuilder pb = new ProcessBuilder(kubectl, "get", "job", jobName, "-n", namespace,
                    "-o", "jsonpath={.status.succeeded}|{.status.failed}|{.status.active}");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
            if (!p.waitFor(10, TimeUnit.SECONDS)) { p.destroyForcibly(); return new JobPhase(0, 0, 0, false); }
            if (p.exitValue() != 0) return new JobPhase(0, 0, 0, false);   // not found / error
            String[] parts = out.split("\\|", -1);
            return new JobPhase(
                    parseIntSafe(parts.length > 0 ? parts[0] : ""),
                    parseIntSafe(parts.length > 1 ? parts[1] : ""),
                    parseIntSafe(parts.length > 2 ? parts[2] : ""),
                    true);
        } catch (Exception e) {  // noqa
            return new JobPhase(0, 0, 0, false);
        }
    }

    private static int parseIntSafe(String s) {
        try { return (s == null || s.isBlank()) ? 0 : Integer.parseInt(s.strip()); }
        catch (NumberFormatException e) { return 0; }
    }

    /** kubectl apply -f -  (매니페스트를 stdin 으로). 비0 종료 시 예외. */
    private void kubectlApply(String yaml) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(kubectl, "apply", "-f", "-");
        pb.redirectErrorStream(true);
        Process p = pb.start();
        try (OutputStream os = p.getOutputStream()) {
            os.write(yaml.getBytes(StandardCharsets.UTF_8));
        }
        String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        if (!p.waitFor(30, TimeUnit.SECONDS)) {
            p.destroyForcibly();
            throw new RuntimeException("kubectl apply 타임아웃");
        }
        if (p.exitValue() != 0) {
            throw new RuntimeException("kubectl apply 실패(exit " + p.exitValue() + "): " + out.strip());
        }
        log.debug("[k8s] apply: {}", out.strip());
    }
}
