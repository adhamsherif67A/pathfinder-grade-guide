import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Search,
  GraduationCap,
  Target,
  AlertCircle,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GRADE_OPTIONS, calculateGPA } from "@/lib/gpa";
import { getSemesterRecommendation } from "@/lib/recommendation";
import { CURRICULUM, CURRICULUM_BY_CODE, SEMESTERS, type CurriculumCourse } from "@/lib/curriculum";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { calculateRequiredGrades } from "@/lib/gpa-projection";

export const Route = createFileRoute("/gpa-calculator")({
  component: GpaCalculatorRoute,
});

type Row = {
  id?: string;
  course_code: string;
  course_name: string;
  letter_grade: string;
  credit_hours: number;
  uclan?: boolean;
};

function emptyRow(): Row {
  return { course_code: "", course_name: "", letter_grade: "A", credit_hours: 3 };
}

function rowFromCurriculum(c: CurriculumCourse): Row {
  return {
    course_code: c.code,
    course_name: c.name,
    letter_grade: "A",
    credit_hours: c.credits || 3,
    uclan: c.uclan,
  };
}

function GpaCalculatorRoute() {
  const { role } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (role === 'advisor') {
      navigate({ to: "/advisor" });
    }
  }, [role, navigate]);

  return (
    <AppShell>
      <GpaCalculatorPage />
    </AppShell>
  );
}

function GpaCalculatorPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterSem, setFilterSem] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showUclanOnly, setShowUclanOnly] = useState(false);
  const [targetGpa, setTargetGpa] = useState<number>(3.5);

  const { student, loading: ctxLoading } = useAppContext();
  const studentId = student?.id;

  useEffect(() => {
    if (ctxLoading) return;
    if (!studentId) {
      setRows([emptyRow()]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("id, course_name, letter_grade, credit_hours, course_code")
          .eq("student_id", studentId)
          .order("created_at", { ascending: true });
        if (!active) return;
        if (error) {
          toast.error("Could not load courses");
          setRows([emptyRow()]);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setRows(
            data.map((d) => {
              const code = (d as { course_code?: string | null }).course_code || "";
              const cur = code ? CURRICULUM_BY_CODE[code] : undefined;
              return {
                id: d.id,
                course_code: code,
                course_name: d.course_name,
                letter_grade: d.letter_grade,
                credit_hours: Number(d.credit_hours),
                uclan: cur?.uclan,
              };
            }),
          );
        } else {
          setRows([emptyRow()]);
        }
        setLoading(false);
      } catch {
        if (!active) return;
        toast.error("Could not load courses");
        setRows([emptyRow()]);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [studentId, ctxLoading]);

  const enrolledCodes = useMemo(
    () => new Set(rows.map((r) => r.course_code).filter(Boolean)),
    [rows],
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CURRICULUM.filter((c) => {
      if (filterSem !== "all" && c.semester !== filterSem) return false;
      if (showUclanOnly && !c.uclan) return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [filterSem, search, showUclanOnly]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const remove = (i: number) =>
    setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((_, idx) => idx !== i)));

  const addBlank = () => setRows((rs) => [...rs, emptyRow()]);

  const enroll = (c: CurriculumCourse) => {
    const code = c.code.toUpperCase();
    
    // Check if ALREADY in the current ledger (avoid UI duplicates)
    if (enrolledCodes.has(code)) {
      toast.info(`${code} is already in your ledger.`);
      return;
    }

    setRows((rs) => {
      const last = rs[rs.length - 1];
      if (last && !last.course_code && !last.course_name.trim()) {
        return [...rs.slice(0, -1), rowFromCurriculum(c)];
      }
      return [...rs, rowFromCurriculum(c)];
    });
    toast.success(`Enrolled in ${code}`);
  };

  const reset = () => {
    if (window.confirm("This will clear all entries from your current view. Continue?")) {
      setRows([emptyRow()]);
    }
  };

  const save = async () => {
    if (!student) return;
    setSaving(true);
    try {
      const valid = rows.filter(
        (r) =>
          (r.course_name.trim() || r.course_code.trim()) &&
          r.letter_grade &&
          Number(r.credit_hours) >= 1,
      );
      const { error: delErr } = await supabase
        .from("courses")
        .delete()
        .eq("student_id", student.id);
      if (delErr) throw delErr;
      if (valid.length > 0) {
        const { error: insErr } = await supabase.from("courses").insert(
          valid.map((r) => ({
            student_id: student.id,
            course_code: r.course_code.trim() || null,
            course_name: r.course_name.trim() || r.course_code.trim(),
            letter_grade: r.letter_grade,
            credit_hours: Number(r.credit_hours),
          })) as never,
        );
        if (insErr) throw insErr;
      }
      toast.success("Academic record updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const { gpa, totalCredits, totalPoints } = calculateGPA(rows);
  const rec = getSemesterRecommendation(rows);
  const recToneClass =
    rec.tone === "good"
      ? "text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
      : rec.tone === "ok"
        ? "text-sky-200 border-sky-400/30 bg-sky-400/10"
        : "text-amber-200 border-amber-400/30 bg-amber-400/10";

  const totalCurriculumCredits = 144;
  const remainingCredits = Math.max(0, totalCurriculumCredits - totalCredits);
  const projection = calculateRequiredGrades(
    totalPoints,
    totalCredits,
    targetGpa,
    remainingCredits,
  );

  return (
    <div className="space-y-6 pb-24 md:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">GPA Calculator</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Manage your academic record and track performance
          </p>
        </div>

        <div className="flex w-full sm:w-auto gap-2">
          <Button
            variant="ghost"
            onClick={reset}
            size="sm"
            className="flex-1 sm:flex-none text-muted-foreground h-11 px-4 rounded-xl"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reset
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            size="sm"
            className="flex-1 sm:flex-none shadow-xl h-11 px-6 rounded-xl font-bold"
          >
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-32 right-6 z-[60]">
        <Button
          size="icon"
          className="h-16 w-16 rounded-full shadow-2xl shadow-primary/50 border-2 border-white/20 bg-primary text-primary-foreground"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-8 w-8" />
        </Button>
      </div>

      {/* GPA & Recommendation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-strong rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">
            Current GPA
          </div>
          <div className="text-6xl font-black text-gradient leading-none">{gpa.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground mt-3 font-mono">
            {totalCredits} Total Credits
          </div>
        </div>

        <div
          className={`glass-strong rounded-3xl p-5 border transition-colors ${recToneClass} md:col-span-2`}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-white/10">
              <Settings2 className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-sm uppercase tracking-tight">Smart Recommendation</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-bold leading-tight">{rec.label}</div>
              <div className="text-xs opacity-80 mt-1">Next Term: {rec.credits}</div>
            </div>
            <ul className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4">
              {rec.reasons.slice(0, 3).map((r, idx) => (
                <li key={idx} className="text-[10px] leading-tight flex gap-2">
                  <CheckCircle2 className="h-3 w-3 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_350px] gap-6 items-start">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Course Ledger
            </h2>

            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex rounded-xl h-9 px-4 gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  <Plus className="h-4 w-4" /> Enroll from Curriculum
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl glass-strong border-white/10 p-0 overflow-hidden sm:rounded-3xl h-[88vh] sm:h-[85vh] flex flex-col focus:outline-none">
                <div className="p-4 sm:p-8 flex flex-col h-full overflow-hidden">
                  <DialogHeader className="mb-4 shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tighter">
                      <GraduationCap className="h-7 w-7 text-primary" /> Subject Catalog
                    </DialogTitle>
                  </DialogHeader>

                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-6 shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search courses..."
                        className="pl-11 h-12 bg-white/5 border-white/15 rounded-2xl text-base"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={filterSem} onValueChange={setFilterSem}>
                        <SelectTrigger className="flex-1 sm:w-[140px] h-12 bg-white/5 border-white/15 rounded-2xl text-xs font-bold">
                          <SelectValue placeholder="Sem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Terms</SelectItem>
                          {SEMESTERS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.startsWith("Conc") ? s : `Sem ${s}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant={showUclanOnly ? "default" : "outline"}
                        size="icon"
                        onClick={() => setShowUclanOnly((v) => !v)}
                        className={`h-12 w-12 rounded-2xl transition-all ${showUclanOnly ? "bg-[#FFC000] text-black border-none" : "border-white/15 text-muted-foreground"}`}
                      >
                        <GraduationCap className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-24 sm:pb-2 touch-pan-y overscroll-contain">
                    {filteredCatalog.map((c) => {
                      const enrolled = enrolledCodes.has(c.code);
                      return (
                        <div
                          key={c.code}
                          className={`glass-strong rounded-[1.5rem] p-5 flex items-center justify-between gap-4 border transition-all ${c.uclan ? "border-l-8 border-l-[#FFC000]" : "border-white/5"}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                                {c.code}
                              </span>
                              {c.uclan && (
                                <Badge className="bg-[#FFC000] text-black text-[8px] h-4 border-none font-black uppercase">
                                  UCLAN
                                </Badge>
                              )}
                            </div>
                            <div className="font-bold text-sm sm:text-base truncate tracking-tight">
                              {c.name}
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest opacity-60">
                              {c.credits} Cr • Term {c.semester}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={enrolled ? "ghost" : "default"}
                            disabled={enrolled}
                            onClick={() => enroll(c)}
                            className="rounded-xl px-5 h-10 font-black text-xs uppercase tracking-wider shadow-lg"
                          >
                            {enrolled ? "Added" : "Add"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sm:hidden absolute bottom-6 left-6 right-6 z-[70]">
                    <Button
                      className="w-full h-14 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-black text-xs uppercase tracking-widest border-2 border-white/10 bg-background/80 backdrop-blur-xl"
                      onClick={() => setPickerOpen(false)}
                    >
                      Done Browsing
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-20 text-center animate-pulse italic">
              Retrieving academic history...
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`glass-strong rounded-3xl p-4 sm:p-5 border transition-all ${r.uclan ? "border-l-4 border-l-[#FFC000]" : "border-white/10 hover:border-white/20 shadow-lg"}`}
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-1 w-full space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[110px_1fr_120px_90px] sm:gap-4 items-center">
                      <Input
                        value={r.course_code}
                        onChange={(e) => update(i, { course_code: e.target.value.toUpperCase() })}
                        placeholder="CODE"
                        className="bg-white/5 border-white/10 font-mono text-xs h-9 rounded-xl text-primary"
                      />
                      <div className="relative group">
                        <Input
                          value={r.course_name}
                          onChange={(e) => update(i, { course_name: e.target.value })}
                          placeholder="Course name"
                          className="bg-white/5 border-white/10 h-9 rounded-xl font-medium"
                        />
                        {r.uclan && (
                          <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#FFC000] text-black text-[7px] h-3.5 border-none">
                            UCLAN
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:block">
                        <div className="sm:hidden text-[9px] uppercase font-bold text-muted-foreground mb-1 ml-1">
                          Grade
                        </div>
                        <Select
                          value={r.letter_grade}
                          onValueChange={(v) => update(i, { letter_grade: v })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 h-9 rounded-xl font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADE_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g} className="font-mono">
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:block">
                        <div className="sm:hidden text-[9px] uppercase font-bold text-muted-foreground mb-1 ml-1">
                          Credits
                        </div>
                        <Input
                          type="number"
                          min={1}
                          step={0.5}
                          value={r.credit_hours}
                          onChange={(e) => update(i, { credit_hours: Number(e.target.value) })}
                          className="bg-white/5 border-white/10 h-9 rounded-xl font-mono text-center"
                        />
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(i)}
                      className="text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={addBlank}
                className="w-full h-14 rounded-3xl border-2 border-dashed border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all gap-2 text-muted-foreground hover:text-primary"
              >
                <Plus className="h-5 w-5" />
                <span className="font-bold text-xs uppercase tracking-widest">
                  Manual Course Entry
                </span>
              </Button>
            </div>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="glass-strong rounded-3xl p-6 border border-primary/20 bg-primary/5 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
              <Target className="h-32 w-32 rotate-12" />
            </div>

            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-lg">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold italic tracking-tight">What-If Projection</h3>
            </div>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-2 px-1">
                  Target GPA Goal
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    step={0.01}
                    value={targetGpa}
                    onChange={(e) => setTargetGpa(Number(e.target.value))}
                    className="bg-white/10 border-white/15 h-12 rounded-2xl text-2xl font-black text-primary px-4"
                  />
                  <div className="text-right">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold">
                      Left to earn
                    </div>
                    <div className="text-lg font-mono font-bold">
                      {remainingCredits}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">Cr</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-3xl p-5 border transition-all duration-500 ${projection.isPossible ? "bg-primary/10 border-primary/20" : "bg-destructive/10 border-destructive/20"}`}
              >
                <div className="flex gap-4">
                  {projection.isPossible ? (
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-black uppercase tracking-tight mb-1">
                      {projection.isPossible ? "Feasible Goal" : "Mathematical Limit"}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {projection.message}
                    </p>
                  </div>
                </div>

                {projection.isPossible && (
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-end justify-between">
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase font-black">
                        Maintain Average
                      </div>
                      <div className="text-[10px] text-primary/80 font-semibold italic">
                        Minimum Grade: {projection.recommendedGrade}
                      </div>
                    </div>
                    <div className="text-4xl font-black text-primary leading-none">
                      {projection.requiredAveragePoints.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-strong rounded-3xl p-5 text-[10px] text-muted-foreground space-y-3 leading-relaxed">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#FFC000] shrink-0" />
              <span>UCLAN courses are dual-certified (UK Integration).</span>
            </div>
            <p className="opacity-60 italic">
              Calculations strictly follow AAST 4.0 grading protocols. Final year project credits
              are weighted as standard course hours.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
