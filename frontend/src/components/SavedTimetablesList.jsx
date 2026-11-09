import React from "react";

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

export default function SavedTimetablesList({
  savedList,
  filteredSavedList,
  sections,
  conflicts,
  departments,
  filterAcademicYear,
  setFilterAcademicYear,
  filterDepartment,
  setFilterDepartment,
  filterSemester,
  setFilterSemester,
  showArchived,
  setShowArchived,
  loadSaved,
  archiveSaved,
  deleteSaved,
}) {
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "18px", fontWeight: "700", color: "#F0EDE8" }}>Saved Timetables</div>
        {savedList.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {[
              { label: "Total Saved", val: savedList.length, color: "#EAB308" },
              { label: "Sections Done", val: new Set(savedList.map(t => t.section_id).filter(Boolean)).size, color: "#60A5FA" },
              { label: "Conflicts", val: conflicts.length, color: conflicts.length > 0 ? "#F87171" : "#34D399" },
            ].map(st => (
              <div key={st.label} style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 16px", textAlign: "center", minWidth: "90px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: "800", color: st.color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{st.val}</div>
                <div style={{ fontSize: "9px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'Sora',sans-serif", marginTop: "3px" }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {savedList.length > 0 && (
        <div style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: "12px", padding: "16px", marginBottom: "18px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#818CF8", textTransform: "uppercase", letterSpacing: "2px", fontFamily: "'Sora',sans-serif", marginBottom: "12px" }}>🔍 Filter &amp; Search</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Academic Year</label>
              <select value={filterAcademicYear} onChange={e => setFilterAcademicYear(e.target.value)} style={{ ...selectSt, width: "100%" }}>
                <option value="">— All Years —</option>
                {[...new Set(savedList.map(t => t.academic_year).filter(Boolean))].sort().reverse().map(year => (<option key={year} value={year}>{year}</option>))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Department</label>
              <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} style={{ ...selectSt, width: "100%" }}>
                <option value="">— All Departments —</option>
                {departments.map(d => (<option key={d.id} value={d.id}>{d.name} ({d.code})</option>))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Semester</label>
              <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={{ ...selectSt, width: "100%" }}>
                <option value="">— All Semesters —</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (<option key={s} value={s}>Semester {s}</option>))}
              </select>
            </div>
          </div>

          {(filterAcademicYear || filterDepartment || filterSemester) && (
            <button onClick={() => { setFilterAcademicYear(""); setFilterDepartment(""); setFilterSemester(""); }} style={{ fontSize: "12px", padding: "6px 14px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#F87171", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontFamily: "'Sora',sans-serif" }}>Clear Filters</button>
          )}

          <button onClick={() => setShowArchived(!showArchived)} style={{ fontSize: "12px", padding: "6px 14px", background: showArchived ? "rgba(129,140,248,0.2)" : "rgba(129,140,248,0.1)", border: `1px solid ${showArchived ? "rgba(129,140,248,0.5)" : "rgba(129,140,248,0.3)"}`, color: "#818CF8", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontFamily: "'Sora',sans-serif", transition: "all 0.2s", marginLeft: "8px" }}>
            {showArchived ? "📂 Hide Archived" : "📂 Show Archived"} ({savedList.filter(t => t.is_archived).length})
          </button>
        </div>
      )}

      {filteredSavedList.length === 0 ? (
        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "48px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: "2.4rem", marginBottom: "12px", opacity: 0.3 }}>📂</div>
          <div style={{ fontFamily: "'Sora',sans-serif", color: "#94A3B8", fontSize: "15px", marginBottom: "6px" }}>No saved timetables yet</div>
          <div style={{ fontSize: "11px", color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>Generate a timetable and click Save to see it here</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "12px" }}>
          {filteredSavedList.map(tt => {
            const sec = sections.find(s => String(s.id) === String(tt.section_id));
            const hasConflict = conflicts.some(cf => sec && cf.includes(sec.section_name));
            const displayLabel = sec ? `C${sec.cluster ?? 1} · Sem ${sec.semester} · ${sec.section_name}` : tt.label || `Timetable #${tt.id}`;
            const metaInfo = `W.E.F: ${tt.wef || "—"} · ${tt.total_students || "—"} students`;

            return (
              <div
                key={tt.id}
                onClick={() => loadSaved(tt)}
                className="tt-saved-row"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: `1px solid ${hasConflict ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "10px",
                  padding: "16px 18px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ fontWeight: "700", fontSize: "14px", color: hasConflict ? "#F87171" : "#F0EDE8", marginBottom: "4px", marginTop: "0" }}>
                  {displayLabel}
                </div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace", marginBottom: "3px" }}>
                  {metaInfo}
                </div>
                {tt.created_at && (
                  <div style={{ fontSize: "9px", color: "#475569", fontFamily: "'JetBrains Mono',monospace" }}>
                    {new Date(tt.created_at).toLocaleString()}
                  </div>
                )}
                <div style={{ marginTop: "10px", fontSize: "10px", color: "#818CF8", fontWeight: "600" }}>
                  Load →
                </div>
                <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px" }}>
                  <button onClick={e => {
                    e.stopPropagation();
                    archiveSaved(tt.id, !tt.is_archived);
                  }}
                    style={{
                      background: tt.is_archived ? "rgba(16,185,129,0.12)" : "rgba(234,179,8,0.12)",
                      color: tt.is_archived ? "#34D399" : "#EAB308",
                      border: `1px solid ${tt.is_archived ? "rgba(16,185,129,0.25)" : "rgba(234,179,8,0.25)"}`,
                      borderRadius: "5px",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: "600"
                    }}>
                    {tt.is_archived ? "📂 Restore" : "📌 Archive"}
                  </button>
                  <button onClick={e => deleteSaved(tt.id, e)} style={{
                    background: "rgba(220,38,38,0.12)",
                    color: "#F87171",
                    border: "1px solid rgba(220,38,38,0.25)",
                    borderRadius: "5px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "600"
                  }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}