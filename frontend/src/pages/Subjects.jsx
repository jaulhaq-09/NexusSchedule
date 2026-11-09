import { useEffect, useState } from "react";
import API from "../services/api";
import OCRTableUpload from "../components/OCRTableUpload";
import AICoordinatorModal from "../components/AICoordinatorModal";
import { aiSuggestCoordinatorsBulk, aiIdentifyCoreSubjects, toggleSubjectCore } from "../services/api";
import QuickReset from "../components/QuickReset";
import { useLocation } from "react-router-dom";
// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`;
const COLORS = ["#7C3AED", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#6366F1", "#14B8A6"];

export default function Subjects() {

  useScrollToTop();  // ✅ ADD THIS LINE

  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hours, setHours] = useState("");
  const [category, setCategory] = useState("");
  const [deptId, setDeptId] = useState(String((() => { try { return JSON.parse(localStorage.getItem("user") || "{}").department_id ?? ""; } catch { return ""; } })()));
  const [departments, setDepartments] = useState([]);

  const CATEGORIES = ["ASC", "IPCC", "PCC", "PCCL", "HSMC", "AEC", "PW", "SL", "NCMC"];
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [coordinatorSubject, setCoordinatorSubject] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [identifyingCore, setIdentifyingCore] = useState(false);

  // ✅ NEW: click-any-cell inline editing, same pattern as Faculty.jsx —
  // no separate Edit button, click a cell, edit, blur/Enter saves.
  const isAdmin = localStorage.getItem("userRole") === "coordinator"; // coordinators manage their own dept+cluster data
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [editingCell, setEditingCellRaw] = useState(null); // { id, field }
  const setEditingCell = (v) => { if (isAdmin) setEditingCellRaw(v); };
  const [editValue, setEditValue] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try {
      const r = await API.get("/subjects");
      setSubjects(r.data || []);
    } catch {
      showToast("Failed to load subjects", "error");
    }
  };

  useEffect(() => {
    load();
    API.get("/departments").then(r => setDepartments(r.data || [])).catch(() => { });
  }, []);

  const runAiAnalysis = async () => {
    setAiAnalyzing(true);
    try {
      const res = await aiSuggestCoordinatorsBulk();
      setAiResults(res.data.results || {});
      showToast("✓ AI analysis complete for all subjects");
    } catch (err) {
      showToast(err.response?.data?.detail || "AI analysis failed", "error");
    } finally {
      setAiAnalyzing(false);
    }
  };

  const runIdentifyCore = async () => {
    setIdentifyingCore(true);
    try {
      const res = await aiIdentifyCoreSubjects();
      const coreNames = res.data.core_subjects || [];
      await load();
      showToast(`✓ ${coreNames.length} subjects identified as core`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Core subject identification failed", "error");
    } finally {
      setIdentifyingCore(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Required";
    if (!code.trim()) e.code = "Required";
    if (!hours || isNaN(hours) || Number(hours) <= 0) e.hours = "Enter valid number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addSubject = async () => {
    if (!validate()) return;
    try {
      const res = await API.post("/subjects", {
        subject_name: name.trim(),
        subject_code: code.trim(),
        hours_per_week: Number(hours),
        course_category: category || null,
        department_id: deptId ? Number(deptId) : null,
      });
      const newSubject = res.data;
      setSubjects(p => [...p, newSubject]);
      setName(""); setCode(""); setHours(""); setCategory(""); setErrors({});
      showToast(`"${name}" added`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to add", "error");
    }
  };

  // ✅ NEW: single-field inline save — mirrors Faculty.jsx's saveInlineEdit.
  // Accepts an optional explicit value (used by the category <select>,
  // whose onChange fires before React state has updated) so we don't
  // read a stale editValue.
  const saveInlineEdit = async (subjectId, field, valueOverride) => {
    const value = valueOverride !== undefined ? valueOverride : editValue;
    setEditingCell(null);

    const item = subjects.find(s => s.id === subjectId);
    if (!item) return;

    if (field === "name" && !String(value).trim()) { showToast("Name cannot be empty", "error"); return; }
    if (field === "code" && !String(value).trim()) { showToast("Code cannot be empty", "error"); return; }
    if (field === "hours" && (isNaN(value) || Number(value) <= 0)) { showToast("Enter a valid number", "error"); return; }

    const updated = {
      subject_name: field === "name" ? value.trim() : item.subject_name,
      subject_code: field === "code" ? value.trim() : item.subject_code,
      hours_per_week: field === "hours" ? Number(value) : item.hours_per_week,
      course_category: field === "category" ? (value || null) : (item.course_category || null),
      semester: item.semester ?? null,
      subject_type: item.subject_type || "THEORY",
      department_id: field === "department" ? Number(value || 0) : (item.department_id ?? null),
    };

    try {
      await API.put(`/subjects/${subjectId}`, updated);
      setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, ...updated } : s));
      showToast("✓ Updated");
    } catch (err) {
      showToast(err.response?.data?.detail || "Update failed", "error");
      load(); // revert on error
    }
  };

  // ✅ NEW: Core/Elective badge now toggles instantly on click — no edit
  // mode needed, matches the "click to change" spirit of the rest of the page.
  const toggleCore = async (subject) => {
    if (!isAdmin) return;
    try {
      await toggleSubjectCore(subject.id, !subject.is_core);
      setSubjects(prev => prev.map(s => s.id === subject.id ? { ...s, is_core: !s.is_core } : s));
      showToast(`✓ Marked as ${!subject.is_core ? "Core" : "Elective"}`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to update", "error");
    }
  };

  const deleteSubject = async () => {
    const subject = deleteModal?.subject;
    if (!subject?.id) {
      showToast("Invalid subject ID", "error");
      setDeleteModal(null);
      return;
    }
    setDeleting(true);
    try {
      await API.delete(`/subjects/${subject.id}`);
      setSubjects(p => p.filter(s => s.id !== subject.id));
      showToast(`"${subject.subject_name}" deleted`);
    } catch (err) {
      showToast(err.response?.data?.detail || "Delete failed", "error");
    } finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  const filtered = subjects.filter(s =>
    s.subject_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.subject_code?.toLowerCase().includes(search.toLowerCase())
  );

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    .sp{min-height:100vh;background:linear-gradient(135deg, #080C14 0%, #0F172A 100%);font-family:'Sora',sans-serif;padding:24px 32px 0;color:#F0EDE8}
    .sp-hd{margin-bottom:20px}
    .sp-hd h1{font-family:'Sora',sans-serif;font-size:22px;font-weight:700;color:#F0EDE8;letter-spacing:-0.3px}
    .sp-hd p{color:#94A3B8;font-size:13px;margin-top:4px;font-family:'Sora',sans-serif}
    .gc{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
    .ct{font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:#F0EDE8;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .fg{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:14px}
    @media(max-width:700px){.fg{grid-template-columns:1fr}}
    .fw{display:flex;flex-direction:column;gap:5px}
    .fl{font-size:10px;font-family:'Sora',sans-serif;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px}
    .fi{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
    .fi:focus{border-color:#EAB308;box-shadow:0 0 0 3px rgba(234,179,8,.12)}
    .fi.err{border-color:#EF4444}
    .fe{font-size:11px;color:#F87171;font-family:'Sora',sans-serif}
    .ba{padding:8px 16px;background:#EAB308;color:#0A0C12;font-weight:700;font-size:12px;font-family:'Sora',sans-serif;border:none;border-radius:8px;cursor:pointer;transition:opacity .2s,transform .15s;box-shadow:0 4px 16px rgba(234,179,8,0.3)}
    .ba:hover{opacity:.9;transform:translateY(-1px)}
    .lh{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
    .lt{font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:#F0EDE8}
    .cb{background:rgba(234,179,8,.15);color:#EAB308;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;padding:2px 10px;border-radius:20px;border:1px solid rgba(234,179,8,.3)}
    .si{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:220px;transition:border-color .2s}
    .si:focus{border-color:#EAB308}
    .si::placeholder{color:#475569}
    table{width:100%;border-collapse:collapse}
    thead tr{background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,.08)}
    th{font-family:'Sora',sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;padding:10px 14px;text-align:left;font-weight:700}
    th:last-child{text-align:right}
    tbody tr{border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s}
    tbody tr:hover{background:rgba(255,255,255,.04)}
    tbody tr:last-child{border-bottom:none}
    td{padding:10px 14px;font-size:13px;color:#94A3B8;vertical-align:middle}
    td:last-child{text-align:right}
    .rn{font-family:'JetBrains Mono',monospace;font-size:11px;color:#64748B}
    .nc{display:flex;align-items:center;gap:9px}
    .nd{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .nm{font-weight:600;color:#F0EDE8}
    .cd{font-family:'JetBrains Mono',monospace;font-size:11px;background:rgba(255,255,255,.06);color:#94A3B8;padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.08)}
    .hb{font-family:'JetBrains Mono',monospace;font-size:11px;color:#EAB308;background:rgba(234,179,8,.1);padding:3px 9px;border-radius:6px;border:1px solid rgba(234,179,8,.2)}
    .acts{display:flex;gap:6px;justify-content:flex-end}
    .bd{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);color:#F87171;padding:5px 13px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;transition:background .2s}
    .bd:hover{background:rgba(220,38,38,.25)}
    .bd:disabled{opacity:.4;cursor:not-allowed}
    .edit-input{background:rgba(255,255,255,.07);border:1px solid rgba(234,179,8,.4);border-radius:7px;padding:6px 10px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:100%}
    .es{text-align:center;padding:56px 24px}
    .es .ei{font-size:2.5rem;margin-bottom:12px;opacity:0.3}
    .es .et{font-family:'Sora',sans-serif;font-size:14px;color:#94A3B8;margin-bottom:6px}
    .es .es2{font-size:12px;font-family:'Sora',sans-serif;color:#64748B}
    .toast{position:fixed;bottom:28px;right:28px;padding:11px 18px;border-radius:9px;font-size:13px;font-family:'Sora',sans-serif;font-weight:500;z-index:9999;animation:sli .3s ease;max-width:300px}
    .toast.success{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#34D399}
    .toast.error{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#F87171}
    @keyframes sli{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .mo{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998}
    .mb{background:rgba(255,255,255,0.08);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px 32px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .mi{font-size:2.2rem;margin-bottom:10px}
    .mt{font-family:'Sora',sans-serif;font-size:16px;font-weight:700;color:#F0EDE8;margin-bottom:8px}
    .md{font-size:13px;color:#94A3B8;margin-bottom:20px;line-height:1.5}
    .mn{color:#EAB308;font-weight:600}
    .ma{display:flex;gap:10px;justify-content:center}
    .bca{padding:8px 20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#94A3B8;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-size:13px;font-weight:600}
    .bca:disabled{opacity:.5;cursor:not-allowed}
    .bda{padding:8px 20px;background:linear-gradient(135deg,#DC2626,#B91C1C);border:none;color:#fff;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;transition:filter .2s;box-shadow:0 4px 14px rgba(220,38,38,0.4)}
    .bda:hover{filter:brightness(1.1)}
    .bda:disabled{opacity:.5;cursor:not-allowed}
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>
      <div className="sp">
        <div className="sp-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>Subject Management</h1>
            <p style={{ margin: 0 }}>
              Add, edit and manage subjects · {subjects.length} total
            </p>
          </div>

          <div style={{ display: isAdmin ? "flex" : "none", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowOCR(true)}
              style={{
                padding: "6px 12px",
                background: "rgba(99,102,241,0.15)",
                color: "#818CF8",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "11px",
                fontFamily: "Sora, sans-serif",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              📷 Import
            </button>

            <button
              onClick={() => setShowReset(true)}
              style={{
                padding: "6px 12px",
                background: "rgba(239,68,68,0.15)",
                color: "#F87171",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "11px",
                fontFamily: "Sora, sans-serif",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              🔄 Reset
            </button>

            <button
              onClick={runAiAnalysis}
              disabled={aiAnalyzing}
              style={{
                padding: "6px 12px",
                background: "rgba(234,179,8,0.15)",
                color: "#EAB308",
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: "8px",
                cursor: aiAnalyzing ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "11px",
                fontFamily: "Sora, sans-serif",
                whiteSpace: "nowrap",
                opacity: aiAnalyzing ? 0.6 : 1,
              }}
            >
              {aiAnalyzing ? "🤖 Analyzing…" : "🤖 AI Analyze"}
            </button>

            <button
              onClick={runIdentifyCore}
              disabled={identifyingCore}
              style={{
                padding: "6px 12px",
                background: "rgba(245,158,11,0.15)",
                color: "#F59E0B",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "8px",
                cursor: identifyingCore ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "11px",
                fontFamily: "Sora, sans-serif",
                whiteSpace: "nowrap",
                opacity: identifyingCore ? 0.6 : 1,
              }}
            >
              {identifyingCore ? "🎯 Identifying…" : "🎯 Identify Core"}
            </button>
          </div>
        </div>
        {/* ── Add Subject Form ── */}
        <div className="gc" style={{ display: isAdmin ? undefined : "none" }}>
          <div className="ct">Add New Subject</div>
          <div className="fg">
            <div className="fw">
              <label className="fl">Subject Name</label>
              <input className={`fi${errors.name ? " err" : ""}`} placeholder="e.g. Mathematics" value={name}
                onChange={e => { setName(e.target.value); setErrors({}); }} />
              {errors.name && <span className="fe">{errors.name}</span>}
            </div>
            <div className="fw">
              <label className="fl">Subject Code</label>
              <input className={`fi${errors.code ? " err" : ""}`} placeholder="e.g. MATH101" value={code}
                onChange={e => { setCode(e.target.value); setErrors({}); }} />
              {errors.code && <span className="fe">{errors.code}</span>}
            </div>
            <div className="fw">
              <label className="fl">Hours / Week</label>
              <input className={`fi${errors.hours ? " err" : ""}`} placeholder="e.g. 4" type="number" min="1" value={hours}
                onChange={e => { setHours(e.target.value); setErrors({}); }} />
              {errors.hours && <span className="fe">{errors.hours}</span>}
            </div>
            <div className="fw">
              <label className="fl">Department</label>
              <select className="fi" value={deptId} disabled onChange={e => setDeptId(e.target.value)}>
                {departments.filter(d => String(d.id) === String(deptId)).map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
          </div>
          <button className="ba" onClick={addSubject}>Add Subject</button>
        </div>

        {/* ── Subjects List ── */}
        <div className="gc">
          <div className="lh">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="lt">Subjects List</span>
              <span className="cb">{filtered.length}</span>
            </div>
            {subjects.length > 0 && (
              <input className="si" placeholder="🔍 Search..." value={search}
                onChange={e => setSearch(e.target.value)} />
            )}
          </div>

          {subjects.length === 0 ? (
            <div className="es">
              <div className="ei">📭</div>
              <div className="et">No subjects yet</div>
              <div className="es2">Add your first subject using the form above</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="es">
              <div className="ei">🔍</div>
              <div className="et">No results found</div>
              <div className="es2">No subjects match "{search}"</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>Code</th><th>Dept</th><th>Hrs/Wk</th><th>Units</th><th>Type</th><th>Course Coordinator</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td className="rn">{i + 1}</td>

                    {/* Name — click to edit */}
                    <td onClick={() => { setEditingCell({ id: s.id, field: "name" }); setEditValue(s.subject_name); }}>
                      {editingCell?.id === s.id && editingCell?.field === "name" ? (
                        <input
                          autoFocus
                          className="edit-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(s.id, "name")}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveInlineEdit(s.id, "name");
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      ) : (
                        <div className="nc" style={{ cursor: "text" }} title="Click to edit">
                          <div className="nd" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="nm">{s.subject_name}</span>
                        </div>
                      )}
                    </td>

                    {/* Code — click to edit */}
                    <td onClick={() => { setEditingCell({ id: s.id, field: "code" }); setEditValue(s.subject_code); }}>
                      {editingCell?.id === s.id && editingCell?.field === "code" ? (
                        <input
                          autoFocus
                          className="edit-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(s.id, "code")}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveInlineEdit(s.id, "code");
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span className="cd" style={{ cursor: "text" }} title="Click to edit">{s.subject_code}</span>
                      )}
                    </td>

                    {/* Department — common (blank) or one department */}
                    <td>
                      <select
                        className="edit-input"
                        disabled
                        value={s.department_id || ""}
                        onChange={e => saveInlineEdit(s.id, "department", e.target.value)}
                      >
                        <option value="">Common</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
                      </select>
                    </td>

                    {/* Hrs/Wk — click to edit */}
                    <td onClick={() => { setEditingCell({ id: s.id, field: "hours" }); setEditValue(String(s.hours_per_week)); }}>
                      {editingCell?.id === s.id && editingCell?.field === "hours" ? (
                        <input
                          autoFocus
                          type="number" min="1"
                          className="edit-input"
                          style={{ width: 70 }}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(s.id, "hours")}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveInlineEdit(s.id, "hours");
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span style={{ color: "#94A3B8", fontSize: "13px", cursor: "text" }} title="Click to edit">{s.hours_per_week}h</span>
                      )}
                    </td>

                    {/* Units — derived, not editable */}
                    <td><span style={{ color: "#94A3B8", fontSize: "13px" }}>{(s.hours_per_week || 2) * 2}</span></td>

                    {/* Type — click to instantly toggle */}
                    <td>
                      {s.is_core ? (
                        <button
                          onClick={() => toggleCore(s)}
                          style={{
                            border: "none", cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                            padding: "3px 9px", borderRadius: "6px", fontWeight: 700,
                            color: "#0C0A00", background: "linear-gradient(135deg,#FBBF24,#F59E0B)",
                          }}
                          title="Click to mark as Elective"
                        >
                          ⭐ CORE
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleCore(s)}
                          style={{
                            border: "1px solid rgba(255,255,255,.08)", cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
                            padding: "3px 9px", borderRadius: "6px", fontWeight: 500,
                            color: "#94A3B8", background: "rgba(255,255,255,.06)",
                          }}
                          title="Click to mark as Core"
                        >
                          ELECTIVE
                        </button>
                      )}
                    </td>

                    {/* Course Coordinator — unchanged */}
                    <td>
                      {s.coordinator_name ? (
                        <span className="hb" style={{ color: "#34D399", background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)" }}>
                          ✅ {s.coordinator_name}
                        </span>
                      ) : aiResults[s.id]?.suggestions ? (
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => setCoordinatorSubject({ ...s, _preloaded: aiResults[s.id].suggestions })}
                        >
                          <span className="hb" style={{ color: "#818CF8", background: "rgba(129,140,248,0.12)", borderColor: "rgba(129,140,248,0.3)" }}>
                            🏆 {aiResults[s.id].suggestions[0]?.faculty_name} (suggested)
                          </span>
                        </div>
                      ) : aiResults[s.id]?.error ? (
                        <span style={{ fontSize: 11, color: "#F87171" }}>⚠ No match</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#334155" }}>—</span>
                      )}
                    </td>

                    {/* Actions — Delete only, no Edit button */}
                    <td>
                      <div className="acts">
                        <button className="bd" style={{ display: isAdmin ? undefined : "none" }} disabled={deleting}
                          onClick={() => setDeleteModal({ subject: s })}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Navigation Buttons — corner arrows, matches Faculty/Structure ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '20px 0 24px',
          gap: '20px'
        }}>
          <button
            onClick={() => window.location.href = '/faculty'}
            title="Previous: Faculty"
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
            onClick={() => window.location.href = '/labs'}
            title="Next: Labs"
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

      {/* ── Delete Confirm Modal ── */}
      {deleteModal && (
        <div className="mo">
          <div className="mb">
            <div className="mi">🗑️</div>
            <div className="mt">Delete Subject?</div>
            <div className="md">
              Permanently delete <span className="mn">"{deleteModal.subject?.subject_name}"</span>? This cannot be undone.
            </div>
            <div className="ma">
              <button className="bca" disabled={deleting} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="bda" disabled={deleting} onClick={deleteSubject}>
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {coordinatorSubject && (
        <AICoordinatorModal
          subject={coordinatorSubject}
          onClose={() => setCoordinatorSubject(null)}
          onAssigned={(name) => {
            showToast(`✓ ${name} assigned as coordinator`);
            load();
          }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* OCR Import Modal */}
      {showOCR && (
        <OCRTableUpload
          target="subjects"
          onClose={() => setShowOCR(false)}
          onImported={() => {
            setShowOCR(false);
            load();
          }}
        />
      )}

      {/* Quick Reset Modal */}
      {showReset && (
        <QuickReset
          target="subjects"
          onComplete={() => {
            setShowReset(false);
            load();
          }}
        />
      )}
    </>
  );
}