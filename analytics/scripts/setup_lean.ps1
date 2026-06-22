# Lean 실행환경 준비 (Windows) — Docker 데몬 확인 + venv에 lean CLI 설치 + 이미지 풀 + 검증.
# 사용: Docker Desktop 실행 후 →  cd C:\Alpha_Helix\analytics ;  .\scripts\setup_lean.ps1
$ErrorActionPreference = "Stop"
$ROOT  = Split-Path -Parent $PSScriptRoot           # analytics/
$VENV  = Join-Path $ROOT ".venv\Scripts"
$PY    = Join-Path $VENV "python.exe"
$IMAGE = "quantconnect/lean:latest"

Write-Host "== Lean 환경 준비 ==" -ForegroundColor Cyan

# 1) Docker 데몬
Write-Host "[1/4] Docker 데몬 확인..."
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "  ✗ Docker 데몬 미실행 — Docker Desktop을 먼저 실행한 뒤 다시 실행하세요." -ForegroundColor Yellow
  exit 1
}
Write-Host "  ✓ Docker 실행 중" -ForegroundColor Green

# 2) lean CLI (analytics venv 에 설치 — executor 가 venv/Scripts 에서 탐색)
Write-Host "[2/4] lean CLI 설치(venv)..."
if (-not (Test-Path $PY)) { $PY = "python" }        # venv 없으면 시스템 python
& $PY -m pip install --quiet --upgrade lean
$leanBin = Join-Path $VENV "lean.exe"
if (-not (Test-Path $leanBin)) { $leanBin = "lean" }
& $leanBin --version
if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ lean CLI 설치/실행 실패" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ lean CLI" -ForegroundColor Green

# 3) Lean 이미지
Write-Host "[3/4] Lean 이미지 ($IMAGE, 최초 ~13GB · 수~수십 분)..."
if (docker images -q $IMAGE) {
  Write-Host "  ✓ 이미지 이미 존재" -ForegroundColor Green
} else {
  docker pull $IMAGE
  if ($LASTEXITCODE -ne 0) { Write-Host "  ✗ 이미지 풀 실패" -ForegroundColor Red; exit 1 }
  Write-Host "  ✓ 이미지 풀 완료" -ForegroundColor Green
}

# 4) 마무리 안내
Write-Host "[4/4] 환경 준비 완료." -ForegroundColor Cyan
Write-Host "  다음:" -ForegroundColor Cyan
Write-Host "   · app.lean.enabled=true  (application-local.properties)"
Write-Host "   · (선택) `$env:LEAN_NODE_SLOTS=2  또는  LEAN_NODES JSON 으로 노드/슬롯 수 조정"
Write-Host "   · analytics 재시작 → IDE LEAN ENGINE 패널의 ✗ 들이 ✓ 로 바뀌고 노드 풀/큐 표시"
