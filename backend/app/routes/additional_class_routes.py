from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from app.database.db import get_db
from app.models.additional_class import AdditionalClass
from app.models.user import User
from app.routes.auth_routes import require_admin, get_current_user

router = APIRouter(prefix="/api/additional-classes", tags=["additional_classes"], dependencies=[Depends(get_current_user)])

# Pydantic models
class AdditionalClassCreate(BaseModel):
    title: str
    reason: str
    subject_name: str
    faculty_id: int
    faculty_name: str
    room_id: int
    room_name: str
    day: str
    time: str
    duration_slots: int
    section_ids: List[int]
    student_group_name: Optional[str] = ""
    failed_students_count: Optional[int] = 0
    remarks: Optional[str] = ""
    status: Optional[str] = "scheduled"

class AdditionalClassUpdate(BaseModel):
    title: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class AvailabilityCheck(BaseModel):
    section_ids: List[int]
    faculty_name: str
    room_id: int
    duration: int

class StatusUpdate(BaseModel):
    status: str

def check_slot_availability(db: Session, section_ids: List[int], faculty_name: str, 
                            room_id: int, day: str, time: str, duration: int) -> Dict:
    """Check if a time slot is available"""
    reasons = []
    
    # Define breaks and lunch times
    breaks = {
        "10:20 - 10:40": "break",
        "12:30 - 01:25": "lunch"
    }
    
    if time in breaks:
        reasons.append("break_lunch")
        return {"available": False, "reasons": reasons}
    
    # Check existing additional classes
    existing = db.query(AdditionalClass).filter(
        AdditionalClass.day == day,
        AdditionalClass.time == time,
        AdditionalClass.status != "cancelled"
    ).all()
    
    for ac in existing:
        # Check section conflict
        if ac.section_ids and any(sid in ac.section_ids for sid in section_ids):
            reasons.append(f"section_{ac.section_ids[0]}_busy")
        
        # Check faculty conflict
        if ac.faculty_name == faculty_name:
            reasons.append("teacher_busy")
        
        # Check room conflict
        if ac.room_id == room_id:
            reasons.append("room_busy")
    
    available = len(reasons) == 0
    return {"available": available, "reasons": reasons}

@router.post("")
async def create_additional_class(ac: AdditionalClassCreate, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    """Create a new additional class"""
    
    # Validate the data
    if not ac.section_ids:
        raise HTTPException(status_code=400, detail="At least one section is required")
    
    if not ac.subject_name or not ac.faculty_name:
        raise HTTPException(status_code=400, detail="Subject and faculty are required")
    
    # Check availability
    availability = check_slot_availability(
        db, ac.section_ids, ac.faculty_name, ac.room_id, 
        ac.day, ac.time, ac.duration_slots
    )
    
    if not availability["available"]:
        raise HTTPException(
            status_code=409, 
            detail=f"Slot not available. Conflicts: {', '.join(availability['reasons'])}"
        )
    
    # Create the class
    new_class = AdditionalClass(
        title=ac.title,
        reason=ac.reason,
        subject_name=ac.subject_name,
        faculty_id=ac.faculty_id,
        faculty_name=ac.faculty_name,
        room_id=ac.room_id,
        room_name=ac.room_name,
        day=ac.day,
        time=ac.time,
        duration_slots=ac.duration_slots,
        section_ids=ac.section_ids,
        student_group_name=ac.student_group_name,
        failed_students_count=ac.failed_students_count,
        remarks=ac.remarks,
        status=ac.status
    )
    
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    
    return {"message": "Additional class created successfully", "data": new_class.to_dict()}

@router.get("")
async def get_all_additional_classes(db: Session = Depends(get_db)):
    """Get all additional classes"""
    classes = db.query(AdditionalClass).all()
    return {"data": [c.to_dict() for c in classes]}

@router.get("/{class_id}")
async def get_additional_class(class_id: int, db: Session = Depends(get_db)):
    """Get a specific additional class by ID"""
    ac = db.query(AdditionalClass).filter(AdditionalClass.id == class_id).first()
    
    if not ac:
        raise HTTPException(status_code=404, detail="Additional class not found")
    
    return {"data": ac.to_dict()}

@router.put("/{class_id}")
async def update_additional_class(class_id: int, update: AdditionalClassUpdate, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    """Update an additional class"""
    ac = db.query(AdditionalClass).filter(AdditionalClass.id == class_id).first()
    
    if not ac:
        raise HTTPException(status_code=404, detail="Additional class not found")
    
    # Update fields
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ac, key, value)
    
    ac.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ac)
    
    return {"message": "Additional class updated successfully", "data": ac.to_dict()}

@router.delete("/{class_id}")
async def delete_additional_class(class_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    """Delete an additional class"""
    ac = db.query(AdditionalClass).filter(AdditionalClass.id == class_id).first()
    
    if not ac:
        raise HTTPException(status_code=404, detail="Additional class not found")
    
    db.delete(ac)
    db.commit()
    
    return {"message": "Additional class deleted successfully"}

@router.patch("/{class_id}/status")
async def update_status(class_id: int, status_update: StatusUpdate, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    """Update the status of an additional class"""
    ac = db.query(AdditionalClass).filter(AdditionalClass.id == class_id).first()
    
    if not ac:
        raise HTTPException(status_code=404, detail="Additional class not found")
    
    valid_statuses = ["scheduled", "completed", "cancelled", "in_progress"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    ac.status = status_update.status
    ac.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ac)
    
    return {"message": "Status updated successfully", "data": ac.to_dict()}

@router.post("/check-availability")
async def check_availability(check: AvailabilityCheck, db: Session = Depends(get_db)):
    """Check availability for all time slots"""
    DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    PERIOD_SLOTS = [
        "08:30 - 09:25", "09:25 - 10:20",
        "10:40 - 11:35", "11:35 - 12:30",
        "01:25 - 02:20", "02:20 - 03:15", "03:15 - 04:10"
    ]
    
    availability_grid = {}
    
    for day in DAYS:
        availability_grid[day] = {}
        for time in PERIOD_SLOTS:
            availability = check_slot_availability(
                db, check.section_ids, check.faculty_name,
                check.room_id, day, time, check.duration
            )
            availability_grid[day][time] = availability
    
    return {"data": availability_grid}

@router.get("/section/{section_id}")
async def get_by_section(section_id: int, db: Session = Depends(get_db)):
    """Get all additional classes for a specific section"""
    classes = db.query(AdditionalClass).filter(
        AdditionalClass.section_ids.contains([section_id])
    ).all()
    return {"data": [c.to_dict() for c in classes]}

@router.get("/faculty/{faculty_id}")
async def get_by_faculty(faculty_id: int, db: Session = Depends(get_db)):
    """Get all additional classes for a specific faculty"""
    classes = db.query(AdditionalClass).filter(
        AdditionalClass.faculty_id == faculty_id
    ).all()
    return {"data": [c.to_dict() for c in classes]}