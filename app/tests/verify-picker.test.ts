import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createVerifyPage } from '../src/verify/page.js';

describe('verify page, the file button', () => {
  let page: ReturnType<typeof createVerifyPage>;
  const input = () => page.element.querySelector('[data-control="verify-file"]') as HTMLInputElement;
  const names = () => page.element.querySelector('[data-role="file-names"]') as HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    page = createVerifyPage();
    document.body.append(page.element);
  });

  it('keeps the real file input, for the keyboard and for tests', () => {
    expect(input().type).toBe('file');
    expect(input().multiple).toBe(true);
    expect(input().hasAttribute('hidden')).toBe(false);
    expect(input().style.display).toBe('');
  });

  it('draws a button in the app style labelled Choose a copy file, around the input', () => {
    const button = input().closest('.file-button') as HTMLElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Choose a copy file');
  });

  it('says No file chosen until a file is given', () => {
    expect(names().textContent).toBe('No file chosen');
  });

  it('shows the chosen file names next to the button', async () => {
    const a = new File(['x'], 'first.html', { type: 'text/html' });
    const b = new File(['y'], 'second.html', { type: 'text/html' });
    await page.loadFiles([a, b]);
    expect(names().textContent).toBe('first.html, second.html');
    await page.loadFiles([a]);
    expect(names().textContent).toBe('first.html');
  });

  it('styles the button in the style sheet and hides the browser box', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/app.css'), 'utf8');
    expect(css).toMatch(/\.file-button\s*\{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.file-button input\s*\{[^}]*opacity: 0/);
  });
});
