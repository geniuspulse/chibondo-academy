import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Link, useSearchParams, useOutletContext } from 'react-router-dom';
import { BookOpen, Tag, Clock, Search, User, ChevronRight, TrendingUp, Newspaper, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import SEO from '@/components/SEO';

const CATEGORIES = [
  'All','Biology','Chemistry','Physics','Mathematics','English',
  'History','Geography','Study Tips','Exam Strategy','Career Guidance','General'
];

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

function PostCard({ post, featured = false }) {
  const rt = readTime(post.content);
  const catColor = CATEGORY_COLORS[post.category] || CATEGORY_COLORS.General;
  const date = post.published_at ? format(new Date(post.published_at), 'dd MMM yyyy') : '';

  if (featured) {
    return (
      <Link
        to={`/blog/${post.slug || post.id}`}
        className="group relative rounded-2xl overflow-hidden border border-border hover:border-accent/40 transition-all duration-200 hover:shadow-xl block"
      >
        <div className="aspect-[16/7] w-full overflow-hidden bg-muted">
          {post.cover_image
            ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)'}}><Newspaper className="w-16 h-16 opacity-10" /></div>
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            {post.is_featured && <Badge className="bg-accent text-accent-foreground text-[10px]"><Star className="w-2.5 h-2.5 mr-1" />Featured</Badge>}
            {post.category && <Badge className={`text-[10px] ${catColor}`}>{post.category}</Badge>}
          </div>
          <h2 className="font-heading font-bold text-lg sm:text-xl text-white leading-snug line-clamp-2 mb-2 group-hover:text-accent/90 transition-colors">
            {post.title}
          </h2>
          {post.excerpt && <p className="text-sm text-white/70 line-clamp-2 mb-3 hidden sm:block">{post.excerpt}</p>}
          <div className="flex items-center gap-3 text-xs text-white/60">
            {post.author_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author_name}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rt} min read</span>
            {date && <span>{date}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/blog/${post.slug || post.id}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/40 hover:shadow-lg transition-all duration-200 group flex flex-col"
    >
      <div className="aspect-video overflow-hidden bg-muted flex-shrink-0">
        {post.cover_image
          ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)'}}><Newspaper className="w-10 h-10 opacity-10" /></div>
        }
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {post.category && <Badge className={`text-[10px] ${catColor}`}>{post.category}</Badge>}
        </div>
        <h3 className="font-heading font-bold text-sm leading-snug mb-1.5 group-hover:text-accent transition-colors line-clamp-2 flex-1">
          {post.title}
        </h3>
        {post.excerpt && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{post.excerpt}</p>}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-auto pt-3 border-t border-border">
          {post.author_photo
            ? <img src={post.author_photo} alt={post.author_name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
            : <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><User className="w-3 h-3" /></div>
          }
          <span className="truncate">{post.author_name || 'Chibondo Academy'}</span>
          <span className="ml-auto flex-shrink-0 flex items-center gap-1"><Clock className="w-3 h-3" />{rt}m</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const { user } = useOutletContext() || {};
  const isAuthenticated = !!user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blogPosts'],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 100); } catch(e) { console.error(e); return []; } },
  });

  const featuredPosts = useMemo(() => posts.filter(p => p.is_featured).slice(0, 1), [posts]);
  const mainFeatured = featuredPosts[0] || posts[0];

  const filtered = useMemo(() => {
    return posts.filter(p => {
      const matchSearch = !search ||
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.excerpt?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()) ||
        (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [posts, search, activeCategory]);

  const handleSearch = (val) => {
    setSearch(val);
    const params = {};
    if (val) params.q = val;
    if (activeCategory !== 'All') params.category = activeCategory;
    setSearchParams(params);
  };

  const handleCategory = (cat) => {
    setActiveCategory(cat);
    const params = {};
    if (search) params.q = search;
    if (cat !== 'All') params.category = cat;
    setSearchParams(params);
  };

  const gridPosts = search || activeCategory !== 'All' ? filtered : posts.filter(p => p.id !== mainFeatured?.id);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <SEO
        title="Blog — Study Tips, MSCE Revision & Career Guidance"
        description="Learn smarter, pass MSCE, build your future. Expert articles from Chibondo Academy tutors on Biology, Chemistry, Physics, Maths and study strategies."
        canonical={`${window.location.origin}/blog`}
        ogType="website"
        schema={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Chibondo Academy Blog",
          "description": "MSCE revision notes, study tips, and career guidance for Malawian secondary school students",
          "url": `${window.location.origin}/blog`,
          "publisher": { "@type": "Organization", "name": "Chibondo Academy" }
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-accent" /> Blog
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Learn smarter. Pass MSCE. Build your future.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search articles…" value={search} onChange={e => handleSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => handleCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >{cat}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="aspect-[16/7] bg-muted rounded-2xl animate-pulse" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="font-semibold mb-1">No articles yet</p>
          <p className="text-sm text-muted-foreground">Check back soon — our tutors are writing!</p>
        </div>
      ) : (
        <>
          {/* Featured hero — only show when not filtering */}
          {!search && activeCategory === 'All' && mainFeatured && (
            <PostCard post={mainFeatured} featured />
          )}

          {/* Grid */}
          {gridPosts.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">No articles match your search.</p>
              <button onClick={() => { handleSearch(''); handleCategory('All'); }} className="text-accent text-sm mt-2 hover:underline">Clear filters</button>
            </div>
          ) : (
            <>
              {(search || activeCategory !== 'All') && (
                <p className="text-sm text-muted-foreground">{gridPosts.length} article{gridPosts.length !== 1 ? 's' : ''} found</p>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {gridPosts.map(post => <PostCard key={post.id} post={post} />)}
              </div>
            </>
          )}

          {/* Join CTA */}
          {!search && activeCategory === 'All' && (
            <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-primary/10 border border-accent/20 rounded-2xl p-6 sm:p-8 text-center">
              <h2 className="font-heading font-bold text-lg mb-2">Ready to start learning?</h2>
              <p className="text-sm text-muted-foreground mb-4">Join hundreds of Malawian students already passing MSCE with Chibondo Academy.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isAuthenticated ? (
                  <>
                    <Link to="/subjects"><Button>Browse Courses</Button></Link>
                    <Link to="/subscription"><Button variant="outline">View School Fees</Button></Link>
                  </>
                ) : (
                  <>
                    <Link to="/register"><Button style={{background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))'}}>Create Free Account</Button></Link>
                    <Link to="/login"><Button variant="outline">Log In</Button></Link>
                    <Link to="/subjects"><Button variant="ghost">Browse Courses</Button></Link>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
