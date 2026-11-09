import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "▣", path: "/dashboard", access: "all" },
  { label: "My Timetable", icon: "🗓", path: "/my-timetable", access: "faculty" },
  { label: "Structure", icon: "🏗️", path: "/structure", access: "editor" },
  { label: "Faculty", icon: "👤", path: "/faculty", access: "editor" },
  { label: "Subjects", icon: "📚", path: "/subjects", access: "editor" },
  { label: "Sections", icon: "🗂", path: "/sections", access: "editor" },
  { label: "Rooms", icon: "🏫", path: "/rooms", access: "editor" },
  { label: "Labs", icon: "🔬", path: "/labs", access: "editor" },
  { label: "Timetable", icon: "📅", path: "/timetable", access: "editor" },
  { label: "Additional Timetable", icon: "📝", path: "/additional-timetable", access: "editor" },
  { label: "Faculty Timetable", icon: "👨‍🏫", path: "/faculty-timetable", access: "editor" },
  { label: "Admin", icon: "⚙", path: "/admin", access: "admin" },
];

const EXPANDED_WIDTH = "220px";
const COLLAPSED_WIDTH = "68px";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userRaw = localStorage.getItem("user");
  const user = userRaw ? JSON.parse(userRaw) : {};
  const role = localStorage.getItem("userRole");
  const isAdmin = role === "admin";
  const isLoggedIn = localStorage.getItem("isAuthenticated") === "true";
  // "My Timetable" is visible to plain faculty accounts, and to admins
  // who are also linked to a faculty record (e.g. a department head).
  const canSeeMyTimetable = role === "faculty" || (isAdmin && !!user.faculty_id);

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed ? "true" : "false");
    window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed } }));
  }, [collapsed]);

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <aside style={{
      width, flexShrink: 0,
      background: "#0F1117",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0,
      height: "100vh", zIndex: 100,
      transition: "width 0.2s ease",
      overflow: "hidden",
    }}>
      {/* Logo + name — fixed 64px height, matches TopBar height exactly */}
      <div style={{
        height: "64px", boxSizing: "border-box",
        padding: collapsed ? "0 14px" : "0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "#EAB308", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "16px", flexShrink: 0,
          }}>▣</div>
          {!collapsed && (
            <div style={{ whiteSpace: "nowrap" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "#F0EDE8", lineHeight: 1.1, fontFamily: "Sora,sans-serif" }}>Schedulo</div>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: "9px", color: "#5C6070", letterSpacing: "1.5px", marginTop: "2px" }}>AI TIMETABLE</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "6px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map(item => {
          if (item.access === "admin" && !isAdmin) return null;
          if (item.access === "editor" && role !== "coordinator") return null;
          if (item.access === "faculty" && !canSeeMyTimetable) return null;

          const active = location.pathname === item.path;
          return (
            <div key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: collapsed ? "10px" : "9px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "8px", cursor: "pointer",
                marginBottom: "2px",
                background: active ? "rgba(234,179,8,0.12)" : "transparent",
                color: active ? "#EAB308" : "#5C6070",
                borderLeft: active && !collapsed ? "2px solid #EAB308" : "2px solid transparent",
                transition: "all 0.15s",
                fontFamily: "Sora,sans-serif",
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: "14px", flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ fontSize: "13px", fontWeight: active ? "600" : "400", whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          );
        })}
      </nav>

      {/* Not logged in → Home + Admin Login buttons. Once logged in, Home
          disappears (Logout in the top bar covers navigating away) and
          identity/logout live only in the shared top bar user menu. */}
      {!isLoggedIn && (
        <div style={{ padding: collapsed ? "14px 10px" : "16px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => navigate("/")}
            title={collapsed ? "Home" : undefined}
            style={{
              width: "100%", padding: "9px",
              borderRadius: "7px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94A3B8", cursor: "pointer", fontSize: "12.5px", fontWeight: "600",
              fontFamily: "Sora,sans-serif", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#EAB308"; e.currentTarget.style.borderColor = "rgba(234,179,8,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#94A3B8"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            <span>←</span>
            {!collapsed && <span>Home</span>}
          </button>
          <button
            onClick={() => navigate("/login")}
            title={collapsed ? "Admin Login" : undefined}
            style={{
              width: "100%", padding: "10px", borderRadius: "7px",
              background: "#EAB308", border: "none",
              color: "#0A0C12", cursor: "pointer", fontSize: "13px", fontWeight: "700",
              fontFamily: "Sora,sans-serif", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}>
            <span>🔐</span>
            {!collapsed && <span>Admin Login</span>}
          </button>
        </div>
      )}

      {/* Collapse toggle — now in the bottom-most position, where Logout used to be */}
      <div style={{ padding: collapsed ? "10px" : "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width: "100%",
            padding: "7px",
            borderRadius: "7px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#5C6070",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex", alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontFamily: "Sora,sans-serif",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#EAB308"; e.currentTarget.style.borderColor = "rgba(234,179,8,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#5C6070"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        >
          <span style={{ display: "inline-block", transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>◀</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };