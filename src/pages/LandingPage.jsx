import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { usePricing } from '@/hooks/usePricing';
import SEO from '@/components/SEO';
import { format } from 'date-fns';
import {
  BookOpen, Play, ChevronRight, ArrowRight,
  CheckCircle, Zap, GraduationCap, Lock, Newspaper, Clock, MessageSquare
} from 'lucide-react';

const SUBJECT_ICONS = {
  biology: '🧬', chemistry: '⚗️', physics: '⚡', mathematics: '📐',
  'additional mathematics': '∑', english: '📖', 'english language': '📖',
  'english literature': '📚', chichewa: '🗣️', agriculture: '🌱',
  geography: '🌍', history: '📜',
};
function subjectIcon(name = '') { return SUBJECT_ICONS[name.toLowerCase()] || '📘'; }
function readTime(content = '') { return Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200)); }

export default function LandingPage() {
  const navigate = useNavigate();

  // Shared pricing hook — DO NOT inline a separate ['pricing'] query here.
  // (This used to rely on useQuery's onSuccess callback, which was removed
  // in React Query v5 — so it silently never updated and always showed the
  // MWK 10,000 default. Also avoids the ['pricing'] cache-shape collision
  // that broke the checkout page — see usePricing.js.)
  const { data: pricingData } = usePricing();
  const pricing = pricingData || { monthly_price: 10000, annual_price: 80000 };

  const { data: subjects = [] } = useQuery({
    queryKey: ['landing-subjects'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'order', 6),
    staleTime: 5 * 60_000,
  });

  const { data: blogPosts = [] } = useQuery({
    queryKey: ['landing-blog'],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 3); } catch { return []; } },
    staleTime: 5 * 60_000,
  });

  const { data: recentThreads = [] } = useQuery({
    queryKey: ['landing-forum-activity'],
    queryFn: async () => { try { return await db.entities.GroupChatMessage.filter({}, 'created_date', 5); } catch { return []; } },
    staleTime: 2 * 60_000,
  });

  const forumCounts = React.useMemo(() => {
    const map = {};
    recentThreads.forEach(t => {
      if (!t.subject_id) return;
      map[t.subject_id] = (map[t.subject_id] || 0) + 1;
    });
    return map;
  }, [recentThreads]);

  const fmt = (n) => Number(n).toLocaleString('en-MW');

  return (
    <>
      <SEO
        title="Welcome to The Chibondo Academy"
        description="Malawi's online MSCE learning platform. Expert video lessons for Form 3 & 4. Study at your own pace."
      />

      <div className="space-y-10">

        {/* ── 1. HERO ── */}
        <div className="relative rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--sidebar-background))' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse at 10% 50%, hsl(var(--primary)) 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, hsl(222 47% 55% / 0.15) 0%, transparent 50%)' }} />
          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-5"
                style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary-foreground))' }}>
                <Zap className="w-3 h-3" /> Malawi's Online MSCE Platform
              </span>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-white mb-4">
                Study smarter.<br />
                <span style={{ color: 'hsl(var(--primary-foreground))' }}>Pass your MSCE.</span>
              </h1>
              <p className="text-white/65 text-sm leading-relaxed mb-8 max-w-md">
                Video lessons, quizzes, and past papers for every Form 3 &amp; 4 subject —
                taught by Malawian educators, available anytime on your phone.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate('/register')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:brightness-110"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  Create Free Account
                </button>
                <button onClick={() => navigate('/subjects')}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/20 text-white/80 hover:border-white/40 hover:text-white transition-colors">
                  Browse Subjects
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. FEATURED SUBJECTS (with forum activity merged in) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base">Subjects</h2>
            <Link to="/subjects" className="flex items-center gap-1 text-xs font-semibold hover:text-accent transition-colors"
              style={{ color: 'hsl(var(--primary))' }}>
              All subjects <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {subjects.slice(0, 4).map(subject => {
              const forumCount = forumCounts[subject.id] || 0;
              return (
                <Link key={subject.id} to={`/subjects/${subject.id}`}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-muted">
                    {subjectIcon(subject.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm group-hover:text-accent transition-colors">{subject.name}</p>
                    {subject.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{subject.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {forumCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />{forumCount}
                      </span>
                    )}
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors" />
                  </div>
                </Link>
              );
            })}
            {subjects.length === 0 && [1,2,3,4].map(i => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>

          <button onClick={() => navigate('/subjects')}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 hover:brightness-110 mt-3"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            Browse All Subjects
          </button>
        </div>

        {/* ── 3. BLOG (uniform rows) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base">Latest Articles</h2>
            <Link to="/blog" className="flex items-center gap-1 text-xs font-semibold hover:text-accent transition-colors"
              style={{ color: 'hsl(var(--primary))' }}>
              All posts <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {blogPosts.slice(0, 3).map(post => (
              <Link key={post.id} to={`/blog/${post.slug || post.id}`}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-accent/40 transition-colors group">
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  {post.cover_image
                    ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-5 h-5 text-muted-foreground/30" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  {post.category && <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--primary))' }}>{post.category}</p>}
                  <p className="font-semibold text-xs group-hover:text-accent transition-colors line-clamp-2">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" /><span>{readTime(post.content || '')} min read</span>
                    {post.published_at && <><span className="opacity-40">·</span><span>{format(new Date(post.published_at), 'dd MMM yyyy')}</span></>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors flex-shrink-0" />
              </Link>
            ))}
            {blogPosts.length === 0 && [1,2,3].map(i => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        </div>

        {/* ── 4. PRICING (single compact card) ── */}
        <div>
          <h2 className="font-display font-bold text-base mb-4">School Fees</h2>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">MWK {fmt(pricing.monthly_price)}</p>
                <p className="text-xs text-muted-foreground">per month — all subjects included</p>
              </div>
              <Link to="/subscription">
                <button className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 hover:brightness-110"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  Pay Fees
                </button>
              </Link>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs text-muted-foreground">
                Or save MWK {fmt(pricing.monthly_price * 12 - pricing.annual_price)} with an annual plan — tap to compare.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70">Payments via Airtel Money &amp; TNM Mpamba</p>
          </div>
        </div>

      </div>
    </>
  );
}
