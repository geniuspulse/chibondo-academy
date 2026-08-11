import React from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, PlayCircle, CheckCircle2, Clock,
  GraduationCap, ArrowRight, Trophy
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function statusStyle(status, pct) {
  if (pct === 100 || status === 'completed') return { label:'Completed', cls:'bg-green-500/10 text-green-600 border-green-500/20' };
  if (pct > 0)                              return { label:'In Progress', cls:'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  return                                           { label:'Enrolled',    cls:'bg-muted text-muted-foreground border-border' };
}

function ClassCard({ enrollment, subject }) {
  const navigate = useNavigate();
  const pct   = enrollment.progress_percentage || 0;
  const badge = statusStyle(enrollment.status, pct);
  const ago   = enrollment.last_accessed
    ? formatDistanceToNow(new Date(enrollment.last_accessed), { addSuffix: true })
    : null;
  const resumeId = enrollment.last_lesson_id || null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200">
      {/* Cover */}
      <div className="relative h-36 bg-gradient-to-br from-primary/20 to-accent/10 overflow-hidden">
        {subject?.cover_image
          ? <img src={subject.cover_image} alt={enrollment.subject_name} className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary/20" />
            </div>
          )
        }
        {pct === 100 && (
          <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
            <Trophy className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-heading font-bold text-sm leading-snug line-clamp-2">
            {enrollment.subject_name}
          </h3>
          {enrollment.form_name && (
            <p className="text-xs text-muted-foreground mt-0.5">{enrollment.form_name}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {/* Last active */}
        {ago && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last studied {ago}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {pct === 100 ? (
            <Link to={`/subjects/${enrollment.subject_id}`} className="flex-1">
              <button className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-border hover:border-primary/40 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> View Course
              </button>
            </Link>
          ) : (
            <>
              {resumeId && (
                <Link to={`/lesson/${resumeId}`} className="flex-1">
                  <button className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                    <PlayCircle className="w-3.5 h-3.5" />
                    {pct > 0 ? 'Continue' : 'Start'}
                  </button>
                </Link>
              )}
              <Link to={`/subjects/${enrollment.subject_id}`} className={resumeId ? '' : 'flex-1'}>
                <button className="w-full py-2 px-3 rounded-xl text-xs font-semibold border border-border hover:border-primary/40 transition-colors flex items-center justify-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyClassesPage() {
  const { user } = useOutletContext() ?? {};

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['my-enrollments', user?.id],
    queryFn: async () => { try { return await db.entities.Enrollment.filter({ student_id: user.id }, '-last_accessed', 100); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Fetch subjects for cover images
  const { data: subjects = [] } = useQuery({
    queryKey: ['all-subjects-for-classes'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
  });
  const subjectMap = React.useMemo(() => {
    const m = {};
    subjects.forEach(s => { m[s.id] = s; });
    return m;
  }, [subjects]);

  const completed  = enrollments.filter(e => (e.progress_percentage || 0) === 100 || e.status === 'completed');
  const inProgress = enrollments.filter(e => (e.progress_percentage || 0) > 0 && (e.progress_percentage || 0) < 100);
  const notStarted = enrollments.filter(e => !e.progress_percentage || e.progress_percentage === 0);

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="flex gap-1.5">
        {[0,1,2].map(i=>(
          <div key={i} className="w-2 h-2 rounded-full bg-accent"
            style={{ animation:`bounce 1.2s ease-in-out ${i*0.15}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );

  return (
    <>
      <SEO title="My Classes | Chibondo Academy" description="Your enrolled courses and learning progress" />
      <div className="space-y-6">

        {/* Header — gradient matches site style */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-medium">Learning</span>
          </div>
          <h1 className="text-2xl font-bold mb-4">My Classes</h1>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:'Enrolled',    val: enrollments.length },
              { label:'In Progress', val: inProgress.length },
              { label:'Completed',   val: completed.length },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <p className="text-2xl font-bold">{val}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="w-14 h-14 mx-auto text-muted-foreground/20" />
            <p className="font-bold text-muted-foreground">No classes yet</p>
            <p className="text-sm text-muted-foreground/60">Browse subjects and click "Join Class" to get started</p>
            <Link to="/subjects">
              <button className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                Browse Subjects
              </button>
            </Link>
          </div>
        ) : (
          <>
            {inProgress.length > 0 && (
              <section>
                <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">In Progress</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inProgress.map(e => <ClassCard key={e.id} enrollment={e} subject={subjectMap[e.subject_id]} />)}
                </div>
              </section>
            )}
            {notStarted.length > 0 && (
              <section>
                <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3">Not Started</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notStarted.map(e => <ClassCard key={e.id} enrollment={e} subject={subjectMap[e.subject_id]} />)}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section>
                <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" /> Completed
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completed.map(e => <ClassCard key={e.id} enrollment={e} subject={subjectMap[e.subject_id]} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
