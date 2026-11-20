import type { HandoverRecord } from 'core';
import { sealWords } from 'core';
import { renderForm, stampImpression } from '../form/index.js';

export interface CopyOptions {
  record: HandoverRecord;
  reducedMotion: boolean;
  onTearOff?: () => void;
  onTamper?: () => void;
  onPrint?: () => void;
  onNew?: () => void;
  onLibrary?: () => void;
}

function action(control: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('data-control', control);
  b.addEventListener('click', onClick);
  return b;
}

/** True from 900 px wide, where the copy screen shows the banner card and the copies end side by side after the tear off. */
function wideScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 900px)').matches;
}

function sheetLabel(text: string): HTMLElement {
  const label = document.createElement('p');
  label.className = 'sheet-label';
  label.textContent = text;
  return label;
}

/**
 * The top sheet peels up and to the left to show the whole carbon copy, holds, and settles at its rest place. With reduced motion nothing peels and the
 * carbon copy appears with a plain fade at its rest place.
 */
export function createCopyScreen(options: CopyOptions): { element: HTMLElement } {
  const { record, reducedMotion } = options;
  if (record.seal === undefined) throw new TypeError('createCopyScreen: the record has no seal');

  const element = document.createElement('main');
  element.className = 'screen copy';
  element.setAttribute('data-screen', 'copy');
  const pageTitle = document.createElement('h1');
  pageTitle.className = 'sr-only';
  pageTitle.textContent = 'Your sealed copy';
  element.append(pageTitle);
  element.setAttribute('data-motion', reducedMotion ? 'reduced' : 'full');

  // The seal strip: the stamp picture and the four seal words, above the sheets, so that they are in the first view.
  const strip = document.createElement('div');
  strip.className = 'seal-strip';
  strip.setAttribute('data-box', 'panel');
  const stripArt = document.createElement('span');
  stripArt.className = 'seal-stamp';
  stripArt.setAttribute('data-art', 'stamp');
  stripArt.setAttribute('data-role', 'seal-stamp');
  stripArt.setAttribute('data-first-view', 'whole');
  stripArt.setAttribute('aria-hidden', 'true');
  // The 72 px stamp mark of the sealed banner shows from 900 px wide. A phone's pinned bar has no room for it, so it is not made there.
  if (wideScreen()) stripArt.append(stampImpression(record.sealedAt));
  const stripText = document.createElement('p');
  stripText.className = 'seal-strip-text';
  stripText.append('Sealed. Seal words: ');
  const stripWords = document.createElement('strong');
  stripWords.setAttribute('data-role', 'seal-words');
  stripWords.setAttribute('data-first-view', 'whole');
  stripWords.textContent = sealWords(record.seal);
  stripText.append(stripWords);
  strip.append(stripArt, stripText);
  // The pinned bar of a phone (and the banner of a wide screen): the seal strip and the swap control.
  const sealBar = document.createElement('div');
  sealBar.className = 'seal-bar';
  sealBar.setAttribute('data-sticky', 'true');
  sealBar.append(strip);
  element.append(sealBar);

  // A person sees both sheets. The swap control (narrow screens) brings the other one to the front, with no motion.
  const sheets = document.createElement('div');
  sheets.className = 'sheets';
  sheets.setAttribute('data-front', 'top');
  const carbon = document.createElement('div');
  carbon.className = reducedMotion ? 'carbon-sheet rest fade' : 'carbon-sheet rest ink';
  carbon.setAttribute('data-role', 'carbon-sheet');
  carbon.setAttribute('data-first-view', 'start');
  carbon.append(sheetLabel('Carbon copy'), renderForm(record, { mode: 'carbon' }));
  const top = document.createElement('div');
  top.className = reducedMotion ? 'top-sheet rest' : 'top-sheet rest lift peel';
  // The roll lies over the fold of the clipped top copy. It is decoration, drawn by CSS.
  const roll = document.createElement('span');
  roll.className = 'roll';
  roll.setAttribute('aria-hidden', 'true');
  top.append(sheetLabel('Top copy'), renderForm(record, { mode: 'top' }), roll);
  sheets.append(carbon, top);

  const swap = document.createElement('input');
  swap.type = 'button';
  swap.value = 'Show carbon copy';
  swap.setAttribute('data-control', 'swap-sheets');
  swap.addEventListener('click', () => {
    const next = sheets.getAttribute('data-front') === 'top' ? 'carbon' : 'top';
    sheets.setAttribute('data-front', next);
    swap.value = next === 'top' ? 'Show carbon copy' : 'Show top copy';
  });
  const switcher = document.createElement('div');
  switcher.className = 'sheet-switch';
  switcher.append(swap);
  sealBar.append(switcher);
  element.append(sheets);

  const edge = document.createElement('div');
  edge.className = 'tear-edge';
  edge.setAttribute('aria-hidden', 'true');
  element.append(edge);

  const actions = document.createElement('div');
  actions.className = 'copy-actions';
  // Tear off the copy and Print are the bar at the bottom of a phone.
  const bar = document.createElement('div');
  bar.className = 'copy-bar';
  bar.setAttribute('data-sticky', 'true');
  actions.append(bar);
  if (options.onTearOff) {
    const tearOff = options.onTearOff;
    // The tear off motion (the perforation opens, the copy slides out and settles) is a class for 0.7 s. With reduced motion there is none.
    bar.append(
      action('tear-off', 'Tear off the copy', () => {
        if (!reducedMotion) {
          element.classList.add('tearing');
          setTimeout(() => element.classList.remove('tearing'), 700);
        }
        // On a wide screen the two copies end side by side.
        if (wideScreen()) element.classList.add('torn');
        tearOff();
      }),
    );
  }
  if (options.onPrint) bar.append(action('print', 'Print', options.onPrint));
  if (options.onTamper) actions.append(action('tamper', 'Try to change this copy', options.onTamper));
  if (options.onLibrary) actions.append(action('library', 'Library', options.onLibrary));
  if (options.onNew) actions.append(action('new-form', 'New form', options.onNew));
  element.append(actions);

  // The page foot of the print layout: the seal words and the full seal. Hidden on screen.
  const foot = document.createElement('footer');
  foot.className = 'print-foot';
  const words = document.createElement('p');
  words.append('Seal words: ');
  const wordsText = document.createElement('strong');
  wordsText.setAttribute('data-role', 'print-words');
  wordsText.textContent = sealWords(record.seal);
  words.append(wordsText);
  const full = document.createElement('p');
  full.append('Seal: ');
  const sealText = document.createElement('code');
  sealText.setAttribute('data-role', 'print-seal');
  sealText.textContent = record.seal;
  full.append(sealText);
  foot.append(words, full);
  element.append(foot);

  // The same two lines in the bottom margin of every printed page (a page margin box).
  const css = (text: string) => JSON.stringify(text);
  const marginBox = document.createElement('style');
  marginBox.setAttribute('data-role', 'print-style');
  marginBox.textContent =
    `@page { @bottom-center { content: ${css('Seal words: ' + sealWords(record.seal))} "\\A " ${css('Seal: ' + record.seal)}; white-space: pre; font-size: 8pt; color: #000; vertical-align: top; padding-top: 3mm; } }`;
  element.append(marginBox);
  return { element };
}