import React from 'react';
import { Star, Play, Bookmark as BookmarkIcon, CheckCircle2 } from 'lucide-react';
import { Drama, WatchHistory } from '../types/tv';

interface DramaCardProps {
  drama: Drama;
  onClick: (drama: Drama) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (drama: Drama, e: React.MouseEvent) => void;
  history?: WatchHistory;
}

export const DramaCard: React.FC<DramaCardProps> = ({
  drama,
  onClick,
  isBookmarked,
  onToggleBookmark,
  history,
}) => {
  const watchPercent = history && history.totalDurationSeconds > 0
    ? Math.min(100, Math.round((history.progressSeconds / history.totalDurationSeconds) * 100))
    : 0;

  return (
    <div
      onClick={() => onClick(drama)}
      className="group relative flex flex-col cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5"
    >
      {/* Poster Wrapper */}
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-slate-800 border border-white/10 shadow-lg shadow-black/40 group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20 transition-all">
        
        <img
          src={drama.thumbnail}
          alt={drama.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

        {/* Hover Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 backdrop-blur-md transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Rating Badge */}
        {drama.score && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400" />
            {drama.score}
          </div>
        )}

        {/* Bookmark Button */}
        {onToggleBookmark && (
          <button
            onClick={(e) => onToggleBookmark(drama, e)}
            className={`absolute top-2.5 right-2.5 p-2 rounded-xl backdrop-blur-md transition-all ${
              isBookmarked
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                : 'bg-black/60 text-slate-300 hover:text-white hover:bg-black/80 border border-white/10'
            }`}
            title={isBookmarked ? 'Bookmarked' : 'Add to Bookmarks'}
          >
            <BookmarkIcon className="w-3.5 h-3.5" fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Episode count tag */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-300">
          {drama.episodesCount ? (
            <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md border border-white/10">
              Ep {drama.episodesCount}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/30 text-indigo-300 backdrop-blur-md">
              Ongoing
            </span>
          )}
          {history && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 backdrop-blur-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Ep {history.episodeNumber}
            </span>
          )}
        </div>

        {/* Watch Progress Bar */}
        {watchPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-300"
              style={{ width: `${watchPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mt-2.5 text-sm font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1" title={drama.koreanTitle ? `${drama.koreanTitle} (${drama.title})` : drama.title}>
        {drama.koreanTitle ? (
          <>
            <span className="text-slate-100 font-bold">{drama.koreanTitle}</span>
            <span className="text-xs text-slate-400 font-normal ml-1.5">({drama.title})</span>
          </>
        ) : (
          drama.title
        )}
      </h3>
    </div>
  );
};
