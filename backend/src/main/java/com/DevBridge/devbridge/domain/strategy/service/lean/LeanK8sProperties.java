package com.DevBridge.devbridge.domain.strategy.service.lean;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

/**
 * Lean v2(K8s) 설정 — 등급별 컨테이너 자원(CPU/RAM·타임아웃·동시 Pod) + 워커 이미지/콜백/네임스페이스.
 * 등급 자원이 곧 부하 최소화의 핵심(Pod resources.limits) + QC 노드 tier 대응. 설정: {@code app.lean.k8s.*}.
 */
@Component
public class LeanK8sProperties {

    @Value("${app.lean.k8s.enabled:false}")                 private boolean enabled;
    @Value("${app.lean.k8s.worker-image:lean-worker:latest}") private String workerImage;
    @Value("${app.lean.k8s.callback-base-url:http://localhost:8080/api/lean/jobs}") private String callbackBaseUrl;
    @Value("${app.lean.k8s.namespace-prefix:lean-tenant-}") private String namespacePrefix;

    // 워커 Pod 가 결과 콜백 인증에 쓸 내부 토큰 — 반드시 컨트롤러 검증값(app.analytics.internal-token)과 동일.
    @Value("${app.analytics.internal-token:}")              private String internalToken;
    // 워커 in-pod 데이터 페치용 Polygon 키(테넌트 Secret 으로 주입). 미설정 시 워커는 yfinance 폴백.
    @Value("${app.lean.k8s.polygon-api-key:}")              private String polygonApiKey;

    // 등급별 자원 (cpu, memory, timeoutSec, maxPods=동시 Pod=ResourceQuota)
    @Value("${app.lean.k8s.standard.cpu:1}")       private String stdCpu;
    @Value("${app.lean.k8s.standard.mem:2Gi}")     private String stdMem;
    @Value("${app.lean.k8s.standard.timeout:600}") private int stdTimeout;
    @Value("${app.lean.k8s.standard.max-pods:1}")  private int stdMaxPods;
    @Value("${app.lean.k8s.premium.cpu:2}")        private String prmCpu;
    @Value("${app.lean.k8s.premium.mem:4Gi}")      private String prmMem;
    @Value("${app.lean.k8s.premium.timeout:1200}") private int prmTimeout;
    @Value("${app.lean.k8s.premium.max-pods:2}")   private int prmMaxPods;
    @Value("${app.lean.k8s.expert.cpu:4}")         private String expCpu;
    @Value("${app.lean.k8s.expert.mem:8Gi}")       private String expMem;
    @Value("${app.lean.k8s.expert.timeout:1800}")  private int expTimeout;
    @Value("${app.lean.k8s.expert.max-pods:4}")    private int expMaxPods;

    public boolean isEnabled() { return enabled; }
    public String getWorkerImage() { return workerImage; }
    public String getCallbackBaseUrl() { return callbackBaseUrl; }
    public String getNamespacePrefix() { return namespacePrefix; }
    public String getInternalToken() { return internalToken; }
    public String getPolygonApiKey() { return polygonApiKey; }

    /**
     * 워커 콜백용 per-job 토큰 = HMAC-SHA256(internal-token, "lean-job:"+jobId) hex.
     * 긴-수명 internal-token 대신 잡별 토큰을 워커 Secret 에 주입 → 워커(임의 user 코드 실행)가
     * 토큰을 유출해도 그 잡의 콜백에만 유효(타 잡/타 internal-token 엔드포인트 불가). 무상태(재계산 검증).
     */
    public String jobToken(long jobId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(internalToken.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(("lean-job:" + jobId).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException("lean jobToken HMAC 실패", e);
        }
    }

    /** 등급별 Pod 자원 사양. */
    public record K8sResources(String cpu, String mem, int timeoutSec, int maxPods) {}

    /** 등급 → 자원. FREE/미상 → maxPods 0(차단). */
    public K8sResources resourcesFor(String tier) {
        if (tier == null) return new K8sResources(stdCpu, stdMem, stdTimeout, 0);
        switch (tier.toUpperCase()) {
            case "EXPERT":   return new K8sResources(expCpu, expMem, expTimeout, expMaxPods);
            case "PREMIUM":  return new K8sResources(prmCpu, prmMem, prmTimeout, prmMaxPods);
            case "STANDARD": return new K8sResources(stdCpu, stdMem, stdTimeout, stdMaxPods);
            default:         return new K8sResources(stdCpu, stdMem, stdTimeout, 0);
        }
    }
}
