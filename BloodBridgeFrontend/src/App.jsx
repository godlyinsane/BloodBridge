import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MapPin, ShieldCheck, Bell, Activity, Droplet,
  Search, ArrowRight, Clock3, Calendar, Building2,
  ChevronRight, Info, Mail, Navigation, Compass,
  Phone, PhoneCall, Sun, Moon, LocateFixed, Hospital, Sparkles, HeartHandshake, CheckCircle2, ShieldAlert, Users, FileText, XCircle, Shield
} from "lucide-react";
import EmergencyBanner from "./EmergencyBanner";
import NearestBloodBankMap from "./NearestBloodBankMap";

// =================================================================
// Backend connection
// =================================================================
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.REACT_APP_API_BASE_URL || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")).replace(/\/+$/, "");

async function api(path, options = {}, token = null) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "sticky", top: 0, zIndex: 60, padding: "10px 16px",
      background: "#3b2b08", color: "#ffe7a3", borderBottom: "1px solid #8a6516",
      textAlign: "center", fontSize: 12.5, lineHeight: 1.5
    }}>
      Low-network mode: showing cached directory where available.
    </div>
  );
}

const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

const COLORS = {
  bg: "var(--background)",
  bg2: "var(--card)",
  panel: "var(--card)",
  panelBorder: "var(--border)",
  crimson: "var(--emergency)",
  crimsonDeep: "#9f1239",
  cyan: "#0ea5e9",
  text: "var(--foreground)",
  textMuted: "var(--muted-foreground)",
  good: "var(--success)",
  warn: "#f59e0b",
};

const glassCard = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "calc(var(--radius) + 8px)",
  color: "var(--foreground)",
};

const glowBtn = {
  background: "var(--gradient-blood)",
  color: "var(--emergency-foreground)",
  border: "none",
  borderRadius: 9999,
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "var(--shadow-glow)",
};

const ghostBtn = {
  background: "var(--secondary)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 9999,
  padding: "11px 22px",
  fontSize: 14.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const inputStyle = {
  width: "100%",
  padding: "12px 18px",
  borderRadius: 9999,
  border: "1px solid var(--border)",
  fontSize: 15,
  fontFamily: "var(--font-sans)",
  color: "var(--foreground)",
  background: "var(--card)",
  boxSizing: "border-box",
  outline: "none",
};

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="bb-logo-lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--drop-a, #f43f5e)" />
          <stop offset="1" stopColor="var(--drop-b, #9f1239)" />
        </linearGradient>
      </defs>
      <path d="M16 2C16 2 5 14 5 20.5A11 11 0 0 0 27 20.5C27 14 16 2 16 2Z" fill="url(#bb-logo-lg)" />
      <path d="M14 15h4v3.5h3.5v4H18V26h-4v-3.5h-3.5v-4H14Z" fill="white" />
    </svg>
  );
}

function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 130,
        height: 34,
        borderRadius: 9999,
        background: "var(--secondary)",
        border: "1px solid var(--border)",
        padding: 3,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        userSelect: "none",
        outline: "none",
        boxSizing: "border-box",
        transition: "background-color 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Sliding Active Pill */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: 3,
          width: "calc(50% - 3px)",
          borderRadius: 9999,
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)",
          transform: dark ? "translateX(100%)" : "translateX(0%)",
          transition: "transform 0.25s cubic-bezier(0.34, 1.3, 0.64, 1), background-color 0.25s ease, border-color 0.25s ease",
          pointerEvents: "none",
        }}
      />
      {/* Light Option */}
      <span
        style={{
          flex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          zIndex: 1,
          fontSize: 12,
          fontWeight: !dark ? 750 : 500,
          color: !dark ? "var(--emergency)" : "var(--muted-foreground)",
          transition: "color 0.2s ease, font-weight 0.2s ease",
        }}
      >
        <Sun size={13} style={{ strokeWidth: !dark ? 2.5 : 2 }} />
        <span>Light</span>
      </span>
      {/* Dark Option */}
      <span
        style={{
          flex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          zIndex: 1,
          fontSize: 12,
          fontWeight: dark ? 750 : 500,
          color: dark ? "var(--emergency)" : "var(--muted-foreground)",
          transition: "color 0.2s ease, font-weight 0.2s ease",
        }}
      >
        <Moon size={13} style={{ strokeWidth: dark ? 2.5 : 2 }} />
        <span>Dark</span>
      </span>
    </button>
  );
}

const HERO_ORBIT_ICONS = [Building2, MapPin, Phone, Hospital, ShieldCheck, Navigation];

function HeroArt() {
  return (
    <div className="hero-art-container" style={{ width: "100%", maxWidth: "min(440px, 85vw)", aspectRatio: "1/1", position: "relative", margin: "0 auto" }}>
      <div className="dot-grid" style={{ position: "absolute", inset: 0, borderRadius: "50%", maskImage: "radial-gradient(circle, black 40%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle, black 40%, transparent 70%)" }} />
      {[100, 76, 52].map((s, i) => (
        <div key={s} style={{ position: "absolute", inset: `${(100 - s) / 2}%`, borderRadius: "50%", border: `1px ${i === 1 ? "dashed" : "solid"} var(--border)` }} />
      ))}
      <div className="animate-spin-slow" style={{ position: "absolute", inset: 0 }}>
        {HERO_ORBIT_ICONS.map((Icon, i) => {
          const a = (i / HERO_ORBIT_ICONS.length) * Math.PI * 2;
          return (
            <div key={i} style={{ position: "absolute", left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 38 * Math.sin(a)}%`, transform: "translate(-50%, -50%)" }}>
              <div className="glass shadow-soft" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--border)", animation: "spin-slow 40s linear infinite reverse" }}>
                <Icon size={16} className="text-red" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="animate-float" style={{ position: "absolute", inset: "31%", display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 100 120" style={{ width: "100%", filter: "drop-shadow(0 30px 30px var(--shadow-drop))" }}>
          <defs>
            <linearGradient id="hero-drop-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--drop-a, #f43f5e)" />
              <stop offset="1" stopColor="var(--drop-b, #9f1239)" />
            </linearGradient>
          </defs>
          <path d="M50 4C50 4 12 52 12 78a38 38 0 0 0 76 0C88 52 50 4 50 4Z" fill="url(#hero-drop-grad)" />
          <polyline points="24,82 38,82 44,70 52,94 58,76 76,76" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// =================================================================
// Three.js particle field — subtle floating blood-cell-inspired points
// =================================================================

// Small seeded pseudo-random so the layout is stable across renders
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateCells(count = 26) {
  const rand = mulberry32(42);
  const cells = [];
  for (let i = 0; i < count; i++) {
    // depth 0 = far/small/blurred, 1 = near/large/sharp
    const depth = rand();
    const size = 14 + depth * 46; // 14px..60px
    cells.push({
      id: i,
      left: rand() * 100, // %
      startBottom: -20 - rand() * 40, // start below the frame
      size,
      depth,
      blur: (1 - depth) * 2.6, // far cells softer
      opacity: 0.35 + depth * 0.55,
      duration: 14 - depth * 6 + rand() * 4, // near cells drift faster
      delay: -rand() * 18, // stagger so it looks continuous on load
      drift: (rand() - 0.5) * 26, // horizontal wander in vw
      rotate: (rand() - 0.5) * 180,
      spin: (rand() - 0.5) * 240,
    });
  }
  return cells;
}

function BloodCellsAnimation() {
  const isLowEnd = typeof window !== "undefined" && (window.innerWidth < 768 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));
  const cells = useMemo(() => generateCells(isLowEnd ? 8 : 14), [isLowEnd]);

  return (
    <div className="bc-wrap">
      <div className="bc-vignette" />
      {cells.map((c) => (
        <span
          key={c.id}
          className="bc-cell"
          style={{
            left: `${c.left}%`,
            bottom: `${c.startBottom}%`,
            width: c.size,
            height: c.size,
            filter: `blur(${c.blur}px)`,
            opacity: c.opacity,
            zIndex: Math.round(c.depth * 100),
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            "--drift": `${c.drift}vw`,
            "--rot": `${c.rotate}deg`,
            "--spin": `${c.spin}deg`,
          }}
        >
          <span className="bc-dimple" />
        </span>
      ))}

      <style>{`
@keyframes donorCardEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .bc-wrap {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 320px;
          overflow: hidden;
          background:
            radial-gradient(120% 90% at 50% 40%, #4a0000 0%, #1b0000 55%, #0a0000 100%);
          border-radius: 20px;
        }

        .bc-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(0,0,0,0.65) 100%);
          z-index: 200;
        }

        .bc-cell {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 32%, #ff6a56 0%, #c41f2d 42%, #7a0014 80%, #5c0010 100%);
          box-shadow: 0 0 12px rgba(255, 50, 40, 0.25);
          animation-name: bc-float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        .bc-dimple {
          position: absolute;
          top: 30%;
          left: 30%;
          width: 40%;
          height: 40%;
          border-radius: 50%;
          background: rgba(70, 0, 10, 0.55);
          filter: blur(1px);
        }

        @keyframes bc-float {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(0.9);
          }
          50% {
            transform: translate3d(calc(var(--drift) * 0.5), -70vh, 0)
              rotate(calc(var(--rot) + var(--spin) * 0.5)) scale(1.05);
          }
          100% {
            transform: translate3d(var(--drift), -145vh, 0)
              rotate(calc(var(--rot) + var(--spin))) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bc-cell {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
   
// =================================================================
// Small UI atoms
// =================================================================
const Pill = ({ children, tone = "neutral" }) => {
  const tones = {
    neutral: { bg: "var(--secondary)", fg: "var(--muted-foreground)" },
    good: { bg: "rgba(16, 185, 129, 0.12)", fg: "var(--success)" },
    warn: { bg: "rgba(225, 29, 72, 0.12)", fg: "var(--emergency)" },
    info: { bg: "rgba(14, 165, 233, 0.12)", fg: "#0284c7" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 11.5, fontWeight: 700,
      padding: "4px 12px", borderRadius: 9999, letterSpacing: 0.3, whiteSpace: "nowrap",
      border: `1px solid ${t.fg}33`, display: "inline-flex", alignItems: "center", gap: 5,
    }}>{children}</span>
  );
};

const Card = ({ children, style, hover = true, ...rest }) => (
  <motion.div
    style={{ ...glassCard, padding: "22px 24px", ...style }}
    whileHover={hover ? { y: -3, boxShadow: "0 20px 50px rgba(0,0,0,0.35)" } : {}}
    transition={{ type: "spring", stiffness: 300, damping: 24 }}
    {...rest}
  >{children}</motion.div>
);

const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 16 }}>
    <span style={{ display: "block", fontSize: 12.5, color: COLORS.textMuted, marginBottom: 7, fontWeight: 600, letterSpacing: 0.3 }}>
      {label}
    </span>
    {children}
  </label>
);

function CountUp({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = null;
    const from = 0;
    const to = typeof value === "number" ? value : 0;
    if (typeof value !== "number") { setDisplay(value); return; }
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, duration]);
  return <>{display}</>;
}

// =================================================================
// Route definitions & URL synchronization
// =================================================================
const ROUTE_MAP = {
  "": "home",
  "/": "home",
  "home": "home",
  "facilities": "camps",
  "camps": "camps",
  "nearestbank": "nearest",
  "nearest": "nearest",
  "available": "available",
  "listings": "available",
  "requests": "camps",
  "emergency": "camps",
  "donor": "camps",
  "bloodbank": "bloodbank",
  "hospital": "bloodbank",
  "features": "services",
  "services": "services",
  "about": "about",
  "privacy": "privacy",
  "terms": "terms",
};

const TAB_TO_PATH = {
  home: "/",
  camps: "/facilities",
  nearest: "/nearestbank",
  available: "/available",
  requests: "/facilities",
  donor: "/facilities",
  bloodbank: "/bloodbank",
  services: "/features",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
};

function getTabFromLocation() {
  if (typeof window === "undefined" || !window.location) return "home";
  const segment = (window.location.pathname || "/").toLowerCase().split("/").filter(Boolean)[0] || "";
  return ROUTE_MAP[segment] || "home";
}

// =================================================================
// Main component
// =================================================================

export default function BloodBridgeApp() {
  const [tab, setTabState] = useState(() => getTabFromLocation());

  const setTab = useCallback((destination) => {
    if (typeof destination === "function") {
      setTabState((prev) => {
        const next = destination(prev);
        const targetPath = TAB_TO_PATH[next] || "/";
        if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
          window.history.pushState({ tab: next }, "", targetPath);
        }
        return next;
      });
      return;
    }
    const targetPath = TAB_TO_PATH[destination] || "/";
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.history.pushState({ tab: destination }, "", targetPath);
    }
    setTabState(destination);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextTab = getTabFromLocation();
      setTabState(nextTab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [toast, setToast] = useState(null);
  const notify = useCallback((msg) => {
    if (!msg || typeof msg !== "string") return;
    if (/failed to fetch|networkerror|load failed|offline|timeout/i.test(msg)) {
      console.warn("Network notice suppressed:", msg);
      return;
    }
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  }, []);
const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bloodbridge-theme") || "dark";
    }
    return "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    // Synchronously apply class and data-theme to documentElement immediately on click so style recalc and transitions begin with 0 delay
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.classList.toggle("theme-light", next === "light");
      document.documentElement.setAttribute("data-theme", next);
    }
    try {
      localStorage.setItem("bloodbridge-theme", next);
    } catch (e) {}
    setTheme(next);
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("theme-light", theme === "light");
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);
  

  const fontImport = (
    <style>{`
      * { box-sizing: border-box; }
      body, html {
        margin: 0;
        font-family: var(--font-sans) !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        letter-spacing: -0.011em;
      }
      h1, h2, h3, h4, h5, h6, .headline, strong, b {
        font-family: var(--font-sans) !important;
        letter-spacing: -0.035em !important;
        -webkit-font-smoothing: antialiased;
      }
      h1, .headline.hero-title {
        font-weight: 700 !important;
        letter-spacing: -0.04em !important;
      }
      body {
        font-size: 16px;
        line-height: 1.6;
      }
      p {
        line-height: 1.7;
        font-size: 15px;
      }
      .navbtn {
        font-family: var(--font-sans) !important;
        font-size: 14.5px !important;
        font-weight: 500 !important;
        letter-spacing: -0.015em;
      }
      input:focus, select:focus { border-color: var(--emergency) !important; outline: 2px solid var(--emergency) !important; }
      table { border-collapse: collapse; width: 100%; }
      th, td { text-align: left; padding: 14px 16px; font-size: 14px; }
      th { color: var(--muted-foreground); font-weight: 600; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; font-family: var(--font-mono); }
      td { border-bottom: 1px solid var(--border); color: var(--foreground); }
      .navbtn { background:none; border:none; cursor:pointer; font-size:14.5px; font-weight:500;
                padding:8px 14px; color:var(--muted-foreground); position: relative; border-radius: 9999px; transition: all 0.2s ease; }
      @media (hover: hover) and (pointer: fine) {
        .navbtn:hover { color: var(--foreground); }
      }
      @media (hover: none), (pointer: coarse) {
        .navbtn:hover { color: inherit; }
      }
      @media print {
        body * { visibility: hidden !important; }
        .bloodbridge-qr-dialog, .bloodbridge-qr-dialog * { visibility: visible !important; }
        .bloodbridge-qr-dialog { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; background: #fff !important; }
        .bloodbridge-qr-dialog button { display: none !important; }
      }
      .navbtn.active { color: #fff; }
      .nav-account, .nav-theme { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:11px 16px; border-radius:12px; font-size:14.5px; font-weight:750; white-space:nowrap; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
      .nav-account:hover, .nav-theme:hover { transform:translateY(-1px); }
      .nav-account.primary { border:1px solid #c92d45; color:#fff; background:linear-gradient(135deg,#d83a50,#a91e35); box-shadow:0 7px 20px rgba(190,35,60,.2); }
      .nav-account.secondary:hover, .nav-theme:hover { background:rgba(180,40,60,.08) !important; }
      .nav-theme { border:1px solid ${COLORS.panelBorder}; background:transparent; color:${COLORS.text}; }
      .theme-light .nav-theme { border-color:#d0d5dd; color:#344054; }
      .theme-light .navbtn.active { color:#a51d32 !important; }
      .theme-light .navbtn.active::after { background:linear-gradient(90deg,#c72d45,#ef8a99); }
      @media (max-width: 1100px) {
        .bloodbridge-topbar-inner { gap:10px !important; }
        .bloodbridge-nav { order:3; flex:1 0 100% !important; justify-content:flex-start !important; overflow-x:auto; }
        .bloodbridge-account-actions { margin-left:auto; }
      }
      @media (max-width: 680px) {
        .bloodbridge-topbar-inner { padding:10px 12px !important; align-items:center !important; }
        .bloodbridge-topbar-inner > div:first-child { flex:1 1 auto !important; min-width:0; }
        .bloodbridge-menu-toggle { display:inline-flex !important; }
        .bloodbridge-nav, .bloodbridge-account-actions { display:none !important; }
        .bloodbridge-topbar.mobile-menu-open .bloodbridge-nav { display:flex !important; order:3; flex:1 0 100% !important; flex-direction:column; align-items:stretch !important; gap:0 !important; padding:8px 0 !important; border-top:1px solid rgba(255,255,255,.09); }
        .bloodbridge-topbar.mobile-menu-open .bloodbridge-nav .navbtn { text-align:left; padding:15px 16px !important; border-radius:0; border-bottom:1px solid rgba(255,255,255,.05); font-size:15px !important; min-height:56px; }
        .bloodbridge-topbar.mobile-menu-open .bloodbridge-nav .navbtn.active::after { display:none; }
        .bloodbridge-topbar.mobile-menu-open .bloodbridge-account-actions { display:grid !important; order:4; flex:1 0 100%; grid-template-columns:1fr; width:100%; gap:9px !important; padding:10px 0 5px; }
        .nav-account, .nav-theme { padding:12px 10px; min-height:46px; font-size:13px; gap:7px; white-space:normal; }
        .nav-account svg { display:inline-block; }
      }
      .navbtn.active::after { content:''; position:absolute; bottom:-6px; left:0; right:0; height:2px;
                background: linear-gradient(90deg, ${COLORS.crimson}, ${COLORS.cyan}); border-radius: 2px; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 8px; }
      nav::-webkit-scrollbar { display: none; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
      body { overflow-x: hidden; }
      button, input, select, textarea { font: inherit; }
      button { touch-action: manipulation; }
      img, svg, canvas { max-width: 100%; }
      .bloodbridge-nav { scrollbar-width: none; }
      .bloodbridge-nav::-webkit-scrollbar { display: none; }
      @media (max-width: 900px) {
        .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .bloodbridge-topbar { overflow-x: clip; }
        .bloodbridge-topbar-inner { width: 100%; max-width: 100vw !important; box-sizing: border-box; padding: 12px 14px !important; gap: 10px !important; align-items: stretch !important; }
        .bloodbridge-topbar-inner > div:first-child { flex: 1 0 100%; min-width: 0; }
        .bloodbridge-nav { flex: 1 1 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }
        .bloodbridge-content { width: 100%; max-width: 100vw !important; box-sizing: border-box; overflow-x: clip; }
        .bloodbridge-topbar-inner > div:first-child .headline { font-size: 20px !important; }
        .bloodbridge-topbar-inner > div:first-child div:last-child { font-size: 9px !important; letter-spacing: .25px !important; }
        .bloodbridge-nav { width: 100%; gap: 18px !important; padding: 4px 0 8px; margin: 0; }
        .navbtn { flex: 0 0 auto; font-size: 13px !important; padding: 9px 1px !important; min-height: 40px; white-space: nowrap; }
        .navbtn.active::after { bottom: 0; }
        .bloodbridge-content { padding: 22px 14px 40px !important; }
        .bloodbridge-content h1 { font-size: clamp(28px, 8vw, 38px) !important; line-height: 1.12 !important; overflow-wrap: anywhere; }
        .bloodbridge-content h2 { overflow-wrap: anywhere; }
        .bloodbridge-content input, .bloodbridge-content select, .bloodbridge-content textarea { min-width: 0; max-width: 100%; font-size: 16px !important; }
        .bloodbridge-content button { max-width: 100%; }
        .bloodbridge-content table { min-width: 680px; }
        .bloodbridge-content [style*="grid-template-columns"] { min-width: 0; }
        .bloodbridge-content [style*="gap: 26px"] { gap: 14px !important; }
        .bloodbridge-content [style*="padding: 40px 24px 70px"] { padding: 22px 14px 40px !important; }
        .bloodbridge-content [style*="font-size: 52px"] { font-size: clamp(34px, 10vw, 48px) !important; }
        .bloodbridge-content [style*="min-height: 480px"] { min-height: 320px !important; }
        .bloodbridge-content [style*="border-radius: 18px"] { border-radius: 14px !important; }
        .bloodbridge-content [style*="padding: 22px 24px"] { padding: 18px 16px !important; }
        .bloodbridge-content [style*="padding: 28px 32px"] { padding: 20px 16px !important; }
        .bloodbridge-content .bc-wrap { min-height: 250px; border-radius: 14px; }
      }

      /* Mobile-first layout repairs for the Home and Recipient screens. */
      @media (max-width: 680px) {
        .bloodbridge-content, .bloodbridge-content * { min-width: 0; }
        .bloodbridge-content p, .bloodbridge-content label, .bloodbridge-content h1,
        .bloodbridge-content h2, .bloodbridge-content h3, .bloodbridge-content span,
        .bloodbridge-content button, .bloodbridge-content a {
          overflow-wrap: break-word; word-break: normal; hyphens: none;
        }
        .bloodbridge-content .home-hero {
          grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important;
          min-height: 0 !important; align-items: start !important; margin-bottom: 24px !important;
        }
        .bloodbridge-content .home-hero > div:first-child { left: -14px !important; right: -14px !important; }
        .bloodbridge-content .home-hero h1 {
          font-size: clamp(31px, 9vw, 39px) !important; line-height: 1.12 !important; letter-spacing: -0.8px;
        }
        .bloodbridge-content .home-hero h1 br { display: none; }
        .bloodbridge-content .home-hero p { font-size: 14.5px !important; line-height: 1.75 !important; max-width: none !important; }
        .bloodbridge-content .home-hero > div:nth-of-type(3) {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important;
        }
        .bloodbridge-content .home-hero button {
          white-space: normal; line-height: 1.35; justify-content: center;
          padding: 12px 13px !important; font-size: 13px !important;
        }
        .bloodbridge-content .recipient-layout {
          grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important; align-items: start;
        }
        .bloodbridge-content .recipient-layout > div { width: 100%; min-width: 0; }
        .bloodbridge-content .recipient-layout form > label > div[style*="display: flex"] { flex-wrap: wrap !important; }
        .bloodbridge-content .recipient-layout form > label > div[style*="display: flex"] > input {
          flex: 1 1 125px; width: 100%;
        }
        .bloodbridge-content .recipient-layout button, .bloodbridge-content .recipient-layout a {
          white-space: normal; line-height: 1.35;
        }
        .bloodbridge-content .recipient-layout [style*="grid-template-columns: 1fr auto"] {
          grid-template-columns: minmax(0, 1fr) !important; align-items: start !important; gap: 12px !important;
        }
        .bloodbridge-content .recipient-layout [style*="text-align: right"] {
          align-items: flex-start !important; text-align: left !important;
        }
        .bloodbridge-content .recipient-layout .bloodbridge-map, .bloodbridge-content .recipient-layout iframe { max-width: 100%; }
      }
      @media (max-width: 640px) {
        .grid2 { grid-template-columns: minmax(0, 1fr) !important; }
      }
      @media (max-width: 390px) {
        .bloodbridge-nav { gap: 15px !important; }
        .navbtn { font-size: 12.5px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
      }

      /* Clean Minimal Footer matching reference design */
      .bloodbridge-footer {
        background: #000000;
        color: #f8fafc;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding: 68px 24px 34px;
        margin-top: 48px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Plus Jakarta Sans", "Segoe UI", Roboto, sans-serif;
      }
      .theme-light .bloodbridge-footer {
        background: #ffffff;
        color: #0f172a;
        border-top-color: #e5e7eb;
      }
      .bloodbridge-footer-inner {
        max-width: 1140px;
        margin: 0 auto;
      }
      .bloodbridge-footer-grid {
        display: grid;
        grid-template-columns: 2.2fr 1fr 1fr 1fr;
        gap: 48px;
        align-items: start;
      }
      @media (max-width: 900px) {
        .bloodbridge-footer-grid {
          grid-template-columns: 1fr 1fr;
          gap: 36px 24px;
        }
      }
      @media (max-width: 520px) {
        .bloodbridge-footer-grid {
          grid-template-columns: 1fr;
          gap: 28px;
        }
      }
      .bloodbridge-footer-brand {
        display: flex;
        flex-direction: column;
      }
      .bloodbridge-footer-col {
        display: flex;
        flex-direction: column;
      }
      .bloodbridge-footer-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin: 0 0 20px;
        color: #71717a;
        user-select: none;
      }
      .theme-light .bloodbridge-footer-title {
        color: #64748b;
      }
      .bloodbridge-footer-links {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .bloodbridge-footer-link {
        border: 0;
        padding: 0;
        background: transparent;
        font-size: 14px;
        font-weight: 450;
        text-align: left;
        cursor: pointer;
        text-decoration: none;
        line-height: 1.45;
        color: #d4d4d8;
        transition: color 0.15s ease;
        display: inline-block;
        width: fit-content;
        font-family: inherit;
      }
      .theme-light .bloodbridge-footer-link {
        color: #334155;
      }
      .bloodbridge-footer-link:hover {
        color: #ffffff;
      }
      .theme-light .bloodbridge-footer-link:hover {
        color: #0f172a;
      }
      .bloodbridge-footer-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin-top: 56px;
        padding-top: 28px;
      }
      .theme-light .bloodbridge-footer-bottom {
        border-top-color: #e5e7eb;
      }
      .bloodbridge-footer-cr {
        font-size: 13px;
        color: #71717a;
        font-weight: 400;
      }
      .theme-light .bloodbridge-footer-cr {
        color: #64748b;
      }
      .bloodbridge-footer-credit {
        font-size: 13px;
        color: #71717a;
        font-weight: 400;
      }
      .theme-light .bloodbridge-footer-credit {
        color: #64748b;
      }
      .bloodbridge-footer-credit strong {
        color: #ffffff;
        font-weight: 700 !important;
      }
      .theme-light .bloodbridge-footer-credit strong {
        color: #0f172a;
      }

      /* Light mode comprehensive overrides */
      .theme-light {
        color-scheme: light;
      }
      .theme-light, [data-theme="light"] {
        --text: #0f172a;
        --text-muted: #64748b;
      }
      .theme-light body, .theme-light html {
        background-color: #f8fafc !important;
        color: #0f172a !important;
      }
      .theme-light .headline:not(.bg-ink *):not([data-ink-card] *):not(footer *),
      .theme-light h1:not(.bg-ink *):not([data-ink-card] *):not(footer *),
      .theme-light h2:not(.bg-ink *):not([data-ink-card] *):not(footer *),
      .theme-light h3:not(.bg-ink *):not([data-ink-card] *):not(footer *),
      .theme-light h4:not(.bg-ink *):not([data-ink-card] *):not(footer *) {
        color: #0f172a !important;
      }
      .theme-light p:not(.bg-ink *):not([data-ink-card] *):not(footer *) {
        color: #475569 !important;
      }

      /* Home hero and floating blood cells in light mode */
      .theme-light .bc-wrap {
        background: radial-gradient(120% 90% at 50% 40%, #fee2e2 0%, #fef2f2 55%, #f8fafc 100%) !important;
      }
      .theme-light .bc-vignette {
        background: radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(255, 255, 255, 0.7) 100%) !important;
      }
      .theme-light .hero-graphic-card {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.08) !important;
      }
      .theme-light .hero-graphic-card [style*="rgba(10, 12, 18, 0.7)"],
      .theme-light .hero-graphic-card [style*="rgba(10,12,18,0.7)"] {
        background: #f8fafc !important;
        border-color: #e2e8f0 !important;
      }
      .theme-light .hero-graphic-card [style*="rgba(255,255,255,0.035)"],
      .theme-light .hero-graphic-card [style*="rgba(255, 255, 255, 0.035)"] {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }

      /* Blood facilities directory banner & metric cards in light mode */
      .theme-light [style*="#11151b"],
      .theme-light [style*="background: rgb(17, 21, 27)"],
      .theme-light [style*="background: #11151b"] {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
      }

      /* Nearest blood bank map containers & call buttons in light mode */
      .theme-light [style*="#0f172a"],
      .theme-light [style*="background: rgb(15, 23, 42)"],
      .theme-light [style*="background: #0f172a"] {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
        color: #0f172a !important;
      }
      .theme-light [style*="background: linear-gradient(135deg, rgba(2,132,199,0.12), rgba(15,23,42,0.6))"],
      .theme-light [style*="background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(15, 23, 42, 0.6))"] {
        background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), #ffffff) !important;
        border-color: #bae6fd !important;
      }
      .theme-light a[style*="background: rgba(255,255,255,0.08)"],
      .theme-light a[style*="background: rgba(255, 255, 255, 0.08)"] {
        background: #f1f5f9 !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
      }

      /* High-contrast text overrides for light mode */
      .theme-light [style*="color: rgb(243, 244, 246)"],
      .theme-light [style*="color: #f3f4f6"],
      .theme-light [style*="color: #F3F4F6"] {
        color: #0f172a !important;
      }
      .theme-light [style*="color: rgb(209, 213, 219)"],
      .theme-light [style*="color: #d1d5db"] {
        color: #334155 !important;
      }

      .theme-light [style*="background: rgba(20, 22, 28, 0.7)"],
      .theme-light [style*="background: rgba(255, 255, 255, 0.045)"],
      .theme-light [style*="background: rgba(16, 20, 30, 0.75)"],
      .theme-light [style*="background: rgba(18, 22, 32, 0.75)"],
      .theme-light .quick-card-inner {
        background: #ffffff !important;
        border-color: #e2e8f0 !important;
        box-shadow: 0 4px 18px -4px rgba(0, 0, 0, 0.07) !important;
        color: #0f172a !important;
      }
      .theme-light .quick-card-inner h3 {
        color: #0f172a !important;
      }
      .theme-light input, .theme-light select, .theme-light textarea {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
      }
      .theme-toggle-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }
    `}</style>
  );

  

  

  return (
    <div
      className="bloodbridge-app-root"
      style={{
        fontFamily: "var(--font-sans)",
        minHeight: "100vh",
        color: "var(--foreground)",
        backgroundColor: "var(--background)",
      }}
    >
      {fontImport}
      <NetworkStatusBanner />
      <EmergencyBanner
        onFindNearestBank={() => {
          setTab("nearest");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Redesigned Glass Sticky Header matching New Homepage Redesign */}
      <header className="glass sticky top-0 z-40 border-b border-border/60" style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" style={{ maxWidth: "72rem", margin: "0 auto", padding: "0 20px", display: "flex", height: 64, alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={() => { setTab("home"); setMobileMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--foreground)" }}
          >
            <Logo size={28} />
            <span style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.025em" }}>BloodBridge</span>
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <nav className="bloodbridge-nav" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
              {[
                { id: "home", label: "Home", path: "/" },
                { id: "camps", label: "Blood Facilities", path: "/facilities" },
                { id: "nearest", label: "Nearest Bank", path: "/nearestbank" },
                { id: "about", label: "About", path: "/about" },
              ].map((n) => (
                <a
                  key={n.id}
                  href={n.path}
                  role="link"
                  onClick={(e) => { e.preventDefault(); setTab(n.id); setMobileMenuOpen(false); }}
                  className={`navbtn rounded-full transition cursor-pointer ${
                    tab === n.id ? "active text-red bg-red/10 font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{
                    textDecoration: "none",
                    border: "none",
                    borderRadius: 9999,
                    padding: "7px 14px",
                    background: tab === n.id ? "rgba(225, 29, 72, 0.1)" : "transparent",
                    color: tab === n.id ? "var(--emergency)" : "var(--muted-foreground)",
                    fontWeight: tab === n.id ? 600 : 500,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {n.label}
                </a>
              ))}
            </nav>
            <ThemeToggle dark={theme === "dark"} onToggle={toggleTheme} />
            <div className="bloodbridge-menu-toggle-wrap">
              <button
                onClick={() => setMobileMenuOpen(v => !v)}
                aria-label="Toggle navigation"
                className="btn btn-ghost !p-2"
                style={{ width: 40, height: 40, borderRadius: 12, padding: 0, display: "grid", placeItems: "center" }}
              >
                {mobileMenuOpen ? <XCircle size={20} /> : <span style={{ fontSize: 22, lineHeight: 1 }}>☰</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            className="animate-rise"
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--card)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              boxShadow: "var(--shadow-lift)",
            }}
          >
            {[
              { id: "home", label: "Home" },
              { id: "camps", label: "Blood Facilities" },
              { id: "nearest", label: "Nearest Bank" },
              { id: "about", label: "About" },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); setMobileMenuOpen(false); }}
                style={{
                  textAlign: "left",
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: tab === n.id ? "rgba(225, 29, 72, 0.1)" : "transparent",
                  color: tab === n.id ? "var(--emergency)" : "var(--foreground)",
                  fontWeight: tab === n.id ? 700 : 500,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 44,
                }}
              >
                <span>{n.label}</span>
                {tab === n.id && <span className="size-2 rounded-full bg-emergency" />}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="bloodbridge-content" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px 60px", position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {tab === "home" && <Home goTo={setTab} />}
            {tab === "camps" && <CampsAndBanksView notify={notify} goTo={setTab} />}
            {tab === "nearest" && <NearestBloodBankMap apiBase={API_BASE} notify={notify} />}
            {tab === "about" && <BloodBridgeInfoPage page="about" theme={theme} goTo={setTab} />}
            {tab === "privacy" && <BloodBridgeInfoPage page="privacy" theme={theme} goTo={setTab} />}
            {tab === "terms" && <BloodBridgeInfoPage page="terms" theme={theme} goTo={setTab} />}

          </motion.div>
        </AnimatePresence>
      </div>

      {tab !== "admin" && (
        <footer
          className="mt-24 bloodbridge-persistent-footer"
          style={{
            marginTop: 80,
            borderTop: "1.5px solid rgba(255, 255, 255, 0.14)",
            background: "#0c0d11",
            color: "#f4f4f5",
          }}
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-3" style={{ maxWidth: "72rem", margin: "0 auto", padding: "64px 20px", display: "grid", gap: 48 }}>
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.25rem", fontWeight: 700, color: "#ffffff" }}>
                <Logo size={28} /> BloodBridge
              </div>
              <p className="mt-4 text-sm leading-relaxed" style={{ margin: "16px 0", fontSize: "0.875rem", lineHeight: 1.7, color: "#94a3b8" }}>
                Connecting people with verified blood banks, hospitals, and emergency distribution centers to guide you when it matters most.
              </p>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 9999, background: "rgba(225, 29, 72, 0.15)", color: "#f43f5e", fontSize: "0.8rem", fontWeight: 600 }}>
                <Heart size={14} fill="currentColor" /> Every donation can make a difference
              </span>
            </div>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 16px", color: "#64748b" }}>Quick links</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, fontSize: "0.9rem" }}>
                {[
                  ["home", "Home"],
                  ["camps", "Blood Facilities & Directory"],
                  ["nearest", "Camps & Blood Banks"],
                  ["about", "Features & Mission"],
                ].map(([to, label]) => (
                  <li key={label}>
                    <button
                      onClick={() => { setTab(to); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="group inline-flex items-center gap-1 cursor-pointer"
                      style={{ background: "none", border: "none", padding: 0, color: "#cbd5e1", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: "inherit", fontFamily: "inherit", transition: "color 0.15s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
                    >
                      <ChevronRight size={14} style={{ color: "var(--emergency)" }} />
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 16px", color: "#64748b" }}>Contact us</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16, fontSize: "0.875rem" }}>
                <li style={{ display: "flex", gap: 12 }}>
                  <Mail size={16} style={{ color: "var(--emergency)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#ffffff" }}>Email support</p>
                    <a href="mailto:support.bloodbridge@gmail.com" style={{ color: "#94a3b8", textDecoration: "none", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      support.bloodbridge@gmail.com
                    </a>
                  </div>
                </li>
                <li style={{ display: "flex", gap: 12 }}>
                  <Phone size={16} style={{ color: "var(--emergency)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#ffffff" }}>Mobile</p>
                    <p style={{ margin: 0, color: "#94a3b8" }}>+91 9132450XXX</p>
                  </div>
                </li>
                <li style={{ display: "flex", gap: 12 }}>
                  <MapPin size={16} style={{ color: "var(--emergency)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#ffffff" }}>Location</p>
                    <p style={{ margin: 0, color: "#94a3b8" }}>VIT Bhopal University, MP</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "24px 20px", borderTop: "1.5px solid rgba(255, 255, 255, 0.14)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: "0.8rem", color: "#94a3b8" }}>
            <p style={{ margin: 0, color: "#94a3b8" }}>
              © 2026 BloodBridge · Developed by Priyansh Bhatt for EPICS. Built with <Heart size={12} fill="currentColor" style={{ display: "inline", verticalAlign: -1, color: "var(--emergency)" }} /> to help save lives.
            </p>
            <div style={{ display: "flex", gap: 20 }}>
              <button onClick={() => { setTab("about"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}>About Us</button>
              <button onClick={() => { setTab("privacy"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}>Privacy Policy</button>
              <button onClick={() => { setTab("terms"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")} onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}>Terms &amp; Conditions</button>
            </div>
          </div>
          <p style={{ paddingBottom: 32, textAlign: "center", fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
            BloodBridge is a technology platform and does not replace medical advice or professional blood-bank screening.
          </p>
        </footer>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)",
              ...glassCard, padding: "14px 22px", fontSize: 13.5, display: "flex",
              alignItems: "center", gap: 10, maxWidth: "90vw", zIndex: 50,
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            <Bell size={16} color={COLORS.crimson} />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



function BloodBridgeInfoPage({ page, theme, goTo }) {
  const light = theme === "light";
  const ink = "var(--foreground)";
  const muted = "var(--muted-foreground)";
  const panel = "var(--card)";
  const line = "var(--border)";
  const red = "var(--emergency)";
  const sectionStyle = { background: panel, border: "1px solid " + line, borderRadius: 16, padding: "clamp(18px,3vw,30px)", marginBottom: 18 };
  const headingStyle = { color: red, fontSize: 17, fontWeight: 800, margin: "0 0 10px" };
  const paraStyle = { color: muted, fontSize: 14, lineHeight: 1.85, margin: "0 0 12px" };
  const bulletStyle = { color: muted, fontSize: 14, lineHeight: 1.8, paddingLeft: 20, margin: "8px 0 0" };
  const content = {
    about: {
      title: "About BloodBridge",
      subtitle: "A student project built around a simple goal: help people find blood donation support more easily.",
    },
    privacy: {
      title: "Privacy Policy",
      subtitle: "How BloodBridge handles information used by its blood-donation support features.",
    },
    terms: {
      title: "Terms of Service",
      subtitle: "By accessing and using BloodBridge, you agree to be bound by these Terms of Service. Please read them carefully.",
    }
  }[page];
  return (
    <div style={{ color: ink, paddingBottom: 20 }}>
      {page === "about" && (
        <div className="about-page-wrap" style={{ maxWidth: 1040, margin: "0 auto", padding: "10px 0 40px" }}>
          {/* Apple-style Hero Showcase */}
          <section
            className="tile nearest-bank-card about-hero-card"
            style={{
              position: "relative",
              textAlign: "center",
              padding: "clamp(48px, 8vw, 84px) 24px clamp(36px, 6vw, 60px)",
              overflow: "hidden",
              borderRadius: 32,
              background: light
                ? "radial-gradient(circle at 50% 0%, #ffffff 0%, #f4f6fa 100%)"
                : "radial-gradient(circle at 50% -20%, rgba(255, 59, 84, 0.18) 0%, rgba(34, 211, 238, 0.08) 50%, rgba(13, 16, 23, 0.95) 100%)",
              border: `1px solid ${light ? "rgba(15, 23, 42, 0.22)" : "rgba(255,255,255,0.08)"}`,
              boxShadow: light ? "0 20px 60px rgba(0,0,0,0.04)" : "0 30px 80px rgba(0,0,0,0.6)",
              marginBottom: 32,
            }}
          >
            {/* Ambient glass glow */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "80%",
                height: 1,
                background: "linear-gradient(90deg, transparent, rgba(255,59,84,0.6), transparent)",
              }}
            />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 18px",
                  borderRadius: 999,
                  background: light ? "rgba(255,59,84,0.08)" : "rgba(255,59,84,0.12)",
                  border: `1px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(255,59,84,0.3)"}`,
                  color: "#ff6579",
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 24,
                }}
              >
                <Sparkles size={14} /> The Philosophy Behind BloodBridge
              </div>

              <h1
                className="headline"
                style={{
                  fontSize: "clamp(36px, 6vw, 64px)",
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  lineHeight: 1.05,
                  margin: "0 auto 22px",
                  maxWidth: 820,
                  color: ink,
                }}
              >
                Built to connect human lives when seconds matter most.
              </h1>

              <p
                style={{
                  fontSize: "clamp(16px, 2.2vw, 20px)",
                  lineHeight: 1.6,
                  color: muted,
                  maxWidth: 680,
                  margin: "0 auto 36px",
                  fontWeight: 450,
                  letterSpacing: "-0.2px",
                }}
              >
                An engineering project engineered with clarity, speed, and zero friction — bridging people in need with certified blood banks and emergency hospitals.
              </p>

              {/* Minimal Apple Pill Tagline */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, flexWrap: "wrap", fontSize: 13.5, color: muted }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><CheckCircle2 size={16} color={COLORS.good} /> 100% Free Open Utility</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><ShieldCheck size={16} color={COLORS.cyan} /> 48+ Verified Centers</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Heart size={16} color={COLORS.crimson} /> Community First</span>
              </div>
            </motion.div>
          </section>

          {/* 3 Large Apple-style Bento Highlights */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))", gap: 20, marginBottom: 32 }}>
            {/* Bento Card 1: The Mission */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="nearest-bank-card about-bento-card"
              style={{
                background: light ? "#ffffff" : "rgba(255,255,255,0.035)",
                border: `1px solid ${light ? "rgba(15, 23, 42, 0.2)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 26,
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                boxShadow: light ? "0 10px 30px rgba(0,0,0,0.03)" : "none",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(255,59,84,0.2), rgba(255,59,84,0.05))",
                  border: `1px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(255,59,84,0.3)"}`,
                  display: "grid",
                  placeItems: "center",
                  color: COLORS.crimson,
                  marginBottom: 22,
                }}
              >
                <Heart size={26} fill="rgba(255,59,84,0.2)" />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: ink, letterSpacing: "-0.5px" }}>
                Our Core Mission
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: muted, margin: 0 }}>
                In critical emergencies, families often waste precious hours making chaotic phone calls to find available blood units. BloodBridge replaces this uncertainty with an instant, verified directory mapped with live GPS coordinates, direct emergency phone contacts, and operating hours.
              </p>
            </motion.div>

            {/* Bento Card 2: The Architecture */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="nearest-bank-card about-bento-card"
              style={{
                background: light ? "#ffffff" : "rgba(255,255,255,0.035)",
                border: `1px solid ${light ? "rgba(15, 23, 42, 0.2)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 26,
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                boxShadow: light ? "0 10px 30px rgba(0,0,0,0.03)" : "none",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(34,211,238,0.05))",
                  border: `1px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(34,211,238,0.3)"}`,
                  display: "grid",
                  placeItems: "center",
                  color: COLORS.cyan,
                  marginBottom: 22,
                }}
              >
                <Compass size={26} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: ink, letterSpacing: "-0.5px" }}>
                Precision &amp; Accessibility
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: muted, margin: 0 }}>
                Designed with a mobile-first, high-legibility interface that runs smoothly even on entry-level smartphones and spotty cellular connections. Zero tracking, zero advertisements, and no bloated login barriers for people seeking emergency help.
              </p>
            </motion.div>

            {/* Bento Card 3: The Geographic Scope */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="nearest-bank-card about-bento-card"
              style={{
                background: light ? "#ffffff" : "rgba(255,255,255,0.035)",
                border: `1px solid ${light ? "rgba(15, 23, 42, 0.2)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 26,
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                boxShadow: light ? "0 10px 30px rgba(0,0,0,0.03)" : "none",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.05))",
                  border: `1px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(52,211,153,0.3)"}`,
                  display: "grid",
                  placeItems: "center",
                  color: COLORS.good,
                  marginBottom: 22,
                }}
              >
                <MapPin size={26} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", color: ink, letterSpacing: "-0.5px" }}>
                100 KM Regional Network
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: muted, margin: 0 }}>
                Covering every major medical hub and community centre within 100 km of VIT Bhopal — including Sehore, Ashta, Bhopal, Hoshangabad, Raisen, Mandideep, and surrounding rural towns.
              </p>
            </motion.div>
          </div>

          {/* Apple-style Editorial Quote / Statement Section */}
          <section
            className="tile nearest-bank-card about-quote-card"
            style={{
              position: "relative",
              borderRadius: 30,
              padding: "clamp(36px, 5vw, 54px) clamp(24px, 4vw, 44px)",
              background: light
                ? "linear-gradient(135deg, #fff5f6 0%, #ffffff 100%)"
                : "linear-gradient(135deg, rgba(255,59,84,0.1) 0%, rgba(18,22,30,0.8) 100%)",
              border: `1.5px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(255,59,84,0.25)"}`,
              marginBottom: 32,
              textAlign: "left",
            }}
          >
            <div style={{ maxWidth: 840 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: COLORS.crimson, textTransform: "uppercase", marginBottom: 14 }}>
                The Story Behind BloodBridge
              </div>
              <h2
                style={{
                  fontSize: "clamp(24px, 3.8vw, 36px)",
                  fontWeight: 850,
                  letterSpacing: "-0.8px",
                  lineHeight: 1.25,
                  margin: "0 0 16px",
                  color: ink,
                }}
              >
                Technology is at its finest when it directly serves human life.
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.8, color: muted, margin: 0 }}>
                BloodBridge originated as an end-semester Engineering Projects in Community Service (EPICS) initiative at VIT Bhopal University. Rather than crafting another theoretical software demonstration, this platform was developed to address the real-world healthcare fragmentation observed across Madhya Pradesh's central district belt.
              </p>
            </div>
          </section>

          {/* Designer / Author Signature Showcase — Apple Style Credit */}
          <section
            className="tile nearest-bank-card about-credit-card"
            style={{
              background: light ? "#ffffff" : "rgba(20, 24, 34, 0.75)",
              border: `1px solid ${light ? "rgba(15, 23, 42, 0.22)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 30,
              padding: "clamp(32px, 5vw, 48px) clamp(20px, 4vw, 36px)",
              textAlign: "center",
              boxShadow: light ? "0 14px 40px rgba(0,0,0,0.04)" : "0 20px 50px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 16px",
                borderRadius: 999,
                background: "rgba(255,59,84,0.12)",
                border: `1px solid ${light ? "rgba(15, 23, 42, 0.24)" : "rgba(255,59,84,0.3)"}`,
                color: "#ff7085",
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              EPICS Project · VIT Bhopal University
            </div>

            <h2
              className="headline"
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 900,
                letterSpacing: "-1px",
                margin: "0 0 10px",
                color: ink,
              }}
            >
              Developed by <span style={{ color: COLORS.crimson }}>Priyansh Bhatt</span> for EPICS
            </h2>

            <p style={{ fontSize: 16.5, color: muted, maxWidth: 580, margin: "0 auto 28px", lineHeight: 1.65 }}>
              Engineering Projects in Community Service (EPICS) · School of Computing Science and Engineering, VIT Bhopal University.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, maxWidth: 880, margin: "0 auto" }}>
              {[
                { name: "Priyansh Bhatt", role: "Lead Developer & Researcher", dot: "#34D399" },
                { name: "Varun Kumar", role: "Presentation & Pitch Lead", dot: "#38BDF8" },
                { name: "Deeptanshu", role: "Overall Review & QA", dot: "#A78BFA" },
                { name: "Krishna Thakkar", role: "Project Report & Documentation", dot: "#FBBF24" },
                { name: "Abhijit Chauhan", role: "Preliminary Testing & Feedback", dot: "#F472B6" },
                { name: "Jayesh Joshi", role: "Bug Hunting & Testing", dot: "#FB7185" },
              ].map((member) => (
                <div
                  key={member.name}
                  className="about-author-pill"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 20px",
                    borderRadius: 20,
                    background: light ? "#f9fafb" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${light ? "rgba(15, 23, 42, 0.2)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: member.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 14.5, fontWeight: 750, color: ink }}>{member.name}</span>
                  <span style={{ fontSize: 12.5, color: muted }}>· {member.role}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => { goTo("camps"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{
                  ...glowBtn,
                  fontSize: 15,
                  padding: "13px 24px",
                  borderRadius: 14,
                }}
              >
                <Building2 size={18} />
                <span>Explore Facilities</span>
              </button>
              <button
                type="button"
                onClick={() => { goTo("nearest"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{
                  ...ghostBtn,
                  fontSize: 15,
                  padding: "13px 24px",
                  borderRadius: 14,
                  ...(light ? { border: "1px solid rgba(15, 23, 42, 0.26)" } : {}),
                }}
              >
                <Navigation size={18} />
                <span>Locate Nearest Blood Bank</span>
              </button>
            </div>
          </section>
        </div>
      )}
      {page === "privacy" && <>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 34px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "rgba(255,59,84,0.1)", border: "1px solid rgba(255,59,84,0.25)", color: red, marginBottom: 12 }}>
            <Shield size={22} />
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.5px" }}>Privacy Policy</h1>
          <p style={{ color: muted, fontSize: 15, margin: "0 auto", lineHeight: 1.65 }}>
            At BloodBridge, we believe in radical transparency. We literally store nothing except what is publicly available on Google regarding blood banks, hospitals, and donation centres.
          </p>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 20 }}>
          {[
            {
              title: "1. Information We Store (Zero Private Data)",
              body: "We literally do not collect, harvest, store, or sell your private personal data or confidential medical records. The platform only compiles and displays openly available public information found on Google, government registries, and public health portals about blood banks, donation camps, and hospital centers."
            },
            {
              title: "2. Public Facility & Directory Data",
              body: "The only information present on this platform consists of publicly indexed facility names, telephone numbers, addresses, opening hours, and geographic coordinates that are already open and accessible on Google and public directories for community convenience."
            },
            {
              title: "3. No Tracking & No Third-Party Selling",
              body: "We do not track your personal identity, browse history, or sell any information to marketing agencies, brokers, or third parties. BloodBridge exists exclusively as an open community utility to help people find emergency blood resources."
            },
            {
              title: "4. Third-Party Maps & Links",
              body: "When you tap to open directions or call a phone number, your device interacts directly with third-party providers (such as Google Maps or your local phone carrier). Their respective terms and privacy policies govern those actions."
            },
            {
              title: "5. Contact & Privacy Inquiries",
              body: "If any public blood bank or hospital listing needs correction or removal from the directory, email us directly at support.bloodbridge@gmail.com."
            }
          ].map((item) => (
            <section key={item.title} style={{ ...sectionStyle, padding: "22px 24px", marginBottom: 0, borderRadius: 16 }}>
              <h2 style={{ ...headingStyle, fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: red }}>{item.title}</h2>
              <p style={{ ...paraStyle, margin: 0, fontSize: 14.5, lineHeight: 1.75, color: muted }}>{item.body}</p>
            </section>
          ))}
        </div>
      </>}
      {page === "terms" && <>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 34px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "rgba(255,59,84,0.1)", border: "1px solid rgba(255,59,84,0.25)", color: red, marginBottom: 12 }}>
            <FileText size={22} />
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.5px" }}>Terms of Service</h1>
          <p style={{ color: muted, fontSize: 15, margin: "0 auto", lineHeight: 1.65 }}>
            By accessing and using BloodBridge, you agree to be bound by these Terms of Service. Please read them carefully.
          </p>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 20 }}>
          {[
            {
              title: "1. Community Welfare & Zero Liability",
              body: "BloodBridge is an open community welfare initiative built strictly for public awareness, education, and voluntary social assistance. The operators, developers, contributors, and team members DO NOT assume any legal responsibility, liability, or obligation whatsoever for any outcome, direct or indirect damages, injuries, delays, losses, disputes, or medical complications arising from using or relying on this website. Use of this platform is entirely at your own discretion and risk."
            },
            {
              title: "2. Hospital & Blood Bank Verification",
              body: "You MUST independently contact and verify all details directly with the responsible hospital, licensed blood bank, or certified healthcare facility before taking any action or traveling. BloodBridge is NOT a licensed medical clinic, hospital, diagnostic center, or blood bank. We do NOT test, extract, screen, collect, store, handle, transport, or issue blood units or blood products."
            },
            {
              title: "3. November 2026 Dataset Scope",
              body: "Directory records, hospital listings, public blood bank directories, and geolocation mappings displayed on this website are based on public and compiled data accurate as of early November 2026. Facility contacts, operating hours, active inventory, telephone numbers, and camp schedules are subject to changes by third parties without notice. Real-time availability cannot be guaranteed."
            },
            {
              title: "4. Acceptable Use Policy",
              body: "BloodBridge is designed to facilitate voluntary community support. You are strictly prohibited from using the platform for: (a) fraudulent blood requests or financial solicitations; (b) commercial resale or paid trade of blood or organs (which is illegal under applicable law); (c) harassment, spam, impersonation, or deceptive practices; or (d) uploading malicious, automated, or misleading data. We reserve the absolute right to restrict, report, or terminate access for any violation without notice."
            },
            {
              title: "5. Emergency Medical Protocols",
              body: "BloodBridge must NEVER be used as a replacement for emergency medical services. In any acute medical emergency or life-threatening situation, immediately call national emergency helplines (108 / 102), contact the nearest hospital emergency room, or reach the local state blood council directly."
            },
            {
              title: "6. Third-Party Integrations",
              body: "This website may integrate or link to external third-party services including maps, routing, geolocation, public government registries, and telephone protocols. BloodBridge has no control over and assumes zero responsibility for the content, uptime, accuracy, privacy policies, or actions of any third-party service."
            },
            {
              title: "7. Terms Modifications",
              body: "We reserve the right to revise or update these terms at any time to reflect platform improvements or statutory guidelines. Continued access or use of BloodBridge after revisions are posted constitutes your explicit acceptance of the updated terms."
            },
            {
              title: "8. Contact & Reports",
              body: "For community suggestions, corrections to unlisted or outdated hospital and blood donation centers, or questions regarding these terms, contact support.bloodbridge@gmail.com."
            }
          ].map((item) => (
            <section key={item.title} style={{ ...sectionStyle, padding: "22px 24px", marginBottom: 0, borderRadius: 16 }}>
              <h2 style={{ ...headingStyle, fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: red }}>{item.title}</h2>
              <p style={{ ...paraStyle, margin: 0, fontSize: 14.5, lineHeight: 1.75, color: muted }}>{item.body}</p>
            </section>
          ))}
        </div>
      </>}
      {page !== "about" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <button onClick={() => goTo("about")} style={{ border: "1px solid " + line, borderRadius: 10, background: "transparent", color: ink, fontWeight: 700, padding: "12px 18px", cursor: "pointer" }}>About BloodBridge</button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// HOME
// =================================================================
// =================================================================

const BLOOD_GROUP_INFO = {
  "O+": {
    badge: "Most Common",
    prevalence: "~38% in India",
    desc: "Can donate red cells to any Rh+ patient. High hospital trauma demand.",
    givesTo: "Rh+ types",
    receivesFrom: "O+, O-",
  },
  "O-": {
    badge: "Universal Donor",
    prevalence: "~1.4% in India",
    desc: "Universal red cell donor. Crucial in emergency trauma and surgery.",
    givesTo: "All blood types",
    receivesFrom: "O- only",
  },
  "A+": {
    badge: "Second Common",
    prevalence: "~22% in India",
    desc: "Can donate red cells to A+ and AB+. Ideal for platelet donations.",
    givesTo: "A+, AB+",
    receivesFrom: "A, O types",
  },
  "A-": {
    badge: "Rare Group",
    prevalence: "~0.8% in India",
    desc: "Can donate red cells to A and AB patients. Essential in scheduled care.",
    givesTo: "A, AB types",
    receivesFrom: "A-, O-",
  },
  "B+": {
    badge: "High Prevalence",
    prevalence: "~32% in India",
    desc: "Key group in India. Vital for regular transfusions and thalassemia care.",
    givesTo: "B+, AB+",
    receivesFrom: "B, O types",
  },
  "B-": {
    badge: "Rare Group",
    prevalence: "~1.4% in India",
    desc: "Can donate red cells to B and AB patients. High clinical need.",
    givesTo: "B, AB types",
    receivesFrom: "B-, O-",
  },
  "AB+": {
    badge: "Universal Recipient",
    prevalence: "~8% in India",
    desc: "Can receive red cells of any type. Universal plasma donor to all.",
    givesTo: "AB+ only",
    receivesFrom: "All blood types",
  },
  "AB-": {
    badge: "Rarest Group",
    prevalence: "~0.5% in India",
    desc: "Rarest group. Universal plasma donor along with AB+ to all patients.",
    givesTo: "AB-, AB+",
    receivesFrom: "All Rh- types",
  },
};

function Home({ goTo }) {
  
  const [placesToDonate, setPlacesToDonate] = useState([
    {
      name: "District Hospital Blood Bank Sehore",
      district: "Sehore",
      category: "Government",
      address: "Near Bus Stand, Sehore - 466001",
      phone: "07562-224102",
      openingHours: "24/7 Walk-in Donation",
    },
    {
      name: "AIIMS Blood Bank Bhopal",
      district: "Bhopal",
      category: "Government",
      address: "Saket Nagar, AIIMS Campus, Bhopal - 462020",
      phone: "0755-2970000",
      openingHours: "24 Hours / 7 Days",
    },
    {
      name: "Indian Red Cross Society Blood Centre Bhopal",
      district: "Bhopal",
      category: "Red Cross",
      address: "Red Cross Bhavan, Shivaji Nagar, Link Road No. 1, Bhopal",
      phone: "0755-2550100",
      openingHours: "24 Hours / 7 Days",
    },
    {
      name: "Bhopal Memorial Hospital & Research Centre (BMHRC)",
      district: "Bhopal",
      category: "Government",
      address: "Raisen Bypass Road, Karond, Bhopal - 462038",
      phone: "0755-2740325",
      openingHours: "24/7 Operations",
    },
    {
      name: "District Hospital Blood Bank Vidisha",
      district: "Vidisha",
      category: "Government",
      address: "Sironj Road, Vidisha - 464001",
      phone: "07592-232102",
      openingHours: "24/7 Open",
    },
    {
      name: "District Hospital Blood Bank Raisen",
      district: "Raisen",
      category: "Government",
      address: "Sanchi Road, Raisen - 464551",
      phone: "07482-222045",
      openingHours: "24/7 Open",
    },
  ]);

  useEffect(() => {
    let live = true;
    api("/blood-banks")
      .then((data) => {
        if (live && Array.isArray(data) && data.length > 0) {
          const valid = data.filter(
            (b) => b.category === "Government" || b.category === "Red Cross" || b.category === "Charitable" || b.category === "Private"
          );
          if (valid.length >= 4) {
            setPlacesToDonate(valid.slice(0, 6));
          }
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  

  return (
    <div className="bloodbridge-home pb-8">
      {/* Hero Section */}
      <section className="mx-auto grid max-w-6xl items-center gap-6 sm:gap-10 px-4 pb-6 pt-4 sm:pb-8 sm:pt-6 md:grid-cols-[1.1fr_1fr] md:pt-10">
        <div className="animate-rise">
          <span className="eyebrow !text-red flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-red animate-pulse" />
            Blood donor network · Madhya Pradesh
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Be someone's <span className="text-gradient">lifeline.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-muted-foreground">
            Find verified blood banks, hospitals, and emergency donors across Sehore, Bhopal, and nearby regions — call or get turn-by-turn directions in one tap.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => goTo("camps")}
              className="btn btn-primary"
            >
              <Building2 className="size-4" /> Browse facilities
            </button>
            <button
              type="button"
              onClick={() => goTo("nearest")}
              className="btn btn-ghost"
            >
              <Navigation className="size-4" /> Nearest bank
            </button>
            <button
              type="button"
              onClick={() => goTo("about")}
              className="btn btn-ghost !border-dashed text-xs sm:text-sm"
            >
              <Info className="size-3.5" /> About BloodBridge
            </button>
          </div>
        </div>
        <HeroArt />
      </section>

      {/* Active Regional Network Banner */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(24px, 3.5vw, 36px)" }}>
        <div
          className="tile home-network-banner flex flex-wrap items-center justify-between gap-3 hover:!translate-y-0"
          style={{ padding: "12px 20px", borderRadius: 16 }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="grid place-items-center rounded-xl bg-red/10 text-red shrink-0"
              style={{ width: 28, height: 28, display: "grid", placeItems: "center", flexShrink: 0 }}
            >
              <Activity className="size-3.5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                <span className="eyebrow text-[10px]">Active regional network</span>
                <span className="text-muted-foreground text-[11px] hidden sm:inline">· Bhopal, Sehore, Raisen, Vidisha, Ashta, Hoshangabad</span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-foreground leading-tight" style={{ margin: "1px 0 0" }}>
                32+ verified facilities within 100 km
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs sm:text-sm text-sky-500">32+</span>
              <span className="text-muted-foreground text-[11px]">Verified Centres</span>
            </div>
            <div className="h-3 w-px bg-border/60" />
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-500">24x7</span>
              <span className="text-muted-foreground text-[11px]">Emergency Access</span>
            </div>
            <div className="h-3 w-px bg-border/60" />
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs sm:text-sm text-red">6</span>
              <span className="text-muted-foreground text-[11px]">Districts</span>
            </div>
          </div>
        </div>
      </section>

      {/* What do you need? */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(48px, 6vw, 68px)" }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5" style={{ marginBottom: 20 }}>
          <div>
            <span className="eyebrow !text-red block mb-1">Quick navigation</span>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-tight text-foreground m-0">What do you need?</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground m-0 sm:text-right max-w-md pb-0.5">
            Direct access to emergency centers, live routing, and community initiatives.
          </p>
        </div>
        <div className="grid gap-3 sm:gap-3.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {[
            {
              id: "camps",
              icon: Building2,
              title: "Explore facilities",
              body: "Verified hospitals, government blood centers, and emergency facility contacts.",
              action: () => goTo("camps"),
            },
            {
              id: "nearest",
              icon: MapPin,
              title: "Nearest blood bank",
              body: "Turn-by-turn directions with real-time GPS and Google Maps integration.",
              action: () => goTo("nearest"),
            },
            {
              id: "about",
              icon: Info,
              title: "About us",
              body: "Learn about the BloodBridge mission, life-saving network, and community values.",
              action: () => goTo("about"),
            },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.action}
              className="tile nearest-bank-card group flex flex-col justify-between text-left transition-all duration-200"
              style={{
                textAlign: "left",
                alignItems: "flex-start",
                width: "100%",
                borderRadius: 18,
                padding: "18px 20px",
                minHeight: 128,
                overflow: "hidden",
              }}
            >
              <div>
                <span
                  className="grid place-items-center rounded-xl bg-red/10 text-red group-hover:bg-red group-hover:text-white transition-colors duration-200"
                  style={{ width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <c.icon className="size-4" />
                </span>
                <h3 className="text-base font-semibold" style={{ margin: "8px 0 2px", fontSize: "1rem" }}>{c.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed" style={{ margin: 0, lineHeight: 1.4 }}>{c.body}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-red" style={{ marginTop: 8 }}>
                <span>Open view</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Blood Groups at a Glance */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(48px, 6vw, 68px)" }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3" style={{ marginBottom: 22 }}>
          <div>
            <span className="eyebrow !text-red block mb-1">Clinical Reference</span>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-tight m-0">Blood groups at a glance</h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground m-0">
              Compatibility facts, clinical roles, and population prevalence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => goTo("camps")}
            className="btn btn-primary text-xs whitespace-nowrap self-start sm:self-auto"
            style={{ borderRadius: 9999, padding: "8px 16px" }}
          >
            <Building2 className="size-3.5" /> Find Blood Facilities
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GROUPS.map((group) => {
            const info = BLOOD_GROUP_INFO[group] || {
              badge: "Blood Group",
              prevalence: "Prevalent",
              desc: "Clinical reference facts and compatibility.",
              givesTo: "Compatible types",
              receivesFrom: "Compatible types",
            };
            return (
              <div
                key={group}
                className="tile nearest-bank-card flex flex-col justify-between transition-all duration-200"
                style={{
                  padding: "20px 22px",
                  borderRadius: 20,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 210,
                  overflow: "hidden",
                }}
              >
                <div>
                  <div className="pb-3 border-b border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground" style={{ lineHeight: 1 }}>
                        {group}
                      </span>
                      <span
                        className="text-[11px] font-mono uppercase tracking-wider rounded-full bg-red/10 text-red border border-red/20 font-bold shrink-0"
                        style={{ padding: "5px 12px", borderRadius: 9999, lineHeight: 1.2 }}
                      >
                        {info.badge}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span className="text-[11px]">Prevalence in India</span>
                      <span className="font-semibold text-foreground font-mono text-xs">{info.prevalence.replace(/ in India/i, "")}</span>
                    </div>
                  </div>
                  <p
                    className="text-sm text-muted-foreground leading-relaxed font-normal"
                    style={{ margin: "12px 0 0", lineHeight: 1.55 }}
                  >
                    {info.desc}
                  </p>
                </div>

                <div
                  className="mt-4 pt-3 border-t border-border/60 text-xs font-mono space-y-1.5 text-muted-foreground"
                  style={{ marginTop: 14, paddingTop: 10 }}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px]">Gives to:</span>
                    <strong className="text-foreground font-bold rounded bg-muted/60 text-[11px]" style={{ padding: "4px 10px", borderRadius: 8 }}>{info.givesTo}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px]">Gets from:</span>
                    <strong className="text-foreground font-bold rounded bg-muted/60 text-[11px]" style={{ padding: "4px 10px", borderRadius: 8 }}>{info.receivesFrom}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(48px, 6vw, 68px)" }}>
        <div style={{ marginBottom: 20 }}>
          <span className="eyebrow !text-red block mb-1">Process</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight m-0">How it works.</h2>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {[
            { icon: Search, t: "Find", b: "Browse or search verified hospitals, blood banks, and walk-in facilities." },
            { icon: PhoneCall, t: "Call", b: "Confirm real-time blood group availability directly before traveling." },
            { icon: Navigation, t: "Go", b: "Open GPS directions in Google Maps and follow medical guidance." },
          ].map((s, i) => (
            <div
              key={s.t}
              className="tile nearest-bank-card flex flex-col justify-between"
              style={{
                borderRadius: 18,
                padding: "18px 20px",
                overflow: "hidden"
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="grid place-items-center rounded-full border border-border"
                  style={{ width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0 }}
                >
                  <s.icon className="size-4 text-red" />
                </span>
                <span className="font-mono text-lg sm:text-xl font-semibold text-border">0{i + 1}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <h3 className="font-semibold text-base sm:text-lg" style={{ margin: 0 }}>{s.t}</h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed" style={{ margin: "4px 0 0" }}>{s.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verified Centres */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(48px, 6vw, 68px)" }}>
        <div
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 22 }}
        >
          <div>
            <span className="eyebrow !text-red block mb-1">Direct Walk-In</span>
            <h2 className="text-2xl sm:text-3xl sm:text-4xl font-semibold leading-tight m-0">Donate Blood &amp; Save Lives: Verified Centres</h2>
          </div>
          <button
            type="button"
            onClick={() => { goTo("camps"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="btn btn-ghost text-xs self-start sm:self-auto"
            style={{ width: "auto", flexShrink: 0, borderRadius: 9999, border: "1px solid var(--border)", padding: "7px 14px" }}
          >
            View all 32+ facilities <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {placesToDonate.map((p, idx) => (
            <div
              key={p.name || idx}
              className="tile nearest-bank-card flex flex-col justify-between"
              style={{ borderRadius: 18, padding: "20px 22px", overflow: "hidden" }}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-flex items-center rounded-full text-xs font-medium bg-red/10 text-red border border-red/20"
                    style={{ borderRadius: 9999, padding: "5px 12px", lineHeight: 1.2 }}
                  >
                    {p.category || "Verified Centre"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{p.district}</span>
                </div>
                <h3 className="mt-2.5 text-base font-semibold leading-snug">{p.name}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {p.address}
                </p>
                {p.openingHours && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {p.openingHours}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between gap-2">
                {p.phone ? (
                  <a
                    href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}
                    className="btn btn-ghost !py-1.5 !px-3 text-xs"
                    style={{ borderRadius: 9999 }}
                  >
                    <Phone className="size-3.5 text-red" />
                    Call
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Contact on site</span>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address || p.district || ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary !py-1.5 !px-3 text-xs"
                  style={{ borderRadius: 9999 }}
                >
                  <Navigation className="size-3.5" />
                  Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dark Ink Banner CTA */}
      <section className="mx-auto max-w-6xl px-4" style={{ marginTop: "clamp(48px, 6vw, 68px)", marginBottom: "clamp(40px, 5vw, 60px)" }}>
        <div
          data-ink-card
          className="tile nearest-bank-card relative overflow-hidden rounded-3xl sm:rounded-4xl bg-ink p-5 sm:p-8 md:p-10 text-ink-foreground"
          style={{
            background: "var(--ink)",
            borderRadius: 24,
            padding: "clamp(24px, 4.5vw, 44px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.4)",
            overflow: "hidden"
          }}
        >
          <svg className="absolute -right-24 -top-24 h-[20rem] sm:h-[28rem] w-[20rem] sm:w-[28rem] pointer-events-none" viewBox="0 0 200 200" aria-hidden>
            {[90, 70, 50, 30].map((r, i) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="var(--emergency)"
                strokeOpacity={0.15 + i * 0.15}
                strokeWidth="0.6"
              />
            ))}
          </svg>
          <div className="relative max-w-xl">
            <span className="eyebrow !text-red">Join our mission</span>
            <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl" style={{ color: "#ffffff" }}>
              A small act can make a life-changing difference.
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: "rgba(255, 255, 255, 0.85)" }}>
              Explore donation camps, verified hospitals, and regional blood banks to find support when it matters most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => goTo("camps")}
                className="btn btn-primary"
              >
                <Building2 className="size-4" /> Camps & banks
              </button>
              <button
                type="button"
                onClick={() => goTo("nearest")}
                className="btn btn-ink"
                style={{ color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.2)" }}
              >
                <Navigation className="size-4" /> Nearest bank
              </button>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
          BloodBridge is a guidance and discovery directory connecting people with verified blood banks, hospitals, and emergency healthcare centers. It does not handle, process, or accept blood requests.
        </p>
      </section>
    </div>
  );
}


function CampsAndBanksView({ notify, goTo }) {
  const [camps, setCamps] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(true);
  const [districtData, setDistrictData] = useState({});

  useEffect(() => {
    let live = true;
    fetch("/india-districts.json")
      .then(r => { if (!r.ok) throw new Error("District list unavailable"); return r.json(); })
      .then(raw => {
        const source = Array.isArray(raw) ? raw : (raw.states || raw.data || raw);
        const map = {};
        if (Array.isArray(source)) {
          source.forEach(row => {
            const name = row.state || row.stateName || row.name;
            const ds = row.districts || row.children || row.district || [];
            if (name) map[name] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean);
          });
        } else if (source && typeof source === "object") {
          Object.entries(source).forEach(([name, value]) => {
            const ds = Array.isArray(value) ? value : (value.districts || value.children || []);
            map[name.replace(/\s*\(UT\)$/i, "")] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean);
          });
        }
        if (live) setDistrictData(map);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const stateOptions = Object.keys(districtData).sort();
  const districtOptions = state => districtData[state] || [];
  const [directoryTab, setDirectoryTab] = useState("camps");
  const [query, setQuery] = useState("");
  const [campFilter, setCampFilter] = useState("upcoming");
  const [bankDistrictFilter, setBankDistrictFilter] = useState("ALL");
  const [bankCategoryFilter, setBankCategoryFilter] = useState("ALL");
  const [bankServiceFilter, setBankServiceFilter] = useState("ALL");

  const loadCamps = useCallback(async () => {
    try {
      const data = await api("/camps");
      setCamps(Array.isArray(data) ? data : []);
    } catch (err) { /* background failure suppressed */ }
    finally { setLoading(false); }
  }, []);

  const loadBanks = useCallback(async () => {
    try {
      const data = await api("/blood-banks");
      setBanks(Array.isArray(data) ? data : []);
    } catch (err) { /* background failure suppressed */ }
    finally { setBanksLoading(false); }
  }, []);

  useEffect(() => { loadCamps(); loadBanks(); }, [loadCamps, loadBanks]);

    const dateValue = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingCount = camps.filter((c) => { const d = dateValue(c.date); return d && d >= today; }).length;
  const filteredCamps = camps.filter((c) => {
    const d = dateValue(c.date);
    const upcoming = !d || d >= today;
    if (campFilter === "upcoming" && !upcoming) return false;
    if (campFilter === "past" && (!d || d >= today)) return false;
    return [c.title, c.organizer, c.location, c.city, c.state].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => {
    const da = dateValue(a.date) ? dateValue(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const db = dateValue(b.date) ? dateValue(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return campFilter === "past" ? db - da : da - db;
  });
  const DISTRICT_OPTIONS = ["ALL", "Sehore", "Bhopal", "Raisen", "Vidisha", "Rajgarh", "Shajapur", "Narmadapuram", "Dewas"];
  const CATEGORY_OPTIONS = [
    { id: "ALL", label: "All Types" },
    { id: "Government", label: "Government" },
    { id: "Private", label: "Private" },
    { id: "Charitable", label: "Charitable" },
    { id: "Red Cross", label: "Red Cross" },
    { id: "Blood Storage Unit", label: "Storage Units" },
  ];
  const SERVICE_OPTIONS = [
    { id: "ALL", label: "All Services" },
    { id: "NEED", label: "Need Blood (Sec A)" },
    { id: "DONATE", label: "Want to Donate (Sec B)" },
  ];

  const filteredBanks = banks.filter((b) => {
    if (bankDistrictFilter !== "ALL" && String(b.district || b.city || "").toLowerCase() !== bankDistrictFilter.toLowerCase()) {
      return false;
    }
    if (bankCategoryFilter !== "ALL") {
      const cat = String(b.category || "").toLowerCase();
      if (bankCategoryFilter === "Government" && !cat.includes("government")) return false;
      if (bankCategoryFilter === "Private" && !cat.includes("private")) return false;
      if (bankCategoryFilter === "Charitable" && !cat.includes("charitable")) return false;
      if (bankCategoryFilter === "Red Cross" && !cat.includes("red cross")) return false;
      if (bankCategoryFilter === "Blood Storage Unit" && !cat.includes("storage")) return false;
    }
    if (bankServiceFilter !== "ALL") {
      const srv = String(b.serviceCategory || "").toLowerCase();
      if (bankServiceFilter === "NEED" && !srv.includes("need")) return false;
      if (bankServiceFilter === "DONATE" && !srv.includes("donate")) return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.city, b.district, b.state, b.phone, b.email, b.address, b.openingHours, b.category, b.facilityType, b.components, b.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const panel = { border: "1px solid var(--border)", borderRadius: 18, background: "var(--card)", boxShadow: "var(--shadow-soft)", color: "var(--foreground)" };
  const buttonStyle = (active) => ({ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, padding: "10px 13px", fontSize: 12, fontWeight: 750, cursor: "pointer", color: active ? "#fff" : "var(--foreground)", background: active ? "linear-gradient(135deg, " + COLORS.crimson + ", " + COLORS.crimsonDeep + ")" : "var(--secondary)", border: active ? "1px solid rgba(255,90,110,0.35)" : "1px solid var(--border)", boxShadow: active ? "0 8px 22px rgba(255,59,84,0.18)" : "none", textDecoration: "none", transition: "color 0.22s ease, background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, transform 0.18s ease" });
  const tabPillBtnStyle = (active) => ({ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, padding: "10px 14px", fontSize: 12, fontWeight: 750, cursor: "pointer", color: active ? "#fff" : "var(--foreground)", background: "transparent", border: "1px solid transparent", textDecoration: "none", transition: "color 0.22s ease" });
  const field = { ...inputStyle, width: "100%", boxSizing: "border-box" };
  const changeTab = (tab) => { setDirectoryTab(tab); setQuery(""); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 25 }}>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}
        className="tile nearest-bank-card facilities-hero-card"
        style={{ borderRadius: 18, color: "var(--foreground)", position: "relative", overflow: "hidden", padding: "clamp(22px, 4vw, 38px)" }}>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid rgba(255,90,110,0.25)", background: "rgba(255,59,84,0.08)", color: "#ff8797", borderRadius: 30, padding: "7px 11px", fontSize: 10, fontWeight: 850, letterSpacing: 1, textTransform: "uppercase" }}>
            <MapPin size={13} /> EMERGENCY &amp; RECIPIENT FACILITIES DIRECTORY
          </div>
          <h1 className="headline" style={{ fontSize: "clamp(30px, 5vw, 47px)", lineHeight: 1.08, letterSpacing: -1.4, margin: "18px 0 12px" }}>
            Need Blood? Find <span style={{ color: COLORS.crimson }}>Hospitals &amp; Blood Banks</span>
          </h1>
          <p style={{ margin: 0, maxWidth: 620, fontSize: 14, lineHeight: 1.8, color: COLORS.textMuted }}>
            Find emergency blood facilities, hospital blood banks, and verified distribution centers across India. Browse contact details, check locations, or call direct emergency lines.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 23 }}>
            <div className="facilities-hero-pills" style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, padding: 4, borderRadius: 15, background: "var(--secondary)", border: "1px solid var(--border)" }}>
              <button onClick={() => changeTab("banks")} style={tabPillBtnStyle(directoryTab === "banks")}>
                {directoryTab === "banks" && (
                  <motion.span
                    layoutId="heroDirPill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{ position: "absolute", inset: 0, borderRadius: 11, background: `linear-gradient(135deg, ${COLORS.crimson}, ${COLORS.crimsonDeep})`, boxShadow: "0 8px 22px rgba(255,59,84,0.22)", border: "1px solid rgba(255,90,110,0.35)" }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Building2 size={15} /> Hospital blood banks
                </span>
              </button>
              <button onClick={() => { changeTab("camps"); setCampFilter("upcoming"); }} style={tabPillBtnStyle(directoryTab === "camps")}>
                {directoryTab === "camps" && (
                  <motion.span
                    layoutId="heroDirPill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{ position: "absolute", inset: 0, borderRadius: 11, background: `linear-gradient(135deg, ${COLORS.crimson}, ${COLORS.crimsonDeep})`, boxShadow: "0 8px 22px rgba(255,59,84,0.22)", border: "1px solid rgba(255,90,110,0.35)" }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Calendar size={15} /> Active blood distribution drives
                </span>
              </button>
            </div>
            <a
              href="mailto:support.bloodbridge@gmail.com?subject=Blood%20Donation%20Centre%20or%20Hospital%20Not%20Listed&body=Hi%20BloodBridge%20Team%2C%0A%0AI%20would%20like%20to%20report%20a%20blood%20donation%20centre%20or%20hospital%20that%20is%20not%20mentioned%20on%20the%20platform%3A%0A%0AFacility%20Name%3A%20%0ALocation%2FCity%3A%20%0AContact%20Details%3A%20%0AAdditional%20Info%3A%20%0A"
              style={{
                ...buttonStyle(false),
                borderColor: "rgba(225, 29, 72, 0.4)",
                color: "var(--emergency)",
                background: "rgba(225, 29, 72, 0.08)",
              }}
            >
              <Mail size={14} /> Hospital not listed? Report via email
            </a>
          </div>
        </div>
      </motion.section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
        {[
          { label: "Upcoming camps", value: upcomingCount, note: "Scheduled for today or later", icon: <Calendar size={17} />, color: COLORS.crimson },
          { label: "Blood banks", value: banks.length, note: "Directory listings", icon: <Building2 size={17} />, color: COLORS.cyan },
          { label: "Public phone numbers", value: camps.filter((c) => c.contactPhone).length + banks.filter((b) => b.phone).length, note: "Listings with a contact number", icon: <Phone size={17} />, color: COLORS.good },
        ].map((s) => (
          <div key={s.label} className="tile nearest-bank-card" style={{ borderRadius: 18, color: "var(--foreground)", padding: "16px 17px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7 }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 650 }}>{s.label}</span>
              <span style={{ width: 31, height: 31, borderRadius: 10, display: "grid", placeItems: "center", color: s.color, background: s.color + "18" }}>{s.icon}</span>
            </div>
            <div className="headline" style={{ fontSize: 27, fontWeight: 850, marginTop: 9, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 4 }}>{s.note}</div>
          </div>
        ))}
      </div>

      <section>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 17 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 850, color: COLORS.textMuted }}>Explore recipient resources</div>
            <h2 className="headline" style={{ fontSize: 25, letterSpacing: -0.5, margin: "7px 0 0" }}>Blood Facilities &amp; Distribution Centers</h2>
          </div>
          <div className="facilities-section-pills" style={{ display: "flex", gap: 6, padding: 5, borderRadius: 15, background: "var(--secondary)", border: "1px solid var(--border)" }}>
            <button onClick={() => changeTab("banks")} style={tabPillBtnStyle(directoryTab === "banks")}>
              {directoryTab === "banks" && (
                <motion.span
                  layoutId="sectionDirPill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  style={{ position: "absolute", inset: 0, borderRadius: 11, background: `linear-gradient(135deg, ${COLORS.crimson}, ${COLORS.crimsonDeep})`, boxShadow: "0 8px 22px rgba(255,59,84,0.22)", border: "1px solid rgba(255,90,110,0.35)" }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Building2 size={14} /> Blood Banks <span>{banks.length}</span>
              </span>
            </button>
            <button onClick={() => changeTab("camps")} style={tabPillBtnStyle(directoryTab === "camps")}>
              {directoryTab === "camps" && (
                <motion.span
                  layoutId="sectionDirPill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  style={{ position: "absolute", inset: 0, borderRadius: 11, background: `linear-gradient(135deg, ${COLORS.crimson}, ${COLORS.crimsonDeep})`, boxShadow: "0 8px 22px rgba(255,59,84,0.22)", border: "1px solid rgba(255,90,110,0.35)" }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Calendar size={14} /> Distribution Drives <span>{camps.length}</span>
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 17 }}>
          <div style={{ position: "relative", flex: "1 1 245px", minWidth: 0 }}>
            <Search size={16} color={COLORS.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input aria-label={directoryTab === "camps" ? "Search donation camps" : "Search blood banks"} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={directoryTab === "camps" ? "Search camps, venues, cities…" : "Search banks, cities, states…"}
              style={{ ...field, padding: "11px 16px 11px 42px", minHeight: 44, borderRadius: 13 }} />
          </div>
          {directoryTab === "camps" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["upcoming", "Upcoming"], ["all", "All dates"], ["past", "Past"]].map(([key, label]) => <button key={key} onClick={() => setCampFilter(key)} style={{ ...buttonStyle(campFilter === key), padding: "10px 11px" }}>{label}</button>)}
          </div>}
          </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={directoryTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >

        {directoryTab === "camps" && (loading
          ? <div style={{ ...panel, padding: 34, textAlign: "center", color: COLORS.textMuted }}>Loading donation camps…</div>
          : filteredCamps.length === 0
            ? <div style={{ ...panel, padding: "40px 22px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 13px", display: "grid", placeItems: "center", color: COLORS.crimson, background: "rgba(255,59,84,0.1)" }}><Calendar size={23} /></div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{query ? "No camps match your search" : campFilter === "past" ? "No past camps to show" : "No donation camps listed yet"}</div>
                <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.7, maxWidth: 430, margin: "8px auto 0" }}>{query ? "Try another camp name, organizer or location." : "New community drives will appear here when they are added."}</p>
                {query && <button onClick={() => setQuery("")} style={{ ...buttonStyle(false), marginTop: 15 }}>Clear search</button>}
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }} className="grid2">
                {filteredCamps.map((c, i) => {
                  const date = dateValue(c.date);
                  const isPast = date && date < today;
                  const place = [c.location, c.city, c.state].filter(Boolean).join(", ");
                  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place || c.title || "");
                  return <motion.article key={c._id || c.title + i} whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }}
                    className="tile nearest-bank-card"
                    style={{ borderRadius: 18, color: "var(--foreground)", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div className="facilities-camp-inner" style={{ padding: 19, display: "flex", flexDirection: "column", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "6px 11px", fontSize: 11, letterSpacing: 0.7, fontWeight: 850, textTransform: "uppercase", color: isPast ? COLORS.textMuted : COLORS.good, background: isPast ? "var(--secondary)" : "rgba(52,211,153,0.1)", border: "1px solid " + (isPast ? "var(--border)" : "rgba(52,211,153,0.2)") }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPast ? COLORS.textMuted : COLORS.good }} /> {isPast ? "Completed" : "Upcoming drive"}
                          </span>
                          <h3 style={{ fontSize: 19, lineHeight: 1.35, margin: "12px 0 6px", fontWeight: 800, overflowWrap: "anywhere" }}>{c.title}</h3>
                          {c.organizer && <div style={{ fontSize: 14, color: COLORS.textMuted }}>Organized by {c.organizer}</div>}
                        </div>
                        <div style={{ width: 64, minWidth: 64, flexShrink: 0, borderRadius: 14, padding: "10px 6px", textAlign: "center", background: "rgba(255,59,84,0.09)", border: "1px solid rgba(255,59,84,0.16)" }}>
                          <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 850, color: COLORS.crimson }}>{date ? date.toLocaleDateString(undefined, { month: "short" }) : "TBD"}</div>
                          <div className="headline" style={{ fontSize: 25, lineHeight: 1.2, fontWeight: 850 }}>{date ? date.getDate() : "—"}</div>
                          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{date ? date.getFullYear() : "DATE"}</div>
                        </div>
                      </div>
                      <div style={{ height: 1, background: "var(--border)", margin: "16px 0 14px" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, color: COLORS.textMuted, fontSize: 14.5, lineHeight: 1.6 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><MapPin size={17} color={COLORS.cyan} style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ lineHeight: 1.55 }}>{place || "Venue details to be confirmed"}</span></div>
                        {c.contactPhone && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Phone size={16} color={COLORS.cyan} /><a href={"tel:" + String(c.contactPhone).replace(/[^\d+]/g, "")} style={{ color: COLORS.text, textDecoration: "none", fontWeight: 650 }}>{c.contactPhone}</a></div>}
                        {(c.startTime || c.endTime) && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Clock3 size={16} color={COLORS.cyan} /><span>{[c.startTime, c.endTime].filter(Boolean).join(" – ")}</span></div>}
                        {Number(c.expectedDonors) > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Users size={16} color={COLORS.cyan} /><span>Expected participants: {c.expectedDonors}</span></div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 20 }}>
                        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ ...buttonStyle(true), textDecoration: "none", flex: 1, fontSize: 14.5, padding: "11px 16px" }}><MapPin size={16} /> Get directions <ArrowRight size={15} /></a>
                        
                      </div>
                    </div>
                  </motion.article>;
                })}
              </div>)}

        {directoryTab === "banks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            {/* Filter Group 1: District Filter */}
            <div className="facilities-filter-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: COLORS.textMuted, marginRight: 4, letterSpacing: 0.8, textTransform: "uppercase" }}>
                District:
              </span>
              {DISTRICT_OPTIONS.map((d) => {
                const count = d === "ALL" ? banks.length : banks.filter(b => (b.district || b.city || "").toLowerCase() === d.toLowerCase()).length;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBankDistrictFilter(d)}
                    style={{
                      ...buttonStyle(bankDistrictFilter === d),
                      padding: "6px 11px",
                      fontSize: 12,
                      borderRadius: 10,
                    }}
                  >
                    {d === "ALL" ? `All Districts (${banks.length})` : `${d} (${count})`}
                  </button>
                );
              })}
            </div>

            {/* Filter Group 2: Type & Service Filter */}
            <div className="facilities-filter-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: COLORS.textMuted, marginRight: 4, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Type:
              </span>
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBankCategoryFilter(c.id)}
                  style={{
                    ...buttonStyle(bankCategoryFilter === c.id),
                    padding: "6px 11px",
                    fontSize: 12,
                    borderRadius: 10,
                  }}
                >
                  {c.label}
                </button>
              ))}

              <span className="hidden sm:inline-block" style={{ width: 1, height: 18, background: "var(--border)", margin: "0 6px" }} />

              <span style={{ fontSize: 11, fontWeight: 900, color: COLORS.textMuted, marginRight: 4, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Service:
              </span>
              {SERVICE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setBankServiceFilter(s.id)}
                  style={{
                    ...buttonStyle(bankServiceFilter === s.id),
                    padding: "6px 11px",
                    fontSize: 12,
                    borderRadius: 10,
                    background: bankServiceFilter === s.id
                      ? "linear-gradient(135deg, #0284c7, #0369a1)"
                      : "var(--secondary)",
                    borderColor: bankServiceFilter === s.id ? "#38bdf8" : "var(--border)",
                    color: bankServiceFilter === s.id ? "#ffffff" : "var(--foreground)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {directoryTab === "banks" && (banksLoading
          ? <div style={{ ...panel, padding: 34, textAlign: "center", color: COLORS.textMuted }}>Loading blood bank directory…</div>
          : filteredBanks.length === 0
            ? <div style={{ ...panel, padding: "40px 22px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 13px", display: "grid", placeItems: "center", color: COLORS.cyan, background: "rgba(34,211,238,0.1)" }}><Building2 size={23} /></div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{query || bankDistrictFilter !== "ALL" || bankCategoryFilter !== "ALL" ? "No blood banks match your filters" : "No blood banks listed yet"}</div>
                <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.7, maxWidth: 430, margin: "8px auto 0" }}>Try choosing "All Districts" or clearing search keywords.</p>
                {(query || bankDistrictFilter !== "ALL" || bankCategoryFilter !== "ALL" || bankServiceFilter !== "ALL") && (
                  <button
                    onClick={() => { setQuery(""); setBankDistrictFilter("ALL"); setBankCategoryFilter("ALL"); setBankServiceFilter("ALL"); }}
                    style={{ ...buttonStyle(false), marginTop: 15 }}
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }} className="grid2">
                {filteredBanks.map((b, i) => {
                  const place = [b.address, b.city, b.district, b.state].filter(Boolean).join(", ");
                  const mapsUrl = (b.lat != null && b.lng != null)
                    ? `https://www.google.com/maps/search/?api=1&query=${Number(b.lat).toFixed(6)},${Number(b.lng).toFixed(6)}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, place].filter(Boolean).join(" "))}`;
                  const phoneNumbers = String(b.phone || "").split(",").map(p => p.trim()).filter(Boolean);
                  const isStorage = (b.category || "").toLowerCase().includes("storage") || (b.facilityType || "").toLowerCase().includes("storage");
                  const isGov = (b.category || "").toLowerCase().includes("government");
                  const isRedCross = (b.category || "").toLowerCase().includes("red cross");
                  const isCharitable = (b.category || "").toLowerCase().includes("charitable");
                  const badgeColor = isRedCross ? COLORS.crimson : isGov ? COLORS.cyan : isCharitable ? COLORS.good : isStorage ? "#f59e0b" : "#a855f7";

                  return (
                    <motion.article key={b._id || b.name + i} whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }}
                      className="tile nearest-bank-card facilities-card"
                      style={{ borderRadius: 18, color: "var(--foreground)", padding: 20, display: "flex", flexDirection: "column", minWidth: 0, gap: 14 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 48, height: 48, minWidth: 48, borderRadius: 12, display: "grid", placeItems: "center", color: badgeColor, background: badgeColor + "18", border: "1px solid " + badgeColor + "33" }}>
                          <Building2 size={22} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 850, padding: "3px 8px", borderRadius: 6, background: badgeColor + "22", color: badgeColor, border: "1px solid " + badgeColor + "44", textTransform: "uppercase" }}>
                              {b.category || "Hospital Blood Bank"}
                            </span>
                            {b.district && (
                              <span style={{ fontSize: 10.5, fontWeight: 750, padding: "3px 8px", borderRadius: 6, background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                                📍 {b.district}
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, fontWeight: 750, padding: "3px 8px", borderRadius: 6, background: isStorage ? "rgba(245,158,11,0.15)" : "rgba(52,211,153,0.15)", color: isStorage ? "#fbbf24" : "#34d399" }}>
                              {isStorage ? "Need Blood Only (Issue)" : "Issue & Donation (Sec A & B)"}
                            </span>
                          </div>
                          <h3 style={{ fontSize: 17.5, lineHeight: 1.35, fontWeight: 800, margin: 0, color: "var(--foreground)", overflowWrap: "anywhere" }}>
                            {b.name}
                          </h3>
                          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                            {b.facilityType || "Blood Bank Facility"}
                          </div>
                        </div>
                        
                      </div>

                      {b.components && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--secondary)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)", display: "flex", gap: 6, alignItems: "center" }}>
                          <Droplet size={13} color={COLORS.crimson} style={{ flexShrink: 0 }} />
                          <span><strong>Components:</strong> {b.components}</span>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, color: COLORS.textMuted, fontSize: 13.5, lineHeight: 1.55 }}>
                        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                          <MapPin size={16} color={badgeColor} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{b.address || place || "Location not provided"}</span>
                        </div>
                        {phoneNumbers.length > 0 && (
                          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                            <Phone size={15} color={COLORS.good} style={{ flexShrink: 0 }} />
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {phoneNumbers.map((p, idx) => (
                                <a key={idx} href={"tel:" + p.replace(/[^\d+]/g, "")} style={{ color: "var(--foreground)", textDecoration: "none", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--secondary)", border: "1px solid var(--border)" }}>
                                  {p}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {b.email && (
                          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                            <Mail size={15} color={COLORS.cyan} style={{ flexShrink: 0 }} />
                            <a href={"mailto:" + b.email.split(",")[0].trim()} style={{ color: "#0284c7", textDecoration: "none", fontSize: 12.5, overflowWrap: "anywhere" }}>
                              {b.email}
                            </a>
                          </div>
                        )}
                        {b.openingHours && (
                          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                            <Clock3 size={15} color={COLORS.cyan} style={{ flexShrink: 0 }} />
                            <span>{b.openingHours}</span>
                          </div>
                        )}
                        {b.notes && (
                          <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 8 }}>
                            ℹ {b.notes}
                          </div>
                        )}
                      </div>

                      <div className="facilities-card-actions" style={{ marginTop: "auto", paddingTop: 14, display: "grid", gridTemplateColumns: phoneNumbers.length > 0 ? "1fr 1fr" : "1fr", gap: 8 }}>
                        {phoneNumbers.length > 0 && (
                          <a href={"tel:" + phoneNumbers[0].replace(/[^\d+]/g, "")} style={{ ...buttonStyle(false), textDecoration: "none", boxSizing: "border-box", fontSize: 13, padding: "9px 12px", background: "rgba(52,211,153,0.12)", color: "#10b981", borderColor: "rgba(52,211,153,0.3)" }}>
                            <Phone size={14} /> Call Direct
                          </a>
                        )}
                        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ ...buttonStyle(false), textDecoration: "none", boxSizing: "border-box", fontSize: 13, padding: "9px 12px" }}>
                          <MapPin size={14} /> Maps &amp; Directions
                        </a>
                      </div>
                    </motion.article>
                  );
                })}
              </div>)}
          </motion.div>
        </AnimatePresence>
      </section>

      
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "0 4px", color: COLORS.textMuted, fontSize: 11.5, lineHeight: 1.7 }}>
        <ShieldCheck size={15} color={COLORS.good} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Call the organizer or blood bank before travelling to confirm current hours, camp status, and availability. Directory listings are not a substitute for emergency medical care.</span>
      </div>
    </div>
  );
}


