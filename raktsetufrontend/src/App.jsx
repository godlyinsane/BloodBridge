import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MapPin, ShieldCheck, Bell, Users, Activity, Droplet,
  CheckCircle2, AlertTriangle, Send, Search, ArrowRight, Radio,
  Sparkles, Gauge, Clock3, UserCheck, ShieldAlert, Shield,
  Phone, MessageCircle, Share2, Calendar, Building2, Plus, Trash2, Timer,
  Lock, LogOut, Upload, FileText, XCircle, BellRing, ChevronRight, Info, Mail,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import DonorLocationsMap from "./DonorLocationsMap";
import InventoryView from "./InventoryView";
import EmergencyBanner from "./EmergencyBanner";
import P2PBloodListings from "./P2PBloodListings";
import NearestBloodBankMap from "./NearestBloodBankMap";

// =================================================================
// Backend connection — UNCHANGED business logic, same endpoints
// =================================================================
// Configure REACT_APP_API_BASE_URL for deployment (for example, https://api.example.com/api).
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

// Connection status is visible, but offline mode never pretends live matching works.
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
      Low-network mode: showing the cached app shell where available. Donor matching, requests, and live inventory need an internet connection.
    </div>
  );
}

// Fetches a protected file (e.g. a verification document) as a blob using the
// admin's auth token, then opens it in a new tab. A plain <a href> can't send
// an Authorization header, so this is the only way to view admin-only files.
async function openProtectedFile(path, token) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not open document.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const sanitizeIndianMobile = (value) => String(value || "").replace(/\D/g, "").slice(0, 10);
const isValidIndianMobile = (value) => /^[6-9]\d{9}$/.test(String(value || ""));


// Rare blood types — awareness info (all four), plus a real registration/matching
// track for the two truly rare phenotypes that need their own donor pool.
const RARE_BLOOD_TYPES = [
  { name: "Bombay Blood Group (hh)", rarity: "~1 in 4 million", note: "Lacks the H antigen present in all other groups; can only receive blood from other Bombay-group donors." },
  { name: "Rh-null (\"Golden Blood\")", rarity: "Fewer than 50 known donors worldwide", note: "Completely lacks all Rh antigens; can be given to almost anyone with Rh-related antibodies but is extremely hard to find." },
  { name: "AB- (rarest of the standard 8)", rarity: "~0.6% of the population", note: "Least common of the eight major groups; AB- donors are always in short supply." },
  { name: "O- (universal donor)", rarity: "~7% of the population", note: "Can donate to any blood group, making it constantly in high demand during emergencies." },
];

// Only these two need a dedicated donor pool — AB- and O- already register through
// the normal 8-group donor system above.
const RARE_GROUPS = ["Bombay Blood Group (hh)", "Rh-null (Golden Blood)"];

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Minimum safe gap between donations, per Indian national blood-centre guidelines
// (e-RaktKosh / Clinical Establishments rules): men every 90 days, women every 120 days.
const MIN_GAP_DAYS = { Male: 90, Female: 120, Other: 120 };
function minGapDays(gender) { return MIN_GAP_DAYS[gender] || 90; }
function daysUntilEligible(gender, lastDonation) {
  return Math.max(0, minGapDays(gender) - daysSince(lastDonation));
}
function eligibilityProgress(gender, lastDonation) {
  const gap = minGapDays(gender);
  return Math.min(100, Math.round((daysSince(lastDonation) / gap) * 100));
}

// Purely visual composite score for the matching animation — does not alter
// the real ranking, which already comes sorted by distance from the backend.
function visualMatchScore(distanceKm, urgency) {
  const radius = urgency === "High" ? 25 : 10;
  const proximity = Math.max(0, 1 - distanceKm / radius);
  return Math.round(72 + proximity * 27);
}

// =================================================================
// Design tokens
// =================================================================
const COLORS = {
  bg: "#0A0B0E",
  bg2: "#101216",
  panel: "rgba(255,255,255,0.045)",
  panelBorder: "rgba(255,255,255,0.09)",
  crimson: "#FF3B54",
  crimsonDeep: "#B3202A",
  cyan: "#22D3EE",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  good: "#34D399",
  warn: "#FBBF24",
};

const glassCard = {
  background: "rgba(20, 22, 28, 0.7)",
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 18,
};

const glowBtn = {
  background: `linear-gradient(135deg, ${COLORS.crimson}, ${COLORS.crimsonDeep})`,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "13px 24px",
  fontSize: 14.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "0 8px 30px rgba(255,59,84,0.35)",
};

const ghostBtn = {
  background: "rgba(255,255,255,0.04)",
  color: COLORS.text,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 12,
  padding: "12px 22px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${COLORS.panelBorder}`,
  fontSize: 14.5,
  fontFamily: "Inter, sans-serif",
  color: COLORS.text,
  background: "rgba(255,255,255,0.03)",
  boxSizing: "border-box",
  outline: "none",
};

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
    neutral: { bg: "rgba(255,255,255,0.06)", fg: COLORS.textMuted },
    good: { bg: "rgba(52,211,153,0.12)", fg: COLORS.good },
    warn: { bg: "rgba(255,59,84,0.12)", fg: COLORS.crimson },
    info: { bg: "rgba(34,211,238,0.12)", fg: COLORS.cyan },
  };
  const t = tones[tone];
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 11.5, fontWeight: 700,
      padding: "4px 11px", borderRadius: 20, letterSpacing: 0.3, whiteSpace: "nowrap",
      border: `1px solid ${t.fg}22`,
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
// Main component
// =================================================================
export default function BloodBridgeApp() {
  const [tab, setTab] = useState("home");
  useEffect(()=>{if(tab!=="requests")return;const timer=window.setTimeout(()=>{document.getElementById("blood-request-sos")?.scrollIntoView({behavior:"smooth",block:"start"});},140);return()=>window.clearTimeout(timer);},[tab]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("raktmitra-theme") || "dark");
  const toggleTheme = () => setTheme((current) => {
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("raktmitra-theme", next);
    return next;
  });
  const [donors, setDonors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("raktsetu_admin_token"));
  const [adminUsername, setAdminUsername] = useState(() => localStorage.getItem("raktsetu_admin_user"));

  const loginAdmin = (token, username) => {
    localStorage.setItem("raktsetu_admin_token", token);
    localStorage.setItem("raktsetu_admin_user", username);
    setAdminToken(token);
    setAdminUsername(username);
  };
  const logoutAdmin = () => {
    localStorage.removeItem("raktsetu_admin_token");
    localStorage.removeItem("raktsetu_admin_user");
    setAdminToken(null);
    setAdminUsername(null);
  };

  const notify = useCallback((msg) => {
    if (!msg || typeof msg !== "string") return;
    // Suppress repeated background network/fetch failure popups
    if (/failed to fetch|networkerror|load failed|offline|timeout/i.test(msg)) {
      console.warn("Network notice suppressed:", msg);
      return;
    }
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const donorPath = adminToken ? "/donors" : "/donors/public";
      const requestPath = adminToken ? "/requests" : "/requests/public";
      const [d, r] = await Promise.all([api(donorPath, {}, adminToken), api(requestPath, {}, adminToken)]);
      setDonors(d);
      setRequests(r);
      setLoadError(false);
    } catch {
      // Gracefully fallback to empty lists if the backend server is offline
      setDonors([]);
      setRequests([]);
      setLoadError(false);
    }
  }, [adminToken]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const fontImport = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

      * { box-sizing: border-box; }
      body, html {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Plus Jakarta Sans", "SF Pro", "San Francisco", "Segoe UI", Roboto, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      h1, h2, h3, h4, h5, h6, .headline, strong, b {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", "SF Pro", "San Francisco", sans-serif !important;
        font-weight: 800 !important;
        letter-spacing: -0.035em;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      h1, .headline.hero-title {
        font-weight: 900 !important;
        letter-spacing: -0.04em;
      }
      body {
        font-size: 16px;
      }
      p {
        line-height: 1.7;
        font-weight: 450;
        letter-spacing: -0.01em;
      }
      .navbtn {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", sans-serif !important;
        font-size: 15px !important;
        font-weight: 700 !important;
        letter-spacing: -0.015em;
      }
      input:focus, select:focus { border-color: ${COLORS.cyan} !important; box-shadow: 0 0 0 3px rgba(34,211,238,0.15); }
      table { border-collapse: collapse; width: 100%; }
      th, td { text-align: left; padding: 12px 14px; font-size: 13px; }
      th { color: ${COLORS.textMuted}; font-weight: 600; border-bottom: 1px solid ${COLORS.panelBorder}; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
      td { border-bottom: 1px solid rgba(255,255,255,0.05); color: ${COLORS.text}; }
      .navbtn { background:none; border:none; cursor:pointer; font-size:14px; font-weight:600;
                padding:9px 4px; color:${COLORS.textMuted}; position: relative; transition: color 0.18s ease; }
      @media (hover: hover) and (pointer: fine) {
        .navbtn:hover { color: #fff; }
      }
      @media (hover: none), (pointer: coarse) {
        .navbtn:hover { color: inherit; }
      }
      @media print {
        body * { visibility: hidden !important; }
        .raktsetu-qr-dialog, .raktsetu-qr-dialog * { visibility: visible !important; }
        .raktsetu-qr-dialog { position: fixed !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; background: #fff !important; }
        .raktsetu-qr-dialog button { display: none !important; }
      }
      .navbtn.active { color: #fff; }
      .nav-account, .nav-theme { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:40px; padding:10px 13px; border-radius:12px; font-size:12px; font-weight:750; white-space:nowrap; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
      .nav-account:hover, .nav-theme:hover { transform:translateY(-1px); }
      .nav-account.primary { border:1px solid #c92d45; color:#fff; background:linear-gradient(135deg,#d83a50,#a91e35); box-shadow:0 7px 20px rgba(190,35,60,.2); }
      .nav-account.secondary:hover, .nav-theme:hover { background:rgba(180,40,60,.08) !important; }
      .nav-theme { border:1px solid ${COLORS.panelBorder}; background:transparent; color:${COLORS.text}; }
      .theme-light .nav-theme { border-color:#d0d5dd; color:#344054; }
      .theme-light .navbtn.active { color:#a51d32 !important; }
      .theme-light .navbtn.active::after { background:linear-gradient(90deg,#c72d45,#ef8a99); }
      @media (max-width: 1100px) {
        .raktsetu-topbar-inner { gap:10px !important; }
        .raktsetu-nav { order:3; flex:1 0 100% !important; justify-content:flex-start !important; overflow-x:auto; }
        .raktmitra-account-actions { margin-left:auto; }
      }
      @media (max-width: 680px) {
        .raktsetu-topbar-inner { padding:10px 12px !important; align-items:center !important; }
        .raktsetu-topbar-inner > div:first-child { flex:1 1 auto !important; min-width:0; }
        .raktmitra-menu-toggle { display:inline-flex !important; }
        .raktsetu-nav, .raktmitra-account-actions { display:none !important; }
        .raktsetu-topbar.mobile-menu-open .raktsetu-nav { display:flex !important; order:3; flex:1 0 100% !important; flex-direction:column; align-items:stretch !important; gap:0 !important; padding:8px 0 !important; border-top:1px solid rgba(255,255,255,.09); }
        .raktsetu-topbar.mobile-menu-open .raktsetu-nav .navbtn { text-align:left; padding:15px 16px !important; border-radius:0; border-bottom:1px solid rgba(255,255,255,.05); font-size:15px !important; min-height:56px; }
        .raktsetu-topbar.mobile-menu-open .raktsetu-nav .navbtn.active::after { display:none; }
        .raktsetu-topbar.mobile-menu-open .raktmitra-account-actions { display:grid !important; order:4; flex:1 0 100%; grid-template-columns:1fr; width:100%; gap:9px !important; padding:10px 0 5px; }
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
      .raktsetu-nav { scrollbar-width: none; }
      .raktsetu-nav::-webkit-scrollbar { display: none; }
      @media (max-width: 900px) {
        .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .raktsetu-topbar { overflow-x: clip; }
        .raktsetu-topbar-inner { width: 100%; max-width: 100vw !important; box-sizing: border-box; padding: 12px 14px !important; gap: 10px !important; align-items: stretch !important; }
        .raktsetu-topbar-inner > div:first-child { flex: 1 0 100%; min-width: 0; }
        .raktsetu-nav { flex: 1 1 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }
        .raktsetu-content { width: 100%; max-width: 100vw !important; box-sizing: border-box; overflow-x: clip; }
        .raktsetu-topbar-inner > div:first-child .headline { font-size: 20px !important; }
        .raktsetu-topbar-inner > div:first-child div:last-child { font-size: 9px !important; letter-spacing: .25px !important; }
        .raktsetu-nav { width: 100%; gap: 18px !important; padding: 4px 0 8px; margin: 0; }
        .navbtn { flex: 0 0 auto; font-size: 13px !important; padding: 9px 1px !important; min-height: 40px; white-space: nowrap; }
        .navbtn.active::after { bottom: 0; }
        .raktsetu-content { padding: 22px 14px 40px !important; }
        .raktsetu-content h1 { font-size: clamp(28px, 8vw, 38px) !important; line-height: 1.12 !important; overflow-wrap: anywhere; }
        .raktsetu-content h2 { overflow-wrap: anywhere; }
        .raktsetu-content input, .raktsetu-content select, .raktsetu-content textarea { min-width: 0; max-width: 100%; font-size: 16px !important; }
        .raktsetu-content button { min-height: 42px; max-width: 100%; }
        .raktsetu-content table { min-width: 680px; }
        .raktsetu-content [style*="grid-template-columns"] { min-width: 0; }
        .raktsetu-content [style*="gap: 26px"] { gap: 14px !important; }
        .raktsetu-content [style*="padding: 40px 24px 70px"] { padding: 22px 14px 40px !important; }
        .raktsetu-content [style*="font-size: 52px"] { font-size: clamp(34px, 10vw, 48px) !important; }
        .raktsetu-content [style*="min-height: 480px"] { min-height: 320px !important; }
        .raktsetu-content [style*="border-radius: 18px"] { border-radius: 14px !important; }
        .raktsetu-content [style*="padding: 22px 24px"] { padding: 18px 16px !important; }
        .raktsetu-content [style*="padding: 28px 32px"] { padding: 20px 16px !important; }
        .raktsetu-content .bc-wrap { min-height: 250px; border-radius: 14px; }
      }

      /* Mobile-first layout repairs for the Home and Recipient screens. */
      @media (max-width: 680px) {
        .raktsetu-content, .raktsetu-content * { min-width: 0; }
        .raktsetu-content p, .raktsetu-content label, .raktsetu-content h1,
        .raktsetu-content h2, .raktsetu-content h3, .raktsetu-content span,
        .raktsetu-content button, .raktsetu-content a {
          overflow-wrap: break-word; word-break: normal; hyphens: auto;
        }
        .raktsetu-content .home-hero {
          grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important;
          min-height: 0 !important; align-items: start !important; margin-bottom: 24px !important;
        }
        .raktsetu-content .home-hero > div:first-child { left: -14px !important; right: -14px !important; }
        .raktsetu-content .home-hero h1 {
          font-size: clamp(31px, 9vw, 39px) !important; line-height: 1.12 !important; letter-spacing: -0.8px;
        }
        .raktsetu-content .home-hero h1 br { display: none; }
        .raktsetu-content .home-hero p { font-size: 14.5px !important; line-height: 1.75 !important; max-width: none !important; }
        .raktsetu-content .home-hero > div:nth-of-type(3) {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important;
        }
        .raktsetu-content .home-hero button {
          white-space: normal; line-height: 1.35; justify-content: center;
          padding: 12px 13px !important; font-size: 13px !important;
        }
        .raktsetu-content .recipient-layout {
          grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important; align-items: start;
        }
        .raktsetu-content .recipient-layout > div { width: 100%; min-width: 0; }
        .raktsetu-content .recipient-layout form > label > div[style*="display: flex"] { flex-wrap: wrap !important; }
        .raktsetu-content .recipient-layout form > label > div[style*="display: flex"] > input {
          flex: 1 1 125px; width: 100%;
        }
        .raktsetu-content .recipient-layout button, .raktsetu-content .recipient-layout a {
          white-space: normal; line-height: 1.35;
        }
        .raktsetu-content .recipient-layout [style*="grid-template-columns: 1fr auto"] {
          grid-template-columns: minmax(0, 1fr) !important; align-items: start !important; gap: 12px !important;
        }
        .raktsetu-content .recipient-layout [style*="text-align: right"] {
          align-items: flex-start !important; text-align: left !important;
        }
        .raktsetu-content .recipient-layout .raktsetu-map, .raktsetu-content .recipient-layout iframe { max-width: 100%; }
      }
      @media (max-width: 390px) {
        .grid2 { grid-template-columns: 1fr !important; }
        .raktsetu-nav { gap: 15px !important; }
        .navbtn { font-size: 12.5px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
      }
    `}</style>
  );

  const isAdminRoute = window.location.pathname.split("/").filter(Boolean).join("/") === "admin";

  // Keep the admin dashboard on its own URL, outside the public navigation.
  if (isAdminRoute) {
    return (
      <div style={{ fontFamily: "Inter, -apple-system, sans-serif", minHeight: "100vh", color: COLORS.text, background: COLORS.bg }}>
        {fontImport}
        <NetworkStatusBanner />
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 70px" }}>
          <div style={{ marginBottom: 24 }}>
            <a href="/" style={{ color: COLORS.textMuted, textDecoration: "none", fontSize: 13 }}>← Back to BloodBridge</a>
          </div>
          <AdminView
            donors={donors} requests={requests} notify={notify} refreshAll={refreshAll}
            adminToken={adminToken} adminUsername={adminUsername}
            onLogin={loginAdmin} onLogout={logoutAdmin}
          />
        </div>
        {toast && (
          <div role="status" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", ...glassCard, padding: "14px 22px", zIndex: 50 }}>
            <Bell size={16} color={COLORS.crimson} style={{ verticalAlign: -3, marginRight: 8 }} />{toast}
          </div>
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center",
                     justifyContent: "center", fontFamily: "Inter, sans-serif", color: COLORS.text }}>
        {fontImport}
        <Card style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🔌</div>
          <h2 className="headline" style={{ marginBottom: 8 }}>Can't reach the backend</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.6 }}>
            Make sure your Node/Express server is running at <code>{API_BASE}</code>, then reload.
          </p>
          <button style={{ ...glowBtn, marginTop: 16 }} onClick={refreshAll}>Try again</button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "Inter, -apple-system, sans-serif", minHeight: "100vh", color: COLORS.text,
      background: `radial-gradient(1200px 600px at 15% -10%, rgba(255,59,84,0.10), transparent 60%),
                   radial-gradient(1000px 500px at 90% 0%, rgba(34,211,238,0.08), transparent 60%),
                   ${COLORS.bg}`,
    }}>
      {fontImport}
      <NetworkStatusBanner />
      <EmergencyBanner
        apiBase={API_BASE}
        onFindNearestBank={() => {
          setTab("nearest");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Responsive BloodBridge navigation */}
      <div className={`raktsetu-topbar ${theme === "light" ? "theme-light" : "theme-dark"} ${mobileMenuOpen ? "mobile-menu-open" : ""}`} data-theme={theme} style={{ borderBottom: `1px solid ${theme === "light" ? "#e5e7eb" : COLORS.panelBorder}`, position: "sticky", top: 0, zIndex: 20, background: theme === "light" ? "#ffffff" : "#0d0f14" }}>
        <div className="raktsetu-topbar-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <button aria-label="BloodBridge home" onClick={() => { setTab("home"); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: 0, border: 0, background: "transparent", color: theme === "light" ? "#171923" : "#fff", cursor: "pointer", textAlign: "left" }}>
            <img src="/raktmitra-logo.svg" alt="BloodBridge logo" width="42" height="42" style={{ display: "block", objectFit: "contain", flexShrink: 0 }} />
            <span><span className="headline" style={{ display: "block", fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>BloodBridge</span><span style={{ display: "block", fontSize: 9.5, color: theme === "light" ? "#667085" : COLORS.textMuted, letterSpacing: .45, marginTop: 4 }}>BLOOD DONOR NETWORK</span></span>
          </button>
          <button type="button" className="raktmitra-menu-toggle" aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)} style={{ display:"none", alignItems:"center", justifyContent:"center", width:44, height:44, borderRadius:12, border:`1px solid ${theme === "light" ? "#d0d5dd" : COLORS.panelBorder}`, color:theme === "light"?"#344054":"#fff", background:"transparent", cursor:"pointer", flexShrink:0 }}><span style={{fontSize:25,lineHeight:1}}>{mobileMenuOpen ? "×" : "☰"}</span></button>
          <nav className="raktsetu-nav" aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: 20, flex: "1 1 auto", justifyContent: "center", minWidth: 0 }}>
            {[[ "home", "Home" ], [ "camps", "Blood Facilities (Need Blood)" ], [ "nearest", "Nearest Blood Bank" ]].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`navbtn ${tab === k ? "active" : ""}`}
                onClick={() => { setTab(k); setMobileMenuOpen(false); }}
                style={{
                  background: "transparent",
                  border: 0,
                  color: theme === "light" ? (tab === k ? "#a51d32" : "#4b5563") : undefined,
                  touchAction: "manipulation",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="raktsetu-content" style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 70px", position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {tab === "home" && <Home donors={donors} requests={requests} goTo={setTab} />}
            {tab === "available" && <P2PBloodListings apiBase={API_BASE} notify={notify} />}
            {tab === "nearest" && <NearestBloodBankMap apiBase={API_BASE} notify={notify} />}
            {tab === "donor" && <DonorView notify={notify} />}
            {tab === "bloodbank" && <BloodBankPortal notify={notify} />}
            {tab === "rare" && <RareDonorView notify={notify} />}
            
            {tab === "requests" && <RequestsBoard notify={notify} requests={requests} refreshAll={refreshAll} />}
            {tab === "inventory" && <InventoryView theme={theme} />}
            {tab === "camps" && <CampsAndBanksView notify={notify} adminToken={adminToken} goTo={setTab} />}
            {tab === "services" && <FeatureHubPanel notify={notify} />}
            {tab === "about" && <BloodBridgeInfoPage page="about" theme={theme} goTo={setTab} />}
            {tab === "privacy" && <BloodBridgeInfoPage page="privacy" theme={theme} goTo={setTab} />}
            {tab === "terms" && <BloodBridgeInfoPage page="terms" theme={theme} goTo={setTab} />}

          </motion.div>
        </AnimatePresence>
      </div>

      {tab !== "admin" && (
        <footer aria-label="BloodBridge site footer" style={{
          background: theme === "light" ? "#f5f7fa" : "linear-gradient(145deg,#10141b 0%,#090b10 100%)",
          color: theme === "light" ? "#17202b" : "#f3f4f6",
          borderTop: "1px solid " + (theme === "light" ? "#e1e5eb" : "rgba(255,255,255,.1)"),
          borderBottom: "3px solid " + COLORS.cyan,
          padding: "42px 24px 18px",
          marginTop: 12
        }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))", gap: "34px 42px", alignItems: "start" }}>
              <div>
                <button aria-label="BloodBridge home" onClick={() => { setTab("home"); window.scrollTo({top:0,behavior:"smooth"}); }}
                  style={{ display:"inline-flex",alignItems:"center",gap:10,border:0,padding:0,background:"transparent",color:"inherit",cursor:"pointer",marginBottom:14 }}>
                  <img src="/raktmitra-logo.svg" alt="" width="38" height="38" style={{objectFit:"contain"}} />
                  <span className="headline" style={{fontSize:23,fontWeight:700,letterSpacing:-.5}}>Blood<span style={{color:COLORS.crimson}}>Bridge</span></span>
                </button>
                <p style={{fontSize:13,lineHeight:1.8,color:theme==="light"?"#596474":"#a8b0bd",margin:"0 0 18px",maxWidth:310}}>
                  Connecting blood donors, recipients and blood banks to help people find the blood they need, when it matters most.
                </p>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11.5,fontWeight:700,color:theme==="light"?"#a51d32":"#ff8a9a",background:theme==="light"?"#fff0f2":"rgba(255,59,84,.09)",border:"1px solid "+(theme==="light"?"#f4cbd2":"rgba(255,59,84,.22)"),borderRadius:30,padding:"7px 11px"}}>
                  <Heart size={13} fill="currentColor" /> Every donation can make a difference
                </div>
              </div>

              <div>
                <h3 style={{fontSize:12,fontWeight:800,letterSpacing:1.1,textTransform:"uppercase",margin:"5px 0 17px"}}>Quick links</h3>
                <div style={{display:"grid",gap:12}}>
                  {[
                    ["Home","home"],
                    ["Emergency Requests","requests"],["Camps & Blood Banks","camps"],["Features","services"]
                  ].map(([label,destination])=>(
                    <button key={label} onClick={()=>{setTab(destination);window.scrollTo({top:0,behavior:"smooth"});}}
                      style={{display:"block",width:"fit-content",border:0,padding:0,background:"transparent",color:theme==="light"?"#4b5563":"#c5cbd4",fontSize:13,textAlign:"left",cursor:"pointer",transition:"color .18s"}}>
                      <span style={{color:COLORS.crimson,marginRight:8}}>›</span>{label}
                    </button>
                  ))}
                </div>
              </div>



              <div>
                <h3 style={{fontSize:12,fontWeight:800,letterSpacing:1.1,textTransform:"uppercase",margin:"5px 0 17px"}}>Contact us</h3>
                <div style={{display:"grid",gap:15,fontSize:13}}>
                  <a href="mailto:support.bloodbridge@gmail.com" style={{display:"flex",gap:10,alignItems:"flex-start",color:"inherit",textDecoration:"none",overflowWrap:"anywhere"}}>
                    <MessageCircle size={17} color={COLORS.crimson} style={{flexShrink:0,marginTop:1}} />
                    <span><span style={{display:"block",fontWeight:700,marginBottom:4}}>Email support</span><span style={{color:theme==="light"?"#596474":"#a8b0bd"}}>support.bloodbridge@gmail.com</span></span>
                  </a>
                  <a href="tel:+919132450XXX" style={{display:"flex",gap:10,alignItems:"flex-start",color:"inherit",textDecoration:"none"}}>
                    <Phone size={17} color={COLORS.crimson} style={{flexShrink:0,marginTop:1}} />
                    <span><span style={{display:"block",fontWeight:700,marginBottom:4}}>Mobile</span><span style={{color:theme==="light"?"#596474":"#a8b0bd"}}>+91 9132450XXX</span></span>
                  </a>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <MapPin size={17} color={COLORS.crimson} style={{flexShrink:0,marginTop:1}} />
                    <span><span style={{display:"block",fontWeight:700,marginBottom:4}}>Location</span><span style={{color:theme==="light"?"#596474":"#a8b0bd"}}>VIT Bhopal University, MP</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",borderTop:"1px solid "+(theme==="light"?"#e1e5eb":"rgba(255,255,255,.1)"),marginTop:34,paddingTop:18}}>
              <span style={{fontSize:11.5,color:theme==="light"?"#737d8b":"#8e98a7"}}>© {new Date().getFullYear()} BloodBridge · Made by Priyansh Bhatt for EPICS. Built with <span style={{color:COLORS.crimson}}>♥</span> to help save lives.</span>
              <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                {[["About Us","about"],["Privacy Policy","privacy"],["Terms & Conditions","terms"]].map(([label,destination])=>(
                  <button key={label} onClick={()=>{setTab(destination);window.scrollTo({top:0,behavior:"smooth"});}}
                    style={{border:0,padding:0,background:"transparent",color:theme==="light"?"#596474":"#a8b0bd",fontSize:11.5,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </div>
            <p style={{fontSize:10.5,lineHeight:1.6,textAlign:"center",color:theme==="light"?"#87909c":"#737d8b",margin:"13px 0 0"}}>
              BloodBridge is a technology platform and does not replace medical advice or professional blood-bank screening.
            </p>
          </div>
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
  const ink = light ? "#182230" : "#f4f6f9";
  const muted = light ? "#596474" : "#a8b0bd";
  const panel = light ? "#ffffff" : "#121821";
  const line = light ? "#e4e7ec" : "rgba(255,255,255,.1)";
  const red = "#c43d50";
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
        <section style={{ background: "linear-gradient(120deg,#9f2033,#e75b4d)", color: "#fff", borderRadius: 18, padding: "clamp(24px,5vw,44px)", marginBottom: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", opacity: .85, marginBottom: 10 }}>RAKTMITRA · INFORMATION</div>
          <h1 style={{ fontSize: "clamp(28px,4vw,38px)", lineHeight: 1.15, margin: "0 0 12px" }}>{content.title}</h1>
          <p style={{ maxWidth: 760, margin: 0, lineHeight: 1.8, fontSize: 15, color: "rgba(255,255,255,.9)" }}>{content.subtitle}</p>
        </section>
      )}
      {page === "about" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18, marginBottom: 26 }}>
          <section style={sectionStyle}>
            <div style={{ color: red, fontSize: 22, marginBottom: 12 }}>◎</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 19 }}>Our Mission</h2>
            <p style={paraStyle}>Make it easier for people to discover donor and blood-bank information, explore available support, and connect during a time-sensitive need. We aim to make the search process clearer and more accessible.</p>
          </section>
          <section style={sectionStyle}>
            <div style={{ color: red, fontSize: 22, marginBottom: 12 }}>♡</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 19 }}>Our Story</h2>
            <p style={paraStyle}>BloodBridge is an end-semester academic project created to explore how web technology can support blood-donation awareness and help connect donors, recipients, and blood-bank information in one place.</p>
          </section>
        </div>
        <h2 style={{ textAlign: "center", fontSize: 27, color: red, margin: "30px 0 18px" }}>Our Values</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 30 }}>
          {[
            ["Compassion","Treat every request with empathy and respect."],
            ["Trust & Responsibility","Present information clearly and encourage responsible use."],
            ["Community","Support collaboration among donors, recipients and blood banks."],
            ["Accessibility","Keep key discovery features straightforward and easy to navigate."]
          ].map(([title,desc])=><section key={title} style={{...sectionStyle,textAlign:"center",padding:"23px 18px"}}>
            <div style={{color:red,fontSize:22,marginBottom:10}}>{title==="Compassion"?"♡":title==="Community"?"♧":title==="Accessibility"?"◎":"◇"}</div>
            <h3 style={{fontSize:15,margin:"0 0 8px"}}>{title}</h3><p style={{...paraStyle,fontSize:13,margin:0}}>{desc}</p>
          </section>)}
        </div>
        <section style={{...sectionStyle,textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",borderRadius:999,background:"rgba(255,59,84,0.12)",border:"1px solid rgba(255,59,84,0.28)",color:"#ff7085",fontSize:12,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>
            EPICS PROJECT · VIT BHOPAL UNIVERSITY
          </div>
          <h2 style={{fontSize:26,color:red,margin:"0 0 8px"}}>Made by Priyansh Bhatt for EPICS</h2>
          <p style={paraStyle}>Engineering Projects in Community Service (EPICS) · VIT Bhopal University</p>
          <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:12,marginTop:20}}>
            <span style={{border:"1px solid "+(light?"#edc7cc":"rgba(255,130,145,.38)"),background:light?"#fff4f5":"rgba(196,61,80,.16)",color:light?"#a62c40":"#ff9aaa",borderRadius:30,padding:"12px 28px",fontWeight:800,fontSize:15}}>
              Priyansh Bhatt (Lead Developer &amp; Researcher)
            </span>
          </div>
        </section>
      </>}
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
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:24}}>
        <button onClick={()=>{goTo("home");window.scrollTo({top:0,behavior:"smooth"});}} style={{border:0,borderRadius:10,background:red,color:"#fff",fontWeight:750,padding:"12px 18px",cursor:"pointer"}}>Back to Home</button>
        {page!=="about"&&<button onClick={()=>goTo("about")} style={{border:"1px solid "+line,borderRadius:10,background:"transparent",color:ink,fontWeight:700,padding:"12px 18px",cursor:"pointer"}}>About BloodBridge</button>}
      </div>
    </div>
  );
}

// =================================================================
// HOME
// =================================================================
// =================================================================
function Home({ donors, requests, goTo }) {
  const verified = donors.filter((d) => d.verified).length;
  const available = donors.filter((d) => d.available && d.verified).length;
  const open = requests.filter((r) => r.status === "Open" || r.status === "Matched").length;
  const fulfilled = requests.filter((r) => r.status === "Fulfilled" || r.status === "Completed").length;
    const [showDonorMap, setShowDonorMap] = useState(false);
  const groupCounts = useMemo(() => {
    const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]));
    donors.forEach((d) => { if (counts[d.group] !== undefined) counts[d.group]++; });
    return GROUPS.map((g) => ({ group: g, count: counts[g] }));
  }, [donors]);

  const mapDonors = donors.filter((d) => {
    const lat = Number(d.lat), lng = Number(d.lng);
    return d.available && d.verified && d.lat != null && d.lng != null &&
      Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
      Number.isFinite(lng) && lng >= -180 && lng <= 180;
  });
  const mapCenter = mapDonors.length
    ? { lat: Math.round(Number(mapDonors[0].lat) * 100) / 100, lng: Math.round(Number(mapDonors[0].lng) * 100) / 100 }
    : null;

  const quickActions = [
    { icon: <Building2 size={21} />, title: "Need Blood? Explore Facilities", description: "Explore verified hospitals, government blood banks, and emergency facility contacts.", action: () => goTo("camps"), tone: COLORS.crimson, tag: "Need Blood", label: "Find facilities" },
    { icon: <MapPin size={21} />, title: "Nearest Blood Bank", description: "Find the closest blood bank with Google Maps turn-by-turn navigation.", action: () => goTo("nearest"), tone: "#0ea5e9", tag: "Live GPS", label: "Locate bank" },
    { icon: <Info size={21} />, title: "About Us", description: "Learn about the BloodBridge network, mission, and community values.", action: () => goTo("about"), tone: "#818cf8", tag: "Network", label: "About BloodBridge" },
  ];

  return (
    <div className="rakt-home">
      <style>{`
        .rakt-home .home-hero { isolation:isolate; }
        .rakt-home .hero-copy { min-width:0; }
        .rakt-home .hero-title { font-size:clamp(2.15rem,4.5vw,3.7rem); line-height:1.06; letter-spacing:-1.8px; }
        .rakt-home .hero-actions { display:flex; gap:12px; margin-top:26px; flex-wrap:wrap; }
        .rakt-home .home-section { margin-top:48px; }
        .rakt-home .quick-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
        .rakt-home .quick-card-inner {
          min-height: 220px;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          padding: 22px 20px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12), 0 8px 24px -8px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .rakt-home .quick-card-inner:hover {
            border-color: var(--card-tone-border, rgba(255, 255, 255, 0.25));
            box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 0 25px -4px var(--card-tone-glow, rgba(255, 255, 255, 0.15)), 0 12px 28px -8px rgba(0, 0, 0, 0.6);
          }
        }
        @media (hover: none), (pointer: coarse) {
          .rakt-home .quick-card-inner {
            transform: none !important;
          }
          .rakt-home .quick-card-inner:active {
            border-color: var(--card-tone-border, rgba(255, 255, 255, 0.2));
          }
        }
        .rakt-home .quick-action-btn {
          transition: filter 0.2s ease, box-shadow 0.2s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        @media (hover: hover) and (pointer: fine) {
          .rakt-home .quick-action-btn:hover {
            filter: brightness(1.2);
            box-shadow: 0 0 16px var(--card-tone-glow, rgba(255, 255, 255, 0.25));
          }
        }
        @media (hover: none), (pointer: coarse) {
          .rakt-home .quick-action-btn:active {
            filter: brightness(0.95);
          }
        }
        .rakt-home .how-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
        .rakt-home .section-heading { font-size:clamp(1.4rem,2.4vw,2rem); line-height:1.2; margin:0 0 8px; }
        .rakt-home .section-subtitle { color:${COLORS.textMuted}; font-size:14px; line-height:1.7; margin:0 0 20px; max-width:680px; }
        .rakt-home .quick-card { min-width:0; height:100%; display:flex; flex-direction:column; }
        .rakt-home .quick-card button { margin-top:auto; align-self:flex-start; }
        .rakt-home .blood-groups { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:9px; }
        .rakt-home .blood-group { text-align:center; border:1px solid ${COLORS.panelBorder}; border-radius:12px; padding:13px 5px; background:rgba(255,255,255,.035); }
        .rakt-home .blood-group strong { display:block; font-size:18px; color:#ff7d90; margin-bottom:4px; }
        .rakt-home .blood-group span { font-size:11px; color:${COLORS.textMuted}; }
        .rakt-home .step-number { width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:rgba(255,59,84,.12);color:#ff7d90;font-weight:800;margin-bottom:14px; }
        @media(max-width:900px) {
          .rakt-home .home-hero { grid-template-columns:1fr !important; gap:24px !important; padding-top:18px; }
          .rakt-home .quick-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .rakt-home .blood-groups { grid-template-columns:repeat(4,minmax(0,1fr)); }
        }
        @media(max-width:560px) {
          .rakt-home .home-hero { min-height:unset !important; }
          .rakt-home .hero-title { letter-spacing:-1px; }
          .rakt-home .hero-actions { display:grid; grid-template-columns:1fr; }
          .rakt-home .hero-actions button { width:100%; justify-content:center; }
          .rakt-home .hero-stats { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:10px !important; }
          .rakt-home .quick-grid,.rakt-home .how-grid { grid-template-columns:1fr; }
          .rakt-home .home-section { margin-top:36px; }
        }
      `}</style>

      <section className="home-hero grid2" style={{ position:"relative", minHeight:500, display:"grid", gridTemplateColumns:"1.15fr .85fr", gap:34, alignItems:"center", marginBottom:16, padding:"12px 0 28px" }}>
        <div style={{ position:"absolute", top:-28, bottom:0, left:"-30vw", right:"-30vw", zIndex:-1, pointerEvents:"none", opacity:.45, borderRadius:20, overflow:"hidden" }}><BloodCellsAnimation /></div>
        <motion.div className="hero-copy" initial={{opacity:0,x:-24}} animate={{opacity:1,x:0}} transition={{duration:.6}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"7px 13px",borderRadius:30,background:"rgba(255,59,84,.1)",border:"1px solid rgba(255,59,84,.28)",marginBottom:20,fontSize:12,fontWeight:700,color:"#ff8293"}}>
            <Heart size={14} fill="currentColor" /> Every drop can make a difference
          </div>
          <h1 className="headline hero-title" style={{margin:"0 0 20px",fontWeight:800}}>
            Be someone's <span style={{background:`linear-gradient(90deg,${COLORS.crimson},#ff8a9a ${"55%"},${COLORS.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>lifeline.</span><br />
            <span style={{fontSize:".76em",letterSpacing:"-1px"}}>Find blood. Give hope.</span>
          </h1>
          <p style={{fontSize:15.5,color:COLORS.textMuted,lineHeight:1.85,maxWidth:520,margin:0}}>
            BloodBridge brings donors, people seeking blood, and blood banks together. Find compatible donor support, register to help, and explore donation resources in one place.
          </p>
          <div className="hero-actions">
            </div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:22,color:COLORS.textMuted,fontSize:12}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><ShieldCheck size={15} color={COLORS.cyan}/> Verification-aware donor listings</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}><MapPin size={15} color={COLORS.good}/> Location-based discovery</span>
          </div>
        </motion.div>
        <motion.div className="hero-stats" style={{position:"relative",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} transition={{duration:.6,delay:.12}}>
          <StatCard label="Registered donors" value={donors.length} icon={<Users size={18} color={COLORS.cyan}/>}/>
          <StatCard label="Verified donors" value={verified} icon={<ShieldCheck size={18} color={COLORS.cyan}/>}/>
          <StatCard label="Available verified donors" value={available} icon={<Activity size={18} color={COLORS.good}/>}/>
          <StatCard label="Open requests" value={open} icon={<AlertTriangle size={18} color={COLORS.crimson}/>}/>
          <div style={{gridColumn:"1 / -1",fontSize:11.5,lineHeight:1.6,color:COLORS.textMuted,padding:"0 4px"}}>Live totals from the records currently loaded by BloodBridge. Availability can change; please confirm details before travelling.</div>
        </motion.div>
      </section>

            <section className="home-section">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:16,flexWrap:"wrap"}}>
          <div><SectionLabel>Start here</SectionLabel><h2 className="headline section-heading">What do you need today?</h2><p className="section-subtitle">Choose a quick action to get to the right part of BloodBridge.</p></div>
        </div>
        <div className="quick-grid">
          {quickActions.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: "easeOut" }}
            >
              <div
                className="quick-card-inner"
                style={{
                  "--card-tone-border": `${item.tone}60`,
                  "--card-tone-glow": `${item.tone}35`,
                  background: `radial-gradient(circle at 18% 14%, ${item.tone}16 0%, rgba(20, 24, 34, 0.72) 48%, rgba(12, 14, 20, 0.96) 100%)`,
                }}
              >
                {/* Top Row: Icon squircle + Category badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      color: item.tone,
                      background: `linear-gradient(135deg, ${item.tone}24, ${item.tone}0a)`,
                      border: `1px solid ${item.tone}40`,
                      boxShadow: `0 4px 14px ${item.tone}20`,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  {item.tag && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: "rgba(255, 255, 255, 0.045)",
                        border: "1px solid rgba(255, 255, 255, 0.09)",
                        color: "#9ca3af",
                        letterSpacing: 0.4,
                      }}
                    >
                      {item.tag}
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 7px", color: "#f3f4f6", letterSpacing: -0.3 }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 12.5, lineHeight: 1.65, color: COLORS.textMuted, margin: "0 0 18px", flex: 1 }}>
                  {item.description}
                </p>

                {/* Tactile Action Button Pill */}
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={item.action}
                  style={{
                    marginTop: "auto",
                    alignSelf: "flex-start",
                    border: `1px solid ${item.tone}40`,
                    background: `linear-gradient(135deg, ${item.tone}1c 0%, ${item.tone}0a 100%)`,
                    padding: "7px 15px",
                    borderRadius: 999,
                    color: "#ffffff",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: `0 2px 10px ${item.tone}18`,
                    letterSpacing: -0.2,
                  }}
                >
                  <span>{item.label}</span>
                  <ArrowRight size={13} style={{ color: item.tone }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionLabel>Explore the donor pool</SectionLabel>
        <h2 className="headline section-heading">Blood groups at a glance</h2>
        <p className="section-subtitle">Counts below reflect donor records currently loaded, not confirmed blood-bank inventory. Only eligible verified donors are shown on the public donor map.</p>
        <div className="blood-groups">{groupCounts.map(({group,count})=><div className="blood-group" key={group}><strong>{group}</strong><span>{count} donor{count===1?"":"s"}</span></div>)}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
          <button style={ghostBtn} onClick={()=>setShowDonorMap(v=>!v)} aria-expanded={showDonorMap}><MapPin size={15}/> {showDonorMap?"Hide donor map":"Show donor map"}</button>
        </div>
      </section>

      <AnimatePresence>{showDonorMap && <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} style={{marginTop:20}}>
        <SectionLabel>Live donor map</SectionLabel><Card hover={false} style={{padding:12}}>
          {mapCenter ? <><div style={{color:COLORS.textMuted,fontSize:12.5,padding:"4px 8px 12px"}}>Approximate locations of available, verified donors.</div><DonorLocationsMap center={mapCenter} donors={mapDonors.map(d=>({lat:Math.round(Number(d.lat)*100)/100,lng:Math.round(Number(d.lng)*100)/100,label:(d.locality||"Registered area")+" · "+d.group}))} height={360}/></> : <div style={{minHeight:130,display:"grid",placeItems:"center",textAlign:"center",padding:24,color:COLORS.textMuted,fontSize:13,lineHeight:1.7}}>No available, verified donor locations are ready to display yet.</div>}
        </Card>
      </motion.div>}</AnimatePresence>

      <section className="home-section">
        <SectionLabel>Simple, connected, community-focused</SectionLabel><h2 className="headline section-heading">How BloodBridge works</h2><p className="section-subtitle">A clear path from searching for help to connecting with donation support.</p>
        <div className="how-grid">{[
          {n:"01",title:"Search or register",desc:"Recipients can start a blood request; eligible donors can create a donor profile."},
          {n:"02",title:"Review compatible support",desc:"Use blood-group and location-based tools to explore relevant donor matches."},
          {n:"03",title:"Confirm before you travel",desc:"Contact the relevant donor or blood bank and follow professional screening and transfusion guidance."}
        ].map((step,i)=><motion.div key={step.n} initial={{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.07}}><Card style={{height:"100%",padding:22}}><div className="step-number">{step.n}</div><h3 style={{fontSize:16,margin:"0 0 9px"}}>{step.title}</h3><p style={{fontSize:13.5,color:COLORS.textMuted,lineHeight:1.8,margin:0}}>{step.desc}</p></Card></motion.div>)}</div>
      </section>

      <section className="home-section">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap",padding:"clamp(22px,4vw,36px)",borderRadius:20,border:"1px solid rgba(255,59,84,.25)",background:"linear-gradient(120deg,rgba(255,59,84,.12),rgba(34,211,238,.06))"}}>
          <div style={{maxWidth:600}}><h2 className="headline" style={{fontSize:"clamp(1.35rem,2.5vw,2rem)",margin:"0 0 9px"}}>A small act can make a life-changing difference.</h2><p style={{color:COLORS.textMuted,fontSize:13.5,lineHeight:1.75,margin:0}}>Join the community, explore donation camps and blood banks, or start a search for blood support.</p></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={glowBtn} onClick={()=>goTo("donor")}><Heart size={15}/> Join as donor</button><button style={ghostBtn} onClick={()=>goTo("camps")}><Building2 size={15}/> Camps & banks</button></div>
        </div>
      </section>
      <p style={{fontSize:11.5,color:COLORS.textMuted,lineHeight:1.7,textAlign:"center",margin:"28px 0 0"}}>BloodBridge helps people discover donation support; it does not replace medical advice, donor eligibility assessment, or blood-bank screening.</p>
    </div>
  );
}

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, color: COLORS.textMuted,
                 textTransform: "uppercase", marginBottom: 12 }}>{children}</div>
);

const StatCard = ({ label, value, icon }) => (
  <Card style={{ padding: "18px 20px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div className="headline" style={{ fontSize: 28, fontWeight: 700 }}>
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3 }}>{label}</div>
      </div>
      {icon}
    </div>
  </Card>
);

// =================================================================
// DONOR VIEW
// =================================================================
// =================================================================
// BLOOD GROUP VERIFICATION — badge, donor upload panel, admin review
// =================================================================
function VerificationBadge({ status }) {
  const map = {
    verified: { tone: "good", icon: <ShieldCheck size={12} style={{ verticalAlign: -2 }} />, label: "Verified" },
    pending: { tone: "info", icon: <Clock3 size={12} style={{ verticalAlign: -2 }} />, label: "Pending" },
    rejected: { tone: "warn", icon: <XCircle size={12} style={{ verticalAlign: -2 }} />, label: "Rejected" },
    unverified: { tone: "neutral", icon: null, label: "Unverified" },
  };
  const s = map[status] || map.unverified;
  return <Pill tone={s.tone}>{s.icon} {s.label}</Pill>;
}

function VerificationPanel({ donor, donorToken, notify }) {
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, n] = await Promise.all([
        api(`/donors/${donor._id}/verification`, {}, donorToken),
        api(`/donors/${donor._id}/notifications`, {}, donorToken),
      ]);
      setStatus(s);
      setNotifications(n);
    } catch (err) {
      notify(err.message);
    }
  }, [donor._id, donorToken, notify]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { notify("Please choose a JPG, PNG, or PDF file."); return; }
    if (file.size > 5 * 1024 * 1024) { notify("File must be under 5MB."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      await api(`/donors/${donor._id}/verification/upload`, { method: "POST", body: fd }, donorToken);
      notify("Document uploaded — awaiting admin review.");
      setFile(null);
      load();
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  const markRead = async (id) => {
    try {
      await api(`/donors/${donor._id}/notifications/${id}/read`, { method: "PATCH" }, donorToken);
      setNotifications((ns) => ns.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (err) { notify(err.message); }
  };

  if (!status) return <Card hover={false} style={{ color: COLORS.textMuted, textAlign: "center" }}>Loading…</Card>;

  const canUpload = status.bloodGroupStatus === "unverified" || status.bloodGroupStatus === "rejected";

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Entered blood group: {status.group}</div>
          <VerificationBadge status={status.bloodGroupStatus} />
        </div>

        {status.bloodGroupStatus === "verified" && (
          <p style={{ fontSize: 12.5, color: COLORS.good, lineHeight: 1.6 }}>
            <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            Confirmed by {status.bloodGroupVerifiedBy || "an admin"} on {new Date(status.bloodGroupVerifiedAt).toLocaleDateString()}.
          </p>
        )}
        {status.bloodGroupStatus === "pending" && (
          <p style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6 }}>
            Your document ({status.bloodGroupDocOriginalName || "uploaded file"}) is awaiting admin review.
          </p>
        )}
        {status.bloodGroupStatus === "rejected" && (
          <p style={{ fontSize: 12.5, color: COLORS.crimson, lineHeight: 1.6 }}>
            Rejected: {status.bloodGroupRejectionReason || "Document did not match."} You can re-upload below.
          </p>
        )}
        {status.bloodGroupStatus === "unverified" && (
          <p style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6 }}>
            You haven't uploaded proof of your blood group yet. Your account is registered, but you won't be included in automated recipient matching until an admin verifies your blood group. After approval, you can be considered for location-based matches.
          </p>
        )}
      </Card>

      {canUpload && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            <Upload size={15} style={{ verticalAlign: -2, marginRight: 6 }} /> Upload proof of blood group
          </div>
          <p style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
            A lab report, blood donor card, or hospital certificate. JPG, PNG, or PDF, max 5MB. Only
            admins can view this document.
          </p>
          <form onSubmit={submit}>
            <Field label="Document">
              <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: "9px 12px" }} />
            </Field>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
              style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Uploading…" : "Submit for verification"}
            </motion.button>
          </form>
        </Card>
      )}

      {notifications.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Notifications</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div key={n._id} onClick={() => !n.read && markRead(n._id)} style={{
                padding: "12px 14px", borderRadius: 10, cursor: n.read ? "default" : "pointer",
                background: n.read ? "rgba(255,255,255,0.02)" : "rgba(34,211,238,0.06)",
                border: `1px solid ${n.read ? COLORS.panelBorder : COLORS.cyan + "33"}`,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <BellRing size={14} color={n.read ? COLORS.textMuted : COLORS.cyan} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, color: n.read ? COLORS.textMuted : COLORS.text, lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 3 }}>{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// DONATION ELIGIBILITY TRACKER — gender-aware safe-donation countdown,
// based on national blood-centre guidelines (men: 90 days, women: 120 days)
// =================================================================
function EligibilityTracker({ donor }) {
  const gap = minGapDays(donor.gender);
  const daysLeft = daysUntilEligible(donor.gender, donor.lastDonation);
  const progress = eligibilityProgress(donor.gender, donor.lastDonation);
  const eligible = daysLeft === 0;
  const nextDate = new Date(new Date(donor.lastDonation).getTime() + gap * 86400000);

  return (
    <Card style={{ marginTop: 16 }} hover={false}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Timer size={16} color={eligible ? COLORS.good : COLORS.warn} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Donation eligibility tracker</span>
        </div>
        {eligible ? (
          <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Eligible now</Pill>
        ) : (
          <Pill tone="warn">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</Pill>
        )}
      </div>

      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 10 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{
            height: "100%", borderRadius: 6,
            background: eligible
              ? `linear-gradient(90deg, ${COLORS.good}, ${COLORS.cyan})`
              : `linear-gradient(90deg, ${COLORS.crimson}, ${COLORS.warn})`,
          }}
        />
      </div>

      <div style={{ fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.6 }}>
        {eligible ? (
          <>You've cleared the {gap}-day safe gap since your last donation — you're eligible to donate again. Please also pass the blood bank's on-site screening (hemoglobin, weight, health check) before donating.</>
        ) : (
          <>Based on your gender, the recommended gap between donations is <b>{gap} days</b>. You'll be eligible again on <b>{nextDate.toLocaleDateString()}</b>.</>
        )}
      </div>
    </Card>
  );
}

function DonorView({ notify }) {
  const [mode, setMode] = useState("register"); // register | login
  const [stage, setStage] = useState("form"); // form -> otp (registration only)
  const [form, setForm] = useState({ name: "", phone: "", password: "", group: "O+", gender: "Male", lat: "", lng: "", district: "", city: "", state: "" });
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [loginRecovery, setLoginRecovery] = useState("form");
  const [recoveryForm, setRecoveryForm] = useState({ phone: "", otp: "", newPassword: "", confirmPassword: "" });
  const [enteredOtp, setEnteredOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [districtData, setDistrictData] = useState({});
  useEffect(() => { let live = true; fetch("/india-districts.json").then(r => { if (!r.ok) throw new Error("District list unavailable"); return r.json(); }).then(raw => { const source = Array.isArray(raw) ? raw : (raw.states || raw.data || raw); const map = {}; if (Array.isArray(source)) source.forEach(row => { const name = row.state || row.stateName || row.name; const ds = row.districts || row.children || row.district || []; if (name) map[name] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); else if (source && typeof source === "object") Object.entries(source).forEach(([name, value]) => { const ds = Array.isArray(value) ? value : (value.districts || value.children || []); map[name.replace(/\\s*\\(UT\\)$/i, "")] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); if (live) setDistrictData(map); }).catch(() => {}); return () => { live = false; }; }, []);
  const stateOptions = Object.keys(districtData).sort();
  const districtOptions = state => districtData[state] || [];

  const [donorToken, setDonorToken] = useState(() => localStorage.getItem("raktsetu_donor_token"));
  const [profile, setProfile] = useState(null);
  const [panel, setPanel] = useState("overview"); // overview | verification | edit | password | donation | delete

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem("raktsetu_donor_token");
      if (!token) { setCheckingSession(false); return; }
      try {
        const me = await api("/donors/me", {}, token);
        setProfile(me);
        setDonorToken(token);
      } catch {
        localStorage.removeItem("raktsetu_donor_token");
        setDonorToken(null);
      } finally {
        setCheckingSession(false);
      }
    };
    restore();
  }, []);

  const logIn = (token, donor) => {
    localStorage.setItem("raktsetu_donor_token", token);
    setDonorToken(token);
    setProfile(donor);
  };
  const logOut = () => {
    localStorage.removeItem("raktsetu_donor_token");
    setDonorToken(null);
    setProfile(null);
  };

  const useLocation = () => {
    if (!navigator.geolocation) { notify("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) })),
      () => notify("Location access denied — you can enter coordinates manually.")
    );
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { notify("Please fill in your name and phone number."); return; }
    if (!isValidIndianMobile(form.phone)) { notify("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9."); return; }
    if (!form.password || form.password.length < 6) { notify("Password must be at least 6 characters."); return; }
    const donorLat = form.lat.trim() === "" ? NaN : Number(form.lat);
    const donorLng = form.lng.trim() === "" ? NaN : Number(form.lng);
    if (!Number.isFinite(donorLat) || donorLat < -90 || donorLat > 90 ||
        !Number.isFinite(donorLng) || donorLng < -180 || donorLng > 180) {
      notify("Set your real location with “Use my current location” or enter valid latitude and longitude. Choose your district and set your real location with Use my current location or enter valid latitude and longitude.");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/donors/send-otp", { method: "POST", body: JSON.stringify({ phone: form.phone }) });
      setStage("otp");
      notify(result.demo ? `Demo mode — OTP sent to +91 ${form.phone}: ${result.code}` : `Real SMS sent to +91 ${form.phone} via Twilio.`);
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const result = await api("/donors/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name, phone: form.phone, password: form.password, group: form.group, gender: form.gender,
          lat: Number(form.lat), lng: Number(form.lng),
          district: form.district || form.city, city: form.district || form.city, state: form.state,
          
          otp: enteredOtp,
        }),
      });
      logIn(result.token, result.donor);
      setPanel("verification");
      notify("Registration complete. Upload blood-group proof for admin approval to appear in recipient matching.");
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.phone || !loginForm.password) { notify("Enter your phone and password."); return; }
    setBusy(true);
    try {
      const result = await api("/donors/login", { method: "POST", body: JSON.stringify(loginForm) });
      logIn(result.token, result.donor);
      notify(`Welcome back, ${result.donor.name}.`);
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  const sendDonorRecoveryOtp = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(recoveryForm.phone)) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    setBusy(true);
    try { const result = await api("/donors/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ phone: recoveryForm.phone }) }); setLoginRecovery("otp"); notify(result.demo ? `Demo mode — password reset OTP for +91 ${recoveryForm.phone}: ${result.code}` : `OTP sent to +91 ${recoveryForm.phone}.`); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  const resetDonorPassword = async (e) => {
    e.preventDefault();
    if (recoveryForm.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    if (recoveryForm.newPassword !== recoveryForm.confirmPassword) { notify("New passwords don't match."); return; }
    setBusy(true);
    try { await api("/donors/forgot-password/reset", { method: "POST", body: JSON.stringify({ phone: recoveryForm.phone, otp: recoveryForm.otp, newPassword: recoveryForm.newPassword }) }); setLoginRecovery("done"); setLoginForm({ phone: recoveryForm.phone, password: "" }); notify("Password reset successfully. Log in with your new password."); }
    catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  if (checkingSession) {
    return <Card hover={false} style={{ textAlign: "center", color: COLORS.textMuted, maxWidth: 480 }}>Checking session…</Card>;
  }

  if (donorToken && profile) {
    const me = profile;
    const panels = [
      ["overview", "Overview"],
      ["verification", "Blood Group Verification"],
      ["edit", "Edit Profile"],
      ["password", "Change Password"],
      ["donation", "Last Donated Blood"],
      ["digital", "Digital ID & History"],
      ["delete", "Delete Profile"],
    ];
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Donor dashboard</SectionLabel>
          <button onClick={logOut} style={{ ...ghostBtn, padding: "7px 13px", fontSize: 12 }}>
            <LogOut size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Log out
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {panels.map(([key, label]) => (
            <button key={key} onClick={() => setPanel(key)}
              style={{
                background: panel === key ? "rgba(255,59,84,0.12)" : "rgba(255,255,255,0.04)",
                color: panel === key ? COLORS.crimson : COLORS.textMuted,
                border: `1px solid ${panel === key ? COLORS.crimson + "44" : COLORS.panelBorder}`,
                borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={panel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {panel === "overview" && (
              <>
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="headline" style={{ fontWeight: 700, fontSize: 19 }}>{me.name}</div>
                      <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 3 }}>+91 {me.phone} · ID {me._id.slice(-6)}</div>
                    </div>
                    <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Verified</Pill>
                  </div>
                  <div style={{ display: "flex", gap: 10, margin: "18px 0", flexWrap: "wrap" }}>
                    <Pill tone="warn">{me.group}</Pill>
                    <Pill tone="info">{me.gender}</Pill>
                    <Pill tone={me.available ? "good" : "neutral"}>{me.available ? "Available" : "Unavailable"}</Pill>
                    <VerificationBadge status={me.bloodGroupStatus} />
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ ...ghostBtn, marginTop: 4 }}
                    onClick={async () => {
                      try {
                        const updated = await api(`/donors/${me._id}/availability`, { method: "PATCH", body: JSON.stringify({ available: !me.available }) }, donorToken);
                        setProfile(updated);
                        notify(me.available ? "Marked yourself unavailable." : "Marked yourself available.");
                      } catch (err) { notify(err.message); }
                    }}>
                    {me.available ? "Set myself unavailable" : "Set myself available"}
                  </motion.button>
                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${COLORS.panelBorder}`,
                                 display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 5 }}>Last donation</div>
                      <div style={{ fontSize: 14.5 }}>{new Date(me.lastDonation).toLocaleDateString()} &nbsp;·&nbsp; {daysSince(me.lastDonation)} days ago</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 5 }}>Total donations</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{me.totalDonations || 0}</div>
                    </div>
                  </div>
                </Card>
                <EligibilityTracker donor={me} />
              </>
            )}
            {panel === "verification" && (
              <VerificationPanel donor={me} donorToken={donorToken} notify={notify} />
            )}
            {panel === "edit" && (
              <EditProfileForm donor={me} donorToken={donorToken} notify={notify} onUpdated={setProfile} />
            )}
            {panel === "password" && (
              <ChangePasswordForm donor={me} donorToken={donorToken} notify={notify} />
            )}
            {panel === "donation" && (
              <LastDonatedBloodForm donor={me} donorToken={donorToken} notify={notify} onUpdated={setProfile} />
            )}
            {panel === "digital" && <DonorDigitalIdPanel donor={me} donorToken={donorToken} notify={notify} />}
            {panel === "delete" && (
              <DeleteProfileSection donor={me} donorToken={donorToken} notify={notify} onDeleted={logOut} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <SectionLabel>{mode === "register" ? "Register as a donor" : "Donor login"}</SectionLabel>
        <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setStage("form"); }}
          style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
          {mode === "register" ? "Already registered? Log in" : "New here? Register"}
        </button>
      </div>
      <Card>
        {mode === "login" && (
          loginRecovery === "form" ? <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submitLogin}>
            <Field label="Mobile number"><input required inputMode="numeric" maxLength={10} style={inputStyle} value={loginForm.phone} onChange={e => setLoginForm({ ...loginForm, phone: e.target.value.replace(/\D/g, "").slice(0,10) })} placeholder="10-digit mobile number" /></Field>
            <Field label="Password"><input required type="password" style={inputStyle} value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Your password" /></Field>
            <button type="button" onClick={() => { setRecoveryForm({ phone: loginForm.phone, otp: "", newPassword: "", confirmPassword: "" }); setLoginRecovery("phone"); }} style={{ background: "none", border: 0, color: COLORS.cyan, padding: "8px 0", cursor: "pointer", fontWeight: 700 }}>Forgot password?</button>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy} style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>{busy ? "Signing in…" : "Log in"}</motion.button>
          </motion.form> : loginRecovery === "phone" ? <form onSubmit={sendDonorRecoveryOtp}>
            <p style={{ color: COLORS.textMuted, fontSize: 13 }}>Enter the mobile number linked to your donor account. Demo OTP appears in the notification.</p>
            <Field label="Registered mobile number"><input required inputMode="numeric" maxLength={10} style={inputStyle} value={recoveryForm.phone} onChange={e => setRecoveryForm({ ...recoveryForm, phone: e.target.value.replace(/\D/g, "").slice(0,10) })} placeholder="10-digit mobile number" /></Field>
            <button disabled={busy} style={{ ...glowBtn, width: "100%", justifyContent: "center" }}>{busy ? "Generating OTP…" : "Generate demo OTP"}</button><button type="button" style={{ ...ghostBtn, marginTop: 8 }} onClick={() => setLoginRecovery("form")}>Back to login</button>
          </form> : loginRecovery === "otp" ? <form onSubmit={resetDonorPassword}>
            <Field label="Demo OTP"><input required inputMode="numeric" maxLength={6} style={inputStyle} value={recoveryForm.otp} onChange={e => setRecoveryForm({ ...recoveryForm, otp: e.target.value.replace(/\D/g, "").slice(0,6) })} placeholder="OTP from notification" /></Field>
            <Field label="New password"><input required type="password" minLength={6} style={inputStyle} value={recoveryForm.newPassword} onChange={e => setRecoveryForm({ ...recoveryForm, newPassword: e.target.value })} placeholder="At least 6 characters" /></Field>
            <Field label="Confirm new password"><input required type="password" minLength={6} style={inputStyle} value={recoveryForm.confirmPassword} onChange={e => setRecoveryForm({ ...recoveryForm, confirmPassword: e.target.value })} placeholder="Re-enter new password" /></Field>
            <button disabled={busy} style={{ ...glowBtn, width: "100%", justifyContent: "center" }}>{busy ? "Resetting…" : "Verify OTP & reset password"}</button><button type="button" style={{ ...ghostBtn, marginTop: 8 }} onClick={() => setLoginRecovery("phone")}>Use another mobile number</button>
          </form> : <div><p style={{ color: COLORS.good }}>Your password has been reset.</p><button style={glowBtn} onClick={() => setLoginRecovery("form")}>Back to login</button></div>
        )}
        {mode === "register" && (
          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={submitForm}>
                <Field label="Full name">
                  <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Anjali Patel" />
                </Field>
                <Field label="Phone number">
                  <input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number" />
                </Field>
                <Field label="Password (min. 6 characters — used to log in later)">
                  <input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Choose a password" />
                </Field>
                <Field label="Blood group">
                  <select style={inputStyle} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
                    {GROUPS.map((g) => <option key={g} style={{ background: "#161821" }}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Gender (sets your safe donation interval — 90 days for men, 120 for women, per national guidelines)">
                  <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option style={{ background: "#161821" }}>Male</option>
                    <option style={{ background: "#161821" }}>Female</option>
                    <option style={{ background: "#161821" }}>Other</option>
                  </select>
                </Field>
                <Field label="State / Union Territory"><select required style={inputStyle} value={form.state} onChange={e => setForm({ ...form, state: e.target.value, district: "" })}><option value="">Select state</option>{(stateOptions.length ? stateOptions : ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"]).map(st => <option key={st}>{st}</option>)}</select></Field>
                <Field label="District"><select required style={inputStyle} value={form.district || form.city} onChange={e => setForm({ ...form, district: e.target.value, city: e.target.value })} disabled={!form.state}><option value="">Select district</option>{districtOptions(form.state).map(dist => <option key={dist}>{dist}</option>)}</select></Field>
                <Field label="Location">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inputStyle} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="Latitude" />
                    <input style={inputStyle} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="Longitude" />
                  </div>
                  <button type="button" onClick={useLocation} style={{ ...ghostBtn, marginTop: 9, fontSize: 12, padding: "7px 13px" }}>
                    <MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Use my current location
                  </button>
                </Field>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending…" : "Send verification code"}
                </motion.button>
              </motion.form>
            )}
            {stage === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
                  We sent a verification code to +91 {form.phone}. Check the notification banner (demo, 4 digits)
                  or your SMS inbox (real Twilio, 6 digits).
                </p>
                <Field label="Enter OTP">
                  <input style={inputStyle} value={enteredOtp} onChange={(e) => setEnteredOtp(e.target.value)} placeholder="4 or 6-digit code" maxLength={6} />
                </Field>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} disabled={busy}
                  style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }} onClick={verifyOtp}>
                  {busy ? "Verifying…" : "Verify & complete registration"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Card>
    </div>
  );
}

// =================================================================
// DONOR "MY PAGE" SUB-FEATURES — edit profile, change password,
// last donated blood register, delete profile/unsubscribe
// =================================================================
function EditProfileForm({ donor, donorToken, notify, onUpdated }) {
  const [form, setForm] = useState({
    name: donor.name, group: donor.group, gender: donor.gender,
    district: donor.district || donor.city || "", city: donor.district || donor.city || "", state: donor.state || "",
    lat: donor.lat, lng: donor.lng,
      });
  const [busy, setBusy] = useState(false);

  const useLocation = () => {
    if (!navigator.geolocation) { notify("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) })),
      () => notify("Location access denied.")
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api(`/donors/${donor._id}/profile`, { method: "PATCH", body: JSON.stringify(form) }, donorToken);
      onUpdated(updated);
      notify("Profile updated.");
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <Field label="Full name">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Blood group">
          <select style={inputStyle} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
            {GROUPS.map((g) => <option key={g} style={{ background: "#161821" }}>{g}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option style={{ background: "#161821" }}>Male</option>
            <option style={{ background: "#161821" }}>Female</option>
            <option style={{ background: "#161821" }}>Other</option>
          </select>
        </Field>
        <Field label="District / State">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="District" />
            <input style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
          </div>
        </Field>
        <Field label="Location">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="Latitude" />
            <input style={inputStyle} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="Longitude" />
          </div>
          <button type="button" onClick={useLocation} style={{ ...ghostBtn, marginTop: 9, fontSize: 12, padding: "7px 13px" }}>
            <MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Use my current location
          </button>
        </Field>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
          style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : "Save changes"}
        </motion.button>
      </form>
    </Card>
  );
}

function ChangePasswordForm({ donor, donorToken, notify }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStage, setForgotStage] = useState("phone"); // phone -> otp -> done
  const [forgotForm, setForgotForm] = useState({ phone: donor.phone, otp: "", newPassword: "", confirmPassword: "" });
  const [forgotBusy, setForgotBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { notify("New passwords don't match."); return; }
    if (form.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await api(`/donors/${donor._id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      }, donorToken);
      notify("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  const sendForgotOtp = async (e) => {
    e.preventDefault();
    if (!isValidIndianMobile(forgotForm.phone)) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    setForgotBusy(true);
    try {
      const result = await api("/donors/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ phone: forgotForm.phone }) });
      setForgotStage("otp");
      notify(result.demo ? `Demo mode — OTP sent to +91 ${forgotForm.phone}: ${result.code}` : `OTP sent to +91 ${forgotForm.phone}.`);
    } catch (err) {
      notify(err.message);
    } finally { setForgotBusy(false); }
  };

  const resetForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotForm.newPassword !== forgotForm.confirmPassword) { notify("New passwords don't match."); return; }
    if (forgotForm.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    setForgotBusy(true);
    try {
      await api("/donors/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({ phone: forgotForm.phone, otp: forgotForm.otp, newPassword: forgotForm.newPassword }),
      });
      notify("Password reset successfully.");
      setForgotStage("done");
    } catch (err) {
      notify(err.message);
    } finally { setForgotBusy(false); }
  };

  return (
    <div>
      <Card style={{ maxWidth: 420 }}>
        <form onSubmit={submit}>
          <Field label="Current password">
            <input type="password" style={inputStyle} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password">
            <input type="password" style={inputStyle} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" style={inputStyle} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
            style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Updating…" : "Change password"}
          </motion.button>
        </form>
      </Card>

      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowForgot((s) => !s)}
          style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
          {showForgot ? "Hide" : "Forgot your current password?"}
        </button>
      </div>

      <AnimatePresence>
        {showForgot && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <Card style={{ maxWidth: 420, marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Reset password via OTP</div>

              {forgotStage === "phone" && (
                <form onSubmit={sendForgotOtp}>
                  <Field label="Registered phone number">
                    <input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={inputStyle} value={forgotForm.phone} onChange={(e) => setForgotForm({ ...forgotForm, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number" />
                  </Field>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={forgotBusy}
                    style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: forgotBusy ? 0.6 : 1 }}>
                    {forgotBusy ? "Sending…" : "Send verification code"}
                  </motion.button>
                </form>
              )}

              {forgotStage === "otp" && (
                <form onSubmit={resetForgotPassword}>
                  <p style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                    Check the notification banner (demo mode) or your SMS inbox for the code.
                  </p>
                  <Field label="Enter OTP">
                    <input style={inputStyle} value={forgotForm.otp} onChange={(e) => setForgotForm({ ...forgotForm, otp: e.target.value })} placeholder="4 or 6-digit code" maxLength={6} />
                  </Field>
                  <Field label="New password">
                    <input type="password" style={inputStyle} value={forgotForm.newPassword} onChange={(e) => setForgotForm({ ...forgotForm, newPassword: e.target.value })} />
                  </Field>
                  <Field label="Confirm new password">
                    <input type="password" style={inputStyle} value={forgotForm.confirmPassword} onChange={(e) => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })} />
                  </Field>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={forgotBusy}
                    style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: forgotBusy ? 0.6 : 1 }}>
                    {forgotBusy ? "Resetting…" : "Reset password"}
                  </motion.button>
                </form>
              )}

              {forgotStage === "done" && (
                <p style={{ fontSize: 13.5, color: COLORS.good }}>
                  <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Password reset. Log out and log back in with your new password.
                </p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LastDonatedBloodForm({ donor, donorToken, notify, onUpdated }) {
  const [form, setForm] = useState({ donationDate: "", patientName: "", location: "", hospitalName: "", type: "Blood" });
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api(`/donors/${donor._id}/donations`, {}, donorToken);
      setHistory(data);
    } catch (err) {
      notify(err.message);
    }
  }, [donor._id, donorToken, notify]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.donationDate) { notify("Donated date is required."); return; }
    setBusy(true);
    try {
      await api(`/donors/${donor._id}/donations`, { method: "POST", body: JSON.stringify(form) }, donorToken);
      const updatedMe = await api("/donors/me", {}, donorToken);
      onUpdated(updatedMe);
      notify("Donation registered.");
      setForm({ donationDate: "", patientName: "", location: "", hospitalName: "", type: "Blood" });
      loadHistory();
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Last Donated Blood: Register</div>
        <form onSubmit={submit}>
          <Field label="Donated Date (DD/MM/YYYY)">
            <input type="date" style={inputStyle} value={form.donationDate} onChange={(e) => setForm({ ...form, donationDate: e.target.value })} />
          </Field>
          <Field label="Patient Name">
            <input style={inputStyle} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
          </Field>
          <Field label="Location">
            <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Hospital Name">
            <input style={inputStyle} value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
          </Field>
          <Field label="Type of Donation">
            <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option style={{ background: "#161821" }}>Blood</option>
              <option style={{ background: "#161821" }}>Platelets</option>
              <option style={{ background: "#161821" }}>Plasma</option>
            </select>
          </Field>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
            style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Submitting…" : "Submit"}
          </motion.button>
        </form>
      </Card>

      {history && history.length > 0 && (
        <Card hover={false} style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead><tr><th>Date</th><th>Patient</th><th>Location</th><th>Hospital</th><th>Type</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id}>
                  <td>{new Date(h.donationDate).toLocaleDateString()}</td>
                  <td>{h.patientName || "—"}</td>
                  <td>{h.location || "—"}</td>
                  <td>{h.hospitalName || "—"}</td>
                  <td><Pill tone="info">{h.type}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function DeleteProfileSection({ donor, donorToken, notify, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteProfile = async () => {
    setBusy(true);
    try {
      await api(`/donors/${donor._id}`, { method: "DELETE" }, donorToken);
      notify("Your profile has been deleted.");
      onDeleted();
    } catch (err) {
      notify(err.message);
    } finally { setBusy(false); }
  };

  return (
    <Card style={{ maxWidth: 420, borderColor: COLORS.crimson + "44" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete Profile / Unsubscribe</div>
      <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
        This permanently deletes your donor profile and donation history from BloodBridge. You will no
        longer appear in any matching results. This cannot be undone.
      </p>
      {!confirming ? (
        <button style={{ ...ghostBtn, borderColor: COLORS.crimson + "55", color: COLORS.crimson }} onClick={() => setConfirming(true)}>
          Delete my profile
        </button>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={busy} style={{ ...glowBtn, opacity: busy ? 0.6 : 1 }} onClick={deleteProfile}>
            {busy ? "Deleting…" : "Yes, delete permanently"}
          </button>
          <button style={ghostBtn} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
    </Card>
  );
}


// =================================================================
// RARE DONOR VIEW — full mirror of DonorView (register/login/OTP,
// password, forgot-password, edit profile, delete) but for rare
// blood phenotypes, plus a directory search to find other rare donors.
// =================================================================
function RareDonorView({ notify }) {
  const [mode, setMode] = useState("register");
  const [view, setView] = useState("form"); // form | search
  const [stage, setStage] = useState("form");
  const [form, setForm] = useState({ name: "", phone: "", password: "", rareType: RARE_GROUPS[0], gender: "Male", lat: "", lng: "", city: "", state: "", donationType: "Free", feeAmount: "" });
  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [enteredOtp, setEnteredOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [donorToken, setDonorToken] = useState(() => localStorage.getItem("raktsetu_rare_token"));
  const [profile, setProfile] = useState(null);
  const [panel, setPanel] = useState("overview");

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem("raktsetu_rare_token");
      if (!token) { setCheckingSession(false); return; }
      try {
        const me = await api("/rare-donors/me", {}, token);
        setProfile(me);
        setDonorToken(token);
      } catch {
        localStorage.removeItem("raktsetu_rare_token");
        setDonorToken(null);
      } finally { setCheckingSession(false); }
    };
    restore();
  }, []);

  const logIn = (token, donor) => {
    localStorage.setItem("raktsetu_rare_token", token);
    setDonorToken(token);
    setProfile(donor);
  };
  const logOut = () => {
    localStorage.removeItem("raktsetu_rare_token");
    setDonorToken(null);
    setProfile(null);
  };

  const useLocation = () => {
    if (!navigator.geolocation) { notify("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) })),
      () => notify("Location access denied — you can enter coordinates manually.")
    );
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { notify("Please fill in your name and phone number."); return; }
    if (!isValidIndianMobile(form.phone)) { notify("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9."); return; }
    if (!form.password || form.password.length < 6) { notify("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const result = await api("/rare-donors/send-otp", { method: "POST", body: JSON.stringify({ phone: form.phone }) });
      setStage("otp");
      notify(result.demo ? `Demo mode — OTP sent to +91 ${form.phone}: ${result.code}` : `Real SMS sent to +91 ${form.phone} via Twilio.`);
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    setBusy(true);
    try {
      const result = await api("/rare-donors/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name, phone: form.phone, password: form.password, rareType: form.rareType, gender: form.gender,
          lat: Number(form.lat), lng: Number(form.lng),
          city: form.city, state: form.state,
          donationType: form.donationType, feeAmount: parseFloat(form.feeAmount) || 0,
          otp: enteredOtp,
        }),
      });
      logIn(result.token, result.donor);
      notify("Phone verified — you're now registered and logged in.");
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.phone || !loginForm.password) { notify("Enter your phone and password."); return; }
    setBusy(true);
    try {
      const result = await api("/rare-donors/login", { method: "POST", body: JSON.stringify(loginForm) });
      logIn(result.token, result.donor);
      notify(`Welcome back, ${result.donor.name}.`);
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  if (checkingSession) {
    return <Card hover={false} style={{ textAlign: "center", color: COLORS.textMuted, maxWidth: 480 }}>Checking session…</Card>;
  }

  if (donorToken && profile) {
    const me = profile;
    const panels = [
      ["overview", "Overview"],
      ["edit", "Edit Profile"],
      ["password", "Change Password"],
      ["donation", "Last Donated Blood"],
      ["delete", "Delete Profile"],
    ];
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Rare donor dashboard</SectionLabel>
          <button onClick={logOut} style={{ ...ghostBtn, padding: "7px 13px", fontSize: 12 }}>
            <LogOut size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Log out
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {panels.map(([key, label]) => (
            <button key={key} onClick={() => setPanel(key)}
              style={{
                background: panel === key ? "rgba(255,59,84,0.12)" : "rgba(255,255,255,0.04)",
                color: panel === key ? COLORS.crimson : COLORS.textMuted,
                border: `1px solid ${panel === key ? COLORS.crimson + "44" : COLORS.panelBorder}`,
                borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={panel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {panel === "overview" && (
              <>
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div className="headline" style={{ fontWeight: 700, fontSize: 19 }}>{me.name}</div>
                      <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 3 }}>+91 {me.phone} · ID {me._id.slice(-6)}</div>
                    </div>
                    <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Verified</Pill>
                  </div>
                  <div style={{ display: "flex", gap: 10, margin: "18px 0", flexWrap: "wrap" }}>
                    <Pill tone="warn">{me.rareType}</Pill>
                    <Pill tone="info">{me.gender}</Pill>
                    <Pill tone={me.available ? "good" : "neutral"}>{me.available ? "Available" : "Unavailable"}</Pill>
                    <Pill tone={me.donationType === "Paid" ? "warn" : "good"}>
                      {me.donationType === "Paid" ? `Paid · ₹${me.feeAmount}` : "Free donor"}
                    </Pill>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ ...ghostBtn, marginTop: 4 }}
                    onClick={async () => {
                      try {
                        const updated = await api(`/rare-donors/${me._id}/availability`, { method: "PATCH", body: JSON.stringify({ available: !me.available }) }, donorToken);
                        setProfile(updated);
                        notify(me.available ? "Marked yourself unavailable." : "Marked yourself available.");
                      } catch (err) { notify(err.message); }
                    }}>
                    {me.available ? "Set myself unavailable" : "Set myself available"}
                  </motion.button>
                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${COLORS.panelBorder}`,
                                 display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 5 }}>Last donation</div>
                      <div style={{ fontSize: 14.5 }}>{new Date(me.lastDonation).toLocaleDateString()} &nbsp;·&nbsp; {daysSince(me.lastDonation)} days ago</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 5 }}>Total donations</div>
                      <div style={{ fontSize: 14.5, fontWeight: 700 }}>{me.totalDonations || 0}</div>
                    </div>
                  </div>
                </Card>
                <EligibilityTracker donor={me} />
              </>
            )}
            {panel === "edit" && <EditRareProfileForm donor={me} donorToken={donorToken} notify={notify} onUpdated={setProfile} />}
            {panel === "password" && <ChangeRarePasswordForm donor={me} donorToken={donorToken} notify={notify} />}
            {panel === "donation" && <LastDonatedRareBloodForm donor={me} donorToken={donorToken} notify={notify} onUpdated={setProfile} />}
            {panel === "delete" && <DeleteRareProfileSection donor={me} donorToken={donorToken} notify={notify} onDeleted={logOut} />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div style={view === "search" ? undefined : { maxWidth: 480 }}>
      {view === "form" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <SectionLabel>{mode === "register" ? "Register as a rare-type donor" : "Rare donor login"}</SectionLabel>
            <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setStage("form"); }}
              style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
              {mode === "register" ? "Already registered? Log in" : "New here? Register"}
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
            For phenotypes like Bombay Blood Group and Rh-null, where compatible donors are extremely
            rare and usually need to find each other directly.
          </p>

          <button onClick={() => setView("search")} style={{
            width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 20,
            background: "rgba(34,211,238,0.06)", border: `1px solid ${COLORS.cyan}33`, borderRadius: 14,
            padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap", color: COLORS.text, font: "inherit",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} color={COLORS.cyan} />
              <span style={{ fontSize: 13.5 }}>Looking for a rare-type donor instead?</span>
            </div>
            <span style={{ fontSize: 12.5, color: COLORS.cyan, fontWeight: 600 }}>Find a rare type →</span>
          </button>

          <SectionLabel>{mode === "register" ? "New registration" : "Log in to your account"}</SectionLabel>
          <Card>
        {mode === "login" && (
          <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submitLogin}>
            <Field label="Phone number">
              <input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={inputStyle} value={loginForm.phone} onChange={(e) => setLoginForm({ ...loginForm, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number" />
            </Field>
            <Field label="Password">
              <input type="password" style={inputStyle} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Your password" />
            </Field>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
              style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Signing in…" : "Log in"}
            </motion.button>
          </motion.form>
        )}

        {mode === "register" && (
          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={submitForm}>
                <Field label="Full name">
                  <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Anjali Patel" />
                </Field>
                <Field label="Phone number">
                  <input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number" />
                </Field>
                <Field label="Password (min. 6 characters)">
                  <input type="password" style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Choose a password" />
                </Field>
                <Field label="Rare blood type">
                  <select style={inputStyle} value={form.rareType} onChange={(e) => setForm({ ...form, rareType: e.target.value })}>
                    {RARE_GROUPS.map((g) => <option key={g} style={{ background: "#161821" }}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Gender">
                  <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option style={{ background: "#161821" }}>Male</option>
                    <option style={{ background: "#161821" }}>Female</option>
                    <option style={{ background: "#161821" }}>Other</option>
                  </select>
                </Field>
                <Field label="Donation preference">
                  <div style={{ display: "flex", gap: 8, marginBottom: form.donationType === "Paid" ? 10 : 0 }}>
                    <button type="button" onClick={() => setForm({ ...form, donationType: "Free" })}
                      style={{ ...(form.donationType === "Free" ? glowBtn : ghostBtn), flex: 1, justifyContent: "center", padding: "10px" }}>
                      Free / Voluntary
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, donationType: "Paid" })}
                      style={{ ...(form.donationType === "Paid" ? glowBtn : ghostBtn), flex: 1, justifyContent: "center", padding: "10px" }}>
                      Expect compensation
                    </button>
                  </div>
                  {form.donationType === "Paid" && (
                    <input style={inputStyle} value={form.feeAmount} onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
                      placeholder="Expected amount (₹) for travel/time" type="number" min={0} />
                  )}
                </Field>
                <Field label="District / State">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="District" />
                    <input style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
                  </div>
                </Field>
                <Field label="Location">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={inputStyle} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="Latitude" />
                    <input style={inputStyle} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="Longitude" />
                  </div>
                  <button type="button" onClick={useLocation} style={{ ...ghostBtn, marginTop: 9, fontSize: 12, padding: "7px 13px" }}>
                    <MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Use my current location
                  </button>
                </Field>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending…" : "Send verification code"}
                </motion.button>
              </motion.form>
            )}
            {stage === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p style={{ fontSize: 13.5, color: COLORS.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
                  We sent a verification code to +91 {form.phone}. Check the notification banner (demo, 4 digits)
                  or your SMS inbox (real Twilio, 6 digits).
                </p>
                <Field label="Enter OTP">
                  <input style={inputStyle} value={enteredOtp} onChange={(e) => setEnteredOtp(e.target.value)} placeholder="4 or 6-digit code" maxLength={6} />
                </Field>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} disabled={busy}
                  style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: busy ? 0.6 : 1 }} onClick={verifyOtp}>
                  {busy ? "Verifying…" : "Verify & complete registration"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Card>
        </>
      )}

      {view === "search" && (
        <div>
          <button onClick={() => setView("form")} style={{ ...ghostBtn, marginBottom: 18, fontSize: 12.5 }}>
            ← Back to registration
          </button>
          <RareDonorSearchPage notify={notify} />
        </div>
      )}
    </div>
  );
}

function rareMatchScore(distanceKm) {
  return Math.round(Math.max(45, 100 - distanceKm * 1.5));
}

function RareDonorSearchPage({ notify }) {
  const [rareType, setRareType] = useState(RARE_GROUPS[0]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [results, setResults] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [notified, setNotified] = useState({});

  const useLocation = () => {
    if (!navigator.geolocation) { notify("Geolocation not supported in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(4)); setLng(pos.coords.longitude.toFixed(4)); },
      () => notify("Location access denied — you can enter coordinates manually.")
    );
  };

  const search = async (e) => {
    e.preventDefault();
    setAnalysing(true);
    setResults(null);
    try {
      const rlat = parseFloat(lat) || 22.0797;
      const rlng = parseFloat(lng) || 82.1409;
      const data = await api(`/rare-donors/search?rareType=${encodeURIComponent(rareType)}&lat=${rlat}&lng=${rlng}`);
      await new Promise((r) => setTimeout(r, 900));
      setResults(data);
      notify(data.length ? `Found ${data.length} matching donor(s).` : "No matching rare-type donors found yet.");
    } catch (err) {
      notify(err.message);
    } finally { setAnalysing(false); }
  };

  const notifyDonor = (id) => {
    setNotified((n) => ({ ...n, [id]: true }));
    notify("SMS alert sent to donor (demo mode).");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)", gap: 32 }} className="grid2 recipient-layout">
      <div>
        <SectionLabel>Search for a rare-type donor</SectionLabel>
        <Card>
          <form onSubmit={search}>
            <Field label="Rare blood type">
              <select style={inputStyle} value={rareType} onChange={(e) => setRareType(e.target.value)}>
                {RARE_GROUPS.map((g) => <option key={g} style={{ background: "#161821" }}>{g}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inputStyle} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" />
                <input style={inputStyle} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" />
              </div>
              <button type="button" onClick={useLocation} style={{ ...ghostBtn, marginTop: 9, fontSize: 12, padding: "7px 13px" }}>
                <MapPin size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Use my current location
              </button>
            </Field>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={analysing}
              style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: analysing ? 0.6 : 1 }}>
              <Search size={14} /> {analysing ? "Analysing…" : "Find matching donors"}
            </motion.button>
          </form>
        </Card>
      </div>

      <div>
        <SectionLabel>{results ? "Matching results" : "Matching engine"}</SectionLabel>
        {!results && !analysing && (
          <Card style={{ color: COLORS.textMuted, fontSize: 13.5, textAlign: "center", padding: "50px 20px" }} hover={false}>
            Submit a search to run the matching engine.
          </Card>
        )}
        {analysing && <MatchingAnalysisAnimation group={rareType} />}
        {results && results.length === 0 && (
          <Card style={{ color: COLORS.crimson, fontSize: 13.5 }} hover={false}>
            No verified, available donors of this type found nearby yet.
          </Card>
        )}
        {results && results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {results.map((d, i) => {
              const score = rareMatchScore(d.distanceKm);
              return (
                <motion.div key={d._id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09 }}>
                  <Card style={{ padding: "18px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                          <Pill tone="warn">{d.rareType}</Pill>
                        </div>
                        <div style={{ fontSize: 12.5, color: COLORS.textMuted, display: "flex", gap: 14, flexWrap: "wrap" }}>
                          <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {d.distanceKm.toFixed(1)} km away</span>
                          <span><Clock3 size={11} style={{ verticalAlign: -1 }} /> last donated {daysSince(d.lastDonation)}d ago</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        {notified[d._id] ? (
                          <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Notified</Pill>
                        ) : (
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            style={{ ...glowBtn, padding: "9px 16px", fontSize: 12.5 }} onClick={() => notifyDonor(d._id)}>
                            <Send size={13} /> Notify
                          </motion.button>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          {d.phone ? <>
                            <a href={`tel:+91${d.phone}`} title="Call donor" style={{ ...ghostBtn, padding: "6px 10px", textDecoration: "none" }}><Phone size={13} /></a>
                            <a href={`https://wa.me/91${d.phone}`} target="_blank" rel="noopener noreferrer" title="WhatsApp donor" style={{ ...ghostBtn, padding: "6px 10px", textDecoration: "none" }}><MessageCircle size={13} /></a>
                          </> : <span style={{fontSize:11,color:COLORS.textMuted,alignSelf:"center"}}>Contact details unavailable</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.panelBorder}`,
                                   display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <FlowNode label="Donor" icon={<UserCheck size={13} />} tone="cyan" />
                      <FlowArrow />
                      <FlowNode label="Compatible" icon={<CheckCircle2 size={13} />} tone="good" />
                      <FlowArrow />
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                        <Gauge size={14} color={COLORS.crimson} />
                        <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                            style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${COLORS.crimson}, ${COLORS.cyan})` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, minWidth: 34 }}>{score}%</span>
                      </div>
                      <FlowArrow />
                      <FlowNode label="Recipient" icon={<Heart size={13} />} tone="warn" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditRareProfileForm({ donor, donorToken, notify, onUpdated }) {
  const [form, setForm] = useState({
    name: donor.name, rareType: donor.rareType, gender: donor.gender,
    district: donor.district || donor.city || "", city: donor.district || donor.city || "", state: donor.state || "", lat: donor.lat, lng: donor.lng,
    donationType: donor.donationType || "Free", feeAmount: donor.feeAmount || "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api(`/rare-donors/${donor._id}/profile`, { method: "PATCH", body: JSON.stringify(form) }, donorToken);
      onUpdated(updated);
      notify("Profile updated.");
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <Field label="Full name">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Rare blood type">
          <select style={inputStyle} value={form.rareType} onChange={(e) => setForm({ ...form, rareType: e.target.value })}>
            {RARE_GROUPS.map((g) => <option key={g} style={{ background: "#161821" }}>{g}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option style={{ background: "#161821" }}>Male</option>
            <option style={{ background: "#161821" }}>Female</option>
            <option style={{ background: "#161821" }}>Other</option>
          </select>
        </Field>
        <Field label="District / State">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="District" />
            <input style={inputStyle} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
          </div>
        </Field>
        <Field label="Donation preference">
          <div style={{ display: "flex", gap: 8, marginBottom: form.donationType === "Paid" ? 10 : 0 }}>
            <button type="button" onClick={() => setForm({ ...form, donationType: "Free" })}
              style={{ ...(form.donationType === "Free" ? glowBtn : ghostBtn), flex: 1, justifyContent: "center", padding: "10px" }}>
              Free / Voluntary
            </button>
            <button type="button" onClick={() => setForm({ ...form, donationType: "Paid" })}
              style={{ ...(form.donationType === "Paid" ? glowBtn : ghostBtn), flex: 1, justifyContent: "center", padding: "10px" }}>
              Expect compensation
            </button>
          </div>
          {form.donationType === "Paid" && (
            <input style={inputStyle} value={form.feeAmount} onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
              placeholder="Expected amount (₹) for travel/time" type="number" min={0} />
          )}
        </Field>
        <Field label="Location">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="Latitude" />
            <input style={inputStyle} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="Longitude" />
          </div>
        </Field>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
          style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : "Save changes"}
        </motion.button>
      </form>
    </Card>
  );
}

function ChangeRarePasswordForm({ donor, donorToken, notify }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStage, setForgotStage] = useState("phone");
  const [forgotForm, setForgotForm] = useState({ phone: donor.phone, otp: "", newPassword: "", confirmPassword: "" });
  const [forgotBusy, setForgotBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { notify("New passwords don't match."); return; }
    if (form.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await api(`/rare-donors/${donor._id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      }, donorToken);
      notify("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  const sendForgotOtp = async (e) => {
    e.preventDefault();
    if (!isValidIndianMobile(forgotForm.phone)) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    setForgotBusy(true);
    try {
      const result = await api("/rare-donors/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ phone: forgotForm.phone }) });
      setForgotStage("otp");
      notify(result.demo ? `Demo mode — OTP sent to +91 ${forgotForm.phone}: ${result.code}` : `OTP sent to +91 ${forgotForm.phone}.`);
    } catch (err) { notify(err.message); } finally { setForgotBusy(false); }
  };

  const resetForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotForm.newPassword !== forgotForm.confirmPassword) { notify("New passwords don't match."); return; }
    if (forgotForm.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    setForgotBusy(true);
    try {
      await api("/rare-donors/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({ phone: forgotForm.phone, otp: forgotForm.otp, newPassword: forgotForm.newPassword }),
      });
      notify("Password reset successfully.");
      setForgotStage("done");
    } catch (err) { notify(err.message); } finally { setForgotBusy(false); }
  };

  return (
    <div>
      <Card style={{ maxWidth: 420 }}>
        <form onSubmit={submit}>
          <Field label="Current password">
            <input type="password" style={inputStyle} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password">
            <input type="password" style={inputStyle} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" style={inputStyle} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
            style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Updating…" : "Change password"}
          </motion.button>
        </form>
      </Card>

      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowForgot((s) => !s)}
          style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
          {showForgot ? "Hide" : "Forgot your current password?"}
        </button>
      </div>

      <AnimatePresence>
        {showForgot && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <Card style={{ maxWidth: 420, marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Reset password via OTP</div>
              {forgotStage === "phone" && (
                <form onSubmit={sendForgotOtp}>
                  <Field label="Registered phone number">
                    <input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={inputStyle} value={forgotForm.phone} onChange={(e) => setForgotForm({ ...forgotForm, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number" />
                  </Field>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={forgotBusy}
                    style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: forgotBusy ? 0.6 : 1 }}>
                    {forgotBusy ? "Sending…" : "Send verification code"}
                  </motion.button>
                </form>
              )}
              {forgotStage === "otp" && (
                <form onSubmit={resetForgotPassword}>
                  <p style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                    Check the notification banner (demo mode) or your SMS inbox for the code.
                  </p>
                  <Field label="Enter OTP">
                    <input style={inputStyle} value={forgotForm.otp} onChange={(e) => setForgotForm({ ...forgotForm, otp: e.target.value })} placeholder="4 or 6-digit code" maxLength={6} />
                  </Field>
                  <Field label="New password">
                    <input type="password" style={inputStyle} value={forgotForm.newPassword} onChange={(e) => setForgotForm({ ...forgotForm, newPassword: e.target.value })} />
                  </Field>
                  <Field label="Confirm new password">
                    <input type="password" style={inputStyle} value={forgotForm.confirmPassword} onChange={(e) => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })} />
                  </Field>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={forgotBusy}
                    style={{ ...glowBtn, width: "100%", justifyContent: "center", opacity: forgotBusy ? 0.6 : 1 }}>
                    {forgotBusy ? "Resetting…" : "Reset password"}
                  </motion.button>
                </form>
              )}
              {forgotStage === "done" && (
                <p style={{ fontSize: 13.5, color: COLORS.good }}>
                  <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Password reset. Log out and log back in with your new password.
                </p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LastDonatedRareBloodForm({ donor, donorToken, notify, onUpdated }) {
  const [form, setForm] = useState({ donationDate: "", patientName: "", location: "", hospitalName: "", type: "Blood" });
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api(`/rare-donors/${donor._id}/donations`, {}, donorToken);
      setHistory(data);
    } catch (err) { notify(err.message); }
  }, [donor._id, donorToken, notify]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.donationDate) { notify("Donated date is required."); return; }
    setBusy(true);
    try {
      await api(`/rare-donors/${donor._id}/donations`, { method: "POST", body: JSON.stringify(form) }, donorToken);
      const updatedMe = await api("/rare-donors/me", {}, donorToken);
      onUpdated(updatedMe);
      notify("Donation registered.");
      setForm({ donationDate: "", patientName: "", location: "", hospitalName: "", type: "Blood" });
      loadHistory();
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Last Donated Blood: Register</div>
        <form onSubmit={submit}>
          <Field label="Donated Date (DD/MM/YYYY)">
            <input type="date" style={inputStyle} value={form.donationDate} onChange={(e) => setForm({ ...form, donationDate: e.target.value })} />
          </Field>
          <Field label="Patient Name">
            <input style={inputStyle} value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} />
          </Field>
          <Field label="Location">
            <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Hospital Name">
            <input style={inputStyle} value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
          </Field>
          <Field label="Type of Donation">
            <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option style={{ background: "#161821" }}>Blood</option>
              <option style={{ background: "#161821" }}>Platelets</option>
              <option style={{ background: "#161821" }}>Plasma</option>
            </select>
          </Field>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
            style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Submitting…" : "Submit"}
          </motion.button>
        </form>
      </Card>

      {history && history.length > 0 && (
        <Card hover={false} style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead><tr><th>Date</th><th>Patient</th><th>Location</th><th>Hospital</th><th>Type</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id}>
                  <td>{new Date(h.donationDate).toLocaleDateString()}</td>
                  <td>{h.patientName || "—"}</td>
                  <td>{h.location || "—"}</td>
                  <td>{h.hospitalName || "—"}</td>
                  <td><Pill tone="info">{h.type}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function DeleteRareProfileSection({ donor, donorToken, notify, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteProfile = async () => {
    setBusy(true);
    try {
      await api(`/rare-donors/${donor._id}`, { method: "DELETE" }, donorToken);
      notify("Your profile has been deleted.");
      onDeleted();
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ maxWidth: 420, borderColor: COLORS.crimson + "44" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete Profile / Unsubscribe</div>
      <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
        This permanently deletes your rare-donor profile and donation history from BloodBridge. This
        cannot be undone.
      </p>
      {!confirming ? (
        <button style={{ ...ghostBtn, borderColor: COLORS.crimson + "55", color: COLORS.crimson }} onClick={() => setConfirming(true)}>
          Delete my profile
        </button>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button disabled={busy} style={{ ...glowBtn, opacity: busy ? 0.6 : 1 }} onClick={deleteProfile}>
            {busy ? "Deleting…" : "Yes, delete permanently"}
          </button>
          <button style={ghostBtn} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
    </Card>
  );
}

function RequestsBoard({ notify, requests, refreshAll }) {
  const [requester, setRequester] = useState(() => { try { return JSON.parse(localStorage.getItem("raktmitra_requester") || "null"); } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem("raktmitra_requester_token") || "");
  const [authMode, setAuthMode] = useState("register");
  const [authRecovery, setAuthRecovery] = useState("form");
  const [recovery, setRecovery] = useState({ phone: "", otp: "", newPassword: "", confirmPassword: "" });
  const [authStage, setAuthStage] = useState("form");
  const [authBusy, setAuthBusy] = useState(false);
  const [auth, setAuth] = useState({ name: "", phone: "", password: "", otp: "", district: "", city: "", state: "" });
  const [view, setView] = useState("live");
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(Array.isArray(requests) ? requests : []);
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [districtData, setDistrictData] = useState({});
  useEffect(() => { let live = true; fetch("/india-districts.json").then(r => { if (!r.ok) throw new Error("District list unavailable"); return r.json(); }).then(raw => { const source = Array.isArray(raw) ? raw : (raw.states || raw.data || raw); const map = {}; if (Array.isArray(source)) source.forEach(row => { const name = row.state || row.stateName || row.name; const ds = row.districts || row.children || row.district || []; if (name) map[name] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); else if (source && typeof source === "object") Object.entries(source).forEach(([name, value]) => { const ds = Array.isArray(value) ? value : (value.districts || value.children || []); map[name.replace(/\\s*\\(UT\\)$/i, "")] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); if (live) setDistrictData(map); }).catch(() => {}); return () => { live = false; }; }, []);
  const stateOptions = Object.keys(districtData).sort();
  const districtOptions = state => districtData[state] || [];
  const [form, setForm] = useState({ recipient: "", group: "O+", units: 1, urgency: "Normal", district: "", city: "", state: "", lat: "", lng: "" });
  const states = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
  const field = { ...inputStyle, width: "100%", boxSizing: "border-box" };
  const openCount = items.filter(r => r.status !== "Fulfilled").length;
  const high = items.filter(r => r.urgency === "High" && r.status !== "Fulfilled");
  const normal = items.filter(r => r.urgency !== "High" && r.status !== "Fulfilled");
  const refreshLive = async () => {
    try { const fresh = await api("/requests/public"); setItems(Array.isArray(fresh) ? fresh : []); }
    catch (err) { notify("Live requests couldn't refresh: " + err.message); }
  };
  const refreshMine = async (authToken = token) => {
    if (!authToken) return;
    try { const fresh = await api("/requests/mine", {}, authToken); setMine(Array.isArray(fresh) ? fresh : []); }
    catch (err) { if (err.message.toLowerCase().includes("session")) logout(); else notify(err.message); }
  };
  useEffect(() => { refreshLive(); }, []);
  useEffect(() => { if (token) refreshMine(token); }, [token]);
  const logout = () => {
    localStorage.removeItem("raktmitra_requester_token");
    localStorage.removeItem("raktmitra_requester");
    setToken(""); setRequester(null); setMine([]); setView("live"); setAuthMode("login"); setAuthStage("form");
  };
  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(auth.phone.replace(/\D/g, "").slice(-10))) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    setAuthBusy(true);
    try {
      const result = await api("/requesters/send-otp", { method: "POST", body: JSON.stringify({ phone: auth.phone }) });
      setAuthStage("otp");
      notify(result.demo ? "Demo OTP for " + auth.phone + ": " + result.code + " (valid for 5 minutes)" : "OTP sent.");
    } catch (err) { notify(err.message); } finally { setAuthBusy(false); }
  };
  const submitAuth = async (e) => {
    e.preventDefault();
    if (!isValidIndianMobile(auth.phone)) { notify("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9."); return; }
    if (authMode === "register" && authStage === "form") return sendOtp();
    setAuthBusy(true);
    try {
      const result = await api("/requesters/" + (authMode === "register" ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify(authMode === "register"
          ? { name: auth.name, phone: auth.phone, password: auth.password, otp: auth.otp, district: auth.district || auth.city, city: auth.district || auth.city, state: auth.state }
          : { phone: auth.phone, password: auth.password })
      });
      localStorage.setItem("raktmitra_requester_token", result.token);
      localStorage.setItem("raktmitra_requester", JSON.stringify(result.requester));
      setToken(result.token); setRequester(result.requester); setView("dashboard");
      notify(authMode === "register" ? "Requester account created. Welcome to your dashboard!" : "Welcome back!");
      await refreshLive();
    } catch (err) { notify(err.message); } finally { setAuthBusy(false); }
  };
  const sendRequesterRecoveryOtp = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(recovery.phone)) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    setAuthBusy(true);
    try { const result = await api("/requesters/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ phone: recovery.phone }) }); setAuthRecovery("otp"); notify(result.demo ? `Demo mode — requester password reset OTP for +91 ${recovery.phone}: ${result.code}` : `OTP sent to +91 ${recovery.phone}.`); }
    catch (err) { notify(err.message); } finally { setAuthBusy(false); }
  };
  const resetRequesterPassword = async (e) => {
    e.preventDefault();
    if (recovery.newPassword.length < 6) { notify("New password must be at least 6 characters."); return; }
    if (recovery.newPassword !== recovery.confirmPassword) { notify("New passwords don't match."); return; }
    setAuthBusy(true);
    try { await api("/requesters/forgot-password/reset", { method: "POST", body: JSON.stringify({ phone: recovery.phone, otp: recovery.otp, newPassword: recovery.newPassword }) }); setAuthRecovery("done"); setAuth({ ...auth, phone: recovery.phone, password: "" }); setAuthMode("login"); notify("Requester password reset successfully. Log in with your new password."); }
    catch (err) { notify(err.message); } finally { setAuthBusy(false); }
  };
  const locate = () => {
    if (!navigator.geolocation) { notify("Location is unavailable. Enter coordinates manually."); return; }
    navigator.geolocation.getCurrentPosition(p => setForm(f => ({ ...f, lat: String(p.coords.latitude), lng: String(p.coords.longitude) })), () => notify("Location permission denied. Enter coordinates manually."), { enableHighAccuracy: true, timeout: 10000 });
  };
  const submitRequest = async (e) => {
    e.preventDefault();
    if (!token || !requester) { setView("account"); setAuthMode("register"); notify("Create a requester account or log in to publish a request."); return; }
    if (!form.recipient.trim() || !form.city.trim() || !form.state || !form.lat || !form.lng) { notify("Complete hospital/recipient, district, state and location details."); return; }
    setBusy(true);
    try {
      const result = await api("/requests", { method: "POST", body: JSON.stringify({ ...form, district: form.district || form.city, city: form.district || form.city, units: Number(form.units), lat: Number(form.lat), lng: Number(form.lng) }) }, token);
      notify(result.matches?.length ? "Request published — " + result.matches.length + " eligible donor(s) matched." : "Request published. No eligible verified donor match was found yet.");
      setForm({ recipient: "", group: "O+", units: 1, urgency: "Normal", district: requester.district || requester.city || "", city: requester.district || requester.city || "", state: requester.state || "", lat: "", lng: "" });
      await refreshLive(); await refreshMine(token); await refreshAll();
      setView("dashboard");
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };
  const markFulfilled = async (r) => {
    if (!token) { notify("Log in to your requester account to update your request."); return; }
    if (!window.confirm("Mark this request as fulfilled? This should only be done after the blood need has been met.")) return;
    try {
      await api("/requests/mine/" + r._id + "/fulfill", { method: "PATCH", body: JSON.stringify({}) }, token);
      notify("Request marked as fulfilled.");
      await refreshLive(); await refreshMine(token);
    } catch (err) { notify(err.message); }
  };
  const callNumber = phone => String(phone || "").replace(/[^\d+]/g, "");
  const shareRequest = r => {
    const phone = callNumber(r.requesterPhone);
    const text = "BloodBridge blood request: " + (r.group || "") + " · " + (r.units || 1) + " unit(s) needed at " + [r.recipient, r.district || r.city, r.state].filter(Boolean).join(", ") + ". Priority: " + (r.urgency === "High" ? "HIGH / SOS" : "Normal") + ". Please contact the requester to verify availability.";
    window.open("https://wa.me/?text=" + encodeURIComponent(text + (phone ? " Contact: " + phone : "")), "_blank", "noopener,noreferrer");
  };
  const RequestCard = ({ r, owned = false }) => {
    const sos = r.urgency === "High";
    const phone = callNumber(r.requesterPhone);
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Recently";
    return <article key={r._id} style={{ border: "1px solid " + (sos && r.status !== "Fulfilled" ? "rgba(255,112,77,.9)" : COLORS.panelBorder), borderRadius: 22, padding: "18px clamp(14px,3vw,24px)", background: sos && r.status !== "Fulfilled" ? "linear-gradient(135deg,rgba(255,93,65,.16),rgba(255,255,255,.025))" : COLORS.panel, boxShadow: sos && r.status !== "Fulfilled" ? "0 8px 28px rgba(255,90,55,.08)" : "none", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 54, height: 54, flex: "0 0 54px", borderRadius: "50%", border: "2px solid " + (sos ? "#ff704d" : COLORS.crimson), display: "grid", placeItems: "center", fontWeight: 900, color: sos ? "#ff997e" : COLORS.crimson, fontSize: 15 }}>{r.group || "B+"}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 17 }}>{r.requesterName || (owned ? requester?.name : "") || r.recipient || "Blood requester"}</strong>{sos && r.status !== "Fulfilled" && <Pill tone="warn">CRITICAL · SOS</Pill>}</div><div style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 5 }}>{r.recipient || "Hospital / recipient"} · {[r.district || r.city, r.state].filter(Boolean).join(", ") || "Location to be confirmed"}</div><div style={{ color: COLORS.textMuted, fontSize: 11.5, marginTop: 4 }}>{r.units || 1} unit(s) · {date}</div></div>
        <Pill tone={r.status === "Fulfilled" ? "good" : sos ? "warn" : "info"}>{r.status === "Fulfilled" ? "FULFILLED" : sos ? "HIGH · SOS" : "NORMAL"}</Pill>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        <a href={phone ? "tel:" + phone : undefined} onClick={e => { if (!phone) { e.preventDefault(); notify("The requester hasn't provided a callable number."); } }} style={{ ...glowBtn, textDecoration: "none", justifyContent: "center", fontSize: 12.5, minHeight: 42 }}><Phone size={15}/> Call</a>
        <button type="button" onClick={() => shareRequest(r)} style={{ ...ghostBtn, justifyContent: "center", color: "#4ade80", borderColor: "rgba(74,222,128,.42)", fontSize: 12.5, minHeight: 42 }}><MessageCircle size={15}/> Share on WhatsApp</button>
        {owned && r.status !== "Fulfilled" && <button type="button" onClick={() => markFulfilled(r)} style={{ ...ghostBtn, gridColumn: "1 / -1", justifyContent: "center", minHeight: 42 }}><CheckCircle2 size={15}/> Mark as fulfilled</button>}
      </div>
      {sos && r.status !== "Fulfilled" && <div style={{ borderRadius: 10, padding: "10px 12px", background: "rgba(255,93,65,.12)", color: "#ff9b82", fontSize: 12, lineHeight: 1.6 }}>High emergency request. Please call to confirm the requirement and coordinate with the treating hospital.</div>}
    </article>;
  };
  const authCard = <Card hover={false} style={{ maxWidth: 650, margin: "0 auto", width: "100%" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}><div><SectionLabel>REQUESTER ACCOUNT</SectionLabel><h2 className="headline" style={{ margin: "6px 0 8px", fontSize: 26 }}>{authMode === "register" ? "Create your requester account" : "Requester login"}</h2><p style={{ margin: 0, color: COLORS.textMuted, fontSize: 13, lineHeight: 1.6 }}>A verified mobile number helps you manage your own blood requests and update their status.</p></div><button type="button" style={ghostBtn} onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthStage("form"); }}>{authMode === "register" ? "Already registered? Log in" : "Create account"}</button></div>
    {authRecovery === "form" ? <form onSubmit={submitAuth} style={{ display: "grid", gap: 13, marginTop: 20 }}>
      {authMode === "register" && <><Field label="Full name"><input required maxLength={100} style={field} value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })} placeholder="Requester name"/></Field><Field label="State / Union Territory"><select required style={field} value={auth.state} onChange={e => setAuth({ ...auth, state: e.target.value, district: "", city: "" })}><option value="">Select state</option>{(stateOptions.length ? stateOptions : states).map(st => <option key={st}>{st}</option>)}</select></Field><Field label="District"><select required style={field} value={auth.district || auth.city} onChange={e => setAuth({ ...auth, district: e.target.value, city: e.target.value })} disabled={!auth.state}><option value="">Select district</option>{districtOptions(auth.state).map(dist => <option key={dist}>{dist}</option>)}</select></Field></>}
      <Field label="Mobile number"><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={field} value={auth.phone} onChange={e => setAuth({ ...auth, phone: sanitizeIndianMobile(e.target.value) })} placeholder="10-digit Indian mobile number"/></Field>
      {!(authMode === "register" && authStage === "otp") && <Field label="Password"><input required type="password" minLength={6} style={field} value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="At least 6 characters"/></Field>}
      {authMode === "register" && authStage === "otp" && <Field label="Demo OTP"><input required inputMode="numeric" maxLength={6} style={field} value={auth.otp} onChange={e => setAuth({ ...auth, otp: e.target.value.replace(/\D/g, "").slice(0,6) })} placeholder="Enter the code shown in the demo notification"/></Field>}
      <button disabled={authBusy} style={{ ...glowBtn, justifyContent: "center", minHeight: 46 }}>{authBusy ? "Please wait…" : authMode === "login" ? "Log in to requester dashboard" : authStage === "form" ? "Send demo OTP" : "Verify OTP & create account"}</button>
      {authMode === "register" && authStage === "otp" && <button type="button" style={ghostBtn} onClick={() => setAuthStage("form")}>Change details / resend OTP</button>}
      {authMode === "login" && <button type="button" style={{ background: "none", border: 0, color: COLORS.cyan, cursor: "pointer", fontWeight: 700, justifySelf: "start" }} onClick={() => { setRecovery({ phone: auth.phone, otp: "", newPassword: "", confirmPassword: "" }); setAuthRecovery("phone"); }}>Forgot password?</button>}
    </form> : <div style={{ display: "grid", gap: 13, marginTop: 20 }}>
      {authRecovery === "phone" && <form onSubmit={sendRequesterRecoveryOtp} style={{ display: "grid", gap: 13 }}><p style={{ color: COLORS.textMuted, fontSize: 13 }}>Enter the mobile number on your requester account. This college demo displays the OTP in a notification.</p><Field label="Registered mobile number"><input required inputMode="numeric" maxLength={10} style={field} value={recovery.phone} onChange={e => setRecovery({ ...recovery, phone: e.target.value.replace(/\D/g, "").slice(0,10) })} placeholder="10-digit Indian mobile number"/></Field><button disabled={authBusy} style={{ ...glowBtn, justifyContent: "center" }}>{authBusy ? "Generating OTP…" : "Generate demo OTP"}</button></form>}
      {authRecovery === "otp" && <form onSubmit={resetRequesterPassword} style={{ display: "grid", gap: 13 }}><Field label="Demo OTP"><input required inputMode="numeric" maxLength={6} style={field} value={recovery.otp} onChange={e => setRecovery({ ...recovery, otp: e.target.value.replace(/\D/g, "").slice(0,6) })} placeholder="Enter OTP from notification"/></Field><Field label="New password"><input required type="password" minLength={6} style={field} value={recovery.newPassword} onChange={e => setRecovery({ ...recovery, newPassword: e.target.value })} placeholder="At least 6 characters"/></Field><Field label="Confirm new password"><input required type="password" minLength={6} style={field} value={recovery.confirmPassword} onChange={e => setRecovery({ ...recovery, confirmPassword: e.target.value })} placeholder="Re-enter new password"/></Field><button disabled={authBusy} style={{ ...glowBtn, justifyContent: "center" }}>{authBusy ? "Resetting…" : "Verify OTP & reset password"}</button><button type="button" style={ghostBtn} onClick={() => setAuthRecovery("phone")}>Use another mobile number</button></form>}
      {authRecovery === "done" && <p style={{ color: COLORS.good }}>Password reset. You can log in with your new password.</p>}
      <button type="button" style={ghostBtn} onClick={() => { setAuthRecovery("form"); setAuthMode("login"); }}>Back to requester login</button>
    </div>}
  </Card>;
  const visible = items.filter(r => r.status !== "Fulfilled" && (filter === "all" || (filter === "sos" ? r.urgency === "High" : r.urgency !== "High")));
  return <div id="blood-request-sos" data-blood-request-sos="true" style={{ display: "grid", gap: 20, maxWidth: 1120, margin: "0 auto", scrollMarginTop: 18, minWidth: 0 }}>
    <section style={{ border: "1px solid " + COLORS.panelBorder, borderRadius: 24, padding: "clamp(16px,4vw,34px)", background: "radial-gradient(650px 250px at 100% 0%, rgba(255,87,56,.18), transparent 70%), " + COLORS.panel }}>
      <div style={{ color: COLORS.crimson, fontSize: 11, letterSpacing: 1.7, fontWeight: 900 }}>COMMUNITY BLOOD NEEDS</div>
      <h1 className="headline" style={{ fontSize: "clamp(32px,5vw,46px)", margin: "10px 0" }}>Live <span style={{ color: COLORS.crimson }}>Requests</span></h1>
      <p style={{ color: COLORS.textMuted, lineHeight: 1.7, margin: "0 0 20px", maxWidth: 740 }}>See nearby blood needs, contact requesters, and share verified request details. Requesters must create an account to publish and manage requests.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
        <StatCard label="Open requests" value={openCount} icon={<Activity size={18} color={COLORS.cyan}/>}/>
        <StatCard label="SOS · High emergency" value={high.length} icon={<AlertTriangle size={18} color="#ff704d"/>}/>
        <StatCard label="Normal requests" value={normal.length} icon={<Heart size={18} color={COLORS.good}/>}/>
        <StatCard label="My requests" value={mine.length} icon={<UserCheck size={18} color={COLORS.cyan}/>}/>
      </div>
    </section>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{[["live","Live Requests"],["sos","SOS"],["create","Create a Request"],["dashboard","Requester Dashboard"],...(!token ? [["account","Login / Register"]] : [])].map(([key,label]) => <button key={key} onClick={() => { if ((key === "create" || key === "dashboard") && !token) { setView("account"); setAuthMode("register"); notify("Please create a requester account or log in first."); } else setView(key); }} style={{ ...ghostBtn, background: view === key ? "rgba(255,91,71,.16)" : "transparent", borderColor: view === key ? COLORS.crimson : COLORS.panelBorder }}>{label}</button>)}</div>
      {token && <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 12, color: COLORS.textMuted }}>Signed in as {requester?.name || "Requester"}</span><button onClick={logout} style={ghostBtn}><LogOut size={14}/> Log out</button></div>}
    </div>
    {view === "live" || view === "sos" ? <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}><div><h2 className="headline" style={{ margin: 0, fontSize: 27 }}>{view === "sos" ? "SOS · High Emergency" : "Live Requests"}</h2><p style={{ margin: "5px 0 0", color: COLORS.textMuted, fontSize: 13 }}>Call the requester to confirm details before travelling.</p></div>{view === "live" && <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{[["all","All"],["sos","SOS · High"],["normal","Normal"]].map(([k,label]) => <button key={k} onClick={() => setFilter(k)} style={{ ...ghostBtn, background: filter === k ? "rgba(255,91,71,.16)" : "transparent", borderColor: filter === k ? COLORS.crimson : COLORS.panelBorder }}>{label}</button>)}</div>}</div>
      {(view === "sos" ? items.filter(r => r.urgency === "High" && r.status !== "Fulfilled") : visible).length === 0 ? <Card hover={false}>No active requests in this section yet. If you need blood, create a requester account to publish a request.</Card> : <div style={{ display: "grid", gap: 13 }}>{(view === "sos" ? items.filter(r => r.urgency === "High" && r.status !== "Fulfilled") : visible).map(r => <RequestCard key={r._id} r={r}/>)}</div>}
    </section> : null}
    {view === "create" && (token ? <Card hover={false}><div><SectionLabel>NEW BLOOD REQUEST</SectionLabel><h2 className="headline" style={{ fontSize: 25, margin: "6px 0" }}>Create a blood request</h2><p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.6 }}>Your mobile number comes from your verified requester account. Your account can track this request after publishing.</p></div>
      <form onSubmit={submitRequest} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 13, marginTop: 18, alignItems: "end" }}>
        <Field label="Hospital / recipient reference"><input required maxLength={120} style={field} value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} placeholder="Hospital or recipient reference"/></Field>
        <Field label="Blood group"><select style={field} value={form.group} onChange={e => setForm({ ...form, group: e.target.value })}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Units needed"><input type="number" min="1" max="20" required style={field} value={form.units} onChange={e => setForm({ ...form, units: e.target.value })}/></Field>
        <Field label="Request priority"><select style={field} value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}><option value="Normal">Normal</option><option value="High">High emergency · SOS</option></select></Field>
        <Field label="State / UT"><select required style={field} value={form.state} onChange={e => setForm({ ...form, state: e.target.value, district: "", city: "" })}><option value="">Select state</option>{(stateOptions.length ? stateOptions : states).map(st => <option key={st}>{st}</option>)}</select></Field>
        <Field label="District"><select required style={field} value={form.district || form.city} onChange={e => setForm({ ...form, district: e.target.value, city: e.target.value })} disabled={!form.state}><option value="">Select district</option>{districtOptions(form.state).map(dist => <option key={dist}>{dist}</option>)}</select></Field>
        <Field label="Latitude"><input required style={field} value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="Latitude"/></Field>
        <Field label="Longitude"><input required style={field} value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="Longitude"/></Field>
        <button type="button" onClick={locate} style={{ ...ghostBtn, justifyContent: "center" }}><MapPin size={15}/> Use my location</button>
        <button disabled={busy} style={{ ...glowBtn, justifyContent: "center" }}>{busy ? "Publishing…" : "Publish request"}</button>
      </form><p style={{ color: COLORS.textMuted, fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>High priority is a coordination label, not a medical triage decision. In a life-threatening emergency, contact local emergency services and the treating hospital.</p>
    </Card> : authCard)}
    {view === "account" && (token ? <Card hover={false}><h2 className="headline">You're signed in</h2><p>Your requester account is ready. Create a request or open your dashboard.</p><button style={glowBtn} onClick={() => setView("dashboard")}>Open requester dashboard <ArrowRight size={15}/></button></Card> : authCard)}
    {view === "dashboard" && (token ? <section style={{ display: "grid", gap: 14 }}><div style={{ border: "1px solid " + COLORS.panelBorder, borderRadius: 20, padding: 22, background: COLORS.panel }}><SectionLabel>REQUESTER DASHBOARD</SectionLabel><h2 className="headline" style={{ fontSize: 29, margin: "8px 0" }}>Welcome, {requester?.name || "Requester"}</h2><p style={{ color: COLORS.textMuted, margin: 0 }}>{[requester?.district || requester?.city, requester?.state].filter(Boolean).join(", ")} · +91 {requester?.phone}</p><div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}><button style={glowBtn} onClick={() => { setForm(f => ({ ...f, district: requester?.district || requester?.city || f.district || f.city, city: requester?.district || requester?.city || f.district || f.city, state: requester?.state || f.state })); setView("create"); }}><Plus size={15}/> Create new request</button><button style={ghostBtn} onClick={() => refreshMine(token)}>Refresh dashboard</button></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}><StatCard label="My total requests" value={mine.length} icon={<Activity size={18} color={COLORS.cyan}/>}/><StatCard label="Still open" value={mine.filter(r => r.status !== "Fulfilled").length} icon={<Clock3 size={18} color={COLORS.crimson}/>}/><StatCard label="Fulfilled" value={mine.filter(r => r.status === "Fulfilled").length} icon={<CheckCircle2 size={18} color={COLORS.good}/>}/></div>{mine.length ? <div style={{ display: "grid", gap: 12 }}>{mine.map(r => <RequestCard key={r._id} r={r} owned/>)}</div> : <Card hover={false}><h3>No requests yet</h3><p style={{ color: COLORS.textMuted }}>Your requests will appear here after you publish them.</p><button style={glowBtn} onClick={() => setView("create")}>Create your first request</button></Card>}</section> : authCard)}
  </div>;
}

function MatchingAnalysisAnimation({ group }) {
  const steps = ["Scanning donor pool", "Checking blood-group compatibility", "Calculating live distance", "Ranking by match confidence"];
  return (
    <Card hover={false} style={{ padding: "26px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}>
          <Radio size={18} color={COLORS.cyan} />
        </motion.div>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Running compatibility analysis for {group}…</span>
      </div>
      {steps.map((s, i) => (
        <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.22 }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
          fontSize: 13, color: COLORS.textMuted }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.22 + 0.15 }}
            style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(52,211,153,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CheckCircle2 size={11} color={COLORS.good} />
          </motion.div>
          {s}
        </motion.div>
      ))}
    </Card>
  );
}

function MatchResultCard({ m, index, urgency, notified, onNotify }) {
  const score = visualMatchScore(m.distanceKm, urgency);
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.09 }}>
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
              <Pill tone="warn">{m.group}</Pill>
              <VerificationBadge status={m.bloodGroupStatus} />
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.textMuted, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {m.distanceKm.toFixed(1)} km away</span>
              <span><Clock3 size={11} style={{ verticalAlign: -1 }} /> last donated {daysSince(m.lastDonation)}d ago</span>
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {notified ? (
              <Pill tone="good"><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Notified</Pill>
            ) : (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ ...glowBtn, padding: "9px 16px", fontSize: 12.5 }} onClick={onNotify}>
                <Send size={13} /> Notify
              </motion.button>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              {m.phone ? <>
                <a href={`tel:+91${m.phone}`} title="Call donor" style={{ ...ghostBtn, padding: "6px 10px", textDecoration: "none" }}><Phone size={13} /></a>
                <a href={`https://wa.me/91${m.phone}`} target="_blank" rel="noopener noreferrer" title="WhatsApp donor" style={{ ...ghostBtn, padding: "6px 10px", textDecoration: "none" }}><MessageCircle size={13} /></a>
              </> : <span style={{fontSize:11,color:COLORS.textMuted,alignSelf:"center"}}>Contact hidden until donor consents</span>}
            </div>
          </div>
        </div>

        {/* Animated match-flow: Donor -> Compatibility -> Score -> Recipient */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.panelBorder}`,
                       display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <FlowNode label="Donor" icon={<UserCheck size={13} />} tone="cyan" />
          <FlowArrow />
          <FlowNode label="Compatible" icon={<CheckCircle2 size={13} />} tone="good" />
          <FlowArrow />
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
            <Gauge size={14} color={COLORS.crimson} />
            <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${COLORS.crimson}, ${COLORS.cyan})` }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, minWidth: 34 }}>{score}%</span>
          </div>
          <FlowArrow />
          <FlowNode label="Recipient" icon={<Heart size={13} />} tone="warn" />
        </div>
      </Card>
    </motion.div>
  );
}

const FlowNode = ({ label, icon, tone }) => {
  const map = { cyan: COLORS.cyan, good: COLORS.good, warn: COLORS.crimson };
  const c = map[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 20,
                   background: `${c}15`, border: `1px solid ${c}33`, fontSize: 12, fontWeight: 600, color: c }}>
      {icon} {label}
    </div>
  );
};
const FlowArrow = () => <ArrowRight size={14} color={COLORS.textMuted} style={{ flexShrink: 0 }} />;

// =================================================================
// ADMIN VIEW
// =================================================================
// =================================================================
// CAMPS & BLOOD BANK DIRECTORY — mirrors e-RaktKosh (camps, bank network)
// and Friends2Support (city/state-based browsing) features
// =================================================================
function CampsAndBanksView({ notify, adminToken, goTo }) {
  const [camps, setCamps] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(true);
  const [districtData, setDistrictData] = useState({});
  useEffect(() => { let live = true; fetch("/india-districts.json").then(r => { if (!r.ok) throw new Error("District list unavailable"); return r.json(); }).then(raw => { const source = Array.isArray(raw) ? raw : (raw.states || raw.data || raw); const map = {}; if (Array.isArray(source)) source.forEach(row => { const name = row.state || row.stateName || row.name; const ds = row.districts || row.children || row.district || []; if (name) map[name] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); else if (source && typeof source === "object") Object.entries(source).forEach(([name, value]) => { const ds = Array.isArray(value) ? value : (value.districts || value.children || []); map[name.replace(/\\s*\\(UT\\)$/i, "")] = ds.map(d => typeof d === "string" ? d : (d.name || d.districtName || d.en || "")).filter(Boolean); }); if (live) setDistrictData(map); }).catch(() => {}); return () => { live = false; }; }, []);
  const stateOptions = Object.keys(districtData).sort();
  const districtOptions = state => districtData[state] || [];
  const [directoryTab, setDirectoryTab] = useState("camps");
  const [query, setQuery] = useState("");
  const [campFilter, setCampFilter] = useState("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showOrganizerForm, setShowOrganizerForm] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [organizerToken, setOrganizerToken] = useState(() => localStorage.getItem("raktmitra_camp_organizer_token") || "");
  const [organizerProfile, setOrganizerProfile] = useState(null);
  const [organizerProposals, setOrganizerProposals] = useState([]);
  const [organizerAuthMode, setOrganizerAuthMode] = useState("login");
  const [organizerAuthStage, setOrganizerAuthStage] = useState("form");
  const [organizerAuthBusy, setOrganizerAuthBusy] = useState(false);
  const [organizerAuthForm, setOrganizerAuthForm] = useState({ organizationType: "College / University", organizationName: "", organizerName: "", phone: "", email: "", password: "", confirmPassword: "", otp: "", newPassword: "" });
  const [organizerForm, setOrganizerForm] = useState({ organizationType: "College / University", organizationName: "", organizerName: "", phone: "", email: "", title: "", location: "", city: "", state: "Madhya Pradesh", postalCode: "", date: "", startTime: "09:00", endTime: "13:00", expectedDonors: "50", preferredBloodBank: "", arrangement: "Venue provided by organizer", refreshments: "Organizer will arrange", notes: "" });
  const [form, setForm] = useState({ title: "", organizer: "", location: "", district: "", city: "", state: "", date: "", contactPhone: "" });
  const [bankForm, setBankForm] = useState({ name: "", district: "", city: "", state: "", phone: "", address: "", lat: "", lng: "", openingHours: "" });

  const loadProposals = useCallback(async () => { if (!adminToken) { setProposals([]); return; } try { const data = await api("/camps/proposals/admin", {}, adminToken); setProposals(Array.isArray(data) ? data : []); } catch (err) { notify(err.message); } }, [adminToken, notify]);

  const loadOrganizerProposals = useCallback(async (token = organizerToken) => {
    if (!token) { setOrganizerProposals([]); return; }
    try {
      const data = await api("/camps/proposals/mine", {}, token);
      setOrganizerProposals(Array.isArray(data) ? data : []);
    } catch (err) {
      if (/session expired|login required/i.test(err.message)) {
        localStorage.removeItem("raktmitra_camp_organizer_token");
        setOrganizerToken(""); setOrganizerProfile(null); setOrganizerProposals([]);
      } else notify(err.message);
    }
  }, [organizerToken, notify]);
  useEffect(() => {
    if (!organizerToken) { setOrganizerProfile(null); setOrganizerProposals([]); return; }
    let live = true;
    api("/camp-organizers/me", {}, organizerToken).then(profile => {
      if (live) { setOrganizerProfile(profile); setOrganizerAuthForm(f => ({ ...f, organizationType: profile.organizationType || f.organizationType, organizationName: profile.organizationName || f.organizationName, organizerName: profile.organizerName || f.organizerName, phone: profile.phone || f.phone, email: profile.email || f.email })); setOrganizerForm(f => ({ ...f, organizationType: profile.organizationType || f.organizationType, organizationName: profile.organizationName || f.organizationName, organizerName: profile.organizerName || f.organizerName, phone: profile.phone || f.phone, email: profile.email || f.email })); }
    }).catch(() => {
      if (live) { localStorage.removeItem("raktmitra_camp_organizer_token"); setOrganizerToken(""); setOrganizerProfile(null); }
    });
    loadOrganizerProposals(organizerToken);
    return () => { live = false; };
  }, [organizerToken]);
  const acceptOrganizerSession = (result) => {
    localStorage.setItem("raktmitra_camp_organizer_token", result.token);
    setOrganizerToken(result.token); setOrganizerProfile(result.organizer);
    setOrganizerAuthStage("form"); setOrganizerAuthMode("login");
    setOrganizerAuthForm(f => ({ ...f, organizationType: result.organizer.organizationType || f.organizationType, organizationName: result.organizer.organizationName || f.organizationName, organizerName: result.organizer.organizerName || f.organizerName, phone: result.organizer.phone || f.phone, email: result.organizer.email || f.email, password: "", confirmPassword: "", otp: "" }));
    notify("Camp organizer account ready. You can now manage your camp proposals.");
  };
  const sendOrganizerRegisterOtp = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(organizerAuthForm.phone)) { notify("Enter a valid 10-digit Indian mobile number."); return; }
    if (!organizerAuthForm.organizationName.trim() || !organizerAuthForm.organizerName.trim() || !organizerAuthForm.email.trim()) { notify("Complete the organization, contact name and email first."); return; }
    if (organizerAuthForm.password.length < 8) { notify("Choose a password with at least 8 characters."); return; }
    if (organizerAuthForm.password !== organizerAuthForm.confirmPassword) { notify("Passwords do not match."); return; }
    setOrganizerAuthBusy(true);
    try {
      const result = await api("/camp-organizers/register/send-otp", { method: "POST", body: JSON.stringify({ phone: organizerAuthForm.phone }) });
      setOrganizerAuthStage("otp");
      notify(result.demo ? "Demo verification OTP: " + result.code + " (valid for 5 minutes)." : "Verification OTP sent.");
    } catch (err) { notify(err.message); } finally { setOrganizerAuthBusy(false); }
  };
  const registerCampOrganizer = async (e) => {
    e.preventDefault(); setOrganizerAuthBusy(true);
    try {
      const result = await api("/camp-organizers/register", { method: "POST", body: JSON.stringify(organizerAuthForm) });
      acceptOrganizerSession(result);
    } catch (err) { notify(err.message); } finally { setOrganizerAuthBusy(false); }
  };
  const loginCampOrganizer = async (e) => {
    e.preventDefault();
    if (!organizerAuthForm.phone || !organizerAuthForm.password) { notify("Enter your registered mobile number and password."); return; }
    setOrganizerAuthBusy(true);
    try { acceptOrganizerSession(await api("/camp-organizers/login", { method: "POST", body: JSON.stringify({ phone: organizerAuthForm.phone, password: organizerAuthForm.password }) })); }
    catch (err) { notify(err.message); } finally { setOrganizerAuthBusy(false); }
  };
  const sendOrganizerRecoveryOtp = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(organizerAuthForm.phone)) { notify("Enter the mobile number linked to your organizer account."); return; }
    setOrganizerAuthBusy(true);
    try {
      const result = await api("/camp-organizers/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ phone: organizerAuthForm.phone }) });
      setOrganizerAuthStage("reset");
      notify(result.demo ? "Demo password reset OTP: " + result.code + " (valid for 5 minutes)." : "Password reset OTP sent.");
    } catch (err) { notify(err.message); } finally { setOrganizerAuthBusy(false); }
  };
  const resetOrganizerPassword = async (e) => {
    e.preventDefault();
    if (organizerAuthForm.newPassword.length < 8) { notify("New password must be at least 8 characters."); return; }
    if (organizerAuthForm.newPassword !== organizerAuthForm.confirmPassword) { notify("New passwords do not match."); return; }
    setOrganizerAuthBusy(true);
    try {
      await api("/camp-organizers/forgot-password/reset", { method: "POST", body: JSON.stringify({ phone: organizerAuthForm.phone, otp: organizerAuthForm.otp, newPassword: organizerAuthForm.newPassword }) });
      setOrganizerAuthMode("login"); setOrganizerAuthStage("form");
      setOrganizerAuthForm(f => ({ ...f, password: "", confirmPassword: "", newPassword: "", otp: "" }));
      notify("Password reset successfully. Log in with your new password.");
    } catch (err) { notify(err.message); } finally { setOrganizerAuthBusy(false); }
  };
  const logoutCampOrganizer = () => {
    localStorage.removeItem("raktmitra_camp_organizer_token");
    setOrganizerToken(""); setOrganizerProfile(null); setOrganizerProposals([]);
    setShowOrganizerForm(false); setOrganizerAuthMode("login"); setOrganizerAuthStage("form");
    notify("Logged out of camp organizer portal.");
  };
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
  useEffect(() => { loadProposals(); }, [loadProposals]);

  const addCamp = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.location.trim() || !form.date) { notify("Camp title, venue, and date are required."); return; }
    try {
      await api("/camps", { method: "POST", body: JSON.stringify({ ...form, district: form.district || form.city, city: form.district || form.city }) }, adminToken);
      notify("Donation camp added.");
      setForm({ title: "", organizer: "", location: "", city: "", state: "", date: "", contactPhone: "" });
      setShowForm(false); loadCamps();
    } catch (err) { notify(err.message); }
  };
  const submitProposal = async (e) => {
    e.preventDefault();
    if (!organizerToken) { notify("Log in to your camp organizer account before submitting a proposal."); return; }
    if (!organizerForm.organizationName.trim() || !organizerForm.organizerName.trim() || !organizerForm.phone.trim() || !organizerForm.email.trim() || !organizerForm.title.trim() || !organizerForm.location.trim() || !organizerForm.city.trim() || !organizerForm.date) { notify("Complete all required organiser and camp details."); return; }
    if (organizerForm.endTime <= organizerForm.startTime) { notify("Camp end time must be after start time."); return; }
    setProposalBusy(true);
    try {
      const result = await api("/camps/proposals", { method: "POST", body: JSON.stringify({ ...organizerForm, organizationType: organizerProfile?.organizationType || organizerForm.organizationType, organizationName: organizerProfile?.organizationName || organizerForm.organizationName, organizerName: organizerProfile?.organizerName || organizerForm.organizerName, phone: organizerProfile?.phone || organizerForm.phone, email: organizerProfile?.email || organizerForm.email, expectedDonors: Number(organizerForm.expectedDonors) }) }, organizerToken);
      notify("Camp proposal submitted. Reference: " + result.reference + ". It will appear publicly only after review and blood-bank coordination.");
      setOrganizerForm({ organizationType: organizerProfile?.organizationType || "College / University", organizationName: organizerProfile?.organizationName || "", organizerName: organizerProfile?.organizerName || "", phone: organizerProfile?.phone || "", email: organizerProfile?.email || "", title: "", location: "", city: "", state: "Madhya Pradesh", postalCode: "", date: "", startTime: "09:00", endTime: "13:00", expectedDonors: "50", preferredBloodBank: "", arrangement: "Venue provided by organizer", refreshments: "Organizer will arrange", notes: "" });
      setShowOrganizerForm(false); loadOrganizerProposals(organizerToken);
    } catch (err) { notify(err.message); } finally { setProposalBusy(false); }
  };
  const reviewProposal = async (id, action, reason = "") => {
    try { await api("/camps/proposals/" + id + "/review", { method: "PATCH", body: JSON.stringify({ action, reason }) }, adminToken); notify(action === "approve" ? "Proposal approved and camp published." : "Proposal returned/rejected."); loadProposals(); loadCamps(); }
    catch (err) { notify(err.message); }
  };
  const removeCamp = async (id) => {
    try { await api("/camps/" + id, { method: "DELETE" }, adminToken); notify("Camp removed."); loadCamps(); }
    catch (err) { notify(err.message); }
  };
  const addBank = async (e) => {
    e.preventDefault();
    if (!bankForm.name.trim()) { notify("Blood bank name is required."); return; }
    try {
      await api("/blood-banks", { method: "POST", body: JSON.stringify({ ...bankForm, district: bankForm.district || bankForm.city, city: bankForm.district || bankForm.city }) }, adminToken);
      notify("Blood bank added.");
      setBankForm({ name: "", city: "", state: "", phone: "", address: "", lat: "", lng: "", openingHours: "" });
      setShowBankForm(false); loadBanks();
    } catch (err) { notify(err.message); }
  };
  const removeBank = async (id) => {
    try { await api("/blood-banks/" + id, { method: "DELETE" }, adminToken); notify("Blood bank removed."); loadBanks(); }
    catch (err) { notify(err.message); }
  };

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
  const filteredBanks = banks.filter((b) => [b.name, b.city, b.state, b.phone, b.address, b.openingHours].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));

  const panel = { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, background: "#11151b", boxShadow: "0 5px 18px rgba(0,0,0,0.12)" };
  const buttonStyle = (active) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, padding: "10px 13px", fontSize: 12, fontWeight: 750, cursor: "pointer", color: active ? "#fff" : COLORS.textMuted, background: active ? "linear-gradient(135deg, " + COLORS.crimson + ", " + COLORS.crimsonDeep + ")" : "rgba(255,255,255,0.035)", border: active ? "1px solid rgba(255,90,110,0.35)" : "1px solid rgba(255,255,255,0.08)", boxShadow: active ? "0 8px 22px rgba(255,59,84,0.18)" : "none", textDecoration: "none" });
  const field = { ...inputStyle, width: "100%", boxSizing: "border-box" };
  const changeTab = (tab) => { setDirectoryTab(tab); setQuery(""); setShowForm(false); setShowBankForm(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 25 }}>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ ...panel, position: "relative", overflow: "hidden", padding: "clamp(22px, 4vw, 38px)" }}>
        <div aria-hidden="true" style={{ position: "absolute", width: 5, left: 0, top: 0, bottom: 0, background: COLORS.crimson }} />
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
            <button onClick={() => changeTab("banks")} style={buttonStyle(directoryTab === "banks")}><Building2 size={15} /> Hospital blood banks</button>
            <button onClick={() => { changeTab("camps"); setCampFilter("upcoming"); }} style={buttonStyle(directoryTab === "camps")}><Calendar size={15} /> Active blood distribution drives</button>
            <a
              href="mailto:support.bloodbridge@gmail.com?subject=Blood%20Donation%20Centre%20or%20Hospital%20Not%20Listed&body=Hi%20BloodBridge%20Team%2C%0A%0AI%20would%20like%20to%20report%20a%20blood%20donation%20centre%20or%20hospital%20that%20is%20not%20mentioned%20on%20the%20platform%3A%0A%0AFacility%20Name%3A%20%0ALocation%2FCity%3A%20%0AContact%20Details%3A%20%0AAdditional%20Info%3A%20%0A"
              style={{
                ...buttonStyle(false),
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "#ff9b9b",
                background: "rgba(239, 68, 68, 0.08)",
              }}
            >
              <Mail size={14} /> Hospital not listed? Report via email
            </a>
          </div>
        </div>
      </motion.section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Upcoming camps", value: upcomingCount, note: "Scheduled for today or later", icon: <Calendar size={17} />, color: COLORS.crimson },
          { label: "Blood banks", value: banks.length, note: "Directory listings", icon: <Building2 size={17} />, color: COLORS.cyan },
          { label: "Public phone numbers", value: camps.filter((c) => c.contactPhone).length + banks.filter((b) => b.phone).length, note: "Listings with a contact number", icon: <Phone size={17} />, color: COLORS.good },
        ].map((s) => (
          <div key={s.label} style={{ ...panel, padding: "16px 17px", minWidth: 0 }}>
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
          <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 15, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => changeTab("banks")} style={buttonStyle(directoryTab === "banks")}><Building2 size={14} /> Blood Banks <span>{banks.length}</span></button>
            <button onClick={() => changeTab("camps")} style={buttonStyle(directoryTab === "camps")}><Calendar size={14} /> Distribution Drives <span>{camps.length}</span></button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 17 }}>
          <div style={{ position: "relative", flex: "1 1 245px", minWidth: 0 }}>
            <Search size={16} color={COLORS.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input aria-label={directoryTab === "camps" ? "Search donation camps" : "Search blood banks"} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={directoryTab === "camps" ? "Search camps, venues, cities…" : "Search banks, cities, states…"}
              style={{ ...field, paddingLeft: 42, minHeight: 44, borderRadius: 13 }} />
          </div>
          {directoryTab === "camps" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["upcoming", "Upcoming"], ["all", "All dates"], ["past", "Past"]].map(([key, label]) => <button key={key} onClick={() => setCampFilter(key)} style={{ ...buttonStyle(campFilter === key), padding: "10px 11px" }}>{label}</button>)}
          </div>}
          {directoryTab === "camps" && <button onClick={() => { if (!organizerToken) { setOrganizerAuthMode("register"); setOrganizerAuthStage("form"); } else setShowOrganizerForm((v) => !v); }} style={buttonStyle(!showOrganizerForm)}><Plus size={15} /> {showOrganizerForm ? "Close organiser form" : "Organise a camp"}</button>}
          {adminToken && <button onClick={() => directoryTab === "camps" ? setShowForm((v) => !v) : setShowBankForm((v) => !v)} style={buttonStyle(true)}><Plus size={15} /> {directoryTab === "camps" ? (showForm ? "Close form" : "Add camp") : (showBankForm ? "Close form" : "Add bank")}</button>}
        </div>

        {directoryTab === "camps" && (
          <section style={{ ...panel, padding: "clamp(16px,3vw,24px)", borderColor: organizerToken ? "rgba(52,211,153,.3)" : "rgba(255,59,84,.24)" }}>
            {!organizerToken ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><div style={{ color: COLORS.crimson, fontSize: 10, letterSpacing: 1.2, fontWeight: 900 }}>CAMP ORGANIZER PORTAL</div><h2 className="headline" style={{ margin: "7px 0", fontSize: 24 }}>{organizerAuthMode === "register" ? "Create your organizer account" : organizerAuthMode === "forgot" ? "Recover your account" : "Organizer sign in"}</h2><p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.65, margin: 0, maxWidth: 650 }}>Create an organizer account for your college, company, NGO, or community group to submit blood donation camps and track their approval status.</p></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" style={buttonStyle(organizerAuthMode === "login")} onClick={() => { setOrganizerAuthMode("login"); setOrganizerAuthStage("form"); }}>Log in</button>
                    <button type="button" style={buttonStyle(organizerAuthMode === "register")} onClick={() => { setOrganizerAuthMode("register"); setOrganizerAuthStage("form"); }}>Create account</button>
                  </div>
                </div>
                {organizerAuthMode === "register" && organizerAuthStage !== "otp" && (
                  <form onSubmit={sendOrganizerRegisterOtp} className="grid2" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginTop: 18 }}>
                    <Field label="Organization type *"><select required style={field} value={organizerAuthForm.organizationType} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,organizationType:e.target.value})}><option>College / University</option><option>Company / Workplace</option><option>NGO / Charitable trust</option><option>Community / Resident group</option><option>Hospital / Healthcare organisation</option><option>Other organisation</option></select></Field>
                    <Field label="Organization name *"><input required maxLength={160} style={field} value={organizerAuthForm.organizationName} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,organizationName:e.target.value})} placeholder="College, company or trust"/></Field>
                    <Field label="Organizer full name *"><input required maxLength={100} style={field} value={organizerAuthForm.organizerName} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,organizerName:e.target.value})}/></Field>
                    <Field label="Mobile number *"><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={field} value={organizerAuthForm.phone} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,phone:e.target.value.replace(/\D/g,"").slice(0,10)})} placeholder="10-digit Indian mobile"/></Field>
                    <Field label="Email address *"><input required type="email" style={field} value={organizerAuthForm.email} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,email:e.target.value})}/></Field>
                    <Field label="Password (min 8 characters) *"><input required minLength={8} type="password" style={field} value={organizerAuthForm.password} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,password:e.target.value})}/></Field>
                    <Field label="Confirm password *"><input required minLength={8} type="password" style={field} value={organizerAuthForm.confirmPassword} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,confirmPassword:e.target.value})}/></Field>
                    <div style={{ display:"flex", alignItems:"end" }}><button disabled={organizerAuthBusy} type="submit" style={{...glowBtn,justifyContent:"center",width:"100%",opacity:organizerAuthBusy ? 0.65 : 1}}>{organizerAuthBusy?"Generating OTP…":"Verify mobile with demo OTP"} <ArrowRight size={14}/></button></div>
                  </form>
                )}
                {organizerAuthMode === "register" && organizerAuthStage === "otp" && (
                  <form onSubmit={registerCampOrganizer} style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:18,alignItems:"end" }}>
                    <Field label={"Demo OTP sent for +91 " + organizerAuthForm.phone}><input required inputMode="numeric" maxLength={4} pattern="[0-9]{4}" style={field} value={organizerAuthForm.otp} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,otp:e.target.value.replace(/\D/g,"").slice(0,4)})} placeholder="4-digit OTP"/></Field>
                    <button disabled={organizerAuthBusy} type="submit" style={{...glowBtn,justifyContent:"center",minHeight:44}}>{organizerAuthBusy?"Verifying…":"Verify & create account"}</button>
                    <button type="button" style={ghostBtn} onClick={()=>setOrganizerAuthStage("form")}>Edit details</button>
                  </form>
                )}
                {organizerAuthMode === "login" && (
                  <form onSubmit={loginCampOrganizer} style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:18,alignItems:"end" }}>
                    <Field label="Registered mobile number"><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={field} value={organizerAuthForm.phone} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,phone:e.target.value.replace(/\D/g,"").slice(0,10)})} placeholder="10-digit mobile"/></Field>
                    <Field label="Password"><input required type="password" style={field} value={organizerAuthForm.password} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,password:e.target.value})}/></Field>
                    <button disabled={organizerAuthBusy} type="submit" style={{...glowBtn,justifyContent:"center",minHeight:44}}>{organizerAuthBusy?"Signing in…":"Login to portal"}</button>
                    <button type="button" style={{...ghostBtn,minHeight:44}} onClick={()=>{setOrganizerAuthMode("forgot");setOrganizerAuthStage("form");}}>Forgot password?</button>
                  </form>
                )}
                {organizerAuthMode === "forgot" && (
                  <div style={{ marginTop:18 }}>
                    {organizerAuthStage !== "reset" ? <form onSubmit={sendOrganizerRecoveryOtp} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,alignItems:"end"}}>
                      <Field label="Mobile number linked to account"><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} style={field} value={organizerAuthForm.phone} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,phone:e.target.value.replace(/\D/g,"").slice(0,10)})} placeholder="10-digit mobile"/></Field>
                      <button disabled={organizerAuthBusy} type="submit" style={{...glowBtn,justifyContent:"center",minHeight:44}}>{organizerAuthBusy?"Generating OTP…":"Send demo reset OTP"}</button>
                      <button type="button" style={ghostBtn} onClick={()=>{setOrganizerAuthMode("login");setOrganizerAuthStage("form");}}>Back to login</button>
                    </form> : <form onSubmit={resetOrganizerPassword} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,alignItems:"end"}}>
                      <Field label="Demo reset OTP"><input required inputMode="numeric" maxLength={4} pattern="[0-9]{4}" style={field} value={organizerAuthForm.otp} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,otp:e.target.value.replace(/\D/g,"").slice(0,4)})}/></Field>
                      <Field label="New password (min 8 characters)"><input required minLength={8} type="password" style={field} value={organizerAuthForm.newPassword} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,newPassword:e.target.value})}/></Field>
                      <Field label="Confirm new password"><input required minLength={8} type="password" style={field} value={organizerAuthForm.confirmPassword} onChange={e=>setOrganizerAuthForm({...organizerAuthForm,confirmPassword:e.target.value})}/></Field>
                      <button disabled={organizerAuthBusy} type="submit" style={{...glowBtn,justifyContent:"center",minHeight:44}}>{organizerAuthBusy?"Resetting…":"Reset password"}</button>
                    </form>}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div><div style={{color:COLORS.good,fontSize:10,letterSpacing:1.2,fontWeight:900}}>ORGANIZER DASHBOARD</div><h2 className="headline" style={{fontSize:24,margin:"7px 0"}}>{organizerProfile?.organizationName || "Your organization"}</h2><div style={{fontSize:12.5,color:COLORS.textMuted}}>{organizerProfile?.organizerName} · +91 {organizerProfile?.phone} · {organizerProfile?.email}</div></div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" style={buttonStyle(true)} onClick={()=>setShowOrganizerForm(v=>!v)}><Plus size={14}/>{showOrganizerForm?"Close camp form":"Propose a camp"}</button><button type="button" style={buttonStyle(false)} onClick={()=>loadOrganizerProposals(organizerToken)}>Refresh status</button><button type="button" style={buttonStyle(false)} onClick={logoutCampOrganizer}><LogOut size={14}/>Log out</button></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:18}}>
                  {[["Total proposals",organizerProposals.length],["Pending review",organizerProposals.filter(p=>["pending","under_review"].includes(p.status)).length],["Approved",organizerProposals.filter(p=>p.status==="approved").length],["Needs changes",organizerProposals.filter(p=>p.status==="rejected").length]].map(([label,value])=><div key={label} style={{border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:13,background:"rgba(255,255,255,.025)"}}><div style={{fontSize:11,color:COLORS.textMuted}}>{label}</div><strong style={{fontSize:25,display:"block",marginTop:4}}>{value}</strong></div>)}
                </div>
                <div style={{marginTop:17,fontSize:15,fontWeight:850}}>Your camp proposals</div>
                {organizerProposals.length===0 ? <p style={{fontSize:12.5,color:COLORS.textMuted,lineHeight:1.7}}>No proposals yet. Choose <b>Propose a camp</b> to submit your first camp for admin review. Approved camps become visible in the public directory.</p> : <div style={{display:"grid",gap:9,marginTop:10}}>{organizerProposals.map(p=><article key={p._id} style={{border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:13,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>{p.title}</strong><div style={{fontSize:12,color:COLORS.textMuted,marginTop:4}}>{p.city}, {p.state} · {new Date(p.date).toLocaleDateString()} · {p.expectedDonors} expected donors</div><div style={{fontSize:11,color:COLORS.textMuted,marginTop:4}}>Reference: {p.reference}</div>{p.reviewReason&&<div style={{fontSize:12,color:COLORS.warn,marginTop:5}}>Review note: {p.reviewReason}</div>}</div><Pill tone={p.status==="approved"?"good":p.status==="rejected"?"warn":"info"}>{String(p.status||"pending").replaceAll("_"," ").toUpperCase()}</Pill></article>)}</div>}
              </>
            )}
          </section>
        )}
        <AnimatePresence initial={false}>
          {directoryTab === "camps" && showOrganizerForm && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: 17 }}>
            <div style={{ ...panel, padding: 21 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><Calendar size={20} color={COLORS.crimson}/><div style={{ fontSize: 18, fontWeight: 850 }}>Propose a blood donation camp</div></div>
              <p style={{ margin: "0 0 17px", fontSize: 12.5, color: COLORS.textMuted, lineHeight: 1.7 }}>For colleges, companies, community groups and eligible organisations. Submissions are reviewed and coordinated with a blood bank before they can be published. This form is a request, not legal approval to collect blood.</p>
              <form onSubmit={submitProposal} className="grid2" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 13 }}>
                <Field label="Organisation type *"><select style={field} value={organizerForm.organizationType} onChange={e=>setOrganizerForm({...organizerForm,organizationType:e.target.value})}><option>College / University</option><option>Company / Workplace</option><option>NGO / Charitable trust</option><option>Community / Resident group</option><option>Hospital / Healthcare organisation</option><option>Other organisation</option></select></Field>
                <Field label="Organisation name *"><input style={field} required maxLength={160} value={organizerForm.organizationName} onChange={e=>setOrganizerForm({...organizerForm,organizationName:e.target.value})} placeholder="College, company, trust…" /></Field>
                <Field label="Organiser full name *"><input style={field} required maxLength={100} value={organizerForm.organizerName} onChange={e=>setOrganizerForm({...organizerForm,organizerName:e.target.value})} /></Field>
                <Field label="Organiser mobile *"><input style={field} required type="tel" pattern="[0-9+() -]{10,18}" value={organizerForm.phone} onChange={e=>setOrganizerForm({...organizerForm,phone:e.target.value})} placeholder="Contact number" /></Field>
                <Field label="Organiser email *"><input style={field} required type="email" value={organizerForm.email} onChange={e=>setOrganizerForm({...organizerForm,email:e.target.value})} /></Field>
                <Field label="Camp name *"><input style={field} required maxLength={160} value={organizerForm.title} onChange={e=>setOrganizerForm({...organizerForm,title:e.target.value})} placeholder="Community blood donation camp" /></Field>
                <Field label="Venue / full address *"><input style={field} required maxLength={300} value={organizerForm.location} onChange={e=>setOrganizerForm({...organizerForm,location:e.target.value})} placeholder="Building, street and landmark" /></Field>
                <Field label="State / UT *"><select style={field} required value={organizerForm.state} onChange={e=>setOrganizerForm({...organizerForm,state:e.target.value,district:"",city:""})}><option value="">Select state</option>{(stateOptions.length?stateOptions:["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"]).map(st=><option key={st}>{st}</option>)}</select></Field><Field label="District *"><select style={field} required value={organizerForm.district||organizerForm.city} onChange={e=>setOrganizerForm({...organizerForm,district:e.target.value,city:e.target.value})} disabled={!organizerForm.state}><option value="">Select district</option>{districtOptions(organizerForm.state).map(x=><option key={x}>{x}</option>)}</select></Field>
                <Field label="PIN code"><input style={field} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={organizerForm.postalCode} onChange={e=>setOrganizerForm({...organizerForm,postalCode:e.target.value})} placeholder="6-digit PIN" /></Field>
                <Field label="Proposed date *"><input style={field} type="date" min={new Date().toISOString().slice(0,10)} required value={organizerForm.date} onChange={e=>setOrganizerForm({...organizerForm,date:e.target.value})} /></Field>
                <Field label="Expected donors *"><input style={field} type="number" min="1" max="5000" required value={organizerForm.expectedDonors} onChange={e=>setOrganizerForm({...organizerForm,expectedDonors:e.target.value})} /></Field>
                <Field label="Start time"><input style={field} type="time" required value={organizerForm.startTime} onChange={e=>setOrganizerForm({...organizerForm,startTime:e.target.value})} /></Field>
                <Field label="End time"><input style={field} type="time" required value={organizerForm.endTime} onChange={e=>setOrganizerForm({...organizerForm,endTime:e.target.value})} /></Field>
                <Field label="Preferred blood bank (optional)"><input style={field} value={organizerForm.preferredBloodBank} onChange={e=>setOrganizerForm({...organizerForm,preferredBloodBank:e.target.value})} placeholder="Name, if already coordinated" /></Field>
                <Field label="Venue / transport arrangement"><select style={field} value={organizerForm.arrangement} onChange={e=>setOrganizerForm({...organizerForm,arrangement:e.target.value})}><option>Venue provided by organizer</option><option>Request blood bank guidance</option><option>Need mobile collection setup</option><option>Not decided</option></select></Field>
                <Field label="Refreshments"><select style={field} value={organizerForm.refreshments} onChange={e=>setOrganizerForm({...organizerForm,refreshments:e.target.value})}><option>Organizer will arrange</option><option>Request guidance</option><option>Not decided</option></select></Field>
                <Field label="Notes / support needed"><input style={field} maxLength={1000} value={organizerForm.notes} onChange={e=>setOrganizerForm({...organizerForm,notes:e.target.value})} placeholder="Volunteer support, accessibility, other details" /></Field>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 9, flexWrap: "wrap" }}><button type="button" onClick={()=>setShowOrganizerForm(false)} style={buttonStyle(false)}>Cancel</button><button type="submit" disabled={proposalBusy} style={{...glowBtn,justifyContent:"center",opacity:proposalBusy ? 0.65 : 1}}>{proposalBusy?"Submitting…":"Submit for review"} <ArrowRight size={14}/></button></div>
              </form>
            </div>
          </motion.div>}
          {adminToken && proposals.filter(p=>p.status==="pending"||p.status==="under_review").length>0 && <div style={{...panel,padding:18,marginBottom:17}}>
            <div style={{fontSize:16,fontWeight:850,marginBottom:12}}>Camp proposals awaiting review <span style={{color:COLORS.crimson}}>({proposals.filter(p=>p.status==="pending"||p.status==="under_review").length})</span></div>
            <div style={{display:"grid",gap:10}}>{proposals.filter(p=>p.status==="pending"||p.status==="under_review").map(p=><div key={p._id} style={{border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:13}}>
              <div style={{fontWeight:800}}>{p.title} · {p.organizationName}</div><div style={{fontSize:12,color:COLORS.textMuted,marginTop:5}}>{p.city}, {p.state} · {new Date(p.date).toLocaleDateString()} · {p.expectedDonors} expected donors</div><div style={{fontSize:12,color:COLORS.textMuted,marginTop:4}}>{p.organizerName} · {p.phone} · {p.email}</div><div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}><button onClick={()=>reviewProposal(p._id,"approve")} style={buttonStyle(true)}>Approve &amp; publish</button><button onClick={()=>reviewProposal(p._id,"reject","Please coordinate with an eligible blood bank and resubmit.")} style={buttonStyle(false)}>Return for changes</button></div>
            </div>)}</div>
          </div>}
          {directoryTab === "camps" && showForm && adminToken && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 17 }}>
            <div style={{ ...panel, padding: 21 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5 }}>Create a donation camp</div>
              <p style={{ margin: "0 0 17px", fontSize: 12, color: COLORS.textMuted }}>Add a clear venue and current contact details for donors.</p>
              <form onSubmit={addCamp} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 13 }} className="grid2">
                <Field label="Camp title *"><input style={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Community blood donation drive" required /></Field>
                <Field label="Organizer"><input style={field} value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} placeholder="Hospital, college or organization" /></Field>
                <Field label="Venue / address *"><input style={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Street, building or landmark" required /></Field>
                <Field label="Date *"><input type="date" min={new Date().toISOString().slice(0, 10)} style={field} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
                <Field label="District"><select style={field} value={form.district||form.city} onChange={e=>setForm({...form,district:e.target.value,city:e.target.value})} disabled={!form.state}><option value="">Select district</option>{districtOptions(form.state).map(x=><option key={x}>{x}</option>)}</select></Field>
                <Field label="State"><input style={field} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" /></Field>
                <Field label="Organizer phone"><input type="tel" style={field} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="Public contact number" /></Field>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}><button type="submit" style={{ ...glowBtn, flex: 1, justifyContent: "center", minHeight: 43 }}>Publish camp <ArrowRight size={14} /></button><button type="button" onClick={() => setShowForm(false)} style={buttonStyle(false)}>Cancel</button></div>
              </form>
            </div>
          </motion.div>}
          {directoryTab === "banks" && showBankForm && adminToken && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginBottom: 17 }}>
            <div style={{ ...panel, padding: 21 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5 }}>Register a blood bank</div>
              <p style={{ margin: "0 0 17px", fontSize: 12, color: COLORS.textMuted }}>Keep the directory useful with accurate public contact details.</p>
              <form onSubmit={addBank} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 13 }} className="grid2">
                <Field label="Blood bank name *"><input style={field} value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} placeholder="Registered blood bank name" required /></Field>
                <Field label="Public phone"><input type="tel" style={field} value={bankForm.phone} onChange={(e) => setBankForm({ ...bankForm, phone: e.target.value })} placeholder="Contact number" /></Field>
                <Field label="District"><select style={field} value={bankForm.district||bankForm.city} onChange={e=>setBankForm({...bankForm,district:e.target.value,city:e.target.value})} disabled={!bankForm.state}><option value="">Select district</option>{districtOptions(bankForm.state).map(x=><option key={x}>{x}</option>)}</select></Field>
                <Field label="State"><input style={field} value={bankForm.state} onChange={(e) => setBankForm({ ...bankForm, state: e.target.value })} placeholder="State" /></Field>
                <Field label="Public address"><input style={field} value={bankForm.address} onChange={(e) => setBankForm({ ...bankForm, address: e.target.value })} placeholder="Street / locality" /></Field>
                <Field label="Opening hours"><input style={field} value={bankForm.openingHours} onChange={(e) => setBankForm({ ...bankForm, openingHours: e.target.value })} placeholder="e.g. Mon–Sat, 9 AM–5 PM" /></Field>
                <Field label="Latitude (optional)"><input type="number" step="any" style={field} value={bankForm.lat} onChange={(e) => setBankForm({ ...bankForm, lat: e.target.value })} placeholder="e.g. 22.0797" /></Field>
                <Field label="Longitude (optional)"><input type="number" step="any" style={field} value={bankForm.lng} onChange={(e) => setBankForm({ ...bankForm, lng: e.target.value })} placeholder="e.g. 82.1391" /></Field>
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setShowBankForm(false)} style={buttonStyle(false)}>Cancel</button><button type="submit" style={{ ...glowBtn, justifyContent: "center" }}>Register bank <ArrowRight size={14} /></button></div>
              </form>
            </div>
          </motion.div>}
        </AnimatePresence>

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
                  return <motion.article key={c._id || c.title + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.24) }}
                    style={{ ...panel, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div style={{ height: 4, background: isPast ? "rgba(255,255,255,0.13)" : "linear-gradient(90deg, " + COLORS.crimson + ", #ff8a70, " + COLORS.cyan + ")" }} />
                    <div style={{ padding: 19, display: "flex", flexDirection: "column", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "5px 8px", fontSize: 9, letterSpacing: 0.7, fontWeight: 850, textTransform: "uppercase", color: isPast ? COLORS.textMuted : COLORS.good, background: isPast ? "rgba(255,255,255,0.06)" : "rgba(52,211,153,0.1)", border: "1px solid " + (isPast ? "rgba(255,255,255,0.08)" : "rgba(52,211,153,0.2)") }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: isPast ? COLORS.textMuted : COLORS.good }} /> {isPast ? "Completed" : "Upcoming drive"}
                          </span>
                          <h3 style={{ fontSize: 17, lineHeight: 1.35, margin: "11px 0 5px", fontWeight: 800, overflowWrap: "anywhere" }}>{c.title}</h3>
                          {c.organizer && <div style={{ fontSize: 12, color: COLORS.textMuted }}>Organized by {c.organizer}</div>}
                        </div>
                        <div style={{ width: 55, minWidth: 55, borderRadius: 13, padding: "8px 4px", textAlign: "center", background: "rgba(255,59,84,0.09)", border: "1px solid rgba(255,59,84,0.16)" }}>
                          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 850, color: COLORS.crimson }}>{date ? date.toLocaleDateString(undefined, { month: "short" }) : "TBD"}</div>
                          <div className="headline" style={{ fontSize: 22, lineHeight: 1.25, fontWeight: 850 }}>{date ? date.getDate() : "—"}</div>
                          <div style={{ fontSize: 9, color: COLORS.textMuted }}>{date ? date.getFullYear() : "DATE"}</div>
                        </div>
                      </div>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0 13px" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, color: COLORS.textMuted, fontSize: 12.5 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><MapPin size={15} color={COLORS.cyan} style={{ flexShrink: 0, marginTop: 1 }} /><span style={{ lineHeight: 1.55 }}>{place || "Venue details to be confirmed"}</span></div>
                        {c.contactPhone && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Phone size={14} color={COLORS.cyan} /><a href={"tel:" + String(c.contactPhone).replace(/[^\d+]/g, "")} style={{ color: COLORS.text, textDecoration: "none" }}>{c.contactPhone}</a></div>}
                        {(c.startTime || c.endTime) && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Clock3 size={14} color={COLORS.cyan} /><span>{[c.startTime, c.endTime].filter(Boolean).join(" – ")}</span></div>}
                        {Number(c.expectedDonors) > 0 && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Users size={14} color={COLORS.cyan} /><span>Expected participants: {c.expectedDonors}</span></div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 18 }}>
                        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ ...buttonStyle(true), textDecoration: "none", flex: 1 }}><MapPin size={14} /> Get directions <ArrowRight size={13} /></a>
                        {adminToken && <button onClick={() => removeCamp(c._id)} aria-label={"Remove " + c.title} style={{ ...buttonStyle(false), color: COLORS.crimson, padding: "10px 12px" }}><Trash2 size={14} /></button>}
                      </div>
                    </div>
                  </motion.article>;
                })}
              </div>)}

        {directoryTab === "banks" && (banksLoading
          ? <div style={{ ...panel, padding: 34, textAlign: "center", color: COLORS.textMuted }}>Loading blood bank directory…</div>
          : filteredBanks.length === 0
            ? <div style={{ ...panel, padding: "40px 22px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, margin: "0 auto 13px", display: "grid", placeItems: "center", color: COLORS.cyan, background: "rgba(34,211,238,0.1)" }}><Building2 size={23} /></div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{query ? "No blood banks match your search" : "No blood banks listed yet"}</div>
                <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.7, maxWidth: 430, margin: "8px auto 0" }}>{query ? "Try a different bank name, district or state." : "Registered blood banks will appear here with their location and public contact details."}</p>
                {query && <button onClick={() => setQuery("")} style={{ ...buttonStyle(false), marginTop: 15 }}>Clear search</button>}
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }} className="grid2">
                {filteredBanks.map((b, i) => {
                  const place = [b.address, b.city, b.state].filter(Boolean).join(", ");
                  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([b.name, place].filter(Boolean).join(" "));
                  return <motion.article key={b._id || b.name + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.24) }}
                    style={{ ...panel, padding: 19, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 47, height: 47, minWidth: 47, borderRadius: 14, display: "grid", placeItems: "center", color: COLORS.cyan, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.13)" }}><Building2 size={21} /></div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 16, lineHeight: 1.4, fontWeight: 800, overflowWrap: "anywhere" }}>{b.name}</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, color: COLORS.cyan, fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.7 }}><ShieldCheck size={12} /> Directory listing</div>
                      </div>
                      {adminToken && <button onClick={() => removeBank(b._id)} aria-label={"Remove " + b.name} style={{ background: "transparent", border: 0, color: COLORS.textMuted, cursor: "pointer", padding: 5 }}><Trash2 size={14} /></button>}
                    </div>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "16px 0 13px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, color: COLORS.textMuted, fontSize: 12.5 }}>
                      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><MapPin size={15} color={COLORS.cyan} style={{ flexShrink: 0, marginTop: 1 }} /><span>{place || "Location not provided"}</span></div>
                      {b.phone && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Phone size={14} color={COLORS.cyan} /><a href={"tel:" + String(b.phone).replace(/[^\d+]/g, "")} style={{ color: COLORS.text, textDecoration: "none" }}>{b.phone}</a></div>}
                      {b.openingHours && <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><Clock3 size={14} color={COLORS.cyan} style={{ flexShrink: 0, marginTop: 2 }} /><span>{b.openingHours}</span></div>}
                    </div>
                    <div style={{ marginTop: "auto", paddingTop: 18 }}><a href={mapsUrl} target="_blank" rel="noreferrer" style={{ ...buttonStyle(false), textDecoration: "none", width: "100%", boxSizing: "border-box" }}><MapPin size={14} /> View location <ArrowRight size={13} /></a></div>
                  </motion.article>;
                })}
              </div>)}
      </section>

      
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "0 4px", color: COLORS.textMuted, fontSize: 11.5, lineHeight: 1.7 }}>
        <ShieldCheck size={15} color={COLORS.good} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Call the organizer or blood bank before travelling to confirm current hours, camp status, and availability. Directory listings are not a substitute for emergency medical care.</span>
      </div>
    </div>
  );
}

function AdvancedOperationsPanel({ adminToken, notify }) {
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('trace') ? 'trace' : 'inventory');
  const [inventory, setInventory] = useState([]); const [banks, setBanks] = useState([]); const [integrationKeys,setIntegrationKeys]=useState([]);
  const [forecast, setForecast] = useState(null); const [alerts, setAlerts] = useState(null); const [risk, setRisk] = useState(null); const [audit, setAudit] = useState([]);
  const [traceCode, setTraceCode] = useState(() => new URLSearchParams(window.location.search).get('trace') || ''); const [trace, setTrace] = useState(null); const [qrUnit,setQrUnit]=useState(null); const [simulation, setSimulation] = useState(null); const [routeResult, setRouteResult] = useState(null);
  const [unit, setUnit] = useState({unitCode:'',bloodBankId:'',group:'O+',component:'WholeBlood',collectedAt:'',expiresAt:'',testStatus:'Pending'});
  const [keyForm, setKeyForm] = useState({organizationName:'',scopes:['requests:read','inventory:read'],expiresAt:''}); const [newKey,setNewKey]=useState(null);
  const [scenario,setScenario]=useState({extraDemandUnits:20,days:7,closedBloodBankId:''}); const [routeForm,setRouteForm]=useState({originLat:'',originLng:'',destinations:'22.7196,75.8577\n22.7533,75.8937'});
  const [busy,setBusy]=useState(false);
  const load = useCallback(async()=>{try{const x=await Promise.all([api('/advanced/inventory',{},adminToken),api('/blood-banks'),api('/advanced/inventory/alerts',{},adminToken),api('/advanced/forecast?days=30',{},adminToken),api('/advanced/risk-review',{},adminToken),api('/advanced/audit?limit=100',{},adminToken),api('/advanced/integrations/keys',{},adminToken)]);setInventory(x[0]);setBanks(x[1]);setAlerts(x[2]);setForecast(x[3]);setRisk(x[4]);setAudit(x[5]);setIntegrationKeys(x[6]);}catch(e){notify(e.message)}},[adminToken,notify]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{const code=new URLSearchParams(window.location.search).get('trace');if(!code)return;api('/advanced/trace/'+encodeURIComponent(code),{},adminToken).then(setTrace).catch(e=>notify(e.message));},[adminToken,notify]);
  const run=async fn=>{setBusy(true);try{await fn()}catch(e){notify(e.message)}finally{setBusy(false)}};
  const field={...inputStyle};
  const button=(name,id)=> <button key={id} onClick={()=>setTab(id)} style={tab===id?glowBtn:ghostBtn}>{name}</button>;
  const addUnit=async e=>{e.preventDefault();await run(async()=>{const r=await api('/advanced/inventory',{method:'POST',body:JSON.stringify(unit)},adminToken);notify('Unit registered: '+r.unit.status);setUnit({unitCode:'',bloodBankId:'',group:'O+',component:'WholeBlood',collectedAt:'',expiresAt:'',testStatus:'Pending'});await load()})};
  const changeStatus=async(u,status)=>{const needsReason=['Recalled','Quarantined','Discarded'].includes(status);const reason=needsReason?window.prompt('Reason required')||'':'';if(needsReason&&!reason.trim())return;await run(async()=>{await api('/advanced/inventory/'+u._id+'/status',{method:'PATCH',body:JSON.stringify({status,reason})},adminToken);notify('Inventory status updated');await load()})};
  const recordScreening=async(u)=>{const result=window.prompt('Enter screening result: Passed, Failed, or Pending',u.testStatus);if(result===null)return;const testStatus=String(result).trim();if(!['Passed','Failed','Pending'].includes(testStatus)){notify('Use exactly Passed, Failed, or Pending.');return;}await run(async()=>{const updated=await api('/advanced/inventory/'+u._id+'/testing',{method:'PATCH',body:JSON.stringify({testStatus})},adminToken);notify('Screening recorded: '+updated.testStatus+' — '+updated.status);await load()})};
  const lookupTrace=async e=>{e.preventDefault();await run(async()=>setTrace(await api('/advanced/trace/'+encodeURIComponent(traceCode),{},adminToken)))};
  const makeKey=async e=>{e.preventDefault();await run(async()=>{setNewKey(await api('/advanced/integrations/keys',{method:'POST',body:JSON.stringify({...keyForm,expiresAt:keyForm.expiresAt||undefined})},adminToken));notify('Key created. Copy it now.');await load()})};
  const revokeKey=async k=>{if(!window.confirm('Revoke API key for '+k.organizationName+'? Existing integrations will stop working.'))return;await run(async()=>{await api('/advanced/integrations/keys/'+k._id+'/revoke',{method:'PATCH',body:'{}'},adminToken);notify('Integration key revoked.');await load()})};
  const simulate=async e=>{e.preventDefault();await run(async()=>setSimulation(await api('/advanced/resilience/simulate',{method:'POST',body:JSON.stringify({...scenario,extraDemandUnits:Number(scenario.extraDemandUnits),days:Number(scenario.days)})},adminToken)))};
  const optimize=async e=>{e.preventDefault();const originLat=routeForm.originLat.trim(),originLng=routeForm.originLng.trim();const rows=routeForm.destinations.split('\n').map(s=>s.trim()).filter(Boolean);if(!originLat||!originLng){notify('Enter both origin coordinates.');return;}const origin={lat:Number(originLat),lng:Number(originLng)};if(!Number.isFinite(origin.lat)||origin.lat < -90||origin.lat > 90||!Number.isFinite(origin.lng)||origin.lng < -180||origin.lng > 180){notify('Enter valid origin latitude and longitude.');return;}const destinations=[];for(const row of rows){const parts=row.split(',').map(s=>s.trim());if(parts.length!==2||!parts[0]||!parts[1]){notify('Each destination must be latitude,longitude on its own line.');return;}const lat=Number(parts[0]),lng=Number(parts[1]);if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lng)||lng < -180||lng > 180){notify('A destination has invalid coordinates.');return;}destinations.push({lat,lng,label:row});}if(!destinations.length){notify('Enter at least one destination.');return;}await run(async()=>setRouteResult(await api('/advanced/logistics/route',{method:'POST',body:JSON.stringify({origin,destinations})},adminToken)))};

  return <div style={{marginTop:36}}><SectionLabel>Advanced operations suite</SectionLabel><p style={{color:COLORS.textMuted,fontSize:12.5}}>Shortage planning · inventory · expiry and recall · traceability · hospital integrations · logistics · risk review · resilience.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:8,margin:'14px 0'}}>{button('Inventory / expiry','inventory')}{button('Forecast','forecast')}{button('Unit trace','trace')}{button('Logistics','logistics')}{button('Hospital API','keys')}{button('Risk review','risk')}{button('Resilience lab','resilience')}{button('Audit trail','audit')}</div>
  {tab==='inventory'&&<><Card hover={false} style={{marginBottom:14}}><h3>Register blood unit</h3><p style={{fontSize:12,color:COLORS.textMuted}}>Pending or failed screening must not be used; pending units are quarantined.</p><form onSubmit={addUnit} style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}} className='grid2'><Field label='Unit code'><input required style={field} value={unit.unitCode} onChange={e=>setUnit({...unit,unitCode:e.target.value})}/></Field><Field label='Blood bank'><select required style={field} value={unit.bloodBankId} onChange={e=>setUnit({...unit,bloodBankId:e.target.value})}><option value=''>Select bank</option>{banks.map(b=><option key={b._id} value={b._id}>{b.name} — {b.city}</option>)}</select></Field><Field label='Blood group'><select style={field} value={unit.group} onChange={e=>setUnit({...unit,group:e.target.value})}>{GROUPS.map(g=><option key={g}>{g}</option>)}</select></Field><Field label='Component'><select style={field} value={unit.component} onChange={e=>setUnit({...unit,component:e.target.value})}>{['WholeBlood','RedCells','Platelets','Plasma','Cryoprecipitate'].map(g=><option key={g}>{g}</option>)}</select></Field><Field label='Collected'><input required type='date' style={field} value={unit.collectedAt} onChange={e=>setUnit({...unit,collectedAt:e.target.value})}/></Field><Field label='Expires'><input required type='date' style={field} value={unit.expiresAt} onChange={e=>setUnit({...unit,expiresAt:e.target.value})}/></Field><Field label='Screening status'><select style={field} value={unit.testStatus} onChange={e=>setUnit({...unit,testStatus:e.target.value})}>{['Pending','Passed','Failed'].map(s=><option key={s}>{s}</option>)}</select></Field><button disabled={busy} style={{...glowBtn,alignSelf:'end'}}>Add unit</button></form></Card><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>{[['Available',inventory.filter(x=>x.status==='Available').length],['Quarantined',inventory.filter(x=>x.status==='Quarantined').length],['Expiring soon',alerts?.expiringSoon?.length||0],['Expired',alerts?.expired?.length||0],['Recalled',alerts?.recalled?.length||0]].map(x=><Card key={x[0]} hover={false} style={{padding:12,minWidth:105}}><div style={{fontSize:11,color:COLORS.textMuted}}>{x[0]}</div><b style={{fontSize:20}}>{x[1]}</b></Card>)}</div><Card hover={false} style={{padding:0,overflowX:'auto'}}><table><thead><tr><th>Code</th><th>Group / component</th><th>Bank</th><th>Expiry</th><th>Screening</th><th>Status</th><th>Actions</th></tr></thead><tbody>{inventory.map(u=><tr key={u._id}><td>{u.unitCode}</td><td>{u.group} / {u.component}</td><td>{u.bloodBankId?.name||'—'}</td><td>{new Date(u.expiresAt).toLocaleDateString()}</td><td>{u.testStatus}</td><td>{u.status}</td><td><div style={{display:'flex',gap:4,flexWrap:'wrap'}}><button style={{...ghostBtn,padding:6}} onClick={()=>{setTraceCode(u.unitCode);setTab('trace')}}>Trace</button><button style={{...ghostBtn,padding:6}} onClick={()=>setQrUnit(u)}>QR label</button>{!['Issued','Expired','Recalled','Discarded'].includes(u.status)&&<button style={{...ghostBtn,padding:6}} onClick={()=>recordScreening(u)}>Record test</button>}{u.status!=='Recalled'&&<button style={{...ghostBtn,padding:6}} onClick={()=>changeStatus(u,'Quarantined')}>Quarantine</button>}{u.status!=='Recalled'&&<button style={{...ghostBtn,padding:6,color:COLORS.crimson}} onClick={()=>changeStatus(u,'Recalled')}>Recall</button>}{u.testStatus==='Passed'&&new Date(u.expiresAt)>new Date()&&u.status!=='Available'&&<button style={{...ghostBtn,padding:6,color:COLORS.good}} onClick={()=>changeStatus(u,'Available')}>Release</button>}</div></td></tr>)}</tbody></table>{!inventory.length&&<p style={{padding:18,color:COLORS.textMuted}}>No units registered yet.</p>}</Card></>}
  {tab==='forecast'&&<Card hover={false}><h3>Shortage forecast</h3><p style={{fontSize:12,color:COLORS.textMuted}}>Rolling average from recorded requests and usable inventory; a planning baseline, not trained AI.</p>{forecast?.forecast?.map(f=><div key={f.group} style={{display:'grid',gridTemplateColumns:'50px 1fr 100px',gap:12,alignItems:'center',padding:'12px 0',borderBottom:'1px solid '+COLORS.panelBorder}}><b>{f.group}</b><div><div style={{fontSize:12,color:COLORS.textMuted}}>{f.availableTestPassedUnits} units · 7-day demand {f.projected7DayDemand}</div><div style={{height:7,background:'#333',borderRadius:6,marginTop:6}}><div style={{height:7,width:Math.min(100,f.projected7DayDemand/Math.max(1,f.availableTestPassedUnits)*100)+'%',background:f.shortageRisk==='High'?COLORS.crimson:f.shortageRisk==='Moderate'?COLORS.warn:COLORS.good,borderRadius:6}}/></div></div><Pill tone={f.shortageRisk==='High'?'warn':f.shortageRisk==='Moderate'?'info':'good'}>{f.shortageRisk}</Pill></div>)}</Card>}
  {tab==='trace'&&<Card hover={false}><h3>Unit traceability</h3><form onSubmit={lookupTrace} style={{display:'flex',gap:8}}><input required style={{...field,flex:1}} value={traceCode} onChange={e=>setTraceCode(e.target.value)} placeholder='Enter unit code'/><button style={glowBtn} disabled={busy}>Find</button></form>{trace&&<div><h4>{trace.unit.unitCode} · {trace.unit.group} · {trace.unit.status}</h4><p style={{fontSize:13,color:COLORS.textMuted}}>{trace.unit.component} · test {trace.unit.testStatus} · expires {new Date(trace.unit.expiresAt).toLocaleString()}</p>{trace.history.map((h,i)=><p key={h._id||i} style={{fontSize:12}}>{h.action} · {h.actor} · {new Date(h.occurredAt||h.createdAt).toLocaleString()}</p>)}</div>}</Card>}
  {tab==='logistics'&&<Card hover={false}><h3>Emergency stop ordering</h3><p style={{fontSize:12,color:COLORS.textMuted}}>Enter coordinates in decimal degrees; straight-line estimates are not road routing or live traffic.</p><form onSubmit={optimize}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}} className='grid2'><Field label='Origin latitude'><input required type='number' step='any' style={field} value={routeForm.originLat} onChange={e=>setRouteForm({...routeForm,originLat:e.target.value})}/></Field><Field label='Origin longitude'><input required type='number' step='any' style={field} value={routeForm.originLng} onChange={e=>setRouteForm({...routeForm,originLng:e.target.value})}/></Field></div><Field label='Destinations: latitude,longitude per line'><textarea required rows={4} style={field} value={routeForm.destinations} onChange={e=>setRouteForm({...routeForm,destinations:e.target.value})}/></Field><button style={glowBtn} disabled={busy}>Optimize order</button></form>{routeResult&&<div><h4>{routeResult.estimatedDistanceKm} km · approx {routeResult.estimatedDrivingMinutes} min</h4>{routeResult.route.map((p,i)=><p key={i}>{i+1}. {p.label} — {p.distanceFromPreviousKm} km</p>)}</div>}</Card>}
  {tab==='keys'&&<Card hover={false}><h3>Hospital / partner API keys</h3><p style={{fontSize:12,color:COLORS.textMuted}}>Raw keys are shown once and stored as hashes. Share using a secure channel.</p><form onSubmit={makeKey}><Field label='Organization'><input required style={field} value={keyForm.organizationName} onChange={e=>setKeyForm({...keyForm,organizationName:e.target.value})}/></Field><Field label='Scopes'><div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{['requests:read','inventory:read','inventory:write'].map(s=><label key={s}><input type='checkbox' checked={keyForm.scopes.includes(s)} onChange={e=>setKeyForm({...keyForm,scopes:e.target.checked?[...keyForm.scopes,s]:keyForm.scopes.filter(x=>x!==s)})}/> {s}</label>)}</div></Field><Field label='Expiry (optional)'><input type='date' style={field} value={keyForm.expiresAt} onChange={e=>setKeyForm({...keyForm,expiresAt:e.target.value})}/></Field><button style={glowBtn} disabled={busy||!keyForm.scopes.length}>Create API key</button></form>{newKey&&<div style={{padding:12,marginTop:12,border:'1px solid '+COLORS.warn,borderRadius:10}}><b>Copy now — shown once</b><p style={{overflowWrap:'anywhere'}}>{newKey.apiKey}</p><button style={ghostBtn} onClick={()=>navigator.clipboard?.writeText(newKey.apiKey).then(()=>notify('Copied'))}>Copy</button><p>{newKey.scopes.join(', ')}</p></div>}<h4 style={{marginTop:24}}>Provisioned integrations</h4><div style={{overflowX:'auto'}}><table><thead><tr><th>Organization</th><th>Scopes</th><th>Expiry</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>{integrationKeys.map(k=><tr key={k._id}><td>{k.organizationName}</td><td>{(k.scopes||[]).join(', ')}</td><td>{k.expiresAt?new Date(k.expiresAt).toLocaleDateString():'No expiry'}</td><td>{k.lastUsedAt?new Date(k.lastUsedAt).toLocaleString():'Never'}</td><td>{k.active?'Active':'Revoked'}</td><td>{k.active&&<button style={{...ghostBtn,padding:6,color:COLORS.crimson}} onClick={()=>revokeKey(k)}>Revoke</button>}</td></tr>)}</tbody></table></div></Card>}
  {tab==='risk'&&<Card hover={false}><h3>Human review flags</h3><p style={{fontSize:12,color:COLORS.textMuted}}>Similar requests in seven days; flags never automatically block or deny care.</p>{risk?.flaggedGroups?.length?risk.flaggedGroups.map((r,i)=><div key={i} style={{padding:12,marginBottom:8,background:'rgba(255,59,84,.07)',borderRadius:10}}><Pill tone={r.risk==='High review priority'?'warn':'info'}>{r.risk}</Pill><p>{r.reason}</p><small>{r.count} requests · {r.requestIds.map(x=>String(x).slice(-6)).join(', ')}</small></div>):<p>No repeated patterns flagged.</p>}</Card>}
  {tab==='resilience'&&<Card hover={false}><h3>Blood network what-if simulator</h3><form onSubmit={simulate}><Field label='Extra demand units'><input type='number' min='0' max='100000' style={field} value={scenario.extraDemandUnits} onChange={e=>setScenario({...scenario,extraDemandUnits:e.target.value})}/></Field><Field label='Horizon days'><input type='number' min='1' max='30' style={field} value={scenario.days} onChange={e=>setScenario({...scenario,days:e.target.value})}/></Field><Field label='Close a blood bank (optional)'><select style={field} value={scenario.closedBloodBankId} onChange={e=>setScenario({...scenario,closedBloodBankId:e.target.value})}><option value=''>No closure</option>{banks.map(b=><option key={b._id} value={b._id}>{b.name} — {b.city}</option>)}</select></Field><button style={glowBtn} disabled={busy}>Run scenario</button></form>{simulation&&<table><thead><tr><th>Group</th><th>Available</th><th>Demand</th><th>Gap</th></tr></thead><tbody>{simulation.results.map(r=><tr key={r.group}><td>{r.group}</td><td>{r.availableUnits}</td><td>{r.projectedTotalDemand}</td><td>{r.projectedGap}</td></tr>)}</tbody></table>}</Card>}
  {tab==='audit'&&<Card hover={false}><h3>Operations audit trail</h3>{audit.map(a=><p key={a._id} style={{fontSize:12,borderBottom:'1px solid '+COLORS.panelBorder,paddingBottom:8}}>{new Date(a.occurredAt||a.createdAt).toLocaleString()} · <b>{a.action}</b> · {a.actor} · {a.resourceType} {String(a.resourceId||'').slice(-6)}</p>)}</Card>}
  {qrUnit&&<div className="raktsetu-qr-dialog" role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.82)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}><Card hover={false} style={{maxWidth:360,width:'100%',textAlign:'center',background:'#fff',color:'#111'}}><button onClick={()=>setQrUnit(null)} style={{...ghostBtn,float:'right',color:'#111',borderColor:'#ddd'}}>Close</button><div style={{clear:'both'}}/><h3 style={{margin:'8px 0'}}>BloodBridge Blood Unit</h3><div style={{fontWeight:700,fontSize:17}}>{qrUnit.unitCode}</div><div style={{fontSize:13,margin:'5px 0 16px'}}>{qrUnit.group} · {qrUnit.component}</div><QRCodeSVG value={window.location.origin+'/?trace='+encodeURIComponent(qrUnit.unitCode)} size={220} level="M" includeMargin={true}/><p style={{fontSize:12,color:'#444'}}>Scan to open BloodBridge with this trace code. Admin sign-in is required to view the audit history.</p><button style={{...glowBtn,justifyContent:'center'}} onClick={()=>window.print()}>Print QR label</button></Card></div>}
  </div>;
}

function OperationsGrowthPanel({ adminToken, notify }) {
  const [tab, setTab] = useState("tracking");
  const [trackingId, setTrackingId] = useState("");
  const [tracking, setTracking] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState("Matched");
  const [trackingNote, setTrackingNote] = useState("");
  const [heatmap, setHeatmap] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointment, setAppointment] = useState({ donorName: "", contact: "", bloodBankName: "", scheduledAt: "", notes: "" });
  const [alerts, setAlerts] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [reports, setReports] = useState(null);
  const [busy, setBusy] = useState(false);
  const field = { ...inputStyle };
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { notify(e.message); } finally { setBusy(false); } };
  const load = useCallback(async () => {
    try {
      const [h, a, al, r, rep] = await Promise.all([
        api("/productivity/heatmap", {}, adminToken),
        api("/productivity/appointments", {}, adminToken),
        api("/productivity/alerts", {}, adminToken),
        api("/productivity/eligibility-reminders", {}, adminToken),
        api("/productivity/reports", {}, adminToken)
      ]);
      setHeatmap(h); setAppointments(a); setAlerts(al); setReminders(r.reminderCandidates || []); setReports(rep);
    } catch (e) { notify(e.message); }
  }, [adminToken, notify]);
  useEffect(() => { if (adminToken) load(); }, [adminToken, load]);
  const lookup = async (e) => { e.preventDefault(); await run(async () => { const t = await api("/productivity/tracking/" + encodeURIComponent(trackingId.trim()), {}, adminToken); setTracking(t); setTrackingStatus(t.status); }); };
  const updateTracking = async (e) => { e.preventDefault(); await run(async () => { await api("/productivity/tracking/" + encodeURIComponent(trackingId.trim()), { method: "PATCH", body: JSON.stringify({ status: trackingStatus, note: trackingNote }) }, adminToken); setTrackingNote(""); setTracking(await api("/productivity/tracking/" + encodeURIComponent(trackingId.trim()), {}, adminToken)); notify("Request timeline updated"); await load(); }); };
  const createAppointment = async (e) => { e.preventDefault(); await run(async () => { await api("/productivity/appointments", { method: "POST", body: JSON.stringify({ ...appointment, scheduledAt: new Date(appointment.scheduledAt).toISOString() }) }, adminToken); setAppointment({ donorName: "", contact: "", bloodBankName: "", scheduledAt: "", notes: "" }); notify("Donation appointment booked"); await load(); }); };
  const appointmentStatus = async (id, status) => run(async () => { await api("/productivity/appointments/" + id, { method: "PATCH", body: JSON.stringify({ status }) }, adminToken); await load(); });
  const acknowledge = async (kind, ref) => run(async () => { await api("/productivity/alerts/acknowledge", { method: "POST", body: JSON.stringify({ kind, ref }) }, adminToken); notify("Acknowledgement added to audit trail"); });
  const exportReports = () => {
    if (!reports) return;
    const rows = [["section", "status", "count", "units"]];
    for (const [section, items] of [["requests", reports.requestCounts], ["inventory", reports.inventoryCounts], ["donors", reports.donorCounts], ["appointments", reports.appointmentCounts]]) {
      for (const item of items || []) rows.push([section, item._id || "Unknown", item.count, item.units ?? ""]);
    }
    const csv = rows.map(row => row.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "raktsetu-operations-report.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const btn = (label, id) => <button key={id} onClick={() => setTab(id)} style={tab === id ? glowBtn : ghostBtn}>{label}</button>;
  const alertList = (title, kind, items, labelFn) => <div style={{ marginTop: 14 }}><h4>{title} ({items?.length || 0})</h4>{items?.length ? items.map((item, i) => <div key={item._id || item.unitCode || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid " + COLORS.panelBorder, padding: "9px 0" }}><span style={{ fontSize: 12 }}>{labelFn(item)}</span><button style={{ ...ghostBtn, padding: "5px 9px" }} onClick={() => acknowledge(kind, item._id || item.unitCode || String(i))}>Acknowledge</button></div>) : <p style={{ color: COLORS.textMuted, fontSize: 12 }}>No current items.</p>}</div>;
  return <div style={{ marginTop: 30 }}>
    <SectionLabel>Emergency response & donor operations</SectionLabel>
    <p style={{ color: COLORS.textMuted, fontSize: 12.5 }}>Request milestones · shortage heatmap · donation bookings · smart operational alerts · eligibility reminders · reports.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0" }}>{btn("Request tracking", "tracking")}{btn("Shortage heatmap", "heatmap")}{btn("Appointments", "appointments")}{btn("Alert center", "alerts")}{btn("Eligibility reminders", "eligibility")}{btn("Analytics / CSV", "reports")}</div>
    {tab === "tracking" && <Card hover={false}><h3>Emergency request tracking</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Use the full request ID from the admin Requests table. Public tracking responses expose only a short reference and non-identifying milestones.</p><form onSubmit={lookup} style={{ display: "flex", gap: 8 }}><input required style={{ ...field, flex: 1 }} value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="Full request ID"/><button style={glowBtn} disabled={busy}>Find request</button></form>{tracking && <div style={{ marginTop: 16 }}><h4>Ref {tracking.reference} · {tracking.group} · {tracking.units} unit(s)</h4><div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>{["Open", "Matched", "Fulfilled"].map((s, i) => <div key={s} style={{ flex: 1, minWidth: 80, padding: 10, borderRadius: 9, border: "1px solid " + COLORS.panelBorder, background: tracking.status === s ? "rgba(255,59,84,.12)" : "transparent", textAlign: "center", fontSize: 12 }}>{i + 1}. {s}</div>)}</div>{(tracking.milestones || []).map((m, i) => <p key={i} style={{ fontSize: 12, borderBottom: "1px solid " + COLORS.panelBorder, paddingBottom: 7 }}>{m.status} · {new Date(m.changedAt).toLocaleString()} {m.note ? "· " + m.note : ""}</p>)}<form onSubmit={updateTracking} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8, alignItems: "end" }} className="grid2"><Field label="Update status"><select style={field} value={trackingStatus} onChange={e => setTrackingStatus(e.target.value)}>{["Open", "Matched", "Fulfilled"].map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Timeline note (optional)"><input style={field} value={trackingNote} onChange={e => setTrackingNote(e.target.value)} maxLength={240} placeholder="e.g. Blood bank contacted"/></Field><button style={glowBtn} disabled={busy}>Save update</button></form></div>}</Card>}
    {tab === "heatmap" && <Card hover={false}><h3>Live shortage heatmap</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Aggregated open requests by district, state and blood group. No recipient names or exact coordinates are shown.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }} className="grid2">{heatmap.map((h, i) => <div key={h.city + h.state + h.group + i} style={{ border: "1px solid " + COLORS.panelBorder, borderRadius: 10, padding: 12, background: h.level === "High" ? "rgba(255,59,84,.12)" : h.level === "Moderate" ? "rgba(255,180,0,.09)" : "rgba(50,190,120,.07)" }}><b>{h.city}{h.state ? ", " + h.state : ""}</b><div style={{ fontSize: 12, marginTop: 5 }}>{h.group} · {h.units} unit(s)</div><Pill tone={h.level === "High" ? "warn" : h.level === "Moderate" ? "info" : "good"}>{h.level}</Pill><div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{h.requests} request(s) · {h.urgent} urgent</div></div>)}</div>{!heatmap.length && <p style={{ color: COLORS.textMuted }}>No active requests to map yet.</p>}</Card>}
    {tab === "appointments" && <><Card hover={false}><h3>Book donation appointment</h3><form onSubmit={createAppointment} style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }} className="grid2"><Field label="Donor name"><input required maxLength={120} style={field} value={appointment.donorName} onChange={e => setAppointment({ ...appointment, donorName: e.target.value })}/></Field><Field label="Contact (optional)"><input style={field} value={appointment.contact} onChange={e => setAppointment({ ...appointment, contact: e.target.value })}/></Field><Field label="Blood bank / camp"><input required maxLength={160} style={field} value={appointment.bloodBankName} onChange={e => setAppointment({ ...appointment, bloodBankName: e.target.value })}/></Field><Field label="Date & time"><input required type="datetime-local" style={field} value={appointment.scheduledAt} onChange={e => setAppointment({ ...appointment, scheduledAt: e.target.value })}/></Field><Field label="Notes"><input style={field} value={appointment.notes} onChange={e => setAppointment({ ...appointment, notes: e.target.value })}/></Field><button style={glowBtn} disabled={busy} type="submit">Book slot</button></form><p style={{ color: COLORS.textMuted, fontSize: 11 }}>Booking does not confirm medical eligibility. Staff must screen donors at the visit.</p></Card><Card hover={false} style={{ marginTop: 12, overflowX: "auto" }}><h3>Appointment schedule</h3><table><thead><tr><th>Donor</th><th>Bank / camp</th><th>Scheduled</th><th>Status</th><th>Actions</th></tr></thead><tbody>{appointments.map(a => <tr key={a._id}><td>{a.donorName}<div style={{ fontSize: 11, color: COLORS.textMuted }}>{a.contact}</div></td><td>{a.bloodBankName}</td><td>{new Date(a.scheduledAt).toLocaleString()}</td><td>{a.status}</td><td><select style={{ ...field, minWidth: 120 }} value={a.status} onChange={e => appointmentStatus(a._id, e.target.value)}>{["Booked", "Confirmed", "Completed", "Cancelled", "No-show"].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{!appointments.length && <p style={{ color: COLORS.textMuted }}>No appointments booked yet.</p>}</Card></>}
    {tab === "alerts" && <Card hover={false}><h3>Smart operational alert center</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Alerts are derived from current records; acknowledgements are audited. This version does not send SMS/email or push notifications.</p>{alertList("Urgent requests", "urgent-request", alerts?.urgentRequests, x => x.group + " · " + x.units + " unit(s) · " + (x.city || "Unspecified") + " · " + x.status)}{alertList("Units expiring in 7 days", "expiring-unit", alerts?.expiring, x => x.unitCode + " · " + x.group + " · expires " + new Date(x.expiresAt).toLocaleDateString())}{alertList("Expired units", "expired-unit", alerts?.expired, x => x.unitCode + " · " + x.group + " · " + x.status)}{alertList("Quarantined units", "quarantined-unit", alerts?.quarantined, x => x.unitCode + " · " + x.group + " · test " + x.testStatus)}{alertList("Recalled units", "recalled-unit", alerts?.recalled, x => x.unitCode + " · " + x.group + " · " + (x.recallReason || "Recall recorded"))}</Card>}
    {tab === "eligibility" && <Card hover={false}><h3>Donor eligibility reminder candidates</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Candidates have at least 90 days since their recorded last donation and verified records. This is a reminder queue, not medical clearance; no message is sent automatically.</p><div style={{ overflowX: "auto" }}><table><thead><tr><th>Donor</th><th>Group</th><th>District</th><th>Last donation</th><th>Days</th></tr></thead><tbody>{reminders.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.group}</td><td>{d.district || d.city || "—"}</td><td>{new Date(d.lastDonation).toLocaleDateString()}</td><td>{d.daysSinceDonation}</td></tr>)}</tbody></table></div>{!reminders.length && <p>No reminder candidates currently.</p>}</Card>}
    {tab === "reports" && <Card hover={false}><h3>Analytics & downloadable reports</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Aggregate totals only; exported CSV contains no donor or recipient names.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{[["Requests", reports?.requestCounts?.reduce((n, x) => n + x.count, 0) || 0], ["Inventory units", reports?.inventoryCounts?.reduce((n, x) => n + x.count, 0) || 0], ["Donor records", reports?.donorCounts?.reduce((n, x) => n + x.count, 0) || 0], ["Appointments", reports?.appointmentCounts?.reduce((n, x) => n + x.count, 0) || 0]].map(x => <Card key={x[0]} hover={false} style={{ padding: 14, minWidth: 120 }}><div style={{ fontSize: 12, color: COLORS.textMuted }}>{x[0]}</div><b style={{ fontSize: 24 }}>{x[1]}</b></Card>)}</div><button style={{ ...glowBtn, marginTop: 16 }} onClick={exportReports} disabled={!reports}>Download aggregate CSV</button></Card>}
  </div>;
}


function FeatureHubPanel({ adminMode = false, adminToken, notify }) {
  const [donorToken] = useState(() => localStorage.getItem("raktsetu_donor_token") || "");
  const [section, setSection] = useState(() => adminMode ? "forecast" : "booking");
  const [language, setLanguage] = useState(() => localStorage.getItem("raktsetu_language") || "en");
  const [banks, setBanks] = useState([]);
  const [camps, setCamps] = useState([]);
  const [bankSearch, setBankSearch] = useState("");
  const visibleBanks = useMemo(() => { const query = bankSearch.trim().toLowerCase(); return banks.filter(bank => !query || [bank.name, bank.city, bank.state, bank.address].some(value => String(value || "").toLowerCase().includes(query))); }, [banks, bankSearch]);
  const [booking, setBooking] = useState({ donorName: "", contact: "", bloodBankName: "", scheduledAt: "", notes: "" });
  const [queued, setQueued] = useState(() => { try { return JSON.parse(localStorage.getItem("raktsetu_booking_queue") || "[]"); } catch { return []; } });
  const [donors, setDonors] = useState([]);
  const [retention, setRetention] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [risk, setRisk] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [coldEvents, setColdEvents] = useState([]);
  const [notice, setNotice] = useState({ donorId: "", message: "Thank you for being part of the BloodBridge donor community.", email: false, push: false });
  const [routeForm, setRouteForm] = useState("Bhopal hospital,22.0797,82.1391\nBlood bank,22.1034,82.1578");
  const [routeResult, setRouteResult] = useState(null);
  const [coldForm, setColdForm] = useState({ unitCode: "", temperatureC: "4", minC: "2", maxC: "6" });
  const [importText, setImportText] = useState('[\n  {"unitCode":"PARTNER-UNIT-001","bloodBankId":"PASTE_BLOOD_BANK_ID","group":"O+","component":"WholeBlood","collectedAt":"2026-10-01","expiresAt":"2026-11-01"}\n]');
  const [busy, setBusy] = useState(false);
  const field = { ...inputStyle };
  const labels = language === "hi"
    ? { booking: "दान अपॉइंटमेंट", map: "ब्लड बैंक मानचित्र", forecast: "कमी पूर्वानुमान", notifications: "सूचनाएँ", retention: "डोनर जुड़ाव", logistics: "आपातकालीन मार्ग", cold: "कोल्ड-चेन", integrations: "इंटीग्रेशन", analytics: "एनालिटिक्स", risk: "जोखिम समीक्षा", import: "स्टॉक आयात", backup: "बैकअप और सुरक्षा", submit: "अपॉइंटमेंट बुक करें", fullName: "पूरा नाम", contact: "संपर्क नंबर", location: "ब्लड बैंक / कैंप", date: "अपॉइंटमेंट की तारीख और समय", note: "वैकल्पिक नोट", offlineText: "इंटरनेट न होने पर अनुरोध इस डिवाइस पर सुरक्षित रहेगा और कनेक्शन लौटने पर भेजने की कोशिश होगी।", bookingNote: "यह बुकिंग केवल अनुरोध है। ब्लड बैंक की पुष्टि के बाद ही अपॉइंटमेंट तय होगा।" }
    : { booking: "Book Donation", map: "Blood Bank Map", forecast: "Shortage Forecast", notifications: "Notifications", retention: "Donor Engagement", logistics: "Emergency Logistics", cold: "Cold Chain", integrations: "Integrations", analytics: "Analytics", risk: "Risk Review", import: "Stock Import", backup: "Backup & Security", submit: "Book appointment", fullName: "Full name", contact: "Contact number", location: "Blood bank / camp", date: "Appointment date and time", note: "Optional note", offlineText: "When offline, the request stays on this device and retries when the connection returns.", bookingNote: "A booking is only a request until the blood bank confirms it." };

  const loadPublic = useCallback(async () => {
    try { const [data, campData] = await Promise.all([api("/features/map/banks"), api("/camps")]); setBanks(Array.isArray(data) ? data : []); setCamps(Array.isArray(campData) ? campData.filter(c => !c.date || new Date(c.date) >= new Date(new Date().setHours(0,0,0,0))) : []); }
    catch { setBanks([]); setCamps([]); }
  }, []);
  const loadAdmin = useCallback(async () => {
    if (!adminToken) return;
    try {
      const results = await Promise.all([
        api("/features/forecast?days=30", {}, adminToken),
        api("/features/retention/candidates", {}, adminToken),
        api("/features/risk-review", {}, adminToken),
        api("/features/analytics", {}, adminToken),
        api("/features/integration/status", {}, adminToken),
        api("/features/diagnostics", {}, adminToken),
        api("/features/cold-chain", {}, adminToken),
        api("/donors", {}, adminToken)
      ]);
      setForecast(results[0]); setRetention(results[1]); setRisk(results[2]); setAnalytics(results[3]);
      setIntegration(results[4]); setDiagnostics(results[5]); setColdEvents(results[6]);
      setDonors(Array.isArray(results[7]) ? results[7] : []);
    } catch (error) { notify(error.message); }
  }, [adminToken, notify]);
  useEffect(() => { loadPublic(); }, [loadPublic]);
  useEffect(() => { if (adminMode) loadAdmin(); }, [adminMode, loadAdmin]);
  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return;
      let pending = [];
      try { pending = JSON.parse(localStorage.getItem("raktsetu_booking_queue") || "[]"); } catch { pending = []; }
      const remaining = [];
      for (const item of pending) {
        try { await api("/features/appointments/book", { method: "POST", body: JSON.stringify(item) }, donorToken); }
        catch { remaining.push(item); }
      }
      localStorage.setItem("raktsetu_booking_queue", JSON.stringify(remaining));
      setQueued(remaining);
      if (pending.length && !remaining.length) notify("Saved offline appointment request(s) synced.");
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [notify, donorToken]);

  const run = async (fn, success) => {
    setBusy(true);
    try { const result = await fn(); if (success) notify(success); return result; }
    catch (error) { notify(error.message || "Feature action failed."); return null; }
    finally { setBusy(false); }
  };
  const book = async (event) => {
    event.preventDefault();
    const clientReference = window.crypto?.randomUUID ? window.crypto.randomUUID() : "rs_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
    const payload = { ...booking, scheduledAt: new Date(booking.scheduledAt).toISOString(), clientReference };
    const saveForRetry = () => {
      const next = [...queued, payload];
      localStorage.setItem("raktsetu_booking_queue", JSON.stringify(next)); setQueued(next);
      setBooking({ donorName: "", contact: "", bloodBankName: "", scheduledAt: "", notes: "" });
    };
    if (!navigator.onLine) {
      saveForRetry();
      notify("Offline: appointment saved on this device and will retry when internet returns.");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/features/appointments/book", { method: "POST", body: JSON.stringify(payload) }, donorToken);
      notify(result.message || "Appointment submitted. Wait for the blood bank to confirm.");
      setBooking({ donorName: "", contact: "", bloodBankName: "", scheduledAt: "", notes: "" });
    } catch (error) {
      if (!navigator.onLine || /failed to fetch|network|temporarily unavailable|load failed/i.test(error.message || "")) {
        saveForRetry();
        notify("Connection interrupted: appointment saved for a safe retry.");
      } else notify(error.message);
    } finally { setBusy(false); }
  };
  const sendNotice = async (event) => {
    event.preventDefault();
    const result = await run(() => api("/features/notifications/send", { method: "POST", body: JSON.stringify(notice) }, adminToken), "Notification saved in donor inbox.");
    if (result) {
      const failed = [];
      if (notice.email && !result.channels?.email?.sent) failed.push("Email: " + (result.channels?.email?.reason || "provider unavailable"));
      if (notice.push && !result.channels?.push?.sent) failed.push("Push: " + (result.channels?.push?.reason || "provider unavailable"));
      if (failed.length) notify("In-app message saved. External channel issue — " + failed.join("; "));
    }
    await loadAdmin();
  };
  const optimizeRoute = async (event) => {
    event.preventDefault();
    const points = [];
    for (const line of routeForm.split("\n").map(x => x.trim()).filter(Boolean)) {
      const parts = line.split(",");
      if (parts.length < 3 || !Number.isFinite(Number(parts[1])) || !Number.isFinite(Number(parts[2]))) { notify("Use one line per stop: label,latitude,longitude."); return; }
      points.push({ label: parts[0].trim(), lat: Number(parts[1]), lng: Number(parts[2]) });
    }
    if (points.length < 2) { notify("Enter at least two route stops."); return; }
    const result = await run(() => api("/features/logistics/route", { method: "POST", body: JSON.stringify({ points }) }, adminToken), "Emergency route calculated.");
    if (result) setRouteResult(result);
  };
  const logTemperature = async (event) => {
    event.preventDefault();
    const result = await run(() => api("/features/cold-chain/" + encodeURIComponent(coldForm.unitCode), { method: "POST", body: JSON.stringify({ temperatureC: Number(coldForm.temperatureC), minC: Number(coldForm.minC), maxC: Number(coldForm.maxC) }) }, adminToken), "Cold-chain reading recorded.");
    if (result) { setColdEvents(await api("/features/cold-chain", {}, adminToken)); if (!result.inRange) notify("Out-of-range reading recorded; unit quarantined for review."); }
  };
  const importStock = async (event) => {
    event.preventDefault();
    let units;
    try { units = JSON.parse(importText); } catch { notify("Stock import must be valid JSON."); return; }
    const result = await run(() => api("/features/inventory/import", { method: "POST", body: JSON.stringify({ units }) }, adminToken), "Stock import processed.");
    if (result) notify("Imported " + result.imported + " row(s); rejected " + result.rejected + ". All new units remain quarantined pending screening.");
  };
  const triggerBackup = async () => {
    const result = await run(() => api("/features/backup/trigger", { method: "POST", body: "{}" }, adminToken), "Backup provider accepted the trigger.");
    if (result) notify(result.message);
  };
  const downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
  };
  const button = (label, id) => <button key={id} onClick={() => setSection(id)} style={section === id ? glowBtn : ghostBtn}>{label}</button>;

  return <div style={{ marginTop: adminMode ? 0 : 10 }}>
    <SectionLabel>{adminMode ? "BloodBridge feature hub" : "BloodBridge community services"}</SectionLabel>
    <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.65 }}>Appointments · donor engagement · planning intelligence · hospital operations · low-network support. Clinical decisions remain with qualified blood-bank staff.</p>
    {!adminMode && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
      {button(labels.booking, "booking")}{button(labels.map, "map")}
      <label style={{ display: "flex", alignItems: "center", gap: 7, color: COLORS.textMuted, fontSize: 12, marginLeft: "auto" }}>Language
        <select aria-label="Interface language" style={{ ...field, width: 130, padding: "7px 8px" }} value={language} onChange={e => { setLanguage(e.target.value); localStorage.setItem("raktsetu_language", e.target.value); }}>
          <option value="en">English</option><option value="hi">हिन्दी</option>
        </select>
      </label>
    </div>}
    {adminMode && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
      {button(labels.forecast, "forecast")}{button(labels.notifications, "notifications")}{button(labels.retention, "retention")}{button(labels.logistics, "logistics")}{button(labels.cold, "cold")}{button(labels.integrations, "integrations")}{button(labels.analytics, "analytics")}{button(labels.risk, "risk")}{button(labels.import, "import")}{button(labels.backup, "backup")}
    </div>}

    {section === "booking" && <Card hover={false}>
      <h3>{labels.booking}</h3>
      <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.7 }}>{labels.bookingNote} Choose a listed blood bank or donation camp, request a suitable time, and keep your contact number available. The team must confirm the slot; this form does not reserve blood or replace medical screening.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, margin: "12px 0 18px" }}>
        {[["01","Choose a location","Select a listed facility or camp."],["02","Request a time","Send your preferred date and contact details."],["03","Wait for confirmation","The facility confirms availability and next steps."]].map(([n,title,desc])=><div key={n} style={{ padding: 13, borderRadius: 12, border: "1px solid " + COLORS.panelBorder, background: "linear-gradient(145deg,rgba(220,53,78,.07),transparent)" }}><div style={{ color: COLORS.crimson, fontWeight: 850, fontSize: 11, letterSpacing: 1 }}>{n}</div><b style={{ display: "block", margin: "5px 0", fontSize: 13 }}>{title}</b><span style={{ color: COLORS.textMuted, fontSize: 11, lineHeight: 1.55 }}>{desc}</span></div>)}
      </div>
      <form onSubmit={book} style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }} className="grid2">
        <Field label={labels.fullName}><input required maxLength={120} style={field} value={booking.donorName} onChange={e => setBooking({ ...booking, donorName: e.target.value })} /></Field>
        <Field label={labels.contact}><input required type="tel" maxLength={25} style={field} value={booking.contact} onChange={e => setBooking({ ...booking, contact: e.target.value })} placeholder="+91..." /></Field>
        <Field label={labels.location}><select required style={field} value={booking.bloodBankName} onChange={e => setBooking({ ...booking, bloodBankName: e.target.value })}><option value="">Choose a blood bank or camp</option><optgroup label="Blood banks">{banks.map((b,i)=><option key={b.id||b._id||i} value={b.name}>{[b.name,b.city,b.state].filter(Boolean).join(" · ")}</option>)}</optgroup><optgroup label="Upcoming donation camps">{camps.map((c,i)=><option key={c._id||i} value={c.title}>{[c.title,c.city,c.state,c.date?new Date(c.date).toLocaleDateString():""].filter(Boolean).join(" · ")}</option>)}</optgroup></select><div style={{fontSize:11,color:COLORS.textMuted,marginTop:5}}>Approved camps published in Camps & Banks appear here.</div></Field>
        <Field label={labels.date}><input required type="datetime-local" min={new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} style={field} value={booking.scheduledAt} onChange={e => setBooking({ ...booking, scheduledAt: e.target.value })} /></Field>
        <div style={{ gridColumn: "1 / -1" }}><Field label={labels.note}><textarea maxLength={300} rows={2} style={field} value={booking.notes} onChange={e => setBooking({ ...booking, notes: e.target.value })} /></Field></div>
        <button disabled={busy} style={{ ...glowBtn, justifyContent: "center", gridColumn: "1 / -1" }}>{labels.submit}</button>
      </form>
      {queued.length > 0 && <p role="status" style={{ color: COLORS.warn, fontSize: 12, marginTop: 12 }}>{queued.length} appointment request(s) waiting to sync from this device.</p>}
    </Card>}

    {section === "map" && <Card hover={false}>
      <h3>{labels.map}</h3>
      <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.7 }}>Find a listed blood bank, check its address and open directions. The map preview follows your search; it is a location finder, not a live inventory or emergency-dispatch map.</p>
      <Field label="Search blood banks by name, district or address"><input style={field} value={bankSearch} onChange={event => setBankSearch(event.target.value)} placeholder="e.g. Bhopal, district hospital" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(240px,.75fr)", gap: 14, alignItems: "stretch" }} className="grid2">
        <div style={{ border: "1px solid " + COLORS.panelBorder, borderRadius: 14, overflow: "hidden", minHeight: 300, background: COLORS.panel }}>
          <div style={{ padding: "10px 13px", borderBottom: "1px solid " + COLORS.panelBorder, fontSize: 12, fontWeight: 800 }}>MAP PREVIEW · {visibleBanks[0] ? (visibleBanks[0].city || visibleBanks[0].name) : "VIT Bhopal University, MP"}</div>
          <iframe title="Blood bank location map preview" loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: 300, border: 0, display: "block" }} src={"https://maps.google.com/maps?q=" + encodeURIComponent(visibleBanks[0] ? ([visibleBanks[0].name, visibleBanks[0].address, visibleBanks[0].city, visibleBanks[0].state].filter(Boolean).join(", ")) : (bankSearch.trim() || "blood banks in VIT Bhopal University, Sehore, Madhya Pradesh, India")) + "&output=embed"} />
        </div>
        <div style={{ border: "1px solid " + COLORS.panelBorder, borderRadius: 14, padding: 14 }}>
          <b style={{ fontSize: 14 }}>Nearby listing</b>
          {visibleBanks[0] ? <>
            <h4 style={{ margin: "12px 0 6px", lineHeight: 1.4 }}>{visibleBanks[0].name}</h4>
            <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>{[visibleBanks[0].address, visibleBanks[0].city, visibleBanks[0].state].filter(Boolean).join(" · ") || "Address not listed"}</p>
            {visibleBanks[0].phone && <a href={"tel:" + visibleBanks[0].phone} style={{ color: COLORS.cyan, fontSize: 12, display: "block", marginTop: 8 }}>Call {visibleBanks[0].phone}</a>}
            {Number.isFinite(Number(visibleBanks[0].lat)) && Number.isFinite(Number(visibleBanks[0].lng)) && <a target="_blank" rel="noreferrer" href={"https://www.google.com/maps/dir/?api=1&destination=" + visibleBanks[0].lat + "," + visibleBanks[0].lng} style={{ display: "inline-block", marginTop: 12, padding: "9px 12px", borderRadius: 9, background: COLORS.crimson, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>Get directions ↗</a>}
          </> : <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7, marginTop: 12 }}>No verified public blood-bank locations are currently listed. The preview shows a general search area; add verified facility details to make this map specific.</p>}
        </div>
      </div>
      <h4 style={{ margin: "22px 0 10px" }}>Listed blood banks ({visibleBanks.length})</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
        {visibleBanks.map(b => <div key={b.id} style={{ padding: 14, borderRadius: 12, border: "1px solid " + COLORS.panelBorder }}>
          <b>{b.name}</b><div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 5 }}>{[b.city, b.state, b.address].filter(Boolean).join(" · ") || "Address not listed"}</div>
          {b.phone && <div style={{ marginTop: 8, fontSize: 12 }}><a href={"tel:" + b.phone} style={{ color: COLORS.textMuted }}>{b.phone}</a></div>}
          <a target="_blank" rel="noreferrer" href={Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)) ? ("https://www.google.com/maps/dir/?api=1&destination=" + b.lat + "," + b.lng) : ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([b.name,b.city,b.state].filter(Boolean).join(", ")))} style={{ display: "inline-block", marginTop: 10, color: COLORS.cyan, fontSize: 12, fontWeight: 750 }}>Open in Google Maps ↗</a>
        </div>)}
      </div>{!banks.length && <p style={{ color: COLORS.textMuted, marginTop: 12 }}>No verified public blood-bank locations are currently available. Search the map area or add verified blood-bank records through the registration workflow.</p>}{banks.length > 0 && !visibleBanks.length && <p style={{ color: COLORS.textMuted }}>No blood banks match that search.</p>}
    </Card>}

    {adminMode && section === "forecast" && <Card hover={false}><h3>Trend-adjusted shortage forecast</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>{forecast?.disclaimer || "Loading forecast…"}</p>{forecast?.forecast?.map(f => <div key={f.group} style={{ display: "grid", gridTemplateColumns: "52px 1fr 90px", gap: 12, padding: "10px 0", alignItems: "center", borderBottom: "1px solid " + COLORS.panelBorder }}><b>{f.group}</b><div style={{ fontSize: 12, color: COLORS.textMuted }}>{f.availableUnits} available · 7-day demand {f.projected7DayDemand} · trend {f.trendDirection}</div><Pill tone={f.shortageRisk === "High" ? "warn" : f.shortageRisk === "Moderate" ? "info" : "good"}>{f.shortageRisk}</Pill></div>)}<button style={{ ...ghostBtn, marginTop: 12 }} onClick={() => downloadJson("raktsetu-shortage-forecast.json", forecast)}>Export forecast JSON</button></Card>}

    {adminMode && section === "notifications" && <Card hover={false}><h3>Donor notifications</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Saves an in-app notification. SMS is intentionally deferred for a later release. Email and push are optional and require a configured trusted HTTPS webhook. Do not include sensitive patient details.</p><form onSubmit={sendNotice}>
      <Field label="Donor"><select required style={field} value={notice.donorId} onChange={e => setNotice({ ...notice, donorId: e.target.value })}><option value="">Choose donor</option>{donors.map(d => <option key={d._id} value={d._id}>{d.name} · {d.group}</option>)}</select></Field>
      <Field label="Message"><textarea required minLength={3} maxLength={500} rows={3} style={field} value={notice.message} onChange={e => setNotice({ ...notice, message: e.target.value })} /></Field>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>{[["email", "Also send email (webhook)"], ["push", "Also send push (webhook)"]].map(([key, label]) => <label key={key} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12 }}><input type="checkbox" checked={Boolean(notice[key])} onChange={e => setNotice({ ...notice, [key]: e.target.checked })} />{label}</label>)}</div>
      <button disabled={busy} style={glowBtn}>Send notification</button></form></Card>}

    {adminMode && section === "retention" && <Card hover={false}><h3>Donor retention and re-engagement</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>These are reminder candidates based on recorded dates, not medical eligibility decisions. Always confirm suitability with qualified staff.</p><div style={{ overflowX: "auto" }}><table><thead><tr><th>Donor</th><th>Group</th><th>District</th><th>Days since donation</th><th></th></tr></thead><tbody>{retention.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.group}</td><td>{d.district || d.city || "—"}</td><td>{d.daysSinceDonation}</td><td><button style={{ ...ghostBtn, padding: 6 }} onClick={() => { setNotice({ donorId: d.id, message: "Thank you for supporting your community through BloodBridge. If you wish to donate again, please contact your blood bank to confirm eligibility.", email: false, push: false }); setSection("notifications"); }}>Prepare message</button></td></tr>)}</tbody></table></div>{!retention.length && <p>No donor retention candidates currently.</p>}</Card>}

    {adminMode && section === "logistics" && <Card hover={false}><h3>Emergency logistics route</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Enter one stop per line as label,latitude,longitude. OSRM road routing is attempted; fallback estimates are clearly labelled and are not live traffic guidance.</p><form onSubmit={optimizeRoute}><Field label="Stops"><textarea required rows={5} style={field} value={routeForm} onChange={e => setRouteForm(e.target.value)} /></Field><button disabled={busy} style={glowBtn}>Calculate route</button></form>{routeResult && <div style={{ marginTop: 14, padding: 12, border: "1px solid " + COLORS.panelBorder, borderRadius: 10 }}><b>{routeResult.distanceKm} km · about {routeResult.durationMinutes} minutes</b><p style={{ fontSize: 12, color: COLORS.textMuted }}>Source: {routeResult.source}</p>{routeResult.waypointOrder?.map(stop => <div key={stop.index} style={{ fontSize: 12, padding: "5px 0" }}>{stop.index}. {stop.label}</div>)}<p style={{ fontSize: 12 }}>{routeResult.disclaimer}</p></div>}</Card>}

    {adminMode && section === "cold" && <><Card hover={false}><h3>Cold-chain temperature log</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Staff must enter limits from the applicable blood-component protocol. Out-of-range readings quarantine an eligible unit for review; this tool does not set clinical limits.</p><form onSubmit={logTemperature} style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }} className="grid2"><Field label="Unit code"><input required style={field} value={coldForm.unitCode} onChange={e => setColdForm({ ...coldForm, unitCode: e.target.value })} /></Field><Field label="Temperature °C"><input required type="number" step="0.1" style={field} value={coldForm.temperatureC} onChange={e => setColdForm({ ...coldForm, temperatureC: e.target.value })} /></Field><Field label="Protocol minimum °C"><input required type="number" step="0.1" style={field} value={coldForm.minC} onChange={e => setColdForm({ ...coldForm, minC: e.target.value })} /></Field><Field label="Protocol maximum °C"><input required type="number" step="0.1" style={field} value={coldForm.maxC} onChange={e => setColdForm({ ...coldForm, maxC: e.target.value })} /></Field><button disabled={busy} style={glowBtn}>Record reading</button></form></Card><Card hover={false} style={{ marginTop: 12 }}><h3>Recent cold-chain events</h3>{coldEvents.map(e => <p key={e._id} style={{ fontSize: 12, borderBottom: "1px solid " + COLORS.panelBorder, paddingBottom: 8 }}>{new Date(e.occurredAt || e.createdAt).toLocaleString()} · {e.action} · {e.metadata?.unitCode || e.resourceId}</p>)}</Card></>}

    {adminMode && section === "integrations" && <Card hover={false}><h3>Hospital integrations and service readiness</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Partner API keys and scopes remain managed in Advanced Operations. No secrets are displayed here.</p>{integration?.integrations?.map(item => <div key={item.name} style={{ padding: 12, margin: "8px 0", borderRadius: 10, border: "1px solid " + COLORS.panelBorder }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><b>{item.name}</b><Pill tone={item.configured ? "good" : "warn"}>{item.configured ? "Ready" : "Needs configuration"}</Pill></div><p style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 0 }}>{item.detail}</p></div>)}<button style={{ ...ghostBtn, marginTop: 10 }} onClick={loadAdmin}>Refresh integration status</button></Card>}

    {adminMode && section === "analytics" && <Card hover={false}><h3>Aggregate decision support</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Counts only; this panel does not export donor or recipient names.</p>{analytics && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>{[["Request groups", analytics.requests?.length || 0], ["Inventory states", analytics.inventory?.length || 0], ["Donor verification states", analytics.donors?.length || 0], ["Appointment states", analytics.appointments?.length || 0], ["Units expiring in 7 days", analytics.expiringSoon || 0]].map(x => <Card key={x[0]} hover={false} style={{ padding: 12 }}><div style={{ fontSize: 11, color: COLORS.textMuted }}>{x[0]}</div><b style={{ fontSize: 24 }}>{x[1]}</b></Card>)}</div>}<button style={{ ...ghostBtn, marginTop: 12 }} onClick={() => downloadJson("raktsetu-aggregate-analytics.json", analytics)}>Export aggregate JSON</button></Card>}

    {adminMode && section === "risk" && <Card hover={false}><h3>Human-reviewed request risk indicators</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>{risk?.disclaimer || "Loading indicators…"}</p>{risk?.flaggedGroups?.map((r, i) => <div key={i} style={{ padding: 12, marginBottom: 8, borderRadius: 10, background: "rgba(255,59,84,.07)" }}><Pill tone={r.priority === "High review priority" ? "warn" : "info"}>{r.priority}</Pill><p>{r.group} · {r.city} · {r.count} open requests · {r.totalUnits} unit(s)</p><small>{r.reason}</small></div>)}{!risk?.flaggedGroups?.length && <p>No repeated patterns currently require review.</p>}</Card>}

    {adminMode && section === "import" && <Card hover={false}><h3>Hospital / blood-bank inventory import</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Paste a JSON array of unit records. Every imported unit starts quarantined and pending screening. Use an existing bloodBankId from your database.</p><form onSubmit={importStock}><Field label="Inventory JSON"><textarea required rows={10} style={{ ...field, fontFamily: "monospace", fontSize: 11 }} value={importText} onChange={e => setImportText(e.target.value)} /></Field><button disabled={busy} style={glowBtn}>Validate and import</button></form></Card>}

    {adminMode && section === "backup" && <><Card hover={false}><h3>Backup and disaster recovery</h3><p style={{ fontSize: 12, color: COLORS.textMuted }}>Automated database backups require a configured trusted HTTPS webhook or managed MongoDB backups. No donor records are exported by this control.</p><button disabled={busy} style={glowBtn} onClick={triggerBackup}>Trigger configured backup</button><button style={{ ...ghostBtn, marginLeft: 8 }} onClick={() => downloadJson("raktsetu-feature-diagnostics.json", diagnostics)}>Export safe diagnostics</button></Card><Card hover={false} style={{ marginTop: 12 }}><h3>Security and runtime diagnostics</h3>{diagnostics && <><p>Runtime: {diagnostics.runtime} · Node {diagnostics.nodeVersion} · Database: {diagnostics.databaseState}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{Object.entries(diagnostics.configured || {}).map(([key, value]) => <Pill key={key} tone={value ? "good" : "warn"}>{key}: {value ? "configured" : "not configured"}</Pill>)}</div><p style={{ fontSize: 12, color: COLORS.textMuted }}>{diagnostics.message}</p></>}</Card></>}
  </div>;
}


function DonorDigitalIdPanel({ donor, donorToken, notify }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api("/features/donor/profile", {}, donorToken)); }
    catch (error) { notify(error.message); }
  }, [donorToken, notify]);
  const [digitalId, setDigitalId] = useState(null);
  useEffect(() => {
    load();
    api("/features/donor/digital-id", {}, donorToken).then(setDigitalId).catch(error => notify(error.message));
  }, [load, donorToken, notify]);
  const certificate = async (appointmentId) => {
    setBusy(true);
    try {
      const result = await api("/features/donor/certificate/" + appointmentId, {}, donorToken);
      const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(result.certificateId)} · BloodBridge</title><style>body{font-family:Arial,sans-serif;background:#f2f4f7;padding:32px;color:#18212b}.certificate{max-width:850px;margin:auto;background:#fff;border:8px double #a51d37;padding:48px;text-align:center}.eyebrow{letter-spacing:4px;color:#a51d37;font-weight:bold}.name{font-size:34px;margin:28px 0 12px}.rule{height:1px;background:#ddd;margin:26px 0}.meta{display:flex;justify-content:space-between;gap:20px;text-align:left;flex-wrap:wrap}.small{font-size:12px;color:#606b78;line-height:1.6}.print{margin:20px auto;display:block;padding:12px 18px;background:#a51d37;color:white;border:0;border-radius:8px;font-size:15px}@media print{body{background:white;padding:0}.certificate{border:8px double #a51d37;max-width:none}.print{display:none}}</style></head><body><main class="certificate"><div class="eyebrow">RAKTSETU · DONATION RECORD</div><h1>Appointment Completion Certificate</h1><p>This record acknowledges the completed appointment of</p><div class="name">${escapeHtml(result.donorName)}</div><p>Blood group: <strong>${escapeHtml(result.bloodGroup || "Not recorded")}</strong></p><p>at <strong>${escapeHtml(result.organization)}</strong></p><div class="rule"></div><div class="meta"><div><strong>Certificate reference</strong><br>${escapeHtml(result.certificateId)}</div><div><strong>Recorded completion</strong><br>${escapeHtml(new Date(result.completedAt).toLocaleString())}</div><div><strong>Record issued</strong><br>${escapeHtml(new Date(result.issuedAt).toLocaleString())}</div></div><p class="small" style="margin-top:28px">${escapeHtml(result.statement)}</p><p class="small">This is a BloodBridge digital record, not a government ID or a replacement for an official blood-bank certificate.</p><button class="print" onclick="window.print()">Print / Save as PDF</button></main></body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = result.certificateId + ".html"; a.click(); URL.revokeObjectURL(url);
      notify("Printable certificate downloaded. Open it and choose Print → Save as PDF.");
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  };
  return <div>
    <Card hover={false}>
      <h3>Digital donor ID</h3>
      {digitalId ? <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }} className="grid2">
        <div><b className="headline" style={{ fontSize: 20 }}>{digitalId.id}</b><p style={{ margin: "8px 0 4px" }}>{digitalId.name} · {digitalId.bloodGroup}</p><p style={{ fontSize: 12, color: COLORS.textMuted }}>{[digitalId.city, digitalId.state].filter(Boolean).join(", ")}</p><Pill tone={digitalId.bloodGroupVerified ? "good" : "warn"}>{digitalId.bloodGroupVerified ? "Blood group verified" : "Blood group verification pending"}</Pill><p style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 12 }}>{digitalId.disclaimer}</p></div>
        <div style={{ padding: 10, background: "#fff", borderRadius: 8, justifySelf: "center" }}><QRCodeSVG value={digitalId.qrPayload} size={128} includeMargin /></div>
      </div> : <p style={{ color: COLORS.textMuted }}>Loading digital ID…</p>}
    </Card>
    <Card hover={false} style={{ marginTop: 12 }}>
      <h3>Donation and appointment history</h3>
      {data?.eligibility && <p style={{ fontSize: 12, color: COLORS.textMuted }}>Days since recorded donation: {data.eligibility.daysSinceDonation ?? "Not recorded"}. This is a reminder aid, not medical clearance.</p>}
      {(data?.appointments || []).map(item => <div key={item._id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + COLORS.panelBorder }}>
        <div><b>{item.bloodBankName}</b><div style={{ fontSize: 12, color: COLORS.textMuted }}>{new Date(item.scheduledAt).toLocaleString()} · {item.status}</div></div>
        {item.status === "Completed" && <button disabled={busy} style={{ ...ghostBtn, padding: 7 }} onClick={() => certificate(item._id)}>Export certificate</button>}
      </div>)}
      {!data?.appointments?.length && <p style={{ fontSize: 12, color: COLORS.textMuted }}>No appointment records linked to this donor contact yet.</p>}
      <button style={{ ...ghostBtn, marginTop: 12 }} onClick={load}>Refresh history</button>
    </Card>
  </div>;
}

function AdminLoginGate({ onLogin, notify }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin(result.token, result.username);
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto 14px",
                       background: "rgba(255,59,84,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={20} color={COLORS.crimson} />
        </div>
        <div className="headline" style={{ fontSize: 19, fontWeight: 700 }}>Admin access</div>
        <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 4 }}>Restricted to authorized administrators only.</div>
      </div>
      <Card>
        <form onSubmit={submit}>
          <Field label="Username">
            <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Admin username" />
          </Field>
          <Field label="Password">
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          </Field>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
            style={{ ...glowBtn, width: "100%", justifyContent: "center", marginTop: 6, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Signing in…" : "Sign in"}
          </motion.button>
        </form>
      </Card>
    </div>
  );
}

function BloodBankPortal({ notify }) {
  const [mode, setMode] = useState("login");
  const [token, setToken] = useState(() => localStorage.getItem("raktmitra_bloodbank_token") || "");
  const [bank, setBank] = useState(null);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [form, setForm] = useState({ name: "", licenseNumber: "", email: "", phone: "", password: "", confirmPassword: "", otp: "", state: "", district: "", address: "" });
  const [registerStage, setRegisterStage] = useState("form");
  const [bankRecoveryStage, setBankRecoveryStage] = useState("form");
  const [bankRecovery, setBankRecovery] = useState({ email: "", otp: "", newPassword: "", confirmPassword: "" });
  const [inventory, setInventory] = useState([]);
  const [entry, setEntry] = useState({ group: "O+", component: "Whole Blood", units: "1", collectedAt: "", expiresAt: "", batchCode: "" });
  const [doc, setDoc] = useState({ kind: "blood_bank_license", file: null });
  const [section, setSection] = useState("overview");
  const auth = (path, options = {}) => api("/registered-blood-banks" + path, { ...options, headers: { ...(options.headers || {}), ...(token ? { Authorization: "Bearer " + token } : {}) } });
  const refresh = async (activeToken = token) => {
    const t = activeToken;
    if (!t) return;
    const me = await api("/registered-blood-banks/me", { headers: { Authorization: "Bearer " + t } });
    setBank(me);
    const stock = await api("/registered-blood-banks/inventory", { headers: { Authorization: "Bearer " + t } });
    setInventory(stock.inventory || []);
  };
  useEffect(() => { if (token) refresh().catch((e) => { localStorage.removeItem("raktmitra_bloodbank_token"); setToken(""); setBank(null); notify(e.message); }); }, []);
  const loginBank = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const result = await api("/registered-blood-banks/login", { method: "POST", body: JSON.stringify(login) }); localStorage.setItem("raktmitra_bloodbank_token", result.token); setToken(result.token); await refresh(result.token); notify("Welcome to your blood bank dashboard."); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const registerBank = async (e) => {
    e.preventDefault();
    if (!isValidIndianMobile(form.phone)) return notify("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
    if (form.password.length < 8) return notify("Password must contain at least 8 characters.");
    if (form.password !== form.confirmPassword) return notify("Password and confirmation do not match.");
    setBusy(true);
    try {
      if (registerStage === "form") {
        const result = await api("/registered-blood-banks/register/send-otp", { method: "POST", body: JSON.stringify({ phone: form.phone }) });
        setRegisterStage("otp");
        notify(result.demo ? `Demo mode — blood bank registration OTP for +91 ${form.phone}: ${result.code}` : "Registration OTP sent.");
      } else {
        const result = await api("/registered-blood-banks/register", { method: "POST", body: JSON.stringify(form) });
        setMode("login"); setRegisterStage("form"); setLogin({ email: form.email, password: "" }); notify(result.message);
      }
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const sendBankRecoveryOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/registered-blood-banks/forgot-password/send-otp", { method: "POST", body: JSON.stringify({ email: bankRecovery.email }) });
      setBankRecoveryStage("otp");
      notify(result.demo ? `Demo mode — blood bank password reset OTP: ${result.code}` : "Password reset OTP sent.");
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const resetBankPassword = async (e) => {
    e.preventDefault();
    if (bankRecovery.newPassword.length < 8) return notify("New password must contain at least 8 characters.");
    if (bankRecovery.newPassword !== bankRecovery.confirmPassword) return notify("New passwords don't match.");
    setBusy(true);
    try {
      const result = await api("/registered-blood-banks/forgot-password/reset", { method: "POST", body: JSON.stringify({ email: bankRecovery.email, otp: bankRecovery.otp, newPassword: bankRecovery.newPassword }) });
      setBankRecoveryStage("done"); setLogin({ email: bankRecovery.email, password: "" }); notify(result.message);
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const uploadDoc = async (e) => {
    e.preventDefault(); if (!doc.file) return notify("Choose a document first.");
    const fd = new FormData(); fd.append("kind", doc.kind); fd.append("document", doc.file);
    setBusy(true);
    try { const result = await fetch(API_BASE + "/registered-blood-banks/documents", { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd }); const data = await result.json(); if (!result.ok) throw new Error(data.error || "Upload failed."); setBank(data.bank); notify(data.message); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const saveStock = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await auth("/inventory", { method: "POST", body: JSON.stringify({ ...entry, units: Number(entry.units), collectedAt: entry.collectedAt || null, expiresAt: entry.expiresAt || null }) }); await refresh(); notify("Inventory entry saved."); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const logout = () => { localStorage.removeItem("raktmitra_bloodbank_token"); setToken(""); setBank(null); setInventory([]); };
  const field = (label, key, type = "text", required = true) => <label style={{ display: "grid", gap: 6, color: COLORS.textMuted, fontSize: 12, fontWeight: 600 }}>{label}<input required={required} type={key === "phone" ? "tel" : type} inputMode={key === "phone" ? "numeric" : undefined} pattern={key === "phone" ? "[6-9][0-9]{9}" : undefined} maxLength={key === "phone" ? 10 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: key === "phone" ? sanitizeIndianMobile(e.target.value) : e.target.value })} style={inputStyle} /></label>;
  if (!token || !bank) return <div style={{ maxWidth: 960, margin: "0 auto" }}>
    <div style={{ borderRadius: 22, padding: "26px 28px", background: "linear-gradient(120deg,#172f71,#244aa2)", color: "#fff", marginBottom: 22 }}><div style={{ fontSize: 12, opacity: .8, letterSpacing: 1 }}>RAKTMITRA • FACILITY PORTAL</div><h1 className="headline" style={{ margin: "10px 0 6px", fontSize: 30 }}>{mode === "register" ? "Blood Bank Registration" : "Blood Bank Login"}</h1><p style={{ margin: 0, opacity: .85, fontSize: 14 }}>Register your facility, verify your mobile with a demo OTP, and manage blood inventory after approval.</p></div>
    <Card hover={false} style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}><button onClick={() => { setMode("login"); setBankRecoveryStage("form"); }} style={mode === "login" ? glowBtn : ghostBtn}>Login</button><button onClick={() => { setMode("register"); setRegisterStage("form"); }} style={mode === "register" ? glowBtn : ghostBtn}>Register facility</button></div>
      {mode === "login" ? (bankRecoveryStage === "form" ? <form onSubmit={loginBank} style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.textMuted }}>Official email<input type="email" required value={login.email} onChange={e=>setLogin({...login,email:e.target.value})} style={inputStyle}/></label>
        <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.textMuted }}>Password<input type="password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} style={inputStyle}/></label>
        <button disabled={busy} style={glowBtn}>{busy ? "Please wait…" : "Login to Blood Bank Dashboard"}</button>
        <button type="button" onClick={()=>{setMode("register");setRegisterStage("form");}} style={ghostBtn}>Register your facility</button>
        <button type="button" onClick={()=>{setBankRecovery({email:login.email,otp:"",newPassword:"",confirmPassword:""});setBankRecoveryStage("email");}} style={{...ghostBtn,border:0,color:COLORS.cyan}}>Forgot password?</button>
      </form> : <div style={{display:"grid",gap:14}}>
        {bankRecoveryStage === "email" && <form onSubmit={sendBankRecoveryOtp} style={{display:"grid",gap:14}}><p style={{color:COLORS.textMuted,fontSize:13}}>Enter your registered official email. The demo OTP will be displayed in a notification.</p><label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted}}>Official email<input type="email" required value={bankRecovery.email} onChange={e=>setBankRecovery({...bankRecovery,email:e.target.value})} style={inputStyle}/></label><button disabled={busy} style={glowBtn}>{busy?"Generating OTP…":"Generate demo OTP"}</button></form>}
        {bankRecoveryStage === "otp" && <form onSubmit={resetBankPassword} style={{display:"grid",gap:14}}><label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted}}>Demo OTP<input required inputMode="numeric" maxLength={4} value={bankRecovery.otp} onChange={e=>setBankRecovery({...bankRecovery,otp:e.target.value.replace(/\D/g,"").slice(0,4)})} style={inputStyle}/></label><label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted}}>New password<input required type="password" minLength={8} value={bankRecovery.newPassword} onChange={e=>setBankRecovery({...bankRecovery,newPassword:e.target.value})} style={inputStyle}/></label><label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted}}>Confirm new password<input required type="password" minLength={8} value={bankRecovery.confirmPassword} onChange={e=>setBankRecovery({...bankRecovery,confirmPassword:e.target.value})} style={inputStyle}/></label><button disabled={busy} style={glowBtn}>{busy?"Resetting…":"Verify OTP & reset password"}</button><button type="button" onClick={()=>setBankRecoveryStage("email")} style={ghostBtn}>Use another email</button></form>}
        {bankRecoveryStage === "done" && <p style={{color:COLORS.good}}>Password reset successfully. Log in with your new password.</p>}
        <button type="button" onClick={()=>setBankRecoveryStage("form")} style={ghostBtn}>Back to login</button>
      </div>) : <form onSubmit={registerBank} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        {field("Hospital / Blood Bank Name *","name")}{field("Registration / Licence Number *","licenseNumber")}{field("Official Email Address *","email","email")}{field("Secure Password (minimum 8 characters) *","password","password")}{field("Confirm Password *","confirmPassword","password")}{field("Primary Contact Number *","phone","tel")}{field("State *","state")}{field("District *","district")}{field("Complete Address","address","text",false)}
        {registerStage === "otp" && <label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted,gridColumn:"1 / -1"}}>Demo OTP<input required inputMode="numeric" maxLength={4} value={form.otp} onChange={e=>setForm({...form,otp:e.target.value.replace(/\D/g,"").slice(0,4)})} style={inputStyle} placeholder="Enter the OTP shown in the notification"/></label>}
        <div style={{ gridColumn: "1 / -1", padding: 14, borderRadius: 12, background: "rgba(34,211,238,.06)", color: COLORS.textMuted, fontSize: 12, lineHeight: 1.6 }}>Your account remains pending until an administrator reviews your licence and required documents. OTP verification is required to complete registration.</div>
        <button disabled={busy} style={{ ...glowBtn, gridColumn: "1 / -1" }}>{busy ? "Please wait…" : registerStage === "form" ? "Generate demo OTP" : "Verify OTP & register facility"}</button>
        {registerStage === "otp" && <button type="button" onClick={()=>setRegisterStage("form")} style={{...ghostBtn,gridColumn:"1 / -1"}}>Edit details / generate another OTP</button>}
        <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 12, color: COLORS.textMuted }}>Already registered? <button type="button" onClick={()=>setMode("login")} style={{ ...ghostBtn, border: 0, padding: 0 }}>Log in to Dashboard</button></div>
      </form>}
    </Card></div>;
  const available = inventory.filter(i=>i.status==="available" && (!i.expiresAt || new Date(i.expiresAt)>=new Date())).reduce((n,i)=>n+Number(i.units||0),0);
  const expiring = inventory.filter(i=>i.expiresAt && new Date(i.expiresAt)>=new Date() && (new Date(i.expiresAt)-Date.now())<7*86400000).length;
  return <div style={{ maxWidth: 1180, margin: "0 auto" }}>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22 }}><div><div style={{fontSize:11,color:COLORS.crimson,fontWeight:800,letterSpacing:1}}>BLOOD BANK WORKSPACE</div><h1 className="headline" style={{margin:"6px 0",fontSize:30}}>{bank.name}</h1><div style={{fontSize:13,color:COLORS.textMuted}}>{bank.district}, {bank.state} · Licence {bank.licenseNumber}</div></div><div style={{display:"flex",gap:8,alignItems:"center"}}><Pill tone={bank.status==="verified"?"good":bank.status==="rejected"?"warn":"neutral"}>{bank.status.toUpperCase()}</Pill><button style={ghostBtn} onClick={logout}>Log out</button></div></div>
    {bank.status!=="verified" && <Card hover={false} style={{marginBottom:18,borderColor:bank.status==="rejected"?COLORS.crimson:COLORS.warn}}><b>{bank.status==="rejected"?"Verification needs attention":"Verification pending"}</b><p style={{fontSize:13,color:COLORS.textMuted,marginBottom:0}}>{bank.rejectionReason || "Upload a valid blood-bank licence and any required supporting documents. Inventory changes are disabled until approval."}</p></Card>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:22}}><StatCard label="Recorded inventory units" value={available} icon={<Droplet size={18} color={COLORS.crimson}/>} /><StatCard label="Inventory entries" value={inventory.length} icon={<Activity size={18} color={COLORS.cyan}/>} /><StatCard label="Expiring in 7 days" value={expiring} icon={<ShieldAlert size={18} color={COLORS.warn}/>} /><StatCard label="Documents submitted" value={bank.documents?.length||0} icon={<FileText size={18} color={COLORS.good}/>} /></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>{[["overview","Overview"],["inventory","Blood Inventory"],["documents","Documents & Verification"],["profile","Facility Profile"]].map(([key,label])=><button key={key} onClick={()=>setSection(key)} style={section===key?glowBtn:ghostBtn}>{label}</button>)}</div>
    {section==="overview" && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}><Card hover={false}><h3 className="headline">Inventory health</h3><p style={{color:COLORS.textMuted,fontSize:13,lineHeight:1.7}}>Track component-level stock and expiry dates. Only verified facilities can add inventory entries. Confirm stock against your regulated records before publishing availability.</p><button style={glowBtn} onClick={()=>setSection("inventory")}>Manage inventory</button></Card><Card hover={false}><h3 className="headline">Verification checklist</h3>{["Valid blood-bank licence","State / health authority supporting documents","Optional accreditation document"].map((x,i)=><div key={x} style={{padding:"10px 0",borderBottom:"1px solid "+COLORS.panelBorder,fontSize:13,display:"flex",gap:9}}><span style={{color:bank.documents?.some(d=>d.kind===["blood_bank_license","state_noc","accreditation"][i])?COLORS.good:COLORS.warn}}>●</span>{x}</div>)}<button style={{...ghostBtn,marginTop:12}} onClick={()=>setSection("documents")}>Upload documents</button></Card></div>}
    {section==="documents" && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><Card hover={false}><h3 className="headline">Upload verification document</h3><form onSubmit={uploadDoc} style={{display:"grid",gap:14}}><label style={{display:"grid",gap:6,fontSize:12,color:COLORS.textMuted}}>Document category<select value={doc.kind} onChange={e=>setDoc({...doc,kind:e.target.value})} style={inputStyle}><option value="blood_bank_license">Blood Bank Licence (required)</option><option value="state_noc">State Health Department NOC</option><option value="accreditation">NABH / accreditation (optional)</option><option value="other">Other supporting document</option></select></label><input required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e=>setDoc({...doc,file:e.target.files?.[0]||null})} style={inputStyle}/><div style={{fontSize:11,color:COLORS.textMuted}}>PDF, JPG or PNG · maximum 5 MB per file.</div><button disabled={busy} style={glowBtn}>{busy?"Uploading…":"Upload document"}</button></form></Card><Card hover={false}><h3 className="headline">Submitted documents</h3>{(bank.documents||[]).length===0?<p style={{color:COLORS.textMuted,fontSize:13}}>No documents uploaded yet.</p>:bank.documents.map(d=><div key={d._id} style={{padding:"12px 0",borderBottom:"1px solid "+COLORS.panelBorder}}><b style={{fontSize:13}}>{d.originalName}</b><div style={{fontSize:11,color:COLORS.textMuted,marginTop:5}}>{d.kind.replaceAll("_"," ")} · {d.reviewStatus}</div></div>)}</Card></div>}
    {section==="inventory" && <><Card hover={false} style={{marginBottom:16}}><h3 className="headline">Add inventory batch</h3><form onSubmit={saveStock} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Blood group<select value={entry.group} onChange={e=>setEntry({...entry,group:e.target.value})} style={inputStyle}>{["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(x=><option key={x}>{x}</option>)}</select></label><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Component<select value={entry.component} onChange={e=>setEntry({...entry,component:e.target.value})} style={inputStyle}>{[["Whole Blood","Whole Blood"],["Packed Red Cells","Packed Red Blood Cells"],["Platelets","Platelets"],["Fresh Frozen Plasma","Fresh Frozen Plasma"],["Cryoprecipitate","Cryoprecipitate"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Units<input type="number" min="0" max="10000" step="1" required value={entry.units} onChange={e=>setEntry({...entry,units:e.target.value})} style={inputStyle}/></label><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Collection date<input type="date" value={entry.collectedAt} onChange={e=>setEntry({...entry,collectedAt:e.target.value})} style={inputStyle}/></label><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Expiry date<input type="date" value={entry.expiresAt} onChange={e=>setEntry({...entry,expiresAt:e.target.value})} style={inputStyle}/></label><label style={{display:"grid",gap:5,fontSize:12,color:COLORS.textMuted}}>Batch / reference code<input value={entry.batchCode} onChange={e=>setEntry({...entry,batchCode:e.target.value})} style={inputStyle}/></label><button disabled={busy||bank.status!=="verified"} style={{...glowBtn,gridColumn:"1 / -1"}}>{bank.status==="verified"?"Save inventory entry":"Verification required to edit inventory"}</button></form></Card><Card hover={false} style={{padding:0,overflowX:"auto"}}><table><thead><tr><th>Group</th><th>Component</th><th>Units</th><th>Collected</th><th>Expires</th><th>Batch</th><th>Status</th></tr></thead><tbody>{inventory.map(i=><tr key={i._id}><td><Pill tone={i.group.includes("-")?"info":"warn"}>{i.group}</Pill></td><td>{i.component}</td><td>{i.units}</td><td>{i.collectedAt?new Date(i.collectedAt).toLocaleDateString():"—"}</td><td>{i.expiresAt?new Date(i.expiresAt).toLocaleDateString():"—"}</td><td>{i.batchCode||"—"}</td><td><Pill tone={i.status==="available"?"good":i.status==="expired"?"warn":"neutral"}>{i.status}</Pill></td></tr>)}</tbody></table></Card></>}
    {section==="profile" && <Card hover={false}><h3 className="headline">Registered facility details</h3>{[["Name",bank.name],["Licence number",bank.licenseNumber],["Official email",bank.email],["Contact",bank.phone],["Location",bank.district+", "+bank.state],["Address",bank.address||"Not supplied"],["Registered",new Date(bank.createdAt).toLocaleString()]].map(([k,v])=><div key={k} style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:12,padding:"12px 0",borderBottom:"1px solid "+COLORS.panelBorder,fontSize:13}}><span style={{color:COLORS.textMuted}}>{k}</span><b>{v}</b></div>)}</Card>}
  </div>;
}

function AdminView({ donors, requests, refreshAll, notify, adminToken, adminUsername, onLogin, onLogout }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [rareDonors, setRareDonors] = useState([]);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [registeredBanks, setRegisteredBanks] = useState([]);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [donorStateFilter, setDonorStateFilter] = useState("");
  const [donorDistrictFilter, setDonorDistrictFilter] = useState("");


  const loadRareDonors = useCallback(async () => {
    try {
      const data = await api("/rare-donors");
      setRareDonors(data);
    } catch (err) {
      setRareDonors([]);
      notify(err.message);
    }
  }, [notify]);

  const loadVerificationQueue = useCallback(async () => {
    try {
      const data = await api("/donors/admin/verification/all", {}, adminToken);
      setVerificationQueue(data);
    } catch (err) {
      // Clear stale verification data rather than displaying old records.
      setVerificationQueue([]);
      notify(err.message);
    }
  }, [adminToken, notify]);

  const loadRegisteredBanks = useCallback(async () => {
    try {
      const data = await api("/registered-blood-banks/admin/all", {}, adminToken);
      setRegisteredBanks(Array.isArray(data) ? data : []);
    } catch (err) {
      setRegisteredBanks([]);
      notify(err.message);
    }
  }, [adminToken, notify]);

  const reviewBloodBank = async (id, action, reason = "") => {
    try {
      await api(`/registered-blood-banks/admin/${id}/review`, { method: "PATCH", body: JSON.stringify({ action, reason }) }, adminToken);
      notify("Blood bank status updated.");
      loadRegisteredBanks();
    } catch (err) { notify(err.message); }
  };

  const reviewBankDocument = async (id, documentId, action) => {
    try {
      await api(`/registered-blood-banks/admin/${id}/documents/${documentId}`, { method: "PATCH", body: JSON.stringify({ action }) }, adminToken);
      notify("Document review saved.");
      loadRegisteredBanks();
    } catch (err) { notify(err.message); }
  };

  const viewBankDocument = async (id, documentId) => {
    try { await openProtectedFile(`/registered-blood-banks/admin/${id}/documents/${documentId}/file`, adminToken); }
    catch (err) { notify(err.message); }
  };

  useEffect(() => {
    if (adminToken) { loadRareDonors(); loadVerificationQueue(); loadRegisteredBanks(); }
    else {
      setRareDonors([]);
      setVerificationQueue([]);
      setRegisteredBanks([]);
    }
  }, [adminToken, loadRareDonors, loadVerificationQueue]);

  const viewDocument = async (donorId) => {
    try {
      await openProtectedFile(`/donors/admin/verification/${donorId}/document`, adminToken);
    } catch (err) {
      notify(err.message);
    }
  };

  const approveVerification = async (donorId) => {
    try {
      await api(`/donors/admin/verification/${donorId}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }, adminToken);
      notify("Blood group verified.");
      loadVerificationQueue();
      refreshAll();
    } catch (err) { notify(err.message); }
  };

  const rejectVerification = async (donorId) => {
    try {
      await api(`/donors/admin/verification/${donorId}`, { method: "PATCH", body: JSON.stringify({ action: "reject", reason: rejectReason }) }, adminToken);
      notify("Verification rejected.");
      setRejectingId(null);
      setRejectReason("");
      loadVerificationQueue();
      refreshAll();
    } catch (err) { notify(err.message); }
  };

  const toggleVerify = async (id) => {
    try { await api(`/donors/${id}/verify`, { method: "PATCH" }, adminToken); refreshAll(); }
    catch (err) { notify(err.message); }
  };
  const toggleVerifyRare = async (id) => {
    try { await api(`/rare-donors/${id}/verify`, { method: "PATCH" }, adminToken); loadRareDonors(); }
    catch (err) { notify(err.message); }
  };
  const closeRequest = async (id, matchedDonorIds) => {
    try {
      const donorId = matchedDonorIds && matchedDonorIds.length ? matchedDonorIds[0] : undefined;
      await api(`/requests/${id}/fulfill`, { method: "PATCH", body: JSON.stringify({ donorId }) }, adminToken);
      refreshAll();
    } catch (err) { notify(err.message); }
  };

  const RARE_COLOR = "#B583FF"; // distinct purple accent, separate from crimson/cyan used for normal donors

  const stats = useMemo(() => ({
    total: donors.length,
    verified: donors.filter((d) => d.verified).length,
    available: donors.filter((d) => d.available).length,
    openReq: requests.filter((r) => r.status === "Open" || r.status === "Matched").length,
  }), [donors, requests]);

  // Derive filter choices and visible rows once per donor/filter change.
  const donorStates = useMemo(() => [...new Set(donors.map(d => String(d.state || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [donors]);
  const donorDistricts = useMemo(() => [...new Set(donors
    .filter(d => !donorStateFilter || String(d.state || "").trim().toLocaleLowerCase() === donorStateFilter.toLocaleLowerCase())
    .map(d => String(d.district || d.city || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [donors, donorStateFilter]);
  const filteredDonors = useMemo(() => donors.filter(d => {
    const stateMatches = !donorStateFilter || String(d.state || "").trim().toLocaleLowerCase() === donorStateFilter.toLocaleLowerCase();
    const district = String(d.district || d.city || "").trim();
    const districtMatches = !donorDistrictFilter || district.toLocaleLowerCase() === donorDistrictFilter.toLocaleLowerCase();
    return stateMatches && districtMatches;
  }), [donors, donorStateFilter, donorDistrictFilter]);

  if (!adminToken) {
    return <AdminLoginGate onLogin={onLogin} notify={notify} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <SectionLabel>Administrator command center</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>Signed in as <b style={{ color: COLORS.text }}>{adminUsername}</b></span>
          <button onClick={onLogout} style={{ ...ghostBtn, padding: "7px 13px", fontSize: 12 }}>
            <LogOut size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Log out
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 20, marginBottom: 30 }} className="grid2">
        <StatCard label="Total donors" value={stats.total} icon={<Users size={18} color={COLORS.cyan} />} />
        <StatCard label="Verified" value={stats.verified} icon={<ShieldCheck size={18} color={COLORS.good} />} />
        <StatCard label="Available" value={stats.available} icon={<Activity size={18} color={COLORS.crimson} />} />
        <StatCard label="Active requests" value={stats.openReq} icon={<ShieldAlert size={18} color={COLORS.warn} />} />
      </div>

      {activeSection === "dashboard" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          {[
            ["analytics", "Analytics", "Donor growth, request trends, district coverage and verification rates.", <Activity size={19} color={COLORS.cyan} />],
            ["donors", "Donors", "Review registered donors and manage availability and verification.", <Users size={19} color={COLORS.cyan} />],
            ["requests", "Recipients & Requests", "Review blood requests and mark fulfilled requests.", <BellRing size={19} color={COLORS.warn} />],
            ["bloodbanks", "Blood Banks", "Review facility registrations, licences, verification requests, and blood-bank inventory.", <Building2 size={19} color={COLORS.good} />],
            ["verification", "Blood Group Verification", "Review uploaded blood-group proof and approve or reject it.", <FileText size={19} color={COLORS.crimson} />],
            ["operations", "Operations & Reports", "Open traceability, appointments, alerts and operational reports.", <Activity size={19} color={COLORS.good} />],
            ["features", "Feature Hub", "Manage shortage intelligence, notifications, donor retention, routing, cold-chain logs, integrations, analytics and recovery.", <Sparkles size={19} color={COLORS.cyan} />],
          ].map(([key, title, description, icon]) => (
            <Card key={key} hover={false} style={{ minHeight: 185, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(255,255,255,0.07)", marginBottom: 14 }}>{icon}</div>
                <div className="headline" style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
                <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.6, marginBottom: 16 }}>{description}</p>
              </div>
              <button onClick={() => setActiveSection(key)} style={{ ...ghostBtn, border: 0, color: COLORS.cyan, padding: 0, alignSelf: "flex-start" }}>Manage <ChevronRight size={14} style={{ verticalAlign: -3 }} /></button>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <button onClick={() => setActiveSection("dashboard")} style={{ ...ghostBtn, margin: "0 0 18px" }}>← Back to Admin dashboard</button>
          {activeSection === "analytics" && <>
      <SectionLabel>Live admin analytics</SectionLabel>
      <p style={{ color: COLORS.textMuted, fontSize: 12.5, lineHeight: 1.6 }}>Live summaries from the records currently loaded in the admin dashboard. Refresh the page after making changes to update these figures.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Total donors" value={donors.length} icon={<Users size={18} color={COLORS.cyan} />} />
        <StatCard label="Verified donors" value={donors.filter(d => d.verified).length} icon={<ShieldCheck size={18} color={COLORS.good} />} />
        <StatCard label="Available donors" value={donors.filter(d => d.available).length} icon={<Activity size={18} color={COLORS.cyan} />} />
        <StatCard label="Open requests" value={requests.filter(r => ["Open", "Matched"].includes(r.status)).length} icon={<BellRing size={18} color={COLORS.warn} />} />
        <StatCard label="Fulfilled requests" value={requests.filter(r => r.status === "Fulfilled").length} icon={<CheckCircle2 size={18} color={COLORS.good} />} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <Card hover={false}><h3>Donors by blood group</h3>{donors.length ? <div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={GROUPS.map(group => ({ group, donors: donors.filter(d => d.group === group).length }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" /><XAxis dataKey="group" stroke={COLORS.textMuted} /><YAxis allowDecimals={false} stroke={COLORS.textMuted} /><Tooltip contentStyle={{ background: "#151820", border: "1px solid #343945", borderRadius: 10 }} /><Bar dataKey="donors" fill={COLORS.crimson} radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div> : <p style={{ color: COLORS.textMuted }}>No donor records are loaded.</p>}</Card>
        <Card hover={false}><h3>Requests by status</h3>{requests.length ? <div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={["Open", "Matched", "Fulfilled"].map(status => ({ status, requests: requests.filter(r => r.status === status).length }))}><CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" /><XAxis dataKey="status" stroke={COLORS.textMuted} /><YAxis allowDecimals={false} stroke={COLORS.textMuted} /><Tooltip contentStyle={{ background: "#151820", border: "1px solid #343945", borderRadius: 10 }} /><Bar dataKey="requests" fill={COLORS.cyan} radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div> : <p style={{ color: COLORS.textMuted }}>No request records are loaded.</p>}</Card>
      </div>
      <Card hover={false} style={{ marginTop: 14 }}><h3>Verification overview</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>{[["Verified",donors.filter(d=>d.verified).length],["Pending",donors.filter(d=>!d.verified).length],["Available",donors.filter(d=>d.available).length],["Unavailable",donors.filter(d=>!d.available).length]].map(([label,value])=><div key={label} style={{ border:"1px solid "+COLORS.panelBorder,borderRadius:10,padding:13 }}><div style={{fontSize:12,color:COLORS.textMuted}}>{label}</div><b style={{fontSize:23}}>{value}</b></div>)}</div></Card>
      </>}
          {activeSection === "donors" && <>
      <SectionLabel>Donor verification queue</SectionLabel>
      <Card hover={false} style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
            Filter by state
            <select value={donorStateFilter} onChange={e => { setDonorStateFilter(e.target.value); setDonorDistrictFilter(""); }} style={{ ...inputStyle, width: "100%" }}>
              <option value="">All states</option>
              {donorStates.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
            Filter by district
            <select value={donorDistrictFilter} onChange={e => setDonorDistrictFilter(e.target.value)} disabled={!donorStateFilter} style={{ ...inputStyle, width: "100%", opacity: donorStateFilter ? 1 : .6 }}>
              <option value="">All districts</option>
              {donorDistricts.map(district => <option key={district} value={district}>{district}</option>)}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{filteredDonors.length} of {donors.length} donors</span>
            <button type="button" style={{ ...ghostBtn, padding: "9px 13px", fontSize: 12 }} onClick={() => { setDonorStateFilter(""); setDonorDistrictFilter(""); }} disabled={!donorStateFilter && !donorDistrictFilter}>Clear filters</button>
          </div>
        </div>
      </Card>
      <Card style={{ padding: 0, marginBottom: 34, overflowX: "auto" }} hover={false}>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Group</th><th>Gender</th><th>Phone</th><th>District</th><th>Fee</th><th>Status</th><th>Availability</th><th></th></tr></thead>
          <tbody>
            {filteredDonors.map((d) => (
              <tr key={d._id}>
                <td style={{ color: COLORS.textMuted }}>{d._id.slice(-6)}</td>
                <td>{d.name}</td>
                <td><Pill tone="warn">{d.group}</Pill></td>
                <td style={{ color: COLORS.textMuted }}>{d.gender}</td>
                <td>+91 {d.phone}</td>
                <td style={{ color: COLORS.textMuted }}>{d.district || d.city || "—"}</td>
                <td>{d.verified ? <Pill tone="good">Verified</Pill> : <Pill tone="neutral">Pending</Pill>}</td>
                <td>{d.available ? <Pill tone="good">Available</Pill> : <Pill tone="neutral">Unavailable</Pill>}</td>
                <td><button style={{ ...ghostBtn, padding: "6px 13px", fontSize: 12 }} onClick={() => toggleVerify(d._id)}>
                  {d.verified ? "Revoke" : "Verify"}
                </button></td>
              </tr>
            ))}
            {!filteredDonors.length && <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: COLORS.textMuted }}>No donors found for the selected location.</td></tr>}
          </tbody>
        </table>
      </Card>

      </>}

          {activeSection === "rare" && <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: RARE_COLOR }} />
        <SectionLabel>Rare-type donor verification queue</SectionLabel>
      </div>
      <Card style={{ padding: 0, marginBottom: 34, overflowX: "auto", borderColor: RARE_COLOR + "40" }} hover={false}>
        {rareDonors.length === 0 ? (
          <div style={{ padding: "24px", color: COLORS.textMuted, fontSize: 13, textAlign: "center" }}>
            No rare-type donors registered yet.
          </div>
        ) : (
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Rare Type</th><th>Gender</th><th>Phone</th><th>District</th><th>Status</th><th>Availability</th><th></th></tr></thead>
            <tbody>
              {rareDonors.map((d) => (
                <tr key={d._id}>
                  <td style={{ color: COLORS.textMuted }}>{d._id.slice(-6)}</td>
                  <td>{d.name}</td>
                  <td>
                    <span style={{
                      background: RARE_COLOR + "22", color: RARE_COLOR, fontSize: 11.5, fontWeight: 700,
                      padding: "4px 11px", borderRadius: 20, border: `1px solid ${RARE_COLOR}44`, whiteSpace: "nowrap",
                    }}>{d.rareType}</span>
                  </td>
                  <td style={{ color: COLORS.textMuted }}>{d.gender}</td>
                  <td>+91 {d.phone}</td>
                  <td style={{ color: COLORS.textMuted }}>{d.district || d.city || "—"}</td>
                  <td>{d.verified ? <Pill tone="good">Verified</Pill> : <Pill tone="neutral">Pending</Pill>}</td>
                  <td>{d.available ? <Pill tone="good">Available</Pill> : <Pill tone="neutral">Unavailable</Pill>}</td>
                  <td><button style={{ ...ghostBtn, padding: "6px 13px", fontSize: 12, borderColor: RARE_COLOR + "55", color: RARE_COLOR }} onClick={() => toggleVerifyRare(d._id)}>
                    {d.verified ? "Revoke" : "Verify"}
                  </button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      </>}

          {activeSection === "bloodbanks" && <>
      <SectionLabel>Blood bank registration & verification queue</SectionLabel>
      <Card hover={false} style={{ padding: 0, marginBottom: 24, overflowX: "auto" }}>
        {registeredBanks.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted }}>No blood bank registrations yet. New registrations will appear here for review.</div> :
        <table><thead><tr><th>Facility</th><th>Licence</th><th>Contact</th><th>Location</th><th>Documents</th><th>Status</th><th>Review</th></tr></thead><tbody>
          {registeredBanks.map((b) => <tr key={b._id}>
            <td><b>{b.name}</b><div style={{fontSize:11,color:COLORS.textMuted}}>{b.email}</div></td>
            <td>{b.licenseNumber}</td><td>{b.phone}</td><td>{b.district}, {b.state}</td>
            <td style={{minWidth:230}}>{(b.documents||[]).length===0?<span style={{color:COLORS.warn,fontSize:12}}>No documents</span>:(b.documents||[]).map(d=><div key={d._id} style={{padding:"5px 0",borderBottom:"1px solid "+COLORS.panelBorder}}><button onClick={()=>viewBankDocument(b._id,d._id)} style={{...ghostBtn,padding:"4px 8px",fontSize:11}}><FileText size={12}/> {d.originalName}</button><div style={{fontSize:10,color:COLORS.textMuted,marginTop:3}}>{d.kind.replaceAll("_"," ")} · {d.reviewStatus}</div>{d.reviewStatus==="pending"&&<div style={{display:"flex",gap:5,marginTop:4}}><button onClick={()=>reviewBankDocument(b._id,d._id,"approve")} style={{...ghostBtn,padding:"3px 7px",fontSize:10,color:COLORS.good}}>Approve doc</button><button onClick={()=>reviewBankDocument(b._id,d._id,"reject")} style={{...ghostBtn,padding:"3px 7px",fontSize:10,color:COLORS.crimson}}>Reject doc</button></div>}</div>)}</td>
            <td><Pill tone={b.status==="verified"?"good":b.status==="rejected"||b.status==="suspended"?"warn":"neutral"}>{b.status}</Pill>{b.rejectionReason&&<div style={{fontSize:10,color:COLORS.textMuted,maxWidth:140,marginTop:4}}>{b.rejectionReason}</div>}</td>
            <td style={{minWidth:140}}><div style={{display:"grid",gap:6}}><button onClick={()=>reviewBloodBank(b._id,"verify")} style={{...ghostBtn,padding:"5px 8px",fontSize:11,color:COLORS.good}} disabled={b.status==="verified"}>Verify facility</button><button onClick={()=>{const reason=window.prompt("Reason for rejection (visible to the facility):")||"";reviewBloodBank(b._id,"reject",reason);}} style={{...ghostBtn,padding:"5px 8px",fontSize:11,color:COLORS.crimson}}>Reject</button><button onClick={()=>reviewBloodBank(b._id,"suspend")} style={{...ghostBtn,padding:"5px 8px",fontSize:11}} disabled={b.status==="suspended"}>Suspend</button></div></td>
          </tr>)}
        </tbody></table>}
      </Card>
      <SectionLabel>Inventory snapshots</SectionLabel>
      <Card hover={false} style={{padding:0,overflowX:"auto"}}><table><thead><tr><th>Blood bank</th><th>Verification</th><th>Inventory entries</th><th>Recorded units</th><th>Last update</th></tr></thead><tbody>{registeredBanks.map(b=><tr key={b._id}><td>{b.name}</td><td><Pill tone={b.status==="verified"?"good":"neutral"}>{b.status}</Pill></td><td>{b.inventory?.length||0}</td><td>{(b.inventory||[]).filter(i=>i.status==="available").reduce((n,i)=>n+Number(i.units||0),0)}</td><td>{b.lastInventoryUpdate?new Date(b.lastInventoryUpdate).toLocaleString():"—"}</td></tr>)}</tbody></table></Card>
      </>}
          {activeSection === "verification" && <>
      <SectionLabel>Blood group verification queue</SectionLabel>
      <Card style={{ padding: 0, marginBottom: 34, overflowX: "auto" }} hover={false}>
        {verificationQueue.length === 0 ? (
          <div style={{ padding: "24px", color: COLORS.textMuted, fontSize: 13, textAlign: "center" }}>
            No pending, verified, or rejected blood-group documents yet.
          </div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Group</th><th>District</th><th>Status</th><th>Document</th><th></th></tr></thead>
            <tbody>
              {verificationQueue.map((d) => (
                <tr key={d._id}>
                  <td>{d.name}<div style={{ fontSize: 11, color: COLORS.textMuted }}>+91 {d.phone}</div></td>
                  <td><Pill tone="warn">{d.group}</Pill></td>
                  <td style={{ color: COLORS.textMuted }}>{d.district || d.city || "—"}</td>
                  <td>
                    <VerificationBadge status={d.bloodGroupStatus} />
                    {d.bloodGroupStatus === "rejected" && d.bloodGroupRejectionReason && (
                      <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 4, maxWidth: 180 }}>{d.bloodGroupRejectionReason}</div>
                    )}
                  </td>
                  <td>
                    {d.bloodGroupDocOriginalName ? (
                      <button onClick={() => viewDocument(d._id)} style={{ ...ghostBtn, padding: "5px 11px", fontSize: 11.5 }}>
                        <FileText size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> View
                      </button>
                    ) : <span style={{ color: COLORS.textMuted, fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    {d.bloodGroupStatus === "pending" && (
                      rejectingId === d._id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 220 }}>
                          <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)"
                            style={{ ...inputStyle, padding: "6px 9px", fontSize: 11.5 }} />
                          <button onClick={() => rejectVerification(d._id)} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11.5, borderColor: COLORS.crimson + "55", color: COLORS.crimson }}>Confirm</button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11.5 }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => approveVerification(d._id)} style={{ ...ghostBtn, padding: "5px 11px", fontSize: 11.5, borderColor: COLORS.good + "55", color: COLORS.good }}>Approve</button>
                          <button onClick={() => setRejectingId(d._id)} style={{ ...ghostBtn, padding: "5px 11px", fontSize: 11.5, borderColor: COLORS.crimson + "55", color: COLORS.crimson }}>Reject</button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      </>}

          {activeSection === "operations" && <>
      <OperationsGrowthPanel adminToken={adminToken} notify={notify} />
      <AdvancedOperationsPanel adminToken={adminToken} notify={notify} />
      </>}

          {activeSection === "features" && <FeatureHubPanel adminMode adminToken={adminToken} notify={notify} />}

          {activeSection === "requests" && <>
      <SectionLabel>Requests</SectionLabel>
      <Card style={{ padding: 0, overflowX: "auto" }} hover={false}>
        <table>
          <thead><tr><th>ID</th><th>Recipient</th><th>Group</th><th>Units</th><th>Urgency</th><th>Status</th><th>Raised</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id}>
                <td style={{ color: COLORS.textMuted }}>{r._id.slice(-6)}</td>
                <td>{r.recipient}</td>
                <td><Pill tone="warn">{r.group}</Pill></td>
                <td>{r.units}</td>
                <td>{r.urgency === "High" ? <Pill tone="warn">High</Pill> : <Pill tone="info">Normal</Pill>}</td>
                <td>{r.status === "Fulfilled" ? <Pill tone="good">Fulfilled</Pill> : r.status === "Matched" ? <Pill tone="info">Matched</Pill> : <Pill tone="neutral">Open</Pill>}</td>
                <td style={{ color: COLORS.textMuted }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>{r.status !== "Fulfilled" && (
                  <button style={{ ...ghostBtn, padding: "6px 13px", fontSize: 12 }} onClick={() => closeRequest(r._id, r.matchedDonorIds)}>Mark fulfilled</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </>}
        </>
      )}
    </div>
  );
}
