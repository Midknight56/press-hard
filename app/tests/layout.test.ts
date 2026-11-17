import { describe, expect, it } from 'vitest';
import { contrastRatio, findLayoutProblems, parseColor, VIEWPORTS, type ControlBox } from '../src/layout.js';

const view = { width: 390, height: 844 };
const box = (name: string, x: number, y: number, w = 100, h = 48, extra: Partial<ControlBox> = {}): ControlBox => ({
  name,
  x,
  y,
  width: w,
  height: h,
  padding: null,
  ...extra,
});

describe('VIEWPORTS', () => {
  it('lists the 7 sizes of the screen standards', () => {
    expect(VIEWPORTS.map((v) => `${v.width}x${v.height}`)).toEqual([
      '360x640',
      '375x667',
      '390x844',
      '412x915',
      '768x1024',
      '1280x720',
      '1920x1080',
    ]);
  });
});

describe('findLayoutProblems', () => {
  it('accepts controls that fit', () => {
    expect(findLayoutProblems([box('a', 16, 16), box('b', 16, 76)], view, 2000)).toEqual([]);
  });

  it('names a control that is smaller than 44 px', () => {
    const problems = findLayoutProblems([box('tiny', 16, 16, 43, 48), box('flat', 16, 80, 100, 43.5)], view, 2000);
    expect(problems.map((p) => p.control)).toEqual(['tiny', 'flat']);
    expect(problems[0]?.problem).toContain('44');
  });

  it('accepts a control of exactly 44 by 44', () => {
    expect(findLayoutProblems([box('a', 16, 16, 44, 44)], view, 2000)).toEqual([]);
  });

  it('names a control that is less than 16 px from an edge', () => {
    const problems = findLayoutProblems(
      [box('left', 15, 100), box('right', 390 - 16 - 99, 200), box('top', 100, 15), box('far', 100, 2000 - 16 - 47)],
      view,
      2000,
    );
    expect(problems.map((p) => p.control)).toEqual(['left', 'right', 'top', 'far']);
  });

  it('accepts a control exactly 16 px from the edges', () => {
    expect(findLayoutProblems([box('a', 16, 16, 358, 48), box('b', 16, 2000 - 16 - 48, 358, 48)], view, 2000)).toEqual([]);
  });

  it('names two controls that are less than 12 px apart and two that overlap', () => {
    const near = findLayoutProblems([box('a', 16, 16), box('b', 16, 16 + 48 + 11)], view, 2000);
    expect(near).toHaveLength(1);
    expect(near[0]?.control).toBe('b');
    expect(near[0]?.problem).toContain('a');
    const overlap = findLayoutProblems([box('a', 16, 16), box('b', 60, 30)], view, 2000);
    expect(overlap).toHaveLength(1);
  });

  it('accepts two controls exactly 12 px apart, side by side or one above the other', () => {
    expect(findLayoutProblems([box('a', 16, 16), box('b', 128, 16), box('c', 16, 76)], view, 2000)).toEqual([]);
  });

  it('names a button with less than 8 px padding', () => {
    const problems = findLayoutProblems([box('b', 16, 16, 100, 48, { padding: { top: 8, right: 7.9, bottom: 8, left: 8 } })], view, 2000);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.problem).toContain('padding');
    expect(
      findLayoutProblems([box('b', 16, 16, 100, 48, { padding: { top: 8, right: 8, bottom: 8, left: 8 } })], view, 2000),
    ).toEqual([]);
  });
});

describe('parseColor', () => {
  it('reads rgb and rgba text from a browser', () => {
    expect(parseColor('rgb(255, 253, 248)')).toEqual({ r: 255, g: 253, b: 248, a: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('returns null for text it cannot read', () => {
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor('color(display-p3 1 0 0)')).toBeNull();
  });
});

describe('contrastRatio', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  it('is 21 for black on white and 1 for the same colour', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('matches the known value for grey 767676 on white (4.54)', () => {
    expect(contrastRatio({ r: 0x76, g: 0x76, b: 0x76, a: 1 }, white)).toBeCloseTo(4.54, 2);
  });

  it('is below 4.5 for grey 777777 on white', () => {
    expect(contrastRatio({ r: 0x77, g: 0x77, b: 0x77, a: 1 }, white)).toBeLessThan(4.5);
  });
});
