from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.db import Base
import bcrypt


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user")  # "admin" | "faculty" | "user"
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=True)  # linked when role="faculty"
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # NULL = college-wide
    cluster = Column(Integer, nullable=True)
    must_change_password = Column(Boolean, default=False)                                     # NULL = all clusters
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_password(self, password: str):
        """Hash and set the password"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Verify password against hash"""
        if not self.password_hash:
            return False
        return bcrypt.checkpw(
            password.encode('utf-8'), 
            self.password_hash.encode('utf-8')
        )

    def to_dict(self):
        """Serialize user to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "faculty_id": self.faculty_id,
            "department_id": self.department_id,
            "cluster": self.cluster,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }