import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/appointments")({
  component: AppointmentsPage,
});

type Apt = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  note?: string | null;
};

function toIsoLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AppointmentsPage() {
  const { profile, role, student } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Apt[]>([]);

  const [advisorId, setAdvisorId] = useState<string | null>(null);

  const [startLocal, setStartLocal] = useState(() =>
    toIsoLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(false);

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

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let q = supabase
        .from("appointments")
        .select("id,start_at,end_at,status,note")
        .order("start_at", { ascending: true })
        .limit(200);

      if (role === "student") {
        if (!student) return;
        q = q.eq("student_id", student.id);
      } else {
        q = q.eq("advisor_id", profile.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setAppointments(
        (data || []).map((a) => ({
          id: a.id,
          start_at: a.start_at,
          end_at: a.end_at,
          status: a.status,
          note: a.note ?? null,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (role === "student") await loadAdvisorForStudent();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load advisor assignment");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, role, student?.id]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, role, student?.id]);

  const book = async () => {
    if (!profile || role !== "student" || !student) return;
    if (!advisorId) {
      toast.error("No advisor assigned yet");
      return;
    }

    const start = new Date(startLocal);
    if (Number.isNaN(start.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    setBooking(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        advisor_id: advisorId,
        student_id: student.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "requested",
        note: note.trim() || null,
      });
      if (error) throw error;
      toast.success("Appointment requested");
      setNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request appointment");
    } finally {
      setBooking(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "confirmed")
      return (
        <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
          Confirmed
        </Badge>
      );
    if (s === "requested")
      return (
        <Badge className="bg-amber-500/20 text-amber-200 border border-amber-500/30">
          Requested
        </Badge>
      );
    if (s === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  const title = useMemo(
    () => (role === "student" ? "Appointments" : "Advisor Appointments"),
    [role],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{title}</h1>
          <p className="text-sm text-muted-foreground">Booking + advisor availability (MVP)</p>
        </div>

        {role === "student" ? (
          <section className="glass-strong rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Request an appointment</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Start time</div>
                <Input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="bg-white/5 border-white/15"
                />
              </div>
              <div className="flex-1 min-w-[220px] space-y-2">
                <div className="text-xs text-muted-foreground">Note (optional)</div>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="E.g. Course planning for next term"
                  className="bg-white/5 border-white/15"
                />
              </div>
              <Button onClick={book} disabled={booking}>
                {booking ? "Requesting…" : "Request"}
              </Button>
            </div>
            {!advisorId ? (
              <div className="mt-3 text-xs text-amber-200">No advisor assigned yet.</div>
            ) : null}
          </section>
        ) : null}

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <div className="mt-4 space-y-2">
            {appointments.map((a) => (
              <div
                key={a.id}
                className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="font-medium">
                    {new Date(a.start_at).toLocaleString()} →{" "}
                    {new Date(a.end_at).toLocaleTimeString()}
                  </div>
                  {a.note ? (
                    <div className="text-xs text-muted-foreground mt-1">{a.note}</div>
                  ) : null}
                </div>
                {statusBadge(a.status)}
              </div>
            ))}
            {!loading && appointments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No appointments yet.</div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
