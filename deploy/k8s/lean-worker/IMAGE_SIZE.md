# lean-worker 이미지 크기 — 진단 & 슬림화 계획

## 현황 (2026-06-18)
`lean-worker:latest` = **약 42.5GB**.

## 진단 — 비대 원인은 우리 코드가 아니다
`docker history lean-worker:latest` 분석:

| 레이어(출처) | 크기 |
|---|---|
| `pip install cython pandas scipy ...`(ML 스택) — **upstream `quantconnect/lean`** | **20.9GB** |
| `pip install cupy-cuda12x mamba iisignature ...` — upstream | 1.18GB |
| `conda install cuda-compiler` — upstream | 1.0GB |
| apt(wget/curl/git/xvfb/...) · miniconda · dotnet-sdk — upstream | 각 0.6~1.0GB |
| **우리 레이어**(`COPY app/` + `pip install yfinance`) | **~2.9MB + 수십MB** |

→ **42.5GB의 99.9%는 베이스 `quantconnect/lean`(전체 CUDA/conda 리서치 스택).** 우리가 얹은 건 ~3MB.

⚠️ **파생 이미지에서 `conda remove`/`rm` 으로 지워도 총량은 안 줄어든다** — 레이어는 가산이라 베이스 레이어가 그대로 남고 삭제 레이어만 추가된다.

## ✅ 슬림화 실제 완료 — 42.5GB → **11.5GB** (-73%)
`Dockerfile.slim` + `build-slim.sh`(export/import flatten)로 불필요 스택 제거 후 공간 회수. 2단계로 진행:
- **1차(2026-06-18, 13.4GB)**: GPU/DL — nvidia(4.3G)·tensorrt(3.9G)·tensorflow(1.8G)·torch(1.7G)·cupy/cuda/jax/triton/mamba커널·h2o/ray/catboost/PyQt6/httpstan/kaleido·conda pkgs 캐시(1.8G) + 잔여 cuda `.pth`.
- **2차 추가(2026-06-19, 11.5GB)**: 리서치/NLP/비전/양자/시각화/주피터 — spacy·transformers·gensim·cv2·opencv·dwave·dimod·onnx·panel·plotly·bokeh·holoviews·notebook·jupyter·interpret·ortools·clang·mlflow (miniconda 5.9G→4.6G).
- 유지: dotnet 런타임·miniconda 기본 python·**pandas/numpy/scipy·sklearn·xgboost·pyarrow·polars**·Lean 엔진(/Lean)·우리 app.
- **검증(양 단계 모두)**: 슬림 이미지로 `sma_crossover SPY 2023` 백테스트 → **15체결·Net +11.41%·Sharpe 0.401·데이터 5/5**(원본과 동일, ModuleNotFound/ImportError 0) = Lean 동작 무손상.
- **`.dockerignore`** — 빌드 컨텍스트(app/) 위생.

> ⚠️ `rm` 만으론 레이어 가산이라 안 줄어든다 → `build-slim.sh` 가 `docker export | docker import` 로 flatten(단일 레이어 재구성)해 실제 공간을 회수하고 ENV(PATH·PYTHONNET_PYDLL 등)를 재적용한다.
> 11.5GB 면 `kind load docker-image lean-worker:slim` 가능(42.5GB 는 비현실) → 로컬에서도 멀티테넌트 Pod 실제 실행 검증 완료(Wave 5).

## (추가 슬림 여지 — 선택 follow-up)
- dotnet SDK→runtime, 잔여 미사용 libs 제거로 더 줄일 수 있으나 런처 native 의존 반복 검증 필요(현 11.5GB 가 kind-load·검증된 실용본).

## 진짜 슬림화 옵션 (follow-up — 큰 작업, 빌드머신 필요)
백테스트 워커는 **`dotnet QuantConnect.Lean.Launcher` + Python 알고(pandas/numpy/yfinance)** 만 쓰고 **cupy/cuda/mamba/conda-research 는 안 쓴다.** 따라서:

1. **멀티스테이지(권장)** — 슬림 베이스(`debian-slim` + dotnet-runtime + python3 + pandas/numpy)에서 시작해 `COPY --from=quantconnect/lean /Lean /Lean` 으로 엔진/데이터만 가져온다. 런처가 요구하는 시스템 라이브러리(libxrender1·libxtst6·libxi6·zlib 등)는 apt 로 최소 설치. **예상 1~3GB대**(CUDA/conda 제거분 ~24GB↓). ⚠️ 런처가 dlopen 하는 native 의존을 한 번에 못 맞추면 반복 빌드 필요(매 빌드가 베이스 40GB 처리 → beefy 빌드머신·디스크 필요).
2. **upstream 슬림 태그 확인** — `quantconnect/lean` 의 GPU/research 미포함 변형(있으면)으로 베이스 교체.
3. **운영 완화책**(슬림 전까지): ECR 1회 푸시 후 노드가 캐시 → 풀 비용 1회성. EKS 워커 노드 디스크 ≥60Gi, **scale-to-zero**(잡 없을 때 노드 0). `deploy/k8s/eks/` 참고.

## 영향
- EKS ECR: 42.5GB 푸시/풀 = 비용·시간↑(슬림화 시 대폭↓).
- 로컬 kind: `kind load docker-image`(42.5GB)는 비현실 → 멀티테넌트 오케스트레이션은 kind 로, 워커 실행은 `docker run` 으로 분리 검증함(`docs/QUANT_IDE_MVP_FLOWS.md` Wave 4).

*추적: 이슈 #195 "워커 이미지 슬림화".*
