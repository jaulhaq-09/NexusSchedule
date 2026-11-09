import { useState } from "react";
import API from "../services/api";

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr("");
    if (next.length < 8) return setErr("New password must be at least 8 characters");
    if (next !== confirm) return setErr("New passwords do not match");
    setSaving(true);
    try {
      await API.post("/auth/change-password", { current_password: current, new_password: next });
      try {
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        u.must_change_password = false;
        localStorage.setItem("user", JSON.stringify(u));
      } catch (e) {}
      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e.response?.data?.detail || "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: "8px", marginBottom: "14px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#F0EDE8", fontSize: "14px", outline: "none", boxSizing: "border-box", fontFamily: "Sora, sans-serif",
  };
  const lab = { display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", fontFamily: "Sora, sans-serif", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "400px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(234,179,8,0.25)", borderRadius: "16px", padding: "32px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "20px", color: "#EAB308" }}>Set a new password</h2>
        <p style={{ margin: "0 0 22px", fontSize: "13px", color: "#94A3B8" }}>Your administrator gave you a first password. Choose your own to continue.</p>

        <label style={lab}>Current (first) password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={inp} />
        <label style={lab}>New password</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="At least 8 characters" style={inp} />
        <label style={lab}>Confirm new password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inp} />

        {err && <div style={{ color: "#F87171", fontSize: "12px", marginBottom: "14px" }}>{err}</div>}

        <button onClick={submit} disabled={saving} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: "#EAB308", color: "#0A0C12", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "Sora, sans-serif" }}>
          {saving ? "Saving…" : "Save password"}
        </button>
      </div>
    </div>
  );
}