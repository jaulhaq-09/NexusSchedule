from fastapi import APIRouter, Depends, Body, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
import json

from app.database.db import SessionLocal
from app.models.saved_timetable import SavedTimetable
from app.models.section import Section
from app.models.subject import Subject
from app.models.room import Room
from app.utils.logger import logger
from app.services.audit_service import AuditService
from app.routes.auth_routes import get_current_user

# ── Two routers: one for the generator, one for saved timetables ──
router         = APIRouter(prefix="/timetable", dependencies=[Depends(get_current_user)])
saved_router   = APIRouter(prefix="/timetables", dependencies=[Depends(get_current_user)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# GENERATOR ROUTES  /timetable/...
# ─────────────────────────────────────────────────────────────

@router.get("/view")
def view(day: Optional[str] = None, db: Session = Depends(get_db)):
    logger.info(f"📖 Viewing timetable entries" + (f" for day={day}" if day else " (all days)"))
    try:
        # Real timetables live in SavedTimetable.timetable_data (JSON), not the
        # Timetable ORM table — see today-workload for the same finding.
        saved_rows = db.query(SavedTimetable).filter(
            SavedTimetable.is_archived.is_(False)
        ).all()

        # Build subject_name -> is_core lookup once, so per-entry checks are cheap.
        core_subject_names = {
            s.subject_name for s in db.query(Subject).filter(Subject.is_core.is_(True)).all()
        }

        result = []
        for row in saved_rows:
            section = db.query(Section).get(row.section_id) if row.section_id else None
            room    = db.query(Room).get(row.room_id) if row.room_id else None

            try:
                entries = json.loads(row.timetable_data) if row.timetable_data else []
            except Exception:
                continue

            for entry in entries:
                entry_day = entry.get("day")
                if day and entry_day != day.capitalize():
                    continue

                subject_name = entry.get("subject")
                result.append({
                    "id":          f"{row.id}-{entry_day}-{entry.get('time')}-{subject_name}",
                    "section":     section.section_name if section else row.label,
                    "subject":     subject_name,
                    "faculty":     entry.get("facultyName"),
                    "room":        room.room_name if room else None,
                    "day":         entry_day,
                    "time":        entry.get("time"),
                    "is_lab":      bool(entry.get("isLab")),
                    "is_core":     subject_name in core_subject_names,
                    "cluster":     row.cluster,
                    "semester":    row.semester,
                })

        logger.info(f"✅ Viewing {len(result)} timetable entries" + (f" for {day}" if day else ""))
        return result
    except Exception as e:
        logger.error(f"❌ Error viewing timetable: {str(e)}")
        raise

# ─────────────────────────────────────────────────────────────
# SAVED TIMETABLES CRUD  /timetables/...
# ─────────────────────────────────────────────────────────────

@saved_router.get("/")
def list_saved(db: Session = Depends(get_db)):
    """Return all saved timetables, ordered newest first."""
    logger.info("📋 Fetching all saved timetables")
    try:
        rows = db.query(SavedTimetable).order_by(SavedTimetable.id.desc()).all()
        logger.info(f"✅ Found {len(rows)} saved timetables")
        return [_serialize(r) for r in rows]
    except Exception as e:
        logger.error(f"❌ Error fetching saved timetables: {str(e)}")
        raise


@saved_router.post("/")
def create_saved(data: dict = Body(...), db: Session = Depends(get_db)):
    """Save a generated timetable with its config."""
    logger.info(f"💾 Saving new timetable '{data.get('label', 'Untitled')}'")
    try:
        row = SavedTimetable(
            label          = data.get("label", ""),
            section_id     = data.get("section_id"),
            room_id        = data.get("room_id"),
            total_students = str(data.get("total_students", "")),
            wef            = data.get("wef", ""),
            timetable_data = json.dumps(data.get("timetable_data", [])),
            subject_config = json.dumps(data.get("subject_config", [])),
            lab_config     = json.dumps(data.get("lab_config", [])),
            pinned_slots   = json.dumps(data.get("pinned_slots", {})),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        
        logger.info(f"✅ Timetable saved with ID #{row.id} (label: '{row.label}')")
        
        # ⭐ LOG TO AUDIT TRAIL (IMPORTANT ACTION)
        AuditService.log_action(
            db=db,
            action="SAVE_TIMETABLE",
            entity_type="TIMETABLE",
            entity_id=row.id,
            description=f"Timetable saved as '{row.label}' for section {row.section_id}"
        )
        
        return _serialize(row)
    except Exception as e:
        logger.error(f"❌ Failed to save timetable: {str(e)}")
        raise


@saved_router.get("/{id}")
def get_saved(id: int, db: Session = Depends(get_db)):
    """Get a specific saved timetable."""
    logger.info(f"📖 Fetching saved timetable #{id}")
    try:
        row = db.query(SavedTimetable).filter(SavedTimetable.id == id).first()
        if not row:
            logger.warning(f"⚠️ Saved timetable #{id} not found")
            raise HTTPException(status_code=404, detail="Not found")
        logger.info(f"✅ Saved timetable #{id} retrieved (label: '{row.label}')")
        return _serialize(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching saved timetable #{id}: {str(e)}")
        raise


@router.get("/today-workload")
def today_workload(day: Optional[str] = None, db: Session = Depends(get_db)):
    from datetime import datetime
    logger.info("📊 Fetching today's faculty workload")
    try:
        # `day` query param is for manual testing only (e.g. ?day=Monday) —
        # the Dashboard never sends it, so real usage always reflects the
        # actual current day. Remove this override once testing is done.
        today_name = day.capitalize() if day else datetime.now().strftime("%A")

        # Real timetables are saved as JSON blobs in SavedTimetable.timetable_data
        # (via the Timetable Studio page's Save button, which POSTs to
        # /saved-timetables/), not as rows in the Timetable ORM table — that
        # table is never written to by the current save flow. Skip archived
        # timetables since they represent past/inactive schedules.
        saved_rows = db.query(SavedTimetable).filter(
            SavedTimetable.is_archived.is_(False)
        ).all()

        workload = {}

        for row in saved_rows:
            # Each saved-timetable row belongs to a single section — resolve
            # its name once per row rather than per entry.
            section_name = None
            if row.section_id:
                sec = db.query(Section).get(row.section_id)
                section_name = sec.section_name if sec else None

            try:
                entries = json.loads(row.timetable_data) if row.timetable_data else []
            except Exception:
                continue

            for entry in entries:
                if entry.get("day") != today_name:
                    continue

                fname = (entry.get("facultyName") or "").strip()
                if not fname or fname in ("—", "-"):
                    continue

                if fname not in workload:
                    workload[fname] = {"name": fname, "periods_today": 0, "subjects": set(), "sections": set()}

                # span already reflects how many consecutive periods this
                # entry occupies (2 for labs/doubles, 1 for a single period)
                workload[fname]["periods_today"] += entry.get("span", 1)

                subject_name = entry.get("subject")
                if subject_name:
                    workload[fname]["subjects"].add(subject_name)

                if section_name:
                    workload[fname]["sections"].add(section_name)

        result = [
            {**v, "subjects": list(v["subjects"]), "sections": list(v["sections"])}
            for v in workload.values()
        ]
        logger.info(f"✅ Workload computed for {len(result)} faculty on {today_name} (from {len(saved_rows)} saved timetables)")
        return {"day": today_name, "faculty_workload": result}
    except Exception as e:
        logger.error(f"❌ Error computing today's workload: {str(e)}")
        raise


@saved_router.delete("/{id}")
def delete_saved(id: int, db: Session = Depends(get_db)):
    """Delete a saved timetable."""
    logger.info(f"🗑️ Deleting saved timetable #{id}")
    try:
        row = db.query(SavedTimetable).filter(SavedTimetable.id == id).first()
        if not row:
            logger.warning(f"⚠️ Saved timetable #{id} not found for deletion")
            raise HTTPException(status_code=404, detail="Not found")
        
        timetable_label = row.label  # Store for logging
        db.delete(row)
        db.commit()
        
        logger.info(f"✅ Saved timetable #{id} deleted (label: '{timetable_label}')")
        
        # ⭐ LOG TO AUDIT TRAIL (IMPORTANT ACTION)
        AuditService.log_action(
            db=db,
            action="DELETE_TIMETABLE",
            entity_type="TIMETABLE",
            entity_id=id,
            description=f"Timetable deleted (label: '{timetable_label}')"
        )
        
        return {"message": "Deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete saved timetable #{id}: {str(e)}")
        raise


def _serialize(row: "SavedTimetable") -> dict:
    """Convert a SavedTimetable ORM row to a JSON-safe dict."""
    def _parse(val):
        if val is None:
            return None
        if isinstance(val, (list, dict)):
            return val
        try:
            return json.loads(val)
        except Exception:
            return val

    return {
        "id":             row.id,
        "label":          row.label,
        "section_id":     row.section_id,
        "room_id":        row.room_id,
        "total_students": row.total_students,
        "wef":            row.wef,
        "created_at":     str(row.created_at) if hasattr(row, "created_at") and row.created_at else None,
        "timetable_data": _parse(row.timetable_data),
        "subject_config": _parse(row.subject_config),
        "lab_config":     _parse(row.lab_config),
        "pinned_slots":   _parse(row.pinned_slots),
    }