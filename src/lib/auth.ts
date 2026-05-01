import { supabase } from "@/integrations/supabase/client";

const KEY = "edupath_session_v1";

export const ALLOWED_EMAIL_DOMAINS = ["student.aast.edu", "aast.edu.eg"] as const;

export type Session = {
  id: string;
  registration_number: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  auth_user_id?: string;
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function isAllowedCollegeEmail(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  const domain = e.slice(at + 1);
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function requestEmailOtp(email: string) {
  const e = normalizeEmail(email);
  if (!isAllowedCollegeEmail(e)) {
    throw new Error(
      `Please use your college email (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" or ")}).`,
    );
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: e,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(params: {
  email: string;
  token: string;
  registration_number: string;
  full_name: string;
}): Promise<Session> {
  const email = normalizeEmail(params.email);
  const token = params.token.trim();
  if (!token) throw new Error("Enter the 6-digit code");

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Verification failed");

  const student = await loginOrRegister(params.registration_number, params.full_name);

  const meta = (user.user_metadata || {}) as { avatar_url?: string };
  const avatar_url = meta.avatar_url;

  try {
    await supabase.auth.updateUser({
      data: {
        student_id: student.id,
        registration_number: student.registration_number,
        full_name: student.full_name,
        avatar_url,
      },
    });
  } catch {
    // Best-effort; local session still works.
  }

  const s: Session = {
    ...student,
    email: user.email || email,
    avatar_url,
    auth_user_id: user.id,
  };
  setSession(s);
  return s;
}

export async function restoreSessionFromSupabase(): Promise<Session | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const meta = (user.user_metadata || {}) as {
    student_id?: string;
    registration_number?: string;
    full_name?: string;
    avatar_url?: string;
  };

  if (meta.student_id) {
    const { data: student } = await supabase
      .from("students")
      .select("id, registration_number, full_name")
      .eq("id", meta.student_id)
      .maybeSingle();

    if (student) {
      const s: Session = {
        ...(student as Session),
        email: user.email || undefined,
        avatar_url: meta.avatar_url,
        auth_user_id: user.id,
      };
      setSession(s);
      return s;
    }
  }

  if (meta.registration_number && meta.full_name) {
    const student = await loginOrRegister(meta.registration_number, meta.full_name);
    const s: Session = {
      ...student,
      email: user.email || undefined,
      avatar_url: meta.avatar_url,
      auth_user_id: user.id,
    };
    setSession(s);
    return s;
  }

  return null;
}

export async function signOut() {
  await supabase.auth.signOut();
  clearSession();
}

// Legacy (pre-email auth) student login: kept for compatibility and migrations.
export async function loginOrRegister(
  registration_number: string,
  full_name: string,
): Promise<Session> {
  const reg = registration_number.trim();
  const name = full_name.trim();
  if (!reg || !name) throw new Error("Registration number and full name are required");

  const { data: existing, error: selErr } = await supabase
    .from("students")
    .select("id, registration_number, full_name")
    .eq("registration_number", reg)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    if (existing.full_name !== name) {
      const { data: upd, error: updErr } = await supabase
        .from("students")
        .update({ full_name: name })
        .eq("id", existing.id)
        .select("id, registration_number, full_name")
        .single();
      if (updErr) throw updErr;
      const s = upd as Session;
      setSession(s);
      return s;
    }
    setSession(existing as Session);
    return existing as Session;
  }

  const { data: created, error: insErr } = await supabase
    .from("students")
    .insert({ registration_number: reg, full_name: name })
    .select("id, registration_number, full_name")
    .single();
  if (insErr) throw insErr;

  const s = created as Session;
  setSession(s);
  return s;
}
