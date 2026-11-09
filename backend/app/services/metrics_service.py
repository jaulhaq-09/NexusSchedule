from datetime import datetime
from typing import Dict
from app.utils.logger import logger

class MetricsService:
    """Collect and store application metrics locally"""

    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.response_times = []
        self.start_time = datetime.now()
        self.endpoints = {}  # Track per-endpoint stats

    def record_request(self, method: str, path: str):
        """Record incoming request"""
        self.request_count += 1
        if path not in self.endpoints:
            self.endpoints[path] = {"count": 0, "errors": 0}
        self.endpoints[path]["count"] += 1

    def record_response_time(self, path: str, duration: float):
        """Record response time"""
        self.response_times.append(duration)

        # Keep only last 1000 response times
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]

    def record_error(self, path: str, error: str):
        """Record error occurrence"""
        self.error_count += 1
        if path in self.endpoints:
            self.endpoints[path]["errors"] += 1
        logger.error(f"Error on {path}: {error}")

    def get_metrics(self) -> Dict:
        """Get current metrics"""
        uptime = (datetime.now() - self.start_time).total_seconds()
        avg_response_time = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times else 0
        )

        return {
            "uptime_seconds": int(uptime),
            "request_count": self.request_count,
            "error_count": self.error_count,
            "avg_response_time_ms": round(avg_response_time * 1000, 2),
            "total_responses_recorded": len(self.response_times),
            "endpoints": self.endpoints
        }

    def get_slowest_endpoints(self, limit: int = 5) -> list:
        """Get slowest endpoints"""
        endpoints_by_time = sorted(
            self.endpoints.items(),
            key=lambda x: x[1].get("avg_time", 0),
            reverse=True
        )
        return endpoints_by_time[:limit]

    # ── Persistence ──────────────────────────────────────────────
    def load_from_db(self, db):
        """Restore counters from the last saved snapshot, if any."""
        from app.models.metrics_snapshot import MetricsSnapshot
        try:
            row = db.query(MetricsSnapshot).filter(MetricsSnapshot.id == 1).first()
            if row:
                self.request_count = row.request_count or 0
                self.error_count = row.error_count or 0
                self.response_times = row.response_times or []
                self.endpoints = row.endpoints or {}
                logger.info(
                    f"[METRICS] Restored from snapshot: "
                    f"{self.request_count} requests, {self.error_count} errors"
                )
        except Exception as e:
            logger.error(f"[METRICS] Failed to load snapshot: {e}")

    def save_to_db(self, db):
        """Persist current counters as the single snapshot row."""
        from app.models.metrics_snapshot import MetricsSnapshot
        try:
            row = db.query(MetricsSnapshot).filter(MetricsSnapshot.id == 1).first()
            if not row:
                row = MetricsSnapshot(id=1)
                db.add(row)
            row.request_count = self.request_count
            row.error_count = self.error_count
            row.response_times = self.response_times[-1000:]
            row.endpoints = self.endpoints
            db.commit()
            logger.info("[METRICS] Snapshot saved")
        except Exception as e:
            logger.error(f"[METRICS] Failed to save snapshot: {e}")
            db.rollback()

# Global metrics instance
metrics_service = MetricsService()