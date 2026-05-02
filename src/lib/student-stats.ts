import { CURRICULUM, CURRICULUM_BY_CODE } from "./curriculum";
import { GRADE_POINTS } from "./gpa";

export type StudentStats = {
  academicStanding: string;
  standingTone: "good" | "ok" | "warn";
  mechatronicsProgress: {
    earned: number;
    total: number;
    percentage: number;
  };
  uclanProgress: {
    earned: number;
    total: number;
    percentage: number;
  };
  gradeBreakdown: {
    topGrade: string;
    topGradeCount: number;
    failCount: number;
  };
  bestSemester: {
    semester: string;
    gpa: number;
  } | null;
  graduationAudit: {
    totalCreditsPassed: number;
    requiredCredits: number;
    isGpaQualified: boolean;
    coreSemestersCompleted: number;
    concentrationCredits: number;
    isReady: boolean;
  };
};

export function calculateStudentStats(
  courses: { course_code: string | null; letter_grade: string; credit_hours: number }[],
  cumulativeGpa: number
): StudentStats {
  // 1. Academic Standing
  let academicStanding = "Good Standing";
  let standingTone: "good" | "ok" | "warn" = "good";

  if (cumulativeGpa < 2.0) {
    academicStanding = "Academic Probation";
    standingTone = "warn";
  } else if (cumulativeGpa < 2.2) {
    academicStanding = "Academic Warning";
    standingTone = "warn";
  } else if (cumulativeGpa >= 3.6) {
    academicStanding = "Honor Roll";
    standingTone = "good";
  }

  // 2. Credits Calculation
  const totalMechatronicsCredits = 144;
  const earnedCredits = courses.reduce((acc, c) => {
    if (c.letter_grade !== "F") return acc + c.credit_hours;
    return acc;
  }, 0);

  // 3. UCLAN Progress
  const uclanCourses = CURRICULUM.filter(c => c.uclan);
  const totalUclanCredits = uclanCourses.reduce((acc, c) => acc + c.credits, 0);
  
  const earnedUclanCredits = courses.reduce((acc, c) => {
    if (c.letter_grade === "F" || !c.course_code) return acc;
    const curriculumCourse = CURRICULUM_BY_CODE[c.course_code.trim().toUpperCase()];
    if (curriculumCourse?.uclan) {
      return acc + c.credit_hours;
    }
    return acc;
  }, 0);

  // 4. Grade Breakdown
  const gradeCounts: Record<string, number> = {};
  let failCount = 0;
  courses.forEach(c => {
    if (c.letter_grade === "F") failCount++;
    gradeCounts[c.letter_grade] = (gradeCounts[c.letter_grade] || 0) + 1;
  });

  let topGrade = "N/A";
  let topGradeCount = 0;
  Object.entries(gradeCounts).forEach(([grade, count]) => {
    if (count > topGradeCount) {
      topGradeCount = count;
      topGrade = grade;
    }
  });

  // 5. Best Semester & Core Audit
  const semesters = new Map<string, { totalPoints: number; totalCredits: number }>();
  const coreSems = new Set<string>();
  let concCredits = 0;

  courses.forEach(c => {
    const code = (c.course_code || "").trim().toUpperCase();
    const curriculum = CURRICULUM_BY_CODE[code];
    const sem = curriculum ? curriculum.semester : "Other";
    const pts = GRADE_POINTS[c.letter_grade] || 0;
    
    // GPA tracking
    const current = semesters.get(sem) || { totalPoints: 0, totalCredits: 0 };
    semesters.set(sem, {
      totalPoints: current.totalPoints + pts * c.credit_hours,
      totalCredits: current.totalCredits + c.credit_hours
    });

    // Core / Conc Audit
    if (c.letter_grade !== "F") {
      if (curriculum) {
        if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(curriculum.semester)) {
          coreSems.add(curriculum.semester);
        } else if (curriculum.semester.startsWith("Conc")) {
          concCredits += c.credit_hours;
        }
      }
    }
  });

  let bestSem: { semester: string; gpa: number } | null = null;
  semesters.forEach((data, sem) => {
    if (sem === "Other") return;
    const gpa = data.totalCredits > 0 ? data.totalPoints / data.totalCredits : 0;
    if (!bestSem || gpa > bestSem.gpa) {
      bestSem = { semester: sem, gpa };
    }
  });

  const audit = {
    totalCreditsPassed: earnedCredits,
    requiredCredits: 144,
    isGpaQualified: cumulativeGpa >= 2.0,
    coreSemestersCompleted: coreSems.size,
    concentrationCredits: concCredits,
    isReady: earnedCredits >= 144 && cumulativeGpa >= 2.0 && coreSems.size === 8
  };

  return {
    academicStanding,
    standingTone,
    mechatronicsProgress: {
      earned: earnedCredits,
      total: totalMechatronicsCredits,
      percentage: Math.min(100, Math.round((earnedCredits / totalMechatronicsCredits) * 100))
    },
    uclanProgress: {
      earned: earnedUclanCredits,
      total: totalUclanCredits,
      percentage: Math.min(100, Math.round((earnedUclanCredits / totalUclanCredits) * 100))
    },
    gradeBreakdown: {
      topGrade,
      topGradeCount,
      failCount
    },
    bestSemester: bestSem,
    graduationAudit: audit
  };
}
