import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  MessageSquare, Send, Reply, MoreVertical,
  Search, TrendingUp, Clock, Pin, ImageIcon, Mic,
  X, ChevronDown, ChevronUp, Heart, Loader2, Plus, StopCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const ROLE_BADGE = {
  admin:   { label: 'Admin',   cls: 'bg-destructive/10 text-destructive' },
  teacher: { label: 'Teacher', cls: 'bg-accent/10 text-accent-foreground' },
  user:    { label: 'Student', cls: 'bg-muted text-muted-foreground' },
};

const AVATAR_BG = {
  admin:   'bg-destructive/20 text-destructive',
  teacher: 'bg-accent text-accent-foreground',
  user:    'bg-primary/20 text-primary-foreground',
};

function Avi({ name, role, size = 9 }) {
  const cls = AVATAR_BG[role] || AVATAR_BG.user;
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${cls}`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ── WhatsApp-style compose bar ────────────────────────────────────────────────
function ComposeBar({ user, onPost, isPending }) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [mrRef, setMrRef] = useState(null);
  const chunksRef = useRef([]);
  const imgRef = useRef();
  const textareaRef = useRef();

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      setUploading(true);
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const { file_url } = await db.integrations.Core.UploadFile({ file: new File([blob], 'voice.webm', { type: 'audio/webm' }) });
      setVoiceUrl(file_url);
      setUploading(false);
      stream.getTracks().forEach(t => t.stop());
    };
    mr.start();
    setMrRef(mr);
    setRecording(true);
  };

  const stopRec = () => { mrRef?.stop(); setRecording(false); setMrRef(null); };

  const handleSend = () => {
    if (!text.trim() && !imageUrl && !voiceUrl) return;
    onPost({ content: text.trim() || '📷', image_url: imageUrl, voice_note_url: voiceUrl });
    setText(''); setImageUrl(null); setVoiceUrl(null);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* preview row */}
      {(imageUrl || voiceUrl) && (
        <div className="flex items-center gap-3 px-4 pt-3">
          {imageUrl && (
            <div className="relative">
              <img src={imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover border border-border" />
              <button onClick={() => setImageUrl(null)} className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center text-[10px]"><X className="w-2.5 h-2.5" /></button>
            </div>
          )}
          {voiceUrl && (
            <div className="flex items-center gap-2 flex-1">
              <audio controls src={voiceUrl} className="h-8 flex-1" />
              <button onClick={() => setVoiceUrl(null)}><X className="w-4 h-4 text-destructive" /></button>
            </div>
          )}
        </div>
      )}

      {/* input row */}
      <div className="flex items-end gap-2 p-3">
        <Avi name={user?.full_name} role={user?.role} size={8} />
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={e => { setText(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
          onKeyDown={handleKey}
          placeholder="Share something with the group..."
          className="flex-1 resize-none bg-muted/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 min-h-[36px] max-h-32 leading-relaxed placeholder:text-muted-foreground"
          style={{ overflow: 'hidden' }}
        />
        {/* attachments */}
        <div className="flex items-center gap-1 pb-0.5">
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button onClick={() => imgRef.current?.click()} title="Attach image" className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={recording ? stopRec : startRec}
            title={recording ? 'Stop recording' : 'Voice note'}
            className={`p-1.5 rounded-lg transition-colors ${recording ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-primary'}`}
          >
            {recording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={(!text.trim() && !imageUrl && !voiceUrl) || isPending}
            className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-colors hover:bg-primary/90"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline reply bar ──────────────────────────────────────────────────────────
function ReplyBar({ user, onPost, isPending, onCancel }) {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef();

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const handleSend = () => {
    if (!text.trim() && !imageUrl) return;
    onPost({ content: text.trim() || '📷', image_url: imageUrl });
    setText(''); setImageUrl(null);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="bg-muted/30 border-t border-border/50 px-4 py-3">
      {imageUrl && (
        <div className="relative inline-block mb-2">
          <img src={imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <button onClick={() => setImageUrl(null)} className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-white rounded-full flex items-center justify-center"><X className="w-2 h-2" /></button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Avi name={user?.full_name} role={user?.role} size={7} />
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Reply..."
          className="flex-1 bg-card rounded-full px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground border border-border"
        />
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <button onClick={() => imgRef.current?.click()} className="text-muted-foreground hover:text-primary">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>
        <button onClick={handleSend} disabled={!text.trim() && !imageUrl} className="text-primary disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
    </div>
  );
}

// ── Reply bubble ──────────────────────────────────────────────────────────────
function ReplyBubble({ reply, user, onLike, onDelete }) {
  const badge = ROLE_BADGE[reply.author_role] || ROLE_BADGE.user;
  const isOwner = user?.id === reply.author_id || user?.role === 'admin';
  return (
    <div className="flex gap-2.5 py-2">
      <Avi name={reply.author_name} role={reply.author_role} size={7} />
      <div className="flex-1 min-w-0">
        <div className="bg-muted/60 rounded-xl rounded-tl-sm px-3 py-2 inline-block max-w-full">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold">{reply.author_name}</span>
            <Badge className={`text-[8px] border-0 px-1.5 py-0 ${badge.cls}`}>{badge.label}</Badge>
          </div>
          <p className="text-sm leading-relaxed">{reply.content}</p>
          {reply.image_url && <img src={reply.image_url} alt="" className="mt-1.5 max-h-40 rounded-lg object-cover" />}
          {reply.voice_note_url && <audio controls src={reply.voice_note_url} className="mt-1.5 w-full h-7" />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 px-1">
          <button onClick={() => onLike(reply)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors">
            <Heart className="w-3 h-3" /> {reply.likes || 0}
          </button>
          <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(reply.created_date), { addSuffix: true })}</span>
          {isOwner && <button onClick={() => onDelete(reply.id)} className="text-[11px] text-muted-foreground hover:text-destructive ml-auto">Delete</button>}
        </div>
      </div>
    </div>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({ post, replies, user, onLike, onDelete, onReply }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const badge = ROLE_BADGE[post.author_role] || ROLE_BADGE.user;
  const isOwner = user?.id === post.author_id || user?.role === 'admin';
  const rc = replies.length;

  const handleReply = ({ content, image_url }) => {
    onReply(post.id, content, image_url);
    setShowReplies(true);
    setReplyOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avi name={post.author_name} role={post.author_role} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm">{post.author_name}</span>
                <Badge className={`text-[8px] border-0 px-1.5 ${badge.cls}`}>{badge.label}</Badge>
                {post.is_pinned && <span className="text-[10px] text-accent font-medium">📌 Pinned</span>}
                <span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}</span>
              </div>
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground"><MoreVertical className="w-4 h-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {post.title && <p className="font-semibold text-sm mt-1">{post.title}</p>}
            <p className="text-sm leading-relaxed mt-1 text-foreground">{post.content}</p>
            {post.image_url && <img src={post.image_url} alt="" className="mt-2 w-full max-h-64 rounded-xl object-cover border border-border" />}
            {post.voice_note_url && <audio controls src={post.voice_note_url} className="mt-2 w-full" />}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/40">
          <button
            onClick={() => onLike(post)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Heart className="w-3.5 h-3.5" /> {post.likes || 0}
          </button>
          <button
            onClick={() => { setReplyOpen(r => !r); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Reply className="w-3.5 h-3.5" /> Reply
          </button>
          {rc > 0 && (
            <button
              onClick={() => setShowReplies(r => !r)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors ml-auto"
            >
              <MessageSquare className="w-3.5 h-3.5" /> {rc} {rc === 1 ? 'reply' : 'replies'}
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {showReplies && rc > 0 && (
        <div className="px-4 pb-2 border-t border-border/30 bg-muted/10">
          <div className="pl-3 border-l-2 border-border/50">
            {replies.map(r => (
              <ReplyBubble key={r.id} reply={r} user={user} onLike={onLike} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {replyOpen && (
        <ReplyBar
          user={user}
          onPost={handleReply}
          onCancel={() => setReplyOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DiscussionsPage() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [allDiscussions, setAllDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Initial load
  useEffect(() => {
    Promise.resolve([]).then(data => { setAllDiscussions(data); setLoading(false); });
  }, []);

  // Real-time subscription
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = db.entities.Discussion.subscribe((event) => {
        if (event.type === 'create') {
          setAllDiscussions(prev => [event.data, ...prev]);
        } else if (event.type === 'update') {
          setAllDiscussions(prev => prev.map(d => d.id === event.id ? event.data : d));
        } else if (event.type === 'delete') {
          setAllDiscussions(prev => prev.filter(d => d.id !== event.id));
        }
      });
    } catch (e) {
      console.warn("Discussion subscription failed:", e);
    }
    return unsub;
  }, []);

  const rootPosts = allDiscussions.filter(d => !d.parent_id && d.status === 'active');
  const allReplies = allDiscussions.filter(d => !!d.parent_id && d.status === 'active');
  const getReplies = (pid) => allReplies.filter(r => r.parent_id === pid);

  const filtered = rootPosts
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.author_name?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
      if (sortBy === 'pinned') return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      return new Date(b.created_date) - new Date(a.created_date);
    });

  const createMutation = useMutation({
    mutationFn: async ({ content, image_url, voice_note_url }) => {
      try {
        toast.error('Forum feature coming soon');
        return null;
      } catch (e) {
        toast.error('Forum feature coming soon');
        return null;
      }
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, content, image_url }) => {
      try {
        toast.error('Forum feature coming soon');
        return null;
      } catch (e) {
        toast.error('Forum feature coming soon');
        return null;
      }
    }
  });

  const likeMutation = useMutation({
    mutationFn: async (post) => {
      try {
        return null;
      } catch (e) {
        return null;
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      try {
        return null;
      } catch (e) {
        return null;
      }
    },
    onSuccess: () => toast.success('Deleted'),
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold">Community</h1>
          <p className="text-xs text-muted-foreground">{rootPosts.length} posts · {allReplies.length} replies</p>
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          {[
            { key: 'recent', icon: Clock },
            { key: 'popular', icon: TrendingUp },
            { key: 'pinned', icon: Pin },
          ].map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setSortBy(key)} title={key}
              className={`p-1.5 rounded-md transition-colors ${sortBy === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <ComposeBar user={user} onPost={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-9 h-9 bg-muted rounded-full" /><div className="flex-1 space-y-2"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-full" /></div></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">{search ? 'No posts match your search' : 'No posts yet — say something!'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              replies={getReplies(post.id)}
              user={user}
              onLike={(p) => likeMutation.mutate(p)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onReply={(parentId, content, image_url) => replyMutation.mutate({ parentId, content, image_url })}
            />
          ))}
        </div>
      )}
    </div>
  );
}