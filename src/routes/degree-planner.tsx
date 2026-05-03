import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Plus,
  Trash2,
  ArrowRightCircle,
  RotateCcw
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULUM, CURRICULUM_BY_CODE } from "@/lib/curriculum";
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
  const { student, loading: ctxLoading, refresh } = useAppContext();
  const [passedCodes, setPassedCodes] = useState<Set<string>>(new Set());
  const [enrolledCodes, setEnrolledCodes] = useState<Set<string>>(new Set());
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (ctxLoading) return;
    if (!student) { setLoading(false); return; }

    async function loadData() {
      try {
        const { data } = await supabase
          .from("courses")
          .select("course_code, letter_grade")
          .eq("student_id", student.id);

        if (data) {
          const passed = new Set<string>();
          const enrolled = new Set<string>();
          data.forEach(d => {
            const code = (d.course_code || "").trim().toUpperCase();
            if (code) {
              enrolled.add(code);
              if (d.letter_grade !== "F") passed.add(code);
            }
          });
          setPassedCodes(passed);
          setEnrolledCodes(enrolled);
        }
        
        const savedPlan = localStorage.getItem(`plan_${student.id}`);
        if (savedPlan) setPlannedCourses(JSON.parse(savedPlan));
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [student, ctxLoading]);

  useEffect(() => {
    if (student && !loading) {
      localStorage.setItem(`plan_${student.id}`, JSON.stringify(plannedCourses));
    }
  }, [plannedCourses, student, loading]);

  const violations = useMemo(() => 
    validateDegreePlan(passedCodes, plannedCourses), 
    [passedCodes, plannedCourses]
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

  const nextSemesterToPlan = useMemo(() => {
    const completedSems = new Set<string>();
    enrolledCodes.forEach(code => {
      const sem = CURRICULUM_BY_CODE[code]?.semester;
      if (sem) completedSems.add(sem);
    });
    for (const sem of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      if (!completedSems.has(sem)) return sem;
    }
    return "Conc. 1";
  }, [enrolledCodes]);

  const addToPlan = (course_code: string, semester: string) => {
    const code = course_code.trim().toUpperCase();
    if (enrolledCodes.has(code)) {
      toast.error("This course is already in your GPA Calculator.");
      return;
    }
    if (plannedCourses.some(p => p.course_code === code)) {
      toast.error("This course is already in your plan.");
      return;
    }
    setPlannedCourses(prev => [...prev, { course_code: code, semester }]);
    toast.success(`Added to Sem ${semester}`);
  };

  const commitTerm = async (semester: string) => {
    if (!student) return;
    const termPlanned = plannedCourses.filter(p => p.semester === semester);
    if (termPlanned.length === 0) {
      toast.info("No courses planned for this semester to commit.");
      return;
    }

    const confirm = window.confirm(`Move all ${termPlanned.length} courses from Sem ${semester} to your GPA Calculator?`);
    if (!confirm) return;

    setIsCommitting(true);
    try {
      const toInsert = termPlanned.map(p => {
        const cur = CURRICULUM_BY_CODE[p.course_code];
        return {
          student_id: student.id,
          course_code: p.course_code,
          course_name: cur?.name || p.course_code,
          letter_grade: "A", // Default to A
          credit_hours: cur?.credits || 3
        };
      });

      const { error } = await supabase.from("courses").insert(toInsert as never);
      if (error) throw error;

      // Remove from plan
      setPlannedCourses(prev => prev.filter(p => p.semester !== semester));
      
      // Update local enrolled set to prevent re-adding
      setEnrolledCodes(prev => {
        const next = new Set(prev);
        termPlanned.forEach(p => next.add(p.course_code));
        return next;
      });

      toast.success(`Semester ${semester} committed to Calculator!`);
      if (refresh) void refresh();
    } catch (err) {
      toast.error("Failed to commit semester.");
    } finally {
      setIsCommitting(false);
    }
  };

  const removeFromPlan = (course_code: string) => {
    setPlannedCourses(prev => prev.filter(p => p.course_code !== course_code));
  };

  const resetPlan = () => {
    setPlannedCourses([]);
    toast.success("Planner cleared");
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground italic">Syncing Academic Record...</div>;

  if (!student) {
    return (
      <div className="glass-strong rounded-2xl p-12 text-center max-w-2xl mx-auto mt-20">
        <div className="h-16 w-16 bg-primary/10 rounded-full grid place-items-center mx-auto mb-6">
          <Info className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Student Profile Required</h2>
        <p className="text-muted-foreground text-sm mb-6">
          The Degree Planner helps students map their curriculum journey. 
          As an advisor, you can view this tool on individual student profiles soon.
        </p>
        <Link to="/advisor">
          <Button>Go to Student Directory</Button>
        </Link>
      </div>
    );
  }

  const plannerSemesters = ["1", "2", "3", "4", "5", "6", "7", "8", "Conc. 1", "Conc. 2"];

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
          <Button variant="ghost" size="sm" onClick={resetPlan} className="text-muted-foreground hover:text-destructive">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset Plan
          </Button>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            {passedCodes.size} Passed
          </Badge>
          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20">
            {plannedCourses.length} Planned
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Course Catalog */}
        <section className="glass-strong rounded-2xl p-6 h-[80vh] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
            <Plus className="h-5 w-5" /> Available Courses
          </h2>
          <div className="overflow-y-auto space-y-2 pr-2">
            {CURRICULUM.filter(c => !enrolledCodes.has(c.code.toUpperCase()) && !plannedCourses.some(p => p.course_code === c.code.toUpperCase()))
              .map(course => {
                const isNextSem = course.semester === nextSemesterToPlan;
                return (
                  <div key={course.code} className={`glass rounded-xl p-3 border transition-all group ${isNextSem ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-white/5 hover:border-white/20'}`}>
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[10px] text-muted-foreground uppercase">{course.code}</div>
                          {isNextSem && <Badge className="text-[8px] h-3 px-1 uppercase bg-primary text-primary-foreground">Next Sem</Badge>}
                        </div>
                        <div className="font-semibold text-sm truncate">{course.name}</div>
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto pb-1">
                      <div className="flex gap-1">
                        {plannerSemesters.map(sem => (
                          <button
                            key={sem}
                            onClick={() => addToPlan(course.code, sem)}
                            className={`h-7 px-2 shrink-0 rounded text-[9px] font-bold transition-colors ${
                              sem === course.semester 
                                ? 'bg-primary/20 text-primary border border-primary/30' 
                                : 'bg-white/5 text-muted-foreground hover:bg-primary hover:text-primary-foreground'
                            }`}
                          >
                            S{sem}
                          </button>
                        ))}
                      </div>
                    </div>
                    {course.prerequisite && (
                      <div className="mt-2 text-[9px] text-muted-foreground italic flex items-center gap-1 opacity-60">
                        <Info className="h-3 w-3 shrink-0" /> Prereq: {course.prerequisite}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>

        {/* Planner Grid */}
        <section className="space-y-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {plannerSemesters.map(semNum => {
              const semPlanned = plannedCourses.filter(p => p.semester === semNum);
              // Find passed courses that belong to this semester
              const semCompleted = CURRICULUM.filter(c => 
                c.semester === semNum && 
                passedCodes.has(c.code.toUpperCase())
              ).map(c => ({ course_code: c.code, isCompleted: true }));

              return (
                <SemesterCol 
                  key={semNum} 
                  sem={semNum} 
                  courses={[...semCompleted, ...semPlanned.map(p => ({ ...p, isCompleted: false }))]}
                  violationMap={violationMap}
                  onRemove={removeFromPlan}
                  onCommit={commitTerm}
                  isRecommended={semNum === nextSemesterToPlan}
                />
              );
            })}
          </div>

          {/* Violations Summary */}
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
                      <div className="font-bold text-amber-200">{v.course_code} Conflict</div>
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
  onRemove,
  onCommit,
  isRecommended
}: { 
  sem: string; 
  courses: (PlannedCourse & { isCompleted: boolean })[]; 
  violationMap: Map<string, PrerequisiteViolation[]>;
  onRemove: (code: string) => void;
  onCommit: (sem: string) => void;
  isRecommended?: boolean;
}) {
  return (
    <div className={`glass-strong rounded-2xl p-5 flex flex-col h-full min-h-[180px] border transition-all duration-500 ${isRecommended ? 'border-primary/50 shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.1)] scale-[1.02] z-10' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
        <h3 className={`font-bold flex items-center gap-2 ${isRecommended ? 'text-primary' : 'text-foreground/80'}`}>
          <Calendar className="h-4 w-4" /> Sem {sem}
          {isRecommended && <Badge className="text-[7px] h-3 px-1 bg-primary text-primary-foreground">Next</Badge>}
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          {courses.reduce((acc, c) => acc + (CURRICULUM_BY_CODE[c.course_code.toUpperCase()]?.credits || 0), 0)} Cr
        </Badge>
      </div>

      <div className="flex-1 space-y-2">
        {courses.length === 0 ? (
          <div className="h-full min-h-[60px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-[10px] text-muted-foreground uppercase tracking-widest">
            No courses
          </div>
        ) : (
          courses.map(plan => {
            const course = CURRICULUM_BY_CODE[plan.course_code.toUpperCase()];
            const hasViolation = violationMap.has(plan.course_code.toUpperCase());
            return (
              <div 
                key={plan.course_code} 
                className={`glass rounded-xl p-3 border transition-all ${
                  plan.isCompleted ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80' :
                  hasViolation ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] bg-white/10 px-1 rounded">{plan.course_code}</span>
                      {plan.isCompleted ? (
                        <Badge className="text-[7px] h-3 px-1 bg-emerald-500/20 text-emerald-400 border-none">Passed</Badge>
                      ) : hasViolation ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : null}
                    </div>
                    <div className="text-xs font-semibold truncate mt-1">{course?.name}</div>
                  </div>
                  {!plan.isCompleted && (
                    <button onClick={() => onRemove(plan.course_code)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!courses.every(c => c.isCompleted) && courses.some(c => !c.isCompleted) && (
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 w-full h-8 text-[10px] gap-2 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all"
          onClick={() => onCommit(sem)}
        >
          <ArrowRightCircle className="h-3 w-3" /> Enroll Planned Courses
        </Button>
      )}
    </div>
  );
}
