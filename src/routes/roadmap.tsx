import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, Unlock, Flag, Info, Calendar, Compass } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { SEMESTERS } from "@/lib/curriculum";
import { getCourseRoadmap, type PlannedCourse, type RoadmapCourse } from "@/lib/degree-planner";

export const Route = createFileRoute("/roadmap")({
  component: RoadmapRoute,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      studentId: (search.studentId as string) || undefined,
    };
  },
});

function RoadmapRoute() {
  return (
    <AppShell>
      <RoadmapPage />
    </AppShell>
  );
}

function RoadmapPage() {
  const { student: currentStudent, loading: ctxLoading } = useAppContext();
  const { studentId } = Route.useSearch();

  const [targetStudent, setTargetStudent] = useState<{ id: string; name: string } | null>(null);
  const [passedCodes, setPassedCodes] = useState<Set<string>>(new Set());
  const [enrolledCodes, setEnrolledCodes] = useState<Set<string>>(new Set());
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;

    const idToLoad = studentId || currentStudent?.id;
    if (!idToLoad) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      // 1) Fetch student name if it's an external ID
      if (studentId) {
        const { data: sData } = await supabase
          .from("students")
          .select("full_name")
          .eq("id", studentId)
          .maybeSingle();
        if (sData) setTargetStudent({ id: studentId, name: sData.full_name });
      } else if (currentStudent) {
        setTargetStudent({ id: currentStudent.id, name: currentStudent.full_name });
      }

      // 2) Fetch academic record
      const { data } = await supabase
        .from("courses")
        .select("course_code, letter_grade")
        .eq("student_id", idToLoad);

      if (data) {
        const passed = new Set<string>();
        const enrolled = new Set<string>();
        data.forEach((d) => {
          const code = (d.course_code || "").trim().toUpperCase();
          if (code) {
            enrolled.add(code);
            if (d.letter_grade !== "F") passed.add(code);
          }
        });
        setPassedCodes(passed);
        setEnrolledCodes(enrolled);
      }

      const savedPlan = localStorage.getItem(`plan_${idToLoad}`);
      if (savedPlan) setPlannedCourses(JSON.parse(savedPlan));
      setLoading(false);
    }

    void loadData();
  }, [studentId, currentStudent, ctxLoading]);

  const roadmap = useMemo(
    () => getCourseRoadmap(passedCodes, enrolledCodes, plannedCourses),
    [passedCodes, enrolledCodes, plannedCourses],
  );

  if (loading)
    return (
      <div className="text-center py-20 text-muted-foreground italic">
        Generating Visual Roadmap...
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
            {targetStudent ? `Roadmap: ${targetStudent.name}` : "Academic Roadmap"}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Visualizing the 144-credit Mechatronics journey (AAST x UCLAN)
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-3 glass p-4 rounded-2xl border-white/10 shadow-lg">
          <LegendItem icon={CheckCircle2} label="Passed" color="text-emerald-400" />
          <LegendItem icon={Compass} label="Enrolled" color="text-amber-400" />
          <LegendItem icon={Flag} label="Planned" color="text-primary" />
          <LegendItem icon={Unlock} label="Unlocked" color="text-sky-400" />
          <LegendItem icon={Lock} label="Locked" color="text-muted-foreground/40" />
        </div>
      </div>

      <div className="space-y-12 pb-20">
        {SEMESTERS.map((sem) => (
          <section key={sem} className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 grid place-items-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {sem.startsWith("Conc") ? sem : `Semester ${sem}`}
              </h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {roadmap
                .filter((c) => c.semester === sem)
                .map((course) => (
                  <RoadmapCard key={course.code} course={course} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function RoadmapCard({ course }: { course: RoadmapCourse }) {
  const isCompleted = course.status === "completed";
  const isEnrolled = course.status === "enrolled";
  const isPlanned = course.status === "planned";
  const isUnlocked = course.status === "unlocked";
  const isLocked = course.status === "locked";

  return (
    <div
      className={`glass-strong rounded-2xl p-4 border transition-all duration-500 relative group ${
        isCompleted
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isEnrolled
            ? "border-amber-500/40 bg-amber-500/5"
            : isPlanned
              ? "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]"
              : isUnlocked
                ? "border-sky-500/30 bg-sky-500/5"
                : "border-white/5 opacity-50 grayscale"
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          {course.code}
        </span>
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {isEnrolled && <Compass className="h-4 w-4 text-amber-400" />}
        {isPlanned && <Flag className="h-4 w-4 text-primary" />}
        {isUnlocked && <Unlock className="h-4 w-4 text-sky-400" />}
        {isLocked && <Lock className="h-4 w-4 text-muted-foreground/40" />}
      </div>

      <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-2">{course.name}</h3>

      <div className="flex items-center gap-2 mt-auto">
        <Badge variant="outline" className="text-[9px] h-4 py-0 border-white/10">
          {course.credits} Cr
        </Badge>
        {course.uclan && (
          <Badge className="bg-[#FFC000] text-black text-[8px] h-4 py-0 hover:bg-[#FFC000]">
            UCLAN
          </Badge>
        )}
      </div>

      {course.prerequisite && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2">
          <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground italic leading-tight">
            Req: {course.prerequisite}
          </p>
        </div>
      )}

      {/* Decorative pulse for planned */}
      {isPlanned && (
        <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-ping opacity-75" />
      )}
    </div>
  );
}

function LegendItem({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
