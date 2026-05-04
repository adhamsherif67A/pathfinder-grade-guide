import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { CURRICULUM, CURRICULUM_BY_CODE, SEMESTERS } from "@/lib/curriculum";

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
// New Course Entry State
const [newCourse, setNewCourse] = useState({ code: "", name: "", grade: "A", credits: "3" });
const [isAddingCourse, setIsAddingCourse] = useState(false);

// Curriculum Catalog State for Advisor
const [catalogOpen, setCatalogOpen] = useState(false);
const [catSearch, setCatSearch] = useState("");
const [catFilterSem, setCatFilterSem] = useState("all");

  const enrollFromCatalog = async (c: typeof CURRICULUM[0]) => {
    if (!selectedStudent) return;
    
    const { error } = await supabase.from("courses").insert({
      student_id: selectedStudent.id,
      course_code: c.code,
      course_name: c.name,
      letter_grade: "A", 
      credit_hours: c.credits
    } as never);

    if (error) {
      toast.error(`Failed to enroll in ${c.code}`);
    } else {
      toast.success(`Enrolled ${selectedStudent.full_name} in ${c.code}`);
      fetchRoster();
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

  if (loading)
    return (
      <div className="text-center py-20 text-muted-foreground italic">
        Syncing Department Roster...
      </div>
    );

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Advisor Portal</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Departmental Oversight & Graduation Tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-1">
        <StatTile label="Students" value={overview.total} color="primary" />
        <StatTile label="At Risk" value={overview.atRisk} color="destructive" />
        <StatTile label="Ready" value={overview.ready} color="emerald" />
        <StatTile label="Avg GPA" value={overview.avgGpa.toFixed(2)} color="accent" />
      </div>

      <div className="glass-strong rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-10 bg-white/5 border-white/10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "at-risk" ? "destructive" : "ghost"}
              size="sm"
              onClick={() => setFilter("at-risk")}
              className="gap-2 whitespace-nowrap"
            >
              <TrendingDown className="h-4 w-4" /> At Risk
            </Button>
            <Button
              variant={filter === "graduating" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("graduating")}
              className="gap-2 text-emerald-400 whitespace-nowrap"
            >
              <GraduationCap className="h-4 w-4" /> Grad Ready
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left min-w-[600px] sm:min-w-0">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Student Info</th>
                <th className="px-4 py-3 text-center">GPA</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">Credits</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 grid place-items-center shrink-0">
                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate">
                          {student.full_name}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                          Reg: {student.registration_number}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div
                      className={`text-sm sm:text-lg font-mono font-bold ${student.gpa < 2.0 ? "text-destructive" : "text-foreground"}`}
                    >
                      {student.gpa.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center hidden sm:table-cell">
                    <div className="text-sm font-medium">{student.credits} / 144</div>
                  </td>
                  <td className="px-4 py-4">
                    {student.stats.graduationAudit.isReady ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[9px] sm:text-[10px]">
                        <ClipboardCheck className="h-3 w-3" /> Ready
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground gap-1 text-[9px] sm:text-[10px]"
                      >
                        In Progress
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sm:opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-xl glass-strong border-white/10 p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" /> Academic Audit:{" "}
                {selectedStudent?.full_name}
              </DialogTitle>
              <DialogDescription>
                Registration: {selectedStudent?.registration_number}
              </DialogDescription>
            </DialogHeader>

            {selectedStudent && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 border-sky-500/20 text-sky-400 hover:bg-sky-500/10"
                    asChild
                  >
                    <Link to="/roadmap" search={{ studentId: selectedStudent.id }}>
                      <Compass className="h-4 w-4" /> View Visual Roadmap
                    </Link>
                  </Button>
                </div>

                <section className="glass rounded-2xl p-4 border border-primary/20 bg-primary/5">
                  <h4 className="text-[10px] font-bold uppercase text-primary mb-3 flex items-center gap-2">
                    <GraduationCap className="h-3 w-3" /> Graduation Checklist
                  </h4>
                  <div className="space-y-2">
                    <AuditRow
                      label="Min GPA (2.0+)"
                      isDone={selectedStudent.stats.graduationAudit.isGpaQualified}
                    />
                    <AuditRow
                      label="144 Credits"
                      isDone={selectedStudent.stats.graduationAudit.totalCreditsPassed >= 144}
                    />
                    <AuditRow
                      label="8 Core Semesters"
                      isDone={selectedStudent.stats.graduationAudit.coreSemestersCompleted === 8}
                    />
                    <AuditRow
                      label="Concentration"
                      isDone={selectedStudent.stats.graduationAudit.concentrationCredits >= 6}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground">
                      Administrative Record Entry
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[9px]"
                      onClick={() => setIsAddingCourse(!isAddingCourse)}
                    >
                      {isAddingCourse ? "Cancel" : "Add Course Override"}
                    </Button>
                  </div>

                  {isAddingCourse ? (
                    <div className="glass rounded-xl p-4 border border-accent/20 bg-accent/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Code (e.g. ME101)"
                          value={newCourse.code}
                          onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                          className="bg-white/10 text-xs h-8"
                        />
                        <Input
                          placeholder="Course Name"
                          value={newCourse.name}
                          onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                          className="bg-white/10 text-xs h-8"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={newCourse.grade}
                          onValueChange={(v) => setNewCourse({ ...newCourse, grade: v })}
                        >
                          <SelectTrigger className="h-8 bg-white/10 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADE_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Credits"
                          value={newCourse.credits}
                          onChange={(e) => setNewCourse({ ...newCourse, credits: e.target.value })}
                          className="bg-white/10 text-xs h-8"
                        />
                      </div>
                      <Button
                        className="w-full h-8 text-xs gap-2 bg-accent hover:bg-accent/80"
                        onClick={addAdminCourse}
                      >
                        <PlusCircle className="h-3 w-3" /> Save Override Record
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-9 text-[10px] gap-2 border-primary/20 text-primary bg-primary/5"
                        onClick={() => setCatalogOpen(true)}
                      >
                        <BookOpen className="h-3 w-3" /> Mechatronics Catalog
                      </Button>
                      <Button variant="outline" className="flex-1 h-9 text-[10px] gap-2 border-amber-500/20 text-amber-500 bg-amber-500/5" onClick={sendAlert}>
                        <MessageSquareWarning className="h-3 w-3" /> Alert Student
                      </Button>
                      <Button variant="outline" className="flex-1 h-9 text-[10px] gap-2 border-destructive/20 text-destructive bg-destructive/5" onClick={clearStudentData}>
                        <Trash2 className="h-3 w-3" /> Reset Records
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
          <div className="bg-white/5 p-3 text-[9px] text-muted-foreground text-center border-t border-white/10">
            All administrative actions are timestamped and logged.
          </div>
        </DialogContent>
      </Dialog>

      {/* Curriculum Catalog for Advisor */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-3xl h-[88vh] sm:h-[80vh] flex flex-col focus:outline-none">
          <div className="p-4 sm:p-8 flex flex-col h-full min-h-0">
            <DialogHeader className="mb-6 shrink-0">
               <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-3 text-2xl sm:text-3xl font-black tracking-tighter">
                     <div className="p-2.5 rounded-2xl bg-primary/20"><BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /></div>
                     Curriculum Catalog
                  </DialogTitle>
                  <Button variant="ghost" size="icon" onClick={() => setCatalogOpen(false)} className="sm:hidden"><Trash2 className="h-5 w-5 opacity-50" /></Button>
               </div>
               <DialogDescription className="text-[11px] uppercase font-black tracking-[0.1em] opacity-40 mt-1">
                  Enrolling: {selectedStudent?.full_name}
               </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-6 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by code or subject name..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="pl-14 h-14 rounded-2xl bg-white/5 border-white/10 text-lg shadow-2xl focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-2">
                <Select value={catFilterSem} onValueChange={setCatFilterSem}>
                  <SelectTrigger className="flex-1 sm:w-[160px] h-14 bg-white/5 border-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {SEMESTERS.map((s) => (
                      <SelectItem key={s} value={s}>{s.startsWith("Conc") ? s : `Sem ${s}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-2 custom-scrollbar pb-10 sm:pb-2 touch-pan-y overscroll-contain">
               {filteredCatalog.map(course => (
                  <div key={course.code} className={`glass-strong rounded-[2rem] p-6 border transition-all duration-300 ${course.uclan ? 'border-l-8 border-l-[#FFC000]' : 'border-white/5'}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                       <div>
                          <div className="flex items-center gap-3 mb-2">
                             <span className="font-mono text-xs text-primary font-black uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">{course.code}</span>
                             {course.uclan && <Badge className="bg-[#FFC000] text-black text-[9px] h-5 border-none font-black px-2">UK INTEGRATED</Badge>}
                          </div>
                          <h4 className="font-black text-lg leading-none tracking-tight">{course.name}</h4>
                          <div className="text-xs text-muted-foreground mt-2 flex gap-3 font-bold uppercase tracking-wider opacity-60">
                             <span>{course.credits} Cr</span>
                             <span>•</span>
                             <span>Sem {course.semester}</span>
                          </div>
                       </div>
                       <Button 
                        size="lg"
                        className="rounded-2xl h-12 px-8 font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all w-full sm:w-auto"
                        onClick={() => enrollFromCatalog(course)}
                       >
                        Enroll Student
                       </Button>
                    </div>
                  </div>
               ))}
            </div>
            
            <div className="sm:hidden mt-4 shrink-0">
               <Button className="w-full h-14 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest border-2 border-white/10 bg-primary text-primary-foreground" onClick={() => setCatalogOpen(false)}>
                  Back to Panel
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const borderMap: Record<string, string> = {
    primary: "border-primary",
    destructive: "border-destructive",
    emerald: "border-emerald-500",
    accent: "border-accent",
  };
  return (
    <div
      className={`glass-strong rounded-xl p-3 sm:p-4 border-l-4 ${borderMap[color] || "border-white/10"}`}
    >
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg sm:text-xl font-bold truncate">{value}</div>
    </div>
  );
}

function AuditRow({ label, isDone }: { label: string; isDone: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {isDone ? (
        <CheckCircle className="h-3 w-3 text-emerald-400" />
      ) : (
        <XCircle className="h-3 w-3 text-muted-foreground/30" />
      )}
      <span
        className={`text-[11px] sm:text-xs ${isDone ? "text-foreground font-medium" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}
