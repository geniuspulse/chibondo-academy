import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ArrowLeft, FileText, Share2, GraduationCap, ChevronDown, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import { cn } from '@/lib/utils';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [justEnrolled, setJustEnrolled] = useState(false);
  const [openTopics, setOpenTopics] = useState({ 0: true });

  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => { const r = await db.entities.Subject.filter({ id: subjectId }); return r[0]; },
  });

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', subjectId],
    queryFn: () => db.entities.Topic.filter({ subject_id: subjectId }, 'order', 200),
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons', subjectId],
    queryFn: () => db.entities.Lesson.filter({ subject_id: subjectId }, 'order', 200),
  });

  const { data: enrollment } = useQuery({
    queryKey: ['enrollment', user?.id, subjectId],
    queryFn: async () => {
      if (!user?.id) return null;
      const r = await db.entities.Enrollment.filter({ student_id: user.id, subject_id: subjectId });
      return r[0] || null;
    },
    enabled: !!user?.id,
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
  const isEnrolled = !!enrollment || justEnrolled;

  // ── Lesson preview logic ──
  // First lesson of each subject is a free preview (like BBA's preview lessons)
  const lessonsByTopic = {};
  lessons.forEach(l => { (lessonsByTopic[l.topic_id] ||= []).push(l); });
  const firstLessonId = lessons.length > 0 ? lessons[0].id : null;
  const isPreviewLesson = (lessonId) => lessonId === firstLessonId;

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const rec = await db.entities.Enrollment.create({
        student_id: user.id, subject_id: subjectId,
        subject_name: subject?.name, form_id: subject?.form_id, form_name: subject?.form_name,
        completed_lessons: [], status: 'active', progress_percentage: 0,
        last_accessed: new Date().toISOString(),
      });
      try { await db.entities.Subject.update(subjectId, { enrollment_count: (subject?.enrollment_count || 0) + 1 }); } catch(_) {}
      return rec;
    },
    onSuccess: () => {
      setJustEnrolled(true);
      toast.success('✓ You have successfully joined this class.');
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
    },
    onError: () => toast.error('Could not join class. Please try again.'),
  });

  const handleLessonClick = (lessonId) => {
    if (isPreviewLesson(lessonId)) {
      navigate(`/lesson/${lessonId}`);
      return;
    }
    if (!hasPaidFees) { navigate('/subscription'); return; }
    if (!isEnrolled) {
      enrollMutation.mutateAsync().then(() => navigate(`/lesson/${lessonId}`));
      return;
    }
    navigate(`/lesson/${lessonId}`);
  };

  const firstLesson = lessons.length > 0 ? lessons[0] : null;
  const ctaConfig = !user
    ? { label: 'Get Started', to: '/register' }
    : !hasPaidFees
    ? { label: 'Pay Fees to Unlock', to: '/subscription' }
    : !isEnrolled
    ? { label: 'Join Class', to: firstLesson ? `/lesson/${firstLesson.id}` : '/subjects', onClick: () => enrollMutation.mutateAsync() }
    : firstLesson
    ? { label: 'Continue Learning', to: `/lesson/${firstLesson.id}` }
    : null;

  const shareLink = `${window.location.origin}/subjects/${subjectId}?ref=${referralCode}`;
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `Study ${subject.name} - Chibondo Academy`, url: shareLink });
    } else {
      navigator.clipboard.writeText(shareLink);
      toast.success('Link copied!');
    }
  };

  const completedLessons = enrollment?.completed_lessons || [];
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  if (!subject) return (
    <div className="flex items-center justify-center py-20">
      <SectionLoader label="Loading subject…" />
    </div>
  );

  // ── SEO ──
  const teacherName = subject.teacher_name || 'Chibondo Academy';
  const lessonCount = lessons.length;
  const topicCount = topics.length;
  const metaTitle = `${subject.name} | ${subject.form_name || 'MSCE'} | Chibondo Academy`;
  const metaDesc = subject.description
    ? subject.description.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Study ${subject.name} (${subject.form_name || 'Secondary'}) online at Chibondo Academy. ${lessonCount} lessons, ${topicCount} topics taught by ${teacherName}.`;
  const canonicalUrl = `${window.location.origin}/subjects/${subjectId}`;
  const keywords = [subject.name, subject.form_name, 'MSCE', 'Malawi secondary school', 'online lessons Malawi', 'Chibondo Academy', teacherName].filter(Boolean).join(', ');

  const courseSchema = {
    "@context": "https://schema.org", "@type": "Course",
    name: subject.name, description: metaDesc, url: canonicalUrl,
    image: subject.cover_image || undefined, keywords,
    provider: { "@type": "Organization", name: "Chibondo Academy", url: window.location.origin, logo: `${window.location.origin}/logo.png` },
    instructor: { "@type": "Person", name: teacherName },
    educationalLevel: subject.form_name || "Secondary", teaches: subject.name,
    courseMode: "Online", numberOfCredits: lessonCount,
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", courseWorkload: `${lessonCount} lessons` },
    offers: { "@type": "Offer", category: subject.is_premium ? "Paid" : "Free", priceCurrency: "MWK", price: subject.is_premium ? "10000" : "0", availability: "https://schema.org/InStock", url: canonicalUrl },
  };

  return (
    <>
      <SEO title={subject.seo_title || metaTitle} description={subject.seo_description || metaDesc}
        canonical={canonicalUrl} ogImage={subject.cover_image || undefined} schema={courseSchema}
        keywords={subject.seo_keywords || keywords} ogTitle={subject.og_title || subject.seo_title || metaTitle}
        ogDescription={subject.og_description || subject.seo_description || metaDesc}
        ogImageOverride={subject.og_image || subject.cover_image || undefined} />

      <div className="space-y-5">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <Link to="/subjects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <div className="flex items-center gap-3">
            {subject.is_premium && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Premium</Badge>}
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors" title="Share course">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BBA-style hero header */}
        <div className="relative overflow-hidden rounded-2xl p-6 border border-border"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--chart-3) / 0.1) 100%)' }}>
          <div className="absolute inset-0 dot-grid opacity-20" />
          <div className="relative z-10">
            <h1 className="text-2xl lg:text-3xl font-heading font-bold">{subject.name}</h1>
            {subject.form_name && <p className="text-sm text-muted-foreground mt-1">{subject.form_name}</p>}
            {subject.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-2xl">{subject.description}</p>}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {subject.teacher_name && (
                <div className="flex items-center gap-1.5 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold">{subject.teacher_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                <span>{totalLessons} lessons</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{topicCount} topics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail or Intro Video */}
        {subject.video_url ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-black border border-border">
            <iframe src={subject.video_url} className="w-full h-full" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        ) : subject.cover_image ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-muted border border-border">
            <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover" />
          </div>
        ) : null}

        {/* Progress + CTA — merged card */}
        {isEnrolled && totalLessons > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold font-heading">Your Progress</span>
              <span className="font-bold text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">{completedLessons.length} of {totalLessons} lessons completed</p>
          </div>
        )}

        {/* CTA Button */}
        {ctaConfig && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <Button
              onClick={() => {
                if (ctaConfig.onClick) ctaConfig.onClick();
                if (ctaConfig.to) navigate(ctaConfig.to);
              }}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition-all"
            >
              {ctaConfig.label}
            </Button>
            {!user && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
              </p>
            )}
          </div>
        )}

        {/* Curriculum — BBA-style accordion with lesson previews */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Course Content
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {totalLessons} lessons · {topicCount} topics
              {firstLessonId && ' · 1 free preview'}
            </p>
          </div>

          <div className="divide-y divide-border">
            {topics.length === 0 && lessons.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No content available yet.
              </div>
            )}

            {topics.map((topic, topicIdx) => {
              const topicLessons = lessonsByTopic[topic.id] || [];
              const isOpen = openTopics[topicIdx] ?? (topicIdx === 0);
              const topicCompletedCount = topicLessons.filter(l => completedLessons.includes(l.id)).length;

              return (
                <div key={topic.id} className="bg-background">
                  <button
                    onClick={() => setOpenTopics(prev => ({ ...prev, [topicIdx]: !prev[topicIdx] }))}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{topicIdx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{topic.title || topic.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {topicLessons.length} lesson{topicLessons.length !== 1 ? 's' : ''}
                        {topicCompletedCount > 0 && ` · ${topicCompletedCount} completed`}
                      </p>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="pb-2 pl-4 pr-4 space-y-1">
                      {topicLessons.map((lesson, lessonIdx) => {
                        const isDone = completedLessons.includes(lesson.id);
                        const isPreview = isPreviewLesson(lesson.id);
                        const canAccess = isPreview || hasPaidFees;
                        const globalIdx = lessons.findIndex(l => l.id === lesson.id) + 1;

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                              canAccess ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              ) : isPreview ? (
                                <Eye className="w-4 h-4 text-primary" />
                              ) : !canAccess ? (
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : lesson.video_url ? (
                                <PlayCircle className="w-4 h-4 text-primary" />
                              ) : (
                                <FileText className="w-4 h-4 text-muted-foreground" />
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lesson.title}</p>
                              {lesson.estimated_minutes > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{lesson.estimated_minutes} min</p>
                              )}
                            </div>
                            {isPreview && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 uppercase tracking-wide flex-shrink-0">
                                Free Preview
                              </span>
                            )}
                            {!isPreview && !canAccess && (
                              <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Lessons without topics */}
            {lessonsByTopic[null] && lessonsByTopic[null].length > 0 && (
              <div className="bg-background">
                <div className="pb-2 pl-4 pr-4 space-y-1 pt-2">
                  {lessonsByTopic[null].map(lesson => {
                    const isDone = completedLessons.includes(lesson.id);
                    const isPreview = isPreviewLesson(lesson.id);
                    const canAccess = isPreview || hasPaidFees;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                          canAccess ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
                          {isDone ? <CheckCircle2 className="w-4 h-4 text-success" />
                          : isPreview ? <Eye className="w-4 h-4 text-primary" />
                          : !canAccess ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          : <FileText className="w-4 h-4 text-muted-foreground" />}
                        </span>
                        <p className="text-sm font-medium truncate flex-1">{lesson.title}</p>
                        {isPreview && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 uppercase tracking-wide">
                            Free Preview
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subscribe banner for non-paying users */}
        {user && !hasPaidFees && (
          <div className="bg-card border border-primary/30 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-heading font-bold text-base mb-1">Unlock All Lessons</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Subscribe to access all {totalLessons} lessons, quizzes, and past papers.
            </p>
            <Button
              onClick={() => navigate('/subscription')}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition-all"
            >
              Pay School Fees
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
