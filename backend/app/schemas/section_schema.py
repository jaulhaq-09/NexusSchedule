from pydantic import BaseModel
from typing import Optional


class SectionCreate(BaseModel):
    section_name: str
    semester:     int
    cluster:      int = 1
    department_id: Optional[int] = None