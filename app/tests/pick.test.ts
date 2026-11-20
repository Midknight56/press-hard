import { describe, expect, it, vi } from 'vitest';
import { createPickScreen } from '../src/screens/pick.js';

function make() {
  const onPick = vi.fn<(id: string) => void>();
  const onSample = vi.fn<() => void>();
  const screen = createPickScreen({ onPick, onSample });
  document.body.append(screen.element);
  return { screen, onPick, onSample };
}
const button = (root: HTMLElement, control: string) =>
  root.querySelector(`[data-control="${control}"]`) as HTMLButtonElement | null;

describe('pick screen', () => {
  it('is marked as the pick screen', () => {
    expect(make().screen.element.getAttribute('data-screen')).toBe('pick');
  });

  it('offers the five forms in order, each with its title', () => {
    const { screen } = make();
    const forms = [...screen.element.querySelectorAll('[data-control^="pick-"]')]
      .map((b) => b.getAttribute('data-control'))
      .filter((c) => c !== 'pick-prefilled');
    expect(forms).toEqual(['pick-rental-return', 'pick-key-handover', 'pick-sold-as-seen', 'pick-tool-loan', 'pick-blank']);
    expect(button(screen.element, 'pick-rental-return')?.textContent).toContain('Rental return');
    expect(button(screen.element, 'pick-key-handover')?.textContent).toContain('Key handover');
    expect(button(screen.element, 'pick-sold-as-seen')?.textContent).toContain('Item sold as seen');
    expect(button(screen.element, 'pick-tool-loan')?.textContent).toContain('Tool loan');
    expect(button(screen.element, 'pick-blank')?.textContent).toContain('Blank form');
  });

  it('calls onPick with the template id', () => {
    const { screen, onPick } = make();
    button(screen.element, 'pick-key-handover')?.click();
    button(screen.element, 'pick-tool-loan')?.click();
    button(screen.element, 'pick-blank')?.click();
    expect(onPick.mock.calls).toEqual([['key-handover'], ['tool-loan'], ['blank']]);
  });

  it('offers the prefilled rental return', () => {
    const { screen, onSample, onPick } = make();
    const sample = button(screen.element, 'pick-prefilled');
    expect(sample?.textContent).toContain('Try it prefilled: rental return');
    sample?.click();
    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows the picture of a form first', () => {
    const { screen } = make();
    const first = screen.element.firstElementChild as HTMLElement;
    expect(first.querySelector('.form') ?? first.classList.contains('form')).toBeTruthy();
  });

  it('puts data-control on every button', () => {
    const { screen } = make();
    for (const b of screen.element.querySelectorAll('button')) expect(b.getAttribute('data-control')).toBeTruthy();
  });

  it('has instructions of at most 6 words', () => {
    const { screen } = make();
    for (const i of screen.element.querySelectorAll('[data-role="instruction"]')) {
      expect((i.textContent ?? '').trim().split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });
});