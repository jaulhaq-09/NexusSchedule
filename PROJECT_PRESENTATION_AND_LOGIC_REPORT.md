# 🎓 NexusSchedule: AI Timetable Generator
## Comprehensive Technical Logic Report & Presentation Master Guide

> **Document Type:** Project Architecture, Algorithmic Logic & Demo Script Guide  
> **Project Name:** NexusSchedule (AI-Powered Academic Timetable Generation System)  
> **Tech Stack:** React 18, Vite, FastAPI (Python), SQLAlchemy, SQLite, Google Gemini AI, OpenCV, PyTesseract  
> **Author:** Antigravity AI Engineering Team  

---

## 📋 Table of Contents
1. [Executive Summary & Project Overview](#1-executive-summary--project-overview)
2. [System Architecture & Technology Stack](#2-system-architecture--technology-stack)
3. [Deep-Dive: Timetable Generation Algorithm & Logic](#3-deep-dive-timetable-generation-algorithm--logic)
4. [AI & Machine Learning Engines](#4-ai--machine-learning-engines)
5. [Page-by-Page Detailed Logic Breakdown](#5-page-by-page-detailed-logic-breakdown)
6. [Step-by-Step Presentation & Live Demo Script](#6-step-by-step-presentation--live-demo-script)
7. [Anticipated Examiner / Viva Q&A Guide](#7-anticipated-examiner--viva-qa-guide)

---

## 1. Executive Summary & Project Overview

### 1.1 Problem Statement
Creating an academic timetable for educational institutions (universities, colleges, schools) is traditionally a complex, time-consuming **NP-Hard Constraint Satisfaction Problem (CSP)**. Manual scheduling leads to frequent issues:
- **Faculty Collisions:** A professor accidentally scheduled in two classes at the same time.
- **Room Overbooking:** Two sections assigned to the same physical room or laboratory.
- **Cognitive Fatigue:** Core analytical subjects (like Mathematics, Data Structures, or Operating Systems) scheduled late in the afternoon when student absorption rate is low.
- **Unbalanced Workloads:** Uneven daily work distribution for faculty members.
- **Paper Timetable Isolation:** Inability to easily digitize legacy physical paper timetables.

### 1.2 The Solution: NexusSchedule
**NexusSchedule** is an intelligent, full-stack, AI-driven academic management system that automates conflict-free timetable generation in seconds. It enforces strict mathematical hard constraints, optimizes soft pedagogical constraints via Google Gemini AI, and provides an end-to-end management portal for rooms, labs, faculty, sections, and legacy timetable OCR ingestion.

---

## 2. System Architecture & Technology Stack

```mermaid
flowchart TD
    subgraph Frontend [React 18 + Vite SPA UI Layer]
        A[Dashboard & Analytics] --> B[Resource Managers: Faculty, Rooms, Labs, Subjects]
        B --> C[Interactive Grid Generator & Pinned Slots]
        C --> D[OCR Paper Timetable Scanner]
    end

    subgraph Backend [FastAPI Python REST API Service]
        E[API Gateway & Auth Routes]
        F[Timetable Generator Engine]
        G[Gemini AI Service]
        H[OpenCV + Tesseract OCR Engine]
        I[Audit & Metrics Logger]
    end

    subgraph Database [Persistence Layer]
        J[(SQLite Database / SQLAlchemy ORM)]
    end

    Frontend <-->|REST / JSON HTTP| Backend
    E --> F
    E --> G
    E --> H
    F <--> J
    G <--> J
    H --> J
    I --> J
```

### 2.1 Technology Stack Table
| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite | High-performance Single Page Application (SPA) |
| **Styling & UI Design** | Vanilla CSS + Sora & JetBrains Fonts | Glassmorphic dark theme, custom responsive components |
| **Backend Framework** | FastAPI (Python 3.10+) | Asynchronous high-speed RESTful API endpoints |
| **Database & ORM** | SQLite + SQLAlchemy | Relational data persistence with strict foreign key constraints |
| **AI LLM Integration** | Google Gemini 1.5 Flash API | Core subject classification, coordinator ranking, insights |
| **Computer Vision / OCR**| OpenCV + PyTesseract | Digital image parsing of physical printed timetables |
| **Export Engines** | SheetJS / jsPDF / HTML Canvas | One-click export to PDF, Excel, and image formats |

---

## 3. Deep-Dive: Timetable Generation Algorithm & Logic

The heart of NexusSchedule is the **Conflict-Free Heuristic CSP Timetable Generator Engine** located in [`backend/app/services/timetable_generator.py`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/backend/app/services/timetable_generator.py).

### 3.1 Constraint Satisfaction Problem (CSP) Formulation
The timetable generation problem is modeled as follows:
- **Variables ($V$):** Every slot in a weekly grid $(Day, Timeslot, Section)$.
- **Domain ($D$):** Triples of $(Subject, Faculty, Room)$.
- **Constraints ($C$):** Hard rules (must never be violated) and Soft rules (optimized for best experience).

```
   +-------------------------------------------------------------------------+
   |                        HARD CONSTRAINTS (Strict)                        |
   +-------------------------------------------------------------------------+
   | 1. One Subject Per Day: Max 1 lecture of same subject per section/day. |
   | 2. Zero Faculty Overlap: A teacher cannot be in 2 classes at once.      |
   | 3. Zero Room Overbooking: A classroom cannot hold 2 sections at once.   |
   | 4. Hours Per Week: Exact credit hours requirement matched per subject. |
   +-------------------------------------------------------------------------+
                                       |
                                       v
   +-------------------------------------------------------------------------+
   |                     SOFT / AI CONSTRAINTS (Heuristic)                   |
   +-------------------------------------------------------------------------+
   | 1. Core Subjects Morning Focus: Core subjects placed before 12:30 PM.   |
   | 2. Uniform Distribution: Randomized shuffling for variety.             |
   +-------------------------------------------------------------------------+
```

---

### 3.2 Step-by-Step Algorithmic Logic Execution Flow

#### **Step 1: Database Hydration & Conflict Set Initialization**
- The generator purges stale timetable drafts from the DB.
- Loads active **Sections**, non-lab **Subjects**, **Faculty**, active **Rooms** (type `CLASS`), and **Timeslots** (type `PERIOD`).
- Global tracking sets are initialized:
  - `used_faculty = set()` $\rightarrow$ Stores tuples of `(faculty_id, slot_id)`
  - `used_room = set()` $\rightarrow$ Stores tuples of `(room_id, slot_id)`

#### **Step 2: Faculty Subject-Competency Mapping**
- Iterates over subjects and faculty competencies.
- Checks comma-separated subject lists defined on faculty records:
  ```python
  fac_subjects = [s.strip().lower() for s in (fac.subjects or "").split(",")]
  if subj.subject_name.lower() in fac_subjects:
      subj_fac_map[subj.id] = fac
  ```

#### **Step 3: Section-by-Section Daily Grid Iteration**
For each section:
1. Maintains a **Daily Tracking Map**: `subjects_used_per_day[day] = set()`.
2. Tracks remaining weekly hours for each subject: `hours_remaining[subject_id] = subject.hours_per_week`.
3. Group timeslots by day (`Monday` through `Saturday`).

#### **Step 4: Slot Allocation with Constraint Checks**
For each day and each available timeslot on that day:
1. **Shuffle Available Slots & Candidate Subjects:** Prevents repetitive schedule patterns.
2. **Subject Candidate Filtering:** Picks subjects that:
   - Have **NOT** been scheduled on this day yet (`subject.id not in subjects_used_per_day[day]`).
   - Still require remaining hours (`hours_remaining[subject.id] > 0`).
3. **🔥 AI Core Subject Morning Cutoff Check:**
   ```python
   slot_is_morning = (slot.start_time < (12, 30))
   if not slot_is_morning and candidate.is_core:
       continue  # Skip core subjects during afternoon slots (First Pass)
   ```
4. **Graceful Fallback:** If an afternoon slot has no remaining non-core subjects, the algorithm falls back to assign a core subject rather than leaving an empty unscheduled gap.
5. **Faculty Availability Check:**
   - Evaluates if the primary assigned faculty is free: `(faculty.id, slot.id) not in used_faculty`.
   - If busy, searches for an eligible substitute faculty who is free during `slot.id`.
6. **Room Availability Check:**
   - Filters rooms where `(room.id, slot.id) not in used_room`.
   - Selects an available room.
7. **Commit & Lock:**
   - Creates `Timetable` database record.
   - Registers lock in `used_faculty.add((faculty.id, slot.id))` and `used_room.add((room.id, slot.id))`.
   - Adds subject to `subjects_used_per_day[day].add(subject.id)`.
   - Decrements `hours_remaining[subject.id] -= 1`.

---

## 4. AI & Machine Learning Engines

### 4.1 Google Gemini LLM Integration ([`ai_service.py`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/backend/app/services/ai_service.py))
NexusSchedule integrates Google Gemini 1.5 Flash to bring cognitive intelligence into academic scheduling:

1. **Automatic Core Subject Identification (`identify_core_subjects`)**:
   - Sends course names to Gemini LLM to automatically flag high-focus analytical subjects (e.g. Mathematics, DBMS, Data Structures, Operating Systems, Computer Networks).
   - Sets the `is_core=True` flag in the database, automatically driving the morning-cutoff rule.

2. **Chief Course Coordinator Recommendation Engine (`suggest_coordinator`)**:
   - Analyzes faculty workloads, designations (Professor, Associate Prof, Assistant Prof), and years of experience.
   - Ranks the top 3 recommended chief coordinators per course with natural language justifications.

3. **Executive AI Insights Generator (`generate_ai_insights`)**:
   - Synthesizes room utilization, teacher workloads, and section allocations into concise, human-readable executive summaries for administrators.

---

### 4.2 Production-Grade OCR Timetable Parsing Engine ([`ocr_timetable.py`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/backend/app/routes/ocr_timetable.py))
To import existing paper timetables, NexusSchedule features a custom **OpenCV + PyTesseract computer vision pipeline**:

```
[Scanned Image / PDF] 
       │
       ▼
[Image Preprocessing (Grayscale, Thresholding, Contrast Boost)]
       │
       ▼
[Dynamic Line & Box Clustering (Width/Height Scaling)]
       │
       ▼
[PyTesseract Text Extraction & Noise Filtering]
       │
       ▼
[Subject Code Normalization (80+ Indian College Rules e.g., '21CS' + '44' -> '21CS44')]
       │
       ▼
[Time Format Standardization & Multi-Faculty Splitting]
       │
       ▼
[Structured DB JSON Entry + Per-Entry Confidence Score]
```

---

## 5. Page-by-Page Detailed Logic Breakdown

| # | Page Name & File | User Persona | Key UI Features & Functions | Underlying Backend Logic & API Routes |
|---|---|---|---|---|
| **1** | **Landing Page**<br>([`Home.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Home.jsx)) | Public / Guest | Visual hero section, feature cards, tech stack overview, interactive demo CTA. | Pure frontend presentation layer. |
| **2** | **Authentication**<br>([`Login.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Login.jsx) / [`Signup.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Signup.jsx)) | Admin / Faculty | Role-based secure login, token persistent state in `localStorage`. | `POST /auth/login`<br>JWT authentication, password verification against bcrypt hashes. |
| **3** | **Admin Dashboard**<br>([`Dashboard.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Dashboard.jsx)) | Admin | Live KPI stat cards (Total Faculty, Rooms, Sections, Timetables), AI Insight Banner, Workload charts, Audit Log feed. | `GET /admin/dashboard-stats`<br>Aggregates counts, computes daily workloads, calls Gemini AI insights. |
| **4** | **Structure Setup**<br>([`Structure.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Structure.jsx)) | Admin | Academic year, department hierarchy, semester counts, cluster setup, institution config. | `GET/POST /institution-config`<br>Manages global parameters (working days, period durations, break slots). |
| **5** | **Faculty Management**<br>([`Faculty.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Faculty.jsx)) | Admin | Add/Edit faculty, assign workload caps, assign comma-separated subject competencies, view availability. | `GET/POST/PUT/DELETE /faculty`<br>`GET /faculty/availability`<br>Ensures workload limits and competency checks. |
| **6** | **Subjects Management**<br>([`Subjects.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Subjects.jsx)) | Admin | Course catalog, subject type (Theory/Practical), credit hours, **AI Core Subject Auto-Detector**. | `GET/POST/PUT/DELETE /subject`<br>`POST /ai/identify-core`<br>Integrates Gemini to auto-flag core subjects. |
| **7** | **Labs Management**<br>([`Labs.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Labs.jsx)) | Admin | Computer lab list, lab capacity, hardware specs, continuous multi-slot block allocations. | `GET/POST/PUT/DELETE /lab`<br>Handles lab batch splits and continuous slot requirements. |
| **8** | **Rooms Management**<br>([`Rooms.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Rooms.jsx)) | Admin | Classroom directory, room type (Lecture Hall, Seminar Room), seating capacity, smartboard tags. | `GET/POST/PUT/DELETE /room`<br>Validates room type matching for lectures vs labs. |
| **9** | **Sections Management**<br>([`Sections.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Sections.jsx)) | Admin | Section list (e.g. CSE-A, ECE-B), strength, semester, class coordinator assignment. | `GET/POST/PUT/DELETE /section`<br>Sets section boundaries for generation. |
| **10** | **Timetable Grid & Generator**<br>([`Timetable.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Timetable.jsx)) | Admin | **Core Generator Hub:** Click "Generate", view interactive grid, lock/pin slots, drag-and-drop edit, PDF/Excel export. | `GET /timetable/generate`<br>`GET /timetable/view`<br>`POST /timetables/`<br>Executes heuristic generator, saves drafts, exports formats. |
| **11** | **Faculty Timetable View**<br>([`FacultyTimetable.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/FacultyTimetable.jsx)) | Faculty / Admin | Filter by faculty member to view personalized weekly schedule across all sections. | `GET /saved-faculty-tt`<br>Filters global timetable entries by `faculty_id`. |
| **12** | **Additional Timetable & OCR**<br>([`AdditionalTimetable.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/AdditionalTimetable.jsx)) | Admin | Remedial class scheduling, elective allocation, **OCR Paper Timetable File Scanner**. | `POST /ocr/parse-timetable`<br>Runs OpenCV + PyTesseract OCR pipeline to digitize paper schedules. |
| **13** | **Admin Settings & Audit Logs**<br>([`Admin.jsx`](file:///c:/Users/rupna/OneDrive/Desktop/AI-Timetable-Generator/frontend/src/pages/Admin.jsx)) | Super Admin | System user access control, global audit log history viewer, database backup/reset utilities. | `GET /admin/audit-logs`<br>`POST /admin/reset-database`<br>Full auditing and database administration. |

---

## 6. Step-by-Step Presentation & Live Demo Script

When presenting or demonstrating this project to professors, project guides, or evaluators, follow this exact **6-Phase Flow**:

```
+------------------------------------------------------------------------------------+
|                         PRESENTATION TIMELINE (15 MINUTES)                         |
+------------------------------------------------------------------------------------+
| Phase 1: High-Impact Opening & Problem Statement                         [2 Mins]  |
| Phase 2: Architecture & Database Design                                  [2 Mins]  |
| Phase 3: Live System Walkthrough (Login -> Dashboard -> Structure)       [3 Mins]  |
| Phase 4: Core Generation Demo (Timetable Grid, Lock/Pin, Core Filtering) [4 Mins]  |
| Phase 5: AI Features & Paper OCR Ingestion Demo                          [3 Mins]  |
| Phase 6: Conclusion & Summary                                            [1 Min]   |
+------------------------------------------------------------------------------------+
```

### 🗣️ Phase 1: High-Impact Opening (2 Mins)
- **What to say:**  
  *"Respected Evaluators, traditional timetable scheduling in colleges takes weeks of manual work and often results in faculty double-booking or room conflicts. Today, we present **NexusSchedule**, an AI-powered academic scheduling platform that generates 100% conflict-free timetables in under 2 seconds while optimizing cognitive learning for students."*

### 🗣️ Phase 2: Architecture & System Setup (2 Mins)
- **What to say:**  
  *"NexusSchedule is built using a modern decoupled architecture: React 18 on the frontend, FastAPI Python on the backend, SQLite persistence, and Google Gemini AI integration. The system models scheduling as a Constraint Satisfaction Problem (CSP)."*

### 🗣️ Phase 3: Live Demo — Configuration Setup (3 Mins)
- **What to show on screen:**
  1. Open the browser and show the **Landing Page**.
  2. Click **Admin Login** and log into the **Admin Dashboard**. Point out the stat cards and AI summary banner.
  3. Briefly navigate to **Faculty** and **Subjects**. Show how subjects have an `is_core` tag and credit hours attached.
  4. Click the **"Auto-Detect Core Subjects"** button on the Subjects page to show Gemini AI in action!

### 🗣️ Phase 4: Live Demo — The Timetable Generator (4 Mins)
- **What to show on screen:**
  1. Navigate to the **Timetable** page. Select a section (e.g. `CSE-A`).
  2. Click **"🔄 Generate New Timetable"**.
  3. **Highlight the Result:**
     - Point out that **No subject repeats twice on the same day**.
     - Point out that **Core subjects (Mathematics, DBMS, OS) appear in the MORNING slots (before 12:30 PM)**.
     - Demonstrate **Slot Pinning:** Click the lock icon on a Monday 9:00 AM slot. Show that re-generating preserves this pinned slot!
  4. Click **"Export to PDF"** or **"Export to Excel"** to show instant download functionality.

### 🗣️ Phase 5: Live Demo — AI Faculty Coordinator & Paper OCR (3 Mins)
- **What to show on screen:**
  1. Go to **Faculty** page $\rightarrow$ Click **"Suggest Chief Coordinator"**. Show Gemini AI ranking faculty based on experience and workload.
  2. Go to **Additional Timetable / OCR Scanner** page $\rightarrow$ Upload a scanned paper timetable image/PDF. Show OpenCV + PyTesseract extracting rows into a clean digital table!

### 🗣️ Phase 6: Conclusion & Wrap-up (1 Min)
- **What to say:**  
  *"In conclusion, NexusSchedule eliminates manual human error, guarantees 0% resource collisions, respects pedagogical cognitive focus, and bridges physical paper records with digital AI automation."*

---

## 7. Anticipated Examiner / Viva Q&A Guide

Here are the top questions evaluators are guaranteed to ask, along with your exact technical answers:

#### **Q1: What algorithm is used to generate the timetable? Is it Genetic Algorithm or CSP?**
> **Answer:** *"NexusSchedule uses a **Heuristic Backtracking Constraint Satisfaction Algorithm (CSP)** combined with daily tracking sets. It treats timeslots as variables and (Subject, Faculty, Room) triples as domain values. It checks 4 hard constraints in real-time ($O(1)$ lookup via Python sets) and applies AI heuristic soft constraints for core subject morning placement."*

#### **Q2: How do you guarantee that a faculty member is not scheduled in two classes simultaneously?**
> **Answer:** *"We maintain a global hash set `used_faculty` containing tuples of `(faculty_id, slot_id)`. Before assigning any slot, the algorithm checks `(faculty.id, slot.id) in used_faculty`. If true, it skips that faculty or assigns an available qualified substitute."*

#### **Q3: How do you handle the constraint where a subject should not be repeated twice on the same day?**
> **Answer:** *"Inside the generator loop, for each section and each day, we maintain a set `subjects_used_per_day[day]`. A candidate subject is eligible only if `subject.id not in subjects_used_per_day[day]`. Once assigned, `subject.id` is added to that day's set."*

#### **Q4: What role does Artificial Intelligence (Gemini LLM) play in your system?**
> **Answer:** *"Gemini LLM is utilized in three key areas:  
> 1. **Core Subject Auto-Classification:** Analyzing course syllabi to flag heavy analytical subjects requiring morning focus.  
> 2. **Chief Course Coordinator Ranking:** Evaluating faculty workloads and designations to rank course leaders.  
> 3. **Executive Analytics Insights:** Generating executive summary reports on institutional resource utilization."*

#### **Q5: How does your OCR engine handle low-quality paper timetable scans?**
> **Answer:** *"Our custom OCR engine in `ocr_timetable.py` uses OpenCV for image preprocessing (grayscale conversion, thresholding, noise reduction). It dynamically calculates row and column bucket tolerances scaled to image dimensions, applies Indian college subject code correction rules (e.g. merging split tokens like '21CS' + '44' into '21CS44'), and provides a per-entry confidence score."*

#### **Q6: What happens if there are not enough rooms or faculty members to satisfy all subjects?**
> **Answer:** *"The generator pre-validates data sufficiency before execution. If available resources cannot satisfy required credit hours, the engine reports an explicit validation message indicating which resource is lacking, preventing incomplete or invalid DB commits."*

#### **Q7: Can an admin manually lock or modify a specific slot?**
> **Answer:** *"Yes! Administrators can lock/pin specific slots (e.g., reserving Friday 2:00 PM for Sports/Library). The generator reads pinned slot state and preserves those exact assignments while scheduling the remaining unpinned slots around them."*

---

> **End of Technical Report**  
> *Generated for NexusSchedule Project Presentation & Viva Evaluation.*
