import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { CURRICULUM, SEMESTERS } from "@/lib/curriculum";
import { GRADE_POINTS } from "@/lib/gpa";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { student, role } = useAppContext();
  const studentId = student?.id;
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (!studentId || role !== "student") return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("course_code,letter_grade")
          .eq("student_id", studentId);
        if (error) throw error;

        const passed = new Set<string>();
        for (const row of data || []) {
          const code = (row.course_code ?? "").trim().toUpperCase();
          if (!code) continue;
          const gp = GRADE_POINTS[row.letter_grade as keyof typeof GRADE_POINTS] ?? 0;
          if (gp !== 0) passed.add(code);
        }
        setCompleted(passed);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load degree audit");
      } finally {
        setLoading(false);
      }
    })();
  }, [role, studentId]);

  const bySemester = useMemo(() => {
    const semSet = new Set<string>(SEMESTERS as unknown as string[]);
    const map = new Map<string, typeof CURRICULUM>();
    for (const s of SEMESTERS) map.set(s, []);
    map.set("Other", []);

    for (const c of CURRICULUM) {
      const key = semSet.has(c.semester) ? c.semester : "Other";
      map.set(key, [...(map.get(key) || []), c]);
    }

    return Array.from(map.entries());
  }, []);

  const totalRequired = CURRICULUM.filter((c) => c.credits > 0).length;
  const completedRequired = CURRICULUM.filter((c) => c.credits > 0 && completed.has(c.code)).length;
  const remaining = Math.max(0, totalRequired - completedRequired);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Degree Audit</h1>
          <p className="text-sm text-muted-foreground">Requirements checklist + what’s left</p>
        </div>

        {role !== "student" ? (
          <section className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
            Degree audit is currently available in the student view.
          </section>
        ) : (
          <>
            <section className="glass-strong rounded-2xl p-6 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Completed: {completedRequired}</Badge>
              <Badge variant="secondary">Remaining: {remaining}</Badge>
              <Badge variant="secondary">Total: {totalRequired}</Badge>
              <div className="text-xs text-muted-foreground ml-auto">
                {loading ? "Loading…" : ""}
              </div>
            </section>

            <div className="space-y-4">
              {bySemester.map(([sem, courses]) => (
                <section key={sem} className="glass-strong rounded-2xl p-6">
                  <h2 className="text-lg font-semibold">
                    {sem.startsWith("Conc") ? sem : `Semester ${sem}`}
                  </h2>
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    {courses.map((c) => {
                      const done = completed.has(c.code);
                      return (
                        <div
                          key={c.code}
                          className={`glass rounded-xl p-4 border ${
                            done ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-mono text-xs opacity-90">{c.code}</div>
                              <div className="font-medium mt-1">{c.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {c.credits} credits
                                {c.prerequisite ? ` · prereq: ${c.prerequisite}` : ""}
                              </div>
                            </div>
                            <Badge variant={done ? "secondary" : "outline"}>
                              {done ? "Done" : "Left"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
