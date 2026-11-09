from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.faculty_availability import FacultyAvailability
from pydantic import BaseModel
from typing import List, Optional
from app.routes.auth_routes import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AvailabilitySlot(BaseModel):
    day:        str
    start_time: str
    end_time:   str
    available:  bool = True


class AvailabilityCreate(BaseModel):
    slots: List[AvailabilitySlot]


@router.get("/faculty/{faculty_id}/availability")
def get_availability(faculty_id: int, db: Session = Depends(get_db)):
    rows = db.query(FacultyAvailability).filter(
        FacultyAvailability.faculty_id == faculty_id
    ).all()
    return rows


@router.post("/faculty/{faculty_id}/availability")
def set_availability(
    faculty_id: int,
    data: AvailabilityCreate,
    db: Session = Depends(get_db)
):
    # Delete existing availability for this faculty
    db.query(FacultyAvailability).filter(
        FacultyAvailability.faculty_id == faculty_id
    ).delete()

    # Insert new slots
    for slot in data.slots:
        row = FacultyAvailability(
            faculty_id = faculty_id,
            day        = slot.day,
            start_time = slot.start_time,
            end_time   = slot.end_time,
            available  = slot.available,
        )
        db.add(row)

    db.commit()
    return {"message": "Availability updated", "slots": len(data.slots)}


@router.delete("/faculty/{faculty_id}/availability")
def delete_availability(faculty_id: int, db: Session = Depends(get_db)):
    db.query(FacultyAvailability).filter(
        FacultyAvailability.faculty_id == faculty_id
    ).delete()
    db.commit()
    return {"message": "Availability cleared"}