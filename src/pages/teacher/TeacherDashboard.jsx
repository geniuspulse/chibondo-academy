import React, { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { BookOpen, Users, ArrowRight, Plus, CheckCircle2, Clock, ChevronDown, ChevronUp, GraduationCap, TrendingUp, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TeacherDashboard() {
  const { user } = useOutletContext() ?? {};
  const [expandedSubject, setExpandedSubject] = useState(null);

  const { data: subjects = [] } = useQuery({queryKey: ['teacherSubjects', user?.id],
    queryFn: async () => { try { return await db.entities.Subject.filter({ teacher_id: user.id }, 'order', 50); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    placeholderData: [],
  });

  const { data: allEnrollments = [] } = useQuery({queryKey: ['teacherEnrollments', subjects.map(s => s.id).join(',')],
    queryFn: async () => { try { const results = [];
      for (const s of subjects) {
        const e = await db.entities.Enrollment.filter({ subject_id: s.id }, '-created_date', 200);
        results.push(...e.map(en => ({ ...en, subject_name: s.name })));
      }
      return results; } catch(e) { console.error(e); return []; } },
    enabled: subjects.length > 0,
    placeholderData: [],
  });

  const { data: studentProfiles = [] } = useQuery({queryKey: ['studentProfiles'],
    queryFn: async () => { try { return await db.entities.User.list('-created_date', 200); } catch(e) { console.error(e); return []; } },
    enabled: allEnrollments.length > 0,
    placeholderData: [],
  });

  const profileByUserId = Object.fromEntries(studentProfiles.map(p => [p.user_id, p]));
  const uniqueStudentIds = [...new Set(allEnrollments.map(e => e.student_id))];

  // BBA-style stat cards with colored backgrounds
  const stats = [
    { label: 'My Subjects', value: subjects.length, icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    { label: 'Total Students', value: uniqueStudentIds.length, icon: Users, color: 'text-chart-2', bg: 'bg-chart-2/10', border: 'border-chart-2/20' },
    { label: 'Published', value: subjects.filter(s => s.status === 'published').length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  ];

  return (
    <div className="space-y-6">
      {/* BBA-style gradient hero header */}
      <div className="relative overflow-hidden rounded-2xl p-6 border border-border"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.9) 0%, hsl(var(--chart-3) / 0.8) 100%)' }}>
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-card/5 rounded-full -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
              <span className="text-sm font-medium text-primary-foreground/70">Tutor Dashboard</span>
            </div>
            <h1 className="text-2xl font-heading font-bold mb-1 text-primary-foreground">
              Welcome, {user?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-primary-foreground/60 text-sm">Manage your subjects and track student progress</p>
          </div>
          <Link to="/teacher/courses">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-card text-foreground transition-all hover:scale-[1.02]">
              <Plus className="w-4 h-4" /> Manage Content
            </button>
          </Link>
        </div>

        {/* Stats inline in the hero */}
        <div className="relative z-10 flex gap-6 mt-5 flex-wrap">
          {stats.map(stat => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-card/15 flex-shrink-0">
                <stat.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold font-heading leading-none text-primary-foreground">{stat.value}</p>
                <p className="text-[11px] text-primary-foreground/60 mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Subjects — BBA-style cards */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading">My Subjects</CardTitle>
              <Link to="/teacher/courses" className="text-sm text-primary flex items-center gap-1 hover:underline">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {subjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No subjects assigned yet. Contact an admin.</p>
            )}
            {subjects.map(s => {
              const enrolled = allEnrollments.filter(e => e.subject_id === s.id);
              const isExpanded = expandedSubject === s.id;
              const subjectStudents = enrolled
                .map(e => ({ ...e, profile: profileByUserId[e.student_id] }))
                .filter(e => e.profile);

              return (
                <div key={s.id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedSubject(isExpanded ? null : s.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.form_name} · {enrolled.length} student{enrolled.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">{s.status}</Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enrolled Students</p>
                        <Link to={`/teacher/courses/${s.id}`}>
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2">Edit Content</Button>
                        </Link>
                      </div>
                      {subjectStudents.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 text-center">No students enrolled yet</p>
                      )}
                      {subjectStudents.map(e => (
                        <div key={e.id} className="flex items-center gap-2 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-sidebar flex items-center justify-center text-[10px] font-bold text-sidebar-primary flex-shrink-0">
                            {e.profile.full_name?.[0] || '?'}
                          </div>
                          <p className="text-sm flex-1 truncate">{e.profile.full_name}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${e.progress_percentage || 0}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-7">{e.progress_percentage || 0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* All Students — BBA-style cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> Enrolled Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uniqueStudentIds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No students enrolled in your subjects yet.</p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {uniqueStudentIds.map(sid => {
                const profile = profileByUserId[sid];
                const studentEnrollments = allEnrollments.filter(e => e.student_id === sid);
                if (!profile) return null;
                return (
                  <div key={sid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-sidebar flex items-center justify-center text-xs font-bold text-sidebar-primary flex-shrink-0">
                      {profile.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.form} · {profile.school_name || 'Distance learner'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${studentEnrollments[0]?.progress_percentage || 0}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-7">{studentEnrollments[0]?.progress_percentage || 0}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
