import { appConfig } from '../app.config.js';
import type { Audio } from './audio.js';

export interface NavOptions {
  /** Where the other page is, relative to this page. */
  verifyHref: string;
  appHref: string;
  /** Which page this bar is on. */
  page: 'app' | 'verify';
  onHome?: () => void;
  onLibrary?: () => void;
  onHelp?: () => void;
  audio?: Audio;
}

function button(control: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('data-control', control);
  b.addEventListener('click', onClick);
  return b;
}

function link(control: string, text: string, href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  a.className = 'nav-link';
  a.setAttribute('data-control', control);
  return a;
}

/** The bar at the top of every page, and the one line that says drafts will not be kept. */
export function createNav(options: NavOptions): { element: HTMLElement; notice(message: string): void } {
  const element = document.createElement('header');
  element.className = 'bar';
  const brand = document.createElement('p');
  brand.className = 'brand';
  brand.textContent = appConfig.title;
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main');
  if (options.page === 'app') {
    nav.append(
      button('nav-home', 'Forms', () => options.onHome?.()),
      button('nav-library', 'Library', () => options.onLibrary?.()),
      button('nav-help', 'Help', () => options.onHelp?.()),
      link('nav-verify', 'Check a copy', options.verifyHref),
    );
  } else {
    nav.append(link('nav-app', 'Open the form', options.appHref));
  }
  const { audio } = options;
  if (audio !== undefined) {
    const label = () => (audio.enabled() ? 'Sound on' : 'Sound off');
    const sound = button('nav-sound', label(), () => {
      audio.setEnabled(!audio.enabled());
      sound.textContent = label();
      sound.setAttribute('aria-pressed', String(audio.enabled()));
    });
    sound.setAttribute('aria-pressed', String(audio.enabled()));
    nav.append(sound);
  }
  const notice = document.createElement('p');
  notice.className = 'notice';
  notice.setAttribute('data-role', 'notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  element.append(brand, nav, notice);
  return {
    element,
    notice(message) {
      notice.textContent = message;
      notice.hidden = false;
    },
  };
}
