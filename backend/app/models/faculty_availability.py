from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.database.db import Base


class FacultyAvailability(Base):
    __tablename__ = "faculty_availability"

    id         = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    day        = Column(String,  nullable=False)
    start_time = Column(String,  nullable=False)
    end_time   = Column(String,  nullable=False)
    available  = Column(Boolean, default=True)