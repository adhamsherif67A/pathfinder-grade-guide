import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  Filter
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GRADE_POINTS, calculateGPA } from "@/lib/gpa";

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
};

function AdvisorRoute() {
  const { role, navigate } = useAppContext();
  
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
  const [filter, setFilter] = useState<"all" | "at-risk" | "honor">("all");

  useEffect(() => {
    async function fetchRoster() {
      setLoading(true);
      // 1) Fetch all students
      const { data: studentData, error: sErr } = await supabase
        .from("students")
        .select("*");
      
      if (sErr || !studentData) {
        toast.error("Failed to load student roster");
        setLoading(false);
        return;
      }

      // 2) Fetch all courses to calculate GPAs (in a real app, we'd use a view or RPC)
      const { data: courseData, error: cErr } = await supabase
        .from("courses")
        .select("student_id, letter_grade, credit_hours");

      if (cErr) {
        toast.error("Failed to load grade data");
        setLoading(false);
        return;
      }

      const roster = studentData.map(s => {
        const studentCourses = (courseData || []).filter(c => c.student_id === s.id);
        const stats = calculateGPA(studentCourses.map(c => ({
          letter_grade: c.letter_grade,
          credit_hours: Number(c.credit_hours)
        })));

        let status: StudentRosterItem["status"] = "stable";
        if (stats.gpa < 2.0) status = "at-risk";
        else if (stats.gpa < 2.5) status = "warning";
        else if (stats.gpa >= 3.6) status = "honor";

        return {
          id: s.id,
          full_name: s.full_name,
          registration_number: s.registration_number,
          enrollment_year: s.enrollment_year,
          gpa: stats.gpa,
          credits: stats.totalCredits,
          status
        };
      });

      setStudents(roster);
      setLoading(false);
    }

    void fetchRoster();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) || 
                            s.registration_number.includes(search);
      const matchesFilter = filter === "all" || 
                            (filter === "at-risk" && s.status === "at-risk") || 
                            (filter === "honor" && s.status === "honor");
      return matchesSearch && matchesFilter;
    });
  }, [students, search, filter]);

  const stats = useMemo(() => {
    return {
      total: students.length,
      atRisk: students.filter(s => s.status === "at-risk").length,
      honor: students.filter(s => s.status === "honor").length,
      avgGpa: students.length ? students.reduce((acc, s) => acc + s.gpa, 0) / students.length : 0
    };
  }, [students]);

  if (loading) return <div className="text-center py-20 text-muted-foreground italic">Syncing Department Roster...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Advisor Portal</h1>
          <p className="text-muted-foreground text-sm">Departmental Oversight & Student Risk Management</p>
        </div>
      </div>

      {/* Risk Dashboard Summary */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-primary">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Managed Students</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-destructive">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">At Risk (GPA &lt; 2.0)</div>
          <div className="text-2xl font-bold text-destructive">{stats.atRisk}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-emerald-500">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Honor Roll</div>
          <div className="text-2xl font-bold text-emerald-500">{stats.honor}</div>
        </div>
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-accent">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg. Program GPA</div>
          <div className="text-2xl font-bold">{stats.avgGpa.toFixed(2)}</div>
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search students by name or registration number..." 
              className="pl-10 bg-white/5 border-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button 
              variant={filter === 'at-risk' ? 'destructive' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('at-risk')}
              className="gap-2"
            >
              <TrendingDown className="h-4 w-4" /> At Risk
            </Button>
            <Button 
              variant={filter === 'honor' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setFilter('honor')}
              className="gap-2 text-emerald-400"
            >
              <CheckCircle className="h-4 w-4" /> Honor
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-medium">Student Info</th>
                <th className="px-4 py-3 font-medium text-center">GPA</th>
                <th className="px-4 py-3 font-medium text-center">Credits</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted-foreground">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{student.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">Reg: {student.registration_number} · Year: {student.enrollment_year || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`text-lg font-mono font-bold ${student.gpa < 2.0 ? 'text-destructive' : 'text-foreground'}`}>
                        {student.gpa.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium">{student.credits} / 144</div>
                    </td>
                    <td className="px-4 py-4">
                      {student.status === 'at-risk' && <Badge variant="destructive" className="animate-pulse">At Risk</Badge>}
                      {student.status === 'warning' && <Badge variant="outline" className="text-amber-400 border-amber-400/30">Warning</Badge>}
                      {student.status === 'stable' && <Badge variant="outline" className="text-sky-400 border-sky-400/30">Stable</Badge>}
                      {student.status === 'honor' && <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">Honor Roll</Badge>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        View Profile <ExternalLink className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
