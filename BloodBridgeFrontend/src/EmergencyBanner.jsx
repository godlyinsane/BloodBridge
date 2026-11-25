import React from "react";
import { Phone, Navigation } from "lucide-react";

export default function EmergencyBanner({ onFindNearestBank }) {
  return (
    <div className="bg-ink text-ink-foreground" style={{ position: "relative", zIndex: 50, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex" style={{ width: 10, height: 10 }}>
            <span className="absolute inset-0 rounded-full bg-emergency animate-pulse-ring" />
            <span className="relative rounded-full bg-emergency" style={{ width: 10, height: 10 }} />
          </span>
          <span className="font-mono text-xs tracking-widest text-emergency" style={{ fontWeight: 700 }}>CRITICAL DISPATCH</span>
          <span className="opacity-70 hidden sm:inline" style={{ fontSize: 13 }}>In acute emergencies, dispatch immediately</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="tel:108"
            aria-label="Call InstAmbulance 108"
            className="btn !py-1.5 !text-sm bg-emergency text-emergency-foreground hover:opacity-90"
          >
            <Phone size={14} /> Call InstAmbulance 108
          </a>
          <button
            type="button"
            aria-label="Choose 102 or secondary ambulance"
            onClick={() => { window.location.href = "tel:102"; }}
            className="btn !py-1.5 !text-sm bg-ink-foreground/10 hover:bg-ink-foreground/20 text-ink-foreground"
          >
            Choose 102 or secondary ambulance
          </button>
          <button
            type="button"
            aria-label="Take me to nearest blood bank"
            onClick={() => {
              if (typeof onFindNearestBank === "function") {
                onFindNearestBank();
              }
            }}
            className="btn !py-1.5 !text-sm bg-ink-foreground text-ink hover:opacity-90"
          >
            <Navigation size={14} /> Take me to nearest blood bank
          </button>
        </div>
      </div>
    </div>
  );
}
