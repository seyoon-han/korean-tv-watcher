import React, { useState, useEffect, useRef } from 'react';
import { Search, Tv, Bookmark, Download, History, X, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Drama } from '../types/tv';
import { apiService } from '../services/api';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectDrama: (drama: Drama) => void;
  onOpenLibrary: () => void;
  onOpenDownloads: () => void;
  activeDownloadsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onSelectDrama,
  onOpenLibrary,
  onOpenDownloads,
  activeDownloadsCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Drama[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const results = await apiService.searchDramas(searchQuery);
        setSuggestions(results.slice(0, 6));
        setIsSearching(false);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = [
    { id: 'all', label: 'Home' },
    { id: 'kdrama', label: 'K-Drama' },
    { id: 'cdrama', label: 'C-Drama' },
    { id: 'anime', label: 'Anime' },
    { id: 'movies', label: 'Movies' },
    { id: 'history', label: 'History' },
    { id: 'aisub', label: 'AI Subtitles' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0b0c10]/80 border-b border-white/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onTabChange('all')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                TV-Watcher
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md">
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Category Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onTabChange(cat.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === cat.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-3">
          
          {/* Search Box */}
          <div ref={searchRef} className="relative w-48 sm:w-64 md:w-80">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search dramas, anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900/80 text-sm text-white placeholder-slate-400 rounded-xl border border-white/10 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Searching titles...
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                    {suggestions.map((drama) => (
                      <div
                        key={drama.id}
                        onClick={() => {
                          onSelectDrama(drama);
                          setShowSuggestions(false);
                        }}
                        className="p-3 flex items-center gap-3 hover:bg-indigo-600/20 cursor-pointer transition-colors"
                      >
                        <img
                          src={drama.thumbnail}
                          alt={drama.title}
                          className="w-10 h-14 object-cover rounded-lg bg-slate-800"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {drama.koreanTitle ? `${drama.koreanTitle} (${drama.title})` : drama.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{drama.episodesCount ? `${drama.episodesCount} Ep` : 'Ongoing'}</span>
                            {drama.score ? (
                              <span className="text-amber-400 font-medium">★ {drama.score}</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-slate-400">No titles found</div>
                )}
              </div>
            )}
          </div>

          {/* Library Button */}
          <button
            onClick={onOpenLibrary}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
            title="My Library"
          >
            <Bookmark className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline text-xs font-semibold">Library</span>
          </button>

          {/* Downloads Manager Button */}
          <button
            onClick={onOpenDownloads}
            className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
            title="Downloads"
          >
            <Download className="w-4 h-4 text-purple-400" />
            {activeDownloadsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-lg animate-pulse">
                {activeDownloadsCount}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
