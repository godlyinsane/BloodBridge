import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Navigation, Phone, Search } from "lucide-react";
import { Layout } from "@/components/site/Layout";
import { FACILITIES, mapsUrl } from "@/lib/data";

export const Route = createFileRoute("/facilities")({
  head: () => ({ meta: [
    { title: "Blood Facilities — BloodBridge" },
    { name: "description", content: "Verified hospitals, government blood banks and emergency contacts near Bhopal." },
    { property: "og:title", content: "Blood Facilities — BloodBridge" },
    { property: "og:description", content: "Call or navigate to verified blood facilities." },
  ] }),
  component: Facilities,
});

function Facilities() {
  const [q, setQ] = useState("");
  const list = FACILITIES.filter((f) => `${f.name} ${f.city} ${f.type}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <p className="eyebrow">Need blood</p>
        <h1 className="mt-3 text-5xl font-semibold md:text-6xl">Blood facilities.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">Verified hospitals, government blood banks and emergency contacts. Always call ahead to confirm availability.</p>
        <label className="mt-8 flex max-w-md items-center gap-2 rounded-full border border-border bg-card px-4 py-3 shadow-soft">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city" className="w-full bg-transparent outline-none" />
        </label>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => (
            <div key={f.name} className="tile flex flex-col p-6">
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-red/10 text-red"><Building2 className="size-5" /></span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{f.type}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{f.name}</h3>
              <p className="text-sm text-muted-foreground">{f.city}, Madhya Pradesh</p>
              <div className="mt-6 flex gap-2">
                <a href={`tel:${f.phone}`} className="btn btn-ghost !py-2 !text-sm"><Phone className="size-4" /> Call</a>
                <a href={mapsUrl(`${f.name} ${f.city}`)} target="_blank" rel="noreferrer" className="btn btn-ink !py-2 !text-sm"><Navigation className="size-4" /> Directions</a>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-muted-foreground">No facilities match your search.</p>}
        </div>
      </section>
    </Layout>
  );
}
