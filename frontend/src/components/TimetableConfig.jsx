import React from "react";
import API, { updateFaculty } from "../services/api";

const NO_SPINNER_CSS = `
  .no-spinner::-webkit-outer-spin-button,
  .no-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .no-spinner {
    -moz-appearance: textfield;
  }
`;

const PALETTE = [
  "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#06B6D4",
  "#A78BFA", "#FB7185", "#34D399", "#FBBF24", "#60A5FA",
];

// ✅ Backs the per-lab "sticky candidate" set with localStorage instead of
// a plain in-memory ref, so a faculty who was assigned-then-removed stays
// pickable in that lab's dropdown across a full page refresh, not just
// within one mounted session.
const LAB_CANDIDATE_CACHE_KEY = "schedulo_lab_candidate_cache";
const loadLabCandidateCache = () => {
  try {
    const raw = localStorage.getItem(LAB_CANDIDATE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const saveLabCandidateCache = (cache) => {
  try {
    localStorage.setItem(LAB_CANDIDATE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
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
  fontFamily: "'Sora',sans-serif",
  fontWeight: "500",
};

const cardSt = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "14px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
};

// ✅ Matches Theory Faculty's own control: a plain native <select> used to
// ADD one faculty at a time, with already-assigned faculty shown as
// removable chips above it — no checkbox panel. `candidates` is sourced
// from each faculty's own "Labs" field (Faculty page), the same field
// toggleLabFaculty writes to, so read and write finally agree on one
// source of truth.
const LabFacultyAdd = ({ lab, candidates, assignedIds, labFacultySaving, toggleLabFaculty }) => {
  const assignedFacs = candidates.filter(f => assignedIds.includes(String(f.id || f._id)));
  const unassignedFacs = candidates.filter(f => !assignedIds.includes(String(f.id || f._id)));
  const busy = labFacultySaving !== null;

  return (
    <div>
      {assignedFacs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
          {assignedFacs.map(fac => {
            const facId = String(fac.id || fac._id);
            const saving = labFacultySaving === facId;
            return (
              <span key={facId} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "2px 6px 2px 10px", borderRadius: "12px", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", fontSize: "10px", opacity: saving ? 0.5 : 1 }}>
                {fac.name}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleLabFaculty(lab, fac, false)}
                  title="Remove from this lab"
                  style={{ background: "transparent", border: "none", color: "#EAB308", cursor: busy ? "not-allowed" : "pointer", fontSize: "10px", padding: 0, lineHeight: 1, fontWeight: "700" }}
                >✕</button>
              </span>
            );
          })}
        </div>
      )}
     <select
        value=""
        disabled={busy}
        onChange={e => {
          const facId = e.target.value;
          if (!facId) return;
          const fac = candidates.find(f => String(f.id || f._id) === facId);
          if (fac) toggleLabFaculty(lab, fac, true);
        }}
        style={{ ...selectSt, width: "100%", opacity: busy ? 0.6 : 1 }}
      >
        <option value="">{busy ? "Saving…" : "— Select Faculty —"}</option>
        {unassignedFacs.length > 0 ? (
          unassignedFacs.map(f => (
            <option key={f.id || f._id} value={String(f.id || f._id)}>{f.name}</option>
          ))
        ) : (
          <option value="" disabled>No faculty linked to this lab</option>
        )}
      </select>
    </div>
  );
};

export default function TimetableConfig({
  sections, selCluster, setSelCluster, selSemester, setSelSemester,
  filteredSections, selSectionId, setSelSectionId, selSection, savedList, conflicts,
  rooms, selRoomId, setSelRoomId, hdr, setHdr, facultyOptions,
  labConfig, selectedLabs, setSelectedLabs, updateLab, facultyList,
  subjectConfig, allSubjectConfig, selectedSubjects, setSelectedSubjects, updateConfig,
  pinnedSlots, setPinnedSlots, dragItem, setDragItem, dragOver, setDragOver,
  DAYS, SLOTS, openPinModal, clearPin,
  semesterType, setSemesterType,
  selectedPairs, setSelectedPairs,
  selfPairs, setSelfPairs,
  pairCopies, setPairCopies,
  refreshLabs,
  refreshFaculty,
}) {
  // ✅ paired_lab_name is stored as a comma-separated list of partner lab
  // names (e.g. "C++,DBMS"), so a lab can be paired with several other
  // labs simultaneously without one pairing overwriting another.
  const parsePartners = (str) => (str || "").split(",").map(s => s.trim()).filter(Boolean);
  const joinPartners = (arr) => Array.from(new Set(arr.filter(Boolean))).join(",");

  const [batch1LabSel, setBatch1LabSel] = React.useState("");
  const [batch2LabSel, setBatch2LabSel] = React.useState("");
  const [showBatch1, setShowBatch1] = React.useState(false);
  const [showBatch2, setShowBatch2] = React.useState(false);

  const applyPairing = async () => {
    if (!batch1LabSel || !batch2LabSel) return;
    if (batch1LabSel === batch2LabSel) {
      // ✅ Self-pair path — display-only, no API call, no pairedLabName
      // change. Existing cross-lab pairing logic below is untouched.
      const key = batch1LabSel + "/" + batch2LabSel;
      setSelfPairs(prev => new Set(prev).add(key));
      setSelectedPairs(prev => new Set(prev).add(key));
      setBatch1LabSel("");
      setBatch2LabSel("");
      return;
    }
    const labA = labConfig.find(l => l.name === batch1LabSel);
    const labB = labConfig.find(l => l.name === batch2LabSel);
    if (!labA || !labB) return;

    // ✅ Additive — adds each lab to the other's partner list WITHOUT
    // removing any existing partners, so PY↔C++ and PY↔DBMS can coexist.
    const labAPartners = parsePartners(labA.pairedLabName);
    const labBPartners = parsePartners(labB.pairedLabName);
    if (!labAPartners.includes(labB.name)) labAPartners.push(labB.name);
    if (!labBPartners.includes(labA.name)) labBPartners.push(labA.name);
    const newAStr = joinPartners(labAPartners);
    const newBStr = joinPartners(labBPartners);

    updateLab(labA.id, "batch", labA.batch || "A");
    updateLab(labA.id, "pairedLabName", newAStr);
    updateLab(labB.id, "batch", labB.batch || "B");
    updateLab(labB.id, "pairedLabName", newBStr);

    try {
      await API.put(`/labs/${labA.id}`, {
        lab_name: labA.name, lab_code: labA.code || null,
        batch: labA.batch || "A", hours_per_week: labA.hoursPerWeek || labA.hours_per_week || 2,
        paired_lab_name: newAStr,
      });
      await API.put(`/labs/${labB.id}`, {
        lab_name: labB.name, lab_code: labB.code || null,
        batch: labB.batch || "B", hours_per_week: labB.hoursPerWeek || labB.hours_per_week || 2,
        paired_lab_name: newBStr,
      });
      setSelectedPairs(prev => new Set(prev).add([labA.name, labB.name].sort().join("|")));
      setBatch1LabSel("");
      setBatch2LabSel("");
    } catch (err) {
      console.error("Failed to save pairing:", err);
    }
  };

  // ✅ Removes only the specific labA↔partnerName link — labA may still
  // have other partners left afterward, since pairing is additive.
  const unpair = async (labA, partnerName) => {
    const labB = labConfig.find(l => l.name === partnerName);
    const pairKey = [labA.name, partnerName].sort().join("|");
    setSelectedPairs(prev => { const n = new Set(prev); n.delete(pairKey); return n; });
    setPairCopies(prev => { const n = { ...prev }; delete n[pairKey]; return n; });

    const newAStr = joinPartners(parsePartners(labA.pairedLabName).filter(p => p !== partnerName));
    updateLab(labA.id, "pairedLabName", newAStr);

    let newBStr = null;
    if (labB) {
      newBStr = joinPartners(parsePartners(labB.pairedLabName).filter(p => p !== labA.name));
      updateLab(labB.id, "pairedLabName", newBStr);
    }

    try {
      await API.put(`/labs/${labA.id}`, {
        lab_name: labA.name, lab_code: labA.code || null,
        batch: labA.batch || null, hours_per_week: labA.hoursPerWeek || labA.hours_per_week || 2,
        paired_lab_name: newAStr,
      });
      if (labB) {
        await API.put(`/labs/${labB.id}`, {
          lab_name: labB.name, lab_code: labB.code || null,
          batch: labB.batch || null, hours_per_week: labB.hoursPerWeek || labB.hours_per_week || 2,
          paired_lab_name: newBStr,
        });
      }
    } catch (err) {
      console.error("Failed to unpair:", err);
    }
  };

  const [labFacultySaving, setLabFacultySaving] = React.useState(null);

  // ✅ Sticky candidate set per lab — once a faculty appears as a candidate
  // (their own Labs field names this lab, OR they're currently assigned),
  // they stay available to re-add for the rest of this session, even right
  // after being removed. Only ever grows, never shrinks.
  const labCandidateIdsRef = React.useRef(
    Object.fromEntries(
      Object.entries(loadLabCandidateCache()).map(([labId, facIds]) => [labId, new Set(facIds)])
    )
  );

  // ✅ Writes room_id the same way applyPairing/unpair already write
  // other lab fields, then re-pulls /labs/ so roomName (resolved
  // server-side) comes back correct — no local name-guessing needed.
  const updateLabRoom = async (lab, roomId) => {
    try {
      await API.put(`/labs/${lab.id}`, {
        lab_name: lab.name, lab_code: lab.code || null,
        batch: lab.batch || null, hours_per_week: lab.hoursPerWeek || lab.hours_per_week || 2,
        paired_lab_name: lab.pairedLabName || null,
        room_id: roomId ? parseInt(roomId) : null,
      });
      if (refreshLabs) await refreshLabs();
    } catch (err) {
      console.error("Failed to update lab room:", err);
    }
  };

  const toggleLabFaculty = async (lab, fac, adding) => {
    if (labFacultySaving) return; // one write at a time, no overlapping saves
    const facId = String(fac.id || fac._id);
    const current = (fac.labs || "").split(",").map(s => s.trim()).filter(Boolean);
    const next = adding
      ? Array.from(new Set([...current, lab.name]))
      : current.filter(n => n !== lab.name);
    setLabFacultySaving(facId);
    try {
      // ✅ Send the FULL faculty record, not just `labs` — if the backend's
      // PUT /faculty/{id} overwrites the whole row instead of patching one
      // field, a labs-only payload nulls out name/subjects/designation/
      // workload for every faculty we toggle. Spreading `fac` first keeps
      // every other field exactly as it was; only `labs` actually changes.
      await updateFaculty(facId, { ...fac, labs: next.join(",") });
      if (refreshLabs) await refreshLabs();
      if (refreshFaculty) await refreshFaculty();
    } catch (err) {
      console.error("Failed to update lab faculty:", err);
    } finally {
      setLabFacultySaving(null);
    }
  };

  // ✅ Small reusable Copies control — 1x/2x/3x buttons.
  const CopiesControl = ({ pairKey }) => {
    const current = pairCopies[pairKey] || 1;
    return (
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2].map(n => (
          <button
            key={n}
            onClick={() => setPairCopies(prev => ({ ...prev, [pairKey]: n }))}
            style={{
              padding: "3px 9px", borderRadius: "5px", border: `1px solid ${current === n ? "rgba(234,179,8,0.5)" : "rgba(255,255,255,0.1)"}`,
              background: current === n ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)",
              color: current === n ? "#EAB308" : "#64748B", fontSize: "9px", fontWeight: "700",
              cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
            }}
          >{n}x</button>
        ))}
      </div>
    );
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{NO_SPINNER_CSS}</style>

      <div style={{ ...cardSt, padding: "16px 20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1.2px", fontFamily: "'Sora',sans-serif" }}>📍 Select Target Section</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {sections.length === 0 && <span style={{ fontSize: "10px", color: "#F87171", fontFamily: "'Sora',sans-serif" }}>No sections yet</span>}
            <div style={{ display: "flex", gap: "4px" }}>
              {[
                { key: "odd", label: "Odd" },
                { key: "even", label: "Even" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSemesterType(opt.key)}
                  style={{
                    padding: "5px 12px", borderRadius: "6px", fontSize: "10.5px", fontWeight: "700",
                    background: semesterType === opt.key ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${semesterType === opt.key ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: semesterType === opt.key ? "#EAB308" : "#64748B",
                    cursor: "pointer", fontFamily: "'Sora',sans-serif", transition: "all 0.15s",
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "'Sora',sans-serif" }}>🔢 Cluster No.</div>
            <input type="number" min="1" value={selCluster} onChange={e => setSelCluster(Math.max(1, Number(e.target.value) || 1))} style={{ ...selectSt, width: "100%" }} placeholder="e.g. 1" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
              {[...new Set(sections.map(s => s.cluster ?? 1))].sort((a, b) => a - b).map(n => (
                <button key={n} onClick={() => setSelCluster(n)} style={{ padding: "2px 9px", fontSize: "9px", fontFamily: "'JetBrains Mono',monospace", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: "700", background: selCluster === n ? "rgba(234,179,8,0.25)" : "rgba(255,255,255,0.06)", color: selCluster === n ? "#EAB308" : "#475569", transition: "all 0.15s" }}>C{n}</button>
              ))}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "'Sora',sans-serif" }}>📅 Semester</div>
            <select style={selectSt} value={selSemester} onChange={e => setSelSemester(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Semester {n}</option>)}
            </select>
            <div style={{ marginTop: "6px", fontSize: "10px", color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>{filteredSections.length} section{filteredSections.length !== 1 ? "s" : ""} in C{selCluster}-Sem{selSemester}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", fontFamily: "'Sora',sans-serif" }}>📘 Section</div>
            {filteredSections.length === 0 ? (
              <div style={{ padding: "9px 12px", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "8px", color: "#F87171", fontSize: "11px", fontFamily: "'Sora',sans-serif" }}>
                No sections for Cluster {selCluster}, Sem {selSemester}
                <span style={{ display: "block", marginTop: "3px", color: "#B91C1C", fontSize: "10px" }}>Go to Sections page → add with Cluster {selCluster} + Sem {selSemester}</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <select style={selectSt} value={selSectionId} onChange={e => setSelSectionId(e.target.value)}>
                  {filteredSections.map(s => <option key={s.id} value={String(s.id)}>{s.section_name}</option>)}
                </select>
                {(() => { const done = filteredSections.filter(s => savedList.some(tt => String(tt.section_id) === String(s.id))).length; return <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", width: `${filteredSections.length ? (done / filteredSections.length) * 100 : 0}%`, background: "#10B981", borderRadius: "2px", transition: "width 0.3s" }} /></div><span style={{ fontSize: "9px", color: "#475569", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{done}/{filteredSections.length} generated</span></div>; })()}
              </div>
            )}
          </div>
        </div>

        {selSection && (
          <div style={{ marginTop: "14px", padding: "10px 14px", background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.15)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
              <span style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "'Sora',sans-serif" }}>Generating for:</span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#EAB308", fontFamily: "'JetBrains Mono',monospace" }}>Cluster {selSection.cluster ?? 1} · Sem {selSection.semester} · {selSection.section_name}</span>
            </div>
            <div style={{ fontSize: "10px", color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: conflicts.length > 0 ? "#F87171" : "#10B981", display: "inline-block", marginRight: "6px" }} />
              {conflicts.length > 0 ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} detected` : "No conflicts"}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "🏫 Room", content: rooms.length === 0 ? <span style={{ color: "#F87171", fontSize: "12px" }}>Add rooms first</span> : <select style={selectSt} value={selRoomId} onChange={e => { const rid = e.target.value; setSelRoomId(rid); const p = rooms.find(r => String(r.id) === rid); if (p?.capacity) setHdr(h => ({ ...h, totalStudents: String(p.capacity) })) }}>{rooms.filter(r => (r.room_type || "").toUpperCase() !== "LAB").map(r => <option key={r.id} value={String(r.id)}>{r.room_name} ({r.room_type})</option>)}</select> },
          { label: "👥 Total Students", content: <input type="number" min="1" style={{ ...selectSt, width: "90px" }} value={hdr.totalStudents} onChange={e => setHdr(p => ({ ...p, totalStudents: e.target.value }))} /> },
          { label: "📅 W.E.F", content: <input type="text" style={{ ...selectSt, width: "130px" }} value={hdr.wef} onChange={e => setHdr(p => ({ ...p, wef: e.target.value }))} /> },
          { label: "📚 Academic Year", content: <input type="text" placeholder="e.g. 2025-26" style={{ ...selectSt, width: "100px" }} value={hdr.academicYear} onChange={e => setHdr(p => ({ ...p, academicYear: e.target.value }))} /> },
          { label: "👤 Class Teacher", content: <select style={selectSt} value={hdr.classTeacher} onChange={e => setHdr(p => ({ ...p, classTeacher: e.target.value }))}><option value="">— Select —</option>{facultyOptions.map(fo => <option key={fo.value} value={fo.label}>{fo.label}</option>)}</select> },
        ].map(({ label, content }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>{label}</div>
            {content}
          </div>
        ))}
      </div>

      <div style={{ ...cardSt, background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.15)", overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#EAB308", flexShrink: 0 }}>i</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#F0EDE8", marginBottom: "3px" }}>Laboratory Sessions</div>
              <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "'Sora',sans-serif" }}>Labs are configured in the <strong style={{ color: "#EAB308" }}>Labs</strong> menu. Assign faculty to each lab session below for this timetable.</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8", marginBottom: "4px" }}>🔬 Laboratory Sessions &amp; Faculty</div>
              <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "'Sora',sans-serif" }}>Lab sessions span 2 consecutive slots. Assign faculty for each lab below.</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSelectedLabs(new Set(labConfig.map(l => l.name)))} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>Select All</button>
              <button onClick={() => setSelectedLabs(new Set())} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#F87171", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>Clear All</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {labConfig.map(lab => (
              <label key={lab.id} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px", background: selectedLabs.has(lab.name) ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedLabs.has(lab.name) ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "'JetBrains Mono',monospace", transition: "all 0.2s" }}>
                <input type="checkbox" checked={selectedLabs.has(lab.name)} onChange={e => { const s = new Set(selectedLabs); if (e.target.checked) s.add(lab.name); else s.delete(lab.name); setSelectedLabs(s); }} style={{ cursor: "pointer", accentColor: "#EAB308" }} />
                <span style={{ color: selectedLabs.has(lab.name) ? "#EAB308" : "#64748B", fontWeight: selectedLabs.has(lab.name) ? "600" : "400" }}>{lab.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(129,140,248,0.04)" }}>
          <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "13px", fontWeight: "700", color: "#F0EDE8", marginBottom: "3px" }}>🔀 Batch Pairing</div>
          <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "12px" }}>Pick a lab for Batch 1 and a lab for Batch 2, then pair them. Both labs' Batch and Pairing are set together.</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", flexWrap: "nowrap", marginBottom: "14px" }}>
            {showBatch1 && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#60A5FA", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Batch 1 Lab</div>
                <select value={batch1LabSel} onChange={e => setBatch1LabSel(e.target.value)} style={{ ...selectSt, minWidth: "180px", borderColor: "rgba(59,130,246,0.3)" }}>
                  <option value="">— Select —</option>
                  {labConfig.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
                {batch1LabSel && (
                  <div style={{ marginTop: "6px", fontSize: "10px", fontWeight: "700", color: "#60A5FA", fontFamily: "'JetBrains Mono',monospace" }}>{batch1LabSel}/B1</div>
                )}
              </div>
            )}
            {showBatch2 && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#34D399", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Batch 2 Lab</div>
                <select value={batch2LabSel} onChange={e => setBatch2LabSel(e.target.value)} style={{ ...selectSt, minWidth: "180px", borderColor: "rgba(16,185,129,0.3)" }}>
                  <option value="">— Select —</option>
                  {labConfig.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
                {batch2LabSel && (
                  <div style={{ marginTop: "6px", fontSize: "10px", fontWeight: "700", color: "#34D399", fontFamily: "'JetBrains Mono',monospace" }}>{batch2LabSel}/B2</div>
                )}
              </div>
            )}
            {!showBatch1 && (
              <button
                onClick={() => setShowBatch1(true)}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "1px solid rgba(96,165,250,0.35)", fontWeight: "700", fontSize: "12px",
                  fontFamily: "'Sora',sans-serif", cursor: "pointer",
                  background: "rgba(96,165,250,0.12)", color: "#60A5FA",
                }}
              >+ Add Batch 1</button>
            )}
            {!showBatch2 && (
              <button
                onClick={() => setShowBatch2(true)}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "1px solid rgba(52,211,153,0.35)", fontWeight: "700", fontSize: "12px",
                  fontFamily: "'Sora',sans-serif", cursor: "pointer",
                  background: "rgba(52,211,153,0.12)", color: "#34D399",
                }}
              >+ Add Batch 2</button>
            )}
            {showBatch1 && showBatch2 && (
              <button
                onClick={applyPairing}
                disabled={!batch1LabSel || !batch2LabSel}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "none", fontWeight: "700", fontSize: "12px",
                  fontFamily: "'Sora',sans-serif", cursor: (!batch1LabSel || !batch2LabSel) ? "not-allowed" : "pointer",
                  background: (!batch1LabSel || !batch2LabSel) ? "rgba(255,255,255,0.06)" : "#EAB308",
                  color: (!batch1LabSel || !batch2LabSel) ? "#64748B" : "#0A0C12",
                }}
              >Pair These Labs</button>
            )}
          </div>

          {labConfig.some(l => parsePartners(l.pairedLabName).length > 0) && (
            <div>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Current Pairings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(() => {
                  const seen = new Set();
                  const rows = [];
                  // ✅ Enumerates EVERY labA↔labB relationship — a lab can
                  // now have multiple simultaneous partners, each listed
                  // as its own row here.
                  labConfig.forEach(lab => {
                    parsePartners(lab.pairedLabName).forEach(partnerName => {
                      const pairKey = [lab.name, partnerName].sort().join("|");
                      if (seen.has(pairKey)) return;
                      seen.add(pairKey);
                      rows.push({ lab, labA: lab.name, labB: partnerName, pairKey });
                    });
                  });
                  return rows.map(({ lab, labA, labB, pairKey }) => {
                    const [orderedA, orderedB] = lab.batch === "A" ? [labA, labB] : [labB, labA];
                    return (
                      <div key={pairKey} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono',monospace", color: "#60A5FA", fontWeight: "600" }}>{orderedA}</span>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>↔</span>
                          <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono',monospace", color: "#34D399", fontWeight: "600" }}>{orderedB}</span>
                          <button onClick={() => unpair(lab, labB)} style={{ marginLeft: "auto", padding: "3px 10px", fontSize: "10px", fontWeight: "600", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#F87171", borderRadius: "5px", cursor: "pointer" }}>Unpair</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "9px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>Copies:</span>
                          <CopiesControl pairKey={pairKey} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              {/* ✅ Check/uncheck which pairings appear as draggable PAIR
              chips in "Pin Subjects & Labs to Slots" below — same
              pattern as the individual lab checkboxes above. */}
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Show in Pin Slots</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(() => {
                    const seenPair = new Set();
                    const pairs = [];
                    labConfig.forEach(lab => {
                      parsePartners(lab.pairedLabName).forEach(partnerName => {
                        if (partnerName === lab.name) return;
                        const pairKey = [lab.name, partnerName].sort().join("|");
                        if (seenPair.has(pairKey)) return;
                        seenPair.add(pairKey);
                        const [orderedA, orderedB] = lab.batch === "A" ? [lab.name, partnerName] : [partnerName, lab.name];
                        pairs.push({ pairKey, label: orderedA + "/" + orderedB });
                      });
                    });
                    return pairs.map(({ pairKey, label }) => {
                      const checked = selectedPairs.has(pairKey);
                      return (
                        <label key={pairKey} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px", background: checked ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "'JetBrains Mono',monospace", transition: "all 0.2s" }}>
                          <input type="checkbox" checked={checked} onChange={e => { const s = new Set(selectedPairs); if (e.target.checked) s.add(pairKey); else s.delete(pairKey); setSelectedPairs(s); }} style={{ cursor: "pointer", accentColor: "#34D399" }} />
                          <span style={{ color: checked ? "#34D399" : "#64748B", fontWeight: checked ? "600" : "400" }}>{label}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
              {selfPairs.size > 0 && (
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Self-Paired (Batch Split)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[...selfPairs].map(key => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>
                        <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono',monospace", color: "#EAB308", fontWeight: "700" }}>{key}</span>
                        <span style={{ fontSize: "9px", color: "#475569", marginLeft: "12px", marginRight: "4px" }}>Copies:</span>
                        <CopiesControl pairKey={key} />
                        <button onClick={() => { setSelfPairs(prev => { const n = new Set(prev); n.delete(key); return n; }); setSelectedPairs(prev => { const n = new Set(prev); n.delete(key); return n; }); setPairCopies(prev => { const n = { ...prev }; delete n[key]; return n; }); }} style={{ marginLeft: "auto", padding: "3px 10px", fontSize: "10px", fontWeight: "600", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#F87171", borderRadius: "5px", cursor: "pointer" }}>Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["#", "Lab Name", "Code", "Hrs/Wk", "Room", "Lab Faculty", "Timetable Display"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // ✅ FIXED: a paired lab is driven by the Batch Pairing UI
                // above, not by its own checkbox here, so it was being
                // dropped from this table (and from TimetableGrid's Subject
                // & Faculty Mapping) whenever its checkbox happened to be
                // unticked. A lab with any partner now always counts as
                // visible, regardless of selectedLabs.
                const visibleLabList = labConfig.filter(l => selectedLabs.has(l.name) || parsePartners(l.pairedLabName).length > 0);

                // ✅ Group each pair's two rows next to each other (instead
                // of wherever they happen to fall in labConfig order) and
                // give every pairing its own stable color, so the table
                // itself shows the relationship — not just the "Current
                // Pairings" card above it.
                const PAIR_COLORS = ["#60A5FA", "#34D399", "#F472B6", "#FBBF24", "#A78BFA", "#2DD4BF"];
                const pairKeyOf = (lab) => {
                  const partners = parsePartners(lab.pairedLabName);
                  if (partners.length === 0) return null;
                  return [lab.name, partners[0]].sort().join("|");
                };
                const colorForKey = (key) => {
                  let hash = 0;
                  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
                  return PAIR_COLORS[hash % PAIR_COLORS.length];
                };

                const placed = new Set();
                const orderedLabs = [];
                visibleLabList.forEach(lab => {
                  if (placed.has(lab.name)) return;
                  orderedLabs.push(lab);
                  placed.add(lab.name);
                  parsePartners(lab.pairedLabName).forEach(partnerName => {
                    if (placed.has(partnerName)) return;
                    const partnerLab = visibleLabList.find(l => l.name === partnerName);
                    if (partnerLab) { orderedLabs.push(partnerLab); placed.add(partnerName); }
                  });
                });

                if (orderedLabs.length === 0) {
                  return (
                    <tr><td colSpan={7} style={{ padding: "36px", textAlign: "center", color: "#64748B" }}><div style={{ fontSize: "2rem", marginBottom: "8px", opacity: 0.3 }}>🔬</div><div style={{ fontFamily: "'Sora',sans-serif" }}>No labs yet</div><div style={{ fontSize: "11px", marginTop: "4px", fontFamily: "'JetBrains Mono',monospace" }}>Add lab from the lab page</div></td></tr>
                  );
                }

                return orderedLabs.map((lab, idx) => {
                  const ids = Array.isArray(lab.facultyIds) ? lab.facultyIds : [];
                  const facNames = ids.map(id => facultyList.find(f => String(f.id || f._id) === String(id))?.name || "").filter(Boolean);
                  // ✅ FIXED: strip title (Dr./Mr./Mrs./Ms./Prof.) before computing
                  // initials, same logic as OCRTableUpload.jsx's computeInitials —
                  // was previously including the title's first letter (e.g. "DAHR"
                  // instead of "AHR" for "Dr. Ashwini H R").
                  const initialsOf = (fullName) => {
                    const cleaned = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, "").trim();
                    return cleaned.split(/\s+/).map(w => w[0]).join("").toUpperCase();
                  };
                  const display = facNames.length ? `${lab.name}-${facNames.map(initialsOf).join("/")}` : lab.name;

                  const partners = parsePartners(lab.pairedLabName);
                  const isPaired = partners.length > 0;
                  const pairKey = pairKeyOf(lab);
                  const pairColor = pairKey ? colorForKey(pairKey) : null;
                  // Is this row the second of its pair immediately following the first?
                  const prevLab = idx > 0 ? orderedLabs[idx - 1] : null;
                  const isSecondOfPair = isPaired && prevLab && partners.includes(prevLab.name);
                  const isFirstOfPair = isPaired && !isSecondOfPair;

                  return (
                    <tr
                      key={lab.id}
                      className="lab-row"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        // ✅ Colored left-border bracket spanning both rows of
                        // a pair — the visual cue that ties them together
                        // right in this table.
                        boxShadow: isPaired ? `inset 3px 0 0 ${pairColor}` : "none",
                        background: isPaired ? `${pairColor}0D` : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 16px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px" }}>{idx + 1}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isPaired ? pairColor : "#EAB308" }} />
                          <span style={{ fontWeight: "600", color: "#F0EDE8" }}>{lab.name}</span>
                          <span style={{ fontSize: "9px", background: "rgba(234,179,8,0.15)", color: "#EAB308", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>LAB</span>
                          {isPaired && (
                            <span style={{ fontSize: "9px", background: `${pairColor}26`, color: pairColor, padding: "2px 6px", borderRadius: "4px", fontWeight: "700", border: `1px solid ${pairColor}55` }}>PAIRED</span>
                          )}
                        </div>
                        {/* ✅ Connecting label under the name — shows exactly
                            which lab(s) this one is tied to, right where
                            you're already looking, not just inferable from
                            the card above. */}
                        {isPaired && (
                          <div style={{ fontSize: "10px", color: pairColor, fontFamily: "'JetBrains Mono',monospace", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ opacity: 0.7 }}>{isFirstOfPair ? "↔ paired with" : "↔ paired with"}</span>
                            <span style={{ fontWeight: "700" }}>{partners.join(", ")}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#94A3B8" }}>{lab.code || "—"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "center" }}><span style={{ background: "rgba(234,179,8,0.15)", color: "#EAB308", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>{lab.hoursPerWeek || lab.hours_per_week || 2}</span></td>
                      <td style={{ padding: "10px 16px" }}>
                        <select
                          className="labs-select"
                          value={lab.roomId || ""}
                          onChange={e => updateLabRoom(lab, e.target.value)}
                          style={{ ...selectSt, minWidth: "0", width: "140px", padding: "6px 8px", fontSize: "11px" }}
                        >
                          <option value="">— No Room —</option>
                          {rooms.filter(r => (r.room_type || "").toUpperCase() === "LAB").map(r => (
                            <option key={r.id} value={String(r.id)}>{r.room_name}</option>
                          ))}
                        </select>
                      </td>
                     <td style={{ padding: "10px 16px", minWidth: "220px" }}>
                        {(() => {
                          // ✅ Matches on each faculty's own "Labs" field (Faculty
                          // page) — the same field toggleLabFaculty writes to —
                          // instead of Subjects, which was never the right source
                          // for this and is what caused labs to show empty.
                          const labsMatchedIds = facultyList.filter(f => {
                            const facLabs = (f.labs || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
                            return facLabs.includes(lab.name.toLowerCase());
                          }).map(f => String(f.id || f._id));

                         if (!labCandidateIdsRef.current[lab.id]) {
                            labCandidateIdsRef.current[lab.id] = new Set();
                          }
                          const stickySet = labCandidateIdsRef.current[lab.id];
                          const sizeBefore = stickySet.size;
                          labsMatchedIds.forEach(id => stickySet.add(id));
                          ids.forEach(id => stickySet.add(id));
                          if (stickySet.size !== sizeBefore) {
                            const cache = loadLabCandidateCache();
                            cache[lab.id] = Array.from(stickySet);
                            saveLabCandidateCache(cache);
                          }

                          const candidates = facultyList.filter(f => stickySet.has(String(f.id || f._id)));
                          return <LabFacultyAdd lab={lab} candidates={candidates} assignedIds={ids} labFacultySaving={labFacultySaving} toggleLabFaculty={toggleLabFaculty} />;
                        })()}
                      </td>
                      <td style={{ padding: "10px 16px" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: "700", color: "#0A0C12", background: "#EAB308", padding: "3px 8px", borderRadius: "5px", letterSpacing: "0.3px", whiteSpace: "nowrap" }}>{display}</span></td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...cardSt, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8" }}>Subject &amp; Faculty Configuration</div>
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>Assign theory faculty to each subject.</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSelectedSubjects(new Set(subjectConfig.map(s => s.subject)))} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>Select All</button>
              <button onClick={() => setSelectedSubjects(new Set())} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#F87171", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>Clear All</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {subjectConfig.map(sc => (
              <label key={sc.subject} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px", background: selectedSubjects.has(sc.subject) ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedSubjects.has(sc.subject) ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "'JetBrains Mono',monospace", transition: "all 0.2s" }}>
                <input type="checkbox" checked={selectedSubjects.has(sc.subject)} onChange={e => { const s = new Set(selectedSubjects); if (e.target.checked) s.add(sc.subject); else s.delete(sc.subject); setSelectedSubjects(s); }} style={{ cursor: "pointer", accentColor: "#EAB308" }} />
                <span style={{ color: selectedSubjects.has(sc.subject) ? "#EAB308" : "#64748B", fontWeight: selectedSubjects.has(sc.subject) ? "600" : "400" }}>
                  {sc.subject}
                  {sc.isCore && <span style={{ marginLeft: 4, color: "#EAB308" }}>⭐</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead><tr style={{ background: "rgba(255,255,255,0.03)" }}>{["Subject", "Code", "Hours/Wk", "Doubles/Wk", "Theory Faculty", "Core Subject"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: "700", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {subjectConfig.filter(sc => selectedSubjects.has(sc.subject)).length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "36px", textAlign: "center", color: "#64748B" }}><div style={{ fontFamily: "'Sora',sans-serif" }}>No subjects yet</div><div style={{ fontSize: "11px", marginTop: "4px", fontFamily: "'JetBrains Mono',monospace" }}>Add subjects from the Subjects page</div></td></tr>
              ) : subjectConfig.filter(sc => selectedSubjects.has(sc.subject)).map((sc, displayIdx) => {
                const idx = (allSubjectConfig || subjectConfig).findIndex(s => s.subject === sc.subject);
                const col = PALETTE[displayIdx % PALETTE.length];
                return (
                  <tr key={sc.subject} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: sc.isFixed ? "rgba(234,179,8,0.04)" : "transparent" }}>
                    <td style={{ padding: "10px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col, flexShrink: 0 }} /><span style={{ fontWeight: "600", color: "#F0EDE8", fontFamily: "Sora,sans-serif", fontSize: "13px" }}>{sc.subject}</span>{sc.isFixed && <span style={{ fontSize: "9px", background: "rgba(234,179,8,0.2)", color: "#EAB308", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>FIXED</span>}</div></td>
                    <td style={{ padding: "10px 14px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px" }}>{sc.code}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <input type="number" min="1" max="10" value={sc.hoursPerWeek} onChange={e => updateConfig(idx, "hoursPerWeek", parseInt(e.target.value) || 1)} style={{ width: "55px", textAlign: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#F0EDE8", padding: "6px", fontSize: "13px", outline: "none", fontFamily: "'JetBrains Mono',monospace" }} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {(() => {
                        const maxDouble = Math.floor((parseInt(sc.hoursPerWeek) || 0) / 2);
                        const curDouble = parseInt(sc.doublePerWeek) || 0;
                        const active = curDouble > 0;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              display: "flex", alignItems: "center",
                              background: active ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${active ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.1)"}`,
                              borderRadius: "8px", overflow: "hidden",
                            }}>
                              <button
                                type="button"
                                onClick={() => updateConfig(idx, "doublePerWeek", Math.max(0, curDouble - 1))}
                                disabled={curDouble <= 0}
                                style={{
                                  width: "24px", height: "28px", border: "none",
                                  background: "transparent", cursor: curDouble <= 0 ? "not-allowed" : "pointer",
                                  color: curDouble <= 0 ? "#374151" : "#818CF8", fontSize: "14px", fontWeight: "700",
                                  fontFamily: "'JetBrains Mono',monospace", lineHeight: 1,
                                }}
                              >−</button>
                              <input
                                type="number" min="0" max={maxDouble}
                                value={curDouble}
                                onChange={e => updateConfig(idx, "doublePerWeek", Math.min(maxDouble, Math.max(0, parseInt(e.target.value) || 0)))}
                                className="no-spinner"
                                style={{
                                  width: "30px", textAlign: "center", background: "transparent",
                                  border: "none", color: active ? "#818CF8" : "#F0EDE8",
                                  fontSize: "13px", outline: "none", fontFamily: "'JetBrains Mono',monospace",
                                  padding: "6px 0",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => updateConfig(idx, "doublePerWeek", Math.min(maxDouble, curDouble + 1))}
                                disabled={curDouble >= maxDouble}
                                style={{
                                  width: "24px", height: "28px", border: "none",
                                  background: "transparent", cursor: curDouble >= maxDouble ? "not-allowed" : "pointer",
                                  color: curDouble >= maxDouble ? "#374151" : "#818CF8", fontSize: "14px", fontWeight: "700",
                                  fontFamily: "'JetBrains Mono',monospace", lineHeight: 1,
                                }}
                              >+</button>
                            </div>
                            <span style={{ fontSize: "9px", color: "#475569", whiteSpace: "nowrap" }}>max {maxDouble}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {(() => {
                        const matchedFaculty = facultyList.filter(fac => {
                          const facSubjects = (fac.subjects || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
                          return facSubjects.includes(sc.subject.toLowerCase());
                        });
                        return (
                          <select value={sc.theoryFacultyId || ""} onChange={e => updateConfig(idx, "theoryFacultyId", e.target.value)} style={{ ...selectSt, borderColor: matchedFaculty.length === 0 ? "rgba(220,38,38,0.4)" : "rgba(234,179,8,0.3)", background: matchedFaculty.length === 0 ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.05)" }}>
                            <option value="">— Select Faculty —</option>
                            {matchedFaculty.length > 0 ? (
                              matchedFaculty.map(fac => (<option key={fac.id || fac._id} value={String(fac.id || fac._id)}>{fac.name}</option>))
                            ) : (
                              <option value="" disabled style={{ color: "#EF4444" }}>⚠ No faculty assigned to teach "{sc.subject}"</option>
                            )}
                          </select>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      {sc.isCore ? (
                        <span style={{ fontSize: "10px", fontWeight: "800", color: "#0A0C12", background: "#EAB308", padding: "3px 10px", borderRadius: "12px", whiteSpace: "nowrap" }}>
                          ⭐ CORE
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", color: "#475569" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...cardSt, overflow: "hidden", marginTop: "20px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8" }}>Pin Subjects &amp; Labs to Slots</div>
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>Drag or click to pin. Pinned slots are never overwritten by the generator.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>{Object.keys(pinnedSlots).length} pinned</span>
            {Object.keys(pinnedSlots).length > 0 && <button onClick={() => setPinnedSlots({})} style={{ padding: "5px 14px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#F87171", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "'Sora',sans-serif" }}>Clear All</button>}
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {subjectConfig.filter(sc => selectedSubjects.has(sc.subject)).map((sc, idx) => (
              <div key={sc.subject} draggable onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; setDragItem({ subject: sc.subject, isLab: false }); }} onDragEnd={() => setDragItem(null)} style={{ padding: "6px 14px", borderRadius: "20px", cursor: "grab", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", fontSize: "12px", fontWeight: "600", fontFamily: "Sora,sans-serif", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: PALETTE[idx % PALETTE.length], flexShrink: 0 }} />{sc.subject}
              </div>
            ))}
            {labConfig.filter(l => selectedLabs.has(l.name)).map(lab => (
              <div key={lab.id} draggable onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; setDragItem({ subject: lab.name, isLab: true }); }} onDragEnd={() => setDragItem(null)} style={{ padding: "6px 14px", borderRadius: "20px", cursor: "grab", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)", color: "#EAB308", fontSize: "12px", fontWeight: "700", fontFamily: "Sora,sans-serif", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#EAB308", flexShrink: 0 }} />{lab.name}<span style={{ fontSize: "8px", background: "rgba(234,179,8,0.2)", padding: "1px 5px", borderRadius: "3px" }}>LAB</span>
              </div>
            ))}
            {/* ✅ Persistent chip per pairing — unlike the dashed "Suggested"
                box (which is tied to one specific day and disappears once
                used), this chip never goes away, so the same pairing can
                be dragged to as many cells as needed, repeatedly. Order
                shown/dragged follows whichever lab is currently batch "A".
                Controlled by the "Show in Pin Slots" checkboxes in Batch
                Pairing — independent of the individual lab checkboxes. */}
            {(() => {
              const seenPair = new Set();
              const pairs = [];
              labConfig.forEach(lab => {
                parsePartners(lab.pairedLabName).forEach(partnerName => {
                  if (partnerName === lab.name) return;
                  const pairKey = [lab.name, partnerName].sort().join("|");
                  if (seenPair.has(pairKey)) return;
                  seenPair.add(pairKey);
                  const [batch1, batch2] = lab.batch === "A" ? [lab.name, partnerName] : [partnerName, lab.name];
                  pairs.push({ pairKey, batch1, batch2 });
                });
              });
              return pairs.map(({ pairKey, batch1, batch2 }) => {
                if (!selectedPairs.has(pairKey)) return null;
                const copies = pairCopies[pairKey] || 1;
                // ✅ One independent draggable chip per copy — each can be
                // dropped onto a different cell manually, regardless of
                // where (if anywhere) the generator auto-placed the others.
                return Array.from({ length: copies }).map((_, idx) => (
                  <div key={"pair_" + pairKey + "_" + idx} draggable onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; setDragItem({ subject: batch1, isLab: true, batchBSubject: batch2 }); }} onDragEnd={() => setDragItem(null)} style={{ padding: "6px 14px", borderRadius: "20px", cursor: "grab", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#34D399", fontSize: "12px", fontWeight: "700", fontFamily: "Sora,sans-serif", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#34D399", flexShrink: 0 }} />{batch1}/{batch2}{copies > 1 && <span style={{ fontSize: "8px", opacity: 0.7 }}>#{idx + 1}</span>}<span style={{ fontSize: "8px", background: "rgba(52,211,153,0.2)", padding: "1px 5px", borderRadius: "3px" }}>PAIR</span>
                  </div>
                ));
              });
            })()}
            {/* ✅ Self-pair chips — same lab as both Batch 1 and Batch 2,
                display/pin-only, independent of real cross-lab pairing. */}
            {[...selfPairs].filter(key => selectedPairs.has(key)).map(key => {
              const [batch1, batch2] = key.split("/");
              const copies = pairCopies[key] || 1;
              return Array.from({ length: copies }).map((_, idx) => (
                <div key={"selfpair_" + key + "_" + idx} draggable onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; setDragItem({ subject: batch1, isLab: true, batchBSubject: batch2 }); }} onDragEnd={() => setDragItem(null)} style={{ padding: "6px 14px", borderRadius: "20px", cursor: "grab", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)", color: "#EAB308", fontSize: "12px", fontWeight: "700", fontFamily: "Sora,sans-serif", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "3px", background: "#EAB308", flexShrink: 0 }} />{batch1}/{batch2}{copies > 1 && <span style={{ fontSize: "8px", opacity: 0.7 }}>#{idx + 1}</span>}<span style={{ fontSize: "8px", background: "rgba(234,179,8,0.2)", padding: "1px 5px", borderRadius: "3px" }}>PAIR</span>
                </div>
              ));
            })}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: "3px", width: "100%", tableLayout: "auto", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th style={{ width: "46px", minWidth: "46px" }} />
                  {SLOTS.map((s, i) => (
                    s.type === "break"
                      ? <th key={i} style={{ padding: "4px 0", width: "38px", minWidth: "38px" }}><div style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "4px", padding: "4px 2px", textAlign: "center" }}><div style={{ fontSize: "7px", fontWeight: "700", color: "#CA8A04", letterSpacing: "0.5px", textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{s.label || "BRK"}</div><div style={{ fontSize: "6px", color: "#A16207", fontFamily: "'JetBrains Mono',monospace", marginTop: "1px" }}>{s.time.split("-")[0].trim()}</div></div></th>
                      : <th key={i} style={{ padding: "4px 3px" }}><div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "4px 2px", textAlign: "center" }}><div style={{ fontSize: "7.5px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", fontWeight: "600" }}>{s.time}</div></div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => {
                  // Which pins take two periods: labs always; a subject with Doubles/wk > 0
                  // for its first N pins, if the next period is directly beside it and free.
                  const doubleKeys = new Set();
                  {
                    const cnt = {}, taken = new Set();
                    Object.entries(pinnedSlots).forEach(([k, p]) => {
                      const [pd, pt] = k.split("|");
                      const psi = SLOTS.findIndex(x => x.time === pt);
                      if (psi === -1) return;
                      taken.add(k);
                      if (p.isLab) {
                        const np = SLOTS.slice(psi + 1).find(n => n.type === "period");
                        if (np) taken.add(pd + "|" + np.time);
                        return;
                      }
                      const wanted = parseInt((allSubjectConfig || subjectConfig || []).find(sc => sc.subject === p.subject)?.doublePerWeek) || 0;
                      const next = SLOTS[psi + 1];
                      if ((cnt[p.subject] || 0) < wanted && next && next.type === "period") {
                        const nk = pd + "|" + next.time;
                        if (!taken.has(nk) && !pinnedSlots[nk]) {
                          cnt[p.subject] = (cnt[p.subject] || 0) + 1;
                          taken.add(nk);
                          if (pd === day) doubleKeys.add(k);
                        }
                      }
                    });
                  }
                  const absorbedTimes = new Set();
                  SLOTS.forEach((s, si) => {
                    if (s.type === "break") return;
                    const pin = pinnedSlots[day + "|" + s.time];
                    if (pin?.isLab) {
                      const nextPeriod = SLOTS.slice(si + 1).find(ns => ns.type === "period");
                      if (nextPeriod) absorbedTimes.add(nextPeriod.time);
                    } else if (pin && doubleKeys.has(day + "|" + s.time)) {
                      absorbedTimes.add(SLOTS[si + 1].time);
                    }
                  });
                  return (
                    <tr key={day}>
                      <td style={{ padding: "2px 6px 2px 0", fontSize: "9px", fontWeight: "700", color: "#475569", fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", letterSpacing: "1.5px", textAlign: "right", width: "46px", verticalAlign: "middle" }}>{day.slice(0, 3).toUpperCase()}</td>
                      {SLOTS.map((s, i) => {
                        if (s.type === "break") return (
                          <td key={i} style={{ width: "38px", minWidth: "38px", verticalAlign: "middle", padding: "2px 0" }}><div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: "5px", height: "54px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: "7px", fontWeight: "700", color: "#CA8A04", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'JetBrains Mono',monospace", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{s.label}</div></div></td>
                        );
                        if (absorbedTimes.has(s.time)) return null;
                        const key = day + "|" + s.time;
                        const pin = pinnedSlots[key];
                        const isOver = dragOver === key;
                        const isDoublePin = doubleKeys.has(key);
                        const colSpan = (pin?.isLab || isDoublePin) ? 2 : 1;
                        return (
                          <td key={i} colSpan={colSpan}
                            onClick={() => openPinModal(day, s.time)}
                            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(key); }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                            onDrop={e => { e.preventDefault(); setDragOver(null); if (!dragItem) return; const entry = { subject: dragItem.subject, isLab: dragItem.isLab }; if (dragItem.batchBSubject) entry.batchBSubject = dragItem.batchBSubject; setPinnedSlots(p => ({ ...p, [key]: entry })); setDragItem(null); }}
                            style={{ position: "relative", verticalAlign: "middle", textAlign: "left", height: "54px", borderRadius: "7px", border: isOver ? "2px dashed rgba(234,179,8,0.7)" : pin?.isLab ? "1.5px solid rgba(234,179,8,0.55)" : pin ? "1.5px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.07)", background: isOver ? "rgba(234,179,8,0.1)" : pin?.isLab ? "rgba(234,179,8,0.13)" : pin ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.02)", cursor: dragItem ? "copy" : "pointer", transition: "all 0.15s", padding: "2px", boxShadow: pin?.isLab ? "inset 3px 0 0 #EAB308" : pin ? "inset 3px 0 0 #EAB308" : "none" }}>
                            {pin ? (
                              <>
                                <div style={{ fontSize: "10px", fontWeight: "700", color: pin.isLab ? "#EAB308" : "#F0EDE8", fontFamily: "'JetBrains Mono',monospace", padding: "4px 6px 0", lineHeight: "1.2" }}>{pin.batchBSubject ? `${pin.subject}/${pin.batchBSubject}` : pin.subject}</div>
                                {pin.isLab && (<div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "6px", marginTop: "3px" }}><div style={{ fontSize: "7px", fontWeight: "700", color: "#92400E", background: "rgba(234,179,8,0.25)", border: "1px solid rgba(234,179,8,0.4)", padding: "1px 5px", borderRadius: "3px", fontFamily: "'JetBrains Mono',monospace" }}>LAB</div><div style={{ fontSize: "7px", color: "#A16207", fontFamily: "'JetBrains Mono',monospace" }}>× 2 slots</div></div>)}
                                {!pin.isLab && isDoublePin && (<div style={{ paddingLeft: "6px", marginTop: "3px", fontSize: "7px", color: "#A16207", fontFamily: "'JetBrains Mono',monospace" }}>× 2 slots</div>)}
                                <button onClick={e => { e.stopPropagation(); clearPin(day, s.time); }} style={{ position: "absolute", top: "3px", right: "3px", width: "14px", height: "14px", background: "rgba(220,38,38,0.2)", border: "1px solid rgba(220,38,38,0.35)", color: "#F87171", cursor: "pointer", fontSize: "8px", borderRadius: "3px", padding: 0, fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                              </>
                            ) : (
                              <div style={{ width: "18px", height: "18px", margin: "auto 0 auto 6px", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.1)", fontSize: "12px" }}>+</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}