import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ArrowLeft, ArrowRight, CheckCircle2, BookOpen, Lock, PlayCircle, FileText, MessageSquare, List, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import LessonComments from '@/components/lesson/LessonComments';
import { useMiniPlayer } from '@/contexts/MiniPlayerContext';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import ExpiryBanner from '@/components/ExpiryBanner';
import SEO from '@/components/SEO';
import '@/styles/lesson-prose.css';

// ─── MAIN ──
export default function LessonPage() {
  const { lessonId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => { const r = await db.entities.Lesson.filter({ id: lessonId }); return r[0]; },
  });

  const { data: allLessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['subjectLessons', lesson?.subject_id],
    queryFn: async () => { try { return await db.entities.Lesson.filter({ subject_id: lesson.subject_id }, 'order', 200); } catch { return []; } },
    enabled: !!lesson?.subject_id,
  });

  const { data: subject } = useQuery({
    queryKey: ['subject', lesson?.subject_id],
    queryFn: async () => { if (!lesson?.subject_id) return null; const r = await db.entities.Subject.filter({ id: lesson.subject_id }); return r[0] || null; },
    enabled: !!lesson?.subject_id,
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, lesson?.subject_id],
    queryFn: async () => { const r = await db.entities.Enrollment.filter({ student_id: user.id, subject_id: lesson.subject_id }); return r[0] || null; },
    enabled: !!user?.id && !!lesson?.subject_id,
  });

  const { isExpired, hasPaidFees } = useSubscription(user?.id);
  const isLocked = !!user && !hasPaidFees;

  // ── Lesson Preview Feature ──
  const hasExplicitPreviews = allLessons.some(l => l.is_free);
  const autoPreviewIds = !hasExplicitPreviews ? allLessons.slice(0, 3).map(l => l.id) : [];
  const isPreviewLesson = lesson?.is_free || autoPreviewIds.includes(lessonId);
  const isGuestPreviewing = isPreviewLesson && !user;

  // ── Mini-player: keep the video "alive" across navigation ──
  const hasVideo = !!lesson?.video_url;
  // Must mirror the locked-screen gating below: preview lessons are always OK;
  // otherwise only a logged-in, paid-up user gets access. (Guests never get non-preview access.)
  const hasVideoAccess = isPreviewLesson || (!!user && !isLocked);
  const dockRef = useRef(null);
  const { playLesson, registerDock } = useMiniPlayer();

  useEffect(() => {
    if (hasVideo && hasVideoAccess && lesson) playLesson(lesson);
  }, [lesson?.id, hasVideo, hasVideoAccess]);

  useEffect(() => {
    if (hasVideo && hasVideoAccess && dockRef.current) {
      registerDock(dockRef.current, lessonId);
      return () => registerDock(null, lessonId);
    }
  }, [lessonId, hasVideo, hasVideoAccess]);

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      let enr = enrollment;
      if (!enr && lesson?.subject_id) {
        enr = await db.entities.Enrollment.create({
          student_id: user.id, subject_id: lesson.subject_id, subject_name: lesson.subject_name,
          completed_lessons: [], status: 'active', progress_percentage: 0,
        });
      }
      if (!enr) return { pct: 0 };
      const completed = [...(enr.completed_lessons || [])];
      if (!completed.includes(lessonId)) completed.push(lessonId);
      const pct = allLessons.length > 0 ? Math.round((completed.length / allLessons.length) * 100) : 0;
      await db.entities.Enrollment.update(enr.id, {
        completed_lessons: completed, progress_percentage: pct, last_lesson_id: lessonId,
        last_accessed: new Date().toISOString(), status: pct === 100 ? 'completed' : 'active',
      });
      return { pct };
    },
    onSuccess: ({ pct }) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      if (pct === 100) toast.success('🎉 Course completed!', { duration: 5000 });
      else { toast.success('✓ Lesson complete!'); if (nextLesson) setTimeout(() => navigate(`/lesson/${nextLesson.id}`), 800); }
    },
    onError: () => toast.error('Could not save progress.'),
  });

  const completedLessons = enrollment?.completed_lessons || [];
  const [activeTab, setActiveTab] = useState('content');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const isCompleted = completedLessons.includes(lessonId);
  const progressPct = allLessons.length > 0 ? Math.round((completedLessons.length / allLessons.length) * 100) : 0;

  // ── Loading ──
  if (lessonLoading) return (
    <div className="flex items-center justify-center py-20">
      <SectionLoader label="Loading lesson…" />
    </div>
  );

  // ── Not found ──
  if (!lesson) return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center">
      <BookOpen className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
      <h1 className="text-2xl font-heading font-bold mb-3">Lesson Not Found</h1>
      <p className="text-sm text-muted-foreground mb-6">This lesson may have been removed or the link is incorrect.</p>
      <Link to="/subjects" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
        Back to Subjects
      </Link>
    </div>
  );

  // ── Locked: user without fees (wait for lessons to load first) ──
  if (user && isLocked && !isPreviewLesson && !lessonsLoading && allLessons.length > 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
          {isExpired ? <AlertTriangle className="w-8 h-8 text-destructive" /> : <Lock className="w-8 h-8 text-primary" />}
        </div>
        <h1 className="text-2xl font-heading font-bold mb-3">
          {isExpired ? 'Your Subscription Has Expired' : 'This Lesson is Locked'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isExpired
            ? 'Your school fees subscription has expired. Renew to regain access to all lessons and content.'
            : 'Pay your school fees to unlock all lessons and content.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/subscription" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition">
            {isExpired ? 'Renew Now' : 'Pay Fees Now'}
          </Link>
          <Link to={`/subjects/${lesson.subject_id}`} className="inline-block px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // ── Locked: guest on non-preview lesson (wait for lessons to load first) ──
  if (!user && !isPreviewLesson && !lessonsLoading && allLessons.length > 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold mb-3">This Lesson is Locked</h1>
        <p className="text-muted-foreground mb-6">
          Become a student and subscribe to unlock all {allLessons.length} lessons in this subject.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition">
            Become a Student
          </Link>
          <Link to={`/subjects/${lesson.subject_id}`} className="inline-block px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // ── SEO ──
  const lessonTitle = lesson.seo_title || lesson.title;
  const lessonDesc = lesson.seo_description || (lesson.content || '').replace(/<[^>]+>/g, '').slice(0, 160) || `Watch and study: ${lesson.title}.`;
  const lessonUrl = `${window.location.origin}/lesson/${lessonId}`;

  return (
    <>
      <SEO title={lessonTitle} description={lessonDesc} canonical={lessonUrl} ogType="article"
        ogImage={lesson.og_image || lesson.thumbnail || undefined} ogTitle={lesson.og_title || lessonTitle}
        keywords={lesson.seo_keywords || `${lesson.title}, MSCE, Chibondo Academy`} />

      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Breadcrumb + Lesson Menu Toggle */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap min-w-0">
            <Link to="/subjects" className="hover:text-foreground transition flex-shrink-0">Subjects</Link>
            <span>/</span>
            <Link to={`/subjects/${lesson.subject_id}`} className="hover:text-foreground transition flex-shrink-0 truncate">
              {subject?.name || lesson.subject_name || 'Course'}
            </Link>
            <span>/</span>
            <span className="text-foreground truncate">{lesson.title}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Lessons</span>
          </button>
        </div>

        {/* Sidebar + Main Content Layout */}
        <div className="flex gap-6 relative">
          {/* Lesson Sidebar */}
          {sidebarOpen && (
            <>
              {/* Mobile backdrop */}
              <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
              {/* Sidebar panel */}
              <aside className="fixed lg:sticky top-0 lg:top-4 right-0 lg:right-auto w-80 max-w-[85vw] h-screen lg:h-[calc(100vh-2rem)] bg-card border-l lg:border lg:rounded-xl border-border z-50 overflow-y-auto p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <List className="w-4 h-4" />
                    All Lessons
                  </h3>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {allLessons.map((l, i) => {
                    const lPreview = l.is_free || (!hasExplicitPreviews && i < 3);
                    const lLocked = user ? (isLocked && !lPreview) : (!lPreview);
                    const lCompleted = completedLessons.includes(l.id);
                    const isCurrent = l.id === lessonId;
                    return (
                      <button
                        key={l.id}
                        onClick={() => {
                          if (lLocked) {
                            if (!user) navigate('/register');
                            else navigate('/subscription');
                            return;
                          }
                          navigate(`/lesson/${l.id}`);
                          setSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                          isCurrent ? "bg-primary/10 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                          {lCompleted ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : lLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-[11px] font-bold text-muted-foreground/60">{i + 1}</span>
                          )}
                        </span>
                        <span className="flex-1 min-w-0 truncate">{l.title}</span>
                        {lPreview && !lCompleted && (
                          <span className="flex-shrink-0 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">FREE</span>
                        )}
                        {isCurrent && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </aside>
            </>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
        {/* Video Player */}
        {hasVideo && (
          <div className="mb-6 bg-black rounded-xl overflow-hidden aspect-video">
            {!user && !isGuestPreviewing ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                <Lock className="w-12 h-12 text-primary" />
                <div>
                  <p className="text-white font-semibold">Create an account to watch</p>
                  <p className="text-white/60 text-sm mt-1">Join free — track progress, access all subjects</p>
                </div>
                <Link to="/register"><Button size="lg">Start Learning</Button></Link>
              </div>
            ) : (
              <div ref={dockRef} className="w-full h-full" />
            )}
          </div>
        )}

        {/* No-video fallback */}
        {!hasVideo && (
          <div className="mb-6 bg-card border border-border rounded-xl p-6 text-center">
            <FileText className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-bold text-foreground">Reading Lesson</p>
            <p className="text-sm text-muted-foreground mt-1">Study notes below — no video for this lesson.</p>
          </div>
        )}

        {/* Lesson Title */}
        <div className="mb-4">
          {isPreviewLesson && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded mb-2">
              Free Preview
            </span>
          )}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-extrabold text-foreground leading-tight">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-sm text-muted-foreground mt-2">{lesson.description}</p>
          )}
        </div>

        {/* Tabs: Content | Discussion */}
        <div className="mb-4 flex items-center gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('content')}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === 'content'
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Content
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === 'discussion'
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Discussion
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'content' && (
          <>
            {/* Lesson Content Card */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 lg:p-8 mb-6">
              {lesson.content ? (
                !user && !isGuestPreviewing ? (
                  <div className="relative">
                    <div className="lesson-content pointer-events-none select-none"
                      style={{ maxHeight: '8rem', overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}
                      dangerouslySetInnerHTML={{ __html: lesson.content }} />
                    <div className="mt-4 rounded-xl p-6 text-center border border-primary bg-card shadow-lg">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
                      <p className="text-sm font-bold">Sign in to read the full notes</p>
                      <p className="text-xs text-muted-foreground mb-4">Become a student to access all lesson content</p>
                      <div className="flex gap-3 justify-center flex-wrap">
                        <Link to="/register" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition">
                          Create Account
                        </Link>
                        <Link to="/login" className="px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition text-sm font-medium">
                          Log in
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                )
              ) : (
                <p className="text-muted-foreground">No content available for this lesson yet.</p>
              )}
            </div>

            {/* Mark as Complete Button */}
            {user && enrollment && (
              <div className="mb-6">
                <button
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  className={cn(
                    "w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2",
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-500 border-2 border-emerald-500/30 hover:bg-emerald-500/20"
                      : "bg-emerald-500 text-black hover:bg-emerald-600"
                  )}
                >
                  {markCompleteMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Completed — Mark as Incomplete
                    </>
                  ) : (
                    'Mark Lesson as Complete'
                  )}
                </button>
              </div>
            )}

            {/* Progress indicator */}
            {user && enrollment && allLessons.length > 0 && (
              <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="font-semibold text-foreground whitespace-nowrap">{progressPct}%</span>
              </div>
            )}

            {/* Guest CTA — BBA-style */}
            {!user && (
              <div className="mb-6 bg-card border border-border rounded-xl p-4 sm:p-6 text-center">
                <p className="text-base font-bold mb-2">Enjoying the lesson?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Become a student to unlock all {allLessons.length} lessons & track your progress
                </p>
                <Link to="/register" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition">
                  Become a Student
                </Link>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
                </p>
              </div>
            )}
          </>
        )}

        {/* Discussion Tab */}
        {activeTab === 'discussion' && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-6 lg:p-8 mb-6">
            {user ? (
              <LessonComments
                lessonId={lessonId}
                lessonTitle={lesson.title}
                lessonUrl={lessonUrl}
                subjectId={lesson.subject_id}
                user={user}
              />
            ) : (
              <div className="text-center py-10">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-4">Sign in to join the discussion</p>
                <div className="flex gap-3 justify-center">
                  <Link to="/register" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition">
                    Become a Student
                  </Link>
                  <Link to="/login" className="px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition text-sm font-medium">
                    Log in
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prev/Next Navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-4 border-t border-border">
          {prevLesson ? (
            <Link
              to={`/lesson/${prevLesson.id}`}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition group sm:max-w-[45%]"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Previous</p>
                <p className="text-sm text-foreground truncate">{prevLesson.title}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <Link
              to={`/lesson/${nextLesson.id}`}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition group sm:max-w-[45%] sm:text-right"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Next</p>
                <p className="text-sm text-foreground truncate">{nextLesson.title}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
            </Link>
          ) : (
            <Link
              to={`/subjects/${lesson.subject_id}`}
              className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-600 transition"
            >
              <span>Finish Course</span>
              <CheckCircle2 className="w-5 h-5" />
            </Link>
          )}
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
