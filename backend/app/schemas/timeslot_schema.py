from pydantic import BaseModel
from typing import Optional


class TimeslotCreate(BaseModel):
    day:       str             # Monday, Tuesday, ...
    start_time: str            # e.g. "08:30"
    end_time:   str            # e.g. "09:25"
    slot_type:  Optional[str] = "PERIOD"   # PERIOD | BREAK | LUNCH


class TimeslotOut(BaseModel):
    id:         int
    day:        str
    start_time: str
    end_time:   str
    slot_type:  Optional[str]

    class Config:
        from_attributes = True