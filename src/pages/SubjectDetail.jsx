import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useState } from 'react';
import { useParams, useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { BookOpen, PlayCircle, CheckCircle2, Lock, ArrowLeft, FileText, Share2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [justEnrolled, setJustEnrolled] = useState(false);

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

  const handleLessonClick = async () => {
    if (!hasPaidFees) { navigate('/subscription'); return; }
    if (!isEnrolled) await enrollMutation.mutateAsync();
  };

  const firstLesson = lessons.length > 0 ? lessons[0] : null;
  // ── Smart CTA ──
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

  const lessonsByTopic = {};
  lessons.forEach(l => { (lessonsByTopic[l.topic_id] ||= []).push(l); });
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
        {/* Compact Header — back + share */}
        <div className="flex items-center justify-between">
          <Link to="/subjects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <div className="flex items-center gap-3">
            {subject.is_premium && <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">Premium</Badge>}
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors" title="Share course">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title + description folded together */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">{subject.name}</h1>
          {subject.form_name && <p className="text-sm text-muted-foreground mt-1">{subject.form_name}</p>}
          {subject.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2">{subject.description}</p>}
          {subject.teacher_name && (
            <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
              <GraduationCap className="w-4 h-4 text-primary/70" />
              <span className="text-xs uppercase tracking-widest font-semibold mr-1">Tutor</span>
              <span className="font-semibold text-foreground">{subject.teacher_name}</span>
            </div>
          )}
        </div>

        {/* Thumbnail or Intro Video */}
        {subject.video_url ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-black">
            <iframe src={subject.video_url} className="w-full h-full" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        ) : subject.cover_image ? (
          <div className="rounded-2xl overflow-hidden aspect-video bg-muted">
            <img src={subject.cover_image} alt={subject.name} className="w-full h-full object-cover" />
          </div>
        ) : null}

        {/* Progress + CTA — merged into one card */}
        {isEnrolled && totalLessons > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Progress</span>
              <span className="font-bold text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">{completedLessons.length} of {totalLessons} lessons completed</p>
          </div>
        )}

        {/* Course Content */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-base">Course Content</h2>
            <span className="text-xs text-muted-foreground">
              {topics.length > 0 ? `${topics.length} topics · ${lessons.length} lessons` : `${lessons.length} lessons`}
            </span>
          </div>

          {lessons.length === 0 && topics.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No lessons published yet
            </div>
          ) : topics.length > 0 ? (
            <Accordion type="multiple" defaultValue={topics.map(t => t.id)}>
              {topics.map((topic) => {
                const tl = lessonsByTopic[topic.id] || [];
                return (
                  <AccordionItem key={topic.id} value={topic.id} className="border-0 border-b border-border last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:text-primary">
                      <span className="font-medium text-sm text-left flex-1">
                        {topic.title || topic.name || 'Untitled Topic'}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">({tl.length})</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      {tl.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground italic">No lessons yet</p>
                      ) : tl.map((lesson) => {
                        const isCompleted = completedLessons.includes(lesson.id);
                        const locked = !user || !hasPaidFees;
                        const to = !user ? '/register' : !hasPaidFees ? '/subscription' : `/lesson/${lesson.id}`;
                        return (
                          <Link key={lesson.id} to={to} onClick={() => !locked && handleLessonClick()}
                            className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 text-sm transition-colors hover:bg-muted/30 ${isCompleted ? 'bg-success/5' : locked ? 'opacity-70' : ''}`}>
                            <span className="flex-shrink-0">
                              {isCompleted ? <CheckCircle2 className="w-4 h-4 text-success" />
                              : locked ? <Lock className="w-4 h-4 text-muted-foreground/50" />
                              : lesson.video_url ? <PlayCircle className="w-4 h-4 text-primary" />
                              : <FileText className="w-4 h-4 text-muted-foreground" />}
                            </span>
                            <span className="flex-1 text-foreground/80">{lesson.title}</span>
                            {lesson.duration_minutes && <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes}m</span>}
                          </Link>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div>
              {lessons.map((lesson, idx) => {
                const isCompleted = completedLessons.includes(lesson.id);
                const locked = !user || !hasPaidFees;
                const to = !user ? '/register' : !hasPaidFees ? '/subscription' : `/lesson/${lesson.id}`;
                return (
                  <Link key={lesson.id} to={to} onClick={() => !locked && handleLessonClick()}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 text-sm transition-colors hover:bg-muted/30 ${isCompleted ? 'bg-success/5' : locked ? 'opacity-70' : ''}`}>
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                    <span className="flex-shrink-0">
                      {isCompleted ? <CheckCircle2 className="w-4 h-4 text-success" />
                      : locked ? <Lock className="w-4 h-4 text-muted-foreground/50" />
                      : lesson.video_url ? <PlayCircle className="w-4 h-4 text-primary" />
                      : <FileText className="w-4 h-4 text-muted-foreground" />}
                    </span>
                    <span className="flex-1 text-foreground/80">{lesson.title}</span>
                    {lesson.duration_minutes && <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes}m</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA button — below course content */}
        {ctaConfig && (
          <Link to={ctaConfig.to} onClick={ctaConfig.onClick}>
            <Button className="w-full h-12 text-base font-semibold" size="lg">
              {ctaConfig.label}
            </Button>
          </Link>
        )}
      </div>
    </>
  );
}
