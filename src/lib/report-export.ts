import aastLogoUrl from "@/assets/aast-logo.png";
import engLogoUrl from "@/assets/eng-logo.jpg";
import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import { CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { calculateGPA, GRADE_POINTS } from "@/lib/gpa";
import { getSemesterRecommendation } from "@/lib/recommendation";

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

type SemesterSummary = {
  semester: string;
  gpa: number;
  credits: number;
  courses: number;
};

function semesterForCode(code: string | null): string {
  const normalized = (code || "").trim().toUpperCase();
  const sem = normalized && CURRICULUM_BY_CODE[normalized]?.semester;
  return sem ? String(sem) : "Other";
}

function semesterSortKey(sem: string) {
  if (sem === "Other") return 999;
  const conc = sem.match(/^Conc\.\s*(\d+)$/i);
  if (conc) return 900 + Number(conc[1] || 0);
  const n = Number(sem);
  if (Number.isFinite(n)) return n;
  return 950;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type PdfImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

async function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

async function loadPdfImage(url: string): Promise<PdfImage | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await getImageSize(dataUrl);
    const format = blob.type === "image/png" ? "PNG" : "JPEG";
    return { dataUrl, format, width, height };
  } catch {
    return null;
  }
}

function escapeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[\r\n,"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeCourses(courses: ReportExportCourse[]) {
  return courses.map((c) => ({
    ...c,
    course_code: c.course_code ? c.course_code.trim().toUpperCase() : null,
    course_name: c.course_name ? c.course_name.trim() : c.course_name,
    credit_hours: Number(c.credit_hours) || 0,
  }));
}

function buildSemesterSummary(courses: ReportExportCourse[]): SemesterSummary[] {
  const groups = new Map<string, ReportExportCourse[]>();
  for (const c of courses) {
    const sem = semesterForCode(c.course_code);
    const arr = groups.get(sem) || [];
    arr.push(c);
    groups.set(sem, arr);
  }

  return [...groups.entries()]
    .map(([semester, items]) => {
      const r = calculateGPA(items);
      return {
        semester,
        gpa: Number(r.gpa.toFixed(2)),
        credits: r.totalCredits,
        courses: items.length,
      };
    })
    .sort((a, b) => semesterSortKey(a.semester) - semesterSortKey(b.semester));
}

export function buildReportCsv(args: {
  courses: ReportExportCourse[];
  student?: ReportExportStudent;
  generatedAtIso?: string;
}): string {
  const generatedAtIso = args.generatedAtIso || new Date().toISOString();
  const generatedAtLocal = formatDateTime(generatedAtIso);

  const normalizedCourses = normalizeCourses(args.courses);
  const cumulative = calculateGPA(normalizedCourses);
  const semesterSummary = buildSemesterSummary(normalizedCourses);
  const rec = getSemesterRecommendation(normalizedCourses);

  const studentName = args.student?.full_name || "";
  const reg = args.student?.registration_number || "";

  const header = [
    "row_type",
    "generated_at_iso",
    "generated_at_local",
    "student_name",
    "registration_number",
    "cumulative_gpa",
    "total_credits",
    "total_quality_points",
    "semester",
    "semester_gpa",
    "semester_credits",
    "semester_courses",
    "course_code",
    "course_name",
    "letter_grade",
    "grade_points",
    "credit_hours",
    "quality_points",
    "recommended_load",
    "recommended_label",
    "recommended_credits",
    "latest_semester",
    "latest_semester_gpa",
  ];

  const rows: unknown[][] = [];

  rows.push([
    "SUMMARY",
    generatedAtIso,
    generatedAtLocal,
    studentName,
    reg,
    cumulative.gpa.toFixed(2),
    cumulative.totalCredits,
    cumulative.totalPoints.toFixed(2),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    rec.load,
    rec.label,
    rec.credits,
    rec.latestSemester || "",
    rec.latestSemesterGpa !== undefined ? rec.latestSemesterGpa.toFixed(2) : "",
  ]);

  for (const s of semesterSummary) {
    rows.push([
      "SEMESTER_SUMMARY",
      generatedAtIso,
      generatedAtLocal,
      studentName,
      reg,
      cumulative.gpa.toFixed(2),
      cumulative.totalCredits,
      cumulative.totalPoints.toFixed(2),
      s.semester,
      s.gpa.toFixed(2),
      s.credits,
      s.courses,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const sortedCourses = [...normalizedCourses].sort((a, b) => {
    const sa = semesterForCode(a.course_code);
    const sb = semesterForCode(b.course_code);
    const sk = semesterSortKey(sa) - semesterSortKey(sb);
    if (sk !== 0) return sk;

    const ca = (a.course_code || "").localeCompare(b.course_code || "");
    if (ca !== 0) return ca;

    return (a.course_name || "").localeCompare(b.course_name || "");
  });

  for (const c of sortedCourses) {
    const sem = semesterForCode(c.course_code);
    const pts = GRADE_POINTS[c.letter_grade];
    const credits = Number(c.credit_hours) || 0;
    const qPts = pts !== undefined ? pts * credits : 0;

    rows.push([
      "COURSE",
      generatedAtIso,
      generatedAtLocal,
      studentName,
      reg,
      cumulative.gpa.toFixed(2),
      cumulative.totalCredits,
      cumulative.totalPoints.toFixed(2),
      sem,
      "",
      "",
      "",
      c.course_code || "",
      c.course_name || "",
      c.letter_grade,
      pts !== undefined ? pts.toFixed(2) : "",
      credits,
      pts !== undefined ? qPts.toFixed(2) : "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const lines: string[] = [];
  lines.push(header.map(escapeCsvCell).join(","));
  for (const r of rows) lines.push(r.map(escapeCsvCell).join(","));
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
  const generatedAtLocal = formatDateTime(generatedAtIso);

  const normalizedCourses = normalizeCourses(args.courses);
  const cumulative = calculateGPA(normalizedCourses);
  const semesterSummary = buildSemesterSummary(normalizedCourses);
  const rec = getSemesterRecommendation(normalizedCourses);

  type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;
  type AutoTableModule = { default?: AutoTableFn; autoTable?: AutoTableFn };

  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable =
    (autoTableMod as unknown as AutoTableModule).default ??
    (autoTableMod as unknown as AutoTableModule).autoTable;
  if (!autoTable) throw new Error("Failed to load PDF table module");

  type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY?: number } };

  const doc = new jsPDF({ unit: "pt", format: "a4" }) as JsPdfWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const [aastLogo, engLogo] = await Promise.all([
    loadPdfImage(aastLogoUrl),
    loadPdfImage(engLogoUrl),
  ]);

  const margin = 40;
  const headerH = 78;

  // Header bar
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, headerH, "F");
  doc.setFillColor(59, 130, 246);
  doc.rect(0, headerH - 4, pageWidth, 4, "F");

  const drawLogoBox = (args: {
    x: number;
    y: number;
    w: number;
    h: number;
    img: PdfImage | null;
  }) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(args.x, args.y, args.w, args.h, 10, 10, "F");

    if (!args.img) return;

    const pad = 6;
    const maxW = args.w - pad * 2;
    const maxH = args.h - pad * 2;
    const scale = Math.min(maxW / args.img.width, maxH / args.img.height);
    const w = args.img.width * scale;
    const h = args.img.height * scale;

    doc.addImage(
      args.img.dataUrl,
      args.img.format,
      args.x + (args.w - w) / 2,
      args.y + (args.h - h) / 2,
      w,
      h,
    );
  };

  // Logos (AAST + College of Engineering)
  const logoH = 44;
  const engW = 44;
  const aastW = 92;
  const logoGap = 8;
  const logoY = 16;
  const totalLogoW = engW + logoGap + aastW;
  const logoX = pageWidth - margin - totalLogoW;

  drawLogoBox({ x: logoX, y: logoY, w: engW, h: logoH, img: engLogo });
  drawLogoBox({ x: logoX + engW + logoGap, y: logoY, w: aastW, h: logoH, img: aastLogo });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("EduPath Analytics Portal", margin, 34);
  doc.setFontSize(12);
  doc.text("Academic Performance Report", margin, 54);
  doc.setFontSize(9);
  doc.text("AAST · College of Engineering & Technology", margin, 66);
  doc.text(`Generated: ${generatedAtLocal}`, margin, 76);

  // Student box
  let y = headerH + 26;
  doc.setTextColor(15, 23, 42);

  const studentName = args.student?.full_name || "";
  const reg = args.student?.registration_number || "";
  if (studentName || reg) {
    const boxH = 54;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 10, 10, "FD");

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Student", margin + 14, y + 18);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(studentName || "—", margin + 14, y + 36);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(reg ? `Registration: ${reg}` : "", pageWidth - margin - 14, y + 36, {
      align: "right",
    });

    y += boxH + 14;
  }

  // KPI cards
  const cardGap = 10;
  const cardW = (pageWidth - margin * 2 - cardGap * 2) / 3;
  const cardH = 54;
  const cardY = y;

  const drawCard = (x: number, label: string, value: string) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, cardY, cardW, cardH, 10, 10, "FD");

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(label, x + 12, cardY + 18);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text(value, x + 12, cardY + 42);
  };

  drawCard(margin, "Cumulative GPA", cumulative.gpa.toFixed(2));
  drawCard(margin + cardW + cardGap, "Total Credits", String(cumulative.totalCredits));
  drawCard(margin + (cardW + cardGap) * 2, "Courses", String(normalizedCourses.length));

  y = cardY + cardH + 18;

  // Recommendation box
  const recBoxH = 72;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, pageWidth - margin * 2, recBoxH, 10, 10, "FD");

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Next Semester Recommendation", margin + 14, y + 18);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${rec.label} · ${rec.credits}`, margin + 14, y + 38);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const reasonText = rec.reasons
    .slice(0, 3)
    .map((r) => `• ${r}`)
    .join("\n");
  const reasonLines = doc.splitTextToSize(reasonText, pageWidth - margin * 2 - 28);
  doc.text(reasonLines, margin + 14, y + 54);

  y += recBoxH + 18;

  // Semester Breakdown
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Semester Breakdown", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    head: [["Semester", "GPA", "Credits", "Courses"]],
    body: semesterSummary.map((s) => [
      s.semester,
      s.gpa.toFixed(2),
      String(s.credits),
      String(s.courses),
    ]),
    columnStyles: {
      0: { cellWidth: 170 },
      1: { halign: "right", cellWidth: 70 },
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 70 },
    },
  });

  y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 18 : y + 80;

  // Courses table
  doc.setFontSize(12);
  doc.text("Courses", margin, y);
  y += 10;

  const sortedCourses = [...normalizedCourses].sort((a, b) => {
    const sa = semesterForCode(a.course_code);
    const sb = semesterForCode(b.course_code);
    const sk = semesterSortKey(sa) - semesterSortKey(sb);
    if (sk !== 0) return sk;
    const ca = (a.course_code || "").localeCompare(b.course_code || "");
    if (ca !== 0) return ca;
    return (a.course_name || "").localeCompare(b.course_name || "");
  });

  const courseBody = sortedCourses.map((c) => {
    const sem = semesterForCode(c.course_code);
    const pts = GRADE_POINTS[c.letter_grade];
    const credits = Number(c.credit_hours) || 0;
    const qPts = pts !== undefined ? pts * credits : 0;

    return [
      sem,
      c.course_code || "",
      c.course_name || "",
      c.letter_grade,
      pts !== undefined ? pts.toFixed(2) : "",
      String(credits),
      pts !== undefined ? qPts.toFixed(2) : "",
    ];
  });

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8.6, cellPadding: 4, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    head: [["Sem", "Code", "Course", "Grade", "Pts", "Cr", "QPts"]],
    body: courseBody,
    foot: [
      [
        "",
        "",
        "Totals",
        "",
        "",
        String(cumulative.totalCredits),
        cumulative.totalPoints.toFixed(2),
      ],
    ],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 58 },
      2: { cellWidth: 210 },
      3: { cellWidth: 44 },
      4: { cellWidth: 44, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
      6: { cellWidth: 52, halign: "right" },
    },
    didDrawPage: () => {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`EduPath Analytics · ${generatedAtLocal}`, margin, pageHeight - 18);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 18, {
        align: "right",
      });
    },
  });

  doc.save(args.filename);
}
