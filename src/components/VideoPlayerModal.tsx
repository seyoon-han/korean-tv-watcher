import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings,
  SkipForward, RotateCcw, RotateCw, PictureInPicture2, Subtitles, Check, ArrowRight, Sparkles
} from 'lucide-react';
import { Drama, Episode, StreamSource, SubtitleTrack } from '../types/tv';
import { apiService } from '../services/api';
import { AISubtitleGeneratorModal } from './AISubtitleGeneratorModal';

interface VideoPlayerModalProps {
  drama: Drama;
  currentEpisode: Episode;
  onClose: () => void;
  onSelectNextEpisode?: () => void;
  initialProgressSeconds?: number;
  onUpdateProgress: (progressSeconds: number, totalSeconds: number, completed: boolean) => void;
}

import CryptoJS from 'crypto-js';

const subKey3 = CryptoJS.enc.Utf8.parse('sWODXX04QRTkHdlZ');
const subCfg3 = JSON.parse(atob('eyJpdiI6eyJ3b3JkcyI6Wzk0Njg5NDY5NiwxNjM0NzQ5MDI5LDExMjc1MDgwODIsMTM5NjI3MTE4M10sInNpZ0J5dGVzIjoxNn19'));
const subKey2 = CryptoJS.enc.Utf8.parse('AmSmZVcH93UQUezi');
const subCfg2 = JSON.parse(atob('eyJpdiI6eyJ3b3JkcyI6WzEzODIzNjc4MTksMTQ2NTMzMzg1OSwxOTAyNDA2MjI0LDExNjQ4NTQ4MzhdLCJzaWdCeXRlcyI6MTZ9fQ=='));

function decryptSubtitleLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || !/^[a-zA-Z0-9\+\/\=]{12,}$/.test(trimmed)) {
    return line;
  }
  try {
    let dec = CryptoJS.AES.decrypt(trimmed, subKey3, subCfg3).toString(CryptoJS.enc.Utf8);
    if (dec && dec.length > 0) return dec;
    dec = CryptoJS.AES.decrypt(trimmed, subKey2, subCfg2).toString(CryptoJS.enc.Utf8);
    if (dec && dec.length > 0) return dec;
  } catch (e) {}
  return line;
}

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

export function parseSubtitlesToCues(rawText: string): SubtitleCue[] {
  if (!rawText) return [];
  let text = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  text = text.split('\n').map(decryptSubtitleLine).join('\n');
  text = text.replace(/\{[^}]*\}/g, '');
  const cues: SubtitleCue[] = [];
  const timeRegex = /(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/;
  const blocks = text.split(/\n\s*\n/);
  let id = 0;
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) { timeLineIdx = i; break; }
    }
    if (timeLineIdx !== -1) {
      const match = lines[timeLineIdx].match(timeRegex);
      if (match) {
        const startH = parseInt(match[1] || '0', 10);
        const startM = parseInt(match[2], 10);
        const startS = parseInt(match[3], 10);
        const startMs = parseInt(match[4], 10);
        const startTime = startH * 3600 + startM * 60 + startS + startMs / 1000;
        const endH = parseInt(match[5] || '0', 10);
        const endM = parseInt(match[6], 10);
        const endS = parseInt(match[7], 10);
        const endMs = parseInt(match[8], 10);
        const endTime = endH * 3600 + endM * 60 + endS + endMs / 1000;
        let cueTextLines = lines.slice(timeLineIdx + 1).map(l => decryptSubtitleLine(l));
        let cueText = cueTextLines.join('\n').trim();
        if (cueText) {
          cues.push({ id: ++id, start: startTime, end: endTime, text: cueText });
        }
      }
    }
  }
  return cues;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  drama,
  currentEpisode,
  onClose,
  onSelectNextEpisode,
  initialProgressSeconds = 0,
  onUpdateProgress,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [showAIGenerator, setShowAIGenerator] = useState(false);

  const [streamSource, setStreamSource] = useState<StreamSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoNext, setAutoNext] = useState(true);

  // Quality & Subtitles state
  const [qualities, setQualities] = useState<{ id: number; height: number; label: string }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = Auto
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('off');
  const [subtitleDelay, setSubtitleDelay] = useState<number>(0);
  const [activeCues, setActiveCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string>('');

  // Menus
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Episode Stream Source & Auto Select Default Subtitle
  useEffect(() => {
    async function loadStream() {
      setIsLoading(true);
      setErrorMessage(null);

      const source = await apiService.getEpisodeStream(currentEpisode.id);
      if (!source || !source.url) {
        setErrorMessage('Failed to load video stream. The server might be unreachable.');
        setIsLoading(false);
        return;
      }

      setStreamSource(source);
      const subList = source.subtitles || [];
      setSubtitles(subList);
      setIsLoading(false);

      if (subList.length > 0) {
        const defaultSub = subList.find(s => s.land?.toLowerCase().includes('ko') || s.label?.toLowerCase().includes('korean') || s.default) || subList[0];
        if (defaultSub) {
          changeSubtitle(defaultSub.src);
        }
      }
    }
    loadStream();
  }, [currentEpisode.id]);

  // 2. Initialize HLS Player
  useEffect(() => {
    if (!streamSource || !videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamSource.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels.map((level, index) => ({
          id: index,
          height: level.height,
          label: `${level.height}p`,
        }));
        setQualities(levels);

        if (initialProgressSeconds > 0) {
          video.currentTime = initialProgressSeconds;
        }

        video.play().catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setErrorMessage('Fatal video playback error.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamSource.url;
      if (initialProgressSeconds > 0) {
        video.currentTime = initialProgressSeconds;
      }
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamSource]);

  // 3. Time Update & Progress Sync + Custom Subtitle Cue Renderer
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (dur > 0 && Math.floor(curr) % 5 === 0) {
      onUpdateProgress(curr, dur, curr / dur >= 0.9);
    }

    // Match active subtitle cue
    if (activeCues.length > 0) {
      const matchTime = curr + subtitleDelay;
      const cue = activeCues.find((c) => matchTime >= c.start && matchTime <= c.end);
      setCurrentSubtitleText(cue ? cue.text : '');
    } else {
      setCurrentSubtitleText('');
    }
  };

  const handleEnded = () => {
    if (duration > 0) {
      onUpdateProgress(duration, duration, true);
    }
    if (autoNext && onSelectNextEpisode) {
      onSelectNextEpisode();
    }
  };

  // Quality Switcher
  const changeQuality = (qualityId: number) => {
    setSelectedQuality(qualityId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityId;
    }
    setShowQualityMenu(false);
  };

  // Speed Switcher
  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  // Subtitle Switcher
  const changeSubtitle = async (subUrl: string) => {
    setSelectedSubtitle(subUrl);
    setShowSubtitleMenu(false);

    if (!videoRef.current) return;

    // Clear existing text tracks
    const existing = videoRef.current.querySelectorAll('track');
    existing.forEach((t) => t.remove());

    if (subUrl === 'off') {
      setActiveCues([]);
      setCurrentSubtitleText('');
      return;
    }

    try {
      // Fetch subtitle file & parse to cues directly
      const res = await fetch(subUrl);
      if (res.ok) {
        const rawText = await res.text();
        const cues = parseSubtitlesToCues(rawText);
        setActiveCues(cues);
      }
    } catch (e) {
      console.error('[SUBTITLE_FETCH_ERROR]', e);
    }

    // Native track fallback
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'Subtitle';
    track.srclang = 'en';
    track.src = subUrl;
    track.default = true;
    videoRef.current.appendChild(track);

    setTimeout(() => {
      if (videoRef.current && videoRef.current.textTracks) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = 'showing';
        }
      }
    }, 100);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture();
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => {
            const nv = Math.min(1, v + 0.1);
            if (videoRef.current) videoRef.current.volume = nv;
            return nv;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => {
            const nv = Math.max(0, v - 0.1);
            if (videoRef.current) videoRef.current.volume = nv;
            return nv;
          });
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyP':
          e.preventDefault();
          togglePiP();
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted((m) => {
            if (videoRef.current) videoRef.current.muted = !m;
            return !m;
          });
          break;
        case 'KeyN':
          if (onSelectNextEpisode) {
            e.preventDefault();
            onSelectNextEpisode();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectNextEpisode]);

  // Controls Auto-hide
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative w-full h-full bg-black flex items-center justify-center group"
      >
        {/* Top Header Controls */}
        <div
          className={`absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{drama.title}</h2>
            <p className="text-xs text-indigo-400 font-semibold">Episode {currentEpisode.number}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Element */}
        <video
          ref={videoRef}
          crossOrigin="anonymous"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={() => {
            if (videoRef.current) {
              if (videoRef.current.paused) videoRef.current.play();
              else videoRef.current.pause();
            }
          }}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Custom Subtitle Overlay */}
        {currentSubtitleText && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-6 py-3 rounded-2xl bg-black/85 backdrop-blur-md border border-white/15 text-white font-bold text-base sm:text-xl text-center shadow-2xl max-w-3xl leading-relaxed animate-in fade-in duration-100 whitespace-pre-line">
            {currentSubtitleText}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm z-20">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-300">Resolving video stream...</p>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 z-20">
            <p className="text-rose-400 font-bold text-base text-center">{errorMessage}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl"
            >
              Close Player
            </button>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-3 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-slate-300">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const newTime = parseFloat(e.target.value);
                setCurrentTime(newTime);
                if (videoRef.current) videoRef.current.currentTime = newTime;
              }}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
            />
            <span className="text-xs font-mono font-semibold text-slate-400">{formatTime(duration)}</span>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    if (isPlaying) videoRef.current.pause();
                    else videoRef.current.play();
                  }
                }}
                className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime -= 10;
                }}
                className="p-2 text-slate-300 hover:text-white transition-colors"
                title="Seek -10s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime += 10;
                }}
                className="p-2 text-slate-300 hover:text-white transition-colors"
                title="Seek +10s"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 group/vol">
                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (videoRef.current) videoRef.current.muted = !isMuted;
                  }}
                  className="p-2 text-slate-300 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const nv = parseFloat(e.target.value);
                    setVolume(nv);
                    setIsMuted(nv === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = nv;
                      videoRef.current.muted = nv === 0;
                    }
                  }}
                  className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Next Episode Button */}
              {onSelectNextEpisode && (
                <button
                  onClick={onSelectNextEpisode}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-all border border-white/10"
                >
                  <span>Next Ep</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* AI Subtitle Generator Button */}
              <button
                onClick={() => setShowAIGenerator(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
                title="Generate & Share AI Subtitles (Gemini 3.6 Flash)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Subtitle</span>
              </button>

              {/* Subtitles Menu */}
              {subtitles.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/10"
                    title="Subtitles"
                  >
                    <Subtitles className="w-4 h-4" />
                  </button>
                  {showSubtitleMenu && (
                    <div className="absolute right-0 bottom-full mb-2 w-44 bg-slate-900/95 border border-white/15 rounded-xl shadow-xl overflow-hidden backdrop-blur-xl p-1 z-40 text-xs">
                      <button
                        onClick={() => changeSubtitle('off')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-600/30 text-slate-300 flex items-center justify-between"
                      >
                        <span>Off</span>
                        {selectedSubtitle === 'off' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                      {subtitles.map((sub) => (
                        <button
                          key={sub.src}
                          onClick={() => changeSubtitle(sub.src)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-600/30 text-slate-300 flex items-center justify-between truncate"
                        >
                          <span className="truncate">{sub.label}</span>
                          {selectedSubtitle === sub.src && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Speed Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-mono text-xs font-semibold transition-colors border border-white/10"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-28 bg-slate-900/95 border border-white/15 rounded-xl shadow-xl overflow-hidden backdrop-blur-xl p-1 z-40 text-xs">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changeSpeed(rate)}
                        className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-indigo-600/30 text-slate-300 flex items-center justify-between"
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality Menu */}
              {qualities.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/10"
                    title="Quality Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {showQualityMenu && (
                    <div className="absolute right-0 bottom-full mb-2 w-32 bg-slate-900/95 border border-white/15 rounded-xl shadow-xl overflow-hidden backdrop-blur-xl p-1 z-40 text-xs">
                      <button
                        onClick={() => changeQuality(-1)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-600/30 text-slate-300 flex items-center justify-between"
                      >
                        <span>Auto</span>
                        {selectedQuality === -1 && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                      {qualities.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => changeQuality(q.id)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-600/30 text-slate-300 flex items-center justify-between"
                        >
                          <span>{q.label}</span>
                          {selectedQuality === q.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PiP Button */}
              <button
                onClick={togglePiP}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/10"
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors border border-white/10"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* AI Subtitle Generator Modal */}
        {showAIGenerator && (
          <AISubtitleGeneratorModal
            drama={drama}
            episode={currentEpisode}
            onClose={() => setShowAIGenerator(false)}
            onSubtitleGeneratedAndUploaded={(newUrl, label) => {
              const newTrack: SubtitleTrack = {
                label: `☁️ S3 Cloud: ${label}`,
                src: newUrl,
                isCloud: true,
                isAI: true,
              };
              setSubtitles((prev) => [newTrack, ...prev]);
              changeSubtitle(newUrl);
            }}
          />
        )}

      </div>
    </div>
  );
};
