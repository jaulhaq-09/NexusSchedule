import React from "react";

const REASON_LABELS = {
  break_lunch: "Break / Lunch",
  teacher_busy: "Faculty already teaching",
  room_busy: "Room already booked",
};

export default function AvailabilityGrid({ DAYS, PERIOD_SLOTS, availability, selectedSlots, toggleSlot }) {
  const getStatus = (day, time) => {
    const avail = availability[day]?.[time];
    if (!avail) return { state: "unknown", reason: "" };
    if (avail.available) return { state: "available", reason: "" };

    let reason = "Section already busy";
    if (avail.reasons.includes("break_lunch")) reason = REASON_LABELS.break_lunch;
    else if (avail.reasons.includes("teacher_busy")) reason = REASON_LABELS.teacher_busy;
    else if (avail.reasons.includes("room_busy")) reason = REASON_LABELS.room_busy;

    return { state: avail.reasons.includes("break_lunch") ? "break" : "blocked", reason };
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "20px 24px", marginBottom: "20px",
      overflowX: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", fontFamily: "Sora,sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ fontFamily: "Sora,sans-serif", fontSize: "15px", fontWeight: "700", color: "#F0EDE8" }}>Available Slots</div>
        <div style={{ display: "flex", gap: "16px" }}>
          {[
            { label: "Available", color: "#10B981" },
            { label: "Selected", color: "#EAB308" },
            { label: "Unavailable", color: "#475569" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: item.color }} />
              <span style={{ fontSize: "11px", color: "#64748B" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <table style={{ width:"100%", borderCollapse:"separate", borderSpacing: "4px", minWidth:"760px" }}>
        <thead>
          <tr>
            <th style={{ width: "70px" }} />
            {PERIOD_SLOTS.map(time => (
              <th key={time} style={{ padding:"4px 2px" }}>
                <div style={{ fontSize:"9.5px", color:"#64748B", fontFamily: "'JetBrains Mono',monospace", whiteSpace:"nowrap", fontWeight: "600" }}>{time}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map(day => (
            <tr key={day}>
              <td style={{ fontSize:"11px", color:"#64748B", fontWeight:"700", letterSpacing: "0.5px" }}>
                {day.slice(0, 3).toUpperCase()}
              </td>
              {PERIOD_SLOTS.map(time => {
                const { state, reason } = getStatus(day, time);
                const slot = `${day}|${time}`;
                const isSelected = selectedSlots.includes(slot);
                const isAvailable = state === "available";

                let bg = "rgba(255,255,255,0.02)";
                let border = "1px solid rgba(255,255,255,0.06)";
                let color = "#475569";

                if (isSelected) {
                  bg = "#EAB308"; border = "1px solid #EAB308"; color = "#0A0C12";
                } else if (isAvailable) {
                  bg = "rgba(16,185,129,0.06)"; border = "1px solid rgba(16,185,129,0.25)"; color = "#34D399";
                } else if (state === "break") {
                  bg = "rgba(255,255,255,0.015)"; border = "1px solid rgba(255,255,255,0.04)"; color = "#334155";
                } else {
                  bg = "rgba(255,255,255,0.015)"; border = "1px solid rgba(255,255,255,0.05)"; color = "#64748B";
                }

                return (
                  <td
                    key={time}
                    onClick={() => isAvailable && toggleSlot(day, time)}
                    title={reason || undefined}
                    style={{
                      height: "44px", borderRadius: "8px", background: bg, border,
                      cursor: isAvailable ? "pointer" : "not-allowed",
                      textAlign: "center", verticalAlign: "middle",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ color, fontSize: "14px", fontWeight: isSelected ? "700" : "400" }}>
                      {isSelected ? "✓" : isAvailable ? "" : "·"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: "10.5px", color: "#475569", marginTop: "14px" }}>
        Hover an unavailable slot to see why. Click an available slot to select it.
      </div>
    </div>
  );
}