import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/lib/app-context";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "U";
}

function avatarKey(userId: string) {
  return `edupath_avatar_v1:${userId}`;
}

function SettingsPage() {
  const navigate = useNavigate();
  const { profile, student, role, refresh } = useAppContext();

  const [fullName, setFullName] = useState("");
  const [reg, setReg] = useState("");
  const [program, setProgram] = useState("");
  const [level, setLevel] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState<number | "">("");

  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setFullName(student?.full_name || profile?.full_name || "");
    setReg(student?.registration_number || "");
    setProgram(student?.program || "");
    setLevel(student?.level || "");
    setEnrollmentYear(student?.enrollment_year ?? "");

    if (typeof window === "undefined") return;
    if (!profile?.id) return;
    try {
      const raw = localStorage.getItem(avatarKey(profile.id));
      setAvatarUrl(raw || undefined);
    } catch {
      setAvatarUrl(undefined);
    }
  }, [
    profile?.full_name,
    profile?.id,
    student?.enrollment_year,
    student?.full_name,
    student?.level,
    student?.program,
    student?.registration_number,
  ]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!profile) return null;

  const onSaveProfile = async () => {
    setSaving(true);
    try {
      const nextName = fullName.trim();
      const nextReg = reg.trim();
      if (!nextName) throw new Error("Full name is required");
      if (role === "student" && !nextReg) throw new Error("Registration number is required");

      if (role === "student" && student) {
        const { error } = await supabase
          .from("students")
          .update({
            full_name: nextName,
            registration_number: nextReg,
            program: program.trim() || null,
            level: level.trim() || null,
            enrollment_year: enrollmentYear === "" ? null : Number(enrollmentYear),
          })
          .eq("id", student.id);
        if (error) throw error;
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ full_name: nextName })
        .eq("id", profile.id);
      if (profErr) throw profErr;

      toast.success("Profile updated");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onUploadAvatar = async () => {
    if (!file) {
      toast.error("Choose a photo first");
      return;
    }

    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });

      setAvatarUrl(dataUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem(avatarKey(profile.id), dataUrl);
      }
      toast.success("Profile photo updated (saved on this device)");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const logout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Profile & Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a clear headshot (JPG/PNG). Recommended: square image.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={previewUrl || avatarUrl} alt={fullName || "User"} />
              <AvatarFallback className="text-lg">{initials(fullName || "User")}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-[220px] space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onUploadAvatar} disabled={uploading}>
                  <Camera className="h-4 w-4 mr-1" /> {uploading ? "Uploading..." : "Upload"}
                </Button>
                <Button variant="ghost" onClick={() => setFile(null)} disabled={!file}>
                  Clear
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Saved locally on this device.</p>
            </div>
          </div>
        </section>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Info</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email || "—"} readOnly className="bg-white/5 border-white/15" />
            </div>
            {role === "student" ? (
              <div className="space-y-2">
                <Label>Registration number</Label>
                <Input
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                  className="bg-white/5 border-white/15"
                />
              </div>
            ) : null}

            <div className={`space-y-2 ${role === "student" ? "sm:col-span-2" : ""}`}>
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-white/5 border-white/15"
              />
            </div>

            {role === "student" ? (
              <>
                <div className="space-y-2">
                  <Label>Program</Label>
                  <Input
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="bg-white/5 border-white/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="bg-white/5 border-white/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enrollment year</Label>
                  <Input
                    type="number"
                    value={enrollmentYear}
                    onChange={(e) =>
                      setEnrollmentYear(e.target.value ? Number(e.target.value) : "")
                    }
                    className="bg-white/5 border-white/15"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onSaveProfile} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="destructive" onClick={logout}>
              Logout
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
