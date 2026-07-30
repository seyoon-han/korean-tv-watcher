import React from 'react';
import { X, Download, FolderOpen, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { DownloadProgress } from '../types/tv';

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

interface DownloadManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: DownloadItem[];
  onOpenFolder: (filePath?: string) => void;
}

export const DownloadManagerDrawer: React.FC<DownloadManagerDrawerProps> = ({
  isOpen,
  onClose,
  downloads,
  onOpenFolder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-l border-white/15 h-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Downloads</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenFolder()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 border border-white/10"
              title="Open Downloads Folder"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Folder</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-white/5">
          {downloads.length > 0 ? (
            downloads.map((item) => (
              <div key={item.episodeId} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <h4 className="text-sm font-semibold text-white truncate">{item.dramaTitle}</h4>
                    <p className="text-xs text-indigo-400 font-medium">Episode {item.episodeNumber}</p>
                  </div>

                  {item.status === 'completed' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Failed
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-indigo-300">
                      {item.progress}%
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                {item.status === 'downloading' && (
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Actions */}
                {item.status === 'completed' && item.filePath && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => onOpenFolder(item.filePath)}
                      className="text-xs text-slate-300 hover:text-indigo-400 flex items-center gap-1 font-semibold"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Reveal in Finder/Explorer
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-3">
              <Download className="w-8 h-8 text-slate-600" />
              <p>No active or completed downloads yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
