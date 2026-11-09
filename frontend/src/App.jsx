import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Structure from './pages/Structure';
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Faculty from "./pages/Faculty";
import Subjects from "./pages/Subjects";
import Rooms from "./pages/Rooms";
import Sections from "./pages/Sections";
import Timetable from "./pages/Timetable";
import Labs from "./pages/Labs";  // ← ADD THIS
import Admin from "./pages/Admin";
import AdditionalTimetable from './pages/AdditionalTimetable';
import FacultyTimetable from "./pages/FacultyTimetable";
import ChangePassword from "./pages/ChangePassword";
import ProfileMenu from "./components/ProfileMenu";
import Sidebar, { EXPANDED_WIDTH, COLLAPSED_WIDTH } from "./components/Sidebar";
import { useNavigate, useLocation } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR — Schedulo + current page name (left), Logout (right). Shared
// across every layout below instead of duplicated per page.
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/my-timetable": "My Timetable",
  "/structure": "Structure",
  "/faculty": "Faculty",
  "/subjects": "Subjects",
  "/labs": "Labs",
  "/rooms": "Rooms",
  "/sections": "Sections",
  "/timetable": "Timetable",
  "/additional-timetable": "Additional Timetable",
  "/faculty-timetable": "Faculty Timetable",
  "/admin": "Admin",
};

function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "";
  const userEmail = localStorage.getItem("userEmail");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("user");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    navigate("/login", { replace: true });
  };

  return (
    <div style={{
      height: "64px", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      background: "rgba(255,255,255,0.03)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      fontFamily: "Sora, sans-serif",
      position: "relative",
    }}>
      <div style={{ fontSize: "14px", color: "#F0EDE8", fontWeight: "600", fontFamily: "Sora,sans-serif", animation: "topbarSlideIn 0.6s ease-out", display: "flex", alignItems: "center", gap: "8px" }}>
        <span>👋</span><span>Welcome to Schedulo</span>
      </div>

      {userEmail && <ProfileMenu onLogout={handleLogout} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT WITH SIDEBAR — for pages that need sidebar (Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
function LayoutWithSidebar() {
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem("sidebarCollapsed") === "true");

  React.useEffect(() => {
    const handler = (e) => setCollapsed(e.detail.collapsed);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0C12" }}>
      <Sidebar />
      <div style={{
        flex: 1,
        marginLeft: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minHeight: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        transition: "margin-left 0.2s ease",
      }}>
        <TopBar />
        <Outlet />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED LAYOUT — any logged-in role (admin, faculty, or user)
function AuthenticatedLayout() {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem("sidebarCollapsed") === "true");

  React.useEffect(() => {
    const handler = (e) => setCollapsed(e.detail.collapsed);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword()) {
    return <ChangePassword />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0C12" }}>
      <Sidebar />
      <div style={{
        flex: 1,
        marginLeft: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minHeight: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        transition: "margin-left 0.2s ease",
      }}>
        <TopBar />
        <Outlet />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED LAYOUT — checks token for admin-only pages
function ProtectedLayout() {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userRole = localStorage.getItem("userRole");
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem("sidebarCollapsed") === "true");

  React.useEffect(() => {
    const handler = (e) => setCollapsed(e.detail.collapsed);
    window.addEventListener("sidebar-toggle", handler);
    return () => window.removeEventListener("sidebar-toggle", handler);
  }, []);

  if (!isAuthenticated || !["admin", "coordinator"].includes(userRole)) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword()) {
    return <ChangePassword />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0C12" }}>
      <Sidebar />
      <div style={{
        flex: 1,
        marginLeft: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minHeight: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        transition: "margin-left 0.2s ease",
      }}>
        <TopBar />
        <Outlet />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
const mustChangePassword = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}").must_change_password === true; }
  catch { return false; }
};

function AdminOnly({ children }) {
  return localStorage.getItem("userRole") === "admin" ? children : <Navigate to="/dashboard" replace />;
}

function CoordinatorOnly({ children }) {
  return localStorage.getItem("userRole") === "coordinator" ? children : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public - No sidebar */}
        <Route path="/" element={<Home />} />  {/* ← Keep only this */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes - Admin only with sidebar */}
        <Route element={<ProtectedLayout />}>
          <Route path="/structure" element={<CoordinatorOnly><Structure /></CoordinatorOnly>} />
          <Route path="/timetable" element={<CoordinatorOnly><Timetable /></CoordinatorOnly>} />
          <Route path="/faculty-timetable" element={<CoordinatorOnly><FacultyTimetable /></CoordinatorOnly>} />
          <Route path="/faculty" element={<CoordinatorOnly><Faculty /></CoordinatorOnly>} />
          <Route path="/subjects" element={<CoordinatorOnly><Subjects /></CoordinatorOnly>} />
          <Route path="/labs" element={<CoordinatorOnly><Labs /></CoordinatorOnly>} />
          <Route path="/rooms" element={<CoordinatorOnly><Rooms /></CoordinatorOnly>} />
          <Route path="/sections" element={<CoordinatorOnly><Sections /></CoordinatorOnly>} />
          <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
          <Route path="/additional-timetable" element={<CoordinatorOnly><AdditionalTimetable /></CoordinatorOnly>} />
        </Route>

        {/* Any authenticated role - Admin, Faculty, or User */}
        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-timetable" element={<FacultyTimetable restrictToSelf />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;