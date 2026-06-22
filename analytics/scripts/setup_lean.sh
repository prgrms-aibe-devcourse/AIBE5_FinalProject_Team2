#!/usr/bin/env bash
# Lean 실행환경 준비 (Linux/EC2) — Docker 데몬 확인 + venv에 lean CLI 설치 + 이미지 풀 + 검증.
# 사용: Docker 실행 후 →  cd /opt/who-a/analytics ;  bash scripts/setup_lean.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"     # analytics/
VENV="$ROOT/.venv"
PY="$VENV/bin/python"; [ -x "$PY" ] || PY="python3"
LEANBIN="$VENV/bin/lean"; [ -x "$LEANBIN" ] || LEANBIN="lean"
IMAGE="quantconnect/lean:latest"

echo "== Lean 환경 준비 =="

echo "[1/4] Docker 데몬 확인..."
if ! docker info >/dev/null 2>&1; then
  echo "  ✗ Docker 데몬 미실행 — Docker를 먼저 실행한 뒤 다시 실행하세요."; exit 1
fi
echo "  ✓ Docker 실행 중"

echo "[2/4] lean CLI 설치(venv — executor 가 venv/bin 에서 탐색)..."
"$PY" -m pip install --quiet --upgrade lean
"$LEANBIN" --version || { echo "  ✗ lean CLI 설치/실행 실패"; exit 1; }
echo "  ✓ lean CLI"

echo "[3/4] Lean 이미지 ($IMAGE, 최초 ~13GB · 수~수십 분)..."
if [ -n "$(docker images -q "$IMAGE")" ]; then
  echo "  ✓ 이미지 이미 존재"
else
  docker pull "$IMAGE"
  echo "  ✓ 이미지 풀 완료"
fi

echo "[4/4] 환경 준비 완료."
echo "  다음:"
echo "   · app.lean.enabled=true (application-prod/local.properties 또는 env)"
echo "   · (선택) LEAN_NODE_SLOTS=2  또는  LEAN_NODES JSON 으로 노드/슬롯 수 조정"
echo "   · analytics 재시작 → IDE LEAN ENGINE 패널의 ✗ 들이 ✓ 로, 노드 풀/큐 표시"
