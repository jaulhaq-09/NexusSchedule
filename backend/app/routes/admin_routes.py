from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database.db import SessionLocal
from app.models.faculty import Faculty
from app.models.room import Room
from app.models.section import Section
from app.models.subject import Subject
from app.models.timeslot import TimeSlot
from app.models.user import User
from app.models.audit_log import AuditLog
from app.routes.auth_routes import require_admin, get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.delete("/clear-all")
def clear_all(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Delete all data from all tables — use with caution."""
    db.query(TimeSlot).delete()
    db.query(Faculty).delete()
    db.query(Room).delete()
    db.query(Section).delete()
    db.query(Subject).delete()
    db.commit()
    return {"message": "All data cleared successfully"}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Return counts of all entities for dashboard."""
    return {
        "faculty":   db.query(Faculty).count(),
        "rooms":     db.query(Room).count(),
        "sections":  db.query(Section).count(),
        "subjects":  db.query(Subject).count(),
        "timeslots": db.query(TimeSlot).count(),
        "users":     db.query(User).count(),
    }


@router.get("/audit-logs")
def get_audit_logs(limit: Optional[int] = 10, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Return the most recent audit log entries, newest first."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]