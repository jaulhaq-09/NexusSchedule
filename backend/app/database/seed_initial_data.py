"""
Seed initial data for PostgreSQL
"""

from app.database.db import SessionLocal
from app.models.workspace import Workspace
from app.models.department import Department
from app.models.institution_config import InstitutionConfig


def seed_initial_data():
    db = SessionLocal()
    
    try:
        # 1. Create default workspace
        workspace = db.query(Workspace).filter(Workspace.id == 9).first()
        if not workspace:
            workspace = Workspace(
                id=9,
                name="BMS Institute",
                description="Default workspace for BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT",
                is_active=True
            )
            db.add(workspace)
            db.commit()
            print("✅ Created default workspace (ID=9)")
        
        # 2. Create default departments
        existing_depts = db.query(Department).count()
        if existing_depts == 0:
            departments = [
                Department(
                    workspace_id=9,
                    name="Computer Science & Engineering",
                    code="CSE",
                    short_name="CS&E",
                    hod_name="Dr. Ravindra Gupta"
                ),
                Department(
                    workspace_id=9,
                    name="Electronics & Communication Engineering",
                    code="ECE",
                    short_name="EC&E",
                    hod_name="Dr. Jayaprakash Reddy"
                ),
                Department(
                    workspace_id=9,
                    name="Mechanical Engineering",
                    code="MECH",
                    short_name="ME",
                    hod_name="Dr. Rajesh Kumar"
                ),
                Department(
                    workspace_id=9,
                    name="Civil Engineering",
                    code="CIVIL",
                    short_name="CE",
                    hod_name="Dr. Arjun Singh"
                ),
                Department(
                    workspace_id=9,
                    name="Electrical & Electronics Engineering",
                    code="EEE",
                    short_name="EE&E",
                    hod_name="Dr. Sunil Sharma"
                ),
            ]
            
            for dept in departments:
                db.add(dept)
            
            db.commit()
            print(f"✅ Created {len(departments)} departments")
        
        # 3. Create default institution config
        existing_config = db.query(InstitutionConfig).filter(
            InstitutionConfig.workspace_id == 9
        ).first()
        
        if not existing_config:
            config = InstitutionConfig(
                workspace_id=9,
                working_days=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                slot_template=[
                    {"label": "I", "start_time": "08:30", "end_time": "09:25", "slot_type": "PERIOD"},
                    {"label": "II", "start_time": "09:25", "end_time": "10:20", "slot_type": "PERIOD"},
                    {"label": "Break", "start_time": "10:20", "end_time": "10:40", "slot_type": "BREAK"},
                    {"label": "III", "start_time": "10:40", "end_time": "11:35", "slot_type": "PERIOD"},
                    {"label": "IV", "start_time": "11:35", "end_time": "12:30", "slot_type": "PERIOD"},
                    {"label": "Lunch", "start_time": "12:30", "end_time": "13:25", "slot_type": "LUNCH"},
                    {"label": "V", "start_time": "13:25", "end_time": "14:20", "slot_type": "PERIOD"},
                    {"label": "VI", "start_time": "14:20", "end_time": "15:15", "slot_type": "PERIOD"},
                    {"label": "VII", "start_time": "15:15", "end_time": "16:10", "slot_type": "PERIOD"},
                ],
                semester_count=8,
                cluster_enabled=True,
                cluster_count=4,
                institution_name="BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT",
                institution_address="AVALAHALLI, YELAHANKA, BENGALURU-560119",
                department_name="DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING",
            )
            db.add(config)
            db.commit()
            print("✅ Created default institution configuration")
        
        print("\n🎉 PostgreSQL database initialized successfully!")
        
        # Show summary
        depts = db.query(Department).all()
        print(f"\n📊 Database Summary:")
        print(f"   Workspaces: 1")
        print(f"   Departments: {len(depts)}")
        for dept in depts:
            print(f"      • {dept.code} - {dept.name}")
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_data()