import type { HandoverRecord } from 'core';
import { sealWords } from 'core';
import { renderForm } from '../form/index.js';

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

/**
 * The top sheet lifts to show the carbon copy under it. With reduced motion nothing lifts and the
 * copy appears with a plain fade.
 */
export function createCopyScreen(options: CopyOptions): { element: HTMLElement } {
  const { record, reducedMotion } = options;
  if (record.seal === undefined) throw new TypeError('createCopyScreen: the record has no seal');

  const element = document.createElement('main');
  element.className = 'screen copy';
  element.setAttribute('data-screen', 'copy');
  element.setAttribute('data-motion', reducedMotion ? 'reduced' : 'full');

  const sheets = document.createElement('div');
  sheets.className = 'sheets';
  const carbon = document.createElement('div');
  carbon.className = reducedMotion ? 'carbon-sheet fade' : 'carbon-sheet';
  carbon.append(renderForm(record, { mode: 'carbon' }));
  const top = document.createElement('div');
  top.className = reducedMotion ? 'top-sheet' : 'top-sheet lift';
  top.append(renderForm(record, { mode: 'top' }));
  sheets.append(carbon, top);
  element.append(sheets);

  const actions = document.createElement('div');
  actions.className = 'copy-actions';
  if (options.onTearOff) actions.append(action('tear-off', 'Tear off the copy', options.onTearOff));
  if (options.onPrint) actions.append(action('print', 'Print', options.onPrint));
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