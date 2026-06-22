"""Lean 파라미터 최적화 — QuantConnect optimizer 패리티 (단계 4).

파라미터 그리드를 펼쳐 각 조합을 개별 Lean 백테스트 잡으로 노드 풀([jobs.LeanCluster])에 제출한다.
→ 조합들이 노드 슬롯에 걸쳐 **분산 실행**되고(=다중 노드 활용), 완료된 자식 잡의 통계에서 metric 최댓값을 찾아 best 를 집계한다.

설계: 최적화는 "여러 백테스트 잡의 묶음 + 집계"일 뿐 — 실행은 전적으로 cluster 가 한다(단일 책임).
따라서 멀티노드/큐 정책(동시성 제한·대기)이 최적화에도 자동 적용된다.
"""

from __future__ import annotations

import itertools
import logging
import threading
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from app.lean.jobs import cluster

logger = logging.getLogger(__name__)

_MAX_COMBOS = 64       # 조합 폭발 방어(QC 노드 한도와 동일 사상)
_MAX_OPTS = 50         # 최적화 이력 상한


def expand_grid(param_grid: Dict[str, Any]) -> List[Dict[str, Any]]:
    """{key: [v1, v2, ...]} → 데카르트 곱 조합 리스트(최대 _MAX_COMBOS). 단일값은 [값]으로 취급."""
    if not param_grid:
        return [{}]
    keys = list(param_grid.keys())
    value_lists = [v if isinstance(v, list) else [v] for v in (param_grid[k] for k in keys)]
    combos: List[Dict[str, Any]] = []
    for vals in itertools.product(*value_lists):
        combos.append(dict(zip(keys, vals)))
        if len(combos) >= _MAX_COMBOS:
            logger.warning("[opt] 조합이 %d 초과 — %d 개로 절단", _MAX_COMBOS, _MAX_COMBOS)
            break
    return combos


def _metric_value(stats: Dict[str, Any], metric: str) -> Optional[float]:
    """통계 dict 에서 metric 값을 견고하게 추출(정확 키 → 공백무시 부분일치, %·콤마 제거 후 float)."""
    if not stats:
        return None
    raw = stats.get(metric)
    if raw is None:
        norm = metric.lower().replace(" ", "")
        for k, v in stats.items():
            if norm in str(k).lower().replace(" ", ""):
                raw = v
                break
    if raw is None:
        return None
    try:
        return float(str(raw).replace("%", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return None


class LeanOptimization:
    def __init__(self, opt_id: str, metric: str, combos: List[Dict[str, Any]],
                 child_ids: List[str], meta: Dict[str, Any]):
        self.opt_id = opt_id
        self.metric = metric
        self.combos = combos
        self.child_ids = child_ids
        self.meta = meta
        self.created_at = datetime.now()

    def status(self) -> Dict[str, Any]:
        children = [cluster.get(cid) for cid in self.child_ids]
        done = running = queued = errored = 0
        best: Optional[Dict[str, Any]] = None
        results: List[Dict[str, Any]] = []
        for child, combo in zip(children, self.combos):
            st = child.status if child else "missing"
            val = None
            if child and child.status == "done":
                done += 1
                val = _metric_value((child.result or {}).get("statistics", {}), self.metric)
                if val is not None and (best is None or val > best["value"]):
                    best = {"job_id": child.job_id, "params": combo, "value": val,
                            "statistics": (child.result or {}).get("statistics", {})}
            elif child and child.status == "running":
                running += 1
            elif child and child.status == "queued":
                queued += 1
            elif child and child.status == "error":
                errored += 1
            results.append({"job_id": child.job_id if child else None,
                            "params": combo, "status": st, "value": val})
        total = len(self.child_ids)
        finished = done + errored
        return {
            "opt_id": self.opt_id,
            "metric": self.metric,
            "status": "done" if finished >= total else "running",
            "total": total, "done": done, "running": running, "queued": queued, "error": errored,
            "best": best,
            "meta": self.meta,
            "created_at": self.created_at.isoformat(),
            "results": results,
        }


_OPTS: Dict[str, LeanOptimization] = {}
_OPTS_LOCK = threading.Lock()


def submit_optimization(meta: Dict[str, Any], param_grid: Dict[str, Any], metric: str,
                        run_combo: Callable[[Any, Dict[str, Any]], None]) -> LeanOptimization:
    """그리드를 펼쳐 조합마다 백테스트 잡을 노드 풀에 제출한다.
    run_combo(job, combo): 해당 조합으로 백테스트 실행 + job.finish_ok/finish_err (호출측 정의).
    """
    combos = expand_grid(param_grid)
    opt_id = uuid.uuid4().hex[:12]
    child_ids: List[str] = []
    for combo in combos:
        def _make(c: Dict[str, Any]):
            def _r(job):
                run_combo(job, c)
            return _r
        child = cluster.submit({**meta, "params": combo, "opt_id": opt_id}, _make(combo))
        child_ids.append(child.job_id)
    opt = LeanOptimization(opt_id, metric, combos, child_ids, meta)
    with _OPTS_LOCK:
        _OPTS[opt_id] = opt
        if len(_OPTS) > _MAX_OPTS:
            for k in list(_OPTS.keys())[: len(_OPTS) - _MAX_OPTS]:
                _OPTS.pop(k, None)
    logger.info("[opt] 최적화 %s 제출 — 조합 %d개", opt_id, len(child_ids))
    return opt


def get_optimization(opt_id: str) -> Optional[LeanOptimization]:
    with _OPTS_LOCK:
        return _OPTS.get(opt_id)
