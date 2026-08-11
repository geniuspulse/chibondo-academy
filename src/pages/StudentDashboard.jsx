import { SectionLoader } from '@/components/BrandedSpinner';
import React, { useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import {
  BookOpen, ArrowRight, Clock,
  Share2, Newspaper, ChevronRight, Phone, X, CreditCard, AlertCircle} from 'lucide-react';

/* ─── Platform CTA card — only 2 now ──────────────────────────────────────── */
function ServiceCTA({ icon: Icon, label, description, to, accent }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all duration-200"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ background: accent + '22' }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5 flex-shrink-0" />
    </Link>
  );
}

/* ─── Main dashboard ──────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const { user } = useOutletContext() ?? {};

  // ── Affiliate referral tracking ─────────────────────────────────────────
  // Picks up the code saved to localStorage on Register — runs once after login
  useEffect(() => {
    if (!user?.id) return;
    const pendingCode = localStorage.getItem("pending_referral_code");
    if (!pendingCode) return;
    localStorage.removeItem("pending_referral_code"); // clear before calling to prevent retries
    (async () => {
          try {
            const refRows = await db.entities.User.filter({ referral_code: pendingCode });
            if (refRows?.length) {
              await db.entities.Referral.create({
                referrer_id: refRows[0].id,
                referrer_name: refRows[0].full_name || '',
                referred_user_id: user?.id,
                referred_name: user?.full_name || '',
                referred_email: user?.email || '',
                referral_code: pendingCode,
                status: 'pending',
                reward_amount: 0,
                reward_status: 'pending',
                recurring_reward_amount: 0,
                recurring_count: 0,
              });
            }
          } catch (err) { console.warn('Frontend referral tracking failed:', err); }
        })()
      .then(() => console.log("✅ Referral tracked:", pendingCode))
      .catch(err => console.warn("Referral tracking failed:", err));
  }, [user?.id]);

  const userId   = user?.id;

  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', userId],
    queryFn: () => db.entities.StudentProfile.filter({ user_id: userId }).then(r => r[0] || null),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: activeSub } = useQuery({
    queryKey: ['activeSub', userId],
    queryFn: async () => {
      if (!userId) return null;
      const results = await db.entities.Subscription.filter({ student_id: userId, status: 'active' });
      return results[0] || null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const subDaysLeft = React.useMemo(() => {
    const expiry = activeSub?.expires_at || activeSub?.end_date;
    if (!expiry) return null;
    return Math.ceil((new Date(expiry) - new Date()) / 86400000);
  }, [activeSub]);

  // Show renewal banner when: active sub with ≤7 days left, OR no active sub at all
  // Also show for trial users (always visible so they can upgrade)
  const isTrial = activeSub?.plan === 'trial';
  const showRenewalBanner = userId && activeSub !== undefined && (
    !activeSub || isTrial || (subDaysLeft !== null && subDaysLeft <= 7)
  );

  const [phoneBannerDismissed, setPhoneBannerDismissed] = React.useState(
    () => !!localStorage.getItem('phone_banner_dismissed')
  );
  const showPhoneBanner = !phoneBannerDismissed && !!userId && studentProfile !== undefined && !studentProfile?.phone_number && !user?.phone_number && !user?.phone;

  const dismissPhoneBanner = () => {
    localStorage.setItem('phone_banner_dismissed', '1');
    setPhoneBannerDismissed(true);
  };

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => db.entities.Enrollment.filter({ student_id: userId }, '-last_accessed', 20),
    enabled:  !!userId,
  });

  const { data: latestPosts = [] } = useQuery({
    queryKey: ['latest-blog-posts'],
    queryFn:  () => db.entities.BlogPost.filter({ status: 'published' }, '-published_at', 3),
    staleTime: 300_000,
  });

  const completedCount = enrollments.filter(e =>
    (e.progress_percentage || 0) === 100 || e.status === 'completed'
  ).length;

  const statsData = {
    enrolled:  enrollments.length,
    hours:     user?.total_learning_hours || 0,
    completed: completedCount,
    streak:    user?.study_streak || 0,
  };

  const ctaServices = [
    {
      icon:        Share2,
      label:       'Invite Friends & Earn',
      description: 'Refer classmates and earn cash commissions through the ACA affiliate programme.',
      to:          '/affiliate',
      accent:      'hsl(var(--primary))',
    },
  ];

  // Show a loading state while the user data loads from the auth context
  if (!user?.id) {
    return <SectionLoader label="Loading your dashboard…" />;
  }

  return (
    <div className="space-y-6">
      <WelcomeCard user={user} />

      {/* Phone number banner — shown to existing users without a phone on file */}
      {showPhoneBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-sm">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Phone className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-accent text-xs">Add your phone number</p>
            <p className="text-xs text-muted-foreground mt-0.5">Keep your account secure and receive important updates.</p>
          </div>
          <a href="/settings" className="text-xs font-semibold text-accent underline underline-offset-2 whitespace-nowrap">Add now</a>
          <button onClick={dismissPhoneBanner} className="p-1 rounded hover:bg-accent/20 transition-colors text-accent flex-shrink-0" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Subscription renewal banner ── */}
      {showRenewalBanner && (
        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm ${
          !activeSub
            ? 'bg-destructive/8 border-destructive/20'
            : subDaysLeft <= 3
            ? 'bg-destructive/8 border-destructive/20'
            : 'bg-amber-500/8 border-amber-400/20'
        }`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            !activeSub || subDaysLeft <= 3 ? 'bg-destructive/15' : 'bg-amber-500/15'
          }`}>
            {!activeSub
              ? <AlertCircle className={`w-4 h-4 text-destructive`} />
              : <CreditCard className={`w-4 h-4 ${subDaysLeft <= 3 ? 'text-destructive' : 'text-amber-600'}`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            {!activeSub ? (
              <>
                <p className="font-semibold text-destructive text-xs">No active subscription</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pay school fees to access lessons, quizzes and past papers.</p>
              </>
            ) : isTrial ? (
              <>
                <p className="font-semibold text-primary text-xs">
                  {subDaysLeft === 0 ? 'Trial ends today!' : `Free Trial: ${subDaysLeft} day${subDaysLeft !== 1 ? 's' : ''} left`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to keep full access after your trial ends.</p>
              </>
            ) : (
              <>
                <p className={`font-semibold text-xs ${subDaysLeft <= 3 ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
                  {subDaysLeft === 0 ? 'Expires today!' : `${subDaysLeft} day${subDaysLeft !== 1 ? 's' : ''} left`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {activeSub.plan} plan · renew to keep uninterrupted access
                </p>
              </>
            )}
          </div>
          <a href="/fees" className={`text-xs font-bold whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors ${
            !activeSub || subDaysLeft <= 3
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}>
            {!activeSub ? 'Pay Fees' : isTrial ? 'Upgrade' : 'Renew Now'}
          </a>
        </div>
      )}

      {/* Setup checklist — shown below welcome until complete */}
      <SetupChecklist user={user} />

      <StatsGrid data={statsData} />

      {/* ── Continue Learning — BBA-style progress cards ── */}
      {enrollments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Continue Learning</h2>
            <Link to="/subjects" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              All subjects <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.slice(0, 6).map(e => {
              // Find subject info from enrollments — they include subject_name
              const progress = e.progress_percentage || 0;
              const isCompleted = progress === 100 || e.status === 'completed';
              return (
                <Link key={e.id} to={`/subjects/${e.subject_id}`}
                  className="group p-4 bg-card border border-border rounded-2xl hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    {isCompleted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">COMPLETED</span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{progress}%</span>
                    )}
                  </div>
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                    {e.subject_name || 'Subject'}
                  </p>
                  <div className="mt-3">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {isCompleted ? 'Completed' : progress > 0 ? 'In progress' : 'Not started'}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}



      {/* Affiliate CTA */}
      <ServiceCTA {...ctaServices[0]} />

      {/* Blog mini-feed */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-base flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-accent" /> Latest from Our Blog
          </h3>
          <Link to="/blog" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {latestPosts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No posts yet — check back soon.</p>
        ) : (
          <div className="space-y-1">
            {latestPosts.map(post => (
              <Link
                key={post.id}
                to={`/blog/${post.id}`}
                className="group flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors"
              >
                {post.cover_image && (
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={post.cover_image} alt="" loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                    {post.title}
                  </p>
                  {post.published_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent flex-shrink-0 mt-0.5 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
