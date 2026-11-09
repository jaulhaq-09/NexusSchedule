/**
 * OCRTableUpload.jsx — OCR Table Import Modal
 * ════════════════════════════════════════════════════════════════
 * Modern modal for bulk-importing data from Excel/PDF/Images
 *
 * Props:
 *   - target:       "faculty" | "subjects" | "rooms" | "sections"
 *   - onClose:      () => void
 *   - onImported:   () => void
 *   - globalMeta:   { cluster, semester } — for sections only
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ocrExtractTable, bulkImportFaculty, bulkImportSubjects, bulkImportRooms, bulkImportSections, bulkImportLabs, getDepartments } from "../services/api";

const BULK_APIS = {
  faculty:  bulkImportFaculty,
  subjects: bulkImportSubjects,
  rooms:    bulkImportRooms,
  sections: bulkImportSections,
  labs:     bulkImportLabs,
};

const TARGET_LABELS = {
  faculty:  "Faculty",
  subjects: "Subjects",
  rooms:    "Rooms",
  sections: "Sections",
  labs: "Labs",  // ← MUST HAVE
};

const TARGET_FIELDS = {
  faculty: [
    { key: "name",        label: "Name",        type: "text"   },
    { key: "designation", label: "Designation", type: "text"   },
    { key: "subjects",    label: "Subjects",    type: "text"   },
    { key: "workload",    label: "Workload",    type: "number" },
    { key: "labs",         label: "Labs",         type: "text"   }, // matched exactly against real Lab names
  ],
  subjects: [
    { key: "subject_name",    label: "Subject Name",    type: "text"   },
    { key: "subject_code",    label: "Subject Code",    type: "text"   },
    { key: "hours_per_week",  label: "Hours/Week",      type: "number" },
    { key: "semester",        label: "Semester",        type: "number" },
  ],
  rooms: [
    { key: "room_name", label: "Room Name", type: "text"   },
    { key: "room_type", label: "Room Type", type: "text"   },
    { key: "capacity",  label: "Capacity",  type: "number" },
  ],
  sections: [
    { key: "section_name", label: "Section Name", type: "text"   },
    { key: "cluster",      label: "Cluster No",   type: "number" },
    { key: "semester",     label: "Semester No",  type: "number" },
  ],
  labs: [
    { key: "lab_name", label: "Lab Name", type: "text" },
    { key: "lab_code", label: "Lab Code", type: "text" },
    { key: "hours_per_week", label: "Hours/Week", type: "number" },
    { key: "room_name", label: "Room", type: "text" }, // matched by name against existing Rooms (LAB type)
  ],
};

/**
 * Smart field normalization - handles any column name variation
 * Examples:
 *   "Faculty_Name" → "name"
 *   "SUBJECT NAME" → "subject_name"
 *   "Cluster No" → "cluster"
 *   "Hours/Week" → "hours_per_week"
 */
/**
 * Ultra-aggressive field normalization - handles ANY column name variation
 */
function normalizeRecord(record, fields) {
  const normalized = {};
  
  // Helper: normalize string for comparison
  const normalize = (str) => {
    if (!str) return "";
    return String(str).toLowerCase()
      .replace(/[\s_\-\/\(\)]/g, "")  // Remove separators and parentheses
      .replace(/[^a-z0-9]/g, "");      // Remove non-alphanumeric
  };
  
  // Build keyword map for each target field
  const fieldKeywords = {};
  fields.forEach(f => {
    const normalized_key = normalize(f.key);
    const normalized_label = normalize(f.label);
    
    fieldKeywords[f.key] = {
      key: normalized_key,
      label: normalized_label,
      keywords: new Set()
    };
    
    // Extract all meaningful words
    const words = [
      ...f.key.split('_'),
      ...f.label.toLowerCase().split(/[\s_\-\/]/g)
    ].filter(w => w.length > 2);  // Ignore short words
    
    words.forEach(w => fieldKeywords[f.key].keywords.add(normalize(w)));
  });
  
  // Map each Excel column to target field
  Object.entries(record).forEach(([excelColumn, value]) => {
    const normColumn = normalize(excelColumn);
    
    // Skip if this looks like a header value
    if (value === excelColumn) {
      return;  // Header row detected, skip
    }
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [fieldKey, meta] of Object.entries(fieldKeywords)) {
      let score = 0;
      
      // Exact match on key or label
      if (normColumn === meta.key || normColumn === meta.label) {
        score = 1000;
      }
      // Partial match
      else if (normColumn.includes(meta.key) || meta.key.includes(normColumn)) {
        score = 500;
      }
      // Keyword matching
      else {
        for (const keyword of meta.keywords) {
          if (normColumn.includes(keyword)) {
            score += 100;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fieldKey;
      }
    }
    
    // Store if we found a match
    if (bestMatch && bestScore > 0) {
      normalized[bestMatch] = value;
    }
  });
  
  return normalized;
}

export default function OCRTableUpload({ target, onClose, onImported, globalMeta }) {
  const [stage, setStage]             = useState("idle");
  const [records, setRecords]         = useState([]);
  const [fields]                      = useState(TARGET_FIELDS[target] || []);
  const [errorMsg, setErrorMsg]       = useState("");
  const [dragging, setDragging]       = useState(false);
  const [result, setResult]           = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();
  const [departments, setDepartments]       = useState([]);
  // Coordinators import into their own department + cluster (locked)
  const me = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const [defaultDept, setDefaultDept]       = useState(me.department_id != null ? String(me.department_id) : "");
  const [defaultCluster, setDefaultCluster] = useState(me.cluster != null ? String(me.cluster) : "");

  useEffect(() => {
    if (target === "faculty" || target === "subjects") {
      getDepartments().then(r => setDepartments(r.data || [])).catch(() => {});
    }
  }, [target]);

  const upload = useCallback(async (file) => {
    if (!file) return;
    setStage("uploading");
    setErrorMsg("");

    try {
      const data = await ocrExtractTable(file, target);

      // ✅ Filter out header row if it was included as data
      const filteredRecords = (data.records || []).filter(r => {
        // Check if all values match their keys (indicates header row)
        const entries = Object.entries(r);
        if (entries.length === 0) return false;
        
        const headerLikeCount = entries.filter(([key, value]) => {
          const normKey = String(key).toLowerCase().replace(/[^a-z]/g, "");
          const normVal = String(value).toLowerCase().replace(/[^a-z]/g, "");
          return normKey === normVal || 
                normVal === "labname" || 
                normVal === "labcode" ||
                normVal === "hoursweek" ||
                normVal === "hoursperweek";
        }).length;
        
        // If more than half the fields look like headers, skip this row
        return headerLikeCount < entries.length / 2;
      });

      // Use filtered records
      data.records = filteredRecords;

      if (!data.success || !data.records || data.records.length === 0) {
        setErrorMsg(
          `No ${TARGET_LABELS[target]} data could be extracted.\n\n` +
          "💡 Tips for better results:\n" +
          "• Upload a clear photo of a table with column headers\n" +
          "• For best results use XLSX or PDF files\n" +
          "• Make sure the table has headers matching the required fields\n" +
          "• Avoid handwritten or blurry images"
        );
        setStage("error");
        return;
      }

      // ✅ Normalize OCR keys to match field keys
      const normalizedRecords = data.records.map(r => normalizeRecord(r, TARGET_FIELDS[target] || []));

      setResult(data);
      setRecords(normalizedRecords);
      setStage("preview");

    } catch (err) {
      setErrorMsg(err.message || "Upload failed");
      setStage("error");
    }
  }, [target]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (f) upload(f);
  };

  const updateCell = (rowIdx, key, value) => {
    setRecords(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [key]: value };
      return updated;
    });
  };

  const deleteRow = (rowIdx) => {
    setRecords(prev => prev.filter((_, i) => i !== rowIdx));
  };

  const addRow = () => {
    const empty = {};
    fields.forEach(f => {
      empty[f.key] = f.type === "number" ? "" : "";
    });
    setRecords(prev => [...prev, empty]);
  };

  const doImport = async () => {
    const valid = records.filter(r => {
      return fields.some(f => {
        const val = r[f.key];
        return val !== undefined && val !== null && val !== "" && val !== 0;
      });
    });

    if (valid.length === 0) {
      setErrorMsg("No valid records to import. Fill in at least one field per row.");
      return;
    }

    // ✅ Sanitize: number fields → int or null, text fields → string
    const sanitized = valid.map(r => {
      const row = { ...r };
      fields.forEach(f => {
        if (f.type === "number") {
          const parsed = parseInt(row[f.key]);
          row[f.key] = isNaN(parsed) ? null : parsed;
        } else {
          if (row[f.key] !== null && row[f.key] !== undefined) {
            row[f.key] = String(row[f.key]);
          }
        }
      });
      return row;
    });

    // ✅ For sections: use row-level cluster/semester first, fallback to globalMeta
    let payload = sanitized;
    if (target === "sections") {
      payload = sanitized.map(r => ({
        ...r,
        cluster:  r.cluster  || (globalMeta?.cluster)  || 1,
        semester: r.semester || (globalMeta?.semester) || 1,
      }));
    }

    if (target === "faculty") {
      payload = sanitized.map(r => ({
        ...r,
        department_id: defaultDept ? Number(defaultDept) : null,
        cluster: defaultCluster ? Number(defaultCluster) : null,
      }));
    }

    if (target === "subjects") {
      payload = sanitized.map(r => ({
        ...r,
        department_id: defaultDept ? Number(defaultDept) : null,
      }));
    }

    setStage("importing");
    try {
      const bulkFn = BULK_APIS[target];
      const res = await bulkFn(payload);
      const data = res.data || res;
      setImportResult(data);
      setStage("done");
      if (onImported) onImported();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Import failed";
      setErrorMsg(typeof detail === "string" ? detail : JSON.stringify(detail));
      setStage("error");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
        fontFamily: "Sora, sans-serif"
      }}
      onClick={onClose}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        .ocr-input { transition: all 0.2s; }
        .ocr-input:focus { border-color: #EAB308; box-shadow: 0 0 0 3px rgba(234,179,8,0.1); outline: none; }
        .ocr-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .ocr-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          maxWidth: "1020px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          animation: "slideUp 0.3s ease"
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "22px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px", height: "40px",
              borderRadius: "10px",
              background: "#EAB308",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px",
              boxShadow: "0 8px 24px rgba(234,179,8,0.3)"
            }}>📷</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#F0EDE8" }}>
                Import {TARGET_LABELS[target]} from Image
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                Upload table → OCR extracts data → review & import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "34px", height: "34px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94A3B8", cursor: "pointer", fontSize: "16px", transition: "all 0.2s"
            }}
          >✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "28px", overflow: "auto", flex: 1 }}>

          {/* IDLE / ERROR */}
          {(stage === "idle" || stage === "error") && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current.click()}
                style={{
                  border: dragging ? "2px dashed #EAB308" : "2px dashed rgba(255,255,255,0.15)",
                  borderRadius: "14px",
                  padding: "52px 40px",
                  textAlign: "center",
                  background: dragging ? "rgba(234,179,8,0.05)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontSize: "56px", marginBottom: "18px" }}>📋</div>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>
                  Drop your {TARGET_LABELS[target]} table here
                </h3>
                <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748B", lineHeight: 1.6 }}>
                  Image of a table → data extracted via OCR<br />
                  Or upload XLSX / PDF / DOCX for direct extraction
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf,.docx,.xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
                  className="ocr-btn"
                  style={{
                    padding: "10px 26px", borderRadius: "10px",
                    background: "#EAB308",
                    border: "none", color: "#0A0C12", fontSize: "13px",
                    fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
                    boxShadow: "0 4px 20px rgba(234,179,8,0.3)"
                  }}
                >Choose File</button>
                <div style={{ marginTop: "18px", fontSize: "11px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
                  Supported: JPEG · PNG · PDF · DOCX · XLSX (max 20 MB)
                </div>
              </div>

              {stage === "error" && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{
                    padding: "18px 22px", borderRadius: "12px",
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.25)",
                    color: "#F87171", fontSize: "12px",
                    fontFamily: "'JetBrains Mono', monospace",
                    lineHeight: 1.8, whiteSpace: "pre-wrap"
                  }}>⚠ {errorMsg}</div>
                  <button
                    onClick={() => { setStage("idle"); setErrorMsg(""); }}
                    style={{
                      marginTop: "14px", padding: "10px 22px",
                      background: "rgba(234,179,8,0.1)",
                      border: "1px solid rgba(234,179,8,0.3)",
                      color: "#EAB308", borderRadius: "8px",
                      cursor: "pointer", fontWeight: "600", fontSize: "12px"
                    }}
                  >Try Again</button>
                </div>
              )}
            </>
          )}

          {/* UPLOADING */}
          {stage === "uploading" && (
            <div style={{ textAlign: "center", padding: "72px 40px" }}>
              <div style={{
                width: "48px", height: "48px",
                border: "3px solid rgba(234,179,8,0.2)",
                borderTopColor: "#EAB308", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px"
              }} />
              <div style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "6px" }}>Extracting table data...</div>
              <div style={{ fontSize: "11px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>This may take 5–30 seconds</div>
            </div>
          )}

          {/* IMPORTING */}
          {stage === "importing" && (
            <div style={{ textAlign: "center", padding: "72px 40px" }}>
              <div style={{
                width: "48px", height: "48px",
                border: "3px solid rgba(234,179,8,0.2)",
                borderTopColor: "#EAB308", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 20px"
              }} />
              <div style={{ fontSize: "14px", color: "#94A3B8" }}>Importing {records.length} records...</div>
            </div>
          )}

          {/* DONE */}
          {stage === "done" && importResult && (
            <div style={{ textAlign: "center", padding: "52px 40px" }}>
              <div style={{ fontSize: "56px", marginBottom: "18px" }}>✅</div>
              <h3 style={{ margin: "0 0 10px", fontSize: "18px", fontWeight: "700", color: "#34D399" }}>
                {importResult.imported} {TARGET_LABELS[target]} Imported!
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                {importResult.errors?.length > 0
                  ? `${importResult.errors.length} record(s) had errors and were skipped`
                  : "All records imported successfully"}
              </p>
              {importResult.skipped?.length > 0 && (
                <div style={{
                  marginTop: "16px", padding: "12px 16px", borderRadius: "10px", textAlign: "left",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                  color: "#F59E0B", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.7, maxHeight: "160px", overflowY: "auto",
                }}>
                  {importResult.skipped.length} skipped (already exist):<br />
                  {importResult.skipped.map((s, i) => <div key={i}>• {s}</div>)}
                </div>
              )}
            </div>
          )}

          {/* PREVIEW */}
          {stage === "preview" && records.length > 0 && (
            <>
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <span style={{
                  padding: "6px 14px", borderRadius: "20px",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#34D399", fontSize: "11px", fontWeight: "700",
                  fontFamily: "'JetBrains Mono', monospace"
                }}>✓ {records.length} rows</span>
                <span style={{
                  padding: "6px 14px", borderRadius: "20px",
                  background: "rgba(234,179,8,0.12)",
                  border: "1px solid rgba(234,179,8,0.25)",
                  color: "#EAB308", fontSize: "11px", fontWeight: "700",
                  fontFamily: "'JetBrains Mono', monospace"
                }}>{fields.length} columns</span>
                {result?.source && (
                  <span style={{
                    padding: "6px 14px", borderRadius: "20px",
                    background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    color: "#60A5FA", fontSize: "11px", fontWeight: "700",
                    fontFamily: "'JetBrains Mono', monospace"
                  }}>{result.source}</span>
                )}
              </div>

              {(target === "faculty" || target === "subjects") && (
                <div style={{
                  display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap",
                  padding: "14px 18px", marginBottom: "16px", borderRadius: "10px",
                  background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)",
                }}>
                  <div style={{ minWidth: "220px", flex: 1 }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Department for all rows</div>
                    <select
                      value={defaultDept}
                      disabled={me.department_id != null}
                      onChange={e => setDefaultDept(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#F0EDE8", fontSize: "13px", fontFamily: "Sora, sans-serif" }}
                    >
                      <option value="" style={{ background: "#0F172A" }}>{target === "faculty" ? "— Select department —" : "— Common (all departments) —"}</option>
                      {departments.map(d => <option key={d.id} value={d.id} style={{ background: "#0F172A" }}>{d.code} — {d.name}</option>)}
                    </select>
                  </div>
                  <div style={{ width: "140px", display: target === "faculty" ? "block" : "none" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Cluster *</div>
                    <input
                      type="number" min="1" value={defaultCluster}
                      disabled={me.cluster != null}
                      onChange={e => setDefaultCluster(e.target.value)}
                      placeholder="e.g. 1"
                      style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#F0EDE8", fontSize: "13px", boxSizing: "border-box", fontFamily: "Sora, sans-serif" }}
                    />
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", flexBasis: "100%" }}>
                    {target === "faculty"
                      ? "Required before import. You can change an individual faculty's department or cluster afterwards on the Faculty page."
                      : "Leave blank for subjects shared by every department (like Maths). You can change a subject's department afterwards on the Subjects page."}
                  </div>
                </div>
              )}

              <div style={{
                overflow: "auto", maxHeight: "400px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px", marginBottom: "16px"
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{
                        background: "rgba(255,255,255,0.03)", color: "#64748B",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "10px", textTransform: "uppercase",
                        letterSpacing: "1px", padding: "10px", textAlign: "left",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        position: "sticky", top: 0, width: "40px"
                      }}>#</th>
                      {fields.map(f => (
                        <th key={f.key} style={{
                          background: "rgba(255,255,255,0.03)", color: "#64748B",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "10px", textTransform: "uppercase",
                          letterSpacing: "1px", padding: "10px", textAlign: "left",
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          position: "sticky", top: 0
                        }}>{f.label}</th>
                      ))}
                      <th style={{
                        background: "rgba(255,255,255,0.03)", color: "#64748B",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "10px", textTransform: "uppercase",
                        letterSpacing: "1px", padding: "10px", textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        position: "sticky", top: 0, width: "80px"
                      }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, ri) => (
                      <tr key={ri}>
                        <td style={{
                          padding: "8px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          color: "#475569", fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "11px", textAlign: "center"
                        }}>{ri + 1}</td>
                        {fields.map(f => (
                          <td key={f.key} style={{
                            padding: "6px 8px",
                            borderBottom: "1px solid rgba(255,255,255,0.04)"
                          }}>
                            <input
                              className="ocr-input"
                              type={f.type === "number" ? "number" : "text"}
                              value={row[f.key] ?? ""}
                              onChange={e => updateCell(ri, f.key,
                                f.type === "number"
                                  ? (e.target.value === "" ? null : parseInt(e.target.value) || 0)
                                  : e.target.value
                              )}
                              placeholder={f.label}
                              style={{
                                width: "100%", padding: "8px 10px",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "6px", color: "#F0EDE8",
                                fontSize: "13px", boxSizing: "border-box",
                                fontFamily: "Sora, sans-serif"
                              }}
                            />
                          </td>
                        ))}
                        <td style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          textAlign: "center"
                        }}>
                          <button
                            onClick={() => deleteRow(ri)}
                            style={{
                              padding: "5px 10px",
                              background: "rgba(220,38,38,0.12)",
                              border: "1px solid rgba(220,38,38,0.25)",
                              color: "#F87171", borderRadius: "6px",
                              cursor: "pointer", fontSize: "11px",
                              fontWeight: "600", transition: "all 0.2s",
                              fontFamily: "Sora, sans-serif"
                            }}
                          >✕ Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addRow}
                style={{
                  padding: "8px 18px",
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#34D399", borderRadius: "8px",
                  cursor: "pointer", fontWeight: "600",
                  fontSize: "12px", marginBottom: "14px", transition: "all 0.2s",
                  fontFamily: "Sora, sans-serif"
                }}
              >+ Add Row</button>

              <div style={{
                padding: "14px 18px", borderRadius: "10px",
                background: "rgba(59,130,246,0.05)",
                border: "1px solid rgba(59,130,246,0.2)",
                fontSize: "12px", color: "#64748B",
                fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8
              }}>
                💡 Review and edit cells above. Delete unwanted rows. Add new rows if needed.<br />
                Click <strong style={{ color: "#EAB308" }}>Import {records.length} Records</strong> when ready.
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "18px 28px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", gap: "10px", justifyContent: "flex-end", flexShrink: 0
        }}>
          {stage === "preview" && (
            <>
              <button
                onClick={() => { setStage("idle"); setRecords([]); setResult(null); }}
                style={{
                  padding: "10px 20px",
                  background: "rgba(129,140,248,0.1)",
                  border: "1px solid rgba(129,140,248,0.25)",
                  color: "#818CF8", borderRadius: "8px",
                  cursor: "pointer", fontSize: "12px", fontWeight: "600",
                  fontFamily: "Sora, sans-serif"
                }}
              >↑ Re-upload</button>
              <button
                className="ocr-btn"
                onClick={doImport}
                disabled={records.length === 0 || (target === "faculty" && (!defaultDept || !defaultCluster))}
                style={{
                  padding: "10px 24px",
                  background: records.length === 0 ? "rgba(234,179,8,0.3)" : "#EAB308",
                  border: "none", color: "#0A0C12", borderRadius: "8px",
                  cursor: records.length === 0 ? "not-allowed" : "pointer",
                  fontSize: "12px", fontWeight: "700", transition: "all 0.2s",
                  boxShadow: "0 4px 20px rgba(234,179,8,0.3)",
                  fontFamily: "Sora, sans-serif"
                }}
              >✓ Import {records.length} Records</button>
            </>
          )}

          {stage === "done" && (
            <button
              className="ocr-btn"
              onClick={onClose}
              style={{
                padding: "10px 24px",
                background: "linear-gradient(135deg, #10B981, #059669)",
                border: "none", color: "#FFF", borderRadius: "8px",
                cursor: "pointer", fontSize: "12px", fontWeight: "700", transition: "all 0.2s",
                fontFamily: "Sora, sans-serif"
              }}
            >✓ Done — Close</button>
          )}

          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94A3B8", borderRadius: "8px",
              cursor: "pointer", fontSize: "12px", fontWeight: "600",
              fontFamily: "Sora, sans-serif"
            }}
          >{stage === "preview" ? "Cancel" : "Close"}</button>
        </div>
      </div>
    </div>
  );
}