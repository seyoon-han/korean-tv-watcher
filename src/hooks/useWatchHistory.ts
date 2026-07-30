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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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
