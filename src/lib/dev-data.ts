// Mock data for development/demo mode when AUTH_DISABLED=true

export const DEV_STUDENTS = [
  {
    id: "student-1",
    full_name: "Ahmed Hassan",
    registration_number: "20210001",
    program: "Mechatronics",
    level: "Level 3",
    credits_earned: 75,
  },
  {
    id: "student-2",
    full_name: "Fatima Al-Mansouri",
    registration_number: "20210002",
    program: "Computer Science",
    level: "Level 2",
    credits_earned: 45,
  },
  {
    id: "student-3",
    full_name: "Mohamed Karim",
    registration_number: "20210003",
    program: "Civil Engineering",
    level: "Level 4",
    credits_earned: 105,
  },
  {
    id: "student-4",
    full_name: "Noor Amira",
    registration_number: "20210004",
    program: "Biomedical Engineering",
    level: "Level 2",
    credits_earned: 40,
  },
  {
    id: "student-5",
    full_name: "Youssef Saleh",
    registration_number: "20210005",
    program: "Mechatronics",
    level: "Level 1",
    credits_earned: 20,
  },
];

export const DEV_ALERTS = [
  { student_id: "student-2", severity: "critical" as const, resolved_at: null },
  { student_id: "student-4", severity: "warn" as const, resolved_at: null },
  { student_id: "student-4", severity: "warn" as const, resolved_at: null },
];

export const DEV_COURSES = [
  { id: "course-1", code: "CS101", title: "Introduction to Computer Science", credits: 3 },
  { id: "course-2", code: "CS201", title: "Data Structures", credits: 4, prerequisites: ["CS101"] },
  { id: "course-3", code: "MATH101", title: "Calculus I", credits: 4 },
  { id: "course-4", code: "PHYS101", title: "Physics I", credits: 4 },
];

export const DEV_STUDENT_COURSES = [
  { student_id: "student-1", course_id: "course-1", grade: "A", semester: "Fall 2023" },
  { student_id: "student-1", course_id: "course-3", grade: "B+", semester: "Fall 2023" },
  { student_id: "student-2", course_id: "course-1", grade: "C", semester: "Fall 2023" },
  { student_id: "student-2", course_id: "course-3", grade: "D", semester: "Fall 2023" },
];

export const DEV_APPOINTMENTS = [
  {
    id: "appt-1",
    student_id: "student-1",
    advisor_id: "dev-user",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    title: "Course Selection Review",
    notes: "Plan next semester courses",
  },
  {
    id: "appt-2",
    student_id: "student-2",
    advisor_id: "dev-user",
    scheduled_at: new Date(Date.now() + 172800000).toISOString(),
    title: "Academic Performance Discussion",
    notes: "Discuss recent low grades",
  },
];

export const DEV_MESSAGES = [
  {
    id: "msg-1",
    sender_id: "student-1",
    recipient_id: "dev-user",
    content: "Hi, when is the best time to register for next semester?",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "msg-2",
    sender_id: "dev-user",
    recipient_id: "student-1",
    content: "Let's schedule an appointment to discuss your course plan.",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];
