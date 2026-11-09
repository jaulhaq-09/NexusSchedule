from sqlalchemy import Column, Integer, JSON, DateTime
from sqlalchemy.sql import func
from app.database.db import Base


class MetricsSnapshot(Base):
    """
    Single-row table (id always 1) holding the last saved state of
    MetricsService, so request/error counts survive server restarts.
    """
    __tablename__ = "metrics_snapshot"

    id             = Column(Integer, primary_key=True)
    request_count  = Column(Integer, default=0)
    error_count    = Column(Integer, default=0)
    response_times = Column(JSON, default=list)
    endpoints      = Column(JSON, default=dict)
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())