"""
Initialize PostgreSQL database with all tables
Run this ONCE when switching to PostgreSQL
"""

from app.database.db import Base, engine
from app.models import (
    user, faculty, subject, room, section, 
    timetable, timeslot, workspace, 
    institution_config, department
)

# Optional models
try:
    from app.models import lab
except:
    pass

try:
    from app.models import saved_timetable
except:
    pass

try:
    from app.models import faculty_availability
except:
    pass

try:
    from app.models import additional_class
except:
    pass


def init_database():
    """Create all tables in PostgreSQL"""
    print("🔄 Creating all PostgreSQL tables...")
    
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        
        # Show created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print(f"\n📊 Created {len(tables)} tables:")
        for table in sorted(tables):
            columns = [col['name'] for col in inspector.get_columns(table)]
            print(f"   ✓ {table} ({len(columns)} columns)")
            
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise


if __name__ == "__main__":
    init_database()