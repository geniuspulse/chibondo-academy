import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ArrowLeft, ArrowRight, CheckCircle2, BookOpen, Lock, PlayCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import LessonComments from '@/components/lesson/LessonComments';
import { cn } from '@/lib/utils';
import SEO from '@/components/SEO';
import '@/styles/lesson-prose.css';

// ─── VIDEO UTILS ──
function getYouTubeId(url) {
  if (!url) return null;
  for (const p of [/youtu\.be\/([^?#&]+)/, /youtube\.com\/watch\?v=([^?#&]+)/, /youtube\.com\/embed\/([^?#&]+)/, /youtube\.com\/v\/([^?#&]+)/, /youtube\.com\/shorts\/([^?#&]+)/]) {
    const m = url.match(p); if (m) return m[1];
  }
  return null;
}

const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share; screen-wake-lock";

// ─── BUNNY PLAYER ──
function BunnyPlayer({ videoUrl, lesson }) {
  const [status, setStatus] = useState(null);
  const match = videoUrl?.match(/iframe\.mediadelivery\.net\/embed\/([^/]+)\/([^?#]+)/);
  const libraryId = match?.[1];
  const videoId = match?.[2] || lesson?.bunny_video_id;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('bunny_api_key') : null;
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!libraryId || !videoId || !apiKey) { setStatus('ready'); return; }
    let cancelled = false, timer = null;
    async function check() {
      try {
        const r = await fetch(`/api/bunny?action=status&${new URLSearchParams({ libraryId, videoId, apiKey })}`);
        if (!r.ok) { setStatus('ready'); return; }
        const data = await r.json();
        if (cancelled) return;
        const st = data.status;
        setStatus(st);
        if ((st === 'encoding' || st === 'processing' || st === 'queued') && pollCount < 30) {
          setPollCount(c => c + 1);
          timer = setTimeout(check, 8000);
        }
      } catch { setStatus('ready'); }
    }
    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [libraryId, videoId, apiKey, pollCount]);

  if (status === null || status === 'encoding' || status === 'processing' || status === 'queued') {
    return (
      <div className="aspect-video bg-black w-full flex items-center justify-center">
        <div className="text-center text-white/70 space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-sm font-medium">{status === null ? 'Loading video…' : 'Processing video…'}</p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="aspect-video bg-black w-full flex items-center justify-center">
        <p className="text-sm text-red-400">Video encoding failed. Please contact your teacher.</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black w-full">
      <iframe src={videoUrl} className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" title={lesson?.title || 'Video'} />
    </div>
  );
}

// ─── VIDEO PLAYER ──
function VideoPlayer({ lesson }) {
  const [videoError, setVideoError] = useState(false);
  const { video_url, video_provider } = lesson;
  if (!video_url) return null;

  const ytId = getYouTubeId(video_url);
  if (ytId) {
    const params = 'rel=0&modestbranding=1&iv_load_policy=3&fs=1&playsinline=1&controls=1&origin=' + encodeURIComponent(window.location.origin);
    return (
      <div className="aspect-video bg-black w-full select-none" onContextMenu={e => e.preventDefault()}>
        <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?${params}`}
          className="w-full h-full pointer-events-auto" allow={EMBED_ALLOW} allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" title={lesson.title} loading="lazy" />
      </div>
    );
  }

  if (video_provider === 'bunny' || video_url?.includes('iframe.mediadelivery.net') || video_url?.includes('b-cdn.net'))
    return <BunnyPlayer videoUrl={video_url} lesson={lesson} />;

  if (video_url?.includes('vimeo.com')) {
    const vimeoId = video_url.match(/vimeo\.com\/(\d+)/)?.[1];
    return (
      <div className="aspect-video bg-black w-full">
        <iframe src={vimeoId ? `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0` : video_url}
          className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" title={lesson.title} />
      </div>
    );
  }

  if (video_url?.includes('loom.com')) {
    return (
      <div className="aspect-video bg-black w-full">
        <iframe src={video_url.replace('loom.com/share/', 'loom.com/embed/')}
          className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen title={lesson.title} />
      </div>
    );
  }

  const isDirect = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp|flv)(\?|$)/i.test(video_url);
  if (video_provider === 'upload' || isDirect) {
    return (
      <div className="aspect-video bg-black w-full">
        <video src={video_url} controls className="w-full h-full" playsInline preload="metadata"
          onError={() => setVideoError(true)}>
          <source src={video_url} type="video/mp4" />
          <source src={video_url} type="video/webm" />
        </video>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black w-full">
      <iframe src={video_url} className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" title={lesson.title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation" />
    </div>
  );
}

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

  const { data: allLessons = [] } = useQuery({
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

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const r = await db.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      if (!r[0]) return null;
      const sub = r[0];
      if ((sub.expires_at || sub.end_date) && new Date(sub.expires_at || sub.end_date) < new Date()) return null;
      return sub;
    },
    enabled: !!user?.id,
  });

  const hasPaidFees = !!subscription;
  const isLocked = !!user && !hasPaidFees;

  // ── Lesson Preview Feature ──
  const hasExplicitPreviews = allLessons.some(l => l.is_free);
  const autoPreviewIds = !hasExplicitPreviews ? allLessons.slice(0, 3).map(l => l.id) : [];
  const isPreviewLesson = lesson?.is_free || autoPreviewIds.includes(lessonId);
  const isGuestPreviewing = isPreviewLesson && !user;

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

  // ── Locked: user without fees ──
  if (user && isLocked && !isPreviewLesson) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold mb-3">This Lesson is Locked</h1>
        <p className="text-muted-foreground mb-6">Pay your school fees to unlock all lessons and content.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/subscription" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition">
            Pay Fees Now
          </Link>
          <Link to={`/subjects/${lesson.subject_id}`} className="inline-block px-6 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground transition">
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // ── Locked: guest on non-preview lesson ──
  if (!user && !isPreviewLesson) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold mb-3">This Lesson is Locked</h1>
        <p className="text-muted-foreground mb-6">
          Create a free account and subscribe to unlock all {allLessons.length} lessons in this subject.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition">
            Create Free Account
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
  const hasVideo = !!lesson.video_url;

  return (
    <>
      <SEO title={lessonTitle} description={lessonDesc} canonical={lessonUrl} ogType="article"
        ogImage={lesson.og_image || lesson.thumbnail || undefined} ogTitle={lesson.og_title || lessonTitle}
        keywords={lesson.seo_keywords || `${lesson.title}, MSCE, Chibondo Academy`} />

      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/subjects" className="hover:text-foreground transition">Subjects</Link>
          <span>/</span>
          <Link to={`/subjects/${lesson.subject_id}`} className="hover:text-foreground transition">
            {subject?.name || lesson.subject_name || 'Course'}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{lesson.title}</span>
        </div>

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
              <VideoPlayer lesson={lesson} />
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

        {/* Lesson Content Card */}
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              {isPreviewLesson && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded mb-3">
                  Free Preview
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-foreground">{lesson.title}</h1>
              {lesson.description && (
                <p className="text-sm text-muted-foreground mt-2">{lesson.description}</p>
              )}
            </div>
          </div>

          {/* HTML Content */}
          {lesson.content ? (
            !user && !isGuestPreviewing ? (
              <div className="relative">
                <div className="lesson-content pointer-events-none select-none"
                  style={{ maxHeight: '8rem', overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}
                  dangerouslySetInnerHTML={{ __html: lesson.content }} />
                <div className="mt-4 rounded-xl p-6 text-center border border-primary bg-card shadow-lg">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
                  <p className="text-sm font-bold">Sign in to read the full notes</p>
                  <p className="text-xs text-muted-foreground mb-4">Create a free account to access all lesson content</p>
                  <div className="flex gap-3 justify-center">
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

        {/* Discussion / Comments */}
        {user && (
          <div className="mb-6">
            <LessonComments
              lessonId={lessonId}
              lessonTitle={lesson.title}
              lessonUrl={lessonUrl}
              subjectId={lesson.subject_id}
              user={user}
            />
          </div>
        )}

        {/* Guest CTA — BBA-style */}
        {!user && (
          <div className="mb-6 bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-base font-bold mb-2">Enjoying the lesson?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create a free account to unlock all {allLessons.length} lessons & track your progress
            </p>
            <Link to="/register" className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition">
              Create Free Account
            </Link>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
            </p>
          </div>
        )}

        {/* Prev/Next Navigation */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          {prevLesson ? (
            <Link
              to={`/lesson/${prevLesson.id}`}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition group max-w-[45%]"
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
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition group max-w-[45%] text-right"
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
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-600 transition"
            >
              <span>Finish Course</span>
              <CheckCircle2 className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
