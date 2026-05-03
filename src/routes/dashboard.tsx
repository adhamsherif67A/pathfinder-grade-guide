import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  Calculator,
  Download,
  FileText,
  GraduationCap,
  Link2,
  RefreshCcw,
  TrendingUp,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/ClientOnly";
import { DashboardCharts, type DashboardCourseRow } from "@/components/dashboard/DashboardCharts";
import {
  buildReportCsv,
  downloadCsv,
  downloadReportPdf,
  type ReportExportCourse,
} from "@/lib/report-export";
import { encodeReportSharePayload } from "@/lib/report-share";
import { GRADE_POINTS, calculateGPA } from "@/lib/gpa";
import { getSemesterRecommendation } from "@/lib/recommendation";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { calculateStudentStats } from "@/lib/student-stats";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}

function DashboardPage() {
  const [gpa, setGpa] = useState(0);
  const [credits, setCredits] = useState(0);
  const [count, setCount] = useState(0);
  const [courses, setCourses] = useState<DashboardCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedAtIso, setSyncedAtIso] = useState<string | null>(null);

  const { student, loading: ctxLoading } = useAppContext();

  const exportCourses: ReportExportCourse[] = useMemo(
    () =>
      courses.map((c) => ({
        course_code: c.course_code,
        course_name: c.course_name || null,
        letter_grade: c.letter_grade,
        credit_hours: Number(c.credit_hours),
      })),
    [courses],
  );

  const loadCourses = useCallback(async () => {
    if (ctxLoading) return;
    if (!student) {
      setCourses([]);
      setGpa(0);
      setCredits(0);
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("courses")
      .select("letter_grade, credit_hours, course_code, course_name")
      .eq("student_id", student.id);

    if (error) {
      setError(error.message);
      toast.error("Could not load courses");
      setLoading(false);
      return;
    }

    const mapped: DashboardCourseRow[] = (data || []).map((d) => ({
      letter_grade: d.letter_grade,
      credit_hours: Number(d.credit_hours),
      course_code: (d as { course_code?: string | null }).course_code ?? null,
      course_name: (d as { course_name?: string | null }).course_name ?? null,
    }));

    setCourses(mapped);
    const r = calculateGPA(mapped);
    setGpa(r.gpa);
    setCredits(r.totalCredits);
    setCount(mapped.length);
    setSyncedAtIso(new Date().toISOString());
    setLoading(false);
  }, [student, ctxLoading]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const rec = getSemesterRecommendation(courses);
  const stats = useMemo(() => calculateStudentStats(courses, gpa), [courses, gpa]);

  const toneClass =
    rec.tone === "good"
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : rec.tone === "ok"
        ? "text-sky-300 border-sky-400/30 bg-sky-400/10"
        : "text-amber-300 border-amber-400/30 bg-amber-400/10";

  const standingToneClass =
    stats.standingTone === "good"
      ? "text-emerald-400"
      : stats.standingTone === "ok"
        ? "text-sky-400"
        : "text-amber-400";

  const generatedAtIso = syncedAtIso || new Date().toISOString();
  const canExport = !loading && exportCourses.length > 0;

  const buildShareUrl = () => {
    if (!student) return null;
    const hash = encodeReportSharePayload({
      v: 1,
      generated_at: generatedAtIso,
      student: {
        full_name: student.full_name,
        registration_number: student.registration_number,
      },
      courses: exportCourses,
    });

    const url = new URL(window.location.href);
    url.pathname = "/report";
    url.search = "";
    url.hash = hash;
    return url.toString();
  };

  const copyShareLink = async () => {
    const shareUrl = buildShareUrl();
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy share link");
    }
  };

  const openShareReport = () => {
    const shareUrl = buildShareUrl();
    if (!shareUrl) return;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const exportCsv = () => {
    if (!canExport) return;
    const csv = buildReportCsv({
      courses: exportCourses,
      student: student
        ? { full_name: student.full_name, registration_number: student.registration_number }
        : undefined,
      generatedAtIso,
    });
    const reg = student?.registration_number || "student";
    downloadCsv(`edupath-report-${reg}.csv`, csv);
    toast.success("CSV downloaded");
  };

  const exportPdf = async () => {
    if (!canExport) return;
    try {
      const reg = student?.registration_number || "student";
      await downloadReportPdf({
        courses: exportCourses,
        student: student
          ? { full_name: student.full_name, registration_number: student.registration_number }
          : undefined,
        generatedAtIso,
        filename: `edupath-report-${reg}.pdf`,
      });
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not generate PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Your academic snapshot</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gpa-calculator">
            <Button>
              <Calculator className="h-4 w-4 mr-1" /> Open GPA Calculator
            </Button>
          </Link>
        </div>
      </div>

      {student && (
        <div className="glass-strong rounded-2xl p-6 border-l-4 border-primary">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{student.full_name}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Award className="h-3 w-3" /> Reg: {student.registration_number}
                </span>
                {student.enrollment_year && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> Enrolled: {student.enrollment_year}
                  </span>
                )}
                <span className={`font-semibold ${standingToneClass}`}>
                  {stats.academicStanding}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Cumulative GPA"
          value={loading ? "—" : gpa.toFixed(2)}
          muted={loading}
        />
        <StatCard
          icon={Award}
          label="Academic Standing"
          value={loading ? "—" : stats.academicStanding}
          muted={loading}
          className={standingToneClass}
        />
        <StatCard
          icon={BookOpen}
          label="Total Credits"
          value={loading ? "—" : `${credits} / 144`}
          muted={loading}
        />
        <StatCard
          icon={GraduationCap}
          label="UCLAN Progress"
          value={loading ? "—" : `${stats.uclanProgress.percentage}%`}
          muted={loading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="glass-strong rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Mechatronics Progress</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Overall Degree Progress</span>
                <span className="font-semibold">
                  {stats.mechatronicsProgress.earned} / {stats.mechatronicsProgress.total} Cr. Hr.
                </span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-1000"
                  style={{ width: `${stats.mechatronicsProgress.percentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">UCLAN (UK) Integration</span>
                <span className="font-semibold">
                  {stats.uclanProgress.earned} / {stats.uclanProgress.total} Cr. Hr.
                </span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-1000"
                  style={{ width: `${stats.uclanProgress.percentage}%` }}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-2">
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Top Grade</div>
                <div className="text-xl font-bold">{stats.gradeBreakdown.topGrade}</div>
                <div className="text-[10px] text-muted-foreground">
                  {stats.gradeBreakdown.topGradeCount} times
                </div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Fails</div>
                <div className="text-xl font-bold text-destructive">
                  {stats.gradeBreakdown.failCount}
                </div>
                <div className="text-[10px] text-muted-foreground">Needs retake</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Best Term</div>
                <div className="text-xl font-bold">{stats.bestSemester?.semester || "—"}</div>
                <div className="text-[10px] text-muted-foreground">
                  GPA {stats.bestSemester?.gpa.toFixed(2) || "0.00"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-strong rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-1">Advisor Recommendation</h2>
          <p className="text-xs text-muted-foreground mb-4">Based on current performance</p>

          <div className={`glass rounded-xl p-4 border ${toneClass} mb-4`}>
            <div className="text-sm font-semibold">{rec.label}</div>
            <div className="text-xs opacity-80">Suggested next term: {rec.credits}</div>
          </div>

          <h3 className="text-sm font-semibold mb-2 italic text-muted-foreground">Reasoning:</h3>
          <ul className="space-y-2 text-[11px] opacity-90 mb-6">
            {rec.reasons.map((r, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto">
            <div className="glass rounded-xl p-3 text-center mb-2">
              <div className="text-[10px] uppercase text-muted-foreground">Latest Term GPA</div>
              <div className="text-xl font-bold">
                {rec.latestSemesterGpa !== undefined ? rec.latestSemesterGpa.toFixed(2) : "—"}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Refreshed {new Date().toLocaleTimeString()}
            </p>
          </div>
        </section>
      </div>

      <div className="pt-2">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Analytics</h2>
            <p className="text-xs text-muted-foreground">
              Visualize your performance at a glance
              {syncedAtIso ? ` · Synced ${new Date(syncedAtIso).toLocaleString()}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={copyShareLink}
              disabled={!canExport || !student}
              title="Generates a share link that includes your courses (in the URL)."
            >
              <Link2 className="h-4 w-4 mr-1" /> Copy Share Link
            </Button>
            <Button variant="secondary" onClick={openShareReport} disabled={!canExport || !student}>
              <Link2 className="h-4 w-4 mr-1" /> Open Report
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!canExport}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button onClick={exportPdf} disabled={!canExport}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="ghost" onClick={loadCourses} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="glass rounded-xl p-4 border border-amber-400/30 bg-amber-400/10 text-amber-200 text-sm">
            Could not load your courses: {error}
          </div>
        ) : null}

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

      <section className="glass-strong rounded-2xl p-6 mt-6">
        <h2 className="text-lg font-semibold mb-1">GPA Formula & Grading</h2>
        <p className="text-xs text-muted-foreground mb-4">Official letter-grade conversion</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-4">
          {Object.entries(GRADE_POINTS).map(([g, p]) => (
            <div
              key={g}
              className="glass rounded-lg px-2 py-1 flex flex-col items-center justify-center text-center"
            >
              <span className="font-mono font-semibold text-xs">{g}</span>
              <span className="text-[10px] text-muted-foreground">{p.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="glass rounded-xl p-3 font-mono text-[10px] text-center text-muted-foreground">
          GPA = Σ (grade points × credit hours) / Σ (credit hours)
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  muted,
  className,
}: {
  icon: typeof Calculator;
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className={muted ? "animate-pulse" : undefined}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold truncate max-w-[120px] sm:max-w-none ${className}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
