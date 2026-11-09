import React, { useState, useEffect } from "react";
import { facultyTimetableAPI } from "../services/api";

const inputSt = {
  padding: "8px 12px",
  borderRadius: "8px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F0EDE8",
  fontSize: "13px",
  fontFamily: "Sora,sans-serif",
  outline: "none",
};

const btnSt = (bg, color, border) => ({
  padding: "6px 14px",
  background: bg,
  color,
  border: `1px solid ${border}`,
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
  fontFamily: "Sora,sans-serif",
});

const SavedFacultyTimetables = ({ onView, onExport }) => {
  const [savedList, setSavedList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
 
  useEffect(() => {
    loadFacultyTimetables();
  }, []);
 
  useEffect(() => {
    applyFilters();
  }, [savedList, showArchived, filterYear, filterFaculty, filterSemester]);
 
  const loadFacultyTimetables = async () => {
    const allTT = await facultyTimetableAPI.getAll();
    const archived = await facultyTimetableAPI.search({ is_archived: true });
    setSavedList([...(allTT || []), ...(archived || [])]);
  };
 
  const applyFilters = () => {
    let filtered = [...savedList];
    if (!showArchived) filtered = filtered.filter(tt => !tt.is_archived);
    if (filterYear) filtered = filtered.filter(tt => tt.academic_year === filterYear);
    if (filterFaculty) filtered = filtered.filter(tt => tt.faculty_name.toLowerCase().includes(filterFaculty.toLowerCase()));
    if (filterSemester) filtered = filtered.filter(tt => tt.semester === parseInt(filterSemester));
    setFilteredList(filtered);
  };
 
  const handleArchive = async (id) => {
    await facultyTimetableAPI.archive(id, true);
    loadFacultyTimetables();
  };
 
  const handleRestore = async (id) => {
    await facultyTimetableAPI.archive(id, false);
    loadFacultyTimetables();
  };
 
  const handleDelete = async (id) => {
    if (window.confirm("Delete this faculty timetable?")) {
      await facultyTimetableAPI.delete(id);
      loadFacultyTimetables();
    }
  };
 
  return (
    <div style={{
      marginTop: "24px", padding: "20px 24px",
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      fontFamily: "Sora,sans-serif", color: "#F0EDE8",
    }}>
      <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>
        📚 Saved Faculty Timetables <span style={{ color: "#64748B", fontWeight: "400" }}>({filteredList.length})</span>
      </h3>
 
      <div style={{ marginBottom: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input type="text" placeholder="Search faculty..." value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} style={inputSt} />
        <input type="text" placeholder="Academic Year (e.g., 2025-26)" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={inputSt} />
        <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} style={inputSt}>
          <option value="">All Semesters</option>
          <option value="1">Semester 1</option>
          <option value="2">Semester 2</option>
          <option value="3">Semester 3</option>
          <option value="4">Semester 4</option>
          <option value="5">Semester 5</option>
          <option value="6">Semester 6</option>
          <option value="7">Semester 7</option>
          <option value="8">Semester 8</option>
        </select>
        <button
          onClick={() => setShowArchived(!showArchived)}
          style={btnSt(showArchived ? "rgba(234,179,8,0.15)" : "rgba(129,140,248,0.15)", showArchived ? "#EAB308" : "#818CF8", showArchived ? "rgba(234,179,8,0.3)" : "rgba(129,140,248,0.3)")}
        >
          📂 {showArchived ? "Hide" : "Show"} Archived ({savedList.filter(tt => tt.is_archived).length})
        </button>
      </div>
 
      <div>
        {filteredList.length === 0 ? (
          <p style={{ color: "#64748B", fontSize: "13px" }}>No faculty timetables found</p>
        ) : filteredList.map(tt => (
          <div key={`${tt.id}-${tt.is_archived}`} style={{
            padding: "14px 16px", marginBottom: "10px",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px",
            background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ marginBottom: "10px" }}>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#F0EDE8" }}>{tt.faculty_name}</h4>
              <small style={{ color: "#64748B", fontSize: "11px", fontFamily: "'JetBrains Mono',monospace" }}>
                {tt.academic_year} | Sem {tt.semester}
                {tt.is_archived && <span style={{ marginLeft: "10px", color: "#EAB308" }}>📦 Archived</span>}
              </small>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => onView(tt)} style={btnSt("rgba(16,185,129,0.15)", "#34D399", "rgba(16,185,129,0.3)")}>👁️ View</button>
              <button onClick={() => onExport(tt)} style={btnSt("rgba(129,140,248,0.15)", "#818CF8", "rgba(129,140,248,0.3)")}>📥 Export</button>
              {!tt.is_archived ? (
                <button onClick={() => handleArchive(tt.id)} style={btnSt("rgba(234,179,8,0.15)", "#EAB308", "rgba(234,179,8,0.3)")}>📦 Archive</button>
              ) : (
                <button onClick={() => handleRestore(tt.id)} style={btnSt("rgba(16,185,129,0.15)", "#34D399", "rgba(16,185,129,0.3)")}>♻️ Restore</button>
              )}
              <button onClick={() => handleDelete(tt.id)} style={btnSt("rgba(220,38,38,0.12)", "#F87171", "rgba(220,38,38,0.25)")}>🗑️ Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
 
export default SavedFacultyTimetables;