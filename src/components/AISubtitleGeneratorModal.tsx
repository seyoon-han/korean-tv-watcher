import React, { useState } from 'react';
import { X, Sparkles, CloudUpload, CheckCircle2, AlertCircle, Loader2, Globe, FileText, Share2 } from 'lucide-react';
import { Drama, Episode } from '../types/tv';

interface AISubtitleGeneratorModalProps {
  drama: Drama;
  episode: Episode;
  onClose: () => void;
  onSubtitleGeneratedAndUploaded: (subtitleUrl: string, label: string) => void;
}

export const AISubtitleGeneratorModal: React.FC<AISubtitleGeneratorModalProps> = ({
  drama,
  episode,
  onClose,
  onSubtitleGeneratedAndUploaded,
}) => {
  const [targetLang, setTargetLang] = useState<'Korean' | 'English' | 'Japanese' | 'Chinese'>('Korean');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVtt, setGeneratedVtt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const languages = [
    { id: 'Korean', name: '한국어 (Korean)', flag: '🇰🇷' },
    { id: 'English', name: 'English', flag: '🇺🇸' },
    { id: 'Japanese', name: '日本語 (Japanese)', flag: '🇯🇵' },
    { id: 'Chinese', name: '中文 (Chinese)', flag: '🇨🇳' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGeneratedVtt(null);
    setIsSuccess(false);

    if (!window.electronAPI || !window.electronAPI.generateAISubtitle) {
      setErrorMessage('Electron AI IPC interface not available.');
      setIsGenerating(false);
      return;
    }

    try {
      const result = await window.electronAPI.generateAISubtitle({
        episodeId: episode.id,
        dramaTitle: drama.title,
        episodeNumber: episode.number,
        targetLang,
      });

      if (result.success && result.vttContent) {
        setGeneratedVtt(result.vttContent);
      } else {
        setErrorMessage(result.error || 'Failed to generate subtitles via agy CLI.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing AI subtitle generator.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadToS3Cloud = async () => {
    if (!generatedVtt || !window.electronAPI || !window.electronAPI.uploadCloudSubtitle) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const label = `AI ${targetLang} (Gemini 3.6 Flash)`;
      const res = await window.electronAPI.uploadCloudSubtitle({
        episodeId: episode.id,
        label,
        vttContent: generatedVtt,
        lang: targetLang.toLowerCase(),
      });

      if (res.success && res.subtitleUrl) {
        setIsSuccess(true);
        onSubtitleGeneratedAndUploaded(res.subtitleUrl, label);
      } else {
        setErrorMessage(res.error || 'Failed to publish subtitle to S3 Cloud Repository.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading to S3 Cloud Repository.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                AI Subtitle Generator & S3 Cloud Share
              </h2>
              <p className="text-xs text-indigo-300 font-medium mt-0.5">
                Local agy CLI • Gemini 3.6 Flash (High Effort)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Target Episode Details */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/10 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">{drama.title}</h4>
              <p className="text-xs text-indigo-400 font-semibold mt-0.5">Episode {episode.number}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
              3.6 Flash
            </span>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              Select Target Language
            </label>
            <div className="grid grid-cols-2 gap-3">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setTargetLang(lang.id as any)}
                  className={`p-3 rounded-xl border text-sm font-semibold flex items-center gap-3 transition-all ${
                    targetLang === lang.id
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800/40 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {isSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                Subtitle successfully saved to S3 Cloud Repository! Available to all TV-Watcher app users.
              </span>
            </div>
          )}

          {/* WebVTT Preview Box */}
          {generatedVtt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Generated WebVTT Preview
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">Valid WebVTT</span>
              </div>
              <textarea
                readOnly
                value={generatedVtt}
                className="w-full h-40 p-3 bg-slate-950/80 border border-white/10 rounded-2xl text-xs font-mono text-slate-300 focus:outline-none resize-none"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-4">
          {!generatedVtt ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Invoking Gemini 3.6 Flash via agy CLI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Subtitle with Gemini 3.6 Flash</span>
                </>
              )}
            </button>
          ) : (
            <div className="w-full flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isUploading}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-slate-200 font-semibold text-xs rounded-xl border border-white/10 transition-all"
              >
                Regenerate
              </button>

              <button
                onClick={handleUploadToS3Cloud}
                disabled={isUploading || isSuccess}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading to S3 Repository...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Published to S3 Cloud</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Publish to S3 Cloud Repository</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
