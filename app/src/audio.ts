/** The parts of the Web Audio API that this file uses, so that a test can stand in for them. */
export interface AudioContextLike {
  currentTime: number;
  state: string;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(to: unknown): void;
  };
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(to: unknown): void;
    start(t?: number): void;
    stop(t?: number): void;
  };
}

export interface AudioOptions {
  /** Makes the context. Called only after the first tap. Returns null when there is no audio. */
  createContext?: () => AudioContextLike | null;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null;
}

export interface Audio {
  unlock(): void;
  unlockOnFirstTap(target: EventTarget): void;
  enabled(): boolean;
  setEnabled(on: boolean): void;
  pen(): void;
  stamp(): void;
}

const KEY = 'sound';

function defaultContext(): AudioContextLike | null {
  const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext;
  return Ctor === undefined ? null : new Ctor();
}

function defaultStorage(): AudioOptions['storage'] {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** Sound made in code. Nothing is made before the first tap, and one saved switch turns it off. */
export function createAudio(options: AudioOptions = {}): Audio {
  const createContext = options.createContext ?? defaultContext;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  let context: AudioContextLike | null = null;
  let unlocked = false;

  let on = true;
  try {
    on = storage?.getItem(KEY) !== 'off';
  } catch {
    on = true;
  }

  function blip(from: number, to: number, seconds: number, volume: number, type: string): void {
    if (!on || context === null) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t);
    osc.stop(t + seconds);
  }

  const audio: Audio = {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      try {
        context = createContext();
        if (context !== null && context.state === 'suspended') void context.resume();
      } catch {
        context = null;
      }
    },
    unlockOnFirstTap(target) {
      target.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    },
    enabled: () => on,
    setEnabled(value) {
      on = value;
      try {
        storage?.setItem(KEY, value ? 'on' : 'off');
      } catch {
        // The switch still works for this visit when storage is blocked.
      }
    },
    pen: () => blip(1800, 1200, 0.05, 0.05, 'triangle'),
    stamp: () => blip(140, 45, 0.28, 0.4, 'sine'),
  };
  return audio;
}