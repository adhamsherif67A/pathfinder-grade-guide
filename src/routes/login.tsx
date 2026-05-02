import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { getAppProfile, getAuthUser, requestMagicLinkSignIn } from "@/lib/auth";

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
      await requestMagicLinkSignIn({
        email,
        registration_number: reg,
        full_name: name,
        program: program || undefined,
        level: level || undefined,
        enrollment_year: enrollmentYear === "" ? undefined : Number(enrollmentYear),
      });
      toast.success("Check your email for a sign-in link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell requireAuth={false}>
      <div className="min-h-[80vh] grid place-items-center pt-12">
        <div className="w-full max-w-md glass-strong rounded-3xl p-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center mb-3 shadow-lg">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">EduPath Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              We’ll email you a secure sign-in link.
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
              <Mail className="h-4 w-4 mr-1" />
              {loading ? "Sending link..." : "Email me a sign-in link"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              After you click the link, we’ll automatically link/create your student record.
            </p>
          </form>

          <div className="mt-6 text-[11px] text-muted-foreground">
            Your email must be a college domain (e.g.{" "}
            <span className="font-mono">@student.aast.edu</span>).
          </div>
        </div>
      </div>
    </AppShell>
  );
}
