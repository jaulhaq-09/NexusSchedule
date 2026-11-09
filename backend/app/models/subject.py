from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database.db import Base


class Subject(Base):
    __tablename__ = "subjects"

    id             = Column(Integer, primary_key=True, index=True)
    subject_name   = Column(String, nullable=False)
    subject_code   = Column(String, unique=True, nullable=False)
    hours_per_week = Column(Integer, default=4)
    subject_type   = Column(String, default="THEORY")  # THEORY | LAB
    course_category = Column(String, nullable=True)  # ASC, IPCC, PCC, PCCL, HSMC, AEC, PW, SL, NCMC
    
    # 🔥 UPGRADE #2: Add department foreign key
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # 🔥 UPGRADE #2: Add semester (which semester this subject is offered)
    semester      = Column(Integer, nullable=True)  # 1-8
    
    # 🔥 UPGRADE #2: Add relationship (optional, for eager loading)
    # department = relationship("Department", foreign_keys=[department_id])
     # 🔥 AI Integration columns
    is_core                  = Column(Boolean, default=False)
    coordinator_faculty_id   = Column(Integer, ForeignKey("faculty.id"), nullable=True)
    coordinator_assigned_at  = Column(DateTime(timezone=True), nullable=True)
    ai_suggestions_cache = Column(String, nullable=True)  # JSON string of suggestions