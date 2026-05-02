import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calculateGPA, GRADE_POINTS } from "@/lib/gpa";

export const Route = createFileRoute("/students/$studentId")({
  component: StudentProfilePage,
});

type StudentRow = {
  id: string;
  full_name: string;
  registration_number: string;
  program?: string | null;
  level?: string | null;
  enrollment_year?: number | null;
  credits_earned?: number | null;
};

type NoteRow = {
  id: string;
  visibility: "shared" | "advisor_only";
  body: string;
  created_at: string;
  author_id: string;
};

type CourseRow = {
  course_code: string | null;
  course_name: string | null;
  letter_grade: string;
  credit_hours: number;
  term?: string | null;
};

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const { profile, role } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: s, error: sErr } = await supabase
        .from("students")
        .select("id,full_name,registration_number,program,level,enrollment_year,credits_earned")
        .eq("id", studentId)
        .single();
      if (sErr) throw sErr;

      const { data: c, error: cErr } = await supabase
        .from("courses")
        .select("course_code,course_name,letter_grade,credit_hours,term")
        .eq("student_id", studentId);
      if (cErr) throw cErr;

      const { data: n, error: nErr } = await supabase
        .from("student_notes")
        .select("id,visibility,body,created_at,author_id")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (nErr) throw nErr;

      setStudent({
        id: s.id,
        full_name: s.full_name,
        registration_number: s.registration_number,
        program: s.program ?? null,
        level: s.level ?? null,
        enrollment_year: s.enrollment_year ?? null,
        credits_earned: Number(s.credits_earned ?? 0),
      });
      setCourses(
        (c || []).map((row) => ({
          course_code: row.course_code ?? null,
          course_name: row.course_name ?? null,
          letter_grade: row.letter_grade,
          credit_hours: Number(row.credit_hours),
          term: row.term ?? null,
        })),
      );
      setNotes(
        (n || []).map((row) => ({
          id: row.id,
          visibility: row.visibility as NoteRow["visibility"],
          body: row.body,
          created_at: row.created_at,
          author_id: row.author_id,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load student profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const overall = useMemo(() => {
    const rows = courses.map((c) => ({
      course_code: c.course_code,
      course_name: c.course_name,
      letter_grade: c.letter_grade,
      credit_hours: c.credit_hours,
    }));
    return calculateGPA(rows);
  }, [courses]);

  const termTrend = useMemo(() => {
    const byTerm = new Map<string, CourseRow[]>();
    for (const c of courses) {
      const t = (c.term || "(no term)").trim() || "(no term)";
      byTerm.set(t, [...(byTerm.get(t) || []), c]);
    }
    return Array.from(byTerm.entries())
      .map(([term, cs]) => {
        const r = calculateGPA(
          cs.map((x) => ({
            course_code: x.course_code,
            course_name: x.course_name,
            letter_grade: x.letter_grade,
            credit_hours: x.credit_hours,
          })),
        );
        return { term, gpa: r.gpa, credits: r.totalCredits };
      })
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [courses]);

  const submitNote = async () => {
    if (!profile) return;
    const body = noteBody.trim();
    if (!body) return;

    setSavingNote(true);
    try {
      const { error } = await supabase.from("student_notes").insert({
        student_id: studentId,
        author_id: profile.id,
        visibility: role === "student" ? "shared" : "advisor_only",
        body,
      });
      if (error) throw error;
      setNoteBody("");
      toast.success("Note added");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add note");
    } finally {
      setSavingNote(false);
    }
  };

  const passedCount = useMemo(() => {
    return courses.filter(
      (c) => (GRADE_POINTS[c.letter_grade as keyof typeof GRADE_POINTS] ?? 0) !== 0,
    ).length;
  }, [courses]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Student Profile</h1>
          <p className="text-sm text-muted-foreground">Program, progress, GPA trend, and notes</p>
        </div>

        {loading || !student ? (
          <section className="glass-strong rounded-2xl p-6 text-sm text-muted-foreground">
            Loading…
          </section>
        ) : (
          <>
            <section className="glass-strong rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold">{student.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {student.registration_number}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {student.program || "—"} · {student.level || "—"}
                    {student.enrollment_year ? ` · ${student.enrollment_year}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Overall GPA: {overall.gpa.toFixed(2)}</Badge>
                  <Badge variant="secondary">Passed: {passedCount}</Badge>
                  <Badge variant="secondary">
                    Credits: {Number(student.credits_earned ?? 0).toFixed(0)}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 grid md:grid-cols-3 gap-4">
                {termTrend.slice(-3).map((t) => (
                  <div key={t.term} className="glass rounded-xl p-4">
                    <div className="text-xs text-muted-foreground">{t.term}</div>
                    <div className="text-2xl font-bold mt-1">{t.gpa.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{t.credits} credits</div>
                  </div>
                ))}
                {termTrend.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No term data yet.</div>
                ) : null}
              </div>
            </section>

            <section className="glass-strong rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Notes</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Students can add shared notes. Advisors can add advisor-only notes.
              </p>

              <div className="mt-4 space-y-2">
                <Label htmlFor="note">Add a note</Label>
                <Input
                  id="note"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={
                    role === "student"
                      ? "E.g. I need help picking electives"
                      : "E.g. Discuss probation risk"
                  }
                  className="bg-white/5 border-white/15"
                />
                <Button onClick={submitNote} disabled={savingNote || !noteBody.trim()}>
                  {savingNote ? "Saving…" : "Add note"}
                </Button>
              </div>

              <div className="mt-6 space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant={n.visibility === "advisor_only" ? "destructive" : "secondary"}
                      >
                        {n.visibility}
                      </Badge>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm mt-2 whitespace-pre-wrap">{n.body}</div>
                  </div>
                ))}
                {notes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No notes yet.</div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
