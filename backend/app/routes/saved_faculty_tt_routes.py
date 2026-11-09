# backend/app/routes/saved_faculty_tt_routes.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.saved_faculty_tt import SavedFacultyTT
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.utils.logger import logger

router = APIRouter(prefix="/saved-faculty-tt", tags=["Faculty Timetables"])

class SavedFacultyTTCreate(BaseModel):
    faculty_id: int
    faculty_name: str
    academic_year: str
    semester: int
    timetable_data: str
    comments: Optional[str] = None

class SavedFacultyTTResponse(BaseModel):
    id: int
    faculty_id: int
    faculty_name: str
    academic_year: str
    semester: int
    timetable_data: str
    comments: Optional[str]
    is_archived: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ArchiveRequest(BaseModel):
    is_archived: bool

@router.post("/", response_model=SavedFacultyTTResponse)
def create_faculty_timetable(data: SavedFacultyTTCreate, db: Session = Depends(get_db)):
    logger.info(f"Creating faculty timetable for '{data.faculty_name}' ({data.academic_year} Sem {data.semester})")
    try:
        tt = SavedFacultyTT(**data.dict())
        db.add(tt)
        db.commit()
        db.refresh(tt)
        logger.info(f"Faculty timetable created with ID #{tt.id}")
        return tt
    except Exception as e:
        logger.error(f"❌ Failed to create faculty timetable: {str(e)}")
        raise

@router.get("/")
def get_all_faculty_timetables(db: Session = Depends(get_db)):
    logger.info("[INFO] Fetching all faculty timetables")
    try:
        timetables = db.query(SavedFacultyTT).all()
        logger.info(f"[OK] Found {len(timetables)} faculty timetables")
        return timetables
    except Exception as e:
        logger.error(f"❌ Error fetching faculty timetables: {str(e)}")
        raise

@router.get("/{id}", response_model=SavedFacultyTTResponse)
def get_faculty_timetable(id: int, db: Session = Depends(get_db)):
    logger.info(f"Fetching faculty timetable #{id}")
    try:
        tt = db.query(SavedFacultyTT).filter(SavedFacultyTT.id == id).first()
        if not tt:
            logger.warning(f"⚠️ Faculty timetable #{id} not found")
            raise HTTPException(status_code=404, detail="Timetable not found")
        logger.info(f"Faculty timetable #{id} retrieved ({tt.faculty_name})")
        return tt
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching faculty timetable #{id}: {str(e)}")
        raise

@router.patch("/{id}", response_model=SavedFacultyTTResponse)
def archive_faculty_timetable(id: int, archive_req: ArchiveRequest, db: Session = Depends(get_db)):
    action = "archiving" if archive_req.is_archived else "unarchiving"
    logger.info(f"{action.capitalize()} faculty timetable #{id}")
    try:
        tt = db.query(SavedFacultyTT).filter(SavedFacultyTT.id == id).first()
        if not tt:
            logger.warning(f"⚠️ Faculty timetable #{id} not found for {action}")
            raise HTTPException(status_code=404, detail="Timetable not found")
        tt.is_archived = archive_req.is_archived
        db.commit()
        db.refresh(tt)
        logger.info(f"Faculty timetable #{id} {action} complete")
        return tt
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to {action} faculty timetable #{id}: {str(e)}")
        raise

@router.delete("/{id}")
def delete_faculty_timetable(id: int, db: Session = Depends(get_db)):
    logger.info(f"Deleting faculty timetable #{id}")
    try:
        tt = db.query(SavedFacultyTT).filter(SavedFacultyTT.id == id).first()
        if not tt:
            logger.warning(f"⚠️ Faculty timetable #{id} not found for deletion")
            raise HTTPException(status_code=404, detail="Timetable not found")
        db.delete(tt)
        db.commit()
        logger.info(f"Faculty timetable #{id} deleted successfully")
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete faculty timetable #{id}: {str(e)}")
        raise

@router.get("/search/")
def search_faculty_timetables(
    academic_year: Optional[str] = None,
    faculty_id: Optional[int] = None,
    faculty_name: Optional[str] = None,
    semester: Optional[int] = None,
    is_archived: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    filters = []
    if academic_year:
        filters.append(f"year={academic_year}")
    if faculty_id:
        filters.append(f"faculty_id={faculty_id}")
    if faculty_name:
        filters.append(f"faculty_name={faculty_name}")
    if semester:
        filters.append(f"sem={semester}")
    if is_archived is not None:
        filters.append(f"archived={is_archived}")
    
    logger.info(f"Searching faculty timetables with filters: {', '.join(filters) if filters else 'none'}")
    try:
        query = db.query(SavedFacultyTT)
        
        if academic_year:
            query = query.filter(SavedFacultyTT.academic_year == academic_year)
        if faculty_id:
            query = query.filter(SavedFacultyTT.faculty_id == faculty_id)
        if faculty_name:
            query = query.filter(SavedFacultyTT.faculty_name.ilike(f"%{faculty_name}%"))
        if semester:
            query = query.filter(SavedFacultyTT.semester == semester)
        if is_archived is not None:
            query = query.filter(SavedFacultyTT.is_archived == is_archived)
        
        results = query.all()
        logger.info(f"Search found {len(results)} faculty timetables")
        return results
    except Exception as e:
        logger.error(f"❌ Error searching faculty timetables: {str(e)}")
        raise