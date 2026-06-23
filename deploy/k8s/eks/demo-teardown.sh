#!/usr/bin/env bash
# Alpha-Helix Lean v2 — 데모 teardown (비용 정지). 발표 후 서울 prod 서버에서 실행.
# BE 언와이어(LEAN_K8S_ENABLED=false) → EKS 클러스터 삭제. 다음 데모는 demo-prewarm.sh 로 재생성.
set -uo pipefail
CLUSTER=alphahelix-lean
REGION=ap-northeast-2
APPDIR="${APPDIR:-$HOME/Alpha}"
cd "$APPDIR"

echo "[1/2] BE 언와이어 (LEAN_K8S_ENABLED=false + 재기동)"
# EKS 가 사라지면 스케줄러가 헛디스패치(kubectl 실패)하지 않도록 실행 게이트를 끈다. codegen(코드보기)은 영향 없음.
sed -i 's#LEAN_K8S_ENABLED: "true"#LEAN_K8S_ENABLED: "false"#' docker-compose.override.yml || true
docker compose up -d --force-recreate backend
for i in $(seq 1 14); do [ "$(docker inspect -f '{{.State.Health.Status}}' alpha-backend-1 2>/dev/null)" = healthy ] && break; sleep 5; done
echo "  backend 재기동 완료(언와이어)"

echo "[2/2] EKS 클러스터 삭제 (~10분, 비용 0)"
eksctl delete cluster --name "$CLUSTER" --region "$REGION" --wait
echo "✅ teardown 완료 — EKS 비용 정지. (워커 이미지는 ECR 에 보존 → 다음 prewarm 빠름)"
echo "   다음 데모: bash deploy/k8s/eks/demo-prewarm.sh"
