from sqlalchemy.orm import Session
from app.database.db import engine, Base, SessionLocal

# Import all models so they're registered with Base
from app.models.user import User
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.room import Room
from app.models.section import Section
from app.models.lab import Lab
from app.models.additional_class import AdditionalClass  # ← ADD THIS


def init_database():
    """
    Initialize database: drop all tables, recreate, and add admin user
    """
    print("=" * 60)
    print("🚀 DATABASE INITIALIZATION")
    print("=" * 60)
    
    # Step 1: Drop all existing tables
    print("\n🗑️  Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("✅ All tables dropped")
    
    # Step 2: Create all tables from models
    print("\n✨ Creating tables from models...")
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created:")
    print("   - users")
    print("   - faculty")
    print("   - subjects")
    print("   - rooms")
    print("   - sections")
    print("   - labs")
    
    # Step 3: Create admin user
    print("\n👤 Creating admin user...")
    db = SessionLocal()
    
    try:
        # Check if admin already exists (shouldn't, but just in case)
        existing_admin = db.query(User).filter(User.email == "admin@schedulo.com").first()
        
        if existing_admin:
            print("⚠️  Admin user already exists, skipping...")
        else:
            admin = User(
                name="Admin User",
                email="admin@schedulo.com",
                role="admin",
                is_active=True
            )
            admin.set_password("admin123")
            
            db.add(admin)
            db.commit()
            
            print("✅ Admin user created successfully!")
        
        print("\n" + "=" * 60)
        print("✅ DATABASE INITIALIZATION COMPLETE!")
        print("=" * 60)
        print("\n📋 Login Credentials:")
        print("   📧 Email:    admin@schedulo.com")
        print("   🔑 Password: admin123")
        print("\n⚠️  IMPORTANT: Change this password in production!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error creating admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    try:
        init_database()
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        exit(1)