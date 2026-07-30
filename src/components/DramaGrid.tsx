import React from 'react';
import { DramaCard } from './DramaCard';
import { Drama, WatchHistory, Bookmark } from '../types/tv';

interface DramaGridProps {
  title: string;
  icon?: React.ReactNode;
  dramas: Drama[];
  isLoading?: boolean;
  onSelectDrama: (drama: Drama) => void;
  bookmarks?: Bookmark[];
  onToggleBookmark?: (drama: Drama, e: React.MouseEvent) => void;
  getHistoryForDrama?: (dramaId: number) => WatchHistory | undefined;
}

export const DramaGrid: React.FC<DramaGridProps> = ({
  title,
  icon,
  dramas,
  isLoading,
  onSelectDrama,
  bookmarks = [],
  onToggleBookmark,
  getHistoryForDrama,
}) => {
  return (
    <section className="my-8">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 mb-5">
        {icon}
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/15 to-transparent ml-2" />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="aspect-[2/3] w-full rounded-2xl bg-slate-800/60 border border-white/5" />
              <div className="h-4 w-3/4 bg-slate-800/60 rounded-md" />
            </div>
          ))}
        </div>
      ) : dramas.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {dramas.map((drama) => {
            const isBm = bookmarks.some((b) => b.dramaId === drama.id);
            const hist = getHistoryForDrama ? getHistoryForDrama(drama.id) : undefined;
            return (
              <DramaCard
                key={drama.id}
                drama={drama}
                onClick={onSelectDrama}
                isBookmarked={isBm}
                onToggleBookmark={onToggleBookmark}
                history={hist}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-white/5 text-slate-400 text-sm">
          No dramas found in this section.
        </div>
      )}
    </section>
  );
};
