import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import edupathLogo from "@/assets/edupath-logo.png";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { getAppProfile, getAuthUser, signInDirectly } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [level, setLevel] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState<number | "">("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getAuthUser();
      if (!user) return;
      const profile = await getAppProfile(user.id);
      if (!profile) return;
      navigate({ to: profile.role === "student" ? "/dashboard" : "/advisor" });
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInDirectly({
        email,
        registration_number: reg,
        full_name: name,
        program: program || undefined,
        level: level || undefined,
        enrollment_year: enrollmentYear === "" ? undefined : Number(enrollmentYear),
      });
      toast.success("Welcome to EduPath!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("[Login] Sign in process failed:", err);
      const msg = err instanceof Error ? err.message : "Sign in failed. Check your internet or registration number.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell requireAuth={false}>
      <div className="min-h-[80vh] grid place-items-center pt-12">
        <div className="w-full max-w-md glass-strong rounded-3xl p-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 mb-3">
              <img src={edupathLogo} alt="EduPath" className="h-14 w-14 rounded-2xl object-contain bg-white/90 p-1 shadow-lg" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">EduPath Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your student details to continue.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">College Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. name@student.aast.edu"
                required
                className="bg-white/5 border-white/15"
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reg">Registration #</Label>
                <Input
                  id="reg"
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                  placeholder="e.g. 22102345"
                  required
                  className="bg-white/5 border-white/15"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Enrollment year</Label>
                <Input
                  id="year"
                  type="number"
                  value={enrollmentYear}
                  onChange={(e) => setEnrollmentYear(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 2023"
                  className="bg-white/5 border-white/15"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmed Hassan"
                required
                className="bg-white/5 border-white/15"
                autoComplete="name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="program">Program</Label>
                <Input
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. Mechatronics"
                  className="bg-white/5 border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Input
                  id="level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="e.g. Level 3"
                  className="bg-white/5 border-white/15"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              <LogIn className="h-4 w-4 mr-1" />
              {loading ? "Signing in..." : "Sign in directly"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Verification is disabled. You’ll be logged in immediately.
            </p>
          </form>

          <div className="mt-6 text-[11px] text-muted-foreground">
            Your data is stored in our database based on your registration number.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

