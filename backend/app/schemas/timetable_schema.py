from pydantic import BaseModel



class TimetableResponse(BaseModel):

    id: int

    section_id: int

    subject_id: int

    faculty_id: int

    room_id: int

    timeslot_id: int



    class Config:

        orm_mode = True