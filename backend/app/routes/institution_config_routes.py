"""
Institution Configuration Routes
Manages timetable structure template
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import shutil
import os
from pathlib import Path
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.deps import get_active_workspace
from app.models.workspace import Workspace
from app.models.user import User
from app.routes.auth_routes import require_admin
from app.models.institution_config import InstitutionConfig
from app.models.timeslot import TimeSlot
from app.schemas.institution_config_schema import (
    InstitutionConfigCreate,
    InstitutionConfigUpdate,
    InstitutionConfigResponse,
    StructureInfo
)

router = APIRouter(tags=["Institution Configuration"])


def get_or_create_config(db: Session, workspace_id: int) -> InstitutionConfig:
    """Get existing config or create default"""
    config = db.query(InstitutionConfig).filter(
        InstitutionConfig.workspace_id == workspace_id
    ).first()

    if not config:
        config = InstitutionConfig(workspace_id=workspace_id)
        db.add(config)
        db.commit()
        db.refresh(config)

    return config


# ═══════════════════════════════════════════════════════════════════════════════
# GET ROUTES  (left open: branding/structure is read by public pages too)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/", response_model=InstitutionConfigResponse)
@router.get("")  # 🔥 Handle both /institution-config and /institution-config/
def get_config(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace)
):
    """Get timetable structure configuration"""
    config = get_or_create_config(db, workspace.id)
    return config


@router.get("/structure-info")
def get_structure_info(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace)
):
    """Get quick structure information"""
    config = get_or_create_config(db, workspace.id)

    return {
        "working_days": config.working_days,
        "slot_template": config.slot_template,
        "semester_count": config.semester_count,
        "cluster_enabled": config.cluster_enabled,
        "cluster_count": config.cluster_count,
        "institution_name": config.institution_name,
        "institution_address": config.institution_address,
        "department_name": config.department_name,
        "logo_url": config.logo_url
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PUT ROUTES (UPDATE)  — admin only
# ═══════════════════════════════════════════════════════════════════════════════

@router.put("/", response_model=InstitutionConfigResponse)
@router.put("")  # 🔥 Handle both /institution-config and /institution-config/
def update_config(
    config_data: InstitutionConfigUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace),
    _a: User = Depends(require_admin)
):
    """Update timetable structure configuration"""
    config = get_or_create_config(db, workspace.id)

    # Update structure fields
    config.working_days = config_data.working_days
    config.slot_template = config_data.slot_template
    config.semester_count = config_data.semester_count
    config.cluster_enabled = config_data.cluster_enabled
    config.cluster_count = config_data.cluster_count

    # Update branding fields
    if config_data.institution_name:
        config.institution_name = config_data.institution_name
    if config_data.institution_address:
        config.institution_address = config_data.institution_address
    if config_data.department_name:
        config.department_name = config_data.department_name

    db.commit()
    db.refresh(config)

    return config


# ═══════════════════════════════════════════════════════════════════════════════
# POST ROUTES (CREATE/ACTION)  — admin only
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/apply-structure")
@router.post("apply-structure")  # 🔥 Handle both /apply-structure and apply-structure
def apply_structure(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace),
    _a: User = Depends(require_admin)
):
    """
    Apply the configured structure to timeslots table.
    This generates individual timeslots for each day based on the template.
    """
    try:
        config = get_or_create_config(db, workspace.id)

        # Clear existing timeslots for this workspace
        db.query(TimeSlot).filter(
            TimeSlot.workspace_id == workspace.id
        ).delete()

        # Generate timeslots for each working day
        count = 0
        for day in config.working_days:
            for slot in config.slot_template:
                timeslot = TimeSlot(
                    day=day,
                    start_time=slot["start_time"],
                    end_time=slot["end_time"],
                    slot_type=slot["slot_type"],
                    workspace_id=workspace.id
                )
                db.add(timeslot)
                count += 1

        db.commit()

        return {
            "success": True,
            "message": f"Generated {count} timeslots",
            "days": len(config.working_days),
            "slots_per_day": len(config.slot_template),
            "total_slots": count
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error applying structure: {str(e)}")


@router.post("/reset")
@router.post("reset")  # 🔥 Handle both
def reset_to_default(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace),
    _a: User = Depends(require_admin)
):
    """Reset configuration to default values"""
    try:
        config = db.query(InstitutionConfig).filter(
            InstitutionConfig.workspace_id == workspace.id
        ).first()

        if config:
            db.delete(config)
            db.commit()

        # Create new default config
        config = InstitutionConfig(workspace_id=workspace.id)
        db.add(config)
        db.commit()
        db.refresh(config)

        return config

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error resetting config: {str(e)}")


@router.post("/validate-template")
@router.post("validate-template")  # 🔥 Handle both
def validate_template(slots: list):
    """Validate slot template before saving"""
    errors = []

    if len(slots) == 0:
        errors.append("At least one slot is required")

    # Check required fields
    for i, slot in enumerate(slots):
        if not slot.get("label"):
            errors.append(f"Slot {i+1}: label is required")
        if not slot.get("start_time"):
            errors.append(f"Slot {i+1}: start_time is required")
        if not slot.get("end_time"):
            errors.append(f"Slot {i+1}: end_time is required")
        if not slot.get("slot_type"):
            errors.append(f"Slot {i+1}: slot_type is required")
        if slot.get("slot_type") not in ["PERIOD", "BREAK", "LUNCH"]:
            errors.append(f"Slot {i+1}: slot_type must be PERIOD, BREAK, or LUNCH")

    # Check for time overlaps
    for i in range(len(slots) - 1):
        if slots[i].get("end_time") != slots[i+1].get("start_time"):
            errors.append(f"Gap/overlap between slot {i+1} and {i+2}")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "slot_count": len(slots),
        "period_count": len([s for s in slots if s.get("slot_type") == "PERIOD"]),
        "break_count": len([s for s in slots if s.get("slot_type") in ["BREAK", "LUNCH"]])
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FILE UPLOAD ROUTES  — admin only
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/upload-logo")
@router.post("upload-logo")  # 🔥 Handle both
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_active_workspace),
    _a: User = Depends(require_admin)
):
    """Upload institution logo"""

    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(400, "Only image files allowed")

        # Create logos directory if it doesn't exist
        logo_dir = Path("static/logos")
        logo_dir.mkdir(parents=True, exist_ok=True)

        # Save file
        file_ext = file.filename.split(".")[-1]
        filename = f"logo_{workspace.id}.{file_ext}"
        filepath = logo_dir / filename

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Update config
        config = get_or_create_config(db, workspace.id)
        config.logo_url = f"/static/logos/{filename}"
        db.commit()

        return {
            "success": True,
            "logo_url": config.logo_url,
            "message": "Logo uploaded successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error uploading logo: {str(e)}")