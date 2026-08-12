/**
 * GlobalVideoPlayer.jsx
 * Mounted ONCE at the app root (inside AppLayout). Renders the single active lesson's
 * VideoPlayer and portals it into whichever slot is currently valid:
 *   - the inline dock on LessonPage, when that lesson's page is mounted, or
 *   - a small floating "mini-player" widget in the corner, everywhere else.
 * The iframe/video DOM node is never destroyed during this swap, so playback
 * continues uninterrupted as the student navigates the rest of the site.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Maximize2 } from 'lucide-react';
import { useMiniPlayer } from '@/contexts/MiniPlayerContext';
import VideoPlayer from './VideoPlayer';

export default function GlobalVideoPlayer() {
  const { activeLesson, dockNode, dockLessonId, closePlayer } = useMiniPlayer();
  const navigate = useNavigate();

  if (!activeLesson) return null;

  const showInline = !!dockNode && dockLessonId === activeLesson.id;
  const playerEl = <VideoPlayer lesson={activeLesson} />;

  if (showInline) {
    return createPortal(playerEl, dockNode);
  }

  const goToLesson = () => navigate(`/lesson/${activeLesson.id}`);

  return (
    <div
      className="fixed z-40 bottom-20 left-3 lg:bottom-6 lg:left-6 w-[200px] sm:w-[240px] lg:w-[280px] rounded-xl overflow-hidden shadow-2xl border border-border bg-card"
      style={{ animation: 'miniPlayerIn 0.25s ease-out' }}
    >
      <style>{`
        @keyframes miniPlayerIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header bar — title + expand + close (always visible, no hover dependency) */}
      <div className="flex items-center gap-1 pl-2.5 pr-1 py-1.5 bg-card border-b border-border">
        <button
          onClick={goToLesson}
          className="flex-1 min-w-0 text-left"
          aria-label="Expand to full lesson"
        >
          <p className="text-[11px] font-semibold text-foreground truncate">{activeLesson.title}</p>
        </button>
        <button
          onClick={goToLesson}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Expand"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={closePlayer}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Close player"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Video */}
      <div className="aspect-video bg-black">
        {playerEl}
      </div>
    </div>
  );
}
