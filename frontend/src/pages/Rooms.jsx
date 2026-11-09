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

const typeColor = (t) => {
  if (!t) return "#818CF8";
  const u = t.toUpperCase();
  if (u.includes("LAB")) return "#10B981";
  if (u.includes("CLASS")) return "#0EA5E9";
  return "#EAB308";
};

export default function Rooms() {
  useScrollToTop();  // ✅ ADD THIS LINE

  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("");
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [deleteModal, setDeleteModal] = useState(null);
  const isAdmin = localStorage.getItem("userRole") === "coordinator"; // coordinators manage their own dept+cluster data
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [editingCell, setEditingCellRaw] = useState(null); // { id, field }
  const setEditingCell = (v) => { if (isAdmin) setEditingCellRaw(v); };
  const [editValue, setEditValue] = useState("");
  const [showOCR, setShowOCR] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    try { const r = await API.get("/rooms"); setRooms(r.data || []); }
    catch { showToast("Failed to load rooms", "error"); }
  };

  useEffect(() => { load(); }, []);

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Required";
    if (!type.trim()) e.type = "Required";
    if (!capacity || isNaN(capacity) || Number(capacity) <= 0) e.capacity = "Enter valid number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addRoom = async () => {
    if (!validate()) return;
    try {
      const r = await API.post("/rooms", { room_name: name.trim(), room_type: type.trim().toUpperCase(), capacity: Number(capacity) });
      setRooms(p => [...p, r.data]);
      setName(""); setType(""); setCapacity(""); setErrors({});
      showToast(`Room "${name}" added`);
    } catch (err) { showToast(err.response?.data?.detail || "Failed to add", "error"); }
  };

  //  ✅ Click-any-cell inline editing, same pattern as Labs.jsx —
  // no separate Edit button. Builds the full payload from the existing
  // room plus the one field being changed, then PUTs it.
  const saveInlineEdit = async (roomId, field, valueOverride) => {
    const value = valueOverride !== undefined ? valueOverride : editValue;
    setEditingCell(null);

    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    if (field === "name" && !String(value).trim()) { showToast("Room name cannot be empty", "error"); return; }
    if (field === "type" && !String(value).trim()) { showToast("Room type cannot be empty", "error"); return; }
    if (field === "capacity" && (!value || isNaN(value) || Number(value) <= 0)) { showToast("Enter a valid capacity", "error"); return; }

    const payload = {
      room_name: field === "name" ? value.trim() : room.room_name,
      room_type: field === "type" ? value.trim().toUpperCase() : room.room_type,
      capacity: field === "capacity" ? Number(value) : room.capacity,
    };

    try {
      await API.put(`/rooms/${roomId}`, payload);
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...payload } : r));
      showToast("Room updated");
    } catch (err) {
      showToast(err.response?.data?.detail || "Update failed", "error");
      load();
    }
  };

  const deleteRoom = async () => {
    if (!deleteModal) return;
    try {
      await API.delete(`/rooms/${deleteModal.id}`);
      setRooms(p => p.filter(r => r.id !== deleteModal.id));
      showToast(`Room "${deleteModal.room_name}" deleted`); setDeleteModal(null);
    } catch (err) { showToast(err.response?.data?.detail || "Delete failed", "error"); setDeleteModal(null); }
  };

  const filtered = rooms.filter(r =>
    r.room_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.room_type?.toLowerCase().includes(search.toLowerCase())
  );

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    .rp{min-height:100vh;background:linear-gradient(135deg, #080C14 0%, #0F172A 100%);font-family:'Sora',sans-serif;padding:24px 32px 0;color:#F0EDE8}
    .rp-hd{margin-bottom:20px}
    .rp-hd h1{font-family:'Sora',sans-serif;font-size:22px;font-weight:700;color:#F0EDE8;letter-spacing:-0.3px}
    .rp-hd p{color:#94A3B8;font-size:13px;margin-top:4px;font-family:'Sora',sans-serif}
    .gc{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
    .ct{font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:#F0EDE8;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .fg{display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:14px}
    @media(max-width:700px){.fg{grid-template-columns:1fr}}
    .fw{display:flex;flex-direction:column;gap:5px}
    .fl{font-size:10px;font-family:'Sora',sans-serif;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px}
    .fi{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;transition:border-color .2s;width:100%}
    .fi:focus{border-color:#EAB308;box-shadow:0 0 0 3px rgba(234,179,8,.12)}
    .fi.err{border-color:#EF4444}
    .fe{font-size:11px;color:#F87171;font-family:'Sora',sans-serif}
    .tsel{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:100%;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2364748B' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:18px;padding-right:32px}
    .tsel:focus{border-color:#EAB308}
    .tsel option{background:#0F172A}
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
    .rnc{display:flex;align-items:center;gap:9px}
    .ri{font-size:1.05rem}
    .rm{font-weight:600;color:#F0EDE8}
    .tb{font-family:'JetBrains Mono',monospace;font-size:11px;padding:3px 9px;border-radius:6px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    .cpb{font-family:'JetBrains Mono',monospace;font-size:12px;color:#94A3B8;background:rgba(255,255,255,.06);padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.08)}
    .acts{display:flex;gap:6px;justify-content:flex-end}
    .be{background:rgba(129,140,248,.12);border:1px solid rgba(129,140,248,.3);color:#818CF8;padding:5px 13px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer}
    .be:hover{background:rgba(129,140,248,.22)}
    .bd{background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.25);color:#F87171;padding:5px 13px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer}
    .bd:hover{background:rgba(220,38,38,.25)}
    .edit-input{background:rgba(255,255,255,.07);border:1px solid rgba(234,179,8,.4);border-radius:7px;padding:6px 10px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:100%}
    .edit-sel{background:rgba(255,255,255,.07);border:1px solid rgba(234,179,8,.4);border-radius:7px;padding:6px 10px;color:#F0EDE8;font-size:13px;font-family:'Sora',sans-serif;outline:none;width:100%}
    .edit-sel option{background:#0F172A}
    .bs{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#34D399;padding:5px 13px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer}
    .bc{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#94A3B8;padding:5px 13px;border-radius:6px;font-size:12px;font-family:'Sora',sans-serif;cursor:pointer}
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
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>
      <div className="rp">

        <div className="rp-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1>Room Management</h1>
            <p style={{ margin: 0 }}>Add, edit and manage rooms · {rooms.length} total</p>
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

        <div className="gc" style={{ display: isAdmin ? undefined : "none" }}>
          <div className="ct">Add New Room</div>
          <div className="fg">
            <div className="fw">
              <label className="fl">Room Name</label>
              <input className={`fi${errors.name ? " err" : ""}`} placeholder="e.g. SIE ALB" value={name} onChange={e => { setName(e.target.value); setErrors({}); }} />
              {errors.name && <span className="fe">{errors.name}</span>}
            </div>
            <div className="fw">
              <label className="fl">Room Type</label>
              <select className={`tsel${errors.type ? " err" : ""}`} value={type} onChange={e => { setType(e.target.value); setErrors({}); }}>
                <option value="">Select type...</option>
                <option value="CLASS">CLASS</option>
                <option value="LAB">LAB</option>
                <option value="SEMINAR">SEMINAR</option>
              </select>
              {errors.type && <span className="fe">{errors.type}</span>}
            </div>
            <div className="fw">
              <label className="fl">Capacity</label>
              <input className={`fi${errors.capacity ? " err" : ""}`} placeholder="e.g. 75" type="number" min="1" value={capacity} onChange={e => { setCapacity(e.target.value); setErrors({}); }} />
              {errors.capacity && <span className="fe">{errors.capacity}</span>}
            </div>
          </div>
          <button className="ba" onClick={addRoom}>Add Room</button>
        </div>

        <div className="gc">
          <div className="lh">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="lt">Rooms List</span>
                <span className="cb">{filtered.length}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>💡 Click any cell to edit inline</div>
            </div>
            <input className="si" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.length === 0 ? (
            <div className="es"><div className="ei">🏫</div><p>{search ? "No match" : "No rooms yet"}</p></div>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Room</th><th>Type</th><th>Capacity</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}>
                    <td className="rn">{i + 1}</td>

                    {/* Room Name — click to edit */}
                    <td onClick={() => { setEditingCell({ id: r.id, field: "name" }); setEditValue(r.room_name); }}>
                      {editingCell?.id === r.id && editingCell?.field === "name" ? (
                        <input
                          autoFocus className="edit-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(r.id, "name")}
                          onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(r.id, "name"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        <div className="rnc" style={{ cursor: "text" }} title="Click to edit">
                          <span className="ri">{r.room_type?.toUpperCase().includes("LAB") ? "🔬" : "🏛️"}</span>
                          <span className="rm">{r.room_name}</span>
                        </div>
                      )}
                    </td>

                    {/* Room Type — click to edit */}
                    <td onClick={() => { setEditingCell({ id: r.id, field: "type" }); setEditValue(r.room_type); }}>
                      {editingCell?.id === r.id && editingCell?.field === "type" ? (
                        <select
                          autoFocus className="edit-sel"
                          value={editValue}
                          onChange={e => saveInlineEdit(r.id, "type", e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        >
                          <option value="CLASS">CLASS</option>
                          <option value="LAB">LAB</option>
                          <option value="SEMINAR">SEMINAR</option>
                        </select>
                      ) : (
                        <span className="tb" style={{ background: `${typeColor(r.room_type)}20`, color: typeColor(r.room_type), border: `1px solid ${typeColor(r.room_type)}40`, cursor: "pointer" }} title="Click to edit">{r.room_type}</span>
                      )}
                    </td>

                    {/* Capacity — click to edit */}
                    <td onClick={() => { setEditingCell({ id: r.id, field: "capacity" }); setEditValue(String(r.capacity)); }}>
                      {editingCell?.id === r.id && editingCell?.field === "capacity" ? (
                        <input
                          autoFocus className="edit-input" type="number" min="1" style={{ width: 72 }}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(r.id, "capacity")}
                          onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(r.id, "capacity"); if (e.key === "Escape") setEditingCell(null); }}
                        />
                      ) : (
                        <span className="cpb" style={{ cursor: "text" }} title="Click to edit">👥 {r.capacity}</span>
                      )}
                    </td>

                    {/* Actions — Delete only, no Edit button */}
                    <td><div className="acts">
                      <button className="bd" style={{ display: isAdmin ? undefined : "none" }} onClick={() => setDeleteModal(r)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Navigation Buttons — corner arrows, matches Faculty/Subjects/Labs ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '20px 0 24px',
          gap: '20px'
        }}>
          <button
            onClick={() => window.location.href = '/labs'}
            title="Previous: Labs"
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
            onClick={() => window.location.href = '/sections'}
            title="Next: Sections"
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

      {deleteModal && (
        <div className="mo"><div className="mb">
          <div className="mi">🗑️</div>
          <div className="mt">Delete Room?</div>
          <div className="md">Delete <span className="mn">"{deleteModal.room_name}"</span>? This cannot be undone.</div>
          <div className="ma">
            <button className="bca" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="bda" onClick={deleteRoom}>Yes, Delete</button>
          </div>
        </div></div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* OCR Import Modal */}
      {showOCR && (
        <OCRTableUpload
          target="rooms"
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
          target="rooms"
          onComplete={() => {
            setShowReset(false);
            load(); // or whatever your load function is called
          }}
        />
      )}
    </>
  );
}