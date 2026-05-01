import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { getSession, loginOrRegister } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) navigate({ to: "/dashboard" });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const s = await loginOrRegister(reg, name);
      toast.success(`Welcome, ${s.full_name}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
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
              Sign in or register with your university credentials
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg">Registration Number</Label>
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
              <Label htmlFor="name">Full Name</Label>
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
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              <LogIn className="h-4 w-4 mr-1" />
              {loading ? "Signing in..." : "Continue"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              New users are registered automatically. Returning students keep all their saved
              courses.
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
