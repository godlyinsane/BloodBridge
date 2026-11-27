import React, { useState, useEffect } from "react";
import {
  MapPin, Navigation, Phone, Clock, Search, ArrowRight,
  ExternalLink, Building2, AlertCircle, Compass, CheckCircle2, LocateFixed
} from "lucide-react";

export default function NearestBloodBankMap({ apiBase = "/api", initialLocation = null, notify }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCoords, setUserCoords] = useState(initialLocation);
  const [locationStatus, setLocationStatus] = useState("");

  const fetchNearestBanks = async (coords = null, queryText = "") => {
    setLoading(true);
    setLocationStatus("");
    try {
      const params = new URLSearchParams();
      if (coords?.lat && coords?.lng) {
        params.set("lat", coords.lat);
        params.set("lng", coords.lng);
      }
      if (queryText.trim()) {
        params.set("query", queryText.trim());
      }

      const res = await fetch(`${apiBase}/blood-banks/nearest?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data.results)) {
        setBanks(data.results);
        if (data.results.length === 0) {
          setLocationStatus("No blood banks found in this area. Try searching a major city or district.");
        }
      } else {
        setBanks([]);
      }
    } catch (err) {
      console.warn("Nearest banks fetch notice:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseGPS = () => {
    setLoading(true);
    setLocationStatus("Locating device…");

    const onLocationSuccess = (point, label) => {
      setUserCoords(point);
      setLocationStatus(label);
      fetchNearestBanks(point, searchQuery);
    };

    const tryIpFallback = async () => {
      try {
        setLocationStatus("Detecting regional location via network…");
        const ipRes = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            const point = { lat: Number(ipData.latitude), lng: Number(ipData.longitude) };
            const place = [ipData.city, ipData.region].filter(Boolean).join(", ");
            onLocationSuccess(point, `Location detected via network (${place || "Active Hub"}): ${point.lat.toFixed(2)}°, ${point.lng.toFixed(2)}°`);
            return;
          }
        }
      } catch (e) {
        // network fallback failed
      }

      // Regional network hub fallback (Central MP hub: Bhopal / Sehore corridor)
      const defaultPoint = { lat: 23.2599, lng: 77.4126 };
      onLocationSuccess(defaultPoint, "Using regional network hub coordinates (Bhopal / Central Hub)");
    };

    if (!navigator.geolocation) {
      tryIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationSuccess(point, `Live GPS location detected (${point.lat.toFixed(3)}°, ${point.lng.toFixed(3)}°)`);
      },
      () => {
        // Fallback to IP geolocation so location detection always succeeds
        tryIpFallback();
      },
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 60000 }
    );
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return notify?.("Please enter a city, area, or pincode to search.");
    }
    fetchNearestBanks(userCoords, searchQuery);
  };

  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      fetchNearestBanks(initialLocation);
    } else {
      fetchNearestBanks(null, "");
    }
  }, []);

  return (
    <div style={{ display: "grid", gap: 22 }} className="max-w-6xl mx-auto">
      {/* Hero GPS Visualizer matching Redesign - Compact and screen-optimized */}
      <section
        className="tile nearest-hero-card flex flex-col items-center text-center relative overflow-hidden"
        style={{
          borderRadius: 28,
          padding: "20px 28px",
        }}
      >
        {/* Compact, optimized GPS target symbol */}
        <div className="relative mx-auto grid place-items-center mb-1.5" style={{ width: 32, height: 32 }}>
          <span className="absolute inset-0 rounded-full bg-emergency opacity-25 animate-pulse-ring-subtle" />
          <span
            className="relative grid place-items-center rounded-full text-white"
            style={{
              width: 26,
              height: 26,
              background: "var(--gradient-blood)",
              boxShadow: "0 0 10px rgba(255, 59, 84, 0.4)",
            }}
          >
            <LocateFixed size={14} strokeWidth={2.5} />
          </span>
        </div>

        <p className="eyebrow" style={{ margin: "0 0 2px", fontSize: 11, letterSpacing: 0.8 }}>
          Live GPS Directions
        </p>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: "clamp(1.2rem, 3.2vw, 1.55rem)",
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          Nearest <span className="text-gradient">blood bank.</span>
        </h1>
        <p
          className="text-muted-foreground"
          style={{ maxWidth: 440, margin: "0 auto 12px", fontSize: "0.8125rem", lineHeight: 1.45 }}
        >
          We'll use your live location to calculate precise distances and open turn-by-turn navigation to the closest blood bank.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
          <button
            type="button"
            onClick={handleUseGPS}
            disabled={loading}
            aria-label="Use My Current Location"
            className="btn btn-primary"
            style={{ padding: "6px 14px", fontSize: 12.5 }}
          >
            <Compass size={14} />
            <span>{loading ? "Locating device…" : "Use My Current Location"}</span>
          </button>
          <a
            href="https://www.google.com/maps/search/blood+bank+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ padding: "6px 14px", fontSize: 12.5 }}
          >
            <ExternalLink size={13} /> Open in Google Maps
          </a>
        </div>

        {locationStatus && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: locationStatus.includes("denied") || locationStatus.includes("No blood") ? "var(--emergency)" : "var(--accent-teal, #10b981)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 500
          }}>
            {locationStatus.includes("denied") || locationStatus.includes("No blood") ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{locationStatus}</span>
          </div>
        )}
      </section>

      {/* Search Filter Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Nearby Verified Blood Banks</h3>
          <p className="text-sm text-muted-foreground" style={{ margin: "4px 0 0" }}>
            {banks.length} certified centres found sorted by proximity
          </p>
        </div>

        <form onSubmit={handleManualSearch} style={{ display: "flex", gap: 8, flex: "1 1 260px", maxWidth: 440, width: "100%", flexWrap: "wrap" }}>
          <label className="tile nearest-search-pill flex items-center gap-2 px-4 py-2 w-full" style={{ padding: "8px 16px", borderRadius: 9999, display: "flex", alignItems: "center", gap: 8, flex: "1 1 180px", minWidth: 0 }}>
            <Search size={16} className="text-muted-foreground" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="nearest-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Manual fallback: enter city, district, or pin…"
              style={{ background: "transparent", border: "none", outline: "none", width: "100%", minWidth: 0, fontSize: 14, color: "var(--foreground)" }}
            />
          </label>
          <button type="submit" disabled={loading} className="btn btn-ghost !py-2 !px-4 !text-sm" style={{ flexShrink: 0 }}>
            Search
          </button>
        </form>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--muted-foreground)" }}>
          Finding closest blood banks…
        </div>
      ) : banks.length === 0 ? (
        <div className="tile" style={{ textAlign: "center", padding: 48 }}>
          <Building2 size={36} className="text-red" style={{ margin: "0 auto 12px" }} />
          <h4 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>No blood banks located</h4>
          <p className="text-sm text-muted-foreground" style={{ margin: 0 }}>Try clicking "Use My Current Location" or searching Bhopal, Sehore, or Raisen.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          {banks.map((bank) => (
              <div
                key={bank._id}
                className="tile nearest-bank-card flex flex-col justify-between"
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <span className="grid place-items-center rounded-2xl bg-red/10 text-red" style={{ width: 44, height: 44, minWidth: 44, flexShrink: 0, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(225, 29, 72, 0.1)", color: "var(--emergency)" }}>
                      <Building2 size={20} />
                    </span>
                    {bank.distanceKm != null && (
                      <span className="eyebrow" style={{ background: "var(--secondary)", padding: "4px 10px", borderRadius: 9999, color: "var(--foreground)", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {bank.distanceKm.toFixed(1)} km away
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", lineHeight: 1.35 }}>
                    {bank.name}
                  </h3>
                  <p className="text-sm text-muted-foreground" style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
                    {bank.address || `${bank.district || bank.city}, Madhya Pradesh`}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--muted-foreground)", marginBottom: 18 }}>
                    {bank.openingHours && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={14} className="text-red" />
                        <span>{bank.openingHours}</span>
                      </div>
                    )}
                    {bank.category && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={14} className="text-success" />
                        <span>{bank.category} Centre</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {bank.phone ? (
                    <a href={`tel:${bank.phone.split(/[/,]/)[0].trim()}`} className="btn btn-ghost !py-2 !text-xs" style={{ flex: 1 }}>
                      <Phone size={13} /> Call
                    </a>
                  ) : null}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${bank.name} ${bank.city || bank.district || ""}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary !py-2 !text-xs"
                    style={{ flex: 1.3 }}
                  >
                    <Navigation size={13} /> Directions
                  </a>
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
