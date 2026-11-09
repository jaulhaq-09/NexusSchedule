import React, { useState, useEffect } from "react";

const startOf = (time) => (time || "").split("-")[0].trim();

export default function UnplacedClassesModal({
  items,
  data,
  facultyList,
  isBusyElsewhere,
  DAYS = [],
  PERIOD_SLOTS = [],
  SLOTS = [],
  onApply,
  onRegenerate,
  onClose,
}) {
  const [picks, setPicks] = useState({}); // item id -> { day, time }
  const [facs, setFacs] = useState({});   // item id -> faculty name chosen for it

  useEffect(() => { setPicks({}); setFacs({}); }, [items]);

  const facOf = (it) => facs[it.id] ?? it.facultyName;
  const namesOf = (name) => (name || "").split("/").map(n => n.trim()).filter(n => n && n !== "—" && n !== "-");

  const covered = (time, span) => {
    const i = PERIOD_SLOTS.findIndex(p => p.time === time);
    if (i === -1) return [time];
    return PERIOD_SLOTS.slice(i, i + (span || 1)).map(p => p.time);
  };

  const isAdjacent = (i0, i1) => {
    const a = SLOTS.findIndex(s => s.time === PERIOD_SLOTS[i0]?.time);
    const b = SLOTS.findIndex(s => s.time === PERIOD_SLOTS[i1]?.time);
    return a !== -1 && b === a + 1;
  };

  const facBusyAt = (name, day, time, span) =>
    namesOf(name).find(n => isBusyElsewhere(n, day, time, span));

  // state of one cell for one unplaced class
  const cellStatus = (it, day, time) => {
    const ti = PERIOD_SLOTS.findIndex(p => p.time === time);
    const times = PERIOD_SLOTS.slice(ti, ti + it.span).map(p => p.time);
    if (times.length < it.span) return { state: "blocked", reason: "Needs two periods in a row here" };
    for (let k = 1; k < it.span; k++) if (!isAdjacent(ti + k - 1, ti + k)) return { state: "blocked", reason: "Needs two periods in a row here" };

    if (data.some(e => e.day === day && covered(e.time, e.span).some(t => times.includes(t))))
      return { state: "blocked", reason: "This section already has a class here" };

    const takenByOther = Object.entries(picks).some(([id, m]) =>
      String(id) !== String(it.id) && m.day === day && covered(m.time, items.find(x => String(x.id) === String(id))?.span || 1).some(t => times.includes(t)));
    if (takenByOther) return { state: "blocked", reason: "Already chosen for another class" };

    const busy = facBusyAt(facOf(it), day, time, it.span);
    if (busy) return { state: "faculty", reason: `${busy} is teaching another section then — click, then pick another faculty` };
    return { state: "available", reason: "Free — click to place here" };
  };

  const pick = (it, day, time) => setPicks(prev => {
    const cur = prev[it.id];
    if (cur && cur.day === day && cur.time === time) { const n = { ...prev }; delete n[it.id]; return n; }
    return { ...prev, [it.id]: { day, time } };
  });

  const isReady = (it) => {
    const p = picks[it.id];
    return !!p && !facBusyAt(facOf(it), p.day, p.time, it.span);
  };

  const readyCount = items.filter(isReady).length;
  const leftCount = items.length - readyCount;

  const apply = () => {
    const placements = items.filter(isReady).map(it => ({
      id: it.id, subject: it.subject, facultyName: facOf(it), span: it.span, isCore: it.isCore,
      isLabNamed: it.isLabNamed, day: picks[it.id].day, time: picks[it.id].time,
    }));
    onApply(placements);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "rgba(255,255,255,0.08)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
        border: "1px solid rgba(245,158,11,0.35)", borderRadius: "16px", padding: "26px 24px",
        width: "760px", maxWidth: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column",
        animation: "popIn 0.2s ease", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <span style={{ fontSize: "20px" }}>{leftCount === 0 ? "✅" : "⚠️"}</span>
          <div style={{ fontFamily: "Sora,sans-serif", fontSize: "16px", fontWeight: "700", color: leftCount === 0 ? "#34D399" : "#F59E0B" }}>
            {leftCount === 0
              ? `All ${items.length} class${items.length > 1 ? "es" : ""} ready to place`
              : `${leftCount} of ${items.length} class${items.length > 1 ? "es" : ""} still need a slot`}
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "10px", fontFamily: "Sora,sans-serif" }}>
          These classes couldn't be placed without a clash. Pick a free slot for each, change the faculty if needed, then Apply Changes.
        </div>
        <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
          {[
            { label: "Free slot", color: "#10B981" },
            { label: "Free, but faculty busy — pick another faculty", color: "#F59E0B" },
            { label: "Selected", color: "#EAB308" },
            { label: "Not possible", color: "#475569" },
          ].map(i => (
            <div key={i.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: i.color }} />
              <span style={{ fontSize: "10.5px", color: "#64748B", fontFamily: "Sora,sans-serif" }}>{i.label}</span>
            </div>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
          {items.map(it => {
            const p = picks[it.id];
            const ready = isReady(it);
            const facName = facOf(it);
            const facKnown = facultyList.some(f => f.name === facName);
            return (
              <div key={it.id} style={{
                background: ready ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
                border: ready ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(245,158,11,0.25)",
                borderRadius: "10px", padding: "12px 14px", transition: "background 0.2s, border-color 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#818CF8", fontFamily: "'JetBrains Mono',monospace" }}>{it.subject}</span>
                    <span style={{ fontSize: "11px", color: "#EAB308", fontFamily: "'JetBrains Mono',monospace" }}>{it.span === 2 ? "2 periods in a row" : "1 period"}</span>
                    <span style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "Sora,sans-serif" }}>· {it.facultyName || "no faculty"}</span>
                  </div>
                  <span style={{ fontSize: "10px", color: ready ? "#34D399" : "#F59E0B", fontFamily: "'JetBrains Mono',monospace" }}>
                    {ready ? `✓ ${p.day} · ${p.time}` : p ? "faculty busy — change faculty below" : "pick a slot"}
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px", tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }} />
                      {PERIOD_SLOTS.map(ps => (
                        <th key={ps.time} style={{ padding: "2px 0" }}>
                          <div style={{ fontSize: "8.5px", color: "#64748B", fontFamily: "'JetBrains Mono',monospace", fontWeight: "600" }}>{startOf(ps.time)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day}>
                        <td style={{ fontSize: "10px", color: "#64748B", fontWeight: "700", letterSpacing: "0.5px" }}>{day.slice(0, 3).toUpperCase()}</td>
                        {PERIOD_SLOTS.map(ps => {
                          const { state, reason } = cellStatus(it, day, ps.time);
                          const chosen = p && p.day === day && p.time === ps.time;
                          const clickable = state === "available" || state === "faculty";
                          let bg = "rgba(255,255,255,0.015)", border = "1px solid rgba(255,255,255,0.05)", color = "#475569", mark = "·";
                          if (chosen) { bg = "#EAB308"; border = "1px solid #EAB308"; color = "#0A0C12"; mark = "✓"; }
                          else if (state === "available") { bg = "rgba(16,185,129,0.08)"; border = "1px solid rgba(16,185,129,0.35)"; color = "#34D399"; mark = ""; }
                          else if (state === "faculty") { bg = "rgba(245,158,11,0.08)"; border = "1px solid rgba(245,158,11,0.35)"; color = "#F59E0B"; mark = ""; }
                          return (
                            <td key={ps.time} onClick={() => clickable && pick(it, day, ps.time)} title={reason}
                              style={{ height: "30px", borderRadius: "6px", background: bg, border, cursor: clickable ? "pointer" : "not-allowed", textAlign: "center", verticalAlign: "middle", transition: "all 0.15s" }}>
                              <span style={{ color, fontSize: "12px", fontWeight: chosen ? "700" : "400" }}>{mark}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#64748B", minWidth: "110px" }}>Faculty:</span>
                  <select
                    value={facName}
                    onChange={e => setFacs(prev => ({ ...prev, [it.id]: e.target.value }))}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "7px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", fontSize: "12px", outline: "none", fontFamily: "Sora,sans-serif" }}
                  >
                    {!facKnown && <option value={facName}>{facName || "— none —"}</option>}
                    {facultyList.map(f => {
                      const busy = p ? !!facBusyAt(f.name, p.day, p.time, it.span) : false;
                      return (
                        <option key={String(f.id || f._id)} value={f.name} disabled={busy && f.name !== facName}>
                          {f.name}{busy ? " (busy at this time)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
          <button onClick={apply} disabled={readyCount === 0} style={{
            flex: 1, padding: "10px", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", border: "none",
            borderRadius: "8px", cursor: readyCount === 0 ? "not-allowed" : "pointer", opacity: readyCount === 0 ? 0.5 : 1,
            fontWeight: "700", fontSize: "13px", fontFamily: "Sora,sans-serif",
          }}>✓ Apply Changes{readyCount > 0 ? ` (${readyCount})` : ""}</button>
          {onRegenerate && (
            <button onClick={onRegenerate} style={{ padding: "10px 16px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>⚡ Regenerate</button>
          )}
          <button onClick={onClose} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Ignore</button>
        </div>
      </div>
    </div>
  );
}