from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services import ai_service
from app.database.db import get_db
from app.models.subject import Subject
from app.models.faculty import Faculty
from app.routes.auth_routes import require_admin

router = APIRouter(prefix="/ai", tags=["AI"], dependencies=[Depends(require_admin)])

class CoordinatorRequest(BaseModel):
    subject_id: int
@router.get("/suggest-coordinators-bulk")
def suggest_coordinators_bulk(db: Session = Depends(get_db)):
    subjects = db.query(Subject).all()
    all_faculty = db.query(Faculty).all()

    payload = []
    no_match_ids = []
    eligible_by_subject = {}  # subject_id -> list of real Faculty ORM objects, for ID lookup

    for subject in subjects:
        eligible = [
            f for f in all_faculty
            if subject.subject_name.lower() in (f.subjects or "").lower()
        ]
        if not eligible:
            no_match_ids.append(subject.id)
            continue

        eligible_by_subject[subject.id] = eligible

        payload.append({
            "subject_id": subject.id,
            "subject_name": subject.subject_name,
            "faculty": [{
                "name": f.name,
                "designation": getattr(f, "designation", "Faculty"),
                "subjects": f.subjects,
            } for f in eligible],
        })

    results = {sid: {"error": "No eligible faculty found"} for sid in no_match_ids}

    if payload:
        try:
            batch_result = ai_service.suggest_coordinators_batch(payload)
            for item in payload:
                sid_str = str(item["subject_id"])
                if sid_str in batch_result:
                    suggestions = batch_result[sid_str]
                    # Resolve each suggestion's real faculty_id by matching name —
                    # never trust the AI to invent or echo back a numeric ID.
                    name_to_id = {f.name: f.id for f in eligible_by_subject[item["subject_id"]]}
                    for s in suggestions:
                        s["faculty_id"] = name_to_id.get(s.get("faculty_name"))
                    results[item["subject_id"]] = {"suggestions": suggestions}
                else:
                    results[item["subject_id"]] = {"error": "AI did not return a result for this subject"}
        except Exception as e:
            print(f"[AI BULK] Batch call failed: {repr(e)}")
            for item in payload:
                results[item["subject_id"]] = {"error": str(e)}

    print(f"[AI BULK] Done (single API call). {len(payload)} subjects sent, {len(no_match_ids)} skipped (no faculty)")
    return {"results": results}

@router.post("/assign-coordinator")
def assign_coordinator(subject_id: int, faculty_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(404, "Subject not found")
    subject.coordinator_faculty_id = faculty_id
    subject.coordinator_assigned_at = datetime.utcnow()
    db.commit()
    return {"status": "assigned"}

@router.get("/identify-core-subjects")
def identify_core_subjects(db: Session = Depends(get_db)):
    subjects = db.query(Subject).all()
    names = [s.subject_name for s in subjects]

    # No fallback — if Gemini fails, the request fails honestly instead of
    # silently substituting a hardcoded keyword match for a real AI decision.
    try:
        core_names = ai_service.identify_core_subjects(names)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI classification failed: {str(e)}")

    for s in subjects:
        s.is_core = s.subject_name in core_names
    db.commit()
    return {"core_subjects": core_names}