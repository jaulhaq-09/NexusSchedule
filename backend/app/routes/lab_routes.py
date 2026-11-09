"""
Enhanced Lab Routes with Batch Support
Location: backend/app/routes/lab_routes.py
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.db import get_db
from app.models.lab import Lab
from app.models.faculty import Faculty
from app.models.room import Room
from app.models.user import User
from sqlalchemy import or_
from app.routes.auth_routes import require_editor, get_current_user
from app.schemas.lab_schema import LabCreate, LabUpdate, LabResponse, LabWithFaculty

router = APIRouter(prefix="/labs", tags=["Labs"])


def _matched_faculty(lab_name: str, db: Session):
    """
    Faculty assignment is fully derived, not stored: a faculty is considered
    assigned to this lab if `lab_name` appears exactly (after trim) among
    the comma-separated entries in that faculty's `labs` field.
    """
    if not lab_name:
        return []
    all_faculty = db.query(Faculty).filter(Faculty.labs.isnot(None)).all()
    matched = []
    for f in all_faculty:
        entries = [e.strip() for e in (f.labs or "").split(",") if e.strip()]
        if lab_name.strip() in entries:
            matched.append(f)
    return matched


def _build(lab: Lab, db: Session) -> LabWithFaculty:
    matched = _matched_faculty(lab.lab_name, db)
    room = db.query(Room).filter(Room.id == lab.room_id).first() if lab.room_id else None
    return LabWithFaculty(
        id=lab.id,
        lab_name=lab.lab_name,
        lab_code=lab.lab_code,
        batch=lab.batch,
        hours_per_week=lab.hours_per_week,
        paired_lab_name=lab.paired_lab_name,
        room_id=lab.room_id,
        created_at=lab.created_at,
        updated_at=lab.updated_at,
        faculty_ids=[f.id for f in matched],
        faculty_names=[f.name for f in matched],
        room_name=room.room_name if room else None,
        room_type=room.room_type if room else None,
    )


def _base_name(name: str) -> str:
    return name[:-2] if name.endswith("-A") or name.endswith("-B") else name


# ═══════════════════════════════════════════════════════════════
# GET /labs/
# ═══════════════════════════════════════════════════════════════
@router.get("/", response_model=List[LabWithFaculty])
def get_all_labs(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    q = db.query(Lab)
    if _u.department_id is not None:
        q = q.filter(or_(Lab.department_id == _u.department_id, Lab.department_id.is_(None)))
    return [_build(lab, db) for lab in q.all()]


# ═══════════════════════════════════════════════════════════════
# GET /labs/utilization  (MUST be before /{lab_id} below)
# ═══════════════════════════════════════════════════════════════
@router.get("/utilization")
def lab_utilization(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    """
    Combines two data sources per product decision:
      1. Main generated/saved timetables (SavedTimetable.timetable_data JSON)
      2. Additional/remedial classes (AdditionalClass table)
    Both are matched against Room.room_type == "LAB" to determine which
    entries actually represent lab-room usage. The old version queried the
    Timetable ORM table, which nothing in the current save flow populates —
    same root cause already fixed for /timetable/view and /timetable/today-workload.
    """
    import json
    from app.models.saved_timetable import SavedTimetable
    from app.models.additional_class import AdditionalClass
    from app.models.room import Room
    from app.models.section import Section

    grid = {}

    def add_entry(lab_name, day, time_slot, section_name, subject_name):
        if not lab_name or not day or not time_slot:
            return
        key = (lab_name, day, time_slot)
        if key not in grid:
            grid[key] = {
                "lab_name": lab_name,
                "day": day,
                "time_slot": time_slot,
                "sections_using": [],
                "subject": subject_name,
            }
        if section_name and section_name not in grid[key]["sections_using"]:
            grid[key]["sections_using"].append(section_name)

    saved_rows = db.query(SavedTimetable).filter(SavedTimetable.is_archived.is_(False)).all()
    for row in saved_rows:
        room = db.query(Room).get(row.room_id) if row.room_id else None
        if not room:
            continue

        section_name = None
        if row.section_id:
            sec = db.query(Section).get(row.section_id)
            section_name = sec.section_name if sec else row.label

        try:
            entries = json.loads(row.timetable_data) if row.timetable_data else []
        except Exception:
            continue

        for entry in entries:
            if not entry.get("isLab"):
                continue
            add_entry(room.room_name, entry.get("day"), entry.get("time"), section_name, entry.get("subject"))

    additional = db.query(AdditionalClass).filter(AdditionalClass.status != "cancelled").all()
    for ac in additional:
        if (ac.reason or "").lower() != "lab":
            continue

        room = db.query(Room).get(ac.room_id) if ac.room_id else None
        if not room:
            continue

        section_names = []
        for sid in (ac.section_ids or []):
            sec = db.query(Section).get(sid)
            if sec:
                section_names.append(sec.section_name)
        if not section_names:
            section_names = [ac.student_group_name or "Additional Class"]

        for sname in section_names:
            add_entry(room.room_name, ac.day, ac.time, sname, ac.subject_name)

    result = list(grid.values())
    return {"utilization": result}


# ═══════════════════════════════════════════════════════════════
# POST /labs/
# ═══════════════════════════════════════════════════════════════
@router.post("/", response_model=LabResponse, status_code=201)
def create_lab(lab: LabCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    db_lab = Lab(
        lab_name        = lab.lab_name.strip(),
        lab_code        = (lab.lab_code or "").strip().upper() or None,
        batch           = lab.batch or None,
        hours_per_week  = lab.hours_per_week or 2,
        paired_lab_name = lab.paired_lab_name or None,
        room_id         = lab.room_id or None,
        department_id   = _a.department_id,
    )
    db.add(db_lab)
    db.commit()
    db.refresh(db_lab)
    return db_lab


# ═══════════════════════════════════════════════════════════════
# GET /labs/{lab_id}
# ═══════════════════════════════════════════════════════════════
@router.get("/{lab_id}", response_model=LabResponse)
def get_lab(lab_id: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")
    return lab


# ═══════════════════════════════════════════════════════════════
# PUT /labs/{lab_id}
# ═══════════════════════════════════════════════════════════════
@router.put("/{lab_id}", response_model=LabResponse)
def update_lab(lab_id: int, lab: LabUpdate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    db_lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not db_lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    if _a.department_id is not None and db_lab.department_id != _a.department_id:
        raise HTTPException(status_code=403, detail="This lab belongs to another department")
    for field, value in lab.dict(exclude_unset=True).items():
        setattr(db_lab, field, value)

    db.commit()
    db.refresh(db_lab)
    return db_lab


# ═══════════════════════════════════════════════════════════════
# DELETE /labs/{lab_id}
# ═══════════════════════════════════════════════════════════════
@router.delete("/{lab_id}")
def delete_lab(lab_id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    db_lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not db_lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    if _a.department_id is not None and db_lab.department_id != _a.department_id:
        raise HTTPException(status_code=403, detail="This lab belongs to another department")
    name = db_lab.lab_name
    db.delete(db_lab)
    db.commit()
    return {"message": f"Lab '{name}' deleted", "id": lab_id}


# ═══════════════════════════════════════════════════════════════
# POST /labs/{lab_id}/clone
# ═══════════════════════════════════════════════════════════════
@router.post("/{lab_id}/clone", status_code=201)
def clone_lab(
    lab_id: int,
    target_batch: str = Query(..., description="Target batch: A or B"),
    db: Session = Depends(get_db),
    _a: User = Depends(require_editor),
):
    source = db.query(Lab).filter(Lab.id == lab_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Lab not found")

    if _a.department_id is not None and source.department_id != _a.department_id:
        raise HTTPException(status_code=403, detail="This lab belongs to another department")
    new_name = f"{_base_name(source.lab_name)}-{target_batch}"

    if db.query(Lab).filter(Lab.lab_name == new_name).first():
        raise HTTPException(status_code=400, detail=f"Lab '{new_name}' already exists")

    cloned = Lab(
        lab_name       = new_name,
        lab_code       = source.lab_code,
        batch          = target_batch,
        hours_per_week = source.hours_per_week,
        department_id  = source.department_id,
    )
    db.add(cloned)
    db.commit()
    db.refresh(cloned)

    return {
        "message": f"Cloned '{source.lab_name}' → '{new_name}'",
        "original_id": lab_id,
        "cloned_id": cloned.id,
        "cloned_lab": LabResponse.from_orm(cloned),
    }

# ═══════════════════════════════════════════════════════════════
# POST /labs/bulk
# ═══════════════════════════════════════════════════════════════
@router.post("/bulk")
def bulk_import_labs(data: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    records = data.get("records", [])
    if not records:
        raise HTTPException(400, "No records provided")

    imported = 0
    errors = []
    new_labs = []

    # ✅ Build a lowercase room-name lookup once, so each row's free-text
    # "room_name" (from OCR or manual entry) resolves to the matching
    # Room's id — same matching Room rows the Labs page dropdown offers.
    rooms_by_name = {r.room_name.strip().lower(): r.id for r in db.query(Room).all()}

    for record in records:
        try:
            lab_name = (record.get("lab_name") or "").strip()
            if not lab_name:
                errors.append("Skipped a row: lab_name is required")
                continue

            room_id = None
            room_name_raw = (record.get("room_name") or "").strip()
            if room_name_raw:
                room_id = rooms_by_name.get(room_name_raw.lower())
                if room_id is None:
                    errors.append(f"{lab_name}: room '{room_name_raw}' not found — imported without a room")

            new_labs.append(Lab(
                lab_name       = lab_name,
                lab_code       = (record.get("lab_code") or "").strip().upper() or None,
                batch          = record.get("batch") or None,
                hours_per_week = record.get("hours_per_week") or 2,
                room_id        = room_id,
                department_id  = _a.department_id,
            ))
        except Exception as e:
            errors.append(f"{record.get('lab_name', '?')}: {str(e)}")

    if new_labs:
        db.bulk_save_objects(new_labs)
        db.commit()
        imported = len(new_labs)

    return {"imported": imported, "errors": errors, "total": len(records)}