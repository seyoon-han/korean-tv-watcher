import React, { useState, useEffect } from 'react';
import { X, Play, Download, Star, Bookmark as BookmarkIcon, Globe, Layers, Film, CheckCircle2, Clock } from 'lucide-react';
import { Drama, Episode, WatchHistory, BookmarkStatus } from '../types/tv';
import { apiService } from '../services/api';

interface DramaDetailModalProps {
  dramaId: number;
  onClose: () => void;
  onPlayEpisode: (drama: Drama, episode: Episode) => void;
  onDownloadEpisode: (drama: Drama, episode: Episode) => void;
  isBookmarked?: boolean;
  onToggleBookmark: (drama: Drama, status: BookmarkStatus) => void;
  getEpisodeProgress: (dramaId: number, episodeId: number) => WatchHistory | undefined;
}

export const DramaDetailModal: React.FC<DramaDetailModalProps> = ({
  dramaId,
  onClose,
  onPlayEpisode,
  onDownloadEpisode,
  isBookmarked,
  onToggleBookmark,
  getEpisodeProgress,
}) => {
  const [drama, setDrama] = useState<Drama | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookmarkStatus, setBookmarkStatus] = useState<BookmarkStatus>('watching');

  useEffect(() => {
    async function loadDetail() {
      setIsLoading(true);
      const detail = await apiService.getDramaDetail(dramaId);
      setDrama(detail);
      setIsLoading(false);
    }
    loadDetail();
  }, [dramaId]);

  if (!dramaId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading drama details...</p>
          </div>
        ) : drama ? (
          <div className="overflow-y-auto flex-1 divide-y divide-white/10">
            
            {/* Header / Hero Section */}
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900">
              
              {/* Poster */}
              <img
                src={drama.thumbnail}
                alt={drama.title}
                className="w-40 sm:w-48 aspect-[2/3] object-cover rounded-2xl border border-white/15 shadow-2xl self-center sm:self-start bg-slate-800"
              />

              {/* Info Details */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                    {drama.koreanTitle ? (
                      <>
                        <span className="text-white">{drama.koreanTitle}</span>
                        <span className="block sm:inline text-lg font-medium text-slate-400 sm:ml-2 font-normal">({drama.title})</span>
                      </>
                    ) : (
                      drama.title
                    )}
                  </h2>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-semibold">
                    {drama.score && (
                      <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {drama.score}
                      </span>
                    )}
                    {drama.status && (
                      <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg">
                        {drama.status}
                      </span>
                    )}
                    {drama.country && (
                      <span className="px-2.5 py-1 bg-white/10 border border-white/10 text-slate-300 rounded-lg flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        {drama.country}
                      </span>
                    )}
                    {drama.episodesCount && (
                      <span className="px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {drama.episodesCount} Episodes
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {drama.description && (
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 line-clamp-4">
                      {drama.description}
                    </p>
                  )}
                </div>

                {/* Bookmark Action */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleBookmark(drama, bookmarkStatus)}
                    className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                      isBookmarked
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10'
                    }`}
                  >
                    <BookmarkIcon className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
                    {isBookmarked ? 'Bookmarked' : 'Add to Library'}
                  </button>

                  <select
                    value={bookmarkStatus}
                    onChange={(e) => setBookmarkStatus(e.target.value as BookmarkStatus)}
                    className="bg-slate-800 border border-white/10 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
                  >
                    <option value="watching">Watching</option>
                    <option value="plan_to_watch">Plan to Watch</option>
                    <option value="completed">Completed</option>
                    <option value="favorite">Favorite</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Episode Grid Section */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-indigo-400" />
                  Episodes ({drama.episodes?.length || 0})
                </h3>
              </div>

              {drama.episodes && drama.episodes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
                  {drama.episodes.map((ep) => {
                    const progress = getEpisodeProgress(drama.id, ep.id);
                    const isCompleted = progress?.completed;

                    return (
                      <div
                        key={ep.id}
                        className="group relative p-3 rounded-xl bg-slate-800/60 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-white flex items-center gap-1.5">
                            Ep {ep.number}
                            {isCompleted && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </span>

                          <div className="flex items-center gap-1">
                            {/* Download Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadEpisode(drama, ep);
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors"
                              title="Download Episode"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            
                            {/* Play Button */}
                            <button
                              onClick={() => onPlayEpisode(drama, ep)}
                              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                              title="Play Episode"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                            </button>
                          </div>
                        </div>

                        {progress && !isCompleted && (
                          <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-indigo-500 h-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((progress.progressSeconds / progress.totalDurationSeconds) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-slate-400">No episodes available</div>
              )}
            </div>

          </div>
        ) : null}

      </div>
    </div>
  );
};
