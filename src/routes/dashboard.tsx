import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calculator, BookOpen, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/ClientOnly";
import { DashboardCharts, type DashboardCourseRow } from "@/components/dashboard/DashboardCharts";
import { GRADE_POINTS, calculateGPA, loadRecommendation } from "@/lib/gpa";
import { getSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [gpa, setGpa] = useState(0);
  const [credits, setCredits] = useState(0);
  const [count, setCount] = useState(0);
  const [courses, setCourses] = useState<DashboardCourseRow[]>([]);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    supabase
      .from("courses")
      .select("letter_grade, credit_hours, course_code")
      .eq("student_id", s.id)
      .then(({ data }) => {
        if (!data) return;
        const mapped = data.map((d) => ({
          letter_grade: d.letter_grade,
          credit_hours: Number(d.credit_hours),
          course_code: (d as { course_code?: string | null }).course_code ?? null,
        }));
        setCourses(mapped);
        const r = calculateGPA(mapped);
        setGpa(r.gpa);
        setCredits(r.totalCredits);
        setCount(mapped.length);
      });
  }, []);

  const rec = loadRecommendation(gpa);
  const toneClass =
    rec.tone === "good"
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : rec.tone === "ok"
        ? "text-sky-300 border-sky-400/30 bg-sky-400/10"
        : "text-amber-300 border-amber-400/30 bg-amber-400/10";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Your academic snapshot</p>
          </div>
          <Link to="/gpa-calculator">
            <Button>
              <Calculator className="h-4 w-4 mr-1" /> Open GPA Calculator
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Cumulative GPA" value={gpa.toFixed(2)} />
          <StatCard icon={BookOpen} label="Total Credits" value={String(credits)} />
          <StatCard icon={Calculator} label="Courses Saved" value={String(count)} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="glass-strong rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-1">Grading Scale</h2>
            <p className="text-xs text-muted-foreground mb-4">Official letter-grade conversion</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GRADE_POINTS).map(([g, p]) => (
                <div
                  key={g}
                  className="glass rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <span className="font-mono font-semibold">{g}</span>
                  <span className="text-sm text-muted-foreground">{p.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-strong rounded-2xl p-6 flex flex-col">
            <h2 className="text-lg font-semibold mb-1">GPA Formula</h2>
            <p className="text-xs text-muted-foreground mb-4">How your GPA is computed</p>
            <div className="glass rounded-xl p-4 font-mono text-sm text-center">
              GPA = Σ (grade points × credit hours) / Σ (credit hours)
            </div>

            <h3 className="text-base font-semibold mt-6 mb-2">Recommended Course Load</h3>
            <div className={`glass rounded-xl p-4 border ${toneClass}`}>
              <div className="text-sm font-semibold">{rec.label}</div>
              <div className="text-xs opacity-80">Suggested next term: {rec.credits}</div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Based on cumulative GPA of {gpa.toFixed(2)}.
            </p>
          </section>
        </div>

        <div className="pt-2">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Analytics</h2>
              <p className="text-xs text-muted-foreground">
                Visualize your performance at a glance
              </p>
            </div>
          </div>

          <ClientOnly
            fallback={
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-strong rounded-2xl p-6 h-72" />
                <div className="glass-strong rounded-2xl p-6 h-72" />
              </div>
            }
          >
            <DashboardCharts courses={courses} />
          </ClientOnly>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calculator;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}
