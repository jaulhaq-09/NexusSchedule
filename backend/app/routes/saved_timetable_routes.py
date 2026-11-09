from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database.db import SessionLocal
from app.models.saved_timetable import SavedTimetable
from app.models.user import User
from app.models.section import Section
from app.services.audit_service import AuditService
from app.utils.logger import logger
from app.routes.auth_routes import require_admin, require_editor, get_current_user, in_scope
from typing import Optional
from sqlalchemy import or_
from pydantic import BaseModel

router = APIRouter(prefix="/saved-timetables", tags=["Saved Timetables"], dependencies=[Depends(get_current_user)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse(val):
    if val is None:
        return None
    if isinstance(val, (list, dict)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return val


def _serialize(row: SavedTimetable) -> dict:
    return {
        "id":             row.id,
        "label":          row.label,
        "section_id":     row.section_id,
        "room_id":        row.room_id,
        "total_students": row.total_students,
        "wef":            row.wef,
        "class_teacher":  row.class_teacher if hasattr(row, "class_teacher") else "",
        "academic_year":  row.academic_year if hasattr(row, "academic_year") else "",
        "semester":       row.semester if hasattr(row, "semester") else None,
        "cluster":        row.cluster if hasattr(row, "cluster") else None,
        "department_id":  row.department_id if hasattr(row, "department_id") else None,
        "is_archived":    row.is_archived if hasattr(row, "is_archived") else False,
        "type":           row.type if hasattr(row, "type") else "section",
        "faculty_name":   row.faculty_name if hasattr(row, "faculty_name") else None,
        "created_at":     str(row.created_at) if hasattr(row, "created_at") and row.created_at else None,
        "timetable_data": _parse(row.timetable_data),
        "subject_config": _parse(row.subject_config),
        "lab_config":     _parse(row.lab_config),
        "pinned_slots":   _parse(row.pinned_slots),
    }


@router.get("/")
def list_saved(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    """List all saved timetables"""
    try:
        q = db.query(SavedTimetable)
        if _u.department_id is not None:
            q = q.filter(SavedTimetable.department_id == _u.department_id)
        if _u.cluster is not None:
            q = q.filter(SavedTimetable.cluster == _u.cluster)
        rows = q.order_by(SavedTimetable.id.desc()).all()
        logger.info(f"[OK] Retrieved {len(rows)} saved timetables")
        return [_serialize(r) for r in rows]
    except Exception as e:
        logger.error(f"[ERROR] Failed to list saved timetables: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_saved(data: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Create a new saved timetable"""
    # Department/cluster come from the section itself, never trusted from the client
    sec = db.query(Section).filter(Section.id == data.get("section_id")).first() if data.get("section_id") else None
    dept_id = sec.department_id if sec else data.get("department_id")
    cluster_no = sec.cluster if sec else data.get("cluster")
    if not in_scope(_a, dept_id, cluster_no):
        raise HTTPException(status_code=403, detail="This section is outside your department/cluster")
    try:
        row = SavedTimetable(
            label          = data.get("label", ""),
            section_id     = data.get("section_id"),
            room_id        = data.get("room_id"),
            total_students = str(data.get("total_students", "")),
            wef            = data.get("wef", ""),
            class_teacher  = data.get("class_teacher", ""),
            department_id  = dept_id,
            timetable_data = json.dumps(data.get("timetable_data", [])),
            subject_config = json.dumps(data.get("subject_config", [])),
            lab_config     = json.dumps(data.get("lab_config", [])),
            pinned_slots   = json.dumps(data.get("pinned_slots", {})),
            academic_year  = data.get("academic_year", ""),
            semester       = data.get("semester"),
            cluster        = cluster_no,
            type           = data.get("type", "section"),
            faculty_name   = data.get("faculty_name"),
        )
        # Replace-on-save: archive earlier versions of this same section + term.
        # They stay in the database (Show Archived brings them back); only the
        # newest one counts for the conflict check.
        if row.type in (None, "section") and row.section_id and row.academic_year and row.semester is not None:
            (db.query(SavedTimetable)
               .filter(
                   SavedTimetable.section_id == row.section_id,
                   SavedTimetable.academic_year == row.academic_year,
                   SavedTimetable.semester == row.semester,
                   SavedTimetable.is_archived.isnot(True),
                   or_(SavedTimetable.type == "section", SavedTimetable.type.is_(None)),
               )
               .update({"is_archived": True}, synchronize_session=False))
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info(f"[OK] Created timetable: {data.get('label', 'Untitled')}")

        try:
            AuditService.log_action(
                db=db,
                action="SAVE_TIMETABLE",
                entity_type="TIMETABLE",
                entity_id=row.id,
                description=f"Timetable saved as '{row.label}' for section {row.section_id}"
            )
        except Exception as audit_err:
            # The timetable itself already saved successfully above — a
            # failure here should never turn that into a reported error.
            logger.error(f"[ERROR] Audit logging failed for saved timetable {row.id}: {str(audit_err)}")

        return _serialize(row)

    except Exception as e:
        logger.error(f"[ERROR] Failed to create timetable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def delete_saved(id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Delete a saved timetable"""
    try:
        row = db.query(SavedTimetable).filter(SavedTimetable.id == id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Timetable not found")
        if not in_scope(_a, row.department_id, row.cluster):
            raise HTTPException(status_code=403, detail="Outside your department/cluster")
        db.delete(row)
        db.commit()
        logger.info(f"[OK] Deleted timetable {id}")
        return {"message": "Deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] Failed to delete timetable {id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
def search_timetables(
    academic_year: Optional[str] = None,
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    cluster: Optional[int] = None,
    section_id: Optional[int] = None,
    is_archived: Optional[bool] = None,
    db: Session = Depends(get_db),
    _u: User = Depends(get_current_user)
):
    """Search and filter saved timetables"""
    try:
        print(f"[SEARCH] academic_year={academic_year}, semester={semester}, department_id={department_id}, cluster={cluster}, section_id={section_id}, is_archived={is_archived}")

        query = db.query(SavedTimetable)
        if _u.department_id is not None:
            query = query.filter(SavedTimetable.department_id == _u.department_id)
        if _u.cluster is not None:
            query = query.filter(SavedTimetable.cluster == _u.cluster)

        if academic_year:
            query = query.filter(SavedTimetable.academic_year == academic_year)

        if semester is not None:
            query = query.filter(SavedTimetable.semester == semester)

        if department_id is not None:
            query = query.filter(SavedTimetable.department_id == department_id)

        if cluster is not None:
            query = query.filter(SavedTimetable.cluster == cluster)

        if section_id:
            query = query.filter(SavedTimetable.section_id == section_id)

        if is_archived is not None:
            query = query.filter(SavedTimetable.is_archived == is_archived)

        results = query.order_by(SavedTimetable.created_at.desc()).all()
        logger.info(f"[OK] Search returned {len(results)} results")

        return [_serialize(r) for r in results]
    except Exception as e:
        logger.error(f"[ERROR] Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/busy-slots")
def busy_slots(
    academic_year: str,
    parity: str,                       # "odd" or "even"
    exclude_section_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Faculty-occupied slots this term, from the latest non-archived
    timetable of each section."""
    want_odd = parity.lower() == "odd"
    rows = (
        db.query(SavedTimetable)
        .filter(
            SavedTimetable.is_archived.isnot(True),
            or_(SavedTimetable.type == "section", SavedTimetable.type.is_(None)),
            SavedTimetable.academic_year == academic_year,
            SavedTimetable.section_id.isnot(None),
        )
        .order_by(SavedTimetable.id.desc())
        .all()
    )
    latest = {}
    for r in rows:                     # newest first, so the first one seen wins
        if r.semester is None or (r.semester % 2 == 1) != want_odd:
            continue
        latest.setdefault(r.section_id, r)

    out = []
    for sid, r in latest.items():
        if exclude_section_id is not None and sid == exclude_section_id:
            continue
        try:
            entries = json.loads(r.timetable_data) if r.timetable_data else []
        except Exception:
            continue
        for e in entries:
            raw = ([(e.get("batchA") or {}).get("facultyName"),
                    (e.get("batchB") or {}).get("facultyName")]
                   if e.get("isBatchSplit") else [e.get("facultyName")])
            for name in raw:
                for f in (name or "").split("/"):
                    f = f.strip()
                    if f and f not in ("—", "-"):
                        out.append({"faculty": f, "day": e.get("day"), "time": e.get("time"),
                                    "span": e.get("span", 1), "section_id": sid,
                                    "section_label": r.label})
    return out


@router.patch("/{id}")
def update_saved(id: int, data: dict, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    """Update a saved timetable (archive/restore functionality)"""
    try:
        row = db.query(SavedTimetable).filter(SavedTimetable.id == id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Timetable not found")
        if not in_scope(_a, row.department_id, row.cluster):
            raise HTTPException(status_code=403, detail="Outside your department/cluster")

        # ✅ Handle archive toggle
        if "is_archived" in data:
            row.is_archived = data["is_archived"]
            action = "archived" if data["is_archived"] else "restored"
            logger.info(f"[OK] Timetable {id} {action}")

        db.commit()
        db.refresh(row)
        return _serialize(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ERROR] Failed to update timetable {id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))