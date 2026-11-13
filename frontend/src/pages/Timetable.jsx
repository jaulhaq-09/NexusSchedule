import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import API, { savedTimetablesAPI } from "../services/api";
import SavedTimetablesList from "../components/SavedTimetablesList";
import TimetableConfig from "../components/TimetableConfig";
import TimetableGrid from "../components/TimetableGrid";
import ConflictResolutionModal from "../components/ConflictResolutionModal";
import UnplacedClassesModal from "../components/UnplacedClassesModal";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from 'xlsx';
import { getInstitutionConfig } from '../services/api';
import { useLocation } from "react-router-dom";

// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

const injectFonts = () => {
  if (document.getElementById("tt-fonts")) return;
  const l = document.createElement("link");
  l.id = "tt-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(l);
  const s = document.createElement("style");
  s.textContent = `
    @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
    @keyframes popIn     { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse     { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
    .tt-row:hover td { background: rgba(234,179,8,0.04) !important; }
    .tt-cell:hover   { filter: brightness(1.08); transform: scale(1.01); }
    .tt-btn:hover    { transform: translateY(-1px); filter: brightness(1.1); }
    .tt-saved-row:hover { background: rgba(255,255,255,0.06) !important; transform: translateY(-2px); }
    .lab-row:hover { background: rgba(255,255,255,0.03) !important; }
    .stat-card:hover { transform: translateY(-4px) scale(1.02); }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(234,179,8,0.3); border-radius:3px; }
  `;
  document.head.appendChild(s);
};

const PALETTE = [
  "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#06B6D4",
  "#A78BFA", "#FB7185", "#34D399", "#FBBF24", "#60A5FA",
];

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const loadPage = () => { try { return JSON.parse(localStorage.getItem("tt_page") || "{}"); } catch { return {}; } };
const myUser = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };

// ✅ paired_lab_name is now a comma-separated list of partner names, so
// every read site parses it instead of comparing a single string.
const parsePairedNames = (str) => (str || "").split(",").map(s => s.trim()).filter(Boolean);

// True if a period slot's start time is before 12:30 PM.
// Expects "HH:MM - HH:MM" 24-hour strings, matching the shape built
// from institution config's start_time/end_time in fetchAll().
const isMorningSlot = (timeStr) => {
  if (!timeStr) return false;
  const startPart = timeStr.split("-")[0].trim();
  const [hStr, mStr] = startPart.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return false;
  return h < 12 || (h === 12 && m < 30);
};

// Reorders free period-slot indices so the preferred half (morning or
// afternoon) is tried first, preserving ascending order within each half.
const orderIndicesByPreference = (indices, periodSlots, preferMorning) => {
  const preferred = [];
  const rest = [];
  indices.forEach(idx => {
    const morning = isMorningSlot(periodSlots[idx]?.time);
    (morning === preferMorning ? preferred : rest).push(idx);
  });
  return [...preferred, ...rest];
};

const selectSt = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(234,179,8,0.3)",
  fontSize: "13px",
  background: "rgba(255,255,255,0.05)",
  color: "#EAB308",
  cursor: "pointer",
  minWidth: "160px",
  outline: "none",
  fontFamily: "Sora,sans-serif",
  fontWeight: "500",
};

if (!document.getElementById("select-option-style")) {
  const style = document.createElement("style");
  style.id = "select-option-style";
  style.textContent = `
    select option {
      background: #0F172A !important;
      color: #F0EDE8 !important;
      padding: 10px !important;
      font-family: 'Sora', sans-serif !important;
      font-size: 13px !important;
    }
    select option:checked {
      background: rgba(234,179,8,0.3) !important;
      color: #EAB308 !important;
      font-weight: 600 !important;
    }
    select option:hover {
      background: rgba(234,179,8,0.15) !important;
    }
    select:focus {
      border-color: #EAB308 !important;
      box-shadow: 0 0 0 3px rgba(234,179,8,0.15) !important;
    }
  `;
  document.head.appendChild(style);
}

const inputSt = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", color: "#F0EDE8",
  padding: "7px 10px", fontSize: "13px",
  outline: "none", fontFamily: "Sora,sans-serif",
  width: "100%",
};

function buildConflictKey(day, time, facultyName) {
  return JSON.stringify({ day, time, f: facultyName });
}

const normFac = (n) => (n || "").toLowerCase().replace(/\s+/g, " ").trim();

// every faculty name on an entry, incl. "A/B" multi-faculty and batch-split entries
const entryFaculty = (e) => {
  const raw = e.isBatchSplit ? [e.batchA?.facultyName, e.batchB?.facultyName] : [e.facultyName];
  return raw.flatMap(n => (n || "").split("/")).map(n => n.trim()).filter(n => n && n !== "-" && n !== "—");
};

// all period times an entry occupies (a 2-period lab/double covers both)
const coveredTimes = (periodSlots, time, span) => {
  const i = periodSlots.findIndex(p => p.time === time);
  if (i === -1) return [time];
  return periodSlots.slice(i, i + (span || 1)).map(p => p.time);
};

// "day|time|faculty" -> [other sectionIds busy then]. Other sections only,
// same odd/even term only. A section in `grids` (this session) overrides its
// older saved copy in `busy`.
const buildOthersMap = ({ curId, grids, busy, periodSlots, sections }) => {
  const cur = sections.find(s => String(s.id) === curId);
  const validIds = new Set(
    sections.filter(s => !cur || s.semester % 2 === cur.semester % 2).map(s => String(s.id))
  );
  const map = {};
  const mark = (sid, day, time, span, name) =>
    coveredTimes(periodSlots, time, span).forEach(t => {
      const k = `${day}|${t}|${normFac(name)}`;
      if (!map[k]) map[k] = [];
      if (!map[k].includes(String(sid))) map[k].push(String(sid));
    });
  Object.entries(grids).forEach(([sid, entries]) => {
    if (String(sid) === curId || !validIds.has(String(sid))) return;
    entries.forEach(e => entryFaculty(e).forEach(f => mark(sid, e.day, e.time, e.span, f)));
  });
  busy.forEach(b => {
    const sid = String(b.section_id);
    if (sid === curId || sid in grids) return;
    mark(sid, b.day, b.time, b.span, b.faculty);
  });
  return map;
};

export default function Timetable() {

  useScrollToTop();  // ✅ ADD THIS LINE
  injectFonts();

  // ADD THESE (as state, inside the component, before other useState):
  const [DAYS, setDAYS] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [SLOTS, setSLOTS] = useState([]);
  const [PERIOD_SLOTS, setPERIOD_SLOTS] = useState([]);
  // 🔥 ADD THESE 4 LINES HERE:
  const [institutionName, setInstitutionName] = useState('');
  const [institutionAddress, setInstitutionAddress] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selDepartment, setSelDepartment] = useState('');
  const [departments, setDepartments] = useState([
    { id: '1', name: 'Computer Science and Engineering', code: 'CSE' },
    { id: '2', name: 'Mechanical Engineering', code: 'ME' },
    { id: '3', name: 'Civil Engineering', code: 'CIVIL' },
    { id: '4', name: 'Electrical and Electronics Engineering', code: 'EEE' },
    { id: '5', name: 'Electronics and Communication Engineering', code: 'ECE' },
    { id: '6', name: 'Information Science and Engineering', code: 'ISE' },
    { id: '7', name: 'Management Studies', code: 'MBA' },
    { id: '8', name: 'Artificial Intelligence and Machine Learning', code: 'AIML' },
    { id: '9', name: 'Data Science', code: 'DS' },
    { id: '10', name: 'Biotechnology', code: 'BT' },
  ]);
  const [toast, setToast] = useState(null);
  const [grid, setGrid] = useState({});
  const [data, setData] = useState([]);
  // ✅ Tracks whether the initial data load (faculty/subjects/rooms/
  // sections/labs/institution config) has finished. Generate reads
  // PERIOD_SLOTS, labConfig, subjectConfig etc. — clicking before this
  // is true means those can still be empty, producing a broken or empty
  // timetable on the very first click after navigating to this page.
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [editCell, setEditCell] = useState(null);
  const [cellInput, setCellInput] = useState("");


  const handleSectionImport = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const rows = jsonData.slice(1).filter(row => row && row[0]);
      const newSections = rows.map((row, idx) => ({
        id: `imported_${Date.now()}_${idx}`,
        section_name: String(row[0] || '').trim(),
        cluster: row[1] ? parseInt(String(row[1]).replace(/[^0-9]/g, '')) || 1 : 1,
        semester: row[2] ? parseInt(String(row[2]).replace(/[^0-9]/g, '')) || 4 : 4,
      })).filter(s => s.section_name);
      if (newSections.length === 0) {
        toast$("No valid sections found in file", "error");
        return;
      }
      setSections(prev => {
        const existing = new Set(prev.map(s => s.section_name));
        const toAdd = newSections.filter(ns => !existing.has(ns.section_name));
        return [...prev, ...toAdd];
      });
      toast$(`✓ Imported ${newSections.length} sections`);
      setShowSectionImport(false);
    } catch (error) {
      console.error('Import error:', error);
      toast$("Failed to import sections", "error");
    }
  };

  // 🔥 UPGRADE #4: Filter states                                            
  const [filterAcademicYear, setFilterAcademicYear] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filteredSavedList, setFilteredSavedList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [conflictDetails, setConflictDetails] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [unplacedItems, setUnplacedItems] = useState([]);
  const [showUnplacedModal, setShowUnplacedModal] = useState(false);
  const [genSummary, setGenSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("config");
  const [showSectionImport, setShowSectionImport] = useState(false);  // ✅ ADD THIS
  const [facultyList, setFacultyList] = useState([]);
  const [apiSubjects, setApiSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [selRoomId, setSelRoomId] = useState(() => loadPage().selRoomId ?? "");
  const [selSectionId, setSelSectionId] = useState(() => loadPage().selSectionId ?? "");
  const [selCluster, setSelCluster] = useState(() => loadPage().selCluster ?? myUser().cluster ?? 1);
  const [selSemester, setSelSemester] = useState(() => loadPage().selSemester ?? 1);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    try { const s = localStorage.getItem("tt_selectedSubjects"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [selectedLabs, setSelectedLabs] = useState(() => {
    try { const s = localStorage.getItem("tt_selectedLabs"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  // ✅ Tracks every subject/lab name ever seen, persisted, so a page
  // refresh doesn't re-trigger the "select all by default" logic on
  // items the admin already configured (only genuinely NEW subjects/
  // labs get auto-checked going forward).
  const knownSubjectNamesRef = useRef(new Set());
  const knownLabNamesRef = useRef(new Set());
  useEffect(() => {
    try {
      const s = localStorage.getItem("tt_knownSubjectNames");
      knownSubjectNamesRef.current = s ? new Set(JSON.parse(s)) : new Set();
      const l = localStorage.getItem("tt_knownLabNames");
      knownLabNamesRef.current = l ? new Set(JSON.parse(l)) : new Set();
    } catch { }
  }, []);
  // ✅ "All Semesters" removed — Odd/Even is now mandatory, defaults to
  // "odd" so the app always has a definite parity selected.
  const [semesterType, setSemesterType] = useState(() => loadPage().semesterType ?? "odd"); // "odd" | "even"

  const [hdr, setHdr] = useState(() => loadPage().hdr ?? { totalStudents: "60", wef: "16-02-2026", classTeacher: "", academicYear: "2025-26" });
  const [exportModal, setExportModal] = useState(false);
  const [saveModal, setSaveModal] = useState(false);  // 🔥 ADD HERE
  const [exporting, setExporting] = useState(false);
  const [allSectionGrids, setAllSectionGrids] = useState({});
  const [dbBusy, setDbBusy] = useState([]);

  const [subjectConfig, setSubjectConfig] = useState(() => {
    try { const s = localStorage.getItem("tt_subjectConfig"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [labConfig, setLabConfig] = useState([]);
  const [pinnedSlots, setPinnedSlots] = useState(() => {
    try { const s = localStorage.getItem("tt_pinnedSlots"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  // ✅ SIMPLIFIED — no more reversed-order (A/B vs B/A) or per-day flip.
  // Each cross-pairing is stored under ONE sorted key, e.g. "ADA|DBMS".
  // Order shown/placed is always fixed: whichever lab is batch "A" comes
  // first. Self-pairs (same lab both sides) keep their own "X/X" keys.
  const [selectedPairs, setSelectedPairs] = useState(() => {
    try { const s = localStorage.getItem("tt_selectedPairs"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  // ✅ Initialized from storage (not empty) so a refresh doesn't treat
  // every existing pairing as "newly seen" and force it back to checked
  // — that was silently overriding whatever the admin had unchecked.
  const knownPairKeysRef = useRef(new Set());
  useEffect(() => {
    try {
      const s = localStorage.getItem("tt_knownPairKeys");
      knownPairKeysRef.current = s ? new Set(JSON.parse(s)) : new Set();
    } catch { }
  }, []);
  useEffect(() => {
    const currentKeys = new Set();
    labConfig.forEach(lab => {
      parsePairedNames(lab.pairedLabName).forEach(partnerName => {
        if (partnerName === lab.name) return;
        currentKeys.add([lab.name, partnerName].sort().join("|"));
      });
    });
    const newlySeen = [...currentKeys].filter(k => !knownPairKeysRef.current.has(k));
    if (newlySeen.length > 0) {
      knownPairKeysRef.current = new Set([...knownPairKeysRef.current, ...newlySeen]);
      try { localStorage.setItem("tt_knownPairKeys", JSON.stringify([...knownPairKeysRef.current])); } catch { }
      setSelectedPairs(prev => new Set([...prev, ...newlySeen]));
    }
  }, [labConfig]);
  const [selfPairs, setSelfPairs] = useState(() => {
    try { const s = localStorage.getItem("tt_selfPairs"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  // ✅ How many separate occurrences of a pairing (cross-pair or
  // self-pair) should exist — e.g. { "ADA|DBMS": 2 } means two
  // independent draggable copies, each placed on a different day
  // during generation. Keyed by the same pairKey format as above.
  const [pairCopies, setPairCopies] = useState(() => {
    try { const s = localStorage.getItem("tt_pairCopies"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [pinModal, setPinModal] = useState(null);
  const [pinSubjectSel, setPinSubjectSel] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const tableRef = useRef();

  const selRoom = rooms.find(r => String(r.id) === String(selRoomId)) || null;
  const selSection = sections.find(s => String(s.id) === String(selSectionId)) || null;

  const facultyOptions = useMemo(() =>
    facultyList.map(f => ({ value: String(f.id || f._id), label: f.name })),
    [facultyList]);

  const filteredSections = useMemo(() =>
    sections.filter(s => (s.cluster ?? 1) === selCluster && s.semester === selSemester),
    [sections, selCluster, selSemester]);

  const visibleSubjectConfig = useMemo(() => {
    const deptOk = (sc) => !selSection?.department_id || !sc.department_id || sc.department_id === selSection.department_id;
    if (semesterType === "all") return subjectConfig.filter(deptOk);
    return subjectConfig.filter(sc => {
      if (!deptOk(sc)) return false;
      if (!sc.semester) return true;
      const isOdd = sc.semester % 2 === 1;
      return semesterType === "odd" ? isOdd : !isOdd;
    });
  }, [subjectConfig, semesterType, selSection]);

  // Per-term teaching assignments: when a section / academic year is chosen,
  // apply the saved faculty for that section; otherwise fall back to
  // auto-matching within the section's own department.
  useEffect(() => {
    if (!initialLoadDone || !selSectionId || !selSection || !hdr.academicYear) return;
    const parity = selSection.semester % 2 === 1 ? "odd" : "even";
    let cancelled = false;
    const timer = setTimeout(() => {
      API.get("/teaching-assignments", {
        params: { academic_year: hdr.academicYear, parity, section_id: selSectionId },
      }).then(res => {
        if (cancelled) return;
        const saved = {};
        (res.data || []).forEach(a => {
          if (a.kind === "theory") saved[a.subject_name.toLowerCase()] = String(a.faculty_id);
        });
        const autoPick = (name) => {
          const m = facultyList.filter(f =>
            (f.subjects || "").toLowerCase().split(",").map(x => x.trim()).includes(name.toLowerCase()) &&
            (!selSection.department_id || !f.department_id || f.department_id === selSection.department_id)
          );
          return m[0] ? String(m[0].id || m[0]._id) : "";
        };
        setSubjectConfig(prev => prev.map(sc => ({
          ...sc,
          theoryFacultyId: saved[sc.subject.toLowerCase()] || autoPick(sc.subject),
        })));
      }).catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [initialLoadDone, selSectionId, hdr.academicYear, selSection?.semester, facultyList]);

  // ✅ Pulled out of the effect so TimetableConfig can trigger a reload
  // itself (e.g. right after editing a faculty member's "Labs" field,
  // which changes what faculty_ids the backend computes for each lab).
  const refreshLabs = useCallback(async () => {
    try {
      const res = await API.get("/labs/");
      const labs = res.data || [];
      setLabConfig(labs.map(lab => ({
        id: lab.id,
        name: lab.lab_name,
        code: lab.lab_code,
        batch: lab.batch,
        hoursPerWeek: lab.hours_per_week,
        facultyIds: Array.isArray(lab.faculty_ids) ? lab.faculty_ids.map(String) : [],
        pairedLabName: lab.paired_lab_name || null,
        roomId: lab.room_id || null,
        roomName: lab.room_name || null,
        isFixed: false
      })));
    } catch (err) {
      console.error("Failed to reload labs:", err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "config") refreshLabs();
  }, [activeTab, refreshLabs]);

  // ✅ facultyList is edited directly from the Labs table now (toggling a
  // lab's faculty writes to that faculty's `labs` field). Without a way to
  // refetch it, the next toggle would read a stale copy of facultyList and
  // silently overwrite a faculty's real `labs` field with outdated data.
  const refreshFaculty = useCallback(async () => {
    try {
      const res = await API.get("/faculty");
      setFacultyList(res.data || []);
    } catch (err) {
      console.error("Failed to reload faculty:", err);
    }
  }, []);

  useEffect(() => {
    if (filteredSections.length > 0) {
      const cur = filteredSections.find(s => String(s.id) === String(selSectionId));
      if (!cur) setSelSectionId(String(filteredSections[0].id));
    } else if (sections.length > 0) {
      setSelSectionId("");
    }
  }, [filteredSections]);

  useEffect(() => {
    if (!selRoomId) return;
    const room = rooms.find(r => String(r.id) === String(selRoomId));
    if (room?.capacity) setHdr(prev => ({ ...prev, totalStudents: String(room.capacity) }));
  }, [selRoomId, rooms]);

  const toast$ = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    try {
      // 🔥 ADD THIS BLOCK HERE
      const configRes = await getInstitutionConfig();
      const cfg = configRes.data;
      if (cfg.working_days?.length) setDAYS(cfg.working_days);
      if (cfg.slot_template?.length) {
        const slots = cfg.slot_template.map(s => ({
          type: s.slot_type === 'PERIOD' ? 'period' : 'break',
          label: s.label,
          time: `${s.start_time} - ${s.end_time}`
        }));
        setSLOTS(slots);
        setPERIOD_SLOTS(slots.filter(s => s.type === 'period'));
      }
      // 🔥 END OF ADDED BLOCK
      const [fR, sR, rR, secR, labR] = await Promise.all([
        API.get("/faculty").catch(() => ({ data: [] })),
        API.get("/subjects").catch(() => ({ data: [] })),
        API.get("/rooms").catch(() => ({ data: [] })),
        API.get("/sections").catch(() => ({ data: [] })),
        API.get("/labs/").catch(() => ({ data: [] })),
      ]);
      const fac = fR.data || [];
      const subs = sR.data || [];
      const rms = rR.data || [];
      const secs = secR.data || [];

      setFacultyList(fac);
      setApiSubjects(subs);
      setRooms(rms);
      setSections(secs);

      // 🔥 CHANGE #1: Make async with await
      const saved = await savedTimetablesAPI.getAll();
      setSavedList(saved);

      setSelRoomId(prev => {
        const classRooms = rms.filter(r => (r.room_type || "").toUpperCase() !== "LAB");
        const existing = prev && classRooms.find(r => String(r.id) === String(prev));
        const chosenRoom = existing ? classRooms.find(r => String(r.id) === String(prev)) : classRooms[0] || null;
        if (chosenRoom?.capacity) setHdr(h => ({ ...h, totalStudents: String(chosenRoom.capacity) }));
        return chosenRoom ? String(chosenRoom.id) : "";
      });

      // Other sections' saved timetables come from /saved-timetables/busy-slots
      // (term-scoped, latest non-archived). Only this session's own generated
      // sections live in allSectionGrids.

      setSubjectConfig(prev =>
        subs.map(sub => {
          const ex = prev.find(p => p.subject === sub.subject_name);
          const matched = fac.filter(f =>
            f.subjects?.toLowerCase().split(",").map(x => x.trim()).includes(sub.subject_name.toLowerCase())
          );
          return {
            ...(ex || {}),   // keep everything already configured (e.g. two-slot doublePerWeek)
            subject: sub.subject_name,
            code: sub.subject_code,
            semester: sub.semester ?? null,
            department_id: sub.department_id ?? null,
            hoursPerWeek: ex?.hoursPerWeek ?? sub.hours_per_week ?? 4,
            isFixed: ex?.isFixed ?? false,
            isCore: sub.is_core ?? false,
            // ✅ FIXED: always re-run auto-matching on every reload. Previously
            // `ex?.theoryFacultyId ?? matched[0]...` only fell back to the
            // match when theoryFacultyId was null/undefined — but once a
            // subject ever got set to "" (empty string, e.g. no match found
            // on an earlier load), `??` treated "" as "already set" and
            // never re-checked matched[0] again, even after a real match
            // became available (e.g. after adding faculty or a Labs field).
            // Now: if a match exists, it always wins. If no match exists,
            // fall back to whatever was already there so we don't wipe out
            // a manual pick when there's genuinely nothing to auto-suggest.
            theoryFacultyId: matched[0] ? String(matched[0].id || matched[0]._id) : (ex?.theoryFacultyId ?? ""),
            labFacultyId: ex?.labFacultyId ?? "",
          };
        })
      );
      // ✅ FIXED: merge instead of overwrite — only NEW subjects (never
      // seen before) get auto-checked. Subjects the admin already
      // unchecked stay unchecked across refresh/reload.
      {
        const currentSubjectNames = subs.map(s => s.subject_name);
        const newlySeenSubjects = currentSubjectNames.filter(n => !knownSubjectNamesRef.current.has(n));
        if (newlySeenSubjects.length > 0) {
          knownSubjectNamesRef.current = new Set([...knownSubjectNamesRef.current, ...newlySeenSubjects]);
          try { localStorage.setItem("tt_knownSubjectNames", JSON.stringify([...knownSubjectNamesRef.current])); } catch { }
          setSelectedSubjects(prev => new Set([...prev, ...newlySeenSubjects]));
        } else if (knownSubjectNamesRef.current.size === 0) {
          // First-ever load with nothing stored yet — select all, as before.
          knownSubjectNamesRef.current = new Set(currentSubjectNames);
          try { localStorage.setItem("tt_knownSubjectNames", JSON.stringify(currentSubjectNames)); } catch { }
          setSelectedSubjects(new Set(currentSubjectNames));
        }
      }

      const labsFromFaculty = [];
      const seenLabNames = new Set();

      fac.forEach(f => {
        const subjects = (f.subjects || "").split(",").map(s => s.trim()).filter(Boolean);
        subjects.forEach(subj => {
          if (subj.toLowerCase().includes("lab")) {
            const labKey = subj.toLowerCase();
            if (!seenLabNames.has(labKey)) {
              seenLabNames.add(labKey);
              const parentSubject = subj.replace(/\s*lab\s*/i, "").trim();
              labsFromFaculty.push({
                id: `fac_lab_${labKey.replace(/\s+/g, "_")}`,
                name: subj,
                code: subj.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase(),
                hoursPerWeek: 2,
                facultyIds: [String(f.id || f._id)],
                isFixed: false,
                parent_subject: parentSubject,
              });
            } else {
              const existing = labsFromFaculty.find(l => l.name.toLowerCase() === labKey);
              if (existing && !existing.facultyIds.includes(String(f.id || f._id))) {
                existing.facultyIds.push(String(f.id || f._id));
              }
            }
          }
        });
      });

      setLabConfig(prev => {
        const manualLabs = prev.filter(l => !String(l.id).startsWith("fac_lab_"));
        const autoLabs = labsFromFaculty.map(autoLab => {
          const existing = prev.find(l => l.id === autoLab.id);
          return existing
            ? { ...autoLab, hoursPerWeek: existing.hoursPerWeek, code: existing.code || autoLab.code, parent_subject: autoLab.parent_subject, pairedLabName: existing.pairedLabName || null }
            : autoLab;
        });
        return [...manualLabs, ...autoLabs];
      });

      const allLabNames = new Set();
      labsFromFaculty.forEach(l => allLabNames.add(l.name));
      const dbLabRes = await API.get("/labs/").catch(() => ({ data: [] }));
      const dbLabs = (dbLabRes.data || []).map(lab => ({ name: lab.lab_name }));
      dbLabs.forEach(l => allLabNames.add(l.name));

      // ✅ FIXED: merge instead of overwrite — same pattern as subjects
      // above. Only genuinely new labs get auto-checked; the admin's
      // existing checkbox state survives a refresh.
      {
        const currentLabNamesArr = [...allLabNames];
        const newlySeenLabs = currentLabNamesArr.filter(n => !knownLabNamesRef.current.has(n));
        if (newlySeenLabs.length > 0) {
          knownLabNamesRef.current = new Set([...knownLabNamesRef.current, ...newlySeenLabs]);
          try { localStorage.setItem("tt_knownLabNames", JSON.stringify([...knownLabNamesRef.current])); } catch { }
          setSelectedLabs(prev => new Set([...prev, ...newlySeenLabs]));
        } else if (knownLabNamesRef.current.size === 0) {
          knownLabNamesRef.current = new Set(currentLabNamesArr);
          try { localStorage.setItem("tt_knownLabNames", JSON.stringify(currentLabNamesArr)); } catch { }
          setSelectedLabs(allLabNames);
        }
      }

      setInitialLoadDone(true);
    } catch (e) { console.error("fetchAll error:", e); }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 🔥 CHANGE #4: Add useEffect to load saved timetables from database
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const saved = await savedTimetablesAPI.getAll();
        setSavedList(saved);
      } catch (err) {
        console.error("Failed to load saved timetables:", err);
      }
    };
    loadSaved();
  }, []);

  // 🔥 UPGRADE #4: Auto-apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [filterAcademicYear, filterDepartment, filterSemester, savedList, showArchived]);

  // 🔥 ADD THIS RIGHT AFTER THE ABOVE:
  useEffect(() => {
    getInstitutionConfig().then(res => {
      const cfg = res.data;
      if (cfg.working_days?.length) setDAYS(cfg.working_days);
      if (cfg.slot_template?.length) {
        const slots = cfg.slot_template.map(s => ({
          type: s.slot_type === 'PERIOD' ? 'period' : 'break',
          label: s.label,
          time: `${s.start_time} - ${s.end_time}`
        }));
        setSLOTS(slots);
        setPERIOD_SLOTS(slots.filter(s => s.type === 'period'));
      }
      // 🔥 ADD AFTER THIS LINE:
      if (cfg.institution_name) setInstitutionName(cfg.institution_name);
      if (cfg.institution_address) setInstitutionAddress(cfg.institution_address);
      if (cfg.department_name) setDepartmentName(cfg.department_name);
      if (cfg.logo_url) setLogoUrl(cfg.logo_url.startsWith('http') ? cfg.logo_url : `http://localhost:8000${cfg.logo_url}`);

    }).catch(e => console.error("Config load error:", e));
  }, []);



  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "sections_updated" || e.key === "rooms_updated") {
        fetchAll();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    const handleCustomUpdate = () => { fetchAll(); };
    window.addEventListener("sectionsUpdated", handleCustomUpdate);
    window.addEventListener("roomsUpdated", handleCustomUpdate);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sectionsUpdated", handleCustomUpdate);
      window.removeEventListener("roomsUpdated", handleCustomUpdate);
    };
  }, [fetchAll]);

  useEffect(() => {
    const g = {};
    data.forEach(d => {
      if (!g[d.day]) g[d.day] = {};
      g[d.day][d.time] = d;
      if ((d.span || 1) > 1) {
        const pIdx = PERIOD_SLOTS.findIndex(s => s.time === d.time);
        if (pIdx !== -1 && pIdx + 1 < PERIOD_SLOTS.length) {
          g[d.day][PERIOD_SLOTS[pIdx + 1].time] = { __absorbed: true, parentTime: d.time };
        }
      }
    });
    setGrid(g);
  }, [data]);

  useEffect(() => { try { localStorage.setItem("tt_subjectConfig", JSON.stringify(subjectConfig)); } catch { } }, [subjectConfig]);
  useEffect(() => { try { localStorage.setItem("tt_pinnedSlots", JSON.stringify(pinnedSlots)); } catch { } }, [pinnedSlots]);
  useEffect(() => { try { localStorage.setItem("tt_pairCopies", JSON.stringify(pairCopies)); } catch { } }, [pairCopies]);
  useEffect(() => { try { localStorage.setItem("tt_selectedSubjects", JSON.stringify([...selectedSubjects])); } catch { } }, [selectedSubjects]);
  useEffect(() => { try { localStorage.setItem("tt_selectedLabs", JSON.stringify([...selectedLabs])); } catch { } }, [selectedLabs]);
  useEffect(() => { try { localStorage.setItem("tt_selectedPairs", JSON.stringify([...selectedPairs])); } catch { } }, [selectedPairs]);
  useEffect(() => { try { localStorage.setItem("tt_selfPairs", JSON.stringify([...selfPairs])); } catch { } }, [selfPairs]);
  useEffect(() => { try { localStorage.setItem("tt_page", JSON.stringify({ selCluster, selSemester, selSectionId, selRoomId, semesterType, hdr })); } catch { } }, [selCluster, selSemester, selSectionId, selRoomId, semesterType, hdr]);

  const updateLab = (id, field, value) => setLabConfig(p => p.map(l => l.id === id ? { ...l, [field]: value } : l));
  
  const fetchBusySlots = useCallback(async (excludeSectionId) => {
    const sem = selSection?.semester;
    if (!sem || !hdr.academicYear) return [];
    const res = await API.get("/saved-timetables/busy-slots", {
      params: {
        academic_year: hdr.academicYear,
        parity: sem % 2 === 1 ? "odd" : "even",
        ...(excludeSectionId ? { exclude_section_id: excludeSectionId } : {}),
      },
    });
    return res.data || [];
  }, [selSection, hdr.academicYear]);

  const othersMap = useMemo(() => buildOthersMap({
    curId: String(selSectionId), grids: allSectionGrids, busy: dbBusy, periodSlots: PERIOD_SLOTS, sections,
  }), [selSectionId, allSectionGrids, dbBusy, PERIOD_SLOTS, sections]);

  useEffect(() => {
    if (!initialLoadDone || !selSectionId || !selSection) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchBusySlots(selSectionId)
        .then(b => { if (!cancelled) setDbBusy(b); })
        .catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [initialLoadDone, selSectionId, fetchBusySlots]);

  const isBusyElsewhere = useCallback((name, day, time, span) =>
    coveredTimes(PERIOD_SLOTS, time, span).some(t => (othersMap[`${day}|${t}|${normFac(name)}`] || []).length > 0),
  [othersMap, PERIOD_SLOTS]);

  const checkConflicts = useCallback((newEntries, sectionId, dbBusyOverride) => {
    const curId = String(sectionId);
    const map = buildOthersMap({
      curId, grids: allSectionGrids, busy: dbBusyOverride ?? dbBusy, periodSlots: PERIOD_SLOTS, sections,
    });
    const labelOf = (sid) => {
      const sec = sections.find(s => String(s.id) === String(sid));
      if (sec) return `C${sec.cluster ?? 1}-Sem${sec.semester}-${sec.section_name}`;
      const b = (dbBusyOverride ?? dbBusy).find(x => String(x.section_id) === String(sid));
      return b?.section_label || String(sid);
    };
    const found = [], foundDetails = [], seen = new Set();
    newEntries.forEach(e => entryFaculty(e).forEach(f => {
      const clashing = new Set();
      coveredTimes(PERIOD_SLOTS, e.time, e.span).forEach(t =>
        (map[`${e.day}|${t}|${normFac(f)}`] || []).forEach(s => clashing.add(s)));
      if (clashing.size === 0) return;
      const dk = `${e.day}|${e.time}|${normFac(f)}`;
      if (seen.has(dk)) return;
      seen.add(dk);
      const labels = [labelOf(curId), ...[...clashing].map(labelOf)];
      found.push(`⚠ ${f} → ${e.day} ${e.time} (${labels.join(" vs ")})`);
      foundDetails.push({ day: e.day, time: e.time, facultyName: f, sectionLabels: labels });
    }));
    setConflicts(found);
    setConflictDetails(foundDetails);
    return found;
  }, [allSectionGrids, sections, dbBusy, PERIOD_SLOTS]);

  const handleGenerate = useCallback(async () => {
    if (!selSectionId) { toast$("Please select a section before generating!", "error"); return; }
    if (!initialLoadDone || PERIOD_SLOTS.length === 0) {
      toast$("Still loading data — please wait a second and try again", "warn");
      return;
    }
    const genStartTime = performance.now();

    let dbBusyList = [];
    try {
      dbBusyList = await fetchBusySlots(selSectionId);
      setDbBusy(dbBusyList);
    } catch (err) {
      console.error("busy-slots fetch failed:", err);
      toast$("Couldn't load other sections' saved timetables — avoiding clashes with this session's sections only", "warn");
    }
    const getFacName = id => {
      if (!id) return "—";
      return facultyList.find(f => String(f.id || f._id) === String(id))?.name || "—";
    };
    
    const othersMapGen = buildOthersMap({
      curId: String(selSectionId), grids: allSectionGrids, busy: dbBusyList, periodSlots: PERIOD_SLOTS, sections,
    });
    const blockedFacSlots = new Set(Object.keys(othersMapGen)); // still used by the toast below

    const isFacBlocked = (facultyName, day, time) => {
      if (!facultyName || facultyName === "—" || facultyName === "-" || facultyName === "") return false;
      return (othersMapGen[`${day}|${time}|${normFac(facultyName)}`] || []).length > 0;
    };

    const finalData = [];
    const occupiedKeys = new Set();

    const getSlotIndex = (time) => PERIOD_SLOTS.findIndex(ps => ps.time === time);

    const pinnedSubjectCount = {};
    const pinnedLabsPerDay = {};
    // ✅ Pinned pairs (dragged onto specific days) bypass the random
    // pairUnits logic entirely, so they never alternated — each pin just
    // replayed batchA/batchB in whatever order it was dragged. This
    // tracks, per pair of lab names (sorted, so it matches DBMS/PSC and
    // PSC/DBMS the same), how many pinned occurrences have been written
    // so far, and swaps every 2nd one.
    const pinPairOccurrenceCount = {};
    const pinnedDoubleCount = {};

    Object.entries(pinnedSlots).forEach(([key, pin]) => {
      const [pDay, pTime] = key.split("|");
      const lCfgPin = pin.isLab ? labConfig.find(l => l.name === pin.subject) : null;
      const facName = pin.isLab
        ? (lCfgPin?.facultyIds || []).map(id => getFacName(id)).filter(f => f && f !== "—").join("/") || "—"
        : getFacName(subjectConfig.find(s => s.subject === pin.subject)?.theoryFacultyId || "");

      if (pin.isLab && pin.batchBSubject) {
        const lCfgPinB = labConfig.find(l => l.name === pin.batchBSubject);
        const facNameB = (lCfgPinB?.facultyIds || []).map(id => getFacName(id)).filter(f => f && f !== "—").join("/") || "—";
        const pinPairKey = [pin.subject, pin.batchBSubject].sort().join("|");
        const pinOccIdx = pinPairOccurrenceCount[pinPairKey] || 0;
        pinPairOccurrenceCount[pinPairKey] = pinOccIdx + 1;
        const pinSwap = pinOccIdx % 2 === 1;
        const sideA = pinSwap
          ? { subject: pin.batchBSubject, facultyName: facNameB, roomName: lCfgPinB?.roomName || null }
          : { subject: pin.subject, facultyName: facName, roomName: lCfgPin?.roomName || null };
        const sideB = pinSwap
          ? { subject: pin.subject, facultyName: facName, roomName: lCfgPin?.roomName || null }
          : { subject: pin.batchBSubject, facultyName: facNameB, roomName: lCfgPinB?.roomName || null };
        finalData.push({
          day: pDay, time: pTime, isLab: true, span: 2, isPinned: true, isBatchSplit: true,
          batchA: sideA,
          batchB: sideB,
        });
      } else {
        // A subject with Doubles/wk > 0 takes two adjacent periods when pinned,
        // if the next period is free and sits directly beside it.
        let pinSpan = 1;
        if (!pin.isLab) {
          const p0 = getSlotIndex(pTime);
          const wantedDoubles = parseInt(subjectConfig.find(s => s.subject === pin.subject)?.doublePerWeek) || 0;
          if (p0 !== -1 && p0 + 1 < PERIOD_SLOTS.length && (pinnedDoubleCount[pin.subject] || 0) < wantedDoubles) {
            const nextTime = PERIOD_SLOTS[p0 + 1].time;
            const adjacent = SLOTS.findIndex(s => s.time === nextTime) === SLOTS.findIndex(s => s.time === pTime) + 1;
            if (adjacent && !occupiedKeys.has(`${pDay}|${p0 + 1}`) && !pinnedSlots[`${pDay}|${nextTime}`]) pinSpan = 2;
          }
        }
        finalData.push({ day: pDay, time: pTime, subject: pin.subject, isLab: pin.isLab, span: pin.isLab ? 2 : pinSpan, isDouble: !pin.isLab && pinSpan === 2, isPinned: true, facultyName: facName, roomName: pin.isLab ? (lCfgPin?.roomName || null) : undefined });
        if (!pin.isLab && pinSpan === 2) pinnedDoubleCount[pin.subject] = (pinnedDoubleCount[pin.subject] || 0) + 1;
      }

      const pi = getSlotIndex(pTime);
      if (pi !== -1) occupiedKeys.add(`${pDay}|${pi}`);
      if (!pin.isLab) {
        const lastSpan = finalData[finalData.length - 1].span || 1;
        pinnedSubjectCount[pin.subject] = (pinnedSubjectCount[pin.subject] || 0) + lastSpan;
        if (lastSpan === 2 && pi !== -1) occupiedKeys.add(`${pDay}|${pi + 1}`);
      } else {
        if (pi !== -1 && pi + 1 < PERIOD_SLOTS.length) occupiedKeys.add(`${pDay}|${pi + 1}`);
        // ✅ FIXED: track BOTH the primary lab and its Batch 2 partner as
        // "already used" for this day — previously only pin.subject was
        // recorded, so a lab pinned as Batch 2 (e.g. ADA in a C/ADA pin)
        // stayed in the random-placement pool, got treated as unpaired,
        // and wasted a lab-slot that a real unpinned pair (like MC/C++)
        // needed, causing it to randomly drop out of the timetable.
        if (!pinnedLabsPerDay[pDay]) pinnedLabsPerDay[pDay] = [];
        pinnedLabsPerDay[pDay].push(pin.subject);
        if (pin.batchBSubject) pinnedLabsPerDay[pDay].push(pin.batchBSubject);
      }
    });

    // ════════════════════════════════════════════════════════════
    // 🧪 LAB SCHEDULING — clean rewrite, matches the college's
    // reference timetable pattern:
    //   • Every checked lab (standalone, paired, or self-paired)
    //     appears EXACTLY ONCE this week — never randomly skipped,
    //     never appearing twice.
    //   • A self-pair (e.g. "MC/MC") = same lab, Batch1+Batch2, one
    //     2-slot block, one day.
    //   • A cross-pair (e.g. "ADA/DBMS") = two different labs sharing
    //     one 2-slot block on one day. Which lab is Batch1 that day
    //     comes from pairDayOrder (the "Set Days" per-day toggle) —
    //     this is what makes ADA/DBMS on Wednesday reverse to DBMS/ADA
    //     on Friday, matching the reference PDF.
    //   • A standalone lab (checked individually, not part of any
    //     pairing) = one 2-slot block, one day, shown alone.
    //   • Pinned lab slots are respected as already-occupied.
    // ════════════════════════════════════════════════════════════

    const labSlotOptions = [];
    for (let i = 0; i < PERIOD_SLOTS.length - 1; i++) {
      const time1 = PERIOD_SLOTS[i].time;
      const time2 = PERIOD_SLOTS[i + 1].time;
      const idx1 = SLOTS.findIndex(s => s.time === time1);
      const idx2 = SLOTS.findIndex(s => s.time === time2);
      if (idx2 === idx1 + 1) labSlotOptions.push([i, i + 1]);
    }

    const getLabFacName = (labName) => {
      const lCfg = labConfig.find(l => l.name === labName) || {};
      const ids = lCfg.facultyIds || [];
      return ids.map(id => getFacName(id)).filter(f => f && f !== "—").join("/") || "—";
    };

    // ✅ SIMPLIFIED — fixed order only, no day-based reversal. Whichever
    // lab is stored as batch "A" is always Batch 1 for every occurrence.
    const getPairOrder = (labA, labB) => {
      const aIsBatchA = labConfig.find(l => l.name === labA)?.batch === "A";
      return aIsBatchA ? [labA, labB] : [labB, labA];
    };

    const unpinnedLabDays = DAYS.filter(d => !pinnedLabsPerDay[d]);
    const allPinnedLabNames = new Set(Object.values(pinnedLabsPerDay).flat());

    // 1) Every checked cross-lab pairing → expanded into `copies` units.
    const seenPairKeys = new Set();
    const pairUnits = [];
    labConfig.forEach(lab => {
      parsePairedNames(lab.pairedLabName).forEach(partnerName => {
        if (partnerName === lab.name) return;
        const pairKey = [lab.name, partnerName].sort().join("|");
        if (!selectedPairs.has(pairKey)) return;
        if (allPinnedLabNames.has(lab.name) || allPinnedLabNames.has(partnerName)) return;
        if (seenPairKeys.has(pairKey)) return;
        seenPairKeys.add(pairKey);
        const copies = pairCopies[pairKey] || 1;
        for (let i = 0; i < copies; i++) {
          pairUnits.push({ type: "pair", a: lab.name, b: partnerName, pairKey, swap: i % 2 === 1 });
        }
      });
    });

    // 2) Every checked self-pair (same lab, Batch1+Batch2) → expanded
    // into `copies` units too.
    const selfPairUnits = [];
    [...selfPairs].forEach(key => {
      if (!selectedPairs.has(key)) return;
      const [a, b] = key.split("/");
      if (allPinnedLabNames.has(a)) return;
      const copies = pairCopies[key] || 1;
      for (let i = 0; i < copies; i++) {
        selfPairUnits.push({ type: "pair", a, b, pairKey: key, swap: i % 2 === 1 });
      }
    });

    // 3) Every individually-checked lab NOT already used above → single.
    const involvedInAnyPair = new Set();
    [...pairUnits, ...selfPairUnits].forEach(u => { involvedInAnyPair.add(u.a); involvedInAnyPair.add(u.b); });
    const singleUnits = labConfig
      .filter(l => selectedLabs.has(l.name) && !involvedInAnyPair.has(l.name) && !allPinnedLabNames.has(l.name))
      .map(l => ({ type: "single", lab: l.name }));

    const allLabUnits = shuffle([...pairUnits, ...selfPairUnits, ...singleUnits]);

    // 4) Assign each unit to a day — round-robin across unpinned days,
    // max 2 lab-units per day, and never the SAME lab twice on the same
    // day (so 2x/3x copies of a pairing spread across different days,
    // matching the reference timetable pattern).
    const unplacedLabs = [];
    const dayUnitMap = {};
    const dayCounts = {};
    const labDayUsed = {};
    unpinnedLabDays.forEach(d => { dayUnitMap[d] = []; dayCounts[d] = 0; });

    let dayCursor = 0;
    allLabUnits.forEach(unit => {
      const labsNeeded = unit.type === "pair" ? [unit.a, unit.b] : [unit.lab];
      for (let attempt = 0; attempt < unpinnedLabDays.length; attempt++) {
        const day = unpinnedLabDays[(dayCursor + attempt) % unpinnedLabDays.length];
        if (dayCounts[day] >= 2) continue;
        if (labsNeeded.some(n => labDayUsed[n]?.has(day))) continue;
        dayUnitMap[day].push(unit);
        dayCounts[day]++;
        labsNeeded.forEach(n => { if (!labDayUsed[n]) labDayUsed[n] = new Set(); labDayUsed[n].add(day); });
        dayCursor = (dayCursor + attempt + 1) % unpinnedLabDays.length;
        return;
      }
      unplacedLabs.push(unit.type === "pair" ? `${unit.a}/${unit.b}` : unit.lab);
    });

    // 5) Place each day's units into actual time slots.
    // ✅ pairOccurrenceCount tracks, per pairKey, how many times that
    // pairing has actually been WRITTEN into the timetable so far —
    // alternating the batch order by this real placement count instead of
    // the creation-time `unit.swap` flag, so 2x/3x copies reliably
    // alternate no matter what order shuffle/day-assignment puts them in.
    const pairOccurrenceCount = {};
    DAYS.forEach(day => {
      const dayUnits = dayUnitMap[day] || [];
      const baseCursor = Math.floor(Math.random() * 2);
      let slotOffset = 0;

      dayUnits.forEach(unit => {
        if (unit.type === "pair") {
          const occIdx = pairOccurrenceCount[unit.pairKey] || 0;
          pairOccurrenceCount[unit.pairKey] = occIdx + 1;
          const swapThis = occIdx % 2 === 1;
          const [orderedA, orderedB] = getPairOrder(unit.a, unit.b);
                    const [batch1Name, batch2Name] = unit.swap ? [orderedB, orderedA] : [orderedA, orderedB];
          let placedPair = false;
          for (let attempt = 0; attempt < labSlotOptions.length; attempt++) {
            const pair = labSlotOptions[(baseCursor + slotOffset + attempt) % labSlotOptions.length];
            const i0 = pair[0], i1 = pair[1];
            if (occupiedKeys.has(`${day}|${i0}`) || occupiedKeys.has(`${day}|${i1}`)) continue;
            const t0 = PERIOD_SLOTS[i0]?.time;
            if (!t0) continue;
            // A lab can take this slot only if at least one of its assigned
            // faculty is free for BOTH periods; busy ones sit this slot out.
            const t1 = PERIOD_SLOTS[i1]?.time;
            const freeFacsOf = (labName) => getLabFacName(labName).split("/").map(s => s.trim())
              .filter(f => f && f !== "—" && !isFacBlocked(f, day, t0) && !isFacBlocked(f, day, t1));
            const hasFac = (labName) => getLabFacName(labName) !== "—";
            const freeA = freeFacsOf(batch1Name), freeB = freeFacsOf(batch2Name);
            if ((hasFac(batch1Name) && freeA.length === 0) || (hasFac(batch2Name) && freeB.length === 0)) continue;
            const getLabRoomName = (labName) => labConfig.find(l => l.name === labName)?.roomName || null;
            finalData.push({
              day, time: t0, isLab: true, span: 2, isBatchSplit: true,
              batchA: { subject: batch1Name, facultyName: hasFac(batch1Name) ? freeA.join("/") : "—", roomName: getLabRoomName(batch1Name) },
              batchB: { subject: batch2Name, facultyName: hasFac(batch2Name) ? freeB.join("/") : "—", roomName: getLabRoomName(batch2Name) },
            });
            occupiedKeys.add(`${day}|${i0}`);
            occupiedKeys.add(`${day}|${i1}`);
            placedPair = true;
            break;
          }
          if (!placedPair) unplacedLabs.push(`${batch1Name}/${batch2Name}`);
          slotOffset++;
          return;
        }

        const labName = unit.lab;
        const lCfg = labConfig.find(l => l.name === labName) || {};
        const ids = lCfg.facultyIds || [];
        // ✅ FIXED: previously one faculty was picked at random BEFORE
        // knowing the day/slot, so a lab with several assigned faculty
        // could fail to place (or quietly block out a slot) just because
        // that one random pick was busy elsewhere — even when another of
        // the lab's own faculty was free. Now every assigned faculty is
        // tried per slot attempt, shuffled, and the slot only counts as
        // unusable if ALL of them are blocked at that exact day/time.
        const candidateIds = ids.length > 0 ? shuffle(ids) : [""];
        const getDisplay = (facultyId) => {
          const code = lCfg.code || labName;
          const f = facultyList.find(ff => String(ff.id || ff._id) === String(facultyId));
          const initials = f ? f.name.split(" ").map(w => w[0]).join("") : "";
          return initials ? `${code}-${initials}` : code;
        };

        for (let attempt = 0; attempt < labSlotOptions.length; attempt++) {
          const pair = labSlotOptions[(baseCursor + slotOffset + attempt) % labSlotOptions.length];
          const i0 = pair[0], i1 = pair[1];
          if (occupiedKeys.has(`${day}|${i0}`) || occupiedKeys.has(`${day}|${i1}`)) continue;
          const t0 = PERIOD_SLOTS[i0]?.time;
          if (!t0) continue;

          const t1 = PERIOD_SLOTS[i1]?.time;
          const freeCandidateId = candidateIds.find(cid => !isFacBlocked(getFacName(cid), day, t0) && !isFacBlocked(getFacName(cid), day, t1));
          if (freeCandidateId === undefined) continue;

          const facName = getFacName(freeCandidateId) || "—";
          finalData.push({ day, time: t0, subject: labName, isLab: true, span: 2, facultyName: facName, labDisplay: getDisplay(freeCandidateId), roomName: lCfg.roomName || null });
          occupiedKeys.add(`${day}|${i0}`);
          occupiedKeys.add(`${day}|${i1}`);
          slotOffset++;
          return;
        }
        unplacedLabs.push(labName);
        slotOffset++;
      });
    });

    // Any subject whose name contains "lab"/"laboratory" is treated as a
    // real lab session and must always occupy a continuous 2-period block,
    // the same way entries from labConfig do — regardless of whatever
    // doublePerWeek value (often left at 0) is set on the Subjects page.
    const isLabNamedSubject = (name) => /\blab(oratory)?\b/i.test(name || "");

    const theoryTokens = [];
    subjectConfig.filter(sc => selectedSubjects.has(sc.subject) && (!selSection?.department_id || !sc.department_id || sc.department_id === selSection.department_id)).forEach(sc => {
      const totalHours = parseInt(sc.hoursPerWeek) || 0;
      const pinned = pinnedSubjectCount[sc.subject] || 0;
      const remaining = Math.max(0, totalHours - pinned);
      if (remaining === 0) return;

      const facName = getFacName(sc.theoryFacultyId);
      const maxDoubles = Math.floor(remaining / 2);

      const forceAllDoubles = isLabNamedSubject(sc.subject);
      const doubles = forceAllDoubles ? maxDoubles : Math.min(Math.max(0, (parseInt(sc.doublePerWeek) || 0) - (pinnedDoubleCount[sc.subject] || 0)), maxDoubles);
      const singles = remaining - doubles * 2;

      for (let i = 0; i < doubles; i++)
        theoryTokens.push({ subject: sc.subject, facultyName: facName, isDouble: true, isCore: sc.isCore, isLabNamed: forceAllDoubles });
      for (let i = 0; i < singles; i++)
        theoryTokens.push({ subject: sc.subject, facultyName: facName, isDouble: false, isCore: sc.isCore, isLabNamed: forceAllDoubles });
    });

    const getFreeIndices = (day) =>
      PERIOD_SLOTS
        .map((_, idx) => idx)
        .filter(idx => !occupiedKeys.has(`${day}|${idx}`));

    // Core subjects are placed before non-core ones so they get first claim
    // on morning slots; non-core tokens fill what's left, preferring
    // afternoon slots when available.
    const coreTokens = shuffle(theoryTokens.filter(t => t.isCore));
    const nonCoreTokens = shuffle(theoryTokens.filter(t => !t.isCore));
    // Place one-period classes before doubles so they can claim early periods;
    // doubles then use the remaining adjacent slots. Core order is stable within
    // each duration group.
    const shuffledTokens = [...coreTokens, ...nonCoreTokens].sort((a, b) => (a.isDouble ? 1 : 0) - (b.isDouble ? 1 : 0));
    const subjectDayUsed = {};
    // Generated single-period classes that the gap-filler below may move.
    const movable = new Set();
    // A two-slot class may only use two periods that sit directly next to each
    // other on the grid (never across the break or lunch column).
    const validPairStart = new Set(labSlotOptions.map(p => p[0]));

    const tryPlaceToken = (token, allowSameDay, ignoreFacBlock) => {
      const { subject, facultyName, isDouble, isCore, isLabNamed } = token;
      if (!subjectDayUsed[subject]) subjectDayUsed[subject] = new Set();

      // Try the days with the most free pre-12:30 slots first, so every day's
      // morning fills evenly instead of some days staying empty.
      const morningFree = (d) => getFreeIndices(d).filter(i => isMorningSlot(PERIOD_SLOTS[i]?.time)).length;
      const dayOrder = shuffle([...DAYS]).sort((a, b) => morningFree(b) - morningFree(a));
      for (const day of dayOrder) {
        if (!allowSameDay && subjectDayUsed[subject].has(day)) continue;

        const freeIdxRaw = getFreeIndices(day);
        if (freeIdxRaw.length === 0) continue;
        const freeIdx = orderIndicesByPreference(freeIdxRaw, PERIOD_SLOTS, true);

        if (isDouble) {
          for (let fi = 0; fi < freeIdx.length - 1; fi++) {
            const i0 = freeIdx[fi];
            const i1 = freeIdx[fi + 1];
            if (i1 !== i0 + 1 || !validPairStart.has(i0)) continue;
            const t0 = PERIOD_SLOTS[i0].time;
            const t1 = PERIOD_SLOTS[i1].time;
            if (!ignoreFacBlock && (isFacBlocked(facultyName, day, t0) || isFacBlocked(facultyName, day, t1))) continue;
            finalData.push({ day, time: t0, subject, isLab: !!isLabNamed, span: 2, isDouble: true, facultyName, isCore: !!isCore });
            occupiedKeys.add(`${day}|${i0}`);
            occupiedKeys.add(`${day}|${i1}`);
            subjectDayUsed[subject].add(day);
            return true;
          }
        } else {
          for (const idx of freeIdx) {
            const t = PERIOD_SLOTS[idx].time;
            if (!ignoreFacBlock && isFacBlocked(facultyName, day, t)) continue;
            const single = { day, time: t, subject, isLab: !!isLabNamed, span: 1, isDouble: false, facultyName, isCore: !!isCore };
            finalData.push(single);
            movable.add(single);
            occupiedKeys.add(`${day}|${idx}`);
            subjectDayUsed[subject].add(day);
            return true;
          }
        }
      }
      return false;
    };

    // ── First-period rotation ──
    // Give period I of each free day to a DIFFERENT subject (TOC on Mon, PE on
    // Tue, ...), so every faculty gets a first period. Days where period I is
    // already taken (a pinned lab / fixed slot) are skipped, and placement and
    // two-slot subjects are never used here.
    {
      const firstT = PERIOD_SLOTS[0]?.time;
      const firstCount = {};
      if (firstT) {
        shuffle(DAYS).filter(d => !occupiedKeys.has(`${d}|0`)).forEach(day => {
          const cands = shuffledTokens.filter(t =>
            !t.isDouble && !t.isLabNamed && !/placement/i.test(t.subject || "") &&
            !(subjectDayUsed[t.subject] && subjectDayUsed[t.subject].has(day)) &&
            !isFacBlocked(t.facultyName, day, firstT));
          if (cands.length === 0) return;
          const minCount = Math.min(...cands.map(t => firstCount[t.subject] || 0));
          const pool = cands.filter(t => (firstCount[t.subject] || 0) === minCount);
          const tok = pool[Math.floor(Math.random() * pool.length)];
          shuffledTokens.splice(shuffledTokens.indexOf(tok), 1);
          const firstEntry = { day, time: firstT, subject: tok.subject, isLab: false, span: 1, isDouble: false, facultyName: tok.facultyName, isCore: !!tok.isCore };
          finalData.push(firstEntry);
          movable.add(firstEntry);
          occupiedKeys.add(`${day}|0`);
          if (!subjectDayUsed[tok.subject]) subjectDayUsed[tok.subject] = new Set();
          subjectDayUsed[tok.subject].add(day);
          firstCount[tok.subject] = (firstCount[tok.subject] || 0) + 1;
        });
      }
    }

    const unplacedAfterPass1 = [];
    for (const token of shuffledTokens) {
      if (!tryPlaceToken(token, false, false)) unplacedAfterPass1.push(token);
    }

    const unplacedAfterPass2 = [];
    for (const token of unplacedAfterPass1) {
      if (!tryPlaceToken(token, true, false)) unplacedAfterPass2.push(token);
    }

    // Never force a faculty clash just to fill a slot — whatever still can't
    // be placed is reported below instead of silently double-booking someone.
    const unplacedTheory = unplacedAfterPass2;

    // ── Fill any remaining pre-12:30 gaps ──
    // Round 1 keeps "one subject per day". Round 2 relaxes that rule, because a
    // repeated subject is better than an empty morning slot. Labs, two-slot
    // classes and pinned slots are never moved, and a move is skipped if the
    // faculty would clash with another section.
    {
      const isMorningIdx = (i) => isMorningSlot(PERIOD_SLOTS[i]?.time);
      const subjectOnDay = (subject, day, skip) => finalData.some(e => e !== skip && e.subject === subject && e.day === day);
      for (const relaxed of [false, true]) {
        let moved = true, guard = 0;
        while (moved && guard++ < 100) {
          moved = false;
          for (const day of DAYS) {
            for (let i = 0; i < PERIOD_SLOTS.length; i++) {
              if (!isMorningIdx(i) || occupiedKeys.has(`${day}|${i}`)) continue;
              const t = PERIOD_SLOTS[i].time;
              const cands = finalData.filter(e =>
                movable.has(e) && e.span === 1 && !isMorningIdx(getSlotIndex(e.time)) &&
                (relaxed || e.day === day || !subjectOnDay(e.subject, day, e)) &&
                !isFacBlocked(e.facultyName, day, t));
              if (cands.length === 0) continue;
              cands.sort((a, b) => (b.day === day ? 1 : 0) - (a.day === day ? 1 : 0));
              const e = cands[0];
              occupiedKeys.delete(`${e.day}|${getSlotIndex(e.time)}`);
              e.day = day; e.time = t;
              occupiedKeys.add(`${day}|${i}`);
              moved = true;
            }
          }
        }
      }
      // Diagnostic: why is a morning slot still empty?
      const gaps = [];
      DAYS.forEach(day => PERIOD_SLOTS.forEach((p, i) => {
        if (!isMorningIdx(i) || occupiedKeys.has(`${day}|${i}`)) return;
        const why = finalData
          .filter(e => movable.has(e) && e.span === 1 && !isMorningIdx(getSlotIndex(e.time)))
          .map(e => `${e.subject} (${e.facultyName}) ${isFacBlocked(e.facultyName, day, p.time) ? "FACULTY BUSY" : "ok"}`);
        gaps.push(`${day} ${p.time}: ${why.join(", ") || "no single-period classes left after 12:30"}`);
      }));
      if (gaps.length) console.log("Morning gaps left:\n" + gaps.join("\n"));
    }

    setData(finalData);
    const newAll = { ...allSectionGrids, [selSectionId]: finalData };
    setAllSectionGrids(newAll);
    const found = checkConflicts(finalData, selSectionId);
    setShowConflictModal(found.length > 0);
    // Classes that couldn't be placed without a clash → popup to place them by hand
    setUnplacedItems(unplacedTheory.map((t, i) => ({
      id: i, subject: t.subject, facultyName: t.facultyName,
      span: t.isDouble ? 2 : 1, isCore: !!t.isCore, isLabNamed: !!t.isLabNamed,
    })));
    setShowUnplacedModal(unplacedTheory.length > 0);
    setActiveTab("timetable");

    const coreSubjectsTotal = subjectConfig.filter(sc => selectedSubjects.has(sc.subject) && sc.isCore && (!selSection?.department_id || !sc.department_id || sc.department_id === selSection.department_id)).length;
    const coreEntriesPlaced = finalData.filter(e => !e.isLab && e.isCore);
    const coreInMorning = coreEntriesPlaced.filter(e => isMorningSlot(e.time)).length;
    setGenSummary({
      totalEntries: finalData.length,
      coreSubjectsTotal,
      coreEntriesPlaced: coreEntriesPlaced.length,
      coreInMorning,
      timeTakenMs: Math.round(performance.now() - genStartTime),
      unplaced: [
        ...unplacedLabs.map(n => `${n} (lab)`),
        ...Object.entries(unplacedTheory.reduce((a, t) => { a[t.subject] = (a[t.subject] || 0) + (t.isDouble ? 2 : 1); return a; }, {}))
          .map(([s, h]) => `${s} (${h}h)`),
      ],
    });

    const otherSectionsCount = Object.keys(allSectionGrids).filter(k => String(k) !== String(selSectionId)).length;
    if (unplacedTheory.length > 0 || unplacedLabs.length > 0) {
      toast$("Some items couldn't be placed without a clash — see the banner above, then Regenerate or pin them by hand", "warn");
    } else if (found.length > 0) {
      toast$(`Generated with ${found.length} conflict(s) — try regenerating`, "warn");
    } else {
      if (otherSectionsCount > 0) {
        toast$(`✓ Timetable generated — no conflicts! (${blockedFacSlots.size} cross-section blocks applied)`);
      } else {
        toast$("✓ Timetable generated — no conflicts!");
      }
    }
  }, [subjectConfig, labConfig, facultyList, selSectionId, allSectionGrids, checkConflicts, pinnedSlots, selectedPairs, pairCopies, DAYS, SLOTS, PERIOD_SLOTS, initialLoadDone]);

  const handleApplyConflictResolution = (selections, moves = {}) => {
    // swap one faculty inside an "A/B/C" list; drops duplicates if the new one is already there
    const swapFac = (s, oldN, newN) =>
      [...new Set((s || "").split("/").map(x => x.trim()).map(x => (x === oldN ? newN : x)))].join("/");
    const moveOf = (c) => moves[`${c.day}|${c.time}|${c.facultyName}`];

    let updated = data;

    // 1) Slot moves — matched by the original entry object, so two moves
    // can never pick up each other's entry.
    const movedRefs = new Map();
    conflictDetails.forEach(c => {
      const mv = moveOf(c);
      if (!mv) return;
      const ref = data.find(e => e.day === c.day && e.time === c.time);
      if (ref && !movedRefs.has(ref)) movedRefs.set(ref, mv);
    });
    if (movedRefs.size > 0) {
      updated = updated.map(e => movedRefs.has(e) ? { ...e, day: movedRefs.get(e).day, time: movedRefs.get(e).time } : e);
    }

    // 2) Faculty reassignments (at the class's new slot if it was moved)
    conflictDetails.forEach(c => {
      const sel = selections[`${c.day}|${c.time}|${c.facultyName}`];
      const newFac = sel && facultyList.find(f => String(f.id || f._id) === String(sel));
      if (!newFac || newFac.name === c.facultyName) return;
      const mv = moveOf(c);
      const atDay = mv ? mv.day : c.day;
      const atTime = mv ? mv.time : c.time;
      updated = updated.map(e => {
        if (e.day !== atDay || e.time !== atTime) return e;
        return e.isBatchSplit
          ? {
              ...e,
              batchA: { ...e.batchA, facultyName: swapFac(e.batchA?.facultyName, c.facultyName, newFac.name) },
              batchB: { ...e.batchB, facultyName: swapFac(e.batchB?.facultyName, c.facultyName, newFac.name) },
            }
          : { ...e, facultyName: swapFac(e.facultyName, c.facultyName, newFac.name) };
      });
    });
    setData(updated);
    const newAll = { ...allSectionGrids, [selSectionId]: updated };
    setAllSectionGrids(newAll);
    const found = checkConflicts(updated, selSectionId);
    if (found.length === 0) {
      setShowConflictModal(false);
      toast$("✓ All conflicts resolved!");
    } else {
      toast$(`${found.length} conflict(s) remain — keep adjusting`, "warn");
    }
  };

  const handleApplyUnplaced = (placements) => {
    if (!placements.length) return;
    const added = placements.map(p => ({
      day: p.day, time: p.time, subject: p.subject, isLab: !!p.isLabNamed,
      span: p.span, isDouble: p.span === 2, facultyName: p.facultyName, isCore: !!p.isCore,
    }));
    const updated = [...data, ...added];
    setData(updated);
    setAllSectionGrids({ ...allSectionGrids, [selSectionId]: updated });
    const doneIds = new Set(placements.map(p => p.id));
    const remaining = unplacedItems.filter(it => !doneIds.has(it.id));
    setUnplacedItems(remaining);
    setGenSummary(prev => prev && ({
      ...prev,
      totalEntries: updated.length,
      unplaced: [
        ...(prev.unplaced || []).filter(x => /\(lab\)$/.test(x)),
        ...Object.entries(remaining.reduce((a, t) => { a[t.subject] = (a[t.subject] || 0) + t.span; return a; }, {}))
          .map(([sub, h]) => `${sub} (${h}h)`),
      ],
    }));
    const found = checkConflicts(updated, selSectionId);
    setShowUnplacedModal(remaining.length > 0);
    if (found.length > 0) setShowConflictModal(true);
    toast$(found.length > 0
      ? `Placed ${placements.length} class${placements.length > 1 ? "es" : ""} — ${found.length} conflict(s) to fix`
      : `✓ Placed ${placements.length} class${placements.length > 1 ? "es" : ""}`, found.length > 0 ? "warn" : undefined);
  };

  // 🔥 CHANGE #2: Make async with await
  const saveTimetable = async () => {
    if (!data.length) { toast$("Generate first!", "error"); return; }
    try {
      // 🔥 VERIFY: Check if faculty names exist in timetable_data
      const hasValidFaculty = data.every(entry =>
        entry.facultyName && entry.facultyName !== "—" && entry.facultyName !== "-"
      );

      if (!hasValidFaculty) {
        console.warn("⚠️ WARNING: Some entries missing faculty names!");
        data.forEach((entry, idx) => {
          if (!entry.facultyName || entry.facultyName === "—") {
            console.log(`  Entry ${idx}: ${entry.day} ${entry.time} - ${entry.subject} → NO FACULTY`);
          }
        });
      }

      const saveData = {
        label: `C${selSection?.cluster ?? 1} · Sem${selSection?.semester || "?"} · ${selSection?.section_name || "?"} / ${selRoom?.room_name || "?"}`,
        section_id: selSection?.id || null,
        room_id: selRoom?.id || null,
        total_students: hdr.totalStudents,
        wef: hdr.wef,
        class_teacher: hdr.classTeacher,
        academic_year: hdr.academicYear,
        semester: selSection?.semester,
        cluster: selSection?.cluster ?? 1,
        department_id: selDepartment || null,
        type: "section",
        timetable_data: data,  // ← HAS facultyName
        subject_config: subjectConfig,
        lab_config: labConfig,
        pinned_slots: pinnedSlots,
      };

      // 🔥 LOG: Show what's being saved
      console.log("💾 Saving timetable:");
      console.log("   Section:", saveData.label);
      console.log("   Total entries:", data.length);
      console.log("   Faculty list:", [...new Set(data.map(e => e.facultyName).filter(f => f && f !== "—"))]);
      console.log("   Full data:", saveData);

      await savedTimetablesAPI.save(saveData);
      const saved = await savedTimetablesAPI.getAll();
      setSavedList(saved);

      // 🔥 CONFIRM: Show what was saved
      const justSaved = saved[saved.length - 1];
      if (justSaved?.timetable_data) {
        console.log("✅ Successfully saved! Faculty names in database:");
        const savedFaculty = [...new Set(
          justSaved.timetable_data.map(e => e.facultyName).filter(f => f && f !== "—")
        )];
        console.log("   ", savedFaculty.join(", "));
      }

      toast$("✓ Saved to database!");
    } catch (err) {
      console.error("❌ Save failed:", err);
      toast$("Failed to save: " + err.message, "error");
    }
  };

  const loadSaved = tt => {
    // Clear faculty view selection

    if (tt.timetable_data) setData(tt.timetable_data);
    if (tt.subject_config) setSubjectConfig(tt.subject_config);
    if (tt.lab_config) setLabConfig(tt.lab_config);
    if (tt.pinned_slots) setPinnedSlots(tt.pinned_slots);
    if (tt.total_students) setHdr(p => ({ ...p, totalStudents: tt.total_students }));
    if (tt.wef) setHdr(p => ({ ...p, wef: tt.wef }));
    if (tt.class_teacher) setHdr(p => ({ ...p, classTeacher: tt.class_teacher }));
    if (tt.academic_year) setHdr(p => ({ ...p, academicYear: tt.academic_year }));
    if (tt.section_id) setSelSectionId(String(tt.section_id));
    if (tt.section_id && String(tt.section_id) !== "default" && tt.timetable_data?.length) {
      setAllSectionGrids(prev => { const next = { ...prev, [String(tt.section_id)]: tt.timetable_data }; delete next["default"]; return next; });
    }
    if (tt.room_id) setSelRoomId(String(tt.room_id));
    setActiveTab("timetable");
    toast$("✓ Loaded section timetable!", "success");
  };

  // 🔥 CHANGE #3: Make async with await
  const deleteSaved = async (id, ev) => {
    ev.stopPropagation();
    try {
      await savedTimetablesAPI.delete(id);
      const tt = savedList.find(t => t.id === id);
      if (tt?.section_id) setAllSectionGrids(prev => { const n = { ...prev }; delete n[String(tt.section_id)]; return n; });
      const saved = await savedTimetablesAPI.getAll();
      setSavedList(saved);
      toast$("✓ Deleted from database");
    } catch (err) {
      toast$("Failed to delete: " + err.message, "error");
    }
  };

  const applyFilters = useCallback(() => {
    console.log("🔍 Frontend filter called with:", {
      filterAcademicYear,
      filterDepartment,
      filterSemester,
      showArchived,  // 🔥 ADD THIS LINE
      savedListCount: savedList.length
    });

    let filtered = [...savedList];

    // 🔥 STEP 1: Filter archived ONLY if NOT showing archived
    if (!showArchived) {
      filtered = filtered.filter(tt => !tt.is_archived);
      console.log("👁️ After removing archived:", filtered.length);
    } else {
      console.log("👁️ Showing ALL items (including archived):", filtered.length);  // 🔥 THIS SHOULD APPEAR
    }

    // 🔥 STEP 2: Apply specific filters if selected
    if (filterAcademicYear) {
      console.log("📅 Filtering by year:", filterAcademicYear);
      filtered = filtered.filter(tt => tt.academic_year === filterAcademicYear);
      console.log("   Result:", filtered.length);
    }

    if (filterSemester) {
      console.log("📚 Filtering by semester:", filterSemester);
      filtered = filtered.filter(tt => tt.semester === parseInt(filterSemester));
      console.log("   Result:", filtered.length);
    }

    if (filterDepartment) {
      console.log("🏢 Filtering by department:", filterDepartment);
      filtered = filtered.filter(tt => String(tt.department_id) === String(filterDepartment));
      console.log("   Result:", filtered.length);
    }

    // 🔥 STEP 3: Set the final filtered list
    console.log("📊 Final:", filtered.length, "items");
    setFilteredSavedList(filtered);

  }, [filterAcademicYear, filterDepartment, filterSemester, showArchived, savedList]);

  // 🔥 UPGRADE #4: Archive/Restore timetable
  const archiveSaved = async (id, isArchived = true) => {
    try {
      console.log("🗂️ Archiving:", id, "isArchived:", isArchived);

      // 1. Call backend
      await savedTimetablesAPI.archive(id, isArchived);

      // 2. 🔥 CRITICAL: Clear the filtered list IMMEDIATELY
      setFilteredSavedList([]);

      // 3. Get fresh list
      const freshList = await savedTimetablesAPI.getAll();
      console.log("📥 Fresh list:", freshList.length);

      // 4. Filter OUT archived items
      let filtered = freshList.filter(tt => !tt.is_archived);
      console.log("👁️ Non-archived count:", filtered.length);

      // 5. Apply current filters
      if (filterAcademicYear) {
        filtered = filtered.filter(tt => tt.academic_year === filterAcademicYear);
      }
      if (filterSemester) {
        filtered = filtered.filter(tt => tt.semester === parseInt(filterSemester));
      }
      if (filterDepartment) {
        filtered = filtered.filter(tt => String(tt.department_id) === String(filterDepartment));
      }

      // 6. 🔥 UPDATE: Set savedList first
      setSavedList(freshList);

      // 7. 🔥 Then set filtered list (this forces React to re-render with new keys)
      setFilteredSavedList(filtered);

      console.log("✅ Updated: total=" + freshList.length + ", visible=" + filtered.length);
      toast$(isArchived ? "✓ Archived" : "✓ Restored");

    } catch (err) {
      console.error("❌ Error:", err);
      toast$("Failed: " + err.message, "error");
    }
  };

  const saveEdit = (day, time) => {
    const v = cellInput.trim();
    if (!v) { setData(p => p.filter(d => !(d.day === day && d.time === time))); setEditCell(null); return; }

    // ✅ FIXED: a lab is now identified by matching against the actual
    // configured lab names (labConfig), not by checking whether the typed
    // text literally contains the word "lab" — real lab names like ADA,
    // DBMS, MC, PY don't contain that substring, which was causing every
    // edited lab cell to collapse from a 2-slot span down to 1.
    const isLab = labConfig.some(l => l.name.toLowerCase() === v.toLowerCase())
      || v.toLowerCase().includes("lab");

    const editedRoomName = isLab ? (labConfig.find(l => l.name.toLowerCase() === v.toLowerCase())?.roomName || null) : undefined;
    setData(p => [
      ...p.filter(d => !(d.day === day && d.time === time)),
      { day, time, subject: v, isLab, span: isLab ? 2 : 1, facultyName: "—", roomName: editedRoomName },
    ]);
    setEditCell(null);
  };

  const allSubjectLabOptions = () => [
    ...subjectConfig.map(s => ({ value: s.subject, label: s.subject, isLab: false })),
    ...labConfig.map(l => ({ value: l.name, label: l.name + " (LAB)", isLab: true })),
  ];

  const openPinModal = (day, time) => {
    setPinModal({ day, time });
    const existing = pinnedSlots[day + "|" + time];
    setPinSubjectSel(existing?.subject || "");
  };
  const savePinSlot = () => {
    if (!pinModal) return;
    const key = pinModal.day + "|" + pinModal.time;
    if (!pinSubjectSel) { setPinnedSlots(p => { const n = { ...p }; delete n[key]; return n; }); }
    else {
      const isLab = allSubjectLabOptions().find(o => o.value === pinSubjectSel)?.isLab || false;
      const pinEntry = { subject: pinSubjectSel, isLab };
      // ✅ Batch 2 partner is no longer picked here — it's read straight
      // from the lab's pairing set in the top-level Batch Pairing section
      // (TimetableConfig.jsx), so pinning a paired lab auto-includes its
      // partner without a separate selection in this modal.
      if (isLab) {
        // ✅ A lab may have multiple partners now — auto-attach defaults
        // to the first one. Use the PAIR chips in "Pin Subjects & Labs to
        // Slots" to pin a specific partner combo instead.
        const pairedNames = parsePairedNames(labConfig.find(l => l.name === pinSubjectSel)?.pairedLabName);
        if (pairedNames.length > 0) pinEntry.batchBSubject = pairedNames[0];
      }
      setPinnedSlots(p => ({ ...p, [key]: pinEntry }));
    }
    setPinModal(null);
  };
  const clearPin = (day, time) => { const key = day + "|" + time; setPinnedSlots(p => { const n = { ...p }; delete n[key]; return n; }); };

  const doExport = async (format) => {
    if (!data.length) { toast$("Generate a timetable first!", "error"); setExportModal(false); return; }
    setExporting(true);
    try {
      if (format === "word") {
        const html = tableRef.current ? tableRef.current.innerHTML : "";
        const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><style>@page WordSection1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:36pt}body{font-family:"Times New Roman",serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:6pt 8pt;font-size:9pt}th{background:#111;color:#fff;font-weight:bold}</style></head><body><div>${html}</div></body></html>`;
        const blob = new Blob(["﻿", wordHtml], { type: "application/msword" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "Timetable.doc"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); toast$("Word exported!");
      } else {
        const canvas = await html2canvas(tableRef.current, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: tableRef.current.scrollWidth,
          windowHeight: tableRef.current.scrollHeight,
          onclone: (clonedDoc) => {
            const el = clonedDoc.querySelector('[data-ref="timetable"]');
            if (el) { el.style.width = tableRef.current.scrollWidth + 'px'; }
          }
        });
        if (format === "png") { const a = document.createElement("a"); a.download = "Timetable.png"; a.href = canvas.toDataURL("image/png", 1.0); a.click(); toast$("PNG exported!"); }
        else { const pdf = new jsPDF("landscape", "mm", "a3"); const pageW = 420, margin = 12, usableW = pageW - margin * 2; const imgH = (canvas.height * usableW) / canvas.width; const usableH = 297 - margin * 2; let finalW = usableW, finalH = imgH; if (imgH > usableH) { finalH = usableH; finalW = (canvas.width * finalH) / canvas.height; } pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", margin + (usableW - finalW) / 2, margin, finalW, finalH); pdf.save("Timetable.pdf"); toast$("PDF exported!"); }
      }
    } catch (e) { console.error(e); toast$("Export failed", "error"); }
    setExporting(false); setExportModal(false);
  };

  const saveAssignment = async (subjectName, facultyId) => {
    try {
      await API.put("/teaching-assignments", {
        academic_year: hdr.academicYear,
        parity: selSection.semester % 2 === 1 ? "odd" : "even",
        section_id: Number(selSectionId),
        subject_name: subjectName,
        kind: "theory",
        faculty_id: facultyId ? Number(facultyId) : null,
      });
    } catch (e) {
      toast$(e.response?.data?.detail || "Could not save teaching assignment", "error");
    }
  };

  const updateConfig = (idx, field, value) => {
    if (field === "theoryFacultyId" && selSection && hdr.academicYear && subjectConfig[idx]) {
      saveAssignment(subjectConfig[idx].subject, value);
    }
    updateConfigState(idx, field, value);
  };

  const updateConfigState = (idx, field, value) => setSubjectConfig(prev => {
    const u = [...prev];
    u[idx] = { ...u[idx], [field]: value };
    if (field === "doublePerWeek" || field === "hoursPerWeek") {
      const hrs = parseInt(field === "hoursPerWeek" ? value : u[idx].hoursPerWeek) || 0;
      const dbl = parseInt(field === "doublePerWeek" ? value : u[idx].doublePerWeek) || 0;
      u[idx].doublePerWeek = Math.min(dbl, Math.floor(hrs / 2));
    }
    return u;
  });

  const displaySem = selSection ? `Cluster ${selSection.cluster ?? 1} · Sem ${selSection.semester} — ${selSection.section_name}` : "—";
  const displayRoom = selRoom ? selRoom.room_name : "—";

  return (
    <div style={{ fontFamily: "Sora,sans-serif", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", color: "#F0EDE8", display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, padding: "14px 24px", borderRadius: "10px", fontWeight: "600", fontSize: "13px", background: toast.type === "error" ? "#DC2626" : toast.type === "warn" ? "#D97706" : "#059669", color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "slideUp 0.3s ease", maxWidth: "420px" }}>
          {toast.msg}
        </div>
      )}


      {saveModal && (
        <div onClick={() => setSaveModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, animation: "fadeIn 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px 24px", width: "440px", animation: "popIn 0.2s ease", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontFamily: "Sora,sans-serif", fontSize: "18px", fontWeight: "700", color: "#34D399", marginBottom: "6px" }}>💾 Save Timetable</div>
            <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "Sora,sans-serif", marginBottom: "16px" }}>Save current timetable to your collection</div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "Sora,sans-serif" }}>🏢 Department</div>
              <select style={{ ...selectSt, width: "100%", minWidth: "100%" }} value={selDepartment} onChange={e => setSelDepartment(e.target.value)}>
                <option value="">— Select Department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "Sora,sans-serif" }}>📋 Summary</div>
              <div style={{ fontSize: "12px", color: "#F0EDE8", fontFamily: "'JetBrains Mono',monospace" }}>Section: <strong>{selSection ? `${selSection.semester}th ${selSection.section_name}` : "—"}</strong></div>
              <div style={{ fontSize: "12px", color: "#F0EDE8", fontFamily: "'JetBrains Mono',monospace", marginTop: "4px" }}>Cluster: <strong>C{selSection?.cluster ?? 1}</strong></div>
              <div style={{ fontSize: "12px", color: "#F0EDE8", fontFamily: "'JetBrains Mono',monospace", marginTop: "4px" }}>Room: <strong>{displayRoom}</strong></div>
              <div style={{ fontSize: "12px", color: "#F0EDE8", fontFamily: "'JetBrains Mono',monospace", marginTop: "4px" }}>Academic Year: <strong>{hdr.academicYear}</strong></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <button onClick={() => { saveTimetable(); setSaveModal(false); }} style={{ padding: "12px", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "13px", fontFamily: "Sora,sans-serif" }}>✓ Save</button>
              <button onClick={() => setSaveModal(false)} style={{ padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#94A3B8", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {exportModal && (
        <div onClick={() => !exporting && setExportModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, animation: "fadeIn 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "28px 24px", width: "440px", animation: "popIn 0.2s ease", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontFamily: "Sora,sans-serif", fontSize: "18px", fontWeight: "700", color: "#EAB308", marginBottom: "6px" }}>Export Timetable</div>
            <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "Sora,sans-serif", marginBottom: "16px" }}>Choose export format</div>

            {/* Department selector - full width */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "Sora,sans-serif" }}>🏢 Department</div>
              <select style={{ ...selectSt, width: "100%", minWidth: "100%" }} value={selDepartment} onChange={e => setSelDepartment(e.target.value)}>
                <option value="">— Select Department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
              </select>
            </div>

            {/* Format buttons - 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              {[{ fmt: "pdf", icon: "📄", label: "PDF", sub: "A3 landscape", color: "#F472B6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.2)" }, { fmt: "png", icon: "🖼", label: "PNG", sub: "High-res 4×", color: "#818CF8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)" }, { fmt: "word", icon: "📝", label: "Word", sub: "Editable .doc", color: "#34D399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" }].map(({ fmt, icon, label, sub, color, bg, border }) => (
                <button key={fmt} onClick={() => !exporting && doExport(fmt)} disabled={exporting} style={{ background: exporting ? "rgba(255,255,255,0.02)" : bg, border: `1px solid ${exporting ? "rgba(255,255,255,0.06)" : border}`, borderRadius: "12px", padding: "20px 10px", cursor: exporting ? "not-allowed" : "pointer", textAlign: "center", transition: "all 0.2s", opacity: exporting ? 0.4 : 1, fontFamily: "Sora,sans-serif" }}>
                  <div style={{ fontSize: "26px", marginBottom: "8px" }}>{exporting ? "⏳" : icon}</div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: exporting ? "#64748B" : color, marginBottom: "4px" }}>{label}</div>
                  <div style={{ fontSize: "9px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>{sub}</div>
                </button>
              ))}
            </div>

            <button onClick={() => !exporting && setExportModal(false)} disabled={exporting} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#94A3B8", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {pinModal && (
        <div onClick={() => setPinModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, animation: "fadeIn 0.2s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: "16px", padding: "28px 26px", width: "420px", animation: "popIn 0.2s ease", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontFamily: "Sora,sans-serif", fontSize: "17px", fontWeight: "700", color: "#EAB308", marginBottom: "4px" }}>Pin Slot</div>
            <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "Sora,sans-serif", marginBottom: "20px" }}>{pinModal.day} · {pinModal.time}</div>
            <select value={pinSubjectSel} onChange={e => setPinSubjectSel(e.target.value)} style={{ ...selectSt, width: "100%", fontSize: "14px", padding: "10px 12px", marginBottom: "18px" }} autoFocus>
              <option value="">— Remove pin —</option>
              {subjectConfig.length > 0 && <optgroup label="── Subjects ──">{subjectConfig.map(s => <option key={s.subject} value={s.subject}>{s.subject} ({s.code})</option>)}</optgroup>}
              {labConfig.length > 0 && <optgroup label="── Labs ──">{labConfig.map(l => <option key={l.id} value={l.name}>{l.name} (LAB)</option>)}</optgroup>}
            </select>
            {/* ✅ Batch 2 pairing is now read-only here — it reflects
                whatever was set in the top-level Batch Pairing section
                on the Config tab, not a separate choice made per-pin. */}
            {allSubjectLabOptions().find(o => o.value === pinSubjectSel)?.isLab && (() => {
              const pairedNames = parsePairedNames(labConfig.find(l => l.name === pinSubjectSel)?.pairedLabName);
              return pairedNames.length > 0 ? (
                <div style={{ marginBottom: "18px", padding: "9px 12px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "3px", fontFamily: "Sora,sans-serif" }}>Paired with (first one auto-attached here):</div>
                  <div style={{ fontSize: "13px", color: "#34D399", fontWeight: "700", fontFamily: "'JetBrains Mono',monospace" }}>{pairedNames.join(", ")}</div>
                </div>
              ) : (
                <div style={{ marginBottom: "18px", fontSize: "11px", color: "#64748B", fontFamily: "Sora,sans-serif" }}>No Batch 2 pairing set for this lab. Set one in the Batch Pairing section on the Config tab.</div>
              );
            })()}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={savePinSlot} style={{ flex: 1, padding: "10px", background: "#EAB308", color: "#0A0C12", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px", fontFamily: "Sora,sans-serif" }}>{pinSubjectSel ? "Pin" : "Remove"}</button>
              <button onClick={() => setPinModal(null)} style={{ padding: "10px 18px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontFamily: "Sora,sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showConflictModal && conflictDetails.length > 0 && (
        <ConflictResolutionModal
          conflictDetails={conflictDetails}
          data={data}
          facultyList={facultyList}
          isBusyElsewhere={isBusyElsewhere}
          DAYS={DAYS}
          PERIOD_SLOTS={PERIOD_SLOTS}
          SLOTS={SLOTS}
          onApply={handleApplyConflictResolution}
          onRegenerate={() => { setShowConflictModal(false); handleGenerate(); }}
          onClose={() => setShowConflictModal(false)}
        />
      )}

      {showUnplacedModal && !showConflictModal && unplacedItems.length > 0 && (
        <UnplacedClassesModal
          items={unplacedItems}
          data={data}
          facultyList={facultyList}
          isBusyElsewhere={isBusyElsewhere}
          DAYS={DAYS}
          PERIOD_SLOTS={PERIOD_SLOTS}
          SLOTS={SLOTS}
          onApply={handleApplyUnplaced}
          onRegenerate={() => { setShowUnplacedModal(false); handleGenerate(); }}
          onClose={() => setShowUnplacedModal(false)}
        />
      )}

      <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#EAB308", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "900", color: "#0A0C12" }}>⊞</div>
          <div>
            <div style={{ fontFamily: "Sora,sans-serif", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>TimeTable Studio</div>
            <div style={{ fontSize: "10px", color: "#64748B", letterSpacing: "1px", textTransform: "uppercase" }}>Multi-Cluster · AI Scheduler</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {[{ id: "config", label: "⚙ Config" }, { id: "timetable", label: "📅 Timetable" }, { id: "saved", label: "📂 Saved" }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="tt-btn" style={{ padding: "7px 16px", borderRadius: "8px", border: activeTab === tab.id ? "1px solid rgba(234,179,8,0.5)" : "1px solid transparent", background: activeTab === tab.id ? "rgba(234,179,8,0.1)" : "transparent", color: activeTab === tab.id ? "#EAB308" : "#64748B", cursor: "pointer", fontWeight: "600", fontSize: "12px", transition: "all 0.2s", fontFamily: "Sora,sans-serif" }}>{tab.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="tt-btn" onClick={() => data.length ? setSaveModal(true) : toast$("Generate first!", "error")} style={{ padding: "8px 14px", background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px", transition: "all 0.2s" }}>💾 Save</button>
          <button className="tt-btn" onClick={() => setExportModal(true)} style={{ padding: "8px 14px", background: "rgba(129,140,248,0.15)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.3)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px", transition: "all 0.2s" }}>⬇ Export</button>
        </div>
      </div>

      {activeTab === "timetable" && (
        <button
          className="tt-btn"
          onClick={handleGenerate}
          disabled={!initialLoadDone}
          title="Generate this section's timetable again"
          style={{
            position: "fixed", top: "290px", right: "28px", zIndex: 9000,
            padding: "12px 20px", background: initialLoadDone ? "#EAB308" : "rgba(234,179,8,0.35)",
            color: "#0A0C12", border: "none", borderRadius: "999px",
            cursor: initialLoadDone ? "pointer" : "not-allowed", fontWeight: "700", fontSize: "13px",
            fontFamily: "Sora,sans-serif", boxShadow: "0 8px 28px rgba(234,179,8,0.4)", transition: "all 0.2s",
          }}
        >{initialLoadDone ? "⚡ Regenerate" : "⏳ Loading…"}</button>
      )}

      <div style={{ padding: (activeTab === "timetable" || activeTab === "faculty-view") ? "20px 16px" : "24px 32px", flex: 1 }}>

        {conflicts.length > 0 && (
          <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "12px", padding: "12px 18px", marginBottom: "16px", animation: "fadeIn 0.3s ease", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ fontWeight: "700", color: "#F87171", fontSize: "13px" }}>⚠ {conflicts.length} Cross-Section Conflict{conflicts.length > 1 ? "s" : ""} detected</div>
            <button onClick={() => setShowConflictModal(true)} style={{ padding: "6px 14px", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", color: "#F87171", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "700", fontFamily: "Sora,sans-serif" }}>Review &amp; Fix →</button>
          </div>
        )}

        {genSummary && (
          <div style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: "12px", padding: "12px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontWeight: "700", color: "#EAB308", fontSize: "12px" }}>⚡ Last Generation</div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace" }}>Entries: <strong style={{ color: "#F0EDE8" }}>{genSummary.totalEntries}</strong></div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace" }}>Core subjects: <strong style={{ color: "#F0EDE8" }}>{genSummary.coreSubjectsTotal}</strong></div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace" }}>Core periods in morning: <strong style={{ color: genSummary.coreEntriesPlaced > 0 && genSummary.coreInMorning === genSummary.coreEntriesPlaced ? "#34D399" : "#EAB308" }}>{genSummary.coreInMorning} / {genSummary.coreEntriesPlaced}</strong></div>
            <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace" }}>Time taken: <strong style={{ color: "#F0EDE8" }}>{genSummary.timeTakenMs} ms</strong></div>
            {genSummary.unplaced?.length > 0 && (
              <div style={{ fontSize: "11px", color: "#F87171", fontFamily: "'JetBrains Mono',monospace" }}>⚠ Not placed (would clash / no free slot): <strong>{genSummary.unplaced.join(", ")}</strong></div>
            )}
            <button onClick={() => setGenSummary(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#64748B", cursor: "pointer", fontSize: "13px" }}>✕</button>
          </div>
        )}

        {activeTab === "config" && (
          <TimetableConfig
            sections={sections}
            selCluster={selCluster}
            setSelCluster={setSelCluster}
            selSemester={selSemester}
            setSelSemester={setSelSemester}
            filteredSections={filteredSections}
            selSectionId={selSectionId}
            setSelSectionId={setSelSectionId}
            selSection={selSection}
            savedList={savedList}
            conflicts={conflicts}
            rooms={rooms}
            selRoomId={selRoomId}
            setSelRoomId={setSelRoomId}
            hdr={hdr}
            setHdr={setHdr}
            facultyOptions={facultyOptions}
            labConfig={labConfig}
            selectedLabs={selectedLabs}
            setSelectedLabs={setSelectedLabs}
            updateLab={updateLab}
            facultyList={facultyList}
            subjectConfig={subjectConfig}
            allSubjectConfig={subjectConfig}
            selectedSubjects={selectedSubjects}
            setSelectedSubjects={setSelectedSubjects}
            updateConfig={updateConfig}
            semesterType={semesterType}
            setSemesterType={setSemesterType}
            pinnedSlots={pinnedSlots}
            setPinnedSlots={setPinnedSlots}
            dragItem={dragItem}
            setDragItem={setDragItem}
            dragOver={dragOver}
            setDragOver={setDragOver}
            DAYS={DAYS}
            SLOTS={SLOTS}
            openPinModal={openPinModal}
            clearPin={clearPin}
            selectedPairs={selectedPairs}
            setSelectedPairs={setSelectedPairs}
            selfPairs={selfPairs}
            setSelfPairs={setSelfPairs}
            pairCopies={pairCopies}
            setPairCopies={setPairCopies}
            refreshLabs={refreshLabs}
            refreshFaculty={refreshFaculty}
          />
        )}

        {activeTab === "config" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "18px 0 4px" }}>
            <button
              className="tt-btn"
              onClick={handleGenerate}
              disabled={!initialLoadDone}
              style={{
                padding: "8px 16px",
                background: initialLoadDone ? "#EAB308" : "rgba(234,179,8,0.35)",
                color: "#0A0C12",
                border: "none",
                borderRadius: "8px",
                cursor: initialLoadDone ? "pointer" : "not-allowed",
                fontWeight: "700",
                fontSize: "12px",
                fontFamily: "Sora,sans-serif",
                boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
                transition: "all 0.2s",
              }}
            >{initialLoadDone ? "⚡ Generate" : "⏳ Loading…"}</button>
          </div>
        )}

        {activeTab === "timetable" && (
          <TimetableGrid
            ref={tableRef}
            DAYS={DAYS}
            SLOTS={SLOTS}
            grid={grid}
            data={data}
            editCell={editCell}
            setEditCell={setEditCell}
            cellInput={cellInput}
            setCellInput={setCellInput}
            saveEdit={saveEdit}
            logoUrl={logoUrl}
            institutionName={institutionName}
            institutionAddress={institutionAddress}
            departmentName={departmentName}
            hdr={hdr}
            selSection={selSection}
            displayRoom={displayRoom}
            labConfig={labConfig}
            selectedLabs={selectedLabs}
            facultyList={facultyList}
            subjectConfig={visibleSubjectConfig.filter(sc => selectedSubjects.has(sc.subject))}
            semesterType={semesterType}
          />
        )}

        {activeTab === "saved" && (
          <SavedTimetablesList
            savedList={savedList}
            filteredSavedList={filteredSavedList}
            sections={sections}
            conflicts={conflicts}
            departments={departments}
            filterAcademicYear={filterAcademicYear}
            setFilterAcademicYear={setFilterAcademicYear}
            filterDepartment={filterDepartment}
            setFilterDepartment={setFilterDepartment}
            filterSemester={filterSemester}
            setFilterSemester={setFilterSemester}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            loadSaved={loadSaved}
            archiveSaved={archiveSaved}
            deleteSaved={deleteSaved}
          />
        )}
      </div>

      {/* ── Navigation Buttons — corner arrows, matches Faculty/Subjects/Labs/Rooms/Sections ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '16px 32px 24px',
        gap: '20px'
      }}>
        <button
          onClick={() => window.location.href = '/sections'}
          title="Previous: Sections"
          style={{
            width: '38px',
            height: '38px',
            backgroundColor: 'rgba(92,96,112,0.1)',
            color: '#94A3B8',
            border: '1px solid rgba(92,96,112,0.25)',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Sora, sans-serif',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ←
        </button>
        <button
          onClick={() => window.location.href = '/additional-timetable'}
          title="Next: Additional Timetable"
          style={{
            width: '38px',
            height: '38px',
            backgroundColor: '#EAB308',
            color: '#0A0C12',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: 'Sora, sans-serif',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}