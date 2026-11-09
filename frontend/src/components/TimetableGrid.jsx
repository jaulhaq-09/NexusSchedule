import React, { forwardRef } from "react";

const PALETTE = [
  "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#06B6D4",
  "#A78BFA", "#FB7185", "#34D399", "#FBBF24", "#60A5FA",
];

const TimetableGrid = forwardRef(function TimetableGrid({
  DAYS, SLOTS, grid, data, editCell, setEditCell, cellInput, setCellInput, saveEdit,
  logoUrl, institutionName, institutionAddress, departmentName, hdr, selSection, displayRoom,
  labConfig, selectedLabs, facultyList, subjectConfig, semesterType,
}, tableRef) {

  // ✅ FIXED: the Odd/Even/All Semesters toggle in Config now controls
  // this label directly — previously it only affected which subjects
  // were shown, while the header always fell back to the section's
  // actual semester number regardless of what was selected.
  const semesterParity = semesterType === "odd" ? "ODD"
    : semesterType === "even" ? "EVEN"
    : selSection?.semester
      ? (selSection.semester % 2 === 0 ? "EVEN" : "ODD")
      : "";

  const clusterVal = selSection?.cluster ?? 1;

  const facInitials = (facultyName) => {
    if (!facultyName || facultyName === "—") return "";
    return facultyName.split("/").map(n => {
      const cleaned = n.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, "").trim();
      return cleaned.split(/\s+/).map(w => w[0]).join("").toUpperCase();
    }).filter(Boolean).join("/");
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease", overflowX: "auto", width: "100%" }}>
      <div ref={tableRef} data-ref="timetable" style={{ background: "#ffffff", borderRadius: "12px", padding: "28px 32px", color: "#000", boxShadow: "0 4px 32px rgba(0,0,0,0.18)", fontFamily: "'Times New Roman',Georgia,serif", width: "100%", boxSizing: "border-box" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "10px" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" crossOrigin="anonymous" style={{ width: "70px", height: "70px", borderRadius: "50%", border: "2px solid #000", objectFit: "cover", flexShrink: 0 }} onError={(e) => e.target.style.display = 'none'} />
          ) : (
            <div style={{ width: "70px", height: "70px", borderRadius: "50%", border: "2px solid #000", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#999" }}>LOGO</div>
          )}
          <div style={{ flex: 1, textAlign: "center", paddingTop: "4px" }}>
            <div style={{ fontSize: "17px", fontWeight: "900", letterSpacing: "1px", color: "#000", marginBottom: "2px" }}>{institutionName || "BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT"}</div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#000", marginBottom: "2px" }}>{institutionAddress || "AVALAHALLI, YELAHANKA, BENGALURU-560119"}</div>
            {departmentName && (
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#000", marginBottom: "4px" }}>{departmentName.toUpperCase()}</div>
            )}
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#000" }}>
              {selSection?.semester ? `${selSection.semester}th ` : ""}Semester B.E Timetable for the Academic Year {hdr.academicYear || "—"}{semesterParity && ` (${semesterParity})`}
            </div>
          </div>
        </div>

        {/* ── Info bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0", border: "1px solid #000", marginBottom: "14px" }}>
          <div style={{ padding: "8px 12px", borderRight: "1px solid #000" }}>
            <div style={{ fontSize: "9px", fontWeight: "700", color: "#000", marginBottom: "3px" }}>Semester/Section:</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#000" }}>{selSection ? `${selSection.semester}th ${selSection.section_name}` : "—"}</div>
          </div>
          <div style={{ padding: "8px 12px", borderRight: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#000" }}>Division-{clusterVal}</div>
          </div>
          <div style={{ padding: "8px 12px", borderRight: "1px solid #000" }}>
            <div style={{ fontSize: "9px", fontWeight: "700", color: "#000", marginBottom: "3px" }}>w.e.f:</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#000" }}>{hdr.wef}</div>
          </div>
          <div style={{ padding: "8px 12px", borderRight: "1px solid #000" }}>
            <div style={{ fontSize: "9px", fontWeight: "700", color: "#000", marginBottom: "3px" }}>Classroom:</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#000" }}>{displayRoom}</div>
          </div>
          <div style={{ padding: "8px 12px" }}>
            <div style={{ fontSize: "9px", fontWeight: "700", color: "#000", marginBottom: "3px" }}>Class Coordinator:</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#000" }}>{hdr.classTeacher || "—"}</div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed", border: "2px solid #1e293b" }}>
          <thead>
            <tr>
              <th style={{ background: "#1e293b", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "10px 8px", border: "1px solid #1e293b", textAlign: "center", letterSpacing: "1px", width: "70px" }}>DAY</th>
              {(() => {
                const romans = ["I", "II", "10.20-10.40", "III", "IV", "12.30-1.25", "V", "VI", "VII"];
                let romanIdx = 0;
                return SLOTS.map((s, i) => {
                  if (s.type === "break") {
                    const label = romans[romanIdx] || s.label; romanIdx++;
                    return <th key={i} style={{ background: "#e8e8e8", color: "#555", fontSize: "9px", padding: "6px 2px", border: "1px solid #000", fontWeight: "700", fontStyle: "italic", textAlign: "center", width: "36px" }}>{label}<br /><span style={{ fontSize: "7px" }}>{s.time}</span></th>;
                  } else {
                    const label = romans[romanIdx] || ""; romanIdx++;
                    return <th key={i} style={{ background: "#1e293b", color: "#fff", fontSize: "10px", padding: "8px 2px", border: "1px solid #1e293b", fontWeight: "700", textAlign: "center", whiteSpace: "nowrap" }}>{label}<br /><span style={{ fontSize: "7px" }}>{s.time}</span></th>;
                  }
                });
              })()}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => {
              let skip = 0;
              return (
                <tr key={day}>
                  <td style={{ background: "#1e293b", color: "#fff", fontWeight: "700", fontSize: "9px", textAlign: "center", padding: "0 6px", border: "1px solid #1e293b", letterSpacing: "1px", width: "70px", whiteSpace: "nowrap" }}>{day.toUpperCase()}</td>
                  {SLOTS.map((slot, i) => {
                    if (skip > 0) { skip--; return null; }

                    // ✅ Break/Lunch: rendered once as a single tall column
                    // spanning every day row (matches the PDF template),
                    // instead of repeating the cell on every row.
                    if (slot.type === "break") {
                      if (di === 0) {
                        return (
                          <td key={i} rowSpan={DAYS.length} style={{ background: "#eef2f6", textAlign: "center", border: "1px solid #1e293b", padding: "4px 2px", verticalAlign: "middle" }}>
                            <div style={{ fontSize: "10px", fontWeight: "700", color: "#1e293b", textTransform: "uppercase", letterSpacing: "1px", writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto" }}>
                              {slot.label}
                            </div>
                          </td>
                        );
                      }
                      return null; // covered by the first row's rowSpan
                    }

                    const cell = grid[day]?.[slot.time];
                    if (cell?.__absorbed) return null;
                    if ((cell?.span || 1) > 1) skip = (cell?.span || 1) - 1;

                    // ✅ Batch-split cell: two different labs (Batch 1 / Batch 2)
                    // sharing one slot, matching the PDF's "ADA lab B1(411C)/
                    // DBMS lab B2(KC)" style. Not click-to-edit like plain
                    // cells — editing this would need to touch the pin, not
                    // free text — so it renders read-only.
                    if (cell?.isBatchSplit) {
                      return (
                        <td key={i} colSpan={cell.span || 2} style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "4px 3px", height: "78px", verticalAlign: "middle", textAlign: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <div style={{ fontWeight: "700", fontSize: "10px", color: "#000", lineHeight: "1.25", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                                {cell.batchA?.subject} <span style={{ fontWeight: "600", fontSize: "8px", color: "#555" }}>B1</span>
                                <div style={{ fontWeight: "800", fontSize: "10.5px", color: "#000", textTransform: "none", marginTop: "3px", letterSpacing: "0.2px", lineHeight: "1.2", background: "rgba(234,179,8,0.15)", borderRadius: "3px", padding: "1px 4px", display: "inline-block" }}>{[facInitials(cell.batchA?.facultyName), cell.batchA?.roomName].filter(Boolean).join(" · ")}</div>
                              </div>
                              <div style={{ height: "1px", background: "#000", opacity: 0.15, margin: "1px 6px" }} />
                              <div style={{ fontWeight: "700", fontSize: "10px", color: "#000", lineHeight: "1.25", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                                {cell.batchB?.subject} <span style={{ fontWeight: "600", fontSize: "8px", color: "#555" }}>B2</span>
                                <div style={{ fontWeight: "800", fontSize: "10.5px", color: "#000", textTransform: "none", marginTop: "3px", letterSpacing: "0.2px", lineHeight: "1.2", background: "rgba(234,179,8,0.15)", borderRadius: "3px", padding: "1px 4px", display: "inline-block" }}>{[facInitials(cell.batchB?.facultyName), cell.batchB?.roomName].filter(Boolean).join(" · ")}</div>
                              </div>
                            </div>
                          </td>
                      );
                    }

                    return (
                      <td key={i} colSpan={cell?.span || 1} onClick={() => { setCellInput(cell?.subject || ""); setEditCell(`${day}-${slot.time}`); }} style={{ border: "1px solid #cbd5e1", background: "#ffffff", padding: "4px 3px", height: "78px", verticalAlign: "middle", textAlign: "center", cursor: "pointer" }}>
                        {editCell === `${day}-${slot.time}` ? (<input autoFocus value={cellInput} onChange={e => setCellInput(e.target.value)} onBlur={() => saveEdit(day, slot.time)} style={{ width: "90%", border: "1px solid #000", borderRadius: "2px", padding: "3px 5px", fontSize: "11px", outline: "none" }} />)
                          : cell && !cell.__absorbed ? (
                            <div style={{ fontWeight: "700", fontSize: "11px", color: "#000", lineHeight: "1.3", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                              {cell.subject}
                              {/* ✅ Standalone lab — always tagged with
                                  "B1/B2" (the whole class is present, just
                                  split into two batches within one lab
                                  session), matching the requested display
                                  pattern regardless of any batch field. */}
                              {cell.isLab && (
                                <>
                                  <span style={{ fontWeight: "600", fontSize: "8px", color: "#555", marginLeft: "4px" }}>B1/B2</span>
                                  <div style={{ fontWeight: "800", fontSize: "10.5px", color: "#000", textTransform: "none", marginTop: "3px", letterSpacing: "0.2px", lineHeight: "1.2", background: "rgba(234,179,8,0.15)", borderRadius: "3px", padding: "1px 4px", display: "inline-block" }}>{[facInitials(cell.facultyName), cell.roomName].filter(Boolean).join(" · ")}</div>
                                </>
                              )}
                            </div>
                          ) : <span style={{ color: "#ccc", fontSize: "14px" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: "12px", fontSize: "10px", color: "#110404", fontStyle: "italic" }}>* Lab cells show only Lab Name. Faculty assignments appear in the mapping table below. Split cells show two subjects in one period.</div>

        {/* ── Combined Subject & Faculty Mapping table ── */}
        {data.length > 0 && <div style={{ marginTop: "34px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
            <div style={{ flex: 1, height: "1px", background: "#000" }} /><span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase", color: "#000", whiteSpace: "nowrap" }}>Subject &amp; Faculty Mapping</span><div style={{ flex: 1, height: "1px", background: "#000" }} />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "auto", border: "3px solid #000" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                {["SUBJECT", "CODE", "FACULTY", "FACULTY FOR PRACTICAL"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "#000", border: "1px solid #ccc" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // ✅ One combined table instead of two side-by-side tables:
                // each theory subject row shows its matching lab's practical
                // faculty (if one exists); labs that aren't tied to a
                // subject get their own row with just the practical column.
                //
                // ✅ FIXED: a paired lab (DBMS LAB, PSC LAB, JAVA LAB, C++ LAB,
                // etc.) is driven entirely by the Batch Pairing UI in Config,
                // not by its own "Laboratory Sessions" checkbox — so its
                // checkbox is almost never ticked. That meant `visibleLabs`
                // silently dropped it here, which meant it could never match
                // `matchedLabIds` or fall into `standaloneLabRows`, so its
                // faculty never appeared in this mapping table (and the grid
                // cells above never show faculty at all — only this table
                // does). Any lab that has a partner now counts as visible
                // regardless of its checkbox state.
                const parsePartners = (str) => (str || "").split(",").map(s => s.trim()).filter(Boolean);
                const visibleLabs = labConfig.filter(l => selectedLabs.has(l.name) || parsePartners(l.pairedLabName).length > 0);

                const findMatchingLab = (subjectName) => {
                  const normalized = (subjectName || "").toLowerCase();
                  return visibleLabs.find(l =>
                    (l.parent_subject && l.parent_subject.toLowerCase() === normalized) ||
                    l.name.toLowerCase().startsWith(normalized)
                  );
                };

                const labFacNames = (lab) => {
                  const ids = Array.isArray(lab.facultyIds) ? lab.facultyIds : [];
                  const initialsOf = (fullName) => {
                    const cleaned = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s*/i, "").trim();
                    return cleaned.split(/\s+/).map(w => w[0]).join("").toUpperCase();
                  };
                  return ids
                    .map(id => facultyList.find(f => String(f.id || f._id) === String(id))?.name || "")
                    .filter(Boolean)
                    .map(initialsOf);
                };

                const matchedLabIds = new Set();

                const theoryRows = subjectConfig.map((sc, idx) => {
                  const thFac = facultyList.find(f => String(f.id || f._id) === String(sc.theoryFacultyId));
                  const matchedLab = findMatchingLab(sc.subject);
                  if (matchedLab) matchedLabIds.add(matchedLab.id);
                  const practicalNames = matchedLab ? labFacNames(matchedLab) : [];
                  const col = PALETTE[idx % PALETTE.length];
                  return { key: `sub-${sc.subject}`, subject: sc.subject, code: sc.code, faculty: thFac?.name, practical: practicalNames, col, isFixed: sc.isFixed };
                });

                const standaloneLabRows = visibleLabs
                  .filter(l => !matchedLabIds.has(l.id))
                  .map(lab => ({ key: `lab-${lab.id}`, subject: lab.name, code: lab.code, faculty: null, practical: labFacNames(lab), col: "#666" }));

                const rows = [...theoryRows, ...standaloneLabRows];

                if (rows.length === 0) {
                  return (
                    <tr><td colSpan={4} style={{ padding: "16px 12px", color: "#050505", fontStyle: "italic", fontSize: "11px" }}>No subjects configured</td></tr>
                  );
                }

                return rows.map((r, idx) => (
                  <tr key={r.key} style={{ background: idx % 2 === 0 ? "#fafafa" : "#ffffff" }}>
                    <td style={{ padding: "9px 10px", border: "1px solid #ccc" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: "700", color: "#000", fontFamily: "'Courier New',monospace", fontSize: "12px" }}>{r.subject}</span>
                        {r.isFixed && <span style={{ fontSize: "9px", border: "1px solid #999", color: "#333", padding: "2px 6px", borderRadius: "3px", fontWeight: "700" }}>FIXED</span>}
                      </div>
                    </td>
                    <td style={{ padding: "9px 10px", color: "#080808", fontFamily: "'Courier New',monospace", fontSize: "10px", border: "1px solid #ccc" }}>
                      {r.code || "—"}
                    </td>
                    <td style={{ padding: "9px 10px", color: "#222", fontSize: "11px", border: "1px solid #ccc" }}>
                      {r.faculty || <span style={{ color: "#0f0e0e", fontStyle: "italic" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 10px", color: "#222", fontSize: "11px", border: "1px solid #ccc" }}>
                      {r.practical.length > 0 ? r.practical.join(" / ") : <span style={{ color: "#0f0e0e", fontStyle: "italic" }}>—</span>}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {/* ── Signatures: 5 blocks, matching the PDF (HOD row dropped) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", marginTop: "40px", gap: "8px" }}>
            {["TIMETABLE OFFICERS", "CHIEF TIMETABLE OFFICER", `HEAD(CSE-D${clusterVal})`, "DEAN (ACA)", "PRINCIPAL"].map((label) => (
              <div key={label} style={{ textAlign: "center", padding: "0 8px" }}>
                <div style={{ height: "40px", borderBottom: "1.5px solid #000", marginBottom: "6px" }} />
                <div style={{ fontSize: "8px", fontWeight: "700", color: "#000", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
});

export default TimetableGrid;