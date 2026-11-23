import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Building2, CheckCircle2, ChevronRight, Clock3, Droplet, MapPin, Search, ShieldCheck } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.REACT_APP_API_BASE_URL || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")).replace(/\/+$/, "");
const GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const COMPONENTS = ["Whole Blood", "Packed Red Cells", "Platelets", "Fresh Frozen Plasma", "Cryoprecipitate"];
const GROUP_COLORS = { "O+": "#fb7185", "O-": "#fda4af", "A+": "#f87171", "A-": "#fca5a5", "B+": "#e879f9", "B-": "#d8b4fe", "AB+": "#60a5fa", "AB-": "#93c5fd" };

export default function InventoryView({ theme = "dark" }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All groups");
  const [selectedComponent, setSelectedComponent] = useState("All components");
  const [refreshTick, setRefreshTick] = useState(0);
  const light = theme === "light";
  const ink = light ? "#182230" : "#F3F4F6";
  const muted = light ? "#667085" : "#9CA3AF";
  const panel = { background: light ? "#fff" : "rgba(255,255,255,.045)", border: "1px solid " + (light ? "#e6e8ee" : "rgba(255,255,255,.09)"), borderRadius: 22, boxShadow: light ? "0 12px 35px rgba(16,24,40,.045)" : "0 16px 44px rgba(0,0,0,.16)" };
  const selectStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", borderRadius: 12, padding: "12px 13px", color: ink, background: light ? "#fff" : "#15171d", border: "1px solid " + (light ? "#d0d5dd" : "rgba(255,255,255,.13)"), fontSize: 13, outline: "none" };
  const ghost = { background: light ? "#fff" : "rgba(255,255,255,.04)", color: ink, border: "1px solid " + (light ? "#d0d5dd" : "rgba(255,255,255,.13)"), borderRadius: 12, padding: "9px 12px", fontSize: 11.5, fontWeight: 650, cursor: "pointer" };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    fetch(API_BASE + "/registered-blood-banks/public")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Unable to load current blood-bank stock.");
        return data;
      })
      .then((data) => { if (active) setBanks(Array.isArray(data) ? data : (data.banks || [])); })
      .catch((error) => { if (active) setLoadError(error.message || "Unable to load current blood-bank stock."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshTick]);

  const now = Date.now();
  const bankRows = useMemo(() => banks.map((bank) => {
    const inventory = (bank.inventory || []).filter((item) => {
      const status = String(item.status || "available").toLowerCase();
      const expiry = item.expiresAt ? new Date(item.expiresAt).getTime() : null;
      return status === "available" && (expiry === null || expiry > now) && Number(item.units) > 0;
    });
    return { ...bank, liveInventory: inventory };
  }), [banks, now]);

  const availableUnits = bankRows.reduce((sum, bank) => sum + bank.liveInventory.reduce((n, item) => n + Number(item.units || 0), 0), 0);
  const reportingBanks = bankRows.filter((bank) => bank.liveInventory.length > 0).length;
  const stockRows = bankRows.flatMap((bank) => bank.liveInventory.map((item) => ({
    ...item, bankName: bank.name, bankState: bank.state, bankDistrict: bank.district, bankId: bank._id
  }))).filter((item) =>
    (selectedGroup === "All groups" || item.group === selectedGroup) &&
    (selectedComponent === "All components" || item.component === selectedComponent) &&
    (!query || [item.bankName, item.bankState, item.bankDistrict, item.group, item.component].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
  );
  const atlasRows = bankRows.flatMap((bank) => bank.liveInventory.map((item) => ({
    ...item, bankName: bank.name, bankState: bank.state, bankDistrict: bank.district, bankId: bank._id
  }))).filter((item) => selectedComponent === "All components" || item.component === selectedComponent);
  const groupSummary = GROUPS.map((group) => {
    const rows = atlasRows.filter((item) => item.group === group);
    const units = rows.reduce((sum, item) => sum + Number(item.units || 0), 0);
    return { group, units, entries: rows.length, components: [...new Set(rows.map((row) => row.component).filter(Boolean))] };
  });
  const filteredBanks = bankRows.map((bank) => ({
    ...bank,
    filteredInventory: bank.liveInventory.filter((item) =>
      (selectedGroup === "All groups" || item.group === selectedGroup) &&
      (selectedComponent === "All components" || item.component === selectedComponent) &&
      (!query || [bank.name, bank.state, bank.district, item.group, item.component].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
    )
  })).filter((bank) => bank.filteredInventory.length > 0);
  const totalEntries = bankRows.reduce((sum, bank) => sum + bank.liveInventory.length, 0);
  const updateDates = bankRows.flatMap((bank) => bank.liveInventory.map((item) => item.updatedAt || bank.lastInventoryUpdate || bank.updatedAt)).filter(Boolean).map((date) => new Date(date)).filter((date) => Number.isFinite(date.getTime())).sort((a, b) => b - a);
  const latestUpdate = updateDates[0];

  return <div style={{ display: "grid", gap: 22, color: ink }}>
    <section style={{ ...panel, overflow: "hidden", position: "relative", padding: "clamp(24px,4vw,42px)", background: light ? "linear-gradient(125deg,#fff6f7 0%,#fff 58%,#f2fbff 100%)" : "radial-gradient(700px 300px at 85% 10%,rgba(34,211,238,.13),transparent 65%),radial-gradient(620px 330px at 8% 0%,rgba(255,59,84,.2),transparent 68%),linear-gradient(135deg,#171018 0%,#101319 60%,#101923 100%)" }}>
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", border: "1px solid rgba(255,100,120,.13)", right: -65, top: -90, boxShadow: "0 0 0 28px rgba(255,100,120,.025),0 0 0 58px rgba(255,100,120,.02)", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 30, background: light ? "#ffe5e9" : "rgba(255,59,84,.12)", color: light ? "#a51d32" : "#ff8091", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}><Droplet size={14} /> Donate Blood &amp; Community Stock</div>
          <h1 className="headline" style={{ fontSize: "clamp(30px,5vw,48px)", letterSpacing: "-1.5px", lineHeight: 1.06, margin: "18px 0 12px", maxWidth: 680 }}>Step forward. Donate blood.<br /><span style={{ color: "#FF3B54" }}>Save someone's life today.</span></h1>
          <p style={{ color: muted, maxWidth: 620, fontSize: 14.5, lineHeight: 1.8, margin: 0 }}>Review which blood groups and components are in high demand or low supply across certified facilities. Find where your donation can have the biggest life-saving impact.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22, alignItems: "center" }}>
            <button onClick={() => setRefreshTick((v) => v + 1)} disabled={loading} style={{ background: "linear-gradient(135deg,#FF3B54,#B3202A)", color: "#fff", border: 0, borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? .7 : 1 }}><Activity size={16} /> {loading ? "Refreshing…" : "Check urgent needs"}</button>
            <span style={{ color: muted, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 6 }}><ShieldCheck size={14} color="#34D399" /> Certified blood donation centres only</span>
          </div>
        </div>
        <div aria-hidden="true" style={{ width: "clamp(86px,14vw,150px)", height: "clamp(86px,14vw,150px)", borderRadius: "36% 64% 55% 45% / 42% 40% 60% 58%", background: "linear-gradient(145deg,#ff7185,#d51f3c 70%,#8d122b)", boxShadow: "inset -15px -18px 30px rgba(72,0,20,.24),0 22px 55px rgba(255,59,84,.2)", display: "grid", placeItems: "center", transform: "rotate(-12deg)" }}><Droplet size={62} strokeWidth={1.35} color="#fff" fill="rgba(255,255,255,.12)" /></div>
      </div>
    </section>

    <section aria-label="Inventory overview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
      {[
        { label: "Units reported available", value: availableUnits.toLocaleString(), icon: <Droplet size={18} />, tone: "#FF3B54", note: "Across listed components" },
        { label: "Banks with stock", value: reportingBanks.toLocaleString(), icon: <Building2 size={18} />, tone: "#22D3EE", note: "Verified bank accounts" },
        { label: "Stock records", value: totalEntries.toLocaleString(), icon: <Activity size={18} />, tone: "#34D399", note: "Available inventory entries" },
        { label: "Last stock update", value: latestUpdate ? latestUpdate.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "Not reported", icon: <Clock3 size={18} />, tone: "#FBBF24", note: latestUpdate ? latestUpdate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "Waiting for bank updates" }
      ].map((stat) => <motion.div key={stat.label} whileHover={{ y: -3 }} style={{ ...panel, padding: "18px 19px", minWidth: 0 }}>
        <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 12, color: stat.tone, background: stat.tone + "18", marginBottom: 14 }}>{stat.icon}</div>
        <div style={{ color: muted, fontSize: 11.5, lineHeight: 1.4 }}>{stat.label}</div>
        <div style={{ color: ink, fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, letterSpacing: "-.7px", margin: "6px 0 3px", overflowWrap: "anywhere" }}>{stat.value}</div>
        <div style={{ color: muted, fontSize: 10.5 }}>{stat.note}</div>
      </motion.div>)}
    </section>

    <section style={{ ...panel, padding: "clamp(18px,3.2vw,28px)", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", right: -125, top: -150, background: "radial-gradient(circle,rgba(255,59,84,.12),transparent 68%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 22, position: "relative" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#FF6478", fontSize: 10, letterSpacing: 1.7, fontWeight: 850, textTransform: "uppercase" }}><span style={{ width: 20, height: 2, background: "#FF3B54", display: "inline-block", borderRadius: 3 }} /> Blood group atlas</div>
          <h2 className="headline" style={{ margin: "9px 0 7px", fontSize: "clamp(23px,3vw,30px)", letterSpacing: "-.8px" }}>Find your blood group.</h2>
          <p style={{ margin: 0, color: muted, fontSize: 12.5, lineHeight: 1.7, maxWidth: 500 }}>A clear snapshot of stock reported by blood banks. Choose a card to filter the inventory list below.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 14, border: "1px solid " + (light ? "#f1cbd1" : "rgba(255,100,120,.2)"), background: light ? "#fff5f6" : "rgba(255,59,84,.07)" }}>
          <div style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, background: "rgba(255,59,84,.13)", color: "#FF6478" }}><Droplet size={18} /></div>
          <div><div style={{ color: muted, fontSize: 10.5 }}>Total listed units</div><div style={{ color: ink, fontWeight: 850, fontSize: 20, letterSpacing: "-.5px", lineHeight: 1.2 }}>{atlasRows.reduce((sum, item) => sum + Number(item.units || 0), 0).toLocaleString()}</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 11, position: "relative" }}>
        {groupSummary.map(({ group, units, entries, components }) => {
          const active = selectedGroup === group;
          const accent = GROUP_COLORS[group] || "#FF3B54";
          const level = entries === 0 ? { label: "NO STOCK REPORTED", color: muted } : units < 5 ? { label: "LOW STOCK", color: "#FBBF24" } : { label: "IN STOCK", color: "#34D399" };
          const share = atlasRows.length ? Math.min(100, (units / Math.max(...groupSummary.map((item) => item.units), 1)) * 100) : 0;
          return <motion.button key={group} whileHover={{ y: -3 }} whileTap={{ scale: .985 }} aria-pressed={active} onClick={() => setSelectedGroup(active ? "All groups" : group)} style={{
            position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer", minWidth: 0, padding: "16px 16px 14px", borderRadius: 18,
            border: "1px solid " + (active ? accent : (light ? "#e6e8ee" : "rgba(255,255,255,.09)")),
            background: light ? (active ? "linear-gradient(145deg,#fff1f3,#fff 75%)" : "#fff") : (active ? "linear-gradient(145deg,rgba(255,59,84,.13),rgba(255,255,255,.035) 75%)" : "linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))"),
            color: ink, boxShadow: active ? "0 0 0 2px " + accent + "22,0 12px 28px rgba(0,0,0,.08)" : (light ? "0 7px 20px rgba(16,24,40,.025)" : "none"), transition: "border-color .2s,box-shadow .2s"
          }}>
            <div style={{ position: "absolute", width: 100, height: 100, borderRadius: "50%", right: -48, top: -50, background: accent, opacity: light ? .07 : .11, filter: "blur(2px)", pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span style={{ display: "inline-grid", placeItems: "center", flexShrink: 0, width: 46, height: 46, borderRadius: 15, color: "#fff", background: "linear-gradient(145deg," + accent + ",#9f1239)", boxShadow: "0 6px 16px " + accent + "30", fontSize: 17, fontWeight: 900, letterSpacing: "-.5px" }}>{group}</span>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 750, color: muted }}>Blood group</div><div style={{ fontSize: 10, color: level.color, fontWeight: 850, letterSpacing: ".45px", marginTop: 4, whiteSpace: "nowrap" }}>{level.label}</div></div>
              </div>
              <ChevronRight size={16} color={active ? accent : muted} style={{ transform: active ? "rotate(90deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 21, position: "relative" }}>
              <span style={{ fontSize: "clamp(27px,3vw,34px)", lineHeight: 1, fontWeight: 850, letterSpacing: "-1.2px" }}>{units.toLocaleString()}</span><span style={{ color: muted, fontSize: 11, fontWeight: 600 }}>units available</span>
            </div>
            <div style={{ height: 4, background: light ? "#eef0f4" : "rgba(255,255,255,.08)", borderRadius: 6, marginTop: 14, overflow: "hidden" }}><div style={{ height: "100%", width: share + "%", borderRadius: 6, background: "linear-gradient(90deg," + accent + ",#FF6478)", transition: "width .35s ease" }} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, position: "relative" }}>
              <span style={{ color: muted, fontSize: 10.5 }}>{entries} {entries === 1 ? "stock record" : "stock records"}</span>
              <span style={{ color: muted, fontSize: 10.5 }}>{components.length} {components.length === 1 ? "component" : "components"}</span>
            </div>
          </motion.button>;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center", justifyContent: "space-between", marginTop: 17, paddingTop: 15, borderTop: "1px solid " + (light ? "#eceef2" : "rgba(255,255,255,.08)") }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", color: muted, fontSize: 11 }}>
          <CheckCircle2 size={14} color="#34D399" /> Stock shown only when reported by a bank; low stock means fewer than 5 units (display threshold only).
        </div>
        <button onClick={() => setSelectedGroup("All groups")} style={{ ...ghost, borderColor: selectedGroup === "All groups" ? "#FF3B54" : undefined, color: selectedGroup === "All groups" ? "#FF6478" : ink }}>View all groups</button>
      </div>
    </section>

    <section style={{ ...panel, padding: "clamp(16px,3vw,25px)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div><div style={{ color: "#22D3EE", fontSize: 10.5, letterSpacing: 1.3, fontWeight: 800 }}>FIND THE RIGHT STOCK</div><h2 className="headline" style={{ margin: "7px 0 5px", fontSize: 24 }}>Explore inventory</h2><p style={{ margin: 0, color: muted, fontSize: 12.5 }}>Search verified blood banks and narrow results by group or component.</p></div>
        <div style={{ color: muted, fontSize: 11, padding: "7px 10px", borderRadius: 9, background: light ? "#f2f4f7" : "rgba(255,255,255,.04)" }}>{stockRows.length} matching stock records</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.4fr) repeat(2,minmax(140px,1fr))", gap: 10, marginBottom: 18 }} className="grid2">
        <label style={{ position: "relative", display: "block" }}><Search size={16} color={muted} style={{ position: "absolute", left: 13, top: 14 }} /><input aria-label="Search inventory" placeholder="Search bank, district, group…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...selectStyle, paddingLeft: 38 }} /></label>
        <select aria-label="Filter by blood group" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={selectStyle}><option>All groups</option>{GROUPS.map((group) => <option key={group}>{group}</option>)}</select>
        <select aria-label="Filter by component" value={selectedComponent} onChange={(e) => setSelectedComponent(e.target.value)} style={selectStyle}><option>All components</option>{COMPONENTS.map((component) => <option key={component}>{component}</option>)}</select>
      </div>
      {loadError && <div role="alert" style={{ borderRadius: 14, border: "1px solid rgba(255,59,84,.3)", background: "rgba(255,59,84,.08)", padding: 16, marginBottom: 14, color: ink }}><b style={{ color: "#FF3B54" }}>Stock could not be loaded.</b><p style={{ color: muted, fontSize: 12.5, margin: "6px 0 12px" }}>{loadError}</p><button onClick={() => setRefreshTick((v) => v + 1)} style={ghost}>Try again</button></div>}
      {loading ? <div style={{ display: "grid", placeItems: "center", padding: "46px 18px", color: muted }}><Activity size={25} style={{ marginBottom: 10 }} /><div style={{ fontSize: 13 }}>Loading the latest reported stock…</div></div>
        : filteredBanks.length === 0 ? <div style={{ textAlign: "center", padding: "42px 18px", borderRadius: 16, border: "1px dashed " + (light ? "#d0d5dd" : "rgba(255,255,255,.15)") }}><div style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", margin: "0 auto 13px", background: light ? "#fff0f2" : "rgba(255,59,84,.1)", color: "#FF3B54" }}><Droplet size={24} /></div><h3 style={{ margin: "0 0 7px", fontSize: 16 }}>{banks.length ? "No matching stock right now" : "No verified stock listings yet"}</h3><p style={{ color: muted, fontSize: 12.5, maxWidth: 440, lineHeight: 1.7, margin: "0 auto 16px" }}>{banks.length ? "Try another blood group, component, or search term. Stock only appears here when a verified bank has an available inventory entry." : "When a registered blood bank is verified and reports inventory, its available stock will appear here automatically. We never fill this page with invented quantities."}</p><button onClick={() => { setQuery(""); setSelectedGroup("All groups"); setSelectedComponent("All components"); setRefreshTick((v) => v + 1); }} style={ghost}>Reset filters & refresh</button></div>
        : <div style={{ display: "grid", gap: 12 }}>
          {filteredBanks.map((bank) => <article key={bank._id} style={{ borderRadius: 17, border: "1px solid " + (light ? "#e4e7ec" : "rgba(255,255,255,.09)"), padding: 17, background: light ? "#fff" : "rgba(255,255,255,.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}><div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, display: "grid", placeItems: "center", color: "#22D3EE", background: "rgba(34,211,238,.1)" }}><Building2 size={20} /></div><div style={{ minWidth: 0 }}><h3 style={{ margin: "1px 0 5px", fontSize: 15, overflowWrap: "anywhere" }}>{bank.name}</h3><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", color: muted, fontSize: 11.5 }}><MapPin size={12} />{[bank.district, bank.state].filter(Boolean).join(", ") || "Location not provided"}<span style={{ color: "#34D399", display: "inline-flex", alignItems: "center", gap: 4 }}><ShieldCheck size={12} /> Verified</span></div></div></div>
              <span style={{ fontSize: 10.5, padding: "6px 9px", borderRadius: 20, background: "rgba(52,211,153,.1)", color: "#34D399", fontWeight: 750 }}>AVAILABLE STOCK</span>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {bank.filteredInventory.map((item, index) => <div key={item._id || item.group + "-" + item.component + "-" + index} style={{ display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 10, alignItems: "center", borderRadius: 12, padding: "10px 11px", background: light ? "#f8fafc" : "rgba(255,255,255,.035)" }}>
                <span style={{ display: "inline-grid", placeItems: "center", minWidth: 42, height: 36, borderRadius: 10, color: "#fff", background: "linear-gradient(145deg," + (GROUP_COLORS[item.group] || "#FF3B54") + ",#9f1239)", fontSize: 13, fontWeight: 850 }}>{item.group}</span>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, overflowWrap: "anywhere" }}>{item.component}</div><div style={{ color: muted, fontSize: 10.5, marginTop: 3 }}>{item.batchCode ? "Batch " + item.batchCode : "Batch reference not supplied"}{item.expiresAt ? " · Expires " + new Date(item.expiresAt).toLocaleDateString() : " · Expiry date not reported"}</div></div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><b style={{ fontSize: 20, letterSpacing: "-.5px" }}>{Number(item.units).toLocaleString()}</b><div style={{ color: Number(item.units) < 5 ? "#FBBF24" : "#34D399", fontSize: 9, fontWeight: 800 }}>{Number(item.units) < 5 ? "LOW STOCK" : "AVAILABLE"}</div><div style={{ color: muted, fontSize: 10 }}>units</div></div>
              </div>)}
            </div>
            <div style={{ color: muted, fontSize: 10.5, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}><Clock3 size={12} />Last reported update: {(bank.lastInventoryUpdate || bank.updatedAt) ? new Date(bank.lastInventoryUpdate || bank.updatedAt).toLocaleString() : "Not provided"}</div>
          </article>)}
        </div>}
    </section>

    <aside style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "15px 17px", borderRadius: 15, background: light ? "#fff8e7" : "rgba(251,191,36,.07)", border: "1px solid " + (light ? "#f2d58a" : "rgba(251,191,36,.18)") }}>
      <ShieldCheck size={19} color="#FBBF24" style={{ flexShrink: 0, marginTop: 1 }} /><div><b style={{ fontSize: 12.5 }}>Availability is a live listing, not a reservation.</b><p style={{ color: muted, fontSize: 11.5, lineHeight: 1.7, margin: "5px 0 0" }}>Stock changes as blood banks update their records. Confirm current availability, compatibility, screening, and issue requirements directly with the blood bank before making clinical decisions. This page does not reserve or allocate units.</p></div>
    </aside>
  </div>;
}
