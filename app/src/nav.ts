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

const STEPS = ['Fill in together', 'Both sign', 'Seal with the stamp', 'Peel back, keep the copy'];

function button(control: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('data-control', control);
  b.addEventListener('click', onClick);
  return b;
}

function link(control: string, text: string, href: string, name?: string): HTMLAnchorElement {
  const a = document.createElement('a');
  if (name !== undefined) a.setAttribute('aria-label', name);
  a.href = href;
  a.textContent = text;
  a.className = 'nav-link';
  a.setAttribute('data-control', control);
  return a;
}

/** The bar at the top of every page, and the one line that says drafts will not be kept. */
export function createNav(options: NavOptions): {
  element: HTMLElement;
  notice(message: string): void;
  /** Marks one button as the current page (the aria-current attribute), or none. */
  setCurrent(control: string | null): void;
} {
  const element = document.createElement('header');
  element.className = 'bar';
  const brand = document.createElement('p');
  brand.className = 'brand';
  brand.textContent = appConfig.title;
  // The tagline shows in the rail of wide screens. The four steps are drawn by CSS from data attributes, so no text node holds them.
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'The carbon copy, back from the dead.';
  const steps = document.createElement('ol');
  steps.className = 'steps';
  steps.setAttribute('aria-hidden', 'true');
  STEPS.forEach((step, i) => {
    const item = document.createElement('li');
    item.setAttribute('data-n', String(i + 1));
    item.setAttribute('data-step', step);
    steps.append(item);
  });
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main');
  if (options.page === 'app') {
    nav.append(
      button('nav-home', 'Forms', () => options.onHome?.()),
      button('nav-library', 'Library', () => options.onLibrary?.()),
      button('nav-help', 'Help', () => options.onHelp?.()),
      link('nav-verify', 'Check', options.verifyHref, 'Check a copy'),
    );
  } else {
    nav.append(link('nav-app', 'Open the form', options.appHref));
  }
  const { audio } = options;
  if (audio !== undefined) {
    // The label says the state in words: Sound on or Sound off. Pressed means on; a dashed, struck out button means off.
    const show = () => {
      sound.textContent = audio.enabled() ? 'Sound on' : 'Sound off';
      sound.setAttribute('aria-pressed', String(audio.enabled()));
    };
    const sound = button('nav-sound', 'Sound', () => {
      audio.setEnabled(!audio.enabled());
      show();
    });
    show();
    nav.append(sound);
  }
  const notice = document.createElement('p');
  notice.className = 'notice';
  notice.setAttribute('data-role', 'notice');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  element.append(brand, tagline, nav, steps, notice);
  return {
    element,
    setCurrent(control) {
      for (const item of Array.from(nav.querySelectorAll('[data-control]'))) {
        if (item.getAttribute('data-control') === control) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      }
    },
    notice(message) {
      notice.textContent = message;
      notice.hidden = false;
    },
  };
}
