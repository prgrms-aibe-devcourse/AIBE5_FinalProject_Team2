#!/usr/bin/env bash
# Alpha-Helix Lean v2 — 데모 프리웜 (서울 prod 서버에서 실행: ssh ubuntu@<seoul-ip>)
# 발표 ~25분 전 한 방에: EKS 클러스터 + 워커노드 3대 + kubeconfig + BE→EKS 와이어.
# 끝나면 demo-teardown.sh 로 비용 정지(클러스터 삭제 + BE 언와이어).
#
# 전제: 인스턴스에 IAM 역할(EKS/ECR/EC2/CFN/IAM, 예: alpha-eks-builder) + eksctl/kubectl/aws 설치,
#       IMDS hop-limit=2, docker-compose.override.yml 에 LEAN_K8S 블록 존재(아래 ensure 가 점검).
set -euo pipefail
CLUSTER=alphahelix-lean
REGION=ap-northeast-2
ORIGIN_IP="${ORIGIN_IP:-43.203.164.54}"           # 워커 콜백용 공개 IP(CF 우회 — CF 는 워커 NAT 를 403 차단)
ECR=685835763566.dkr.ecr.${REGION}.amazonaws.com
APPDIR="${APPDIR:-$HOME/Alpha}"
cd "$APPDIR"

echo "[1/5] EKS 클러스터 (없으면 생성, ~18분)"
if ! eksctl get cluster "$CLUSTER" --region "$REGION" >/dev/null 2>&1; then
  eksctl create cluster -f deploy/k8s/eks/eksctl-cluster.yaml
else echo "  이미 존재 — 스킵"; fi

echo "[2/5] 워커노드 3대 스케일(스팟)"
eksctl scale nodegroup --cluster "$CLUSTER" --name ng-lean-worker-spot \
  --nodes 3 --nodes-min 0 --nodes-max 10 --region "$REGION" || true

echo "[3/5] kubeconfig (컨테이너가 읽도록 644)"
aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION"
chmod 644 "$HOME/.kube/config"

echo "[4/5] BE→EKS 와이어 ON + 재기동"
# override 에 LEAN_K8S 블록이 있어야 함. callback 은 항상 오리진 IP(CF 우회)로 강제.
sed -i "s#LEAN_CALLBACK_BASE_URL: .*#LEAN_CALLBACK_BASE_URL: \"http://${ORIGIN_IP}/api/lean/jobs\"#" docker-compose.override.yml || true
sed -i 's#LEAN_K8S_ENABLED: "false"#LEAN_K8S_ENABLED: "true"#' docker-compose.override.yml || true
if ! grep -q 'LEAN_K8S_ENABLED: "true"' docker-compose.override.yml; then
  echo "  ⚠️ override 에 LEAN_K8S 블록 없음 — README/메모리 참조해 backend 섹션에 추가 필요"; fi
docker compose up -d --force-recreate backend
for i in $(seq 1 18); do [ "$(docker inspect -f '{{.State.Health.Status}}' alpha-backend-1 2>/dev/null)" = healthy ] && break; sleep 5; done

echo "[5/6] 이미지 사전 풀 DaemonSet (전 워커 노드에 14GB 미리 캐시 — 데모 첫 클릭 7분 멈춤 방지)"
# ⚠️ 핵심: 신규 노드는 첫 잡에서 lean-worker(14GB) 풀에 ~7분 걸림(실측). DaemonSet 으로 데모 전 미리 당김.
# 호스트의 manifest 를 컨테이너 안 kubectl 로 stdin 파이프(컨테이너 /app 엔 repo 파일 없음).
docker exec -i alpha-backend-1 kubectl apply -f - < deploy/k8s/eks/prepull-daemonset.yaml
echo "  전 노드 풀 완료까지 대기(~7-10분, 병렬)…"
docker exec alpha-backend-1 kubectl -n kube-system rollout status ds/lean-image-prepull --timeout=15m 2>&1 | tail -3

echo "[6/6] 검증 — BE 가 EKS 노드 보이나 + 더미 백테스트 1건(엔드투엔드 워밍)"
docker exec alpha-backend-1 kubectl get nodes 2>&1 | head -6
echo "✅ 프리웜 완료 — 전 노드 이미지 캐시됨. 데모 첫 클릭부터 ~30-45초로 빠름."
echo "   (스케일업으로 노드가 더 늘면 DaemonSet 이 자동 사전풀 → rollout status 로 재확인 가능)"
echo "   발표 후: bash deploy/k8s/eks/demo-teardown.sh  (비용 정지)"
