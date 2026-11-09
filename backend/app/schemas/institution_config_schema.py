"""
Institution Configuration Schemas
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class SlotTemplateItem(BaseModel):
    """Individual time slot in the template"""
    label: str                    # "I", "II", "Break", "Lunch", etc.
    start_time: str              # "08:30"
    end_time: str                # "09:25"
    slot_type: str               # "PERIOD", "BREAK", "LUNCH"


class InstitutionConfigBase(BaseModel):
    """Base configuration schema"""
    working_days: List[str]      # ["Monday", "Tuesday", ...]
    slot_template: List[dict]    # List of slot definitions
    semester_count: Optional[int] = 8
    cluster_enabled: Optional[bool] = True
    cluster_count: Optional[int] = 4


class InstitutionConfigCreate(InstitutionConfigBase):
    """Schema for creating new configuration"""
    pass


class InstitutionConfigUpdate(BaseModel):
    """Schema for updating configuration"""
    working_days: List[str]
    slot_template: List[dict]
    semester_count: int = 8
    cluster_enabled: bool = True
    cluster_count: int = 4
    # Institution branding fields
    institution_name: Optional[str] = None
    institution_address: Optional[str] = None
    department_name: Optional[str] = None


class InstitutionConfigResponse(BaseModel):
    """Schema for configuration response"""
    id: int
    workspace_id: int
    working_days: List[str]
    slot_template: List[dict]
    semester_count: int
    cluster_enabled: bool
    cluster_count: int
    # Institution branding fields
    institution_name: Optional[str] = None
    institution_address: Optional[str] = None
    department_name: Optional[str] = None
    logo_url: Optional[str] = None
    # Audit fields
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StructureInfo(BaseModel):
    """Quick info about timetable structure"""
    working_days: List[str]
    slot_template: List[dict]
    semester_count: int
    cluster_enabled: bool
    cluster_count: int
    # Institution branding
    institution_name: Optional[str] = None
    institution_address: Optional[str] = None
    department_name: Optional[str] = None
    logo_url: Optional[str] = None