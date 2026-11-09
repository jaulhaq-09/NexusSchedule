"""
Department/Branch Model
Represents different departments in the institution (CSE, ECE, MECH, etc.)
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.db import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, default=9, index=True)
    
    # Department Details
    name = Column(String(200), nullable=False)  # "Computer Science & Engineering"
    code = Column(String(50), nullable=False, unique=True, index=True)  # "CSE"
    short_name = Column(String(100), nullable=True)  # "CS&E"
    
    # Department Head
    hod_name = Column(String(200), nullable=True)
    hod_email = Column(String(200), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Department(code='{self.code}', name='{self.name}')>"