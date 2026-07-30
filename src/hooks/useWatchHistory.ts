import { useState, useEffect } from 'react';
import { WatchHistory } from '../types/tv';

const STORAGE_KEY = 'tv_watcher_history';

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load from Electron persistent file store on mount (persists across reinstall)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.loadPersistentData) {
      (window as any).electronAPI.loadPersistentData().then((store: any) => {
        if (store && Array.isArray(store.history) && store.history.length > 0) {
          setHistory((prev) => {
            // Merge persistent store history with local state
            const map = new Map<string, WatchHistory>();
            [...prev, ...store.history].forEach((item) => {
              const key = `${item.dramaId}_${item.episodeId}`;
              const existing = map.get(key);
              if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
                map.set(key, item);
              }
            });
            return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 100);
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      if (typeof window !== 'undefined' && (window as any).electronAPI?.savePersistentData) {
        (window as any).electronAPI.loadPersistentData().then((store: any) => {
          const currentBookmarks = store?.bookmarks || [];
          (window as any).electronAPI.savePersistentData({
            history,
            bookmarks: currentBookmarks
          });
        });
      }
    } catch (e) {
      console.error('Failed to save watch history:', e);
    }
  }, [history]);

  const updateProgress = (
    item: Omit<WatchHistory, 'updatedAt' | 'completed'> & { completed?: boolean }
  ) => {
    setHistory((prev) => {
      const isCompleted = item.completed || (item.totalDurationSeconds > 0 && item.progressSeconds / item.totalDurationSeconds >= 0.9);
      const updatedItem: WatchHistory = {
        ...item,
        completed: isCompleted,
        updatedAt: Date.now(),
      };

      const filtered = prev.filter(
        (h) => !(h.dramaId === item.dramaId && h.episodeId === item.episodeId)
      );
      return [updatedItem, ...filtered].slice(0, 100);
    });
  };

  const getEpisodeProgress = (dramaId: number, episodeId: number) => {
    return history.find((h) => h.dramaId === dramaId && h.episodeId === episodeId);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const removeHistoryItem = (dramaId: number, episodeId: number) => {
    setHistory((prev) => prev.filter((h) => !(h.dramaId === dramaId && h.episodeId === episodeId)));
  };

  return {
    history,
    updateProgress,
    getEpisodeProgress,
    clearHistory,
    removeHistoryItem,
  };
}
