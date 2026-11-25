import React, { useState, useEffect } from "react";
import {
  Users, Droplet, MapPin, Phone, MessageCircle, Plus, Search,
  CheckCircle, AlertTriangle, ShieldCheck, X, Clock, Lock, ArrowRight,
  Filter, Eye, Check, Mail
} from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function P2PBloodListings({ apiBase = "/api", notify }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [searchCity, setSearchCity] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);

  // Form states
  const [formStep, setFormStep] = useState("form"); // "form" | "otp"
  const [formData, setFormData] = useState({
    name: "",
    bloodGroup: "O+",
    city: "",
    area: "",
    phone: "",
    notes: "",
  });
  const [otp, setOtp] = useState("");
  const [demoOtpNotice, setDemoOtpNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Revealed contacts mapping: { [listingId]: { phone, callUrl, whatsAppUrl } }
  const [revealedContacts, setRevealedContacts] = useState({});
  const [revealingId, setRevealingId] = useState(null);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroup && selectedGroup !== "ALL") params.set("group", selectedGroup);
      if (searchCity.trim()) params.set("city", searchCity.trim());

      const res = await fetch(`${apiBase}/donor-listings/public?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data.listings)) {
        setListings(data.listings);
      } else {
        setListings([]);
      }
    } catch (err) {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedGroup, searchCity]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return notify?.("Please enter contact name.");
    if (!formData.city.trim()) return notify?.("Please enter city or district.");
    const cleanPhone = formData.phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return notify?.("Please enter a valid 10-digit Indian mobile number.");
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/donor-listings/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code.");

      if (data.code) {
        setDemoOtpNotice(`Verification Code: ${data.code}`);
      }
      setFormStep("otp");
      notify?.("Verification code sent! Enter it to confirm your listing.");
    } catch (err) {
      notify?.(err.message || "Could not generate verification OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndPublish = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 4) {
      return notify?.("Please enter the 4-digit verification code.");
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/donor-listings/verify-and-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone.replace(/\D/g, "").slice(-10),
          otp: otp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");

      notify?.("Blood availability listing verified and published!");
      setShowPostModal(false);
      setFormStep("form");
      setFormData({ name: "", bloodGroup: "O+", city: "", area: "", phone: "", notes: "" });
      setOtp("");
      setDemoOtpNotice("");
      fetchListings();
    } catch (err) {
      notify?.(err.message || "Verification failed. Check the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevealContact = async (listingId) => {
    if (revealedContacts[listingId]) return;
    setRevealingId(listingId);
    try {
      const res = await fetch(`${apiBase}/donor-listings/${listingId}/reveal-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to reveal contact details.");

      setRevealedContacts((prev) => ({
        ...prev,
        [listingId]: {
          phone: data.phoneFormatted || data.phone,
          callUrl: data.callUrl,
          whatsAppUrl: data.whatsAppUrl,
        },
      }));
    } catch (err) {
      notify?.(err.message || "Failed to load contact information.");
    } finally {
      setRevealingId(null);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "Recently";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Header and Call to Action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: "#ff3b54", textTransform: "uppercase" }}>
            BLOOD DONATION DIRECTORY &amp; VERIFIED CENTRES
          </div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", margin: "6px 0", fontWeight: 800 }}>
            Blood Donation Centres &amp; Availability Directory
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 13.5, margin: 0, maxWidth: 650, lineHeight: 1.6 }}>
            Browse verified blood donation centres, hospital facilities, and available donor listings. Contact details remain protected until you click Contact.
          </p>
        </div>

        <a
          href="mailto:priyanshbhatt20@gmail.com?subject=Blood%20Donation%20Centre%20or%20Hospital%20Not%20Listed&body=Hi%20BloodBridge%20Team%2C%0A%0AI%20would%20like%20to%20report%20a%20blood%20donation%20centre%20or%20hospital%20that%20is%20not%20mentioned%20on%20the%20platform%3A%0A%0AFacility%20Name%3A%20%0ALocation%2FCity%3A%20%0AContact%20Details%3A%20%0AAdditional%20Info%3A%20%0A"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, #ef4444, #b91c1c)",
            color: "#ffffff",
            border: "1px solid #f87171",
            padding: "12px 20px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 13.5,
            textDecoration: "none",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(239, 68, 68, 0.35)",
            lineHeight: 1.3,
            maxWidth: 380,
            textAlign: "left",
          }}
        >
          <Mail size={18} style={{ flexShrink: 0 }} />
          <span>Centre or hospital not listed? Report to us at priyanshbhatt20@gmail.com</span>
        </a>
      </div>

      {/* Safety Notice Bar */}
      <div
        style={{
          padding: "12px 16px",
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12.5,
          color: "#fca5a5",
          lineHeight: 1.5,
        }}
      >
        <AlertTriangle size={18} style={{ flexShrink: 0, color: "#ef4444" }} />
        <span>
          <strong>Safety Verification Notice:</strong> Always confirm the donor's blood group compatibility and travel readiness directly with the treating hospital or licensed blood bank before proceeding.
        </span>
      </div>

      {/* Filter and Sort Toolbar */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* Blood Group Filter Pills */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Filter By Blood Group:
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedGroup("ALL")}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                border: selectedGroup === "ALL" ? "1px solid var(--emergency)" : "1px solid var(--border)",
                background: selectedGroup === "ALL" ? "var(--emergency)" : "var(--secondary)",
                color: selectedGroup === "ALL" ? "#ffffff" : "var(--foreground)",
              }}
            >
              All Groups
            </button>
            {BLOOD_GROUPS.map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                  border: selectedGroup === grp ? "1px solid var(--emergency)" : "1px solid var(--border)",
                  background: selectedGroup === grp ? "var(--emergency)" : "var(--secondary)",
                  color: selectedGroup === grp ? "#ffffff" : "var(--foreground)",
                }}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Location / City Filter and Sort Info */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              type="text"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Filter by city or area (e.g., Delhi, Mumbai, Bhopal)…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px 10px 36px",
                background: "var(--secondary)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--foreground)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={13} />
            <span>Sorted by: <strong>Most recent verified first</strong></span>
          </div>
        </div>
      </div>

      {/* Listing Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted-foreground)", fontSize: 14 }}>
          Loading verified blood listings…
        </div>
      ) : listings.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "50px 20px",
            background: "var(--card)",
            borderRadius: 16,
            border: "1px dashed var(--border)",
          }}
        >
          <Droplet size={36} color="var(--emergency)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: 18, margin: "0 0 6px", fontWeight: 700, color: "var(--foreground)" }}>No verified listings found</h3>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: 0, maxWidth: 420, marginInline: "auto" }}>
            No blood availability matching blood group "{selectedGroup}" and your city filter is currently live. Be the first to upload availability!
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedGroup("ALL");
              setSearchCity("");
            }}
            style={{
              marginTop: 16,
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
          {listings.map((item) => {
            const isRevealed = Boolean(revealedContacts[item._id]);
            const contactInfo = revealedContacts[item._id];

            return (
              <div
                key={item._id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "var(--shadow-soft)",
                  borderTop: "3px solid var(--emergency)",
                }}
              >
                {/* Card Top: Name & Blood Group */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)" }}>
                      {item.name || "Available Donor"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: "#10b981",
                          background: "rgba(16, 185, 129, 0.12)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                        }}
                      >
                        <ShieldCheck size={12} /> Verified Listing
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>• {formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(225, 29, 72, 0.12)",
                      border: "1px solid rgba(225, 29, 72, 0.35)",
                      color: "var(--emergency)",
                      fontWeight: 900,
                      fontSize: 16,
                      padding: "6px 14px",
                      borderRadius: 12,
                    }}
                  >
                    {item.bloodGroup}
                  </div>
                </div>

                {/* Location */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13, color: "var(--foreground)" }}>
                  <MapPin size={14} color="var(--emergency)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    <strong>{item.city}</strong>
                    {item.area ? `, ${item.area}` : ""}
                  </span>
                </div>

                {/* Notes */}
                {item.notes && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      background: "var(--secondary)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      borderLeft: "2px solid var(--emergency)",
                      fontStyle: "italic",
                    }}
                  >
                    "{item.notes}"
                  </div>
                )}

                {/* Contact Section: Masked until "Contact" is clicked */}
                <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  {!isRevealed ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                        <Lock size={13} />
                        <span>{item.phoneMasked || "+91 xx xx xx xx"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevealContact(item._id)}
                        disabled={revealingId === item._id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--foreground)",
                          color: "var(--background)",
                          border: 0,
                          fontWeight: 800,
                          fontSize: 12.5,
                          padding: "8px 16px",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        <Eye size={13} />
                        <span>{revealingId === item._id ? "Revealing…" : "Contact Donor"}</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
                        <Check size={14} />
                        <span>{contactInfo.phone}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a
                          href={contactInfo.callUrl}
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            background: "#ef4444",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontWeight: 800,
                            fontSize: 12.5,
                            padding: "9px 12px",
                            borderRadius: 8,
                          }}
                        >
                          <Phone size={13} /> Call
                        </a>
                        <a
                          href={contactInfo.whatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            background: "#059669",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontWeight: 800,
                            fontSize: 12.5,
                            padding: "9px 12px",
                            borderRadius: 8,
                          }}
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Blood Available Modal */}
      {showPostModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: 16,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              background: "#12151e",
              border: "1px solid #ef4444",
              borderRadius: 16,
              maxWidth: 500,
              width: "100%",
              padding: 24,
              color: "#f3f4f6",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#ef4444", letterSpacing: 1 }}>VERIFIED AVAILABILITY</span>
                <h3 style={{ fontSize: 20, margin: "4px 0 0", fontWeight: 800 }}>Upload Blood Available</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                style={{ background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {formStep === "form" ? (
              <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    Donor Contact Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Donor xx"
                    maxLength={100}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f3f4f6",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      Blood Group *
                    </label>
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        background: "#1f2937",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#f3f4f6",
                        fontSize: 13,
                      }}
                    >
                      {BLOOD_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      Contact Number *
                    </label>
                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#f3f4f6",
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      City / District *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Bhopal"
                      maxLength={100}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#f3f4f6",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      Area / Locality
                    </label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g. Civil Lines"
                      maxLength={150}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        color: "#f3f4f6",
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    Optional Notes (Availability, timings, preferences)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Available for whole blood donation on weekends within 20km."
                    maxLength={300}
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f3f4f6",
                      fontSize: 13,
                      resize: "none",
                    }}
                  />
                </div>

                <div style={{ fontSize: 11.5, color: "#9ca3af", lineHeight: 1.5 }}>
                  🛡️ <strong>Verification Protection:</strong> We will verify your mobile number via OTP before your listing goes live. Your phone number is masked and only shown when a user clicks "Contact".
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: "#ef4444",
                    color: "#ffffff",
                    border: 0,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>{submitting ? "Sending verification code…" : "Send Verification OTP"}</span>
                  <ArrowRight size={15} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndPublish} style={{ display: "grid", gap: 14 }}>
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(239,68,68,0.15)", color: "#ef4444", display: "grid", placeItems: "center", margin: "0 auto 10px" }}>
                    <ShieldCheck size={22} />
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: 16 }}>Verify Phone Number</h4>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#9ca3af" }}>
                    Enter the 4-digit verification code sent to +91 {formData.phone.slice(0, 2)}xxxxxx{formData.phone.slice(-2)}
                  </p>
                  {demoOtpNotice && (
                    <div style={{ marginTop: 10, padding: 8, background: "#1e293b", color: "#38bdf8", borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                      {demoOtpNotice}
                    </div>
                  )}
                </div>

                <div>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 4-digit OTP"
                    maxLength={6}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      textAlign: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: 8,
                      background: "rgba(0,0,0,0.5)",
                      border: "2px solid #ef4444",
                      borderRadius: 10,
                      color: "#ffffff",
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: "#10b981",
                    color: "#ffffff",
                    border: 0,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle size={16} />
                  <span>{submitting ? "Verifying…" : "Verify & Publish Listing"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormStep("form")}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "#9ca3af",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Edit phone number or details
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
