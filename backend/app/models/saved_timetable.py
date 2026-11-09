"""
UPGRADE #1 - FIXED SavedTimetable Model
Added missing: lab_config, pinned_slots, class_teacher
Added metadata: academic_year, semester, cluster, is_archived, version, type
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime

from sqlalchemy.sql import func

from app.database.db import Base



class SavedTimetable(Base):

    __tablename__ = "saved_timetables"



    id             = Column(Integer, primary_key=True, index=True)

    label          = Column(String,  nullable=True)

    section_id     = Column(Integer, nullable=True)

    room_id        = Column(Integer, nullable=True)

    total_students = Column(String,  nullable=True)

    wef            = Column(String,  nullable=True)
    
    class_teacher  = Column(String,  nullable=True)  # 🔥 ADDED

    department_id  = Column(Integer, nullable=True)  # 🔥 ADD THIS

    timetable_data = Column(Text,    nullable=False)

    subject_config = Column(Text,    nullable=True)
    
    # 🔥 CRITICAL: These 2 were MISSING — now ADDED
    lab_config     = Column(Text,    nullable=True)
    pinned_slots   = Column(Text,    nullable=True)

    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    
    # 🔥 OPTIONAL: Archive/Search metadata (for future upgrades)
    academic_year  = Column(String(20), nullable=True)   # e.g. "2025-26"
    semester       = Column(Integer, nullable=True)       # 1-8
    cluster        = Column(Integer, nullable=True)       # 1-4
    is_archived    = Column(Boolean, default=False)       # marks past-year
    version        = Column(Integer, default=1)           # revision tracking
    type           = Column(String, default="section", nullable=True)  # "section" or "faculty"
    faculty_name   = Column(String, nullable=True)        # For faculty timetables