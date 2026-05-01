import { CURRICULUM_BY_CODE } from "@/lib/curriculum";
import { calculateGPA } from "@/lib/gpa";

export type CourseLike = {
  course_code?: string | null;
  letter_grade: string;
  credit_hours: number;
};

export type SemesterLoad = "half" | "normal" | "overload";

export type SemesterRecommendation = {
  load: SemesterLoad;
  label: string;
  credits: string;
  tone: "good" | "ok" | "warn";
  reasons: string[];
  cumulativeGpa: number;
  latestSemester?: string;
  latestSemesterGpa?: number;
};

function semesterForCode(code: string | null | undefined): string {
  const normalized = (code || "").trim().toUpperCase();
  const sem = normalized && CURRICULUM_BY_CODE[normalized]?.semester;
  return sem ? String(sem) : "Other";
}

function semesterSortKey(sem: string) {
  if (sem === "Other") return -1;
  const conc = sem.match(/^Conc\.\s*(\d+)$/i);
  if (conc) return 900 + Number(conc[1] || 0);
  const n = Number(sem);
  if (Number.isFinite(n)) return n;
  return 0;
}

const LOW_GRADES = new Set(["D", "D+", "C-"]);

export function getSemesterRecommendation(courses: CourseLike[]): SemesterRecommendation {
  const normalized = courses.map((c) => ({
    course_code: c.course_code ?? null,
    letter_grade: c.letter_grade,
    credit_hours: Number(c.credit_hours) || 0,
  }));

  const cumulative = calculateGPA(normalized);

  // Find latest semester based on known curriculum mapping (ignore "Other" unless it's the only thing)
  const groups = new Map<string, CourseLike[]>();
  for (const c of normalized) {
    const sem = semesterForCode(c.course_code);
    const arr = groups.get(sem) || [];
    arr.push(c);
    groups.set(sem, arr);
  }

  const semesters = [...groups.keys()].filter((s) => s !== "Other");
  const latestSemester =
    semesters.length > 0
      ? semesters.sort((a, b) => semesterSortKey(b) - semesterSortKey(a))[0]
      : groups.has("Other")
        ? "Other"
        : undefined;

  const latestCourses = latestSemester ? groups.get(latestSemester) || [] : [];
  const latest = latestCourses.length ? calculateGPA(latestCourses) : null;

  const failCount = normalized.filter((c) => c.letter_grade === "F").length;
  const hasFail = failCount > 0;
  const lowCount = normalized.filter((c) => LOW_GRADES.has(c.letter_grade)).length;

  const latestFailCount = latestCourses.filter((c) => c.letter_grade === "F").length;
  const latestHasFail = latestFailCount > 0;
  const latestLowCount = latestCourses.filter((c) => LOW_GRADES.has(c.letter_grade)).length;

  const cumulativeGpa = cumulative.gpa;
  const latestGpa = latest?.gpa;

  const perfSummary =
    latestGpa !== undefined && latestSemester
      ? `Cumulative GPA ${cumulativeGpa.toFixed(2)} · Latest term (${latestSemester}) GPA ${latestGpa.toFixed(2)}.`
      : `Cumulative GPA ${cumulativeGpa.toFixed(2)}.`;

  const gradeFlags: string[] = [];
  if (latestHasFail) gradeFlags.push(`${latestFailCount} fail(s) in latest term`);
  if (latestLowCount > 0)
    gradeFlags.push(`${latestLowCount} low grade(s) in latest term (C-/D+/D)`);
  if (!latestHasFail && !latestLowCount) gradeFlags.push("No low grades in latest term");

  if (hasFail && !latestHasFail) gradeFlags.push(`${failCount} fail(s) overall`);
  if (lowCount > 0 && latestLowCount === 0) gradeFlags.push(`${lowCount} low grade(s) overall`);

  // Rules (tunable): use BOTH cumulative and latest term performance
  const needsHalf =
    cumulativeGpa < 2.0 ||
    hasFail ||
    lowCount >= 3 ||
    (latestGpa !== undefined && latestGpa < 2.2) ||
    latestHasFail ||
    latestLowCount >= 2;

  const canOverload =
    cumulativeGpa >= 3.5 &&
    (latestGpa === undefined || latestGpa >= 3.5) &&
    !hasFail &&
    lowCount === 0;

  if (needsHalf) {
    return {
      load: "half",
      label: "Half Load Recommended",
      credits: "9–12 credits",
      tone: "warn",
      reasons: [
        "Half-load is recommended to recover performance and avoid repeating low results.",
        perfSummary,
        `Grade signals: ${gradeFlags.join(" · ")}.`,
      ],
      cumulativeGpa,
      latestSemester,
      latestSemesterGpa: latestGpa,
    };
  }

  if (canOverload) {
    return {
      load: "overload",
      label: "Overload Eligible",
      credits: "21+ credits",
      tone: "good",
      reasons: [
        "You’re performing strongly — an overload is reasonable if you can commit the time.",
        perfSummary,
        `Grade signals: ${gradeFlags.join(" · ")}.`,
      ],
      cumulativeGpa,
      latestSemester,
      latestSemesterGpa: latestGpa,
    };
  }

  return {
    load: "normal",
    label: "Normal Load Recommended",
    credits: "15–18 credits",
    tone: "ok",
    reasons: [
      "Normal load keeps you progressing while protecting your GPA.",
      perfSummary,
      `Grade signals: ${gradeFlags.join(" · ")}.`,
    ],
    cumulativeGpa,
    latestSemester,
    latestSemesterGpa: latestGpa,
  };
}
