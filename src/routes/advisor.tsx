import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";

export const Route = createFileRoute("/advisor")({
  component: AdvisorRosterPage,
});

type RosterStudent = {
  id: string;
  full_name: string;
  registration_number: string;
  program?: string | null;
  level?: string | null;
  credits_earned?: number | null;
  openAlerts?: number;
  criticalAlerts?: number;
};

type AdvisorStudentsRow = {
  student: {
    id: string;
    full_name: string;
    registration_number: string;
    program: string | null;
    level: string | null;
    credits_earned: number | null;
  } | null;
};

type AlertRow = {
  student_id: string;
  severity: "info" | "warn" | "critical";
  resolved_at: string | null;
};

function AdvisorRosterPage() {
  const { profile, role } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<RosterStudent[]>([]);

  const load = async () => {
    if (!profile || role === "student") return;
    setLoading(true);
    try {
      let roster: RosterStudent[] = [];

      if (role === "admin") {
        const { data, error } = await supabase
          .from("students")
          .select("id,full_name,registration_number,program,level,credits_earned")
          .order("full_name", { ascending: true })
          .limit(500);
        if (error) throw error;
        roster = (data || []).map((s) => ({
          id: s.id,
          full_name: s.full_name,
          registration_number: s.registration_number,
          program: (s as { program?: string | null }).program ?? null,
          level: (s as { level?: string | null }).level ?? null,
          credits_earned: Number((s as { credits_earned?: number | null }).credits_earned ?? 0),
        }));
      } else {
        const { data, error } = await supabase
          .from("advisor_students")
          .select("student:students(id,full_name,registration_number,program,level,credits_earned)")
          .eq("advisor_id", profile.id);
        if (error) throw error;
        const rows = (data || []) as unknown as AdvisorStudentsRow[];
        roster = rows
          .map((r) => r.student)
          .filter((s): s is NonNullable<AdvisorStudentsRow["student"]> => !!s)
          .map((s) => ({
            id: s.id,
            full_name: s.full_name,
            registration_number: s.registration_number,
            program: s.program,
            level: s.level,
            credits_earned: Number(s.credits_earned ?? 0),
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
      }

      const ids = roster.map((s) => s.id);
      if (ids.length) {
        const { data: alerts, error: aErr } = await supabase
          .from("alerts")
          .select("student_id,severity,resolved_at")
          .in("student_id", ids)
          .is("resolved_at", null);
        if (aErr) throw aErr;

        const byStudent = new Map<string, { open: number; critical: number }>();
        const alertRows = (alerts || []) as unknown as AlertRow[];
        for (const a of alertRows) {
          const sid = a.student_id;
          const prev = byStudent.get(sid) || { open: 0, critical: 0 };
          prev.open += 1;
          if (a.severity === "critical") prev.critical += 1;
          byStudent.set(sid, prev);
        }

        roster = roster.map((s) => {
          const c = byStudent.get(s.id);
          return {
            ...s,
            openAlerts: c?.open ?? 0,
            criticalAlerts: c?.critical ?? 0,
          };
        });
      }

      setStudents(roster);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, role]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) => {
      return (
        s.full_name.toLowerCase().includes(query) ||
        s.registration_number.toLowerCase().includes(query) ||
        (s.program || "").toLowerCase().includes(query)
      );
    });
  }, [q, students]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Advisor Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Student roster, search, and at-risk flags
            </p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        <section className="glass-strong rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, reg #, or program…"
              className="bg-white/5 border-white/15 max-w-md"
            />
            <div className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${filtered.length} students`}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const atRisk = (s.criticalAlerts || 0) > 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {s.registration_number}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.program || "—"}</TableCell>
                      <TableCell className="text-sm">{s.level || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {Number(s.credits_earned ?? 0).toFixed(0)}
                      </TableCell>
                      <TableCell>
                        {atRisk ? (
                          <Badge className="bg-red-500/20 text-red-200 border border-red-500/30">
                            At-risk
                          </Badge>
                        ) : (s.openAlerts || 0) > 0 ? (
                          <Badge className="bg-amber-500/20 text-amber-200 border border-amber-500/30">
                            {s.openAlerts} alert(s)
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to="/students/$studentId" params={{ studentId: s.id }}>
                          <Button size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-sm text-muted-foreground py-8 text-center"
                    >
                      No students match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
