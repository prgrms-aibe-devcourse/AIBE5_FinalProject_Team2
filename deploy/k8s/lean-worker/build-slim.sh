#!/usr/bin/env bash
# 슬림 워커 이미지 빌드 — GPU/DL/research 스택 제거 후 export/import flatten 으로 실제 공간 회수.
# 검증 결과: lean-worker:latest 42.5GB → lean-worker:slim 13.4GB (-69%), 백테스트 동일 동작.
#
# 전제: lean-worker:latest 가 이미 빌드돼 있어야 함(analytics/app 동봉). 아래 순서로:
#   1) rm 레이어 추가 빌드(Dockerfile.slim)  2) container export → import 로 flatten + ENV 재적용
#   3) (선택) docker rmi lean-worker:rm  4) kind 사용 시: kind load docker-image lean-worker:slim
set -e
WD="$(cd "$(dirname "$0")" && pwd)"
SRC="${SRC_IMAGE:-lean-worker:latest}"
OUT="${OUT_IMAGE:-lean-worker:slim}"

echo "[1/3] rm 레이어 빌드 ($SRC 기반)"
docker build -f "$WD/Dockerfile.slim" -t lean-worker:rm "$WD"

echo "[2/3] flatten (export → import + ENV 재적용)"
docker rm -f leanworker_slimtmp 2>/dev/null || true
docker create --name leanworker_slimtmp lean-worker:rm >/dev/null
# 베이스(quantconnect/lean) ENV 중 런타임 필수만 재적용 — PATH·PYTHONNET_PYDLL 가 핵심.
docker export leanworker_slimtmp | docker import \
  --change 'WORKDIR /opt/lean-worker' \
  --change 'ENTRYPOINT ["python3","run_backtest.py"]' \
  --change 'ENV PATH=/opt/miniconda3/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' \
  --change 'ENV LANG=en_US.UTF-8' \
  --change 'ENV LC_ALL=en_US.UTF-8' \
  --change 'ENV LANGUAGE=en_US:en' \
  --change 'ENV PYTHONNET_PYDLL=/opt/miniconda3/lib/libpython3.11.so' \
  --change 'ENV MKL_THREADING_LAYER=GNU' \
  --change 'ENV PYTHONPATH=/opt/lean-worker' \
  --change 'ENV PIP_DEFAULT_TIMEOUT=120' \
  - "$OUT"
docker rm -f leanworker_slimtmp >/dev/null

echo "[3/3] 결과"
docker images lean-worker --format '  {{.Repository}}:{{.Tag}}  {{.Size}}'
echo "검증:  docker run --rm -e POLYGON_API_KEY=... -e STRATEGY_ID=sma_crossover -e SYMBOLS='[\"SPY\"]' \\"
echo "         -e START_DATE=2023-01-01 -e END_DATE=2024-01-01 -e MARKET=us $OUT"
echo "kind:   kind load docker-image $OUT --name alpha   (13.4GB 라 가능; 42.5GB 원본은 비현실)"
