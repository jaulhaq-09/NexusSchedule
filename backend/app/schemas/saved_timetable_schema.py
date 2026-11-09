from pydantic import BaseModel
from typing import Optional, Any, Dict, List


class SavedTimetableCreate(BaseModel):
    label:          Optional[str]  = ""
    section_id:     Optional[int]  = None
    room_id:        Optional[int]  = None
    total_students: Optional[str]  = ""
    wef:            Optional[str]  = ""
    timetable_data: Optional[Any]  = []
    subject_config: Optional[Any]  = []
    lab_config:     Optional[Any]  = []
    pinned_slots:   Optional[Any]  = {}


class SavedTimetableOut(BaseModel):
    id:             int
    label:          Optional[str]
    section_id:     Optional[int]
    room_id:        Optional[int]
    total_students: Optional[str]
    wef:            Optional[str]
    timetable_data: Optional[Any]
    subject_config: Optional[Any]
    lab_config:     Optional[Any]
    pinned_slots:   Optional[Any]
    created_at:     Optional[str]

    class Config:
        from_attributes = True