# K8s 클러스터 + 오토스케일 (클러스터 ops — AWS/EKS)

> 이 부분은 **AWS 계정·과금이 드는 ops** 라 레포 코드가 아니라 가이드로 제공. EKS 기준.

## 1. 클러스터
- **EKS** 클러스터 + **관리형 노드그룹**(예: c6i.xlarge 스팟+온디맨드 혼합).
- 백테스트는 CPU 집약·짧음 → 스팟 인스턴스로 비용 최소화 권장(중단돼도 Job 재생성).

## 2. Cluster Autoscaler (핵심 — 부하 흡수·비용 최소)
대기 Pod(스케줄 불가)가 생기면 노드 증설, 유휴 노드는 축소:
```bash
# EKS — Cluster Autoscaler 또는 Karpenter
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  --set autoDiscovery.clusterName=<CLUSTER> --set awsRegion=<REGION>
```
- **Karpenter**(권장): Pod 자원요청에 딱 맞는 노드를 즉시 프로비저닝(빈패킹·스팟 최적). 평소 0~소수 노드 → 백테스트 몰리면 자동 확장 → 끝나면 축소 = **평시 부하·비용 최소**.

## 3. 등급 → 자원 (LeanJob 렌더러와 일치)
`app.lean.k8s.tier.*` (BE 설정) 와 ResourceQuota 를 맞춘다:
| tier | Pod cpu/mem | 동시 Pod | timeout |
|---|---|---|---|
| STANDARD | 1 / 2Gi | 1 | 600s |
| PREMIUM | 2 / 4Gi | 2 | 1200s |
| EXPERT | 4 / 8Gi | 4 | 1800s |

## 4. 워커 이미지 레지스트리
`deploy/k8s/lean-worker/` 이미지를 빌드→ECR 푸시→`__WORKER_IMAGE__` 에 지정:
```bash
docker build -t <ECR>/lean-worker:latest deploy/k8s/lean-worker
docker push <ECR>/lean-worker:latest
```

## 5. BE 연결
- BE in-cluster 면 `lean-controller` ServiceAccount, 밖이면 kubeconfig(IRSA 권장).
- `app.lean.k8s.enabled=true` + `app.lean.k8s.worker-image=<ECR>/lean-worker:latest` + 콜백 URL(BE 내부 주소).

## 6. 로컬 개발(클러스터 없이)
- Docker Desktop → Kubernetes 활성화, 또는 `kind create cluster` / `minikube start`.
- `kubectl apply -f deploy/k8s/01..03` (토큰 치환 후) 로 단일 노드에서 멀티테넌트 동작 확인.
- 워커 이미지는 로컬 빌드 후 `kind load docker-image` / minikube image load.

## 7. 관측
- `kubectl get jobs -A -l app=lean` · `kubectl top pods -A` · K8s Dashboard / Grafana.
- BE 어드민(K5)은 lean_job + K8s Job 상태를 합쳐 전 테넌트 뷰 제공.
