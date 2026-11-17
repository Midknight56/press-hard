import { describe, expect, it } from 'vitest';
import {
  centreOffset,
  findCentreProblems,
  findFirstViewProblems,
  findLayoutProblems,
  findPictureProblems,
  rectsOverlap,
  REQUIRED_FIRST_VIEW,
  type ControlBox,
  type FirstViewItem,
} from '../src/layout.js';

const view = { width: 390, height: 844 };
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const control = (name: string, x: number, y: number): ControlBox => ({ name, x, y, width: 100, height: 48, padding: null });
const sheet = (name: string, x: number, y: number, w: number, h: number): ControlBox => ({
  name,
  x,
  y,
  width: w,
  height: h,
  padding: null,
  kind: 'box',
});

describe('findLayoutProblems, sheets, cards and panels', () => {
  it('names a sheet that is less than 16 px from the left or right edge', () => {
    const problems = findLayoutProblems([sheet('left', 12, 100, 300, 400), sheet('right', 16, 600, 390 - 16 - 16 + 6, 400)], view, 2000);
    expect(problems.map((p) => p.control)).toEqual(['left', 'right']);
    expect(problems[0]?.problem).toContain('left edge');
    expect(problems[1]?.problem).toContain('right edge');
  });

  it('accepts a sheet exactly 16 px from both edges, and does not apply the size, padding or gap rules to it', () => {
    const small = sheet('badge', 16, 100, 30, 20);
    const behind = sheet('behind', 16, 110, 358, 400);
    expect(findLayoutProblems([sheet('top', 16, 100, 358, 400), small, behind, control('c', 40, 120)], view, 2000)).toEqual([]);
  });
});

describe('rectsOverlap', () => {
  it('is true when two boxes share area and false when they only touch or are apart', () => {
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(49, 10, 20, 20))).toBe(true);
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(50, 0, 20, 20))).toBe(false);
    expect(rectsOverlap(rect(0, 0, 50, 50), rect(0, 60, 20, 20))).toBe(false);
  });
});

describe('findPictureProblems', () => {
  it('accepts a picture beside its label', () => {
    expect(findPictureProblems([{ control: 'fill/stamp', picture: rect(12, 10, 40, 40), label: rect(64, 20, 100, 20), background: false }])).toEqual([]);
  });

  it('names a picture that sits on top of the label', () => {
    const problems = findPictureProblems([{ control: 'fill/stamp', picture: rect(12, 10, 48, 48), label: rect(40, 20, 100, 20), background: false }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.control).toBe('fill/stamp');
    expect(problems[0]?.problem).toContain('overlaps');
  });

  it('names a picture drawn as a background image, which cannot be measured', () => {
    const problems = findPictureProblems([{ control: 'fill/stamp', picture: null, label: rect(40, 20, 100, 20), background: true }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.problem).toContain('background');
  });
});

describe('centreOffset and findCentreProblems', () => {
  it('measures how far the middle of a column is from the middle of the view', () => {
    expect(centreOffset(608, 1312, 1920)).toBe(0);
    expect(centreOffset(624, 1280, 1920)).toBe(-8);
    expect(centreOffset(16, 344, 360)).toBe(0);
  });

  it('accepts a column and boxes within 2 px of the middle and names the ones that are off', () => {
    expect(findCentreProblems('pick', { left: 608, right: 1312 }, { left: 640, right: 1281.5 }, 1920)).toEqual([]);
    const problems = findCentreProblems('pick', { left: 600, right: 1300 }, { left: 624, right: 1280 }, 1920);
    expect(problems.map((p) => p.control)).toEqual(['pick/column', 'pick/boxes']);
    expect(problems[0]?.problem).toContain('centre');
  });

  it('skips the boxes when the screen has none', () => {
    expect(findCentreProblems('help', { left: 608, right: 1312 }, null, 1920)).toEqual([]);
  });
});

describe('findFirstViewProblems', () => {
  const small = { width: 360, height: 640 };
  const item = (name: string, rule: FirstViewItem['rule'], top: number, bottom: number): FirstViewItem => ({ name, rule, top, bottom });

  it('requires the marks the screen standards ask for', () => {
    expect(REQUIRED_FIRST_VIEW['pick']).toEqual(['pick-rental-return', 'pick-key-handover', 'pick-sold-as-seen', 'pick-blank', 'pick-sample', 'pick-preview']);
    expect(REQUIRED_FIRST_VIEW['fill']).toEqual(['stamp']);
    expect(REQUIRED_FIRST_VIEW['copy']).toEqual(['seal-stamp', 'seal-words', 'carbon-sheet']);
    expect(findFirstViewProblems('help', [], small)).toEqual([]);
  });

  it('names a required mark that is missing', () => {
    const problems = findFirstViewProblems('fill', [], small);
    expect(problems.map((p) => p.control)).toEqual(['fill/stamp']);
    expect(problems[0]?.problem).toContain('no mark');
  });

  it('names a whole item that is cut off or less than 16 px from the bottom', () => {
    expect(findFirstViewProblems('fill', [item('stamp', 'whole', 500, 624)], small)).toEqual([]);
    const cut = findFirstViewProblems('fill', [item('stamp', 'whole', 600, 660)], small);
    expect(cut).toHaveLength(1);
    expect(cut[0]?.problem).toContain('first view');
    expect(findFirstViewProblems('fill', [item('stamp', 'whole', 570, 625)], small)).toHaveLength(1);
  });

  it('wants the start of a tall item in view and names one that starts below the view', () => {
    const copy = (carbonTop: number) => [
      item('seal-stamp', 'whole', 120, 180),
      item('seal-words', 'whole', 190, 220),
      item('carbon-sheet', 'start', carbonTop, carbonTop + 1200),
    ];
    expect(findFirstViewProblems('copy', copy(240), small)).toEqual([]);
    expect(findFirstViewProblems('copy', copy(620), small).map((p) => p.control)).toEqual(['copy/carbon-sheet']);
    expect(findFirstViewProblems('copy', copy(700), small).map((p) => p.control)).toEqual(['copy/carbon-sheet']);
  });

  it('names a preview that is not below every form choice', () => {
    const names = ['pick-rental-return', 'pick-key-handover', 'pick-sold-as-seen', 'pick-blank', 'pick-sample'];
    const choices = names.map((n, i) => item(n, 'whole', 100 + i * 60, 144 + i * 60));
    expect(findFirstViewProblems('pick', [...choices, item('pick-preview', 'after', 400, 1400)], small)).toEqual([]);
    const above = findFirstViewProblems('pick', [...choices, item('pick-preview', 'after', 80, 1000)], small);
    expect(above.map((p) => p.control)).toEqual(['pick/pick-preview']);
    expect(above[0]?.problem).toContain('below');
  });
});
