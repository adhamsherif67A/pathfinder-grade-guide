import { supabase } from "@/integrations/supabase/client";
import type { AppProfile, AppRole, AppStudent } from "@/lib/app-context";

// Toggle this to `true` to fully disable authentication (dev mode).
export const AUTH_DISABLED = false;

export const ALLOWED_EMAIL_DOMAINS = ["student.aast.edu", "aast.edu.eg"] as const;

const PENDING_KEY = "edupath_pending_onboard_v1";

export function isAllowedCollegeEmail(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  const domain = e.slice(at + 1);
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type PendingOnboard = {
  registration_number: string;
  full_name: string;
  program?: string;
  level?: string;
  enrollment_year?: number;
};

export function setPendingOnboard(p: PendingOnboard) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

export function getPendingOnboard(): PendingOnboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingOnboard) : null;
  } catch {
    return null;
  }
}

export function clearPendingOnboard() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_KEY);
}

export async function requestMagicLinkSignIn(args: {
  email: string;
  registration_number: string;
  full_name: string;
  program?: string;
  level?: string;
  enrollment_year?: number;
}) {
  const email = normalizeEmail(args.email);
  if (!isAllowedCollegeEmail(email)) {
    throw new Error(
      `Please use your college email (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ")}).`,
    );
  }

  setPendingOnboard({
    registration_number: args.registration_number.trim(),
    full_name: args.full_name.trim(),
    program: args.program?.trim() || undefined,
    level: args.level?.trim() || undefined,
    enrollment_year: args.enrollment_year,
  });

  if (AUTH_DISABLED) {
    return;
  }

  const emailRedirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      data: {
        full_name: args.full_name.trim(),
      },
    },
  });

  if (error) throw error;
}

export async function signOut() {
  if (AUTH_DISABLED) {
    clearPendingOnboard();
    return;
  }

  await supabase.auth.signOut();
  clearPendingOnboard();
}

export async function getAuthUser() {
  if (AUTH_DISABLED) {
    return { id: "dev-user" } as any;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getAppProfile(userId: string): Promise<AppProfile | null> {
  if (AUTH_DISABLED) {
    // Always return student role in dev mode
    return {
      id: userId,
      email: "dev@local",
      full_name: "Demo Student",
      role: "student" as const,
      student_id: "dev-student",
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,student_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as AppRole,
    student_id: data.student_id,
  };
}

export async function getStudentById(studentId: string): Promise<AppStudent | null> {
  if (AUTH_DISABLED) {
    if (studentId === "dev-student") {
      return {
        id: "dev-student",
        registration_number: "00000000",
        full_name: "Demo Student",
        enrollment_year: 2022,
        program: "Mechatronics",
        level: "Level 3",
        credits_earned: 75,
      };
    }
    return null;
  }

  const { data, error } = await supabase
    .from("students")
    .select("id,registration_number,full_name,enrollment_year,program,level,credits_earned")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    registration_number: data.registration_number,
    full_name: data.full_name,
    enrollment_year: data.enrollment_year,
    program: data.program,
    level: data.level,
    credits_earned: Number(data.credits_earned ?? 0),
  };
}

export async function ensureStudentLinked(args: {
  userId: string;
  profile: AppProfile;
  pending: PendingOnboard;
}): Promise<{ profile: AppProfile; student: AppStudent }> {
  const reg = args.pending.registration_number.trim();
  const name = args.pending.full_name.trim();
  if (!reg || !name) throw new Error("Missing registration number or full name for onboarding");

  // 1) Find student by auth_user_id
  const { data: byAuth, error: authErr } = await supabase
    .from("students")
    .select("id,registration_number,full_name,enrollment_year,program,level,credits_earned")
    .eq("auth_user_id", args.userId)
    .maybeSingle();
  if (authErr) throw authErr;

  let studentId = byAuth?.id as string | undefined;

  // 2) If missing, link or create by registration number
  if (!studentId) {
    const { data: existing, error: selErr } = await supabase
      .from("students")
      .select("id")
      .eq("registration_number", reg)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("students")
        .update({
          auth_user_id: args.userId,
          full_name: name,
          program: args.pending.program ?? null,
          level: args.pending.level ?? null,
          enrollment_year: args.pending.enrollment_year ?? null,
        })
        .eq("id", existing.id);
      if (updErr) throw updErr;
      studentId = existing.id;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("students")
        .insert({
          auth_user_id: args.userId,
          registration_number: reg,
          full_name: name,
          program: args.pending.program ?? null,
          level: args.pending.level ?? null,
          enrollment_year: args.pending.enrollment_year ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      studentId = created.id;
    }
  }

  // 3) Update profile.student_id
  if (studentId && args.profile.student_id !== studentId) {
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ student_id: studentId })
      .eq("id", args.userId);
    if (profErr) throw profErr;
  }

  const student = await getStudentById(studentId!);
  if (!student) throw new Error("Failed to load student after onboarding");

  const nextProfile: AppProfile = { ...args.profile, student_id: studentId };
  return { profile: nextProfile, student };
}
