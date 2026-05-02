import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAppContext } from "@/lib/app-context";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { role } = useAppContext();

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gradient">Admin</h1>
        <div className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
          {role !== "admin"
            ? "You don’t have access to admin features."
            : "Curriculum management, official PDF reports, and transcript parsing will live here (next iteration)."}
        </div>
      </div>
    </AppShell>
  );
}
