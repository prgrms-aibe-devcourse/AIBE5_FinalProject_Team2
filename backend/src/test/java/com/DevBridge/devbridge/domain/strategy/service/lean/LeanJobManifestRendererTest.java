package com.DevBridge.devbridge.domain.strategy.service.lean;

import com.DevBridge.devbridge.domain.strategy.entity.LeanJob;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * K8s Job 매니페스트 렌더러 테스트 — 테넌트 네임스페이스·등급 자원 limits·env·콜백 URL 이 정확히 채워지고
 * 모든 토큰이 치환되는지(누락 시 잘못된 YAML) 검증.
 */
class LeanJobManifestRendererTest {

    private LeanJob job(long id, long userId, String tier) {
        return LeanJob.builder()
                .id(id).userId(userId).tier(tier).status("QUEUED")
                .strategyId("sma_crossover").symbolsJson("[\"SPY\"]")
                .startDate("2023-01-01").endDate("2024-01-01").market("us")
                .build();
    }

    @Test
    void renders_tenant_namespace_tier_resources_and_callback() {
        LeanK8sProperties props = mock(LeanK8sProperties.class);
        when(props.getNamespacePrefix()).thenReturn("lean-tenant-");
        when(props.getWorkerImage()).thenReturn("ecr/lean-worker:latest");
        when(props.getCallbackBaseUrl()).thenReturn("http://be/api/lean/jobs");
        when(props.resourcesFor("EXPERT"))
                .thenReturn(new LeanK8sProperties.K8sResources("4", "8Gi", 1800, 4));

        String yaml = new LeanJobManifestRenderer(props).renderJob(job(7L, 42L, "EXPERT"));

        assertThat(yaml).contains("namespace: lean-tenant-42");
        assertThat(yaml).contains("name: lean-bt-7");
        assertThat(yaml).contains("leanJobId: \"7\"");
        assertThat(yaml).contains("image: ecr/lean-worker:latest");
        assertThat(yaml).contains("cpu: \"4\"").contains("memory: \"8Gi\"");
        assertThat(yaml).contains("activeDeadlineSeconds: 1800");
        assertThat(yaml).contains("value: \"sma_crossover\"");     // STRATEGY_ID
        assertThat(yaml).contains("value: '[\"SPY\"]'");           // SYMBOLS (JSON, single-quoted)
        assertThat(yaml).contains("http://be/api/lean/jobs/7/result"); // 콜백 URL
        // 모든 토큰이 치환됐는지 — 잔여 __TOKEN__ 이 있으면 깨진 매니페스트
        assertThat(yaml).doesNotContain("__");
    }

    @Test
    void namespace_is_per_tenant() {
        LeanK8sProperties props = mock(LeanK8sProperties.class);
        when(props.getNamespacePrefix()).thenReturn("lean-tenant-");
        assertThat(new LeanJobManifestRenderer(props).namespaceFor(job(1L, 99L, "PREMIUM")))
                .isEqualTo("lean-tenant-99");
    }

    @Test
    void renders_tenant_secret_with_token_and_polygon() {
        LeanK8sProperties props = mock(LeanK8sProperties.class);
        when(props.getNamespacePrefix()).thenReturn("lean-tenant-");
        when(props.getInternalToken()).thenReturn("tok-123");
        when(props.getPolygonApiKey()).thenReturn("poly-xyz");

        String yaml = new LeanJobManifestRenderer(props).renderSecret(job(7L, 42L, "EXPERT"));

        assertThat(yaml).contains("kind: Secret");
        assertThat(yaml).contains("namespace: lean-tenant-42");
        assertThat(yaml).contains("internal-token: \"tok-123\"");   // 콜백 검증값과 동일
        assertThat(yaml).contains("polygon-api-key: \"poly-xyz\"");
        assertThat(yaml).doesNotContain("__");                      // 모든 토큰 치환됨
    }

    @Test
    void secret_escapes_double_quotes_in_value() {
        LeanK8sProperties props = mock(LeanK8sProperties.class);
        when(props.getNamespacePrefix()).thenReturn("lean-tenant-");
        when(props.getInternalToken()).thenReturn("a\"b");
        when(props.getPolygonApiKey()).thenReturn("");

        String yaml = new LeanJobManifestRenderer(props).renderSecret(job(1L, 1L, "STANDARD"));
        assertThat(yaml).contains("internal-token: \"a\\\"b\"");    // " 가 \" 로 이스케이프
    }
}
