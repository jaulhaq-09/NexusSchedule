import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRooms, getSections, getSubjects, getFaculty, aiTodayWorkload, getTimetable, aiLabUtilization, getAuditLogs } from '../services/api';
import { useLocation } from "react-router-dom";
// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};
export default function DashboardUltra() {

  useScrollToTop();  // ✅ ADD THIS LINE

  const navigate = useNavigate();
  const isAdmin = localStorage.getItem("userRole") === "admin";
  const userEmail = localStorage.getItem("userEmail") || "Guest";

  const [stats, setStats] = useState({ rooms: 0, sections: 0, subjects: 0, faculty: 0, coreSubjects: 0 });
  const [loading, setLoading] = useState(true);
  const [animatedStats, setAnimatedStats] = useState({ rooms: 0, sections: 0, subjects: 0, faculty: 0, coreSubjects: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const DASHBOARD_TIPS = [
    "Core subjects are auto-prioritized for morning slots when generating a timetable.",
    "Pin a lab or subject to a fixed slot — the generator will never move it.",
    "Paired labs (Batch 1 / Batch 2) always share one time slot automatically.",
    "Use Copies (1x/2x) on a lab pairing to control how many times it repeats per week.",
    "Cross-section faculty clashes are detected automatically before you save.",
  ];
  const [tipIndex] = useState(() => Math.floor(Math.random() * DASHBOARD_TIPS.length));
  const [facultyWorkload, setFacultyWorkload] = useState([]);
  const [workloadDay, setWorkloadDay] = useState('');

  const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayIdx = ALL_DAYS.indexOf(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const [activeDay, setActiveDay] = useState(todayIdx >= 0 ? ALL_DAYS[todayIdx] : "Monday");
  const [dayEntries, setDayEntries] = useState([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [clusterFilter, setClusterFilter] = useState("All");
  const [semesterFilter, setSemesterFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [labUtilization, setLabUtilization] = useState([]);
  const [labLoading, setLabLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [fullAuditLogs, setFullAuditLogs] = useState([]);
  const [fullAuditLoading, setFullAuditLoading] = useState(false);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [r, s, sub, f] = await Promise.all([
          getRooms(), getSections(), getSubjects(), getFaculty()
        ]);
        const statsData = {
          rooms: r.data?.length || 0,
          sections: s.data?.length || 0,
          subjects: sub.data?.length || 0,
          faculty: f.data?.length || 0,
          coreSubjects: (sub.data || []).filter(subj => subj.is_core).length,
        };
        setStats(statsData);
      } catch { /* swallow */ }
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  // Fetch today's real faculty workload (replaces old random-number chart)
  useEffect(() => {
    const fetchWorkload = async () => {
      try {
        const res = await aiTodayWorkload();
        const rows = res.data?.faculty_workload || [];
        const workload = rows
          .map(row => ({
            name: row.name?.split(' ')[0] || 'Faculty',
            hours: row.periods_today || 0,
            subjects: row.subjects || [],
            sections: row.sections || [],
          }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 6);
        setFacultyWorkload(workload);
        setWorkloadDay(res.data?.day || '');
      } catch {
        setFacultyWorkload([]);
      }
    };
    fetchWorkload();
  }, []);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const openActivityModal = async () => {
    setShowActivityModal(true);
    setFullAuditLoading(true);
    try {
      const res = await getAuditLogs(50);
      setFullAuditLogs(res.data || []);
    } catch {
      setFullAuditLogs([]);
    } finally {
      setFullAuditLoading(false);
    }
  };

  // Fetch weekly lab utilization (combined main + additional classes)
  useEffect(() => {
    const fetchLabUtilization = async () => {
      setLabLoading(true);
      try {
        const res = await aiLabUtilization();
        setLabUtilization(res.data?.utilization || []);
      } catch {
        setLabUtilization([]);
      } finally {
        setLabLoading(false);
      }
    };
    fetchLabUtilization();
  }, []);

  // Fetch timetable entries for whichever day tab is active
  useEffect(() => {
    const fetchDayView = async () => {
      setDayLoading(true);
      try {
        const res = await getTimetable(activeDay);
        setDayEntries(res.data || []);
        // Reset all filters when the day changes — a cluster/semester/section
        // picked on Monday may not even exist on Tuesday
        setClusterFilter("All");
        setSemesterFilter("All");
        setSectionFilter("All");
      } catch {
        setDayEntries([]);
      } finally {
        setDayLoading(false);
      }
    };
    fetchDayView();
  }, [activeDay]);

  // Animate count-up
  useEffect(() => {
    if (loading) return;

    const duration = 1500;
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setAnimatedStats({
        rooms: Math.floor(stats.rooms * progress),
        sections: Math.floor(stats.sections * progress),
        subjects: Math.floor(stats.subjects * progress),
        faculty: Math.floor(stats.faculty * progress),
        coreSubjects: Math.floor(stats.coreSubjects * progress),
      });

      if (currentStep >= steps) {
        setAnimatedStats(stats);
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [stats, loading]);

  // Maps action types to icon + color; falls back to a generic entry for
  // any action string not explicitly listed here (new AuditService actions
  // added later will still render sensibly instead of breaking).
  const actionStyle = (action = "") => {
    if (action.includes("TIMETABLE")) return { icon: "📅", color: "#818CF8" };
    if (action.includes("FACULTY")) return { icon: "👤", color: "#10B981" };
    if (action.includes("ROOM")) return { icon: "🏫", color: "#F59E0B" };
    if (action.includes("SUBJECT")) return { icon: "📚", color: "#EC4899" };
    if (action.includes("SECTION")) return { icon: "📖", color: "#3B82F6" };
    if (action.includes("DELETE")) return { icon: "🗑️", color: "#EF4444" };
    return { icon: "📝", color: "#94A3B8" };
  };

  const timeAgo = (isoString) => {
    if (!isoString) return "";
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  const fullActivity = fullAuditLogs.map(log => ({
    action: log.description || `${log.action} — ${log.entity_type}`,
    time: timeAgo(log.timestamp),
    ...actionStyle(log.action),
  }));

  const statCards = [
    { label: 'Subjects', value: animatedStats.subjects, icon: '📚', color: '#F59E0B', tag: 'ACADEMIC' },
    { label: 'Faculty', value: animatedStats.faculty, icon: '👤', color: '#818CF8', tag: 'ACTIVE' },
    { label: 'Rooms', value: animatedStats.rooms, icon: '🏫', color: '#10B981', tag: 'FACILITIES' },
    { label: 'Sections', value: animatedStats.sections, icon: '📖', color: '#EF4444', tag: 'CLASSES' },
    { label: 'Core Subjects', value: animatedStats.coreSubjects, icon: '🎯', color: '#FBBF24', tag: 'PRIORITY' },
  ];

  const maxWorkload = Math.max(...facultyWorkload.map(f => f.hours), 20);

  return (
    <div style={{ height: "100%", background: "linear-gradient(135deg, #080C14 0%, #0F172A 100%)", padding: "32px 40px 0", fontFamily: "Sora, sans-serif", position: "relative", overflow: "hidden" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(2.2); opacity: 0; } }

        .stat-card:hover { transform: translateY(-8px) scale(1.02) !important; box-shadow: 0 20px 60px var(--glow-color) !important; }
        .activity-item:hover { background: rgba(255,255,255,0.08) !important; transform: translateX(8px) !important; }

        .glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
        .glass-strong { background: rgba(255,255,255,0.08); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.15); }
      `}</style>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Welcome Banner with Clock */}
        <div className="glass-strong" style={{
          borderRadius: "24px",
          padding: "40px",
          marginBottom: "32px",
          animation: "fadeInDown 0.8s ease",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
        }}>
          {/* Gradient Orb */}
          <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "250px", height: "250px", background: "radial-gradient(circle, rgba(234,179,8,0.2), transparent)", borderRadius: "50%", filter: "blur(40px)" }} />

          {/* Left Content */}
          <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#94A3B8", maxWidth: "650px", lineHeight: 1.5 }}>
              {isAdmin
                ? `Logged in as ${userEmail}. Generate conflict-free timetables in seconds with AI.`
                : "View system statistics and analytics. Login as admin to generate and manage timetables."
              }
            </p>

            {isAdmin && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ position: "relative", width: "8px", height: "8px", flexShrink: 0 }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981", animation: "pulseDot 2s ease-in-out infinite" }} />
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#10B981" }} />
                  </span>
                  <span style={{ fontSize: "11px", color: "#10B981", fontWeight: "700", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.5px" }}>AI SCHEDULER READY</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", maxWidth: "480px" }}>
                  <span style={{ fontSize: "14px", flexShrink: 0 }}>💡</span>
                  <span style={{ fontSize: "11.5px", color: "#94A3B8", lineHeight: 1.5 }}>{DASHBOARD_TIPS[tipIndex]}</span>
                </div>
              </div>
            )}

            {!isAdmin && (
              <button onClick={() => navigate("/login")} style={{
                padding: "16px 36px",
                background: "linear-gradient(135deg, #EAB308, #F59E0B)",
                border: "none",
                borderRadius: "12px",
                color: "#0A0C12",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.3s",
                boxShadow: "0 4px 20px rgba(234,179,8,0.4)"
              }}>
                🔐 Login as Admin
              </button>
            )}
          </div>

          {/* Real-Time Clock */}
          <div className="glass" style={{
            textAlign: "center",
            padding: "16px 24px",
            borderRadius: "14px",
            flexShrink: 0,
            zIndex: 2,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              fontSize: "22px",
              fontWeight: "700",
              color: "#EAB308",
              letterSpacing: "1px",
              fontFamily: "JetBrains Mono, monospace",
              lineHeight: 1,
              marginBottom: "6px"
            }}>
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              }).toUpperCase()}
            </div>
            <div style={{
              fontSize: "10px",
              color: "#94A3B8",
              letterSpacing: "1px",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: "500"
            }}>
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              }).toUpperCase()}
            </div>

            <button onClick={openActivityModal} style={{
              marginTop: "14px",
              padding: "8px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              color: "#94A3B8",
              fontSize: "11px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.5px",
              width: "100%"
            }}>
              🔄 View All Activity
            </button>
          </div> 
        </div> 

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {statCards.map((card, idx) => (
            <div key={idx} className="stat-card glass" style={{
                  borderRadius: "16px",
                  padding: "20px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  animation: `fadeInUp 0.6s ease ${idx * 0.1}s both`,
                  cursor: "pointer",
                  '--glow-color': `${card.color}40`,
                  borderColor: `${card.color}33`,
                  boxShadow: `0 2px 12px ${card.color}10`
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${card.color}, ${card.color}80)`, transform: "scaleX(0)", transformOrigin: "left", transition: "transform 0.4s ease" }} className="top-border" />

                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{
                        padding: "4px 10px",
                        background: `${card.color}20`,
                        border: `1px solid ${card.color}40`,
                        borderRadius: "14px",
                        fontSize: "9px",
                        fontWeight: "700",
                        color: card.color,
                        letterSpacing: "1px",
                        fontFamily: "JetBrains Mono, monospace"
                      }}>
                        {card.tag}
                      </div>
                      <div style={{ fontSize: "20px", opacity: 0.9 }}>{card.icon}</div>
                    </div>
                    <div style={{
                      fontSize: "32px",
                      fontWeight: "800",
                      color: card.color,
                      marginBottom: "2px",
                      fontFamily: "JetBrains Mono, monospace",
                      lineHeight: 1
                    }}>
                      {loading ? "..." : card.value}
                    </div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                      {card.label}
                    </div>
                  </div>
                </div>
          ))}
        </div>

       {/* Day-wise Timetable */}
        <div className="glass-strong" style={{
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "32px",
          animation: "fadeInUp 0.6s ease 0.5s both",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "18px" }}>📆</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#F0EDE8" }}>Day-wise Timetable</h3>
              {!dayLoading && (() => {
                const cScoped = clusterFilter === "All" ? dayEntries : dayEntries.filter(e => String(e.cluster) === clusterFilter);
                const sScoped = semesterFilter === "All" ? cScoped : cScoped.filter(e => String(e.semester) === semesterFilter);
                const finalScoped = sectionFilter === "All" ? sScoped : sScoped.filter(e => e.section === sectionFilter);
                return (
                  <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#64748B", background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: "12px" }}>
                    {finalScoped.length} {finalScoped.length === 1 ? "class" : "classes"}
                  </span>
                );
              })()}

            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {ALL_DAYS.map(d => (
                <button key={d} onClick={() => setActiveDay(d)} style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: activeDay === d ? "1px solid rgba(234,179,8,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  background: activeDay === d ? "linear-gradient(135deg, rgba(234,179,8,0.2), rgba(245,158,11,0.1))" : "rgba(255,255,255,0.03)",
                  color: activeDay === d ? "#EAB308" : "#94A3B8",
                  fontWeight: activeDay === d ? "700" : "500",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "JetBrains Mono, monospace",
                  boxShadow: activeDay === d ? "0 2px 12px rgba(234,179,8,0.15)" : "none"
                }}>
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {!dayLoading && dayEntries.length > 0 && (() => {
            // Interactive pill row — used when there's a real choice to make (2+ options)
            const filterPillRow = (label, options, active, setActive) => (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "1px", minWidth: "70px" }}>{label}:</span>
                {["All", ...options].map(opt => (
                  <button key={opt} onClick={() => setActive(opt)} style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    border: active === opt ? "1px solid rgba(129,140,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    background: active === opt ? "rgba(129,140,248,0.15)" : "rgba(255,255,255,0.03)",
                    color: active === opt ? "#818CF8" : "#94A3B8",
                    fontWeight: active === opt ? "700" : "500",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "JetBrains Mono, monospace"
                  }}>
                    {opt}
                  </button>
                ))}
              </div>
            );

            // Read-only info badge — used when there's only one possible value,
            // so the user still sees exactly what they're scoped into rather
            // than the row disappearing with no explanation.
            const filterInfoRow = (label, value) => (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "1px", minWidth: "70px" }}>{label}:</span>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: "1px solid rgba(129,140,248,0.3)",
                  background: "rgba(129,140,248,0.08)",
                  color: "#818CF8",
                  fontWeight: "700",
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, monospace"
                }}>
                  {value} <span style={{ color: "#64748B", fontWeight: "500" }}>(only one)</span>
                </span>
              </div>
            );

            const clusterScopedPreview = clusterFilter === "All"
              ? dayEntries
              : dayEntries.filter(e => String(e.cluster) === clusterFilter);
            const semesterScopedPreview = semesterFilter === "All"
              ? clusterScopedPreview
              : clusterScopedPreview.filter(e => String(e.semester) === semesterFilter);

            const clusterOptions = [...new Set(dayEntries.map(e => e.cluster).filter(c => c !== null && c !== undefined))].map(String).sort();
            const semesterOptions = [...new Set(clusterScopedPreview.map(e => e.semester).filter(s => s !== null && s !== undefined))].map(String).sort((a, b) => a - b);
            const sectionOptionsPreview = [...new Set(semesterScopedPreview.map(e => e.section).filter(Boolean))];

            const hasAnyContext = clusterOptions.length > 0 || semesterOptions.length > 0 || sectionOptionsPreview.length > 0;

            return hasAnyContext ? (
              <div style={{ marginBottom: "20px" }}>
                {clusterOptions.length > 1
                  ? filterPillRow("Cluster", clusterOptions, clusterFilter, (v) => { setClusterFilter(v); setSemesterFilter("All"); setSectionFilter("All"); })
                  : clusterOptions.length === 1 && filterInfoRow("Cluster", clusterOptions[0])}

                {semesterOptions.length > 1
                  ? filterPillRow("Semester", semesterOptions, semesterFilter, (v) => { setSemesterFilter(v); setSectionFilter("All"); })
                  : semesterOptions.length === 1 && filterInfoRow("Semester", semesterOptions[0])}

                {sectionOptionsPreview.length > 1
                  ? filterPillRow("Section", sectionOptionsPreview, sectionFilter, setSectionFilter)
                  : sectionOptionsPreview.length === 1 && filterInfoRow("Section", sectionOptionsPreview[0])}
              </div>
            ) : null;
          })()}

          {dayLoading ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#64748B" }}>
              <div style={{ fontSize: "13px", fontFamily: "JetBrains Mono, monospace" }}>Loading schedule…</div>
            </div>
          ) : dayEntries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "#64748B" }}>
              <div style={{ fontSize: "40px", marginBottom: "14px", opacity: 0.25 }}>📭</div>
              <div style={{ fontSize: "14px" }}>No classes scheduled for {activeDay}</div>
            </div>
          ) : (
            (() => {
              const subjectPalette = ["#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#06B6D4"];
              const colorForSubject = (name) => {
                if (!name) return "#64748B";
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                return subjectPalette[Math.abs(hash) % subjectPalette.length];
              };
             const initials = (name) => (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

              // Cascading filter: cluster narrows semester options, semester
              // narrows section options, each applied on top of the last.
              const clusterScoped = clusterFilter === "All"
                ? dayEntries
                : dayEntries.filter(e => String(e.cluster) === clusterFilter);

              const semesterScoped = semesterFilter === "All"
                ? clusterScoped
                : clusterScoped.filter(e => String(e.semester) === semesterFilter);

              const filteredEntries = sectionFilter === "All"
                ? semesterScoped
                : semesterScoped.filter(e => e.section === sectionFilter);

              const sortedEntries = filteredEntries.slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));

              // Bar chart data: total periods per faculty for the selected day (and section, if filtered)
              const facultyLoad = {};
              filteredEntries.forEach(e => {
                const fname = (e.faculty || "").trim();
                if (!fname || fname === "—" || fname === "-") return;
                facultyLoad[fname] = (facultyLoad[fname] || 0) + (e.span || 1);
              });
              const facultyBars = Object.entries(facultyLoad)
                .map(([name, periods]) => ({ name: name.split(" ")[0], periods }))
                .sort((a, b) => b.periods - a.periods)
                .slice(0, 8);
              const maxFacultyLoad = Math.max(...facultyBars.map(f => f.periods), 1);

              // Line chart data: how many classes are running at each distinct time slot
              const slotCounts = {};
              filteredEntries.forEach(e => {
                if (!e.time) return;
                slotCounts[e.time] = (slotCounts[e.time] || 0) + 1;
              });
              const timeline = Object.entries(slotCounts)
                .map(([time, count]) => ({ time, count }))
                .sort((a, b) => a.time.localeCompare(b.time));
              const maxDensity = Math.max(...timeline.map(t => t.count), 1);

              const buildSmoothPath = (pts, xKey, yKey) => {
                if (pts.length < 2) return `M ${pts[0]?.[xKey] || 0} ${pts[0]?.[yKey] || 0}`;
                let d = `M ${pts[0][xKey]} ${pts[0][yKey]}`;
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[i === 0 ? i : i - 1];
                  const p1 = pts[i];
                  const p2 = pts[i + 1];
                  const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
                  const cp1x = p1[xKey] + (p2[xKey] - p0[xKey]) / 6;
                  const cp1y = p1[yKey] + (p2[yKey] - p0[yKey]) / 6;
                  const cp2x = p2[xKey] - (p3[xKey] - p1[xKey]) / 6;
                  const cp2y = p2[yKey] - (p3[yKey] - p1[yKey]) / 6;
                  d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[xKey]} ${p2[yKey]}`;
                }
                return d;
              };

              const LW = 480, LH = 140, lPadX = 30, lPadY = 20;
              const lStepX = timeline.length > 1 ? (LW - lPadX * 2) / (timeline.length - 1) : 0;
              const lPoints = timeline.map((t, i) => ({
                px: timeline.length > 1 ? lPadX + i * lStepX : LW / 2,
                py: LH - lPadY - (t.count / maxDensity) * (LH - lPadY * 2),
                ...t,
              }));
              const linePath = buildSmoothPath(lPoints, "px", "py");

              return (
                <div>
                  {facultyBars.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                      {/* Bar chart — faculty load for this day */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px 20px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
                          Faculty Load — {activeDay}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "110px" }}>
                          {facultyBars.map((f, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: "10px", fontWeight: "700", color: "#EAB308", fontFamily: "JetBrains Mono, monospace" }}>{f.periods}</span>
                              <div style={{
                                width: "100%",
                                height: `${(f.periods / maxFacultyLoad) * 80}px`,
                                background: "linear-gradient(180deg, #EAB308, #F59E0B)",
                                borderRadius: "5px 5px 0 0",
                                boxShadow: "0 2px 10px rgba(234,179,8,0.25)",
                                transition: "height 0.4s ease"
                              }} />
                              <span style={{ fontSize: "9px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60px" }}>{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Line chart — class density across the day's timeline */}
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px 20px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
                          Class Density — {activeDay}
                        </div>
                        <svg viewBox={`0 0 ${LW} ${LH}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                          <defs>
                            <linearGradient id="densityFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {lPoints.length > 1 && (
                            <path d={`${linePath} L ${lPoints[lPoints.length - 1].px} ${LH - lPadY} L ${lPoints[0].px} ${LH - lPadY} Z`} fill="url(#densityFill)" />
                          )}
                          <path d={linePath} fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
                          {lPoints.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.px} cy={p.py} r="4" fill="#0F172A" stroke="#818CF8" strokeWidth="2" />
                              <text x={p.px} y={p.py - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#818CF8" fontFamily="JetBrains Mono, monospace">{p.count}</text>
                              <text x={p.px} y={LH - 2} textAnchor="middle" fontSize="8" fill="#64748B" fontFamily="JetBrains Mono, monospace">{p.time?.split(" ")[0]}</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </div>
                  )}

                <div style={{ overflowX: "auto", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px" }}>
                    <thead>
                      <tr>
                        {["Time Slot", "Section", "Subject", "Faculty", "Room"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#64748B", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.2px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((e, i) => {
                        const subjColor = colorForSubject(e.subject);
                        return (
                          <tr
                            key={e.id || i}
                            className="activity-item"
                            style={{
                              background: i % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                              borderLeft: e.is_core ? "3px solid #EAB308" : "3px solid transparent",
                              borderBottom: i === sortedEntries.length - 1 ? "none" : "1px solid rgba(255,255,255,0.04)",
                              transition: "background 0.15s"
                            }}
                          >
                            <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#CBD5E1", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                {e.time || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "13px 16px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "700", color: "#818CF8", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)", padding: "3px 10px", borderRadius: "6px", fontFamily: "JetBrains Mono, monospace" }}>
                                {e.section || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "13px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: subjColor, flexShrink: 0, boxShadow: `0 0 8px ${subjColor}80` }} />
                                <span style={{ color: e.is_core ? "#F0EDE8" : "#CBD5E1", fontWeight: e.is_core ? "700" : "500" }}>{e.subject || "—"}</span>
                                {e.is_core && (
                                  <span style={{ fontSize: "9px", fontWeight: "800", color: "#0C0A00", background: "linear-gradient(135deg,#FBBF24,#F59E0B)", padding: "2px 7px", borderRadius: "10px" }}>CORE</span>
                                )}
                                {e.is_lab && (
                                  <span style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 7px", borderRadius: "10px" }}>LAB</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "13px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "#94A3B8", flexShrink: 0 }}>
                                  {initials(e.faculty)}
                                </div>
                                <span style={{ color: "#E8E3D8" }}>{e.faculty || "—"}</span>
                              </div>
                            </td>
                            <td style={{ padding: "13px 16px", color: "#64748B", fontSize: "11px", fontFamily: "JetBrains Mono, monospace" }}>{e.room || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Weekly Lab Utilization */}
        <div className="glass-strong" style={{
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "32px",
          animation: "fadeInUp 0.6s ease 0.55s both",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <span style={{ fontSize: "18px" }}>🔬</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#F0EDE8" }}>Weekly Lab Schedule</h3>
          </div>

          {labLoading ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#64748B" }}>
              <div style={{ fontSize: "13px", fontFamily: "JetBrains Mono, monospace" }}>Loading lab data…</div>
            </div>
          ) : labUtilization.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "#64748B" }}>
              <div style={{ fontSize: "40px", marginBottom: "14px", opacity: 0.25 }}>🔬</div>
              <div style={{ fontSize: "14px" }}>No lab sessions scheduled this week</div>
            </div>
          ) : (() => {
            const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const uniqueLabs = [...new Set(labUtilization.map(u => u.lab_name))];
            const totalSessionsToday = labUtilization.filter(u => u.day === todayName).length;

            const labCounts = {};
            labUtilization.forEach(u => { labCounts[u.lab_name] = (labCounts[u.lab_name] || 0) + 1; });
            const busiestLab = Object.entries(labCounts).sort((a, b) => b[1] - a[1])[0];

            const byDay = {};
            ALL_DAYS.forEach(d => { byDay[d] = labUtilization.filter(u => u.day === d).sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || "")); });

            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
                  {[
                    { label: "Total Labs", value: uniqueLabs.length, icon: "🔬", color: "#F59E0B" },
                    { label: "Labs Today", value: totalSessionsToday, icon: "📅", color: "#10B981" },
                    { label: "Busiest Lab", value: busiestLab ? `Room ${busiestLab[0]}` : "—", icon: "👥", color: "#818CF8" },
                  ].map((card, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "20px" }}>{card.icon}</span>
                        <span style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px" }}>{card.label}</span>
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: "700", color: card.color, fontFamily: "JetBrains Mono, monospace" }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>
                  {ALL_DAYS.map(day => {
                    const isToday = day === todayName;
                    const sessions = byDay[day];
                    return (
                      <div key={day} style={{
                        background: isToday ? "rgba(234,179,8,0.06)" : "rgba(255,255,255,0.015)",
                        border: isToday ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "10px",
                        padding: "10px",
                        boxShadow: "none",
                        minHeight: "110px"
                      }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: isToday ? "#EAB308" : "#94A3B8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace" }}>
                          {day.slice(0, 3)}{isToday && " •"}
                        </div>
                        {sessions.length === 0 ? (
                          <div style={{ fontSize: "10px", color: "#374151", fontStyle: "italic" }}>No labs</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {sessions.map((s, i) => (
                              <div key={i} title={`${s.subject} — ${s.sections_using.join(", ")}`} style={{
                                background: "rgba(245,158,11,0.1)",
                                border: "1px solid rgba(245,158,11,0.2)",
                                borderRadius: "6px",
                                padding: "6px 8px",
                              }}>
                                <div style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>Rm {s.lab_name}</div>
                                <div style={{ fontSize: "9px", color: "#CBD5E1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.subject}</div>
                                <div style={{ fontSize: "8px", color: "#64748B" }}>{s.time_slot?.split(" ")[0]}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Faculty Workload */}
        <div style={{ marginBottom: "32px" }}>
          <div className="glass-strong" style={{
            borderRadius: "16px",
            padding: "24px",
            animation: "fadeInLeft 0.6s ease 0.6s both",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            alignSelf: "start"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <span style={{ fontSize: "18px" }}>📊</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#F0EDE8" }}>
                Faculty Workload {workloadDay && <span style={{ fontSize: "13px", fontWeight: "500", color: "#64748B" }}>— {workloadDay}</span>}
              </h3>
            </div>

            {facultyWorkload.length > 0 ? (
              (() => {
                const W = 560, H = 220, padX = 40, padY = 24;
                const n = facultyWorkload.length;
                const stepX = n > 1 ? (W - padX * 2) / (n - 1) : 0;
                const yFor = (h) => H - padY - (h / maxWorkload) * (H - padY * 2);
                const points = facultyWorkload.map((f, i) => ({
                  x: n > 1 ? padX + i * stepX : W / 2,
                  y: yFor(f.hours),
                  ...f,
                }));

                // Smooth curve through points using cubic Bezier segments
                const buildSmoothPath = (pts) => {
                  if (pts.length < 2) return `M ${pts[0]?.x || 0} ${pts[0]?.y || 0}`;
                  let d = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[i === 0 ? i : i - 1];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
                    const cp1x = p1.x + (p2.x - p0.x) / 6;
                    const cp1y = p1.y + (p2.y - p0.y) / 6;
                    const cp2x = p2.x - (p3.x - p1.x) / 6;
                    const cp2y = p2.y - (p3.y - p1.y) / 6;
                    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
                  }
                  return d;
                };

                const linePath = buildSmoothPath(points);
                const areaPath = points.length > 1
                  ? `${linePath} L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`
                  : "";

                return (
                  <div style={{ animation: "fadeInLeft 0.6s ease both", maxWidth: "600px", margin: "0 auto" }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                      <defs>
                        <linearGradient id="workloadFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EAB308" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal gridlines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
                        <line key={i} x1={padX} x2={W - padX} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      ))}

                      {areaPath && <path d={areaPath} fill="url(#workloadFill)" />}
                      <path d={linePath} fill="none" stroke="#EAB308" strokeWidth="2.5" strokeLinecap="round" />

                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="5" fill="#0F172A" stroke="#EAB308" strokeWidth="2.5" />
                          <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#EAB308" fontFamily="JetBrains Mono, monospace">
                            {p.hours}h
                          </text>
                          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
                            {p.name}
                          </text>
                        </g>
                      ))}
                    </svg>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "20px" }}>
                      {facultyWorkload.map((faculty, idx) => (
                        faculty.sections.length > 0 && (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>{faculty.name}:</span>
                            {faculty.sections.map((sec, si) => (
                              <span key={si} style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace", color: "#818CF8", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)", padding: "2px 8px", borderRadius: "10px" }}>
                                {sec}
                              </span>
                            ))}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>📊</div>
                <div>No workload data available</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .stat-card:hover .top-border {
          transform: scaleX(1) !important;
        }
      `}</style>
       
       {showActivityModal && (
        <div onClick={() => setShowActivityModal(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100, padding: "20px"
        }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-strong" style={{
            borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "560px",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#F0EDE8" }}>All Recent Activity</h3>
              <button onClick={() => setShowActivityModal(false)} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px", color: "#94A3B8", width: "28px", height: "28px",
                cursor: "pointer", fontSize: "14px"
              }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {fullAuditLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "13px" }}>Loading…</div>
              ) : fullActivity.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "13px" }}>No activity found</div>
              ) : fullActivity.map((item, idx) => (
                <div key={idx} className="glass" style={{
                  padding: "14px", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "10px"
                }}>
                  <div style={{ fontSize: "20px", background: `${item.color}20`, padding: "6px", borderRadius: "8px" }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", color: "#F0EDE8", marginBottom: "4px" }}>{item.action}</div>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}