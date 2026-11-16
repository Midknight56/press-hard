import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createStamp } from '../src/stamp.js';

let element: HTMLElement;
let onSeal: Mock<() => void>;
let stamp: { destroy(): void };

function make(reducedMotion = false): void {
  stamp = createStamp(element, { holdMs: 1200, onSeal, reducedMotion });
}
const press = () => element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const release = () => element.dispatchEvent(new Event('pointerup', { bubbles: true }));
const key = (type: 'keydown' | 'keyup', k: string, repeat = false) =>
  element.dispatchEvent(new KeyboardEvent(type, { key: k, repeat, bubbles: true }));
const meter = () => element.getAttribute('data-progress');

beforeEach(() => {
  vi.useFakeTimers();
  element = document.createElement('button');
  document.body.append(element);
  onSeal = vi.fn<() => void>();
});

afterEach(() => {
  stamp?.destroy();
  element.remove();
  vi.useRealTimers();
});

describe('stamp, pointer', () => {
  it('does not seal at 1199 ms', () => {
    make();
    press();
    vi.advanceTimersByTime(1199);
    expect(onSeal).not.toHaveBeenCalled();
  });

  it('seals once at 1200 ms', () => {
    make();
    press();
    vi.advanceTimersByTime(1199);
    vi.advanceTimersByTime(1);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('keeps sealing once when the hold goes on', () => {
    make();
    press();
    vi.advanceTimersByTime(5000);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('reads 0.5 on the meter at 600 ms and 0 before the press', () => {
    make();
    expect(meter()).toBe('0');
    press();
    vi.advanceTimersByTime(600);
    expect(meter()).toBe('0.5');
  });

  it('empties the meter and seals nothing when released at 800 ms', () => {
    make();
    press();
    vi.advanceTimersByTime(800);
    release();
    expect(meter()).toBe('0');
    vi.advanceTimersByTime(2000);
    expect(onSeal).not.toHaveBeenCalled();
  });

  it('counts again from zero after an early release', () => {
    make();
    press();
    vi.advanceTimersByTime(800);
    release();
    press();
    vi.advanceTimersByTime(1199);
    expect(onSeal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it.each(['pointercancel', 'pointerleave', 'blur'])('treats %s as a release', (type) => {
    make();
    press();
    vi.advanceTimersByTime(900);
    element.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(2000);
    expect(onSeal).not.toHaveBeenCalled();
    expect(meter()).toBe('0');
  });

  it('ignores a second pointer down while one hold runs', () => {
    make();
    press();
    vi.advanceTimersByTime(600);
    press();
    vi.advanceTimersByTime(600);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('does nothing after destroy', () => {
    make();
    stamp.destroy();
    press();
    vi.advanceTimersByTime(3000);
    expect(onSeal).not.toHaveBeenCalled();
  });

  it('stops a running hold on destroy', () => {
    make();
    press();
    vi.advanceTimersByTime(600);
    stamp.destroy();
    vi.advanceTimersByTime(3000);
    expect(onSeal).not.toHaveBeenCalled();
  });
});

describe('stamp, keyboard', () => {
  it.each([' ', 'Enter'])('seals once when %j is held and keydown repeats', (k) => {
    make();
    key('keydown', k);
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(50);
      key('keydown', k, true);
    }
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('does not restart the hold on a repeated keydown', () => {
    make();
    key('keydown', ' ');
    vi.advanceTimersByTime(600);
    key('keydown', ' ', true);
    expect(meter()).toBe('0.5');
    vi.advanceTimersByTime(600);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('seals nothing when the key is released early', () => {
    make();
    key('keydown', ' ');
    vi.advanceTimersByTime(1000);
    key('keyup', ' ');
    vi.advanceTimersByTime(2000);
    expect(onSeal).not.toHaveBeenCalled();
    expect(meter()).toBe('0');
  });

  it('ignores other keys', () => {
    make();
    key('keydown', 'a');
    vi.advanceTimersByTime(3000);
    expect(onSeal).not.toHaveBeenCalled();
  });
});

describe('stamp, reduced motion', () => {
  it('marks the element and still needs the full hold', () => {
    make(true);
    expect(element.getAttribute('data-motion')).toBe('reduced');
    press();
    vi.advanceTimersByTime(1199);
    expect(onSeal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });

  it('marks full motion otherwise', () => {
    make(false);
    expect(element.getAttribute('data-motion')).toBe('full');
  });
});
describe('stamp, enabled switch', () => {
  it('does not start a hold while enabled returns false, and starts again when it returns true', () => {
    let enabled = false;
    stamp = createStamp(element, { holdMs: 1200, onSeal, reducedMotion: false, enabled: () => enabled });
    press();
    vi.advanceTimersByTime(2000);
    expect(onSeal).not.toHaveBeenCalled();
    expect(meter()).toBe('0');
    release();
    enabled = true;
    press();
    vi.advanceTimersByTime(1200);
    expect(onSeal).toHaveBeenCalledTimes(1);
  });
});