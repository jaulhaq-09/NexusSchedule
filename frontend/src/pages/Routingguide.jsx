/**
 * Routingguide.jsx
 * Developer reference — shows all routes in the app.
 * Not linked in production navigation.
 */

const ROUTES = [
  { path: "/",          page: "Home",      access: "Public",    desc: "Landing page with info about the system" },
  { path: "/login",     page: "Login",     access: "Public",    desc: "Admin login page" },
  { path: "/signup",    page: "Signup",    access: "Public",    desc: "Admin registration" },
  { path: "/dashboard", page: "Dashboard", access: "Protected", desc: "Overview stats and quick actions" },
  { path: "/faculty",   page: "Faculty",   access: "Admin",     desc: "Add / edit / delete faculty" },
  { path: "/subjects",  page: "Subjects",  access: "Admin",     desc: "Add / edit / delete subjects" },
  { path: "/rooms",     page: "Rooms",     access: "Admin",     desc: "Add / edit / delete rooms" },
  { path: "/sections",  page: "Sections",  access: "Admin",     desc: "Add / edit / delete sections" },
  { path: "/timetable", page: "Timetable", access: "Protected", desc: "Generate, view, save and export timetables" },
  { path: "/admin",     page: "Admin",     access: "Admin",     desc: "System stats and danger-zone actions" },
];

const BACKEND_ROUTES = [
  { method:"POST",   path:"/login",                    desc:"Admin login → JWT token" },
  { method:"POST",   path:"/signup",                   desc:"Register admin" },
  { method:"GET",    path:"/faculty",                  desc:"List all faculty" },
  { method:"POST",   path:"/faculty",                  desc:"Add faculty" },
  { method:"PUT",    path:"/faculty/{id}",             desc:"Update faculty" },
  { method:"DELETE", path:"/faculty/{id}",             desc:"Delete faculty" },
  { method:"GET",    path:"/rooms",                    desc:"List all rooms" },
  { method:"POST",   path:"/rooms",                    desc:"Add room" },
  { method:"PUT",    path:"/rooms/{id}",               desc:"Update room" },
  { method:"DELETE", path:"/rooms/{id}",               desc:"Delete room" },
  { method:"GET",    path:"/sections",                 desc:"List all sections" },
  { method:"POST",   path:"/sections",                 desc:"Add section" },
  { method:"PUT",    path:"/sections/{id}",            desc:"Update section" },
  { method:"DELETE", path:"/sections/{id}",            desc:"Delete section" },
  { method:"GET",    path:"/subjects",                 desc:"List all subjects" },
  { method:"POST",   path:"/subjects",                 desc:"Add subject" },
  { method:"PUT",    path:"/subjects/{id}",            desc:"Update subject" },
  { method:"DELETE", path:"/subjects/{id}",            desc:"Delete subject" },
  { method:"GET",    path:"/timetable/generate",       desc:"Generate timetable" },
  { method:"GET",    path:"/timetable/view",           desc:"View timetable entries" },
  { method:"GET",    path:"/timetables/",              desc:"List saved timetables" },
  { method:"POST",   path:"/timetables/",              desc:"Save a timetable" },
  { method:"DELETE", path:"/timetables/{id}",          desc:"Delete saved timetable" },
  { method:"POST",   path:"/ocr/upload-generate",      desc:"Upload image/PDF → extract timetable" },
  { method:"GET",    path:"/ocr/status",               desc:"OCR engine status" },
  { method:"DELETE", path:"/clear-all",                desc:"Clear all data (admin)" },
  { method:"GET",    path:"/stats",                    desc:"Entity counts" },
];

const METHOD_COLORS = {
  GET:    "#10B981",
  POST:   "#3B82F6",
  PUT:    "#F59E0B",
  DELETE: "#EF4444",
};

const ACCESS_COLORS = {
  Public:    "#94A3B8",
  Protected: "#EAB308",
  Admin:     "#F87171",
};

const css = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  .rg{min-height:100vh;background:linear-gradient(135deg, #080C14 0%, #0F172A 100%);font-family:'Sora',sans-serif;padding:32px 24px;color:#F0EDE8}
  .rg h1{font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:700;color:#EAB308;margin-bottom:6px}
  .rg-sub{color:#64748B;font-size:0.82rem;font-family:'JetBrains Mono',monospace;margin-bottom:28px}
  .section-title{font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:600;color:#F0EDE8;margin:24px 0 12px}
  table{width:100%;border-collapse:collapse;margin-bottom:32px;font-size:0.84rem}
  th{text-align:left;padding:9px 14px;font-size:0.7rem;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.1em;color:#64748B;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
  td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04);color:#94A3B8;vertical-align:middle}
  tr:hover td{background:rgba(255,255,255,.025)}
  .method{display:inline-block;padding:2px 8px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:700;letter-spacing:.04em}
  .access{display:inline-block;padding:2px 8px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:0.7rem}
  .path{font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:#94A3B8}
`;

export default function Routingguide() {
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`}</style>
      <style>{css}</style>
      <div className="rg">
        <h1>📋 Routing Guide</h1>
        <p className="rg-sub">Developer reference — all frontend and backend routes</p>

        <div className="section-title">Frontend Routes</div>
        <table>
          <thead>
            <tr><th>Path</th><th>Page</th><th>Access</th><th>Description</th></tr>
          </thead>
          <tbody>
            {ROUTES.map(r => (
              <tr key={r.path}>
                <td><span className="path">{r.path}</span></td>
                <td>{r.page}</td>
                <td>
                  <span className="access" style={{
                    background:`${ACCESS_COLORS[r.access]}20`,
                    color: ACCESS_COLORS[r.access],
                    border:`1px solid ${ACCESS_COLORS[r.access]}40`
                  }}>{r.access}</span>
                </td>
                <td style={{ color:"#64748B", fontSize:"0.8rem" }}>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-title">Backend API Routes</div>
        <table>
          <thead>
            <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
          </thead>
          <tbody>
            {BACKEND_ROUTES.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className="method" style={{
                    background:`${METHOD_COLORS[r.method]}20`,
                    color: METHOD_COLORS[r.method],
                    border:`1px solid ${METHOD_COLORS[r.method]}40`
                  }}>{r.method}</span>
                </td>
                <td><span className="path">{r.path}</span></td>
                <td style={{ color:"#64748B", fontSize:"0.8rem" }}>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}