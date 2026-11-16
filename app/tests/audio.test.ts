import { describe, expect, it, vi } from 'vitest';
import { createAudio, type AudioContextLike } from '../src/audio.js';

function fakeContext() {
  const started: string[] = [];
  const context: AudioContextLike = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: async () => undefined,
    createGain: () => ({
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => undefined,
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => undefined,
      start: () => {
        started.push('start');
      },
      stop: () => undefined,
    }),
  };
  return { context, started };
}
function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    data,
  };
}

describe('audio', () => {
  it('makes no sound and creates no context before the first tap', () => {
    const { context, started } = fakeContext();
    const create = vi.fn(() => context);
    const audio = createAudio({ createContext: create, storage: memoryStorage() });
    audio.pen();
    audio.stamp();
    expect(started).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('makes sound after the first tap', () => {
    const { context, started } = fakeContext();
    const create = vi.fn(() => context);
    const audio = createAudio({ createContext: create, storage: memoryStorage() });
    audio.unlock();
    expect(create).toHaveBeenCalledTimes(1);
    audio.pen();
    audio.stamp();
    expect(started.length).toBeGreaterThanOrEqual(2);
    audio.unlock();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('listens for the first tap on the target and unlocks once', () => {
    const { context } = fakeContext();
    const create = vi.fn(() => context);
    const audio = createAudio({ createContext: create, storage: memoryStorage() });
    const target = document.createElement('div');
    audio.unlockOnFirstTap(target);
    expect(create).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('is on by default and the switch is saved', () => {
    const storage = memoryStorage();
    const audio = createAudio({ createContext: () => fakeContext().context, storage });
    expect(audio.enabled()).toBe(true);
    audio.setEnabled(false);
    expect(audio.enabled()).toBe(false);
    expect(storage.data['sound']).toBe('off');
    expect(createAudio({ createContext: () => fakeContext().context, storage }).enabled()).toBe(false);
    audio.setEnabled(true);
    expect(storage.data['sound']).toBe('on');
  });

  it('makes no sound while the switch is off', () => {
    const { context, started } = fakeContext();
    const audio = createAudio({ createContext: () => context, storage: memoryStorage({ sound: 'off' }) });
    audio.unlock();
    audio.pen();
    audio.stamp();
    expect(started).toEqual([]);
  });

  it('works when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const { context, started } = fakeContext();
    const audio = createAudio({ createContext: () => context, storage: broken });
    expect(audio.enabled()).toBe(true);
    audio.setEnabled(false);
    expect(audio.enabled()).toBe(false);
    audio.setEnabled(true);
    audio.unlock();
    audio.stamp();
    expect(started.length).toBeGreaterThanOrEqual(1);
  });

  it('stays silent when the browser has no audio', () => {
    const audio = createAudio({ createContext: () => null, storage: memoryStorage() });
    audio.unlock();
    expect(() => {
      audio.pen();
      audio.stamp();
    }).not.toThrow();
  });
});