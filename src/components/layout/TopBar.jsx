import React, { useState } from 'react';
import { Bell, Menu, X, Camera, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

/* ── Profile photo lightbox ─────────────────────────────────────────────────── */
function PhotoViewer({ user, open, onClose }) {
  if (!open) return null;
  const role   = user?.role === 'admin' ? 'Admin' : user?.role === 'teacher' ? 'Tutor' : 'Student';
  const avatar = user?.avatar_url;
  const initial = user?.full_name?.[0]?.toUpperCase() || 'U';
  const settingsPath = user?.role === 'admin' ? '/admin/settings' : user?.role === 'teacher' ? '/teacher/settings' : '/settings';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-4 max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-full text-white/70 hover:text-white hover:bg-card/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Photo or large initial */}
        {avatar ? (
          <img
            src={avatar}
            alt={user?.full_name}
            className="w-52 h-52 rounded-full object-cover border-4"
            style={{ borderColor: 'hsl(var(--primary))' }}
          />
        ) : (
          <div
            className="w-52 h-52 rounded-full flex items-center justify-center text-7xl font-black border-4"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary))' }}
          >
            {initial}
          </div>
        )}

        {/* Name + role */}
        <div className="text-center">
          <p className="text-white text-xl font-bold">{user?.full_name || 'User'}</p>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--primary-foreground))' }}>{role}</p>
        </div>

        {/* Change photo CTA */}
        <Link to={settingsPath} onClick={onClose}>
          <Button
            size="sm"
            className="gap-2 font-semibold"
            style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}
          >
            <Camera className="w-3.5 h-3.5" /> Change Photo
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ── Avatar button — click opens viewer ────────────────────────────────────── */
function UserAvatar({ user, size = 8, onClick }) {
  const [err, setErr]   = useState(false);
  const initial         = user?.full_name?.[0]?.toUpperCase() || 'U';
  const avatarUrl       = user?.avatar_url;

  const cls = `w-${size} h-${size} rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all border-2`;
  const ringStyle = { borderColor: 'hsl(var(--primary) / 0.5)', '--tw-ring-color': 'hsl(var(--primary))' };

  return avatarUrl && !err ? (
    <img
      src={avatarUrl}
      alt={user?.full_name || 'Profile'}
      onError={() => setErr(true)}
      className={cls}
      style={ringStyle}
      onClick={onClick}
    />
  ) : (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all border-2`}
      style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary) / 0.5)' }}
      onClick={onClick}
    >
      {initial}
    </div>
  );
}

export default function TopBar({ user, notificationCount = 0, onMenuClick }) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const isGuest = !user;

  return (
    <>
      <header
        className="h-14 border-b border-border bg-card flex items-center px-4 lg:px-6 sticky top-0 z-30"
      >
        {isGuest ? (
          /* ── GUEST LAYOUT: Logo left · Login + Join Now right ── */
          <>
            <Link to="/blog" className="flex items-center flex-shrink-0">
              <img
                src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_wide.jpg"
                alt="Chibondo Academy"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-8 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="h-8 px-4 text-sm font-semibold" style={{ background:'hsl(var(--primary))', color:'hsl(var(--primary-foreground))' }}>
                  Join Now
                </Button>
              </Link>
            </div>
          </>
        ) : (
          /* ── AUTH LAYOUT: hamburger · logo · bell + avatar ── */
          <>
            <div className="flex-1 flex items-center">
              <Button
                variant="ghost" size="icon"
                className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={onMenuClick}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center lg:hidden">
              <Link to="/">
                <img
                  src="https://nckjjfxlmmsnmnexcgzg.supabase.co/storage/v1/object/public/assets/logo_wide.jpg"
                  alt="Chibondo Academy"
                  className="h-9 w-auto object-contain"
                />
              </Link>
            </div>

            <div className="flex-1 flex items-center justify-end gap-2">
              <Link to="/notifications">
                <Button variant="ghost" size="icon"
                  className="relative h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted">
                  <Bell className="w-4 h-4" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-accent-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Button>
              </Link>
              {/* Avatar — click opens the photo viewer */}
              <UserAvatar user={user} size={8} onClick={() => setPhotoOpen(true)} />
            </div>
          </>
        )}
      </header>

      {/* Photo viewer modal */}
      <PhotoViewer user={user} open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </>
  );
}
