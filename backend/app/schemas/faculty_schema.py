from pydantic import BaseModel
from typing import Optional


class FacultyCreate(BaseModel):
    name:        str
    designation: Optional[str] = None
    subjects:    Optional[str] = None
    workload:    Optional[int] = None
    labs:        Optional[str] = None
    email:         Optional[str] = None
    phone:         Optional[str] = None
    department_id: Optional[int] = None
    cluster:       Optional[int] = None


class FacultyUpdate(BaseModel):
    name:        Optional[str] = None
    designation: Optional[str] = None
    subjects:    Optional[str] = None
    workload:    Optional[int] = None
    labs:        Optional[str] = None
    email:         Optional[str] = None
    phone:         Optional[str] = None
    department_id: Optional[int] = None
    cluster:       Optional[int] = None


class FacultyOut(BaseModel):
    id:          int
    name:        str
    designation: Optional[str] = None
    subjects:    Optional[str] = None
    workload:    Optional[int] = None
    labs:        Optional[str] = None
    email:         Optional[str] = None
    phone:         Optional[str] = None
    department_id: Optional[int] = None
    cluster:       Optional[int] = None

    class Config:
        from_attributes = True