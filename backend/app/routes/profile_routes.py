from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.user import User
from app.routes.auth_routes import get_current_user, get_db

router = APIRouter(prefix="/auth/me", tags=["Profile"])

MAX_PHOTO_CHARS = 400_000  # ~300 KB as a base64 data URL (client resizes to ~256px)


class ProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None      # data URL, or "" to remove
    remove_photo: bool = False


def _read(db: Session, user_id: int):
    row = db.execute(text("SELECT phone, photo FROM users WHERE id = :i"), {"i": user_id}).first()
    return {"phone": row[0] if row else None, "photo": row[1] if row else None}


@router.get("/profile")
def get_my_profile(db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    return {"name": me.name, "email": me.email, "role": me.role, **_read(db, me.id)}


@router.put("/profile")
def update_my_profile(data: ProfileIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(400, "Name cannot be empty")
        me.name = name
    if data.phone is not None:
        phone = data.phone.strip()
        if phone and (len(phone) > 20 or not all(c.isdigit() or c in "+- ()" for c in phone)):
            raise HTTPException(400, "Enter a valid phone number")
        db.execute(text("UPDATE users SET phone = :p WHERE id = :i"), {"p": phone or None, "i": me.id})
    if data.remove_photo:
        db.execute(text("UPDATE users SET photo = NULL WHERE id = :i"), {"i": me.id})
    elif data.photo:
        if not data.photo.startswith("data:image/") or len(data.photo) > MAX_PHOTO_CHARS:
            raise HTTPException(400, "Photo must be an image under 300 KB")
        db.execute(text("UPDATE users SET photo = :p WHERE id = :i"), {"p": data.photo, "i": me.id})
    db.commit()
    return {"name": me.name, **_read(db, me.id)}