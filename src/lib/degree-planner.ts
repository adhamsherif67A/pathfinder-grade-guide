import { CURRICULUM, CURRICULUM_BY_CODE, SEMESTER_ORDER, type CurriculumCourse } from "./curriculum";

export type PlannedCourse = {
  course_code: string;
  semester: string; // The semester the student PLANS to take it (e.g., "5")
};

export type PrerequisiteViolation = {
  course_code: string;
  prerequisite: string;
  message: string;
};

/**
 * Validates a degree plan against the curriculum prerequisites.
 */
export function validateDegreePlan(
  completedCourseCodes: Set<string>,
  plannedCourses: PlannedCourse[],
): PrerequisiteViolation[] {
  const violations: PrerequisiteViolation[] = [];

  // Sort planned courses by semester using official SEMESTER_ORDER
  const sortedPlan = [...plannedCourses].sort((a, b) => {
    const orderA = SEMESTER_ORDER[a.semester] ?? 999;
    const orderB = SEMESTER_ORDER[b.semester] ?? 999;
    return orderA - orderB;
  });

  const currentlyAvailable = new Set(completedCourseCodes);

  for (const plan of sortedPlan) {
    const course = CURRICULUM_BY_CODE[plan.course_code];
    if (!course || !course.prerequisite) {
      currentlyAvailable.add(plan.course_code.toUpperCase());
      continue;
    }

    const prereqStr = course.prerequisite;
    const individualPrereqs = prereqStr.split("&").map((s) => s.trim().toUpperCase());

    for (const prereq of individualPrereqs) {
      if (prereq.toLowerCase().includes("cr. hr.")) continue;

      if (!currentlyAvailable.has(prereq)) {
        violations.push({
          course_code: plan.course_code,
          prerequisite: prereq,
          message: `${course.name} (${plan.course_code}) requires ${prereq}, which is not yet completed or planned in a previous term.`,
        });
      }
    }

    currentlyAvailable.add(plan.course_code.toUpperCase());
  }

  return violations;
}

export type CourseStatus = "completed" | "enrolled" | "failed" | "withdrawn" | "planned" | "unlocked" | "locked";

export type RoadmapCourse = CurriculumCourse & {
  status: CourseStatus;
};

/**
 * Calculates the roadmap status for all courses, supporting multiple instances for retakes.
 */
export function getCourseRoadmap(
  studentCourses: any[], // Full record from Supabase
  plannedCourses: PlannedCourse[],
): RoadmapCourse[] {
  const roadmap: RoadmapCourse[] = [];
  
  const passedSet = new Set(studentCourses.filter(c => !['F', 'W'].includes(c.letter_grade)).map(c => c.course_code.toUpperCase()));
  const recordMap = new Map<string, string>(); // code -> latest grade
  studentCourses.forEach(c => recordMap.set(c.course_code.toUpperCase(), c.letter_grade));

  // 1. Map base curriculum
  CURRICULUM.forEach(base => {
    const code = base.code.toUpperCase();
    const grade = recordMap.get(code);
    
    let status: CourseStatus = "locked";
    
    if (grade) {
       if (grade === 'F') status = "failed";
       else if (grade === 'W') status = "withdrawn";
       else status = "completed";
    } else {
       // Check if unlocked
       if (!base.prerequisite) {
          status = "unlocked";
       } else {
          const prereqs = base.prerequisite.split("&").map(s => s.trim().toUpperCase());
          const isUnlocked = prereqs.every(p => p.includes("CR. HR.") || passedSet.has(p));
          status = isUnlocked ? "unlocked" : "locked";
       }
    }

    roadmap.push({ ...base, status });
  });

  // 2. Map planned courses (Retakes or Future)
  plannedCourses.forEach(plan => {
     const base = CURRICULUM_BY_CODE[plan.course_code.toUpperCase()];
     if (base) {
        roadmap.push({
           ...base,
           semester: plan.semester, // Overwrite with planned semester
           status: "planned" as CourseStatus
        });
     }
  });

  return roadmap;
}
