import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getAppProfile, getAuthUser } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getAuthUser();
        if (!user) {
          setError("No session found. Please try signing in again.");
          return;
        }

        const profile = await getAppProfile(user.id);
        if (!profile) {
          setError("Could not load profile.");
          return;
        }

        toast.success("Signed in");
        navigate({ to: profile.role === "student" ? "/dashboard" : "/advisor" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    })();
  }, [navigate]);

  return (
    <AppShell requireAuth={false}>
      <div className="max-w-xl mx-auto glass-strong rounded-2xl p-6">
        <h1 className="text-xl font-semibold">Signing you in…</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {error ? error : "You’ll be redirected automatically."}
        </p>
      </div>
    </AppShell>
  );
}
