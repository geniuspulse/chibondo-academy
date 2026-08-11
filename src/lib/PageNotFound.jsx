import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  Search, GraduationCap, BookOpen, Library, Newspaper,
  Users, Home, ArrowRight, Star, ChevronRight, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/* ─── brand tokens (match the rest of the app) ─────────────────────────────── */
const BRAND = {
  bg:       'hsl(222 47% 8%)',
  surface:  'hsl(222 47% 11%)',
  card:     'hsl(222 40% 14%)',
  border:   'hsl(222 40% 20%)',
  gold:     'hsl(var(--primary))',
  goldText: 'hsl(222 47% 11%)',
  text:     'hsl(210 40% 96%)',
  muted:    'hsl(210 20% 55%)',
};

/* ─── logo URLs (from existing sidebar/topbar) ─────────────────────────────── */
const LOGO_SQUARE = 'https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_square.jpg';
const LOGO_WIDE   = 'https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_wide.jpg';

/* ─── smart keyword extraction from the attempted URL ─────────────────────── */
function extractKeywords(pathname) {
  return pathname
    .replace(/^\//, '')
    .split(/[/-]/)
    .filter(w => w.length > 2 && !/^\d+$/.test(w))
    .map(w => w.toLowerCase())
    .slice(0, 5);
}

/* ─── detect device type ──────────────────────────────────────────────────── */
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
  return 'desktop';
}

/* ─── Nav link helper ─────────────────────────────────────────────────────── */
function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="text-sm font-medium transition-colors hover:opacity-100"
      style={{ color: 'hsl(210 20% 65%)' }}
      onMouseEnter={e => e.currentTarget.style.color = BRAND.gold}
      onMouseLeave={e => e.currentTarget.style.color = 'hsl(210 20% 65%)'}
    >
      {children}
    </Link>
  );
}

/* ─── Course card ─────────────────────────────────────────────────────────── */
function CourseCard({ subject }) {
  return (
    <Link to={`/subjects/${subject.id}`} className="group block">
      <div
        className="rounded-xl overflow-hidden border transition-all duration-200 group-hover:scale-[1.02]"
        style={{ background: BRAND.card, borderColor: BRAND.border }}
      >
        {subject.cover_image ? (
          <img
            src={subject.cover_image}
            alt={subject.name}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div
            className="w-full h-32 flex items-center justify-center"
            style={{ background: `hsl(var(--primary))15` }}
          >
            <BookOpen className="w-10 h-10" style={{ color: BRAND.gold }} />
          </div>
        )}
        <div className="p-3">
          <p className="font-semibold text-sm truncate" style={{ color: BRAND.text }}>
            {subject.name}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: BRAND.muted }}>
            {subject.form_name}
          </p>
          {subject.teacher_name && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: BRAND.muted }}>
              <GraduationCap className="w-3 h-3" />
              {subject.teacher_name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Tutor card ──────────────────────────────────────────────────────────── */
function TutorCard({ tutor }) {
  return (
    <Link to={`/tutors/${tutor.slug}`} className="group block">
      <div
        className="rounded-xl border p-4 flex items-center gap-4 transition-all duration-200 group-hover:border-yellow-500/40"
        style={{ background: BRAND.card, borderColor: BRAND.border }}
      >
        {tutor.profile_photo ? (
          <img
            src={tutor.profile_photo}
            alt={tutor.full_name}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2"
            style={{ borderColor: `hsl(var(--primary))40` }}
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold"
            style={{ background: BRAND.gold, color: BRAND.goldText }}
          >
            {tutor.full_name?.[0]?.toUpperCase() || 'T'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: BRAND.text }}>{tutor.full_name}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: BRAND.muted }}>
            {tutor.professional_title || (tutor.subjects?.[0])}
          </p>
          {tutor.subjects?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tutor.subjects.slice(0, 2).map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded-md"
                  style={{ background: `hsl(var(--primary))20`, color: BRAND.gold }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: BRAND.muted }} />
      </div>
    </Link>
  );
}

/* ─── Blog card ───────────────────────────────────────────────────────────── */
function BlogCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <div
        className="rounded-xl overflow-hidden border transition-all duration-200 group-hover:border-yellow-500/40"
        style={{ background: BRAND.card, borderColor: BRAND.border }}
      >
        {post.cover_image ? (
          <img src={post.cover_image} alt={post.title} className="w-full h-28 object-cover" />
        ) : (
          <div
            className="w-full h-28 flex items-center justify-center"
            style={{ background: `hsl(var(--primary))10` }}
          >
            <Newspaper className="w-8 h-8" style={{ color: `hsl(var(--primary))60` }} />
          </div>
        )}
        <div className="p-3">
          <p className="font-semibold text-sm line-clamp-2 leading-snug" style={{ color: BRAND.text }}>
            {post.title}
          </p>
          {post.excerpt && (
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: BRAND.muted }}>
              {post.excerpt}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Quick Nav Cards ─────────────────────────────────────────────────────── */
const QUICK_CARDS = [
  {
    icon: GraduationCap,
    title: 'Courses',
    desc: 'Browse all available courses for Forms 1–4.',
    cta: 'Browse Courses',
    to: '/subjects',
    accent: '#3B82F6',
  },
  {
    icon: Users,
    title: 'Tutors',
    desc: 'Meet our expert subject tutors.',
    cta: 'Find Tutors',
    to: '/tutors',
    accent: BRAND.gold,
  },
  {
    icon: Library,
    title: 'Library',
    desc: 'Access revision resources and study materials.',
    cta: 'Open Library',
    to: '/library',
    accent: '#10B981',
  },
  {
    icon: MessageSquare,
    title: 'Community',
    desc: 'Join subject discussion forums.',
    cta: 'Visit Forums',
    to: '/forums',
    accent: '#8B5CF6',
  },
];

/* ─── EDUCATIONAL ILLUSTRATION — inline SVG so no asset dependency ────────── */
function LibraryIllustration() {
  return (
    <svg
      viewBox="0 0 340 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[320px] mx-auto"
      aria-hidden="true"
    >
      {/* Floor */}
      <rect x="20" y="220" width="300" height="8" rx="4" fill="hsl(222 40% 18%)" />

      {/* Left bookshelf */}
      <rect x="20" y="80" width="70" height="140" rx="4" fill="hsl(222 40% 16%)" stroke="hsl(222 40% 22%)" strokeWidth="1.5" />
      {/* Shelf lines */}
      <rect x="22" y="126" width="66" height="2" fill="hsl(222 40% 22%)" />
      <rect x="22" y="172" width="66" height="2" fill="hsl(222 40% 22%)" />
      {/* Books top shelf */}
      <rect x="26" y="90" width="10" height="34" rx="2" fill="#E53E3E" />
      <rect x="38" y="93" width="8" height="31" rx="2" fill="#3182CE" />
      <rect x="48" y="88" width="12" height="36" rx="2" fill="#38A169" />
      <rect x="62" y="94" width="8" height="30" rx="2" fill="hsl(var(--primary))" />
      {/* Books middle shelf */}
      <rect x="26" y="136" width="8" height="32" rx="2" fill="#805AD5" />
      <rect x="36" y="133" width="12" height="35" rx="2" fill="#DD6B20" />
      <rect x="50" y="138" width="10" height="30" rx="2" fill="#319795" />
      <rect x="62" y="135" width="8" height="33" rx="2" fill="#E53E3E" />
      {/* Books bottom shelf */}
      <rect x="26" y="182" width="10" height="32" rx="2" fill="#3182CE" />
      <rect x="38" y="185" width="8" height="29" rx="2" fill="#38A169" />
      <rect x="48" y="180" width="14" height="34" rx="2" fill="#805AD5" />

      {/* Right bookshelf */}
      <rect x="250" y="80" width="70" height="140" rx="4" fill="hsl(222 40% 16%)" stroke="hsl(222 40% 22%)" strokeWidth="1.5" />
      <rect x="252" y="126" width="66" height="2" fill="hsl(222 40% 22%)" />
      <rect x="252" y="172" width="66" height="2" fill="hsl(222 40% 22%)" />
      <rect x="256" y="90" width="10" height="34" rx="2" fill="#38A169" />
      <rect x="268" y="94" width="8" height="30" rx="2" fill="hsl(var(--primary))" />
      <rect x="278" y="88" width="12" height="36" rx="2" fill="#E53E3E" />
      <rect x="292" y="93" width="10" height="31" rx="2" fill="#3182CE" />
      <rect x="256" y="136" width="12" height="32" rx="2" fill="#DD6B20" />
      <rect x="270" y="133" width="8" height="35" rx="2" fill="#805AD5" />
      <rect x="280" y="138" width="10" height="30" rx="2" fill="#319795" />
      <rect x="292" y="135" width="10" height="33" rx="2" fill="hsl(var(--primary))" />
      <rect x="256" y="182" width="8" height="32" rx="2" fill="#38A169" />
      <rect x="266" y="180" width="14" height="34" rx="2" fill="#3182CE" />
      <rect x="282" y="185" width="10" height="29" rx="2" fill="#E53E3E" />

      {/* Student body */}
      {/* Legs */}
      <rect x="153" y="185" width="12" height="35" rx="6" fill="hsl(222 30% 30%)" />
      <rect x="169" y="185" width="12" height="35" rx="6" fill="hsl(222 30% 30%)" />
      {/* Shoes */}
      <ellipse cx="159" cy="221" rx="9" ry="5" fill="hsl(222 47% 14%)" />
      <ellipse cx="175" cy="221" rx="9" ry="5" fill="hsl(222 47% 14%)" />
      {/* Torso */}
      <rect x="148" y="135" width="38" height="52" rx="10" fill="hsl(var(--primary))" />
      {/* Books in arm */}
      <rect x="183" y="152" width="32" height="22" rx="4" fill="#E53E3E" />
      <rect x="183" y="148" width="32" height="6" rx="3" fill="#C53030" />
      <rect x="185" y="158" width="28" height="20" rx="3" fill="#3182CE" />
      {/* Arm */}
      <rect x="176" y="155" width="10" height="20" rx="5" fill="hsl(33 80% 68%)" />
      {/* Head */}
      <circle cx="167" cy="116" r="22" fill="hsl(33 80% 68%)" />
      {/* Hair */}
      <path d="M145 110 Q147 90 167 88 Q187 90 189 110" fill="hsl(222 47% 14%)" />
      {/* Eyes */}
      <circle cx="160" cy="114" r="2.5" fill="hsl(222 47% 11%)" />
      <circle cx="174" cy="114" r="2.5" fill="hsl(222 47% 11%)" />
      <circle cx="161" cy="113" r="1" fill="white" />
      <circle cx="175" cy="113" r="1" fill="white" />
      {/* Smile */}
      <path d="M161 121 Q167 126 173 121" stroke="hsl(222 47% 11%)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Signpost pole */}
      <rect x="210" y="100" width="6" height="120" rx="3" fill="hsl(222 40% 22%)" />
      {/* Sign 1 — Courses */}
      <rect x="216" y="104" width="80" height="22" rx="4" fill="#3182CE" />
      <text x="256" y="119" textAnchor="middle" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="600">Courses →</text>
      {/* Sign 2 — Tutors */}
      <rect x="130" y="130" width="80" height="22" rx="4" fill="hsl(var(--primary))" />
      <text x="170" y="145" textAnchor="middle" fill="hsl(222 47% 11%)" fontSize="10" fontFamily="sans-serif" fontWeight="600">← Tutors</text>
      {/* Sign 3 — Library */}
      <rect x="216" y="156" width="80" height="22" rx="4" fill="#38A169" />
      <text x="256" y="171" textAnchor="middle" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="600">Library →</text>
      {/* Sign 4 — Blog */}
      <rect x="130" y="182" width="80" height="22" rx="4" fill="#805AD5" />
      <text x="170" y="197" textAnchor="middle" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="600">← Blog</text>

      {/* 404 floating badge */}
      <rect x="110" y="28" width="120" height="42" rx="12" fill="hsl(222 40% 16%)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
      <text x="170" y="55" textAnchor="middle" fill="hsl(var(--primary))" fontSize="22" fontFamily="sans-serif" fontWeight="800" letterSpacing="-1">404</text>
    </svg>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────────────────────────── */
export default function PageNotFound() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [search, setSearch] = useState('');

  const keywords = useMemo(
    () => extractKeywords(location.pathname),
    [location.pathname]
  );

  /* ── Analytics: log the 404 hit ── */
  useEffect(() => {
    const deviceType = getDeviceType();
    const log = {
      requested_url: location.pathname + location.search,
      referrer:      document.referrer || '',
      device_type:   deviceType,
      user_agent:    navigator.userAgent.slice(0, 250),
      keywords,
      timestamp:     new Date().toISOString(),
    };
    // Fire-and-forget — don't block render or crash on error
    db.entities.NotFoundLog.create(log).catch(() => {});
  }, [location.pathname]);

  /* ── Popular courses (top by enrollment) ── */
  const { data: popularCourses = [] } = useQuery({
    queryKey: ['404_popular_courses'],
    queryFn:  () => db.entities.Subject.filter({ status: 'published' }, '-enrollment_count', 6),
    staleTime: 10 * 60_000,
  });

  /* ── Smart suggestions — filter courses by URL keywords ── */
  const smartCourses = useMemo(() => {
    if (!keywords.length) return [];
    return popularCourses.filter(s =>
      keywords.some(kw =>
        s.name?.toLowerCase().includes(kw) ||
        s.form_name?.toLowerCase().includes(kw) ||
        s.teacher_name?.toLowerCase().includes(kw)
      )
    );
  }, [popularCourses, keywords]);

  const displayCourses = smartCourses.length > 0 ? smartCourses : popularCourses;

  /* ── Featured tutors ── */
  const { data: tutors = [] } = useQuery({
    queryKey: ['404_tutors'],
    queryFn:  () => db.entities.TutorProfile.filter({ status: 'active', is_visible: true }, '-created_date', 4),
    staleTime: 10 * 60_000,
  });

  /* ── Recent blog posts ── */
  const { data: blogPosts = [] } = useQuery({
    queryKey: ['404_blog'],
    queryFn:  () => db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 4),
    staleTime: 10 * 60_000,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/subjects?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <>
      {/* noindex meta */}
      {typeof document !== 'undefined' && (() => {
        let m = document.querySelector('meta[name="robots"]');
        if (!m) { m = document.createElement('meta'); m.name = 'robots'; document.head.appendChild(m); }
        m.content = 'noindex';
        return null;
      })()}

      <div className="min-h-screen" style={{ background: BRAND.bg, color: BRAND.text }}>

        {/* ── TOP NAV ── */}
        <header
          className="sticky top-0 z-40 h-14 border-b flex items-center px-4 sm:px-6"
          style={{ background: BRAND.surface, borderColor: BRAND.border }}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src={LOGO_SQUARE} alt="Chibondo Academy" className="w-8 h-8 rounded-lg object-cover" />
            <img src={LOGO_WIDE} alt="Chibondo Academy" className="h-7 w-auto object-contain hidden sm:block" />
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6 ml-10">
            <NavLink to="/subjects">Courses</NavLink>
            <NavLink to="/tutors">Tutors</NavLink>
            <NavLink to="/library">Library</NavLink>
            <NavLink to="/blog">Blog</NavLink>
            <NavLink to="/forums">Community</NavLink>
          </nav>

          <div className="flex-1" />

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="h-8 text-sm" style={{ color: 'hsl(210 20% 65%)' }}>
                Login
              </Button>
            </Link>
            <Link to="/register" className="hidden sm:block">
              <Button size="sm" className="h-8 text-sm font-semibold"
                style={{ background: BRAND.gold, color: BRAND.goldText }}>
                Join Now
              </Button>
            </Link>
          </div>
        </header>

        <main className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 pb-20">

          {/* ── HERO SECTION ── */}
          <section className="py-12 sm:py-16 flex flex-col lg:flex-row items-center gap-10">

            {/* Left: text content */}
            <div className="flex-1 text-center lg:text-left">
              {/* 404 display number */}
              <div className="mb-4">
                <span
                  className="text-[100px] sm:text-[140px] font-black leading-none tracking-tighter select-none"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  404
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-4">
                Page Not Found
              </h1>

              <p className="text-base leading-relaxed max-w-lg mx-auto lg:mx-0 mb-6" style={{ color: BRAND.muted }}>
                The page you are looking for may have been moved, renamed, or no longer exists.
                <br /><br />
                Don't worry — there are thousands of lessons, resources, tutors, and study materials waiting for you.
              </p>

              {/* Smart suggestion hint */}
              {keywords.length > 0 && (
                <div
                  className="inline-flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl border mb-6 text-sm"
                  style={{ background: `hsl(var(--primary))10`, borderColor: `hsl(var(--primary))30`, color: BRAND.gold }}
                >
                  <span className="font-medium">Looks like you were searching for:</span>
                  {keywords.map((kw, i) => (
                    <Badge
                      key={i}
                      className="text-[11px] cursor-pointer"
                      style={{ background: `hsl(var(--primary))25`, color: BRAND.gold, border: 'none' }}
                      onClick={() => setSearch(kw)}
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start">
                <Link to="/">
                  <Button size="lg" variant="outline"
                    className="h-11 font-semibold border"
                    style={{ borderColor: BRAND.border, color: BRAND.text }}>
                    <Home className="w-4 h-4 mr-2" /> Go Home
                  </Button>
                </Link>
                <Link to="/subjects">
                  <Button size="lg" className="h-11 font-semibold"
                    style={{ background: BRAND.gold, color: BRAND.goldText }}>
                    <BookOpen className="w-4 h-4 mr-2" /> Browse Courses
                  </Button>
                </Link>
                <Link to="/tutors">
                  <Button size="lg" variant="outline" className="h-11 font-semibold border"
                    style={{ borderColor: BRAND.border, color: BRAND.text }}>
                    <GraduationCap className="w-4 h-4 mr-2" /> Find a Tutor
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: illustration */}
            <div className="flex-shrink-0 w-full max-w-sm lg:max-w-xs xl:max-w-sm">
              <LibraryIllustration />
            </div>
          </section>

          {/* ── SEARCH ── */}
          <section className="mb-14">
            <div
              className="rounded-2xl border p-6 sm:p-8"
              style={{ background: BRAND.card, borderColor: BRAND.border }}
            >
              <h2 className="text-lg font-heading font-semibold mb-1 text-center">
                Find what you're looking for
              </h2>
              <p className="text-sm text-center mb-5" style={{ color: BRAND.muted }}>
                Search courses, tutors, study materials, or blog posts
              </p>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: BRAND.muted }} />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search courses, tutors, blog posts, or study resources..."
                    className="pl-9 h-11 border text-sm"
                    style={{ background: BRAND.surface, borderColor: BRAND.border, color: BRAND.text }}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 px-6 font-semibold shrink-0"
                  style={{ background: BRAND.gold, color: BRAND.goldText }}
                  disabled={!search.trim()}
                >
                  Find Content
                </Button>
              </form>
            </div>
          </section>

          {/* ── QUICK NAVIGATION CARDS ── */}
          <section className="mb-14">
            <h2 className="text-xl font-heading font-bold mb-5">Where would you like to go?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_CARDS.map(({ icon: Icon, title, desc, cta, to, accent }) => (
                <Link key={to} to={to} className="group block">
                  <div
                    className="rounded-xl border p-5 h-full flex flex-col gap-3 transition-all duration-200 group-hover:scale-[1.02]"
                    style={{ background: BRAND.card, borderColor: BRAND.border }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${accent}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1" style={{ color: BRAND.text }}>{title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>{desc}</p>
                    </div>
                    <div
                      className="flex items-center gap-1 text-xs font-semibold mt-auto"
                      style={{ color: accent }}
                    >
                      {cta} <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── POPULAR / SMART COURSES ── */}
          {displayCourses.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-heading font-bold">
                  {smartCourses.length > 0 ? 'Suggested Courses' : 'Popular Courses'}
                </h2>
                <Link
                  to="/subjects"
                  className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ color: BRAND.gold }}
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {displayCourses.slice(0, 6).map(s => (
                  <CourseCard key={s.id} subject={s} />
                ))}
              </div>
              {smartCourses.length === 0 && displayCourses.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: BRAND.muted }}>
                  We couldn't find the page you requested, but you can continue exploring Chibondo Academy using the links above.
                </p>
              )}
            </section>
          )}

          {/* ── FEATURED TUTORS ── */}
          {tutors.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-heading font-bold">Meet Our Tutors</h2>
                <Link
                  to="/tutors"
                  className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ color: BRAND.gold }}
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tutors.slice(0, 4).map(t => (
                  <TutorCard key={t.id} tutor={t} />
                ))}
              </div>
            </section>
          )}

          {/* ── RECENT ARTICLES ── */}
          {blogPosts.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-heading font-bold">Recent Learning Articles</h2>
                <Link
                  to="/blog"
                  className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ color: BRAND.gold }}
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {blogPosts.slice(0, 4).map(p => (
                  <BlogCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}

          {/* ── EMPTY STATE (all sections empty) ── */}
          {displayCourses.length === 0 && tutors.length === 0 && blogPosts.length === 0 && (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{ background: BRAND.card, borderColor: BRAND.border }}
            >
              <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>
                We couldn't find the page you requested, but you can continue exploring Chibondo Academy using the links below.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <Link to="/subjects"><Button size="sm" style={{ background: BRAND.gold, color: BRAND.goldText }}>Browse Courses</Button></Link>
                <Link to="/tutors"><Button size="sm" variant="outline" style={{ borderColor: BRAND.border, color: BRAND.text }}>Find Tutors</Button></Link>
                <Link to="/blog"><Button size="sm" variant="outline" style={{ borderColor: BRAND.border, color: BRAND.text }}>Read Blog</Button></Link>
              </div>
            </div>
          )}

        </main>

        {/* ── MINIMAL FOOTER ── */}
        <footer
          className="border-t py-6 px-4 sm:px-6"
          style={{ borderColor: BRAND.border, background: BRAND.surface }}
        >
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={LOGO_SQUARE} alt="" className="w-7 h-7 rounded-lg object-cover" />
              <span className="text-sm font-semibold" style={{ color: BRAND.gold }}>Chibondo Academy</span>
            </Link>
            <p className="text-xs" style={{ color: BRAND.muted }}>
              © {new Date().getFullYear()} Chibondo Academy · All rights reserved
            </p>
            <div className="flex items-center gap-4">
              <NavLink to="/subjects">Courses</NavLink>
              <NavLink to="/tutors">Tutors</NavLink>
              <NavLink to="/blog">Blog</NavLink>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
