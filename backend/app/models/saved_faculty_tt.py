# backend/app/models/saved_faculty_tt.py

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.database.db import Base  # ✅ CORRECT: app.database.db, NOT app.db

class SavedFacultyTT(Base):
    __tablename__ = "saved_faculty_tt"
    
    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, nullable=False, index=True)
    faculty_name = Column(String, nullable=False)
    academic_year = Column(String(20), index=True)
    semester = Column(Integer)
    timetable_data = Column(Text, nullable=False)
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_archived = Column(Boolean, default=False, index=True)
    version = Column(Integer, default=1)