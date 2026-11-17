import { appConfig } from '../../app.config.js';
import { renderForm } from '../form/index.js';
import { templates } from '../templates/index.js';
import { sampleRecord } from '../templates/sample.js';

export interface PickOptions {
  onPick(templateId: string): void;
  onSample(): void;
}

function button(control: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('data-control', control);
  b.addEventListener('click', onClick);
  return b;
}

/**
 * The first screen. The picture of a form stays first in the markup, but it is hidden from readers
 * of the screen and app.css draws it below the four forms and the sample, so the choices are in view first.
 */
export function createPickScreen(options: PickOptions): { element: HTMLElement } {
  const element = document.createElement('main');
  element.className = 'screen pick';
  element.setAttribute('data-screen', 'pick');

  const preview = document.createElement('div');
  preview.className = 'pick-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('data-first-view', 'after');
  preview.setAttribute('data-role', 'pick-preview');
  preview.append(renderForm(sampleRecord, { mode: 'top' }));

  const title = document.createElement('h1');
  title.textContent = appConfig.title;

  const instruction = document.createElement('p');
  instruction.setAttribute('data-role', 'instruction');
  instruction.textContent = 'Pick a form to start';

  const list = document.createElement('div');
  list.className = 'pick-list';
  for (const template of templates) {
    const b = button(`pick-${template.id}`, template.title, () => options.onPick(template.id));
    b.setAttribute('data-first-view', 'whole');
    list.append(b);
  }
  const sample = button('pick-sample', 'Sample: filled rental return', options.onSample);
  sample.className = 'sample';
  sample.setAttribute('data-first-view', 'whole');

  element.append(preview, title, instruction, list, sample);
  return { element };
}