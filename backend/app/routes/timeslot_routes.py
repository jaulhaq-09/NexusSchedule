from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.timeslot import TimeSlot
from app.schemas.timeslot_schema import TimeslotCreate
from app.models.user import User
from app.routes.auth_routes import require_admin, get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/timeslots")
def create_timeslot(data: TimeslotCreate, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    slot = TimeSlot(
        day        = data.day,
        start_time = data.start_time,
        end_time   = data.end_time,
        slot_type  = data.slot_type or "PERIOD",
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/timeslots")
def get_timeslots(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    return db.query(TimeSlot).order_by(TimeSlot.day, TimeSlot.start_time).all()


@router.put("/timeslots/{id}")
def update_timeslot(id: int, data: TimeslotCreate, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    slot = db.query(TimeSlot).filter(TimeSlot.id == id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Timeslot not found")
    slot.day        = data.day
    slot.start_time = data.start_time
    slot.end_time   = data.end_time
    slot.slot_type  = data.slot_type or "PERIOD"
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/timeslots/{id}")
def delete_timeslot(id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    slot = db.query(TimeSlot).filter(TimeSlot.id == id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Timeslot not found")
    db.delete(slot)
    db.commit()
    return {"message": "Timeslot deleted"}


@router.post("/timeslots/seed")
def seed_default_timeslots(db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    """Create the standard 9 slots (7 periods + 2 breaks) for all 5 days."""
    DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    SLOTS = [
        ("08:30", "09:25", "PERIOD"),
        ("09:25", "10:20", "PERIOD"),
        ("10:20", "10:40", "BREAK"),
        ("10:40", "11:35", "PERIOD"),
        ("11:35", "12:30", "PERIOD"),
        ("12:30", "13:25", "LUNCH"),
        ("13:25", "14:20", "PERIOD"),
        ("14:20", "15:15", "PERIOD"),
        ("15:15", "16:10", "PERIOD"),
    ]
    # Clear existing
    db.query(TimeSlot).delete()
    count = 0
    for day in DAYS:
        for start, end, stype in SLOTS:
            db.add(TimeSlot(day=day, start_time=start, end_time=end, slot_type=stype))
            count += 1
    db.commit()
    return {"message": f"Seeded {count} timeslots"}