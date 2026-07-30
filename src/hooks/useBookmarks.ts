import { useState, useEffect } from 'react';
import { Bookmark, BookmarkStatus, Drama } from '../types/tv';

const STORAGE_KEY = 'tv_watcher_bookmarks';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.error('Failed to save bookmarks:', e);
    }
  }, [bookmarks]);

  const toggleBookmark = (drama: Drama, status: BookmarkStatus = 'watching') => {
    setBookmarks((prev) => {
      const existing = prev.find((b) => b.dramaId === drama.id);
      if (existing) {
        if (existing.status === status) {
          // Remove if toggled same status
          return prev.filter((b) => b.dramaId !== drama.id);
        } else {
          // Update status
          return prev.map((b) => (b.dramaId === drama.id ? { ...b, status } : b));
        }
      }
      return [
        {
          dramaId: drama.id,
          dramaTitle: drama.title,
          dramaPoster: drama.thumbnail,
          status,
          addedAt: Date.now(),
        },
        ...prev,
      ];
    });
  };

  const isBookmarked = (dramaId: number): Bookmark | undefined => {
    return bookmarks.find((b) => b.dramaId === dramaId);
  };

  const removeBookmark = (dramaId: number) => {
    setBookmarks((prev) => prev.filter((b) => b.dramaId !== dramaId));
  };

  return {
    bookmarks,
    toggleBookmark,
    isBookmarked,
    removeBookmark,
  };
}
