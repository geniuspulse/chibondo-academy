/**
 * MiniPlayerContext.jsx
 *
 * Keeps a lesson video "alive" across navigation. Native browser Picture-in-Picture
 * doesn't work for YouTube/Bunny embeds (they're cross-origin iframes, not a plain
 * <video> element the PiP API can grab). So instead we do what Udemy/YouTube's own
 * web app do: mount ONE video player at the app root and use a React portal to move
 * it between (a) the inline slot on the lesson page and (b) a floating corner widget
 * everywhere else. The iframe DOM node never unmounts, so playback never resets.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const MiniPlayerContext = createContext(null);

export function MiniPlayerProvider({ children }) {
  const [activeLesson, setActiveLesson] = useState(null); // full lesson record (id, title, subject_id, video_url, video_provider, ...)
  const [dockNode, setDockNode] = useState(null);          // DOM node of the inline slot on the currently-mounted LessonPage
  const [dockLessonId, setDockLessonId] = useState(null);  // which lesson that dock belongs to

  const playLesson = useCallback((lesson) => {
    if (!lesson?.video_url) return;
    setActiveLesson(prev => (prev?.id === lesson.id ? prev : lesson));
  }, []);

  // Called by LessonPage on mount (node, lessonId) and on unmount (null, lessonId)
  const registerDock = useCallback((node, forLessonId) => {
    setDockNode(node);
    setDockLessonId(node ? forLessonId : null);
  }, []);

  const closePlayer = useCallback(() => {
    setActiveLesson(null);
    setDockNode(null);
    setDockLessonId(null);
  }, []);

  const value = {
    activeLesson,
    dockNode,
    dockLessonId,
    playLesson,
    registerDock,
    closePlayer,
  };

  return (
    <MiniPlayerContext.Provider value={value}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error('useMiniPlayer must be used within MiniPlayerProvider');
  return ctx;
}
