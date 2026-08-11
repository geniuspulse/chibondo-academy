import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Progress } from '@/components/ui/progress';
import { Users, BookOpen, TrendingUp, CheckCircle2, GraduationCap, BarChart3, Clock } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accent ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted) / 0.08)' }}>
          <Icon className="w-5 h-5" style={{ color: accent ? 'hsl(var(--primary))' : 'hsl(222 47% 35%)' }} />
        </div>
      </div>
    </div>
  );
}

export default function EnrollmentAnalytics() {
  const { data: enrollments = [], isLoading } = useQuery({queryKey: ['admin-all-enrollments'],
    queryFn: async () => { try { return await db.entities.Enrollment.list('-created_date', 5000); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],
  });
  const { data: subjects = [] } = useQuery({queryKey: ['admin-all-subjects'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
    placeholderData: [],
  });
  const { data: tutors = [] } = useQuery({queryKey: ['admin-tutors'],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ status: 'active' }, 'full_name', 100); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
    placeholderData: [],
  });

  const subjectMap     = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const tutorMap       = useMemo(() => Object.fromEntries(tutors.map(t => [t.id, t])), [tutors]);
  const subjectToTutor = useMemo(() => {
    const m = {};
    subjects.forEach(s => { if (s.tutor_profile_id) m[s.id] = s.tutor_profile_id; });
    return m;
  }, [subjects]);

  const totalStudents  = useMemo(() => new Set(enrollments.map(e => e.student_id)).size, [enrollments]);
  const totalCompleted = enrollments.filter(e => (e.progress_percentage||0) === 100 || e.status === 'completed').length;
  const activeWeek     = enrollments.filter(e => e.last_accessed && (Date.now() - new Date(e.last_accessed).getTime()) < 7*24*3600_000).length;
  const avgProgress    = enrollments.length ? Math.round(enrollments.reduce((a,e)=>a+(e.progress_percentage||0),0)/enrollments.length) : 0;

  const courseStats = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      if (!map[e.subject_id]) map[e.subject_id] = { students: new Set(), completed: 0 };
      map[e.subject_id].students.add(e.student_id);
      if ((e.progress_percentage||0) === 100) map[e.subject_id].completed++;
    });
    return Object.entries(map)
      .map(([sid,d]) => ({ subject: subjectMap[sid], sid, students: d.students.size, completed: d.completed, rate: d.students.size ? Math.round(d.completed/d.students.size*100) : 0 }))
      .filter(d => d.subject)
      .sort((a,b) => b.students - a.students);
  }, [enrollments, subjectMap]);

  const tutorStats = useMemo(() => {
    const map = {};
    enrollments.forEach(e => {
      const tid = subjectToTutor[e.subject_id];
      if (!tid) return;
      if (!map[tid]) map[tid] = { students: new Set(), courses: new Set(), completed: 0 };
      map[tid].students.add(e.student_id);
      map[tid].courses.add(e.subject_id);
      if ((e.progress_percentage||0) === 100) map[tid].completed++;
    });
    return Object.entries(map)
      .map(([tid,d]) => ({ tutor: tutorMap[tid], tid, students: d.students.size, courses: d.courses.size, completed: d.completed }))
      .filter(d => d.tutor)
      .sort((a,b) => b.students - a.students);
  }, [enrollments, subjectToTutor, tutorMap]);

  return (
    <>
      <SEO title="Enrollment Analytics | Admin" />
      <div className="space-y-6">
        <div className="rounded-2xl p-5" style={{background:'hsl(var(--card))'}}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5" style={{color:'hsl(var(--primary))'}}/>
            <span className="text-sm font-medium" style={{color:'hsl(var(--primary) / 0.8)'}}>Admin</span>
          </div>
          <h1 className="text-xl font-heading font-bold" style={{color:'hsl(var(--foreground))'}}>Enrollment Analytics</h1>
          <p className="text-sm mt-1" style={{color:'hsl(var(--muted-foreground))'}}>Live — {enrollments.length} records · {subjects.length} courses</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Active Students"   value={totalStudents.toLocaleString()}   sub="unique enrolled" accent />
          <StatCard icon={BookOpen}     label="Total Enrollments" value={enrollments.length.toLocaleString()} />
          <StatCard icon={CheckCircle2} label="Completions"       value={totalCompleted.toLocaleString()} sub="100% done" accent />
          <StatCard icon={TrendingUp}   label="Avg Progress"      value={`${avgProgress}%`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Clock}         label="Active (7 days)"  value={activeWeek.toLocaleString()} sub="accessed recently" />
          <StatCard icon={BookOpen}      label="Courses"          value={subjects.length} />
          <StatCard icon={GraduationCap} label="Tutors"           value={tutors.length} accent />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent"/>
            <h2 className="font-bold text-sm">Enrollments by Course</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : courseStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No enrollment data yet</div>
          ) : courseStats.map(({subject,sid,students,completed,rate}) => (
            <div key={sid} className="px-5 py-3 flex items-center gap-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{subject.name}</p>
                <p className="text-xs text-muted-foreground">{subject.form_name}</p>
              </div>
              <div className="flex items-center gap-5 flex-shrink-0">
                <div className="text-right"><p className="font-bold text-sm">{students.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">students</p></div>
                <div className="text-right"><p className="font-bold text-sm text-green-600">{completed}</p><p className="text-[10px] text-muted-foreground">completed</p></div>
                <div className="w-16"><p className="text-[10px] text-muted-foreground mb-1 text-right">{rate}%</p><Progress value={rate} className="h-1.5"/></div>
              </div>
            </div>
          ))}
        </div>

        {tutorStats.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-accent"/>
              <h2 className="font-bold text-sm">Enrollments by Tutor</h2>
            </div>
            {tutorStats.map(({tutor,tid,students,courses,completed}) => (
              <div key={tid} className="px-5 py-3 flex items-center gap-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                  {tutor.profile_photo ? <img src={tutor.profile_photo} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{tutor.full_name?.[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{tutor.full_name}</p>
                  <p className="text-xs text-muted-foreground">{tutor.professional_title}</p>
                </div>
                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right"><p className="font-bold text-sm">{students.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">students</p></div>
                  <div className="text-right"><p className="font-bold text-sm">{courses}</p><p className="text-[10px] text-muted-foreground">courses</p></div>
                  <div className="text-right"><p className="font-bold text-sm text-green-600">{completed}</p><p className="text-[10px] text-muted-foreground">completions</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
