import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
});

type StudentOption = { id: string; label: string };

type Msg = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
};

function MessagesPage() {
  const { profile, role, student } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const [advisorId, setAdvisorId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const effectiveStudentId = role === "student" ? (student?.id ?? null) : activeStudentId;

  const loadRoster = async () => {
    if (!profile) return;
    if (role === "student") return;

    const { data, error } = await supabase
      .from("advisor_students")
      .select("student:students(id,full_name,registration_number)")
      .eq("advisor_id", profile.id);
    if (error) throw error;

    type AdvisorStudentLinkRow = {
      student: { id: string; full_name: string; registration_number: string } | null;
    };

    const rows = (data || []) as unknown as AdvisorStudentLinkRow[];
    const opts = rows
      .map((r) => r.student)
      .filter((s): s is NonNullable<AdvisorStudentLinkRow["student"]> => !!s)
      .map((s) => ({ id: s.id, label: `${s.full_name} · ${s.registration_number}` }))
      .sort((a, b) => a.label.localeCompare(b.label));

    setStudentOptions(opts);
    setActiveStudentId(opts[0]?.id ?? null);
  };

  const loadAdvisorForStudent = async () => {
    if (!profile || role !== "student" || !student) return;
    const { data, error } = await supabase
      .from("advisor_students")
      .select("advisor_id")
      .eq("student_id", student.id)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    setAdvisorId(data?.advisor_id ?? null);
  };

  const loadMessages = async () => {
    if (!profile) return;
    if (!effectiveStudentId) return;

    setLoading(true);
    try {
      const q = supabase
        .from("messages")
        .select("id,body,created_at,sender_id")
        .eq("student_id", effectiveStudentId)
        .order("created_at", { ascending: true })
        .limit(300);

      if (role === "advisor") {
        q.eq("advisor_id", profile.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setMessages((data || []) as Msg[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (!profile) return;
        if (role === "advisor") await loadRoster();
        if (role === "student") await loadAdvisorForStudent();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load messaging");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, role, student?.id]);

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStudentId, role, advisorId, profile?.id]);

  const send = async () => {
    if (!profile) return;
    if (!effectiveStudentId) return;
    const body = draft.trim();
    if (!body) return;

    const advId = role === "student" ? advisorId : profile.id;
    if (!advId) {
      toast.error("No advisor assigned yet");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        student_id: effectiveStudentId,
        advisor_id: advId,
        sender_id: profile.id,
        body,
      });
      if (error) throw error;
      setDraft("");
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  const title = role === "student" ? "Messaging" : "Advisor Messaging";

  const headerHint = useMemo(() => {
    if (role === "student") return "Message your advisor and track action items (MVP)";
    return "Select a student to view the conversation";
  }, [role]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{title}</h1>
          <p className="text-sm text-muted-foreground">{headerHint}</p>
        </div>

        {role !== "student" ? (
          <section className="glass-strong rounded-2xl p-6">
            <div className="max-w-md space-y-2">
              <div className="text-xs text-muted-foreground">Student</div>
              <Select value={activeStudentId || ""} onValueChange={(v) => setActiveStudentId(v)}>
                <SelectTrigger className="bg-white/5 border-white/15">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {studentOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        ) : null}

        <section className="glass-strong rounded-2xl p-6">
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {messages.map((m) => {
              const mine = m.sender_id === profile?.id;
              return (
                <div
                  key={m.id}
                  className={`glass rounded-xl p-3 text-sm ${
                    mine ? "border border-primary/30 bg-primary/10" : "border border-white/10"
                  }`}
                >
                  <div className="text-[11px] text-muted-foreground">
                    {mine ? "You" : "Them"} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                </div>
              );
            })}
            {!loading && messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              className="bg-white/5 border-white/15"
            />
            <Button onClick={send} disabled={sending || !draft.trim() || !effectiveStudentId}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
