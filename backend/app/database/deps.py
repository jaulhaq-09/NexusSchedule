"""
Database Dependencies
"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.workspace import Workspace


def get_active_workspace(
    db: Session = Depends(get_db),
    workspace_id: int = Header(default=9, alias="X-Workspace-ID")
) -> Workspace:
    """
    Get or create the active workspace.
    Defaults to workspace_id=9 if header not provided.
    Auto-creates workspace if it doesn't exist.
    """
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.is_active == True
    ).first()
    
    if not workspace:
        # Auto-create default workspace
        workspace = Workspace(
            id=workspace_id,
            name=f"Workspace {workspace_id}",
            description="Auto-created default workspace",
            is_active=True
        )
        db.add(workspace)
        try:
            db.commit()
            db.refresh(workspace)
            print(f"[INFO] Created workspace {workspace_id}")
        except Exception as e:
            db.rollback()
            print(f"[ERROR] Failed to create workspace: {e}")
            raise HTTPException(500, "Failed to create workspace")
    
    return workspace