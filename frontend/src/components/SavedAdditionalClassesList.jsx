import React from "react";
import { IconList, IconInbox } from "./icons";

export default function SavedAdditionalClassesList({
  additionalClasses, filteredAdditionalClasses,
  sectionsWithTimetables, filterSection, setFilterSection,
  exportAdditionalClassesPDF, exporting, deleteClass,
}) {
  const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const grouped = {};
  filteredAdditionalClasses.forEach(ac => {
    const day = ac.day || "Unscheduled";
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(ac);
  });
  const days = Object.keys(grouped).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  days.forEach(day => grouped[day].sort((a, b) => (a.time || "").localeCompare(b.time || "")));

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)", fontFamily: "Sora,sans-serif",
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <IconList style={{ width: 15, height: 15, color: "#EAB308" }} />
          <div style={{ fontFamily: "Sora,sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8" }}>
            Saved Additional Classes <span style={{ color: "#64748B", fontWeight: "400" }}>({additionalClasses.length})</span>
          </div>
        </div>
        {additionalClasses.length > 0 && (
          <button
            onClick={exportAdditionalClassesPDF}
            disabled={exporting}
            style={{
              padding:"6px 16px", background:"rgba(255,255,255,0.05)", color:"#94A3B8",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px",
              cursor: exporting ? "not-allowed" : "pointer", fontWeight:"600", fontSize:"12px",
              opacity: exporting ? 0.6 : 1, fontFamily: "Sora,sans-serif",
            }}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        )}
      </div>

      {additionalClasses.length > 0 && (
        <div style={{ marginBottom:"18px", display:"flex", gap:"10px", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:"9px", border:"1px solid rgba(255,255,255,0.07)", flexWrap: "wrap" }}>
          <label style={{ fontSize:"11px", color:"#64748B", fontWeight:"600", minWidth:"105px" }}>Filter by Section</label>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            style={{ padding:"7px 10px", borderRadius:"7px", background:"rgba(255,255,255,0.05)", color:"#F0EDE8", border:"1px solid rgba(255,255,255,0.1)", fontSize:"12px", outline:"none", flex:"1", maxWidth: "280px", fontFamily: "Sora,sans-serif" }}
          >
            <option value="">All Sections</option>
            {sectionsWithTimetables.map(s => (
              <option key={s.id} value={s.id}>C{s.cluster} · Sem{s.semester} · {s.section_name}</option>
            ))}
          </select>
          {filterSection && (
            <button
              onClick={() => setFilterSection('')}
              style={{ padding:"5px 12px", background:"rgba(220,38,38,0.1)", color:"#F87171", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"6px", cursor:"pointer", fontSize:"11px", fontWeight:"600", fontFamily: "Sora,sans-serif" }}
            >
              Clear
            </button>
          )}
          <span style={{ fontSize:"11px", color:"#475569", marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace" }}>
            {filteredAdditionalClasses.length} of {additionalClasses.length}
          </span>
        </div>
      )}

      {filteredAdditionalClasses.length === 0 ? (
        <div style={{ textAlign:"center", padding:"44px 20px" }}>
          <IconInbox style={{ width: 32, height: 32, color: "#475569", marginBottom: "12px" }} />
          <div style={{ fontSize:"13px", color: "#64748B" }}>
            {filterSection ? "No additional classes found for this section" : "No additional classes scheduled yet"}
          </div>
          {filterSection && (
            <button
              onClick={() => setFilterSection('')}
              style={{ marginTop:"14px", padding:"7px 16px", background:"rgba(255,255,255,0.05)", color:"#94A3B8", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"7px", cursor:"pointer", fontSize:"12px", fontFamily: "Sora,sans-serif" }}
            >
              Show All
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {days.map(day => (
            <div key={day}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#EAB308", letterSpacing: "0.5px" }}>{day.toUpperCase()}</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>{grouped[day].length}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: "8px" }}>
                {grouped[day].map(ac => (
                  <div key={ac.id} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px", padding: "11px 13px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "6px", marginBottom: "5px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#EAB308", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ac.subject_name}</div>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: ac.status === "scheduled" ? "#10B981" : "#64748B", flexShrink: 0 }} title={ac.status || "scheduled"} />
                    </div>

                    <div style={{ fontSize: "10.5px", color: "#94A3B8", fontFamily: "'JetBrains Mono',monospace", marginBottom: "3px" }}>
                      {ac.time}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#64748B", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ac.faculty_name}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9.5px", color: "#475569", marginBottom: "9px" }}>
                      <span>{ac.section_ids?.map(secId => sectionsWithTimetables.find(s => String(s.id) === String(secId))?.section_name).filter(Boolean).join(", ") || "—"}</span>
                      <span>Rm {ac.room_name}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: "9.5px", color: "#475569", textTransform: "capitalize" }}>{ac.reason}</span>
                      <button
                        onClick={() => deleteClass(ac.id)}
                        style={{ padding: "3px 9px", background: "rgba(220,38,38,0.1)", color: "#F87171", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "5px", cursor: "pointer", fontSize: "9.5px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}