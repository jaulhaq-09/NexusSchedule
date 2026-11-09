"""
Import all models to register them with SQLAlchemy
"""

from app.models.user import User
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.room import Room
from app.models.section import Section
from app.models.timeslot import TimeSlot
from app.models.workspace import Workspace
from app.models.institution_config import InstitutionConfig
from app.models.department import Department
from app.models.metrics_snapshot import MetricsSnapshot

from app.database.db import Base  # 🔥 ADD THIS LINE

# Optional models - import with try/except
try:
    from app.models.lab import Lab
except ImportError:
    pass

try:
    from app.models.saved_timetable import SavedTimetable
except ImportError:
    pass

try:
    from app.models.faculty_availability import FacultyAvailability
except ImportError:
    pass

try:
    from app.models.additional_class import AdditionalClass
except ImportError:
    pass

__all__ = [
    "User",
    "Faculty",
    "Subject",
    "Room",
    "Section",
    "TimeSlot",
    "Workspace",
    "InstitutionConfig",
    "Department",
    "MetricsSnapshot",
]