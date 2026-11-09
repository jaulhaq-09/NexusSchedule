import os
import json
import html
import secrets
import string
import urllib.request
import urllib.error
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.models.user import User
from app.models.faculty import Faculty
from app.routes import auth_routes
from app.routes.auth_routes import require_admin

router = APIRouter(prefix="/auth/users", tags=["Invites"])

ALLOWED_ROLES = {"faculty", "coordinator", "admin"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class InviteIn(BaseModel):
    name: str
    email: str
    role: str = "faculty"
    department_id: Optional[int] = None
    cluster: Optional[int] = None
    faculty_id: Optional[int] = None


# ── helpers ────────────────────────────────────────────────────────────────

_ALPHABET = "".join(c for c in (string.ascii_letters + string.digits) if c not in "0O1lI")


def _temp_password(length: int = 10) -> str:
    while True:
        pw = "".join(secrets.choice(_ALPHABET) for _ in range(length))
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw):
            return pw


def _send_brevo(to_email: str, to_name: str, subject: str, html_body: str):
    """Send one transactional email through Brevo. Returns (ok, error_message)."""
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "").strip()
    sender_name = os.getenv("BREVO_SENDER_NAME", "NexusSchedule").strip() or "NexusSchedule"
    if not api_key or not sender_email:
        return False, "Email is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL missing in .env)"

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html_body,
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return (200 <= resp.status < 300), None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")[:300]
        return False, f"Brevo error {e.code}: {body}"
    except Exception as e:
        return False, f"Could not reach Brevo: {e}"


def _credentials_email(user: User, temp_password: str, reissued: bool = False):
    app_url = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
    name = html.escape(user.name or "")
    email = html.escape(user.email)
    pw = html.escape(temp_password)
    role = html.escape(user.role)
    intro = (
        "Your NexusSchedule password has been reset by the administrator."
        if reissued
        else "An account has been created for you on NexusSchedule, the academic timetable system."
    )
    body = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">
      <h2 style="color:#b45309;margin-bottom:4px">NexusSchedule</h2>
      <p>Hello {name},</p>
      <p>{intro}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 14px 6px 0;color:#64748b">Username</td><td style="padding:6px 0"><b>{email}</b></td></tr>
        <tr><td style="padding:6px 14px 6px 0;color:#64748b">Temporary password</td><td style="padding:6px 0"><b style="font-family:monospace;font-size:16px">{pw}</b></td></tr>
        <tr><td style="padding:6px 14px 6px 0;color:#64748b">Role</td><td style="padding:6px 0">{role}</td></tr>
      </table>
      <p><a href="{app_url}/login" style="background:#EAB308;color:#0A0C12;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Log in</a></p>
      <p style="color:#64748b;font-size:13px">You will be asked to choose a new password the first time you log in. If you did not expect this email, you can ignore it.</p>
    </div>
    """
    subject = "Your NexusSchedule password was reset" if reissued else "Your NexusSchedule account"
    return subject, body


def _user_out(u: User) -> dict:
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role,
        "faculty_id": u.faculty_id, "department_id": u.department_id,
        "cluster": u.cluster, "is_active": u.is_active,
    }


# ── routes ─────────────────────────────────────────────────────────────────

@router.post("/invite")
def invite_user(data: InviteIn, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    name = (data.name or "").strip()
    email = (data.email or "").strip().lower()
    role = (data.role or "").strip().lower()

    if not name:
        raise HTTPException(400, "Name is required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid email address")
    if role not in ALLOWED_ROLES:
        raise HTTPException(400, "Role must be faculty, coordinator or admin")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "A user with this email already exists")

    department_id = data.department_id
    cluster = data.cluster
    if role in ("faculty", "coordinator"):
        if not department_id or not cluster or cluster < 1:
            raise HTTPException(400, "Department and cluster are required for faculty and coordinators")
        exists = db.execute(text("SELECT 1 FROM departments WHERE id = :i"), {"i": department_id}).first()
        if not exists:
            raise HTTPException(400, "Department not found")
    else:
        department_id = None
        cluster = None

    if role == "coordinator":
        clash = db.query(User).filter(
            User.role == "coordinator", User.is_active == True,
            User.department_id == department_id, User.cluster == cluster,
        ).first()
        if clash:
            raise HTTPException(400, f"{clash.name} is already the coordinator for this department and cluster")

    faculty_id = None  # logins are not linked to faculty records

    temp_pw = _temp_password()
    user = User(
        name=name, email=email, role=role, faculty_id=faculty_id,
        department_id=department_id, cluster=cluster,
        is_active=True, must_change_password=True,
    )
    user.set_password(temp_pw)
    db.add(user)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Could not create user: {e}")
    db.refresh(user)

    subject, body = _credentials_email(user, temp_pw)
    sent, err = _send_brevo(user.email, user.name, subject, body)

    out = {"user": _user_out(user), "email_sent": sent, "email_error": err}
    if not sent:
        out["temp_password"] = temp_pw  # shown once so the admin can share it manually
    return out


@router.post("/{user_id}/resend-credentials")
def resend_credentials(user_id: int, db: Session = Depends(get_db), _a: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    temp_pw = _temp_password()
    user.set_password(temp_pw)
    user.must_change_password = True
    db.commit()

    try:
        fails = getattr(auth_routes, "_LOGIN_FAILS", None)
        if isinstance(fails, dict):
            fails.pop(user.email.lower(), None)
    except Exception:
        pass

    subject, body = _credentials_email(user, temp_pw, reissued=True)
    sent, err = _send_brevo(user.email, user.name, subject, body)

    out = {"email_sent": sent, "email_error": err}
    if not sent:
        out["temp_password"] = temp_pw
    return out