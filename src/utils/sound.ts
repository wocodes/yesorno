import confetti from 'canvas-confetti';

export const STORAGE_KEY_SOUNDS = 'yesorno_sounds_enabled_v1';
export const STORAGE_KEY_ANIMATIONS = 'yesorno_animations_enabled_v1';

/**
 * Returns whether sounds and audio chimes are enabled
 */
export function areSoundsEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SOUNDS);
    if (val !== null) return val === 'true';
    return true; // Enabled by default
  } catch {
    return true;
  }
}

/**
 * Sets sounds enabled state and persists to localStorage
 */
export function setSoundsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SOUNDS, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns whether animations and confetti are enabled
 */
export function areAnimationsEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_ANIMATIONS);
    if (val !== null) return val === 'true';
    return true; // Enabled by default
  } catch {
    return true;
  }
}

/**
 * Applies the disable-animations class to <html> for instant global CSS suppression
 */
export function applyAnimationsClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (enabled) {
    document.documentElement.classList.remove('disable-animations');
  } else {
    document.documentElement.classList.add('disable-animations');
  }
}

/**
 * Sets animations enabled state, persists to localStorage, and updates document class
 */
export function setAnimationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_ANIMATIONS, String(enabled));
    applyAnimationsClass(enabled);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Triggers a classy, refined confetti celebration
 */
export function triggerVoteConfetti(isYes = true): void {
  if (!areAnimationsEnabled()) return;

  try {
    const colors = isYes 
      ? ['#10b981', '#34d399', '#6366f1', '#a7f3d0', '#fbbf24'] 
      : ['#f43f5e', '#fb7185', '#6366f1', '#fecdd3', '#e2e8f0'];

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.75 },
      colors,
      disableForReducedMotion: true,
      scalar: 0.9,
      ticks: 200
    });
  } catch {
    // Ignore if not supported
  }
}

/**
 * Plays an ultra-classy synthesized acoustic chime via Web Audio API
 */
export function playHapticChime(type: 'yes' | 'no' | 'tap' = 'yes'): void {
  if (!areSoundsEnabled()) return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'yes') {
      // Elegant ascending two-tone glass chord (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.55);
      });
    } else if (type === 'no') {
      // Soft, warm low-end resonant confirmation tone (A3 -> E3)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(164.81, now + 0.25);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } else {
      // Subtle tactile click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    }

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 800);
  } catch {
    // Graceful fallback if Web Audio is restricted
  }
}

