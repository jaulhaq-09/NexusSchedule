import { NavLink, useNavigate } from "react-router-dom";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap');`;

const NAV = [
  { to:"/dashboard", icon:"⬛", label:"Dashboard" },
  { to:"/timetable", icon:"📅", label:"Timetable" },
  { to:"/faculty",   icon:"👤", label:"Faculty",  adminOnly:true },
  { to:"/subjects",  icon:"📖", label:"Subjects", adminOnly:true },
  { to:"/sections",  icon:"📚", label:"Sections", adminOnly:true },
  { to:"/rooms",     icon:"🚪", label:"Rooms",    adminOnly:true },
  { to:"/labs",      icon:"🔬", label:"Labs",     adminOnly:true },
  { to:"/admin",     icon:"⚙",  label:"Admin",    adminOnly:true },
];

export default function Navbar() {
  const navigate  = useNavigate();
  const role      = localStorage.getItem("role") || "user";
  const userEmail = localStorage.getItem("user") || "";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const css = `
    .nb{position:fixed;top:0;left:0;width:220px;height:100vh;background:#0A0E1A;border-right:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;z-index:800;overflow:hidden}
    .nb-logo{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px}
    .nb-logo-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#FBBF24,#F59E0B);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;flex-shrink:0;box-shadow:0 4px 12px rgba(251,191,36,.35)}
    .nb-logo-text{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#FBBF24;line-height:1.2}
    .nb-logo-sub{font-family:'DM Mono',monospace;font-size:9px;color:#374151;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
    .nb-links{flex:1;padding:14px 10px;display:flex;flex-direction:column;gap:3px;overflow-y:auto}
    .nb-link{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;text-decoration:none;color:#475569;font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:500;transition:all .2s;cursor:pointer;border:none;background:none;width:100%}
    .nb-link:hover{color:#E2E8F0;background:rgba(255,255,255,0.05)}
    .nb-link.active{color:#FBBF24;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2)}
    .nb-link .icon{font-size:15px;width:20px;text-align:center;flex-shrink:0}
    .nb-footer{padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06)}
    .nb-user{font-family:'DM Mono',monospace;font-size:9.5px;color:#374151;margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nb-role{display:inline-block;font-family:'DM Mono',monospace;font-size:8px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(251,191,36,.15);color:#FBBF24;border:1px solid rgba(251,191,36,.25);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px}
    .nb-logout{width:100%;padding:9px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;color:#F87171;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12.5px;font-weight:600;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px}
    .nb-logout:hover{background:rgba(239,68,68,.2)}
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>
      <nav className="nb">
        {/* Logo */}
        <div className="nb-logo">
          <div className="nb-logo-icon">⊞</div>
          <div>
            <div className="nb-logo-text">NexusSchedule</div>
            <div className="nb-logo-sub">AI Timetable</div>
          </div>
        </div>

        {/* Nav links */}
        <div className="nb-links">
          {NAV.filter(n => !n.adminOnly || role === "admin").map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nb-link${isActive ? " active" : ""}`}
            >
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="nb-footer">
          <div className="nb-user">Logged in as: {userEmail || "—"}</div>
          <div className="nb-role">{role}</div>
          <button className="nb-logout" onClick={handleLogout}>
            ⏻ Logout
          </button>
        </div>
      </nav>
    </>
  );
}