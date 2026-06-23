# deploy/k8s — Lean v2 멀티테넌트 (Kubernetes)

> 설계: [docs/LEAN_K8S_V2.md](../../docs/LEAN_K8S_V2.md) · 클러스터/오토스케일 ops: [04-autoscaler-and-cluster.md](04-autoscaler-and-cluster.md)

## 구성
| 파일 | 무엇 |
|---|---|
| `01-namespace-quota.yaml` | 테넌트 네임스페이스 + 등급별 ResourceQuota + NetworkPolicy(격리) |
| `02-rbac.yaml` | BE 컨트롤러 ServiceAccount/ClusterRole(Job·ns 관리) + 워커 콜백 토큰 Secret |
| `03-lean-backtest-job.template.yaml` | 백테스트 1건 = Job(자원 limits·timeout·env). BE 가 토큰 치환해 생성 |
| `lean-worker/` | 워커 컨테이너(Pod 가 백테스트 1회 실행 → BE 콜백 → 종료) |
| `04-autoscaler-and-cluster.md` | EKS·Cluster Autoscaler/Karpenter·로컬(kind) 가이드 |

토큰(`__...__`)은 BE `LeanJobManifestRenderer` 또는 `envsubst` 가 치환한다.

## 빠른 로컬 시험 (클러스터 없이)
```bash
# 1) 로컬 단일노드 K8s: Docker Desktop K8s 켜기 / 또는
kind create cluster
# 2) 워커 이미지 빌드 + 로드
docker build -t lean-worker:latest deploy/k8s/lean-worker
kind load docker-image lean-worker:latest
# 3) 토큰 치환 후 apply (예: 테넌트 42·EXPERT)
sed -e 's/__TENANT_ID__/42/g' -e 's/__TIER__/EXPERT/g' -e 's/__MAX_PODS__/4/g' \
    -e 's/__QUOTA_CPU__/16/g' -e 's/__QUOTA_MEM__/32Gi/g' \
    deploy/k8s/01-namespace-quota.yaml | kubectl apply -f -
# 4) 백테스트 Job 도 동일하게 치환 후 apply → kubectl get jobs -A -l app=lean
```

## 운영(EKS) 전환
[04-autoscaler-and-cluster.md](04-autoscaler-and-cluster.md) 참조 — EKS + Karpenter(노드 자동 프로비저닝) + ECR(워커 이미지) + BE `app.lean.k8s.enabled=true`.

## 상태
- ✅ 매니페스트·워커 이미지·BE 렌더러 = 배포 준비.
- ⬜ BE K8s 디스패처(`kubectl/fabric8 apply`+watch, K3) · 클러스터 provisioning(K4, AWS ops) · 어드민 콘솔(K5).
