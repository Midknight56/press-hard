export interface StampOptions {
  holdMs: number;
  /** Called once when a hold reaches holdMs. */
  onSeal(): void;
  reducedMotion: boolean;
  /** When it returns false a press starts nothing. Default: always true. */
  enabled?: () => boolean;
}

const TICK_MS = 20;
const HOLD_KEYS = [' ', 'Enter'];

/**
 * Press and hold control. The meter is the `data-progress` attribute (0 to 1) and the CSS variable
 * `--progress`. A release of any kind (pointer up, cancel, leave, blur, key up) empties the meter.
 */
export function createStamp(element: HTMLElement, options: StampOptions): { destroy(): void } {
  let holding = false;
  let sealed = false;
  let startedAt = 0;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let finisher: ReturnType<typeof setTimeout> | null = null;

  element.setAttribute('data-motion', options.reducedMotion ? 'reduced' : 'full');

  const show = (progress: number) => {
    const text = String(Math.round(progress * 1000) / 1000);
    element.setAttribute('data-progress', text);
    element.style.setProperty('--progress', text);
  };

  const stopTimers = () => {
    if (ticker !== null) clearInterval(ticker);
    if (finisher !== null) clearTimeout(finisher);
    ticker = null;
    finisher = null;
  };

  const finish = () => {
    if (!holding || sealed) return;
    sealed = true;
    stopTimers();
    show(1);
    options.onSeal();
  };

  const start = () => {
    if (holding) return;
    if (options.enabled !== undefined && !options.enabled()) return;
    holding = true;
    sealed = false;
    startedAt = performance.now();
    show(0);
    ticker = setInterval(() => {
      if (!holding || sealed) return;
      const progress = Math.min(1, (performance.now() - startedAt) / options.holdMs);
      if (progress >= 1) finish();
      else show(progress);
    }, TICK_MS);
    finisher = setTimeout(finish, options.holdMs);
  };

  const release = () => {
    holding = false;
    sealed = false;
    stopTimers();
    show(0);
  };

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (!HOLD_KEYS.includes(e.key)) return;
    if (e.preventDefault) e.preventDefault();
    if (e.repeat) return;
    start();
  };
  const onKeyUp = (event: Event) => {
    if (HOLD_KEYS.includes((event as KeyboardEvent).key)) release();
  };

  const handlers: [string, (e: Event) => void][] = [
    ['pointerdown', start],
    ['pointerup', release],
    ['pointercancel', release],
    ['pointerleave', release],
    ['blur', release],
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
  ];
  for (const [type, handler] of handlers) element.addEventListener(type, handler);
  show(0);

  return {
    destroy() {
      for (const [type, handler] of handlers) element.removeEventListener(type, handler);
      holding = false;
      stopTimers();
    },
  };
}