import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Plus,
  Trash2,
  ArrowRightCircle
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULUM, CURRICULUM_BY_CODE, SEMESTERS } from "@/lib/curriculum";
import { validateDegreePlan, type PlannedCourse, type PrerequisiteViolation } from "@/lib/degree-planner";
import { toast } from "sonner";

export const Route = createFileRoute("/degree-planner")({
  component: DegreePlannerRoute,
});

function DegreePlannerRoute() {
  return (
    <AppShell>
      <DegreePlannerPage />
    </AppShell>
  );
}

function DegreePlannerPage() {
  const { student, loading: ctxLoading } = useAppContext();
  const [completedCodes, setCompletedCodes] = useState<Set<string>>(new Set());
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  // Load completed courses from DB
  useEffect(() => {
    if (ctxLoading || !student) return;

    async function loadData() {
      const { data } = await supabase
        .from("courses")
        .select("course_code")
        .eq("student_id", student.id)
        .not("letter_grade", "eq", "F"); // Only non-failing grades count as completed

      if (data) {
        const codes = new Set(data.map(d => d.course_code).filter(Boolean) as string[]);
        setCompletedCodes(codes);
      }
      
      // Load plan from localStorage
      const savedPlan = localStorage.getItem(`plan_${student.id}`);
      if (savedPlan) {
        setPlannedCourses(JSON.parse(savedPlan));
      }
      
      setLoading(false);
    }

    void loadData();
  }, [student, ctxLoading]);

  // Save plan to localStorage
  useEffect(() => {
    if (student && !loading) {
      localStorage.setItem(`plan_${student.id}`, JSON.stringify(plannedCourses));
    }
  }, [plannedCourses, student, loading]);

  const violations = useMemo(() => 
    validateDegreePlan(completedCodes, plannedCourses), 
    [completedCodes, plannedCourses]
  );

  const violationMap = useMemo(() => {
    const map = new Map<string, PrerequisiteViolation[]>();
    violations.forEach(v => {
      const arr = map.get(v.course_code) || [];
      arr.push(v);
      map.set(v.course_code, arr);
    });
    return map;
  }, [violations]);

  const addToPlan = (course_code: string, semester: string) => {
    if (completedCodes.has(course_code)) {
      toast.error("You have already completed this course.");
      return;
    }
    if (plannedCourses.some(p => p.course_code === course_code)) {
      toast.error("This course is already in your plan.");
      return;
    }
    setPlannedCourses(prev => [...prev, { course_code, semester }]);
    toast.success("Course added to plan");
  };

  const removeFromPlan = (course_code: string) => {
    setPlannedCourses(prev => prev.filter(p => p.course_code !== course_code));
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">Initializing Degree Planner...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Strategic Degree Planner</h1>
          <p className="text-muted-foreground text-sm">
            Map out your future semesters and detect prerequisite conflicts automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            {completedCodes.size} Completed
          </Badge>
          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20">
            {plannedCourses.length} Planned
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Course Catalog / Suggestions */}
        <section className="glass-strong rounded-2xl p-6 h-[80vh] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" /> Available Courses
          </h2>
          <div className="overflow-y-auto space-y-2 pr-2">
            {CURRICULUM.filter(c => !completedCodes.has(c.code) && !plannedCourses.some(p => p.course_code === c.code))
              .map(course => (
                <div key={course.code} className="glass rounded-xl p-3 border border-white/5 hover:border-white/20 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase">{course.code}</div>
                      <div className="font-semibold text-sm truncate">{course.name}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {[5, 6, 7, 8].map(sem => (
                        <button
                          key={sem}
                          onClick={() => addToPlan(course.code, String(sem))}
                          className="h-6 w-6 rounded bg-primary/10 text-primary hover:bg-primary text-[10px] font-bold transition-colors grid place-items-center"
                          title={`Add to Semester ${sem}`}
                        >
                          S{sem}
                        </button>
                      ))}
                    </div>
                  </div>
                  {course.prerequisite && (
                    <div className="mt-2 text-[9px] text-muted-foreground italic flex items-center gap-1">
                      <Info className="h-3 w-3" /> Prereq: {course.prerequisite}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* The Planner Grid */}
        <section className="lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {[5, 6, 7, 8].map(semNum => (
              <SemesterCol 
                key={semNum} 
                sem={String(semNum)} 
                courses={plannedCourses.filter(p => p.semester === String(semNum))}
                violationMap={violationMap}
                onRemove={removeFromPlan}
              />
            ))}
          </div>

          {/* Violations / Summary */}
          <div className="glass-strong rounded-2xl p-6 border-l-4 border-amber-500">
            <h3 className="font-bold flex items-center gap-2 text-amber-500 mb-4">
              <AlertTriangle className="h-5 w-5" /> 
              Prerequisite Conflict Analysis
            </h3>
            {violations.length === 0 ? (
              <div className="flex items-center gap-3 text-emerald-400 bg-emerald-400/5 p-4 rounded-xl border border-emerald-400/20">
                <CheckCircle2 className="h-6 w-6" />
                <div className="text-sm font-medium">Your current degree plan is valid! No prerequisite violations detected.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {violations.map((v, idx) => (
                  <div key={idx} className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5 flex gap-4">
                    <ArrowRightCircle className="h-5 w-5 text-amber-500 shrink-0 mt-1" />
                    <div>
                      <div className="font-bold text-amber-200">{v.course_code} Error</div>
                      <p className="text-xs text-muted-foreground mt-1">{v.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SemesterCol({ 
  sem, 
  courses, 
  violationMap,
  onRemove
}: { 
  sem: string; 
  courses: PlannedCourse[]; 
  violationMap: Map<string, PrerequisiteViolation[]>;
  onRemove: (code: string) => void;
}) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <h3 className="font-bold text-primary flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Semester {sem}
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          {courses.reduce((acc, c) => acc + (CURRICULUM_BY_CODE[c.course_code]?.credits || 0), 0)} Credits
        </Badge>
      </div>

      <div className="flex-1 space-y-2">
        {courses.length === 0 ? (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-[10px] text-muted-foreground uppercase tracking-widest">
            Empty Term
          </div>
        ) : (
          courses.map(plan => {
            const course = CURRICULUM_BY_CODE[plan.course_code];
            const hasViolation = violationMap.has(plan.course_code);
            return (
              <div 
                key={plan.course_code} 
                className={`glass rounded-xl p-3 border transition-all ${
                  hasViolation ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] bg-white/10 px-1 rounded">{plan.course_code}</span>
                      {hasViolation && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="text-xs font-semibold truncate mt-1">{course?.name}</div>
                  </div>
                  <button onClick={() => onRemove(plan.course_code)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
