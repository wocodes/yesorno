import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Shield } from 'lucide-react';
import { VoiceAttachment } from '../types';
import { formatAudioDuration } from '../utils/audio';

interface Props {
  attachment: VoiceAttachment;
  compact?: boolean;
}

export const VoicePlayer: React.FC<Props> = ({ attachment, compact = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(attachment.durationSeconds || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDuration(attachment.durationSeconds || 0);
  }, [attachment]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback failed:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration) && duration === 0) {
        setDuration(Math.round(audioRef.current.duration));
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const barHeights = [45, 80, 60, 95, 75, 40, 85, 100, 70, 50, 90, 65, 40, 60, 80, 50];

  const getFilterBadge = () => {
    if (!attachment.voiceFilter || attachment.voiceFilter === 'none') return null;
    const filterNames: Record<string, string> = {
      deep: 'Deep Mask',
      high: 'Helium Mask',
      robot: 'Robotic Vocoder',
      radio: 'Radio Filter'
    };
    return (
      <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/90 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
        <Shield className="w-2.5 h-2.5 text-emerald-600" />
        <span>{filterNames[attachment.voiceFilter] || 'Voice Masked'}</span>
      </span>
    );
  };

  return (
    <div className={`flex flex-col gap-2 bg-gradient-to-r from-brand-50/60 to-purple-50/40 hover:from-brand-50 hover:to-purple-50/60 border border-brand-100 rounded-2xl transition-all shadow-2xs ${
      compact ? 'p-2.5' : 'p-3'
    }`}>
      <div className="flex items-center gap-3">
        <audio
          ref={audioRef}
          src={attachment.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          preload="metadata"
        />

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white flex items-center justify-center shadow-lift transition-transform active:scale-95 shrink-0 cursor-pointer"
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform / Progress bar */}
        <div 
          className="flex-1 flex items-center gap-1 h-7 cursor-pointer group"
          onClick={handleProgressClick}
          title="Click to seek"
        >
          {barHeights.map((h, i) => {
            const progressPercent = duration > 0 ? (currentTime / duration) : 0;
            const barPercent = i / barHeights.length;
            const isPassed = progressPercent >= barPercent;

            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPassed 
                    ? 'bg-gradient-to-t from-brand-600 to-brand-500 group-hover:from-brand-700 group-hover:to-brand-600' 
                    : 'bg-brand-200/80 group-hover:bg-brand-300/80'
                } ${isPlaying && isPassed ? 'scale-y-110' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        {/* Time & Mic icon */}
        <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 shrink-0 bg-white/80 px-2 py-0.5 rounded-lg border border-brand-100">
          <Volume2 className="w-3 h-3 text-brand-600" />
          <span>{formatAudioDuration(isPlaying ? currentTime : duration)}</span>
        </div>
      </div>

      {/* Voice Mask Indicator tag */}
      {getFilterBadge() && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1 border-t border-brand-100/60">
          <span className="text-[10px] font-medium text-slate-500">Anonymous Voice Privacy</span>
          {getFilterBadge()}
        </div>
      )}
    </div>
  );
};
