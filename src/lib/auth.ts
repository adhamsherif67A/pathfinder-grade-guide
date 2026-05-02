import { supabase } from "@/integrations/supabase/client";
import type { AppProfile, AppRole, AppStudent } from "@/lib/app-context";

// We are bypassing Supabase Auth as requested.
export const AUTH_DISABLED = true; 

const SESSION_KEY = "edupath_session_v2";

export type Session = {
  registration_number: string;
  full_name: string;
  role: AppRole;
};

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export const ALLOWED_EMAIL_DOMAINS = ["student.aast.edu", "aast.edu.eg"] as const;

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

export async function signInDirectly(args: {
  email: string;
  registration_number: string;
  full_name: string;
  enrollment_year?: number;
}) {
  const reg = args.registration_number.trim();
  const name = args.full_name.trim();

  if (!reg || !name) throw new Error("Registration number and name are required.");

  console.log("[Auth] Attempting direct sign in for:", reg);

  // 1) Upsert student record
  const { data, error: sErr } = await supabase
    .from("students")
    .upsert(
      {
        registration_number: reg,
        full_name: name,
        enrollment_year: args.enrollment_year || undefined,
      },
      { onConflict: "registration_number" },
    )
    .select("id")
    .maybeSingle();

  if (sErr) {
    console.error("[Auth] Database error during sign in:", sErr);
    throw new Error(sErr.message || "Failed to save student record to database.");
  }

  if (!data) {
    console.error("[Auth] No data returned from upsert");
    throw new Error("Could not create or find your student record.");
  }

  console.log("[Auth] Successfully upserted student:", data.id);

  // 2) Set local session
  setSession({
    registration_number: reg,
    full_name: name,
    role: "student",
  });
}

export async function signOut() {
  clearSession();
}

export async function getAuthUser() {
  const s = getSession();
  if (!s) return null;
  return { id: s.registration_number, email: s.registration_number } as any;
}

export async function getAppProfile(userId: string): Promise<AppProfile | null> {
  const s = getSession();
  if (!s || s.registration_number !== userId) return null;

  // Find student record to get the ID
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, registration_number")
    .eq("registration_number", s.registration_number)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    email: data.registration_number,
    full_name: data.full_name,
    role: s.role,
    student_id: data.id,
  };
}

export async function getStudentById(studentId: string): Promise<AppStudent | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id,registration_number,full_name,enrollment_year")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    registration_number: data.registration_number,
    full_name: data.full_name,
    enrollment_year: data.enrollment_year,
    credits_earned: 0,
  };
}

// No longer needed but kept for compatibility
export async function ensureStudentLinked(args: any) {
  return args;
}

