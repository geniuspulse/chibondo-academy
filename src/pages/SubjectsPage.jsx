import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { BookOpen, Lock, ChevronRight, Search, Users, Calendar, PlayCircle, Star, GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import SEO from '@/components/SEO';
import { format } from 'date-fns';

export default function SubjectsPage() {
  const { user } = useOutletContext() ?? {};
  const [selectedForm, setSelectedForm] = useState('all');
  const [search, setSearch] = useState('');

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try { return await db.entities.Subject.filter({ status: 'published' }, 'order', 100); }
      catch(e) { console.error('subjects fetch failed', e); return []; }
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['myEnrollments', user?.id],
    queryFn: async () => {
      try { return await db.entities.Enrollment.filter({ student_id: user.id }, '-created_date', 100); }
      catch(e) { console.error('enrollments fetch failed', e); return []; }
    },
    enabled: !!user?.id,
  });

  // Fetch all lessons to compute real per-subject counts
  const { data: allLessons = [] } = useQuery({
    queryKey: ['allLessonsCount'],
    queryFn: async () => {
      try { return await db.entities.Lesson.filter({ status: 'published' }, 'created_date', 2000); }
      catch(e) { console.error('lessons fetch failed', e); return []; }
    },
  });

  // Build maps
  const lessonCountBySubject = {};
  allLessons.forEach(l => {
    lessonCountBySubject[l.subject_id] = (lessonCountBySubject[l.subject_id] || 0) + 1;
  });

  // Student counts come straight from the public subjects.enrollment_count column
  // (bulk-reading the enrollments table is RLS-restricted to each user's own rows,
  // which was silently showing 0 students for guests and other students).

  const enrollmentMap = {};
  enrollments.forEach(e => { enrollmentMap[e.subject_id] = e; });

  const filteredSubjects = subjects.filter(s => {
    const subjectFormName = s.form_name || s.form || '';
    const matchForm = selectedForm === 'all' || subjectFormName === selectedForm;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(search.toLowerCase());
    return matchForm && matchSearch;
  });

  // Group subjects by form_name for section headers
  // (AcademicForm table removed — group by form_name string on the subject itself)
  const formNames = [...new Set(filteredSubjects.map(s => s.form_name || s.form || 'Other').filter(Boolean))].sort();
  const subjectsByForm = {};
  filteredSubjects.forEach(s => {
    const key = s.form_name || s.form || 'Other';
    if (!subjectsByForm[key]) subjectsByForm[key] = [];
    subjectsByForm[key].push(s);
  });

  // For filtering, derive unique form names from subjects
  const allFormNames = [...new Set(subjects.map(s => s.form_name || s.form || 'Other').filter(Boolean))].sort();

  const groupedForms = selectedForm === 'all'
    ? formNames
    : formNames.filter(name => name === selectedForm);

  // Always show something — if no groups matched, show all
  const effectiveGroups = groupedForms.length > 0 ? groupedForms : formNames;

  return (
    <>
      <SEO
        title="All Subjects | MSCE Courses | Chibondo Academy"
        description="Browse all MSCE subjects available at Chibondo Academy. Form 3 and Form 4 courses including Mathematics, Biology, Physics, Chemistry, English and more."
        canonical={`${window.location.origin}/subjects`}
        keywords="MSCE subjects, Form 3 courses, Form 4 courses, online learning Malawi, Chibondo Academy"
      />
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 border border-border"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--chart-3) / 0.8) 100%)' }}>
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative z-10">
        <h1 className="text-2xl font-heading font-bold mb-1 text-primary-foreground">All Subjects</h1>
        <p className="text-primary-foreground/70 text-sm">
          {isLoading ? 'Loading courses…' : `${subjects.length} courses available · Choose your subjects and start learning`}
        </p>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            className="pl-9 h-10 bg-card text-foreground border-0 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        </div>
      </div>

      {/* Form filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mt-2">
        {['all', ...allFormNames].map((name) => {
          const label = name === 'all' ? 'All Forms' : name;
          return (
            <button
              key={name}
              onClick={() => setSelectedForm(name)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selectedForm === name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-40 bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">No subjects found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Try a different search or form filter</p>
        </div>
      ) : (
        <div className="space-y-8">
          {effectiveGroups.map(formKey => {
            const formName = formKey;
            const formSubjects = subjectsByForm[formKey] || [];
            return (
              <div key={formKey}>
                {effectiveGroups.length > 1 && (
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-heading font-bold text-lg">{formName}</h2>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{formSubjects.length} subjects</span>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {formSubjects.map(subject => {
                    const enrollment = enrollmentMap[subject.id];
                    const isPremium = subject.is_premium;
                    const isEnrolled = !!enrollment;
                    const lessonCount = lessonCountBySubject[subject.id] || 0;
                    const progressPct = enrollment?.progress_percentage || 0;

                    return (
                      <Link
                        key={subject.id}
                        to={`/subjects/${subject.id}`}
                        className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-200 group flex flex-col"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-accent/10">
                          {subject.cover_image ? (
                            <img
                              src={subject.cover_image}
                              alt={subject.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-14 h-14 text-primary/20" />
                            </div>
                          )}
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                          {/* Top badges */}
                          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
                            <span className="text-[10px] text-white/90 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                              {subject.form_name}
                            </span>
                            <div className="flex gap-1.5">
                              {isPremium && (
                                <Badge className="text-[10px] bg-accent text-accent-foreground border-0 shadow-sm">
                                  <Star className="w-2.5 h-2.5 mr-1 fill-current" />Premium
                                </Badge>
                              )}
                              {isEnrolled && (
                                <Badge className="text-[10px] bg-success text-success-foreground border-0 shadow-sm">Enrolled</Badge>
                              )}
                            </div>
                          </div>

                          {/* Bottom: play icon if enrolled */}
                          {isEnrolled && (
                            <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-card/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-card/30 transition-colors">
                              <PlayCircle className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="font-heading font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {subject.name}
                          </h3>
                          {subject.description && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                              {subject.description}
                            </p>
                          )}

                          {/* Stats row */}
                          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-primary/60" />
                              {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                            </span>
                            {subject.teacher_name && (
                              <span className="flex items-center gap-1 ml-auto min-w-0">
                                <GraduationCap className="w-3 h-3 text-primary/60 flex-shrink-0" />
                                <span className="truncate">{subject.teacher_name}</span>
                              </span>
                            )}
                          </div>

                          {/* Progress if enrolled */}
                          {isEnrolled && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground">Your Progress</span>
                                <span className="text-xs font-bold text-primary">{progressPct}%</span>
                              </div>
                              <Progress value={progressPct} className="h-1.5" />
                            </div>
                          )}

                          {/* CTA row */}
                          <div className={`flex items-center justify-between mt-auto pt-3 text-xs font-semibold transition-colors ${
                            isEnrolled ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                          }`}>
                            <span>{isEnrolled ? 'Continue Learning' : isPremium ? 'View Course' : 'Start Free'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}