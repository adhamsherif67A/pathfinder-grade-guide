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
  plannedCourses: PlannedCourse[]
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
    const individualPrereqs = prereqStr.split('&').map(s => s.trim());
    
    for (const prereq of individualPrereqs) {
      // Skip credit hour requirements for this simple version
      if (prereq.toLowerCase().includes('cr. hr.')) continue;
      
      if (!currentlyAvailable.has(prereq)) {
        violations.push({
          course_code: plan.course_code,
          prerequisite: prereq,
          message: `${course.name} (${plan.course_code}) requires ${prereq}, which is not yet completed or planned in a previous term.`
        });
      }
    }

    // After checking, we assume they pass and it becomes available for the NEXT semesters in the plan
    currentlyAvailable.add(plan.course_code);
  }

  return violations;
}

/**
 * Suggests courses for a specific semester based on what is unlocked.
 */
export function suggestNextCourses(
  completedCourseCodes: Set<string>,
  targetSemester: string
): CurriculumCourse[] {
  return CURRICULUM.filter(course => {
    // Only suggest courses for the target semester (or generally recommended)
    if (course.semester !== targetSemester) return false;
    
    // Filter out already completed
    if (completedCourseCodes.has(course.code)) return false;
    
    // Check if prerequisites are met
    if (!course.prerequisite) return true;
    
    const prereqs = course.prerequisite.split('&').map(s => s.trim());
    return prereqs.every(p => {
      if (p.toLowerCase().includes('cr. hr.')) return true; // Ignore credit hour limits for suggestions
      return completedCourseCodes.has(p);
    });
  });
}
