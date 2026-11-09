import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

function FloatingParticles() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Ambient background streaks
    const AMBIENT_COUNT = 45;
    const BASE_ANGLE = -Math.PI / 3.4;
    const AMBIENT_COLORS = ['96,165,250', '96,165,250', '234,179,8', '148,163,184'];

    const ambient = Array.from({ length: AMBIENT_COUNT }, () => {
      const speed = Math.random() * 0.16 + 0.05;
      const angle = BASE_ANGLE + (Math.random() - 0.5) * 0.5;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 7 + 5,
        alpha: Math.random() * 0.28 + 0.2,
        color: AMBIENT_COLORS[Math.floor(Math.random() * AMBIENT_COLORS.length)],
      };
    });

    // Cursor-chasing curved trail (snake chain)
    const TRAIL_COUNT = 26;
    const trail = Array.from({ length: TRAIL_COUNT }, () => ({ x: -9999, y: -9999 }));
    let trailActive = false;
    let lastMouse = { x: 0, y: 0 };
    let cursorSpeed = 0;

    const handleMouseMove = (e) => {
      cursorSpeed = Math.min(Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y), 40);
      lastMouse = { x: e.clientX, y: e.clientY };
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      if (!trailActive) {
        trail.forEach((p) => { p.x = e.clientX; p.y = e.clientY; });
        trailActive = true;
      }
    };
    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      // ambient streaks
      ambient.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;

        const mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        const tailX = p.x - (p.vx / mag) * p.len;
        const tailY = p.y - (p.vy / mag) * p.len;

        const grad = ctx.createLinearGradient(tailX, tailY, p.x, p.y);
        grad.addColorStop(0, `rgba(${p.color},0)`);
        grad.addColorStop(1, `rgba(${p.color},${p.alpha})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      // cursor-chasing curved trail
      if (trailActive && mouse.x > -1000) {
        let targetX = mouse.x;
        let targetY = mouse.y;

        trail.forEach((p, i) => {
          const ease = 0.34 - i * 0.006;
          p.x += (targetX - p.x) * Math.max(ease, 0.11);
          p.y += (targetY - p.y) * Math.max(ease, 0.11);
          targetX = p.x;
          targetY = p.y;
        });

        const glowBoost = Math.min(cursorSpeed / 40, 1);

        // smooth continuous curve through the chain, tapering toward the tail
        for (let i = 1; i < trail.length - 1; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const c = trail[i + 1];
          const midAB = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const midBC = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };

          const taper = Math.pow(1 - i / trail.length, 1.4);
          const width = (5 + glowBoost * 3) * taper + 0.6;
          const t = i / trail.length;
          const gold = t < 0.18;
          const color = gold ? '234,179,8' : '148,197,253';
          const alpha = (1 - t) * (0.55 + glowBoost * 0.25);

          ctx.beginPath();
          ctx.moveTo(midAB.x, midAB.y);
          ctx.quadraticCurveTo(b.x, b.y, midBC.x, midBC.y);
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // glowing head
        const head = trail[0];
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3.2 + glowBoost * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,224,120,0.95)';
        ctx.shadowColor = 'rgba(234,179,8,1)';
        ctx.shadowBlur = 14 + glowBoost * 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" aria-hidden="true" />;
}

export default function HomeEnhancedCollege() {

  useScrollToTop();  // ✅ ADD THIS LINE

  const navigate = useNavigate();
  const [counters, setCounters] = useState({ sections: 0, faculty: 0, subjects: 0, efficiency: 0 });

  // Animated counters
  useEffect(() => {
    const targets = { sections: 12, faculty: 100, subjects: 50, efficiency: 99 };
    const duration = 1400;
    const steps = 40;
    const interval = duration / steps;

    let current = { sections: 0, faculty: 0, subjects: 0, efficiency: 0 };

    const timer = setInterval(() => {
      let updated = false;

      Object.keys(targets).forEach(key => {
        if (current[key] < targets[key]) {
          current[key] = Math.min(current[key] + Math.ceil(targets[key] / steps), targets[key]);
          updated = true;
        }
      });

      setCounters({ ...current });

      if (!updated) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const features = [
    { icon: "⊞", title: "Multi-Section Support", description: "Manage multiple sections, clusters, and semesters simultaneously." },
    { icon: "◆", title: "Faculty Workload Management", description: "Automatic workload distribution — no teacher over- or under-scheduled." },
    { icon: "◇", title: "Conflict Detection", description: "Real-time detection and prevention of scheduling conflicts across sections." },
    { icon: "○", title: "Lab & Theory Scheduling", description: "Separate scheduling for lab sessions and theory classes with batch management." },
    { icon: "▤", title: "Excel Import / Export", description: "Import faculty, subjects, and sections from Excel files for quick setup." },
    { icon: "⚡", title: "One-Click Generation", description: "Generate complete semester timetables for all sections with a single click." },
  ];

  const howItWorksSteps = [
    { step: 1, title: "Import Data", description: "Add faculty, subjects, rooms and sections — manually or via Excel." },
    { step: 2, title: "Configure", description: "Set hours per week, assign faculty, and configure labs." },
    { step: 3, title: "Generate", description: "AI fills the timetable in seconds, respecting every constraint." },
    { step: 4, title: "Export", description: "Review, edit inline, then export to PDF or save to the database." },
  ];

  const css = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: linear-gradient(135deg, #080C14 0%, #0F172A 100%);
      overflow-x: hidden;
    }

    .home-enhanced {
      min-height: 100vh;
      font-family: 'Sora', sans-serif;
      color: #F0EDE8;
      position: relative;
    }

    .bg-photo {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(8,12,20,0.72) 0%, rgba(8,12,20,0.85) 100%),
        url('/j.webp') center/cover no-repeat;
      opacity: 0.75;
    }

    .bg-orbs {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.42;
      mix-blend-mode: screen;
      will-change: transform;
    }

    .orb-1 {
      width: 480px; height: 480px;
      background: radial-gradient(circle, rgba(234,179,8,0.6) 0%, transparent 70%);
      top: 140px; left: -140px;
      animation: floatOrbA 20s ease-in-out infinite;
    }

    .orb-2 {
      width: 420px; height: 420px;
      background: radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 70%);
      top: 220px; right: -120px;
      animation: floatOrbB 24s ease-in-out infinite;
    }

    .orb-3 {
      width: 340px; height: 340px;
      background: radial-gradient(circle, rgba(234,179,8,0.45) 0%, transparent 70%);
      bottom: 12%; left: 4%;
      animation: floatOrbC 26s ease-in-out infinite;
    }

    .orb-4 {
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%);
      bottom: 6%; right: 6%;
      animation: floatOrbA 22s ease-in-out infinite reverse;
    }

    .orb-5 {
      width: 260px; height: 260px;
      background: radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%);
      top: 50%; left: 45%;
      animation: floatOrbB 28s ease-in-out infinite reverse;
    }

    .bg-grid {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-image: radial-gradient(rgba(234,179,8,0.15) 1px, transparent 1px);
      background-size: 34px 34px;
      -webkit-mask-image: radial-gradient(ellipse 70% 55% at 50% 15%, black 30%, transparent 100%);
      mask-image: radial-gradient(ellipse 70% 55% at 50% 15%, black 30%, transparent 100%);
    }

    .particle-canvas {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }

    @keyframes floatOrbA {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(50px, 70px) scale(1.1); }
      66% { transform: translate(-30px, 30px) scale(0.94); }
    }

    @keyframes floatOrbB {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-60px, -50px) scale(1.15); }
    }

    @keyframes floatOrbC {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(40px, -60px) scale(1.06); }
    }

    @media (prefers-reduced-motion: reduce) {
      .orb { animation: none; }
      .college-logo-badge { animation: none; }
      .scroll-cue { animation: none; }
      .header-college-name { animation: none; }
    }

    .container {
      max-width: 1120px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

    /* Header */
    .header {
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      width: 100%;
      box-sizing: border-box;
    }

    .header-college {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .college-logo-badge {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(234,179,8,0.4);
      object-fit: cover;
      background: #fff;
      box-shadow: 0 0 14px rgba(234,179,8,0.2);
      animation: slowSpin 30s linear infinite;
    }

    @keyframes slowSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .header-college-name {
      font-family: 'Sora', sans-serif;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      white-space: nowrap;
      background: linear-gradient(90deg, #F0EDE8 0%, #F0EDE8 35%, #EAB308 50%, #F0EDE8 65%, #F0EDE8 100%);
      background-size: 250% auto;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmerText 5s linear infinite;
    }

    @keyframes shimmerText {
      0% { background-position: 0% center; }
      100% { background-position: -250% center; }
    }

    @media (max-width: 820px) {
      .header-college-name { display: none; }
      .header-badges { display: none; }
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .header-badges {
      display: flex;
      gap: 8px;
      padding-left: 48px;
    }

    .trust-pill-mini {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.62rem;
      font-weight: 600;
      color: #94A3B8;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      transition: border-color 0.25s ease, color 0.25s ease;
    }

    .trust-pill-mini:hover {
      border-color: rgba(234,179,8,0.3);
      color: #EAB308;
    }

    .trust-pill-mini-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #EAB308;
      flex-shrink: 0;
    }

    .logo-mark {
      width: 30px; height: 30px; border-radius: 8px;
      background: #EAB308; color: #0A0C12;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 900;
    }

    .nav-buttons {
      display: flex;
      gap: 8px;
    }

    .nav-buttons .btn {
      padding: 7px 15px;
      font-size: 0.78rem;
    }

    .btn {
      padding: 9px 20px;
      border-radius: 8px;
      font-family: 'Sora', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      outline: none;
    }

    .btn-secondary {
      background: rgba(255,255,255,0.05);
      color: #94A3B8;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .btn-secondary:hover {
      background: rgba(255,255,255,0.08);
      color: #F0EDE8;
    }

    .btn-primary {
      background: #EAB308;
      color: #0A0C12;
      box-shadow: 0 4px 16px rgba(234,179,8,0.3);
    }

    .btn-primary:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    /* Hero Section */
    .hero {
      text-align: center;
      padding: 120px 32px 100px;
      border-radius: 24px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(234,179,8,0.15);
      box-shadow: 0 24px 70px rgba(0,0,0,0.5);
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url('/j.webp') center/cover no-repeat;
      filter: saturate(1.25) contrast(1.1) brightness(1.15);
      z-index: 0;
    }

    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(8,12,20,0.15) 0%, rgba(8,12,20,0.3) 40%, rgba(8,12,20,0.75) 65%, rgba(8,12,20,0.95) 100%),
        radial-gradient(ellipse at center, transparent 35%, rgba(8,12,20,0.4) 90%);
      z-index: 1;
    }

    .hero-title {
      position: relative;
      z-index: 2;
      font-family: 'Sora', sans-serif;
      font-size: 2.75rem;
      font-weight: 800;
      line-height: 1.15;
      margin-bottom: 16px;
      color: #F0EDE8;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 16px rgba(0,0,0,0.6);
    }

    .hero-description {
      position: relative;
      z-index: 2;
      font-size: 1.02rem;
      color: #CBD5E1;
      max-width: 560px;
      margin: 0 auto 36px;
      line-height: 1.65;
      text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }

    .btn-large {
      padding: 13px 30px;
      font-size: 0.95rem;
      border-radius: 9px;
    }

    .stats-row {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      max-width: 720px;
      margin: 0 auto;
    }

    @media (max-width: 700px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
    }

    .stat-cell {
      padding: 16px 12px;
      border-radius: 12px;
      background: rgba(8,12,20,0.82);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(234,179,8,0.22);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .stat-cell:hover {
      transform: translateY(-2px);
      border-color: rgba(234,179,8,0.25);
    }

    .stat-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.5rem;
      font-weight: 700;
      color: #EAB308;
      margin-bottom: 2px;
    }

    .stat-label {
      color: #64748B;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .scroll-cue {
      position: absolute;
      bottom: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      width: 26px;
      height: 26px;
      border: 1px solid rgba(234,179,8,0.35);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #EAB308;
      font-size: 12px;
      animation: bounceCue 2.2s ease-in-out infinite;
      opacity: 0.8;
    }

    @keyframes bounceCue {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(6px); }
    }

    /* Demo Video */
    .video-sec {
      padding: 56px 0 24px;
    }

    .video-wrap {
      position: relative;
      max-width: 860px;
      margin: 0 auto;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(234,179,8,0.18);
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset;
      transition: border-color 0.25s ease;
    }

    .video-wrap:hover {
      border-color: rgba(234,179,8,0.35);
    }

    .video-wrap video {
      width: 100%;
      display: block;
      aspect-ratio: 16 / 9;
      background: #000;
    }

    .video-caption {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px 22px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .video-caption-icon {
      flex-shrink: 0;
      width: 34px; height: 34px;
      border-radius: 9px;
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.25);
      color: #EAB308;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
    }

    .video-caption-title {
      font-family: 'Sora', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      color: #F0EDE8;
      margin-bottom: 3px;
    }

    .video-caption-text {
      font-size: 0.85rem;
      color: #64748B;
      line-height: 1.5;
    }

    /* Section shared */
    .sec {
      padding: 72px 0;
    }

    .section-eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      color: #EAB308;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
      text-align: center;
    }

    .section-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.9rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 10px;
      color: #F0EDE8;
    }

    .section-subtitle {
      text-align: center;
      color: #64748B;
      font-size: 0.92rem;
      margin-bottom: 44px;
    }

    /* Features */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }

    .feature-card {
      position: relative;
      overflow: hidden;
      background: rgba(12,17,28,0.82);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 26px;
      transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, #EAB308, rgba(234,179,8,0.2));
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.35s ease;
    }

    .feature-card:hover {
      background: rgba(16,22,36,0.9);
      border-color: rgba(234,179,8,0.3);
      transform: translateY(-6px);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(234,179,8,0.08);
    }

    .feature-card:hover::before {
      transform: scaleX(1);
    }

    .feature-index {
      position: absolute;
      top: 18px; right: 20px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 600;
      color: rgba(148,163,184,0.35);
      letter-spacing: 0.05em;
    }

    .feature-icon {
      width: 42px; height: 42px;
      border-radius: 11px;
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.2);
      color: #EAB308;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      margin-bottom: 18px;
      transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
    }

    .feature-card:hover .feature-icon {
      transform: scale(1.08) rotate(-4deg);
      background: rgba(234,179,8,0.18);
      box-shadow: 0 0 20px rgba(234,179,8,0.25);
    }

    .feature-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.02rem;
      font-weight: 600;
      color: #F0EDE8;
      margin-bottom: 8px;
    }

    .feature-description {
      color: #94A3B8;
      line-height: 1.6;
      font-size: 0.88rem;
    }

    /* How It Works */
    .how-it-works {
      position: relative;
      z-index: 1;
      background: rgba(255,255,255,0.02);
      border-top: 1px solid rgba(255,255,255,0.06);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .steps-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    @media (max-width: 800px) {
      .steps-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .step-card {
      position: relative;
      overflow: hidden;
      background: rgba(12,17,28,0.82);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px 22px;
      transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
    }

    .step-card:hover {
      background: rgba(16,22,36,0.9);
      border-color: rgba(234,179,8,0.3);
      transform: translateY(-5px);
      box-shadow: 0 14px 34px rgba(0,0,0,0.3);
    }

    .step-ghost-number {
      position: absolute;
      top: -10px; right: -4px;
      font-family: 'Sora', sans-serif;
      font-size: 3.6rem;
      font-weight: 800;
      color: rgba(234,179,8,0.06);
      line-height: 1;
      pointer-events: none;
      transition: color 0.3s ease;
    }

    .step-card:hover .step-ghost-number {
      color: rgba(234,179,8,0.12);
    }

    .step-number {
      position: relative;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 700;
      color: #EAB308;
      background: rgba(234,179,8,0.12);
      border: 1px solid rgba(234,179,8,0.3);
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }

    .step-card:hover .step-number {
      box-shadow: 0 0 0 4px rgba(234,179,8,0.1), 0 0 18px rgba(234,179,8,0.35);
      transform: scale(1.06);
    }

    .step-title {
      position: relative;
      font-family: 'Sora', sans-serif;
      font-size: 0.98rem;
      font-weight: 600;
      color: #F0EDE8;
      margin-bottom: 6px;
    }

    .step-description {
      position: relative;
      color: #94A3B8;
      font-size: 0.85rem;
      line-height: 1.55;
    }

    /* CTA */
    .cta {
      padding: 80px 0;
      text-align: center;
    }

    .cta-box {
      position: relative;
      background: rgba(234,179,8,0.06);
      border: 1px solid rgba(234,179,8,0.2);
      border-radius: 20px;
      padding: 56px 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }

    .cta-box:hover {
      border-color: rgba(234,179,8,0.35);
      box-shadow: 0 24px 70px rgba(0,0,0,0.4), 0 0 40px rgba(234,179,8,0.08);
    }

    .cta-title {
      font-family: 'Sora', sans-serif;
      font-size: 1.9rem;
      font-weight: 700;
      color: #F0EDE8;
      margin-bottom: 12px;
    }

    .cta-text {
      color: #94A3B8;
      font-size: 0.98rem;
      margin-bottom: 28px;
    }

    /* Footer */
    .footer {
      position: relative;
      z-index: 1;
      padding: 28px 0;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .footer-college {
      color: #94A3B8;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .footer-text {
      color: #475569;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
      margin-top: 4px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero-title { font-size: 2.1rem; }
      .cta-title { font-size: 1.5rem; }
      .nav-buttons { gap: 6px; }
      .btn { padding: 7px 14px; font-size: 0.78rem; }
    }
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{css}</style>

      <div className="home-enhanced">

        {/* Background photo */}
        <div className="bg-photo" aria-hidden="true"></div>

        {/* Floating background layers */}
        <div className="bg-grid" aria-hidden="true"></div>
        <div className="bg-orbs" aria-hidden="true">
          <span className="orb orb-1"></span>
          <span className="orb orb-2"></span>
          <span className="orb orb-3"></span>
          <span className="orb orb-4"></span>
          <span className="orb orb-5"></span>
        </div>
        <FloatingParticles />

        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="header-college">
              <img src="/college-logo.png" alt="BMSIT Logo" className="college-logo-badge" />
              <span className="header-college-name">BMS Institute of Technology &amp; Management</span>
            </div>
            <div className="header-badges">
              <span className="trust-pill-mini"><span className="trust-pill-mini-dot"></span>Affiliated to VTU</span>
              <span className="trust-pill-mini"><span className="trust-pill-mini-dot"></span>Autonomous Institution</span>
            </div>
          </div>
          <div className="nav-buttons">
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/admin')}>
              Admin Portal
            </button>
          </div>
        </header>

        {/* Hero */}
        <div className="container">
          <section className="hero">
            <h1 className="hero-title">
              Randomized Heuristic Timetable Generator
            </h1>
            <p className="hero-description">
              Conflict-free academic timetables for multiple sections, faculty,
              and subjects — generated automatically in seconds.
            </p>

            <div className="stats-row">
              <div className="stat-cell">
                <div className="stat-number">{counters.sections}+</div>
                <div className="stat-label">Sections</div>
              </div>
              <div className="stat-cell">
                <div className="stat-number">{counters.faculty}+</div>
                <div className="stat-label">Faculty</div>
              </div>
              <div className="stat-cell">
                <div className="stat-number">{counters.subjects}+</div>
                <div className="stat-label">Subjects</div>
              </div>
              <div className="stat-cell">
                <div className="stat-number">{counters.efficiency}%</div>
                <div className="stat-label">Conflict-Free</div>
              </div>
            </div>
            <span className="scroll-cue" aria-hidden="true">⌄</span>
          </section>
        </div>

        {/* Demo Video */}
        <div className="container">
          <section className="video-sec">
            <div className="video-wrap">
              <video controls poster="/video-poster.jpg">
                <source src="/demo-video.mp4" type="video/mp4" />
                Your browser doesn't support embedded video.
              </video>
              <div className="video-caption">
                <div className="video-caption-icon">▶</div>
                <div>
                  <div className="video-caption-title">See it in action</div>
                  <div className="video-caption-text">A short walkthrough — from importing faculty to exporting a finished timetable.</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Features */}
        <div className="container">
          <section className="sec">
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Everything you need to schedule smarter</h2>
            <p className="section-subtitle">Purpose-built for the constraints real institutions face</p>
            <div className="features-grid">
              {features.map((feature, index) => (
                <div className="feature-card" key={index}>
                  <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* How It Works */}
        <section className="how-it-works">
          <div className="container sec">
            <div className="section-eyebrow">Process</div>
            <h2 className="section-title">From data to timetable in 4 steps</h2>
            <p className="section-subtitle">Simple enough to use on day one</p>
            <div className="steps-grid">
              {howItWorksSteps.map((step) => (
                <div className="step-card" key={step.step}>
                  <span className="step-ghost-number">{String(step.step).padStart(2, '0')}</span>
                  <div className="step-number">{step.step}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="container">
          <section className="cta">
            <div className="cta-box">
              <h2 className="cta-title">Ready to build your perfect timetable?</h2>
              <p className="cta-text">Log in as administrator to get started — your data, your rules.</p>
              <button className="btn btn-primary btn-large" onClick={() => navigate('/admin')}>
                Admin Login
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            <p className="footer-college">BMS Institute of Technology &amp; Management, Bengaluru</p>
            <p className="footer-text">Affiliated to VTU · Autonomous Institution</p>
            <p className="footer-text">Department of Computer Science &amp; Engineering</p>
            <p className="footer-text">Developed by Jaul Haq &amp; Avishek Kumar Sah · © 2026</p>
          </div>
        </footer>

      </div>
    </>
  );
}