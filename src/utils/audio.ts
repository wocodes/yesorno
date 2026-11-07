// Audio recording, Web Audio playback, and Anonymous Voice Filter Transformation

import { VoiceFilterType } from '../types';

export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
}

/**
 * Converts a Blob to a base64 Data URL string
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts an image file to a base64 data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formats seconds into mm:ss display
 */
export function formatAudioDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Encodes an AudioBuffer into a WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      // Interleave channels & clamp PCM
      let sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    out.setUint16(offset, data, true);
    offset += 2;
  }
  function setUint32(data: number) {
    out.setUint32(offset, data, true);
    offset += 4;
  }
}

/**
 * Applies a voice adjustment filter for anonymous privacy protection
 * Supported filters: 'none' | 'deep' | 'high' | 'robot' | 'radio'
 */
export async function transformAudioVoice(
  audioBlob: Blob,
  filterType: VoiceFilterType
): Promise<{ blob: Blob; dataUrl: string; durationSeconds: number }> {
  if (filterType === 'none') {
    const dataUrl = await blobToDataUrl(audioBlob);
    return { blob: audioBlob, dataUrl, durationSeconds: 0 };
  }

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close();

    const sampleRate = decodedBuffer.sampleRate;
    let rate = 1.0;

    if (filterType === 'deep') rate = 0.82; // Lower pitch
    if (filterType === 'high') rate = 1.25; // Higher pitch

    const targetLength = Math.floor(decodedBuffer.length / rate);
    const offlineCtx = new OfflineAudioContext(
      decodedBuffer.numberOfChannels,
      targetLength,
      sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.playbackRate.value = rate;

    let lastNode: AudioNode = source;

    if (filterType === 'deep') {
      // Warm low-pass filter
      const biquad = offlineCtx.createBiquadFilter();
      biquad.type = 'lowpass';
      biquad.frequency.value = 1600;
      biquad.Q.value = 2.5;
      lastNode.connect(biquad);
      lastNode = biquad;
    } else if (filterType === 'high') {
      // Crisp high-pass filter
      const biquad = offlineCtx.createBiquadFilter();
      biquad.type = 'highpass';
      biquad.frequency.value = 400;
      biquad.Q.value = 1.5;
      lastNode.connect(biquad);
      lastNode = biquad;
    } else if (filterType === 'robot') {
      // Robotic ring modulator using oscillator
      const ringMod = offlineCtx.createGain();
      ringMod.gain.value = 0.0;

      const osc = offlineCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55; // 55Hz robotic vibrato carrier

      const oscGain = offlineCtx.createGain();
      oscGain.gain.value = 0.8;

      osc.connect(oscGain);
      oscGain.connect(ringMod.gain);
      osc.start(0);

      lastNode.connect(ringMod);
      lastNode = ringMod;
    } else if (filterType === 'radio') {
      // Telephony / walkie-talkie bandpass
      const bandpass = offlineCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1800;
      bandpass.Q.value = 0.9;
      lastNode.connect(bandpass);
      lastNode = bandpass;
    }

    lastNode.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const newWavBlob = audioBufferToWav(renderedBuffer);
    const dataUrl = await blobToDataUrl(newWavBlob);
    const durationSeconds = Math.round(renderedBuffer.duration);

    return { blob: newWavBlob, dataUrl, durationSeconds };
  } catch (err) {
    console.warn('Voice transformation failed, using original audio:', err);
    const dataUrl = await blobToDataUrl(audioBlob);
    return { blob: audioBlob, dataUrl, durationSeconds: 0 };
  }
}

/**
 * Creates a synthetic realistic gentle voice chime audio sample (WAV format) using Web Audio API
 */
export function generateSampleChimeWav(durationSec = 4, toneType: 'agree' | 'disagree' | 'neutral' = 'agree'): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const baseFreq = toneType === 'agree' ? 440 : toneType === 'disagree' ? 330 : 392;
  const harmonyFreq = toneType === 'agree' ? 554.37 : toneType === 'disagree' ? 293.66 : 493.88;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 0.9) * Math.min(1, t * 20);
    const s1 = Math.sin(2 * Math.PI * baseFreq * t);
    const s2 = Math.sin(2 * Math.PI * harmonyFreq * t) * 0.5;
    const s3 = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.25;
    const vocalPulse = Math.sin(2 * Math.PI * 4 * t) * 0.15;
    const sample = Math.max(-1, Math.min(1, (s1 + s2 + s3) * env * (1 + vocalPulse)));

    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
