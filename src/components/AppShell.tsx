import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, GraduationCap, Calculator, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import campusBg from "@/assets/campus-bg.jpg";
import aastLogo from "@/assets/aast-logo.png";
import engLogo from "@/assets/eng-logo.jpg";
import { clearSession, getSession, type Session } from "@/lib/auth";

export function AppShell({ children, requireAuth = true }: { children: ReactNode; requireAuth?: boolean }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSessionState(s);
    setReady(true);
    if (requireAuth && !s) navigate({ to: "/login" });
  }, [requireAuth, navigate]);

  if (!ready) return null;

  const logout = () => {
    clearSession();
    navigate({ to: "/login" });
  };

  const navItem = (to: string, label: string, Icon: typeof Calculator) => {
    const active = path === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
          active
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-foreground/80 hover:text-foreground hover:bg-white/5"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Background image with overlay */}
      <div
        className="fixed inset-0 -z-20 bg-center bg-cover"
        style={{ backgroundImage: `url(${campusBg})`, opacity: 0.55 }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10"
        style={{ background: "var(--gradient-overlay)" }}
        aria-hidden
      />

      {/* Logos top right */}
      <div className="fixed top-3 right-3 z-30 flex items-center gap-2 glass rounded-2xl px-3 py-2">
        <img src={engLogo} alt="College of Engineering & Technology" className="h-10 w-10 rounded-md object-cover" />
        <img src={aastLogo} alt="AAST" className="h-10 w-auto object-contain bg-white/90 rounded-md px-1" />
      </div>

      {/* Header */}
      {session && (
        <header className="sticky top-0 z-20 w-full">
          <div className="mx-auto max-w-7xl px-4 py-3 mt-2 mr-44 sm:mr-48">
            <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
              <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight truncate">EduPath Analytics</div>
                  <div className="text-[11px] text-muted-foreground leading-tight truncate">
                    {session.full_name} · {session.registration_number}
                  </div>
                </div>
              </Link>
              <nav className="flex items-center gap-1">
                {navItem("/dashboard", "Dashboard", LayoutDashboard)}
                {navItem("/gpa-calculator", "GPA", Calculator)}
                <Button variant="ghost" size="sm" onClick={logout} className="text-foreground/80 hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Logout</span>
                </Button>
              </nav>
            </div>
          </div>
        </header>
      )}

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
