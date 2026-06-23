#!/usr/bin/env bash
# Alpha-Helix · lean-worker 이미지 → AWS ECR 빌드·태그·푸시
# ─────────────────────────────────────────────────────────────────────────────
# 워커 이미지는 deploy/k8s/lean-worker/Dockerfile (FROM quantconnect/lean) 기반이며,
# 빌드 전에 analytics/app 을 lean-worker/app 으로 복사해야 한다(Dockerfile COPY app/ 가 요구).
# 산출 이미지를 ECR 로 올린 뒤, BE 환경변수 LEAN_WORKER_IMAGE 에 ECR URI 를 지정한다.
#
# 사용:
#   AWS_REGION=ap-northeast-2 ACCOUNT_ID=123456789012 ./deploy/k8s/eks/ecr-push.sh
# 선택 변수:
#   REPO=lean-worker  TAG=latest  PLATFORM=linux/amd64
#
# 사전: aws CLI 로그인(aws configure / SSO) + docker 데몬 실행 + ECR push 권한.
set -euo pipefail

# ── 변수 ─────────────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-<AWS_REGION>}"          # 예: ap-northeast-2
ACCOUNT_ID="${ACCOUNT_ID:-<ACCOUNT_ID>}"          # 12자리 AWS 계정 ID
REPO="${REPO:-lean-worker}"                       # ECR 리포지토리 이름
TAG="${TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"               # EKS 노드는 x86_64(c6i 등) — arm 빌드 머신이면 명시 필수

if [[ "$AWS_REGION" == "<AWS_REGION>" || "$ACCOUNT_ID" == "<ACCOUNT_ID>" ]]; then
  echo "ERROR: AWS_REGION 과 ACCOUNT_ID 를 환경변수로 지정하세요." >&2
  echo "  예: AWS_REGION=ap-northeast-2 ACCOUNT_ID=123456789012 $0" >&2
  exit 1
fi

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${REPO}:${TAG}"

# 레포 루트 기준 경로(이 스크립트는 deploy/k8s/eks/ 에 있음).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
WORKER_DIR="${REPO_ROOT}/deploy/k8s/lean-worker"
ANALYTICS_APP="${REPO_ROOT}/analytics/app"

echo "==> 이미지 URI: ${IMAGE_URI}"
echo "==> 워커 컨텍스트: ${WORKER_DIR}"

# ── 1. analytics/app 동봉 (Dockerfile 의 'COPY app/ ./app/' 충족) ─────────────
if [[ ! -d "${ANALYTICS_APP}" ]]; then
  echo "ERROR: ${ANALYTICS_APP} 없음 — 레포 구조 확인 필요." >&2
  exit 1
fi
echo "==> analytics/app → lean-worker/app 복사"
rm -rf "${WORKER_DIR}/app"
cp -r "${ANALYTICS_APP}" "${WORKER_DIR}/app"

# ── 2. ECR 리포지토리 보장(없으면 생성) ──────────────────────────────────────
echo "==> ECR 리포지토리 보장: ${REPO}"
aws ecr describe-repositories --region "${AWS_REGION}" --repository-names "${REPO}" >/dev/null 2>&1 \
  || aws ecr create-repository --region "${AWS_REGION}" --repository-name "${REPO}" \
       --image-scanning-configuration scanOnPush=true >/dev/null

# ── 3. ECR 로그인 ────────────────────────────────────────────────────────────
echo "==> ECR 로그인"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}"

# ── 4. 빌드 + 태그 ───────────────────────────────────────────────────────────
# ⚠️ quantconnect/lean 베이스라 결과 이미지 ~42.5GB — 빌드/푸시 시간·대역폭 주의(README 비용 메모).
echo "==> 빌드 (platform=${PLATFORM})"
docker build --platform "${PLATFORM}" -t "${IMAGE_URI}" "${WORKER_DIR}"

# ── 5. 푸시 ──────────────────────────────────────────────────────────────────
echo "==> 푸시"
docker push "${IMAGE_URI}"

echo ""
echo "✅ 완료: ${IMAGE_URI}"
echo "   BE 환경변수에 그대로 사용:  LEAN_WORKER_IMAGE=${IMAGE_URI}"
