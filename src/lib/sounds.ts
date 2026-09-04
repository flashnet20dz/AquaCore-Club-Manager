/**
 * Sound utility — uses Web Audio API for short beeps
 * No external audio files needed; works offline (PWA-friendly)
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.18): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // ignore
  }
}

/** Positive "ding" — valid check-in, success */
export function playSuccessSound(): void {
  playTone(880, 0.12, "sine", 0.2);
  setTimeout(() => playTone(1320, 0.18, "sine", 0.2), 90);
}

/** Warning "buzz" — expired or frozen subscriber trying to check in */
export function playWarningSound(): void {
  playTone(220, 0.18, "square", 0.18);
  setTimeout(() => playTone(180, 0.22, "square", 0.18), 130);
}

/** Soft click — delete confirmation, button clicks */
export function playClickSound(): void {
  playTone(660, 0.05, "triangle", 0.1);
}

/** Error sound — failure */
export function playErrorSound(): void {
  playTone(300, 0.2, "sawtooth", 0.15);
  setTimeout(() => playTone(220, 0.25, "sawtooth", 0.15), 120);
}

/** Notification chime — new alert */
export function playNotificationSound(): void {
  playTone(988, 0.1, "sine", 0.15);
  setTimeout(() => playTone(1318, 0.1, "sine", 0.15), 80);
  setTimeout(() => playTone(1568, 0.15, "sine", 0.15), 160);
}

// User preference (set from settings)
let soundsEnabled = true;
export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}
export function isSoundsEnabled(): boolean {
  return soundsEnabled;
}

// Wrappers that respect user preference
export function notifySuccess(): void { if (soundsEnabled) playSuccessSound(); }
export function notifyWarning(): void { if (soundsEnabled) playWarningSound(); }
export function notifyClick(): void { if (soundsEnabled) playClickSound(); }
export function notifyError(): void { if (soundsEnabled) playErrorSound(); }
export function notifyNotification(): void { if (soundsEnabled) playNotificationSound(); }
