"""
NexusSchedule - FastAPI Backend
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import Base, engine, test_connection
from app.models import Base as ModelsBase
from app.routes.saved_faculty_tt_routes import router as faculty_tt_router

import time
from datetime import datetime
from fastapi import Request
from sqlalchemy import text
from app.utils.logger import logger

# ← Add these IMPORTS (right after existing imports from app.routes)

from app.models.faculty import Faculty
from app.models.room import Room
from app.models.section import Section
from app.models.subject import Subject
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from fastapi import Depends
from app.routes import ai_routes

# ═══════════════════════════════════════════════════════════════════════════════
# IMPORT MODELS
# ═══════════════════════════════════════════════════════════════════════════════

try:
    from app.models import saved_timetable
except ImportError:
    pass

try:
    from app.models import additional_class
    print("[INFO] Additional class model imported ✓")
except ImportError as e:
    print(f"[WARNING] Additional class model not found: {e}")

try:
    from app.models import faculty_availability
except ImportError:
    pass

from app.models import teaching_assignment

try:
    from app.models import lab
    print("[INFO] Lab model imported ✓")
except ImportError as e:
    print(f"[WARNING] Lab model not found: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# IMPORT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

from app.routes import (
    auth_routes, 
    faculty_routes, 
    subject_routes,
    room_routes, 
    section_routes, 
    timeslot_routes,
    timetable_routes, 
    admin_routes,
    institution_config_routes,
    department_routes
)
from app.routes.auth_routes import get_current_user, require_admin

# ═══════════════════════════════════════════════════════════════════════════════
# CREATE TABLES ON STARTUP
# ═══════════════════════════════════════════════════════════════════════════════
# Runs once, after every model has been imported and registered with Base
# (direct imports above, the try/except optional-model imports, and the
# AuditLog model pulled in via admin_routes just above) — so every table
# gets created in a single pass instead of two staggered calls.
Base.metadata.create_all(bind=engine)

# ═══════════════════════════════════════════════════════════════════════════════
# INLINE SCHEMA MIGRATIONS — idempotent, run once at startup instead of a
# separate migration script file. Safe to run every restart.
# ═══════════════════════════════════════════════════════════════════════════════
try:
    with engine.connect() as conn:
        # ✅ NEW: faculty.labs — comma-separated lab names, mirrors `subjects`
        conn.execute(text(
            "ALTER TABLE faculty ADD COLUMN IF NOT EXISTS labs VARCHAR"
        ))
        conn.execute(text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS email VARCHAR"))
        conn.execute(text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS phone VARCHAR"))
        conn.execute(text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
        conn.execute(text("ALTER TABLE faculty ADD COLUMN IF NOT EXISTS cluster INTEGER"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS cluster INTEGER"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
        conn.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_email ON faculty (lower(email)) WHERE email IS NOT NULL AND email <> ''"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT"))
        # ✅ CLEANUP: faculty assignment on labs is no longer stored at all —
        # it's derived from faculty.labs instead. Dropping these columns
        # loses any faculty assignments made via the old Labs-page picker;
        # re-enter them via each faculty's new Labs field on the Faculty page.
        conn.execute(text(
            "ALTER TABLE labs DROP COLUMN IF EXISTS faculty_id"
        ))
        conn.execute(text(
            "ALTER TABLE labs DROP COLUMN IF EXISTS faculty_ids"
        ))
        conn.commit()
    print("[INFO] faculty.labs column verified, labs.faculty_id/faculty_ids dropped ✓")
except Exception as e:
    print(f"[WARNING] Could not run schema migrations: {e}")

# Optional routes
_has_lab_routes = False
try:
    from app.routes import lab_routes
    _has_lab_routes = True
    print("[INFO] Lab routes imported ✓")
except ImportError:
    pass

_has_saved = False
try:
    from app.routes import saved_timetable_routes
    _has_saved = True
except Exception as e:
    print(f"[WARNING] saved_timetable_routes: {e}")

_has_avail = False
try:
    from app.routes import faculty_availability_routes
    _has_avail = True
except Exception as e:
    print(f"[WARNING] faculty_availability_routes: {e}")

_has_ocr = False
try:
    from app.routes import ocr_timetable
    _has_ocr = True
    print("[INFO] OCR routes imported ✓")
except Exception as e:
    print(f"[WARNING] OCR routes not available: {e}")

_has_additional_classes = False
try:
    from app.routes import additional_class_routes
    _has_additional_classes = True
    print("[INFO] Additional classes routes imported ✓")
except Exception as e:
    print(f"[WARNING] Additional classes routes not available: {e}")

_has_faculty_tt = False
try:
    from app.routes import saved_faculty_tt_routes
    _has_faculty_tt = True
    print("[INFO] Faculty timetable routes imported ✓")
except ImportError as e:
    print(f"[WARNING] Faculty timetable routes not found: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# CREATE FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="NexusSchedule API",
    version="2.1",
    description="NexusSchedule - AI-Powered Academic Timetable Generation Platform"
)

# ✅ CORS MIDDLEWARE MUST BE HERE (immediately after app = FastAPI)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP & SHUTDOWN EVENTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    logger.info("=" * 50)
    logger.info("TIMETABLE APPLICATION STARTING")
    logger.info("=" * 50)

    from app.services.metrics_service import metrics_service
    db = SessionLocal()
    try:
        metrics_service.load_from_db(db)
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown():
    from app.services.metrics_service import metrics_service
    db = SessionLocal()
    try:
        metrics_service.save_to_db(db)
    finally:
        db.close()

    logger.info("=" * 50)
    logger.info("TIMETABLE APPLICATION SHUTTING DOWN")
    logger.info("=" * 50)

# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST LOGGING MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════════════════

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests and responses + track metrics"""
    from app.services.metrics_service import metrics_service
    
    start_time = time.time()
    
    # Record request in metrics
    metrics_service.record_request(request.method, request.url.path)
    
    # Log request (✓ FIXED: > instead of →)
    logger.info(f"> {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Record response time and status
        metrics_service.record_response_time(request.url.path, process_time)
        
        # Log response (✓ FIXED: < instead of ←)
        logger.info(
            f"< {request.method} {request.url.path} | "
            f"Status: {response.status_code} | "
            f"Time: {process_time:.2f}s"
        )
        
        return response
    
    except Exception as e:
        process_time = time.time() - start_time
        
        # Record error in metrics
        metrics_service.record_error(request.url.path, str(e))
        
        # Log error (✓ FIXED: [ERROR] instead of ❌)
        logger.error(
            f"[ERROR] {request.method} {request.url.path} | "
            f"Error: {str(e)} | "
            f"Time: {process_time:.2f}s",
            exc_info=True
        )
        raise

# ═══════════════════════════════════════════════════════════════════════════════
# STATIC FILES
# ═══════════════════════════════════════════════════════════════════════════════

try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception as e:
    print(f"[WARNING] Static files not mounted: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# REGISTER ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

app.include_router(auth_routes.router, prefix="/auth", tags=["Auth"])
app.include_router(faculty_routes.router)
app.include_router(subject_routes.router)
app.include_router(room_routes.router)
app.include_router(section_routes.router)
app.include_router(timeslot_routes.router)
app.include_router(admin_routes.router)
app.include_router(department_routes.router)
from app.routes import teaching_routes
from app.routes import invite_routes
from app.routes import profile_routes
app.include_router(profile_routes.router)
app.include_router(teaching_routes.router)
app.include_router(invite_routes.router)
app.include_router(timetable_routes.router)
app.include_router(faculty_tt_router)
app.include_router(ai_routes.router)
app.include_router(
    institution_config_routes.router,
    prefix="/institution-config",
    tags=["institution-config"]
)


print("[SUCCESS] ✓ Institution config routes registered at /institution-config!")

# Optional routes
if _has_saved:
    app.include_router(saved_timetable_routes.router)
    print("[SUCCESS] ✓ Saved timetable routes registered!")

if _has_avail:
    app.include_router(faculty_availability_routes.router)
    print("[SUCCESS] ✓ Faculty availability routes registered!")

if _has_lab_routes:
    app.include_router(lab_routes.router)
    print("[SUCCESS] ✓ Lab routes registered!")

if _has_ocr:
    app.include_router(ocr_timetable.router)
    print("[SUCCESS] ✓ OCR routes registered!")
else:
    ocr_fallback = APIRouter(prefix="/ocr", tags=["OCR"])
    
    @ocr_fallback.post("/extract-table")
    @ocr_fallback.post("/upload-generate")
    async def ocr_unavailable():
        raise HTTPException(503, detail="OCR not available")
    
    app.include_router(ocr_fallback)
    print("[WARNING] OCR unavailable")

if _has_additional_classes:
    app.include_router(additional_class_routes.router)
    print("[SUCCESS] ✓ Additional classes routes registered!")

if _has_faculty_tt:
    app.include_router(saved_faculty_tt_routes.router)
    print("[SUCCESS] ✓ Faculty timetable routes registered!")

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK & STATUS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "AI Timetable API v2.1",
        "database": "PostgreSQL",
        "ocr_ready": _has_ocr,
        "labs_enabled": _has_lab_routes,
        "additional_classes_enabled": _has_additional_classes
    }

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE DEPENDENCY
# ═══════════════════════════════════════════════════════════════════════════════

def get_db():
    """Get database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
async def health_check(db = None):
    """Health check endpoint with database verification"""
    try:
        logger.info("[OK] Health check passed")
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "AI Timetable Generator",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"[ERROR] Health check failed: {str(e)}")
        
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "service": "AI Timetable Generator",
            "database": "error",
            "error": str(e)
        }

# ═══════════════════════════════════════════════════════════════════════════════
# STATS ENDPOINT (For Admin Overview Page)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/stats")
async def get_stats(db: Session = Depends(get_db), _u = Depends(get_current_user)):
    """Get system statistics - Faculty, Rooms, Sections, Subjects count"""
    try:
        logger.info("[STATS] Stats requested")
        stats = {
            "faculty": db.query(Faculty).count(),
            "rooms": db.query(Room).count(),
            "sections": db.query(Section).count(),
            "subjects": db.query(Subject).count(),
        }
        logger.info(f"[OK] Stats retrieved: {stats}")
        return stats
    except Exception as e:
        logger.error(f"[ERROR] Error getting stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════════════════════════════════
# METRICS ENDPOINTS (Phase 3 - Operations)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/metrics")
async def get_metrics(_a = Depends(require_admin)):
    """Get system metrics"""
    from app.services.metrics_service import metrics_service
    
    metrics = metrics_service.get_metrics()
    logger.info(f"[METRICS] Metrics requested: {metrics['request_count']} requests")
    
    return metrics

@app.get("/api/metrics/endpoints")
async def get_endpoint_metrics(_a = Depends(require_admin)):
    """Get per-endpoint metrics"""
    from app.services.metrics_service import metrics_service
    
    metrics = metrics_service.get_metrics()
    
    # Sort endpoints by request count
    sorted_endpoints = sorted(
        metrics["endpoints"].items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )
    
    return {
        "endpoints": dict(sorted_endpoints),
        "total_endpoints": len(metrics["endpoints"])
    }

@app.get("/debug/ocr-test")
async def debug_ocr(_a = Depends(require_admin)):
    """Test if OCR module is accessible"""
    try:
        from app.routes import ocr_timetable
        return {
            "ocr_imported": True,
            "router_prefix": ocr_timetable.router.prefix,
            "routes": [
                {"path": r.path, "methods": list(r.methods)} 
                for r in ocr_timetable.router.routes
            ]
        }
    except Exception as e:
        return {"ocr_imported": False, "error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE CONNECTION TEST
# ═══════════════════════════════════════════════════════════════════════════════

if not test_connection():
    print("WARNING: PostgreSQL connection failed. Please check your configuration.")
else:
    print("[SUCCESS] PostgreSQL connected and ready!")