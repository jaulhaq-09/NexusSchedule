from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database.db import SessionLocal
from app.models.subject import Subject
from app.models.faculty import Faculty
from app.schemas.subject_schema import SubjectCreate
from app.models.user import User
from app.routes.auth_routes import require_editor, get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _check_owner(subject, user):
    """A coordinator may only change subjects of their own department
    (shared/Common subjects with no department are read-only for them)."""
    if user.department_id is not None and subject.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="This subject belongs to another department or is shared")


@router.post("/subjects")
def create_subject(data: SubjectCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    # Check for duplicate code
    existing = db.query(Subject).filter(Subject.subject_code == data.subject_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject code '{data.subject_code}' already exists")

    subject = Subject(
        subject_name    = data.subject_name.strip(),
        subject_code    = data.subject_code.strip().upper(),
        hours_per_week  = data.hours_per_week or 4,
        subject_type    = data.subject_type or "THEORY",
        course_category = data.course_category,
        semester        = data.semester,
        department_id   = _a.department_id if _a.department_id is not None else (data.department_id or None),
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects")
def get_subjects(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    q = db.query(Subject)
    if _u.department_id is not None:
        q = q.filter(or_(Subject.department_id == _u.department_id, Subject.department_id.is_(None)))
    subjects = q.order_by(Subject.subject_name).all()
    faculty_by_id = {f.id: f.name for f in db.query(Faculty).all()}
    for s in subjects:
        # Not a DB column — attached in-memory only, purely so it's present
        # in this response. Nothing is persisted here (no db.commit()).
        s.coordinator_name = faculty_by_id.get(s.coordinator_faculty_id)
    return subjects


@router.get("/subjects/{id}")
def get_subject(id: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    subject = db.query(Subject).filter(Subject.id == id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.put("/subjects/{id}")
def update_subject(id: int, data: SubjectCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    subject = db.query(Subject).filter(Subject.id == id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    _check_owner(subject, _a)

    # Check duplicate code (excluding self)
    dup = db.query(Subject).filter(
        Subject.subject_code == data.subject_code.strip().upper(),
        Subject.id != id
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"Subject code '{data.subject_code}' already used")

    subject.subject_name    = data.subject_name.strip()
    subject.subject_code    = data.subject_code.strip().upper()
    subject.hours_per_week  = data.hours_per_week or 4
    subject.subject_type    = data.subject_type or "THEORY"
    subject.course_category = data.course_category
    if data.semester is not None:
        subject.semester = data.semester
    if data.department_id is not None and _a.department_id is None:
        subject.department_id = data.department_id or None
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/reset-all")
def reset_all_subjects(db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Allow admins and coordinators to reset subjects across all departments."""
    deleted = db.query(Subject).delete(synchronize_session=False)
    db.commit()
    return {"message": "All subjects reset", "deleted": deleted}


@router.delete("/subjects/{id}")
def delete_subject(id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    subject = db.query(Subject).filter(Subject.id == id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    _check_owner(subject, _a)
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted"}


@router.patch("/subjects/{id}/core")
def toggle_core(id: int, data: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Manually set is_core, overriding whatever the AI last decided."""
    subject = db.query(Subject).filter(Subject.id == id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    _check_owner(subject, _a)
    subject.is_core = bool(data.get("is_core"))
    db.commit()
    db.refresh(subject)
    return {"id": subject.id, "is_core": subject.is_core}

@router.post("/subjects/bulk")
def bulk_create_subjects(payload: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    data = payload.get("records", [])
    if not data:
        raise HTTPException(status_code=400, detail="No records provided")

    existing_codes = {c[0] for c in db.query(Subject.subject_code).all()}
    seen_in_batch = set()
    created = []
    errors = []

    for i, item in enumerate(data):
        code = (item.get("subject_code") or "").strip().upper()
        if not code:
            errors.append(f"Row {i+1}: subject_code is required")
            continue
        if code in existing_codes or code in seen_in_batch:
            errors.append(f"Row {i+1}: Subject code '{code}' already exists")
            continue
        try:
            subject = Subject(
                subject_name    = (item.get("subject_name") or "").strip(),
                subject_code    = code,
                hours_per_week  = item.get("hours_per_week") or 4,
                subject_type    = item.get("subject_type") or "THEORY",
                course_category = item.get("course_category"),
                semester        = item.get("semester"),
                department_id   = _a.department_id if _a.department_id is not None else (item.get("department_id") or None),
            )
            db.add(subject)
            created.append(subject)
            seen_in_batch.add(code)
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    db.commit()
    for subject in created:
        db.refresh(subject)

    return {
        "imported": len(created),
        "errors": errors,
        "total": len(data),
        "subjects": created,
    }