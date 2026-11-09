/**
 * Faculty.jsx
 * ─────────────────────────────────────────────────────────────
 * Full CRUD Faculty page
 * Fix: uses f.id (PostgreSQL integer) — not f._id
 * Features:
 *  • Add faculty with validation
 *  • Inline edit — click any row field to edit in place
 *  • Delete with custom confirmation modal
 *  • Search / filter by name or subject
 *  • Beautiful dark academic UI matching TimeTable Studio
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import API from "../services/api";
import OCRTableUpload from "../components/OCRTableUpload";
import QuickReset from "../components/QuickReset";

// Auto scroll to top
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

/* ── inject fonts once ── */
const injectFonts = () => {
  if (document.getElementById("fac-fonts")) return;
  const l = document.createElement("link");
  l.id = "fac-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(l);

  const s = document.createElement("style");
  s.textContent = `
    @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
    .fac-row { transition: background 0.15s; }
    .fac-row:hover { background: rgba(255,255,255,0.04) !important; }
    .fac-btn:hover { transform: translateY(-1px); filter: brightness(1.12); }
    .fac-input:focus { border-color: rgba(234,179,8,0.5) !important; outline: none; }
  `;
  document.head.appendChild(s);
};

export default function Faculty() {
  injectFonts();
  useScrollToTop();

  const isAdmin = localStorage.getItem("userRole") === "coordinator"; // coordinators manage their own dept+cluster data
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [stage, setStage] = useState("confirm");
  const [faculty, setFaculty] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  /* add form */
  const [form, setForm] = useState({ name: "", designation: "", subjects: "", workload: "", labs: "", email: "", phone: "", department_id: me.department_id ?? "", cluster: me.cluster ?? "" });
  const [formErr, setFormErr] = useState({});

  /* delete modal */
  const [deleteModal, setDeleteModal] = useState(null); // { id, name }

  /* OCR import modal */
  const [showOCR, setShowOCR] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [departments, setDepartments] = useState([]);

  /* inline edit */
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState("");

  /* ── helpers ── */
  const toast$ = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── load ── */
  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("/faculty");
      setFaculty(res.data || []);
    } catch (err) {
      console.error("Load Error:", err);
      toast$("Failed to load faculty list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    API.get("/departments").then(r => setDepartments(r.data || [])).catch(() => { });
  }, []);

  /* ── filtered list ── */
  const filtered = faculty.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.subjects?.toLowerCase().includes(search.toLowerCase()) ||
    f.designation?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── validate form ── */
  const validate = () => {
    const err = {};
    if (!form.name.trim()) err.name = "Required";
    if (!form.department_id) err.department_id = "Required";
    if (!form.cluster || Number(form.cluster) < 1) err.cluster = "Required";
    if (!form.designation.trim()) err.designation = "Required";
    if (!form.subjects.trim()) err.subjects = "Required";
    if (!form.workload) err.workload = "Required";
    else if (isNaN(form.workload) || Number(form.workload) < 1)
      err.workload = "Must be a positive number";
    setFormErr(err);
    return Object.keys(err).length === 0;
  };

  /* ── add ── */
  const addFaculty = async () => {
    if (!validate()) return;
    try {
      const res = await API.post("/faculty", {
        name: form.name.trim(),
        designation: form.designation.trim(),
        subjects: form.subjects.trim(),
        workload: Number(form.workload),
        labs: form.labs.trim() || null,
        email: null,
        phone: null,
        department_id: Number(form.department_id),
        cluster: Number(form.cluster),
      });
      setFaculty(prev => [...prev, res.data]);
      setForm(p => ({ name: "", designation: "", subjects: "", workload: "", labs: "", email: "", phone: "", department_id: p.department_id, cluster: p.cluster }));
      setFormErr({});
      toast$(`✓ ${form.name} added successfully`);
    } catch (err) {
      console.error("Add Error:", err.response?.data);
      toast$(err.response?.data?.detail || "Error adding faculty", "error");
    }
  };

  /* ── delete ── */
  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, name } = deleteModal;
    setDeleteModal(null);
    try {
      await API.delete(`/faculty/${id}`);
      setFaculty(prev => prev.filter(f => f.id !== id));
      toast$(`✓ ${name} deleted`);
    } catch (err) {
      console.error("Delete Error:", err.response?.data);
      toast$(
        err.response?.status === 404
          ? `Faculty "${name}" not found in database`
          : err.response?.data?.detail || "Error deleting faculty",
        "error"
      );
    }
  };

  /* ── inline edit save ── */
  // ✅ savingRef guards against Enter-then-blur double-firing this function
  // for the same edit — removing the <input> on Enter (setEditingCell(null))
  // fires a native blur on it, which was calling this a second time while
  // the first save was still in flight.
  const savingRef = useRef(false);

  const saveInlineEdit = async (faculty_id, field) => {
    if (savingRef.current) return;
    const value = editValue.trim();
    setEditingCell(null);
    if (!value) return;

    const item = faculty.find(f => f.id === faculty_id);
    if (!item) return;

    const updated = {
      name: item.name,
      designation: item.designation,
      subjects: item.subjects,
      workload: item.workload,
      labs: item.labs,
      [field]: field === "workload" ? Number(value) : value,
    };

    savingRef.current = true;
    try {
      await API.put(`/faculty/${faculty_id}`, updated);
      setFaculty(prev => prev.map(f =>
        f.id === faculty_id ? { ...f, [field]: updated[field] } : f
      ));
      toast$("✓ Updated");
    } catch (err) {
      console.error("Update Error:", err.response?.data);
      toast$(err.response?.data?.detail || "Update failed", "error");
      load(); // revert on error
    } finally {
      savingRef.current = false;
    }
  };

  const patchFaculty = async (id, patch) => {
    try {
      await API.put(`/faculty/${id}`, patch);
      setFaculty(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
      toast$("✓ Updated");
    } catch (err) {
      toast$(err.response?.data?.detail || "Update failed", "error");
    }
  };

  /* ── styles ── */
  const inputSt = {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#F0EDE8",
    fontSize: "13px",
    fontFamily: "Sora, sans-serif",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const FIELDS = [
    { key: "name", label: "Full Name", placeholder: "e.g. Dr. Ravi Kumar", type: "text" },
    { key: "designation", label: "Designation", placeholder: "e.g. Professor", type: "text" },
    { key: "subjects", label: "Subjects", placeholder: "e.g. mc, ada, DBMS", type: "text" },
    { key: "workload", label: "Workload (hrs)", placeholder: "e.g. 18", type: "number" },
    { key: "labs", label: "Labs", placeholder: "e.g. DBMS Lab-A, Data Structures Lab-B", type: "text" },
  ];

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div style={{
      fontFamily: "Sora, sans-serif",
      background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)",
      minHeight: "100vh",
      color: "#F0EDE8",
      padding: "24px 32px 0",
    }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "12px 22px", borderRadius: "10px",
          fontWeight: "600", fontSize: "13px",
          background: toast.type === "error" ? "#DC2626" : "#059669",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "slideDown 0.3s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: "16px",
            padding: "28px 32px",
            textAlign: "center",
            minWidth: "300px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            animation: "slideDown 0.25s ease",
          }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>🗑️</div>
            <div style={{
              fontFamily: "Sora, sans-serif",
              fontSize: "16px", fontWeight: "700", color: "#F0EDE8",
              marginBottom: "8px",
            }}>Delete Faculty?</div>
            <div style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "20px" }}>
              <span style={{ color: "#EAB308", fontWeight: "600" }}>{deleteModal.name}</span>
              {" "}will be permanently removed.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="fac-btn"
                onClick={confirmDelete}
                style={{
                  padding: "8px 20px",
                  background: "linear-gradient(135deg,#DC2626,#B91C1C)",
                  color: "#fff", border: "none", borderRadius: "8px",
                  cursor: "pointer", fontWeight: "700", fontSize: "13px",
                  boxShadow: "0 4px 14px rgba(220,38,38,0.4)",
                  transition: "all 0.2s",
                }}>
                Delete
              </button>
              <button
                className="fac-btn"
                onClick={() => setDeleteModal(null)}
                style={{
                  padding: "8px 20px",
                  background: "rgba(255,255,255,0.06)",
                  color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px", cursor: "pointer",
                  fontWeight: "600", fontSize: "13px",
                  transition: "all 0.2s",
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{
            fontFamily: "Sora, sans-serif",
            fontSize: "22px", fontWeight: "700", color: "#F0EDE8",
            letterSpacing: "-0.3px",
          }}>
            Faculty Management
          </div>
          <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
            Add, edit and manage faculty members · {faculty.length} total
          </div>
        </div>

        <div style={{ display: isAdmin ? "flex" : "none", alignItems: "center", gap: "8px" }}>
          <button
            className="fac-btn"
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
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            📷 Import
          </button>
          <button
            className="fac-btn"
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
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {isAdmin && (<>
        {/* ── Add Faculty Card ── */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "20px 24px",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{
            fontFamily: "Sora, sans-serif",
            fontSize: "16px", fontWeight: "600", color: "#F0EDE8",
            marginBottom: "16px",
          }}>
            Add New Faculty
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "16px",
          }}>
            {FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{
                  fontSize: "10px", fontWeight: "700", color: "#64748B",
                  textTransform: "uppercase", letterSpacing: "1px",
                  display: "block", marginBottom: "6px",
                }}>{label}</label>
                <input
                  className="fac-input"
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => {
                    setForm(p => ({ ...p, [key]: e.target.value }));
                    if (formErr[key]) setFormErr(p => ({ ...p, [key]: "" }));
                  }}
                  onKeyDown={e => e.key === "Enter" && addFaculty()}
                  style={{
                    ...inputSt,
                    borderColor: formErr[key] ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.1)",
                  }}
                />
                {formErr[key] && (
                  <div style={{ fontSize: "11px", color: "#F87171", marginTop: "4px" }}>
                    {formErr[key]}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Department</label>
              <select className="fac-input" disabled value={form.department_id}
                onChange={e => { setForm(p => ({ ...p, department_id: e.target.value })); if (formErr.department_id) setFormErr(p => ({ ...p, department_id: "" })); }}
                style={{ ...inputSt, borderColor: formErr.department_id ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.1)" }}>
                <option value="" style={{ background: "#0F172A" }}>— Select —</option>
                {departments.map(d => <option key={d.id} value={d.id} style={{ background: "#0F172A" }}>{d.code} — {d.name}</option>)}
              </select>
              {formErr.department_id && <div style={{ fontSize: "11px", color: "#F87171", marginTop: "4px" }}>{formErr.department_id}</div>}
            </div>
            <div>
              <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: "6px" }}>Cluster No.</label>
              <input className="fac-input" disabled type="number" min="1" placeholder="e.g. 1" value={form.cluster}
                onChange={e => { setForm(p => ({ ...p, cluster: e.target.value })); if (formErr.cluster) setFormErr(p => ({ ...p, cluster: "" })); }}
                style={{ ...inputSt, borderColor: formErr.cluster ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.1)" }} />
              {formErr.cluster && <div style={{ fontSize: "11px", color: "#F87171", marginTop: "4px" }}>{formErr.cluster}</div>}
            </div>
          </div>

          <button
            className="fac-btn"
            onClick={addFaculty}
            style={{
              padding: "8px 16px",
              background: "#EAB308",
              color: "#0A0C12", border: "none", borderRadius: "8px",
              cursor: "pointer", fontWeight: "700", fontSize: "12px",
              boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
              transition: "all 0.2s",
            }}>
            Add Faculty
          </button>
        </div>

      </>)}

      {/* ── Faculty List Card ── */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}>

        {/* Card header + search */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "12px",
        }}>
          <div style={{
            fontFamily: "Sora, sans-serif",
            fontSize: "16px", fontWeight: "600", color: "#F0EDE8",
          }}>
            Faculty List
            <span style={{
              marginLeft: "10px", fontSize: "12px",
              background: "rgba(234,179,8,0.15)", color: "#EAB308",
              padding: "2px 10px", borderRadius: "20px", fontFamily: "Sora, sans-serif",
              fontWeight: "600",
            }}>{faculty.length}</span>
          </div>

          {/* Search */}
          <input
            className="fac-input"
            placeholder="🔍 Search by name, subject or designation…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...inputSt,
              width: "280px",
              background: "rgba(255,255,255,0.04)",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "Name", "Designation", "Subjects", "Workload", "Labs", "Dept", "Cluster", "Action"].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    color: "#64748B", fontWeight: "700",
                    fontSize: "10px", textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                    {search ? `No results for "${search}"` : "No faculty added yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((f, idx) => (
                  <tr key={f.id} className="fac-row" style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    {/* Index */}
                    <td style={{ padding: "10px 14px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                      {idx + 1}
                    </td>

                    {/* Editable fields */}
                    {["name", "designation", "subjects", "workload", "labs"].map(field => (
                      <td key={field} style={{ padding: "10px 14px" }}
                        onClick={() => {
                          if (isAdmin) setEditingCell({ id: f.id, field });
                          setEditValue(String(f[field] || ""));
                        }}>
                        {editingCell?.id === f.id && editingCell?.field === field ? (
                          <input
                            autoFocus
                            type={field === "workload" ? "number" : "text"}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveInlineEdit(f.id, field)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveInlineEdit(f.id, field);
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            style={{
                              ...inputSt,
                              width: "100%", padding: "5px 8px",
                              fontSize: "13px",
                              borderColor: "rgba(234,179,8,0.5)",
                            }}
                          />
                        ) : (
                          <div style={{
                            cursor: "text",
                            color: field === "name" ? "#F0EDE8" : "#94A3B8",
                            fontWeight: field === "name" ? "600" : "400",
                            fontFamily: field === "subjects" ? "'JetBrains Mono', monospace" : "inherit",
                            fontSize: field === "subjects" ? "12px" : "13px",
                            borderBottom: "1px dashed rgba(255,255,255,0.08)",
                            paddingBottom: "2px",
                            display: "inline-block",
                          }}
                            title="Click to edit"
                          >
                            {field === "subjects" || field === "labs"
                              ? (f[field]?.split(",").map(s => s.trim()).filter(Boolean).map((s, i) => (
                                <span key={i} style={{
                                  display: "inline-block",
                                  background: field === "labs" ? "rgba(234,179,8,0.15)" : "rgba(129,140,248,0.15)",
                                  color: field === "labs" ? "#EAB308" : "#818CF8",
                                  borderRadius: "4px",
                                  padding: "1px 7px",
                                  marginRight: "4px",
                                  marginBottom: "2px",
                                  fontSize: "11px",
                                  fontWeight: "600",
                                }}>{s}</span>
                              )) || "—")
                              : f[field] || "—"}
                          </div>
                        )}
                      </td>
                    ))}

                    {/* Department */}
                    <td style={{ padding: "10px 14px" }}>
                      <select disabled value={f.department_id ?? ""}
                        onChange={e => patchFaculty(f.id, { department_id: Number(e.target.value) })}
                        style={{ ...inputSt, width: "90px", padding: "5px 8px" }}>
                        <option value="" disabled style={{ background: "#0F172A" }}>—</option>
                        {departments.map(d => <option key={d.id} value={d.id} style={{ background: "#0F172A" }}>{d.code}</option>)}
                      </select>
                    </td>

                    {/* Cluster */}
                    <td style={{ padding: "10px 14px" }}>
                      <input disabled type="number" min="1" key={`${f.id}-${f.cluster}`} defaultValue={f.cluster ?? ""}
                        onBlur={e => { const v = Number(e.target.value); if (v >= 1 && v !== f.cluster) patchFaculty(f.id, { cluster: v }); }}
                        style={{ ...inputSt, width: "70px", padding: "5px 8px" }} />
                    </td>

                    {/* Action */}
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        className="fac-btn"
                        onClick={() => setDeleteModal({ id: f.id, name: f.name })}
                        style={{
                          display: isAdmin ? "inline-block" : "none",
                          padding: "6px 14px",
                          background: "rgba(220,38,38,0.12)",
                          color: "#F87171",
                          border: "1px solid rgba(220,38,38,0.25)",
                          borderRadius: "6px", cursor: "pointer",
                          fontWeight: "600", fontSize: "12px",
                          transition: "all 0.2s",
                        }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        {filtered.length > 0 && (
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            fontSize: "11px", color: "#4B5563",
          }}>
            💡 Click any cell to edit inline · Press Enter to save · Esc to cancel
          </div>
        )}
      </div>

      {/* OCR Import Modal */}
      {showOCR && (
        <OCRTableUpload
          target="faculty"
          onClose={() => setShowOCR(false)}
          onImported={() => load()}
        />
      )}

      {/* Quick Reset Modal */}
      {showReset && (
        <QuickReset
          target="faculty"
          onComplete={() => {
            setShowReset(false);
            load();
          }}
        />
      )}

      {/* ── Navigation Buttons — corner arrows, matches Structure page ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '20px 0 24px',
        gap: '20px'
      }}>
        <button
          className="fac-btn"
          onClick={() => window.location.href = '/structure'}
          title="Previous: Structure"
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
            fontFamily: "Sora, sans-serif",
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ←
        </button>

        <button
          className="fac-btn"
          onClick={() => window.location.href = '/subjects'}
          title="Next: Subjects"
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
            fontFamily: "Sora, sans-serif",
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