import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Copy, Check, Share2, QrCode, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

function CopyField({ label, value, sub }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
          style={{ background: copied ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))', color: copied ? 'hsl(var(--primary))' : 'hsl(var(--primary-foreground))' }}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="font-mono text-sm break-all text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function QRModal({ url, onClose }) {
  const canvasRef = useRef();

  useEffect(() => {
    // Use a simple URL-based QR service (no library needed)
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-xs w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-center">QR Code</h3>
        <div className="flex justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=1a2035&color=b89037&margin=10`}
            alt="QR Code"
            className="w-48 h-48 rounded-xl"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=1a2035&color=b89037&margin=10`, '_blank')}
            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-4 h-4 inline mr-1.5" />Download
          </button>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AffiliateLinks() {
  const { user } = useOutletContext() || {};
  const [qrUrl, setQrUrl] = useState(null);

  const referralCode = user?.referral_code || (user?.id ? `CHIB-${user.id.slice(-6).toUpperCase()}` : '');
  const baseRef = `${window.location.origin}/register?ref=${referralCode}`;

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({queryKey: ['subjects-for-links'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 50); } catch(e) { console.error(e); return []; } },
    placeholderData: [],
  });

  const whatsappMsg = `📚 *The Chibondo Academy* — Malawi's #1 online secondary school!\n\nMSCE lessons for ALL subjects — Form 3 & Form 4.\n\nFees from *MWK 10,000/month* — affordable & comprehensive.\n\n📲 Register FREE 👇\n${baseRef}`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
  };

  const handleShare = (url) => {
    if (navigator.share) {
      navigator.share({ title: 'Join Chibondo Academy', url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  return (
    <>
    <SEO title="Affiliate Links" description="Get your referral links and QR codes to share Chibondo Academy with your network." />
    <div className="space-y-6">
      {qrUrl && <QRModal url={qrUrl} onClose={() => setQrUrl(null)} />}

      {/* Your code */}
      <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Your Referral Code</p>
        <p className="text-3xl font-heading font-bold tracking-widest" style={{ color: 'hsl(var(--primary))' }}>{referralCode}</p>
        <p className="text-xs text-muted-foreground">Share this code or the links below</p>
      </div>

      {/* Default link */}
      <div className="space-y-2">
        <h3 className="font-semibold">Default Referral Link</h3>
        <CopyField label="Registration Link" value={baseRef} sub="General link for all new student registrations" />
        <div className="flex gap-2">
          <button onClick={() => setQrUrl(baseRef)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted/50 transition-colors">
            <QrCode className="w-4 h-4" /> QR Code
          </button>
          <button onClick={() => handleShare(baseRef)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted/50 transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 transition-colors">
            <Share2 className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>

      {/* WhatsApp message preview */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold">WhatsApp Message Template</p>
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 text-sm whitespace-pre-line text-foreground/80 leading-relaxed">
          {whatsappMsg}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(whatsappMsg); toast.success('Message copied!'); }}
          className="flex items-center gap-2 text-xs text-primary hover:underline">
          <Copy className="w-3.5 h-3.5" /> Copy message
        </button>
      </div>

      {/* Course-specific links */}
      {subjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Course-Specific Links</h3>
          <p className="text-xs text-muted-foreground">Direct links to individual subjects with your referral code embedded.</p>
          <div className="space-y-2">
            {subjects.slice(0, 15).map(s => {
              const link = `${window.location.origin}/subjects/${s.id}?ref=${referralCode}`;
              return (
                <CopyField
                  key={s.id}
                  label={s.name}
                  value={link}
                  sub={s.form_name || ''}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
