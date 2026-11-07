import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, Square, Trash2, Play, Pause, AlertCircle, 
  Sparkles, Sliders, Shield, Radio, Bot, Volume2 
} from 'lucide-react';
import { VoiceAttachment, VoiceFilterType } from '../types';
import { 
  blobToDataUrl, formatAudioDuration, generateSampleChimeWav, 
  transformAudioVoice 
} from '../utils/audio';

interface Props {
  onRecordingComplete: (attachment: VoiceAttachment | null) => void;
  existingAttachment?: VoiceAttachment | null;
  isAnonymous?: boolean;
  label?: string;
}

export const VoiceRecorder: React.FC<Props> = ({ 
  onRecordingComplete, 
  existingAttachment,
  isAnonymous = false,
  label = 'Voice Note Attachment (Optional)'
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAttachment?.audioUrl || null);
  const [duration, setDuration] = useState<number>(existingAttachment?.durationSeconds || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice Changer / Adjustment
  const [selectedFilter, setSelectedFilter] = useState<VoiceFilterType>(existingAttachment?.voiceFilter || 'none');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_RECORDING_SECONDS = 60;

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // When user changes voice filter and rawBlob exists, re-transform audio!
  const handleSelectFilter = async (filter: VoiceFilterType) => {
    setSelectedFilter(filter);
    if (!rawBlob) return;

    setIsApplyingFilter(true);
    try {
      if (filter === 'none') {
        const dataUrl = await blobToDataUrl(rawBlob);
        setAudioUrl(dataUrl);
        onRecordingComplete({
          audioUrl: dataUrl,
          durationSeconds: duration,
          mimeType: rawBlob.type || 'audio/wav',
          createdAt: new Date().toISOString(),
          voiceFilter: 'none',
          isVoiceMasked: false
        });
      } else {
        const result = await transformAudioVoice(rawBlob, filter);
        setAudioUrl(result.dataUrl);
        if (result.durationSeconds > 0) setDuration(result.durationSeconds);
        onRecordingComplete({
          audioUrl: result.dataUrl,
          durationSeconds: result.durationSeconds || duration,
          mimeType: 'audio/wav',
          createdAt: new Date().toISOString(),
          voiceFilter: filter,
          isVoiceMasked: true
        });
      }
    } catch (err) {
      console.warn('Filter processing failed:', err);
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRawBlob(audioBlob);
        const finalDuration = recordingSeconds || 1;
        setDuration(finalDuration);

        // If anonymous, default to 'deep' voice mask for privacy protection!
        const initialFilter = isAnonymous ? 'deep' : 'none';
        setSelectedFilter(initialFilter);

        try {
          if (initialFilter !== 'none') {
            const transformed = await transformAudioVoice(audioBlob, initialFilter);
            setAudioUrl(transformed.dataUrl);
            onRecordingComplete({
              audioUrl: transformed.dataUrl,
              durationSeconds: transformed.durationSeconds || finalDuration,
              mimeType: 'audio/wav',
              createdAt: new Date().toISOString(),
              voiceFilter: initialFilter,
              isVoiceMasked: true
            });
          } else {
            const dataUrl = await blobToDataUrl(audioBlob);
            setAudioUrl(dataUrl);
            onRecordingComplete({
              audioUrl: dataUrl,
              durationSeconds: finalDuration,
              mimeType,
              createdAt: new Date().toISOString(),
              voiceFilter: 'none',
              isVoiceMasked: false
            });
          }
        } catch {
          const fallbackUrl = URL.createObjectURL(audioBlob);
          setAudioUrl(fallbackUrl);
          onRecordingComplete({
            audioUrl: fallbackUrl,
            durationSeconds: finalDuration,
            mimeType,
            createdAt: new Date().toISOString()
          });
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      const startTimestamp = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 500);

    } catch (err: unknown) {
      console.warn('Microphone access failed:', err);
      const message = err instanceof Error ? err.message : 'Unable to access microphone.';
      setErrorMessage(
        message.includes('Permission')
          ? 'Microphone permission was denied. Please enable microphone access in your browser settings.'
          : message
      );
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleUseSimulatedAudio = async () => {
    setErrorMessage(null);
    const simUrl = generateSampleChimeWav(5, 'agree');
    
    // Fetch blob to allow voice changer on simulation too!
    const response = await fetch(simUrl);
    const blob = await response.blob();
    setRawBlob(blob);
    setAudioUrl(simUrl);
    setDuration(5);
    setSelectedFilter('none');

    onRecordingComplete({
      audioUrl: simUrl,
      durationSeconds: 5,
      mimeType: 'audio/wav',
      createdAt: new Date().toISOString(),
      voiceFilter: 'none',
      isVoiceMasked: false
    });
  };

  const handleDeleteRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setAudioUrl(null);
    setRawBlob(null);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackTime(0);
    setSelectedFilter('none');
    onRecordingComplete(null);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5 text-brand-600" />
          {label}
        </span>
        <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">Max 60 sec</span>
      </div>

      {/* Recording State */}
      {isRecording && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Recording Active...</span>
            <span className="font-mono text-sm font-bold text-rose-900 bg-white/80 px-2.5 py-0.5 rounded-lg border border-rose-200">
              {formatAudioDuration(recordingSeconds)} / 1:00
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop & Save</span>
          </button>
        </div>
      )}

      {/* Preview / Recorded State */}
      {!isRecording && audioUrl && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-soft">
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
              onEnded={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
              }}
            />

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={togglePlayback}
                disabled={isApplyingFilter}
                className="w-9 h-9 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white shadow-lift flex items-center justify-center transition-transform active:scale-95 shrink-0 cursor-pointer"
                aria-label={isPlaying ? 'Pause voicenote preview' : 'Play voicenote preview'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              {/* Waveform preview simulation */}
              <div className="flex-1 flex items-center gap-1 h-7">
                {[40, 70, 90, 50, 80, 100, 60, 45, 85, 95, 65, 40, 75, 55].map((h, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all duration-200 ${
                      isPlaying 
                        ? 'bg-gradient-to-t from-brand-600 to-indigo-500 animate-pulse' 
                        : 'bg-brand-200'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              <div className="text-xs font-mono font-bold text-slate-600 shrink-0 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/80">
                {formatAudioDuration(isPlaying ? playbackTime : duration)}
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeleteRecording}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete voicenote"
              aria-label="Delete voicenote"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* ANONYMOUS VOICE CHANGER / ADJUSTMENT SECTION */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-600" />
                <span>Voice Privacy Filter / Adjustment</span>
              </span>
              {selectedFilter !== 'none' && (
                <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-600" /> Voice Masked
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              {isAnonymous 
                ? 'Your vote is anonymous. Mask or pitch-shift your voice so people cannot identify you by sound.'
                : 'Select a vocal mask preset if you prefer not to share your natural voice tone.'}
            </p>

            {/* Filter Presets Pill Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
              {/* None */}
              <button
                type="button"
                onClick={() => handleSelectFilter('none')}
                disabled={isApplyingFilter}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedFilter === 'none'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Natural</span>
              </button>

              {/* Deep Pitch */}
              <button
                type="button"
                onClick={() => handleSelectFilter('deep')}
                disabled={isApplyingFilter}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedFilter === 'deep'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-brand-600" />
                <span>Deep Mask</span>
              </button>

              {/* Helium / High Pitch */}
              <button
                type="button"
                onClick={() => handleSelectFilter('high')}
                disabled={isApplyingFilter}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedFilter === 'high'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Helium</span>
              </button>

              {/* Robotic */}
              <button
                type="button"
                onClick={() => handleSelectFilter('robot')}
                disabled={isApplyingFilter}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedFilter === 'robot'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-purple-600" />
                <span>Robotic</span>
              </button>

              {/* Radio */}
              <button
                type="button"
                onClick={() => handleSelectFilter('radio')}
                disabled={isApplyingFilter}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedFilter === 'radio'
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold ring-2 ring-brand-500/20 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span>Radio</span>
              </button>
            </div>

            {isApplyingFilter && (
              <p className="text-[10px] text-brand-600 font-semibold animate-pulse pt-1">
                Applying voice mask transformation...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Initial state (no recording yet) */}
      {!isRecording && !audioUrl && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-300 hover:border-brand-400 text-slate-800 rounded-xl text-xs font-bold shadow-2xs hover:bg-slate-50 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Mic className="w-4 h-4 text-brand-600" />
              <span>Record Voice Note</span>
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={handleUseSimulatedAudio}
                className="flex items-center justify-center gap-1.5 py-3 px-4 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Add a sample audio note without mic permissions (Local Dev Only)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate Voice (Dev)</span>
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                {errorMessage}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
