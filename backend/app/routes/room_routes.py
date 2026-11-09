from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.room import Room
from app.schemas.room_schema import RoomCreate
from app.models.user import User
from app.routes.auth_routes import require_editor, get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/rooms")
def create_room(data: RoomCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    room = Room(
        room_name = data.room_name,
        room_type = data.room_type,
        capacity  = data.capacity,
        department_id = _a.department_id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/rooms")
def get_rooms(db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    q = db.query(Room)
    if _u.department_id is not None:
        q = q.filter(or_(Room.department_id == _u.department_id, Room.department_id.is_(None)))
    return q.order_by(Room.room_name).all()


@router.get("/rooms/{id}")
def get_room(id: int, db: Session = Depends(get_db), _u: User = Depends(get_current_user)):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.put("/rooms/{id}")
def update_room(id: int, data: RoomCreate, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if _a.department_id is not None and room.department_id != _a.department_id:
        raise HTTPException(status_code=403, detail="This room belongs to another department")
    room.room_name = data.room_name
    room.room_type = data.room_type
    room.capacity  = data.capacity
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{id}")
def delete_room(id: int, db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if _a.department_id is not None and room.department_id != _a.department_id:
        raise HTTPException(status_code=403, detail="This room belongs to another department")
    db.delete(room)
    db.commit()
    return {"message": "Room deleted"}


@router.post("/rooms/bulk")
def bulk_create_rooms(data: List[RoomCreate], db: Session = Depends(get_db), _a: User = Depends(require_editor)):
    if not data:
        raise HTTPException(status_code=400, detail="No records provided")

    created = []
    errors = []
    for i, item in enumerate(data):
        try:
            room = Room(
                room_name = item.room_name,
                room_type = item.room_type,
                capacity  = item.capacity,
                department_id = _a.department_id,
            )
            db.add(room)
            created.append(room)
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    db.commit()
    for room in created:
        db.refresh(room)

    return {
        "imported": len(created),
        "errors": errors,
        "total": len(data),
        "rooms": created,
    }