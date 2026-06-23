-- V31: lean_job 에 워커 실행 job_id 추가 — BE 스케줄러가 워커(analytics)에 배정 후 상태 폴링/결과 회수.
ALTER TABLE lean_job ADD COLUMN worker_job_id VARCHAR(64) NULL AFTER worker_id;
