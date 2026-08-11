import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, Users, Clock, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

/* ── Tutor card ─────────────────────────────────────────────────────────────── */
function TutorCard({ profile, courseCount, studentCount }) {
  const [coverErr, setCoverErr]   = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  // All data comes directly from TutorProfile (publicly readable)
  const name      = profile.full_name            || 'Tutor';
  const photo     = profile.profile_photo        || '';
  const coverPhoto= profile.cover_photo          || '';
  const title     = profile.professional_title   || '';
  const tagline   = profile.tagline              || '';
  const subjects  = profile.subjects             || [];
  const years     = profile.years_teaching       || 0;
  const slug      = profile.slug                 || profile.id;

  const initials  = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const hasCover  = coverPhoto && !coverErr;

  return (
    <Link
      to={`/tutors/${slug}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 group flex flex-col"
    >
      {/* Cover banner — only rendered when a real cover photo exists, so cards without one don't waste space */}
      {hasCover && (
        <div className="relative h-24 w-full flex-shrink-0 overflow-hidden">
          <img src={coverPhoto} alt="Cover" loading="eager" decoding="async"
            onError={() => setCoverErr(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>
      )}

      {/* Header row: avatar + name/title side by side */}
      <div className={`px-4 flex items-center gap-3 ${hasCover ? '-mt-7 pb-1' : 'pt-4'}`}>
        <div className="w-14 h-14 rounded-full overflow-hidden border-4 shadow-sm flex-shrink-0"
          style={{ borderColor:'hsl(var(--card))', background:'hsl(var(--muted))' }}>
          {photo && !avatarErr ? (
            <img src={photo} alt={name} loading="eager" decoding="async" onError={() => setAvatarErr(true)}
              className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
              <span className="text-lg font-bold text-primary-foreground select-none">{initials}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1">
            {name}
          </p>
          {title && (
            <p className="text-xs font-medium text-primary line-clamp-1">{title}</p>
          )}
        </div>
        {years > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />{years}yr
          </span>
        )}
      </div>

      {/* Identity details */}
      <div className="px-4 pb-4 pt-2 flex flex-col flex-1">
        {tagline && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">"{tagline}"</p>
        )}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {subjects.slice(0,3).map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          {courseCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3 h-3" />{courseCount} {courseCount === 1 ? 'course' : 'courses'}
            </span>
          )}
          {studentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{studentCount.toLocaleString()} {studentCount === 1 ? 'student' : 'students'}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto" />
        </div>
      </div>
    </Link>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
export default function TutorsPage() {
  const [search, setSearch] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────
  // TutorProfile has rls.read={} — fully public, works for logged-out users.
  // We drive the directory from TutorProfile only; no User.filter() needed.
  const { data: tutorProfiles = [], isLoading } = useQuery({queryKey: ['all-tutor-profiles-public'],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ status: 'active', is_visible: true }, 'full_name', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],
  });

  // Published subjects — rls allows public reads on published records.
  const { data: subjects = [] } = useQuery({queryKey: ['subjects-all-for-tutors'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 500); } catch(e) { console.error(e); return []; } },
    staleTime: 60_000,
    placeholderData: [],
  });

  // Course count per tutor (match on tutor_profile_id OR teacher_id === user_id)
  const courseCountByProfile = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      const key = s.tutor_profile_id || s.teacher_id;
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [subjects]);

  // Student count per tutor
  const studentCountByProfile = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      const key = s.tutor_profile_id || s.teacher_id;
      if (key && s.enrollment_count) {
        map[key] = (map[key] || 0) + s.enrollment_count;
      }
    });
    return map;
  }, [subjects]);

  // Search filter across TutorProfile fields directly
  const filtered = useMemo(() => {
    if (!search.trim()) return tutorProfiles;
    const q = search.toLowerCase();
    return tutorProfiles.filter(p =>
      p.full_name?.toLowerCase().includes(q) ||
      p.professional_title?.toLowerCase().includes(q) ||
      p.tagline?.toLowerCase().includes(q) ||
      p.subjects?.some(s => s.toLowerCase().includes(q))
    );
  }, [tutorProfiles, search]);

  // Alias so the count in the hero header still works
  const visibleTeachers = filtered;

  return (
    <>
      <SEO title="Our Tutors | Chibondo Academy" description="Meet the expert tutors at Chibondo Academy" />
      <div className="space-y-5">

        {/* Hero header — matches Subjects page style */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-medium text-primary-foreground/80">Chibondo Academy</span>
          </div>
          <h1 className="text-2xl font-heading font-bold mb-1">Our Tutors</h1>
          <p className="text-primary-foreground/70 text-sm mb-4">
            {visibleTeachers.length} expert {visibleTeachers.length === 1 ? 'tutor' : 'tutors'} ready to help you excel
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tutors or subjects…"
              className="pl-9 h-10 bg-card text-foreground border-0 shadow-sm"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 bg-card rounded-2xl border border-border animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/20" />
            <p className="font-semibold text-muted-foreground">No tutors found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <TutorCard
                key={p.id}
                profile={p}
                courseCount={courseCountByProfile[p.id] || courseCountByProfile[p.user_id] || 0}
                studentCount={studentCountByProfile[p.id] || studentCountByProfile[p.user_id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
