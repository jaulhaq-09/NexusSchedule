"""
app/models/teaching_assignment.py
Who teaches what, to which section, in which term.
A "term" = academic_year + parity ("odd" / "even"), the same notion the
busy-slots conflict check already uses. Faculty stay in their department and
cluster; only these rows change from semester to semester.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.database.db import Base


class TeachingAssignment(Base):
    __tablename__ = "teaching_assignments"

    id            = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String, nullable=False, index=True)      # e.g. "2025-26"
    parity        = Column(String, nullable=False)                  # "odd" | "even"
    section_id    = Column(Integer, nullable=False, index=True)
    subject_name  = Column(String, nullable=False)
    kind          = Column(String, nullable=False, default="theory")  # "theory" | "lab"
    faculty_id    = Column(Integer, ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    hours_per_week = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("academic_year", "parity", "section_id", "subject_name", "kind",
                         name="uq_teaching_assignment"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "academic_year": self.academic_year,
            "parity": self.parity,
            "section_id": self.section_id,
            "subject_name": self.subject_name,
            "kind": self.kind,
            "faculty_id": self.faculty_id,
            "hours_per_week": self.hours_per_week,
        }