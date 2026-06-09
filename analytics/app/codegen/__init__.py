"""
Alpha-Helix 포트폴리오 전략 codegen (북극성).

워크스페이스 config → **독립 실행 가능한 파이썬 전략 코드** 생성.
설계 원칙: 라이브 엔진(app/backtest/infinite_buying.py · value_rebalancing.py)을 단일 진실원천(SSOT)으로
삼아 그 매매 로직을 1:1 미러링한 코드를 emit한다. 따라서 '생성코드 실행 결과 == 엔진 결과'가
정의상 성립하며, tests/test_codegen_engine_parity.py 가 이를 회귀 가드로 강제한다.

기존 Lean codegen(app/lean/kis_backtest/codegen)은 조건 신호형(all-in/all-out)이라 IB/VR의
포지션 스케일링(분할매수·밴드 리밸런싱)을 표현할 수 없어 별도 모듈로 분리했다.
"""
from app.codegen.portfolio_codegen import (
    generate_portfolio_strategy,
    PORTFOLIO_STRATEGIES,
)

__all__ = ["generate_portfolio_strategy", "PORTFOLIO_STRATEGIES"]
