from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.db import SessionLocal
from app.models.faculty import Faculty
from app.schemas.faculty_schema import FacultyCreate, FacultyUpdate, FacultyOut
from app.models.user import User
from app.routes.auth_routes import require_admin, get_current_user, require_editor, in_scope

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/faculty", response_model=FacultyOut)
def create_faculty(data: FacultyCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    faculty = Faculty(
        name        = data.name.strip(),
        designation = data.designation.strip() if data.designation else None,
        subjects    = data.subjects.strip()    if data.subjects    else None,
        workload    = data.workload,
        labs        = data.labs.strip()        if data.labs        else None,
        email       = data.email.strip().lower() if data.email     else None,
        phone       = data.phone.strip()       if data.phone       else None,
        department_id = _a.department_id if _a.role == "coordinator" else data.department_id,
        cluster     = _a.cluster if _a.role == "coordinator" else data.cluster,
    )
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return faculty


@router.get("/faculty", response_model=List[FacultyOut])
def get_faculty(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    q = db.query(Faculty)
    if _u.department_id is not None:
        q = q.filter(Faculty.department_id == _u.department_id)
    if _u.cluster is not None:
        q = q.filter(Faculty.cluster == _u.cluster)
    return q.order_by(Faculty.name).all()


@router.get("/faculty/{id}", response_model=FacultyOut)
def get_faculty_by_id(id: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    f = db.query(Faculty).filter(Faculty.id == id).first()
    if not f or not in_scope(_u, f.department_id, f.cluster):
        raise HTTPException(status_code=404, detail="Faculty not found")
    return f


@router.put("/faculty/{id}", response_model=FacultyOut)
def update_faculty(id: int, data: FacultyUpdate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    faculty = db.query(Faculty).filter(Faculty.id == id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    if not in_scope(_a, faculty.department_id, faculty.cluster):
        raise HTTPException(status_code=403, detail="This faculty belongs to another cluster")
    if data.name        is not None: faculty.name        = data.name.strip()
    if data.designation is not None: faculty.designation = data.designation.strip()
    if data.subjects    is not None: faculty.subjects    = data.subjects.strip()
    if data.workload    is not None: faculty.workload    = data.workload
    if data.labs        is not None: faculty.labs        = data.labs.strip()
    if data.email       is not None: faculty.email       = data.email.strip().lower() or None
    if data.phone       is not None: faculty.phone       = data.phone.strip() or None
    if data.department_id is not None and _a.role != "coordinator": faculty.department_id = data.department_id
    if data.cluster     is not None and _a.role != "coordinator": faculty.cluster     = data.cluster

    db.commit()
    db.refresh(faculty)
    return faculty


@router.delete("/faculty/{id}")
def delete_faculty(id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    faculty = db.query(Faculty).filter(Faculty.id == id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    if not in_scope(_a, faculty.department_id, faculty.cluster):
        raise HTTPException(status_code=403, detail="This faculty belongs to another cluster")
    # Keep any login for this faculty: just detach it from the deleted record.
    db.query(User).filter(User.faculty_id == id).update({User.faculty_id: None})
    db.delete(faculty)
    db.commit()
    return {"message": "Faculty deleted"}

@router.post("/faculty/bulk")
def bulk_import_faculty(data: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Bulk import faculty from OCR"""
    records = data.get("records", [])

    if not records:
        raise HTTPException(400, "No records provided")

    imported = 0
    errors = []
    new_faculty = []
    skipped = []
    seen_emails = {e.lower() for (e,) in db.query(Faculty.email).all() if e}

    for record in records:
        try:
            name = (record.get("name") or "").strip()
            if not name:
                errors.append("Skipped a row: name is required")
                continue
            email = (record.get("email") or "").strip().lower() or None
            if email and email in seen_emails:
                skipped.append(f"{name} ({email}) already exists")
                continue
            if email:
                seen_emails.add(email)
            new_faculty.append(Faculty(
                name        = name,
                designation = record.get("designation") or "",
                subjects    = record.get("subjects") or "",
                workload    = int(record.get("workload") or 0),
                labs        = record.get("labs") or "",
                email       = email,
                phone       = (record.get("phone") or "").strip() or None,
                department_id = _a.department_id if _a.role == "coordinator" else (record.get("department_id") or None),
                cluster     = _a.cluster if _a.role == "coordinator" else (record.get("cluster") or None),
            ))
        except Exception as e:
            errors.append(f"{record.get('name', '?')}: {str(e)}")

    if new_faculty:
        db.bulk_save_objects(new_faculty)
        db.commit()
        imported = len(new_faculty)

    return {"imported": imported, "skipped": skipped, "errors": errors, "total": len(records)}