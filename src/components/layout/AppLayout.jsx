import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { db } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { X, Camera } from 'lucide-react';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import MobileSidebar from './MobileSidebar';
import WhatsAppButton from '../WhatsAppButton';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarPhotoOpen, setSidebarPhotoOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // Session-persistent auth check.
  //
  // Key rules for session persistence:
  //   1. Only treat the user as logged-out when the server explicitly says
  //      the token is invalid (401/403). Any other error (network timeout,
  //      server 5xx, DNS failure) is transient — keep the cached user.
  //   2. React Query will use the last successful cached value while a
  //      background refetch is in flight, so users never see a "blink" to
  //      the guest state during a normal re-check.
  //   3. gcTime > staleTime means the cache survives navigation even if no
  //      component is subscribed, so coming back to the app from a different
  //      tab never triggers a cold auth check.
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await db.auth.me();
      } catch (err) {
        // Genuine auth rejection — no token or token revoked
        const status = err?.status ?? err?.response?.status;
        if (status === 401 || status === 403) {
          return null; // user is genuinely not authenticated
        }
        // Transient error (network blip, 5xx, timeout).
        // Throw so React Query keeps the previous cached value and retries.
        throw err;
      }
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5_000),
    staleTime: 30 * 60_000,  // 30 min — background re-check, but cached user shown in the meantime
    gcTime:    60 * 60_000,  // 60 min — keep in cache across navigation / tab switches
  });

  // Guarantee every registered user has role='user' (student)
  useEffect(() => {
    if (user && !user.role) {
      db.auth.updateMe({ role: 'user' }).catch(() => {});
    }
  }, [user?.id, user?.role]);

  // ── Forum Presence Heartbeat (authenticated users only) ────────────────────
  const location = useLocation();
  const isOnForums = location.pathname.startsWith('/forums') || location.pathname.startsWith('/forum');
  // Chat pages need a locked-height main so only messages scroll, not the page
  const isChatPage = /^\/forums\/[^/]+\/chat/.test(location.pathname);

  useEffect(() => {
    if (!user?.id || !isOnForums) return;

    let presenceId = null;
    const beat = async () => {
      try {
        const now = new Date().toISOString();
        if (presenceId) {
          await db.entities.ForumPresence.update(presenceId, { last_seen: now });
        } else {
          const existing = await db.entities.ForumPresence.filter({ user_id: user.id });
          if (existing[0]) {
            presenceId = existing[0].id;
            await db.entities.ForumPresence.update(presenceId, { last_seen: now });
          } else {
            const created = await db.entities.ForumPresence.create({
              user_id:   user.id,
              user_name: user.full_name || user.email || 'Student',
              user_role: user.role || 'user',
              last_seen: now,
            });
            presenceId = created?.id;
          }
        }
      } catch(_) {}
    };

    beat();
    const iv = setInterval(beat, 60_000);
    return () => clearInterval(iv);
  }, [user?.id, isOnForums]);

  // useMemo prevents a new object reference on every render.
  const enrichedUser = React.useMemo(() => {
    if (!user) return null;
    return { ...user, avatar_url: user.avatar_url || null };
  }, [user?.id, user?.email, user?.full_name, user?.role, user?.avatar_url, user?.referral_code]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: async () => {
      if (!user?.id) return [];
      return db.entities.Notification.filter({ user_id: user.id, is_read: false }, '-created_date', 50);
    },
    enabled: !!user?.id,
    staleTime: 30_000,          // 30s — don't refetch on every window focus
    refetchOnWindowFocus: false, // prevent refetch cascade when user clicks back into app mid-edit
    refetchInterval: 90_000,     // poll every 90s — notifications aren't critical-path
  });

  const isGuest = !enrichedUser;

  const sAvatar    = enrichedUser?.avatar_url;
  const sInitial   = enrichedUser?.full_name?.[0]?.toUpperCase() || 'U';
  const sRoleLabel = enrichedUser?.role === 'admin' ? 'Admin' : enrichedUser?.role === 'teacher' ? 'Tutor' : 'Student';
  const sSettingsPath = enrichedUser?.role === 'admin' ? '/admin/settings' : enrichedUser?.role === 'teacher' ? '/teacher/settings' : '/settings';

  // Pull-to-refresh — real page reload with visual pull feedback
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pullDistance, setPullDistance] = React.useState(0);
  const touchStartY = React.useRef(0);
  const isPulling   = React.useRef(false);
  const pullThreshold = 70; // px needed to trigger refresh
  const maxPull = 100;      // visual cap

  // Check if the page is scrolled to the very top
  const isAtTop = () => {
    return window.scrollY <= 0 && (document.documentElement.scrollTop || document.body.scrollTop) <= 0;
  };

  const onTouchStart = React.useCallback((e) => {
    if (isAtTop() && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [isRefreshing]);

  const onTouchMove = React.useCallback((e) => {
    if (!isPulling.current || isRefreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && isAtTop()) {
      // Resistance: the further you pull, the harder it gets
      const dampened = Math.min(dy * 0.5, maxPull);
      setPullDistance(dampened);
      // Prevent native scroll bounce while pulling
      if (dy > 10) e.preventDefault();
    } else if (dy <= 0) {
      setPullDistance(0);
      isPulling.current = false;
    }
  }, [isRefreshing]);

  const onTouchEnd = React.useCallback((e) => {
    if (!isPulling.current) {
      setPullDistance(0);
      return;
    }
    isPulling.current = false;
    const dy = (e.changedTouches[0]?.clientY || 0) - touchStartY.current;
    setPullDistance(0);
    if (dy > pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      // Invalidate all React Query caches so every page refetches fresh data
      // from the server. This preserves auth state (no redirect to /login)
      // while still giving the user a "fresh page" experience.
      queryClient.invalidateQueries().then(() => {
        // Brief delay so the spinner is visible
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 600);
      });
    }
  }, [isRefreshing]);

  return (
    <>
      {/* Pull-to-refresh indicator — visible during pull and refresh */}
      <div
        className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center pointer-events-none"
        style={{
          transition: isPulling.current ? 'none' : 'opacity 0.2s, transform 0.2s',
          opacity: (isRefreshing || pullDistance > 0) ? 1 : 0,
          transform: `translateY(${isRefreshing ? 20 : Math.max(0, pullDistance - 10)}px)`,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="mt-2 flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 shadow-lg text-xs font-medium text-muted-foreground">
          <RefreshCw
            className={cn('w-3.5 h-3.5', (isRefreshing || pullDistance >= pullThreshold) && 'animate-spin')}
            style={!isRefreshing && pullDistance > 0 && pullDistance < pullThreshold ? { transform: `rotate(${pullDistance * 3.6}deg)` } : {}}
          />
          {isRefreshing ? 'Refreshing…' : pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>
      {/* ── Sidebar avatar lightbox ── */}
      {sidebarPhotoOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSidebarPhotoOpen(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSidebarPhotoOpen(false)}
              className="absolute -top-10 right-0 p-2 rounded-full text-white/70 hover:text-white hover:bg-card/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {sAvatar ? (
              <img src={sAvatar} alt={enrichedUser?.full_name}
                className="w-52 h-52 rounded-full object-cover border-4"
                style={{ borderColor: 'hsl(var(--primary))' }} />
            ) : (
              <div
                className="w-52 h-52 rounded-full flex items-center justify-center text-7xl font-black border-4"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary))' }}
              >
                {sInitial}
              </div>
            )}
            <div className="text-center">
              <p className="text-white text-xl font-bold">{enrichedUser?.full_name || 'User'}</p>
              <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--primary-foreground))' }}>{sRoleLabel}</p>
            </div>
            <a href={sSettingsPath} onClick={() => setSidebarPhotoOpen(false)}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                <Camera className="w-3.5 h-3.5" /> Change Photo
              </div>
            </a>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar — shown for authenticated users only */}
      {!isGuest && (
        <div className="hidden lg:block flex-shrink-0">
          <Sidebar user={enrichedUser} collapsed={collapsed} onToggle={handleToggle} onAvatarClick={() => setSidebarPhotoOpen(true)} />
        </div>
      )}

      {/* Mobile Sidebar Sheet — authenticated only */}
      {!isGuest && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 border-0">
            <MobileSidebar user={enrichedUser} onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
          !isGuest && collapsed ? "lg:ml-16" : !isGuest ? "lg:ml-64" : ""
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <TopBar
            user={enrichedUser}
            notificationCount={notifications.length}
            onMenuClick={() => setMobileOpen(true)}
          />
        <main key={location.pathname} className={isChatPage ? "chat-main-layout" : "flex-1 p-4 lg:p-6 pb-24 lg:pb-6 w-full max-w-7xl mx-auto page-enter"}>
          <Outlet context={{ user: enrichedUser, notifications }} />
          <WhatsAppButton />
        </main>
      </div>

      <BottomNav user={enrichedUser} notifications={notifications} />
    </div>
    </>
  );
}
