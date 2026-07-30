import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { DramaGrid } from './components/DramaGrid';
import { DramaDetailModal } from './components/DramaDetailModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { DownloadManagerDrawer } from './components/DownloadManagerDrawer';
import { LibraryModal } from './components/LibraryModal';
import { Drama, Episode, BookmarkStatus } from './types/tv';
import { apiService } from './services/api';
import { useBookmarks } from './hooks/useBookmarks';
import { useWatchHistory } from './hooks/useWatchHistory';
import { AutoUpdateModal } from './components/AutoUpdateModal';
import { Sparkles, TrendingUp, RefreshCw, Star, Flame, Tv } from 'lucide-react';

interface DownloadItem {
  episodeId: number;
  episodeNumber: number;
  dramaId: number;
  dramaTitle: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
  filePath?: string;
  error?: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState('all');

  // Auto Update State
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    downloadUrl: string;
    assetName: string;
  } | null>(null);

  // Data states
  const [featured, setFeatured] = useState<Drama[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Drama[]>([]);
  const [trending, setTrending] = useState<Drama[]>([]);
  const [topRated, setTopRated] = useState<Drama[]>([]);
  const [categoryDramas, setCategoryDramas] = useState<Drama[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Active selections
  const [selectedDramaId, setSelectedDramaId] = useState<number | null>(null);
  const [activePlayerState, setActivePlayerState] = useState<{
    drama: Drama;
    episode: Episode;
  } | null>(null);

  // Drawers
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  // Hooks
  const { bookmarks, toggleBookmark, isBookmarked, removeBookmark } = useBookmarks();
  const { history, updateProgress, getEpisodeProgress, clearHistory, removeHistoryItem } = useWatchHistory();

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  // 1. Initial Data Fetching & GitHub Auto-Update Check
  useEffect(() => {
    async function loadAllData() {
      setIsLoading(true);
      const [featRes, recRes, trendRes, topRes] = await Promise.all([
        apiService.getFeatured(),
        apiService.getRecentUpdates(),
        apiService.getTrending(),
        apiService.getTopRated(),
      ]);

      setFeatured(featRes);
      setRecentUpdates(recRes);
      setTrending(trendRes);
      setTopRated(topRes);
      setIsLoading(false);
    }
    loadAllData();

    // Check for GitHub Release updates on startup
    if (window.electronAPI?.checkForUpdates) {
      window.electronAPI.checkForUpdates().then((res) => {
        if (res && res.hasUpdate && res.downloadUrl) {
          setUpdateInfo(res);
        }
      });
    }
  }, []);

  // Fetch category specific dramas when activeTab changes
  useEffect(() => {
    if (activeTab === 'all') {
      setCategoryDramas([]);
      return;
    }
    async function loadCategory() {
      setIsCategoryLoading(true);
      const results = await apiService.getDramasByCategory(activeTab);
      setCategoryDramas(results);
      setIsCategoryLoading(false);
    }
    loadCategory();
  }, [activeTab]);

  // 2. Electron IPC Listener Setup for Downloader
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onDownloadProgress(({ episodeId, progress }) => {
        setDownloads((prev) =>
          prev.map((item) =>
            item.episodeId === episodeId
              ? { ...item, progress, status: 'downloading' }
              : item
          )
        );
      });

      window.electronAPI.onDownloadCompleted(({ episodeId, filePath }) => {
        setDownloads((prev) =>
          prev.map((item) =>
            item.episodeId === episodeId
              ? { ...item, progress: 100, status: 'completed', filePath }
              : item
          )
        );
      });

      window.electronAPI.onDownloadFailed(({ episodeId, error }) => {
        setDownloads((prev) =>
          prev.map((item) =>
            item.episodeId === episodeId
              ? { ...item, status: 'failed', error }
              : item
          )
        );
      });
    }
  }, []);

  // 3. Download Trigger
  const handleDownloadEpisode = async (drama: Drama, episode: Episode) => {
    // Fetch stream first
    const source = await apiService.getEpisodeStream(episode.id);
    if (!source || !source.url) {
      alert('Failed to obtain download URL for this episode.');
      return;
    }

    const newItem: DownloadItem = {
      episodeId: episode.id,
      episodeNumber: episode.number,
      dramaId: drama.id,
      dramaTitle: drama.title,
      progress: 0,
      status: 'downloading',
    };

    setDownloads((prev) => [newItem, ...prev.filter((d) => d.episodeId !== episode.id)]);
    setIsDownloadsOpen(true);

    if (window.electronAPI) {
      window.electronAPI.downloadEpisode({
        episodeId: episode.id,
        episodeNumber: episode.number,
        dramaId: drama.id,
        dramaTitle: drama.title,
        streamUrl: source.url,
      });
    }
  };

  // Filtered Dramas based on Category Tab
  const filterByTab = (list: Drama[]) => {
    if (activeTab === 'all') return list;
    if (categoryDramas.length > 0) return categoryDramas;
    
    if (activeTab === 'kdrama') return list.filter((d) => !d.country || d.country.toLowerCase().includes('korea') || d.title.toLowerCase().includes('korea'));
    if (activeTab === 'cdrama') return list.filter((d) => !d.country || d.country.toLowerCase().includes('china') || d.title.toLowerCase().includes('china'));
    if (activeTab === 'anime') return list.filter((d) => !d.type || d.type.toLowerCase().includes('anime') || d.title.toLowerCase().includes('anime'));
    if (activeTab === 'movies') return list.filter((d) => !d.type || d.type.toLowerCase().includes('movie'));
    return list;
  };

  // Next Episode Handler
  const handleSelectNextEpisode = (currentDrama: Drama, currentEp: Episode) => {
    if (!currentDrama.episodes) return;
    const nextEp = currentDrama.episodes.find((e) => e.number === currentEp.number + 1);
    if (nextEp) {
      setActivePlayerState({ drama: currentDrama, episode: nextEp });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 flex flex-col font-[#Plus_Jakarta_Sans]">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        activeDownloadsCount={downloads.filter((d) => d.status === 'downloading').length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        
        {/* Featured Hero Banner */}
        {activeTab === 'all' && (
          <HeroBanner
            items={featured}
            onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
          />
        )}

        {/* Continue Watching Row (if history exists) */}
        {history.length > 0 && activeTab === 'all' && (
          <section className="my-8">
            <div className="flex items-center gap-2 mb-4">
              <Tv className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Continue Watching</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {history.slice(0, 5).map((item) => (
                <div
                  key={`${item.dramaId}-${item.episodeId}`}
                  onClick={() => setSelectedDramaId(item.dramaId)}
                  className="group relative bg-slate-900/60 rounded-2xl overflow-hidden border border-white/10 p-2.5 cursor-pointer hover:border-indigo-500/50 transition-all"
                >
                  <img
                    src={item.dramaPoster}
                    alt={item.dramaTitle}
                    className="w-full aspect-[16/9] object-cover rounded-xl bg-slate-800"
                  />
                  <div className="mt-2">
                    <h4 className="text-xs font-bold text-white truncate">{item.dramaTitle}</h4>
                    <p className="text-[11px] text-indigo-400 font-semibold">Ep {item.episodeNumber}</p>
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-indigo-500 h-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((item.progressSeconds / (item.totalDurationSeconds || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category Tab View */}
        {activeTab !== 'all' ? (
          <div className="mt-6">
            <DramaGrid
              title={
                activeTab === 'kdrama'
                  ? '🇰🇷 한국 드라마 (K-Dramas)'
                  : activeTab === 'cdrama'
                  ? '🇨🇳 중국 드라마 (C-Dramas)'
                  : activeTab === 'anime'
                  ? '🎎 애니메이션 (Anime)'
                  : '🎬 영화 (Movies)'
              }
              icon={<Sparkles className="w-5 h-5 text-indigo-400" />}
              dramas={categoryDramas}
              isLoading={isCategoryLoading}
              onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
              bookmarks={bookmarks}
              onToggleBookmark={(drama, e) => {
                e.stopPropagation();
                toggleBookmark(drama);
              }}
              getHistoryForDrama={(id) => history.find((h) => h.dramaId === id)}
            />
          </div>
        ) : (
          <>
            {/* Recent Updates Grid */}
            <DramaGrid
              title="Recent Episode Updates"
              icon={<RefreshCw className="w-5 h-5 text-purple-400" />}
              dramas={recentUpdates}
              isLoading={isLoading}
              onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
              bookmarks={bookmarks}
              onToggleBookmark={(drama, e) => {
                e.stopPropagation();
                toggleBookmark(drama);
              }}
              getHistoryForDrama={(id) => history.find((h) => h.dramaId === id)}
            />

            {/* Trending Grid */}
            <DramaGrid
              title="Trending & Popular"
              icon={<Flame className="w-5 h-5 text-rose-400" />}
              dramas={trending}
              isLoading={isLoading}
              onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
              bookmarks={bookmarks}
              onToggleBookmark={(drama, e) => {
                e.stopPropagation();
                toggleBookmark(drama);
              }}
              getHistoryForDrama={(id) => history.find((h) => h.dramaId === id)}
            />

            {/* Top Rated Grid */}
            <DramaGrid
              title="Top Rated All-Time"
              icon={<Star className="w-5 h-5 text-amber-400" />}
              dramas={topRated}
              isLoading={isLoading}
              onSelectDrama={(drama) => setSelectedDramaId(drama.id)}
              bookmarks={bookmarks}
              onToggleBookmark={(drama, e) => {
                e.stopPropagation();
                toggleBookmark(drama);
              }}
              getHistoryForDrama={(id) => history.find((h) => h.dramaId === id)}
            />
          </>
        )}

      </main>

      {/* Drama Detail Modal */}
      {selectedDramaId && (
        <DramaDetailModal
          dramaId={selectedDramaId}
          onClose={() => setSelectedDramaId(null)}
          onPlayEpisode={(drama, episode) => {
            setActivePlayerState({ drama, episode });
          }}
          onDownloadEpisode={handleDownloadEpisode}
          isBookmarked={!!isBookmarked(selectedDramaId)}
          onToggleBookmark={(drama, status) => toggleBookmark(drama, status)}
          getEpisodeProgress={getEpisodeProgress}
        />
      )}

      {/* Video Player Modal */}
      {activePlayerState && (
        <VideoPlayerModal
          drama={activePlayerState.drama}
          currentEpisode={activePlayerState.episode}
          onClose={() => setActivePlayerState(null)}
          onSelectNextEpisode={() =>
            handleSelectNextEpisode(activePlayerState.drama, activePlayerState.episode)
          }
          initialProgressSeconds={
            getEpisodeProgress(activePlayerState.drama.id, activePlayerState.episode.id)
              ?.progressSeconds || 0
          }
          onUpdateProgress={(progress, total, completed) => {
            updateProgress({
              dramaId: activePlayerState.drama.id,
              dramaTitle: activePlayerState.drama.title,
              dramaPoster: activePlayerState.drama.thumbnail,
              episodeId: activePlayerState.episode.id,
              episodeNumber: activePlayerState.episode.number,
              progressSeconds: progress,
              totalDurationSeconds: total,
              completed,
            });
          }}
        />
      )}

      {/* Library Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        bookmarks={bookmarks}
        history={history}
        onRemoveBookmark={removeBookmark}
        onRemoveHistoryItem={removeHistoryItem}
        onClearHistory={clearHistory}
        onSelectDrama={(id) => setSelectedDramaId(id)}
      />

      {/* Downloads Manager Drawer */}
      <DownloadManagerDrawer
        isOpen={isDownloadsOpen}
        onClose={() => setIsDownloadsOpen(false)}
        downloads={downloads}
        onOpenFolder={(path) => {
          if (window.electronAPI) {
            window.electronAPI.openFolder(path);
          }
        }}
      />

      {/* GitHub Release Auto-Update Modal */}
      {updateInfo && (
        <AutoUpdateModal
          updateInfo={updateInfo}
          onClose={() => setUpdateInfo(null)}
        />
      )}

    </div>
  );
}
