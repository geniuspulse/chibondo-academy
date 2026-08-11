import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, BookOpen, PlayCircle, GraduationCap, Award, FileText,
  Phone, Mail, Facebook, Linkedin, Youtube, Twitter,
  Users, Star, Clock, ChevronRight, MessageSquare, Zap
} from 'lucide-react';

/* ── helpers ───────────────────────────────────────────────────────────────── */
function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}

/* ── Sticky CTA ────────────────────────────────────────────────────────────── */
function StickyCTA({ isAuthenticated, isSubscribed, navigate }) {
  if (isSubscribed) return null;
  return (
    <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 py-2.5 bg-background/95 backdrop-blur border-t border-border shadow-2xl">
      <button
        onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}
        className="w-full py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
        style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}
      >
        Start Learning
      </button>
    </div>
  );
}

/* ── Subject / Course card ─────────────────────────────────────────────────── */
function CourseCard({ subject, navigate }) {
  const lessons = subject.total_lessons || 0;
  const students = subject.enrollment_count || 0;

  return (
    <button
      onClick={() => navigate(`/subjects/${subject.id}`)}
      className="w-full text-left group flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/20 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 shadow-sm">
        {subject.cover_image
          ? <img src={subject.cover_image} alt="" loading="lazy" decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary/30" />
            </div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-snug group-hover:text-accent transition-colors line-clamp-1">
          {subject.name}
        </p>
        {subject.form_name && (
          <p className="text-xs text-muted-foreground mt-0.5">{subject.form_name}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {lessons > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <PlayCircle className="w-2.5 h-2.5" />{lessons} {lessons === 1 ? 'lesson' : 'lessons'}
            </span>
          )}
          {students > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />{students.toLocaleString()} enrolled
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors flex-shrink-0" />
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function TutorProfilePage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { user }   = useOutletContext() ?? {};
  const [avatarErr, setAvatarErr] = useState(false);
  const [bioOpen,   setBioOpen]   = useState(false);

  const isAuthenticated = !!user?.id;
  const isSubscribed    = user?.subscription_status === 'active';

  /* ─────────────────────────────────────────────────
     Step 1: Try to resolve the slug via TutorProfile.
     If slug looks like a legacy ID (24 hex chars), also
     try resolving as a User ID directly.
  ───────────────────────────────────────────────── */
  const looksLikeId = /^[a-f0-9]{24}$/.test(slug);

  const { data: profilesBySlug = [], isLoading: loadingSlug } = useQuery({queryKey: ['tutor-by-slug', slug],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ slug, status: 'active' }, 'full_name', 1); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
    enabled:  !looksLikeId,
    placeholderData: [],
  });

  const { data: profilesByUserId = [], isLoading: loadingById } = useQuery({queryKey: ['tutor-by-user-id', slug],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ user_id: slug, status: 'active' }, 'full_name', 1); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
    enabled:  looksLikeId,
    placeholderData: [],
  });

  /* The resolved TutorProfile (may be null — teacher with no profile yet) */
  const tutorProfile = profilesBySlug[0] || profilesByUserId[0] || null;

  /* ─────────────────────────────────────────────────
     Step 2: Resolve the teacher User record.
     If we have a TutorProfile, use user_id. Otherwise
     the slug IS the user ID.
  ───────────────────────────────────────────────── */
  const teacherUserId = tutorProfile?.user_id || (looksLikeId ? slug : null);

  const { data: teacherUsers = [], isLoading: loadingUser } = useQuery({queryKey: ['teacher-user', teacherUserId],
    queryFn: async () => { try { return await db.entities.User.filter({ id: teacherUserId }, 'full_name', 1); } catch(e) { console.error(e); return []; } },
    enabled:  !!teacherUserId,
    staleTime: 120_000,
    placeholderData: [],
  });
  const teacherUser = teacherUsers[0] || null;

  /* ─────────────────────────────────────────────────
     Step 3: Subjects (courses) — query by teacher_id
     (the user's ID) as the primary join key, so courses
     show up even if TutorProfile isn't created yet.
  ───────────────────────────────────────────────── */
  const { data: subjects = [] } = useQuery({queryKey: ['tutor-subjects-by-teacher', teacherUserId],
    queryFn: async () => { try { return await db.entities.Subject.filter({ teacher_id: teacherUserId, status: 'published' }, 'name', 50); } catch(e) { console.error(e); return []; } },
    enabled:  !!teacherUserId,
    staleTime: 30_000,
    placeholderData: [],
  });

  /* Blog posts */
  const { data: blogPosts = [] } = useQuery({queryKey: ['tutor-blog', teacherUserId],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 6); } catch(e) { console.error(e); return []; } },
    enabled:  !!teacherUserId,
    staleTime: 120_000,
    placeholderData: [],
  });
  const tutorPosts = blogPosts.filter(p =>
    p.tutor_profile_id === tutorProfile?.id || p.author_id === teacherUserId
  );

  /* ─────────────────────────────────────────────────
     Merge display data: TutorProfile > User fallback
  ───────────────────────────────────────────────── */
  const isLoading = loadingSlug || loadingById || loadingUser;

  const displayName  = tutorProfile?.full_name      || teacherUser?.full_name || teacherUser?.email || '';
  const photo        = tutorProfile?.profile_photo  || teacherUser?.avatar_url || '';
  const coverPhoto   = tutorProfile?.cover_photo    || '';
  const title        = tutorProfile?.professional_title || '';
  const tagline      = tutorProfile?.tagline        || '';
  const bioHtml      = tutorProfile?.biography      || '';
  const yearsTeaching= tutorProfile?.years_teaching || 0;
  const subjectTags  = tutorProfile?.subjects       || [];
  const qualifications = tutorProfile?.qualifications || [];
  const certifications = tutorProfile?.certifications || [];

  const totalStudents = useMemo(() =>
    subjects.reduce((acc, s) => acc + (s.enrollment_count || 0), 0),
  [subjects]);

  /* Social links */
  const socials = [
    { href: tutorProfile?.email  && `mailto:${tutorProfile.email}`,  Icon: Mail,     label: 'Email'    },
    { href: tutorProfile?.phone  && `tel:${tutorProfile.phone}`,      Icon: Phone,    label: 'Phone'    },
    { href: tutorProfile?.linkedin,                                    Icon: Linkedin, label: 'LinkedIn' },
    { href: tutorProfile?.facebook,                                    Icon: Facebook, label: 'Facebook' },
    { href: tutorProfile?.youtube,                                     Icon: Youtube,  label: 'YouTube'  },
    { href: tutorProfile?.twitter_x,                                   Icon: Twitter,  label: 'Twitter'  },
  ].filter(s => s.href);

  /* ─────────────────────────────────────────────────
     Loading / Not found
  ───────────────────────────────────────────────── */
  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent"
            style={{ animation:`bounce 1.2s ${i*0.15}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-7px);opacity:1}}`}</style>
    </div>
  );

  if (!displayName) return (
    <div className="text-center py-24 space-y-3">
      <GraduationCap className="w-14 h-14 mx-auto text-muted-foreground/20" />
      <p className="font-bold text-lg">Tutor not found</p>
      <button onClick={() => navigate('/tutors')}
        className="px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
        ← View All Tutors
      </button>
    </div>
  );

  const bioText    = stripHtml(bioHtml);
  const bioPreview = bioText.slice(0, 280);
  const hasBioMore = bioText.length > 280;
  const initials   = displayName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <>
      <SEO
        title={`${displayName} | Chibondo Academy`}
        description={`${displayName}${title ? ` — ${title}` : ''}. ${tagline || ''}`}
        canonical={`https://aca.db.app/tutors/${slug}`}
        ogImage={coverPhoto || photo}
      />

      <StickyCTA isAuthenticated={isAuthenticated} isSubscribed={isSubscribed} navigate={navigate} />

      <div className="pb-28 lg:pb-10 -mt-4 lg:-mt-6">

        {/* ── Header banner ── */}
        <div className="relative -mx-4 lg:-mx-6 overflow-hidden"
          style={{ minHeight: '180px' }}>
          {coverPhoto ? (
            <img src={coverPhoto} alt="Cover"
              className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-48"
              style={{ background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)' }}>
              <div className="absolute inset-0"
                style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, hsl(var(--primary)) 0%, transparent 60%)' }} />
            </div>
          )}
          {/* Dark overlay at bottom for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

          {/* Back button */}
          <button
            onClick={() => navigate('/tutors')}
            className="absolute top-4 left-4 lg:left-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm border border-white/20 bg-black/30 hover:bg-black/45 text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Tutors
          </button>
        </div>

        {/* ── Identity ── */}
        <div className="px-4 lg:px-6">
          {/* Avatar overlaps cover */}
          <div className="relative -mt-12 mb-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 shadow-2xl"
              style={{ borderColor:'hsl(var(--card))', background:'hsl(var(--muted))' }}>
              {photo && !avatarErr ? (
                <img src={photo} alt={displayName} loading="eager" decoding="async"
                  onError={() => setAvatarErr(true)}
                  className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
                  <span className="text-3xl font-bold text-primary-foreground">{initials}</span>
                </div>
              )}
            </div>
          </div>

          <h1 className="font-heading font-bold text-2xl sm:text-3xl leading-tight">{displayName}</h1>
          {title && (
            <p className="text-sm font-medium mt-0.5" style={{ color:'hsl(var(--primary))' }}>{title}</p>
          )}
          {tagline && (
            <p className="text-sm text-muted-foreground italic mt-1">"{tagline}"</p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-4 py-4 border-y border-border">
            {subjects.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="font-bold">{subjects.length}</span>
                <span className="text-muted-foreground">{subjects.length === 1 ? 'Course' : 'Courses'}</span>
              </div>
            )}
            {totalStudents > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-accent" />
                <span className="font-bold">{totalStudents.toLocaleString()}</span>
                <span className="text-muted-foreground">Students</span>
              </div>
            )}
            {yearsTeaching > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4 text-accent" />
                <span className="font-bold">{yearsTeaching}</span>
                <span className="text-muted-foreground">{yearsTeaching === 1 ? 'year' : 'years'} experience</span>
              </div>
            )}
            {subjectTags.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">{subjectTags.join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Social links */}
          {socials.length > 0 && (
            <div className="flex gap-2.5 mt-4 flex-wrap">
              {socials.map(({ href, Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                  title={label}>
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── Two-column body ── */}
        <div className="px-4 lg:px-6 mt-6 grid lg:grid-cols-3 gap-6">

          {/* ── LEFT: main content ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Biography */}
            {bioText && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent" /> About
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {bioOpen ? bioText : bioPreview}{hasBioMore && !bioOpen && '…'}
                </p>
                {hasBioMore && (
                  <button onClick={() => setBioOpen(v => !v)}
                    className="mt-2 text-xs font-semibold text-accent hover:underline">
                    {bioOpen ? 'Show less' : 'Read more'}
                  </button>
                )}
              </section>
            )}

            {/* Courses */}
            {subjects.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-heading font-bold text-base mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" /> Courses
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{subjects.length} available</span>
                </h2>
                <div className="space-y-3">
                  {subjects.map(s => <CourseCard key={s.id} subject={s} navigate={navigate} />)}
                </div>
              </section>
            )}

            {/* Blog posts */}
            {tutorPosts.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-heading font-bold text-base mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" /> Articles & Resources
                </h2>
                <div className="space-y-3">
                  {tutorPosts.map(post => (
                    <div key={post.id}
                      className="flex gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/blog/${post.id}`)}>
                      {post.cover_image && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                          <img src={post.cover_image} alt="" loading="lazy" decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2 group-hover:text-accent transition-colors">{post.title}</p>
                        {post.excerpt && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.excerpt}</p>}
                        {post.published_at && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(post.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent flex-shrink-0 self-center transition-colors" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Qualifications */}
            {qualifications.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent" /> Qualifications
                </h2>
                <div className="space-y-3">
                  {qualifications.map((q, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{q.name}</p>
                        {q.institution && <p className="text-xs text-muted-foreground">{q.institution}{q.year ? ` · ${q.year}` : ''}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <section className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-heading font-bold text-base mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" /> Certifications
                </h2>
                <div className="space-y-3">
                  {certifications.map((c, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Award className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        {c.organization && <p className="text-xs text-muted-foreground">{c.organization}{c.date_issued ? ` · ${c.date_issued}` : ''}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT: sidebar ── */}
          <div className="space-y-4">

            {/* CTA card */}
            {!isSubscribed && (
              <div className="hidden lg:block rounded-2xl p-5 text-center"
                style={{ background:'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)' }}>
                <Zap className="w-8 h-8 mx-auto mb-3" style={{ color:'hsl(var(--primary))' }} />
                <p className="font-heading font-bold text-sm mb-1">Start Learning Today</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Get full access to all courses by {displayName.split(' ')[0]}.
                </p>
                <button
                  onClick={() => navigate(isAuthenticated ? '/subscription' : '/register')}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                  {isAuthenticated ? 'View Plans' : 'Get Started'}
                </button>
              </div>
            )}

            {/* Subject tags */}
            {subjectTags.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-accent" /> Specialises In
                </h3>
                <div className="flex flex-wrap gap-2">
                  {subjectTags.map(s => (
                    <span key={s} className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {(tutorProfile?.current_position || tutorProfile?.previous_schools) && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" /> Experience
                </h3>
                {tutorProfile.current_position && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-foreground/80">Current</p>
                    <p className="text-xs text-muted-foreground">{tutorProfile.current_position}</p>
                  </div>
                )}
                {tutorProfile.previous_schools && (
                  <div>
                    <p className="text-xs font-medium text-foreground/80">Previous</p>
                    <p className="text-xs text-muted-foreground">{tutorProfile.previous_schools}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
