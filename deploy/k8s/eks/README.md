# deploy/k8s/eks — Lean v2 멀티테넌트 클라우드 → AWS EKS 프로비저닝 & 런북

> 상위 매니페스트(테넌트 NS·RBAC·Job 템플릿)는 [../README.md](../README.md) 와 [../01-namespace-quota.yaml](../01-namespace-quota.yaml)·[../02-rbac.yaml](../02-rbac.yaml)·[../03-lean-backtest-job.template.yaml](../03-lean-backtest-job.template.yaml) 에 있다. 이 디렉터리는 그것을 **AWS EKS 에 올리는 IaC + 런북**이다.
> 설계 배경: [../../../docs/LEAN_CLOUD_PLAN.md](../../../docs/LEAN_CLOUD_PLAN.md) "v2 — Kubernetes 멀티테넌트 클라우드".

## 이 디렉터리의 산출물
| 파일 | 무엇 |
|---|---|
| [eksctl-cluster.yaml](eksctl-cluster.yaml) | eksctl ClusterConfig — 리전·OIDC·온디맨드 시스템 NG + 스팟 `lean-worker` NG(라벨 `workload=lean-worker` + 테인트)·오토스케일러 IRSA/태그 |
| [ecr-push.sh](ecr-push.sh) | `lean-worker` 이미지 빌드→ECR 푸시(analytics/app 동봉·ECR 로그인·리포 보장) |
| [cluster-autoscaler.md](cluster-autoscaler.md) | 노드 오토스케일 설치(Cluster Autoscaler / Karpenter) — 위 ClusterConfig 와 맞물림 |
| (본 문서) | **엔드투엔드 런북** + S3 결과 공유 메모 + 비용 주의 + **재배포 노트** |

## 사전 준비
- `aws` CLI(로그인/SSO 완료), `eksctl`, `kubectl`, `helm`, `docker` 데몬.
- ECR push + EKS 관리 권한이 있는 IAM 주체.
- 백엔드 빌드가 **Lean v2 엔드포인트 포함**인지 확인 — 아래 [④ 재배포 노트](#④-재배포-노트-운영-be-가-v2-이전이면) 참조.

---

## 엔드투엔드 런북

### ① eksctl 으로 클러스터 생성
[eksctl-cluster.yaml](eksctl-cluster.yaml) 의 `<AWS_REGION>` 등 플레이스홀더를 치환한 뒤:
```bash
eksctl create cluster -f deploy/k8s/eks/eksctl-cluster.yaml
# kubeconfig 갱신(보통 자동). 수동:
aws eks update-kubeconfig --name alphahelix-lean --region <AWS_REGION>
kubectl get nodes        # ng-system 노드 2대 Ready (lean-worker 는 desired 0 → 안 보임이 정상)
```
이어 노드 오토스케일 설치 → [cluster-autoscaler.md](cluster-autoscaler.md).

### ② 워커 이미지를 ECR 로 푸시
```bash
AWS_REGION=<AWS_REGION> ACCOUNT_ID=<ACCOUNT_ID> ./deploy/k8s/eks/ecr-push.sh
# → 출력 끝의  LEAN_WORKER_IMAGE=<ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/lean-worker:latest  를 받아둔다.
```
> ⚠️ 이미지 ~42.5GB(quantconnect/lean 베이스) — 빌드/푸시에 시간·대역폭이 크다. [비용/슬림화 메모](#비용-주의--워커-이미지-425gb) 참조.

### ③ 컨트롤러 RBAC / SA 적용 + lean-system 네임스페이스
BE 컨트롤러가 테넌트 NS/Quota/Secret/Job 을 만들 권한을 클러스터에 심는다.
```bash
kubectl create namespace lean-system --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f deploy/k8s/02-rbac.yaml
# 02-rbac.yaml 의 lean-secrets(테넌트 Secret)는 토큰 포함 → 여기선 적용하지 않는다.
# 테넌트 NS/Quota/Secret/Job 은 런타임에 BE(LeanK8sDispatcher)가 토큰 치환해 'kubectl apply' 로 생성한다.
```
> 테넌트 NS·ResourceQuota·NetworkPolicy 자체를 미리 보고 싶으면 [../01-namespace-quota.yaml](../01-namespace-quota.yaml) 의 `__TENANT_ID__` 등 토큰을 치환해 수동 apply 가능(평소엔 BE 가 자동 생성).

### ④ BE 환경변수 설정 (컨트롤 플레인 켜기)
BE([LeanK8sProperties](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanK8sProperties.java))가 읽는 키 — application.properties 매핑:
`app.lean.k8s.enabled` ← `LEAN_K8S_ENABLED` · `app.lean.k8s.worker-image` ← `LEAN_WORKER_IMAGE` · `app.lean.k8s.callback-base-url` ← `LEAN_CALLBACK_BASE_URL` · `app.lean.k8s.kubectl` ← `KUBECTL_BIN` · `app.lean.k8s.polygon-api-key` ← `POLYGON_API_KEY`.

```bash
LEAN_K8S_ENABLED=true
LEAN_WORKER_IMAGE=<ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/lean-worker:latest
# 워커 Pod 가 결과를 POST 할 BE 주소. 절대 localhost 아님 — 클러스터에서 닿는 BE 서비스 URL.
LEAN_CALLBACK_BASE_URL=http://<BE 서비스 호스트>:9091/api/lean/jobs
KUBECTL_BIN=kubectl                 # 컨테이너 PATH 에 kubectl 이 있어야 함(아래 주의)
POLYGON_API_KEY=<선택 — 없으면 워커가 yfinance 폴백>
# 콜백 인증 토큰은 별도 키가 아니라 ANALYTICS_INTERNAL_TOKEN 을 그대로 테넌트 Secret 으로 주입(동일값 보장).
ANALYTICS_INTERNAL_TOKEN=<BE 와 워커가 공유하는 내부 토큰>
```
콜백 URL 주의: BE 가 최종적으로 워커에 넘기는 값은 `LEAN_CALLBACK_BASE_URL` + `/{jobId}/result`
([LeanJobManifestRenderer](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanJobManifestRenderer.java) 가 `getCallbackBaseUrl() + "/" + jobId + "/result"` 로 조립).
즉 BE 의 실제 콜백 핸들러 `POST /api/lean/jobs/{id}/result` 와 맞추려면 `LEAN_CALLBACK_BASE_URL` 은 `.../api/lean/jobs` 로 끝나야 한다(기본값 동일).

**BE → K8s 인증(in-cluster SA vs kubeconfig)** — 둘 중 하나:
- **in-cluster(권장)**: BE 를 EKS 안에 `lean-system` 네임스페이스 + `serviceAccountName: lean-controller`([../02-rbac.yaml](../02-rbac.yaml))로 배포. Pod 의 마운트된 SA 토큰 + ClusterRole 로 `kubectl`/fabric8 이 자동 인증. 추가 자격증명 불필요.
- **밖(EC2/도커-컴포즈)**: BE 호스트에 IAM 인증되는 kubeconfig 제공(`aws eks update-kubeconfig`) + 컨테이너 안에서도 `KUBECTL_BIN` 이 가리키는 kubectl 이 그 kubeconfig 로 EKS 에 닿아야 함. [LeanK8sDispatcher](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanK8sDispatcher.java) 는 `kubectl apply -f -` 서브프로세스를 띄우므로 **kubectl 바이너리 + IAM 권한이 BE 프로세스 환경에 반드시 존재**해야 한다(현재 docker-compose 의 backend 이미지엔 kubectl 미포함 — in-cluster 배포가 단순).

### ⑤ 검증 (잡 제출 → Pod 실행 → 콜백)
```bash
# 1) STANDARD 이상 유저로 백테스트 제출(JWT 쿠키 필요). 컨트롤러: POST /api/lean/backtest/submit
curl -X POST https://<BE>/api/lean/backtest/submit \
  -H 'Content-Type: application/json' -b 'token=<JWT>' \
  -d '{"strategyId":"sma_crossover","symbols":["SPY"],"startDate":"2023-01-01","endDate":"2024-01-01","market":"us"}'
# → {"jobId": N, "status":"QUEUED", "tier":"STANDARD"}

# 2) 스케줄러(LeanK8sSchedulerService, 4s 틱)가 디스패치 → 테넌트 NS/Job 생성 관찰
kubectl get ns | grep lean-tenant-
kubectl get jobs -A -l app=lean
kubectl get pods -A -l app=lean -w           # Pending→(오토스케일러 노드 확장)→Running→Completed

# 3) 워커 로그 — 데이터 fetch · 엔진 STATISTICS · 콜백 결과 확인
kubectl logs -n lean-tenant-<userId> job/lean-bt-<jobId>
#   [worker] data SPY: ... / [worker] RESULT {...} / [worker] callback .../result -> 200

# 4) 잡 마감 확인(콜백 수신 → DONE). 컨트롤러: GET /api/lean/jobs/{id}
curl https://<BE>/api/lean/jobs/<jobId> -b 'token=<JWT>'   # status: DONE + result.statistics
```
콜백이 안 오면(Pod 가 죽거나 네트워크 차단) 스케줄러가 deadline+120s 후 `ERROR` 로 백스톱 마감한다.
워커 NetworkPolicy([../01-namespace-quota.yaml](../01-namespace-quota.yaml))는 **Ingress 차단·Egress 허용**이라 BE 콜백/데이터 fetch 는 통과한다(인바운드만 막음).

---

## 결과 산출물 공유용 S3 (메모)
현재 워커 콜백([run_backtest.py](../lean-worker/run_backtest.py) `post_result`)은 **stdout STATISTICS 파싱 요약(dict)** 만 BE 로 보낸다 → BE 는 `lean_job.result_json` 에 요약만 저장. Lean 이 생성하는 **전체 리포트(equity curve·체결 로그·`*-order-events.json`·차트 등, Pod 의 `backtests/` 폴더)는 Pod 종료 시 사라진다**(`ttlSecondsAfterFinished: 600` 후 정리).

전체 산출물을 공유/보존하려면 **S3** 가 필요하다(아직 미구현 — follow-up):
1. S3 버킷 생성(예: `alphahelix-lean-results`), 라이프사이클로 N일 후 만료.
2. [eksctl-cluster.yaml](eksctl-cluster.yaml) 의 `lean-controller` SA 에 해당 버킷 `s3:PutObject` 만 IRSA 로 부여(주석 처리된 `attachPolicyARNs` 참조). 워커가 직접 올리면 워커 SA 에 부여.
3. [run_backtest.py](../lean-worker/run_backtest.py) 에서 `run_engine` 후 `backtests/` 결과를 `s3://<버킷>/<jobId>/` 로 업로드하고, 콜백 payload 에 `resultUrl`(프리사인 또는 경로)만 추가.
4. BE 가 `resultUrl` 을 저장 → FE Report 탭에서 다운로드/임베드.

현재는 요약만으로 충분하므로 S3 없이 동작한다. 전체 리포트 공유 요구가 생길 때 위 단계만 추가하면 된다.

## 비용 주의 — 워커 이미지 ~42.5GB
- `quantconnect/lean` 베이스라 이미지가 매우 크다 → **ECR 저장료 + 신규 노드마다 풀 시간/대역폭**이 비용·콜드스타트 지연의 주범.
- 완화책:
  - 노드 디스크 여유 확보됨([eksctl-cluster.yaml](eksctl-cluster.yaml) `ng-lean-worker-spot.volumeSize: 60`).
  - 스팟 NG 가 0→N 만 반복하면 매번 풀 → **`scale-down-unneeded-time` 을 너무 짧게 잡지 말 것**(콜드스타트 잦아짐). [cluster-autoscaler.md](cluster-autoscaler.md) 의 값은 절충치.
  - 이미지 슬림화 권장 — 불필요한 Lean 데이터 트리/심볼 데이터를 베이스에서 제거하거나 멀티스테이지로 런타임 의존만 남기기. 가이드: <https://docs.docker.com/build/building/best-practices/> · ECR 비용: <https://aws.amazon.com/ecr/pricing/>
- 스팟 인스턴스 + 평시 desired 0 으로 **유휴 비용은 거의 0**(컨트롤 평면 + ng-system t3.medium 2대만 상시).

## 워커 노드그룹 타게팅 (선택 — 테인트 대응)
[eksctl-cluster.yaml](eksctl-cluster.yaml) 의 `ng-lean-worker-spot` 에는 `workload=lean-worker:NoSchedule` 테인트가 있다. 백테스트 Pod 를 **반드시 이 NG 로** 보내려면 Job 템플릿에 nodeSelector + toleration 이 필요하다. 현재 [../03-lean-backtest-job.template.yaml](../03-lean-backtest-job.template.yaml) 와 [LeanJobManifestRenderer](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanJobManifestRenderer.java) `JOB_TEMPLATE` 에는 미적용이다.

적용하려면 Pod `spec` 에 추가(템플릿/렌더러 양쪽 동일하게):
```yaml
      nodeSelector:
        workload: lean-worker
      tolerations:
        - key: workload
          operator: Equal
          value: lean-worker
          effect: NoSchedule
```
미적용 시: Pod 가 테인트를 견디지 못해 워커 NG 로 못 가고 `ng-system` 에 스케줄되거나 Pending 일 수 있다.
**간단한 대안**: 테인트를 빼고 라벨(`workload=lean-worker`)만 둔 채 nodeSelector 만 추가하거나, 테인트도 빼서 일반 스케줄링에 맡기면 별도 패치 없이 동작한다(격리 강도 ↔ 단순성 트레이드오프).

---

## ④ 재배포 노트 (운영 BE 가 v2 이전이면)
Lean v2 컨트롤 플레인 엔드포인트(`POST /api/lean/backtest/submit`, `GET /api/lean/jobs`, `GET /api/lean/jobs/{id}`, `POST /api/lean/jobs/{id}/result`)는 [LeanJobController](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/controller/LeanJobController.java) 에 있다. **운영 BE 가 v2 이전 빌드면 이 경로들은 404** 다(이전엔 [LeanBacktestController](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/controller/LeanBacktestController.java) 의 프록시 엔드포인트만 존재). `main` 을 v2 포함 커밋으로 재빌드/재배포하면 v2 엔드포인트가 활성화된다.

- **docker-compose 배포**([../../DOCKER_DEPLOY.md](../../DOCKER_DEPLOY.md), `project_docker_deploy`): `backend` 서비스를 **rebuild** 하면 반영된다.
  ```bash
  docker compose build backend && docker compose up -d backend
  ```
  단, 현재 [../../../docker-compose.yml](../../../docker-compose.yml) 의 `backend` 환경블록엔 `LEAN_K8S_*` 키가 없다 → K8s 디스패치를 켜려면 위 [④ BE 환경변수](#④-be-환경변수-설정-컨트롤-플레인-켜기) 를 backend `environment:` 에 추가(`LEAN_K8S_ENABLED`·`LEAN_WORKER_IMAGE`·`LEAN_CALLBACK_BASE_URL`·`POLYGON_API_KEY`). 또한 backend 컨테이너에 **kubectl + EKS kubeconfig** 가 없으면 디스패치가 실패하므로, EKS 운영은 **BE 를 클러스터 내부에 in-cluster SA(`lean-controller`)로 배포**하는 편이 단순하다. compose 의 backend 는 포트 9091 이라 `LEAN_CALLBACK_BASE_URL` 의 포트도 9091 로 맞춘다.
- `app.lean.k8s.enabled` 기본 OFF — env 로 `true` 를 주기 전까지 스케줄러([LeanK8sSchedulerService](../../../backend/src/main/java/com/DevBridge/devbridge/domain/strategy/service/lean/LeanK8sSchedulerService.java) `tick()`)는 즉시 return 하므로 켜기 전엔 무해하다.
