from app.models.saved_timetable import SavedTimetable
from app.models.additional_class import AdditionalClass

PERIOD_SLOTS = [
    "08:30 - 09:25", "09:25 - 10:20", 
    "10:40 - 11:35", "11:35 - 12:30",
    "01:25 - 02:20", "02:20 - 03:15", "03:15 - 04:10"
]

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

BREAK_SLOTS = ["10:20 - 10:40", "12:30 - 01:25"]

class AvailabilityService:
    
    @staticmethod
    def build_occupancy_maps(saved_timetables, additional_classes):
        """Build occupancy maps from saved timetables and additional classes"""
        section_map = {}  # "section_id|day|time" -> True
        teacher_map = {}  # "faculty_name|day|time" -> True
        room_map = {}     # "room_id|day|time" -> True
        
        # Process saved timetables
        for tt in saved_timetables:
            section_id = tt.section_id
            room_id = tt.room_id
            
            if not tt.timetable_data:
                continue
                
            for entry in tt.timetable_data:
                day = entry.get('day')
                time = entry.get('time')
                faculty_name = entry.get('facultyName', '').strip()
                span = entry.get('span', 1)
                
                # Mark section busy
                section_map[f"{section_id}|{day}|{time}"] = True
                
                # Mark teacher busy (handle multiple teachers separated by /)
                if faculty_name and faculty_name not in ['—', '-', '']:
                    for fac in faculty_name.split('/'):
                        teacher_map[f"{fac.strip()}|{day}|{time}"] = True
                
                # Mark room busy
                if room_id:
                    room_map[f"{room_id}|{day}|{time}"] = True
                
                # If span > 1, mark next slots busy
                if span > 1:
                    time_idx = PERIOD_SLOTS.index(time) if time in PERIOD_SLOTS else -1
                    if time_idx >= 0:
                        for i in range(1, span):
                            if time_idx + i < len(PERIOD_SLOTS):
                                next_time = PERIOD_SLOTS[time_idx + i]
                                section_map[f"{section_id}|{day}|{next_time}"] = True
                                if faculty_name and faculty_name not in ['—', '-', '']:
                                    for fac in faculty_name.split('/'):
                                        teacher_map[f"{fac.strip()}|{day}|{next_time}"] = True
                                if room_id:
                                    room_map[f"{room_id}|{day}|{next_time}"] = True
        
        # Process additional classes
        for ac in additional_classes:
            day = ac.day
            time = ac.time
            duration = ac.duration_slots or 1
            
            # Mark sections busy
            for sec_id in (ac.section_ids or []):
                section_map[f"{sec_id}|{day}|{time}"] = True
            
            # Mark teacher busy
            if ac.faculty_name:
                teacher_map[f"{ac.faculty_name}|{day}|{time}"] = True
            
            # Mark room busy
            if ac.room_id:
                room_map[f"{ac.room_id}|{day}|{time}"] = True
            
            # Mark next slots if duration > 1
            if duration > 1:
                time_idx = PERIOD_SLOTS.index(time) if time in PERIOD_SLOTS else -1
                if time_idx >= 0:
                    for i in range(1, duration):
                        if time_idx + i < len(PERIOD_SLOTS):
                            next_time = PERIOD_SLOTS[time_idx + i]
                            for sec_id in (ac.section_ids or []):
                                section_map[f"{sec_id}|{day}|{next_time}"] = True
                            if ac.faculty_name:
                                teacher_map[f"{ac.faculty_name}|{day}|{next_time}"] = True
                            if ac.room_id:
                                room_map[f"{ac.room_id}|{day}|{next_time}"] = True
        
        return section_map, teacher_map, room_map
    
    @staticmethod
    def check_slot_availability(section_ids, faculty_name, room_id, day, time, duration, saved_timetables, additional_classes):
        """Check if a slot is available for additional class"""
        section_map, teacher_map, room_map = AvailabilityService.build_occupancy_maps(saved_timetables, additional_classes)
        
        reasons = []
        
        # Check break/lunch
        if time in BREAK_SLOTS:
            reasons.append("break_lunch")
        
        # Check all required slots for duration
        time_idx = PERIOD_SLOTS.index(time) if time in PERIOD_SLOTS else -1
        if time_idx < 0:
            reasons.append("invalid_time")
            return False, reasons
        
        slots_to_check = []
        for i in range(duration):
            if time_idx + i < len(PERIOD_SLOTS):
                slots_to_check.append(PERIOD_SLOTS[time_idx + i])
            else:
                reasons.append("insufficient_consecutive_slots")
                return False, reasons
        
        # Check each slot
        for slot_time in slots_to_check:
            # Check sections
            for sec_id in section_ids:
                if f"{sec_id}|{day}|{slot_time}" in section_map:
                    reasons.append(f"section_{sec_id}_busy")
            
            # Check teacher
            if faculty_name and f"{faculty_name}|{day}|{slot_time}" in teacher_map:
                reasons.append("teacher_busy")
            
            # Check room
            if room_id and f"{room_id}|{day}|{slot_time}" in room_map:
                reasons.append("room_busy")
        
        available = len(reasons) == 0
        return available, reasons
    
    @staticmethod
    def get_all_availability(section_ids, faculty_name, room_id, duration, saved_timetables, additional_classes):
        """Get availability grid for all days and slots"""
        result = {}
        
        for day in DAYS:
            result[day] = {}
            for time in PERIOD_SLOTS:
                available, reasons = AvailabilityService.check_slot_availability(
                    section_ids, faculty_name, room_id, day, time, duration, saved_timetables, additional_classes
                )
                result[day][time] = {
                    "available": available,
                    "reasons": reasons
                }
        
        return result