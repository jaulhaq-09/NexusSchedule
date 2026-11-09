additional_class_schema = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "reason": {"type": "string", "enum": ["failed", "remedial", "revision", "makeup"]},
        "subject_name": {"type": "string"},
        "faculty_id": {"type": "integer"},
        "faculty_name": {"type": "string"},
        "room_id": {"type": "integer"},
        "room_name": {"type": "string"},
        "day": {"type": "string"},
        "time": {"type": "string"},
        "duration_slots": {"type": "integer"},
        "section_ids": {"type": "array", "items": {"type": "integer"}},
        "cluster": {"type": "integer"},
        "semester": {"type": "integer"},
        "student_group_name": {"type": "string"},
        "failed_students_count": {"type": "integer"},
        "source_saved_timetable_ids": {"type": "array"},
        "status": {"type": "string"},
        "remarks": {"type": "string"}
    },
    "required": ["title", "subject_name", "day", "time", "section_ids"]
}