import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignatureBox } from '../src/signature.js';

let box: HTMLElement;
let api: ReturnType<typeof createSignatureBox>;
let onLimit: ReturnType<typeof vi.fn<() => void>>;

function rect(width: number, height: number, left = 0, top = 0): DOMRect {
  return { width, height, left, top, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}
function pointer(type: string, x: number, y: number): void {
  box.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  box.getBoundingClientRect = () => rect(200, 100);
  onLimit = vi.fn<() => void>();
  api = createSignatureBox(box, { onLimit });
});
afterEach(() => {
  api.destroy();
  box.remove();
});

describe('signature scaling, box 200 by 100 px', () => {
  it.each([
    [0, 0, 0, 0],
    [100, 50, 500, 500],
    [150, 25, 750, 250],
    [200, 100, 1000, 1000],
    [-5, 120, 0, 1000],
  ])('point (%d,%d) gives (%d,%d)', (x, y, ex, ey) => {
    pointer('pointerdown', x, y);
    pointer('pointerup', x, y);
    expect(api.strokes()).toEqual([[ex, ey]].map(([a, b]) => [a, b]));
  });

  it('subtracts the position of the box on the page', () => {
    box.getBoundingClientRect = () => rect(200, 100, 40, 300);
    pointer('pointerdown', 140, 350);
    expect(api.strokes()).toEqual([[500, 500]]);
  });

  it('rounds to whole numbers', () => {
    pointer('pointerdown', 33.4, 33.4);
    const [x, y] = api.strokes()[0] as number[];
    expect(Number.isInteger(x)).toBe(true);
    expect(x).toBe(167);
    expect(y).toBe(334);
  });

  it('does not divide by zero for a box with no size', () => {
    box.getBoundingClientRect = () => rect(0, 0);
    pointer('pointerdown', 10, 10);
    expect(api.strokes()).toEqual([[0, 0]]);
  });
});

describe('signature strokes', () => {
  it('makes one stroke for each pointer down, with the points in order', () => {
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 100, 50);
    pointer('pointerup', 100, 50);
    pointer('pointerdown', 200, 100);
    pointer('pointermove', 100, 50);
    pointer('pointerup', 100, 50);
    expect(api.strokes()).toEqual([
      [0, 0, 500, 500],
      [1000, 1000, 500, 500],
    ]);
  });

  it('ignores a move with no pointer down and a move after the pointer went up', () => {
    pointer('pointermove', 100, 50);
    pointer('pointerdown', 0, 0);
    pointer('pointerup', 0, 0);
    pointer('pointermove', 100, 50);
    expect(api.strokes()).toEqual([[0, 0]]);
  });

  it('ends the stroke on pointercancel and pointerleave', () => {
    pointer('pointerdown', 0, 0);
    pointer('pointercancel', 0, 0);
    pointer('pointermove', 100, 50);
    pointer('pointerdown', 0, 0);
    pointer('pointerleave', 0, 0);
    pointer('pointermove', 100, 50);
    expect(api.strokes()).toEqual([[0, 0], [0, 0]]);
  });

  it('is empty at first, not empty after a point, and empty after clear', () => {
    expect(api.isEmpty()).toBe(true);
    pointer('pointerdown', 10, 10);
    expect(api.isEmpty()).toBe(false);
    api.clear();
    expect(api.isEmpty()).toBe(true);
    expect(api.strokes()).toEqual([]);
  });

  it('returns a copy that the caller cannot use to change the box', () => {
    pointer('pointerdown', 100, 50);
    (api.strokes()[0] as number[])[0] = 999;
    expect(api.strokes()).toEqual([[500, 500]]);
  });

  it('does nothing after destroy', () => {
    api.destroy();
    pointer('pointerdown', 100, 50);
    expect(api.strokes()).toEqual([]);
  });
});

describe('signature limit of 4000 points', () => {
  function draw(points: number): void {
    pointer('pointerdown', 0, 0);
    for (let i = 1; i < points; i++) pointer('pointermove', i % 200, i % 100);
    pointer('pointerup', 0, 0);
  }

  it('keeps 4000 points and ignores the 4001st', () => {
    draw(4001);
    const total = api.strokes().reduce((sum, s) => sum + s.length / 2, 0);
    expect(total).toBe(4000);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it('does not call onLimit at exactly 4000 points', () => {
    draw(4000);
    expect(api.strokes().reduce((sum, s) => sum + s.length / 2, 0)).toBe(4000);
    expect(onLimit).not.toHaveBeenCalled();
  });

  it('counts points over all strokes and starts no new stroke once full', () => {
    draw(4000);
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 20, 20);
    expect(api.strokes()).toHaveLength(1);
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it('takes input again after clear', () => {
    draw(4001);
    api.clear();
    draw(10);
    expect(api.strokes().reduce((sum, s) => sum + s.length / 2, 0)).toBe(10);
  });
});
describe('signature box, starting strokes, change callback and drawing', () => {
  it('starts from given strokes and adds to them', () => {
    api.destroy();
    box.getBoundingClientRect = () => rect(200, 100);
    api = createSignatureBox(box, { initial: [[10, 20, 30, 40]] });
    expect(api.isEmpty()).toBe(false);
    pointer('pointerdown', 100, 50);
    expect(api.strokes()).toEqual([[10, 20, 30, 40], [500, 500]]);
  });

  it('calls onChange when a stroke ends and when the box is cleared, not for each move', () => {
    api.destroy();
    const onChange = vi.fn<() => void>();
    api = createSignatureBox(box, { onChange });
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 100, 50);
    expect(onChange).not.toHaveBeenCalled();
    pointer('pointerup', 100, 50);
    expect(onChange).toHaveBeenCalledTimes(1);
    pointer('pointerup', 100, 50);
    expect(onChange).toHaveBeenCalledTimes(1);
    api.clear();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('draws one polyline for each stroke inside the box while the pointer moves', () => {
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 100, 50);
    expect(box.querySelectorAll('svg polyline')).toHaveLength(1);
    expect(box.querySelector('polyline')?.getAttribute('points')).toBe('0,0 500,500');
    pointer('pointerup', 100, 50);
    pointer('pointerdown', 200, 100);
    expect(box.querySelectorAll('svg polyline')).toHaveLength(2);
    api.clear();
    expect(box.querySelectorAll('svg polyline')).toHaveLength(0);
  });
});