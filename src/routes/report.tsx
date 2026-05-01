import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { calculateGPA, GRADE_POINTS } from "@/lib/gpa";
import {
  buildReportCsv,
  downloadCsv,
  downloadReportPdf,
  type ReportExportCourse,
} from "@/lib/report-export";
import { decodeReportSharePayload, type ReportSharePayloadV1 } from "@/lib/report-share";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function semesterForCode(code: string | null): string {
  const normalized = (code || "").trim().toUpperCase();
  const sem = normalized && CURRICULUM_BY_CODE[normalized]?.semester;
  return sem ? String(sem) : "Other";
}

function ReportPage() {
  const [payload, setPayload] = useState<ReportSharePayloadV1 | null>(null);

  useEffect(() => {
    setPayload(decodeReportSharePayload(window.location.hash));
  }, []);

  const courses: ReportExportCourse[] = useMemo(() => {
    return (payload?.courses || []).map((c) => ({
      course_code: c.course_code,
      course_name: c.course_name || null,
      letter_grade: c.letter_grade,
      credit_hours: Number(c.credit_hours),
    }));
  }, [payload]);

  const summary = useMemo(() => calculateGPA(courses), [courses]);
  const generatedAtIso = payload?.generated_at || new Date().toISOString();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Report link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const exportCsv = () => {
    if (courses.length === 0) return;
    const csv = buildReportCsv({
      courses,
      student: payload?.student,
      generatedAtIso,
    });
    const reg = payload?.student?.registration_number || "student";
    downloadCsv(`edupath-report-${reg}.csv`, csv);
    toast.success("CSV downloaded");
  };

  const exportPdf = async () => {
    if (courses.length === 0) return;
    const reg = payload?.student?.registration_number || "student";
    await downloadReportPdf({
      courses,
      student: payload?.student,
      generatedAtIso,
      filename: `edupath-report-${reg}.pdf`,
    });
    toast.success("PDF downloaded");
  };

  return (
    <AppShell requireAuth={false}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Shareable Report</h1>
            <p className="text-muted-foreground text-sm">
              {payload?.student?.full_name ? payload.student.full_name : "Open from a share link."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyLink} disabled={!payload}>
              <Link2 className="h-4 w-4 mr-1" /> Copy Link
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={courses.length === 0}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button onClick={exportPdf} disabled={courses.length === 0}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {!payload ? (
          <section className="glass-strong rounded-2xl p-6">
            <h2 className="text-lg font-semibold">No report data</h2>
            <p className="text-sm text-muted-foreground mt-2">
              This page expects a share hash in the URL. Go to your dashboard and click “Copy share
              link”.
            </p>
            <div className="mt-4">
              <Link to="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="glass-strong rounded-2xl p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">GPA</div>
                <div className="text-2xl font-bold">{summary.gpa.toFixed(2)}</div>
              </div>
              <div className="glass-strong rounded-2xl p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total Credits
                </div>
                <div className="text-2xl font-bold">{summary.totalCredits}</div>
              </div>
              <div className="glass-strong rounded-2xl p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Courses
                </div>
                <div className="text-2xl font-bold">{courses.length}</div>
              </div>
            </div>

            <section className="glass-strong rounded-2xl p-6">
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Courses</h2>
                  <p className="text-xs text-muted-foreground">Generated at {generatedAtIso}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sem</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                    <TableHead className="text-right">Cr</TableHead>
                    <TableHead className="text-right">QPts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c, idx) => {
                    const pts = GRADE_POINTS[c.letter_grade];
                    const cr = Number(c.credit_hours) || 0;
                    const qpts = pts !== undefined ? pts * cr : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">
                          {semesterForCode(c.course_code)}
                        </TableCell>
                        <TableCell className="font-mono">{c.course_code || ""}</TableCell>
                        <TableCell>{c.course_name || ""}</TableCell>
                        <TableCell className="font-mono font-semibold">{c.letter_grade}</TableCell>
                        <TableCell className="text-right font-mono">
                          {pts !== undefined ? pts.toFixed(2) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono">{cr}</TableCell>
                        <TableCell className="text-right font-mono">
                          {pts !== undefined ? qpts.toFixed(2) : ""}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <p className="text-[11px] text-muted-foreground mt-4">
                Tip: exports are generated locally in your browser.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
