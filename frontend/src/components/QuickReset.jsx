/**
 * QuickReset.jsx — One-Click Data Reset & Import
 * ════════════════════════════════════════════════════════════════
 * Deletes all existing data and imports fresh sample data
 * 
 * Props:
 *   - target: "faculty" | "subjects" | "rooms" | "sections"
 *   - onComplete: () => void (refresh callback)
 */

import { useState } from "react";
import API from "../services/api";


const SAMPLE_DATA = {
  faculty: [
    { name: "Dr. Anna Malini M", designation: "Professor", subjects: "DBMS, Database Systems", workload: 18 },
    { name: "Dr. Harish Kumar N", designation: "Associate Professor", subjects: "ADA, Algorithms", workload: 16 },
    { name: "Prof. BG/HKN", designation: "Assistant Professor", subjects: "Microcontroller", workload: 14 },
    { name: "Prof. DGY/MA", designation: "Assistant Professor", subjects: "UHV, Human Values", workload: 10 },
    { name: "Dr. Rajesh Kumar", designation: "Professor", subjects: "Computer Networks", workload: 18 },
    { name: "Prof. Sneha Sharma", designation: "Assistant Professor", subjects: "Operating Systems", workload: 12 },
    { name: "Dr. Priya Menon", designation: "Associate Professor", subjects: "Software Engineering", workload: 16 },
    { name: "Prof. Amit Patel", designation: "Assistant Professor", subjects: "Web Technologies", workload: 14 },
  ],
  
  subjects: [
    { subject_name: "Database Management System", subject_code: "DBMS", hours_per_week: 4 },
    { subject_name: "Analysis and Design of Algorithms", subject_code: "ADA", hours_per_week: 4 },
    { subject_name: "Microcontroller and Embedded Systems", subject_code: "MC", hours_per_week: 3 },
    { subject_name: "Universal Human Values", subject_code: "UHV", hours_per_week: 1 },
    { subject_name: "Computer Networks", subject_code: "CN", hours_per_week: 4 },
    { subject_name: "Operating Systems", subject_code: "OS", hours_per_week: 4 },
    { subject_name: "Software Engineering", subject_code: "SE", hours_per_week: 3 },
    { subject_name: "Web Technologies", subject_code: "WT", hours_per_week: 3 },
    { subject_name: "Discrete Mathematical Structures", subject_code: "DMS", hours_per_week: 4 },
    { subject_name: "Data Structures", subject_code: "DS", hours_per_week: 4 },
  ],
  
  rooms: [
    { room_name: "R301", room_type: "Classroom", capacity: 60 },
    { room_name: "R302", room_type: "Classroom", capacity: 73 },
    { room_name: "R303", room_type: "Classroom", capacity: 80 },
    { room_name: "R401", room_type: "Classroom", capacity: 60 },
    { room_name: "R402", room_type: "Classroom", capacity: 65 },
    { room_name: "R403", room_type: "Classroom", capacity: 70 },
    { room_name: "R501", room_type: "Classroom", capacity: 74 },
    { room_name: "LAB-A", room_type: "Lab", capacity: 40 },
    { room_name: "LAB-B", room_type: "Lab", capacity: 40 },
  ],
  
  sections: [
    { section_name: "CSE-A", cluster: 1, semester: 4 },
    { section_name: "CSE-B", cluster: 1, semester: 4 },
    { section_name: "CSE-C", cluster: 2, semester: 4 },
    { section_name: "CSE-D", cluster: 2, semester: 4 },
    { section_name: "ECE-A", cluster: 1, semester: 6 },
    { section_name: "ECE-B", cluster: 2, semester: 6 },
    { section_name: "MECH-A", cluster: 3, semester: 2 },
    { section_name: "MECH-B", cluster: 3, semester: 2 },
  ],
};

const ENDPOINTS = {
  faculty: "/faculty",
  subjects: "/subjects",
  rooms: "/rooms",
  sections: "/sections",
};

const LABELS = {
  faculty: "Faculty",
  subjects: "Subjects",
  rooms: "Rooms",
  sections: "Sections",
};

export default function QuickReset({ target, onComplete }) {
  const [stage, setStage] = useState("confirm"); // idle | confirm | deleting | importing | done | error
  const [progress, setProgress] = useState({ deleted: 0, imported: 0, total: 0 });
  const [error, setError] = useState("");

const handleReset = async () => {
  console.log("🔄 Starting reset...");
  setStage("deleting");
  setError("");
  
  try {
    const response = await API.get(ENDPOINTS[target]);
    const existing = response.data || [];
    console.log("📋 Existing records:", existing.length);
    
    setProgress({ deleted: 0, imported: 0, total: existing.length + SAMPLE_DATA[target].length });
    
    // Delete existing
    for (let i = 0; i < existing.length; i++) {
      const record = existing[i];
      console.log(`🗑️ Deleting record ${record.id}...`);
      try {
        await API.delete(`${ENDPOINTS[target]}/${record.id}`);
        setProgress(p => ({ ...p, deleted: p.deleted + 1 }));
        console.log(`✅ Deleted ${record.id}`);
      } catch (err) {
        console.error(`❌ Failed to delete ${target} ${record.id}:`, err);
      }
    }
      // Step 3: Import sample data
      //setStage("importing");
      //const sampleRecords = SAMPLE_DATA[target];
      
      //for (let i = 0; i < sampleRecords.length; i++) {
        //const record = sampleRecords[i];
        //try {
          //await API.post(ENDPOINTS[target], record);
          //setProgress(p => ({ ...p, imported: p.imported + 1 }));
        //} catch (err) {
          //console.error(`Failed to import ${target} record:`, err);
        //}
     //}
      
      // Done!
      setStage("done");
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);
      
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Reset failed");
      setStage("error");
    }
  };

  if (stage === "idle") {
    return null; // Button is shown in parent component
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
        fontFamily: "Sora, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          maxWidth: "440px",
          width: "100%",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Confirm */}
        {stage === "confirm" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ margin: "0 0 10px", fontSize: "18px", fontWeight: "700", color: "#F0EDE8" }}>
              Reset All {LABELS[target]}?
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#94A3B8", lineHeight: 1.7 }}>
              This will <strong style={{ color: "#F87171" }}>permanently delete ALL</strong> existing {LABELS[target].toLowerCase()}.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => setStage("idle")}
                style={{
                  padding: "10px 22px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#94A3B8",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  fontFamily: "Sora, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: "10px 22px",
                  background: "linear-gradient(135deg,#DC2626,#B91C1C)",
                  border: "none",
                  color: "#FFF",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "700",
                  fontFamily: "Sora, sans-serif",
                  boxShadow: "0 4px 16px rgba(220,38,38,0.4)",
                }}
              >
                Yes, Reset All Data
              </button>
            </div>
          </>
        )}

        {/* Deleting */}
        {stage === "deleting" && (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                border: "3px solid rgba(220,38,38,0.2)",
                borderTopColor: "#F87171",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>
              Deleting Old Data...
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              Deleted {progress.deleted} of {progress.total - SAMPLE_DATA[target].length} records
            </p>
          </>
        )}

        {/* Importing */}
        {stage === "importing" && (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                border: "3px solid rgba(16,185,129,0.2)",
                borderTopColor: "#34D399",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>
              Importing Sample Data...
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              Imported {progress.imported} of {SAMPLE_DATA[target].length} records
            </p>
          </>
        )}

        {/* Done */}
        {stage === "done" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
            <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: "700", color: "#34D399" }}>
              Reset Complete!
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              Successfully imported {progress.imported} {LABELS[target].toLowerCase()}
            </p>
          </>
        )}

        {/* Error */}
        {stage === "error" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>❌</div>
            <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: "700", color: "#F87171" }}>
              Reset Failed
            </h3>
            <p style={{ 
              margin: "0 0 20px", 
              fontSize: "12px", 
              color: "#F87171", 
              fontFamily: "'JetBrains Mono', monospace",
              background: "rgba(220,38,38,0.1)",
              padding: "12px",
              borderRadius: "8px",
            }}>
              {error}
            </p>
            <button
              onClick={() => setStage("idle")}
              style={{
                padding: "10px 20px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
                fontFamily: "Sora, sans-serif",
              }}
            >
              Close
            </button>
          </>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}