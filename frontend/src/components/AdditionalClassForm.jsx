import React, { useState } from "react";
import { IconChevron } from "./icons";

const fieldSt = {
  width: "100%", padding: "9px 12px", borderRadius: "8px",
  background: "rgba(255,255,255,0.05)", color: "#F0EDE8", border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "13px", outline: "none", fontFamily: "Sora,sans-serif", boxSizing: "border-box",
};

const labelSt = {
  display: "block", fontSize: "10px", color: "#64748B", marginBottom: "8px",
  fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.7px",
};

const sectionHeadSt = {
  fontSize: "11px", fontWeight: "700", color: "#64748B",
  textTransform: "uppercase", letterSpacing: "1.3px",
  marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px",
};

export default function AdditionalClassForm({
  sectionsWithTimetables, selectedSections, setSelectedSections,
  selectedSaveBySection, setSelectedSaveBySection,
  availableSubjectsForSelection, subjects, selectedSubject, setSelectedSubject,
  formData, setFormData,
  availableFacultyForSelection, faculty, selectedFaculty, setSelectedFaculty,
  rooms, selectedRoom, setSelectedRoom, suggestedRoom,
  duration, setDuration,
  loading, checkAvailability, saveAdditionalClass, selectedSlots,
}) {
  const [showOptional, setShowOptional] = useState(false);

  const toggleSection = (id) => {
    const idStr = String(id);
    setSelectedSections(prev =>
      prev.includes(idStr) ? prev.filter(s => s !== idStr) : [...prev, idStr]
    );
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px 24px", marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)", fontFamily: "Sora,sans-serif",
    }}>
      <div style={{ fontFamily: "Sora,sans-serif", fontSize: "16px", fontWeight: "700", color: "#F0EDE8", marginBottom: "20px" }}>Class Details</div>

      {/* ── Section 1: Sections (chip picker) ── */}
      <div style={{ marginBottom: "22px" }}>
        <div style={sectionHeadSt}>
          <span style={{ width: "14px", height: "14px", borderRadius: "4px", background: "rgba(234,179,8,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#EAB308" }}>1</span>
          Sections <span style={{ color: "#475569", textTransform: "none", fontWeight: "400", letterSpacing: 0 }}>— only sections with saved timetables</span>
        </div>
        {sectionsWithTimetables.length === 0 ? (
          <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "10px", color: "#64748B", fontSize: "12px", textAlign: "center" }}>
            No sections with saved timetables yet
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {sectionsWithTimetables.map(s => {
              const isSelected = selectedSections.includes(String(s.id));
              const saves = s.__saves || [];
              const hasMultiple = saves.length > 1;
              const currentSaveId = selectedSaveBySection[String(s.id)] || saves[0]?.id || "";

              return (
                <div
                  key={s.id}
                  onClick={() => toggleSection(s.id)}
                  style={{
                    padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
                    fontFamily: "Sora,sans-serif",
                    background: isSelected ? "rgba(234,179,8,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.1)"}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{
                      width: "15px", height: "15px", borderRadius: "4px", flexShrink: 0,
                      border: `1px solid ${isSelected ? "#EAB308" : "rgba(255,255,255,0.2)"}`,
                      background: isSelected ? "#EAB308" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", color: "#0A0C12", fontWeight: "700",
                    }}>{isSelected ? "✓" : ""}</span>
                    <span style={{ fontSize: "12.5px", fontWeight: "600", color: isSelected ? "#EAB308" : "#F0EDE8" }}>
                      C{s.cluster} · Sem{s.semester} · {s.section_name}
                    </span>
                    {s.__orphaned && <span style={{ fontSize: "9px", color: "#F87171", opacity: 0.8 }}>deleted</span>}
                  </div>

                  {!hasMultiple && s.__savedAt && (
                    <div style={{ fontSize: "10px", color: "#475569", fontFamily: "'JetBrains Mono', monospace", marginLeft: "21px" }}>
                      {new Date(s.__savedAt).toLocaleString(undefined, {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  )}

                  {hasMultiple && (
                    <select
                      value={currentSaveId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setSelectedSaveBySection(prev => ({ ...prev, [String(s.id)]: e.target.value }))}
                      style={{
                        marginTop: "6px", marginLeft: "21px", width: "calc(100% - 21px)",
                        padding: "4px 8px", borderRadius: "6px", fontSize: "10.5px",
                        background: "rgba(255,255,255,0.04)", color: "#94A3B8",
                        border: "1px solid rgba(255,255,255,0.1)", outline: "none", cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {saves.map(save => (
                        <option key={save.id} value={save.id}>
                          {save.room_name ? `${save.room_name} · ` : ""}
                          {save.savedAt
                            ? new Date(save.savedAt).toLocaleString(undefined, {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : `Save #${save.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: "10.5px", color: "#475569", marginTop: "10px" }}>
          {selectedSections.length} of {sectionsWithTimetables.length} selected
        </div>
      </div>

      {/* ── Section 2: What & Why ── */}
      <div style={{ marginBottom: "22px" }}>
        <div style={sectionHeadSt}>
          <span style={{ width: "14px", height: "14px", borderRadius: "4px", background: "rgba(234,179,8,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#EAB308" }}>2</span>
          What &amp; Why
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
          <div>
            <label style={labelSt}>Subject *</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={fieldSt}>
              <option value="">Select subject</option>
              {availableSubjectsForSelection.map(s => (
                <option key={s.id} value={s.subject_name}>{s.subject_name}</option>
              ))}
            </select>
            {selectedSections.length > 0 && availableSubjectsForSelection.length < subjects.length && (
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "7px" }}>From section's timetable</div>
            )}
          </div>
          <div>
            <label style={labelSt}>Reason</label>
            <select value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} style={fieldSt}>
              <option value="remedial">Remedial Class</option>
              <option value="makeup">Make-up Session</option>
              <option value="extra">Extra Lecture</option>
              <option value="revision">Revision Class</option>
              <option value="lab">Additional Lab</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Who & Where ── */}
      <div style={{ marginBottom: "22px" }}>
        <div style={sectionHeadSt}>
          <span style={{ width: "14px", height: "14px", borderRadius: "4px", background: "rgba(234,179,8,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#EAB308" }}>3</span>
          Who &amp; Where
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px" }}>
          <div>
            <label style={labelSt}>Faculty *</label>
            <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)} style={fieldSt}>
              <option value="">Select faculty</option>
              {availableFacultyForSelection.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {selectedSections.length > 0 && availableFacultyForSelection.length < faculty.length && (
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "7px" }}>From section's timetable</div>
            )}
          </div>
          <div>
            <label style={labelSt}>Room *</label>
            <select value={selectedRoom || suggestedRoom} onChange={(e) => setSelectedRoom(e.target.value)} style={fieldSt}>
              <option value="">Select room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_name} ({r.room_type})</option>
              ))}
            </select>
            {suggestedRoom && !selectedRoom && (
              <div style={{ fontSize: "10px", color: "#475569", marginTop: "7px" }}>Auto-selected from timetable</div>
            )}
          </div>
          <div>
            <label style={labelSt}>Duration (slots)</label>
            <input type="number" min="1" max="2" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} style={fieldSt} />
          </div>
        </div>
      </div>

      {/* ── Section 4: Optional details (collapsible) ── */}
      <div style={{ marginBottom: "22px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          style={{
            ...sectionHeadSt, background: "none", border: "none", cursor: "pointer",
            padding: 0, width: "100%", justifyContent: "flex-start", marginBottom: showOptional ? "14px" : 0,
          }}
        >
          Optional Details
          <IconChevron style={{ width: 13, height: 13, transform: showOptional ? "rotate(180deg)" : "none", transition: "transform 0.15s", marginLeft: "auto" }} />
        </button>
        {showOptional && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px" }}>
            <div>
              <label style={labelSt}>Student Group Name</label>
              <input type="text" placeholder="e.g., Group A" value={formData.student_group_name} onChange={(e) => setFormData({ ...formData, student_group_name: e.target.value })} style={fieldSt} />
            </div>
            <div>
              <label style={labelSt}>Class Title</label>
              <input type="text" placeholder="Auto-generated if empty" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={fieldSt} />
            </div>
            <div>
              <label style={labelSt}>Failed Students</label>
              <input type="number" min="0" value={formData.failed_students_count} onChange={(e) => setFormData({ ...formData, failed_students_count: e.target.value })} style={fieldSt} />
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: "10px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={checkAvailability}
          disabled={loading || sectionsWithTimetables.length === 0}
          style={{
            padding: "10px 22px", background: "#EAB308", color: "#0A0C12", border: "none", borderRadius: "8px",
            cursor: (loading || sectionsWithTimetables.length === 0) ? "not-allowed" : "pointer",
            fontWeight: "700", fontSize: "12.5px", opacity: (loading || sectionsWithTimetables.length === 0) ? 0.5 : 1,
            transition: "filter 0.15s", fontFamily: "Sora,sans-serif",
            boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
          }}
        >
          {loading ? "Checking…" : "Check Availability"}
        </button>

        <button
          onClick={saveAdditionalClass}
          disabled={selectedSlots.length === 0 || loading}
          style={{
            padding: "10px 22px",
            background: selectedSlots.length > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
            color: selectedSlots.length > 0 ? "#34D399" : "#475569",
            border: `1px solid ${selectedSlots.length > 0 ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "8px", cursor: selectedSlots.length > 0 && !loading ? "pointer" : "not-allowed",
            fontWeight: "700", fontSize: "12.5px", fontFamily: "Sora,sans-serif",
          }}
        >
          Save {selectedSlots.length > 0 ? `(${selectedSlots.length} slot${selectedSlots.length !== 1 ? 's' : ''})` : ''}
        </button>
      </div>
    </div>
  );
}