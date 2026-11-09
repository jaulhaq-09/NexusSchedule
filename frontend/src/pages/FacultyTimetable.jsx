import React, { useState, useEffect } from "react";
import API, { facultyTimetableAPI, savedTimetablesAPI } from "../services/api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useLocation } from "react-router-dom";

// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

/* ─── COLORS ─── */
const C = {
  bg: "#080C14", surface: "#0F172A", card: "#151B2E",
  border: "rgba(255,255,255,0.1)", borderHover: "rgba(255,255,255,0.18)",
  amber: "#EAB308", amberDark: "#F59E0B",
  amberBg: "rgba(234,179,8,0.08)", amberBorder: "rgba(234,179,8,0.25)",
  green: "#34D399", greenBg: "rgba(16,185,129,0.12)",
  red: "#F87171", redBg: "rgba(239,68,68,0.12)",
  orange: "#F59E0B", orangeBg: "rgba(245,158,11,0.12)",
  blue: "#818CF8", blueBg: "rgba(129,140,248,0.12)",
  purple: "#A855F7",
  text: "#F0EDE8", textMuted: "#94A3B8", textDim: "#64748B",
  white: "#fff",
  headerBg: "linear-gradient(90deg, #080C14 0%, #0F172A 50%, #080C14 100%)",
  inputBg: "rgba(255,255,255,0.05)", inputBorder: "rgba(255,255,255,0.1)",
};

/* ─── TOAST ─── */
const Toast = ({ msg, type }) => (
  <div style={{
    position: "fixed", top: "24px", right: "24px", zIndex: 9999,
    padding: "14px 22px", borderRadius: "10px", fontWeight: "600", fontSize: "13px",
    background: type === "error" ? C.red : type === "warn" ? C.orange : C.green,
    color: C.white, boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
    animation: "toastIn 0.35s cubic-bezier(0.16,1,0.3,1)",
    fontFamily: "'Sora', sans-serif",
  }}>{msg}</div>
);

/* ─── STAT CARD ─── */
const StatCard = ({ icon, label, value, color = C.amber, bg = C.amberBg }) => (
  <div style={{
    background: C.card, borderRadius: "10px", padding: "20px 24px",
    border: `1px solid ${C.border}`, flex: 1, minWidth: 0,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: "12px", color: C.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
    </div>
    <h3 style={{ margin: 0, fontSize: "28px", fontWeight: "700", color, fontFamily: "'JetBrains Mono', monospace" }}>
      {typeof value === "number" ? value.toString().padStart(2, "0") : value}
    </h3>
  </div>
);

/* ─── BUTTON ─── */
const Btn = ({ children, onClick, color = C.amber, bg, disabled, loading, full, size = "md" }) => {
  const bgColor = bg || (color === C.green ? C.greenBg : color === C.red ? C.redBg : color === C.orange ? C.orangeBg : color === C.blue ? C.blueBg : C.amberBg);
  const sizes = { sm: { p: "8px 16px", fs: "12px" }, md: { p: "12px 22px", fs: "13px" }, lg: { p: "15px 28px", fs: "15px" } };
  const s = sizes[size];
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{
        padding: s.p, fontSize: s.fs, fontWeight: "600",
        background: disabled ? "#333" : bgColor,
        color: disabled ? "#666" : color,
        border: `1px solid ${disabled ? "#444" : color}40`,
        borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s", width: full ? "100%" : "auto",
        fontFamily: "'Sora', sans-serif",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`; }}}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >{loading ? "⏳ ..." : children}</button>
  );
};

/* ─── SAVED SNAPSHOT CARD ─── */
const SnapshotCard = ({ tt, onArchive, onRestore, onDelete, onView }) => (
  <div style={{
    background: C.card, borderRadius: "10px", padding: "22px",
    border: `1px solid ${tt.is_archived ? C.orange + "40" : C.border}`,
    transition: "all 0.2s", position: "relative", overflow: "hidden",
  }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.amberBorder; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = tt.is_archived ? C.orange + "40" : C.border; e.currentTarget.style.transform = "translateY(0)"; }}
  >
    {tt.is_archived && (
      <div style={{ position: "absolute", top: 0, right: 0, background: C.orange, color: C.white, padding: "4px 10px", fontSize: "10px", fontWeight: "700", borderRadius: "0 10px 0 6px", textTransform: "uppercase" }}>Archived</div>
    )}
    <h3 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "700", color: C.amber }}>{tt.faculty_name}</h3>
    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", color: C.textMuted, background: C.bg, padding: "4px 10px", borderRadius: "4px" }}>📅 {tt.academic_year}</span>
      <span style={{ fontSize: "11px", color: C.textMuted, background: C.bg, padding: "4px 10px", borderRadius: "4px" }}>🎓 Sem {tt.semester}</span>
      {tt.created_at && (
        <span style={{ fontSize: "11px", color: C.textDim, background: C.bg, padding: "4px 10px", borderRadius: "4px" }}>
          🕒 {new Date(tt.created_at).toLocaleDateString()}
        </span>
      )}
    </div>
    {tt.comments && (
      <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: C.text, background: C.amberBg, padding: "10px 12px", borderRadius: "6px", borderLeft: `3px solid ${C.amber}` }}>
        📌 {tt.comments}
      </p>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
      {tt.is_archived
        ? <Btn onClick={() => onRestore(tt.id)} color={C.green} size="sm">♻️ Restore</Btn>
        : <Btn onClick={() => onArchive(tt.id)} color={C.orange} size="sm">📦 Archive</Btn>
      }
      <Btn onClick={() => onView(tt.faculty_name)} color={C.blue} size="sm">👁️ View</Btn>
      <Btn onClick={() => onDelete(tt.id)} color={C.red} size="sm">🗑️ Delete</Btn>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function FacultyTimetable({ restrictToSelf = false }) {
  useScrollToTop();  // ✅ ADD THIS LINE

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  })();

  const [faculties, setFaculties] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionTimetables, setSectionTimetables] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("view");
  const [viewingFaculty, setViewingFaculty] = useState(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false); // ✅ NEW: faculty picker popup
  const [facultySearch, setFacultySearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // ✅ snapshot id pending delete confirmation
  const [showArchived, setShowArchived] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [slotTemplate, setSlotTemplate] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [labsList, setLabsList] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filterAcademicYear, setFilterAcademicYear] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [institutionConfig, setInstitutionConfig] = useState(null);

  const institutionName    = institutionConfig?.institution_name
                          || institutionConfig?.name
                          || institutionConfig?.college_name
                          || "Institution Name";

  const institutionAddress = institutionConfig?.address
                          || institutionConfig?.institution_address
                          || "";

  const departmentName     = institutionConfig?.department_name
                          || institutionConfig?.department
                          || "";

  const academicYear       = institutionConfig?.academic_year
                          || institutionConfig?.current_academic_year
                          || "2025-26";

  const institutionLogo    = institutionConfig?.logo_url
                          || institutionConfig?.logo
                          || institutionConfig?.logo_path
                          || institutionConfig?.institution_logo
                          || null;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { loadAllData(); }, []);
  useEffect(() => { if (restrictToSelf) setActiveTab("view"); }, [restrictToSelf]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

 const loadAllData = async () => {
  try {
    setLoading(true);
    const [facRes, secRes, facTTRes, secTTRes, configRes, subRes, labRes] = await Promise.all([
      API.get("/faculty").then(r => r.data),
      API.get("/sections").then(r => r.data),
      facultyTimetableAPI.getAll(),
      savedTimetablesAPI.getAll(),
      API.get("/institution-config").then(r => r.data),
      API.get("/subjects").then(r => r.data),
      API.get("/labs").then(r => r.data),
    ]);
    let slots = [];
    if (configRes?.slot_template) {
      slots = Array.isArray(configRes.slot_template)
        ? configRes.slot_template
        : Object.values(configRes.slot_template);
    }

    console.log("🏫 Institution Config:", configRes);

    setFaculties(facRes || []);
    setSections(secRes || []);
    setSavedList(facTTRes || []);
    setSectionTimetables(secTTRes || []);
    setSlotTemplate(slots);
    setSubjectsList(subRes || []);
    setLabsList(labRes || []);
    setInstitutionConfig(configRes || {});

    if (configRes?.logo_url && !configRes.logo_url.startsWith('http')) {
      configRes.logo_url = `http://localhost:8000${configRes.logo_url}`;
    }

    // ✅ CHANGED: restrictToSelf still auto-locks to the logged-in user's own
    // faculty record. Otherwise, no auto-selection — the user picks via modal.
    if (restrictToSelf) {
      const own = (facRes || []).find(f => f.id === currentUser.faculty_id);
      if (own) setViewingFaculty(own.name);
    }

  } catch (err) {
    console.error("❌ Load error:", err);
    showToast("Failed to load data", "error");
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  let f = Array.isArray(savedList) ? [...savedList] : [];
  if (!showArchived) f = f.filter(t => !t.is_archived);
  if (filterAcademicYear) f = f.filter(t => t.academic_year === filterAcademicYear);
  if (filterSemester) f = f.filter(t => t.semester === parseInt(filterSemester));
  if (filterFaculty) f = f.filter(t => t.faculty_name?.toLowerCase().includes(filterFaculty.toLowerCase()));
  setFilteredList(f);
}, [savedList, showArchived, filterAcademicYear, filterSemester, filterFaculty]);
  
  const handleSaveSnapshot = async () => {
    if (!viewingFaculty || !saveLabel.trim()) { showToast("Enter a label", "error"); return; }
    setSaving(true);
    try {
      const scheduleData = buildSchedule(viewingFaculty, sectionTimetables, sections, slotTemplate);
      const result = await facultyTimetableAPI.save({
        faculty_id: faculties.find(f => f.name === viewingFaculty)?.id || 0,
        faculty_name: viewingFaculty,
        academic_year: academicYear,
        semester: 1,
        timetable_data: JSON.stringify(scheduleData.entries),
        comments: saveLabel,
      });
      if (result) {
        showToast("✅ Schedule snapshot saved!");
        setSaveLabel("");
        setShowSaveModal(false);
        loadAllData();
      }
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  };

  const handleArchive = async (id) => {
    try { await facultyTimetableAPI.archive(id, true); showToast("📦 Archived"); loadAllData(); }
    catch { showToast("Failed", "error"); }
  };
  const handleRestore = async (id) => {
    try { await facultyTimetableAPI.archive(id, false); showToast("♻️ Restored"); loadAllData(); }
    catch { showToast("Failed", "error"); }
  };
  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try { await facultyTimetableAPI.delete(id); showToast("🗑️ Deleted"); loadAllData(); }
    catch { showToast("Failed", "error"); }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const el = document.getElementById("faculty-schedule-print");
      if (!el) { showToast("Not ready", "error"); return; }
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const pdf = new jsPDF("landscape", "mm", "a4");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210);
      pdf.save(`${viewingFaculty}_${academicYear}.pdf`);
      showToast("✅ PDF Exported!");
    } catch { showToast("Export failed", "error"); }
    finally { setExporting(false); }
  };

  if (loading) {
    return (
      <div style={{ background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "32px", height: "32px", border: `3px solid ${C.border}`, borderTopColor: C.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: C.textMuted, fontSize: "14px", fontFamily: "'Sora', sans-serif" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", color: C.text, minHeight: "100vh" }}>
      <style>{`
        @keyframes toastIn { from { opacity:0; transform:translateX(80px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ─── SAVE MODAL ─── */}
      {showSaveModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowSaveModal(false)}
        >
          <div style={{ background: C.surface, borderRadius: "12px", padding: "32px", width: "440px", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: C.amber }}>💾 Save Schedule Snapshot</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: C.textMuted }}>
              Save <strong style={{ color: C.amber }}>{viewingFaculty}</strong>'s current schedule for future reference.
            </p>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: C.amber, textTransform: "uppercase", letterSpacing: "0.8px" }}>Label *</label>
            <input type="text" placeholder="e.g., Fall 2025 Schedule" value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)}
              autoFocus
              style={{ width: "100%", padding: "14px 16px", borderRadius: "8px", border: `1px solid ${C.inputBorder}`, fontSize: "14px", fontWeight: "500", background: C.inputBg, color: C.text, outline: "none", boxSizing: "border-box", fontFamily: "'Sora', sans-serif", marginBottom: "20px" }}
              onFocus={(e) => { e.target.style.borderColor = C.amber; }}
              onBlur={(e) => { e.target.style.borderColor = C.inputBorder; }}
              onKeyDown={(e) => { if (e.key === "Enter" && saveLabel.trim()) handleSaveSnapshot(); }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Btn onClick={() => setShowSaveModal(false)} color={C.textMuted} size="md" full>Cancel</Btn>
              <Btn onClick={handleSaveSnapshot} color={C.green} bg={C.green} disabled={saving || !saveLabel.trim()} loading={saving} size="md" full>
                <span style={{ color: C.white }}>💾 Save</span>
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DELETE MODAL ─── */}
      {confirmDeleteId !== null && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div style={{ background: C.surface, borderRadius: "12px", padding: "28px", width: "380px", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "700", color: C.red }}>🗑️ Delete Snapshot</h3>
            <p style={{ margin: "0 0 22px 0", fontSize: "13px", color: C.textMuted }}>This can't be undone. Delete this saved snapshot?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Btn onClick={() => setConfirmDeleteId(null)} color={C.textMuted} size="md" full>Cancel</Btn>
              <Btn onClick={confirmDelete} color={C.red} bg={C.red} size="md" full>
                <span style={{ color: C.white }}>🗑️ Delete</span>
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── SELECT FACULTY MODAL (NEW) ─── */}
      {showFacultyModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => setShowFacultyModal(false)}
        >
          <div style={{ background: C.surface, borderRadius: "12px", padding: "28px", width: "420px", maxWidth: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "700", color: C.amber }}>👤 Select Faculty</h3>
            <input
              type="text"
              placeholder="🔍 Search faculty..."
              value={facultySearch}
              onChange={(e) => setFacultySearch(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "8px",
                border: `1px solid ${C.inputBorder}`, background: C.inputBg,
                color: C.text, fontSize: "13px", outline: "none",
                fontFamily: "'Sora', sans-serif", boxSizing: "border-box",
                marginBottom: "14px",
              }}
              onFocus={(e) => { e.target.style.borderColor = C.amber; }}
              onBlur={(e) => { e.target.style.borderColor = C.inputBorder; }}
            />
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {faculties
                .filter(f => !facultySearch || f.name.toLowerCase().includes(facultySearch.toLowerCase()))
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setViewingFaculty(f.name); setShowFacultyModal(false); setFacultySearch(""); }}
                    style={{
                      padding: "12px 14px", borderRadius: "8px", border: "none",
                      cursor: "pointer", fontSize: "13px", fontWeight: "600", textAlign: "left",
                      background: viewingFaculty === f.name ? C.amberBg : C.card,
                      color: viewingFaculty === f.name ? C.amber : C.text,
                      transition: "all 0.2s", fontFamily: "'Sora', sans-serif",
                    }}
                    onMouseEnter={(e) => { if (viewingFaculty !== f.name) e.currentTarget.style.background = C.borderHover; }}
                    onMouseLeave={(e) => { if (viewingFaculty !== f.name) e.currentTarget.style.background = C.card; }}
                  >
                    {f.name}
                  </button>
                ))}
              {faculties.filter(f => !facultySearch || f.name.toLowerCase().includes(facultySearch.toLowerCase())).length === 0 && (
                <p style={{ textAlign: "center", color: C.textDim, fontSize: "13px", padding: "20px 0" }}>No matches found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div style={{ background: C.headerBg, borderBottom: `1px solid ${C.amberBorder}`, padding: "24px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: `linear-gradient(135deg, ${C.amber}, ${C.amberDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>👨‍🏫</div>
          <div>
            <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700", color: C.amber, fontFamily: "'Sora', sans-serif" }}>Faculty Timetable</h1>
            <p style={{ margin: 0, fontSize: "11px", color: C.textDim, letterSpacing: "1.5px", textTransform: "uppercase" }}>View & manage faculty schedules</p>
          </div>
        </div>
        {!restrictToSelf && (
          <div style={{ display: "flex", gap: "6px", paddingBottom: "20px" }}>
            {[{ id: "view", label: "View Schedule" }, { id: "saved", label: "Saved Snapshots" }].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); }}
                style={{
                  padding: "9px 18px", borderRadius: "8px",
                  border: activeTab === tab.id ? `1px solid ${C.amberBorder}` : `1px solid ${C.border}`,
                  fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "'Sora', sans-serif",
                  background: activeTab === tab.id ? C.amberBg : "rgba(255,255,255,0.03)",
                  color: activeTab === tab.id ? C.amber : C.textDim,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text; } }}
                onMouseLeave={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; } }}
              >{tab.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div style={{ padding: "28px" }}>

       {/* ═══ VIEW SCHEDULE TAB ═══ */}
        {activeTab === "view" && (
          <div>
            {/* ✅ Action bar — only shown once a faculty is selected. Left: current
                faculty + change trigger. Right: Save/Export. Before selection, no
                bar renders — the empty state's own button is the only entry point. */}
            {viewingFaculty && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: C.surface, borderRadius: "12px", padding: "16px 24px",
                border: `1px solid ${C.border}`, marginBottom: "20px", flexWrap: "wrap", gap: "12px",
              }}>
                {!restrictToSelf ? (
                  <Btn onClick={() => setShowFacultyModal(true)} color={C.amber} size="md">
                    👤 {viewingFaculty} <span style={{ opacity: 0.6, fontWeight: 400 }}>· Change</span>
                  </Btn>
                ) : (
                  <div style={{ fontSize: "15px", fontWeight: "700", color: C.amber }}>👤 {viewingFaculty}</div>
                )}
                <div style={{ display: "flex", gap: "10px" }}>
                  <Btn onClick={() => setShowSaveModal(true)} color={C.amber} size="md">💾 Save Snapshot</Btn>
                  <Btn onClick={handleExportPDF} color={C.green} disabled={exporting} loading={exporting} size="md">📥 Export PDF</Btn>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div style={{
              background: C.surface, borderRadius: "12px", padding: isMobile ? "16px" : "28px",
              border: `1px solid ${C.border}`, overflowX: "auto", width: "100%",
            }}>
              {viewingFaculty ? (
                <ScheduleDisplay
                  facultyName={viewingFaculty}
                  sectionTimetables={sectionTimetables}
                  sections={sections}
                  institutionName={institutionName}
                  institutionAddress={institutionAddress}
                  departmentName={departmentName}
                  academicYear={academicYear}
                  institutionLogo={institutionLogo}
                  slotTemplate={slotTemplate}
                  subjectsList={subjectsList}
                  labsList={labsList}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "56px 20px 64px", color: C.textDim }}>
                  <div style={{
                    width: "64px", height: "64px", borderRadius: "50%",
                    background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "26px", color: C.amber, margin: "0 auto 20px",
                    fontFamily: "'Sora', sans-serif",
                  }}>◇</div>
                  <p style={{ margin: "0 0 20px", fontSize: "14px" }}>Select a faculty member to view their schedule</p>
                  <Btn onClick={() => setShowFacultyModal(true)} color={C.amber} size="md">Select Faculty</Btn>

                  {/* ✅ Quick-access grid — fixed-width cards with initials, uniform layout instead of wrapping pills */}
                  {faculties.length > 0 && (
                    <div style={{ marginTop: "44px", maxWidth: "680px", margin: "44px auto 0" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: C.textDim, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "16px" }}>
                        Or pick quickly
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                        {faculties.slice(0, 9).map(f => {
                          const initials = f.name.replace(/^Dr\.|^Mr\.|^Ms\.|^Mrs\./i, "").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                          return (
                            <button
                              key={f.id}
                              onClick={() => setViewingFaculty(f.name)}
                              style={{
                                display: "flex", alignItems: "center", gap: "10px",
                                padding: "10px 14px", borderRadius: "10px",
                                background: C.card, border: `1px solid ${C.border}`,
                                color: C.text, fontSize: "12.5px", fontWeight: "600",
                                cursor: "pointer", fontFamily: "'Sora', sans-serif",
                                transition: "all 0.15s", textAlign: "left",
                                overflow: "hidden",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.amberBorder; e.currentTarget.style.background = C.amberBg; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
                            >
                              <div style={{
                                width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                                background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "10px", fontWeight: "700", color: C.amber,
                              }}>{initials}</div>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {faculties.length > 9 && (
                        <button
                          onClick={() => setShowFacultyModal(true)}
                          style={{
                            marginTop: "10px", width: "100%",
                            padding: "10px", borderRadius: "10px",
                            background: "transparent", border: `1px dashed ${C.border}`,
                            color: C.textDim, fontSize: "12px", fontWeight: "600",
                            cursor: "pointer", fontFamily: "'Sora', sans-serif",
                          }}
                        >
                          View all {faculties.length} faculty →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

     {/* ═══ SAVED SNAPSHOTS TAB ═══ */}
    {activeTab === "saved" && (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <StatCard icon="📚" label="Total Saved" value={savedList.length} color={C.amber} bg={C.amberBg} />
          <StatCard icon="✅" label="Active" value={savedList.filter(t => !t.is_archived).length} color={C.green} bg={C.greenBg} />
          <StatCard icon="📦" label="Archived" value={savedList.filter(t => t.is_archived).length} color={C.orange} bg={C.orangeBg} />
          <StatCard icon="📅" label="Years" value={new Set(savedList.map(t => t.academic_year)).size} color={C.purple} bg="rgba(168,85,247,0.1)" />
        </div>

        {/* Filter & Search */}
        <div style={{ background: C.surface, borderRadius: "12px", padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "12px", fontWeight: "700", color: C.amber, textTransform: "uppercase", letterSpacing: "0.8px" }}>🔍 Filter & Search</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: "700", color: C.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Academic Year</label>
              <select 
                value={filterAcademicYear} 
                onChange={(e) => setFilterAcademicYear(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "12px 14px", 
                  borderRadius: "8px", 
                  fontSize: "12px", 
                  background: C.inputBg, 
                  color: C.text, 
                  border: `1px solid ${C.inputBorder}`,
                  fontFamily: "'Sora', sans-serif",
                  cursor: "pointer",
                  outline: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = C.amber; }}
                onBlur={(e) => { e.target.style.borderColor = C.inputBorder; }}
              >
                <option value="">— All Years —</option>
                {[...new Set(savedList.map(t => t.academic_year))].sort().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: "700", color: C.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Faculty Name</label>
              <input 
                type="text" 
                placeholder="Search faculty..." 
                value={filterFaculty} 
                onChange={(e) => setFilterFaculty(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "12px 14px", 
                  borderRadius: "8px", 
                  border: `1px solid ${C.inputBorder}`, 
                  background: C.inputBg, 
                  color: C.text, 
                  fontSize: "12px", 
                  outline: "none", 
                  fontFamily: "'Sora', sans-serif", 
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = C.amber; }}
                onBlur={(e) => { e.target.style.borderColor = C.inputBorder; }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "10px", fontWeight: "700", color: C.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Semester</label>
              <select 
                value={filterSemester} 
                onChange={(e) => setFilterSemester(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "12px 14px", 
                  borderRadius: "8px", 
                  fontSize: "12px", 
                  background: C.inputBg, 
                  color: C.text, 
                  border: `1px solid ${C.inputBorder}`,
                  fontFamily: "'Sora', sans-serif",
                  cursor: "pointer",
                  outline: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = C.amber; }}
                onBlur={(e) => { e.target.style.borderColor = C.inputBorder; }}
              >
                <option value="">— All Semesters —</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Btn 
                onClick={() => setShowArchived(!showArchived)} 
                color={showArchived ? C.orange : C.blue} 
                size="md"
              >
                {showArchived ? "📦 Show All" : "✅ Active Only"}
              </Btn>
            </div>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div style={{ background: C.surface, borderRadius: "12px", padding: "60px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700" }}>No Saved Snapshots</h3>
            <p style={{ margin: "0 0 20px 0", color: C.textDim, fontSize: "13px" }}>Go to View Schedule → select a faculty → click "Save Snapshot"</p>
            <Btn onClick={() => setActiveTab("view")} color={C.amber} size="md">👁️ Go to View Schedule</Btn>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {filteredList.map(tt => (
              <SnapshotCard key={`${tt.id}-${tt.is_archived}`} tt={tt}
                onArchive={handleArchive} onRestore={handleRestore} onDelete={handleDelete}
                onView={(name) => { setViewingFaculty(name); setActiveTab("view"); }}
              />
            ))}
          </div>
        )}
      </div>
    )}
      </div>

      {/* Navigation Buttons — corner arrows, matches Faculty/Sections/Timetable */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 28px 24px'
      }}>
        <button
          onClick={() => window.location.href = '/additional-timetable'}
          title="Previous: Additional Timetable"
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
          onClick={() => window.location.href = '/admin'}
          title="Next: Admin"
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

function buildSchedule(facultyName, sectionTimetables, sections, slotTemplate) {
  const facultyEntries = [];
  const sectionSet = new Set();
  const daysSet = new Set();

  let slots = slotTemplate;
  if (slots && typeof slots === "object" && !Array.isArray(slots)) {
    slots = Object.values(slots);
  }

  const times = (slots || [])
    .filter(slot => slot.slot_type === "PERIOD")
    .map(slot => `${slot.start_time} - ${slot.end_time}`);

  if (Array.isArray(sectionTimetables)) {
    sectionTimetables.forEach((tt) => {
      let data = tt.timetable_data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (Array.isArray(data)) {
        data.forEach(entry => {
          const entryFaculty = entry.facultyName || "—";
          if (!entryFaculty.includes(facultyName)) return;

          const sec = sections?.find(s => String(s.id) === String(tt.section_id));
          const secName = sec?.section_name || "—";
          const cluster = sec?.cluster || "—";
          const cleanDay = (entry.day || "").toUpperCase().trim();
          const cleanTime = (entry.time || "").trim();

          facultyEntries.push({
            day: cleanDay,
            time: cleanTime,
            subject: entry.subject,
            code: entry.code || entry.subjectCode || "",
            section: secName,
            cluster,
            room: entry.room || "—",
            isLab: entry.isLab,
            displayFaculty: entry.isLab ? entryFaculty : "",
          });

          if (cleanDay) daysSet.add(cleanDay);
          sectionSet.add(secName);
        });
      }
    });
  }

  // Deduplicate lab slots
  const seenLabs = new Set();
  const deduplicatedEntries = facultyEntries.filter(entry => {
    if (!entry.isLab) return true;
    const labKey = `${entry.day}-${entry.subject}-${entry.section}`;
    if (seenLabs.has(labKey)) return false;
    seenLabs.add(labKey);
    return true;
  });

  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  const days = dayOrder.filter(d => daysSet.has(d));
  const labCount = deduplicatedEntries.filter(e => e.isLab).length;
  const theoryCount = deduplicatedEntries.filter(e => !e.isLab).length;

  return {
    entries: deduplicatedEntries,
    days,
    times,
    totalClasses: deduplicatedEntries.length,
    labCount,
    theoryCount,
    sectionCount: sectionSet.size,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   SCHEDULE DISPLAY
   ═══════════════════════════════════════════════════════════════════ */
function ScheduleDisplay({ facultyName, sectionTimetables, sections, institutionName, institutionAddress, departmentName, academicYear, slotTemplate, institutionLogo, subjectsList = [], labsList = [] }) {
  const scheduleData = buildSchedule(facultyName, sectionTimetables, sections, slotTemplate);
  const { entries = [], days = [], times = [], totalClasses = 0, labCount = 0, theoryCount = 0 } = scheduleData;

  const grid = {};
  days.forEach(day => {
    grid[day] = {};
    times.forEach(time => { grid[day][time] = []; });
  });
  entries.forEach(entry => {
    if (grid[entry.day]?.[entry.time]) {
      grid[entry.day][entry.time].push(entry);
    }
  });

  const dayTdStyle = {
    padding: "14px",
    border: "1px solid #000",
    textAlign: "center",
    fontSize: "10px",
    fontWeight: "700",
    background: "#e8e8e8",
    whiteSpace: "nowrap",
  };

  return (
    <div id="faculty-schedule-print" style={{ background: "#fff", color: "#000", padding: "40px", fontFamily: "Arial, sans-serif", fontSize: "11px" }}>

      <div style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "3px solid #000", display: "flex", gap: "20px", alignItems: "flex-start" }}>

        <div style={{ flexShrink: 0 }}>
          {institutionLogo ? (
            <img
              src={institutionLogo}
              alt="Institution Logo"
              crossOrigin="anonymous"
              style={{ height: "72px", width: "72px", objectFit: "contain", borderRadius: "50%", border: "2px solid #000" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div style={{ fontSize: "40px", lineHeight: 1 }}>🏫</div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "900", letterSpacing: "1px", textTransform: "uppercase" }}>
            {institutionName}
          </h1>

        {institutionAddress && (
          <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "700", letterSpacing: "0.5px" }}>
            {institutionAddress}
          </p>
        )}

        {departmentName && (
          <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "700", letterSpacing: "0.5px" }}>
            {departmentName}
          </p>
        )}

        <p style={{ margin: "0 0 2px 0", fontSize: "12px", fontWeight: "700" }}>
          FACULTY TIMETABLE FOR {academicYear}
        </p>
        <p style={{ margin: 0, fontSize: "12px", color: "black", fontWeight: "700" }}>
          Academic Year: {academicYear}
        </p>
      </div>
    </div>

      <div style={{ border: "2px solid #000", padding: "12px 16px", marginBottom: "16px", background: "white" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div><span style={{ fontSize: "12px", fontWeight: "700" }}>FACULTY NAME: </span><span style={{ fontSize: "11px", fontWeight: "700" }}>{facultyName}</span></div>
          <div style={{ textAlign: "right" }}><span style={{ fontSize: "10px", fontWeight: "700" }}>ACADEMIC YEAR: </span><span style={{ fontSize: "11px", fontWeight: "700" }}>{academicYear}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: "16px", fontSize: "10px", fontWeight: "700", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        <div><span>TOTAL CLASSES:</span><div style={{ fontSize: "14px", fontWeight: "900" }}>{totalClasses}</div></div>
        <div><span>THEORY:</span><div style={{ fontSize: "14px", fontWeight: "900", color: "black" }}>{theoryCount}</div></div>
        <div><span>LABS:</span><div style={{ fontSize: "14px", fontWeight: "900", color: "black" }}>{labCount}</div></div>
        <div><span>PRINTED:</span><div style={{ fontSize: "14px", fontWeight: "650" }}>{new Date().toLocaleDateString()}</div></div>
      </div>

      {totalClasses === 0 || days.length === 0 ? (
        <div style={{ border: "2px solid #000", padding: "40px", textAlign: "center", color: "#030303" }}>
          <p style={{ fontSize: "14px" }}>No classes assigned</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #000", marginBottom: "24px", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#1a1a1a", color: "#fff" }}>
              <th style={{ padding: "14px", border: "1px solid #333", textAlign: "center", fontSize: "11px", fontWeight: "700", width: "90px" }}>DAY</th>
              {times.map((t, idx) => (
                <th key={idx} style={{ padding: "14px 10px", border: "1px solid #333", textAlign: "center", fontSize: "10px", fontWeight: "700" }}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              let skipNext = false;
              return (
                <tr key={day}>
                  <td style={dayTdStyle}>{day}</td>
                  {times.map((t, tIdx) => {
                    if (skipNext) { skipNext = false; return null; }

                    const cellEntries = grid[day]?.[t] || [];
                    const hasLab = cellEntries.some(e => e.isLab);

                    if (hasLab && tIdx + 1 < times.length) {
                      skipNext = true;
                      return (
                        <td key={`${day}-${t}`} colSpan={2}
                          style={{ padding: "12px 8px", border: "1px solid #000", textAlign: "center", fontSize: "8px", verticalAlign: "top", background: "white" }}>
                          {cellEntries.map((entry, idx) => (
                            <div key={idx} style={{ marginBottom: "10px" }}>
                              <div style={{ fontWeight: "700", fontSize: "10px" }}>{entry.subject}</div>
                              <div style={{ fontSize: "10px", color: "#141212", fontWeight: "600" }}>
                                {entry.section}{entry.cluster && entry.cluster !== "—" ? ` • CLU ${entry.cluster}` : ""}
                              </div>
                              {entry.displayFaculty && (
                                <div style={{ fontSize: "10px", color: "#1d2221", fontWeight: "700",fontStyle: "normal" }}>{entry.displayFaculty}</div>
                              )}
                              <div style={{ fontSize: "8px", fontWeight: "700", color: "#131211", padding: "2px 4px",  borderRadius: "2px", display: "inline-block" }}>
                               
                              </div>
                            </div>
                          ))}
                        </td>
                      );
                    }

                    return (
                      <td key={`${day}-${t}`} style={{ padding: "16px 12px", border: "1px solid #000", textAlign: "center", fontSize: "10px", verticalAlign: "top", minHeight: "140px" }}>
                        {cellEntries.length > 0 ? (
                          cellEntries.map((entry, idx) => (
                            <div key={idx} style={{ marginBottom: "10px" }}>
                              <div style={{ fontWeight: "700", fontSize: "10px" }}>{entry.subject}</div>
                              <div style={{ fontSize: "10px", color: "#1a1414", fontWeight: "600" }}>
                                {entry.section}{entry.cluster && entry.cluster !== "—" ? ` • CLU ${entry.cluster}` : ""}
                              </div>
                              {entry.displayFaculty && (
                                <div style={{ fontSize: "10px", fontStyle: "normal",fontWeight: "700" }}>{entry.displayFaculty}</div>
                              )}
                             
                            </div>
                          ))
                        ) : <span style={{ fontSize: "10px",color: "#111311" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
    })}
      </tbody>
    </table>
  )}

    {totalClasses > 0 && (
      <div style={{ marginTop: "40px", marginBottom: "40px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", marginBottom: "12px", letterSpacing: "1px" }}>Subject & Units Breakdown</div>
        
        <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #000" }}>
          <thead>
            <tr style={{ background: "#000", color: "#fff" }}>
              <th style={{ padding: "12px", border: "1px solid #000", textAlign: "left", fontSize: "11px", fontWeight: "700" }}>SUBJECT</th>
              <th style={{ padding: "12px", border: "1px solid #000", textAlign: "center", fontSize: "11px", fontWeight: "700", width: "200px" }}>CODE</th>
              <th style={{ padding: "12px", border: "1px solid #000", textAlign: "center", fontSize: "11px", fontWeight: "700" }}>UNITS</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const uniqueSubjects = new Map();

              entries.forEach(entry => {
                if (entry.subject) {
                  const subMatch = subjectsList.find(s => 
                    s.subject_name === entry.subject || 
                    s.subject_name?.toLowerCase() === entry.subject?.toLowerCase()
                  );
                  const labMatch = labsList.find(l => 
                    l.lab_name === entry.subject || 
                    l.lab_name?.toLowerCase() === entry.subject?.toLowerCase()
                  );
                  const code = entry.code || subMatch?.subject_code || labMatch?.lab_code || "";
                  
                  if (!uniqueSubjects.has(entry.subject)) {
                    uniqueSubjects.set(entry.subject, {
                      subject: entry.subject,
                      code: code,
                      isLab: entry.isLab,
                      count: 0,
                    });
                  }
                  uniqueSubjects.get(entry.subject).count += 1;
                }
              });

              const subjectsArray = Array.from(uniqueSubjects.values());

              if (subjectsArray.length === 0) {
                return (
                  <tr>
                    <td colSpan={3} style={{ padding: "16px", textAlign: "center", fontSize: "11px", fontStyle: "italic", color: "#666", border: "1px solid #000" }}>
                      No subjects assigned
                    </td>
                  </tr>
                );
              }

              let totalUnits = 0;

              const rows = subjectsArray.map((item, idx) => {
                const unitsPerClass = item.isLab ? 1 : 2;
                const subjectUnits = item.count * unitsPerClass;
                totalUnits += subjectUnits;

                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#f8f8f8" : "#fff" }}>
                    <td style={{ padding: "12px", border: "1px solid #000", fontSize: "11px", fontWeight: "600" }}>
                      {item.subject}
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #000", textAlign: "center", fontSize: "10px" }}>
                      {item.code || "—"}
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #000", textAlign: "center", fontSize: "11px", fontWeight: "700" }}>
                      {item.count} ({item.isLab ? 'Practical' : 'Theory'}) × {unitsPerClass} = {subjectUnits} Unit{subjectUnits !== 1 ? 's' : ''}
                    </td>
                  </tr>
                );
              });

              rows.push(
                <tr key="total" style={{ background: "#f5f5f5", fontWeight: "700" }}>
                  <td colSpan={2} style={{ padding: "14px", border: "1px solid #000", fontSize: "12px", textAlign: "right" }}>
                    Total Units
                  </td>
                  <td style={{ padding: "14px", border: "1px solid #000", textAlign: "center", fontSize: "12px", fontWeight: "900" }}>
                    {totalUnits} Units
                  </td>
                </tr>
              );

              return rows;
            })()}
          </tbody>
        </table>
      </div>
    )}

  <div style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
    {["Timetable Officers", "Chief Timetable Officer", "HOD", "Dean (Academics)", "Principal"].map((lbl, i) => (
      <div key={i} style={{ textAlign: "center" }}>
        <div style={{ height: "50px", borderBottom: "2px solid #000", marginBottom: "6px" }} />
        <div>{lbl}</div>
      </div>
    ))}
  </div>

    </div>
  );
}