from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.database.db import Base
from datetime import datetime

class AdditionalClass(Base):
    __tablename__ = 'additional_classes'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    reason = Column(String(50))  # 'failed', 'remedial', 'revision', 'makeup'
    subject_name = Column(String(100), nullable=False)
    faculty_id = Column(Integer)
    faculty_name = Column(String(100))
    room_id = Column(Integer)
    room_name = Column(String(100))
    day = Column(String(20), nullable=False)
    time = Column(String(30), nullable=False)
    duration_slots = Column(Integer, default=1)
    section_ids = Column(JSON)  # [12, 13, 14]
    cluster = Column(Integer)
    semester = Column(Integer)
    student_group_name = Column(String(100))
    failed_students_count = Column(Integer)
    source_saved_timetable_ids = Column(JSON)  # [45, 46]
    status = Column(String(20), default='scheduled')  # draft, scheduled, cancelled, completed
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'reason': self.reason,
            'subject_name': self.subject_name,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty_name,
            'room_id': self.room_id,
            'room_name': self.room_name,
            'day': self.day,
            'time': self.time,
            'duration_slots': self.duration_slots,
            'section_ids': self.section_ids,
            'cluster': self.cluster,
            'semester': self.semester,
            'student_group_name': self.student_group_name,
            'failed_students_count': self.failed_students_count,
            'source_saved_timetable_ids': self.source_saved_timetable_ids,
            'status': self.status,
            'remarks': self.remarks,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }