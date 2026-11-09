from datetime import datetime
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.utils.logger import logger
from typing import Optional, Dict, Any

class AuditService:
    """Log important actions for auditing"""
    
    @staticmethod
    def log_action(
        db: Session,
        action: str,  # GENERATE_TIMETABLE, CREATE_FACULTY, UPDATE_SECTION
        entity_type: str,  # TIMETABLE, FACULTY, SUBJECT, SECTION
        entity_id: int,
        description: str,
        data_before: Optional[Dict] = None,
        data_after: Optional[Dict] = None
    ):
        """Log an action to audit trail"""
        
        try:
            audit_entry = AuditLog(
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                data_before=data_before,
                data_after=data_after,
                timestamp=datetime.now()
            )
            
            db.add(audit_entry)
            db.commit()
            
            logger.info(
                f"📝 [AUDIT] {action} {entity_type} #{entity_id} - {description}"
            )
        
        except Exception as e:
            logger.error(f"❌ Failed to log audit entry: {str(e)}")
            db.rollback()

# Convenience functions
def log_timetable_generated(db: Session, timetable_id: int, semester: str, year: int):
    AuditService.log_action(
        db=db,
        action="GENERATE_TIMETABLE",
        entity_type="TIMETABLE",
        entity_id=timetable_id,
        description=f"Timetable generated for {semester} {year}"
    )

def log_timetable_saved(db: Session, timetable_id: int, name: str):
    AuditService.log_action(
        db=db,
        action="SAVE_TIMETABLE",
        entity_type="TIMETABLE",
        entity_id=timetable_id,
        description=f"Timetable saved as '{name}'"
    )

def log_faculty_created(db: Session, faculty_id: int, name: str):
    AuditService.log_action(
        db=db,
        action="CREATE_FACULTY",
        entity_type="FACULTY",
        entity_id=faculty_id,
        description=f"Faculty '{name}' created"
    )