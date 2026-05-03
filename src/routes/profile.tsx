import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { 
  User, 
  Award, 
  Cpu, 
  Brain, 
  CheckCircle2, 
  QrCode, 
  ShieldCheck,
  Zap,
  GraduationCap,
  History,
  TrendingUp,
  MapPin
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/lib/app-context";
import { supabase } from "@/integrations/supabase/client";
import { calculateGPA } from "@/lib/gpa";
import { calculateStudentStats, type StudentStats } from "@/lib/student-stats";
import { CURRICULUM_BY_CODE } from "@/lib/curriculum";

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  return (
    <AppShell>
      <ProfilePage />
    </AppShell>
  );
}

function ProfilePage() {
  const { student, loading: ctxLoading } = useAppContext();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading || !student) return;

    async function fetchRecord() {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("student_id", student.id);
      
      if (data) setCourses(data);
      setLoading(false);
    }
    void fetchRecord();
  }, [student, ctxLoading]);

  const stats = useMemo(() => {
    const gpaResult = calculateGPA(courses.map(c => ({
      letter_grade: c.letter_grade,
      credit_hours: Number(c.credit_hours)
    })));

    return calculateStudentStats(
      courses.map(c => ({
        course_code: c.course_code,
        letter_grade: c.letter_grade,
        credit_hours: Number(c.credit_hours)
      })),
      gpaResult.gpa
    );
  }, [courses]);

  // Specialization Calculation Logic
  const specialization = useMemo(() => {
    let automationCount = 0;
    let aiCount = 0;

    courses.forEach(c => {
      if (c.letter_grade === "F") return;
      const code = (c.course_code || "").toUpperCase();
      const curriculum = CURRICULUM_BY_CODE[code];
      if (curriculum?.semester === "Conc. 1") automationCount++;
      if (curriculum?.semester === "Conc. 2") aiCount++;
    });

    if (automationCount > aiCount) return { 
        title: "Automation & Robotics", 
        icon: Cpu, 
        desc: "Expertise in industrial control, embedded systems, and mechanical automation.",
        color: "text-blue-400"
    };
    if (aiCount > automationCount) return { 
        title: "Artificial Intelligence", 
        icon: Brain, 
        desc: "Focus on machine vision, deep learning, and autonomous system intelligence.",
        color: "text-purple-400"
    };
    return { 
        title: "Mechatronics Generalist", 
        icon: Zap, 
        desc: "Core proficiency across mechanical, electrical, and control engineering.",
        color: "text-primary"
    };
  }, [courses]);

  const masterySubjects = useMemo(() => {
    return courses
      .filter(c => ["A+", "A"].includes(c.letter_grade))
      .slice(0, 4);
  }, [courses]);

  if (loading) return <div className="text-center py-20 text-muted-foreground animate-pulse italic">Generating Academic Identity...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      {/* 1. Profile Header Card */}
      <section className="glass-strong rounded-[2.5rem] p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12">
            <User className="h-48 w-48" />
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
          <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-primary to-accent p-1 shadow-2xl">
             <div className="h-full w-full rounded-[1.4rem] bg-background grid place-items-center">
                <User className="h-16 w-16 text-primary" />
             </div>
          </div>
          
          <div className="text-center md:text-left flex-1">
            <Badge variant="outline" className="mb-2 border-primary/20 text-primary uppercase tracking-[0.2em] text-[10px] font-black">
              Official Student Record
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-2">{student?.full_name}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
              <span className="flex items-center gap-2"><MapPin className="h-3 w-3" /> AAST Smart Village</span>
              <span className="flex items-center gap-2"><History className="h-3 w-3" /> Class of {student?.enrollment_year ? student.enrollment_year + 5 : "2027"}</span>
            </div>
          </div>

          <div className="shrink-0 glass p-4 rounded-3xl border-white/5 flex flex-col items-center gap-2">
             <QrCode className="h-16 w-16 opacity-40" />
             <span className="text-[8px] font-black uppercase opacity-30">Scan for Verification</span>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-3 gap-6">
        {/* 2. Specialization Highlight */}
        <section className="md:col-span-2 glass-strong rounded-[2rem] p-8 border-l-8 border-primary">
          <div className="flex items-center gap-4 mb-6">
             <div className="p-3 rounded-2xl bg-primary/10">
                <specialization.icon className={`h-6 w-6 ${specialization.color}`} />
             </div>
             <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Chosen Specialization</h2>
                <p className="text-xl font-black tracking-tight">{specialization.title}</p>
             </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium italic">
            "{specialization.desc}"
          </p>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="glass rounded-2xl p-4 border-white/5">
                <div className="text-[9px] font-black uppercase opacity-40 mb-1">Rank</div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                   <ShieldCheck className="h-4 w-4" /> Top 10%
                </div>
             </div>
             <div className="glass rounded-2xl p-4 border-white/5">
                <div className="text-[9px] font-black uppercase opacity-40 mb-1">Progression</div>
                <div className="text-lg font-bold text-primary flex items-center gap-2">
                   <TrendingUp className="h-4 w-4" /> {stats.mechatronicsProgress.percentage}%
                </div>
             </div>
          </div>
        </section>

        {/* 3. Achievement Badges */}
        <section className="glass-strong rounded-[2rem] p-8 flex flex-col">
           <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Achievements</h2>
           <div className="space-y-4 flex-1">
              {stats.standingTone === "good" && <BadgeCard icon={Award} label="Honor Roll" color="text-yellow-400" />}
              {stats.uclanProgress.percentage > 0 && <BadgeCard icon={Cpu} label="UCLAN Dual" color="text-amber-500" />}
              {courses.length > 20 && <BadgeCard icon={Zap} label="Fast Tracker" color="text-blue-400" />}
              <BadgeCard icon={CheckCircle2} label="Verified ID" color="text-emerald-400" />
           </div>
        </section>
      </div>

      {/* 4. Subject Mastery (Core Strengths) */}
      <section className="glass-strong rounded-[2.5rem] p-8">
        <div className="flex items-center justify-between mb-8">
           <h2 className="text-2xl font-black tracking-tighter">Academic Strengths</h2>
           <Button variant="ghost" size="sm" asChild>
              <Link to="/gpa-calculator" className="text-[10px] font-black uppercase">View All Grades</Link>
           </Button>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4">
           {masterySubjects.length > 0 ? masterySubjects.map(c => (
              <div key={c.id} className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between group hover:border-primary/20 transition-all">
                 <div className="min-w-0">
                    <div className="font-mono text-[9px] font-black text-primary/60 uppercase">{c.course_code}</div>
                    <div className="font-bold text-sm truncate">{c.course_name}</div>
                 </div>
                 <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                    <span className="font-black text-primary">{c.letter_grade}</span>
                 </div>
              </div>
           )) : (
             <div className="col-span-2 text-center py-10 text-muted-foreground italic text-sm">
                Complete core subjects with A/A+ grades to unlock strengths.
             </div>
           )}
        </div>
      </section>

      {/* 5. Formal Graduation Eligibility */}
      <section className="glass-strong rounded-[2.5rem] p-8 border border-emerald-500/20 bg-emerald-500/[0.01]">
         <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400"><GraduationCap className="h-6 w-6" /></div>
            <div>
               <h2 className="text-2xl font-black tracking-tighter">Graduation Eligibility</h2>
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Formal Departmental Status</p>
            </div>
         </div>

         <div className="grid sm:grid-cols-3 gap-6">
            <EligibilityItem label="GPA Requirement" status={stats.graduationAudit.isGpaQualified} value={`${stats.graduationAudit.isGpaQualified ? 'MEETS 2.0+' : 'BELOW 2.0'}`} />
            <EligibilityItem label="Core Curriculum" status={stats.graduationAudit.coreSemestersCompleted === 8} value={`${stats.graduationAudit.coreSemestersCompleted} / 8 Terms`} />
            <EligibilityItem label="Credit Threshold" status={stats.graduationAudit.totalCreditsPassed >= 144} value={`${stats.graduationAudit.totalCreditsPassed} / 144 CR`} />
         </div>
      </section>
    </div>
  );
}

function BadgeCard({ icon: Icon, label, color }: { icon: any, label: string, color: string }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
       <Icon className={`h-5 w-5 ${color} group-hover:scale-110 transition-transform`} />
       <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
    </div>
  );
}

function EligibilityItem({ label, status, value }: { label: string, status: boolean, value: string }) {
  return (
    <div className="space-y-2">
       <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
       <div className="flex items-center gap-3">
          {status ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Zap className="h-5 w-5 text-muted-foreground/20" />}
          <span className={`text-sm font-black ${status ? 'text-foreground' : 'text-muted-foreground'}`}>{value}</span>
       </div>
    </div>
  );
}
