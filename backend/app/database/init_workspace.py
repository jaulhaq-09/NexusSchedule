"""
Initialize default workspace
Run this once to create workspace_id=9
"""

from app.database.db import SessionLocal
from app.models.workspace import Workspace


def init_default_workspace():
    db = SessionLocal()
    try:
        # Check if workspace 9 exists
        workspace = db.query(Workspace).filter(Workspace.id == 9).first()
        
        if not workspace:
            workspace = Workspace(
                id=9,
                name="My First Workspace",
                description="Default workspace for timetable management",
                is_active=True
            )
            db.add(workspace)
            db.commit()
            print("[SUCCESS] ✓ Default workspace (ID=9) created!")
        else:
            print("[INFO] Default workspace (ID=9) already exists")
    
    except Exception as e:
        print(f"[ERROR] Failed to create workspace: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_default_workspace()