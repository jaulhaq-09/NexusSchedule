from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from app.database.db import SessionLocal
from app.models.section import Section
from app.schemas.section_schema import SectionCreate
from app.models.user import User
from app.routes.auth_routes import require_admin, require_editor, in_scope, get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_cluster_column(db: Session):
    """Add cluster column if it doesn't exist yet (safe migration)."""
    try:
        inspector = inspect(db.bind)
        columns = [col["name"] for col in inspector.get_columns("sections")]
        if "cluster" not in columns:
            db.execute(text("ALTER TABLE sections ADD COLUMN cluster INTEGER NOT NULL DEFAULT 1"))
            db.commit()
    except Exception:
        db.rollback()


@router.post("/sections")
def create_section(data: SectionCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    ensure_cluster_column(db)
    section = Section(
        section_name = data.section_name.strip(),
        semester     = data.semester,
        cluster      = _a.cluster if _a.role == "coordinator" else data.cluster,
        department_id = _a.department_id if _a.role == "coordinator" else data.department_id,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.get("/sections")
def get_sections(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    ensure_cluster_column(db)
    q = db.query(Section)
    if _u.department_id is not None:
        q = q.filter(Section.department_id == _u.department_id)
    if _u.cluster is not None:
        q = q.filter(Section.cluster == _u.cluster)
    return q.order_by(
        Section.cluster, Section.semester, Section.section_name
    ).all()


@router.get("/sections/cluster/{cluster}/semester/{semester}")
def get_sections_by_cluster_semester(
    cluster: int, semester: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)
):
    ensure_cluster_column(db)
    q = db.query(Section).filter(Section.cluster == cluster, Section.semester == semester)
    if _u.department_id is not None:
        q = q.filter(Section.department_id == _u.department_id)
    if _u.cluster is not None and _u.cluster != cluster:
        return []
    return q.order_by(Section.section_name).all()


@router.get("/sections/{id}")
def get_section(id: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    section = db.query(Section).filter(Section.id == id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if not in_scope(_u, section.department_id, section.cluster):
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.put("/sections/{id}")
def update_section(id: int, data: SectionCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    ensure_cluster_column(db)
    section = db.query(Section).filter(Section.id == id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if not in_scope(_a, section.department_id, section.cluster):
        raise HTTPException(status_code=403, detail="This section belongs to another cluster")
    section.section_name = data.section_name.strip()
    section.semester     = data.semester
    if _a.role != "coordinator":
        section.cluster = data.cluster
        if data.department_id is not None:
            section.department_id = data.department_id
    db.commit()
    db.refresh(section)
    return section


@router.delete("/sections/{id}")
def delete_section(id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    section = db.query(Section).filter(Section.id == id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if not in_scope(_a, section.department_id, section.cluster):
        raise HTTPException(status_code=403, detail="This section belongs to another cluster")
    db.delete(section)
    db.commit()
    return {"message": "Section deleted"}

from typing import List

@router.post("/sections/bulk")
def bulk_create_sections(data: List[SectionCreate], db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    if not data:
        raise HTTPException(status_code=400, detail="No records provided")

    ensure_cluster_column(db)
    created = []
    errors = []

    for i, item in enumerate(data):
        try:
            section = Section(
                section_name = item.section_name.strip(),
                semester     = item.semester,
                cluster      = _a.cluster if _a.role == "coordinator" else item.cluster,
                department_id = _a.department_id if _a.role == "coordinator" else item.department_id,
            )
            db.add(section)
            created.append(section)
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    db.commit()
    for section in created:
        db.refresh(section)

    return {
        "imported": len(created),
        "errors": errors,
        "total": len(data),
        "sections": created,
    }