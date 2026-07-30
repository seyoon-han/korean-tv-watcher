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
    
    if (activeTab === 'kdrama') {
      const filtered = list.filter((d) => d.koreanTitle || (d.country && d.country.toLowerCase().includes('korea')));
      return filtered.length > 0 ? filtered : list;
    }
    if (activeTab === 'cdrama') {
      const filtered = list.filter((d) => d.country && d.country.toLowerCase().includes('china'));
      return filtered.length > 0 ? filtered : list;
    }
    if (activeTab === 'anime') {
      const filtered = list.filter((d) => d.type && d.type.toLowerCase().includes('anime'));
      return filtered.length > 0 ? filtered : list;
    }
    if (activeTab === 'movies') {
      const filtered = list.filter((d) => d.type && d.type.toLowerCase().includes('movie'));
      return filtered.length > 0 ? filtered : list;
    }
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

        {activeTab === 'history' ? (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">시청 기록 (Watch History)</h2>
                  <p className="text-xs text-slate-400">재설치 후에도 유지되는 영구 시청 기록입니다.</p>
                </div>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold border border-rose-500/30 transition-all"
                >
                  기록 전체 삭제
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map((item) => (
                  <div
                    key={`${item.dramaId}-${item.episodeId}`}
                    onClick={() => setSelectedDramaId(item.dramaId)}
                    className="group relative bg-slate-900 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-4 cursor-pointer transition-all shadow-lg flex gap-4 items-center"
                  >
                    <img
                      src={item.dramaPoster}
                      alt={item.dramaTitle}
                      className="w-16 h-24 object-cover rounded-xl bg-slate-800 border border-white/10"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{item.dramaTitle}</h4>
                      <p className="text-xs text-emerald-400 font-semibold mt-1">Episode {item.episodeNumber}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {Math.floor(item.progressSeconds / 60)}분 / {Math.floor((item.totalDurationSeconds || 0) / 60)}분 시청
                      </p>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-emerald-500 h-full transition-all"
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
            ) : (
              <div className="p-16 bg-slate-900/50 border border-white/10 rounded-3xl text-center">
                <p className="text-slate-400 font-medium">아직 시청 기록이 없습니다. 시청을 시작해보세요!</p>
              </div>
            )}
          </div>
        ) : activeTab === 'aisub' ? (
          <div className="mt-8 bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/40 mb-4 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-pink-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">🤖 AI 자막 & 실시간 복호화 엔진 (PRO Engine)</h2>
            <p className="text-sm text-slate-300 max-w-xl mb-6 leading-relaxed">
              Kisskh 암호화 자막 키(`AmSmZVcH93UQUezi` & `sWODXX04QRTkHdlZ`)의 실시간 AES-128-CBC 자동 복호화 엔진과 AI 한국어 변환 캡션 지원 기능이 활성화되어 있습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
              <div className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl">
                <p className="text-xs font-semibold text-indigo-400 mb-1">AES Decryption Engine</p>
                <p className="text-sm font-bold text-white">Active (v1.0.3)</p>
                <p className="text-[11px] text-slate-400 mt-1">.txt1 & .txt2 키 자동 해제</p>
              </div>
              <div className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl">
                <p className="text-xs font-semibold text-purple-400 mb-1">Live S3/CDN Cache</p>
                <p className="text-sm font-bold text-white">Online</p>
                <p className="text-[11px] text-slate-400 mt-1">한글 타이틀 및 자막 연동</p>
              </div>
              <div className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl">
                <p className="text-xs font-semibold text-pink-400 mb-1">Korean AI Captions</p>
                <p className="text-sm font-bold text-white">Enabled</p>
                <p className="text-[11px] text-slate-400 mt-1">플레이어에서 한글 선택 가능</p>
              </div>
            </div>
          </div>
        ) : activeTab !== 'all' ? (
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
              dramas={filterByTab(recentUpdates)}
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
              dramas={filterByTab(trending)}
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
              title="Top Rated Classics"
              icon={<Star className="w-5 h-5 text-amber-400" />}
              dramas={filterByTab(topRated)}
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
