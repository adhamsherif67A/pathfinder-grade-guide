import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { requestEmailOtp, restoreSessionFromSupabase, verifyEmailOtp } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    restoreSessionFromSupabase().then((s) => {
      if (s) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestEmailOtp(email);
      toast.success("We sent a 6-digit code to your email");
      setStep("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const s = await verifyEmailOtp({
        email,
        token: code,
        registration_number: reg,
        full_name: name,
      });
      toast.success(`Welcome, ${s.full_name}`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
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
              Sign in with your college email + student info
            </p>
          </div>

          {step === "request" ? (
            <form onSubmit={requestCode} className="space-y-4">
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
                <Mail className="h-4 w-4 mr-1" />
                {loading ? "Sending code..." : "Send verification code"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                We’ll email you a 6-digit code. New students are registered automatically.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  required
                  className="bg-white/5 border-white/15 font-mono tracking-widest"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                <KeyRound className="h-4 w-4 mr-1" />
                {loading ? "Verifying..." : "Verify & continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={loading}
                onClick={() => setStep("request")}
              >
                Change email / resend
              </Button>
            </form>
          )}

          <div className="mt-6 text-[11px] text-muted-foreground">
            Your email must be a college domain (e.g.{" "}
            <span className="font-mono">@student.aast.edu</span>).
          </div>
        </div>
      </div>
    </AppShell>
  );
}
