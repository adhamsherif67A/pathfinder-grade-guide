import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { clearSession, getSession, setSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "U";
}

function SettingsPage() {
  const navigate = useNavigate();
  const session = getSession();

  const [email] = useState<string>(session?.email || "");
  const [fullName, setFullName] = useState(session?.full_name || "");
  const [reg, setReg] = useState(session?.registration_number || "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(session?.avatar_url);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!session) return null;

  const onSaveProfile = async () => {
    setSaving(true);
    try {
      const nextName = fullName.trim();
      const nextReg = reg.trim();
      if (!nextName || !nextReg) {
        toast.error("Full name and registration number are required");
        return;
      }

      const { error } = await supabase
        .from("students")
        .update({ full_name: nextName, registration_number: nextReg })
        .eq("id", session.id);
      if (error) throw error;

      setSession({ ...session, full_name: nextName, registration_number: nextReg });
      toast.success("Profile updated");
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
      // Store avatar locally (no email verification / no Supabase Auth required)
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });

      setAvatarUrl(dataUrl);
      setSession({ ...session, avatar_url: dataUrl });
      toast.success("Profile photo updated (saved on this device)");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const logout = () => {
    clearSession();
    navigate({ to: "/login" });
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Profile & Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your student profile</p>
        </div>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a clear headshot (JPG/PNG). Recommended: square image.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={previewUrl || avatarUrl} alt={session.full_name} />
              <AvatarFallback className="text-lg">{initials(session.full_name)}</AvatarFallback>
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
              <p className="text-[11px] text-muted-foreground">
                Saved locally on this device (no upload required).
              </p>
            </div>
          </div>
        </section>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Student info</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email || "—"} readOnly className="bg-white/5 border-white/15" />
            </div>
            <div className="space-y-2">
              <Label>Registration number</Label>
              <Input
                value={reg}
                onChange={(e) => setReg(e.target.value)}
                className="bg-white/5 border-white/15"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-white/5 border-white/15"
              />
            </div>
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
