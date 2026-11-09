from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.db import Base


class TimeSlot(Base):
    __tablename__ = "timeslots"

    id         = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, default=9, index=True)  # 🔥 NEW
    day        = Column(String, nullable=False)   # Monday, Tuesday, ...
    start_time = Column(String, nullable=False)   # e.g. "08:30"
    end_time   = Column(String, nullable=False)   # e.g. "09:25"
    slot_type  = Column(String, default="PERIOD") # PERIOD | BREAK | LUNCH