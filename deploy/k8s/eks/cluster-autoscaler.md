# EKS 노드 오토스케일 — 잡 폭주 흡수 · 평시 비용 최소

> 클러스터/오토스케일 개념·등급↔자원 표·로컬(kind)은 상위 가이드 [../04-autoscaler-and-cluster.md](../04-autoscaler-and-cluster.md) 에 있다(중복 안 함). 여기선 **이 레포의 [eksctl-cluster.yaml](eksctl-cluster.yaml) 와 정확히 맞물리는 설치 절차**만 다룬다.

## 동작 원리 (이 레포 기준)
- 백테스트 1건 = K8s Job 1개 = Pod 1개([../03-lean-backtest-job.template.yaml](../03-lean-backtest-job.template.yaml)). Pod 는 등급별 `resources.requests/limits`(EXPERT=cpu 4/mem 8Gi 등)를 명시한다.
- 잡이 몰려 **스케줄 불가(Pending) Pod** 가 생기면 → Cluster Autoscaler 가 `ng-lean-worker-spot` 노드그룹(desired 0)을 0→N 으로 확장.
- 잡이 끝나 노드가 유휴가 되면 → 축소(다시 0 까지). = **평시 노드 0, 비용 0**(컨트롤 평면 제외).

## 옵션 A — Cluster Autoscaler (이 레포 기본·검증 단순)
[eksctl-cluster.yaml](eksctl-cluster.yaml) 가 이미 만들어 둔 것:
- `iam.serviceAccounts` 에 `cluster-autoscaler`(IRSA, `wellKnownPolicies.autoScaler`).
- 노드그룹 태그 `k8s.io/cluster-autoscaler/enabled` + `k8s.io/cluster-autoscaler/alphahelix-lean=owned`(autoDiscovery 키).
- 스케일-투-제로용 `node-template/label`·`node-template/taint` 태그.

설치:
```bash
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo update
helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  --namespace kube-system \
  --set autoDiscovery.clusterName=alphahelix-lean \   # <CLUSTER> = metadata.name
  --set awsRegion=<AWS_REGION> \
  --set rbac.serviceAccount.create=false \
  --set rbac.serviceAccount.name=cluster-autoscaler \  # eksctl 이 만든 IRSA SA 재사용
  --set extraArgs.scale-down-unneeded-time=2m \        # 짧은 백테스트 → 빠른 축소로 비용↓
  --set extraArgs.scale-down-delay-after-add=2m
```
확인:
```bash
kubectl -n kube-system logs deploy/cluster-autoscaler | grep -i "scale up\|scale down"
```

## 옵션 B — Karpenter (권장·빈패킹/스팟 최적)
노드그룹 단위가 아니라 **Pending Pod 자원요청에 딱 맞는 노드를 즉시 프로비저닝**. 다양한 등급(STANDARD 1/2Gi ~ EXPERT 4/8Gi)이 섞이는 우리 잡 분포에서 빈패킹이 더 촘촘해 비용 효율이 높다. 도입 시 [eksctl-cluster.yaml](eksctl-cluster.yaml) 의 `ng-lean-worker-spot` 는 제거하고(또는 min/max 0 고정) Karpenter `NodePool`/`EC2NodeClass` 로 대체한다. 설치는 상위 [../04-autoscaler-and-cluster.md](../04-autoscaler-and-cluster.md) §2 참조.

## 워커 Pod 를 워커 노드그룹으로 보내기 (테인트 대응)
`ng-lean-worker-spot` 에는 테인트 `workload=lean-worker:NoSchedule` 가 있다. 백테스트 Pod 가 이 노드에 떨어지려면 Job 템플릿에 **nodeSelector + toleration** 이 있어야 한다 — 자세한 패치 방법은 [README.md](README.md) "워커 노드그룹 타게팅" 섹션 참조(현재 [../03-lean-backtest-job.template.yaml](../03-lean-backtest-job.template.yaml) 엔 미적용).
