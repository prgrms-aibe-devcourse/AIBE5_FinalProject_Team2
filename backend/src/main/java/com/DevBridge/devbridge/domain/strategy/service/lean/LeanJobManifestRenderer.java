package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * lean_job → K8s Job 매니페스트(YAML) 렌더러 — v2 컨트롤 플레인의 핵심(순수·테스트).
 *
 * <p>테넌트 네임스페이스 + 등급별 컨테이너 자원 limits(부하 최소화) + 타임아웃 + env(잡 스펙·콜백)를 채운다.
 * 디스패처(K3)가 이 YAML 을 {@code kubectl apply}(또는 fabric8)로 클러스터에 적용한다.
 * 템플릿은 {@code deploy/k8s/03-lean-backtest-job.template.yaml} 과 일치.
 */
@Component
@RequiredArgsConstructor
public class LeanJobManifestRenderer {

    private final LeanK8sProperties props;

    private static final String JOB_TEMPLATE = """
            apiVersion: batch/v1
            kind: Job
            metadata:
              name: lean-bt-__JOB_ID__
              namespace: __NAMESPACE__
              labels:
                app: lean
                tenant: "__TENANT_ID__"
                leanJobId: "__JOB_ID__"
            spec:
              backoffLimit: 0
              activeDeadlineSeconds: __TIMEOUT_SEC__
              ttlSecondsAfterFinished: 600
              template:
                metadata:
                  labels:
                    app: lean
                    leanJobId: "__JOB_ID__"
                spec:
                  restartPolicy: Never
                  automountServiceAccountToken: false
                  nodeSelector:
                    workload: lean-worker
                  tolerations:
                    - key: workload
                      operator: Equal
                      value: lean-worker
                      effect: NoSchedule
                  containers:
                    - name: lean-worker
                      image: __WORKER_IMAGE__
                      imagePullPolicy: IfNotPresent
                      resources:
                        requests: { cpu: "__CPU__", memory: "__MEM__" }
                        limits:   { cpu: "__CPU__", memory: "__MEM__" }
                      env:
                        - { name: LEAN_JOB_ID, value: "__JOB_ID__" }
                        - { name: STRATEGY_ID, value: "__STRATEGY_ID__" }
                        - { name: SYMBOLS, value: '__SYMBOLS_JSON__' }
                        - { name: START_DATE, value: "__START__" }
                        - { name: END_DATE, value: "__END__" }
                        - { name: MARKET, value: "__MARKET__" }
                        - { name: PARAM_OVERRIDES, value: '__PARAMS_JSON__' }
                        - { name: BE_CALLBACK_URL, value: "__CALLBACK_URL__" }
                        - name: BE_INTERNAL_TOKEN
                          valueFrom:
                            secretKeyRef: { name: lean-secrets, key: internal-token }
                        - name: POLYGON_API_KEY
                          valueFrom:
                            secretKeyRef: { name: lean-secrets, key: polygon-api-key }
            """;

    private static final String NS_TEMPLATE = """
            apiVersion: v1
            kind: Namespace
            metadata:
              name: __NAMESPACE__
              labels:
                app: lean
                tenant: "__TENANT_ID__"
                tier: "__TIER__"
            ---
            apiVersion: v1
            kind: ResourceQuota
            metadata:
              name: lean-quota
              namespace: __NAMESPACE__
            spec:
              hard:
                pods: "__MAX_PODS__"
            """;

    // 워커 Pod 가 ① 결과 콜백 인증(internal-token) ② in-pod 데이터(polygon-api-key)에 쓰는 테넌트 Secret.
    // 이게 없으면 워커 콜백이 401 로 거부되고 Polygon 키도 못 받는다(=루프 끊김). 디스패처가 NS 다음에 멱등 apply.
    private static final String SECRET_TEMPLATE = """
            apiVersion: v1
            kind: Secret
            metadata:
              name: lean-secrets
              namespace: __NAMESPACE__
            type: Opaque
            stringData:
              internal-token: "__INTERNAL_TOKEN__"
              polygon-api-key: "__POLYGON_API_KEY__"
            """;

    /** 테넌트 네임스페이스 이름(유저별 격리). */
    public String namespaceFor(LeanJob job) {
        return props.getNamespacePrefix() + job.getUserId();
    }

    /** 테넌트 네임스페이스 + ResourceQuota(동시 Pod 한도=등급) YAML. 멱등 apply 용. */
    public String renderNamespaceQuota(LeanJob job) {
        LeanK8sProperties.K8sResources r = props.resourcesFor(job.getTier());
        return NS_TEMPLATE
                .replace("__NAMESPACE__", namespaceFor(job))
                .replace("__TENANT_ID__", String.valueOf(job.getUserId()))
                .replace("__TIER__", nz(job.getTier(), "STANDARD"))
                .replace("__MAX_PODS__", String.valueOf(Math.max(1, r.maxPods())));
    }

    /**
     * 워커 Pod 용 테넌트 Secret YAML(콜백 internal-token + Polygon 키).
     * ⚠️ 비밀값 포함 — 로그로 출력 금지(디스패처는 stdin 으로만 kubectl 에 전달).
     */
    public String renderSecret(LeanJob job) {
        return SECRET_TEMPLATE
                .replace("__NAMESPACE__", namespaceFor(job))
                // 긴-수명 internal-token 대신 per-job 토큰(HMAC) 주입 — 워커 유출 시 블라스트 반경 최소화
                .replace("__INTERNAL_TOKEN__", yamlDq(props.jobToken(job.getId())))
                .replace("__POLYGON_API_KEY__", yamlDq(props.getPolygonApiKey()));
    }

    /** YAML 이중인용 스칼라 이스케이프(\\ 와 ") — 토큰에 특수문자가 있어도 깨지지 않게. */
    private static String yamlDq(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /** YAML 단일인용 스칼라 이스케이프(' → ''). 단일인용 스칼라엔 백슬래시 이스케이프가 없어 ' 만 더블링.
     *  사용자 main_py(PARAM_OVERRIDES)·심볼이 single-quote 를 포함해도 manifest 가 깨지거나 YAML 주입되지 않게. */
    private static String yamlSq(String s) {
        if (s == null) return "";
        return s.replace("'", "''");
    }

    /** lean_job + 등급 자원 → K8s Job YAML. 모든 토큰을 치환한다. */
    public String renderJob(LeanJob job) {
        LeanK8sProperties.K8sResources r = props.resourcesFor(job.getTier());
        return JOB_TEMPLATE
                .replace("__NAMESPACE__", namespaceFor(job))
                .replace("__TENANT_ID__", String.valueOf(job.getUserId()))
                .replace("__JOB_ID__", String.valueOf(job.getId()))
                .replace("__WORKER_IMAGE__", props.getWorkerImage())
                .replace("__CPU__", r.cpu())
                .replace("__MEM__", r.mem())
                .replace("__TIMEOUT_SEC__", String.valueOf(r.timeoutSec()))
                // 사용자 제어 값은 인용 컨텍스트에 맞게 escape — manifest 파손/YAML 주입 방지.
                // 이중인용("..."): STRATEGY_ID·START·END·MARKET / 단일인용('...'): SYMBOLS_JSON·PARAMS_JSON(main_py 포함)
                .replace("__STRATEGY_ID__", yamlDq(nz(job.getStrategyId(), "")))
                .replace("__SYMBOLS_JSON__", yamlSq(nz(job.getSymbolsJson(), "[]")))
                .replace("__START__", yamlDq(nz(job.getStartDate(), "")))
                .replace("__END__", yamlDq(nz(job.getEndDate(), "")))
                .replace("__MARKET__", yamlDq(nz(job.getMarket(), "us")))
                .replace("__PARAMS_JSON__", yamlSq(nz(job.getParamsJson(), "null")))
                .replace("__CALLBACK_URL__", props.getCallbackBaseUrl() + "/" + job.getId() + "/result");
    }

    private static String nz(String s, String d) {
        return (s == null || s.isBlank()) ? d : s;
    }
}
