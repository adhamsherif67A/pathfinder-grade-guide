import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADE_OPTIONS, calculateGPA } from "@/lib/gpa";
import { getSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gpa-calculator")({
  component: GpaCalculatorPage,
});

type Row = {
  id?: string;
  course_name: string;
  letter_grade: string;
  credit_hours: number;
};

function emptyRow(): Row {
  return { course_name: "", letter_grade: "A", credit_hours: 3 };
}

function GpaCalculatorPage() {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) return;
    supabase
      .from("courses")
      .select("id, course_name, letter_grade, credit_hours")
      .eq("student_id", s.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRows(
            data.map((d) => ({
              id: d.id,
              course_name: d.course_name,
              letter_grade: d.letter_grade,
              credit_hours: Number(d.credit_hours),
            })),
          );
        }
        setLoading(false);
      });
  }, []);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const remove = (i: number) =>
    setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((_, idx) => idx !== i)));

  const add = () => setRows((rs) => [...rs, emptyRow()]);

  const reset = () => setRows([emptyRow()]);

  const save = async () => {
    const s = getSession();
    if (!s) return;
    setSaving(true);
    try {
      const valid = rows.filter(
        (r) => r.course_name.trim() && r.letter_grade && Number(r.credit_hours) > 0,
      );
      const { error: delErr } = await supabase.from("courses").delete().eq("student_id", s.id);
      if (delErr) throw delErr;
      if (valid.length > 0) {
        const { error: insErr } = await supabase.from("courses").insert(
          valid.map((r) => ({
            student_id: s.id,
            course_name: r.course_name.trim(),
            letter_grade: r.letter_grade,
            credit_hours: Number(r.credit_hours),
          })),
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

  const { gpa, totalCredits } = calculateGPA(rows);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gradient">GPA Calculator</h1>
            <p className="text-muted-foreground text-sm">
              Add your courses — your data is auto-loaded and saved to your account
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <section className="glass-strong rounded-2xl p-5">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[1fr_140px_120px_44px] gap-3 px-2 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <div>Course</div>
                  <div>Grade</div>
                  <div>Credits</div>
                  <div></div>
                </div>
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      className="glass rounded-xl p-3 grid md:grid-cols-[1fr_140px_120px_44px] grid-cols-2 gap-3 items-center"
                    >
                      <Input
                        value={r.course_name}
                        onChange={(e) => update(i, { course_name: e.target.value })}
                        placeholder="Course name"
                        className="bg-white/5 border-white/15 col-span-2 md:col-span-1"
                      />
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
                        min={0}
                        step={0.5}
                        value={r.credit_hours}
                        onChange={(e) =>
                          update(i, { credit_hours: Number(e.target.value) })
                        }
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
                <Button variant="ghost" onClick={add} className="mt-3 w-full border border-dashed border-white/15">
                  <Plus className="h-4 w-4 mr-1" /> Add course
                </Button>
              </>
            )}
          </section>

          <aside className="glass-strong rounded-2xl p-6 h-max sticky top-24">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your GPA</div>
            <div className="text-6xl font-bold text-gradient mt-1">{gpa.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              across {totalCredits} credit hours
            </div>
            <div className="mt-5 pt-5 border-t border-white/10 text-xs text-muted-foreground space-y-1">
              <div>Formula:</div>
              <div className="font-mono text-foreground/90">
                Σ(points × credits) / Σ(credits)
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
