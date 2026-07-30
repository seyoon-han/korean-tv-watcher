import React, { useState } from 'react';
import { Sparkles, Download, X, CheckCircle2, ArrowRight } from 'lucide-react';

interface AutoUpdateModalProps {
  updateInfo: {
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    downloadUrl: string;
    assetName: string;
  };
  onClose: () => void;
}

export const AutoUpdateModal: React.FC<AutoUpdateModalProps> = ({ updateInfo, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateNow = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      if (window.electronAPI?.downloadAndInstallUpdate) {
        const res = await window.electronAPI.downloadAndInstallUpdate(updateInfo.downloadUrl);
        if (res.success) {
          setDownloadSuccess(true);
        } else {
          setError(res.error || 'Failed to launch update installer');
        }
      } else {
        window.open(updateInfo.downloadUrl, '_blank');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error executing update');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/20 text-center flex flex-col items-center">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/40 mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          새버전 업데이트 알림 (v{updateInfo.latestVersion})
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          현재 버전: v{updateInfo.currentVersion} ➔ 최신 버전: v{updateInfo.latestVersion}
        </p>

        {/* Release Notes */}
        {updateInfo.releaseNotes && (
          <div className="w-full bg-slate-950/70 border border-white/10 rounded-2xl p-4 mb-6 text-left text-xs text-slate-300 max-h-36 overflow-y-auto leading-relaxed">
            <p className="font-semibold text-indigo-400 mb-1">업데이트 변경 사항:</p>
            <p className="whitespace-pre-line">{updateInfo.releaseNotes}</p>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 w-full">
            {error}
          </p>
        )}

        {downloadSuccess ? (
          <div className="w-full bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>설치 프로그램이 실행되었습니다. 안내에 따라 설치를 완료하세요!</span>
          </div>
        ) : (
          <div className="w-full flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition-all border border-white/10"
            >
              나중에
            </button>
            <button
              onClick={handleUpdateNow}
              disabled={isDownloading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>다운로드 중...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>지금 업데이트</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
