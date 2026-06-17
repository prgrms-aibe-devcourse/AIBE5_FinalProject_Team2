"""Lean 백테스트 노드 풀 + 잡 큐 (QuantConnect식 다중 노드 관리의 토대).

QC 패리티 설계: "노드"를 추상화한다. 노드 = {id, name, tier, slots, kind} + 런타임 active.
- 지금은 한 호스트의 N 동시 슬롯(kind=local) — 인프라 추가 0.
- 나중에 원격 워커가 같은 인터페이스로 등록하면 다중 호스트로 확장(단계 2).

기존 무제한 daemon 스레드(요청당 1 컨테이너 즉시 실행) → 유한 슬롯 큐로 대체:
- 총 슬롯 수만큼 워커 스레드가 큐에서 잡을 꺼내 노드에 배정·실행·반납.
- 슬롯이 다 차면 잡은 큐에서 대기(QC 노드 부족 시 큐와 동일) → 컨테이너 폭주 방지.

/lean/backtest/start 가 cluster.submit() 으로 잡을 큐잉하고, /status 가 since 커서로 증분 폴링한다.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading
import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

_MAX_LOGS = 2000      # 잡당 로그 상한 (lean stdout 폭주 방어)
_MAX_JOBS = 200       # 이력 보존 상한 — 초과 시 완료/에러 잡부터 정리(QC식 과거 백테스트 조회)


# ───────────────────────── 노드 ─────────────────────────

@dataclass
class LeanNode:
    """백테스트 컴퓨트 노드 — QC 의 backtesting node 에 대응. slots=동시 실행 용량."""
    id: str
    name: str
    tier: str = "local"      # 라벨: "local" | "B-MICRO" 등 (자원 등급 표기용)
    slots: int = 1           # 동시 실행 슬롯 수(용량)
    kind: str = "local"      # local | remote(단계 2)
    active: int = 0          # 현재 실행 중 잡 수(런타임)


def _default_nodes() -> List[LeanNode]:
    """env LEAN_NODES(JSON) 우선, 없으면 LEAN_NODE_SLOTS 로 단일 로컬 노드 구성."""
    raw = os.getenv("LEAN_NODES", "").strip()
    if raw:
        try:
            specs = json.loads(raw)
            nodes = [LeanNode(id=str(s["id"]), name=str(s.get("name", s["id"])),
                              tier=str(s.get("tier", "local")), slots=int(s.get("slots", 1)),
                              kind=str(s.get("kind", "local"))) for s in specs]
            if nodes:
                return nodes
        except Exception as e:  # noqa: BLE001
            logger.warning("LEAN_NODES 파싱 실패(%s) — 기본 노드 사용", e)
    try:
        cpu = os.cpu_count() or 2
        default_slots = int(os.getenv("LEAN_NODE_SLOTS", str(max(1, min(2, cpu // 2)))))
    except Exception:  # noqa: BLE001
        default_slots = 1
    return [LeanNode(id="local-1", name="Local Node 1", tier="local", slots=max(1, default_slots))]


# ───────────────────────── 잡 ─────────────────────────

class LeanJob:
    def __init__(self, job_id: str, meta: Optional[Dict[str, Any]] = None):
        self.job_id = job_id
        self.status = "queued"           # queued | running | done | error
        self.phase = "대기열"
        self.logs: List[Dict[str, str]] = []
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.meta: Dict[str, Any] = meta or {}   # {strategy_id, symbols, market, ...} 표시용
        self.node_id: Optional[str] = None
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None
        self.run_with_job: Optional[Callable[["LeanJob"], None]] = None   # 워커가 호출(백테스트+완료)
        self._lock = threading.Lock()

    def log(self, level: str, msg: str) -> None:
        with self._lock:
            if len(self.logs) < _MAX_LOGS:
                self.logs.append({"type": level, "msg": str(msg)})

    def set_phase(self, msg: str) -> None:
        with self._lock:
            self.phase = str(msg)
        self.log("phase", msg)

    def finish_ok(self, result: Dict[str, Any]) -> None:
        with self._lock:
            self.result = result
            self.status = "done"

    def finish_err(self, error: str) -> None:
        with self._lock:
            self.error = str(error)
            self.status = "error"

    def _elapsed(self) -> Optional[float]:
        if self.started_at is None:
            return None
        end = self.finished_at or datetime.now()
        return round((end - self.started_at).total_seconds(), 1)

    def summary(self) -> Dict[str, Any]:
        """큐/이력 목록용 경량 표현(로그 제외)."""
        with self._lock:
            return {
                "job_id": self.job_id,
                "status": self.status,
                "phase": self.phase,
                "node_id": self.node_id,
                "meta": self.meta,
                "created_at": self.created_at.isoformat(),
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "finished_at": self.finished_at.isoformat() if self.finished_at else None,
                "elapsed_seconds": self._elapsed(),
                "error": self.error,
            }

    def snapshot(self, since: int = 0) -> Dict[str, Any]:
        with self._lock:
            since = max(0, min(since, len(self.logs)))
            return {
                "job_id": self.job_id,
                "status": self.status,
                "phase": self.phase,
                "node_id": self.node_id,
                "meta": self.meta,
                "queue_position": _cluster.queue_position(self.job_id) if self.status == "queued" else 0,
                "created_at": self.created_at.isoformat(),
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "finished_at": self.finished_at.isoformat() if self.finished_at else None,
                "elapsed_seconds": self._elapsed(),
                "logs": self.logs[since:],
                "next": len(self.logs),
                "result": self.result,
                "error": self.error,
            }


# ───────────────────────── 클러스터(노드 풀 + 큐 + 디스패처) ─────────────────────────

class LeanCluster:
    def __init__(self) -> None:
        self.nodes: Dict[str, LeanNode] = {}
        self._queue: "queue.Queue[str]" = queue.Queue()
        self._jobs: Dict[str, LeanJob] = {}
        self._order: List[str] = []          # 제출 순서(이력·큐순번·정리용)
        self._lock = threading.Lock()
        self._started = False

    def configure(self, nodes: List[LeanNode]) -> None:
        with self._lock:
            for n in nodes:
                self.nodes[n.id] = n

    def start(self) -> None:
        """노드별 slots 수만큼 워커 스레드 기동(멱등)."""
        with self._lock:
            if self._started:
                return
            self._started = True
            node_list = list(self.nodes.values())
        for node in node_list:
            for i in range(max(1, node.slots)):
                threading.Thread(target=self._worker, args=(node,),
                                 name=f"lean-{node.id}-{i}", daemon=True).start()
        total = sum(max(1, n.slots) for n in node_list)
        logger.info("[LeanCluster] 시작 — 노드 %d개, 총 슬롯 %d", len(node_list), total)

    def submit(self, meta: Dict[str, Any], run_with_job: Callable[[LeanJob], None]) -> LeanJob:
        """잡 큐잉. 빈 슬롯이 있으면 워커가 즉시 집어 실행, 없으면 큐 대기."""
        job = LeanJob(uuid.uuid4().hex[:12], meta=meta)
        job.run_with_job = run_with_job
        with self._lock:
            self._jobs[job.job_id] = job
            self._order.append(job.job_id)
            self._purge_locked()
        self._queue.put(job.job_id)
        return job

    def get(self, job_id: str) -> Optional[LeanJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def queue_position(self, job_id: str) -> int:
        """대기(queued) 잡들 중 1-based 순번. 실행/완료면 0."""
        with self._lock:
            pending = [j for j in self._order
                       if self._jobs.get(j) is not None and self._jobs[j].status == "queued"]
        try:
            return pending.index(job_id) + 1
        except ValueError:
            return 0

    def _worker(self, node: LeanNode) -> None:
        while True:
            job_id = self._queue.get()
            try:
                job = self.get(job_id)
                if job is None or job.run_with_job is None:
                    continue
                with job._lock:
                    job.node_id = node.id
                    job.status = "running"
                    job.started_at = datetime.now()
                with self._lock:
                    node.active += 1
                job.set_phase(f"실행 시작 · node={node.name}")
                try:
                    job.run_with_job(job)        # 백테스트 실행 + finish_ok/finish_err
                except Exception as e:           # noqa: BLE001
                    logger.exception("[LeanCluster] 잡 실행 예외 job=%s", job_id)
                    job.finish_err(str(e))
                finally:
                    with self._lock:
                        node.active = max(0, node.active - 1)
                    with job._lock:
                        job.finished_at = datetime.now()
            finally:
                self._queue.task_done()

    def snapshot_nodes(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [{
                "id": n.id, "name": n.name, "tier": n.tier, "kind": n.kind,
                "slots": n.slots, "active": n.active, "idle": max(0, n.slots - n.active),
            } for n in self.nodes.values()]

    def snapshot_queue(self, limit: int = 50) -> Dict[str, Any]:
        with self._lock:
            ids = list(reversed(self._order))[:limit]    # 최신순
            jobs = [self._jobs[i] for i in ids if i in self._jobs]
            running = sum(1 for j in self._jobs.values() if j.status == "running")
            queued = sum(1 for j in self._jobs.values() if j.status == "queued")
            total_slots = sum(max(1, n.slots) for n in self.nodes.values())
        return {
            "running": running,
            "queued": queued,
            "total_slots": total_slots,
            "jobs": [j.summary() for j in jobs],
        }

    def _purge_locked(self) -> None:
        if len(self._jobs) <= _MAX_JOBS:
            return
        done = [j for j in self._order
                if self._jobs.get(j) is not None and self._jobs[j].status in ("done", "error")]
        for k in done[: max(1, len(self._jobs) - _MAX_JOBS)]:
            self._jobs.pop(k, None)
            try:
                self._order.remove(k)
            except ValueError:
                pass


# 모듈 싱글톤
_cluster = LeanCluster()


def init_cluster() -> None:
    """lifespan 에서 1회 호출 — 노드 구성 + 워커 기동."""
    if not _cluster.nodes:
        _cluster.configure(_default_nodes())
    _cluster.start()


# 외부에서 쓰는 핸들
cluster = _cluster


# ───── 하위호환 헬퍼 (기존 main.py import 유지) ─────

def get_job(job_id: str) -> Optional[LeanJob]:
    return _cluster.get(job_id)
