"use client";

export type NotificationTone =
  | "default"
  | "server_call"
  | "new_order"
  | "order_ready"
  | "success"
  | "error";

interface ToneStep {
  frequency: number;
  durationSec: number;
  gain: number;
  type?: OscillatorType;
}

const TONE_PATTERNS: Record<NotificationTone, ToneStep[]> = {
  default: [
    { frequency: 860, durationSec: 0.13, gain: 0.2, type: "sine" },
    { frequency: 640, durationSec: 0.11, gain: 0.18, type: "sine" },
  ],
  server_call: [
    { frequency: 560, durationSec: 0.1, gain: 0.3, type: "triangle" },
    { frequency: 560, durationSec: 0.1, gain: 0.3, type: "triangle" },
    { frequency: 760, durationSec: 0.12, gain: 0.32, type: "triangle" },
  ],
  // Loud, attention-grabbing pattern for the kitchen — repeated rising beeps.
  new_order: [
    { frequency: 880, durationSec: 0.16, gain: 0.34, type: "square" },
    { frequency: 1175, durationSec: 0.16, gain: 0.34, type: "square" },
    { frequency: 880, durationSec: 0.16, gain: 0.34, type: "square" },
    { frequency: 1175, durationSec: 0.22, gain: 0.36, type: "square" },
  ],
  order_ready: [
    { frequency: 930, durationSec: 0.1, gain: 0.24, type: "sine" },
    { frequency: 1170, durationSec: 0.12, gain: 0.26, type: "sine" },
    { frequency: 1470, durationSec: 0.14, gain: 0.24, type: "sine" },
  ],
  success: [
    { frequency: 880, durationSec: 0.09, gain: 0.2, type: "sine" },
    { frequency: 1180, durationSec: 0.14, gain: 0.2, type: "sine" },
  ],
  error: [
    { frequency: 520, durationSec: 0.13, gain: 0.23, type: "sawtooth" },
    { frequency: 410, durationSec: 0.17, gain: 0.2, type: "sawtooth" },
  ],
};

// A single shared AudioContext, kept alive across notifications. Browsers block
// audio until a user gesture, so it must be "unlocked" once (see unlockAudio).
let sharedContext: AudioContext | null = null;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function ensureContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    return null;
  }
  if (!sharedContext) {
    try {
      sharedContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

/**
 * Must be called from a user gesture (click/tap). Creates and resumes the shared
 * audio context and plays a near-silent blip so the browser unlocks audio for
 * all later background notifications (new orders, etc.).
 */
export async function unlockAudio(): Promise<boolean> {
  const context = ensureContext();
  if (!context) {
    return false;
  }
  try {
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.03);
    return context.state === "running";
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return Boolean(sharedContext && sharedContext.state === "running");
}

export function playNotificationTone(tone: NotificationTone = "default") {
  try {
    const context = ensureContext();
    if (!context) {
      return;
    }

    // Best-effort resume in case the context got suspended (tab backgrounded).
    void context.resume().catch(() => undefined);

    const steps = TONE_PATTERNS[tone] ?? TONE_PATTERNS.default;
    let cursor = context.currentTime;

    steps.forEach((step) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const attackTime = 0.01;
      const releaseTime = step.durationSec;

      oscillator.type = step.type ?? "sine";
      oscillator.frequency.setValueAtTime(step.frequency, cursor);

      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.exponentialRampToValueAtTime(step.gain, cursor + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, cursor + releaseTime);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(cursor);
      oscillator.stop(cursor + releaseTime + 0.02);
      cursor += releaseTime + 0.05;
    });
    // The shared context is intentionally kept open for future tones.
  } catch {
    // Ignore audio errors in restricted browsers.
  }
}
