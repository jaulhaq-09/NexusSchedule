from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.db import Base


class Room(Base):
    __tablename__ = "rooms"

    id        = Column(Integer, primary_key=True, index=True)
    room_name = Column(String, nullable=False)
    room_type = Column(String, nullable=False)   # CLASS | LAB | SEMINAR
    capacity  = Column(Integer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # NULL = shared (legacy)