import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { calculateGPA, GRADE_OPTIONS } from "@/lib/gpa";

export type DashboardCourseRow = {
  course_code: string | null;
  course_name?: string | null;
  letter_grade: string;
  credit_hours: number;
};

function semesterSortKey(sem: string) {
  if (sem === "Other") return 999;
  const conc = sem.match(/^Conc\.\s*(\d+)$/i);
  if (conc) return 900 + Number(conc[1] || 0);
  const n = Number(sem);
  if (Number.isFinite(n)) return n;
  return 950;
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-strong rounded-2xl p-6">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function tooltipStyle(): React.CSSProperties {
  return {
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    borderRadius: 14,
    padding: "10px 12px",
    boxShadow: "var(--shadow-glass)",
  };
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="glass rounded-xl p-6 text-sm text-muted-foreground text-center">{label}</div>
  );
}

export function DashboardCharts({ courses }: { courses: DashboardCourseRow[] }) {
  const bySemester = useMemo(() => {
    const groups = new Map<string, DashboardCourseRow[]>();

    for (const c of courses) {
      const code = (c.course_code || "").trim();
      const sem =
        code && CURRICULUM_BY_CODE[code]?.semester ? CURRICULUM_BY_CODE[code]!.semester : "Other";
      const arr = groups.get(sem) || [];
      arr.push(c);
      groups.set(sem, arr);
    }

    return [...groups.entries()]
      .map(([semester, items]) => {
        const r = calculateGPA(items);
        return {
          semester,
          gpa: Number(r.gpa.toFixed(2)),
          credits: r.totalCredits,
        };
      })
      .sort((a, b) => semesterSortKey(a.semester) - semesterSortKey(b.semester));
  }, [courses]);

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(GRADE_OPTIONS.map((g) => [g, 0]));
    for (const c of courses) {
      if (counts[c.letter_grade] === undefined) continue;
      counts[c.letter_grade] += 1;
    }
    return GRADE_OPTIONS.map((g) => ({ grade: g, count: counts[g] || 0 }));
  }, [courses]);

  const creditsBySemester = useMemo(() => {
    return bySemester.map((s) => ({ semester: s.semester, credits: s.credits }));
  }, [bySemester]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <ChartShell
        title="GPA Trend"
        subtitle="Weighted GPA per semester (based on curriculum codes)"
      >
        {bySemester.length === 0 ? (
          <EmptyState label="Add some courses in the GPA Calculator to see your GPA trend." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bySemester} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }} />
                <YAxis
                  domain={[0, 4]}
                  tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }}
                  tickCount={5}
                />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  labelStyle={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }}
                  itemStyle={{ color: "rgba(255,255,255,0.92)" }}
                  formatter={(value: number, name: string) => {
                    if (name === "gpa") return [value, "GPA"];
                    if (name === "credits") return [value, "Credits"];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,0.70)", fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="gpa"
                  name="GPA"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-primary)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Courses without a recognized curriculum code are grouped under “Other”.
        </p>
      </ChartShell>

      <ChartShell title="Grade Distribution" subtitle="Count of saved courses by letter grade">
        {courses.length === 0 ? (
          <EmptyState label="No saved courses yet." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                <XAxis dataKey="grade" tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  labelStyle={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }}
                  itemStyle={{ color: "rgba(255,255,255,0.92)" }}
                  formatter={(value: number) => [value, "Courses"]}
                />
                <Bar
                  dataKey="count"
                  name="Courses"
                  fill="var(--color-accent)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartShell>

      <ChartShell title="Credits by Semester" subtitle="Total credit hours saved per semester">
        {creditsBySemester.length === 0 ? (
          <EmptyState label="No saved courses yet." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creditsBySemester} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                <XAxis dataKey="semester" tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.70)", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  labelStyle={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }}
                  itemStyle={{ color: "rgba(255,255,255,0.92)" }}
                  formatter={(value: number) => [value, "Credits"]}
                />
                <Bar
                  dataKey="credits"
                  name="Credits"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartShell>

      <section className="glass-strong rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quick Insights</h3>
          <p className="text-xs text-muted-foreground mt-1">Useful summaries</p>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <span className="text-muted-foreground">Tracked semesters</span>
            <span className="font-semibold">{bySemester.length}</span>
          </div>
          <div className="glass rounded-xl p-4 flex items-center justify-between">
            <span className="text-muted-foreground">Total courses</span>
            <span className="font-semibold">{courses.length}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
