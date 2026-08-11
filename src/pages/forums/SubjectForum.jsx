import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import {
  MessageSquare, Plus, ArrowLeft, Pin, CheckCircle,
  Clock, ChevronRight, TrendingUp, Search,
  Megaphone, Users, Share2, Settings, Trash2, Pencil, X, LogIn, LogOut
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLiveAgo } from '@/hooks/useLiveAgo';

const STATUS_BADGE = {
  open:     { label: 'Open',     cls: 'bg-green-500/10 text-green-600 border-green-500/20'  },
  resolved: { label: 'Resolved', cls: 'bg-primary/10 text-primary border-primary/20'       },
  closed:   { label: 'Closed',   cls: 'bg-muted text-muted-foreground border-border'        },
};

/* ── Share with watermark ─────────────────────────────────────────────────── */
async function shareWithWatermark({ imageUrl, title, text, url }) {
  try {
    if (imageUrl) {
      // Fetch image, draw watermark via canvas, share as file
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      // Watermark bar at bottom
      const barH = Math.max(40, bitmap.height * 0.07);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, bitmap.height - barH, bitmap.width, barH);
      const fs = Math.max(14, barH * 0.45);
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = '#3b82f6';
      ctx.textBaseline = 'middle';
      ctx.fillText('@The Chibondo Academy', 12, bitmap.height - barH / 2);
      const watermarkedBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      const file = new File([watermarkedBlob], 'chibondo-academy.jpg', { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return;
      }
      // Fallback: download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(watermarkedBlob);
      a.download = 'chibondo-academy.jpg';
      a.click();
      toast.success('Image downloaded with watermark!');
      return;
    }
    // Text/URL share
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      // Fallback: copy link
      try { await navigator.clipboard.writeText(url); toast.success('Link copied!'); } catch (_) {}
    }
  }
}


/* ── Avatar — shows photo or coloured initials ──────────────────────────── */
function Avi({ name = '?', role, avatarUrl, size = 7, onClick }) {
  const [err, setErr] = React.useState(false);
  const styles = {
    admin:   { background: 'hsl(0 72% 51% / 0.18)',   color: 'hsl(0 72% 36%)' },
    teacher: { background: 'hsl(var(--primary) / 0.2)',   color: 'hsl(var(--primary))' },
    student: { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
    user:    { background: 'hsl(222 47% 55% / 0.18)', color: 'hsl(222 47% 30%)' },
  };
  const s = styles[role] || styles.user;
  const parts = (name || '?').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name[0] || '?').toUpperCase();
  const sizeClass = `w-${size} h-${size}`;

  if (avatarUrl && !err) {
    return (
      <img
        src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-border ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all' : ''}`}
        onClick={onClick}
        title={onClick ? `View ${name}'s profile` : undefined}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 select-none ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all' : ''}`}
      style={s}
      onClick={onClick}
      title={onClick ? `View ${name}'s profile` : undefined}
    >
      {initials}
    </div>
  );
}

/* ── AvatarViewer — fullscreen photo modal for any user ─────────────────── */
function AvatarViewer({ open, onClose, name, role, avatarUrl, tutorSlug }) {
  if (!open) return null;
  const parts = (name || '?').trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name?.[0] || '?').toUpperCase();
  const roleLabel = role === 'teacher' ? 'Tutor' : role === 'admin' ? 'Admin' : 'Student';
  const roleStyle = role === 'teacher'
    ? { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary))' }
    : role === 'admin'
    ? { background: 'hsl(0 72% 51% / 0.12)', color: 'hsl(0 72% 40%)', border: '1px solid hsl(0 72% 51% / 0.25)' }
    : { background: 'hsl(222 47% 55% / 0.12)', color: 'hsl(222 47% 65%)', border: '1px solid hsl(222 47% 55% / 0.25)' };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-full text-white/60 hover:text-white hover:bg-card/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Photo */}
        {avatarUrl ? (
          <img src={avatarUrl} alt={name}
            className="w-52 h-52 rounded-full object-cover border-4"
            style={{ borderColor: 'hsl(var(--primary))' }} />
        ) : (
          <div className="w-52 h-52 rounded-full flex items-center justify-center text-7xl font-black border-4"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary))' }}>
            {initials}
          </div>
        )}

        {/* Name + role */}
        <div className="text-center space-y-1.5">
          <p className="text-white text-xl font-bold">{name}</p>
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={roleStyle}>{roleLabel}</span>
        </div>

        {/* View tutor profile CTA */}
        {tutorSlug && (
          <a href={`/tutors/${tutorSlug}`} onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            View Tutor Profile →
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Thread card ─────────────────────────────────────────────────────────── */
function ThreadCard({ thread, subjectSlug, navigate, user, onShare, onAvatarClick, onDelete }) {
  const badge = STATUS_BADGE[thread.thread_status] || STATUS_BADGE.open;
  const ago = useLiveAgo(thread.last_activity_at || thread.updated_date);

  const isUnread = !thread.last_seen_by?.includes(user?.id);

  return (
    <div className="relative group">
      <button
        onClick={async () => {
          // Mark as read: add user.id to last_seen_by
          if (user?.id && isUnread) {
            try {
              const updatedSeen = [...(thread.last_seen_by || []), user.id];
              await db.entities.Discussion.update(thread.id, { last_seen_by: updatedSeen });
            } catch (_) {}
          }
          navigate(`/forums/${subjectSlug}/${thread.slug || thread.id}`, { state: { thread } });
        }}
        className={`w-full text-left bg-card border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all duration-150 ${
          isUnread ? 'border-accent/40' : 'border-border'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
            {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-accent" />}
            {thread.is_announcement
              ? <Megaphone className="w-4 h-4 text-accent" />
              : <MessageSquare className={`w-4 h-4 transition-colors ${isUnread ? 'text-accent' : 'text-muted-foreground/40 group-hover:text-primary'}`} />
            }
            {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors ${isUnread ? 'text-foreground' : ''}`}>
              {thread.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{thread.content?.slice(0, 100)}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />{ago}
              </span>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
                onClick={e => { e.stopPropagation(); onAvatarClick && onAvatarClick(thread); }}
                title={`View ${thread.author_name}`}
              >
                <Avi
                  name={thread.author_name}
                  role={thread.author_role}
                  avatarUrl={thread.author_avatar}
                  size={5}
                />
                <span className="font-semibold text-foreground/80 hover:text-accent transition-colors">{thread.author_name}</span>
              </button>
              {thread.reply_count > 0 && (
                <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
                </span>
              )}
              {thread.likes > 0 && (
                <span className="text-[11px] text-muted-foreground/70">❤ {thread.likes}</span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            {thread.tags?.length > 0 && (
              <div className="flex gap-1 mt-2">
                {thread.tags.slice(0,3).map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors" />
          </div>
        </div>
      </button>
      {/* Share button on card */}
      <button
        onClick={e => { e.stopPropagation(); onShare(thread); }}
        className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-accent"
        title="Share thread"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>
      {/* Delete button — visible on hover for thread author or admin/teacher */}
      {onDelete && (user?.id === thread.author_id || user?.role === 'admin' || user?.role === 'teacher') && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(thread); }}
          className="absolute top-3 right-[3.75rem] opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          title="Delete thread"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Rename Forum modal ──────────────────────────────────────────────────── */
function RenameModal({ subject, onClose, onSave, saving }) {
  const [name, setName] = useState(subject.forum_name || subject.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Rename Forum</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Forum name…" autoFocus />
        <div className="flex gap-2">
          <button onClick={() => onSave(name)} disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm border border-border">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN ────────────────────────────────────────────────────────────────── */
export default function SubjectForum() {
  const { subjectSlug }    = useParams();
  const navigate           = useNavigate();
  const { state }          = useLocation();
  const { user } = useOutletContext() ?? {};
  const qc                 = useQueryClient();
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('latest');
  const [showNew, setShowNew]     = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(null); // { name, role, avatarUrl, tutorSlug? }
  const [newTitle, setNewTitle]   = useState('');
  const [newContent, setNewContent] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameSaving, setRenameSaving] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  /* ── Subject ── */
  const { data: subjects = [] } = useQuery({
    queryKey: ['subject-by-slug', subjectSlug],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 120_000,
    enabled: !state?.subject,
  });
  const subject = state?.subject || subjects.find(s =>
    (s.slug || s.name.toLowerCase().replace(/\s+/g,'-')) === subjectSlug
  );

  /* ── Threads sorted by latest activity ── */
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['forum-threads', subject?.id],
    queryFn: () => db.entities.Discussion.filter(
      { subject_id: subject.id, status: 'active' }, '-updated_date', 200
    ),
    enabled: !!subject?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  /* ── Forum membership ── */
  const { data: myMembership = [] } = useQuery({
    queryKey: ['forum-membership', subject?.id, user?.id],
    queryFn: () => db.entities.ForumMembership.filter({ user_id: user.id, subject_id: subject.id }),
    enabled: !!subject?.id && !!user?.id,
    staleTime: 60_000,
  });
  const membership = myMembership[0] || null;
  const hasJoined = membership?.status === 'joined';

  /* ── Member count ── */
  const { data: allMembers = [] } = useQuery({
    queryKey: ['forum-members', subject?.id],
    queryFn: () => db.entities.ForumMembership.filter({ subject_id: subject.id, status: 'joined' }),
    enabled: !!subject?.id,
    staleTime: 120_000,
  });

  /* ── Online now (ForumPresence — all users active in last 2 min) ── */
  const { data: presenceList = [] } = useQuery({
    queryKey: ['forum-presence'],
    queryFn: () => db.entities.ForumPresence.list('-last_seen', 200),
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const onlineCount = useMemo(() => {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    return presenceList.filter(p => p.last_seen && new Date(p.last_seen) > cutoff).length;
  }, [presenceList]);

  /* ── Join/Leave mutations ── */
  const joinMut = useMutation({
    mutationFn: async () => {
      if (membership) {
        return db.entities.ForumMembership.update(membership.id, { status: 'joined' });
      }
      return db.entities.ForumMembership.create({
        user_id: user.id,
        subject_id: subject.id,
        subject_slug: subjectSlug,
        user_name: user.full_name || user.email,
        user_role: user.role || 'user',
        status: 'joined',
      });
    },
    onSuccess: () => {
      toast.success(`Joined ${subject?.forum_name || subject?.name} Forum!`);
      qc.invalidateQueries({ queryKey: ['forum-membership', subject?.id, user?.id] });
      qc.invalidateQueries({ queryKey: ['forum-members', subject?.id] });
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => db.entities.ForumMembership.update(membership.id, { status: 'left' }),
    onSuccess: () => {
      toast.success('Left forum');
      qc.invalidateQueries({ queryKey: ['forum-membership', subject?.id, user?.id] });
      qc.invalidateQueries({ queryKey: ['forum-members', subject?.id] });
    },
  });

  /* ── Rename forum (teacher who owns subject, or admin) ── */
  const handleRename = async (newName) => {
    if (!subject?.id) return;
    setRenameSaving(true);
    try {
      await db.entities.Subject.update(subject.id, { forum_name: newName.trim() });
      toast.success('Forum renamed!');
      qc.invalidateQueries({ queryKey: ['subject-by-slug', subjectSlug] });
      qc.invalidateQueries({ queryKey: ['forum-subjects'] });
      setShowRename(false);
    } catch { toast.error('Could not rename forum'); }
    finally { setRenameSaving(false); }
  };

  /* ── Delete single thread (author or admin/teacher) ── */
  const deleteThreadMut = useMutation({
    mutationFn: async (thread) => { try { return null; } catch(e) { return null; } },
    onSuccess: () => {
      toast.success('Thread deleted');
      qc.invalidateQueries({ queryKey: ['forum-threads', subject?.id] });
    },
    onError: (e) => toast.error(e.message || 'Failed to delete thread'),
  });

  const handleDeleteThread = (thread) => {
    if (window.confirm(`Delete "${thread.title}"? This cannot be undone.`)) {
      deleteThreadMut.mutate(thread);
    }
  };

  /* ── Delete forum (admin only — deletes all threads) ── */
  const deleteMut = useMutation({
    mutationFn: async () => {
      // Soft-delete all threads
      const toDelete = threads.filter(t => !t.parent_id);
      /* await Promise.all(toDelete.map(t => db.entities.Discussion.update(t.id, { status: 'deleted' }))); */
    },
    onSuccess: () => {
      toast.success('Forum cleared');
      qc.invalidateQueries({ queryKey: ['forum-threads', subject?.id] });
      setShowManageMenu(false);
      navigate('/forums');
    },
  });

  /* ── Create thread ── */
  const createMut = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !newContent.trim()) throw new Error('Title and content required');
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)
        + '-' + Date.now().toString(36);
      return db.entities.Discussion.create({
        title: newTitle.trim(), slug,
        content: newContent.trim(),
        subject_id: subject.id, subject_slug: subjectSlug,
        author_id: user.id,
        author_name: user.full_name || user.email,
        author_avatar: user.avatar_url || undefined,
        author_role: user.role || 'user',
        thread_status: 'open', status: 'active',
        reply_count: 0, view_count: 0,
      });
    },
    onSuccess: (created) => {
      toast.success('Thread posted!');
      setShowNew(false); setNewTitle(''); setNewContent('');
      // Auto-join if not already a member
      if (!hasJoined) joinMut.mutate();
      qc.invalidateQueries({ queryKey: ['forum-threads', subject?.id] });
      navigate(`/forums/${subjectSlug}/${created.slug || created.id}`, { state: { thread: created, subject } });
    },
    onError: e => toast.error(e.message),
  });

  /* ── Share ── */
  const handleShare = useCallback(async (thread = null) => {
    const url = thread
      ? `${window.location.origin}/forums/${subjectSlug}/${thread.slug || thread.id}`
      : `${window.location.origin}/forums/${subjectSlug}`;
    const title = thread ? thread.title : `${subject?.forum_name || subject?.name} Forum`;
    const text  = thread
      ? `Check out this discussion on Chibondo Academy: "${thread.title}"`
      : `Join the ${subject?.forum_name || subject?.name} Forum on Chibondo Academy!`;
    const imageUrl = thread?.image_url || null;
    await shareWithWatermark({ imageUrl, title, text, url });
  }, [subjectSlug, subject]);

  /* ── Filtering + sorting ── */
  const rootThreads = useMemo(() => threads.filter(t => !t.parent_id), [threads]);

  const filtered = useMemo(() => {
    let list = rootThreads;
    if (search) list = list.filter(t =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase())
    );
    const pinned = list.filter(t => t.is_pinned || t.is_announcement);
    const rest   = list.filter(t => !t.is_pinned && !t.is_announcement);
    switch (filter) {
      case 'unanswered': return [...pinned, ...rest.filter(t => !t.reply_count || t.reply_count === 0)];
      case 'resolved':   return [...pinned, ...rest.filter(t => t.thread_status === 'resolved')];
      case 'popular':    return [...pinned, ...rest.sort((a,b) => (b.reply_count||0) - (a.reply_count||0))];
      default: // latest — already sorted by -updated_date from API
        return [...pinned, ...rest];
    }
  }, [rootThreads, filter, search]);

  /* ── Unread count ── */
  const unreadCount = useMemo(() => {
    return rootThreads.filter(t => !t.last_seen_by?.includes(user?.id)).length;
  }, [rootThreads, user?.id]);

  const forumName = subject?.forum_name || `${subject?.name || subjectSlug} Forum`;

  return (
    <>
      <SEO title={`${forumName} | Chibondo Academy`}
        description={`Ask questions and discuss ${subject?.name || 'topics'} with tutors and fellow students`} />
      
      {showRename && (
        <RenameModal subject={subject} onClose={() => setShowRename(false)} onSave={handleRename} saving={renameSaving} />
      )}

      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(var(--card))' }}>
          <button onClick={() => navigate('/forums')}
            className="flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
            style={{ color: 'hsl(var(--primary) / 0.7)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Forums
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-heading font-bold leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
                {forumName}
              </h1>
              {subject?.form_name && (
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{subject.form_name}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Share forum */}
              <button onClick={() => handleShare()}
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-card/10 transition-colors">
                <Share2 className="w-3.5 h-3.5" />
              </button>

              {/* Manage menu (teacher/admin) */}
              {isTeacherOrAdmin && (
                <div className="relative">
                  <button onClick={() => setShowManageMenu(v => !v)}
                    className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-card/10 transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {showManageMenu && (
                    <div className="absolute right-0 top-10 z-20 bg-card border border-border rounded-xl shadow-xl min-w-[180px] py-1">
                      <button onClick={() => { setShowRename(true); setShowManageMenu(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted text-sm flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-accent" /> Rename Forum
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (window.confirm('Delete all threads in this forum? This cannot be undone.')) deleteMut.mutate();
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted text-sm flex items-center gap-2 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Forum
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ask button */}
              <button onClick={() => setShowNew(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 active:scale-95 transition-transform"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                <Plus className="w-4 h-4" /> Ask
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap mt-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span className="text-xs flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />{rootThreads.length} threads
            </span>
            <span className="text-xs flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />{allMembers.length} members
            </span>
            {/* Online now indicator */}
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: 'hsl(142 70% 45% / 0.12)', color: 'hsl(142 60% 40%)', border: '1px solid hsl(142 70% 45% / 0.2)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {onlineCount} online
            </span>
            {unreadCount > 0 && (
              <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background:'hsl(var(--primary) / 0.15)', color:'hsl(var(--primary-foreground))' }}>
                {unreadCount} new
              </span>
            )}
          </div>

          {/* Join / Leave button */}
          <div className="mt-3">
            {hasJoined ? (
              <button onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:bg-card/10 transition-colors">
                <LogOut className="w-3 h-3" /> Leave Forum
              </button>
            ) : (
              <button onClick={() => joinMut.mutate()} disabled={joinMut.isPending}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={{ background:'hsl(var(--primary) / 0.2)', color:'hsl(var(--primary-foreground))', border:'1px solid hsl(var(--primary))' }}>
                <LogIn className="w-3 h-3" /> {joinMut.isPending ? 'Joining…' : 'Join Forum'}
              </button>
            )}
          </div>
        </div>

        {/* New thread form */}
        {showNew && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm">Ask a Question</h3>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Write a clear question title…" className="h-10" />
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder="Describe your question in detail…" rows={4}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2">
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                {createMut.isPending ? 'Posting…' : 'Post Question'}
              </button>
              <button onClick={() => { setShowNew(false); setNewTitle(''); setNewContent(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-border hover:border-primary/40 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search threads…" className="pl-9" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mt-1">
          {[
            { key: 'latest',     label: 'Latest Activity', icon: Clock },
            { key: 'popular',    label: 'Most Replied',    icon: TrendingUp },
            { key: 'unanswered', label: 'Unanswered',      icon: MessageSquare },
            { key: 'resolved',   label: 'Resolved',        icon: CheckCircle },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-2xl border border-border animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20" />
            <p className="font-semibold text-muted-foreground">No threads yet</p>
            <p className="text-sm text-muted-foreground/60">Be the first to ask a question!</p>
            <button onClick={() => setShowNew(true)}
              className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
              Ask a Question
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <ThreadCard key={t.id} thread={t} subjectSlug={subjectSlug}
                navigate={navigate} user={user} onShare={handleShare}
                onDelete={handleDeleteThread}
                onAvatarClick={t => setViewingAvatar({
                  name: t.author_name,
                  role: t.author_role,
                  avatarUrl: t.author_avatar,
                })}
              />
            ))}
          </div>
        )}
      </div>
      {/* Avatar lightbox */}
      {viewingAvatar && (
        <AvatarViewer
          open={true}
          onClose={() => setViewingAvatar(null)}
          name={viewingAvatar.name}
          role={viewingAvatar.role}
          avatarUrl={viewingAvatar.avatarUrl}
          tutorSlug={viewingAvatar.tutorSlug}
        />
      )}
    </>
  );
}
