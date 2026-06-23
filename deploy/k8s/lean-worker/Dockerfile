# Lean 워커 이미지 — K8s Job 의 Pod(=docker run) 가 실행. 백테스트 1건 → BE 콜백 → 종료.
#
# ⚠️ DinD 회피: 이 이미지가 곧 Lean 엔진(quantconnect/lean)이므로 Pod 안에서 launcher 를 *직접* 구동.
#    (lean CLI 의 "또 컨테이너 띄우기" 안 씀.) run_backtest.py 가 dotnet launcher --config 실행.
#
# 빌드: deploy/k8s/lean-worker/ 에 analytics/app 를 ./app 로 복사한 뒤
#   docker build -t lean-worker:latest deploy/k8s/lean-worker
FROM quantconnect/lean:latest

WORKDIR /opt/lean-worker
ENV PYTHONPATH=/opt/lean-worker

# 데이터 fetch(yfinance)만 추가 — pandas/numpy 는 Lean 이미지에 이미 있어 재설치/충돌 회피.
COPY requirements-worker.txt .
RUN pip install --no-cache-dir -r requirements-worker.txt

# analytics/app 동봉 — app.lean.kis_backtest(codegen/data/project) + app.data.yf_client 재사용.
COPY app/ ./app/
COPY run_backtest.py .

ENTRYPOINT ["python3", "run_backtest.py"]
