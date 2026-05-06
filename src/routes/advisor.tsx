import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Users,
  Search,
  TrendingDown,
  CheckCircle,
  User,
  MessageSquareWarning,
  Trash2,
  Settings,
  GraduationCap,
  ClipboardCheck,
  XCircle,
  PlusCircle,
  Compass,
  BookOpen,
  Calendar,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateGPA, GRADE_OPTIONS } from "@/lib/gpa";
import { calculateStudentStats, type StudentStats } from "@/lib/student-stats";
import { CURRICULUM, SEMESTERS } from "@/lib/curriculum";

export const Route = createFileRoute("/advisor")({
  component: AdvisorRoute,
});

type StudentRosterItem = {
  id: string;
  full_name: string;
  registration_number: string;
  enrollment_year: number | null;
  gpa: number;
  credits: number;
  status: "at-risk" | "warning" | "stable" | "honor";
  stats: StudentStats;
  courses: any[];
};

function AdvisorRoute() {
  const { role } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (role && role !== "advisor") {
      toast.error("Access denied. Advisor role required.");
      navigate({ to: "/dashboard" });
    }
  }, [role, navigate]);

  return (
    <AppShell>
      <AdvisorDashboard />
    </AppShell>
  );
}

function AdvisorDashboard() {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "at-risk" | "honor" | "graduating">("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);

  // Curriculum Catalog State
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [catFilterSem, setCatFilterSem] = useState("all");

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[Advisor] Fetching student roster...");
      // 1. Get all students
      const { data: sData, error: sErr } = await supabase
        .from("students")
        .select("*")
        .order("full_name", { ascending: true });

      if (sErr) throw sErr;
      console.log(`[Advisor] Found ${sData?.length || 0} students.`);

      // 2. Get all courses
      const { data: cData, error: cErr } = await supabase
        .from("courses")
        .select("*");

      if (cErr) throw cErr;
      console.log(`[Advisor] Found ${cData?.length || 0} total course records.`);

      const roster: StudentRosterItem[] = (sData || []).map(s => {
        // Defensive: ensure id is treated as string
        const studentId = String(s.id);
        const sCourses = (cData || []).filter(c => String(c.student_id) === studentId);
        
        const gpaRes = calculateGPA(sCourses.map(c => ({
          letter_grade: c.letter_grade || "F",
          credit_hours: Number(c.credit_hours) || 0
        })));

        const sStats = calculateStudentStats(
          sCourses.map(c => ({
            course_code: c.course_code || "UNK",
            letter_grade: c.letter_grade || "F",
            credit_hours: Number(c.credit_hours) || 0
          })),
          gpaRes.gpa
        );

        let sStatus: StudentRosterItem["status"] = "stable";
        if (gpaRes.gpa < 2.0) sStatus = "at-risk";
        else if (gpaRes.gpa < 2.5) sStatus = "warning";
        else if (gpaRes.gpa >= 3.6) sStatus = "honor";

        return {
          id: studentId,
          full_name: s.full_name || "Unknown Student",
          registration_number: s.registration_number || "00000000",
          enrollment_year: s.enrollment_year,
          gpa: gpaRes.gpa,
          credits: gpaRes.totalCredits,
          status: sStatus,
          stats: sStats,
          courses: sCourses
        };
      });

      setStudents(roster);
    } catch (err) {
      console.error("[Advisor] Roster Load Error:", err);
      toast.error("Roster synchronization failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch = s.full_name.toLowerCase().includes(q) || s.registration_number.includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "at-risk" && s.status === "at-risk") ||
        (filter === "graduating" && s.stats.graduationAudit.isReady) ||
        (filter === "honor" && s.status === "honor");
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  const enrollFromCatalog = async (c: typeof CURRICULUM[0]) => {
    if (!selectedStudent) return;
    try {
      const { error } = await supabase.from("courses").insert({
        student_id: selectedStudent.id,
        course_code: c.code.toUpperCase(),
        course_name: c.name,
        letter_grade: "A", 
        credit_hours: c.credits
      } as never);

      if (error) throw error;
      toast.success(`Enrolled: ${c.code}`);
      fetchRoster();
    } catch (err) {
      toast.error("Enrollment failed.");
    }
  };

  const filteredCatalog = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return CURRICULUM.filter((c) => {
      if (catFilterSem !== "all" && c.semester !== catFilterSem) return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [catFilterSem, catSearch]);

  const clearStudentData = async () => {
    if (!selectedStudent) return;
    if (!window.confirm(`ERASE ACADEMIC RECORD for ${selectedStudent.full_name}?`)) return;

    try {
      const { error } = await supabase.from("courses").delete().eq("student_id", selectedStudent.id);
      if (error) throw error;
      toast.success("Record cleared.");
      setSelectedStudent(null);
      fetchRoster();
    } catch (err) {
      toast.error("Reset failed.");
    }
  };

  const stats = useMemo(() => ({
    total: students.length,
    atRisk: students.filter(s => s.status === "at-risk").length,
    ready: students.filter(s => s.stats.graduationAudit.isReady).length,
    avgGpa: students.length ? students.reduce((acc, s) => acc + s.gpa, 0) / students.length : 0
  }), [students]);

  if (loading) return <div className="text-center py-20 text-muted-foreground italic animate-pulse">Syncing Department Roster...</div>;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gradient uppercase tracking-tighter">Advisor Portal</h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-bold uppercase tracking-widest opacity-60">Full Control & Oversight</p>
        </div>
      </div>

      {/* 1. Roster Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
        <StatTile label="Students" value={stats.total} color="primary" />
        <StatTile label="At Risk" value={stats.atRisk} color="destructive" />
        <StatTile label="Grad Ready" value={stats.ready} color="emerald" />
        <StatTile label="Program GPA" value={stats.avgGpa.toFixed(2)} color="accent" />
      </div>

      {/* 2. Search & List */}
      <div className="glass-strong rounded-[2.5rem] p-4 sm:p-8 border border-white/5 shadow-2xl">
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
           <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
             <Input 
               placeholder="Search by student name or reg number..." 
               className="h-14 pl-12 rounded-2xl bg-white/5 border-white/10 text-lg shadow-inner"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
           </div>
           <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              <Button variant={filter === 'all' ? 'default' : 'ghost'} className="rounded-xl h-14 px-6 uppercase font-black text-[10px] tracking-widest" onClick={() => setFilter('all')}>All</Button>
              <Button variant={filter === 'at-risk' ? 'destructive' : 'ghost'} className="rounded-xl h-14 px-6 uppercase font-black text-[10px] tracking-widest gap-2" onClick={() => setFilter('at-risk')}>
                 <TrendingDown className="h-4 w-4" /> At Risk
              </Button>
              <Button variant={filter === 'graduating' ? 'default' : 'ghost'} className="rounded-xl h-14 px-6 uppercase font-black text-[10px] tracking-widest gap-2 text-emerald-400" onClick={() => setFilter('graduating')}>
                 <GraduationCap className="h-4 w-4" /> Grad Ready
              </Button>
           </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
           <table className="w-full text-left min-w-[800px] sm:min-w-0 border-separate border-spacing-y-2">
              <thead>
                 <tr className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground px-4">
                    <th className="pb-4 pl-6">Student Profile</th>
                    <th className="pb-4 text-center">Current GPA</th>
                    <th className="pb-4 text-center">Progress</th>
                    <th className="pb-4">Audit Result</th>
                    <th className="pb-4 text-right pr-6">Management</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredStudents.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-muted-foreground italic">No student matches found.</td></tr>
                 ) : filteredStudents.map(student => (
                    <tr key={student.id} className="group transition-all">
                       <td className="bg-white/5 first:rounded-l-[1.5rem] last:rounded-r-[1.5rem] py-4 pl-6 border-y border-white/5">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center border border-primary/20 shrink-0">
                                <User className="h-5 w-5 text-primary" />
                             </div>
                             <div className="min-w-0">
                                <div className="font-black text-base tracking-tight truncate">{student.full_name}</div>
                                <div className="text-[10px] font-mono text-muted-foreground uppercase opacity-60">REG: {student.registration_number}</div>
                             </div>
                          </div>
                       </td>
                       <td className="bg-white/5 py-4 text-center font-black border-y border-white/5">
                          <div className={`text-lg ${student.gpa < 2.0 ? 'text-destructive' : 'text-foreground'}`}>{student.gpa.toFixed(2)}</div>
                       </td>
                       <td className="bg-white/5 py-4 text-center border-y border-white/5">
                          <div className="text-sm font-black text-muted-foreground">{student.credits} <span className="text-[10px] opacity-40">/ 144</span></div>
                       </td>
                       <td className="bg-white/5 py-4 border-y border-white/5">
                          {student.stats.graduationAudit.isReady ? (
                             <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black text-[9px] px-3">GRAD READY</Badge>
                          ) : (
                             <Badge variant="outline" className="text-muted-foreground font-black text-[9px] px-3 opacity-40">IN PROGRESS</Badge>
                          )}
                       </td>
                       <td className="bg-white/5 py-4 text-right pr-6 first:rounded-l-[1.5rem] last:rounded-r-[1.5rem] border-y border-white/5">
                          <Button 
                             variant="ghost" 
                             size="sm" 
                             className="rounded-xl h-10 px-4 gap-2 hover:bg-primary hover:text-primary-foreground border border-white/5 active:scale-95 transition-all"
                             onClick={() => setSelectedStudent(student)}
                          >
                             <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Manage</span>
                          </Button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* 3. Student Control Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-[3rem] h-[90vh] sm:h-auto flex flex-col">
           <div className="p-6 sm:p-10 h-full flex flex-col overflow-y-auto custom-scrollbar">
              <DialogHeader className="mb-10">
                 <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                    <div>
                       <DialogTitle className="text-4xl font-black tracking-tighter leading-none mb-2">{selectedStudent?.full_name}</DialogTitle>
                       <DialogDescription className="text-sm font-mono font-black text-primary opacity-80 uppercase tracking-widest">
                          Academic Profile: {selectedStudent?.registration_number}
                       </DialogDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                       <Button variant="outline" className="flex-1 sm:flex-none h-12 rounded-2xl border-sky-500/20 text-sky-400 hover:bg-sky-500/10 gap-2 font-black uppercase text-[10px] tracking-widest" asChild>
                          <Link to="/roadmap" search={{ studentId: selectedStudent?.id }}>
                             <Compass className="h-4 w-4" /> Visual Roadmap
                          </Link>
                       </Button>
                       <Button variant="outline" className="flex-1 sm:flex-none h-12 rounded-2xl border-primary/20 text-primary hover:bg-primary/10 gap-2 font-black uppercase text-[10px] tracking-widest" asChild>
                          <Link to="/degree-planner" search={{ studentId: selectedStudent?.id }}>
                             <Calendar className="h-4 w-4" /> Draft Plan
                          </Link>
                       </Button>
                       <Button variant="destructive" size="icon" className="h-12 w-12 rounded-2xl shadow-xl active:scale-90 transition-transform" onClick={clearStudentData}>
                          <Trash2 className="h-5 w-5" />
                       </Button>
                    </div>
                 </div>
              </DialogHeader>

              {selectedStudent && (
                 <div className="space-y-10">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                       <VitalCard label="CUMULATIVE GPA" value={selectedStudent.gpa.toFixed(2)} color={selectedStudent.gpa < 2.0 ? "text-destructive" : "text-primary"} />
                       <VitalCard label="EARNED CREDITS" value={`${selectedStudent.credits}`} color="text-foreground" />
                       <VitalCard label="TERMS PASSED" value={`${selectedStudent.stats.graduationAudit.coreSemestersCompleted}`} color="text-foreground" />
                       <VitalCard label="CONC. STATUS" value={`${selectedStudent.stats.graduationAudit.concentrationCredits} Cr`} color="text-foreground" />
                    </div>

                    {/* Advisor Actions */}
                    <section className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Administrative Protocols</h4>
                       <div className="grid sm:grid-cols-2 gap-4">
                          <Button 
                            className="h-16 rounded-[1.5rem] gap-4 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20 active:scale-95 transition-all"
                            onClick={() => setCatalogOpen(true)}
                          >
                             <PlusCircle className="h-6 w-6" /> Official Enrollment
                          </Button>
                          <Button 
                            variant="outline"
                            className="h-16 rounded-[1.5rem] gap-4 border-amber-500/20 text-amber-500 bg-amber-500/5 font-black uppercase tracking-widest text-xs active:scale-95 transition-all"
                            onClick={() => toast.success("Academic warning issued to student.")}
                          >
                             <MessageSquareWarning className="h-6 w-6" /> Issue Academic Alert
                          </Button>
                       </div>
                    </section>

                    {/* Graduation Audit View */}
                    <section className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                       <div className="flex items-center gap-3 mb-2">
                          <ClipboardCheck className="h-6 w-6 text-primary" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Verification Checklist</h4>
                       </div>
                       <div className="grid sm:grid-cols-2 gap-y-4 gap-x-12">
                          <AuditItem label="Academic Standing (GPA 2.0+)" isDone={selectedStudent.stats.graduationAudit.isGpaQualified} />
                          <AuditItem label="Credit Accumulation (144+)" isDone={selectedStudent.credits >= 144} />
                          <AuditItem label="Core Semester Logic (1-8)" isDone={selectedStudent.stats.graduationAudit.coreSemestersCompleted === 8} />
                          <AuditItem label="Track Specialization" isDone={selectedStudent.stats.graduationAudit.concentrationCredits >= 6} />
                       </div>
                    </section>

                    {/* Enrollment History */}
                    <section className="space-y-4 pb-12">
                       <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Academic Ledger</h4>
                          <span className="text-[9px] font-black uppercase opacity-40">{selectedStudent.courses.length} TOTAL SUBJECTS</span>
                       </div>
                       <div className="grid sm:grid-cols-2 gap-3">
                          {selectedStudent.courses.slice(0, 10).map(c => (
                             <div key={c.id} className="flex items-center justify-between p-4 glass rounded-2xl border-white/5 hover:border-white/10 transition-all">
                                <div className="min-w-0">
                                   <div className="text-[10px] font-mono text-primary uppercase font-black">{c.course_code}</div>
                                   <div className="text-sm font-bold truncate tracking-tight">{c.course_name}</div>
                                </div>
                                <Badge className={`font-black text-[10px] rounded-lg h-7 px-3 border-none ${c.letter_grade === 'F' ? 'bg-destructive/20 text-destructive shadow-[0_0_15px_rgba(var(--color-destructive-rgb),0.1)]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                   {c.letter_grade}
                                </Badge>
                             </div>
                          ))}
                       </div>
                       {selectedStudent.courses.length > 10 && (
                          <div className="text-[10px] text-center text-muted-foreground italic font-black uppercase tracking-widest opacity-40 pt-4">
                             + Browse Visual Roadmap for full record history
                          </div>
                       )}
                    </section>
                 </div>
              )}
           </div>
        </DialogContent>
      </Dialog>

      {/* 4. Curriculum Catalog for Advisor */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-[3rem] h-[88vh] sm:h-[80vh] flex flex-col focus:outline-none shadow-2xl">
          <div className="p-4 sm:p-10 flex flex-col h-full min-h-0">
            <DialogHeader className="mb-8 shrink-0">
               <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-4 text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">
                     <div className="p-3 rounded-[1.5rem] bg-primary/20"><BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-primary" /></div>
                     Course Discovery
                  </DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCatalogOpen(false)} className="rounded-full h-12 w-12 bg-white/5 active:scale-75 transition-all">
                     <XCircle className="h-7 w-7 opacity-30" />
                  </Button>
               </div>
               <DialogDescription className="text-[12px] uppercase font-black tracking-[0.3em] opacity-40 mt-4 ml-1 text-primary">
                  Official Enrollment Hub for <strong>{selectedStudent?.full_name}</strong>
               </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col sm:flex-row gap-3 mb-8 shrink-0 px-1">
               <div className="relative flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <Input 
                     placeholder="Search catalog by code or name..."
                     value={catSearch}
                     onChange={(e) => setCatSearch(e.target.value)}
                     className="pl-16 h-16 rounded-[1.5rem] bg-white/5 border-white/10 text-xl font-bold shadow-2xl focus:ring-4 focus:ring-primary/10 transition-all"
                  />
               </div>
               <Select value={catFilterSem} onValueChange={setCatFilterSem}>
                  <SelectTrigger className="sm:w-[180px] h-16 bg-white/5 border-white/10 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl">
                     <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">ALL TERMS</SelectItem>
                     {SEMESTERS.map(s => <SelectItem key={s} value={s}>{s.startsWith("Conc") ? s : `SEM ${s}`}</SelectItem>)}
                  </SelectContent>
               </Select>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-5 pr-2 custom-scrollbar pb-32 sm:pb-4 touch-pan-y overscroll-contain">
               {filteredCatalog.map(course => (
                  <div key={course.code} className={`glass-strong rounded-[2.5rem] p-8 border transition-all duration-500 hover:border-primary/40 group ${course.uclan ? 'border-l-[16px] border-l-[#FFC000]' : 'border-white/10'}`}>
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                       <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-4 mb-3">
                             <span className="font-mono text-sm text-primary font-black uppercase tracking-[0.2em] bg-primary/10 px-4 py-1.5 rounded-xl">{course.code}</span>
                             {course.uclan && <Badge className="bg-[#FFC000] text-black text-[10px] h-6 border-none font-black px-4 rounded-full">UK DUAL CERTIFIED</Badge>}
                          </div>
                          <h4 className="font-black text-2xl leading-[1.1] tracking-tighter mb-4">{course.name}</h4>
                          <div className="flex flex-wrap gap-3">
                             <span className="px-4 py-1.5 rounded-2xl bg-white/5 text-[11px] font-black uppercase tracking-widest opacity-60">{course.credits} Credits</span>
                             <span className="px-4 py-1.5 rounded-2xl bg-white/5 text-[11px] font-black uppercase tracking-widest opacity-60">Catalogue Origin: Sem {course.semester}</span>
                          </div>
                       </div>
                       <Button 
                        size="lg"
                        className="rounded-[1.5rem] h-16 px-12 font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all w-full xl:w-auto bg-primary text-primary-foreground border-4 border-white/10"
                        onClick={() => enrollFromCatalog(course)}
                       >
                        Enroll Student
                       </Button>
                    </div>
                  </div>
               ))}
            </div>
            
            <div className="sm:hidden fixed bottom-6 left-6 right-6 z-[70]">
               <Button className="w-full h-16 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-black text-sm uppercase tracking-widest border-2 border-white/20 bg-background/90 backdrop-blur-3xl" onClick={() => setCatalogOpen(false)}>
                  Close Discovery
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string, value: string | number, color: string }) {
  const borderMap: Record<string, string> = {
    primary: "border-primary shadow-primary/10",
    destructive: "border-destructive shadow-destructive/10",
    emerald: "border-emerald-500 shadow-emerald-500/10",
    accent: "border-accent shadow-accent/10"
  };
  return (
    <div className={`glass-strong rounded-[2rem] p-6 border-l-[8px] shadow-2xl transition-transform hover:scale-[1.02] ${borderMap[color] || 'border-white/10'}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 opacity-50">{label}</div>
      <div className="text-3xl sm:text-4xl font-black truncate tracking-tighter leading-none">{value}</div>
    </div>
  );
}

function VitalCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="glass rounded-[1.5rem] p-5 border border-white/5 shadow-inner">
       <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 opacity-40">{label}</div>
       <div className={`text-2xl font-black tracking-tighter leading-none ${color}`}>{value}</div>
    </div>
  );
}

function AuditItem({ label, isDone }: { label: string, isDone: boolean }) {
  return (
    <div className="flex items-center gap-4 group">
      <div className={`h-6 w-6 rounded-full grid place-items-center transition-colors ${isDone ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
         {isDone ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-muted-foreground/30" />}
      </div>
      <span className={`text-sm font-black uppercase tracking-tight transition-colors ${isDone ? 'text-foreground' : 'text-muted-foreground opacity-50 group-hover:opacity-100'}`}>{label}</span>
    </div>
  );
}
