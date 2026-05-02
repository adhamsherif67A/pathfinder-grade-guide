import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn, UserCircle, GraduationCap } from "lucide-react";
import edupathLogo from "@/assets/edupath-logo.png";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAppProfile, getAuthUser, signInDirectly } from "@/lib/auth";
import { AppRole } from "@/lib/app-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState<number | "">("");
  const [role, setRole] = useState<AppRole>("student");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getAuthUser();
      if (!user) return;
      const profile = await getAppProfile(user.id);
      if (!profile) return;
      
      if (profile.role === 'advisor') {
        navigate({ to: "/advisor" });
      } else {
        navigate({ to: "/dashboard" });
      }
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
        role,
        enrollment_year: enrollmentYear === "" ? undefined : Number(enrollmentYear),
      });
      toast.success(`Welcome back, ${role}!`);
      
      if (role === 'advisor') {
        navigate({ to: "/advisor" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      console.error("[Login] Sign in process failed:", err);
      const msg = err instanceof Error ? err.message : "Sign in failed. Check your internet or ID.";
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
              Academic Advising Portal
            </p>
          </div>

          <Tabs defaultValue="student" onValueChange={(v) => setRole(v as AppRole)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10">
              <TabsTrigger value="student" className="gap-2">
                <GraduationCap className="h-4 w-4" /> Student
              </TabsTrigger>
              <TabsTrigger value="advisor" className="gap-2">
                <UserCircle className="h-4 w-4" /> Advisor
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">College Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'student' ? "e.g. name@student.aast.edu" : "e.g. name@aast.edu.eg"}
                required
                className="bg-white/5 border-white/15"
                autoComplete="email"
              />
            </div>

            <div className={`grid ${role === 'student' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div className="space-y-2">
                <Label htmlFor="reg">{role === 'student' ? 'Registration #' : 'Staff ID'}</Label>
                <Input
                  id="reg"
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                  placeholder={role === 'student' ? "e.g. 22102345" : "e.g. AD-9901"}
                  required
                  className="bg-white/5 border-white/15"
                  autoComplete="username"
                />
              </div>
              {role === 'student' && (
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
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="bg-white/5 border-white/15"
                autoComplete="name"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              <LogIn className="h-4 w-4 mr-1" />
              {loading ? "Signing in..." : `Sign in as ${role}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Access as <strong>{role}</strong> mode. Verification bypassed.
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}


