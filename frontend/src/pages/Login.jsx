import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import API from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);

    if (location.state?.signupSuccess) {
      setSuccess("Account created. Sign in below.");
      if (location.state?.signupEmail) setEmail(location.state.signupEmail);
    }

    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");
    if (token && userRole) navigate("/dashboard", { replace: true });

    return () => clearTimeout(t);
  }, [navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }

    setLoading(true);
    try {
      const response = await API.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const { access_token, user } = response.data;
      const role = user?.role || "user";
      const resolvedEmail = user?.email || email.trim();

      localStorage.setItem("token", access_token);
      localStorage.setItem("role", role);
      localStorage.setItem("userRole", role);
      localStorage.setItem("user", JSON.stringify(user || { email: resolvedEmail }));
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", resolvedEmail);

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const st = err.response?.status;
      const msg = err.response?.data?.detail;
      setError(
        msg ||
        (st === 401 ? "Invalid email or password." :
         st === 404 ? "No account found with this email." :
         !err.response ? "Cannot connect to server. Is the backend running?" :
         "Login failed. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* ── RIGHT: visual panel ── */}
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
          <div style={S.badge}>
            <span style={S.badgeDot} />
            LIVE SCHEDULING ENGINE
          </div>
          <h2 style={S.visualTitle}>
            Timetables that<br />build themselves.
          </h2>
          <p style={S.visualDesc}>
            Faculty, rooms, and subjects — reconciled automatically,
            without the manual conflict-checking.
          </p>

          <div style={S.statRow}>
            {[
              { val: "0", label: "Manual conflicts" },
              { val: "< 2s", label: "Generation time" },
              { val: "24/7", label: "Live sync" },
            ].map((s, i) => (
              <div key={i} className="stat-cell" style={S.statCell}>
                <div style={S.statVal}>{s.val}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.footerFixed}>© 2026 Schedulo. All rights reserved.</div>
      </div>

      {/* ── LEFT: form ── */}
      <div style={{ ...S.formSide, flexDirection: "column" }}>
        <div style={{ ...S.card, ...(mounted ? S.cardIn : {}) }}>
          <h1 style={{ ...S.title, ...(mounted ? S.item(1) : S.itemHidden) }}>Sign in</h1>
          <p style={{ ...S.subtitle, ...(mounted ? S.item(2) : S.itemHidden) }}>
            Welcome back to your scheduling workspace.
          </p>

          {success && <div style={S.bannerOk}>{success}</div>}
          {error && <div style={S.bannerErr}>{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ ...S.field, ...(mounted ? S.item(3) : S.itemHidden) }}>
              <label htmlFor="login-email" style={{ ...S.label, color: focused === "email" ? "#EAB308" : "#64748B" }}>Email</label>
              <input
                id="login-email"
                className="in" type="email" value={email}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused("")}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@college.edu" autoComplete="email" style={S.input}
              />
            </div>

            <div style={{ ...S.field, ...(mounted ? S.item(4) : S.itemHidden) }}>
              <div style={S.rowBetween}>
                <label htmlFor="login-password" style={{ ...S.label, marginBottom: 0, color: focused === "pw" ? "#EAB308" : "#64748B" }}>Password</label>
                <span style={S.link}>Forgot?</span>
              </div>
              <div style={{ position: "relative", marginTop: "7px" }}>
                <input
                  id="login-password"
                  className="in"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onFocus={() => setFocused("pw")}
                  onBlur={() => setFocused("")}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter your password" autoComplete="current-password"
                  style={{ ...S.input, paddingRight: "46px" }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={S.eyeBtn}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn"
              style={{ ...S.submit, ...(mounted ? S.item(5) : S.itemHidden) }}>
              <span>{loading ? "Signing in" : "Sign in"}</span>
              {loading && <span className="spinner" />}
            </button>
          </form>

          <div style={{ ...S.registerLine, ...(mounted ? S.item(6) : S.itemHidden) }}>
            Access is managed by your administrator.
          </div>
        </div>

        <Link to="/" className="home-btn" style={S.homeBtn} title="Back to home">
          ←
        </Link>
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

  homeBtn: {
    marginTop: "24px",
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "42px", height: "42px",
    borderRadius: "50%",
    background: "rgba(234,179,8,0.08)",
    border: "1px solid rgba(234,179,8,0.25)",
    color: "#EAB308", fontSize: "17px", fontWeight: "700",
    textDecoration: "none", fontFamily: "Sora, sans-serif",
    transition: "border-color .2s, color .2s, background .2s, transform .2s, box-shadow .2s",
    boxShadow: "0 4px 16px rgba(234,179,8,0.08)",
  },

  footerFixed: {
    position: "absolute", bottom: "32px", left: "60px", zIndex: 2,
    fontSize: "11.5px", color: "#64748B",
  },

  cardIn: { opacity: 1, transform: "translateY(0)" },

  item: (delay) => ({
    opacity: 0, transform: "translateY(12px)",
    animation: `riseIn 0.5s cubic-bezier(0.16,1,0.3,1) ${delay * 0.06}s forwards`,
  }),
  itemHidden: { opacity: 0 },

  logoRow: { display: "flex", alignItems: "center", gap: "9px", marginBottom: "44px", textDecoration: "none" },
  logoMark: {
    width: "28px", height: "28px", borderRadius: "7px", background: "#EAB308",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "14px", fontWeight: "900", color: "#0A0C12",
  },
  logoText: { fontSize: "14px", fontWeight: "700", color: "#F0EDE8" },
  title: { margin: "0 0 6px", fontSize: "28px", fontWeight: "700", color: "#F0EDE8", letterSpacing: "-0.5px" },
  subtitle: { margin: "0 0 34px", fontSize: "13.5px", color: "#94A3B8", lineHeight: 1.5 },

  field: { marginBottom: "18px" },
  label: { display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "7px", transition: "color .15s" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: "9px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#F0EDE8", fontSize: "14px", fontFamily: "Sora, sans-serif",
  },
  eyeBtn: {
    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", color: "#64748B", fontSize: "11px",
    cursor: "pointer", fontFamily: "Sora, sans-serif",
  },
  link: { fontSize: "12px", color: "#EAB308", cursor: "pointer" },
  submit: {
    width: "100%", padding: "13px", borderRadius: "9px", border: "none",
    background: "#EAB308", color: "#0A0C12", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", marginTop: "6px", fontFamily: "Sora, sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "9px",
    position: "relative", overflow: "hidden",
    boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
  },
  bannerOk: {
    padding: "10px 13px", borderRadius: "8px", marginBottom: "18px", fontSize: "13px",
    background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#34D399",
  },
  bannerErr: {
    padding: "10px 13px", borderRadius: "8px", marginBottom: "18px", fontSize: "13px",
    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#F87171",
  },
  divider: { display: "flex", alignItems: "center", gap: "10px", margin: "26px 0", color: "#64748B", fontSize: "11px", textAlign: "center" },
  altBtn: {
    display: "block", width: "100%", padding: "12px", boxSizing: "border-box",
    borderRadius: "9px", border: "1px solid rgba(255,255,255,0.1)",
    color: "#F0EDE8", fontSize: "13.5px", fontWeight: "500", textAlign: "center",
    textDecoration: "none", fontFamily: "Sora, sans-serif",
  },
  back: { display: "block", textAlign: "center", marginTop: "28px", fontSize: "12px", color: "#64748B", textDecoration: "none" },

  registerLine: { textAlign: "center", marginTop: "24px", fontSize: "13px", color: "#94A3B8" },
  regLink: { color: "#EAB308", fontWeight: "600", textDecoration: "none" },

  visualSide: {
    flex: "1", position: "relative", overflow: "hidden",
    background: "linear-gradient(160deg, #080C14 0%, #0F172A 60%, #080C14 100%)",
    display: "flex", alignItems: "center", padding: "60px",
    borderRight: "1px solid rgba(255,255,255,0.1)",
  },
  bgPhoto: {
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: "linear-gradient(160deg, rgba(8,12,20,0.82) 0%, rgba(15,23,42,0.88) 55%, rgba(8,12,20,0.95) 100%), url('/forest.jpg')",
    backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    opacity: 0.65,
  },
  meshGrid: {
    position: "absolute", inset: 0,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    maskImage: "radial-gradient(ellipse 70% 60% at 60% 40%, black 10%, transparent 75%)",
  },
  orb1: {
    position: "absolute", width: "480px", height: "480px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(234,179,8,0.10) 0%, transparent 70%)",
    top: "-140px", right: "-100px", filter: "blur(10px)",
    animation: "drift 14s ease-in-out infinite",
  },
  orb2: {
    position: "absolute", width: "360px", height: "360px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
    bottom: "-120px", left: "-80px", filter: "blur(10px)",
    animation: "drift 18s ease-in-out infinite reverse",
  },

  visualContent: { position: "relative", zIndex: 1, maxWidth: "440px", opacity: 0, transform: "translateY(14px)", transition: "opacity .6s ease .25s, transform .6s ease .25s" },
  visualIn: { opacity: 1, transform: "translateY(0)" },

  badge: {
    display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 13px",
    borderRadius: "20px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
    fontSize: "10.5px", fontWeight: "600", color: "#EAB308", letterSpacing: "1.2px", marginBottom: "26px",
  },
  badgeDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#EAB308", boxShadow: "0 0 8px rgba(234,179,8,0.7)" },
  visualTitle: { margin: "0 0 16px", fontSize: "38px", fontWeight: "700", color: "#F0EDE8", lineHeight: 1.18, letterSpacing: "-1px" },
  visualDesc: { margin: "0 0 44px", fontSize: "14.5px", color: "#94A3B8", lineHeight: 1.7, maxWidth: "380px" },

  statRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" },
  statCell: { padding: "16px 14px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" },
  statVal: { fontSize: "20px", fontWeight: "700", color: "#EAB308", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace" },
  statLabel: { fontSize: "11px", color: "#64748B" },
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

  .spinner {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(10,12,18,0.3); border-top-color: #0A0C12;
    animation: spin .6s linear infinite;
  }

  .alt-btn:hover { border-color: rgba(234,179,8,0.4) !important; color: #EAB308 !important; }
  .alt-btn { transition: border-color .15s, color .15s; }

  .back-link:hover { color: #EAB308 !important; }
  .back-link { transition: color .15s; }
  .reg-link:hover { text-decoration: underline; }

  .logo-mark { transition: transform .3s cubic-bezier(0.34,1.56,0.64,1); }
  .logo-mark:hover { transform: rotate(-8deg) scale(1.08); }

  .home-btn:hover { border-color: rgba(234,179,8,0.5) !important; background: rgba(234,179,8,0.15) !important; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(234,179,8,0.25); }

  .stat-cell { transition: border-color .2s, transform .2s; }
  .stat-cell:hover { border-color: rgba(234,179,8,0.25); transform: translateY(-2px); }

  @media (max-width: 900px) {
    .visual-hide { display: none !important; }
  }
`;