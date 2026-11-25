import { Link } from "@tanstack/react-router";
import { Phone, Navigation, Mail, MapPin, Heart, ChevronRight, Sun, Moon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" className="relative ml-2 flex h-8 w-14 items-center rounded-full bg-secondary p-1 transition">
      <span className={`grid size-6 place-items-center rounded-full bg-card text-foreground shadow-soft transition-transform duration-500 ${dark ? "translate-x-6" : ""}`}>
        {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      </span>
    </button>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--drop-a)" />
          <stop offset="1" stopColor="var(--drop-b)" />
        </linearGradient>
      </defs>
      <path d="M16 2C16 2 5 14 5 20.5A11 11 0 0 0 27 20.5C27 14 16 2 16 2Z" fill="url(#lg)" />
      <path d="M14 15h4v3.5h3.5v4H18V26h-4v-3.5h-3.5v-4H14Z" fill="white" />
    </svg>
  );
}

const nav = [
  { to: "/", label: "Home" },
  { to: "/facilities", label: "Need Blood" },
  { to: "/nearest", label: "Nearest Bank" },
  { to: "/about", label: "About" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Emergency strip */}
      <div className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="absolute inset-0 rounded-full bg-emergency animate-pulse-ring" />
              <span className="relative size-2.5 rounded-full bg-emergency" />
            </span>
            <span className="font-mono text-xs tracking-widest text-emergency">CRITICAL DISPATCH</span>
            <span className="hidden opacity-70 sm:inline">In acute emergencies, dispatch immediately</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="tel:108" className="btn !py-1.5 !text-sm bg-emergency text-emergency-foreground hover:opacity-90"><Phone className="size-3.5" /> Ambulance 108</a>
            <a href="tel:102" className="btn !py-1.5 !text-sm bg-ink-foreground/10 hover:bg-ink-foreground/20">102</a>
            <Link to="/nearest" className="btn !py-1.5 !text-sm bg-ink-foreground text-ink hover:opacity-90"><Navigation className="size-3.5" /> Nearest bank</Link>
          </div>
        </div>
      </div>

      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo /> BloodBridge
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "!text-red bg-red/10" }}>
                {n.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold"><Logo /> BloodBridge</div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Connecting blood donors, recipients and blood banks to help people find the blood they need, when it matters most.</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-red/10 px-3 py-1.5 text-xs font-medium text-red"><Heart className="size-3.5 fill-current" /> Every donation can make a difference</span>
          </div>
          <div>
            <p className="eyebrow">Quick links</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[["/", "Home"], ["/facilities", "Emergency Requests"], ["/facilities", "Camps & Blood Banks"], ["/about", "Features"]].map(([to, l]) => (
                <li key={l}><Link to={to as "/"} className="group inline-flex items-center gap-1 hover:text-foreground"><ChevronRight className="size-3.5 text-red transition group-hover:translate-x-0.5" />{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Contact us</p>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3"><Mail className="size-4 text-red" /><div><p className="font-medium">Email support</p><a href="mailto:support.bloodbridge@gmail.com" className="text-muted-foreground">support.bloodbridge@gmail.com</a></div></li>
              <li className="flex gap-3"><Phone className="size-4 text-red" /><div><p className="font-medium">Mobile</p><p className="text-muted-foreground">+91 9132450XXX</p></div></li>
              <li className="flex gap-3"><MapPin className="size-4 text-red" /><div><p className="font-medium">Location</p><p className="text-muted-foreground">VIT Bhopal University, MP</p></div></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-6 text-xs text-muted-foreground">
          <p>© 2026 BloodBridge · Made by Priyansh Bhatt for EPICS. Built with <Heart className="inline size-3 fill-emergency text-foreground" /> to help save lives.</p>
          <div className="flex gap-5"><Link to="/about">About Us</Link><Link to="/about" hash="privacy">Privacy Policy</Link><Link to="/about" hash="terms">Terms & Conditions</Link></div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">BloodBridge is a technology platform and does not replace medical advice or professional blood-bank screening.</p>
      </footer>
    </div>
  );
}
