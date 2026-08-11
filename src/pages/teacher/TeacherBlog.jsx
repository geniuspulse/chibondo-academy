import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, Link } from 'react-router-dom';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  BookOpen, Plus, Edit2, Trash2, Eye, EyeOff, Loader2, Tag, X,
  Newspaper, MoreVertical, Share2, Copy, ExternalLink, Globe,
  FileEdit, TrendingUp, BarChart2, Users, MousePointerClick, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CATEGORIES = ['Biology','Chemistry','Physics','Mathematics','English','History','Geography','Study Tips','Exam Strategy','Career Guidance','General'];
const STATUS_COLORS = {
  published: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  draft:     'bg-muted text-muted-foreground border-border',
  archived:  'bg-destructive/10 text-destructive border-destructive/20',
};
const EMPTY = { title:'', slug:'', excerpt:'', content:'', cover_image:'', category:'General', tags:[], status:'draft', meta_title:'', meta_description:'', is_featured:false };
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const QUILL_MODULES = { toolbar:[[{header:[1,2,3,false]}],['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['blockquote','code-block'],['link','image'],['clean']] };

// ── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color === 'text-primary' ? 'bg-primary/10' : color === 'text-emerald-600' ? 'bg-emerald-500/10' : color === 'text-violet-600' ? 'bg-violet-500/10' : 'bg-amber-500/10'}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function TeacherBlog() {
  const { user } = useOutletContext() ?? {};
  const queryClient = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [copiedId, setCopiedId]   = useState(null);

  const { data: tutorProfiles = [] } = useQuery({queryKey: ['myTutorProfile', user?.id],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ user_id: user?.id }); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    placeholderData: [],
  });
  const myProfile = tutorProfiles[0];

  const { data: posts = [], isLoading } = useQuery({queryKey: ['teacherBlogPosts', user?.id],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ created_by: user?.id }, '-created_date', 100); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    placeholderData: [],
  });

  // ── Analytics derived from posts ─────────────────────────────────────────
  const totalViews     = posts.reduce((s, p) => s + (p.view_count || 0), 0);
  const publishedPosts = posts.filter(p => p.status === 'published');
  const draftPosts     = posts.filter(p => p.status === 'draft');
  const totalLikes     = posts.reduce((s, p) => s + (p.like_count || 0), 0);
  const topPost        = [...posts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, author_name: myProfile?.full_name || user?.full_name || '', author_photo: myProfile?.profile_photo || '', tutor_profile_id: myProfile?.id || '', tutor_slug: myProfile?.slug || '' });
    setTagInput(''); setActiveTab('content'); setOpen(true);
  };
  const openEdit = p => {
    setEditing(p);
    setForm({ ...EMPTY, ...p, tags: p.tags || [], is_featured: !!p.is_featured });
    setTagInput(''); setActiveTab('content'); setOpen(true);
  };
  const set = (k, v) => setForm(f => ({
    ...f, [k]: v,
    ...(k === 'title' && !editing ? { slug: slugify(v), meta_title: v.slice(0, 60) } : {}),
    ...(k === 'excerpt' && !editing ? { meta_description: v.slice(0, 160) } : {}),
  }));
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };
  const removeTag = t => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));
  const copyLink = (post) => {
    const url = `${window.location.origin}/blog/${post.slug || post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(post.id);
      toast.success('Link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const sharePost = (post) => {
    const url  = `${window.location.origin}/blog/${post.slug || post.id}`;
    const text = `📚 ${post.title} — by ${post.author_name || 'Chibondo Academy'}\n\nRead on Chibondo Academy:\n${url}`;
    if (navigator.share) {
      navigator.share({ title: post.title, text: post.excerpt || post.title, url });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('Post link copied to share!');
    }
  };

  const whatsappShare = (post) => {
    const url  = `${window.location.origin}/blog/${post.slug || post.id}`;
    const text = `📚 *${post.title}*\n\n${post.excerpt || ''}\n\nRead more: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        author_name: form.author_name || myProfile?.full_name || user?.full_name,
        tutor_profile_id: form.tutor_profile_id || myProfile?.id || '',
        tutor_slug: form.tutor_slug || myProfile?.slug || '',
        published_at: form.status === 'published' ? (editing?.published_at || new Date().toISOString()) : form.published_at,
      };
      if (editing) return db.entities.BlogPost.update(editing.id, payload);
      return db.entities.BlogPost.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] });
      queryClient.invalidateQueries({ queryKey: ['blogPosts'] });
      toast.success(editing ? 'Post updated!' : 'Post saved!');
      setOpen(false);
    },
    onError: () => toast.error('Could not save post'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => db.entities.BlogPost.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] }); toast.success('Post deleted'); },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (post) => {
      const newStatus = post.status === 'published' ? 'draft' : 'published';
      return db.entities.BlogPost.update(post.id, {
        status: newStatus,
        published_at: newStatus === 'published' ? (post.published_at || new Date().toISOString()) : post.published_at,
      });
    },
    onSuccess: (_, post) => {
      queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] });
      const newStatus = post.status === 'published' ? 'draft' : 'published';
      toast.success(newStatus === 'published' ? '✅ Post published!' : '📝 Moved to drafts');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (post) => {
      return db.entities.BlogPost.create({
        ...post,
        id: undefined,
        title: `${post.title} (Copy)`,
        slug: `${post.slug || slugify(post.title)}-copy-${Date.now()}`,
        status: 'draft',
        view_count: 0,
        like_count: 0,
        published_at: null,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacherBlogPosts'] }); toast.success('Post duplicated as draft'); },
  });

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" /> My Blog Posts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Share your knowledge with students</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Write Post</Button>
      </div>

      {/* ── Analytics Overview ── */}
      {posts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={Newspaper}        label="Total Posts"      value={posts.length}          sub={`${draftPosts.length} drafts`}          color="text-primary" />
          <StatTile icon={Eye}              label="Total Views"      value={totalViews.toLocaleString()} sub={topPost ? `Top: ${(topPost.view_count||0).toLocaleString()}` : undefined} color="text-violet-600" />
          <StatTile icon={Globe}            label="Published"        value={publishedPosts.length} sub="live articles"               color="text-emerald-600" />
          <StatTile icon={TrendingUp}       label="Engagement"       value={totalLikes}             sub="total likes"                color="text-amber-600" />
        </div>
      )}

      {/* ── Top Post Highlight ── */}
      {topPost && (topPost.view_count || 0) > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">🏆 Top Performing Post</p>
            <p className="text-sm font-medium truncate mt-0.5">{topPost.title}</p>
            <p className="text-xs text-muted-foreground">{(topPost.view_count||0).toLocaleString()} views · {topPost.category}</p>
          </div>
          <Link to={`/blog/${topPost.slug || topPost.id}`} target="_blank">
            <Button size="sm" variant="outline" className="text-xs gap-1 flex-shrink-0">
              <ExternalLink className="w-3 h-3" /> View
            </Button>
          </Link>
        </div>
      )}

      {/* ── Posts List ── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="font-semibold mb-1">No articles yet</p>
          <p className="text-sm text-muted-foreground mb-4">Share your subject expertise with students.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Write Your First Post</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
              {/* Main row */}
              <div className="flex items-center gap-3 p-3">
                {/* Thumbnail */}
                {post.cover_image
                  ? <img src={post.cover_image} alt={post.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Newspaper className="w-6 h-6 opacity-20" />
                    </div>
                }
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-semibold text-sm truncate">{post.title}</p>
                    <Badge className={`text-[10px] capitalize flex-shrink-0 border ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
                    {post.is_featured && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 flex-shrink-0">⭐ Featured</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {post.category && <span className="mr-2">{post.category}</span>}
                    <span className="font-medium">{(post.view_count || 0).toLocaleString()} views</span>
                    {post.like_count > 0 && <span className="ml-2">· {post.like_count} likes</span>}
                    {post.published_at && <span className="ml-2">· {format(new Date(post.published_at), 'dd MMM yyyy')}</span>}
                  </p>
                </div>
                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {/* View */}
                    <DropdownMenuItem asChild>
                      <Link to={`/blog/${post.slug || post.id}`} target="_blank" className="flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5" /> View Post
                      </Link>
                    </DropdownMenuItem>
                    {/* Edit */}
                    <DropdownMenuItem onClick={() => openEdit(post)} className="gap-2">
                      <Edit2 className="w-3.5 h-3.5" /> Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Copy link */}
                    <DropdownMenuItem onClick={() => copyLink(post)} className="gap-2">
                      {copiedId === post.id
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
                        : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                    </DropdownMenuItem>
                    {/* Share */}
                    <DropdownMenuItem onClick={() => sharePost(post)} className="gap-2">
                      <Share2 className="w-3.5 h-3.5" /> Share Post
                    </DropdownMenuItem>
                    {/* WhatsApp */}
                    <DropdownMenuItem onClick={() => whatsappShare(post)} className="gap-2">
                      <svg className="w-3.5 h-3.5 fill-current text-emerald-500" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      Share on WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Toggle publish */}
                    <DropdownMenuItem onClick={() => togglePublishMutation.mutate(post)} className="gap-2">
                      {post.status === 'published'
                        ? <><EyeOff className="w-3.5 h-3.5" /> Move to Draft</>
                        : <><Globe className="w-3.5 h-3.5" /> Publish Now</>}
                    </DropdownMenuItem>
                    {/* Duplicate */}
                    <DropdownMenuItem onClick={() => duplicateMutation.mutate(post)} className="gap-2">
                      <FileEdit className="w-3.5 h-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Delete */}
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onClick={() => { if (window.confirm(`Delete "${post.title}"? This cannot be undone.`)) deleteMutation.mutate(post.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Analytics mini-bar — only for published posts with data */}
              {post.status === 'published' && (
                <div className="px-3 pb-3 pt-0 flex items-center gap-4 border-t border-border/50 mt-0 pt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>{(post.view_count || 0).toLocaleString()} views</span>
                  </div>
                  {post.like_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                      <span>{post.like_count} likes</span>
                    </div>
                  )}
                  {post.comment_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{post.comment_count} comments</span>
                    </div>
                  )}
                  <div className="flex-1" />
                  <p className="text-[10px] text-muted-foreground">
                    {post.published_at
                      ? `Published ${formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}`
                      : 'Published'}
                  </p>
                </div>
              )}
              {post.status === 'draft' && (
                <div className="px-3 pb-2.5 pt-0 flex items-center gap-2 border-t border-border/50 pt-2">
                  <FileEdit className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Draft · Last edited {post.updated_date ? formatDistanceToNow(new Date(post.updated_date), { addSuffix: true }) : 'recently'}
                  </span>
                  <div className="flex-1" />
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1"
                    onClick={() => togglePublishMutation.mutate(post)}>
                    <Globe className="w-2.5 h-2.5" /> Publish
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Post' : 'Write New Post'}</DialogTitle></DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="meta">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Article title" className="mt-1" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v=>set('category',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v=>set('status',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Save as Draft</SelectItem>
                      <SelectItem value="published">Publish Now</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cover Image URL</Label>
                  <Input value={form.cover_image} onChange={e=>set('cover_image',e.target.value)} placeholder="https://…" className="mt-1" />
                </div>
              </div>
              {form.cover_image && <img src={form.cover_image} alt="cover" className="h-28 w-full object-cover rounded-lg border border-border" />}
              <div>
                <Label>Excerpt</Label>
                <Input value={form.excerpt} onChange={e=>set('excerpt',e.target.value)} placeholder="Short summary shown on cards" className="mt-1" />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addTag())} placeholder="Type tag + Enter" />
                  <Button type="button" variant="outline" onClick={addTag}><Tag className="w-4 h-4" /></Button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(t=><Badge key={t} className="bg-accent/10 text-accent border-accent/20 capitalize gap-1 cursor-pointer" onClick={()=>removeTag(t)}>{t}<X className="w-3 h-3"/></Badge>)}
                  </div>
                )}
              </div>
              <div>
                <Label>Content</Label>
                <div className="mt-1 rounded-lg overflow-hidden border border-border" style={{minHeight:320}}>
                  <ReactQuill theme="snow" value={form.content} onChange={v=>set('content',v)} style={{minHeight:280}} modules={QUILL_MODULES} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-sm mb-2">Google Preview</p>
                <p className="text-blue-500 font-medium truncate">{window.location.origin}/blog/{form.slug||'your-article-slug'}</p>
                <p className="font-semibold text-base text-foreground">{form.meta_title||form.title||'Article Title'}</p>
                <p className="text-muted-foreground">{form.meta_description||form.excerpt||'Description…'}</p>
              </div>
              <div>
                <Label>Meta Title <span className="text-muted-foreground text-xs">({(form.meta_title||"").length}/60)</span></Label>
                <Input value={form.meta_title} onChange={e=>set('meta_title',e.target.value)} maxLength={70} placeholder="Defaults to title" className="mt-1" />
              </div>
              <div>
                <Label>Meta Description <span className="text-muted-foreground text-xs">({(form.meta_description||"").length}/160)</span></Label>
                <Input value={form.meta_description} onChange={e=>set('meta_description',e.target.value)} maxLength={180} placeholder="Defaults to excerpt" className="mt-1" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-3 border-t border-border">
            <Button onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending||!form.title} className="flex-1">
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Saving…</> : editing ? 'Update Post' : 'Save Post'}
            </Button>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
