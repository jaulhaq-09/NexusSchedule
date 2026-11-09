"""
Database Configuration & Connection
PostgreSQL setup for production
"""

import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool

# ═══════════════════════════════════════════════════════════════════════════════
# POSTGRESQL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Get environment variables or use defaults
POSTGRES_USER = os.getenv("POSTGRES_USER", "timetable_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "jaul")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "timetable_db")

# Force IPv4 connection (127.0.0.1 instead of localhost which tries IPv6)
DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{quote_plus(POSTGRES_PASSWORD)}@127.0.0.1:{POSTGRES_PORT}/{POSTGRES_DB}"

print(f"\n{'='*80}")
print(f"[DATABASE] PostgreSQL Configuration")
print(f"{'='*80}")
print(f"Host: {POSTGRES_HOST}:{POSTGRES_PORT}")
print(f"Database: {POSTGRES_DB}")
print(f"User: {POSTGRES_USER}")
print(f"{'='*80}\n")

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE ENGINE SETUP
# ═══════════════════════════════════════════════════════════════════════════════

try:
    engine = create_engine(
        DATABASE_URL,
        # Connection pooling for performance
        poolclass=QueuePool,
        pool_size=10,              # Number of connections to keep open
        max_overflow=20,           # Additional connections if needed
        pool_pre_ping=True,        # Test connection before using (prevents "connection lost" errors)
        pool_recycle=3600,         # Recycle connections every hour
        
        # Connection settings
        connect_args={
            "connect_timeout": 10
        },
        
        # Logging (set to True to see SQL queries)
        echo=False,
        echo_pool=False
    )
    
    print("[DATABASE] Engine created successfully ✅\n")

except Exception as e:
    print(f"[DATABASE] ❌ Failed to create engine: {e}\n")
    raise

# ═══════════════════════════════════════════════════════════════════════════════
# SESSION CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

# ═══════════════════════════════════════════════════════════════════════════════
# DECLARATIVE BASE
# ═══════════════════════════════════════════════════════════════════════════════

Base = declarative_base()

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE SESSION DEPENDENCY FOR FASTAPI
# ═══════════════════════════════════════════════════════════════════════════════

def get_db() -> Session:
    """
    FastAPI dependency to get database session
    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        print(f"[DATABASE] Error in session: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# ═══════════════════════════════════════════════════════════════════════════════
# CONNECTION TESTING & INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

def test_connection() -> bool:
    """
    Test PostgreSQL connection on startup
    Returns True if successful, False otherwise
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version()"))
            version = result.fetchone()
            
            if version:
                version_str = version[0]
                print(f"[DATABASE] ✅ PostgreSQL Connected!")
                print(f"[DATABASE] Version: {version_str}\n")
                return True
            else:
                print("[DATABASE] ❌ Could not retrieve version\n")
                return False
                
    except Exception as e:
        print(f"[DATABASE] ❌ Connection Test Failed!")
        print(f"[DATABASE] Error: {e}\n")
        print("[DATABASE] 💡 Troubleshooting:")
        print("[DATABASE]    1. Is PostgreSQL running? (Check Windows Services)")
        print("[DATABASE]    2. Check credentials in environment variables or db.py")
        print("[DATABASE]    3. Verify database 'timetable_db' exists")
        print("[DATABASE]    4. Verify user 'timetable_user' has privileges\n")
        return False

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_table_count() -> int:
    """Get number of tables in database"""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return len(tables)
    except:
        return 0


def get_table_info():
    """Print detailed table information"""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print(f"\n[DATABASE] 📊 Database Tables ({len(tables)} total):")
        print("="*80)
        
        for table in sorted(tables):
            columns = inspector.get_columns(table)
            print(f"  📋 {table} ({len(columns)} columns)")
            
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"[DATABASE] Error getting table info: {e}\n")


def create_all_tables():
    """Create all tables in PostgreSQL"""
    try:
        Base.metadata.create_all(bind=engine)
        print("[DATABASE] ✅ All tables created/verified\n")
        return True
    except Exception as e:
        print(f"[DATABASE] ❌ Error creating tables: {e}\n")
        return False


def drop_all_tables():
    """
    ⚠️  DANGER: Drop all tables (use with caution!)
    This is for development/testing only!
    """
    try:
        response = input("[DATABASE] ⚠️  WARNING: This will delete ALL data! Type 'DELETE_ALL' to confirm: ")
        if response == "DELETE_ALL":
            Base.metadata.drop_all(bind=engine)
            print("[DATABASE] ✅ All tables dropped\n")
        else:
            print("[DATABASE] ❌ Cancelled\n")
    except Exception as e:
        print(f"[DATABASE] ❌ Error dropping tables: {e}\n")

# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP SEQUENCE
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n[DATABASE] Running startup tests...\n")
    
    # Test connection
    if test_connection():
        # Show table info
        get_table_info()
    else:
        print("[DATABASE] ❌ Cannot proceed - no database connection\n")