import React, { useState } from "react";
import { Phone, Navigation, Zap, AlertCircle, X, ShieldAlert, ArrowUpRight } from "lucide-react";

export default function EmergencyBanner({ onFindNearestBank, apiBase = "/api" }) {
  const [showOptions, setShowOptions] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleTakeMeToNearestBank = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      window.open("https://www.google.com/maps/search/?api=1&query=blood+bank+near+me", "_blank");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocating(false);
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude.toFixed(6)},${longitude.toFixed(6)}&destination=blood+bank+near+me`;
        window.open(mapsUrl, "_blank");
        if (typeof onFindNearestBank === "function") {
          onFindNearestBank({ lat: latitude, lng: longitude });
        }
      },
      () => {
        setLocating(false);
        window.open("https://www.google.com/maps/search/?api=1&query=blood+bank+near+me", "_blank");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  return (
    <>
      <aside
        aria-label="Emergency quick action bar"
        style={{
          background: "radial-gradient(120% 120% at 50% 0%, #450a0a 0%, #1f0709 60%, #0f0507 100%)",
          color: "#ffffff",
          borderBottom: "1px solid rgba(239, 68, 68, 0.35)",
          boxShadow: "0 10px 30px -10px rgba(239, 68, 68, 0.25)",
          position: "relative",
          zIndex: 35,
          padding: "10px 18px",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          {/* Handcrafted Emergency Indicator Tag */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                position: "relative",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(185, 28, 28, 0.15))",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 16px rgba(239, 68, 68, 0.35)",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "#fca5a5",
                  boxShadow: "0 0 10px #ef4444",
                  display: "inline-block",
                  animation: "pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                    color: "#f87171",
                  }}
                >
                  CRITICAL DISPATCH
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    background: "rgba(239, 68, 68, 0.22)",
                    color: "#fecaca",
                    padding: "1px 6px",
                    borderRadius: 999,
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    fontWeight: 700,
                  }}
                >
                  LIVE
                </span>
              </div>
              <span style={{ display: "block", fontSize: 12, color: "#e5e7eb", fontWeight: 500, marginTop: 1 }}>
                In acute emergencies, dispatch immediately
              </span>
            </div>
          </div>

          {/* Handcrafted Tactile Emergency Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Unified InstAmbulance Dial Button: Human-crafted embossed pill */}
            <div style={{ display: "inline-flex", alignItems: "stretch", borderRadius: 999, boxShadow: "0 8px 24px -4px rgba(220, 38, 38, 0.5), inset 0 1px 1px rgba(255,255,255,0.4)" }}>
              <a
                href="tel:108"
                aria-label="Call InstAmbulance 108"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
                  color: "#ffffff",
                  fontWeight: 850,
                  fontSize: 13.5,
                  padding: "10px 18px",
                  borderTopLeftRadius: 999,
                  borderBottomLeftRadius: 999,
                  borderRight: "1px solid rgba(255,255,255,0.22)",
                  borderTop: "1px solid rgba(255,255,255,0.25)",
                  borderBottom: "1px solid rgba(185,28,28,0.6)",
                  borderLeft: "1px solid rgba(255,255,255,0.25)",
                  textDecoration: "none",
                  cursor: "pointer",
                  letterSpacing: -0.2,
                  transition: "transform 0.15s ease, filter 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Phone size={13} fill="currentColor" />
                </div>
                <span>InstAmbulance · Call 108</span>
              </a>

              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                title="More ambulance numbers (102)"
                aria-label="Choose 102 or secondary ambulance"
                style={{
                  background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
                  color: "#fecaca",
                  padding: "0 12px",
                  borderTopRightRadius: 999,
                  borderBottomRightRadius: 999,
                  borderTop: "1px solid rgba(255,255,255,0.25)",
                  borderBottom: "1px solid rgba(185,28,28,0.6)",
                  borderRight: "1px solid rgba(255,255,255,0.25)",
                  borderLeft: 0,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span>/ 102</span>
              </button>
            </div>

            {/* Handcrafted Tactile "Take Me to Nearest Blood Bank" Button */}
            <button
              type="button"
              onClick={handleTakeMeToNearestBank}
              disabled={locating}
              aria-label="Take me to nearest blood bank"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #075985 100%)",
                color: "#ffffff",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                fontWeight: 800,
                fontSize: 13,
                padding: "10px 18px",
                borderRadius: 999,
                cursor: "pointer",
                boxShadow: "0 8px 20px -4px rgba(2, 132, 199, 0.45), inset 0 1px 1px rgba(255,255,255,0.35)",
                letterSpacing: -0.2,
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.18)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Navigation size={12} fill="currentColor" />
              </div>
              <span>{locating ? "Locating with GPS…" : "Take Me to Nearest Blood Bank"}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Human-crafted Ambulance Options Dialog */}
      {showOptions && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8, 10, 15, 0.82)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 16,
            backdropFilter: "blur(12px)",
          }}
          onClick={() => setShowOptions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(165deg, #1f1418 0%, #151115 50%, #0e0d11 100%)",
              color: "#f3f4f6",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: 22,
              maxWidth: 440,
              width: "100%",
              padding: "26px 24px",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#f87171", letterSpacing: 1.1, textTransform: "uppercase" }}>
                  INSTAMBULANCE DISPATCH
                </span>
                <h3 style={{ fontSize: 20, margin: "4px 0 0", color: "#ffffff", fontWeight: 800 }}>Emergency Ambulance Helpline</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af" }}>
                  Toll-free 24x7 emergency medical transport
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  color: "#d1d5db",
                  cursor: "pointer",
                }}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 11 }}>
              {/* Option 1: InstAmbulance 108 */}
              <a
                href="tel:108"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "15px 18px",
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.1) 100%)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  color: "#ffffff",
                  textDecoration: "none",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(239,68,68,0.25)", display: "grid", placeItems: "center", color: "#fca5a5" }}>
                    <Phone size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>InstAmbulance (108)</div>
                    <div style={{ fontSize: 12, color: "#fca5a5" }}>National Emergency Response · All India</div>
                  </div>
                </div>
                <div style={{ background: "#ef4444", color: "#ffffff", padding: "6px 14px", borderRadius: 999, fontWeight: 900, fontSize: 13 }}>
                  Dial 108
                </div>
              </a>

              {/* Option 2: Maternal & Disaster Ambulance 102 */}
              <a
                href="tel:102"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "15px 18px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.06)", display: "grid", placeItems: "center", color: "#cbd5e1" }}>
                    <Phone size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Ambulance (102)</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Maternal &amp; District Health Transport</div>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 13 }}>
                  Dial 102
                </div>
              </a>
            </div>

            <div style={{ marginTop: 16, padding: "11px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.22)", borderRadius: 12, display: "flex", gap: 10, fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>Always confirm blood group and availability with the hospital or donor prior to travel.</div>
            </div>

            <button
              type="button"
              onClick={() => setShowOptions(false)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "11px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
