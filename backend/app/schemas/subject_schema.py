from pydantic import BaseModel
from typing import Optional

class SubjectCreate(BaseModel):
    subject_name:    str
    subject_code:    str
    hours_per_week:  Optional[int] = 4
    subject_type:    Optional[str] = "THEORY"   # THEORY | LAB
    course_category: Optional[str] = None       # ASC, IPCC, PCC, PCCL, HSMC, AEC, PW, SL, NCMC
    semester:        Optional[int] = None       # 1-8
    department_id:   Optional[int] = None       # None / 0 = common to all departments


class SubjectUpdate(BaseModel):
    subject_name:    Optional[str] = None
    subject_code:    Optional[str] = None
    hours_per_week:  Optional[int] = None
    subject_type:    Optional[str] = None
    course_category: Optional[str] = None
    semester:        Optional[int] = None


class SubjectOut(BaseModel):
    id:              int
    subject_name:    str
    subject_code:    str
    hours_per_week:  Optional[int]
    subject_type:    Optional[str]
    is_core:         Optional[bool] = False
    course_category: Optional[str] = None
    semester:        Optional[int] = None
    department_id:   Optional[int] = None

    class Config:
        from_attributes = True