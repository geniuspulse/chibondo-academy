/**
 * LessonComments.jsx
 * Self-contained comment + reply section for lesson pages.
 * Uses the Discussion entity filtered by lesson_id + parent_id=null.
 * Has NO connection to subject forums — no subject_id routing, no forum links.
 */

import { toast } from 'sonner';
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ThumbsUp, MessageSquare, ChevronDown, ChevronUp, MoreHorizontal, Pin, CheckCircle2, Trash2, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return ''; }
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

const AVATAR_COLORS = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#06B6D4','#EC4899','#14B8A6','#F97316','#6366F1',
];
function avatarColor(name = '') {
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, src, size = 8 }) {
  const px = { 7: 'w-7 h-7', 8: 'w-8 h-8', 9: 'w-9 h-9' }[size] || 'w-8 h-8';
  if (src) {
    return <img src={src} alt={name} className={`${px} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${px} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none`}
      style={{ background: avatarColor(name) }}>
      {initials(name)}
    </div>
  );
}

// ── Inline textarea with auto-grow ────────────────────────────────────────────
function CommentBox({ placeholder, value, onChange, onSubmit, onCancel, loading, autoFocus = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(); }}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:bg-background transition-colors leading-relaxed"
        style={{ minHeight: 72 }}
      />
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
          {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}

// ── Single comment (with its replies) ─────────────────────────────────────────
function Comment({ comment, replies, user, onReply, onLike, onDelete, onPin, onMarkAnswer, isTeacherOrAdmin }) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const isAuthor    = comment.created_by === user?.id;
  const isTeacher   = comment.author_role === 'teacher' || comment.author_role === 'admin';
  const hasLiked    = (comment.liked_by || []).includes(user?.id);
  const replyCount  = replies.length;

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReplyBox(false);
    setShowReplies(true);
  };

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author_name} src={comment.author_photo} size={8} />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-foreground">{comment.author_name}</span>
          {isTeacher && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Tutor</span>
          )}
          {comment.is_pinned && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5" /> Pinned
            </span>
          )}
          {comment.is_answer && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Answer
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{timeAgo(comment.created_date)}</span>
        </div>

        {/* Body */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-2">
          {comment.content}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Like */}
          <button
            onClick={() => onLike(comment)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              hasLiked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-primary' : ''}`} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>

          {/* Reply */}
          {user?.id && (
            <button
              onClick={() => setShowReplyBox(v => !v)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Reply
            </button>
          )}

          {/* Show/hide replies */}
          {replyCount > 0 && (
            <button
              onClick={() => setShowReplies(v => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              {showReplies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {/* More menu */}
          {(isAuthor || isTeacherOrAdmin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {isTeacherOrAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => onPin(comment)} className="text-xs gap-2">
                      <Pin className="w-3.5 h-3.5" />
                      {comment.is_pinned ? 'Unpin' : 'Pin comment'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMarkAnswer(comment)} className="text-xs gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as answer
                    </DropdownMenuItem>
                  </>
                )}
                {isAuthor && (
                  <DropdownMenuItem onClick={() => onDelete(comment)} className="text-xs gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Reply box */}
        {showReplyBox && user?.id && (
          <div className="mt-3">
            <CommentBox
              placeholder={`Reply to ${comment.author_name}…`}
              value={replyText}
              onChange={setReplyText}
              onSubmit={handleReply}
              onCancel={() => { setShowReplyBox(false); setReplyText(''); }}
              autoFocus
            />
          </div>
        )}

        {/* Replies */}
        {showReplies && replyCount > 0 && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-border">
            {replies.map(reply => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                user={user}
                parentAuthorName={comment.author_name}
                onLike={onLike}
                onDelete={onDelete}
                isTeacherOrAdmin={isTeacherOrAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reply item (nested, no further nesting) ───────────────────────────────────
function ReplyItem({ reply, user, parentAuthorName, onLike, onDelete, isTeacherOrAdmin }) {
  const isAuthor  = reply.created_by === user?.id;
  const isTeacher = reply.author_role === 'teacher' || reply.author_role === 'admin';
  const hasLiked  = (reply.liked_by || []).includes(user?.id);

  return (
    <div className="flex gap-2.5">
      <Avatar name={reply.author_name} src={reply.author_photo} size={7} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-semibold text-foreground">{reply.author_name}</span>
          {isTeacher && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Tutor</span>
          )}
          <span className="text-[10px] text-muted-foreground">{timeAgo(reply.created_date)}</span>
        </div>

        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words mb-1.5">
          <span className="font-semibold text-primary mr-1">@{parentAuthorName}</span>
          {reply.content}
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(reply)}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              hasLiked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <ThumbsUp className={`w-3 h-3 ${hasLiked ? 'fill-primary' : ''}`} />
            {reply.likes > 0 && <span>{reply.likes}</span>}
          </button>

          {(isAuthor || isTeacherOrAdmin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {isAuthor && (
                  <DropdownMenuItem onClick={() => onDelete(reply)} className="text-xs gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LessonComments({ lessonId, lessonTitle, lessonUrl, user, subjectId }) {
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const isGuest = !user?.id;
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  // Fetch ALL comments for this lesson only (no subject_id filter — lesson-scoped)
  const { data: allComments = [], isLoading } = useQuery({
    queryKey: ['lessonComments', lessonId],
    queryFn: () => db.entities.LessonComment.filter({ lesson_id: lessonId, status: 'active' }, 'created_date', 200),
    enabled: !!lessonId,
    staleTime: 30_000,
  });

  const rootComments = allComments.filter(c => !c.parent_id)
    .sort((a, b) => {
      // Pinned first, then newest
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_date) - new Date(a.created_date);
    });

  const getReplies = (parentId) =>
    allComments.filter(c => c.parent_id === parentId)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.LessonComment.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lessonComments', lessonId] });
      setNewComment('');
      toast.success('Comment posted!');
    },
    onError: (err) => {
      console.error('[LessonComments] save error:', err);
      toast.error('Failed to post comment: ' + (err?.message || 'Unknown error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.LessonComment.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessonComments', lessonId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.LessonComment.update(id, { status: 'deleted' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessonComments', lessonId] }),
  });

  const buildPayload = (commentContent, parentId = null) => ({
    lesson_id:   lessonId,
    created_by:  user.id,
    author_name: user.full_name || user.email?.split('@')[0] || 'Student',
    author_photo: user.avatar_url || null,
    author_role: user.role || 'student',
    content:     commentContent,
    parent_id:   parentId || null,
    status:      'active',
  });

  const handlePost = () => {
    if (!newComment.trim()) return;
    if (!user?.id) {
      toast.error('Please log in to post a comment.');
      return;
    }
    createMutation.mutate(buildPayload(newComment.trim()));
  };

  const handleReply = (parentId, text) => {
    if (!text || !user?.id) return;
    createMutation.mutate(buildPayload(text, parentId));
  };

  const handleLike = (comment) => {
    if (!user?.id) return;
    const liked_by = comment.liked_by || [];
    const hasLiked = liked_by.includes(user.id);
    updateMutation.mutate({
      id: comment.id,
      data: {
        likes: Math.max(0, (comment.likes || 0) + (hasLiked ? -1 : 1)),
        liked_by: hasLiked ? liked_by.filter(id => id !== user.id) : [...liked_by, user.id],
      },
    });
  };

  const handleDelete = (comment) => {
    deleteMutation.mutate(comment.id);
  };

  const handlePin = (comment) => {
    if (!isTeacherOrAdmin) return;
    updateMutation.mutate({ id: comment.id, data: { is_pinned: !comment.is_pinned } });
  };

  const handleMarkAnswer = (comment) => {
    if (!isTeacherOrAdmin) return;
    // Unmark previous answer, mark this one
    allComments.forEach(c => {
      if (c.is_answer && c.id !== comment.id) {
        updateMutation.mutate({ id: c.id, data: { is_answer: false } });
      }
    });
    updateMutation.mutate({ id: comment.id, data: { is_answer: !comment.is_answer } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          {allComments.filter(c => !c.parent_id).length} Comment{allComments.filter(c => !c.parent_id).length !== 1 ? 's' : ''}
        </h3>
      </div>

      {/* Post area */}
      {isGuest ? (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">Sign in to leave a comment</p>
          <div className="flex gap-2">
            <a href="/login"
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Log in
            </a>
            <a href="/register"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Sign up
            </a>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Avatar name={user.full_name || user.email || '?'} src={user.avatar_url} size={8} />
          <div className="flex-1">
            <CommentBox
              placeholder="Add a comment… (Ctrl+Enter to post)"
              value={newComment}
              onChange={setNewComment}
              onSubmit={handlePost}
              loading={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rootComments.map(comment => (
            <Comment
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              user={user}
              isTeacherOrAdmin={isTeacherOrAdmin}
              onReply={handleReply}
              onLike={handleLike}
              onDelete={handleDelete}
              onPin={handlePin}
              onMarkAnswer={handleMarkAnswer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
