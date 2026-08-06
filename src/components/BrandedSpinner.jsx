import React from 'react';

/**
 * BrandedSpinner — matches the #aca-splash aesthetic so transitions
 * from splash → React mount → lazy route load feel seamless.
 *
 * Variants:
 *   - BrandedSpinner      → full-screen navy gradient with logo + wordmark (Suspense fallback)
 *   - SectionLoader       → compact branded spinner for inside page content
 *   - InlineSpinner       → tiny spinner for buttons / inline loading
 */

const NAVY_GRADIENT = 'linear-gradient(135deg, #1e2d5c 0%, #0d1b3e 100%)';
const GOLD = '#C9A84C';

const QuillLogo = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 200 244" xmlns="http://www.w3.org/2000/svg" fill="none">
    <rect x="26" y="12" width="108" height="146" rx="3" stroke={GOLD} strokeWidth="5.5" fill="none" opacity="0.6"/>
    <rect x="42" y="26" width="108" height="146" rx="3" stroke={GOLD} strokeWidth="5.5" fill="none"/>
    <path d="M96 36 C138 30 166 56 160 98 C154 132 128 158 106 176 C101 181 98 186 96 194 C94 186 91 181 86 176 C64 158 38 132 32 98 C26 56 54 30 96 36 Z" fill={GOLD}/>
    <line x1="96" y1="40" x2="96" y2="216" stroke="#7A5200" strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M96 60 C78 68 62 78 48 90" stroke="#7A5200" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M96 77 C76 86 59 98 45 111" stroke="#7A5200" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    <path d="M96 94 C77 103 61 115 48 128" stroke="#7A5200" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    <path d="M96 111 C80 120 66 132 56 146" stroke="#7A5200" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M96 128 C83 136 72 148 66 160" stroke="#7A5200" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M96 60 C114 68 130 78 144 90" stroke="#7A5200" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M96 77 C116 86 133 98 147 111" stroke="#7A5200" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    <path d="M96 94 C115 103 131 115 144 128" stroke="#7A5200" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    <path d="M96 111 C112 120 126 132 136 146" stroke="#7A5200" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M96 128 C109 136 120 148 126 160" stroke="#7A5200" strokeWidth="1" fill="none" strokeLinecap="round"/>
    <path d="M93 194 L89 220 L96 232 L103 220 L99 194 Z" fill={GOLD}/>
    <path d="M82 226 Q96 242 110 226 L104 218 L88 218 Z" fill="#0d1420" stroke={GOLD} strokeWidth="2"/>
  </svg>
);

const SPIN_KEY = `@keyframes aca-brand-spin { to { transform: rotate(360deg); } }`;

/**
 * Full-screen branded loader — use for Suspense fallback and full-page loading states.
 * Matches the #aca-splash so the transition is seamless.
 */
export function BrandedSpinner({ label = 'Loading…' }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: NAVY_GRADIENT,
        zIndex: 999,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <style>{SPIN_KEY}</style>

      {/* Decorative rings */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <circle cx="195" cy="380" r="160" fill="none" stroke={GOLD + '0A'} strokeWidth="1.5" />
          <circle cx="195" cy="380" r="250" fill="none" stroke={GOLD + '0A'} strokeWidth="1.5" />
          <circle cx="195" cy="380" r="340" fill="none" stroke={GOLD + '0A'} strokeWidth="1.5" />
        </svg>
      </div>

      {/* Logo with spinner ring around it */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: '3px solid rgba(201,168,76,0.15)',
            borderTopColor: GOLD,
            animation: 'aca-brand-spin 1s linear infinite',
          }}
        />
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            background: 'linear-gradient(135deg, #1e2d5c, #2d4a8a)',
            border: '2px solid rgba(201,168,76,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(201,168,76,0.15)',
          }}
        >
          <QuillLogo size={52} />
        </div>
      </div>

      {/* Wordmark */}
      <div
        style={{
          color: '#fff',
          fontSize: '1.15rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        CHIBONDO<br />
        <span style={{ color: GOLD }}>ACADEMY</span>
      </div>

      {/* Label + spinner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid rgba(201,168,76,0.2)',
            borderTopColor: GOLD,
            animation: 'aca-brand-spin 0.7s linear infinite',
          }}
        />
        <span style={{ color: 'rgba(201,168,76,0.7)', fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Section loader — branded but fits inside a page content area.
 * Use for in-page loading states (dashboards, lists, etc.)
 */
export function SectionLoader({ label = 'Loading…' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: '3rem 1rem',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <style>{SPIN_KEY}</style>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '2px solid hsl(var(--primary) / 0.15)',
            borderTopColor: 'hsl(var(--primary))',
            animation: 'aca-brand-spin 0.8s linear infinite',
          }}
        />
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'hsl(var(--primary) / 0.08)',
            border: '1.5px solid hsl(var(--primary) / 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QuillLogo size={22} />
        </div>
      </div>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}

/**
 * Inline spinner — small branded spinner for buttons and inline loading.
 * Drop-in replacement for <Loader2 className="w-4 h-4 animate-spin" />
 */
export function InlineSpinner({ size = 16, className = '' }) {
  return (
    <>
      <style>{SPIN_KEY}</style>
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid hsl(var(--primary) / 0.2)`,
          borderTopColor: 'hsl(var(--primary))',
          animation: 'aca-brand-spin 0.7s linear infinite',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    </>
  );
}

export default BrandedSpinner;
