import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/login/admin")({
  component: LoginAdminPage,
});

function LoginAdminPage() {
  return (
    <AppShell requireAuth={false}>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gradient">Admin</h1>
        <div className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
          Admin access page (accessible via /login/admin). You have admin access.
        </div>
      </div>
    </AppShell>
  );
}
