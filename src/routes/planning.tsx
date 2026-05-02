import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { CURRICULUM, CURRICULUM_BY_CODE, type CurriculumCourse } from "@/lib/curriculum";
import { GRADE_POINTS } from "@/lib/gpa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/planning")({
  component: PlanningPage,
});

type Planned = {
  course_code: string;
  course_name: string;
  credit_hours: number;
};

function extractCodes(prereq: string) {
  const codes = prereq.toUpperCase().match(/[A-Z]{2,4}\d{4}|UNR-ELE-\d+/g) || [];
  return Array.from(new Set(codes));
}

function extractCreditRequirement(prereq: string): number | null {
  const m = prereq.match(/(\d+)\s*Cr\.?\s*Hr\.?/i);
  return m ? Number(m[1]) : null;
}

function missingPrereqs(args: {
  course: CurriculumCourse;
  completedCodes: Set<string>;
  creditsEarned: number;
  plannedCodes: Set<string>;
}) {
  const prereq = args.course.prerequisite;
  if (!prereq) return [] as string[];

  const missing: string[] = [];
  const creditReq = extractCreditRequirement(prereq);
  if (creditReq != null && args.creditsEarned < creditReq) {
    missing.push(`${creditReq} Cr. Hr.`);
  }

  for (const code of extractCodes(prereq)) {
    if (!args.completedCodes.has(code)) {
      // if it's only in the plan, it's still a prereq risk
      if (args.plannedCodes.has(code)) missing.push(`${code} (planned)`);
      else missing.push(code);
    }
  }

  return missing;
}

function PlanningPage() {
  const { profile, student, role } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [term, setTerm] = useState("Next term");
  const [planId, setPlanId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [completedCodes, setCompletedCodes] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!student || !profile || role !== "student") return;
    setLoading(true);
    try {
      const { data: plan, error: planErr } = await supabase
        .from("semester_plans")
        .select("id,term,created_at")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (planErr) throw planErr;

      if (plan?.id) {
        setPlanId(plan.id);
        setTerm(plan.term || "Next term");

        const { data: pcs, error: pcErr } = await supabase
          .from("planned_courses")
          .select("course_code,course_name,credit_hours,status")
          .eq("plan_id", plan.id)
          .order("created_at", { ascending: true });
        if (pcErr) throw pcErr;

        setPlanned(
          (pcs || [])
            .filter((p) => p.status === "planned" || p.status === "enrolled")
            .map((p) => ({
              course_code: String(p.course_code || "").toUpperCase(),
              course_name: String(p.course_name || p.course_code || ""),
              credit_hours: Number(p.credit_hours ?? 0),
            })),
        );
      } else {
        setPlanId(null);
        setPlanned([]);
      }

      const { data: taken, error: tErr } = await supabase
        .from("courses")
        .select("course_code,letter_grade")
        .eq("student_id", student.id);
      if (tErr) throw tErr;

      const passed = new Set<string>();
      for (const row of taken || []) {
        const code = (row.course_code ?? "").trim().toUpperCase();
        if (!code) continue;
        const gp = GRADE_POINTS[row.letter_grade as keyof typeof GRADE_POINTS] ?? 0;
        if (gp !== 0) passed.add(code);
      }
      setCompletedCodes(passed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, role]);

  const catalog = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return CURRICULUM;
    return CURRICULUM.filter(
      (c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query),
    );
  }, [q]);

  const plannedCodes = useMemo(() => new Set(planned.map((p) => p.course_code)), [planned]);

  const creditsPlanned = useMemo(
    () => planned.reduce((sum, p) => sum + Number(p.credit_hours || 0), 0),
    [planned],
  );

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (creditsPlanned > 18) w.push("Overload risk: planned credits > 18");
    if (creditsPlanned > 0 && creditsPlanned < 12)
      w.push("Half-load warning: planned credits < 12");

    const dup = planned
      .map((p) => p.course_code)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) !== i);
    if (dup.length) w.push(`Duplicate courses in plan: ${Array.from(new Set(dup)).join(", ")}`);

    for (const p of planned) {
      const cur = CURRICULUM_BY_CODE[p.course_code];
      if (!cur) continue;
      const missing = missingPrereqs({
        course: cur,
        completedCodes,
        creditsEarned: Number(student?.credits_earned ?? 0),
        plannedCodes,
      });
      if (missing.length) {
        w.push(`${p.course_code} missing prereqs: ${missing.join(", ")}`);
      }
    }
    return w;
  }, [completedCodes, creditsPlanned, planned, plannedCodes, student?.credits_earned]);

  const addCourse = (c: CurriculumCourse) => {
    if (plannedCodes.has(c.code)) {
      toast.info(`${c.code} already in plan`);
      return;
    }
    setPlanned((ps) => [
      ...ps,
      { course_code: c.code, course_name: c.name, credit_hours: c.credits },
    ]);
  };

  const removeCourse = (code: string) =>
    setPlanned((ps) => ps.filter((p) => p.course_code !== code));

  const save = async () => {
    if (!student || !profile) return;
    setSaving(true);
    try {
      let id = planId;
      if (!id) {
        const { data, error } = await supabase
          .from("semester_plans")
          .insert({
            student_id: student.id,
            term: term.trim() || "Next term",
            created_by: profile.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        setPlanId(id);
      } else {
        const { error } = await supabase
          .from("semester_plans")
          .update({ term: term.trim() || "Next term" })
          .eq("id", id);
        if (error) throw error;
      }

      const { error: delErr } = await supabase.from("planned_courses").delete().eq("plan_id", id);
      if (delErr) throw delErr;

      if (planned.length) {
        const { error: insErr } = await supabase.from("planned_courses").insert(
          planned.map((p) => ({
            plan_id: id,
            course_code: p.course_code,
            course_name: p.course_name,
            credit_hours: p.credit_hours,
            status: "planned",
          })) as never,
        );
        if (insErr) throw insErr;
      }

      toast.success("Plan saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Course Planning</h1>
          <p className="text-sm text-muted-foreground">
            Next-semester plan + prerequisite validation
          </p>
        </div>

        {role !== "student" ? (
          <section className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
            Planning is currently available in the student view.
          </section>
        ) : (
          <>
            <section className="glass-strong rounded-2xl p-6 flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Term</div>
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="bg-white/5 border-white/15 max-w-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Planned credits: {creditsPlanned}</Badge>
                <Button onClick={save} disabled={saving || loading}>
                  {saving ? "Saving…" : "Save plan"}
                </Button>
              </div>
            </section>

            {warnings.length ? (
              <section className="glass-strong rounded-2xl p-6">
                <h2 className="text-lg font-semibold">Alerts</h2>
                <div className="mt-3 space-y-2">
                  {warnings.map((w, i) => (
                    <div
                      key={i}
                      className="glass rounded-xl p-3 border border-amber-400/30 bg-amber-400/10 text-amber-100 text-sm"
                    >
                      {w}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid lg:grid-cols-2 gap-6">
              <section className="glass-strong rounded-2xl p-6">
                <h2 className="text-lg font-semibold">Your plan</h2>
                <div className="mt-4 space-y-2">
                  {planned.map((p) => (
                    <div
                      key={p.course_code}
                      className="glass rounded-xl p-4 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="font-mono text-xs opacity-90">{p.course_code}</div>
                        <div className="font-medium mt-1">{p.course_name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {p.credit_hours} credits
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => removeCourse(p.course_code)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  {planned.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No courses planned yet.</div>
                  ) : null}
                </div>
              </section>

              <section className="glass-strong rounded-2xl p-6">
                <h2 className="text-lg font-semibold">Catalog</h2>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by code or name…"
                  className="mt-3 bg-white/5 border-white/15"
                />
                <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 space-y-2">
                  {catalog.map((c) => {
                    const inPlan = plannedCodes.has(c.code);
                    return (
                      <div
                        key={c.code}
                        className="glass rounded-xl p-4 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-xs opacity-90">{c.code}</div>
                          <div className="font-medium mt-1 truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {c.credits} credits · Sem {c.semester}
                            {c.prerequisite ? ` · prereq: ${c.prerequisite}` : ""}
                          </div>
                        </div>
                        <Button size="sm" disabled={inPlan} onClick={() => addCourse(c)}>
                          {inPlan ? "Added" : "Add"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
