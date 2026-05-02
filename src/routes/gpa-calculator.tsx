import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, RotateCcw, Search, GraduationCap, Target, AlertCircle, CheckCircle2 } from "lucide-react";
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
    if (enrolledCodes.has(c.code)) {
      toast.info(`${c.code} already enrolled`);
      return;
    }
    setRows((rs) => {
      // replace a trailing empty row, otherwise append
      const last = rs[rs.length - 1];
      if (last && !last.course_code && !last.course_name.trim()) {
        return [...rs.slice(0, -1), rowFromCurriculum(c)];
      }
      return [...rs, rowFromCurriculum(c)];
    });
    toast.success(`Enrolled in ${c.code}`);
  };

  const reset = () => setRows([emptyRow()]);

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
      toast.success("Courses saved");
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
  const projection = calculateRequiredGrades(totalPoints, totalCredits, targetGpa, remainingCredits);

  return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gradient">GPA Calculator</h1>
            <p className="text-muted-foreground text-sm">
              Enroll in subjects from the Mechatronics curriculum and track your grades
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <DialogTrigger asChild>
                <Button>
                  <GraduationCap className="h-4 w-4 mr-1" /> Enroll in subject
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl glass-strong border-white/10">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Mechatronics Curriculum
                    <span className="text-xs font-normal text-muted-foreground">
                      144 Cr. Hr. · 8 Semesters · AAST × UCLAN
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by code or name..."
                      className="pl-8 bg-white/5 border-white/15"
                    />
                  </div>
                  <Select value={filterSem} onValueChange={setFilterSem}>
                    <SelectTrigger className="w-[160px] bg-white/5 border-white/15">
                      <SelectValue placeholder="Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All semesters</SelectItem>
                      {SEMESTERS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.startsWith("Conc") ? s : `Semester ${s}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={showUclanOnly ? "default" : "ghost"}
                    onClick={() => setShowUclanOnly((v) => !v)}
                    className="gap-1"
                  >
                    <span className="h-2 w-2 rounded-full bg-[#FFC000]" />
                    UCLAN only
                  </Button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1.5">
                  {filteredCatalog.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No subjects match your filters.
                    </div>
                  )}
                  {filteredCatalog.map((c) => {
                    const enrolled = enrolledCodes.has(c.code);
                    return (
                      <div
                        key={c.code}
                        className={`glass rounded-lg p-3 flex items-center gap-3 ${
                          c.uclan ? "border-l-4 border-l-[#FFC000]" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/10">
                              {c.code}
                            </span>
                            <span className="font-medium truncate">{c.name}</span>
                            {c.uclan && (
                              <Badge className="bg-[#FFC000] text-black hover:bg-[#FFC000] text-[10px]">
                                UCLAN
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.credits} cr · Sem {c.semester}
                            {c.prerequisite ? ` · prereq: ${c.prerequisite}` : ""}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={enrolled ? "ghost" : "default"}
                          disabled={enrolled}
                          onClick={() => enroll(c)}
                        >
                          {enrolled ? "Enrolled" : "Enroll"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_350px] gap-6">
          <section className="glass-strong rounded-2xl p-5">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[110px_1fr_140px_110px_44px] gap-3 px-2 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <div>Code</div>
                  <div>Course</div>
                  <div>Grade</div>
                  <div>Credits</div>
                  <div></div>
                </div>
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      className={`glass rounded-xl p-3 grid md:grid-cols-[110px_1fr_140px_110px_44px] grid-cols-2 gap-3 items-center ${
                        r.uclan ? "border-l-4 border-l-[#FFC000]" : ""
                      }`}
                    >
                      <Input
                        value={r.course_code}
                        onChange={(e) => update(i, { course_code: e.target.value.toUpperCase() })}
                        placeholder="Code"
                        className="bg-white/5 border-white/15 font-mono text-xs"
                      />
                      <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                        <Input
                          value={r.course_name}
                          onChange={(e) => update(i, { course_name: e.target.value })}
                          placeholder="Course name"
                          className="bg-white/5 border-white/15"
                        />
                        {r.uclan && (
                          <Badge className="bg-[#FFC000] text-black hover:bg-[#FFC000] text-[10px] shrink-0">
                            UCLAN
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={r.letter_grade}
                        onValueChange={(v) => update(i, { letter_grade: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/15">
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
                        min={1}
                        step={0.5}
                        value={r.credit_hours}
                        onChange={(e) => update(i, { credit_hours: Number(e.target.value) })}
                        className="bg-white/5 border-white/15"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(i)}
                        aria-label="Remove course"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  onClick={addBlank}
                  className="mt-3 w-full border border-dashed border-white/15"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add blank row
                </Button>
              </>
            )}
          </section>

          <aside className="space-y-6 sticky top-24 h-max">
            <div className="glass-strong rounded-2xl p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current GPA</div>
              <div className="text-6xl font-bold text-gradient mt-1">{gpa.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground mt-1">
                across {totalCredits} credit hours
              </div>
              <div className={`glass rounded-xl p-4 border mt-5 ${recToneClass}`}>
                <div className="text-xs uppercase tracking-wider opacity-80">Next semester</div>
                <div className="text-sm font-semibold mt-1">{rec.label}</div>
                <div className="text-xs opacity-80 mt-1">Suggested: {rec.credits}</div>
                <ul className="mt-3 space-y-1 text-[11px] opacity-90">
                  {rec.reasons.slice(0, 2).map((r, idx) => (
                    <li key={idx}>• {r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-6 border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold italic">What-If Projection</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Target Cumulative GPA
                  </label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      min={1} 
                      max={4} 
                      step={0.01} 
                      value={targetGpa}
                      onChange={(e) => setTargetGpa(Number(e.target.value))}
                      className="bg-white/10 border-white/20 h-10 text-lg font-bold"
                    />
                    <div className="text-xs text-muted-foreground">
                      Remaining: <span className="text-foreground font-mono">{remainingCredits}</span> cr
                    </div>
                  </div>
                </div>

                <div className={`glass rounded-xl p-4 border ${projection.isPossible ? 'border-primary/30 bg-primary/10' : 'border-destructive/30 bg-destructive/10'}`}>
                  <div className="flex gap-3">
                    {projection.isPossible ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-semibold leading-tight mb-1">
                        {projection.isPossible ? 'Target Reachable' : 'Target Out of Reach'}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        {projection.message}
                      </p>
                    </div>
                  </div>
                  
                  {projection.isPossible && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-tight">Required Average</div>
                      <div className="text-xl font-black text-primary">{projection.requiredAveragePoints.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-4 text-[10px] text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FFC000]" />
                <span>UCLAN courses (University of Central Lancashire, UK)</span>
              </div>
              <p>Projection assumes you complete the full 144-credit Mechatronics program.</p>
            </div>
          </aside>
        </div>
      </div>
  );
}

