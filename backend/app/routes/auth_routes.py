"""
app/routes/auth_routes.py
─────────────────────────
NO prefix here — prefix="/auth" is set in main.py.
Final URLs:  POST /auth/login  |  GET /auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

# ── JWT ───────────────────────────────────────────────────────
try:
    import jwt as _jwt
    def _jwt_encode(data): return _jwt.encode(data, _SECRET, algorithm=_ALG)
    def _jwt_decode(tok):  return _jwt.decode(tok,  _SECRET, algorithms=[_ALG])
    _JWTError = _jwt.PyJWTError
except ImportError:
    raise RuntimeError("PyJWT missing — run:  pip install PyJWT")

# ── bcrypt ────────────────────────────────────────────────────
try:
    import bcrypt as _bcrypt
    def hash_password(pw: str) -> str:
        return _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt()).decode()
    def verify_password(plain: str, hashed: str) -> bool:
        try:   return _bcrypt.checkpw(plain.encode(), hashed.encode())
        except Exception: return False
except ImportError:
    try:
        from passlib.context import CryptContext
        _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        def hash_password(pw: str) -> str:          return _ctx.hash(pw)
        def verify_password(plain: str, h: str):
            try:   return _ctx.verify(plain, h)
            except Exception: return False
    except ImportError:
        raise RuntimeError("bcrypt / passlib missing — run:  pip install bcrypt passlib")

import json
from app.database.db import SessionLocal
from app.models.user import User
from app.models.faculty import Faculty
from app.models.saved_timetable import SavedTimetable
from app.models.section import Section
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from pydantic import BaseModel


class RoleUpdate(BaseModel):
    role: str
    faculty_id: Optional[int] = None
    department_id: Optional[int] = None
    cluster: Optional[int] = None

class StatusUpdate(BaseModel):
    is_active: bool

class ProfileUpdate(BaseModel):
    name: str

router   = APIRouter(tags=["Auth"])   # prefix added by main.py
_SECRET  = SECRET_KEY
_ALG     = ALGORITHM
_EXP_MIN = ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Login throttle: 5 wrong passwords locks that email for 5 minutes (in memory;
# resets when the server restarts).
_LOGIN_FAILS = {}
_MAX_FAILS = 5
_LOCK_MIN = 5


def _user_payload(user):
    d = user.to_dict()
    d["must_change_password"] = bool(getattr(user, "must_change_password", False))
    return d


def get_db():
    db = SessionLocal()
    try:    yield db
    finally: db.close()


class LoginRequest(BaseModel):
    email:    str
    password: str


def _make_token(email: str) -> str:
    return _jwt_encode({
        "sub": email,
        "exp": datetime.utcnow() + timedelta(minutes=_EXP_MIN),
    })


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials",
                        headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = _jwt_decode(token)
        email   = payload.get("sub")
        if not email:
            raise exc
    except _JWTError:
        raise exc

    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user or not user.is_active:
        raise exc
    return user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return current_user

def require_editor(current_user: User = Depends(get_current_user)):
    """Admin (college-wide) or cluster coordinator."""
    if current_user.role not in ("admin", "coordinator"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Editor access required")
    return current_user


def in_scope(user: User, department_id, cluster) -> bool:
    """True if this user may touch data of the given department/cluster.
    A user with no department/cluster set is not limited on that level."""
    if user.department_id is not None and department_id != user.department_id:
        return False
    if user.cluster is not None and cluster != user.cluster:
        return False
    return True

# ── POST /auth/login ──────────────────────────────────────────
@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    now = datetime.utcnow()

    rec = _LOGIN_FAILS.get(email)
    if rec and rec["locked_until"] and rec["locked_until"] > now:
        mins = int((rec["locked_until"] - now).total_seconds() // 60) + 1
        raise HTTPException(429, f"Too many failed attempts. Try again in {mins} minute(s).")

    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active or not user.check_password(data.password):
        rec = _LOGIN_FAILS.setdefault(email, {"count": 0, "locked_until": None})
        rec["count"] += 1
        if rec["count"] >= _MAX_FAILS:
            rec["count"] = 0
            rec["locked_until"] = now + timedelta(minutes=_LOCK_MIN)
        raise HTTPException(401, "Invalid email or password")

    _LOGIN_FAILS.pop(email, None)

    return {
        "access_token": _make_token(user.email),
        "token_type":   "bearer",
        "user": _user_payload(user),
    }

@router.post("/signup")
def signup(data: UserCreate, db: Session = Depends(get_db)):
    # Public signup is closed. Accounts are created by the admin
    # (POST /auth/users) for imported faculty only.
    raise HTTPException(403, "Signup is disabled. Contact your administrator for access.")

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return _user_payload(current_user)

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ── POST /auth/change-password (any logged-in user) ─────────────
@router.post("/change-password")
def change_password(data: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.check_password(data.current_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    if data.new_password == data.current_password:
        raise HTTPException(400, "New password must be different from the current one")
    current_user.set_password(data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password updated"}


# ── GET /auth/users (admin only) ────────────────────────────────
@router.get("/users")
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [u.to_dict() for u in users]

# ── POST /auth/users (admin creates a user/admin/faculty) ──────
@router.post("/users")
def create_user(data: UserCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    email = data.email.strip().lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")

    role = data.role if data.role in ("admin", "faculty", "coordinator", "user") else "user"

    new_user = User(
        name=data.name or email.split("@")[0],
        email=email,
        role=role,
        faculty_id=data.faculty_id if role == "faculty" else None,
    )
    new_user.set_password(data.password)
    new_user.must_change_password = True
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user.to_dict()

class FacultyAccountCreate(BaseModel):
    faculty_id: int
    password: Optional[str] = None   # admin-set first password; auto-generated if blank


# ── POST /auth/users/from-faculty (admin creates login for an imported faculty) ──
@router.post("/users/from-faculty")
def create_user_from_faculty(data: FacultyAccountCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    import secrets
    fac = db.query(Faculty).filter(Faculty.id == data.faculty_id).first()
    if not fac:
        raise HTTPException(404, "Faculty not found")

    email = (fac.email or "").strip().lower()
    if not email:
        raise HTTPException(400, f"{fac.name} has no email. Add an email to the faculty record first.")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "A login already exists for this faculty")
    if db.query(User).filter(User.faculty_id == fac.id).first():
        raise HTTPException(400, "This faculty is already linked to a login")

    pw = (data.password or "").strip() or secrets.token_urlsafe(6)
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    new_user = User(name=fac.name, email=email, role="faculty", faculty_id=fac.id,
                    department_id=fac.department_id, cluster=fac.cluster)
    new_user.set_password(pw)
    new_user.must_change_password = True
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # password is returned once so the admin can hand it over
    return {**new_user.to_dict(), "temp_password": pw}

# ── PATCH /auth/users/{id}/role (admin changes a user's role/faculty link) ──
@router.patch("/users/{user_id}/role")
def update_user_role(user_id: int, data: RoleUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if data.role not in ("admin", "faculty", "coordinator", "user"):
        raise HTTPException(400, "Role must be 'admin', 'faculty', 'coordinator', or 'user'")

    if user_id == _admin.id and data.role != "admin":
        raise HTTPException(400, "You cannot remove your own admin role")


    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")

    if data.role == "coordinator" and (not data.department_id or not data.cluster):
        raise HTTPException(400, "A coordinator needs a department and a cluster")

    target.role = data.role
    if data.role == "coordinator" or (data.role == "faculty" and data.department_id):
        target.department_id = data.department_id
        target.cluster = data.cluster
    elif data.role in ("admin", "user"):
        # admins are college-wide: never keep a leftover department/cluster scope
        target.department_id = None
        target.cluster = None
    # Admins may optionally be linked to a faculty record too (e.g. a
    # department head who also teaches); "faculty" role always requires one.
    target.faculty_id = data.faculty_id if data.role in ("faculty", "admin", "coordinator") else None
    db.commit()
    db.refresh(target)

    return target.to_dict()


# ── PATCH /auth/users/{id}/status (admin activates/deactivates) ─
@router.patch("/users/{user_id}/status")
def update_user_status(user_id: int, data: StatusUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if user_id == _admin.id and not data.is_active:
        raise HTTPException(400, "You cannot deactivate your own account")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")

    target.is_active = data.is_active
    db.commit()
    db.refresh(target)

    return target.to_dict()

# ── PATCH /auth/users/{id}/profile (admin edits a user's name) ──
@router.patch("/users/{user_id}/profile")
def update_user_profile(user_id: int, data: ProfileUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Name cannot be empty")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")

    target.name = name
    db.commit()
    db.refresh(target)

    return target.to_dict()

class PasswordReset(BaseModel):
    password: str


# ── POST /auth/users/{id}/reset-password (admin sets a new temporary password) ──
@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    pw = (data.password or "").strip()
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")

    target.set_password(pw)
    target.must_change_password = True
    _LOGIN_FAILS.pop(target.email, None)   # also clears a login lockout
    db.commit()

    return {"message": "Password reset. The user must choose a new one at next login."}


# ── DELETE /auth/users/{id} (admin permanently deletes a user) ──
@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if user_id == _admin.id:
        raise HTTPException(400, "You cannot delete your own account")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")

    db.delete(target)
    db.commit()

    return {"message": "User deleted"}
