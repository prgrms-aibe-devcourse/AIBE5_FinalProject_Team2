# Alpha-Helix 관측성 (Prometheus + Grafana)

백엔드의 **p95/p99 지연 · 에러율 · 처리량 · JVM** 메트릭을 Prometheus 로 수집하고 Grafana 로 시각화한다.

백엔드는 이미 Micrometer 로 `http.server.requests` 타이머에 백분위 히스토그램(p50/p95/p99) + SLO 버킷을 켜 두었고
(`backend/src/main/resources/application.properties` 의 `management.metrics.distribution.*`),
`micrometer-registry-prometheus` 의존성과 `prometheus` actuator 엔드포인트 노출을 추가해 스크레이프가 가능하다.

---

## 1. 백엔드 메트릭 노출 확인

백엔드(로컬 `:8080`, eden 로컬 스택이면 `:9091`)를 띄운 뒤:

```bash
curl http://localhost:8080/actuator/prometheus | head -n 40
```

다음과 같은 Micrometer Prometheus 메트릭이 보이면 정상이다:

```
# HELP http_server_requests_seconds
# TYPE http_server_requests_seconds histogram
http_server_requests_seconds_bucket{method="GET",outcome="SUCCESS",status="200",uri="/actuator/health",le="0.05",} 12.0
http_server_requests_seconds_count{...} 12.0
http_server_requests_seconds_sum{...} 0.31
...
jvm_memory_used_bytes{area="heap",...} ...
```

엔드포인트가 404 면: `application.properties` 의
`management.endpoints.web.exposure.include` 에 `prometheus` 가 포함됐는지 + BE 를 재기동했는지 확인.

> ⚠️ 운영에서는 `/actuator/prometheus` 를 인터넷에 그대로 노출하지 말 것 — Nginx/방화벽으로 내부망/모니터링 IP 에만 허용하거나 별도 management 포트로 분리.

---

## 2. 관측성 스택 띄우기

```bash
cd deploy/observability
docker compose -f docker-compose.observability.yml up -d
```

| 서비스 | URL | 계정 |
|---|---|---|
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin / admin (최초 로그인 시 변경) |

내리기:

```bash
docker compose -f docker-compose.observability.yml down        # 컨테이너만
docker compose -f docker-compose.observability.yml down -v     # 데이터 볼륨까지
```

---

## 3. 스크레이프 타깃 설정 (중요)

Prometheus 는 컨테이너 안에서 동작하므로 호스트의 백엔드를 가리켜야 한다.
`prometheus.yml` 의 `alpha-be` job `targets` 를 환경에 맞게 조정한다.

| 백엔드 위치 | targets 값 |
|---|---|
| Docker Desktop(Win/Mac), BE `:8080` | `host.docker.internal:8080` (기본값) |
| eden 로컬 스택, BE `:9091` | `host.docker.internal:9091` |
| BE 도 같은 compose 네트워크 | `backend:8080` |
| Linux 호스트 | `host.docker.internal:8080` (compose 에 `host-gateway` 매핑 포함됨) |

수정 후 Prometheus 재시작:

```bash
docker compose -f docker-compose.observability.yml restart prometheus
```

타깃 상태 확인: Prometheus UI → **Status → Targets** 에서 `alpha-be` 가 `UP` 인지 확인.

> Analytics(`:8001`) 도 스크레이프하려면 FastAPI 에 `/metrics` 노출을 추가한 뒤
> `prometheus.yml` 의 `alpha-analytics` job 주석을 해제한다.

---

## 4. Grafana 대시보드

데이터소스(Prometheus)와 대시보드는 **provisioning 으로 자동 로드**된다.
Grafana 접속 후 좌측 메뉴 **Dashboards → Alpha-Helix 폴더 → "Alpha-Helix — Backend Latency & Errors"**.

### 수동 import (provisioning 이 안 먹을 때)
1. Grafana → **Dashboards → New → Import**
2. `grafana-dashboard-alpha.json` 업로드 (또는 내용 붙여넣기)
3. 데이터소스로 Prometheus 선택 → Import

---

## 5. 대시보드 패널

| # | 패널 | 핵심 PromQL |
|---|---|---|
| 1 | **HTTP 지연 p50/p95/p99** | `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job="alpha-be"}[5m])) by (le))` |
| 2 | **에러율 (5xx 비율)** | `sum(rate(http_server_requests_seconds_count{job="alpha-be", outcome="SERVER_ERROR"}[5m])) / clamp_min(sum(rate(http_server_requests_seconds_count{job="alpha-be"}[5m])), 1e-9)` |
| 3 | **요청 처리량 (req/s, status별)** | `sum(rate(http_server_requests_seconds_count{job="alpha-be"}[5m])) by (status)` |
| 4 | **JVM 메모리 + GC pause** | `sum(jvm_memory_used_bytes{job="alpha-be", area="heap"})` / `sum(rate(jvm_gc_pause_seconds_sum{job="alpha-be"}[5m]))` |

> 메트릭명은 Micrometer Prometheus 표준(`http_server_requests_seconds_*`, `jvm_*`).
> 분위수는 SLO 버킷(`50ms,100ms,200ms,500ms,1s,2s`) 경계에서 보간되므로,
> 정밀한 p99 가 필요하면 `application.properties` 의 `management.metrics.distribution.slo.*` 에 버킷을 추가한다.
