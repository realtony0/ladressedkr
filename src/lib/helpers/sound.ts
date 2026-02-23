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
    { frequency: 560, durationSec: 0.1, gain: 0.22, type: "triangle" },
    { frequency: 560, durationSec: 0.1, gain: 0.22, type: "triangle" },
    { frequency: 760, durationSec: 0.12, gain: 0.24, type: "triangle" },
  ],
  new_order: [
    { frequency: 840, durationSec: 0.12, gain: 0.2, type: "sine" },
    { frequency: 980, durationSec: 0.12, gain: 0.2, type: "sine" },
  ],
  order_ready: [
    { frequency: 930, durationSec: 0.1, gain: 0.2, type: "sine" },
    { frequency: 1170, durationSec: 0.12, gain: 0.22, type: "sine" },
    { frequency: 1470, durationSec: 0.14, gain: 0.2, type: "sine" },
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

export function playNotificationTone(tone: NotificationTone = "default") {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const steps = TONE_PATTERNS[tone] ?? TONE_PATTERNS.default;
    let cursor = context.currentTime;

    void context.resume().catch(() => undefined);

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
      cursor += releaseTime + 0.045;
    });

    const closeDelay = Math.max(0, Math.ceil((cursor - context.currentTime + 0.1) * 1000));
    window.setTimeout(() => {
      void context.close();
    }, closeDelay);
  } catch {
    // Ignore audio errors in restricted browsers.
  }
}
