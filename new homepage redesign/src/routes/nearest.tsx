import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LocateFixed, Navigation } from "lucide-react";
import { Layout } from "@/components/site/Layout";

export const Route = createFileRoute("/nearest")({
  head: () => ({ meta: [
    { title: "Nearest Blood Bank — BloodBridge" },
    { name: "description", content: "Use your location to get turn-by-turn directions to the closest blood bank." },
    { property: "og:title", content: "Nearest Blood Bank — BloodBridge" },
    { property: "og:description", content: "Live GPS directions to the nearest blood bank." },
  ] }),
  component: Nearest,
});

function Nearest() {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const locate = () => {
    if (!navigator.geolocation) { window.open("https://www.google.com/maps/search/blood+bank+near+me", "_blank"); return; }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setStatus("idle"); window.open(`https://www.google.com/maps/search/blood+bank/@${p.coords.latitude},${p.coords.longitude},14z`, "_blank"); },
      () => { setStatus("error"); window.open("https://www.google.com/maps/search/blood+bank+near+me", "_blank"); },
    );
  };
  return (
    <Layout>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-24 text-center">
        <div className="relative grid size-56 place-items-center">
          <div className="absolute inset-0 rounded-full dot-grid [mask-image:radial-gradient(circle,black_30%,transparent_70%)]" />
          {[0, 0.8, 1.6].map((d) => <span key={d} className="absolute size-20 rounded-full border-2 border-red animate-pulse-ring" style={{ animationDelay: `${d}s` }} />)}
          <span className="relative grid size-20 place-items-center rounded-full bg-blood text-emergency-foreground shadow-lift"><LocateFixed className="size-8" /></span>
        </div>
        <p className="eyebrow mt-6">Live GPS</p>
        <h1 className="mt-3 text-5xl font-semibold md:text-6xl">Nearest blood bank.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">We'll use your location to open Google Maps with the closest blood banks and turn-by-turn navigation.</p>
        <button onClick={locate} className="btn btn-primary mt-8 !px-6 !py-3"><Navigation className="size-4" /> {status === "locating" ? "Locating…" : "Take me to the nearest blood bank"}</button>
        {status === "error" && <p className="mt-4 text-sm text-muted-foreground">Location unavailable — opened a general search instead.</p>}
      </section>
    </Layout>
  );
}
