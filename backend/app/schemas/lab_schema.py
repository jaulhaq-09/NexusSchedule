"""
Enhanced Lab Schemas with Batch Support
Location: backend/app/schemas/lab_schema.py
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LabBase(BaseModel):
    lab_name: str = Field(..., description="Lab name with batch suffix (e.g., MAT-A)")
    lab_code: Optional[str] = Field(None, description="Lab code (e.g., DFVE434)")
    batch: Optional[str] = Field(None, description="Batch identifier: A, B, or NULL")
    hours_per_week: int = Field(2, ge=1, le=10, description="Hours per week")
    paired_lab_name: Optional[str] = Field(None, description="lab_name of another Lab this one is paired with for batch-split scheduling")
    room_id: Optional[int] = Field(None, description="FK to Room.id — the physical room this lab is held in")
    # ✅ No faculty fields here anymore — faculty is no longer part of what
    # you write when creating/updating a lab. It's derived automatically.

class LabCreate(LabBase):
    pass

class LabUpdate(BaseModel):
    lab_name: Optional[str] = None
    lab_code: Optional[str] = None
    batch: Optional[str] = None
    hours_per_week: Optional[int] = None
    paired_lab_name: Optional[str] = None
    room_id: Optional[int] = None

class LabResponse(LabBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class LabWithFaculty(LabResponse):
    """Lab response with auto-matched faculty (computed, not stored)"""
    faculty_ids: List[int] = Field(default_factory=list, description="Computed: faculty whose `labs` field exactly matches this lab's name")
    faculty_names: List[str] = Field(default_factory=list)
    # ✅ Resolved from room_id by the route's _build(), same pattern as
    # faculty_ids/faculty_names — not stored redundantly on Lab itself.
    room_name: Optional[str] = Field(None, description="Resolved from room_id")
    room_type: Optional[str] = Field(None, description="Resolved from room_id")
    
    class Config:
        from_attributes = True