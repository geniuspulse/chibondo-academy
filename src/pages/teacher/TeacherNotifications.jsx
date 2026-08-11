import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Send, Users, User, BookOpen, Search } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_OPTIONS = [
  { value: 'lesson',       label: 'Lesson Update' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'system',       label: 'General' },
];

export default function TeacherNotifications() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();

  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [type, setType]         = useState('announcement');
  const [audience, setAudience] = useState('subject');
  const [subjectId, setSubjectId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [targetStudentId, setTargetStudentId] = useState('');

  // Teacher's own subjects
  const { data: subjects = [] } = useQuery({queryKey: ['teacherSubjects', user?.id],
    queryFn: async () => { try { return await db.entities.Subject.filter({ teacher_id: user.id }); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    placeholderData: [],});

  // Enrollments for selected subject
  const { data: enrollments = [] } = useQuery({queryKey: ['subjectEnrollments', subjectId],
    queryFn: async () => { try { return await db.entities.Enrollment.filter({ subject_id: subjectId }); } catch(e) { console.error(e); return []; } },
    enabled: !!subjectId,
    placeholderData: [],});

  const { data: allEnrollments = [] } = useQuery({queryKey: ['teacherAllEnrollments', user?.id],
    queryFn: async () => { try { const subs = await db.entities.Subject.filter({ teacher_id: user.id });
      if (!subs.length) return [];
      // Get enrollments for all teacher subjects
      const all = await Promise.all(subs.map(s => db.entities.Enrollment.filter({ subject_id: s.id })));
      return all.flat(); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    placeholderData: [],});

  // Unique students across all teacher subjects
  const studentProfiles = useMemo(() => {
    const seen = new Set();
    return allEnrollments
      .map(e => ({ user_id: e.student_id, name: e.student_name || 'Student' }))
      .filter(s => { if (seen.has(s.user_id)) return false; seen.add(s.user_id); return true; });
  }, [allEnrollments]);

  const filteredStudents = studentProfiles.filter(s =>
    !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error('Title and message required');

      let recipients = [];
      if (audience === 'subject') {
        if (!subjectId) throw new Error('Please select a subject');
        const enrolList = await db.entities.Enrollment.filter({ subject_id: subjectId });
        recipients = enrolList.map(e => e.student_id).filter(Boolean);
      } else if (audience === 'all_my_students') {
        recipients = [...new Set(allEnrollments.map(e => e.student_id).filter(Boolean))];
      } else {
        if (!targetStudentId) throw new Error('Please select a student');
        recipients = [targetStudentId];
      }

      await Promise.all(
        recipients.map(uid =>
          db.entities.Notification.create({ user_id: uid, title: title.trim(), message: message.trim(), type, is_read: false })
        )
      );
      return recipients.length;
    },
    onSuccess: (count) => {
      toast.success(`Notification sent to ${count} student${count !== 1 ? 's' : ''}!`);
      setTitle(''); setMessage(''); setSubjectId(''); setTargetStudentId('');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Send Notification
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Notify your students about lessons, updates, or announcements</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Compose Notification</h2>
        </div>
        <div className="p-5 space-y-4">

          {/* Audience */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send To</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'subject',          label: 'By Subject',      icon: BookOpen },
                { value: 'all_my_students',  label: 'All My Students', icon: Users },
                { value: 'specific',         label: 'One Student',     icon: User },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAudience(opt.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-xs font-medium transition-all
                    ${audience === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject selector */}
          {audience === 'subject' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Subject</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Choose subject..." /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.form_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {subjectId && <p className="text-xs text-muted-foreground">{enrollments.length} students enrolled</p>}
            </div>
          )}

          {/* Specific student */}
          {audience === 'specific' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Student</label>
              <div className="relative mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search student..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <div className="max-h-36 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                {filteredStudents.slice(0, 20).map(s => (
                  <button
                    key={s.user_id}
                    onClick={() => setTargetStudentId(s.user_id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors
                      ${targetStudentId === s.user_id ? 'bg-primary/5 text-primary font-medium' : ''}`}
                  >
                    {s.name}
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No students found</p>
                )}
              </div>
            </div>
          )}

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
            <Input placeholder="e.g. New lesson available" value={title} onChange={e => setTitle(e.target.value)} className="h-10" />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
            <Textarea
              placeholder="Write your message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="resize-none h-28"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !title.trim() || !message.trim()}
          >
            {sendMutation.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Send Notification</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}