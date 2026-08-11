import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { usePricing } from '@/hooks/usePricing';
import SEO from '@/components/SEO';
import { format } from 'date-fns';
import {
  BookOpen, Play, ChevronRight, ArrowRight, Zap,
  CheckCircle, GraduationCap, Lock, Newspaper, Clock,
  MessageSquare, Award, Users, TrendingUp
} from 'lucide-react';

const SUBJECT_ICONS = {
  biology: '🧬', chemistry: '⚗️', physics: '⚡', mathematics: '📐',
  'additional mathematics': '∑', english: '📖', 'english language': '📖',
  'english literature': '📚', chichewa: '🗣️', agriculture: '🌱',
  geography: '🌍', history: '📜',
};
function subjectIcon(name = '') { return SUBJECT_ICONS[name.toLowerCase()] || '📘'; }
function readTime(content = '') { return Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 200)); }

function useCountUp(target, isVisible, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let startTime = null;
    let raf;
    const step = (ts) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
      else setValue(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isVisible, target, duration]);
  return value;
}

function StatCounter({ value, suffix, label }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const count = useCountUp(value, visible);
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-primary font-heading">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: pricingData } = usePricing();
  const pricing = pricingData || { monthly_price: 10000, annual_price: 80000 };

  const { data: subjects = [] } = useQuery({
    queryKey: ['landing-subjects'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'order', 6); } catch { return []; } },
    staleTime: 5 * 60_000,
  });

  const { data: blogPosts = [] } = useQuery({
    queryKey: ['landing-blog'],
    queryFn: async () => { try { return await db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 3); } catch { return []; } },
    staleTime: 5 * 60_000,
  });

  const fmt = (n) => Number(n).toLocaleString('en-MW');
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    { q: "How much does it cost?", a: `Monthly subscription is MWK ${fmt(pricing.monthly_price || 10000)}/month. Annual plans save you 2 months at MWK ${fmt(pricing.annual_price || 80000)}/year.` },
    { q: "Which subjects are available?", a: "We cover all Form 3 and Form 4 MSCE subjects — Mathematics, Physical Science, Biology, Chemistry, Physics, English, Chichewa, Geography, History, Agriculture, and more." },
    { q: "Can I study on my phone?", a: "Yes! Chibondo Academy is fully mobile-friendly. Watch video lessons, take quizzes, and access past papers right from your phone — anytime, anywhere." },
    { q: "Do I get a certificate?", a: "Yes. Complete your subjects and pass the final assessments to earn a Chibondo Academy certificate recognized by schools across Malawi." },
    { q: "How do I pay?", a: "Pay via TNM Mpamba, Airtel Money, or bank transfer. Mobile money is instant and you get access immediately after payment." },
  ];

  return (
    <>
      <SEO
        title="Welcome to The Chibondo Academy"
        description="Malawi's online MSCE learning platform. Expert video lessons for Form 3 & 4. Study at your own pace."
      />

      <div className="space-y-0">

        {/* ── 1. HERO — BBA-style dark hero with blob animations ── */}
        <section className="relative overflow-hidden py-16 sm:py-24 md:py-32 px-4 sm:px-6">
          {/* Dot grid background */}
          <div className="absolute inset-0 dot-grid pointer-events-none" />
          {/* Animated blobs */}
          <div className="absolute top-[-10%] left-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-brand-blue/20 rounded-full blur-[100px] sm:blur-[130px] pointer-events-none animate-blob-move" />
          <div className="absolute bottom-[-15%] right-[8%] w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] bg-brand-purple/25 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none animate-blob-move" style={{ animationDelay: "3s" }} />
          <div className="absolute top-1/3 right-1/4 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-brand-accent/10 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none animate-float-slow" />

          <div className="relative max-w-5xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 bg-primary/15 text-primary border border-primary/20">
              <Zap className="w-3 h-3" /> Malawi's Online MSCE Platform
            </span>

            <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl font-extrabold mb-6 leading-[1.1] sm:leading-[1.05] tracking-tight animate-fade-in-up">
              Study smarter.<br />
              <span className="text-gradient">Pass your MSCE.</span>
            </h1>
            <p className="text-base sm:text-xl text-foreground/90 mb-4 max-w-3xl mx-auto font-medium">
              Video lessons, quizzes, and past papers for every Form 3 &amp; 4 subject.
            </p>
            <p className="text-sm sm:text-lg text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto">
              Taught by Malawian educators, available anytime on your phone — fees from MWK {fmt(pricing.monthly_price || 10000)}/month.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button onClick={() => navigate('/register')}
                className="inline-flex items-center justify-center px-6 sm:px-9 py-3.5 sm:py-4 rounded-full bg-primary text-primary-foreground font-bold text-base sm:text-lg hover:opacity-90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
                Create Free Account
              </button>
              <button onClick={() => navigate('/subjects')}
                className="inline-flex items-center justify-center px-6 sm:px-9 py-3.5 sm:py-4 rounded-full bg-card border border-border text-foreground font-semibold text-base sm:text-lg hover:border-primary/50 transition-colors">
                Browse Subjects
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. STATS BAR ── */}
        <section className="bg-card border-y border-border py-10 sm:py-14 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            <StatCounter value={500} suffix="+" label="Students" />
            <StatCounter value={12} suffix="" label="Subjects" />
            <StatCounter value={200} suffix="+" label="Lessons" />
            <StatCounter value={95} suffix="%" label="Pass Rate" />
          </div>
        </section>

        {/* ── 3. SUBJECTS ── */}
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold">Subjects</h2>
              <Link to="/subjects" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                All subjects <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.slice(0, 6).map(subject => (
                <Link key={subject.id} to={`/subjects/${subject.id}`}
                  className="group p-5 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all duration-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-muted">
                      {subjectIcon(subject.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">{subject.name}</p>
                      {subject.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{subject.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <Lock className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[10px] text-muted-foreground">Subscribe to access</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {subjects.length === 0 && [1,2,3,4,5,6].map(i => (
                <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. WHY CHIBONDO ACADEMY ── */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card border-y border-border">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-center mb-12">Why Students Choose Us</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Play, title: "Video Lessons", desc: "Watch clear, expert-led video lessons for every topic — pause, rewind, and replay as much as you need." },
                { icon: CheckCircle, title: "Quizzes & Past Papers", desc: "Test yourself with interactive quizzes and real MSCE past papers with instant marking and feedback." },
                { icon: GraduationCap, title: "Expert Tutors", desc: "Learn from experienced Malawian teachers who know the MSCE syllabus inside out." },
                { icon: TrendingUp, title: "Track Progress", desc: "Monitor your progress with detailed analytics — see your strengths and what needs more work." },
                { icon: Award, title: "Certificates", desc: "Earn recognized certificates when you complete subjects and pass your assessments." },
                { icon: Users, title: "Community", desc: "Join subject forums, ask questions, and learn together with students across Malawi." },
              ].map((feat, i) => (
                <div key={i} className="p-5 rounded-2xl border border-border bg-background">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-primary/10">
                    <feat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. PRICING ── */}
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-4">Simple, Affordable Pricing</h2>
            <p className="text-muted-foreground mb-10">One subscription. All subjects. Cancel anytime.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Monthly */}
              <div className="p-6 rounded-2xl border border-border bg-card text-left">
                <p className="text-sm text-muted-foreground mb-1">Monthly</p>
                <p className="text-3xl font-bold font-heading mb-1">MWK {fmt(pricing.monthly_price || 10000)}</p>
                <p className="text-xs text-muted-foreground mb-4">per month</p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> All subjects</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Video lessons</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Quizzes & past papers</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Forum access</li>
                </ul>
                <button onClick={() => navigate('/register')}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all">
                  Get Started
                </button>
              </div>
              {/* Annual */}
              <div className="p-6 rounded-2xl border border-primary/40 bg-card text-left relative overflow-hidden">
                <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">SAVE 2 MONTHS</div>
                <p className="text-sm text-muted-foreground mb-1">Annual</p>
                <p className="text-3xl font-bold font-heading mb-1">MWK {fmt(pricing.annual_price || 80000)}</p>
                <p className="text-xs text-muted-foreground mb-4">per year</p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Everything in Monthly</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Priority tutor support</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> Certificates</li>
                  <li className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-success" /> 2 months free</li>
                </ul>
                <button onClick={() => navigate('/register')}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all">
                  Choose Annual
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. BLOG ── */}
        {blogPosts.length > 0 && (
          <section className="py-12 sm:py-20 px-4 sm:px-6 bg-card border-y border-border">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-2xl sm:text-3xl font-bold">Latest Articles</h2>
                <Link to="/blog" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  All posts <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {blogPosts.slice(0, 3).map(post => (
                  <Link key={post.id} to={`/blog/${post.slug || post.id}`}
                    className="group p-5 bg-background border border-border rounded-2xl hover:border-primary/40 transition-all">
                    <div className="w-full h-32 rounded-lg overflow-hidden mb-4 bg-muted">
                      {post.cover_image
                        ? <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-8 h-8 text-muted-foreground/30" /></div>
                      }
                    </div>
                    {post.category && <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-primary">{post.category}</p>}
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2 mb-2">{post.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" /><span>{readTime(post.content || '')} min read</span>
                      {post.published_at && <><span className="opacity-40">·</span><span>{format(new Date(post.published_at), 'dd MMM yyyy')}</span></>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 7. FAQ ── */}
        <section className="py-12 sm:py-20 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left">
                    <span className="font-semibold text-sm">{faq.q}</span>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 8. CTA BAND ── */}
        <section className="py-12 sm:py-20 px-4 sm:px-6 border-t border-border bg-gradient-to-r from-brand-blue/10 via-brand-purple/10 to-primary/10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-4">Ready to start learning?</h2>
            <p className="text-muted-foreground mb-8">Join hundreds of Malawian students studying smarter with Chibondo Academy.</p>
            <button onClick={() => navigate('/register')}
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold text-base hover:opacity-90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
              Create Free Account
            </button>
          </div>
        </section>

      </div>
    </>
  );
}
