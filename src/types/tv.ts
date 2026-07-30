export interface Drama {
  id: number;
  title: string;
  koreanTitle?: string;
  thumbnail: string;
  episodesCount?: number;
  status?: string;
  score?: number;
  description?: string;
  country?: string;
  type?: string;
  releaseYear?: number;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  number: number;
  sub?: number;
  title?: string;
}

export interface SubtitleTrack {
  id?: number;
  label: string;
  src: string;
  land?: string;
  default?: boolean;
  isAI?: boolean;
  isCloud?: boolean;
}

export interface StreamSource {
  url: string;
  subtitles?: SubtitleTrack[];
}

export interface WatchHistory {
  dramaId: number;
  dramaTitle: string;
  dramaPoster: string;
  episodeId: number;
  episodeNumber: number;
  progressSeconds: number;
  totalDurationSeconds: number;
  completed: boolean;
  updatedAt: number;
}

export type BookmarkStatus = 'watching' | 'plan_to_watch' | 'completed' | 'favorite';

export interface Bookmark {
  dramaId: number;
  dramaTitle: string;
  dramaPoster: string;
  status: BookmarkStatus;
  addedAt: number;
}

export interface DownloadProgress {
  episodeId: number;
  progress: number;
  filePath?: string;
  error?: string;
}

export interface ElectronAPI {
  downloadEpisode: (data: {
    episodeId: number;
    episodeNumber: number;
    dramaId: number;
    dramaTitle: string;
    streamUrl: string;
  }) => void;
  openFolder: (filePath?: string) => void;
  onDownloadProgress: (callback: (data: { episodeId: number; progress: number }) => void) => void;
  onDownloadCompleted: (callback: (data: { episodeId: number; filePath: string }) => void) => void;
  onDownloadFailed: (callback: (data: { episodeId: number; error: string }) => void) => void;
  generateAISubtitle: (data: {
    episodeId: number;
    dramaTitle: string;
    episodeNumber: number;
    targetLang: string;
  }) => Promise<{ success: boolean; vttContent?: string; error?: string }>;
  uploadCloudSubtitle: (data: {
    episodeId: number;
    label: string;
    vttContent: string;
    lang: string;
  }) => Promise<{ success: boolean; subtitleUrl?: string; fileName?: string; error?: string }>;
  getCloudSubtitles: (episodeId: number) => Promise<{ subtitles: SubtitleTrack[] }>;
  loadPersistentData?: () => Promise<{ history: WatchHistory[]; bookmarks: Bookmark[] }>;
  savePersistentData?: (data: { history: WatchHistory[]; bookmarks: Bookmark[] }) => Promise<{ success: boolean }>;
  checkForUpdates?: () => Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    downloadUrl: string;
    assetName: string;
  }>;
  downloadAndInstallUpdate?: (url: string) => Promise<{ success: boolean; openedBrowser?: boolean; destPath?: string }>;
  isElectron?: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
