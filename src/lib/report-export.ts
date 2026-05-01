import { CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { calculateGPA, GRADE_POINTS } from "@/lib/gpa";

export type ReportExportCourse = {
  course_code: string | null;
  course_name?: string | null;
  letter_grade: string;
  credit_hours: number;
};

export type ReportExportStudent = {
  full_name?: string;
  registration_number?: string;
};

function semesterForCode(code: string | null): string {
  const normalized = (code || "").trim().toUpperCase();
  const sem = normalized && CURRICULUM_BY_CODE[normalized]?.semester;
  return sem ? String(sem) : "Other";
}

function escapeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[\r\n,\"]/g.test(s)) return `"${s.replace(/\"/g, '""')}"`;
  return s;
}

export function buildReportCsv(args: {
  courses: ReportExportCourse[];
  student?: ReportExportStudent;
  generatedAtIso?: string;
}): string {
  const generatedAtIso = args.generatedAtIso || new Date().toISOString();
  const { gpa, totalCredits, totalPoints } = calculateGPA(args.courses);

  const lines: string[] = [];
  lines.push("EduPath Analytics Report");
  if (args.student?.full_name || args.student?.registration_number) {
    lines.push(
      `Student,${escapeCsvCell(args.student?.full_name || "")},${escapeCsvCell(
        args.student?.registration_number || "",
      )}`,
    );
  }
  lines.push(`Generated At,${escapeCsvCell(generatedAtIso)}`);
  lines.push(`Cumulative GPA,${gpa.toFixed(2)}`);
  lines.push(`Total Credits,${totalCredits}`);
  lines.push(`Total Quality Points,${totalPoints.toFixed(2)}`);
  lines.push("");

  lines.push(
    [
      "Semester",
      "Course Code",
      "Course Name",
      "Letter Grade",
      "Grade Points",
      "Credit Hours",
      "Quality Points",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  for (const c of args.courses) {
    const gradePts = GRADE_POINTS[c.letter_grade];
    const credits = Number(c.credit_hours) || 0;
    const qPts = gradePts !== undefined ? gradePts * credits : 0;

    lines.push(
      [
        semesterForCode(c.course_code),
        c.course_code || "",
        c.course_name || "",
        c.letter_grade,
        gradePts !== undefined ? gradePts.toFixed(2) : "",
        credits,
        gradePts !== undefined ? qPts.toFixed(2) : "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReportPdf(args: {
  courses: ReportExportCourse[];
  student?: ReportExportStudent;
  generatedAtIso?: string;
  filename: string;
}) {
  const generatedAtIso = args.generatedAtIso || new Date().toISOString();
  const { gpa, totalCredits, totalPoints } = calculateGPA(args.courses);

  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable =
    (autoTableMod as any).default || (autoTableMod as any).autoTable || (autoTableMod as any);

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text("EduPath Analytics Report", 40, 52);

  doc.setFontSize(10);
  const studentLine = [args.student?.full_name, args.student?.registration_number]
    .filter(Boolean)
    .join(" · ");

  let y = 74;
  if (studentLine) {
    doc.text(studentLine, 40, y);
    y += 14;
  }
  doc.text(`Generated: ${generatedAtIso}`, 40, y);
  y += 18;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    head: [["Cumulative GPA", "Total Credits", "Total Quality Points"]],
    body: [[gpa.toFixed(2), String(totalCredits), totalPoints.toFixed(2)]],
  });

  const afterSummaryY = (doc as any).lastAutoTable?.finalY
    ? (doc as any).lastAutoTable.finalY + 18
    : y + 40;

  const head = [["Semester", "Code", "Name", "Grade", "Pts", "Cr", "QPts"]];
  const body = args.courses.map((c) => {
    const gradePts = GRADE_POINTS[c.letter_grade];
    const credits = Number(c.credit_hours) || 0;
    const qPts = gradePts !== undefined ? gradePts * credits : 0;

    return [
      semesterForCode(c.course_code),
      c.course_code || "",
      c.course_name || "",
      c.letter_grade,
      gradePts !== undefined ? gradePts.toFixed(2) : "",
      String(credits),
      gradePts !== undefined ? qPts.toFixed(2) : "",
    ];
  });

  autoTable(doc, {
    startY: afterSummaryY,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
    head,
    body,
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 56 },
      2: { cellWidth: 190 },
      3: { cellWidth: 44 },
      4: { cellWidth: 38, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 46, halign: "right" },
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(9);
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 18,
      );
    },
  });

  doc.save(args.filename);
}
