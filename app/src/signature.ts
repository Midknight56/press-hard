/** Most points one signature may hold. Matches the limit of `validateRecord`. */
export const MAX_SIGNATURE_POINTS = 4000;

export interface SignatureBox {
  /** Each stroke is x0,y0,x1,y1,... with integers 0 to 1000. A copy. */
  strokes(): number[][];
  clear(): void;
  isEmpty(): boolean;
  destroy(): void;
}

const clamp = (n: number) => Math.min(1000, Math.max(0, n));

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SignatureOptions {
  /** Called once when the 4000 point limit is reached. */
  onLimit?: () => void;
  /** Called when a stroke ends and when the box is cleared. */
  onChange?: () => void;
  /** Strokes already signed, kept and added to. */
  initial?: number[][];
}

export function createSignatureBox(element: HTMLElement, options: SignatureOptions = {}): SignatureBox {
  let strokes: number[][] = (options.initial ?? []).map((s) => [...s]);
  let points = strokes.reduce((sum, s) => sum + Math.floor(s.length / 2), 0);
  let current: number[] | null = null;
  let currentLine: SVGPolylineElement | null = null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'signature');
  svg.setAttribute('aria-hidden', 'true');
  element.append(svg);

  const pointsText = (stroke: number[]) => {
    const list: string[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) list.push(`${stroke[i]},${stroke[i + 1]}`);
    return list.join(' ');
  };
  const newLine = (stroke: number[]) => {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', pointsText(stroke));
    svg.append(line);
    return line;
  };
  for (const stroke of strokes) newLine(stroke);
  let limitSaid = false;
  let destroyed = false;

  element.style.touchAction = 'none';

  function scaled(event: MouseEvent): [number, number] {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return [0, 0];
    return [
      clamp(Math.round(((event.clientX - box.left) * 1000) / box.width)),
      clamp(Math.round(((event.clientY - box.top) * 1000) / box.height)),
    ];
  }

  function full(): boolean {
    if (points < MAX_SIGNATURE_POINTS) return false;
    if (!limitSaid) {
      limitSaid = true;
      options.onLimit?.();
    }
    return true;
  }

  function add(event: MouseEvent, stroke: number[]): void {
    const [x, y] = scaled(event);
    stroke.push(x, y);
    points += 1;
    currentLine?.setAttribute('points', pointsText(stroke));
  }

  const down = (event: Event) => {
    const e = event as PointerEvent;
    if (full()) return;
    current = [];
    strokes.push(current);
    currentLine = newLine(current);
    add(e, current);
    const id = e.pointerId;
    if (typeof id === 'number' && typeof element.setPointerCapture === 'function') {
      try {
        element.setPointerCapture(id);
      } catch {
        // A pointer that is already gone cannot be captured. Drawing still works.
      }
    }
  };
  const move = (event: Event) => {
    if (current === null || full()) return;
    add(event as PointerEvent, current);
  };
  const end = () => {
    if (current === null) return;
    current = null;
    currentLine = null;
    options.onChange?.();
  };

  const handlers: [string, (e: Event) => void][] = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', end],
    ['pointercancel', end],
    ['pointerleave', end],
  ];
  for (const [type, handler] of handlers) element.addEventListener(type, handler);

  return {
    strokes: () => strokes.map((s) => [...s]),
    clear() {
      strokes = [];
      points = 0;
      current = null;
      currentLine = null;
      limitSaid = false;
      svg.replaceChildren();
      options.onChange?.();
    },
    isEmpty: () => points === 0,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const [type, handler] of handlers) element.removeEventListener(type, handler);
      current = null;
      currentLine = null;
    },
  };
}