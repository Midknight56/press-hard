import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from '../src/motion.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    vi.stubGlobal('matchMedia', matchMedia);
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
  it('is false when there is no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});