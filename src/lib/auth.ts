import { supabase } from "@/integrations/supabase/client";

const KEY = "edupath_session_v1";

export type Session = {
  id: string;
  registration_number: string;
  full_name: string;
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
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

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
