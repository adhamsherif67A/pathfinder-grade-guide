export const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 3.83,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
  W: 0.0,
};

export const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

export type CourseInput = {
  letter_grade: string;
  credit_hours: number;
};

export function calculateGPA(courses: CourseInput[]): {
  gpa: number;
  totalCredits: number;
  totalPoints: number;
} {
  let totalPoints = 0;
  let totalCredits = 0;
  for (const c of courses) {
    // 'W' (Withdrawn) does not affect GPA divisor or points
    if (c.letter_grade === "W") continue;

    const pts = GRADE_POINTS[c.letter_grade];
    const credits = Number(c.credit_hours) || 0;
    if (pts === undefined || credits <= 0) continue;
    totalPoints += pts * credits;
    totalCredits += credits;
  }
  const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  return { gpa, totalCredits, totalPoints };
}

export function loadRecommendation(gpa: number): {
  label: string;
  credits: string;
  tone: "good" | "ok" | "warn";
} {
  if (gpa >= 3.0)
    return { label: "Excellent — heavy load OK", credits: "18–21 credits", tone: "good" };
  if (gpa >= 2.5) return { label: "Steady — standard load", credits: "15–18 credits", tone: "ok" };
  if (gpa >= 2.0)
    return { label: "Caution — reduced load", credits: "12–15 credits", tone: "warn" };
  return { label: "Probation — minimum load", credits: "9–12 credits", tone: "warn" };
}
