import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake, MapPin, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/site/Layout";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About — BloodBridge" },
    { name: "description", content: "The BloodBridge mission, network and community values." },
    { property: "og:title", content: "About — BloodBridge" },
    { property: "og:description", content: "Connecting donors, recipients and blood banks." },
  ] }),
  component: About,
});

function About() {
  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-5 pt-20">
        <p className="eyebrow">About us</p>
        <h1 className="mt-3 text-5xl font-semibold md:text-6xl">Blood, when it <span className="text-gradient">matters most.</span></h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">BloodBridge connects blood donors, recipients and blood banks across Sehore, Bhopal, Ashta, Raisen and Hoshangabad. Built by Priyansh Bhatt for EPICS at VIT Bhopal University.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[[ShieldCheck, "Verified", "Every facility is checked before listing."], [MapPin, "Local", "A 100 km regional network around Bhopal."], [HeartHandshake, "Community", "Free for everyone, built to save lives."]].map(([I, t, b]) => {
            const Icon = I as typeof ShieldCheck;
            return <div key={t as string} className="tile p-6"><Icon className="size-6 text-red" /><h3 className="mt-5 font-semibold">{t as string}</h3><p className="mt-1 text-sm text-muted-foreground">{b as string}</p></div>;
          })}
        </div>
        <h2 id="privacy" className="mt-20 text-2xl font-semibold">Privacy Policy</h2>
        <p className="mt-3 text-muted-foreground">BloodBridge has no accounts and collects no personal information. Facility details are curated manually from public sources.</p>
        <h2 id="terms" className="mt-12 text-2xl font-semibold">Terms & Conditions</h2>
        <p className="mt-3 text-muted-foreground">BloodBridge is a technology platform and does not replace medical advice, donor eligibility assessment, or professional blood-bank screening.</p>
      </section>
    </Layout>
  );
}
