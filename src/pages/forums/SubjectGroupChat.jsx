// src/pages/forums/SubjectGroupChat.jsx
// Polished WhatsApp-style group chat — ACA navy/gold theme
// Runs INSIDE the normal AppLayout (TopBar + BottomNav always visible)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  ArrowLeft, MoreVertical, Camera, X, Users,
  Image as ImageIcon, Send, Smile, Palette, Check, ChevronDown,
  Mic, MicOff, Paperclip, FileText, Play, Pause, Download, AtSign
} from 'lucide-react';
import { toast } from 'sonner';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const NAVY = '#0d1b4b';
const GOLD = '#D4AF37';

// ── Chat themes ───────────────────────────────────────────────────────────────
const THEMES = {
  classic: {
    label: 'Classic',
    bg: '#E5DDD5',
    sent: '#DCF8C6',
    received: 'white',
    header: NAVY,
    inputBg: '#F0F2F5',
    pattern: null,
  },
  midnight: {
    label: 'Midnight',
    bg: '#1a1a2e',
    sent: '#16213e',
    received: '#0f3460',
    header: '#16213e',
    inputBg: '#16213e',
    textColor: '#e0e0e0',
    pattern: null,
  },
  ocean: {
    label: 'Ocean',
    bg: '#e8f4f8',
    sent: '#b3e5fc',
    received: 'white',
    header: '#0277bd',
    inputBg: '#e1f5fe',
    pattern: null,
  },
  forest: {
    label: 'Forest',
    bg: '#e8f5e9',
    sent: '#c8e6c9',
    received: 'white',
    header: '#2e7d32',
    inputBg: '#f1f8e9',
    pattern: null,
  },
  royal: {
    label: 'Royal',
    bg: '#f3e5f5',
    sent: '#e1bee7',
    received: 'white',
    header: '#6a1b9a',
    inputBg: '#fce4ec',
    pattern: null,
  },
  aca: {
    label: 'ACA Gold',
    bg: '#fdf8ee',
    sent: '#fff3cd',
    received: 'white',
    header: NAVY,
    inputBg: '#f5f0e8',
    pattern: null,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const SUBJECT_ICON = n => {
  const l = (n || '').toLowerCase();
  if (l.includes('bio'))   return { icon: '🧬', color: '#00897B' };
  if (l.includes('chem'))  return { icon: '⚗️', color: '#7B1FA2' };
  if (l.includes('phys'))  return { icon: '⚡', color: '#1565C0' };
  if (l.includes('math'))  return { icon: '📐', color: '#E65100' };
  if (l.includes('eng') || l.includes('lit')) return { icon: '📖', color: '#2E7D32' };
  if (l.includes('chich')) return { icon: '🗣️', color: '#00695C' };
  if (l.includes('agri'))  return { icon: '🌱', color: '#558B2F' };
  if (l.includes('geo'))   return { icon: '🌍', color: '#00838F' };
  if (l.includes('hist'))  return { icon: '📜', color: '#BF360C' };
  return { icon: '💬', color: NAVY };
};

const NAME_COLORS = ['#E91E63','#9C27B0','#2196F3','#009688','#FF5722','#795548','#00BCD4','#4CAF50'];
const nameColor = id => NAME_COLORS[(id || 'a').charCodeAt(0) % NAME_COLORS.length];

const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDate = iso => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// ── Theme Picker ──────────────────────────────────────────────────────────────
function ThemePicker({ current, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: 'white', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480,
          padding: '20px 16px 32px', boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: NAVY }}>Chat Theme</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => { onSelect(key); onClose(); }}
              style={{
                border: current === key ? `2px solid ${NAVY}` : '2px solid transparent',
                borderRadius: 14, overflow: 'hidden', cursor: 'pointer', padding: 0,
                boxShadow: current === key ? `0 0 0 3px ${GOLD}66` : '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {/* Mini preview */}
              <div style={{ height: 60, background: theme.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '6px 8px', position: 'relative' }}>
                <div style={{ height: 10, background: theme.received || 'white', borderRadius: 6, width: '60%', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />
                <div style={{ height: 10, background: theme.sent, borderRadius: 6, width: '50%', alignSelf: 'flex-end', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />
                {current === key && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check style={{ width: 10, height: 10, color: 'white' }} />
                  </div>
                )}
              </div>
              <div style={{ background: theme.header, padding: '5px 8px', textAlign: 'center' }}>
                <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{theme.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Edit Icon Modal (admin/tutor) ─────────────────────────────────────────────
function EditIconModal({ group, onClose, onSaved }) {
  const [tab, setTab]       = useState('emoji');
  const [emoji, setEmoji]   = useState(group.icon || '💬');
  const [url, setUrl]       = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef             = useRef(null);

  const EMOJIS = ['💬','📚','⚡','🧬','⚗️','📐','📖','🌍','📜','🌱','🏆','🎯','🔥','💡','✏️','🎓','🦁','🚀','🌟','📊'];

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      // Use standard ACA upload pattern
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setUrl(file_url || '');
      toast.success('Image ready');
    } catch (err) {
      toast.error('Upload failed');
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = tab === 'upload' && url
        ? { icon_url: url, icon: null }
        : { icon: emoji, icon_url: null };
      await db.entities.StudyGroup.update(group.id, updates);
      onSaved({ ...group, ...updates });
      toast.success('Icon updated ✓');
      onClose();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Edit Group Icon</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {['emoji', 'upload'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              borderBottom: tab === t ? `2px solid ${NAVY}` : '2px solid transparent',
              color: tab === t ? NAVY : '#999',
            }}>
              {t === 'emoji' ? '😊 Emoji' : '🖼️ Photo'}
            </button>
          ))}
        </div>
        <div style={{ padding: 16 }}>
          {tab === 'emoji' ? (
            <>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>Choose an emoji icon</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)} style={{
                    width: 42, height: 42, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                    border: emoji === e ? `2px solid ${NAVY}` : '1px solid #eee',
                    background: emoji === e ? `${NAVY}12` : '#fafafa',
                  }}>{e}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()} style={{
                width: '100%', border: `2px dashed ${NAVY}`, borderRadius: 12, padding: '20px 0',
                background: `${NAVY}06`, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8, marginBottom: 12,
              }}>
                <ImageIcon style={{ width: 28, height: 28, color: NAVY, opacity: 0.6 }} />
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>Choose Photo</span>
              </button>
              {url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, marginBottom: 10 }}>
                  <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Image ready</span>
                </div>
              )}
            </>
          )}
          <button onClick={handleSave} disabled={saving || (tab === 'upload' && !url)} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: (saving || (tab === 'upload' && !url)) ? '#ccc' : NAVY,
            color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8,
          }}>
            {saving ? 'Saving…' : 'Save Icon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Audio Player for Voice Notes ───────────────────────────────────────
// Global registry so tapping play on one note pauses all others
const audioRegistry = new Set();

function CustomAudioPlayer({ url, isMine }) {
  const [playing,    setPlaying]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [loaded,     setLoaded]     = useState(false);
  const audioRef  = useRef(null);
  const rafRef    = useRef(null);
  const pauseFnRef = useRef(null);

  const fmtDuration = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Tick RAF to update time display smoothly
  const startTick = (audio) => {
    const tick = () => {
      if (!audio.paused) {
        const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        setProgress(pct);
        setCurrentSec(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const audio = new Audio(url);
    audio.preload = 'metadata';
    audioRef.current = audio;

    // Pause function stored in registry
    const pauseFn = () => {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };
    pauseFnRef.current = pauseFn;
    audioRegistry.add(pauseFn);

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      setLoaded(true);
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      cancelAnimationFrame(rafRef.current);
    });
    audio.addEventListener('error', () => {
      setLoaded(false);
    });

    return () => {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
      audioRegistry.delete(pauseFn);
    };
  }, [url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    } else {
      // Pause all other playing audio
      audioRegistry.forEach(fn => { if (fn !== pauseFnRef.current) fn(); });
      audio.play().then(() => {
        setPlaying(true);
        startTick(audio);
      }).catch(() => {});
    }
  };

  // Scrub by tapping/clicking on the waveform
  const handleScrub = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentSec(audio.currentTime);
  };

  const BAR_HEIGHTS = [8, 14, 10, 18, 12, 16, 7, 15, 11, 17, 9, 14, 12, 16, 8];
  const accentColor = isMine ? 'rgba(255,255,255,0.9)' : NAVY;
  const trackColor  = isMine ? 'rgba(255,255,255,0.3)' : '#d0d0d0';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', minWidth: 210 }}>
      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: isMine ? 'rgba(255,255,255,0.25)' : NAVY,
          border: isMine ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, transition: 'transform 0.15s',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
        onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
      >
        {playing
          ? <Pause  style={{ width: 15, height: 15, fill: 'white', color: 'white' }} />
          : <Play   style={{ width: 15, height: 15, fill: 'white', color: 'white', marginLeft: 2 }} />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Interactive waveform scrubber */}
        <div
          onClick={handleScrub}
          onTouchEnd={handleScrub}
          style={{
            display: 'flex', alignItems: 'center', gap: 2, height: 22,
            cursor: 'pointer', paddingBottom: 2,
          }}
        >
          {BAR_HEIGHTS.map((h, i) => {
            const barPct = ((i + 1) / BAR_HEIGHTS.length) * 100;
            const passed = barPct <= progress;
            return (
              <div key={i} style={{
                flex: 1, height: h, borderRadius: 2,
                background: passed ? accentColor : trackColor,
                transition: 'background 0.1s',
                animation: playing && !passed ? `pulseBar 1.1s ${i * 0.07}s infinite ease-in-out` : 'none',
              }} />
            );
          })}
        </div>

        {/* Time row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10,
          color: isMine ? 'rgba(255,255,255,0.7)' : '#888' }}>
          <span>{fmtDuration(currentSec)}</span>
          <span>{fmtDuration(duration)}</span>
        </div>
      </div>

      <style>{`
        @keyframes pulseBar {
          0%, 100% { transform: scaleY(1);   }
          50%       { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}

// ── Message Action Sheet ─────────────────────────────────────────────────────
function MessageActionSheet({ msg, isMine, isStaff, onReply, onCopy, onDelete, onPin, onReport, onClose }) {
  const actions = [
    { icon: '↩️', label: 'Reply',        fn: () => { onReply(msg); onClose(); } },
    { icon: '📋', label: 'Copy Text',    fn: () => { onCopy(msg); onClose(); }, show: !!msg.body && msg.type !== 'image' && msg.type !== 'voice' },
    { icon: '💾', label: 'Save Audio',   fn: () => {
        const a = document.createElement('a');
        a.href = msg.voice_url || msg.media_url;
        a.download = `voice-note.webm`;
        a.target = '_blank';
        a.click();
        onClose();
      }, show: msg.type === 'voice' },
    { icon: '📌', label: 'Pin Message',  fn: () => { onPin(msg); onClose(); }, show: isStaff },
    { icon: '🗑️', label: 'Delete',       fn: () => { onDelete(msg); onClose(); }, show: isMine || isStaff, danger: true },
    { icon: '🚩', label: 'Report',       fn: () => { onReport(msg); onClose(); }, show: !isMine },
  ].filter(a => a.show !== false);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, backdropFilter: 'blur(2px)'
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--card, #fff)', borderRadius: '20px 20px 0 0',
        zIndex: 1001, padding: '8px 0 32px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.18s ease-out',
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: '#ddd', borderRadius: 99, margin: '0 auto 12px' }} />

        {/* Message preview */}
        <div style={{
          margin: '0 16px 12px', padding: '10px 14px',
          background: 'rgba(0,0,0,0.04)', borderRadius: 12,
          fontSize: 13, color: '#555',
          maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis',
          borderLeft: '3px solid hsl(var(--primary))',
        }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: 'hsl(var(--primary))', marginBottom: 3 }}>
            {msg.author_name}
          </div>
          {msg.type === 'image' ? '📷 Photo' : msg.type === 'voice' ? '🎤 Voice note' : msg.body?.slice(0, 80)}
        </div>

        {/* Actions */}
        {actions.map(({ icon, label, fn, danger }) => (
          <button key={label} onClick={fn} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 16,
            padding: '14px 24px', background: 'none', border: 'none',
            fontSize: 15, color: danger ? '#e53935' : 'var(--foreground, #111)',
            cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showName, theme, onReply, onImageTap, onAction }) {
  const t         = THEMES[theme] || THEMES.classic;
  const color     = nameColor(msg.author_id);
  const isStaff   = msg.author_role === 'teacher' || msg.author_role === 'admin';
  const textColor = t.textColor || '#111';
  const receivedBg = t.received || 'white';

  // Long-press → action sheet
  const pressTimer  = useRef(null);
  const didLongPress = useRef(false);

  const startPress = () => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (onAction) onAction(msg, isMine, isStaff);
    }, 450);
  };
  const endPress = () => clearTimeout(pressTimer.current);

  // Swipe handlers (right swipe to reply — keep for UX muscle memory)
  const touchStart = useRef(0);
  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    startPress();
  };
  const handleTouchEnd = (e) => {
    endPress();
    if (didLongPress.current) return; // long-press already handled
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (diff > 80 && onReply) {
      onReply(msg);
    }
  };

  // Helper to parse and highlight @mentions in blue
  const renderBody = (text) => {
    if (!text) return '';
    const parts = text.split(/(@[a-zA-Z0-9_\s.\-]+?)(?=\s|$|[@.,!?])/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#1d9bf0', fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onAction) onAction(msg, isMine, isStaff);
      }}
      style={{
        display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end', gap: 6, marginBottom: 3, padding: '0 10px',
        userSelect: 'none', cursor: 'pointer'
      }}
      title="Hold to see options"
    >
      {/* Avatar */}
      <div style={{ width: 28, flexShrink: 0 }}>
        {!isMine && showName && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'white', fontWeight: 700,
          }}>
            {(msg.author_name || '?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: isMine ? t.sent : receivedBg,
          borderRadius: isMine ? '14px 0 14px 14px' : '0 14px 14px 14px',
          padding: '7px 11px 6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
        }}>
          {!isMine && showName && (
            <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              {msg.author_name}
              {isStaff && (
                <span style={{
                  fontSize: 9, background: GOLD, color: NAVY,
                  borderRadius: 4, padding: '1px 5px', fontWeight: 800,
                }}>TUTOR ⭐</span>
              )}
            </div>
          )}

          {/* Quoted Message (WhatsApp-style Reply Bubble) */}
          {msg.reply_preview && (
            <div style={{
              background: 'rgba(0,0,0,0.05)',
              borderLeft: `3px solid ${color}`,
              borderRadius: 6,
              padding: '4px 8px',
              marginBottom: 6,
              fontSize: 12,
              color: '#555',
            }}>
              <div style={{ fontWeight: 700, color, fontSize: 11 }}>{msg.reply_author}</div>
              <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {msg.reply_preview}
              </div>
            </div>
          )}

          {/* Deleted message */}
          {msg.deleted ? (
            <p style={{ margin: 0, fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
              🚫 This message was deleted
            </p>
          ) : msg.type === 'voice' ? (
            <CustomAudioPlayer url={msg.voice_url || msg.media_url} isMine={isMine} />
          ) : msg.type === 'video' ? (
            <video
              src={msg.media_url}
              controls
              style={{ width: '100%', maxWidth: 260, borderRadius: 10, margin: '4px 0', display: 'block' }}
            />
          ) : msg.type === 'image' ? (
            <div style={{ margin: '4px 0' }}>
              <img
                src={msg.media_url}
                alt="Shared Image"
                onClick={() => onImageTap && onImageTap(msg.media_url)}
                style={{
                  maxWidth: 240,
                  maxHeight: 240,
                  borderRadius: 10,
                  cursor: 'zoom-in',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                {msg.body !== '📷 Photo' && msg.body}
              </p>
            </div>
          ) : msg.type === 'document' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: 'rgba(0,0,0,0.04)',
              borderRadius: 8, margin: '4px 0', border: '1px solid rgba(0,0,0,0.08)'
            }}>
              <FileText style={{ width: 28, height: 28, color: NAVY }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {msg.media_name || 'Document'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Document Card
                </div>
              </div>
              <a
                href={msg.media_url}
                download={msg.media_name || 'document'}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: NAVY
                }}
              >
                <Download style={{ width: 16, height: 16 }} />
              </a>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: isMine ? '#111' : textColor, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {renderBody(msg.body)}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: isMine ? '#888' : (theme === 'midnight' ? '#aaa' : '#aaa') }}>
              {fmtTime(msg.created_date)}
            </span>
            {isMine && <span style={{ fontSize: 11, color: '#53bdeb' }}>✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SubjectGroupChat() {
  const { subjectSlug }    = useParams();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { user }           = useOutletContext() ?? {};
  const qc                 = useQueryClient();

  const [text, setText]         = useState('');
  const [replyTo,      setReplyTo]      = useState(null);
  const [actionSheet,  setActionSheet]  = useState(null); // { msg, isMine, isStaff }
  const [showMenu, setShowMenu] = useState(false);
  const [showEditIcon, setShowEditIcon] = useState(false);
  const [showTheme, setShowTheme]       = useState(false);
  const [localGroup, setLocalGroup]     = useState(null);

  // Attachment button / list picker states
  const [showPicker, setShowPicker] = useState(false);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Fullscreen Image Lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Voice Note states
  const [recording,    setRecording]    = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recSeconds,   setRecSeconds]   = useState(0);
  const audioChunks  = useRef([]);
  const recTimerRef  = useRef(null);

  // Mentions / Tagging States
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1); // Where the '@' starts in textarea

  // Theme persisted to localStorage per-group
  const themeKey = `chat-theme-${subjectSlug}`;
  const [theme, setTheme] = useState(() => localStorage.getItem(themeKey) || 'classic');

  const t = THEMES[theme] || THEMES.classic;
  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';

  // Guest redirect — guests can view but not send
  const isGuest = !user?.id;

  const endRef      = useRef(null);
  const textareaRef = useRef(null);
  const menuRef     = useRef(null);
  const pickerRef   = useRef(null);

  // Passed-in subject / group from navigation state
  const navSubject = location.state?.subject;
  const navGroup   = location.state?.group;

  useEffect(() => {
    if (!showMenu) return;
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  useEffect(() => {
    if (!showPicker) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPicker]);

  const saveTheme = key => {
    setTheme(key);
    localStorage.setItem(themeKey, key);
  };

  // ── Load subjects / group ──────────────────────────────────────────────────
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-chat'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
    initialData: navSubject ? [navSubject] : undefined,
  });

  const subject = useMemo(() =>
    subjects.find(s =>
      s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug ||
      s.id === subjectSlug || s.slug === subjectSlug
    ) || navSubject,
    [subjects, subjectSlug, navSubject]
  );

  const subjectMeta = useMemo(() => subject ? SUBJECT_ICON(subject.name) : { icon: '💬', color: NAVY }, [subject]);

  const virtualGroup = useMemo(() => subject ? ({
    id          : `subject-${subject.id}`,
    name        : `${subject.name} Chat`,
    icon        : subjectMeta.icon,
    icon_url    : null,
    member_count: subject.enrollment_count || null,
    type        : 'subject',
  }) : navGroup, [subject, subjectMeta, navGroup]);

  const { data: dbGroups = [] } = useQuery({
    queryKey: ['studyGroup-subject', subject?.id],
    queryFn: () => subject ? db.entities.StudyGroup.filter({ subject_id: subject.id, status: 'active' }, 'created_date', 1) : [],
    enabled: !!subject?.id,
    staleTime: 60_000,
  });

  const group = useMemo(() => localGroup || navGroup || dbGroups[0] || virtualGroup, [localGroup, navGroup, dbGroups, virtualGroup]);

  // ── Messages ───────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group?.id],
    queryFn: () => group ? db.entities.GroupChatMessage.filter({ group_id: group.id }, 'created_date', 300) : [],
    enabled: !!group?.id,
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Extract distinct author_names as a proxy for active members in the group
  const members = useMemo(() => {
    const list = new Set();
    messages.forEach(m => {
      if (m.author_name) list.add(m.author_name);
    });
    // Add tutor/admin and self if not present
    if (user?.full_name) list.add(user.full_name);
    return Array.from(list);
  }, [messages, user]);

  const filteredMembers = useMemo(() => {
    if (!showMentions) return [];
    return members.filter(m => m.toLowerCase().includes(mentionQuery.toLowerCase()));
  }, [members, showMentions, mentionQuery]);

  const prevLenRef = useRef(0);
  const hasDoneInitialScroll = useRef(false);

  useEffect(() => {
    if (!messages.length) return;
    const isFirstLoad = !hasDoneInitialScroll.current;
    const isNewMsg = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;

    if (isFirstLoad) {
      // Jump instantly to bottom on first load
      hasDoneInitialScroll.current = true;
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    } else if (isNewMsg) {
      // New message arrived — smooth scroll to bottom
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const grouped = useMemo(() => {
    const result = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      if (!prev || !sameDay(prev.created_date, msg.created_date)) {
        result.push({ type: 'date', label: fmtDate(msg.created_date), key: `d-${i}` });
      }
      const showName = !prev || prev.author_id !== msg.author_id || !sameDay(prev.created_date, msg.created_date);
      result.push({ type: 'msg', msg, showName, key: msg.id });
    });
    return result;
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: payload => db.entities.GroupChatMessage.create(payload),
    onMutate: async payload => {
      await qc.cancelQueries({ queryKey: ['groupChat', group.id] });
      const prev = qc.getQueryData(['groupChat', group.id]) || [];
      qc.setQueryData(['groupChat', group.id], [
        ...prev,
        { ...payload, id: `tmp-${Date.now()}`, created_date: new Date().toISOString() },
      ]);
      return { prev };
    },
    onError: (_, __, ctx) => {
      qc.setQueryData(['groupChat', group.id], ctx.prev);
      toast.error('Message failed');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['groupChat', group.id] }),
  });

  const handleSend = useCallback((customPayload = null) => {
    if (!user?.id) {
      // Guest trying to send — redirect to register
      window.location.href = '/register';
      return;
    }
    if (!group) return;

    if (customPayload) {
      sendMutation.mutate({
        group_id   : group.id,
        author_id  : user.id,
        author_name: user.full_name || user.email?.split('@')[0] || 'Student',
        author_role: user.role || 'student',
        deleted    : false,
        ...customPayload,
        ...(replyTo ? { reply_to_id: replyTo.id, reply_preview: replyTo.body.slice(0, 80), reply_author: replyTo.author_name } : {}),
      });
      setReplyTo(null);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    sendMutation.mutate({
      group_id   : group.id,
      author_id  : user.id,
      author_name: user.full_name || user.email?.split('@')[0] || 'Student',
      author_role: user.role || 'student',
      body       : trimmed,
      type       : 'text',
      deleted    : false,
      ...(replyTo ? { reply_to_id: replyTo.id, reply_preview: replyTo.body.slice(0, 80), reply_author: replyTo.author_name } : {}),
    });
    setText('');
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, user, group, replyTo, sendMutation]);

  // ── Message action handlers ────────────────────────────────────────────────
  const handleMsgAction = useCallback((msg, isMine, isStaff) => {
    setActionSheet({ msg, isMine, isStaff });
  }, []);

  const handleDeleteMsg = useCallback(async (msg) => {
    try {
      await db.entities.GroupChatMessage.update(msg.id, {
        body: '🚫 This message was deleted',
        type: 'text',
        media_url: null,
        deleted: true,
      });
      toast.success('Message deleted');
    } catch {
      toast.error('Could not delete message');
    }
  }, []);

  const handleCopyMsg = useCallback((msg) => {
    const text = msg.body || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
    } else {
      // fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast.success('Copied!');
    }
  }, []);

  const handlePinMsg = useCallback(async (msg) => {
    try {
      await db.entities.GroupChatMessage.update(msg.id, { pinned: true });
      toast.success('Message pinned');
    } catch {
      toast.error('Could not pin message');
    }
  }, []);

  const handleReportMsg = useCallback((msg) => {
    toast('Message reported to admins', { icon: '🚩' });
    // Could create a Report entity here in future
  }, []);

  const handleKey = e => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Keyboard navigation can be added if needed, or simply let user tap
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredMembers[0]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = e => {
    const val = e.target.value;
    setText(val);

    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    // Mention triggers on '@'
    const selStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, selStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!/\s/.test(query)) {
        setShowMentions(true);
        setMentionQuery(query);
        setMentionIndex(lastAtIdx);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (name) => {
    if (mentionIndex === -1) return;
    const before = text.slice(0, mentionIndex);
    const after = text.slice(textareaRef.current.selectionStart);
    const updated = `${before}@${name} ${after}`;
    setText(updated);
    setShowMentions(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // ── Image & Doc Handling ──
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Uploading photo...', { id: 'upload' });
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      const isVideo = file.type.startsWith('video/');
      handleSend({
        type: isVideo ? 'video' : 'image',
        media_url: file_url,
        body: isVideo ? '🎥 Video' : '📷 Photo'
      });
      toast.success(isVideo ? 'Video shared!' : 'Photo shared!', { id: 'upload' });
    } catch (err) {
      toast.error('Failed to upload image', { id: 'upload' });
    }
    setShowPicker(false);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading('Uploading document...', { id: 'upload' });
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      handleSend({
        type: 'document',
        media_url: file_url,
        media_name: file.name,
        body: '📄 Document'
      });
      toast.success('Document shared!', { id: 'upload' });
    } catch (err) {
      toast.error('Failed to upload document', { id: 'upload' });
    }
    setShowPicker(false);
  };

  // ── Voice Recording Handling ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Cross-browser mimeType: webm on Chrome/Android, mp4 on Safari/iOS
      const MIME_CANDIDATES = [
        'audio/webm;codecs=opus', 'audio/webm',
        'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg',
      ];
      const mimeType = MIME_CANDIDATES.find(m => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
      }) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (audioChunks.current.length === 0) return; // cancelled
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const ext = finalMime.includes('mp4') ? 'mp4'
                  : finalMime.includes('ogg')  ? 'ogg'
                  : 'webm';
        const blob = new Blob(audioChunks.current, { type: finalMime });
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: finalMime });
        try {
          toast.loading('Sending voice note...', { id: 'voice' });
          const { file_url } = await db.integrations.Core.UploadFile({ file });
          handleSend({
            type: 'voice',
            voice_url: file_url,
            media_url: file_url,
            body: '🎤 Voice note',
          });
          toast.success('Voice note sent!', { id: 'voice' });
        } catch (err) {
          toast.error('Failed to send voice note', { id: 'voice' });
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err) {
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = (cancel = false) => {
    clearInterval(recTimerRef.current);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (cancel) {
        mediaRecorder.onstop = () => {};
        audioChunks.current = [];
      }
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setRecording(false);
    setRecSeconds(0);
  };

  if (!group) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>💬</div>
          <p style={{ fontWeight: 600 }}>Loading chat…</p>
        </div>
      </div>
    );
  }

  const headerColor = t.header;

  return (
    <>
      {showTheme && <ThemePicker current={theme} onSelect={saveTheme} onClose={() => setShowTheme(false)} />}
      {showEditIcon && (
        <EditIconModal group={group} onClose={() => setShowEditIcon(false)} onSaved={setLocalGroup} />
      )}

      {/* Message Action Sheet */}
      {actionSheet && (
        <MessageActionSheet
          msg={actionSheet.msg}
          isMine={actionSheet.isMine}
          isStaff={actionSheet.isStaff}
          onReply={(m) => { setReplyTo(m); setActionSheet(null); }}
          onCopy={handleCopyMsg}
          onDelete={handleDeleteMsg}
          onPin={handlePinMsg}
          onReport={handleReportMsg}
          onClose={() => setActionSheet(null)}
        />
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.95)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <img src={lightboxUrl} alt="Fullscreen" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)',
              border: 'none', color: 'white', padding: 8, borderRadius: '50%', cursor: 'pointer'
            }}
          >
            <X style={{ width: 24, height: 24 }} />
          </button>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 56px - 64px)', /* dvh minus TopBar(56) and BottomNav(64) */
        overflow: 'hidden',
        background: t.bg,
        position: 'relative',
      }}>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0, height: 58, background: headerColor,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 10px', zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <button onClick={() => navigate('/forums')} style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer',
            padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center',
            flexShrink: 0,
          }}>
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>

          {/* Avatar */}
          <div
            onClick={isPrivileged ? () => setShowEditIcon(true) : undefined}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: subjectMeta.color || 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, border: `2px solid ${GOLD}66`,
              cursor: isPrivileged ? 'pointer' : 'default',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {(localGroup || group).icon_url
              ? <img src={(localGroup || group).icon_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span>{(localGroup || group).icon || subjectMeta.icon}</span>
            }
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(localGroup || group).name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users style={{ width: 10, height: 10 }} />
              {group.member_count ? `${group.member_count} members` : 'Group chat'}
            </div>
          </div>

          {/* ⋮ Menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setShowMenu(v => !v)} style={{
              background: 'none', border: 'none', color: 'white', cursor: 'pointer',
              padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center',
            }}>
              <MoreVertical style={{ width: 20, height: 20 }} />
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                background: 'white', borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)', minWidth: 190, zIndex: 200,
                overflow: 'hidden',
              }}>
                <button onClick={() => { setShowTheme(true); setShowMenu(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: 'none', border: 'none',
                  fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                }}>
                  <Palette style={{ width: 15, height: 15, color: '#888' }} /> Change Theme
                </button>
                {isPrivileged && (
                  <button onClick={() => { setShowEditIcon(true); setShowMenu(false); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', background: 'none', border: 'none',
                    fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                    borderTop: '1px solid #f5f5f5',
                  }}>
                    <Camera style={{ width: 15, height: 15, color: '#888' }} /> Edit Group Icon
                  </button>
                )}
                <button onClick={() => { navigate('/forums'); setShowMenu(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: 'none', border: 'none',
                  fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                  borderTop: '1px solid #f5f5f5',
                }}>
                  <ArrowLeft style={{ width: 15, height: 15, color: '#888' }} /> Back to Chats
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', WebkitOverflowScrolling: 'touch' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa', fontSize: 13 }}>Loading messages…</div>
          )}
          {!isLoading && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: theme === 'midnight' ? '#aaa' : '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{(localGroup || group).icon || subjectMeta.icon}</div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>{(localGroup || group).name}</p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>No messages yet — say hello! 👋</p>
            </div>
          )}
          {grouped.map(item =>
            item.type === 'date' ? (
              <div key={item.key} style={{ textAlign: 'center', margin: '10px 0' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.88)', padding: '3px 14px',
                  borderRadius: 12, fontSize: 11,
                  color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                }}>
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                isMine={item.msg.author_id === user?.id}
                showName={item.showName}
                theme={theme}
                onReply={setReplyTo}
                onImageTap={setLightboxUrl}
                onAction={handleMsgAction}
              />
            )
          )}
          <div ref={endRef} style={{ height: 8 }} />
        </div>

        {/* ── Mentions Dropdown ── */}
        {showMentions && filteredMembers.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 64, left: 10, right: 10,
            background: 'white', borderRadius: 12, border: '1px solid #eee',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', maxOverflowY: 'auto', maxHeight: 200, zIndex: 100
          }}>
            {filteredMembers.map((m, idx) => (
              <button
                key={idx}
                onClick={() => insertMention(m)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #f9f9f9',
                  fontSize: 13, fontWeight: 500, color: '#333'
                }}
              >
                <AtSign style={{ width: 14, height: 14, color: '#1d9bf0' }} />
                <span>{m}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Reply preview ── */}
        {replyTo && (
          <div style={{
            flexShrink: 0, background: 'rgba(255,255,255,0.95)',
            borderTop: '2px solid #25D366', padding: '7px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#25D366' }}>{replyTo.author_name}</span>
              <p style={{ margin: 0, fontSize: 12, color: '#555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 260 }}>
                {replyTo.body}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>×</button>
          </div>
        )}

        {/* ── Recording Indicator ── */}
        {recording && (
          <div style={{
            flexShrink: 0, background: 'rgba(255,255,255,0.97)',
            borderTop: '1px solid rgba(0,0,0,0.08)', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            {/* Cancel */}
            <button
              onClick={() => stopRecording(true)}
              style={{
                width: 36, height: 36, borderRadius: '50%', background: '#f5f5f5',
                border: '1px solid #ddd', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#e53935'
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>

            {/* Animated waveform bars */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
              {[10,16,8,18,12,15,7,14,11,17,9,13,16,8,12].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: h, borderRadius: 2, background: 'red',
                  animation: `recPulse 0.9s ${i * 0.06}s infinite ease-in-out`,
                  opacity: 0.8,
                }} />
              ))}
              <style>{`
                @keyframes recPulse {
                  0%,100% { transform: scaleY(0.5); }
                  50%     { transform: scaleY(1.3); }
                }
              `}</style>
            </div>

            {/* Timer */}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e53935', fontVariantNumeric: 'tabular-nums', minWidth: 40 }}>
              {String(Math.floor(recSeconds / 60)).padStart(2,'0')}:{String(recSeconds % 60).padStart(2,'0')}
            </span>

            {/* Send */}
            <button
              onClick={() => stopRecording(false)}
              style={{
                width: 40, height: 40, borderRadius: '50%', background: NAVY,
                border: 'none', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Send style={{ width: 18, height: 18, color: 'white' }} />
            </button>
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{
          flexShrink: 0,
          background: t.inputBg || '#F0F2F5',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '8px 10px',
          display: 'flex', alignItems: 'flex-end', gap: 8,
          position: 'relative'
        }}>
          {/* Paperclip Button */}
          <button
            onClick={() => setShowPicker(p => !p)}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'white', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <Paperclip style={{ width: 20, height: 20, color: NAVY }} />
          </button>

          {/* Attachment Selector Dropdown */}
          {showPicker && (
            <div
              ref={pickerRef}
              style={{
                position: 'absolute', bottom: 64, left: 10,
                background: 'white', borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
                zIndex: 200, width: 160
              }}
            >
              <button
                onClick={() => { imageInputRef.current?.click(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: 600, color: '#333', textAlign: 'left', borderBottom: '1px solid #f5f5f5'
                }}
              >
                <ImageIcon style={{ width: 16, height: 16, color: NAVY }} />
                <span>Image</span>
              </button>
              <button
                onClick={() => { docInputRef.current?.click(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: 600, color: '#333', textAlign: 'left'
                }}
              >
                <FileText style={{ width: 16, height: 16, color: NAVY }} />
                <span>Document</span>
              </button>
            </div>
          )}

          {/* Hidden inputs for attachments */}
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <input
            type="file"
            ref={docInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            style={{ display: 'none' }}
            onChange={handleDocUpload}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={1}
            style={{
              flex: 1, borderRadius: 24, border: '1px solid rgba(0,0,0,0.1)',
              padding: '9px 14px', fontSize: 14, resize: 'none',
              background: 'white', outline: 'none', lineHeight: 1.4,
              maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          />

          {/* Send / Voice Note Mic Button */}
          {text.trim() ? (
            <button
              onClick={() => handleSend()}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#25D366',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s, transform 0.1s',
                transform: 'scale(1)',
                boxShadow: '0 2px 8px rgba(37,211,102,0.4)',
              }}
            >
              <Send style={{ color: 'white', width: 18, height: 18, marginLeft: 2 }} />
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: recording ? 'red' : NAVY,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s, transform 0.1s',
                transform: recording ? 'scale(1.15)' : 'scale(1)',
                boxShadow: recording ? '0 2px 12px rgba(255,0,0,0.5)' : '0 2px 8px rgba(13,27,75,0.3)',
              }}
            >
              {recording ? (
                <MicOff style={{ color: 'white', width: 18, height: 18 }} />
              ) : (
                <Mic style={{ color: 'white', width: 18, height: 18 }} />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
