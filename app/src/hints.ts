/** An instruction shows at most three times. After that it lives only on the help screen. */
export const MAX_SHOWS = 3;

export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Hints {
  /** True when the instruction of this screen may be shown now. Counts the show. */
  take(key: string): boolean;
}

const PREFIX = 'hint-';

export function browserHintStorage(): HintStorage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function createHints(storage: HintStorage | null): Hints {
  const memory = new Map<string, number>();
  return {
    take(key) {
      let count = memory.get(key);
      if (count === undefined) {
        try {
          count = Number(storage?.getItem(PREFIX + key) ?? 0);
        } catch {
          count = 0;
        }
        if (!Number.isFinite(count) || count < 0) count = 0;
      }
      if (count >= MAX_SHOWS) {
        memory.set(key, count);
        return false;
      }
      count += 1;
      memory.set(key, count);
      try {
        storage?.setItem(PREFIX + key, String(count));
      } catch {
        // The count still holds for this visit when storage is blocked.
      }
      return true;
    },
  };
}

/** The help screen: every instruction in one place. */
export const HELP_LINES = [
  'Pick a form to start.',
  'Fill each line. Add photos if you like.',
  'Both people sign in their own box.',
  'Press and hold the stamp until it seals.',
  'Tear off the copy and keep the file.',
  'Open the check page to test any copy.',
] as const;
