import os
from app.database.db import Base, engine
from app.models.user import User
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.room import Room
from app.models.section import Section
from app.models.timeslot import TimeSlot

# Import all other models
try:
    from app.models.saved_timetable import SavedTimetable
except:
    pass

try:
    from app.models.lab import Lab
except:
    pass

try:
    from app.models.faculty_availability import FacultyAvailability
except:
    pass

try:
    from app.models.additional_class import AdditionalClass
except:
    pass

def reset_database():
    """Drop all tables and recreate them"""
    
    print("⚠️  WARNING: This will delete all data!")
    response = input("Continue? (yes/no): ")
    
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    print("\n🗑️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("✅ Tables dropped")
    
    print("\n🔨 Creating new tables with updated schema...")
    Base.metadata.create_all(bind=engine)
    
    print("✅ Tables created with new schema")
    print("\n✅ Database reset complete!")
    print("\nNow run: python create_admin.py")

if __name__ == "__main__":
    reset_database()