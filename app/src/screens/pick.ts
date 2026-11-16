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

/** The first screen: the picture of a form, then the four forms and the sample. */
export function createPickScreen(options: PickOptions): { element: HTMLElement } {
  const element = document.createElement('main');
  element.className = 'screen pick';
  element.setAttribute('data-screen', 'pick');

  const preview = document.createElement('div');
  preview.className = 'pick-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.append(renderForm(sampleRecord, { mode: 'top' }));

  const title = document.createElement('h1');
  title.textContent = appConfig.title;

  const instruction = document.createElement('p');
  instruction.setAttribute('data-role', 'instruction');
  instruction.textContent = 'Pick a form to start';

  const list = document.createElement('div');
  list.className = 'pick-list';
  for (const template of templates) {
    list.append(button(`pick-${template.id}`, template.title, () => options.onPick(template.id)));
  }
  const sample = button('pick-sample', 'Sample: filled rental return', options.onSample);
  sample.className = 'sample';

  element.append(preview, title, instruction, list, sample);
  return { element };
}