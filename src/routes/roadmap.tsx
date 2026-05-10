import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, Unlock, Flag, Info, Calendar, Compass, Zap, AlertTriangle } from "lucide-react";
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
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
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
      try {
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

        // 2) Fetch academic record with full details
        const { data } = await supabase
          .from("courses")
          .select("*")
          .eq("student_id", idToLoad);

        if (data) setStudentCourses(data);

        const savedPlan = localStorage.getItem(`plan_${idToLoad}`);
        if (savedPlan) setPlannedCourses(JSON.parse(savedPlan));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [studentId, currentStudent, ctxLoading]);

  const roadmap = useMemo(
    () => getCourseRoadmap(studentCourses, plannedCourses),
    [studentCourses, plannedCourses],
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient uppercase tracking-tighter">
            {targetStudent ? `Roadmap: ${targetStudent.name}` : "Academic Roadmap"}
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">
            144-Credit Mechatronics Engineering Cycle (AAST x UCLAN)
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-3 glass p-4 rounded-2xl border-white/10 shadow-lg">
          <LegendItem icon={CheckCircle2} label="Passed" color="text-emerald-400" />
          <LegendItem icon={AlertTriangle} label="Failed" color="text-destructive" />
          <LegendItem icon={Info} label="Withdrawn" color="text-amber-500" />
          <LegendItem icon={Flag} label="Planned" color="text-primary" />
          <LegendItem icon={Unlock} label="Unlocked" color="text-sky-400" />
          <LegendItem icon={Lock} label="Locked" color="text-muted-foreground/20" />
        </div>
      </div>

      <div className="space-y-12 pb-20">
        {SEMESTERS.map((sem) => {
          const coursesInSem = roadmap.filter((c) => c.semester === sem);

          return (
            <section key={sem} className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`h-10 w-10 rounded-full border grid place-items-center shrink-0 ${sem.startsWith("Summer") ? "bg-amber-400/10 border-amber-400/30" : "bg-primary/20 border-primary/30"}`}
                >
                  {sem.startsWith("Summer") ? (
                    <Zap className="h-5 w-5 text-amber-400" />
                  ) : (
                    <Calendar className="h-5 w-5 text-primary" />
                  )}
                </div>
                <h2 className={`text-2xl font-black uppercase tracking-tighter ${sem.startsWith("Summer") ? "text-amber-400" : ""}`}>
                  {sem.startsWith("Conc") ? sem : sem.startsWith("Summer") ? sem : `Semester ${sem}`}
                </h2>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {coursesInSem.length > 0 ? (
                  coursesInSem.map((course, idx) => <RoadmapCard key={`${course.code}-${idx}`} course={course} />)
                ) : (
                  <div className="col-span-full py-10 text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.3em] border-2 border-dashed border-white/5 rounded-[2.5rem] text-center">
                    No subjects assigned to this term
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapCard({ course }: { course: RoadmapCourse }) {
  const isCompleted = course.status === "completed";
  const isFailed = course.status === "failed";
  const isWithdrawn = course.status === "withdrawn";
  const isPlanned = course.status === "planned";
  const isUnlocked = course.status === "unlocked";
  const isLocked = course.status === "locked";

  const borderColor = isCompleted ? "border-emerald-500/40 bg-emerald-500/5" :
                    isFailed ? "border-destructive/40 bg-destructive/5" :
                    isWithdrawn ? "border-amber-500/40 bg-amber-500/5" :
                    isPlanned ? "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]" :
                    isUnlocked ? "border-sky-500/30 bg-sky-500/5" :
                    "border-white/5 opacity-50 grayscale";

  return (
    <div className={`glass-strong rounded-[2rem] p-5 border transition-all duration-500 relative group ${borderColor}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="font-mono text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          {course.code}
        </span>
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        {isFailed && <AlertTriangle className="h-4 w-4 text-destructive" />}
        {isWithdrawn && <Info className="h-4 w-4 text-amber-500" />}
        {isPlanned && <Flag className="h-4 w-4 text-primary" />}
        {isUnlocked && <Unlock className="h-4 w-4 text-sky-400" />}
        {isLocked && <Lock className="h-4 w-4 text-muted-foreground/40" />}
      </div>

      <h3 className="font-black text-sm leading-tight mb-3 line-clamp-2 uppercase tracking-tight">{course.name}</h3>

      <div className="flex items-center gap-2 mt-auto">
        <Badge variant="outline" className="text-[9px] font-black h-5 py-0 border-white/10 uppercase tracking-widest">
          {course.credits} Credits
        </Badge>
        {course.uclan && (
          <Badge className="bg-[#FFC000] text-black text-[8px] font-black h-5 py-0 hover:bg-[#FFC000]">
            UCLAN UK
          </Badge>
        )}
      </div>

      {course.prerequisite && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2">
          <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground italic font-medium leading-tight">
            Prerequisite: {course.prerequisite}
          </p>
        </div>
      )}

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
      <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}
