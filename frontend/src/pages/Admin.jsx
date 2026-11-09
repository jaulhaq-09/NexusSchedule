import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MonitoringDashboard from "../components/MonitoringDashboard";
import API, { getDepartments, createFacultyLogin, resetUserPassword, getUsers, createUser, updateUserRole, updateUserStatus, updateUserProfile, deleteUser, getFaculty, getSubjects, getSections, getLabs, savedTimetablesAPI, facultyTimetableAPI } from "../services/api";
import { additionalClassAPI } from "../services/additionalClassApi";
import { useLocation } from "react-router-dom";

// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

export default function Admin() {

  useScrollToTop();  // ✅ ADD THIS LINE
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "admin" | "user"
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "faculty", department_id: "", cluster: "", faculty_id: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editFacultyId, setEditFacultyId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editDeptId, setEditDeptId] = useState("");
  const [editCluster, setEditCluster] = useState("");
  const [loginTarget, setLoginTarget] = useState(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");
  const [pendingRole, setPendingRole] = useState("faculty");
  const [roleSaving, setRoleSaving] = useState(null);
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [deptSaving, setDeptSaving] = useState(false);

  // ✅ NEW: Overview-tab extras — all pulled from real, existing endpoints
  const [extraStats, setExtraStats] = useState({ coreSubjects: 0, labs: 0, savedTimetables: 0 });
  const [extraLoading, setExtraLoading] = useState(true);
  const [userSummary, setUserSummary] = useState({ admins: 0, faculty: 0, users: 0 });

  // ✅ NEW: Operational overview data — timetable coverage, recent saves,
  // additional classes, faculty snapshots. All real, from existing APIs.
  const [opData, setOpData] = useState({
    totalSections: 0,
    scheduledSections: 0,
    recentTimetables: [],
    additionalClassCount: 0,
    additionalScheduledCount: 0,
    facultySnapshotCount: 0,
  });
  const [opLoading, setOpLoading] = useState(true);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/stats", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Stats error:", err);
      showToast("Failed to load stats", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: loads Core Subjects, Labs, Saved Timetables counts, institution
  // info, and the admin/faculty/user account breakdown — all real data.
  const loadOverviewExtras = async () => {
    setExtraLoading(true);
    try {
      // ✅ FIXED: uses existing getSubjects()/getInstitutionConfig() service
      // functions instead of raw fetch, and /saved-timetables/ (the real
      // endpoint, confirmed in services/api.js) instead of the wrong
      // /timetables/ path used before.
      const [subjRes, labRes, ttArr, usersRes] = await Promise.all([
        getSubjects().catch(() => ({ data: [] })),
        getLabs().catch(() => ({ data: [] })),
        savedTimetablesAPI.getAll().catch(() => []),
        getUsers().catch(() => ({ data: [] })),
      ]);

      const subjectsData = subjRes.data || [];
      const coreSubjects = subjectsData.filter(s => s.is_core).length;
      setExtraStats({
        coreSubjects,
        labs: (labRes.data || []).length,
        savedTimetables: (ttArr || []).length,
      });

      const usersData = usersRes.data || [];
      setUserSummary({
        admins: usersData.filter(u => u.role === "admin").length,
        faculty: usersData.filter(u => u.role === "faculty").length,
        users: usersData.filter(u => u.role !== "admin" && u.role !== "faculty").length,
      });
    } catch (err) {
      console.error("Overview extras error:", err);
    } finally {
      setExtraLoading(false);
    }
  };

  // ✅ NEW: pulls sections, saved (section) timetables, additional classes,
  // and faculty snapshots — same API calls your Sections/Timetable/
  // AdditionalTimetable/FacultyTimetable pages already use.
  const loadOperationalData = async () => {
    setOpLoading(true);
    try {
      // ✅ FIXED: uses existing getSections() service function instead of raw fetch
      const [sectionsRes, savedTT, acRes, facTT] = await Promise.all([
        getSections().catch(() => ({ data: [] })),
        savedTimetablesAPI.getAll().catch(() => []),
        additionalClassAPI.getAll().catch(() => ({ data: { data: [] } })),
        facultyTimetableAPI.getAll().catch(() => []),
      ]);

      const sections = sectionsRes.data || [];
      const timetables = savedTT || [];
      // Only section-type saves count toward "scheduled" — matches the
      // filtering AdditionalTimetable.jsx already does for this data.
      const sectionTimetables = timetables.filter(tt => tt.type !== "faculty" && tt.section_id);
      const scheduledSectionIds = new Set(sectionTimetables.map(tt => String(tt.section_id)));

      const recentTimetables = [...sectionTimetables]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5)
        .map(tt => {
          const sec = sections.find(s => String(s.id) === String(tt.section_id));
          return {
            id: tt.id,
            label: sec ? `${sec.section_name} · Sem ${sec.semester} · Cluster ${sec.cluster ?? 1}` : (tt.label || "Unknown section"),
            date: tt.created_at,
          };
        });

      const additionalClasses = acRes?.data?.data || [];

      setOpData({
        totalSections: sections.length,
        scheduledSections: scheduledSectionIds.size,
        recentTimetables,
        additionalClassCount: additionalClasses.length,
        additionalScheduledCount: additionalClasses.filter(ac => ac.status === "scheduled").length,
        facultySnapshotCount: (facTT || []).length,
      });
    } catch (err) {
      console.error("Operational data error:", err);
    } finally {
      setOpLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadOverviewExtras();
    loadOperationalData();
    getDepartments().then(res => setDepartments(res.data || [])).catch(() => { });
  }, []);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await getUsers();
      setUsers(res.data || []);
    } catch (err) {
      console.error("Users error:", err);
      showToast("Failed to load users", "error");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") loadUsers();
  }, [activeTab]);

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      showToast("Fill in all fields", "error");
      return;
    }
    if (newUser.role === "faculty" && !newUser.faculty_id) {
      showToast("Select which faculty this account belongs to", "error");
      return;
    }
    setAddingUser(true);
    try {
      await createUser({
        ...newUser,
        faculty_id: (newUser.role === "faculty" || newUser.role === "admin") && newUser.faculty_id ? Number(newUser.faculty_id) : null,
      });
      showToast(`✅ ${newUser.role === "admin" ? "Admin" : newUser.role === "faculty" ? "Faculty" : "User"} account created`);
      setNewUser({ name: "", email: "", password: "", role: "user", faculty_id: "" });
      setShowAddUser(false);
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to create user", "error");
    } finally {
      setAddingUser(false);
    }
  };

  const openEditModal = (user) => {
    setEditUser(user);
    setEditName(user.name || "");
    setEditRole(user.role);
    setEditFacultyId(user.faculty_id ? String(user.faculty_id) : "");
    setEditDeptId(user.department_id ? String(user.department_id) : "");
    setEditCluster(user.cluster ? String(user.cluster) : "");
  };

  const handleCreateLogin = async () => {
    if (!loginTarget) return;
    if (!loginPassword || loginPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setCreatingLogin(true);
    try {
      await createFacultyLogin(loginTarget.id, loginPassword);
      if (pendingRole && pendingRole !== "faculty") {
        const fresh = (await getUsers()).data || [];
        const nu = fresh.find(x => x.faculty_id === loginTarget.id);
        if (nu) {
          const isCoord = pendingRole === "coordinator";
          await updateUserRole(nu.id, pendingRole, loginTarget.id, isCoord ? Number(loginTarget.department_id) : null, isCoord ? Number(loginTarget.cluster) : null);
        }
      }
      showToast(`✅ Login created for ${loginTarget.name}`);
      setLoginTarget(null);
      setLoginPassword("");
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to create login", "error");
    } finally {
      setCreatingLogin(false);
    }
  };

  const handleRoleChange = async (f, u, role) => {
    if (!role) return;
    if (role === "coordinator" && (!f.department_id || !f.cluster)) {
      showToast("Set this faculty's department and cluster on the Faculty page first", "error");
      return;
    }
    if (!u) { setPendingRole(role); setLoginTarget(f); setLoginPassword(""); return; }
    if (role === u.role) return;
    setRoleSaving(u.id);
    try {
      const isCoord = role === "coordinator";
      await updateUserRole(u.id, role, f.id, isCoord ? Number(f.department_id) : null, isCoord ? Number(f.cluster) : null);
      showToast(`✅ ${f.name} is now ${role}`);
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to change role", "error");
    } finally {
      setRoleSaving(null);
    }
  };

  const handleAddDepartment = async () => {
    const name = newDept.name.trim();
    const code = newDept.code.trim().toUpperCase();
    if (!name || !code) { showToast("Enter a department name and code", "error"); return; }
    setDeptSaving(true);
    try {
      await API.post("/departments", { name, code });
      showToast(`✅ Department ${code} added`);
      setNewDept({ name: "", code: "" });
      const res = await getDepartments();
      setDepartments(res.data || []);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to add department", "error");
    } finally {
      setDeptSaving(false);
    }
  };

  const handleRemoveDepartment = async (d) => {
    if (!window.confirm(`Deactivate department ${d.code}? Faculty and sections keep their data.`)) return;
    try {
      await API.delete(`/departments/${d.id}`);
      showToast(`Department ${d.code} deactivated`);
      const res = await getDepartments();
      setDepartments(res.data || []);
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to deactivate department", "error");
    }
  };

  const handleInvite = async () => {
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    if (!name || !email) { showToast("Enter a name and email", "error"); return; }
    if ((newUser.role === "faculty" || newUser.role === "coordinator") && (!newUser.department_id || !newUser.cluster || Number(newUser.cluster) < 1)) {
      showToast("Select a department and enter a cluster number", "error");
      return;
    }
    setAddingUser(true);
    try {
      const res = await API.post("/auth/users/invite", {
        name, email, role: newUser.role,
        department_id: newUser.department_id ? Number(newUser.department_id) : null,
        cluster: newUser.cluster ? Number(newUser.cluster) : null,
      });
      if (res.data.email_sent) {
        showToast(`✅ Login details emailed to ${email}`);
      } else {
        window.alert(`Account created, but the email could not be sent.\n\n${res.data.email_error || ""}\n\nShare these details manually:\nUsername: ${email}\nTemporary password: ${res.data.temp_password}`);
      }
      setNewUser({ name: "", email: "", role: "faculty", department_id: "", cluster: "", faculty_id: "" });
      setShowAddUser(false);
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to create user", "error");
    } finally {
      setAddingUser(false);
    }
  };

  const handleResend = async (u) => {
    if (!window.confirm(`Generate a new temporary password and email it to ${u.email}?`)) return;
    try {
      const res = await API.post(`/auth/users/${u.id}/resend-credentials`);
      if (res.data.email_sent) {
        showToast(`✅ New login details emailed to ${u.email}`);
      } else {
        window.alert(`The email could not be sent.\n\n${res.data.email_error || ""}\n\nShare these details manually:\nUsername: ${u.email}\nTemporary password: ${res.data.temp_password}`);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to resend", "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (!editName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    if ((editRole === "coordinator" || editRole === "faculty") && (!editDeptId || !editCluster || Number(editCluster) < 1)) {
      showToast("Department and cluster are required", "error");
      return;
    }
    setSavingEdit(true);
    try {
      if (editName.trim() !== editUser.name) {
        await updateUserProfile(editUser.id, editName.trim());
      }
      const newFacultyId = editUser.faculty_id ?? null;
      const newDeptId = (editRole === "coordinator" || editRole === "faculty") ? Number(editDeptId) : null;
      const newCluster = (editRole === "coordinator" || editRole === "faculty") ? Number(editCluster) : null;
      if (editRole !== editUser.role || newFacultyId !== editUser.faculty_id || ((editRole === "coordinator" || editRole === "faculty") && (newDeptId !== editUser.department_id || newCluster !== editUser.cluster))) {
        await updateUserRole(editUser.id, editRole, newFacultyId, newDeptId, newCluster);
      }
      showToast("✅ User updated");
      setEditUser(null);
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to update user", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPw || resetPw.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setResettingPw(true);
    try {
      await resetUserPassword(resetTarget.id, resetPw);
      showToast(`✅ Password reset for ${resetTarget.name || resetTarget.email}`);
      setResetTarget(null);
      setResetPw("");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to reset password", "error");
    } finally {
      setResettingPw(false);
    }
  };

  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      await deleteUser(deleteUserTarget.id);
      showToast("🗑️ User deleted");
      setDeleteUserTarget(null);
      loadUsers();
      loadOverviewExtras();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete user", "error");
    } finally {
      setDeletingUser(false);
    }
  };

  const handleToggleStatus = async (user) => {
    setStatusUpdating(user.id);
    try {
      await updateUserStatus(user.id, !user.is_active);
      showToast(`✅ ${user.name || user.email} ${user.is_active ? "deactivated" : "activated"}`);
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to update status", "error");
    } finally {
      setStatusUpdating(null);
    }
  };

  const statCards = [
    { key: "faculty", label: "Faculty", icon: "👤", color: "#818CF8", tag: "INSTRUCTORS" },
    { key: "rooms", label: "Rooms", icon: "🏫", color: "#34D399", tag: "FACILITIES" },
    { key: "sections", label: "Sections", icon: "📚", color: "#A855F7", tag: "CLASSES" },
    { key: "subjects", label: "Subjects", icon: "📖", color: "#EAB308", tag: "COURSES" },
  ];

  const secondaryStatCards = [
    { key: "coreSubjects", label: "Core Subjects", icon: "🎯", color: "#F59E0B", tag: "PRIORITY" },
    { key: "labs", label: "Labs", icon: "🔬", color: "#14B8A6", tag: "FACILITIES" },
    { key: "savedTimetables", label: "Saved Timetables", icon: "📅", color: "#3B82F6", tag: "SCHEDULES" },
  ];

  const quickLinks = [
    { label: "Faculty", icon: "👤", path: "/faculty" },
    { label: "Subjects", icon: "📖", path: "/subjects" },
    { label: "Sections", icon: "📚", path: "/sections" },
    { label: "Rooms", icon: "🏫", path: "/rooms" },
    { label: "Labs", icon: "🔬", path: "/labs" },
    { label: "Timetable", icon: "📅", path: "/timetable" },
  ];

  const inputSt = {
    width: "100%", padding: "12px 14px", borderRadius: "8px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#F0EDE8", fontSize: "14px", outline: "none",
    fontFamily: "Sora, sans-serif", boxSizing: "border-box",
  };

  const modalOverlaySt = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
  };

  const modalCardSt = (borderColor = "rgba(255,255,255,0.1)") => ({
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(30px)",
    WebkitBackdropFilter: "blur(30px)",
    border: `1px solid ${borderColor}`,
    borderRadius: "16px", padding: "32px", maxWidth: "420px", width: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    animation: "fadeInUp 0.25s ease"
  });

  const coveragePct = opData.totalSections > 0
    ? Math.round((opData.scheduledSections / opData.totalSections) * 100)
    : 0;

  const timeAgo = (isoString) => {
    if (!isoString) return "";
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", padding: "24px 32px 0", fontFamily: "Sora, sans-serif", color: "#F0EDE8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .admin-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(234,179,8,0.15); }
        .admin-tab:hover { border-color: rgba(255,255,255,0.18) !important; color: #F0EDE8 !important; }
        .quick-link:hover { border-color: rgba(234,179,8,0.35) !important; background: rgba(234,179,8,0.08) !important; color: #EAB308 !important; transform: translateY(-2px); }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "12px 22px", borderRadius: "10px",
          background: toast.type === "error" ? "#DC2626" : "#059669",
          color: "#fff", fontSize: "13px", fontWeight: "600",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "slideIn 0.3s ease"
        }}>
          {toast.type === "success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "20px", animation: "fadeInUp 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#EAB308", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px" }}>
            ⚙️
          </div>
          <div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#F0EDE8", letterSpacing: "-0.3px" }}>
              System Administration
            </div>
            <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
              Manage system settings, data, and configurations
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation — unified pill style, matches FacultyTimetable/Sections */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "monitoring", label: "🔍 Monitoring" },
          { id: "users", label: "👥 Users" },
        ].map(tab => (
          <button
            key={tab.id}
            className="admin-tab"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "9px 18px", borderRadius: "8px",
              border: activeTab === tab.id ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: activeTab === tab.id ? "rgba(234,179,8,0.12)" : "rgba(255,255,255,0.03)",
              color: activeTab === tab.id ? "#EAB308" : "#94A3B8",
              fontSize: "13px", fontWeight: "700",
              cursor: "pointer", transition: "all 0.15s",
              fontFamily: "Sora, sans-serif"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "overview" ? (
        <>
          {/* Primary stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            {statCards.map((card, idx) => (
              <div key={card.key} className="admin-card" style={{
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${card.color}30`,
                borderRadius: "16px", padding: "20px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: `fadeInUp 0.6s ease ${idx * 0.1}s both`,
                position: "relative", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
              }}>
                <div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "56px", opacity: "0.06" }}>{card.icon}</div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{
                    padding: "4px 10px", background: `${card.color}20`, border: `1px solid ${card.color}40`,
                    borderRadius: "12px", fontSize: "9px", fontWeight: "700", color: card.color,
                    letterSpacing: "1px", fontFamily: "JetBrains Mono, monospace",
                    display: "inline-block", marginBottom: "12px"
                  }}>
                    {card.tag}
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "800", color: card.color, marginBottom: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                    {loading ? "..." : stats?.[card.key] || 0}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {card.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Secondary stats row — Core Subjects, Labs, Saved Timetables */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            {secondaryStatCards.map((card, idx) => (
              <div key={card.key} className="admin-card" style={{
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${card.color}30`,
                borderRadius: "16px", padding: "20px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: `fadeInUp 0.6s ease ${(idx + 4) * 0.1}s both`,
                position: "relative", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
              }}>
                <div style={{ position: "absolute", top: "-10px", right: "-10px", fontSize: "56px", opacity: "0.06" }}>{card.icon}</div>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{
                    padding: "4px 10px", background: `${card.color}20`, border: `1px solid ${card.color}40`,
                    borderRadius: "12px", fontSize: "9px", fontWeight: "700", color: card.color,
                    letterSpacing: "1px", fontFamily: "JetBrains Mono, monospace",
                    display: "inline-block", marginBottom: "12px"
                  }}>
                    {card.tag}
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: "800", color: card.color, marginBottom: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                    {extraLoading ? "..." : extraStats[card.key]}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {card.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ✅ NEW: Timetable Coverage + Recent Saved Timetables */}
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.3fr", gap: "16px", marginBottom: "16px" }}>
            {/* Coverage */}
            <div style={{
              background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              animation: "fadeInUp 0.6s ease 0.45s both",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "18px" }}>📅</span>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>Timetable Coverage</h3>
              </div>
              {opLoading ? (
                <div style={{ color: "#64748B", fontSize: "13px" }}>Loading…</div>
              ) : opData.totalSections === 0 ? (
                <div style={{ color: "#64748B", fontSize: "13px" }}>No sections yet</div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
                    <span style={{
                      fontSize: "30px", fontWeight: "800", fontFamily: "JetBrains Mono, monospace",
                      color: coveragePct === 100 ? "#34D399" : coveragePct >= 50 ? "#EAB308" : "#F87171",
                    }}>{coveragePct}%</span>
                    <span style={{ fontSize: "12px", color: "#94A3B8" }}>
                      {opData.scheduledSections} of {opData.totalSections} sections scheduled
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{
                      width: `${coveragePct}%`, height: "100%", borderRadius: "10px",
                      background: coveragePct === 100 ? "#34D399" : coveragePct >= 50 ? "#EAB308" : "#F87171",
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  {opData.totalSections - opData.scheduledSections > 0 && (
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "#F59E0B" }}>
                      ⚠ {opData.totalSections - opData.scheduledSections} section{opData.totalSections - opData.scheduledSections !== 1 ? "s" : ""} still need{opData.totalSections - opData.scheduledSections === 1 ? "s" : ""} a timetable
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recent Saved Timetables */}
            <div style={{
              background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              animation: "fadeInUp 0.6s ease 0.5s both",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🕓</span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>Recent Saved Timetables</h3>
                </div>
              </div>
              {opLoading ? (
                <div style={{ color: "#64748B", fontSize: "13px" }}>Loading…</div>
              ) : opData.recentTimetables.length === 0 ? (
                <div style={{ color: "#64748B", fontSize: "13px" }}>No timetables saved yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {opData.recentTimetables.map(tt => (
                    <div key={tt.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <span style={{ fontSize: "12.5px", color: "#F0EDE8", fontWeight: "500" }}>{tt.label}</span>
                      <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>{timeAgo(tt.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ✅ NEW: Additional Classes + Faculty Snapshots */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div style={{
              background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              animation: "fadeInUp 0.6s ease 0.55s both",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>➕</span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>Additional Classes</h3>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>
                  {opLoading ? "..." : opData.additionalClassCount}
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                  {opLoading ? "" : `${opData.additionalScheduledCount} currently scheduled`}
                </div>
              </div>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              animation: "fadeInUp 0.6s ease 0.6s both",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🗂</span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>Faculty Snapshots</h3>
                </div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#818CF8", fontFamily: "JetBrains Mono, monospace" }}>
                  {opLoading ? "..." : opData.facultySnapshotCount}
                </div>
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                  Saved faculty timetable versions
                </div>
              </div>
            </div>
          </div>

          {/* Departments */}
          <div style={{
            background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px", padding: "22px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            animation: "fadeInUp 0.6s ease 0.62s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "18px" }}>🏛</span>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>Departments</h3>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {departments.filter(d => d.is_active !== false).length === 0 ? (
                <div style={{ color: "#64748B", fontSize: "13px" }}>No departments yet</div>
              ) : departments.filter(d => d.is_active !== false).map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px 6px 12px", borderRadius: "8px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#EAB308", fontFamily: "JetBrains Mono, monospace" }}>{d.code}</span>
                  <span style={{ fontSize: "12px", color: "#94A3B8" }}>{d.name}</span>
                  <button
                    onClick={() => handleRemoveDepartment(d)}
                    title="Deactivate"
                    style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: "12px", padding: 0 }}
                  >✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text" placeholder="Department name (e.g. Mechanical Engineering)"
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                style={{ ...inputSt, flex: 2, minWidth: "240px", padding: "10px 14px" }}
              />
              <input
                type="text" placeholder="Code (e.g. ME)"
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                style={{ ...inputSt, flex: 1, minWidth: "120px", padding: "10px 14px" }}
              />
              <button
                onClick={handleAddDepartment}
                disabled={deptSaving}
                style={{
                  padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EAB308",
                  color: "#0A0C12", fontSize: "13px", fontWeight: "700", cursor: deptSaving ? "not-allowed" : "pointer",
                  opacity: deptSaving ? 0.6 : 1, fontFamily: "Sora, sans-serif", whiteSpace: "nowrap",
                  boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
                }}
              >{deptSaving ? "Adding…" : "＋ Add Department"}</button>
            </div>
          </div>
          {/* User Accounts */}
          <div style={{
            background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px", padding: "22px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            animation: "fadeInUp 0.6s ease 0.65s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>👥</span>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>User Accounts</h3>
              </div>
              <button
                onClick={() => setActiveTab("users")}
                style={{
                  background: "none", border: "none", color: "#EAB308",
                  fontSize: "11px", fontWeight: "700", cursor: "pointer", fontFamily: "Sora, sans-serif",
                }}
              >
                Manage →
              </button>
            </div>
            {extraLoading ? (
              <div style={{ color: "#64748B", fontSize: "13px" }}>Loading…</div>
            ) : (
              <div style={{ display: "flex", gap: "32px" }}>
                {[
                  { label: "Admins", value: userSummary.admins, color: "#EAB308" },
                  { label: "Faculty", value: userSummary.faculty, color: "#A855F7" },
                  { label: "Users", value: userSummary.users, color: "#818CF8" },
                ].map(u => (
                  <div key={u.label}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: u.color, fontFamily: "JetBrains Mono, monospace" }}>{u.value}</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600" }}>{u.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : activeTab === "monitoring" ? (
        // MONITORING TAB
        <div style={{ animation: "fadeInUp 0.5s ease" }}>
          <MonitoringDashboard />
        </div>
      ) : (
        // USERS TAB
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px", padding: "24px", animation: "fadeInUp 0.5s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#F0EDE8" }}>
              👥 All Users
            </h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="🔍 Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ ...inputSt, padding: "10px 14px", minWidth: "260px" }}
              />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{ ...inputSt, padding: "10px 14px", width: "auto", cursor: "pointer" }}
              >
                <option value="">All departments</option>
                {departments.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.code || d.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAddUser(true)}
                style={{
                  padding: "10px 18px", borderRadius: "8px", border: "none",
                  background: "#EAB308",
                  color: "#0A0C12", fontSize: "13px", fontWeight: "700",
                  cursor: "pointer", fontFamily: "Sora, sans-serif",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
                }}
              >
                ＋ Add User
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {[
              { key: "all", label: "All" },
              { key: "admin", label: "Admins" },
              { key: "coordinator", label: "Coordinators" },
              { key: "faculty", label: "Faculty" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setRoleFilter(f.key)}
                style={{
                  padding: "7px 16px", borderRadius: "7px", fontSize: "12px", fontWeight: "700",
                  background: roleFilter === f.key ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${roleFilter === f.key ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: roleFilter === f.key ? "#EAB308" : "#94A3B8",
                  cursor: "pointer", fontFamily: "Sora, sans-serif", transition: "all 0.15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>



          {usersLoading ? (
            <p style={{ color: "#64748B", fontSize: "13px" }}>Loading users…</p>
          ) : users.length === 0 ? (
            <p style={{ color: "#64748B", fontSize: "13px" }}>No users found.</p>
          ) : (
            (() => {
              const searched = users.filter(u =>
                !userSearch ||
                u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                u.email?.toLowerCase().includes(userSearch.toLowerCase())
              );
              const list = searched.filter(u => {
                if (deptFilter && String(u.department_id || "") !== deptFilter) return false;
                return roleFilter === "all" || u.role === roleFilter;
              });

              const formatJoined = (ts) => {
                if (!ts) return "—";
                const d = new Date(ts);
                return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
                  " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
              };

              const renderTable = (list, emptyLabel) => (
                list.length === 0 ? (
                  <p style={{ color: "#64748B", fontSize: "12px", padding: "8px 0 20px" }}>{emptyLabel}</p>
                ) : (
                  <div style={{ overflowX: "auto", marginBottom: "28px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["Name", "Email", "Dept", "Cluster", "Role", "Status", "Joined", "Actions"].map(h => (
                            <th key={h} style={{
                              textAlign: "left", padding: "10px 12px", fontSize: "10px",
                              color: "#64748B", fontFamily: "JetBrains Mono, monospace",
                              letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "700",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(u => (
                          <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "12px", fontSize: "13px", color: "#F0EDE8" }}>
                              {u.name || "—"}
                              {u.role === "coordinator" && u.department_id && (
                                <div style={{ fontSize: "10.5px", color: "#14B8A6", marginTop: "2px" }}>
                                  {departments.find(d => d.id === u.department_id)?.code || `Dept #${u.department_id}`} · Cluster {u.cluster}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px", fontSize: "13px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>{u.email}</td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#94A3B8" }}>{departments.find(d => d.id === u.department_id)?.code || "—"}</td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>{u.cluster || "—"}</td>
                            <td style={{ padding: "12px" }}>
                              <span style={{
                                padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                background: u.role === "admin" ? "rgba(234,179,8,0.15)" : u.role === "faculty" ? "rgba(168,85,247,0.15)" : u.role === "coordinator" ? "rgba(20,184,166,0.15)" : "rgba(129,140,248,0.15)",
                                color: u.role === "admin" ? "#EAB308" : u.role === "faculty" ? "#A855F7" : u.role === "coordinator" ? "#14B8A6" : "#818CF8",
                                textTransform: "uppercase",
                              }}>{u.role}</span>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span style={{
                                padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                background: u.is_active ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                color: u.is_active ? "#34D399" : "#F87171",
                              }}>{u.is_active ? "Active" : "Inactive"}</span>
                            </td>
                            <td style={{ padding: "12px", fontSize: "12px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                              {formatJoined(u.created_at)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  onClick={() => handleResend(u)}
                                  style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                    background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
                                    color: "#A855F7", cursor: "pointer", fontFamily: "Sora, sans-serif",
                                  }}
                                >
                                  ✉ Resend
                                </button>
                                <button
                                  onClick={() => openEditModal(u)}
                                  style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                                    color: "#F0EDE8", cursor: "pointer", fontFamily: "Sora, sans-serif",
                                  }}
                                >
                                  ✎ Edit
                                </button>
                                <button
                                  onClick={() => { setResetTarget(u); setResetPw(""); }}
                                  style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                    background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)",
                                    color: "#EAB308", cursor: "pointer", fontFamily: "Sora, sans-serif",
                                  }}
                                >
                                  🔑 Reset
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={statusUpdating === u.id}
                                  style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                    background: u.is_active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                                    border: `1px solid ${u.is_active ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                                    color: u.is_active ? "#F87171" : "#34D399",
                                    cursor: statusUpdating === u.id ? "wait" : "pointer",
                                    fontFamily: "Sora, sans-serif",
                                  }}
                                >
                                  {statusUpdating === u.id ? "…" : u.is_active ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  onClick={() => setDeleteUserTarget(u)}
                                  style={{
                                    padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "700",
                                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                                    color: "#F87171", cursor: "pointer", fontFamily: "Sora, sans-serif",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              );

              return (
                <>
                  {renderTable(list, "No users match.")}
                </>
              );
            })()
          )}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div style={modalOverlaySt} onClick={() => setShowAddUser(false)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardSt("rgba(234,179,8,0.25)")}>
            <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: "700", color: "#EAB308" }}>
              ＋ Add New User
            </h3>

            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Full Name</label>
            <input
              type="text" value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Full name"
              style={{ ...inputSt, marginBottom: "16px" }}
            />

            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Email</label>
            <input
              type="email" value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="user@college.edu"
              style={{ ...inputSt, marginBottom: "16px" }}
            />

            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              style={{ ...inputSt, marginBottom: "16px", cursor: "pointer" }}
            >
              <option value="faculty">Faculty</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>

            {(newUser.role === "faculty" || newUser.role === "coordinator") && (
              <>
                <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Department</label>
                <select
                  value={newUser.department_id}
                  onChange={(e) => setNewUser({ ...newUser, department_id: e.target.value })}
                  style={{ ...inputSt, marginBottom: "16px", cursor: "pointer" }}
                >
                  <option value="">— Select department —</option>
                  {departments.filter(d => d.is_active !== false).map(d => (
                    <option key={d.id} value={String(d.id)}>{d.code} — {d.name}</option>
                  ))}
                </select>
                <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Cluster</label>
                <input
                  type="number" min="1" value={newUser.cluster}
                  onChange={(e) => setNewUser({ ...newUser, cluster: e.target.value })}
                  placeholder="Cluster number"
                  style={{ ...inputSt, marginBottom: "16px" }}
                />
              </>
            )}

            <p style={{ margin: "0 0 22px", fontSize: "11.5px", color: "#94A3B8", lineHeight: 1.6 }}>
              A temporary password is generated and emailed to this address. They choose a new password at first login.
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleInvite} disabled={addingUser} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "#EAB308",
                border: "none", color: "#0A0C12", fontSize: "13px", fontWeight: "700",
                cursor: addingUser ? "not-allowed" : "pointer", opacity: addingUser ? 0.6 : 1,
                transition: "all 0.2s", fontFamily: "Sora, sans-serif",
                boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
              }}>
                {addingUser ? "Sending…" : "Create & Email Login"}
              </button>
              <button onClick={() => setShowAddUser(false)} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.2s", fontFamily: "Sora, sans-serif"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div style={modalOverlaySt} onClick={() => setEditUser(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardSt()}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "700", color: "#F0EDE8" }}>
              ✎ Edit User
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748B" }}>{editUser.email}</p>

            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Name</label>
            <input
              type="text" value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Full name"
              style={{ ...inputSt, marginBottom: "16px" }}
            />

            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Role</label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              style={{ ...inputSt, marginBottom: (editRole === "faculty" || editRole === "admin" || editRole === "coordinator") ? "16px" : "24px", cursor: "pointer" }}
            >
              <option value="user">User</option>
              <option value="faculty">Faculty</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </select>

            {(editRole === "coordinator" || editRole === "faculty") && (
              <>
                <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Department</label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  style={{ ...inputSt, marginBottom: "16px", cursor: "pointer" }}
                >
                  <option value="">— Select department —</option>
                  {departments.map(d => (
                    <option key={d.id} value={String(d.id)}>{d.code} — {d.name}</option>
                  ))}
                </select>
                <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Cluster</label>
                <input
                  type="number" min="1" value={editCluster}
                  onChange={(e) => setEditCluster(e.target.value)}
                  placeholder="Cluster number"
                  style={{ ...inputSt, marginBottom: "24px" }}
                />
              </>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleSaveEdit} disabled={savingEdit} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "#EAB308",
                border: "none", color: "#0A0C12", fontSize: "13px", fontWeight: "700",
                cursor: savingEdit ? "not-allowed" : "pointer", opacity: savingEdit ? 0.6 : 1,
                transition: "all 0.2s", fontFamily: "Sora, sans-serif",
                boxShadow: "0 4px 16px rgba(234,179,8,0.3)",
              }}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditUser(null)} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.2s", fontFamily: "Sora, sans-serif"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Faculty Login Modal */}
      {loginTarget && (
        <div style={modalOverlaySt} onClick={() => setLoginTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardSt("rgba(168,85,247,0.3)")}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "700", color: "#A855F7" }}>
              🔑 Create Login
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748B" }}>
              {loginTarget.name} · {loginTarget.email}
            </p>
            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>First Password</label>
            <input
              type="text" value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{ ...inputSt, marginBottom: "24px" }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleCreateLogin} disabled={creatingLogin} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "#A855F7", border: "none", color: "#FFF", fontSize: "13px", fontWeight: "700",
                cursor: creatingLogin ? "not-allowed" : "pointer", opacity: creatingLogin ? 0.6 : 1,
                fontFamily: "Sora, sans-serif",
              }}>
                {creatingLogin ? "Creating…" : "Create Login"}
              </button>
              <button onClick={() => setLoginTarget(null)} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", fontFamily: "Sora, sans-serif"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div style={modalOverlaySt} onClick={() => setResetTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardSt("rgba(234,179,8,0.3)")}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: "700", color: "#EAB308" }}>🔑 Reset Password</h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748B" }}>{resetTarget.name} · {resetTarget.email}</p>
            <label style={{ display: "block", fontSize: "10px", color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: "700" }}>Temporary Password</label>
            <input
              type="text" value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="At least 6 characters"
              style={{ ...inputSt, marginBottom: "10px" }}
            />
            <p style={{ margin: "0 0 22px", fontSize: "11.5px", color: "#94A3B8", lineHeight: 1.6 }}>
              The user will be asked to choose a new password at next login. This also clears any login lockout.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleResetPassword} disabled={resettingPw} style={{
                flex: 1, padding: "12px", borderRadius: "10px", background: "#EAB308", border: "none",
                color: "#0A0C12", fontSize: "13px", fontWeight: "700",
                cursor: resettingPw ? "not-allowed" : "pointer", opacity: resettingPw ? 0.6 : 1, fontFamily: "Sora, sans-serif",
              }}>
                {resettingPw ? "Resetting…" : "Reset Password"}
              </button>
              <button onClick={() => setResetTarget(null)} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "Sora, sans-serif",
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserTarget && (
        <div style={modalOverlaySt} onClick={() => setDeleteUserTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardSt("rgba(239,68,68,0.3)")}>
            <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: "700", color: "#F87171" }}>
              ⚠️ Delete User
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#94A3B8", lineHeight: 1.7 }}>
              Permanently delete <strong style={{ color: "#F0EDE8" }}>{deleteUserTarget.name}</strong> ({deleteUserTarget.email})? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleDeleteUser} disabled={deletingUser} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "linear-gradient(135deg, #DC2626, #B91C1C)",
                border: "none", color: "#FFF", fontSize: "13px", fontWeight: "700",
                cursor: deletingUser ? "not-allowed" : "pointer", opacity: deletingUser ? 0.6 : 1,
                transition: "all 0.2s", fontFamily: "Sora, sans-serif",
                boxShadow: "0 4px 14px rgba(220,38,38,0.4)",
              }}>
                {deletingUser ? "Deleting…" : "Yes, Delete"}
              </button>
              <button onClick={() => setDeleteUserTarget(null)} style={{
                flex: 1, padding: "12px", borderRadius: "10px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94A3B8", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.2s", fontFamily: "Sora, sans-serif"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons — corner arrow, matches Faculty/Sections/Timetable. Admin is the last page, so only "Previous" is shown. */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        padding: '20px 0 24px'
      }}>
        <button
          onClick={() => window.location.href = '/faculty-timetable'}
          title="Previous: Faculty Timetable"
          style={{
            width: '38px',
            height: '38px',
            backgroundColor: 'rgba(92,96,112,0.1)',
            color: '#94A3B8',
            border: '1px solid rgba(92,96,112,0.25)',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Sora, sans-serif',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ←
        </button>
      </div>
    </div>
  );
}