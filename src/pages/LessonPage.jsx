import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, MessageSquare, BookOpen, PlayCircle, FileText, Lock, Layers, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import LessonDiscussion from '@/components/lesson/LessonDiscussion';
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

// ─── BUNNY PLAYER — simple spinner while encoding ──
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
        <video src={video_url} controls className="w-full h-full" playsInline preload="metadata">
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

// ─── GUEST VIDEO GATE ──
function GuestVideoGate({ lesson }) {
  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      {lesson.thumbnail_url || lesson.cover_image ? (
        <img src={lesson.thumbnail_url || lesson.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(8px)', transform: 'scale(1.05)', opacity: 0.4 }} />
      ) : (
        <div className="absolute inset-0 bg-muted" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Lock className="w-12 h-12 text-primary" />
        <div>
          <p className="text-white font-semibold">Create an account to watch</p>
          <p className="text-white/60 text-sm mt-1">Join free — track progress, access all subjects</p>
        </div>
        <a href="/register"><Button size="lg" className="mt-1">Start Learning</Button></a>
        <a href="/login" className="text-xs underline text-white/60">Already have an account? Log in</a>
      </div>
    </div>
  );
}

// ─── SIDEBAR LESSON ITEM ──
function SidebarLesson({ lesson, currentLessonId, completed, locked }) {
  const isActive = lesson.id === currentLessonId;
  const isDone = completed.includes(lesson.id);
  return (
    <Link to={locked ? '#' : `/lesson/${lesson.id}`}
      onClick={(e) => { if (locked) { e.preventDefault(); toast.error('Pay fees to unlock this lesson.'); } }}
      className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all border-l-2',
        isActive ? 'bg-primary/10 text-primary border-primary font-medium' : 'border-transparent',
        locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-card/40 text-sidebar-foreground/80 hover:text-sidebar-foreground')}>
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {isDone ? <Check className="w-3.5 h-3.5 text-green-500" />
        : locked ? <Lock className="w-3 h-3 text-muted-foreground/60" />
        : lesson.video_url ? <PlayCircle className={cn('w-3.5 h-3.5', isActive && 'text-primary')} />
        : <FileText className={cn('w-3.5 h-3.5', isActive && 'text-primary')} />}
      </span>
      <span className="flex-1 truncate">{lesson.title}</span>
      {lesson.estimated_minutes > 0 && <span className="text-[10px] text-muted-foreground">{lesson.estimated_minutes}m</span>}
    </Link>
  );
}

// ─── MAIN ──
export default function LessonPage() {
  const { lessonId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('notes');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => { const r = await db.entities.Lesson.filter({ id: lessonId }); return r[0]; },
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['subjectLessons', lesson?.subject_id],
    queryFn: async () => { try { return await db.entities.Lesson.filter({ subject_id: lesson.subject_id }, 'order', 200); } catch { return []; } },
    enabled: !!lesson?.subject_id,
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', lesson?.subject_id],
    queryFn: async () => { try { return await db.entities.Topic.filter({ subject_id: lesson?.subject_id }, 'order', 200); } catch { return []; } },
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

  const lessonsByTopic = {};
  allLessons.forEach(l => { (lessonsByTopic[l.topic_id] ||= []).push(l); });

  if (!lesson) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (user && isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <Lock className="w-12 h-12 text-primary" />
        <h2 className="text-xl font-display font-bold">Pay Fees to Access Lessons</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Pay your school fees to unlock all lessons on the platform.</p>
        <div className="flex gap-3">
          <Link to="/subscription"><Button>Pay Fees Now</Button></Link>
          <Link to={`/subjects/${lesson.subject_id}`}><Button variant="outline">Back to Course</Button></Link>
        </div>
      </div>
    );
  }

  const hasVideo = !!lesson.video_url;
  const lessonTitle = lesson.seo_title || lesson.title;
  const lessonDesc = lesson.seo_description || (lesson.content || '').replace(/<[^>]+>/g, '').slice(0, 160) || `Watch and study: ${lesson.title}.`;
  const lessonUrl = `${window.location.origin}/lesson/${lessonId}`;
  const completeBtn = user && enrollment && (
    <Button onClick={() => markCompleteMutation.mutate()} variant={isCompleted ? 'secondary' : 'default'} size="sm"
      disabled={isCompleted || markCompleteMutation.isPending} className="h-8 text-xs font-semibold">
      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />{isCompleted ? 'Done' : 'Complete'}
    </Button>
  );

  return (
    <>
      <SEO title={lessonTitle} description={lessonDesc} canonical={lessonUrl} ogType="article"
        ogImage={lesson.og_image || lesson.thumbnail || undefined} ogTitle={lesson.og_title || lessonTitle}
        keywords={lesson.seo_keywords || `${lesson.title}, MSCE, Chibondo Academy`} />

      <div className="flex flex-col lg:flex-row min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 bg-background text-foreground relative pb-16 lg:pb-0">

        {/* MOBILE TOP BAR */}
        <div className="sticky top-0 z-40 w-full bg-card/95 backdrop-blur-md border-b border-border lg:hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 h-14">
            <Link to={`/subjects/${lesson.subject_id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground min-w-0 max-w-[40%]">
              <ArrowLeft className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-semibold truncate">{lesson.subject_name || 'Subject'}</span>
            </Link>
            <div className="flex-1 px-2 text-center min-w-0 max-w-[35%]">
              <p className="text-[10px] text-muted-foreground truncate">{lesson.topic_title || 'Topic'}</p>
              <h2 className="text-xs font-bold truncate">{lesson.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted text-muted-foreground">{completedLessons.length}/{allLessons.length}</span>}
              {completeBtn}
            </div>
          </div>
          <div className="w-full h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} /></div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <aside className="bg-sidebar text-sidebar-foreground border-r border-border flex-shrink-0 hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-80 flex-col">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <Link to={`/subjects/${lesson.subject_id}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground min-w-0">
              <ArrowLeft className="w-4 h-4" /><span className="text-xs font-semibold truncate">{lesson.subject_name || 'Course'}</span>
            </Link>
          </div>
          {user && (
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {topics.length === 0 ? allLessons.map(l => (
              <SidebarLesson key={l.id} lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLocked} />
            )) : topics.map((topic, tIdx) => {
              const tl = lessonsByTopic[topic.id] || [];
              return (
                <div key={topic.id} className="space-y-0.5">
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[9px] uppercase font-bold text-primary tracking-wider">Topic {tIdx + 1}</p>
                    <p className="text-xs font-bold truncate">{topic.title}</p>
                  </div>
                  {tl.map(l => <SidebarLesson key={l.id} lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLocked} />)}
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* VIDEO AREA — sticky on desktop */}
          <div className="w-full bg-black lg:sticky lg:top-0 z-30">
            {hasVideo ? (
              !user ? <GuestVideoGate lesson={lesson} /> : <VideoPlayer lesson={lesson} />
            ) : (
              <div className="bg-slate-900 py-12 px-6 flex flex-col items-center text-center">
                <FileText className="w-12 h-12 text-primary mb-3" />
                <p className="text-lg font-bold text-white">Reading Lesson</p>
                <p className="text-sm text-slate-400 mt-1">Study notes below — no video for this lesson.</p>
              </div>
            )}
          </div>

          {/* CONTENT BODY */}
          <div className="p-4 sm:p-6 lg:p-8 max-w-4xl w-full space-y-6">

            {/* LESSON HEADER */}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-primary font-bold">{lesson.topic_title || 'Lesson'}</p>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold">{lesson.title}</h1>
              {lesson.description && <p className="text-sm text-muted-foreground leading-relaxed">{lesson.description}</p>}
              {user && enrollment && (
                <div className="pt-2">{completeBtn}</div>
              )}
            </div>

            {/* TABS */}
            <div className="space-y-4">
              <div className="flex border-b border-border overflow-x-auto scrollbar-none">
                <button onClick={() => setActiveTab('notes')}
                  className={cn("flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap", activeTab === 'notes' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <BookOpen className="w-4 h-4" />Notes
                </button>
                <button onClick={() => setActiveTab('discussion')}
                  className={cn("flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap", activeTab === 'discussion' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  <MessageSquare className="w-4 h-4" />Discussion
                </button>
                {user && lesson.attachments?.length > 0 && (
                  <button onClick={() => setActiveTab('downloads')}
                    className={cn("flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap", activeTab === 'downloads' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                    <Download className="w-4 h-4" />Files ({lesson.attachments.length})
                  </button>
                )}
              </div>

              <div className="pt-2">
                {activeTab === 'notes' && (
                  <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 shadow-sm">
                    {lesson.content ? (
                      !user ? (
                        <div className="relative">
                          <div className="lesson-prose max-w-none pointer-events-none select-none"
                            style={{ maxHeight: '8rem', overflow: 'hidden', maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)' }}
                            dangerouslySetInnerHTML={{ __html: lesson.content }} />
                          <div className="mt-4 rounded-xl p-6 text-center border border-primary bg-card shadow-lg">
                            <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
                            <p className="text-sm font-bold">Sign in to read the full notes</p>
                            <p className="text-xs text-muted-foreground mb-4">Create a free account to access all notes and track progress.</p>
                            <div className="flex gap-2 justify-center">
                              <a href="/register"><Button size="sm" className="text-xs h-9 px-5">Start Learning</Button></a>
                              <a href="/login"><Button variant="outline" size="sm" className="text-xs h-9 px-5">Login</Button></a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="lesson-prose max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                      )
                    ) : (
                      <div className="text-center py-16">
                        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No notes available for this lesson yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'discussion' && (
                  <div className="space-y-4">
                    <LessonDiscussion lessonId={lessonId} />
                    <LessonComments lessonId={lessonId} />
                  </div>
                )}

                {activeTab === 'downloads' && user && lesson.attachments?.length > 0 && (
                  <div className="space-y-3">
                    {lesson.attachments.map((file, idx) => (
                      <a key={idx} href={file.url || file} download
                        className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors group">
                        <Download className="w-5 h-5 text-primary group-hover:translate-y-0.5 transition-transform" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name || `File ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground">Download</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* NEXT/PREV NAVIGATION — bottom cards only */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-border">
              {prevLesson ? (
                <Link to={`/lesson/${prevLesson.id}`}>
                  <div className="flex items-center gap-3 p-5 rounded-2xl border border-border hover:bg-muted/30 transition-all group h-full">
                    <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-transform group-hover:-translate-x-1" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Previous</p>
                      <p className="text-xs font-bold truncate mt-1">{prevLesson.title}</p>
                    </div>
                  </div>
                </Link>
              ) : <div className="p-5 rounded-2xl border border-dashed border-border flex items-center justify-center text-muted-foreground/40 text-xs">First Lesson</div>}

              {nextLesson ? (
                <Link to={`/lesson/${nextLesson.id}`}>
                  <div className="flex items-center gap-3 p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all group justify-end text-right h-full">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Next Lesson</p>
                      <p className="text-xs font-bold truncate mt-1">{nextLesson.title}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-5 rounded-2xl border border-green-500/30 bg-green-500/5 text-green-500 justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                  <div><p className="text-xs font-bold">Course Completed!</p><p className="text-[10px] opacity-80">You've completed all lessons</p></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MOBILE COURSE CONTENT BUTTON */}
        <button onClick={() => setMobileDrawerOpen(true)}
          className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm h-11 shadow-xl rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold">
          <Layers className="w-4 h-4" />Course Content ({allLessons.length})
        </button>

        {/* MOBILE DRAWER */}
        {mobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
            <div className="absolute inset-0" onClick={() => setMobileDrawerOpen(false)} />
            <div className="relative bg-card rounded-t-3xl w-full max-h-[85vh] flex flex-col shadow-2xl z-10">
              <div className="mx-auto my-3 w-12 h-1.5 bg-muted rounded-full" />
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <h3 className="text-sm font-bold">Course Content</h3>
                <button onClick={() => setMobileDrawerOpen(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-16">
                {user && (
                  <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-primary">{progressPct}% ({completedLessons.length}/{allLessons.length})</span>
                  </div>
                )}
                {topics.length === 0 ? allLessons.map(l => (
                  <SidebarLesson key={l.id} lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLocked} />
                )) : topics.map((topic, tIdx) => {
                  const tl = lessonsByTopic[topic.id] || [];
                  const doneCount = tl.filter(l => completedLessons.includes(l.id)).length;
                  return (
                    <div key={topic.id} className="bg-card border border-border/60 rounded-xl p-2.5">
                      <div className="flex items-center justify-between px-2 py-1">
                        <div><p className="text-[9px] uppercase font-bold text-primary tracking-wider">Topic {tIdx + 1}</p>
                        <h4 className="text-xs font-bold truncate">{topic.title}</h4></div>
                        <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{doneCount}/{tl.length}</span>
                      </div>
                      <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                        {tl.map(l => <div key={l.id} onClick={() => setMobileDrawerOpen(false)}><SidebarLesson lesson={l} currentLessonId={lessonId} completed={completedLessons} locked={isLocked} /></div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
