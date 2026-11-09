import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";

export default function Signup() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState("");

  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const strength = password.length === 0 ? 0
    : password.length < 4 ? 1
    : password.length < 6 ? 2
    : password.length < 10 ? 3 : 4;
  const strColor = ["#12141C", "#F87171", "#F59E0B", "#EAB308", "#34D399"][strength];
  const strLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];

  const validate = () => {
    if (!name.trim()) { setError("Full name is required."); return false; }
    if (!email.trim()) { setError("Email address is required."); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Enter a valid email address."); return false; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!validate()) return;

    setLoading(true);
    try {
      await API.post("/auth/signup", { name: name.trim(), email: email.trim().toLowerCase(), password });
      setSuccess("Account created. Redirecting to sign in…");
      setTimeout(() => {
        navigate("/login", { state: { signupSuccess: true, signupEmail: email.trim().toLowerCase() } });
      }, 1400);
    } catch (err) {
      const st = err.response?.status;
      const msg = err.response?.data?.detail;
      setError(
        msg ||
        (st === 400 ? "An account with this email already exists." :
         st === 422 ? "Please check your inputs and try again." :
         !err.response ? "Cannot connect to server. Is the backend running?" :
         "Registration failed. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.visualSide}>
        <div style={S.bgPhoto} />
        <Link to="/" style={{ ...S.brandFixed, flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div className="logo-mark" style={S.logoMark}>⊞</div>
            <span style={S.logoText}>Schedulo</span>
          </div>
          <div style={S.collegeRow}>
            <img src="/college-logo.png" alt="BMSIT Logo" style={S.collegeLogoMini} />
            <span style={S.collegeNameMini}>BMS Institute of Technology &amp; Management</span>
          </div>
        </Link>
        <div style={S.orb1} />
        <div style={S.orb2} />
        <div style={S.meshGrid} />

        <div style={{ ...S.visualContent, ...(mounted ? S.visualIn : {}) }}>
          <div style={S.badge}><span style={S.badgeDot} />GET STARTED</div>
          <h2 style={S.visualTitle}>Everything you need<br />to run your institution.</h2>
          <p style={S.visualDesc}>Faculty, sections, subjects, and labs — one system that keeps every schedule conflict-free.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { icon: "◆", title: "Smart scheduling", desc: "AI places subjects with zero manual conflicts." },
              { icon: "◇", title: "Faculty management", desc: "Assign faculty, detect cross-section clashes." },
              { icon: "○", title: "Live conflict check", desc: "Real-time warnings before you generate." },
            ].map((b, i) => (
              <div key={i} className="feat-row" style={S.featRow}>
                <div style={S.featIcon}>{b.icon}</div>
                <div>
                  <div style={S.featTitle}>{b.title}</div>
                  <div style={S.featDesc}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.footerFixed}>© 2026 Schedulo. All rights reserved.</div>
      </div>

      <div style={S.formSide}>
        <div style={{ ...S.card, ...(mounted ? S.cardIn : {}) }}>
          <h1 style={{ ...S.title, ...(mounted ? S.item(1) : S.itemHidden) }}>Create account</h1>
          <p style={{ ...S.subtitle, ...(mounted ? S.item(2) : S.itemHidden) }}>Set up access to the scheduling system.</p>

          {error && <div style={S.bannerErr}>{error}</div>}
          {success && <div style={S.bannerOk}>{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ ...S.field, ...(mounted ? S.item(3) : S.itemHidden) }}>
              <label htmlFor="signup-name" style={{ ...S.label, color: focused === "name" ? "#EAB308" : "#64748B" }}>Full name</label>
              <input
                id="signup-name"
                className="in" type="text" value={name}
                onFocus={() => setFocused("name")} onBlur={() => setFocused("")}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Your full name" autoComplete="name" style={S.input}
              />
            </div>

            <div style={{ ...S.field, ...(mounted ? S.item(4) : S.itemHidden) }}>
              <label htmlFor="signup-email" style={{ ...S.label, color: focused === "email" ? "#EAB308" : "#64748B" }}>Email</label>
              <input
                id="signup-email"
                className="in" type="email" value={email}
                onFocus={() => setFocused("email")} onBlur={() => setFocused("")}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@college.edu" autoComplete="email" style={S.input}
              />
            </div>

            <div style={{ ...S.field, ...(mounted ? S.item(5) : S.itemHidden) }}>
              <label htmlFor="signup-password" style={{ ...S.label, color: focused === "pw" ? "#EAB308" : "#64748B" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-password"
                  className="in"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onFocus={() => setFocused("pw")} onBlur={() => setFocused("")}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="At least 6 characters" autoComplete="new-password"
                  style={{ ...S.input, paddingRight: "46px" }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={S.eyeBtn}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>

              {password.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: "4px", marginTop: "9px" }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: "3px", borderRadius: "2px",
                        background: i <= strength ? strColor : "rgba(255,255,255,0.1)",
                        transition: "background .25s",
                      }} />
                    ))}
                  </div>
                  <div style={{ marginTop: "5px", fontSize: "11px", color: strColor, fontFamily: "'JetBrains Mono', monospace" }}>{strLabel}</div>
                </>
              )}
            </div>

            <button type="submit" disabled={loading || !!success} className="btn"
              style={{ ...S.submit, ...(mounted ? S.item(6) : S.itemHidden) }}>
              <span>{loading ? "Creating account" : success ? "Redirecting" : "Create account"}</span>
              {loading && <span className="spinner" />}
            </button>
          </form>

          <div style={{ ...S.registerLine, ...(mounted ? S.item(7) : S.itemHidden) }}>
            Already have an account? <Link to="/login" className="reg-link" style={S.regLink}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", display: "flex", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", fontFamily: "Sora, sans-serif", overflow: "hidden" },

  formSide: { flex: "0 0 46%", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 },
  card: {
    width: "100%", maxWidth: "400px",
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "44px 40px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    opacity: 0,
    transform: "translateY(16px)",
    transition: "opacity .5s cubic-bezier(0.16,1,0.3,1) .05s, transform .5s cubic-bezier(0.16,1,0.3,1) .05s",
  },
  cardIn: { opacity: 1, transform: "translateY(0)" },

  brandFixed: {
    position: "absolute", top: "40px", left: "60px", zIndex: 2,
    display: "flex", alignItems: "center", gap: "9px", textDecoration: "none",
  },
  collegeRow: { display: "flex", alignItems: "center", gap: "7px" },
  collegeLogoMini: {
    width: "20px", height: "20px", borderRadius: "50%",
    border: "1px solid rgba(234,179,8,0.4)", objectFit: "cover",
    background: "#fff", animation: "spin 30s linear infinite",
  },
  collegeNameMini: {
    fontSize: "10px", fontWeight: "600", color: "#94A3B8",
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em", whiteSpace: "nowrap",
  },
  footerFixed: {
    position: "absolute", bottom: "32px", left: "60px", zIndex: 2,
    fontSize: "11.5px", color: "#64748B",
  },

  item: (delay) => ({ opacity: 0, transform: "translateY(12px)", animation: `riseIn 0.5s cubic-bezier(0.16,1,0.3,1) ${delay * 0.06}s forwards` }),
  itemHidden: { opacity: 0 },

  logoMark: { width: "28px", height: "28px", borderRadius: "7px", background: "#EAB308", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "900", color: "#0A0C12" },
  logoText: { fontSize: "14px", fontWeight: "700", color: "#F0EDE8" },
  title: { margin: "0 0 6px", fontSize: "28px", fontWeight: "700", color: "#F0EDE8", letterSpacing: "-0.5px" },
  subtitle: { margin: "0 0 30px", fontSize: "13.5px", color: "#94A3B8", lineHeight: 1.5 },

  field: { marginBottom: "16px" },
  label: { display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "7px", transition: "color .15s" },
  input: { width: "100%", padding: "12px 14px", borderRadius: "9px", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F0EDE8", fontSize: "14px", fontFamily: "Sora, sans-serif" },
  eyeBtn: { position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748B", fontSize: "11px", cursor: "pointer", fontFamily: "Sora, sans-serif" },

  submit: {
    width: "100%", padding: "13px", borderRadius: "9px", border: "none",
    background: "#EAB308", color: "#0A0C12", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", marginTop: "6px", fontFamily: "Sora, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "9px",
    boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
  },
  bannerOk: { padding: "10px 13px", borderRadius: "8px", marginBottom: "18px", fontSize: "13px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#34D399" },
  bannerErr: { padding: "10px 13px", borderRadius: "8px", marginBottom: "18px", fontSize: "13px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#F87171" },

  registerLine: { textAlign: "center", marginTop: "24px", fontSize: "13px", color: "#94A3B8" },
  regLink: { color: "#EAB308", fontWeight: "600", textDecoration: "none" },

  visualSide: { flex: "1", position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #080C14 0%, #0F172A 60%, #080C14 100%)", display: "flex", alignItems: "center", padding: "60px", borderRight: "1px solid rgba(255,255,255,0.1)" },
  bgPhoto: {
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: "linear-gradient(160deg, rgba(8,12,20,0.82) 0%, rgba(15,23,42,0.88) 55%, rgba(8,12,20,0.95) 100%), url('/forest.jpg')",
    backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    opacity: 0.65,
  },
  meshGrid: { position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "42px 42px", maskImage: "radial-gradient(ellipse 70% 60% at 60% 40%, black 10%, transparent 75%)" },
  orb1: { position: "absolute", width: "480px", height: "480px", borderRadius: "50%", background: "radial-gradient(circle, rgba(234,179,8,0.10) 0%, transparent 70%)", top: "-140px", right: "-100px", filter: "blur(10px)", animation: "drift 14s ease-in-out infinite" },
  orb2: { position: "absolute", width: "360px", height: "360px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", bottom: "-120px", left: "-80px", filter: "blur(10px)", animation: "drift 18s ease-in-out infinite reverse" },

  visualContent: { position: "relative", zIndex: 1, maxWidth: "440px", opacity: 0, transform: "translateY(14px)", transition: "opacity .6s ease .25s, transform .6s ease .25s" },
  visualIn: { opacity: 1, transform: "translateY(0)" },

  badge: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 13px", borderRadius: "20px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", fontSize: "10.5px", fontWeight: "600", color: "#EAB308", letterSpacing: "1.2px", marginBottom: "26px" },
  badgeDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#EAB308", boxShadow: "0 0 8px rgba(234,179,8,0.7)" },
  visualTitle: { margin: "0 0 16px", fontSize: "34px", fontWeight: "700", color: "#F0EDE8", lineHeight: 1.2, letterSpacing: "-0.8px" },
  visualDesc: { margin: "0 0 38px", fontSize: "14.5px", color: "#94A3B8", lineHeight: 1.7, maxWidth: "380px" },

  featRow: { display: "flex", alignItems: "flex-start", gap: "14px", padding: "12px 14px", borderRadius: "10px" },
  featIcon: { width: "30px", height: "30px", flexShrink: 0, borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#EAB308" },
  featTitle: { fontSize: "13.5px", fontWeight: "600", color: "#F0EDE8", marginBottom: "2px" },
  featDesc: { fontSize: "12px", color: "#64748B", lineHeight: 1.55 },
};

const CSS = `
  @keyframes riseIn { to { opacity: 1; transform: translateY(0); } }
  @keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-20px, 20px); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  .in { transition: border-color .15s, box-shadow .15s, background .15s; }
  .in:focus { outline: none; border-color: #EAB308 !important; box-shadow: 0 0 0 3px rgba(234,179,8,0.15); background: rgba(255,255,255,0.08) !important; }
  .in::placeholder { color: #475569; }

  .btn:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
  .btn:active:not(:disabled) { transform: translateY(0); }
  .btn { transition: filter .15s, transform .15s; }
  .btn:disabled { opacity: 0.65; cursor: not-allowed; }

  .spinner { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(10,12,18,0.3); border-top-color: #0A0C12; animation: spin .6s linear infinite; }

  .reg-link:hover { text-decoration: underline; }

  .logo-mark { transition: transform .3s cubic-bezier(0.34,1.56,0.64,1); }
  .logo-mark:hover { transform: rotate(-8deg) scale(1.08); }

  .feat-row { transition: background .15s; }
  .feat-row:hover { background: rgba(255,255,255,0.025); }
`;