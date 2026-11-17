/**
 * Control boxes and the layout rules of the screen standards. `findLayoutProblems` and the colour
 * functions are pure. `collectBoxes` and `collectTextColors` run inside a page (Playwright sends
 * their source to the browser), so each one uses nothing from outside its own body.
 */

export const VIEWPORTS = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

export const MIN_SIZE = 44;
export const MIN_EDGE = 16;
export const MIN_GAP = 12;
export const MIN_PADDING = 8;
export const MIN_CONTRAST = 4.5;

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** One control on page coordinates. `padding` is set for buttons only. */
export interface ControlBox {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  padding: Padding | null;
}

export interface LayoutProblem {
  control: string;
  problem: string;
}

const EPSILON = 0.01;
const px = (n: number) => `${Math.round(n * 100) / 100} px`;

/** Checks the rules of the screen standards. A problem between two controls is named on the later one. */
export function findLayoutProblems(
  boxes: ControlBox[],
  view: { width: number; height: number },
  pageHeight: number,
): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const add = (control: string, problem: string) => problems.push({ control, problem });

  boxes.forEach((b, i) => {
    if (b.width < MIN_SIZE - EPSILON || b.height < MIN_SIZE - EPSILON) {
      add(b.name, `smaller than ${MIN_SIZE} by ${MIN_SIZE} px: ${px(b.width)} by ${px(b.height)}`);
    }
    const left = b.x;
    const right = view.width - (b.x + b.width);
    const top = b.y;
    const bottom = pageHeight - (b.y + b.height);
    const edges: [string, number][] = [['left', left], ['right', right], ['top', top], ['bottom', bottom]];
    for (const [side, space] of edges) {
      if (space < MIN_EDGE - EPSILON) add(b.name, `${px(space)} from the ${side} edge, needs ${MIN_EDGE} px`);
    }
    if (b.padding !== null) {
      const smallest = Math.min(b.padding.top, b.padding.right, b.padding.bottom, b.padding.left);
      if (smallest < MIN_PADDING - EPSILON) add(b.name, `padding ${px(smallest)}, needs ${MIN_PADDING} px`);
    }
    for (let j = 0; j < i; j++) {
      const a = boxes[j] as ControlBox;
      const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
      const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
      if (dx < 0 && dy < 0) {
        add(b.name, `overlaps ${a.name}`);
        continue;
      }
      const gap = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
      if (gap < MIN_GAP - EPSILON) add(b.name, `${px(gap)} from ${a.name}, needs ${MIN_GAP} px`);
    }
  });
  return problems;
}

/** Runs in the page. Every visible element with `data-control`, except inside an inert part (the loop of the landing page), named `<screen>/<control>`. */
export function collectBoxes(): {
  screen: string;
  boxes: ControlBox[];
  pageHeight: number;
  viewWidth: number;
  scrollWidth: number;
} {
  const screen = document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? 'none';
  const boxes: ControlBox[] = [];
  for (const el of Array.from(document.querySelectorAll('[data-control]'))) {
    if (el.closest('[inert]') !== null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    boxes.push({
      name: `${screen}/${el.getAttribute('data-control')}`,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      padding:
        el.tagName === 'BUTTON'
          ? {
              top: parseFloat(style.paddingTop),
              right: parseFloat(style.paddingRight),
              bottom: parseFloat(style.paddingBottom),
              left: parseFloat(style.paddingLeft),
            }
          : null,
    });
  }
  const page = document.documentElement;
  return { screen, boxes, pageHeight: page.scrollHeight, viewWidth: page.clientWidth, scrollWidth: page.scrollWidth };
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Reads `rgb(...)` and `rgba(...)` text as a browser writes it. Returns null for anything else. */
export function parseColor(text: string): Rgba | null {
  const match = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(text.trim());
  if (match === null) return null;
  const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
}

function luminance(c: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio of two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface TextColor {
  name: string;
  text: string;
  color: string;
  background: string;
  opacity: number;
}

/**
 * Runs in the page. Every visible element that holds its own text, and every visible input or
 * select, with its computed colour, the first background colour found going up the tree, and the
 * product of the opacity of the element and its parents.
 */
export function collectTextColors(): { screen: string; items: TextColor[] } {
  const screen = document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? 'none';
  const items: TextColor[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'option', 'svg', 'polyline', 'path'].includes(tag)) continue;
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    const isField = tag === 'input' || tag === 'select';
    if (ownText === '' && !isField) continue;
    if (isField && (el as HTMLInputElement).type === 'file') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') continue;
    let background = 'rgb(255, 255, 255)';
    let opacity = 1;
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      opacity *= parseFloat(getComputedStyle(node).opacity);
    }
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        background = bg;
        break;
      }
    }
    const control = el.getAttribute('data-control') ?? el.getAttribute('data-role') ?? el.className;
    items.push({
      name: `${screen}/${tag}${control ? `[${String(control)}]` : ''}`,
      text: (ownText || (el as HTMLInputElement).value || '').slice(0, 40),
      color: style.color,
      background,
      opacity,
    });
  }
  return { screen, items };
}

/** Contrast of a text item, with its colour blended over the background by its opacity. Null when a colour is unreadable. */
export function textContrast(item: TextColor): number | null {
  const fg = parseColor(item.color);
  const bg = parseColor(item.background);
  if (fg === null || bg === null) return null;
  const alpha = fg.a * item.opacity;
  const blended: Rgba = {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  };
  return contrastRatio(blended, { ...bg, a: 1 });
}
