import React, { useState, useEffect } from 'react';
import { Play, Info, Star, Tv, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Drama } from '../types/tv';

interface HeroBannerProps {
  items: Drama[];
  onSelectDrama: (drama: Drama) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items, onSelectDrama }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex];

  return (
    <div className="relative w-full h-[440px] sm:h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 my-6 group">
      
      {/* Background Poster Blur & Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 group-hover:scale-100 filter brightness-90"
        style={{ backgroundImage: `url(${current.thumbnail})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-full max-w-4xl p-6 sm:p-12 flex flex-col justify-end">
        
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-xs font-semibold rounded-full flex items-center gap-1.5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            FEATURED RELEASE
          </span>
          {current.score && (
            <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-full flex items-center gap-1 backdrop-blur-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {current.score}
            </span>
          )}
          {current.status && (
            <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-full backdrop-blur-md">
              {current.status}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none mb-3 drop-shadow-md">
          {current.title}
        </h1>

        {/* Description snippet */}
        {current.description && (
          <p className="text-slate-300 text-sm sm:text-base line-clamp-2 max-w-2xl mb-6 font-normal leading-relaxed">
            {current.description}
          </p>
        )}

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectDrama(current)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transform active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-white" />
            Watch Now
          </button>
          <button
            onClick={() => onSelectDrama(current)}
            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl border border-white/15 backdrop-blur-md flex items-center gap-2 transition-all"
          >
            <Info className="w-4 h-4" />
            Details
          </button>
        </div>
      </div>

      {/* Carousel Navigation Arrows */}
      {items.length > 1 && (
        <div className="absolute right-6 bottom-6 z-20 flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 border border-white/20 text-white backdrop-blur-md transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            {items.slice(0, 8).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-6 bg-indigo-500' : 'w-1.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
            className="p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 border border-white/20 text-white backdrop-blur-md transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
