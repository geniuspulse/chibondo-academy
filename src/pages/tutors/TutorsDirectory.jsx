import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search, GraduationCap, BookOpen, Users, ChevronRight, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ALL_SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Mathematics', 'Additional Mathematics',
  'English Language', 'English Literature', 'Chichewa', 'Agriculture', 'Geography', 'History'
];

function TutorCard({ tutor, subjectCount }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-200 group flex flex-col">
      {/* Photo */}
      <div className="relative h-48 w-full flex-shrink-0 overflow-hidden">
        {tutor.profile_photo ? (
          <>
            <img
              src={tutor.profile_photo}
              alt={tutor.full_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent">
            <span className="text-5xl font-heading font-bold text-primary-foreground/90">
              {tutor.full_name?.[0]?.toUpperCase()}
            </span>
          </div>
        )}
        {tutor.years_teaching > 0 && (
          <div className="absolute top-3 right-3">
            <span className="text-[10px] text-white font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
              {tutor.years_teaching}+ yrs exp
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="font-heading font-bold text-base leading-tight">{tutor.full_name}</h3>
          {tutor.professional_title && (
            <p className="text-xs text-muted-foreground mt-0.5">{tutor.professional_title}</p>
          )}
          {tutor.tagline && (
            <p className="text-xs text-primary/80 mt-1 italic">"{tutor.tagline}"</p>
          )}
        </div>

        {/* Subjects */}
        {tutor.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tutor.subjects.slice(0, 3).map(s => (
              <Badge key={s} variant="outline" className="text-[10px] py-0 border-primary/30 text-primary/80">{s}</Badge>
            ))}
            {tutor.subjects.length > 3 && (
              <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">+{tutor.subjects.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {subjectCount} {subjectCount === 1 ? 'course' : 'courses'}
          </span>
        </div>

        <Link
          to={`/tutors/${tutor.slug}`}
          className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-sm font-medium transition-all duration-150"
        >
          View Profile <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default function TutorsDirectory() {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { data: tutors = [], isLoading } = useQuery({queryKey: ['tutors-public'],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ status: 'active', is_visible: true }, 'full_name', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const { data: subjects = [] } = useQuery({queryKey: ['subjects-all'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  // Count subjects per tutor via teacher_id or tutor_profile_id
  const subjectCountByTutor = useMemo(() => {
    const map = {};
    subjects.forEach(s => {
      if (s.tutor_profile_id) {
        map[s.tutor_profile_id] = (map[s.tutor_profile_id] || 0) + 1;
      }
    });
    return map;
  }, [subjects]);

  const filtered = useMemo(() => {
    return tutors.filter(t => {
      const matchSearch = !search ||
        t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.subjects?.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
        t.professional_title?.toLowerCase().includes(search.toLowerCase());
      const matchSubject = selectedSubject === 'all' ||
        t.subjects?.some(s => s.toLowerCase().includes(selectedSubject.toLowerCase()));
      return matchSearch && matchSubject;
    });
  }, [tutors, search, selectedSubject]);

  return (
    <>
      <SEO
        title="Our Tutors"
        description="Meet the experienced tutors at Chibondo Academy. Browse tutor profiles, qualifications, and courses."
        canonical="https://aca.db.app/tutors"
        ogImage="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg"
      />

      <div className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/20 to-transparent border-b border-border/30">
          <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-primary">Meet Our Team</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-3">
              Expert Tutors
            </h1>
            <p className="text-muted-foreground max-w-lg">
              Learn from qualified, passionate educators dedicated to helping you succeed in your MSCE examinations.
            </p>

            {/* Search */}
            <div className="relative mt-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or subject..."
                className="pl-9 h-11 bg-card border-border"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selectedSubject === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              All Tutors
              <span className="ml-1.5 text-xs opacity-70">({tutors.length})</span>
            </button>
            {ALL_SUBJECTS.map(s => {
              const count = tutors.filter(t => t.subjects?.includes(s)).length;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => setSelectedSubject(s === selectedSubject ? 'all' : s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    selectedSubject === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Results info */}
          {!isLoading && (
            <p className="text-sm text-muted-foreground mb-6">
              {filtered.length} tutor{filtered.length !== 1 ? 's' : ''} found
              {selectedSubject !== 'all' && ` for ${selectedSubject}`}
            </p>
          )}

          {/* Grid */}
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-8 bg-muted rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-muted-foreground">No tutors found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Try a different search or filter</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(tutor => (
                <TutorCard
                  key={tutor.id}
                  tutor={tutor}
                  subjectCount={subjectCountByTutor[tutor.id] || 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Back to app link */}
        <div className="max-w-6xl mx-auto px-4 pb-12 text-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            Sign in to access all lessons →
          </Link>
        </div>
      </div>
    </>
  );
}
