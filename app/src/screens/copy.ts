import type { HandoverRecord } from 'core';
import { renderForm } from '../form/index.js';

export interface CopyOptions {
  record: HandoverRecord;
  reducedMotion: boolean;
  onTearOff?: () => void;
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
  if (options.onLibrary) actions.append(action('library', 'Library', options.onLibrary));
  if (options.onNew) actions.append(action('new-form', 'New form', options.onNew));
  element.append(actions);
  return { element };
}