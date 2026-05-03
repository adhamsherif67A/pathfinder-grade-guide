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
  DialogTrigger,
} from "@/components/ui/dialog";
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
  
  // UI State
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
    if (window.confirm("Clear your entire future plan? Your actual GPA record will not be affected.")) {
      setPlannedCourses([]);
      toast.success("Planner cleared");
    }
  };

  const filteredCatalog = useMemo(() => {
    return CURRICULUM.filter(c => {
      const isAlreadyIn = enrolledCodes.has(c.code.toUpperCase()) || plannedCourses.some(p => p.course_code === c.code.toUpperCase());
      if (isAlreadyIn) return false;
      if (!searchTerm) return true;
      return c.code.toLowerCase().includes(searchTerm.toLowerCase()) || c.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [enrolledCodes, plannedCourses, searchTerm]);

  if (loading) return <div className="text-center py-20 text-muted-foreground italic">Syncing Academic Record...</div>;

  if (!student) {
    return (
      <div className="glass-strong rounded-2xl p-12 text-center max-w-2xl mx-auto mt-20">
        <div className="h-16 w-16 bg-primary/10 rounded-full grid place-items-center mx-auto mb-6">
          <Info className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Student Profile Required</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Advisors can view roadmaps from the Student Directory.
        </p>
        <Link to="/advisor">
          <Button>Go to Student Directory</Button>
        </Link>
      </div>
    );
  }

  const plannerSemesters = ["1", "2", "3", "4", "5", "6", "7", "8", "Conc. 1", "Conc. 2"];

  return (
    <div className="space-y-6 pb-24 md:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Strategic Planner</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Map your future semesters and detect conflicts</p>
        </div>
        
        <div className="flex w-full sm:w-auto gap-2">
           <Button variant="ghost" onClick={resetPlan} size="sm" className="flex-1 sm:flex-none text-muted-foreground h-11 px-4 rounded-xl">
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
           </Button>
           <Button variant="outline" onClick={() => setCatalogOpen(true)} size="sm" className="flex-1 sm:flex-none h-11 px-6 rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground gap-2 font-bold">
              <Plus className="h-4 w-4" /> Add Courses
           </Button>
        </div>
      </div>

      {/* Floating Add Button for Mobile */}
      <div className="md:hidden fixed bottom-24 right-6 z-50">
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-2xl shadow-primary/40 border-2 border-white/20"
          onClick={() => setCatalogOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

        {/* Conflict Analysis Bar */}
        <div className={`glass-strong rounded-3xl p-6 border-l-4 transition-all duration-500 ${violations.length === 0 ? 'border-emerald-500' : 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.1)]'}`}>
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-black uppercase tracking-tighter flex items-center gap-2">
                {violations.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                Academic Integrity Check
             </h3>
             <Badge variant="outline" className={violations.length === 0 ? 'text-emerald-500' : 'text-amber-500'}>
                {violations.length} {violations.length === 1 ? 'Conflict' : 'Conflicts'} Found
             </Badge>
          </div>
          
          {violations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Your current degree path is mathematically valid and respects all prerequisites.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {violations.map((v, idx) => (
                <div key={idx} className="glass rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 flex gap-4">
                  <ArrowRightCircle className="h-5 w-5 text-amber-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-bold text-xs text-amber-200">{v.course_code} PREREQUISITE ERROR</div>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{v.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Catalog Dialog - Optimized for Mobile */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-3xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-3xl h-full sm:h-auto">
          <div className="p-4 sm:p-6 h-full flex flex-col">
            <DialogHeader className="mb-6">
               <DialogTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-2xl bg-primary/20"><BookOpen className="h-6 w-6 text-primary" /></div>
                  Subject Discovery
               </DialogTitle>
            </DialogHeader>

            <div className="relative mb-6">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
               <Input 
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-white/5 border-white/10 text-lg shadow-inner"
               />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-16 sm:pb-0">
               {filteredCatalog.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground animate-in fade-in zoom-in-95">
                     <Search className="h-12 w-12 mx-auto mb-4 opacity-10" />
                     <p>No available courses match your search.</p>
                  </div>
               )}
               {filteredCatalog.map(course => (
                  <div key={course.code} className={`glass-strong rounded-3xl p-5 border transition-all ${course.uclan ? 'border-l-4 border-l-[#FFC000]' : 'border-white/5'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="font-mono text-[10px] text-primary font-black uppercase tracking-widest">{course.code}</span>
                           {course.uclan && <Badge className="bg-[#FFC000] text-black text-[7px] h-3.5 border-none font-black uppercase">UCLAN (UK)</Badge>}
                        </div>
                        <h4 className="font-bold text-base leading-tight">{course.name}</h4>
                        <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                           <span className="px-2 py-0.5 rounded-full bg-white/5">{course.credits} Credits</span>
                           <span className="px-2 py-0.5 rounded-full bg-white/5">Semester {course.semester}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                       {plannerSemesters.map(sem => (
                         <Button
                           key={sem}
                           size="sm"
                           variant="outline"
                           className="h-9 rounded-xl text-[10px] font-black border-white/5 hover:bg-primary hover:text-primary-foreground hover:border-none transition-all"
                           onClick={() => addToPlan(course.code, sem)}
                         >
                           S{sem}
                         </Button>
                       ))}
                    </div>
                  </div>
               ))}
            </div>
            
            <div className="sm:hidden absolute bottom-4 left-4 right-4">
               <Button className="w-full h-14 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest" onClick={() => setCatalogOpen(false)}>Close Catalog</Button>
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
    <div className={`glass-strong rounded-3xl p-5 flex flex-col h-full min-h-[180px] border transition-all duration-500 ${isRecommended ? 'border-primary shadow-[0_0_40px_rgba(var(--color-primary-rgb),0.15)] scale-[1.02] z-10' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
        <h3 className={`font-black uppercase tracking-tighter flex items-center gap-2 ${isRecommended ? 'text-primary' : 'text-foreground/60'}`}>
          <Calendar className="h-4 w-4" /> Sem {sem}
          {isRecommended && <Badge className="text-[7px] h-3.5 px-1 bg-primary text-primary-foreground border-none">Active</Badge>}
        </h3>
        <div className="text-[10px] font-black text-muted-foreground bg-white/5 px-2 py-0.5 rounded-lg">
          {courses.reduce((acc, c) => acc + (CURRICULUM_BY_CODE[c.course_code.toUpperCase()]?.credits || 0), 0)} CR
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {courses.length === 0 ? (
          <div className="h-full min-h-[80px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-[9px] text-muted-foreground/30 uppercase tracking-[0.2em] font-black">
            Empty Slot
          </div>
        ) : (
          courses.map(plan => {
            const course = CURRICULUM_BY_CODE[plan.course_code.toUpperCase()];
            const hasViolation = violationMap.has(plan.course_code.toUpperCase());
            return (
              <div 
                key={plan.course_code} 
                className={`glass-strong rounded-2xl p-4 border transition-all ${
                  plan.isCompleted ? 'border-emerald-500/20 bg-emerald-500/5 opacity-60 grayscale-[0.5]' :
                  hasViolation ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-black text-primary/80">{plan.course_code}</span>
                      {plan.isCompleted ? (
                        <Badge className="text-[7px] h-3.5 px-1.5 bg-emerald-500/20 text-emerald-400 border-none font-bold">PASSED</Badge>
                      ) : hasViolation ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ) : null}
                    </div>
                    <div className="text-xs font-bold truncate mt-1 leading-tight">{course?.name}</div>
                  </div>
                  {!plan.isCompleted && (
                    <Button
                      variant="ghost" 
                      size="icon"
                      onClick={() => onRemove(plan.course_code)} 
                      className="h-7 w-7 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-lg -mt-1 -mr-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
          className="mt-6 w-full h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all shadow-lg"
          onClick={() => onCommit(sem)}
        >
          <ArrowRightCircle className="h-4 w-4" /> Enroll Semester
        </Button>
      )}
    </div>
  );
}
