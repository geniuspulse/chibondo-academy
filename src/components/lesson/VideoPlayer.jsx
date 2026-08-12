/**
 * VideoPlayer.jsx
 * Shared video player — renders YouTube / Bunny / Vimeo / Loom / direct-file / generic
 * iframe embeds for a lesson. Extracted from LessonPage so the SAME player instance
 * (and its underlying iframe DOM node) can be reused by both the inline lesson page
 * and the floating global mini-player, without ever remounting (which would restart
 * playback).
 */
import React, { useState, useEffect } from 'react';

// ─── VIDEO UTILS ──
export function getYouTubeId(url) {
  if (!url) return null;
  for (const p of [/youtu\.be\/([^?#&]+)/, /youtube\.com\/watch\?v=([^?#&]+)/, /youtube\.com\/embed\/([^?#&]+)/, /youtube\.com\/v\/([^?#&]+)/, /youtube\.com\/shorts\/([^?#&]+)/]) {
    const m = url.match(p); if (m) return m[1];
  }
  return null;
}

export const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share; screen-wake-lock";

// ─── BUNNY PLAYER ──
function BunnyPlayer({ videoUrl, lesson }) {
  const [status, setStatus] = useState(null);
  const match = videoUrl?.match(/iframe\.mediadelivery\.net\/embed\/([^/]+)\/([^?#]+)/);
  const libraryId = match?.[1];
  const videoId = match?.[2] || lesson?.bunny_video_id;
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('bunny_api_key') : null;
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!libraryId || !videoId || !apiKey) { setStatus('ready'); return; }
    let cancelled = false, timer = null;
    async function check() {
      try {
        const r = await fetch(`/api/bunny?action=status&${new URLSearchParams({ libraryId, videoId, apiKey })}`);
        if (!r.ok) { setStatus('ready'); return; }
        const data = await r.json();
        if (cancelled) return;
        const st = data.status;
        setStatus(st);
        if ((st === 'encoding' || st === 'processing' || st === 'queued') && pollCount < 30) {
          setPollCount(c => c + 1);
          timer = setTimeout(check, 8000);
        }
      } catch { setStatus('ready'); }
    }
    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [libraryId, videoId, apiKey, pollCount]);

  if (status === null || status === 'encoding' || status === 'processing' || status === 'queued') {
    return (
      <div className="aspect-video bg-black w-full flex items-center justify-center">
        <div className="text-center text-white/70 space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-sm font-medium">{status === null ? 'Loading video…' : 'Processing video…'}</p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="aspect-video bg-black w-full flex items-center justify-center">
        <p className="text-sm text-red-400">Video encoding failed. Please contact your teacher.</p>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black w-full">
      <iframe src={videoUrl} className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" title={lesson?.title || 'Video'} />
    </div>
  );
}

// ─── VIDEO PLAYER ──
export default function VideoPlayer({ lesson }) {
  const [videoError, setVideoError] = useState(false);
  const { video_url, video_provider } = lesson;
  if (!video_url) return null;

  const ytId = getYouTubeId(video_url);
  if (ytId) {
    const params = 'rel=0&modestbranding=1&iv_load_policy=3&fs=1&playsinline=1&controls=1&origin=' + encodeURIComponent(window.location.origin);
    return (
      <div className="aspect-video bg-black w-full select-none" onContextMenu={e => e.preventDefault()}>
        <iframe src={`https://www.youtube-nocookie.com/embed/${ytId}?${params}`}
          className="w-full h-full pointer-events-auto" allow={EMBED_ALLOW} allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" title={lesson.title} loading="lazy" />
      </div>
    );
  }

  if (video_provider === 'bunny' || video_url?.includes('iframe.mediadelivery.net') || video_url?.includes('b-cdn.net'))
    return <BunnyPlayer videoUrl={video_url} lesson={lesson} />;

  if (video_url?.includes('vimeo.com')) {
    const vimeoId = video_url.match(/vimeo\.com\/(\d+)/)?.[1];
    return (
      <div className="aspect-video bg-black w-full">
        <iframe src={vimeoId ? `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0` : video_url}
          className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" title={lesson.title} />
      </div>
    );
  }

  if (video_url?.includes('loom.com')) {
    return (
      <div className="aspect-video bg-black w-full">
        <iframe src={video_url.replace('loom.com/share/', 'loom.com/embed/')}
          className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen title={lesson.title} />
      </div>
    );
  }

  const isDirect = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp|flv)(\?|$)/i.test(video_url);
  if (video_provider === 'upload' || isDirect) {
    return (
      <div className="aspect-video bg-black w-full">
        <video src={video_url} controls className="w-full h-full" playsInline preload="metadata"
          onError={() => setVideoError(true)}>
          <source src={video_url} type="video/mp4" />
          <source src={video_url} type="video/webm" />
        </video>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black w-full">
      <iframe src={video_url} className="w-full h-full" allow={EMBED_ALLOW} allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin" title={lesson.title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation" />
    </div>
  );
}
