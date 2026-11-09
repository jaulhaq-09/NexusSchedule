from pydantic import BaseModel
from typing import List, Optional


class BulkFacultyItem(BaseModel):
    name:     str
    email:    Optional[str] = None
    subjects: Optional[str] = None


class BulkFacultyCreate(BaseModel):
    faculty: List[BulkFacultyItem]


class BulkRoomItem(BaseModel):
    room_name: str
    room_type: str
    capacity:  int


class BulkRoomCreate(BaseModel):
    rooms: List[BulkRoomItem]


class BulkSubjectItem(BaseModel):
    subject_name:  str
    subject_code:  str
    hours_per_week: Optional[int] = 4


class BulkSubjectCreate(BaseModel):
    subjects: List[BulkSubjectItem]


class BulkSectionItem(BaseModel):
    section_name: str
    semester:     int
    cluster:      int = 1


class BulkSectionCreate(BaseModel):
    sections: List[BulkSectionItem]