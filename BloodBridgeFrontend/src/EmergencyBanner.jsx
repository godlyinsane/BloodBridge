import React from "react";
import { Phone, Navigation } from "lucide-react";

export default function EmergencyBanner({ onFindNearestBank }) {
  return (
    <div
      className="bg-ink text-ink-foreground"
      style={{
        position: "relative",
        zIndex: 50,
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-2 text-xs">
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <span className="relative flex shrink-0" style={{ width: 10, height: 10 }}>
            <span className="absolute inset-0 rounded-full bg-emergency animate-pulse-ring" />
            <span className="relative rounded-full bg-emergency" style={{ width: 10, height: 10 }} />
          </span>
          <span className="font-mono text-[11px] sm:text-xs tracking-wider text-emergency font-bold shrink-0 whitespace-nowrap">
            CRITICAL DISPATCH
          </span>
          <span className="opacity-70 hidden md:inline text-xs whitespace-nowrap">
            · In acute emergencies, dispatch immediately
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
          <a
            href="tel:108"
            aria-label="Call InstAmbulance 108"
            className="btn !py-1.5 !px-3 !text-xs bg-emergency text-emergency-foreground hover:opacity-90 whitespace-nowrap shrink-0 font-medium"
            style={{ borderRadius: 9999 }}
          >
            <Phone size={12} className="shrink-0" />
            <span>Call 108</span>
          </a>
          <button
            type="button"
            aria-label="Choose 102 or secondary ambulance"
            onClick={() => { window.location.href = "tel:102"; }}
            className="btn !py-1.5 !px-3 !text-xs bg-ink-foreground/10 hover:bg-ink-foreground/20 text-ink-foreground whitespace-nowrap shrink-0 font-medium"
            style={{ borderRadius: 9999 }}
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
            className="btn !py-1.5 !px-3 !text-xs bg-ink-foreground text-ink hover:opacity-90 whitespace-nowrap shrink-0 font-medium"
            style={{ borderRadius: 9999 }}
          >
            <Navigation size={12} className="shrink-0" />
            <span>Nearest blood bank</span>
          </button>
        </div>
      </div>
    </div>
  );
}
