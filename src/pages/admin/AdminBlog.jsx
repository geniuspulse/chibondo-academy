import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen, Plus, Edit2, Trash2, Eye, EyeOff, Loader2,
  Tag, X, Star, StarOff, Search, BarChart3, Newspaper,
  Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CATEGORIES = ['Biology','Chemistry','Physics','Mathematics','English','History','Geography','Study Tips','Exam Strategy','Career Guidance','General'];

const STATUS_COLORS = {
  published: 'bg-success/10 text-success border-success/20',
  draft:     'bg-muted text-muted-foreground border-border',
  archived:  'bg-destructive/10 text-destructive border-destructive/20',
};

const EMPTY = {
  title:'', slug:'', excerpt:'', content:'', cover_image:'',
  author_name:'', author_photo:'', category:'General',
  meta_title:'', meta_description:'', keywords:'',
  og_title:'', og_description:'', og_image:'',
  twitter_title:'', twitter_description:'',
  tags:[], status:'draft', is_featured:false,
  linked_subject_id:'', linked_subject_name:'',
  tutor_profile_id:'', tutor_slug:'',
};

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

const QUILL_MODULES = {
  toolbar: {
    container: [
      [{ header: [1, 2, 3, 4, false] }],
      [{ font: [] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
      [{ script: 'sub' }, { script: 'super' }],
      ['clean'],
    ],
  },
  clipboard: { matchVisual: false },
};

const QUILL_FORMATS = [
  'header', 'font', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'align',
  'list', 'bullet', 'indent',
  'blockquote', 'code-block',
  'link', 'image', 'video',
  'script',
];

export default function AdminBlog() {
  const queryClient = useQueryClient();
  const [open, setOpen]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [tagInput, setTagInput] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: posts = [], isLoading } = useQuery({queryKey: ['adminBlogPosts'],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({}, '-created_date', 200); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const { data: subjects = [] } = useQuery({queryKey: ['allSubjects'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status:'published' }, 'name', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const { data: tutors = [] } = useQuery({queryKey: ['allTutors'],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ is_visible:true, status:'active' }, 'full_name', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const openNew  = () => { setEditing(null); setForm(EMPTY); setTagInput(''); setActiveTab('content'); setOpen(true); };
  const openEdit = p => {
    setEditing(p);
    setForm({ ...EMPTY, ...p, tags: p.tags||[], is_featured:!!p.is_featured });
    setTagInput(''); setActiveTab('content'); setOpen(true);
  };

  const set = (k,v) => setForm(f => ({
    ...f, [k]: v,
    ...(k==='title' && !editing ? { slug: slugify(v), meta_title: v.slice(0,60) } : {}),
    ...(k==='excerpt' && !editing ? { meta_description: v.slice(0,160) } : {}),
  }));
  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) setForm(f=>({...f, tags:[...f.tags,t]}));
    setTagInput('');
  };
  const removeTag = t => setForm(f=>({...f, tags:f.tags.filter(x=>x!==t)}));
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        published_at: form.status==='published' ? (editing?.published_at||new Date().toISOString()) : form.published_at,
      };
      if (editing) return db.entities.BlogPost.update(editing.id, payload);
      return db.entities.BlogPost.create(payload);
    },
    onSuccess: (savedPost) => {
      queryClient.invalidateQueries({ queryKey:['adminBlogPosts'] });
      queryClient.invalidateQueries({ queryKey:['blogPosts'] });
      toast.success(editing ? 'Post updated!' : 'Post created!');
      setOpen(false);
      // Notify subscribers when a post is published (fire-and-forget)
      const wasPublished = !editing && form.status === 'published';
      const justPublished = editing && editing.status !== 'published' && form.status === 'published';
      if (wasPublished || justPublished) {
        // blog publish notification removed
      }
    },
    onError: e => toast.error('Could not save post', { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: id => db.entities.BlogPost.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['adminBlogPosts'] });
      queryClient.invalidateQueries({ queryKey:['blogPosts'] });
      toast.success('Post deleted');
    },
  });

  const toggleStatus = (post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    const wasPublished = post.status !== 'published' && newStatus === 'published';
    db.entities.BlogPost.update(post.id, {
      status: newStatus,
      ...(newStatus==='published' ? { published_at: post.published_at || new Date().toISOString() } : {}),
    }).then((updated) => {
      queryClient.invalidateQueries({ queryKey:['adminBlogPosts'] });
      // Fire notification when toggling to published
      if (wasPublished) {
        // blog notification removed (legacy invoke)
      }
    });
  };

  const toggleFeatured = (post) => {
    db.entities.BlogPost.update(post.id, { is_featured: !post.is_featured })
      .then(() => queryClient.invalidateQueries({ queryKey:['adminBlogPosts'] }));
  };

  const filtered = posts.filter(p => {
    const matchQ = !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()) || p.author_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchS = filterStatus==='all' || p.status===filterStatus;
    return matchQ && matchS;
  });

  const stats = { total:posts.length, published:posts.filter(p=>p.status==='published').length, draft:posts.filter(p=>p.status==='draft').length, views:posts.reduce((a,p)=>a+(p.view_count||0),0) };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-accent" /> Blog Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage articles</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />New Post</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Posts', value:stats.total, icon:BookOpen },
          { label:'Published',   value:stats.published, icon:Eye },
          { label:'Drafts',      value:stats.draft, icon:Edit2 },
          { label:'Total Views', value:stats.views.toLocaleString(), icon:BarChart3 },
        ].map(({ label,value,icon:Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className="w-5 h-5 mx-auto mb-1 text-accent opacity-70" />
            <p className="text-xl font-bold font-heading">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search posts…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground mb-4">{posts.length === 0 ? 'No blog posts yet.' : 'No posts match your filter.'}</p>
          {posts.length === 0 && <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Create First Post</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <div key={post.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/30 transition-colors">
              {post.cover_image
                ? <img src={post.cover_image} alt={post.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 hidden sm:block" loading="lazy" />
                : <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 items-center justify-center hidden sm:flex"><Newspaper className="w-5 h-5 opacity-20" /></div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{post.title}</p>
                  <Badge className={`text-[10px] capitalize flex-shrink-0 ${STATUS_COLORS[post.status]}`}>{post.status}</Badge>
                  {post.is_featured && <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20 flex-shrink-0">Featured</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {post.category && <span className="mr-2">{post.category}</span>}
                  {post.author_name && <span className="mr-2">· {post.author_name}</span>}
                  <span>· {(post.view_count||0)} views</span>
                  {post.published_at && <span> · {format(new Date(post.published_at),'dd MMM yyyy')}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" title={post.is_featured?'Unfeature':'Feature'} onClick={()=>toggleFeatured(post)}>
                  {post.is_featured ? <Star className="w-3.5 h-3.5 text-accent" /> : <StarOff className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title={post.status==='published'?'Unpublish':'Publish'} onClick={()=>toggleStatus(post)}>
                  {post.status==='published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>openEdit(post)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={()=>{ if(confirm('Delete this post?')) deleteMutation.mutate(post.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Post' : 'New Blog Post'}</DialogTitle></DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="meta">SEO & Meta</TabsTrigger>
              <TabsTrigger value="links">Linking</TabsTrigger>
            </TabsList>

            {/* CONTENT TAB */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Article title" className="mt-1" />
                </div>
                <div>
                  <Label>Slug (URL)</Label>
                  <Input value={form.slug} onChange={e=>set('slug',slugify(e.target.value))} placeholder="article-url-slug" className="mt-1 font-mono text-sm" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v=>set('category',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v=>set('status',v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_featured} onChange={e=>set('is_featured',e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium">Featured post</span>
                  </label>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Author Name</Label>
                  <Input value={form.author_name} onChange={e=>set('author_name',e.target.value)} placeholder="e.g. Mr. Phiri" className="mt-1" />
                </div>
                <div>
                  <Label>Author Photo URL</Label>
                  <Input value={form.author_photo} onChange={e=>set('author_photo',e.target.value)} placeholder="https://…" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Cover Image URL</Label>
                <Input value={form.cover_image} onChange={e=>set('cover_image',e.target.value)} placeholder="https://…" className="mt-1" />
                {form.cover_image && <img src={form.cover_image} alt="cover" className="mt-2 h-28 w-full object-cover rounded-lg border border-border" />}
              </div>

              <div>
                <Label>Excerpt <span className="text-muted-foreground text-xs">({form.excerpt.length}/160)</span></Label>
                <Input value={form.excerpt} onChange={e=>set('excerpt',e.target.value)} maxLength={200} placeholder="Short summary shown on cards and search results" className="mt-1" />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addTag())} placeholder="Type tag + Enter" />
                  <Button type="button" variant="outline" onClick={addTag}><Tag className="w-4 h-4" /></Button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map(t=>(
                      <Badge key={t} className="bg-accent/10 text-accent border-accent/20 capitalize gap-1 cursor-pointer" onClick={()=>removeTag(t)}>
                        {t}<X className="w-3 h-3"/>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Content</Label>
                <div className="mt-1 rounded-lg overflow-hidden border border-border" style={{minHeight:320}}>
                  <style>{`
                    .ql-editor p { margin-bottom: 0.45em !important; margin-top: 0 !important; }
                    .ql-editor h1,.ql-editor h2,.ql-editor h3,.ql-editor h4 { margin-top: 1.2em; margin-bottom: 0.4em; }
                    .ql-editor { min-height: 280px; font-size: 14px; line-height: 1.7; }
                    .ql-toolbar.ql-snow { border-radius: 8px 8px 0 0; background: hsl(var(--muted)/0.4); flex-wrap: wrap; }
                    .ql-container.ql-snow { border-radius: 0 0 8px 8px; }
                    .ql-snow .ql-picker-label { color: hsl(var(--foreground)); }
                    .ql-snow .ql-stroke { stroke: hsl(var(--foreground)); }
                    .ql-snow .ql-fill { fill: hsl(var(--foreground)); }
                    .ql-video { width: 100%; aspect-ratio: 16/9; border-radius: 8px; margin: 1em 0; }
                  `}</style>
                  <ReactQuill
                    theme="snow"
                    value={form.content}
                    onChange={v => set('content', v)}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                    style={{ minHeight: 320 }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Tip: Use the toolbar to embed images, links and YouTube videos. Drag the toolbar icons to reorder content.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* SEO TAB */}
            <TabsContent value="meta" className="space-y-5">

              {/* ── Google Preview ── */}
              <div className="bg-muted/50 border border-border rounded-xl p-4 text-xs space-y-1">
                <p className="font-semibold text-sm mb-2">🔍 Google Preview</p>
                <p className="text-blue-500 font-medium truncate">{window.location.origin}/blog/{form.slug || 'your-article-slug'}</p>
                <p className="font-semibold text-base text-foreground">{form.meta_title || form.title || 'Article Title'}</p>
                <p className="text-muted-foreground line-clamp-2">{form.meta_description || form.excerpt || 'Article description will appear here…'}</p>
              </div>

              {/* ── Basic SEO ── */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic SEO</p>
                <div>
                  <Label>Meta Title <span className="text-muted-foreground text-xs">({form.meta_title.length}/60)</span></Label>
                  <Input value={form.meta_title} onChange={e=>set('meta_title',e.target.value)} maxLength={70} placeholder="Defaults to post title" className="mt-1" />
                  {form.meta_title.length > 60 && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Too long for Google</p>}
                </div>
                <div>
                  <Label>Meta Description <span className="text-muted-foreground text-xs">({form.meta_description.length}/160)</span></Label>
                  <Textarea value={form.meta_description} onChange={e=>set('meta_description',e.target.value)} maxLength={180} placeholder="Defaults to excerpt" className="mt-1 resize-none" rows={2} />
                  {form.meta_description.length > 160 && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Too long for Google</p>}
                </div>
                <div>
                  <Label>Keywords <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
                  <Input value={form.keywords} onChange={e=>set('keywords',e.target.value)} placeholder="MSCE biology, respiration, Malawi" className="mt-1" />
                </div>
              </div>

              {/* ── Open Graph (Facebook, WhatsApp, LinkedIn) ── */}
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Graph</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Controls how this post appears when shared on Facebook, WhatsApp, and LinkedIn. If empty, falls back to Meta Title/Description above.</p>
                </div>
                {/* Social preview card */}
                <div className="rounded-xl overflow-hidden border border-border bg-muted/30 text-xs">
                  {(form.og_image || form.cover_image) && (
                    <img src={form.og_image || form.cover_image} alt="" className="w-full h-32 object-cover" onError={e=>{e.target.style.display='none'}} />
                  )}
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase">chibondoacademy.com</p>
                    <p className="font-semibold text-foreground line-clamp-1">{form.og_title || form.meta_title || form.title || 'Post Title'}</p>
                    <p className="text-muted-foreground line-clamp-2">{form.og_description || form.meta_description || form.excerpt || 'Description…'}</p>
                  </div>
                </div>
                <div>
                  <Label>OG Title</Label>
                  <Input value={form.og_title} onChange={e=>set('og_title',e.target.value)} placeholder="Defaults to Meta Title" className="mt-1" />
                </div>
                <div>
                  <Label>OG Description</Label>
                  <Textarea value={form.og_description} onChange={e=>set('og_description',e.target.value)} placeholder="Defaults to Meta Description" className="mt-1 resize-none" rows={2} />
                </div>
                <div>
                  <Label>OG Image URL <span className="text-muted-foreground text-xs">(1200×630px ideal)</span></Label>
                  <Input value={form.og_image} onChange={e=>set('og_image',e.target.value)} placeholder="Defaults to cover image" className="mt-1" />
                </div>
              </div>

              {/* ── Twitter Card ── */}
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Twitter / X Card</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Controls the Twitter/X card preview. Falls back to OG fields if empty.</p>
                </div>
                <div>
                  <Label>Twitter Title</Label>
                  <Input value={form.twitter_title} onChange={e=>set('twitter_title',e.target.value)} placeholder="Defaults to OG Title" className="mt-1" />
                </div>
                <div>
                  <Label>Twitter Description</Label>
                  <Textarea value={form.twitter_description} onChange={e=>set('twitter_description',e.target.value)} placeholder="Defaults to OG Description" className="mt-1 resize-none" rows={2} />
                </div>
              </div>

            </TabsContent>

            {/* LINKING TAB */}
            <TabsContent value="links" className="space-y-4">
              <div>
                <Label>Linked Tutor <span className="text-muted-foreground text-xs">(shows "Learn from this tutor" block)</span></Label>
                <Select value={form.tutor_profile_id || 'none'} onValueChange={v=>{
                  const t = tutors.find(x=>x.id===v);
                  setForm(f=>({...f, tutor_profile_id:v==='none'?'':v, tutor_slug:t?.slug||'', author_name:f.author_name||t?.full_name||'', author_photo:f.author_photo||t?.profile_photo||''}));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None — admin post" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Admin post)</SelectItem>
                    {tutors.map(t=><SelectItem key={t.id} value={t.id}>{t.full_name}{t.professional_title ? ` — ${t.professional_title}`:''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Course CTA <span className="text-muted-foreground text-xs">(auto-matched by category if left empty)</span></Label>
                <Select value={form.linked_subject_id || 'auto'} onValueChange={v=>{
                  const s = subjects.find(x=>x.id===v);
                  setForm(f=>({...f, linked_subject_id:v==='auto'?'':v, linked_subject_name:s?.name||''}));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Auto-match by category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-match by category</SelectItem>
                    {subjects.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-3 border-t border-border">
            <Button onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending||!form.title} className="flex-1">
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Saving…</> : editing ? 'Update Post' : 'Create Post'}
            </Button>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
