import React, { useState, useEffect } from "react";
import {
  MapPin, Navigation, Phone, Clock, Search, ArrowRight,
  ExternalLink, Building2, AlertCircle, Compass, CheckCircle2
} from "lucide-react";

export default function NearestBloodBankMap({ apiBase = "/api", initialLocation = null, notify }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCoords, setUserCoords] = useState(initialLocation);
  const [locationStatus, setLocationStatus] = useState("");
  const [selectedBankId, setSelectedBankId] = useState(null);

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
        } else {
          setSelectedBankId(data.results[0]?._id);
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
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser. Please search manually by city or pincode below.");
      return;
    }

    setLoading(true);
    setLocationStatus("Locating your device with GPS…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(point);
        setLocationStatus(`GPS location detected: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
        fetchNearestBanks(point, searchQuery);
      },
      (err) => {
        setLoading(false);
        setLocationStatus("Location permission was denied or timed out. Please enter your city or pincode below.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
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
    // Initial fetch
    if (initialLocation?.lat && initialLocation?.lng) {
      fetchNearestBanks(initialLocation);
    } else {
      fetchNearestBanks(null, "");
    }
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header and Controls */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(2,132,199,0.12), rgba(15,23,42,0.6))",
          border: "1px solid rgba(56,189,248,0.25)",
          borderRadius: 16,
          padding: 22,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.2, color: "#38bdf8", textTransform: "uppercase" }}>
              GOOGLE MAPS &amp; GEOLOCATION ASSISTANT
            </div>
            <h2 style={{ fontSize: "clamp(26px, 4.2vw, 34px)", margin: "6px 0", fontWeight: 850 }}>
              Find Nearest Blood Bank
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 15.5, margin: 0, maxWidth: 660, lineHeight: 1.65 }}>
              Instant live GPS matching with Google Maps directions, phone contacts, and operating hours. If location is denied, enter your city or pincode.
            </p>
          </div>

          {/* Big GPS Location Button */}
          <button
            type="button"
            onClick={handleUseGPS}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "#0284c7",
              color: "#ffffff",
              border: "1px solid #38bdf8",
              padding: "14px 24px",
              borderRadius: 14,
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(2,132,199,0.4)",
            }}
          >
            <Compass size={19} />
            <span>Use My Current Location</span>
          </button>
        </div>

        {/* Fallback Manual Search Form */}
        <form onSubmit={handleManualSearch} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Manual fallback: enter city, district, or 6-digit pincode…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px 11px 40px",
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10,
                color: "#ffffff",
                fontSize: 13.5,
                outline: "none",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "11px 20px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {locationStatus && (
          <div style={{ fontSize: 12, color: "#93c5fd", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} />
            <span>{locationStatus}</span>
          </div>
        )}
      </div>

      {/* Visual Map Overview & Quick Navigation Box */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid rgba(56,189,248,0.2)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(2,132,199,0.2)", display: "grid", placeItems: "center", color: "#38bdf8" }}>
            <Navigation size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>One-Tap Google Maps Directions</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {banks.length} nearby blood banks mapped and sorted by distance
            </div>
          </div>
        </div>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((searchQuery || "blood bank") + " near me")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.08)",
            color: "#ffffff",
            padding: "8px 14px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 12.5,
            fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span>Open Fullscreen in Google Maps</span>
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Results List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          Finding closest blood banks…
        </div>
      ) : banks.length === 0 ? (
        <div style={{ textAlign: "center", padding: 36, background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
          <Building2 size={32} color="#38bdf8" style={{ margin: "0 auto 10px" }} />
          <h4 style={{ margin: "0 0 6px" }}>No blood banks located</h4>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Try clicking "Use My Current Location" or typing a major district name.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
          {banks.map((bank, index) => {
            const isSelected = selectedBankId === bank._id;
            return (
              <div
                key={bank._id || index}
                onClick={() => setSelectedBankId(bank._id)}
                style={{
                  background: isSelected ? "rgba(2, 132, 199, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  border: isSelected ? "1.5px solid #0284c7" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: isSelected ? "0 4px 20px rgba(2, 132, 199, 0.2)" : "none",
                  cursor: "pointer",
                }}
              >
                {/* Bank Name and Distance Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 850, color: "#38bdf8", letterSpacing: 0.8, textTransform: "uppercase" }}>
                      {bank.source || "BLOOD BANK"}
                    </span>
                    <h3 style={{ fontSize: 18.5, margin: "5px 0 0", fontWeight: 800, color: "#f3f4f6" }}>
                      {bank.name}
                    </h3>
                  </div>

                  {bank.distanceKm != null && (
                    <div
                      style={{
                        background: "rgba(2, 132, 199, 0.2)",
                        border: "1px solid #0284c7",
                        color: "#38bdf8",
                        fontWeight: 900,
                        fontSize: 14,
                        padding: "5px 12px",
                        borderRadius: 10,
                        flexShrink: 0,
                      }}
                    >
                      {bank.distanceKm < 1
                        ? `${Math.round(bank.distanceKm * 1000)} m`
                        : `${bank.distanceKm} km`}
                    </div>
                  )}
                </div>

                {/* Address */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: "#d1d5db", lineHeight: 1.55 }}>
                  <MapPin size={17} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{bank.address}</span>
                </div>

                {/* Opening Hours */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "#9ca3af" }}>
                  <Clock size={16} color="#34d399" />
                  <span>{bank.openingHours || "24x7 Emergency Services"}</span>
                </div>

                {/* Action Buttons: Phone & Get Directions */}
                <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {bank.phone && (
                    <a
                      href={`tel:${String(bank.phone).replace(/[^\d+]/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: "rgba(255,255,255,0.08)",
                        color: "#ffffff",
                        textDecoration: "none",
                        fontWeight: 800,
                        fontSize: 14.5,
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      <Phone size={15} />
                      <span>Call</span>
                    </a>
                  )}

                  <a
                    href={bank.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 2,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "#0284c7",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontWeight: 800,
                      fontSize: 14.5,
                      padding: "11px 16px",
                      borderRadius: 10,
                      boxShadow: "0 2px 8px rgba(2,132,199,0.3)",
                    }}
                  >
                    <Navigation size={13} />
                    <span>Get Directions</span>
                    <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
