import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { 
  Users, 
  Search, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  User,
  ExternalLink,
  Filter,
  MessageSquareWarning,
  Trash2,
  Settings,
  GraduationCap,
  ClipboardCheck,
  XCircle
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
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateGPA } from "@/lib/gpa";
import { calculateStudentStats, type StudentStats } from "@/lib/student-stats";

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
    if (role && role !== 'advisor') {
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

  const fetchRoster = async () => {
    setLoading(true);
    const { data: studentData, error: sErr } = await supabase.from("students").select("*");
    if (sErr || !studentData) {
      toast.error("Failed to load student roster");
      setLoading(false);
      return;
    }

    const { data: courseData, error: cErr } = await supabase
      .from("courses")
      .select("student_id, letter_grade, credit_hours, course_code");

    if (cErr) {
      toast.error("Failed to load grade data");
      setLoading(false);
      return;
    }

    const roster = studentData.map(s => {
      const studentCourses = (courseData || []).filter(c => c.student_id === s.id);
      const gpaResult = calculateGPA(studentCourses.map(c => ({
        letter_grade: c.letter_grade,
        credit_hours: Number(c.credit_hours)
      })));

      const stats = calculateStudentStats(
        studentCourses.map(c => ({
          course_code: c.course_code,
          letter_grade: c.letter_grade,
          credit_hours: Number(c.credit_hours)
        })),
        gpaResult.gpa
      );

      let status: StudentRosterItem["status"] = "stable";
      if (gpaResult.gpa < 2.0) status = "at-risk";
      else if (gpaResult.gpa < 2.5) status = "warning";
      else if (gpaResult.gpa >= 3.6) status = "honor";

      return {
        id: s.id,
        full_name: s.full_name,
        registration_number: s.registration_number,
        enrollment_year: s.enrollment_year,
        gpa: gpaResult.gpa,
        credits: gpaResult.totalCredits,
        status,
        stats
      };
    });

    setStudents(roster);
    setLoading(false);
  };

  useEffect(() => {
    void fetchRoster();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || 
                            s.registration_number.includes(search);
      const matchesFilter = filter === "all" || 
                            (filter === "at-risk" && s.status === "at-risk") || 
                            (filter === "graduating" && s.stats.graduationAudit.isReady) ||
                            (filter === "honor" && s.status === "honor");
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  const overview = useMemo(() => {
    return {
      total: students.length,
      atRisk: students.filter(s => s.status === "at-risk").length,
      ready: students.filter(s => s.stats.graduationAudit.isReady).length,
      avgGpa: students.length ? students.reduce((acc, s) => acc + s.gpa, 0) / students.length : 0
    };
  }, [students]);

  const sendAlert = () => {
    toast.success(`Formal warning sent to ${selectedStudent?.full_name}'s student email.`);
  };

  const clearStudentData = async () => {
    if (!selectedStudent) return;
    const confirm = window.confirm(`Are you sure you want to completely erase the academic record for ${selectedStudent.full_name}? This action cannot be undone.`);
    if (!confirm) return;

    const { error } = await supabase.from("courses").delete().eq("student_id", selectedStudent.id);
    if (error) toast.error("Failed to clear data.");
    else {
      toast.success(`Academic record erased for ${selectedStudent.full_name}.`);
      setSelectedStudent(null);
      fetchRoster();
    }
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground italic">Syncing Department Roster...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Advisor Portal</h1>
          <p className="text-muted-foreground text-sm">Departmental Oversight & Graduation Tracking</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-primary">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Managed Students</div>
          <div className="text-2xl font-bold">{overview.total}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-destructive">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">At Risk (GPA &lt; 2.0)</div>
          <div className="text-2xl font-bold text-destructive">{overview.atRisk}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-emerald-500">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready to Graduate</div>
          <div className="text-2xl font-bold text-emerald-500">{overview.ready}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-accent">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg. Program GPA</div>
          <div className="text-2xl font-bold">{overview.avgGpa.toFixed(2)}</div>
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search students..." 
              className="pl-10 bg-white/5 border-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant={filter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('all')}>All</Button>
            <Button variant={filter === 'at-risk' ? 'destructive' : 'ghost'} size="sm" onClick={() => setFilter('at-risk')} className="gap-2">
              <TrendingDown className="h-4 w-4" /> At Risk
            </Button>
            <Button variant={filter === 'graduating' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('graduating')} className="gap-2 text-emerald-400">
              <GraduationCap className="h-4 w-4" /> Grad Ready
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Student Info</th>
                <th className="px-4 py-3 text-center">GPA</th>
                <th className="px-4 py-3 text-center">Credits</th>
                <th className="px-4 py-3">Audit Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.map(student => (
                <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{student.full_name}</div>
                        <div className="text-[10px] text-muted-foreground">Reg: {student.registration_number}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className={`text-lg font-mono font-bold ${student.gpa < 2.0 ? 'text-destructive' : 'text-foreground'}`}>{student.gpa.toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="text-sm font-medium">{student.credits} / 144</div>
                  </td>
                  <td className="px-4 py-4">
                    {student.stats.graduationAudit.isReady ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                        <ClipboardCheck className="h-3 w-3" /> Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground gap-1">
                        In Progress
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity gap-1" onClick={() => setSelectedStudent(student)}>
                      <Settings className="h-3 w-3" /> Audit & Control
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-xl glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Academic Audit: {selectedStudent?.full_name}
            </DialogTitle>
            <DialogDescription>Full departmental oversight and verification panel.</DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6 py-4">
              <section className="glass rounded-2xl p-5 border border-primary/20">
                <h4 className="text-xs font-bold uppercase text-primary mb-4 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Graduation Checklist
                </h4>
                <div className="space-y-3">
                  <AuditRow 
                    label="Minimum GPA (2.0+)" 
                    value={`${selectedStudent.gpa.toFixed(2)} / 2.00`} 
                    isDone={selectedStudent.stats.graduationAudit.isGpaQualified} 
                  />
                  <AuditRow 
                    label="Total Credits (144+)" 
                    value={`${selectedStudent.stats.graduationAudit.totalCreditsPassed} / 144`} 
                    isDone={selectedStudent.stats.graduationAudit.totalCreditsPassed >= 144} 
                  />
                  <AuditRow 
                    label="Core Semesters (1-8)" 
                    value={`${selectedStudent.stats.graduationAudit.coreSemestersCompleted} / 8 Sem`} 
                    isDone={selectedStudent.stats.graduationAudit.coreSemestersCompleted === 8} 
                  />
                  <AuditRow 
                    label="Concentration Credits" 
                    value={`${selectedStudent.stats.graduationAudit.concentrationCredits} Cr`} 
                    isDone={selectedStudent.stats.graduationAudit.concentrationCredits >= 6} 
                  />
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start gap-3 bg-amber-500/5 border-amber-500/20 text-amber-500 hover:bg-amber-500/10" onClick={sendAlert}>
                  <MessageSquareWarning className="h-4 w-4" /> Alert Student
                </Button>
                <Button variant="outline" className="justify-start gap-3 bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/10" onClick={clearStudentData}>
                  <Trash2 className="h-4 w-4" /> Reset Records
                </Button>
              </div>

              <div className="text-[10px] text-muted-foreground text-center border-t border-white/5 pt-4">
                Advisor: {selectedStudent.registration_number} · Formal department audit mode.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditRow({ label, value, isDone }: { label: string, value: string, isDone: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 px-2">
      <div className="flex items-center gap-3">
        {isDone ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground/30" />}
        <span className={`text-sm ${isDone ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
      </div>
      <span className={`text-xs font-mono ${isDone ? 'text-emerald-400' : 'text-muted-foreground'}`}>{value}</span>
    </div>
  );
}
