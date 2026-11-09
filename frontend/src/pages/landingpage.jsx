import { useNavigate } from "react-router-dom";



const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`;



const features = [

  { icon: "🎯", title: "Smart Conflict Detection", desc: "Detects when the same teacher is double-booked across sections at the same time — automatically." },

  { icon: "⚡", title: "Instant Generation", desc: "Full weekly timetable generated in under 2 seconds. Respects hours, labs, and workloads." },

  { icon: "🔒", title: "Fixed Subject Locking", desc: "Pin subjects and labs to specific slots. Generator fills the rest without touching fixed periods." },

  { icon: "📄", title: "PDF Export", desc: "Export beautifully formatted, print-ready timetable PDFs instantly." },

  { icon: "👥", title: "Multi-Section Support", desc: "Manage up to 4 sections with full cross-section conflict checking built-in." },

  { icon: "💾", title: "Save & Restore", desc: "Save generated timetables to the database and reload any saved version anytime." },

];



const steps = [

  { num: "01", title: "Add Your Data", desc: "Enter faculty, subjects, rooms and sections through the management pages." },

  { num: "02", title: "Configure Periods", desc: "Set hours per week per subject and assign faculty." },

  { num: "03", title: "Generate", desc: "Hit Generate — AI fills the timetable respecting all constraints." },

  { num: "04", title: "Export", desc: "Review, edit cells inline, then export PDF or save to database." },

];



export default function LandingPage() {

  const navigate = useNavigate();



  return (

    <>

      <style>{FONTS}</style>

      <style>{`

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        html{scroll-behavior:smooth}

        body{background:linear-gradient(135deg, #080C14 0%, #0F172A 100%);color:#F0EDE8;font-family:'Sora',sans-serif;overflow-x:hidden}



        .lnav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:18px 48px;background:rgba(8,12,20,0.88);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,0.1)}

        .llogo{display:flex;align-items:center;gap:10px;font-family:'Sora',sans-serif;font-size:1.2rem;font-weight:700;color:#EAB308;text-decoration:none;cursor:pointer}

        .nbtn{background:#EAB308;color:#0A0C12;font-weight:700;font-size:0.85rem;font-family:'Sora',sans-serif;border:none;border-radius:8px;padding:10px 22px;cursor:pointer;transition:opacity .2s,transform .15s;box-shadow:0 4px 16px rgba(234,179,8,0.3)}

        .nbtn:hover{opacity:.88;transform:translateY(-1px)}



        .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden}

        .hbg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 900px 600px at 50% 0%,rgba(234,179,8,.08) 0%,transparent 70%),radial-gradient(ellipse 600px 400px at 80% 80%,rgba(99,102,241,.07) 0%,transparent 70%),radial-gradient(ellipse 500px 300px at 10% 60%,rgba(14,165,233,.05) 0%,transparent 70%)}

        .hgrid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)}

        .hcontent{position:relative;z-index:1;max-width:860px}

        .heye{display:inline-flex;align-items:center;gap:8px;background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.25);border-radius:100px;padding:6px 16px;margin-bottom:28px;font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#EAB308;letter-spacing:.12em;text-transform:uppercase;animation:fu .6s ease both}

        .htitle{font-family:'Sora',sans-serif;font-size:clamp(2.8rem,6vw,5rem);font-weight:800;line-height:1.1;color:#F0EDE8;margin-bottom:24px;animation:fu .6s .1s ease both}

        .htitle em{font-style:normal;color:#EAB308}

        .hsub{font-size:1.05rem;color:#94A3B8;line-height:1.7;max-width:560px;margin:0 auto 40px;animation:fu .6s .2s ease both}

        .hacts{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;animation:fu .6s .3s ease both}

        .bprimary{background:#EAB308;color:#0A0C12;font-weight:700;font-size:1rem;font-family:'Sora',sans-serif;border:none;border-radius:10px;padding:14px 32px;cursor:pointer;letter-spacing:.02em;transition:opacity .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 24px rgba(234,179,8,.3)}

        .bprimary:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 4px 32px rgba(234,179,8,.4)}

        .boutline{background:rgba(255,255,255,0.05);color:#94A3B8;border:1px solid rgba(255,255,255,.1);font-size:1rem;font-family:'Sora',sans-serif;border-radius:10px;padding:14px 32px;cursor:pointer;transition:border-color .2s,color .2s,background .2s;text-decoration:none;display:inline-block}

        .boutline:hover{border-color:rgba(234,179,8,.4);color:#F0EDE8;background:rgba(255,255,255,0.08)}



        .sbar{display:flex;justify-content:center;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);padding:28px 0;animation:fu .6s .4s ease both}

        .sitem{padding:0 48px;text-align:center;border-right:1px solid rgba(255,255,255,.1)}

        .sitem:last-child{border-right:none}

        .sval{font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;color:#EAB308}

        .slbl{font-size:0.78rem;color:#64748B;font-family:'JetBrains Mono',monospace;margin-top:4px;text-transform:uppercase;letter-spacing:.08em}



        .sec{padding:96px 48px;max-width:1200px;margin:0 auto}

        .seye{font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#EAB308;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px}

        .stitle{font-family:'Sora',sans-serif;font-size:clamp(1.8rem,3vw,2.6rem);font-weight:700;color:#F0EDE8;line-height:1.2;margin-bottom:16px}

        .stitle em{font-style:normal;color:#EAB308}

        .ssub{font-size:1rem;color:#64748B;max-width:520px;line-height:1.7;margin-bottom:56px}



        .fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}

        .fcard{background:rgba(255,255,255,.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;transition:border-color .25s,background .25s,transform .2s;cursor:default}

        .fcard:hover{border-color:rgba(234,179,8,.3);background:rgba(234,179,8,.05);transform:translateY(-3px)}

        .ficon{font-size:1.8rem;margin-bottom:16px}

        .ftitle{font-family:'Sora',sans-serif;font-size:1.1rem;font-weight:600;color:#F0EDE8;margin-bottom:10px}

        .fdesc{font-size:0.88rem;color:#64748B;line-height:1.7}



        .howsec{background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1)}

        .sgrid{display:grid;grid-template-columns:repeat(4,1fr)}

        @media(max-width:700px){.sgrid{grid-template-columns:1fr 1fr}}

        .scard{padding:36px 28px;border-right:1px solid rgba(255,255,255,.1)}

        .scard:last-child{border-right:none}

        .snum{font-family:'JetBrains Mono',monospace;font-size:3rem;font-weight:700;color:rgba(234,179,8,.18);line-height:1;margin-bottom:16px}

        .stitleh{font-family:'Sora',sans-serif;font-size:1rem;font-weight:600;color:#F0EDE8;margin-bottom:10px}

        .sdesc{font-size:0.85rem;color:#64748B;line-height:1.7}



        .ctasec{text-align:center;background:radial-gradient(ellipse 600px 400px at 50% 50%,rgba(234,179,8,.08) 0%,transparent 70%);padding:100px 24px}

        .ctatitle{font-family:'Sora',sans-serif;font-size:clamp(2rem,4vw,3.2rem);font-weight:700;color:#F0EDE8;margin-bottom:20px;line-height:1.2}

        .ctasub{font-size:1rem;color:#64748B;margin-bottom:40px;max-width:480px;margin-left:auto;margin-right:auto}



        .lfooter{border-top:1px solid rgba(255,255,255,.1);padding:32px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}

        .flogo{font-family:'Sora',sans-serif;font-size:1rem;color:#475569}

        .fcopy{font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#334155}



        @keyframes fu{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

        @media(max-width:768px){.lnav{padding:16px 20px}.sec{padding:64px 20px}.sitem{padding:0 24px}.lfooter{padding:24px 20px}}

      `}</style>



      <nav className="lnav">

        <div className="llogo" onClick={() => navigate("/")}>⊞ AI Timetable</div>

        <button className="nbtn" onClick={() => navigate("/login")}>Admin Login →</button>

      </nav>



      <section className="hero">

        <div className="hbg" /><div className="hgrid" />

        <div className="hcontent">

          <div className="heye">✦ Smart Scheduling for Colleges</div>

          <h1 className="htitle">The <em>AI-powered</em> timetable<br />generator for modern colleges</h1>

          <p className="hsub">Stop spending days manually scheduling classes. Generate conflict-free timetables in seconds — respecting faculty workloads, lab needs, and multi-section constraints.</p>

          <div className="hacts">

            <button className="bprimary" onClick={() => navigate("/login")}>Get Started — Admin Login →</button>

            <a className="boutline" href="#features">See Features</a>

          </div>

        </div>

      </section>



      <div className="sbar">

        {[{val:"< 2s",lbl:"Generation Time"},{val:"4+",lbl:"Sections Supported"},{val:"100%",lbl:"Conflict Free"},{val:"PDF",lbl:"Export Ready"}].map(s => (

          <div className="sitem" key={s.lbl}>

            <div className="sval">{s.val}</div>

            <div className="slbl">{s.lbl}</div>

          </div>

        ))}

      </div>



      <div id="features">

        <div className="sec">

          <div className="seye">✦ Features</div>

          <h2 className="stitle">Everything you need to schedule <em>smarter</em></h2>

          <p className="ssub">Purpose-built for college scheduling with all the constraints real institutions face.</p>

          <div className="fgrid">

            {features.map(f => (

              <div className="fcard" key={f.title}>

                <div className="ficon">{f.icon}</div>

                <div className="ftitle">{f.title}</div>

                <div className="fdesc">{f.desc}</div>

              </div>

            ))}

          </div>

        </div>

      </div>



      <div className="howsec">

        <div className="sec">

          <div className="seye">✦ How It Works</div>

          <h2 className="stitle">From data to timetable in <em>4 steps</em></h2>

          <p className="ssub">Simple enough to use on day one, powerful enough for your most complex schedules.</p>

        </div>

        <div className="sgrid">

          {steps.map(s => (

            <div className="scard" key={s.num}>

              <div className="snum">{s.num}</div>

              <div className="stitleh">{s.title}</div>

              <div className="sdesc">{s.desc}</div>

            </div>

          ))}

        </div>

      </div>



      <div className="ctasec">

        <div className="ctatitle">Ready to build your<br />perfect timetable?</div>

        <div className="ctasub">Log in as administrator to get started. Your data, your rules.</div>

        <button className="bprimary" onClick={() => navigate("/login")}>Admin Login →</button>

      </div>



      <footer className="lfooter">

        <div className="flogo">⊞ AI Timetable System</div>

        <div className="fcopy">© {new Date().getFullYear()} · All rights reserved</div>

      </footer>

    </>

  );

}