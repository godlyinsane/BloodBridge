import React, { useEffect, useRef } from "react";

export default function DonorLocationsMap({ center, donors = [], height = 340 }) {
  const elementRef = useRef(null);

  const centerLat = Number(center?.lat);
  const centerLng = Number(center?.lng);
  useEffect(() => {
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return;
    let map = null;
    let cancelled = false;

    const initialize = () => {
      if (cancelled || !elementRef.current || !window.L) return;
      if (map) { map.remove(); map = null; }
      map = window.L.map(elementRef.current, { scrollWheelZoom: true })
        .setView([centerLat, centerLng], 12);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const bounds = [];
      window.L.marker([centerLat, centerLng])
        .addTo(map)
        .bindPopup("Recipient location");
      bounds.push([centerLat, centerLng]);

      donors.forEach((donor) => {
        const lat = Number(donor.lat);
        const lng = Number(donor.lng);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
            !Number.isFinite(lng) || lng < -180 || lng > 180) return;
        const marker = window.L.marker([lat, lng]).addTo(map);
        const label = donor.label || donor.group || "Matching donor";
        const distance = Number.isFinite(Number(donor.distanceKm))
          ? " · " + Number(donor.distanceKm).toFixed(1) + " km away" : "";
        marker.bindPopup(label + distance);
        bounds.push([lat, lng]);
      });

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
      window.setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    };

    const ensureCss = () => new Promise((resolve) => {
      let link = document.querySelector('link[data-raktsetu-leaflet-css]');
      if (link) {
        if (link.sheet) resolve();
        else { link.addEventListener("load", resolve, { once: true }); link.addEventListener("error", resolve, { once: true }); }
        return;
      }
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-raktsetu-leaflet-css", "true");
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
    const initializeAfterCss = async () => {
      await ensureCss();
      if (cancelled) return;
      initialize();
    };

    if (window.L) initializeAfterCss();
    else {
      let script = document.querySelector('script[data-raktsetu-leaflet-js]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.setAttribute("data-raktsetu-leaflet-js", "true");
        script.onload = initializeAfterCss;
        document.body.appendChild(script);
      } else {
        script.addEventListener("load", initializeAfterCss, { once: true });
      }
    }

    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [centerLat, centerLng, donors]);

  return (
    <div
      ref={elementRef}
      role="img"
      aria-label="Map showing recipient and donor locations"
      style={{ width: "100%", height: Math.max(Number(height)||340, 280), minHeight: 280, display: "block", position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, background: "#101216" }}
    />
  );
}
