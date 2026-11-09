"""
app/routes/teaching_routes.py
Per-term teaching assignments (section + subject -> faculty).
Read: any logged-in user (limited to their own department/cluster).
Write: admin, or the coordinator of that section's department + cluster.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.teaching_assignment import TeachingAssignment
from app.models.section import Section
from app.models.user import User
from app.routes.auth_routes import get_current_user, require_editor, in_scope

router = APIRouter(
    prefix="/teaching-assignments",
    tags=["Teaching Assignments"],
    dependencies=[Depends(get_current_user)],
)


class AssignmentIn(BaseModel):
    academic_year: str
    parity: str                      # "odd" | "even"
    section_id: int
    subject_name: str
    kind: str = "theory"             # "theory" | "lab"
    faculty_id: Optional[int] = None  # null / 0 = clear the assignment
    hours_per_week: Optional[int] = None


def _check_values(parity: str, kind: str):
    if parity not in ("odd", "even"):
        raise HTTPException(400, "parity must be 'odd' or 'even'")
    if kind not in ("theory", "lab"):
        raise HTTPException(400, "kind must be 'theory' or 'lab'")


@router.get("")
@router.get("/")
def list_assignments(
    academic_year: str,
    parity: str,
    section_id: Optional[int] = None,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    _check_values(parity, "theory")
    q = db.query(TeachingAssignment).filter(
        TeachingAssignment.academic_year == academic_year,
        TeachingAssignment.parity == parity,
    )
    if section_id is not None:
        q = q.filter(TeachingAssignment.section_id == section_id)

    rows = q.all()

    # Scope: a department / cluster user only sees assignments of their own sections.
    if me.department_id is not None or me.cluster is not None:
        sec_ids = {r.section_id for r in rows}
        secs = {s.id: s for s in db.query(Section).filter(Section.id.in_(sec_ids)).all()} if sec_ids else {}
        rows = [
            r for r in rows
            if r.section_id in secs and in_scope(me, secs[r.section_id].department_id, secs[r.section_id].cluster)
        ]
    return [r.to_dict() for r in rows]


@router.put("")
@router.put("/")
def set_assignment(
    data: AssignmentIn,
    db: Session = Depends(get_db),
    me: User = Depends(require_editor),
):
    _check_values(data.parity, data.kind)

    sec = db.query(Section).filter(Section.id == data.section_id).first()
    if not sec:
        raise HTTPException(404, "Section not found")
    if not in_scope(me, sec.department_id, sec.cluster):
        raise HTTPException(403, "This section is outside your department/cluster")

    subject = (data.subject_name or "").strip()
    if not subject:
        raise HTTPException(400, "subject_name is required")

    row = db.query(TeachingAssignment).filter(
        TeachingAssignment.academic_year == data.academic_year,
        TeachingAssignment.parity == data.parity,
        TeachingAssignment.section_id == data.section_id,
        TeachingAssignment.subject_name == subject,
        TeachingAssignment.kind == data.kind,
    ).first()

    # Clearing
    if not data.faculty_id:
        if row:
            db.delete(row)
            db.commit()
        return {"cleared": True}

    if row:
        row.faculty_id = data.faculty_id
        if data.hours_per_week is not None:
            row.hours_per_week = data.hours_per_week
    else:
        row = TeachingAssignment(
            academic_year=data.academic_year,
            parity=data.parity,
            section_id=data.section_id,
            subject_name=subject,
            kind=data.kind,
            faculty_id=data.faculty_id,
            hours_per_week=data.hours_per_week,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row.to_dict()