import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Calculator,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import campusBg from "@/assets/campus-bg.jpg";
import edupathLogo from "@/assets/edupath-logo.png";
import aastLogo from "@/assets/aast-logo.png";
import engLogo from "@/assets/eng-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import {
  getAppProfile,
  getAuthUser,
  getStudentById,
  signOut,
} from "@/lib/auth";
import {
  AppContextProvider,
  type AppProfile,
  type AppRole,
  type AppStudent,
} from "@/lib/app-context";

export function AppShell({
  children,
  requireAuth = true,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [student, setStudent] = useState<AppStudent | null>(null);
  const role: AppRole | null = profile?.role ?? null;

  const refresh = async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      if (!user) {
        setProfile(null);
        setStudent(null);
        if (requireAuth) navigate({ to: "/login" });
        return;
      }

      const p = await getAppProfile(user.id);
      if (!p) {
        setProfile(null);
        setStudent(null);
        if (requireAuth) navigate({ to: "/login" });
        return;
      }

      // Student onboarding/linking
      setProfile(p);
      setStudent(p.student_id ? await getStudentById(p.student_id) : null);

      // Single dashboard — no role-based redirects
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireAuth]);

  const logout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const initials = useMemo(() => {
    const name = student?.full_name || profile?.full_name || "";
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "U";
  }, [student?.full_name, profile?.full_name]);

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

  if (loading && requireAuth) return null;

  const showHeader = !!profile;
  const titleLine =
    role === "student"
      ? `${student?.full_name || "Student"}${student?.registration_number ? ` · ${student.registration_number}` : ""}`
      : role === "advisor"
        ? "Advisor"
        : "";

  return (
    <AppContextProvider value={{ loading, profile, student, role, refresh }}>
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
          <img
            src={engLogo}
            alt="College of Engineering & Technology"
            className="h-10 w-10 rounded-md object-cover"
          />
          <img
            src={aastLogo}
            alt="AAST"
            className="h-10 w-auto object-contain bg-white/90 rounded-md px-1"
          />
        </div>

        {/* Header */}
        {showHeader && (
          <header className="sticky top-0 z-20 w-full">
            <div className="mx-auto max-w-7xl px-4 py-3 mt-2 mr-44 sm:mr-48">
              <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 min-w-0"
                >
                  <img
                    src={edupathLogo}
                    alt="EduPath"
                    className="h-9 w-9 rounded-xl bg-white/90 object-contain p-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight truncate">
                      EduPath Analytics
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-tight truncate">
                      {titleLine}
                    </div>
                  </div>
                </Link>

                <nav className="flex items-center gap-1">
                  {navItem("/dashboard", "Dashboard", LayoutDashboard)}
                  {navItem("/gpa-calculator", "GPA Calculator", Calculator)}
                  <div className="ml-1 flex items-center gap-2 px-2 py-2 text-sm" title="Profile">
                    <Avatar className="h-7 w-7">
                      <AvatarImage alt={student?.full_name || profile?.full_name || "User"} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-foreground/80 hover:text-foreground"
                  >
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
    </AppContextProvider>
  );
}
