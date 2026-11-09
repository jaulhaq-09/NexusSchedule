# NexusSchedule 🗓️✨
### AI-Powered Academic Timetable Generation & Resource Optimization Platform

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**NexusSchedule** is an enterprise-grade academic timetable generation and resource optimization platform designed for colleges, universities, and educational institutions. It solves complex NP-hard scheduling challenges using Constraint Satisfaction Problem (CSP) algorithms augmented by Google Gemini AI and computer vision (OCR).

---

## 🚀 Key Features

- **⚡ Automated CSP Timetable Engine**: Generates conflict-free schedules considering faculty availability, lab equipment, room capacities, consecutive class rules, and departmental constraints.
- **🤖 AI Schedule Coordinator**: Powered by Google Gemini to analyze timetable health, resolve schedule bottlenecks, and provide natural language scheduling insights.
- **📷 OCR Timetable Import**: Ingest existing physical or PDF timetables using OpenCV and PyTesseract OCR to convert legacy schedules into editable digital structures.
- **🖐️ Interactive Drag-and-Drop Editor**: Real-time schedule adjustments with `@dnd-kit` and collision detection to prevent faculty or room double-booking.
- **👥 Role-Based Access Control (RBAC)**: Dedicated workflows and permissions for Administrators, Faculty Members, and Coordinators.
- **📊 Analytics & Monitoring Dashboard**: Departmental metrics, faculty workload distribution, lab utilization rates, and conflict tracking.
- **📤 Export & Sharing**: 1-click export to high-resolution PDF, Excel sheets (`.xlsx`), and image formats.

---

## 🏗️ Architecture & Tech Stack

```
AI-Timetable-Generator/
├── backend/                  # FastAPI REST API (Python 3.10+)
│   ├── app/
│   │   ├── database/         # SQLAlchemy ORM & DB Connections
│   │   ├── models/           # Relational Schemas (Faculty, Rooms, Timetables, etc.)
│   │   ├── routes/           # API Endpoints (Auth, CSP Generator, OCR, AI)
│   │   ├── schemas/          # Pydantic Request/Response Models
│   │   ├── services/         # CSP Algorithm & AI Orchestration
│   │   └── utils/            # Logging, Brevo Transactional Emailing, OCR Helpers
│   └── requirements.txt
│
├── frontend/                 # React 19 + Vite Single Page Application
│   ├── src/
│   │   ├── components/       # Timetable grids, Drag-and-Drop, Availability pickers
│   │   ├── pages/            # Dashboard, Timetable, Faculty, Labs, Admin, Auth
│   │   └── services/         # Axios API Client & Authentication Handlers
│   └── package.json
│
└── NEXUSSCHEDULE_MASTER_PRESENTATION_REPORT.md  # Detailed Technical & Viva Report
```

### Technology Matrix
- **Backend:** Python, FastAPI, SQLAlchemy ORM, SQLite / PostgreSQL, PyTesseract, OpenCV, Google Gemini API
- **Frontend:** React 19, Vite, Framer Motion, `@dnd-kit`, Recharts, Axios, jsPDF, XLSX

---

## ⚙️ Quick Start Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm / pnpm
- Tesseract-OCR (optional, for OCR document extraction)

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment configuration (.env)
# Set your DATABASE_URL, GEMINI_API_KEY, and JWT_SECRET

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
Backend API interactive documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend runs locally at `http://localhost:5173`.

---

## 🔒 Security & Best Practices
- Environment variables (`.env`) are strictly excluded from version control.
- Token-based JWT authentication with salted hashing via `passlib[bcrypt]`.
- All database operations are sanitized through SQLAlchemy parameter binding.

---

## 📄 License
This project is licensed under the MIT License.

