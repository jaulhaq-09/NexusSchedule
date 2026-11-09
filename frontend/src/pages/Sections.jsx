import { useEffect, useState } from "react";
import API from "../services/api";
import QuickReset from "../components/QuickReset";
import OCRTableUpload from "../components/OCRTableUpload";
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
const CLUSTER_COLORS = { 1: "#EAB308", 2: "#10B981", 3: "#3B82F6", 4: "#8B5CF6", 5: "#EC4899", 6: "#F97316", 7: "#14B8A6", 8: "#FB7185", 9: "#84CC16", 10: "#06B6D4" };

export default function Sections() {

  useScrollToTop();  // ✅ ADD THIS LINE

  const [sections, setSections] = useState([]);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [cluster, setCluster] = useState(String((() => { try { return JSON.parse(localStorage.getItem("user") || "{}").cluster ?? 1; } catch { return 1; } })()));
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const isAdmin = localStorage.getItem("userRole") === "coordinator"; // coordinators manage their own dept+cluster data
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [editingCell, setEditingCellRaw] = useState(null); // { id, field }
  const setEditingCell = (v) => { if (isAdmin) setEditingCellRaw(v); };
  const [editValue, setEditValue] = useState("");
  const [groupBy, setGroupBy] = useState("cluster"); // "cluster" | "semester" | "none"
  const [showOCR, setShowOCR] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState(String((() => { try { return JSON.parse(localStorage.getItem("user") || "{}").department_id ?? ""; } catch { return ""; } })()));

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    try { const r = await API.get("/sections"); setSections(r.data || []); }
    catch { showToast("Failed to load sections", "error"); }
  };

  useEffect(() => {
    load();
    API.get("/departments").then(r => setDepartments(r.data || [])).catch(() => { });
  }, []);

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Required";
    if (!deptId) e.dept = "Select a department";
    if (!semester || isNaN(semester) || Number(semester) < 1 || Number(semester) > 8)
      e.semester = "Enter 1–8";
    if (!cluster || isNaN(cluster) || Number(cluster) < 1)
      e.cluster = "Enter a valid cluster number (1 or above)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addSection = async () => {
    if (!validate()) return;
    try {
      const r = await API.post("/sections", {
        section_name: name.trim(),
        semester: Number(semester),
        cluster: Number(cluster),
        department_id: Number(deptId),
      });
      setSections(p => [...p, r.data]);
      setName(""); setSemester(""); setCluster("1"); setErrors({});
      showToast(`Section "${name}" added`);
    } catch (err) { showToast(err.response?.data?.detail || "Failed to add", "error"); }
  };

  // ✅ Click-any-cell inline editing, same pattern as Labs.jsx / Rooms.jsx —
  // no separate Edit button.
  const saveInlineEdit = async (sectionId, field, valueOverride) => {
    const value = valueOverride !== undefined ? valueOverride : editValue;
    setEditingCell(null);

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    if (field === "name" && !String(value).trim()) { showToast("Section name cannot be empty", "error"); return; }
    if (field === "cluster" && (!value || isNaN(value) || Number(value) < 1)) { showToast("Enter a valid cluster number", "error"); return; }
    if (field === "semester" && (!value || isNaN(value) || Number(value) < 1 || Number(value) > 8)) { showToast("Semester must be 1–8", "error"); return; }

    const payload = {
      section_name: field === "name" ? value.trim() : section.section_name,
      cluster: field === "cluster" ? Number(value) : (section.cluster ?? 1),
      semester: field === "semester" ? Number(value) : section.semester,
      department_id: field === "dept" ? (value ? Number(value) : null) : (section.department_id ?? null),
    };

    try {
      await API.put(`/sections/${sectionId}`, payload);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, ...payload } : s));
      showToast("Section updated");
    } catch (err) {
      showToast(err.response?.data?.detail || "Update failed", "error");
      load();
    }
  };

  const deleteSection = async () => {
    if (!deleteModal) return;
    try {
      await API.delete(`/sections/${deleteModal.id}`);
      setSections(p => p.filter(s => s.id !== deleteModal.id));
      showToast(`"${deleteModal.section_name}" deleted`); setDeleteModal(null);
    } catch (err) { showToast(err.response?.data?.detail || "Delete failed", "error"); setDeleteModal(null); }
  };

  const filtered = sections.filter(s =>
    s.section_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(s.semester).includes(search) ||
    String(s.cluster).includes(search)
  );

  // Group sections for display
  const grouped = () => {
    if (groupBy === "cluster") {
      const map = {};
      filtered.forEach(s => {
        const k = `Cluster ${s.cluster ?? 1}`;
        if (!map[k]) map[k] = [];
        map[k].push(s);
      });
      return map;
    }
    if (groupBy === "semester") {
      const map = {};
      filtered.forEach(s => {
        const k = `Semester ${s.semester}`;
        if (!map[k]) map[k] = [];
        map[k].push(s);
      });
      return map;
    }
    return { "All Sections": filtered };
  };

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    .secp{min-height:100vh;background:linear-gradient(135deg, #080C14 0%, #0F172A 100%);font-family:'Sora',sans-serif;padding:24px 32px 0;color:#F0EDE8}
    .secp-hd{margin-bottom:20px}
    .secp-hd h1{font-family:'Sora',sans-serif;font-size:22px;font-weight:700;color:#F0EDE8;letter-spacing:-0.3px}
    .secp-hd p{color:#94A3B8;font-size:13px;margin-top:4px;font-family:'Sora',sans-serif}
    .gc{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
    .ct{font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:#F0EDE8;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .fg{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:14px}
    @media(max-width:480px){.fg{grid-template-columns:1fr}}
    .fw{display:flex;flex-direction:column;gap:5px}
    .fl{font-size:10px;font-family:'Sora',sans-serif;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px}
    .fi{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;transition:border-color .2s;width:100%}
    .fi:focus{border-color:#EAB308;box-shadow:0 0 0 3px rgba(234,179,8,.12)}
    .fi.err{border-color:#EF4444}
    .fi-sel{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748B' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer}
    .fi-sel option{background:#0F172A}
    .fe{font-size:11px;color:#F87171;font-family:'Sora',sans-serif}
    .ba{padding:8px 16px;background:#EAB308;color:#0A0C12;font-weight:700;font-size:12px;font-family:'Sora',sans-serif;border:none;border-radius:8px;cursor:pointer;transition:opacity .2s,transform .15s;box-shadow:0 4px 16px rgba(234,179,8,0.3)}
    .ba:hover{opacity:.9;transform:translateY(-1px)}
    .lh{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
    .lt{font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:#F0EDE8}
    .cb{background:rgba(234,179,8,.15);color:#EAB308;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;padding:2px 10px;border-radius:20px;border:1px solid rgba(234,179,8,.3)}
    .si{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:200px;transition:border-color .2s}
    .si:focus{border-color:#EAB308}.si::placeholder{color:#475569}
    .grp-sel{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:7px 12px;color:#94A3B8;font-size:12px;font-family:'Sora',sans-serif;outline:none;cursor:pointer}
    .grp-sel option{background:#0F172A}
    .grp-hdr{display:flex;align-items:center;gap:10px;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)}
    .grp-hdr-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .grp-hdr-lbl{font-family:'JetBrains Mono', monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
    .grp-hdr-cnt{font-size:10px;background:rgba(255,255,255,.06);color:#64748B;padding:2px 8px;border-radius:10px;font-family:'JetBrains Mono', monospace}
    table{width:100%;border-collapse:collapse}
    thead tr{background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,.08)}
    th{font-family:'Sora',sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748B;padding:10px 14px;text-align:left;font-weight:700}
    th:last-child{text-align:right}
    tbody tr{border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s}
    tbody tr:hover{background:rgba(255,255,255,.04)}
    tbody tr:last-child{border-bottom:none}
    td{padding:10px 14px;font-size:13px;color:#94A3B8;vertical-align:middle}
    td:last-child{text-align:right}
    .rn{font-family:'JetBrains Mono', monospace;font-size:11px;color:#64748B}
    .snc{display:flex;align-items:center;gap:10px}
    .sav{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono', monospace;font-size:10px;font-weight:700;flex-shrink:0;letter-spacing:.02em}
    .snm{font-weight:600;color:#F0EDE8}
    .smb{font-family:'JetBrains Mono', monospace;font-size:11px;padding:3px 10px;border-radius:6px;background:rgba(129,140,248,.12);color:#818CF8;border:1px solid rgba(129,140,248,.25)}
    .clb{font-family:'JetBrains Mono', monospace;font-size:11px;padding:3px 10px;border-radius:6px;font-weight:700}
    .acts{display:flex;gap:6px;justify-content:flex-end}
    .be{background:rgba(129,140,248,.12);border:1px solid rgba(129,140,248,.3);color:#818CF8;padding:5px 12px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;transition:background .15s}
    .be:hover{background:rgba(129,140,248,.22)}
    .bd{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);color:#F87171;padding:5px 12px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;transition:background .15s}
    .bd:hover{background:rgba(220,38,38,.25)}
    .edit-input{background:rgba(255,255,255,.07);border:1px solid rgba(234,179,8,.4);border-radius:7px;padding:6px 10px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:100%}
    .edit-sel{background:rgba(255,255,255,.07);border:1px solid rgba(234,179,8,.4);border-radius:7px;padding:6px 10px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none}
    .edit-sel option{background:#0F172A}
    .bs{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#34D399;padding:5px 12px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer}
    .bc{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#94A3B8;padding:5px 12px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;cursor:pointer}
    .es{text-align:center;padding:48px 24px;color:#64748B}
    .es .ei{font-size:2.2rem;margin-bottom:10px;opacity:0.3}
    .es p{font-size:13px;font-family:'Sora',sans-serif}
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
    .bda{padding:8px 20px;background:linear-gradient(135deg,#DC2626,#B91C1C);border:none;color:#fff;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;transition:filter .2s;box-shadow:0 4px 14px rgba(220,38,38,0.4)}
    .bda:hover{filter:brightness(1.1)}
    .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px}
    .stat-card{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
    .stat-val{font-family:'JetBrains Mono', monospace;font-size:1.6rem;font-weight:800;line-height:1}
    .stat-lbl{font-size:10px;color:#64748B;font-family:'Sora',sans-serif;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-top:4px}
  `;

  const groups = grouped();
  const groupKeys = Object.keys(groups).sort();

  const EXTRA_COLORS = ["#A78BFA", "#FB923C", "#34D399", "#F472B6", "#60A5FA", "#FBBF24", "#4ADE80", "#E879F9"];
  const clusterColor = (n) => CLUSTER_COLORS[n] || EXTRA_COLORS[(n - 1) % EXTRA_COLORS.length] || "#94A3B8";

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>
      <div className="secp">

        {/* Header */}
        <div className="secp-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>Section Management</h1>
            <p style={{ margin: 0 }}>Manage sections · {sections.length} total</p>
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
                whiteSpace: "nowrap",
                fontFamily: "Sora, sans-serif",
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
                whiteSpace: "nowrap",
                fontFamily: "Sora, sans-serif",
              }}
            >
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Add Section Form */}
        <div className="gc" style={{ display: isAdmin ? undefined : "none" }}>
          <div className="ct">Add New Section</div>
          <div className="fg">
            <div className="fw">
              <label className="fl">Section Name</label>
              <input className={`fi${errors.name ? " err" : ""}`} placeholder="e.g. CSE-A" value={name}
                onChange={e => { setName(e.target.value); setErrors({}); }} />
              {errors.name && <span className="fe">{errors.name}</span>}
            </div>
            <div className="fw">
              <label className="fl">Department</label>
              <select className={`fi fi-sel${errors.dept ? " err" : ""}`} disabled value={deptId}
                onChange={e => { setDeptId(e.target.value); setErrors({}); }}>
                <option value="">— Select —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
              {errors.dept && <span className="fe">{errors.dept}</span>}
            </div>
            <div className="fw">
              <label className="fl">Cluster No.</label>
              <input
                className={`fi${errors.cluster ? " err" : ""}`}
                placeholder="e.g. 1, 6, 10..."
                type="number" min="1" disabled
                value={cluster}
                onChange={e => { setCluster(e.target.value); setErrors({}); }}
              />
              {errors.cluster && <span className="fe">{errors.cluster}</span>}
            </div>
            <div className="fw">
              <label className="fl">Semester (1–8)</label>
              <select className={`fi fi-sel${errors.semester ? " err" : ""}`} value={semester}
                onChange={e => { setSemester(e.target.value); setErrors({}); }}>
                <option value="">— Select —</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
              {errors.semester && <span className="fe">{errors.semester}</span>}
            </div>
          </div>
          <button className="ba" onClick={addSection}>Add Section</button>
        </div>

        {/* Sections List */}
        <div className="gc">
          <div className="lh">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="lt">Sections List</span>
                <span className="cb">{filtered.length}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>💡 Click any cell to edit inline</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="grp-sel" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                <option value="cluster">Group by Cluster</option>
                <option value="semester">Group by Semester</option>
                <option value="none">No grouping</option>
              </select>
              <input className="si" placeholder="🔍 Search..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="es">
              <div className="ei">📭</div>
              <p>{search ? "No sections match your search" : "No sections yet — add one above"}</p>
            </div>
          ) : (
            groupKeys.map(grpKey => {
              const rows = groups[grpKey];
              const grpCluster = rows[0]?.cluster ?? 1;
              const dotColor = groupBy === "cluster"
                ? clusterColor(grpCluster)
                : "#94A3B8";

              return (
                <div key={grpKey}>
                  {/* Group header */}
                  {groupBy !== "none" && (
                    <div className="grp-hdr">
                      <div className="grp-hdr-dot" style={{ background: dotColor }} />
                      <span className="grp-hdr-lbl" style={{ color: dotColor }}>{grpKey}</span>
                      <span className="grp-hdr-cnt">{rows.length} section{rows.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}

                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Section</th>
                        <th>Dept</th>
                        <th>Cluster</th>
                        <th>Semester</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s, i) => {
                        const col = COLORS[i % COLORS.length];
                        const cc = clusterColor(s.cluster ?? 1);
                        return (
                          <tr key={s.id}>
                            <td className="rn">{i + 1}</td>

                            {/* Section Name — click to edit */}
                            <td onClick={() => { setEditingCell({ id: s.id, field: "name" }); setEditValue(s.section_name); }}>
                              {editingCell?.id === s.id && editingCell?.field === "name" ? (
                                <input
                                  autoFocus className="edit-input"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveInlineEdit(s.id, "name")}
                                  onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(s.id, "name"); if (e.key === "Escape") setEditingCell(null); }}
                                  placeholder="Section name"
                                />
                              ) : (
                                <div className="snc" style={{ cursor: "text" }} title="Click to edit">
                                  <div className="sav" style={{ background: `${col}18`, color: col, border: `1px solid ${col}35` }}>
                                    {(s.section_name || "").slice(0, 4).toUpperCase()}
                                  </div>
                                  <span className="snm">{s.section_name}</span>
                                </div>
                              )}
                            </td>

                            {/* Department — click to edit */}
                            <td onClick={() => { setEditValue(String(s.department_id ?? "")); }}>
                              {editingCell?.id === s.id && editingCell?.field === "dept" ? (
                                <select autoFocus className="edit-sel" value={editValue}
                                  onChange={e => saveInlineEdit(s.id, "dept", e.target.value)}
                                  onBlur={() => setEditingCell(null)}>
                                  <option value="">—</option>
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
                                </select>
                              ) : (
                                <span className="smb" style={{ cursor: "pointer" }} title="Click to edit">
                                  {departments.find(d => d.id === s.department_id)?.code || "—"}
                                </span>
                              )}
                            </td>

                            {/* Cluster — click to edit */}
                            <td onClick={() => { setEditValue(String(s.cluster ?? 1)); }}>
                              {editingCell?.id === s.id && editingCell?.field === "cluster" ? (
                                <input
                                  autoFocus className="edit-input" type="number" min="1" style={{ width: "80px" }}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveInlineEdit(s.id, "cluster")}
                                  onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(s.id, "cluster"); if (e.key === "Escape") setEditingCell(null); }}
                                />
                              ) : (
                                <span className="clb" style={{ background: `${cc}18`, color: cc, border: `1px solid ${cc}35`, cursor: "pointer" }} title="Click to edit">
                                  Cluster {s.cluster ?? 1}
                                </span>
                              )}
                            </td>

                            {/* Semester — click to edit */}
                            <td onClick={() => { setEditingCell({ id: s.id, field: "semester" }); setEditValue(String(s.semester)); }}>
                              {editingCell?.id === s.id && editingCell?.field === "semester" ? (
                                <select
                                  autoFocus className="edit-sel"
                                  value={editValue}
                                  onChange={e => saveInlineEdit(s.id, "semester", e.target.value)}
                                  onBlur={() => setEditingCell(null)}
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Sem {n}</option>)}
                                </select>
                              ) : (
                                <span className="smb" style={{ cursor: "pointer" }} title="Click to edit">Sem {s.semester}</span>
                              )}
                            </td>

                            {/* Actions — Delete only */}
                            <td>
                              <div className="acts">
                                <button className="bd" style={{ display: isAdmin ? undefined : "none" }} onClick={() => setDeleteModal(s)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>

        {/* ── Navigation Buttons — corner arrows, matches Faculty/Subjects/Labs/Rooms ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '20px 0 24px',
          gap: '20px'
        }}>
          <button
            onClick={() => window.location.href = '/rooms'}
            title="Previous: Rooms"
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
            onClick={() => window.location.href = '/timetable'}
            title="Next: Timetable"
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

      {/* Delete Modal */}
      {deleteModal && (
        <div className="mo">
          <div className="mb">
            <div className="mi">🗑️</div>
            <div className="mt">Delete Section?</div>
            <div className="md">
              Delete <span className="mn">"{deleteModal.section_name}"</span>
              {" "}(Cluster {deleteModal.cluster ?? 1}, Sem {deleteModal.semester})?
              This cannot be undone.
            </div>
            <div className="ma">
              <button className="bca" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="bda" onClick={deleteSection}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      {/* OCR Modal */}
      {showOCR && (
        <OCRTableUpload
          target="sections"
          globalMeta={{
            cluster: Number(cluster) || 1,   // ← Use cluster (from line 13)
            semester: Number(semester) || 1  // ← Use semester (from line 12)
          }}
          onClose={() => setShowOCR(false)}
          onImported={() => {
            setShowOCR(false);
            load(); // ← Use load() (from line 27)
          }}
        />
      )}
      {/* Quick Reset Modal */}
      {showReset && (
        <QuickReset
          target="sections"
          onComplete={() => {
            setShowReset(false);
            load(); // or whatever your load function is called
          }}
        />
      )}
    </>
  );
}