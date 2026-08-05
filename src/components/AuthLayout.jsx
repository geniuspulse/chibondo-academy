import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md">
        {/* Brand header — logo only, title below */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16">
            <svg viewBox="0 0 200 244" xmlns="http://www.w3.org/2000/svg" fill="none" className="w-full h-full drop-shadow-lg">
              <rect x="26" y="12" width="108" height="146" rx="3" stroke="#C9A84C" strokeWidth="5.5" fill="none" opacity="0.6"/>
              <rect x="42" y="26" width="108" height="146" rx="3" stroke="#C9A84C" strokeWidth="5.5" fill="none"/>
              <path d="M96 36 C138 30 166 56 160 98 C154 132 128 158 106 176 C101 181 98 186 96 194 C94 186 91 181 86 176 C64 158 38 132 32 98 C26 56 54 30 96 36 Z" fill="#C9A84C"/>
              <line x1="96" y1="40" x2="96" y2="216" stroke="#7A5200" strokeWidth="3.5" strokeLinecap="round"/>
              <path d="M96 60 C78 68 62 78 48 90" stroke="#7A5200" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <path d="M96 77 C76 86 59 98 45 111" stroke="#7A5200" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
              <path d="M96 94 C77 103 61 115 48 128" stroke="#7A5200" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              <path d="M96 111 C80 120 66 132 56 146" stroke="#7A5200" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              <path d="M96 60 C114 68 130 78 144 90" stroke="#7A5200" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
              <path d="M96 77 C116 86 133 98 147 111" stroke="#7A5200" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
              <path d="M96 94 C115 103 131 115 144 128" stroke="#7A5200" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              <path d="M96 111 C112 120 126 132 136 146" stroke="#7A5200" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              <path d="M93 194 L89 220 L96 232 L103 220 L99 194 Z" fill="#C9A84C"/>
              <path d="M82 226 Q96 242 110 226 L104 218 L88 218 Z" fill="none" stroke="#C9A84C" strokeWidth="2"/>
            </svg>
          </div>
          {title && <h1 className="text-lg font-bold mt-3 font-display">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          {children}
        </div>

        {footer && (
          <div className="text-center text-sm text-muted-foreground mt-6">{footer}</div>
        )}
      </div>
    </div>
  );
}
