from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime
from app.database.db import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    action = Column(String(100), nullable=False)  # GENERATE_TIMETABLE, CREATE_FACULTY, etc
    entity_type = Column(String(100), nullable=False)  # TIMETABLE, FACULTY, SECTION, etc
    entity_id = Column(Integer)
    description = Column(Text)  # What was done
    data_before = Column(JSON)  # Optional: state before change
    data_after = Column(JSON)  # Optional: state after change
    timestamp = Column(DateTime, default=datetime.now, nullable=False)
    
    def __repr__(self):
        return f"<AuditLog {self.action} {self.entity_type} #{self.entity_id} at {self.timestamp}>"