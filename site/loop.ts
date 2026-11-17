import { sealRecord, type HandoverRecord } from 'core';
import { createCopyScreen } from '../app/src/screens/copy.js';
import { createFillScreen } from '../app/src/screens/fill.js';
import { createTamperScreen } from '../app/src/screens/tamper.js';
import { createStamp } from '../app/src/stamp.js';
import { openStore } from '../app/src/store.js';
import { rentalReturn } from '../app/src/templates/rental-return.js';
import { sampleRecord } from '../app/src/templates/sample.js';

export interface LoopOptions {
  host: HTMLElement;
  caption: HTMLElement;
  reducedMotion: boolean;
  /** The device clock. */
  now?: () => Date;
}

const isoSeconds = (date: Date) => date.toISOString().replace(/\.\d+Z$/, 'Z');

function sealedSample(now: () => Date): HandoverRecord {
  const result = sealRecord(structuredClone(sampleRecord), isoSeconds(now()));
  if (!result.ok) throw new Error(result.problems.join('; '));
  return result.record;
}

/** Edits the first line of the tamper screen the way a person would, so that the broken seal shows. */
function changeOneLine(tamper: HTMLElement): void {
  const input = tamper.querySelector<HTMLInputElement>('[data-control="field-item"]');
  if (input === null) return;
  input.value = 'Cargo trailer, 3 m';
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * The loop of the landing page, made from the real screens: the sample form is pressed, the copy
 * appears, one line is changed and the seal breaks. It is for looking only: the host is inert.
 * With reduced motion it shows the last two steps next to each other and does not move.
 */
export async function startLoop(options: LoopOptions): Promise<{ stop(): void }> {
  const { host, caption } = options;
  const now = options.now ?? (() => new Date());
  host.setAttribute('inert', '');
  const store = await openStore({ idb: null });
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopped = false;
  let cleanup: (() => void) | null = null;

  const later = (ms: number, work: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!stopped) work();
    }, ms);
    timers.add(id);
  };
  const show = (element: HTMLElement, text: string, destroy?: () => void) => {
    cleanup?.();
    cleanup = destroy ?? null;
    host.replaceChildren(element);
    caption.textContent = text;
  };

  if (options.reducedMotion) {
    const record = sealedSample(now);
    const wrap = document.createElement('div');
    wrap.className = 'loop-static';
    const copy = createCopyScreen({ record, reducedMotion: true });
    const tamper = createTamperScreen({ record, onBack: () => undefined });
    changeOneLine(tamper.element);
    wrap.append(copy.element, tamper.element);
    host.replaceChildren(wrap);
    caption.textContent = 'The copy, then one changed line';
    return { stop: () => undefined };
  }

  function play(): void {
    const fill = createFillScreen({ template: rentalReturn, store, draftId: 'loop', initialRecord: structuredClone(sampleRecord) });
    let record: HandoverRecord | null = null;
    const stamp = createStamp(fill.stampButton, {
      holdMs: 1200,
      reducedMotion: false,
      enabled: () => !fill.isLocked(),
      onSeal: () => {
        record = sealedSample(now);
      },
    });
    show(fill.element, 'Press and hold the stamp', () => {
      stamp.destroy();
      fill.destroy();
    });
    later(900, () => fill.stampButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    later(2300, () => {
      const sealed = record ?? sealedSample(now);
      show(createCopyScreen({ record: sealed, reducedMotion: false }).element, 'The copy appears under it');
      later(3200, () => {
        const tamper = createTamperScreen({ record: sealed, onBack: () => undefined });
        show(tamper.element, 'Try to change one line');
        later(1400, () => {
          changeOneLine(tamper.element);
          caption.textContent = 'The seal breaks. The line shows.';
          later(3600, play);
        });
      });
    });
  }
  play();

  return {
    stop() {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      cleanup?.();
      cleanup = null;
    },
  };
}
