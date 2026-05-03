import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Calculator,
  Compass,
  LayoutDashboard,
  LogOut,
  Map,
  Users,
  User as UserIcon,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import campusBg from "@/assets/campus-bg.jpg";
import edupathLogo from "@/assets/edupath-logo.png";
import aastLogo from "@/assets/aast-logo.png";
import engLogo from "@/assets/eng-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { getAppProfile, getAuthUser, getStudentById, signOut } from "@/lib/auth";
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
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [student, setStudent] = useState<AppStudent | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const role: AppRole | null = profile?.role ?? null;

  const refresh = async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      if (!user) {
        setProfile(null);
        setStudent(null);
        setProfilePic(null);
        if (requireAuth) navigate({ to: "/login" });
        return;
      }

      const p = await getAppProfile(user.id);
      if (!p) {
        setProfile(null);
        setStudent(null);
        setProfilePic(null);
        if (requireAuth) navigate({ to: "/login" });
        return;
      }

      setProfile(p);
      const sData = p.student_id ? await getStudentById(p.student_id) : null;
      setStudent(sData);

      // Load profile pic
      if (sData) {
        setProfilePic(localStorage.getItem(`profile_pic_${sData.id}`));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();

    const handleStorageChange = () => {
      if (student) {
        setProfilePic(localStorage.getItem(`profile_pic_${student.id}`));
      }
    };

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    window.addEventListener("storage", handleStorageChange);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [requireAuth, student?.id]);

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

  const navItem = (to: string, label: string, Icon: React.ElementType) => {
    const active = path === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
          active
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
            : "text-foreground/70 hover:text-foreground hover:bg-white/5"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  const mobileNavItem = (to: string, label: string, Icon: React.ElementType) => {
    const active = path === to;
    return (
      <Link
        to={to}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all ${
          active ? "text-primary scale-110" : "text-muted-foreground"
        }`}
      >
        <Icon className={`${active ? "h-6 w-6" : "h-5 w-5"}`} />
        <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
      </Link>
    );
  };

  const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className="rounded-xl h-9 w-9 bg-white/5 border border-white/5 hover:bg-primary/10"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  };

  if (loading && requireAuth) return null;

  const showHeader = !!profile;
  const titleLine =
    role === "student"
      ? `${student?.full_name || "Student"}`
      : role === "advisor"
        ? `Advisor: ${profile?.full_name || "Staff"}`
        : "";

  return (
    <AppContextProvider value={{ loading, profile, student, role, refresh }}>
      <div className="relative min-h-screen w-full flex flex-col transition-colors duration-500">
        {/* Full-Screen Campus Background */}
        <div
          className="fixed inset-0 -z-20 bg-center bg-cover transition-opacity duration-1000"
          style={{ backgroundImage: `url(${campusBg})`, opacity: theme === "dark" ? 0.45 : 0.25 }}
          aria-hidden
        />
        {/* Dynamic Theme Overlay */}
        <div
          className="fixed inset-0 -z-10 transition-colors duration-1000"
          style={{ background: "var(--gradient-overlay)" }}
          aria-hidden
        />

        {/* Desktop Header & Identity */}
        {showHeader && (
          <header className="sticky top-0 z-30 w-full hidden md:block border-b border-white/5 bg-background/50 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="flex items-center gap-3">
                  <img src={edupathLogo} alt="Logo" className="h-10 w-10 rounded-xl bg-white p-1" />
                  <div>
                    <div className="text-sm font-bold">EduPath Analytics</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      {titleLine}
                    </div>
                  </div>
                </Link>
              </div>

              <nav className="flex items-center gap-1">
                {role === "advisor" && navItem("/advisor", "Roster", Users)}
                {navItem("/dashboard", "Home", LayoutDashboard)}
                {navItem("/roadmap", "Roadmap", Compass)}
                {navItem("/degree-planner", "Planner", Map)}
                {navItem("/gpa-calculator", "Calculator", Calculator)}
                {role === "student" && navItem("/profile", "Profile", UserIcon)}
              </nav>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Link
                  to="/profile"
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage
                      src={profilePic || undefined}
                      alt="Profile"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="rounded-xl gap-2 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </header>
        )}

        {/* Mobile Header (Identity Only) */}
        {showHeader && (
          <div className="md:hidden flex items-center justify-between p-4 bg-background/50 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
            <Link to="/profile" className="flex items-center gap-2">
              <img src={edupathLogo} alt="Logo" className="h-8 w-8 rounded-lg bg-white p-1" />
              <span className="font-bold text-sm">EduPath</span>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-[10px] font-bold text-primary truncate max-w-[100px]">
                {titleLine}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 relative z-10 mx-auto w-full max-w-7xl px-4 pt-6 ${showHeader ? "pb-24 md:pb-12" : "pb-12"}`}
        >
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        {showHeader && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-2xl border-t border-white/10 px-2 pb-safe-offset-2 pt-1 flex items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
            {role === "advisor" ? (
              <>
                {mobileNavItem("/advisor", "Roster", Users)}
                {mobileNavItem("/dashboard", "Stats", LayoutDashboard)}
                {mobileNavItem("/roadmap", "Map", Compass)}
              </>
            ) : (
              <>
                {mobileNavItem("/dashboard", "Home", LayoutDashboard)}
                {mobileNavItem("/roadmap", "Map", Compass)}
                {mobileNavItem("/degree-planner", "Planner", Map)}
                {mobileNavItem("/gpa-calculator", "Calc", Calculator)}
                {mobileNavItem("/profile", "Me", UserIcon)}
              </>
            )}
          </nav>
        )}

        {/* Top Right Logos (Floating) */}
        <div className="fixed top-4 right-4 z-40 hidden xl:flex items-center gap-2 glass rounded-2xl p-2 opacity-80 hover:opacity-100 transition-opacity">
          <img src={aastLogo} className="h-8 w-auto bg-white rounded p-1" />
          <img src={engLogo} className="h-8 w-8 rounded object-cover" />
        </div>
      </div>
    </AppContextProvider>
  );
}
