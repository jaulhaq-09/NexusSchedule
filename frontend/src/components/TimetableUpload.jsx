/**
 * TimetableUpload.jsx — Fixed v2
 * ─────────────────────────────────────────────────────────────
 * KEY FIXES vs original:
 *   1. Replaced API.post (axios) with native fetch() — axios corrupts
 *      multipart/form-data boundaries causing 422 errors
 *   2. Added 30-second timeout with AbortController
 *   3. Clear "backend not running" error instead of hanging forever
 *   4. Handles course_list PDF response (auto-populates subject/lab config)
 *   5. Removed manual Content-Type header (browser sets it with boundary)
 */

import { useState, useRef, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const SLOTS = ["08:30 - 09:25","09:25 - 10:20","10:40 - 11:35","11:35 - 12:30","01:25 - 02:20","02:20 - 03:15","03:15 - 04:10"];

export default function TimetableUpload({ onLoad, onClose, onCourseList }) {
  const [stage,    setStage]    = useState("idle");   // idle | uploading | preview | course_list | error
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rawShown, setRawShown] = useState(false);
  const fileRef = useRef();

  const upload = useCallback(async (file) => {
    if (!file) return;

    // Validate file type
    const allowed = ["image/jpeg","image/png","image/webp","image/bmp","image/tiff","application/pdf"];
    const validExt = file.name.match(/\.(jpe?g|png|pdf|bmp|tiff|webp|xlsx|xls|docx)$/i);
    if (!allowed.includes(file.type) && !validExt) {
      setErrorMsg("Please upload a JPEG, PNG, PDF, XLSX or DOCX file.");
      setStage("error");
      return;
    }

    setStage("uploading");
    setErrorMsg("");

    try {
      // ── FIX 1: Use native fetch, NOT axios ──
      // Axios sets Content-Type manually which breaks multipart boundary.
      // fetch() lets the browser set it correctly with the boundary string.
      const fd = new FormData();
      fd.append("file", file);

      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // DO NOT set Content-Type — browser handles it automatically

      // ── FIX 2: 30-second timeout ──
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 30000);

      let response;
      try {
        response = await fetch("http://127.0.0.1:8000/ocr/upload-generate", {
          method:  "POST",
          headers: headers,
          body:    fd,
          signal:  controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        // ── FIX 3: Clear error for connection refused / timeout ──
        if (fetchErr.name === "AbortError") {
          setErrorMsg("Upload timed out (30s). Is the backend running? Run: uvicorn app.main:app --reload");
        } else {
          setErrorMsg(
            "Cannot reach backend server.\n" +
            "Make sure it's running:\n" +
            "  cd backend\n" +
            "  .\\venv\\Scripts\\Activate.ps1\n" +
            "  uvicorn app.main:app --reload"
          );
        }
        setStage("error");
        return;
      }
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const detail = Array.isArray(data?.detail)
          ? data.detail.map(d => `${d.loc?.join(".")}: ${d.msg}`).join("\n")
          : data?.detail || data?.error || `Server error ${response.status}`;
        setErrorMsg(detail);
        setStage("error");
        return;
      }

      // ── FIX 4: Handle course_list PDF response ──
      if (data?.type === "course_list") {
        setResult(data);
        setStage("course_list");
        return;
      }

      // Normal timetable response
      const entries = data?.timetable_data || data?.timetable || [];
      if (!data.success || !entries.length) {
        const warn = data?.warnings?.join(" ") || "";
        setErrorMsg(
          `OCR found ${data.entries_found || 0} entries — timetable structure not detected.\n` +
          (warn ? warn + "\n" : "") +
          "Tips: use a clear photo/scan with time header row and day column visible."
        );
        setStage("error");
        return;
      }

      setResult({ ...data, timetable_data: entries });
      setStage("preview");

    } catch (err) {
      setErrorMsg(err.message || "Upload failed");
      setStage("error");
    }
  }, []);

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

  // Build preview grid
  const grid = {};
  (result?.timetable_data || []).forEach(e => {
    if (!grid[e.day]) grid[e.day] = {};
    grid[e.day][e.time] = e;
  });

  const entries  = result?.timetable_data || [];
  const labCount = entries.filter(e => e.isLab).length;

  // Course list data
  const courseSubjects = result?.subjects    || [];
  const courseFacMap   = result?.faculty_map || {};
  const courseMeta     = result?.header      || {};

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    .upl-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:9997;font-family:'Sora',sans-serif}
    .upl-box{background:rgba(255,255,255,0.08);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:min(920px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
    .upl-hdr{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .upl-title{font-family:'Sora',sans-serif;font-size:15px;font-weight:700;color:#EAB308}
    .upl-sub{font-size:11px;color:#64748B;font-family:'Sora',sans-serif;margin-top:2px}
    .upl-close{background:none;border:none;color:#64748B;cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;transition:color .15s}
    .upl-close:hover{color:#F87171}
    .upl-body{padding:22px;overflow-y:auto;flex:1}

    .drop-zone{border:2px dashed rgba(234,179,8,0.3);border-radius:14px;padding:44px 24px;text-align:center;cursor:pointer;transition:all .2s}
    .drop-zone:hover,.drop-zone.over{border-color:rgba(234,179,8,0.7);background:rgba(234,179,8,0.04)}
    .drop-icon{font-size:2.6rem;margin-bottom:12px;opacity:0.7}
    .drop-title{font-size:15px;font-weight:700;color:#F0EDE8;margin-bottom:6px}
    .drop-sub{font-size:12px;color:#64748B;font-family:'Sora',sans-serif;margin-bottom:16px}
    .drop-btn{padding:8px 22px;background:#EAB308;color:#0A0C12;font-weight:700;font-size:12px;border:none;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;box-shadow:0 4px 16px rgba(234,179,8,0.3)}
    .drop-types{margin-top:12px;font-size:10px;color:#475569;font-family:'JetBrains Mono',monospace}

    .upl-progress{text-align:center;padding:60px}
    .spin{width:44px;height:44px;border:3px solid rgba(234,179,8,0.2);border-top-color:#EAB308;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .upl-prog-text{font-size:13px;color:#94A3B8;font-family:'Sora',sans-serif;line-height:1.8}

    .upl-error{background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);border-radius:12px;padding:18px;margin-bottom:14px;color:#F87171;font-size:12px;font-family:'JetBrains Mono',monospace;line-height:1.8;white-space:pre-wrap}
    .upl-retry{padding:8px 18px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);color:#EAB308;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:600;font-size:12px;margin-top:8px}

    .prev-stat{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
    .prev-badge{padding:4px 12px;border-radius:20px;font-size:11px;font-family:'JetBrains Mono',monospace;font-weight:700}
    .badge-green{background:rgba(16,185,129,0.15);color:#34D399;border:1px solid rgba(16,185,129,0.3)}
    .badge-amber{background:rgba(234,179,8,0.12);color:#EAB308;border:1px solid rgba(234,179,8,0.25)}
    .badge-blue{background:rgba(59,130,246,0.12);color:#60A5FA;border:1px solid rgba(59,130,246,0.25)}
    .badge-purple{background:rgba(129,140,248,0.12);color:#818CF8;border:1px solid rgba(129,140,248,0.25)}

    .prev-grid{overflow-x:auto;margin-bottom:14px}
    .prev-table{border-collapse:collapse;font-size:11px;width:100%;min-width:600px}
    .prev-table th{background:rgba(255,255,255,0.03);color:#64748B;font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:8px 10px;text-align:center;border:1px solid rgba(255,255,255,0.07)}
    .prev-table td{border:1px solid rgba(255,255,255,0.05);padding:6px 8px;text-align:center;height:48px;vertical-align:middle}
    .prev-day{background:rgba(255,255,255,0.03);color:#94A3B8;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1px;white-space:nowrap}
    .prev-subject{font-weight:700;font-size:11px;color:#F0EDE8;font-family:'JetBrains Mono',monospace;line-height:1.3}
    .prev-lab{background:rgba(234,179,8,0.08);border-left:2px solid #EAB308 !important}
    .prev-theory{background:rgba(129,140,248,0.06);border-left:2px solid #818CF8 !important}
    .prev-empty{color:rgba(255,255,255,0.1);font-size:16px}
    .prev-lab-tag{font-size:8px;color:#EAB308;letter-spacing:1px;margin-top:2px}

    .course-list-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
    .course-list-table th{background:rgba(255,255,255,0.03);color:#64748B;font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:9px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.08)}
    .course-list-table td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04);color:#94A3B8;vertical-align:middle}
    .course-list-table tr:hover td{background:rgba(255,255,255,0.03)}
    .cl-code{font-family:'JetBrains Mono',monospace;font-size:11px;color:#EAB308}
    .cl-subj{font-weight:600;color:#F0EDE8}
    .cl-lab-tag{display:inline-block;font-size:9px;padding:1px 6px;border-radius:4px;background:rgba(234,179,8,0.15);color:#EAB308;border:1px solid rgba(234,179,8,0.3);margin-left:6px;font-family:'JetBrains Mono',monospace;letter-spacing:.5px}
    .cl-fac{font-size:11px;color:#64748B}
    .cl-hrs{font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;text-align:center}
    .meta-row{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap}
    .meta-pill{padding:4px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#94A3B8}
    .meta-pill span{color:#EAB308;font-weight:700}
    .cl-notice{background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:12px 16px;font-size:11px;color:#34D399;font-family:'Sora',sans-serif;line-height:1.8;margin-bottom:14px}

    .raw-toggle{font-size:10px;color:#475569;font-family:'JetBrains Mono',monospace;cursor:pointer;text-decoration:underline;margin-bottom:8px;display:inline-block}
    .raw-box{background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px;font-size:10px;color:#64748B;font-family:'JetBrains Mono',monospace;white-space:pre-wrap;max-height:140px;overflow-y:auto;margin-bottom:14px}

    .upl-footer{padding:14px 22px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0}
    .btn-confirm{padding:8px 22px;background:#EAB308;color:#0A0C12;font-weight:700;font-size:12px;border:none;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;box-shadow:0 4px 16px rgba(234,179,8,0.3)}
    .btn-cancel{padding:8px 18px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94A3B8;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-size:12px}
    .btn-reupload{padding:8px 18px;background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.25);color:#818CF8;border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;font-size:12px}
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>
      <div className="upl-overlay" onClick={onClose}>
        <div className="upl-box" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="upl-hdr">
            <div>
              <div className="upl-title">📷 OCR Timetable Upload</div>
              <div className="upl-sub">
                Upload image, PDF, DOCX or XLSX — extracted automatically
              </div>
            </div>
            <button className="upl-close" onClick={onClose}>✕</button>
          </div>

          <div className="upl-body">

            {/* ── IDLE / ERROR: drop zone ── */}
            {(stage === "idle" || stage === "error") && (
              <>
                <div
                  className={`drop-zone${dragging ? " over" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current.click()}
                >
                  <div className="drop-icon">🗂️</div>
                  <div className="drop-title">Drop your timetable here</div>
                  <div className="drop-sub">
                    Image / PDF → timetable grid extracted via OCR<br/>
                    Course list PDF → subjects &amp; faculty auto-loaded
                  </div>
                  <button
                    className="drop-btn"
                    onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
                  >
                    Choose File
                  </button>
                  <div className="drop-types">
                    Supported: JPEG · PNG · PDF · DOCX · XLSX (max 20 MB)
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.docx,.xlsx,.xls"
                    style={{ display:"none" }}
                    onChange={onFileChange}
                  />
                </div>

                {stage === "error" && (
                  <div style={{ marginTop:"16px" }}>
                    <div className="upl-error">⚠ {errorMsg}</div>
                    <button
                      className="upl-retry"
                      onClick={() => { setStage("idle"); setErrorMsg(""); }}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── UPLOADING ── */}
            {stage === "uploading" && (
              <div className="upl-progress">
                <div className="spin"/>
                <div className="upl-prog-text">
                  Processing file...<br/>
                  <span style={{ fontSize:"10px", color:"#475569" }}>
                    OCR may take 5–20 seconds for large images
                  </span>
                </div>
              </div>
            )}

            {/* ── COURSE LIST PREVIEW ── */}
            {stage === "course_list" && result && (
              <>
                <div className="cl-notice">
                  ✓ Course list detected — {courseSubjects.length} subjects found.
                  Subjects and labs will be auto-loaded into the Config tab.
                  Assign faculty from the dropdowns after loading.
                </div>

                {/* Meta info */}
                {(courseMeta.semester || courseMeta.cluster || courseMeta.section) && (
                  <div className="meta-row">
                    {courseMeta.semester && <div className="meta-pill">Semester <span>{courseMeta.semester}</span></div>}
                    {courseMeta.cluster  && <div className="meta-pill">Cluster <span>{courseMeta.cluster}</span></div>}
                    {courseMeta.section  && <div className="meta-pill">Section <span>{courseMeta.section}</span></div>}
                  </div>
                )}

                <div className="prev-stat">
                  <span className="prev-badge badge-green">
                    {courseSubjects.filter(s => s.subject_type !== "LAB").length} theory subjects
                  </span>
                  <span className="prev-badge badge-amber">
                    {courseSubjects.filter(s => s.subject_type === "LAB").length} labs
                  </span>
                  <span className="prev-badge badge-purple">
                    {Object.keys(courseFacMap).length} faculty entries
                  </span>
                </div>

                <table className="course-list-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Subject</th>
                      <th style={{ textAlign:"center" }}>Hrs/Wk</th>
                      <th>Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseSubjects.map((s, i) => (
                      <tr key={i}>
                        <td className="cl-code">{s.subject_code}</td>
                        <td>
                          <span className="cl-subj">{s.subject_name}</span>
                          {s.subject_type === "LAB" && (
                            <span className="cl-lab-tag">LAB</span>
                          )}
                        </td>
                        <td className="cl-hrs">{s.hours_per_week}</td>
                        <td className="cl-fac">
                          {courseFacMap[s.subject_code] || courseFacMap[s.subject_name] || (
                            <span style={{ color:"#374151", fontStyle:"italic" }}>Not found</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ── TIMETABLE PREVIEW ── */}
            {stage === "preview" && result && (
              <>
                <div className="prev-stat">
                  <span className="prev-badge badge-green">✓ {entries.length} slots extracted</span>
                  {labCount > 0 && (
                    <span className="prev-badge badge-amber">🔬 {labCount} lab sessions</span>
                  )}
                  <span className="prev-badge badge-blue">
                    {[...new Set(entries.map(e => e.day))].length} days detected
                  </span>
                </div>

                <div className="prev-grid">
                  <table className="prev-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        {SLOTS.map(s => <th key={s}>{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td className="prev-day">{day.slice(0,3).toUpperCase()}</td>
                          {SLOTS.map(slot => {
                            const cell = grid[day]?.[slot];
                            return (
                              <td
                                key={slot}
                                className={cell ? (cell.isLab ? "prev-lab" : "prev-theory") : ""}
                              >
                                {cell ? (
                                  <>
                                    <div className="prev-subject">{cell.subject}</div>
                                    {cell.isLab && (
                                      <div className="prev-lab-tag">◆ LAB</div>
                                    )}
                                    {cell.facultyName && cell.facultyName !== "—" && (
                                      <div style={{ fontSize:"9px", color:"#475569", marginTop:"2px" }}>
                                        {cell.facultyName}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="prev-empty">·</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <span
                  className="raw-toggle"
                  onClick={() => setRawShown(p => !p)}
                >
                  {rawShown ? "▲ Hide" : "▼ Show"} raw OCR text
                </span>
                {rawShown && (
                  <div className="raw-box">{result.raw_text}</div>
                )}

                <div style={{ fontSize:"11px", color:"#475569", fontFamily:"'Sora',sans-serif", marginTop:"4px" }}>
                  Review above. Click <strong style={{ color:"#EAB308" }}>Load into Timetable</strong> to use it,
                  or re-upload a clearer image if entries look wrong.
                </div>
              </>
            )}
          </div>

          {/* Footer buttons */}
          <div className="upl-footer">
            {stage === "preview" && (
              <>
                <button
                  className="btn-reupload"
                  onClick={() => { setStage("idle"); setResult(null); }}
                >
                  ↑ Re-upload
                </button>
                <button
                  className="btn-confirm"
                  onClick={() => { onLoad(entries); onClose(); }}
                >
                  ✓ Load into Timetable ({entries.length} slots)
                </button>
              </>
            )}

            {stage === "course_list" && (
              <>
                <button
                  className="btn-reupload"
                  onClick={() => { setStage("idle"); setResult(null); }}
                >
                  ↑ Re-upload
                </button>
                <button
                  className="btn-confirm"
                  onClick={() => {
                    if (onCourseList) onCourseList(courseSubjects, courseFacMap, courseMeta);
                    onClose();
                  }}
                >
                  ✓ Load Subjects &amp; Labs ({courseSubjects.length} items)
                </button>
              </>
            )}

            <button className="btn-cancel" onClick={onClose}>
              {stage === "preview" || stage === "course_list" ? "Cancel" : "Close"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}