from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.db import Base


class Section(Base):
    __tablename__ = "sections"

    id           = Column(Integer, primary_key=True, index=True)
    section_name = Column(String, nullable=False)
    semester     = Column(Integer, nullable=False)
    cluster      = Column(Integer, default=1, nullable=False)
    
    # 🔥 UPGRADE #2: Add department foreign key
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # 🔥 UPGRADE #2: Add relationship (optional, for eager loading)
    # department = relationship("Department", foreign_keys=[department_id])