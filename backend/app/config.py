"""
UPGRADE #2 - FIXED config.py
Removed SQLite fallback - uses PostgreSQL only
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──────────────────────────────────────────────────
# 🔥 CRITICAL: Removed SQLite fallback - uses PostgreSQL ONLY
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://timetable_user:jaul@127.0.0.1:5432/timetable_db"
)

# Verify it's PostgreSQL
if "postgresql" not in DATABASE_URL:
    raise ValueError(
        "❌ DATABASE_URL must be PostgreSQL (postgresql+psycopg2://...)\n"
        "   Set in .env file or environment variable"
    )

# ── JWT Auth ──────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY missing or too short in .env (need 32+ characters)")
ALGORITHM       = os.getenv("ALGORITHM",  "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# ── App ───────────────────────────────────────────────────────
APP_TITLE   = "AI Timetable Generator"
APP_VERSION = "2.1"
DEBUG       = os.getenv("DEBUG", "false").lower() == "true"

# ── CORS ─────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]