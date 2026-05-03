import { CURRICULUM, CURRICULUM_BY_CODE, type CurriculumCourse } from "./curriculum";

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
 * @param completedCourseCodes Codes of courses the student has already passed.
 * @param plannedCourses List of courses planned for future semesters.
 */
export function validateDegreePlan(
  completedCourseCodes: Set<string>,
  plannedCourses: PlannedCourse[],
): PrerequisiteViolation[] {
  const violations: PrerequisiteViolation[] = [];

  // Sort planned courses by semester to check prerequisites chronologically
  const sortedPlan = [...plannedCourses].sort((a, b) => Number(a.semester) - Number(b.semester));

  // Track what will be "available" as we iterate through the plan
  const currentlyAvailable = new Set(completedCourseCodes);

  for (const plan of sortedPlan) {
    const course = CURRICULUM_BY_CODE[plan.course_code];
    if (!course || !course.prerequisite) {
      currentlyAvailable.add(plan.course_code);
      continue;
    }

    // Handle complex prerequisites (e.g., "EBA1104 & EBA1402" or "30 Cr. Hr.")
    const prereqStr = course.prerequisite;

    // Simple split by '&' for now. For "30 Cr. Hr." we'd need more logic,
    // but we'll focus on course-to-course dependencies first.
    const individualPrereqs = prereqStr.split("&").map((s) => s.trim());

    for (const prereq of individualPrereqs) {
      // Skip credit hour requirements for this simple version
      if (prereq.toLowerCase().includes("cr. hr.")) continue;

      if (!currentlyAvailable.has(prereq)) {
        violations.push({
          course_code: plan.course_code,
          prerequisite: prereq,
          message: `${course.name} (${plan.course_code}) requires ${prereq}, which is not yet completed or planned in a previous term.`,
        });
      }
    }

    // After checking, we assume they pass and it becomes available for the NEXT semesters in the plan
    currentlyAvailable.add(plan.course_code);
  }

  return violations;
}

export type CourseStatus = "completed" | "enrolled" | "planned" | "unlocked" | "locked";

export type RoadmapCourse = CurriculumCourse & {
  status: CourseStatus;
};

/**
 * Calculates the roadmap status for all courses in the curriculum.
 */
export function getCourseRoadmap(
  passedCourseCodes: Set<string>,
  enrolledCourseCodes: Set<string>,
  plannedCourses: PlannedCourse[],
): RoadmapCourse[] {
  const plannedSet = new Set(plannedCourses.map((p) => p.course_code.toUpperCase()));

  return CURRICULUM.map((course) => {
    const code = course.code.toUpperCase();

    if (passedCourseCodes.has(code)) {
      return { ...course, status: "completed" as CourseStatus };
    }

    if (enrolledCourseCodes.has(code)) {
      return { ...course, status: "enrolled" as CourseStatus };
    }

    if (plannedSet.has(code)) {
      return { ...course, status: "planned" as CourseStatus };
    }

    // Check if unlocked (all prerequisites met by COMPLETED courses)
    if (!course.prerequisite) {
      return { ...course, status: "unlocked" as CourseStatus };
    }

    const prereqs = course.prerequisite.split("&").map((s) => s.trim().toUpperCase());
    const isUnlocked = prereqs.every((p) => {
      if (p.includes("CR. HR.")) return true;
      return passedCourseCodes.has(p);
    });

    return {
      ...course,
      status: (isUnlocked ? "unlocked" : "locked") as CourseStatus,
    };
  });
}
