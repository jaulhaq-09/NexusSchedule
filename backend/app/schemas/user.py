"""
app/schemas/user.py
====================
Pydantic schemas used by auth_routes.py
"""

from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    """POST /auth/signup"""
    name:       Optional[str] = ""
    email:      str
    password:   str
    role:       Optional[str] = "admin"
    faculty_id: Optional[int] = None


class UserLogin(BaseModel):
    """POST /auth/login"""
    email:    str
    password: str


class UserOut(BaseModel):
    """Embedded in API responses"""
    id:    int
    name:  Optional[str] = ""
    email: str
    role:  Optional[str] = "admin"

    class Config:
        from_attributes = True