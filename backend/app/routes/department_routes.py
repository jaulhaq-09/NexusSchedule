from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database.db import SessionLocal
from app.models.department import Department
from app.models.user import User
from app.routes.auth_routes import require_admin, get_current_user

router = APIRouter(tags=["Departments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DepartmentIn(BaseModel):
    name: str
    code: str
    short_name: Optional[str] = None
    hod_name: Optional[str] = None
    hod_email: Optional[str] = None


def _out(d: Department):
    return {
        "id": d.id, "name": d.name, "code": d.code, "short_name": d.short_name,
        "hod_name": d.hod_name, "hod_email": d.hod_email, "is_active": d.is_active,
    }


@router.get("/departments")
def list_departments(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    return [_out(d) for d in db.query(Department).order_by(Department.code).all()]


@router.post("/departments")
def create_department(data: DepartmentIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    code = data.code.strip().upper()
    if not data.name.strip() or not code:
        raise HTTPException(400, "Name and code are required")
    if db.query(Department).filter(Department.code == code).first():
        raise HTTPException(400, f"Department code '{code}' already exists")
    d = Department(
        name=data.name.strip(), code=code,
        short_name=(data.short_name or "").strip() or None,
        hod_name=(data.hod_name or "").strip() or None,
        hod_email=(data.hod_email or "").strip().lower() or None,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _out(d)


@router.put("/departments/{dept_id}")
def update_department(dept_id: int, data: DepartmentIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(404, "Department not found")
    code = data.code.strip().upper()
    clash = db.query(Department).filter(Department.code == code, Department.id != dept_id).first()
    if clash:
        raise HTTPException(400, f"Department code '{code}' already exists")
    d.name = data.name.strip()
    d.code = code
    d.short_name = (data.short_name or "").strip() or None
    d.hod_name = (data.hod_name or "").strip() or None
    d.hod_email = (data.hod_email or "").strip().lower() or None
    db.commit()
    db.refresh(d)
    return _out(d)


@router.delete("/departments/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(404, "Department not found")
    d.is_active = False   # soft delete, so sections and faculty keep their link
    db.commit()
    return {"message": "Department deactivated"}