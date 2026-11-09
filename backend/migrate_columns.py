from app.database.db import engine
import sqlalchemy as sa

with engine.connect() as conn:
    conn.execute(sa.text('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_core BOOLEAN DEFAULT FALSE'))
    conn.execute(sa.text('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS coordinator_faculty_id INTEGER'))
    conn.execute(sa.text('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS coordinator_assigned_at TIMESTAMPTZ'))
    conn.execute(sa.text('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS ai_suggestions_cache TEXT'))
    conn.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty_id INTEGER'))
    conn.execute(sa.text('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS course_category VARCHAR'))
    conn.execute(sa.text('ALTER TABLE labs ADD COLUMN IF NOT EXISTS paired_lab_name VARCHAR'))
    conn.execute(sa.text('ALTER TABLE labs ADD COLUMN IF NOT EXISTS room_id INTEGER'))
    conn.commit()
    print('✅ Columns added')
