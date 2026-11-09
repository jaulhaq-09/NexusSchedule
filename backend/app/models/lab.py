"""
Enhanced Lab Model with Batch Support
Location: backend/app/models/lab.py
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime

from ..database.db import Base


class Lab(Base):
    __tablename__ = "labs"

    id             = Column(Integer, primary_key=True, index=True)
    lab_name       = Column(String, nullable=False)
    lab_code       = Column(String, nullable=True)
    batch          = Column(String, nullable=True)   # "A", "B", or NULL
    hours_per_week = Column(Integer, default=2)
    # ✅ Which physical room this lab is held in — links to the existing
    # Rooms table instead of storing room text on the lab itself, so it
    # stays consistent with whatever Rooms actually has.
    room_id        = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    department_id  = Column(Integer, ForeignKey("departments.id"), nullable=True)  # NULL = shared (legacy)
    # ✅ Name of another Lab row this lab is paired with (e.g. DBMS Lab-A's
    # paired_lab_name = "ADA Lab-A"). When both labs in a pair get randomly
    # assigned to the same day by the generator, they're placed into one
    # shared slot as a batch-split cell instead of two separate slots.
    paired_lab_name = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ✅ REMOVED: faculty_id, faculty_ids, and the `faculty` relationship.
    # Faculty assignment is no longer stored on Lab at all — it's derived
    # at read time by matching this lab's lab_name against every faculty's
    # comma-separated `labs` field (see lab_routes.py's _build()).

    def __repr__(self):
        return f"<Lab {self.lab_name} (Batch: {self.batch or 'All'})>"