"""
Institution Configuration Model
Stores the timetable structure template (not individual slots)
"""

from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.db import Base


class InstitutionConfig(Base):
    __tablename__ = "institution_config"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, index=True, unique=True)
    
    # Working Days Configuration
    working_days = Column(JSON, default=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    # Example: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    # Time Slot Template (applied to all working days)
    slot_template = Column(JSON, default=[
        {"label": "I",     "start_time": "08:30", "end_time": "09:25", "slot_type": "PERIOD"},
        {"label": "II",    "start_time": "09:25", "end_time": "10:20", "slot_type": "PERIOD"},
        {"label": "Break", "start_time": "10:20", "end_time": "10:40", "slot_type": "BREAK"},
        {"label": "III",   "start_time": "10:40", "end_time": "11:35", "slot_type": "PERIOD"},
        {"label": "IV",    "start_time": "11:35", "end_time": "12:30", "slot_type": "PERIOD"},
        {"label": "Lunch", "start_time": "12:30", "end_time": "13:25", "slot_type": "LUNCH"},
        {"label": "V",     "start_time": "13:25", "end_time": "14:20", "slot_type": "PERIOD"},
        {"label": "VI",    "start_time": "14:20", "end_time": "15:15", "slot_type": "PERIOD"},
        {"label": "VII",   "start_time": "15:15", "end_time": "16:10", "slot_type": "PERIOD"}
    ])
    # Each slot: {"label": "I", "start_time": "08:30", "end_time": "09:25", "slot_type": "PERIOD"}
    
    # Academic Settings
    semester_count = Column(Integer, default=8)
    cluster_enabled = Column(Boolean, default=True)
    cluster_count = Column(Integer, default=4)

    # 🔥 NEW: Institution branding fields
    institution_name = Column(String, default="BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT")
    institution_address = Column(String, default="AVALAHALLI, YELAHANKA, BENGALURU-560119")
    department_name = Column(String, default="DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING")
    logo_url = Column(String, nullable=True)  # Path to uploaded logo
        
    # Audit Fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<InstitutionConfig(workspace_id={self.workspace_id})>"