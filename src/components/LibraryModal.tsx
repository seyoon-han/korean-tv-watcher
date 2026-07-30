import React, { useState } from 'react';
import { X, Bookmark as BookmarkIcon, History, Trash2, Download, Upload, Play, CheckCircle2 } from 'lucide-react';
import { Bookmark, WatchHistory, Drama, Episode } from '../types/tv';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  history: WatchHistory[];
  onRemoveBookmark: (dramaId: number) => void;
  onRemoveHistoryItem: (dramaId: number, episodeId: number) => void;
  onClearHistory: () => void;
  onSelectDrama: (dramaId: number) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  bookmarks,
  history,
  onRemoveBookmark,
  onRemoveHistoryItem,
  onClearHistory,
  onSelectDrama,
}) => {
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history'>('bookmarks');

  if (!isOpen) return null;

  const exportData = () => {
    const data = {
      bookmarks,
      history,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tv-watcher-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <BookmarkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">My Library</h2>
              <p className="text-xs text-slate-400">Bookmarks & Watch History</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportData}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-all"
              title="Backup Library to JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 p-4 border-b border-white/10 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'bookmarks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            Bookmarks ({bookmarks.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Watch History ({history.length})
          </button>

          {activeTab === 'history' && history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="ml-auto text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bookmarks' ? (
            bookmarks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.dramaId}
                    onClick={() => {
                      onSelectDrama(bm.dramaId);
                      onClose();
                    }}
                    className="group relative flex flex-col cursor-pointer bg-slate-800/60 rounded-2xl overflow-hidden border border-white/10 p-2 hover:border-indigo-500/50 transition-all"
                  >
                    <img
                      src={bm.dramaPoster}
                      alt={bm.dramaTitle}
                      className="w-full aspect-[2/3] object-cover rounded-xl bg-slate-800"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white truncate flex-1">{bm.dramaTitle}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(bm.dramaId);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-slate-400">No bookmarked dramas yet.</div>
            )
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((h) => (
                <div
                  key={`${h.dramaId}-${h.episodeId}`}
                  onClick={() => {
                    onSelectDrama(h.dramaId);
                    onClose();
                  }}
                  className="p-3 bg-slate-800/60 hover:bg-indigo-600/10 rounded-2xl border border-white/10 hover:border-indigo-500/30 cursor-pointer transition-all flex items-center gap-4"
                >
                  <img
                    src={h.dramaPoster}
                    alt={h.dramaTitle}
                    className="w-12 h-16 object-cover rounded-xl bg-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{h.dramaTitle}</h4>
                    <p className="text-xs text-indigo-400 font-semibold mt-0.5">Episode {h.episodeNumber}</p>
                    <div className="w-full max-w-xs bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-indigo-500 h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((h.progressSeconds / (h.totalDurationSeconds || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistoryItem(h.dramaId, h.episodeId);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-slate-400">No watch history yet.</div>
          )}
        </div>

      </div>
    </div>
  );
};
