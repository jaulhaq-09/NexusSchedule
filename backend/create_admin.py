"""
backend/create_admin.py
────────────────────────
One-time script to create the first admin account.
Run this once: python create_admin.py
"""

from app.database.db import SessionLocal
from app.models.user import User

def create_admin():
    db = SessionLocal()
    try:
        email = input("Admin email: ").strip().lower()
        name = input("Admin name: ").strip()
        password = input("Admin password: ").strip()

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = "admin"
            if password:
                existing.set_password(password)
            db.commit()
            print(f"✅ User '{email}' was found and successfully promoted to 'admin'!")
            return

        admin = User(name=name or email.split("@")[0], email=email, role="admin")
        admin.set_password(password)
        db.add(admin)
        db.commit()
        print(f"✅ Admin account created: {email}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()