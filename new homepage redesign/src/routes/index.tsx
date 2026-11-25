import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Building2, Info, MapPin, Navigation, ShieldCheck, Search, PhoneCall, Phone, Hospital } from "lucide-react";
import { Layout } from "@/components/site/Layout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BloodBridge — Find blood. Give hope." },
      { name: "description", content: "Find verified blood banks and emergency help across Sehore, Bhopal, Ashta, Raisen and Hoshangabad." },
      { property: "og:title", content: "BloodBridge — Find blood. Give hope." },
      { property: "og:description", content: "Verified blood banks and hospitals, one tap away." },
    ],
  }),
  component: Home,
});

const ORBIT = [Building2, MapPin, Phone, Hospital, ShieldCheck, Navigation];

function HeroArt() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      <div className="absolute inset-0 rounded-full dot-grid [mask-image:radial-gradient(circle,black_40%,transparent_70%)]" />
      {[100, 76, 52].map((s, i) => (
        <div key={s} className="absolute rounded-full border border-border" style={{ inset: `${(100 - s) / 2}%`, borderStyle: i === 1 ? "dashed" : "solid" }} />
      ))}
      <div className="absolute inset-0 animate-spin-slow">
        {ORBIT.map((Icon, i) => {
          const a = (i / ORBIT.length) * Math.PI * 2;
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 38 * Math.sin(a)}%` }}>
              <div className="glass grid size-10 place-items-center rounded-full border border-border shadow-soft [animation:spin-slow_40s_linear_infinite_reverse]">
                <Icon className="size-4 text-red" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-[31%] grid place-items-center animate-float">
        <svg viewBox="0 0 100 120" className="w-full" style={{ filter: "drop-shadow(0 30px 30px var(--shadow-drop))" }}>
          <defs>
            <linearGradient id="drop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--drop-a)" /><stop offset="1" stopColor="var(--drop-b)" /></linearGradient>
          </defs>
          <path d="M50 4C50 4 12 52 12 78a38 38 0 0 0 76 0C88 52 50 4 50 4Z" fill="url(#drop)" />
          <polyline points="24,82 38,82 44,70 52,94 58,76 76,76" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Home() {
  return (
    <Layout>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div className="animate-rise">
          <span className="eyebrow !text-red">Blood donor network · Madhya Pradesh</span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] md:text-7xl">
            Be someone's <span className="text-gradient">lifeline.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Find verified blood banks and hospitals near you — call or get directions in one tap.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/facilities" className="btn btn-primary"><Building2 className="size-4" /> Browse facilities</Link>
            <Link to="/nearest" className="btn btn-ghost"><Navigation className="size-4" /> Nearest bank</Link>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="tile flex flex-wrap items-center justify-between gap-6 p-7 hover:!translate-y-0">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-red/10 text-red"><Activity className="size-5" /></span>
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-success" />
                <span className="eyebrow">Active regional network</span>
              </div>
              <h3 className="mt-1 text-lg font-semibold">32+ verified facilities within 100 km</h3>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Sehore · Bhopal · Ashta · Raisen · Hoshangabad</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <h2 className="text-4xl font-semibold md:text-5xl">What do you need?</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { to: "/facilities", icon: Building2, title: "Explore facilities", body: "Hospitals, government blood banks and emergency contacts." },
            { to: "/nearest", icon: MapPin, title: "Nearest blood bank", body: "Turn-by-turn directions with Google Maps." },
            { to: "/about", icon: Info, title: "About us", body: "Our network, mission and values." },
          ].map((c) => (
            <Link key={c.title} to={c.to} className="tile group flex flex-col p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-red/10 text-red"><c.icon className="size-5" /></span>
              <h3 className="mt-10 text-xl font-semibold">{c.title}</h3>
              <p className="mt-2 flex-1 text-muted-foreground">{c.body}</p>
              <ArrowRight className="mt-6 size-5 transition text-red group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <h2 className="text-4xl font-semibold md:text-5xl">How it works.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { icon: Search, t: "Find", b: "Browse or search the verified facility list." },
            { icon: PhoneCall, t: "Call", b: "Confirm availability directly before you go." },
            { icon: Navigation, t: "Go", b: "Open directions and follow professional guidance." },
          ].map((s, i) => (
            <div key={s.t} className="tile p-7">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full border border-border"><s.icon className="size-5 text-red" /></span>
                <span className="font-mono text-4xl font-semibold text-border">0{i + 1}</span>
              </div>
              <h3 className="mt-8 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-28">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-10 text-ink-foreground md:p-16">
          <svg className="absolute -right-24 -top-24 h-[30rem] w-[30rem]" viewBox="0 0 200 200" aria-hidden>
            {[90, 70, 50, 30].map((r, i) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--emergency)" strokeOpacity={0.15 + i * 0.15} strokeWidth="0.6" />)}
          </svg>
          <div className="relative max-w-xl">
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">A small act can make a life-changing difference.</h2>
            <p className="mt-4 opacity-60">Explore donation camps and blood banks near you.</p>
            <Link to="/facilities" className="btn btn-primary mt-8"><Building2 className="size-4" /> Camps & banks</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">BloodBridge helps people discover donation support; it does not replace medical advice or blood-bank screening.</p>
      </section>
    </Layout>
  );
}
