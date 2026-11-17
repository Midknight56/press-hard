import { HELP_LINES } from '../hints.js';

/** The help screen. Every instruction lives here after it has shown three times. */
export function createHelpScreen(): { element: HTMLElement } {
  const element = document.createElement('main');
  element.className = 'screen help';
  element.setAttribute('data-screen', 'help');
  const title = document.createElement('h1');
  title.textContent = 'Help';
  const list = document.createElement('ol');
  for (const line of HELP_LINES) {
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  }
  element.append(title, list);
  return { element };
}
