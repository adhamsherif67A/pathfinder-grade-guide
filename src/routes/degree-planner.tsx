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
  RotateCcw,
  Search,
  BookOpen
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { CURRICULUM, CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { validateDegreePlan, type PlannedCourse, type PrerequisiteViolation } from "@/lib/degree-planner";
import { toast } from "sonner";

export const Route = createFileRoute("/degree-planner")({
  component: DegreePlannerRoute,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      studentId: (search.studentId as string) || undefined,
    };
  },
});

function DegreePlannerRoute() {
  return (
    <AppShell>
      <DegreePlannerPage />
    </AppShell>
  );
}

function DegreePlannerPage() {
  const { student: currentStudent, loading: ctxLoading, refresh } = useAppContext();
  const { studentId } = Route.useSearch();
  
  const [targetStudent, setTargetStudent] = useState<{ id: string, name: string } | null>(null);
  const [passedCodes, setPassedCodes] = useState<Set<string>>(new Set());
  const [enrolledCodes, setEnrolledCodes] = useState<Set<string>>(new Set());
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  
  // UI State
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (ctxLoading) return;
    
    // Determine which ID to act upon
    const idToLoad = studentId || currentStudent?.id;
    
    // If we're an advisor and no studentId was passed, we can't plan
    if (!idToLoad) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        // 1. Resolve Identity
        if (studentId) {
          const { data: sData } = await supabase.from("students").select("full_name").eq("id", studentId).maybeSingle();
          if (sData) setTargetStudent({ id: studentId, name: sData.full_name });
          else setTargetStudent(null);
        } else if (currentStudent) {
          setTargetStudent({ id: currentStudent.id, name: currentStudent.full_name });
        }

        // 2. Fetch Academic Record (Passed + In Progress)
        const { data: courseData } = await supabase
          .from("courses")
          .select("course_code, letter_grade")
          .eq("student_id", idToLoad);

        const passed = new Set<string>();
        const enrolled = new Set<string>();
        
        (courseData || []).forEach(d => {
          const code = (d.course_code || "").trim().toUpperCase();
          if (code) {
            enrolled.add(code);
            if (d.letter_grade !== "F") passed.add(code);
          }
        });
        
        setPassedCodes(passed);
        setEnrolledCodes(enrolled);
        
        // 3. Load Plan
        const savedPlan = localStorage.getItem(`plan_${idToLoad}`);
        if (savedPlan) setPlannedCourses(JSON.parse(savedPlan));
        else setPlannedCourses([]);
        
      } catch (err) {
        console.error("Load Error:", err);
        toast.error("Failed to load student context.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [studentId, currentStudent, ctxLoading]);

  useEffect(() => {
    const idToLoad = studentId || currentStudent?.id;
    if (idToLoad && !loading) {
      localStorage.setItem(`plan_${idToLoad}`, JSON.stringify(plannedCourses));
    }
  }, [plannedCourses, studentId, currentStudent, loading]);

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
      toast.error("Already in GPA record.");
      return;
    }
    if (plannedCourses.some(p => p.course_code === code)) {
      toast.error("Already in plan.");
      return;
    }
    setPlannedCourses(prev => [...prev, { course_code: code, semester }]);
    toast.success(`Subject assigned to Sem ${semester}`);
  };

  const commitTerm = async (semester: string) => {
    const idToLoad = studentId || currentStudent?.id;
    if (!idToLoad) return;
    const termPlanned = plannedCourses.filter(p => p.semester === semester);
    if (termPlanned.length === 0) {
      toast.info("No courses planned for this semester.");
      return;
    }

    const confirm = window.confirm(`Move all ${termPlanned.length} courses from Sem ${semester} to the active GPA records?`);
    if (!confirm) return;

    setIsCommitting(true);
    try {
      const toInsert = termPlanned.map(p => {
        const cur = CURRICULUM_BY_CODE[p.course_code];
        return {
          student_id: idToLoad,
          course_code: p.course_code,
          course_name: cur?.name || p.course_code,
          letter_grade: "A", 
          credit_hours: cur?.credits || 3
        };
      });

      const { error } = await supabase.from("courses").insert(toInsert as never);
      if (error) throw error;

      setPlannedCourses(prev => prev.filter(p => p.semester !== semester));
      setEnrolledCodes(prev => {
        const next = new Set(prev);
        termPlanned.forEach(p => next.add(p.course_code));
        return next;
      });

      toast.success(`Records updated for Sem ${semester}`);
      if (refresh) void refresh();
    } catch (err) {
      toast.error("Failed to update records.");
    } finally {
      setIsCommitting(false);
    }
  };

  const removeFromPlan = (course_code: string) => {
    setPlannedCourses(prev => prev.filter(p => p.course_code !== course_code));
  };

  const resetPlan = () => {
    if (window.confirm("Erase current roadmap? Active GPA records will not be affected.")) {
      setPlannedCourses([]);
      toast.success("Roadmap cleared");
    }
  };

  const filteredCatalog = useMemo(() => {
    return CURRICULUM.filter(c => {
      const code = c.code.toUpperCase();
      const isAlreadyIn = enrolledCodes.has(code) || plannedCourses.some(p => p.course_code === code);
      if (isAlreadyIn) return false;
      if (!searchTerm) return true;
      return c.code.toLowerCase().includes(searchTerm.toLowerCase()) || c.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [enrolledCodes, plannedCourses, searchTerm]);

  if (loading) return <div className="text-center py-20 text-muted-foreground italic animate-pulse">Syncing roadmap data...</div>;

  if (!targetStudent) {
    return (
      <div className="glass-strong rounded-2xl p-12 text-center max-w-2xl mx-auto mt-20">
        <div className="h-16 w-16 bg-primary/10 rounded-full grid place-items-center mx-auto mb-6">
          <Info className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Student Context Required</h2>
        <p className="text-muted-foreground text-sm mb-6">Please select a student from the directory to start planning.</p>
        <Link to="/advisor"><Button>Directory</Button></Link>
      </div>
    );
  }

  const plannerSemesters = ["1", "2", "3", "4", "5", "6", "7", "8", "Conc. 1", "Conc. 2"];

  return (
    <div className="space-y-6 pb-24 md:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl sm:text-3xl font-black text-gradient tracking-tighter uppercase leading-none">
            {studentId ? `Drafting: ${targetStudent.name}` : "Strategic Planner"}
          </h1>
          <Badge variant="outline" className="mt-2 border-primary/20 text-primary uppercase font-black text-[9px] tracking-widest">
            {studentId ? "ADVISOR PLANNING MODE" : "STUDENT STRATEGY MODE"}
          </Badge>
        </div>
        
        <div className="flex w-full sm:w-auto gap-2">
           <Button variant="ghost" onClick={resetPlan} size="sm" className="flex-1 sm:flex-none text-muted-foreground h-11 px-4 rounded-2xl border border-white/5 bg-white/5">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
           </Button>
           <Button variant="outline" onClick={() => setCatalogOpen(true)} size="sm" className="flex-1 sm:flex-none h-11 px-6 rounded-2xl border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground gap-2 font-black uppercase tracking-widest text-[10px]">
              <Plus className="h-4 w-4" /> Add Subjects
           </Button>
        </div>
      </div>

      {/* Floating Add Button for Mobile */}
      <div className="md:hidden fixed bottom-32 right-6 z-[60]">
        <Button 
          size="icon" 
          className="h-16 w-16 rounded-full shadow-2xl shadow-primary/50 border-4 border-white/10 bg-primary text-primary-foreground"
          onClick={() => setCatalogOpen(true)}
        >
          <Plus className="h-8 w-8" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {plannerSemesters.map(semNum => {
            const semPlanned = plannedCourses.filter(p => p.semester === semNum);
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

        <div className={`glass-strong rounded-[2.5rem] p-8 border-l-8 transition-all duration-700 ${violations.length === 0 ? 'border-emerald-500 bg-emerald-500/5' : 'border-amber-500 bg-amber-500/5 shadow-2xl shadow-amber-500/10'}`}>
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-3">
                {violations.length === 0 ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <AlertTriangle className="h-6 w-6 text-amber-500 animate-pulse" />}
                Integrity Engine Results
             </h3>
             <Badge variant="outline" className={`font-black rounded-full px-4 ${violations.length === 0 ? 'text-emerald-500 border-emerald-500/20' : 'text-amber-500 border-amber-500/20'}`}>
                {violations.length} {violations.length === 1 ? 'VIOLATION' : 'VIOLATIONS'}
             </Badge>
          </div>
          
          {violations.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground italic">Your academic forecast aligns with all prerequisite protocols.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {violations.map((v, idx) => (
                <div key={idx} className="glass rounded-[1.5rem] p-5 border border-amber-500/20 bg-black/20 flex gap-4 backdrop-blur-sm">
                  <ArrowRightCircle className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-black text-xs text-amber-200 uppercase tracking-tight mb-1">{v.course_code} PREREQ CONFLICT</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">{v.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-[3rem] h-[85vh] sm:h-[80vh] flex flex-col focus:outline-none shadow-2xl">
          <div className="p-4 sm:p-10 flex flex-col h-full min-h-0">
            <DialogHeader className="mb-8 shrink-0">
               <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-4 text-3xl sm:text-4xl font-black tracking-tighter leading-none">
                     <div className="p-3 rounded-[1.5rem] bg-primary/20"><BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-primary" /></div>
                     Subject Catalog
                  </DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCatalogOpen(false)} className="rounded-full h-12 w-12 bg-white/5">
                     <XCircle className="h-6 w-6 opacity-30" />
                  </Button>
               </div>
               <DialogDescription className="text-[12px] uppercase font-black tracking-[0.2em] opacity-40 mt-3 ml-1 text-primary">
                  Select a subject to enroll <strong>{targetStudent?.name || "Student"}</strong>
               </DialogDescription>
            </DialogHeader>

            <div className="relative mb-8 shrink-0 px-1">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
               <Input 
                  placeholder="Search code or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-16 h-16 rounded-[1.5rem] bg-white/5 border-white/10 text-xl font-bold shadow-2xl focus:ring-4 focus:ring-primary/10 transition-all"
               />
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-5 pr-2 custom-scrollbar pb-32 sm:pb-4 touch-pan-y overscroll-contain">
               {filteredCatalog.map(course => (
                  <div key={course.code} className={`glass-strong rounded-[2.5rem] p-7 border transition-all duration-500 hover:scale-[1.01] ${course.uclan ? 'border-l-[12px] border-l-[#FFC000]' : 'border-white/10'}`}>
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-3">
                           <span className="font-mono text-sm text-primary font-black uppercase tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-xl">{course.code}</span>
                           {course.uclan && <Badge className="bg-[#FFC000] text-black text-[10px] h-6 border-none font-black px-3 rounded-full">UK DUAL CERTIFIED</Badge>}
                        </div>
                        <h4 className="font-black text-xl sm:text-2xl leading-none tracking-tighter mb-3">{course.name}</h4>
                        <div className="flex flex-wrap gap-2">
                           <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest opacity-60">{course.credits} Credits</span>
                           <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black uppercase tracking-widest opacity-60">Origin: Sem {course.semester}</span>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-40 ml-1">Assign to Term:</div>
                       <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2.5">
                          {plannerSemesters.map(sem => (
                            <Button
                              key={sem}
                              size="sm"
                              variant="outline"
                              className="h-11 min-w-[80px] px-4 rounded-[1rem] text-[11px] font-black border-white/10 bg-white/5 hover:bg-primary hover:text-primary-foreground hover:border-none transition-all active:scale-90"
                              onClick={() => addToPlan(course.code, sem)}
                            >
                              Sem {sem}
                            </Button>
                          ))}
                       </div>
                    </div>
                  </div>
               ))}
            </div>
            
            <div className="sm:hidden fixed bottom-6 left-6 right-6 z-[70]">
               <Button className="w-full h-16 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-black text-sm uppercase tracking-widest border-2 border-white/20 bg-background/80 backdrop-blur-3xl" onClick={() => setCatalogOpen(false)}>
                  Close Catalog
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
    <div className={`glass-strong rounded-[2rem] p-6 flex flex-col h-full min-h-[200px] border transition-all duration-700 ${isRecommended ? 'border-primary shadow-[0_0_50px_rgba(var(--color-primary-rgb),0.2)] scale-[1.02] z-10 bg-primary/[0.02]' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <h3 className={`font-black uppercase tracking-widest text-xs flex items-center gap-3 ${isRecommended ? 'text-primary' : 'text-foreground/40'}`}>
          <Calendar className="h-4 w-4" /> Sem {sem}
          {isRecommended && <Badge className="text-[8px] h-4 px-2 bg-primary text-primary-foreground border-none font-black uppercase">Active</Badge>}
        </h3>
        <div className="text-[11px] font-black text-primary bg-primary/10 px-3 py-1 rounded-xl">
          {courses.reduce((acc, c) => acc + (CURRICULUM_BY_CODE[c.course_code.toUpperCase()]?.credits || 0), 0)} CR
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {courses.length === 0 ? (
          <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-[1.5rem] text-[10px] text-muted-foreground/20 uppercase tracking-[0.3em] font-black text-center px-4">
            No Forecasted Subjects
          </div>
        ) : (
          courses.map(plan => {
            const course = CURRICULUM_BY_CODE[plan.course_code.toUpperCase()];
            const hasViolation = violationMap.has(plan.course_code.toUpperCase());
            return (
              <div 
                key={plan.course_code} 
                className={`glass-strong rounded-[1.5rem] p-5 border transition-all duration-300 ${
                  plan.isCompleted ? 'border-emerald-500/20 bg-emerald-500/[0.02] opacity-50 grayscale-[0.8]' :
                  hasViolation ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-black text-primary">{plan.course_code}</span>
                      {plan.isCompleted ? (
                        <Badge className="text-[8px] h-4 px-2 bg-emerald-500/20 text-emerald-400 border-none font-black uppercase">PASSED</Badge>
                      ) : hasViolation ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : null}
                    </div>
                    <div className="text-[13px] font-bold truncate mt-2 tracking-tight">{course?.name}</div>
                  </div>
                  {!plan.isCompleted && (
                    <Button
                      variant="ghost" 
                      size="icon"
                      onClick={() => onRemove(plan.course_code)} 
                      className="h-8 w-8 text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 rounded-xl -mt-1 -mr-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
          className="mt-8 w-full h-12 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest gap-3 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-xl shadow-primary/10"
          onClick={() => onCommit(sem)}
        >
          <ArrowRightCircle className="h-5 w-5" /> Enroll Term
        </Button>
      )}
    </div>
  );
}
