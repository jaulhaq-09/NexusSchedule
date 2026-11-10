import React, { useState, useEffect } from "react";
import API from "../services/api";
import OCRTableUpload from "../components/OCRTableUpload";
import { useLocation } from "react-router-dom";

const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

const BATCH_OPTIONS = [
  { value: "", label: "No Batch (Whole Class)" },
  { value: "A", label: "Batch 1" },
  { value: "B", label: "Batch 2" },
];

const inputSt = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#F0EDE8",
  fontSize: "13px",
  outline: "none",
  fontFamily: "Sora, sans-serif",
  boxSizing: "border-box",
};

const selectSt = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(234,179,8,0.3)",
  fontSize: "13px",
  background: "rgba(255,255,255,0.05)",
  color: "#EAB308",
  cursor: "pointer",
  outline: "none",
  fontFamily: "Sora, sans-serif",
  fontWeight: "500",
  width: "100%",
  boxSizing: "border-box",
};

const labelSt = {
  fontSize: "10px",
  color: "#64748B",
  display: "block",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: "700",
};

const injectFonts = () => {
  if (document.getElementById("labs-fonts")) return;
  const l = document.createElement("link");
  l.id = "labs-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(l);
  const s = document.createElement("style");
  s.textContent = `
    @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .labs-select option { background:#0F172A !important; color:#F0EDE8 !important; padding:8px !important; font-family:'Sora',sans-serif !important; font-size:13px !important; }
    .labs-select option:checked { background:rgba(234,179,8,0.25) !important; color:#EAB308 !important; font-weight:600 !important; }
    .labs-select:focus { border-color:#EAB308 !important; box-shadow:0 0 0 3px rgba(234,179,8,0.15) !important; outline:none !important; }
  `;
  document.head.appendChild(s);
};

export default function Labs() {
  useScrollToTop();
  injectFonts();

  const [labs, setLabs] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [newLab, setNewLab] = useState({
    lab_name: "",
    lab_code: "",
    hours_per_week: 2,
    room_id: "",
  });
  const [newLabErr, setNewLabErr] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  // ✅ NEW: click-any-cell inline editing, same pattern as Subjects.jsx —
  // no separate Edit button.
  const isAdmin = localStorage.getItem("userRole") === "coordinator"; // coordinators manage their own dept+cluster data
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [editingCell, setEditingCellRaw] = useState(null); // { id, field }
  const setEditingCell = (v) => { if (isAdmin) setEditingCellRaw(v); };
  const [editValue, setEditValue] = useState("");

  // ✅ NEW: Quick Reset now requires confirmation, same modal pattern as
  // Faculty.jsx's delete confirmation.
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchFaculty();
    fetchLabs();
    fetchRooms();
  }, []);

  const fetchFaculty = async () => {
    try {
      const res = await API.get("/faculty");
      setFacultyList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch faculty:", err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await API.get("/rooms");
      setRooms(res.data || []);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    }
  };

  const fetchLabs = async () => {
    try {
      const res = await API.get("/labs/");
      setLabs(res.data || []);
    } catch (err) {
      console.error("Failed to load labs:", err);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ✅ Faculty is purely derived from the backend response's faculty_names —
  // a faculty typed this lab's exact name into their own "Labs" field on
  // the Faculty page. Displayed as initials (title stripped), same logic
  // as TimetableConfig.jsx's initialsOf(), for a compact consistent look.
  const initialsOf = (fullName) => {
    const cleaned = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, "").trim();
    return cleaned.split(/\s+/).map(w => w[0]).join("").toUpperCase();
  };

  const getFacNames = (names) => (names && names.length > 0) ? names.map(initialsOf).join("/") : "—";

  const handleAdd = async () => {
    const name = newLab.lab_name.trim();
    if (!name) {
      setNewLabErr("Lab name is required");
      return;
    }

    try {
      await API.post("/labs/", {
        lab_name: name,
        lab_code: newLab.lab_code.trim().toUpperCase() || null,
        hours_per_week: parseInt(newLab.hours_per_week) || 2,
        room_id: newLab.room_id ? parseInt(newLab.room_id) : null,
      });

      setNewLab({ lab_name: "", lab_code: "", hours_per_week: 2, room_id: "" });
      setNewLabErr("");
      fetchLabs();
      showToast(`✓ Lab "${name}" added successfully`);
    } catch (err) {
      console.error("Failed to add lab:", err);
      setNewLabErr("Failed to add lab");
    }
  };

  // ✅ NEW: single-field inline save, mirrors Subjects.jsx's saveInlineEdit.
  // Accepts an optional explicit value (used by <select> fields, whose
  // onChange fires before React state updates) so we don't read stale state.
  const saveInlineEdit = async (labId, field, valueOverride) => {
    const value = valueOverride !== undefined ? valueOverride : editValue;
    setEditingCell(null);

    const lab = labs.find(l => l.id === labId);
    if (!lab) return;

    if (field === "lab_name" && !String(value).trim()) { showToast("Lab name cannot be empty", "error"); return; }

    const payload = {
      lab_name: field === "lab_name" ? value.trim() : lab.lab_name,
      lab_code: field === "lab_code" ? (value.trim().toUpperCase() || null) : (lab.lab_code || null),
      batch: field === "batch" ? (value || null) : (lab.batch || null),
      hours_per_week: field === "hours_per_week" ? (parseInt(value) || 2) : lab.hours_per_week,
      room_id: field === "room_id" ? (value ? parseInt(value) : null) : (lab.room_id || null),
    };

    try {
      await API.put(`/labs/${labId}`, payload);
      // ✅ The backend derives room_name from room_id (resolved against
      // the Rooms table) — payload only carries room_id, so without this
      // the local optimistic update would leave the displayed room_name
      // stale until a full refetch.
      const resolvedRoomName = field === "room_id"
        ? (rooms.find(r => String(r.id) === String(payload.room_id))?.room_name || null)
        : lab.room_name;
      setLabs(prev => prev.map(l => l.id === labId ? { ...l, ...payload, room_name: resolvedRoomName } : l));
      showToast("✓ Lab updated");
    } catch (err) {
      console.error("Failed to update lab:", err);
      showToast("Update failed", "error");
      fetchLabs();
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await API.delete(`/labs/${id}`);
      fetchLabs();
      showToast(`"${name}" deleted`);
    } catch (err) {
      console.error("Failed to delete lab:", err);
      showToast("Delete failed", "error");
    }
  };

  const confirmQuickReset = async () => {
    setResetting(true);
    try {
      const response = await API.delete("/labs/reset-all");
      await fetchLabs();
      showToast(`All labs deleted (${response.data.deleted})`);
    } catch (err) {
      console.error("Failed to reset:", err);
      showToast(err.response?.data?.detail || "Reset failed", "error");
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  const filtered = labs.filter(
    (l) =>
      (l.lab_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.lab_code || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "Sora, sans-serif", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", minHeight: "100vh", color: "#F0EDE8", padding: "24px 32px 0" }}>
      {toast && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, padding: "12px 22px", borderRadius: "10px", fontWeight: "600", fontSize: "13px", background: toast.type === "error" ? "#DC2626" : "#059669", color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "slideDown 0.3s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Quick Reset Confirmation Modal ── */}
      {showResetConfirm && (
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
            <div style={{ fontSize: "16px", fontWeight: "700", color: "#F0EDE8", marginBottom: "8px" }}>Reset All Labs?</div>
            <div style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "20px" }}>
              All <span style={{ color: "#EAB308", fontWeight: "600" }}>{labs.length}</span> lab{labs.length !== 1 ? "s" : ""} will be permanently deleted. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={confirmQuickReset}
                disabled={resetting}
                style={{
                  padding: "8px 20px",
                  background: "linear-gradient(135deg,#DC2626,#B91C1C)",
                  color: "#fff", border: "none", borderRadius: "8px",
                  cursor: resetting ? "not-allowed" : "pointer", fontWeight: "700", fontSize: "13px",
                  boxShadow: "0 4px 14px rgba(220,38,38,0.4)",
                }}>
                {resetting ? "Deleting…" : "Yes, Reset All"}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                style={{
                  padding: "8px 20px",
                  background: "rgba(255,255,255,0.06)",
                  color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px", cursor: "pointer",
                  fontWeight: "600", fontSize: "13px",
                }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#F0EDE8", letterSpacing: "-0.3px" }}>
            Laboratory Management
          </div>
          <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
            Add, edit and manage laboratories · {labs.length} total
          </div>
        </div>
        <div style={{ display: isAdmin ? "flex" : "none", gap: "8px" }}>
          <button onClick={() => setShowImportModal(true)} style={{ padding: "6px 12px", background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "11px", fontFamily: "Sora, sans-serif", whiteSpace: "nowrap" }}>
            📸 Import
          </button>
          <button onClick={() => setShowResetConfirm(true)} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.15)", color: "#F87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "11px", fontFamily: "Sora, sans-serif", whiteSpace: "nowrap" }}>
            🗑 Reset
          </button>
        </div>
      </div>

      <div style={{
        display: isAdmin ? "block" : "none",
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "#F0EDE8", marginBottom: "16px" }}>
          Add New Laboratory
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "16px" }}>
          <div>
            <div style={labelSt}>Lab Name *</div>
            <input style={{ ...inputSt, borderColor: newLabErr ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)" }} placeholder="e.g. DBMS Lab-A" value={newLab.lab_name} onChange={(e) => { setNewLab((p) => ({ ...p, lab_name: e.target.value })); setNewLabErr(""); }} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            {newLabErr && <div style={{ fontSize: "10px", color: "#F87171", marginTop: "4px" }}>{newLabErr}</div>}
          </div>

          <div>
            <div style={labelSt}>Lab Code <span style={{ color: "#EAB308", fontSize: "9px" }}>(e.g. BCS483L)</span></div>
            <input style={inputSt} placeholder="e.g. DBMSL" value={newLab.lab_code} onChange={(e) => setNewLab((p) => ({ ...p, lab_code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <div style={labelSt}>Hrs/Week</div>
            <input type="number" min="1" max="10" style={{ ...inputSt, textAlign: "center" }} value={newLab.hours_per_week} onChange={(e) => setNewLab((p) => ({ ...p, hours_per_week: e.target.value }))} />
          </div>
          <div>
            <div style={labelSt}>Room</div>
            <select className="labs-select" style={selectSt} value={newLab.room_id} onChange={(e) => setNewLab((p) => ({ ...p, room_id: e.target.value }))}>
              <option value="">— No Room —</option>
              {rooms.filter(r => (r.room_type || "").toUpperCase() === "LAB").map(r => <option key={r.id} value={String(r.id)}>{r.room_name}</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleAdd} style={{ padding: "8px 16px", background: "#EAB308", color: "#0A0C12", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "12px", fontFamily: "Sora, sans-serif", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(234,179,8,0.3)" }}>
          Add Lab
        </button>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <input type="text" placeholder="🔍 Search labs by name or code…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputSt, maxWidth: "400px" }} />
        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "6px" }}>
          Showing {filtered.length} of {labs.length} lab{labs.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        overflow: "hidden",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#F0EDE8" }}>
              Configured Labs
            </div>
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>
              💡 Click any cell to edit inline
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
            {labs.length} lab{labs.length !== 1 ? "s" : ""} total
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "Lab Name", "Code", "Hrs/Wk", "Room", "Units", "Faculty", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "12px", opacity: 0.3 }}>🔬</div>
                    <div style={{ fontSize: "14px", color: "#94A3B8" }}>
                      {searchTerm ? "No labs match your search" : "No labs configured yet — add one above!"}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lab, idx) => {
                  return (
                    <tr key={lab.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px 14px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>{idx + 1}</td>

                      {/* Lab Name — click to edit */}
                      <td style={{ padding: "10px 14px" }} onClick={() => { setEditingCell({ id: lab.id, field: "lab_name" }); setEditValue(lab.lab_name); }}>
                        {editingCell?.id === lab.id && editingCell?.field === "lab_name" ? (
                          <input
                            autoFocus style={{ ...inputSt, width: "150px" }}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveInlineEdit(lab.id, "lab_name")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(lab.id, "lab_name"); if (e.key === "Escape") setEditingCell(null); }}
                          />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "text" }} title="Click to edit">
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EAB308" }} />
                            <span style={{ fontWeight: "600", color: "#F0EDE8" }}>{lab.lab_name}</span>
                            <span style={{ fontSize: "9px", background: "rgba(234,179,8,0.15)", color: "#EAB308", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>LAB</span>
                          </div>
                        )}
                      </td>

                      {/* Code — click to edit */}
                      <td style={{ padding: "10px 14px" }} onClick={() => { setEditingCell({ id: lab.id, field: "lab_code" }); setEditValue(lab.lab_code || ""); }}>
                        {editingCell?.id === lab.id && editingCell?.field === "lab_code" ? (
                          <input
                            autoFocus style={{ ...inputSt, width: "90px" }} placeholder="MCL"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                            onBlur={() => saveInlineEdit(lab.id, "lab_code")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(lab.id, "lab_code"); if (e.key === "Escape") setEditingCell(null); }}
                          />
                        ) : (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)", cursor: "text" }} title="Click to edit">{lab.lab_code || "—"}</span>
                        )}
                      </td>

                      {/* Hrs/Wk — click to edit */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }} onClick={() => { setEditingCell({ id: lab.id, field: "hours_per_week" }); setEditValue(String(lab.hours_per_week)); }}>
                        {editingCell?.id === lab.id && editingCell?.field === "hours_per_week" ? (
                          <input
                            autoFocus type="number" min="1" max="10" style={{ ...inputSt, width: "60px", textAlign: "center" }}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveInlineEdit(lab.id, "hours_per_week")}
                            onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(lab.id, "hours_per_week"); if (e.key === "Escape") setEditingCell(null); }}
                          />
                        ) : (
                          <span style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "text" }} title="Click to edit">{lab.hours_per_week}</span>
                        )}
                      </td>

                      {/* Room — click to edit, dropdown from the Rooms table */}
                      <td style={{ padding: "10px 14px" }}>
                        {editingCell?.id === lab.id && editingCell?.field === "room_id" ? (
                          <select
                            autoFocus className="labs-select" style={{ ...selectSt, width: "160px" }}
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); saveInlineEdit(lab.id, "room_id", e.target.value); }}
                            onBlur={() => setEditingCell(null)}
                          >
                            <option value="">— No Room —</option>
                            {rooms.filter(r => (r.room_type || "").toUpperCase() === "LAB").map(r => <option key={r.id} value={String(r.id)}>{r.room_name}</option>)}
                          </select>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              onClick={() => { setEditingCell({ id: lab.id, field: "room_id" }); setEditValue(lab.room_id ? String(lab.room_id) : ""); }}
                              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: lab.room_name ? "#94A3B8" : "#475569", fontStyle: lab.room_name ? "normal" : "italic", cursor: "text" }}
                              title="Click to edit"
                            >
                              {lab.room_name || "— set room —"}
                            </span>
                            {lab.room_name && (
                              <button
                                type="button"
                                onClick={() => isAdmin && saveInlineEdit(lab.id, "room_id", "")}
                                title="Clear room"
                                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer", fontSize: "10px", padding: 0, lineHeight: 1 }}
                              >✕</button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Units — derived, not editable */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>
                          {(lab.hours_per_week || 2) * 1}
                        </span>
                      </td>

                      {/* Faculty — read-only, auto-derived from each faculty's
                          own "Labs" field on the Faculty page. Shown as
                          initials (matches Timetable Config); hover for
                          full names. */}
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          title={(lab.faculty_names || []).length > 0 ? lab.faculty_names.join(", ") : "Assigned via each faculty's Labs field on the Faculty page"}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "11px", fontWeight: "600",
                            color: (lab.faculty_names || []).length === 0 ? "#475569" : "#EAB308",
                            fontStyle: (lab.faculty_names || []).length === 0 ? "italic" : "normal",
                            cursor: (lab.faculty_names || []).length > 0 ? "help" : "default",
                          }}
                        >
                          {getFacNames(lab.faculty_names)}
                        </span>
                      </td>

                      {/* Actions — Delete only, no Edit button */}
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => handleDelete(lab.id, lab.lab_name)}
                          style={{
                            display: isAdmin ? "inline-block" : "none", padding: "5px 12px", background: "rgba(220,38,38,0.12)",
                            border: "1px solid rgba(220,38,38,0.25)", color: "#F87171",
                            borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600",
                            fontFamily: "Sora, sans-serif", whiteSpace: "nowrap",
                          }}
                        >Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OCR Import Modal */}
      {showImportModal && (
        <OCRTableUpload
          target="labs"
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            fetchLabs();
            setShowImportModal(false);
          }}
        />
      )}

      {/* ── Navigation Buttons — corner arrows, matches Faculty/Subjects/Structure ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '20px 0 24px',
        gap: '20px'
      }}>
        <button
          onClick={() => window.location.href = '/subjects'}
          title="Previous: Subjects"
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
          onClick={() => window.location.href = '/rooms'}
          title="Next: Rooms"
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