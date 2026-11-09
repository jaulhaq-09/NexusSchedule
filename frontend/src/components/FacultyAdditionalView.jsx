import React from "react";
import { IconUser, IconInbox } from "./icons";

export default function FacultyAdditionalView({
  faculty, facultyWorkload, savedFacultyTimetables,
  selectedFacultyView, setSelectedFacultyView,
  facultyAdditionalClasses, sections,
  saveFacultyAdditionalTT, deleteFacultyAdditionalTT,
  exportFacultyAdditionalPDF, exporting,
}) {
  const workload = facultyWorkload.find(w => String(w.faculty_id) === String(selectedFacultyView));
  const hasSaved = savedFacultyTimetables.some(tt => String(tt.faculty_id) === String(selectedFacultyView));

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px 24px", marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)", fontFamily: "Sora,sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
        <IconUser style={{ width: 15, height: 15, color: "#EAB308" }} />
        <div style={{ fontFamily: "Sora,sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8" }}>Faculty Additional Classes</div>
      </div>

      <div style={{ marginBottom: workload ? "20px" : "0" }}>
        <label style={{ display:"block", fontSize:"11px", color:"#64748B", marginBottom:"8px", fontWeight:"600", textTransform: "uppercase", letterSpacing: "0.6px" }}>Select Faculty</label>
        <select
          value={selectedFacultyView}
          onChange={(e) => setSelectedFacultyView(e.target.value)}
          style={{ width:"100%", maxWidth:"420px", padding:"9px 12px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", color:"#F0EDE8", border:"1px solid rgba(255,255,255,0.1)", fontSize:"13px", outline:"none", fontFamily: "Sora,sans-serif" }}
        >
          <option value="">— Select faculty —</option>
          {faculty.map(f => {
            const w = facultyWorkload.find(x => String(x.faculty_id) === String(f.id));
            const saved = savedFacultyTimetables.some(tt => String(tt.faculty_id) === String(f.id));
            return (
              <option key={f.id} value={f.id}>
                {saved ? "★ " : ""}{f.name} {w ? `(${w.total_classes} classes, ${w.total_hours}h)` : "(no additional classes)"}
              </option>
            );
          })}
        </select>
        {savedFacultyTimetables.length > 0 && (
          <div style={{ marginTop:"8px", fontSize:"11px", color:"#34D399" }}>
            {savedFacultyTimetables.length} faculty timetable{savedFacultyTimetables.length !== 1 ? "s" : ""} saved
          </div>
        )}
      </div>

      {selectedFacultyView && !workload && (
        <div style={{ textAlign:"center", padding:"44px 20px" }}>
          <IconInbox style={{ width: 32, height: 32, color: "#475569", marginBottom: "12px" }} />
          <div style={{ fontSize:"13px", color: "#64748B" }}>No additional classes assigned to this faculty</div>
        </div>
      )}

      {selectedFacultyView && workload && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:"10px", marginBottom:"18px" }}>
            {[
              { label:"Total Classes", value: workload.total_classes },
              { label:"Total Hours", value: `${workload.total_hours}h` },
              { label:"Subjects", value: workload.subjects.length },
              { label:"Sections", value: workload.sections.length },
            ].map(stat => (
              <div key={stat.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"10px", padding:"12px 14px" }}>
                <div style={{ fontSize:"10px", color:"#64748B", textTransform:"uppercase", letterSpacing: "0.6px", marginBottom:"6px" }}>{stat.label}</div>
                <div style={{ fontSize:"20px", fontWeight:"700", color:"#EAB308", fontFamily: "'JetBrains Mono',monospace" }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:"8px", marginBottom:"18px", flexWrap: "wrap" }}>
            <button
              onClick={() => saveFacultyAdditionalTT(selectedFacultyView, facultyAdditionalClasses)}
              style={{ padding:"7px 16px", background:"rgba(16,185,129,0.12)", color:"#34D399", border: "1px solid rgba(16,185,129,0.3)", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"12px", fontFamily: "Sora,sans-serif" }}
            >
              Save Faculty TT
            </button>
            <button
              onClick={() => exportFacultyAdditionalPDF(selectedFacultyView)}
              disabled={exporting}
              style={{ padding:"7px 16px", background:"rgba(255,255,255,0.05)", color:"#94A3B8", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", cursor: exporting ? "not-allowed" : "pointer", fontWeight:"600", fontSize:"12px", opacity: exporting ? 0.6 : 1, fontFamily: "Sora,sans-serif" }}
            >
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
            {hasSaved && (
              <button
                onClick={() => deleteFacultyAdditionalTT(selectedFacultyView)}
                style={{ padding:"7px 16px", background:"rgba(220,38,38,0.1)", color:"#F87171", border:"1px solid rgba(220,38,38,0.25)", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"12px", fontFamily: "Sora,sans-serif" }}
              >
                Delete Saved TT
              </button>
            )}
          </div>

          <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:"12px", padding:"14px" }}>
            <div style={{ fontSize:"11px", color:"#64748B", marginBottom:"12px", fontWeight:"600", textTransform: "uppercase", letterSpacing: "0.6px" }}>Additional Classes</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {facultyAdditionalClasses.map(ac => (
                <div key={ac.id} style={{ background:"rgba(255,255,255,0.03)", borderRadius:"9px", padding:"12px 14px", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", gap: "12px" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#EAB308", marginBottom:"5px" }}>{ac.subject_name}</div>
                      <div style={{ fontSize:"11px", color:"#64748B", marginBottom:"8px", fontFamily: "'JetBrains Mono',monospace" }}>
                        {ac.day} · {ac.time} · {ac.room_name}
                      </div>
                      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                        {ac.section_ids?.map(sid => {
                          const sec = sections.find(s => String(s.id) === String(sid));
                          return sec ? (
                            <span key={sid} style={{ background:"rgba(255,255,255,0.06)", color:"#94A3B8", padding:"3px 9px", borderRadius:"6px", fontSize:"10px", fontWeight:"600" }}>
                              C{sec.cluster}·S{sec.semester}·{sec.section_name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <span style={{ background:"rgba(255,255,255,0.05)", color:"#64748B", padding:"4px 10px", borderRadius:"7px", fontSize:"10px", fontWeight:"600", textTransform:"capitalize", whiteSpace: "nowrap" }}>
                      {ac.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}