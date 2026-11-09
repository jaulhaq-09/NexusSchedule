from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.db import Base


class Faculty(Base):
    __tablename__ = "faculty"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    designation = Column(String, nullable=True)
    subjects    = Column(String, nullable=True)  # comma-separated
    workload    = Column(Integer, nullable=True)
    # ✅ NEW: comma-separated lab names this faculty teaches, matched by
    # exact string against Lab.lab_name — same pattern as `subjects`.
    labs        = Column(String, nullable=True)
    email         = Column(String, nullable=True, index=True)
    phone         = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    cluster       = Column(Integer, nullable=True)

    # ✅ REMOVED: the old `labs = relationship("Lab", back_populates="faculty")`
    # is gone — Lab no longer has a faculty_id foreign key to relate through.
    # Faculty↔Lab matching is now purely by string comparison (see
    # lab_routes.py's _build()), not a DB relationship.