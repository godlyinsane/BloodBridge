import React from "react";
import { Phone, Navigation } from "lucide-react";

export default function EmergencyBanner({ onFindNearestBank }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 50,
        background: "linear-gradient(90deg, #10141f 0%, #151a27 50%, #10141f 100%)",
        borderBottom: "1px solid rgba(255, 59, 84, 0.3)",
        boxShadow: "0 4px 16px -2px rgba(255, 59, 84, 0.18)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-2 text-xs">
        {/* Left Side: Critical Dispatch with Glowing Badge & Text Shadow */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-0.5 rounded-full"
            style={{
              background: "rgba(255, 59, 84, 0.12)",
              border: "1px solid rgba(255, 59, 84, 0.35)",
              boxShadow: "0 0 10px rgba(255, 59, 84, 0.2)",
            }}
          >
            <span className="relative flex shrink-0" style={{ width: 8, height: 8 }}>
              <span className="absolute inset-0 rounded-full bg-emergency animate-pulse-ring" />
              <span
                className="relative rounded-full bg-emergency"
                style={{ width: 8, height: 8, boxShadow: "0 0 8px #ff3b54" }}
              />
            </span>
            <span
              className="font-mono text-[11px] sm:text-xs tracking-widest text-emergency font-black uppercase whitespace-nowrap"
              style={{
                textShadow: "0 0 10px rgba(255, 59, 84, 0.7), 0 0 2px rgba(255, 59, 84, 0.9)",
              }}
            >
              CRITICAL DISPATCH
            </span>
          </div>

          <span
            className="hidden md:inline text-xs font-semibold whitespace-nowrap"
            style={{
              color: "#e2e8f0",
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
              letterSpacing: "-0.2px",
            }}
          >
            · In acute emergencies, dispatch immediately
          </span>
        </div>

        {/* Right Side: Bold, Shadowed Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          <a
            href="tel:108"
            aria-label="Call InstAmbulance 108"
            className="btn !py-1.5 !px-3.5 !text-xs whitespace-nowrap shrink-0 font-bold transition-transform active:scale-95"
            style={{
              borderRadius: 9999,
              background: "linear-gradient(135deg, #ff3b54 0%, #d81e39 100%)",
              color: "#ffffff",
              boxShadow: "0 2px 12px rgba(255, 59, 84, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
              letterSpacing: "0.2px",
            }}
          >
            <Phone size={13} className="shrink-0" strokeWidth={2.5} />
            <span>Call 108</span>
          </a>

          <button
            type="button"
            aria-label="Choose 102 or secondary ambulance"
            onClick={() => { window.location.href = "tel:102"; }}
            className="btn !py-1.5 !px-3.5 !text-xs whitespace-nowrap shrink-0 font-bold transition-transform active:scale-95"
            style={{
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
              letterSpacing: "0.2px",
            }}
          >
            <span>102 Ambulance</span>
          </button>

          <button
            type="button"
            aria-label="Take me to nearest blood bank"
            onClick={() => {
              if (typeof onFindNearestBank === "function") {
                onFindNearestBank();
              }
            }}
            className="btn !py-1.5 !px-3.5 !text-xs whitespace-nowrap shrink-0 font-extrabold transition-transform active:scale-95"
            style={{
              borderRadius: 9999,
              background: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.3), 0 0 14px rgba(255, 255, 255, 0.35)",
              letterSpacing: "0.2px",
            }}
          >
            <Navigation size={13} className="shrink-0 text-red" strokeWidth={2.5} />
            <span>Nearest blood bank</span>
          </button>
        </div>
      </div>
    </div>
  );
}
