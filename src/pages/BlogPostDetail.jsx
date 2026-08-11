import React, { useEffect } from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  ArrowLeft, Clock, User, Calendar, Tag, Share2,
  BookOpen, GraduationCap, ChevronRight, Newspaper,
  ExternalLink, TrendingUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import SEO from '@/components/SEO';

const CATEGORY_COLORS = {
  Biology:         'bg-green-500/10 text-green-600 border-green-500/20',
  Chemistry:       'bg-purple-500/10 text-purple-600 border-purple-500/20',
  Physics:         'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Mathematics:     'bg-orange-500/10 text-orange-600 border-orange-500/20',
  English:         'bg-pink-500/10 text-pink-600 border-pink-500/20',
  'Study Tips':    'bg-accent/10 text-accent border-accent/20',
  'Exam Strategy': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Career Guidance':'bg-teal-500/10 text-teal-600 border-teal-500/20',
  General:         'bg-muted text-muted-foreground border-border',
};

function readTime(content = '') {
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function RelatedPosts({ currentId, category }) {
  const { data: related = [] } = useQuery({
    queryKey: ['relatedPosts', category, currentId],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ status: 'published', category }, '-published_at', 4); } catch(e) { console.error(e); return []; } },
    enabled: !!category,
  });
  const filtered = related.filter(p => p.id !== currentId).slice(0, 3);
  if (!filtered.length) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-heading font-bold text-sm mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent" /> Related Articles
      </h3>
      <div className="space-y-3">
        {filtered.map(p => (
          <Link key={p.id} to={`/blog/${p.slug || p.id}`}
            className="flex gap-3 group hover:bg-muted/50 rounded-xl p-2 -mx-2 transition-colors">
            {p.cover_image
              ? <img src={p.cover_image} alt={p.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" loading="lazy" />
              : <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center"><Newspaper className="w-5 h-5 opacity-30" /></div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold line-clamp-2 group-hover:text-accent transition-colors">{p.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{readTime(p.content)} min read</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TutorBlock({ tutorProfileId, tutorSlug }) {
  const { data: profiles = [] } = useQuery({
    queryKey: ['tutorProfile', tutorProfileId],
    queryFn: async () => { try { return await db.entities.TutorProfile.filter({ id: tutorProfileId }); } catch(e) { console.error(e); return []; } },
    enabled: !!tutorProfileId,
  });
  const tutor = profiles[0];
  if (!tutor) return null;

  return (
    <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-accent/20 rounded-2xl p-5">
      <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">Learn from this tutor</p>
      <div className="flex items-center gap-3 mb-4">
        {tutor.profile_photo
          ? <img src={tutor.profile_photo} alt={tutor.full_name} className="w-12 h-12 rounded-full object-cover border-2 border-accent/30" />
          : <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><User className="w-5 h-5 opacity-40" /></div>
        }
        <div>
          <p className="font-heading font-bold text-sm">{tutor.full_name}</p>
          <p className="text-xs text-muted-foreground">{tutor.professional_title || tutor.tagline}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link to={`/tutors/${tutor.slug || tutorSlug}`}>
          <Button size="sm" variant="outline" className="w-full text-xs">
            <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> View Tutor Profile
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CourseCTA({ post }) {
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjectCTA', post.linked_subject_id, post.category],
    queryFn: async () => {
      if (post.linked_subject_id) {
        const res = await db.entities.Subject.filter({ id: post.linked_subject_id, status: 'published' });
        if (res.length) return res;
      }
      // Fall back to category-matching subject
      if (post.category && !['Study Tips','Exam Strategy','Career Guidance','General'].includes(post.category)) {
        return db.entities.Subject.filter({ status: 'published' }, 'name', 5);
      }
      return [];
    },
  });

  // Find best match — exact category name in subject name
  const match = subjects.find(s =>
    s.name?.toLowerCase().includes(post.category?.toLowerCase()) ||
    post.category?.toLowerCase().includes(s.name?.toLowerCase())
  ) || subjects[0];

  const isAcademic = post.category && !['Study Tips','Exam Strategy','Career Guidance','General'].includes(post.category);

  return (
    <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="font-heading font-bold text-sm">
            {match ? `Master ${match.name}` : isAcademic ? `Master ${post.category}` : 'Start Learning Today'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {match
              ? `Go beyond the article — structured lessons, quizzes & more in our ${match.name} course.`
              : 'Join Chibondo Academy for structured MSCE lessons, quizzes, and assignments.'}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {match ? (
          <Link to={`/subjects/${match.id}`} className="flex-1">
            <Button className="w-full text-xs" size="sm">
              <ChevronRight className="w-3.5 h-3.5 mr-1" /> Start {match.name} Course
            </Button>
          </Link>
        ) : (
          <Link to="/subjects" className="flex-1">
            <Button className="w-full text-xs" size="sm">Browse All Courses</Button>
          </Link>
        )}
        <Link to="/subscription">
          <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">View School Fees</Button>
        </Link>
      </div>
    </div>
  );
}

function ShareBar({ post }) {
  const url = window.location.href;
  const msg = `📚 ${post.title}\n\n${post.excerpt || ''}\n\n${url}`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    // small feedback — no toast needed, just the icon
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Share:</span>
      <button onClick={handleWhatsApp}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/20 transition-colors">
        <Share2 className="w-3 h-3" /> WhatsApp
      </button>
      <button onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors">
        Copy Link
      </button>
    </div>
  );
}

export default function BlogPostDetail() {
  const { slugOrId } = useParams();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blogPost', slugOrId],
    queryFn: async () => {
      let res = await db.entities.BlogPost.filter({ slug: slugOrId, status: 'published' });
      if (!res.length) res = await db.entities.BlogPost.filter({ id: slugOrId, status: 'published' });
      return res;
    },
    staleTime: 1000 * 60 * 5,
  });

  const post = posts[0];

  // Increment view count once per visit — uses backend function to bypass RLS
  const viewMutation = useMutation({
    mutationFn: async () => {
      // Call trackBlogView backend function (service role — bypasses RLS so anyone can increment views)
      const res = await fetch('/api/trackBlogView', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      });
      if (!res.ok) throw new Error('view track failed');
    },
  });

  useEffect(() => {
    if (post?.id) {
      const key = `blog_viewed_${post.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        viewMutation.mutate();
      }
    }
  }, [post?.id]);

  const rt = post ? readTime(post.content) : 0;
  const catColor = post ? (CATEGORY_COLORS[post.category] || CATEGORY_COLORS.General) : '';
  const publishDate = post?.published_at ? format(new Date(post.published_at), 'dd MMMM yyyy') : '';

  const seoSchema = post ? {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.og_title || post.meta_title || post.title,
    "description": post.og_description || post.meta_description || post.excerpt,
    "image": post.cover_image,
    "author": {
      "@type": "Person",
      "name": post.author_name || "Chibondo Academy"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Chibondo Academy",
      "logo": { "@type": "ImageObject", "url": "https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg" }
    },
    "datePublished": post.published_at,
    "dateModified": post.updated_date,
    "mainEntityOfPage": { "@type": "WebPage", "@id": window.location.href }
  } : null;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-24" />
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="aspect-[16/7] bg-muted rounded-2xl" />
        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-3">{[1,2,3,4,5].map(i=><div key={i} className="h-4 bg-muted rounded" />)}</div>
          <div className="space-y-4"><div className="h-40 bg-muted rounded-2xl"/><div className="h-40 bg-muted rounded-2xl"/></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-heading font-bold mb-2">Article not found</h2>
        <p className="text-muted-foreground text-sm mb-5">This post may have been removed or unpublished.</p>
        <Link to="/blog"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Back to Blog</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SEO
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt}
        canonical={`${window.location.origin}/blog/${post.slug || post.id}`}
        ogImage={post.cover_image}
        ogType="article"
        schema={seoSchema}
        keywords={post.keywords}
        ogTitle={post.og_title || post.meta_title || post.title}
        ogDescription={post.og_description || post.meta_description || post.excerpt}
        ogImageOverride={post.og_image || post.cover_image}
        twitterTitle={post.twitter_title || post.og_title || post.meta_title || post.title}
        twitterDescription={post.twitter_description || post.og_description || post.meta_description || post.excerpt}
        twitterImage={post.twitter_image || post.og_image || post.cover_image}
      />

      {/* Back */}
      <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Blog
      </Link>

      {/* Cover image */}
      {post.cover_image && (
        <div className="aspect-[16/7] rounded-2xl overflow-hidden border border-border">
          <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-6 lg:gap-8 items-start">
        {/* ── LEFT: Article ── */}
        <div className="space-y-5 min-w-0">
          {/* Meta */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {post.category && <Badge className={`text-xs ${catColor}`}>{post.category}</Badge>}
              {(post.tags || []).slice(0, 3).map(t => (
                <Badge key={t} variant="outline" className="text-[10px] capitalize"><Tag className="w-2.5 h-2.5 mr-1" />{t}</Badge>
              ))}
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold leading-snug">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pb-3 border-b border-border">
              <span className="flex items-center gap-2">
                {post.author_photo
                  ? <img src={post.author_photo} alt={post.author_name} className="w-7 h-7 rounded-full object-cover" />
                  : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><User className="w-4 h-4" /></div>
                }
                <span>{post.author_name || 'Chibondo Academy'}</span>
              </span>
              {publishDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{publishDate}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{rt} min read</span>
            </div>
          </div>

          {/* Content */}
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-7">
            {post.content
              ? (
                <div
                  className="aca-article-body"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                  style={{
                    fontSize: '0.9375rem',
                    lineHeight: '1.8',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              )
              : post.excerpt && <p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
            }
            <style>{`
              .aca-article-body h1,.aca-article-body h2,.aca-article-body h3,.aca-article-body h4 {
                font-weight: 700; line-height: 1.3; margin: 1.5em 0 0.5em;
                color: hsl(var(--foreground));
              }
              .aca-article-body h1 { font-size: 1.5rem; }
              .aca-article-body h2 { font-size: 1.25rem; border-bottom: 1px solid hsl(var(--border)); padding-bottom: 0.3em; }
              .aca-article-body h3 { font-size: 1.1rem; }
              .aca-article-body p { margin: 0 0 0.55em; }
              .aca-article-body p + p { margin-top: 0; }
              .aca-article-body .ql-editor p { margin-bottom: 0.55em; }
              .aca-article-body a { color: hsl(var(--primary)); text-decoration: underline; }
              .aca-article-body a:hover { opacity: 0.8; }
              .aca-article-body ul,.aca-article-body ol { margin: 0.75em 0 1em 1.5em; }
              .aca-article-body li { margin-bottom: 0.35em; }
              .aca-article-body blockquote {
                border-left: 4px solid hsl(var(--primary));
                margin: 1.2em 0; padding: 0.75em 1em;
                background: hsl(var(--muted)); border-radius: 0 8px 8px 0;
                color: hsl(var(--muted-foreground)); font-style: italic;
              }
              .aca-article-body code {
                background: hsl(var(--muted)); padding: 0.15em 0.4em;
                border-radius: 4px; font-size: 0.85em; font-family: monospace;
              }
              .aca-article-body pre {
                background: hsl(var(--muted)); padding: 1em; border-radius: 8px;
                overflow-x: auto; margin: 1em 0;
              }
              .aca-article-body pre code { background: none; padding: 0; }
              .aca-article-body img { max-width: 100%; border-radius: 8px; margin: 0.75em 0; }
              .aca-article-body iframe { width: 100%; aspect-ratio: 16/9; border-radius: 8px; margin: 1em 0; border: none; }
              .aca-article-body .ql-video { width: 100%; aspect-ratio: 16/9; border-radius: 8px; margin: 1em 0; border: none; display: block; }
              .aca-article-body strong { font-weight: 700; }
              .aca-article-body em { font-style: italic; }
              .aca-article-body table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.875rem; }
              .aca-article-body th { background: hsl(var(--muted)); font-weight: 600; }
              .aca-article-body th,.aca-article-body td { border: 1px solid hsl(var(--border)); padding: 0.5em 0.75em; text-align: left; }
              .aca-article-body hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 1.5em 0; }
            `}</style>
          </div>

          {/* Share */}
          <ShareBar post={post} />

          {/* Course CTA — full width on mobile, below content */}
          <div className="lg:hidden">
            <CourseCTA post={post} />
          </div>

          {/* Related — mobile */}
          <div className="lg:hidden">
            <RelatedPosts currentId={post.id} category={post.category} />
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="hidden lg:flex flex-col gap-5 sticky top-4">
          {/* Tutor block */}
          {post.tutor_profile_id && (
            <TutorBlock tutorProfileId={post.tutor_profile_id} tutorSlug={post.tutor_slug} />
          )}

          {/* Course CTA */}
          <CourseCTA post={post} />

          {/* Related posts */}
          <RelatedPosts currentId={post.id} category={post.category} />

          {/* Affiliate CTA */}
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-lg">🎁</span>
            </div>
            <p className="font-heading font-bold text-sm mb-1">Earn by Sharing</p>
            <p className="text-xs text-muted-foreground mb-3">Refer a student and earn MWK commission when they pay fees.</p>
            <Link to="/my-referrals">
              <Button variant="outline" size="sm" className="w-full text-xs">Join Affiliate Program</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
