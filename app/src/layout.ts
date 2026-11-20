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
  /** `box` is a sheet, card or panel (`data-box`): only the edge rule applies. Default `control`. */
  kind?: 'control' | 'box';
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
    const isBox = b.kind === 'box';
    if (!isBox && (b.width < MIN_SIZE - EPSILON || b.height < MIN_SIZE - EPSILON)) {
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
    if (!isBox && b.padding !== null) {
      const smallest = Math.min(b.padding.top, b.padding.right, b.padding.bottom, b.padding.left);
      if (smallest < MIN_PADDING - EPSILON) add(b.name, `padding ${px(smallest)}, needs ${MIN_PADDING} px`);
    }
    for (let j = 0; j < i; j++) {
      const a = boxes[j] as ControlBox;
      if (isBox || a.kind === 'box') continue;
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
  // A bar that follows the person (`data-sticky`) is measured at its place in the flow, so that it
  // does not seem to lie on top of the lines it floats over.
  const sticky = Array.from(document.querySelectorAll<HTMLElement>('[data-sticky]'));
  for (const el of sticky) el.style.position = 'static';
  for (const el of Array.from(document.querySelectorAll('[data-control], [data-box]'))) {
    if (el.closest('[inert]') !== null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const isBox = el.hasAttribute('data-box') && !el.hasAttribute('data-control');
    boxes.push({
      name: isBox ? `${screen}/box:${el.getAttribute('data-box')}` : `${screen}/${el.getAttribute('data-control')}`,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      ...(isBox ? { kind: 'box' as const } : {}),
      padding:
        !isBox && el.tagName === 'BUTTON'
          ? {
              top: parseFloat(style.paddingTop),
              right: parseFloat(style.paddingRight),
              bottom: parseFloat(style.paddingBottom),
              left: parseFloat(style.paddingLeft),
            }
          : null,
    });
  }
  for (const el of sticky) el.style.position = '';
  const page = document.documentElement;
  return { screen, boxes, pageHeight: page.scrollHeight, viewWidth: page.clientWidth, scrollWidth: page.scrollWidth };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when two boxes share area. Boxes that only touch do not overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width - EPSILON && b.x < a.x + a.width - EPSILON && a.y < b.y + b.height - EPSILON && b.y < a.y + a.height - EPSILON;
}

/** One picture inside a control, with the box of the label text. `picture` is null for a background image. */
export interface PictureCheck {
  control: string;
  picture: Rect | null;
  label: Rect | null;
  background: boolean;
}

/** A picture inside a control must be an element beside the label, never on top of it and never a background image. */
export function findPictureProblems(items: PictureCheck[]): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  for (const item of items) {
    if (item.background) {
      problems.push({ control: item.control, problem: 'the picture is a background image, so its place cannot be measured; make it an element beside the label' });
    } else if (item.picture !== null && item.label !== null && rectsOverlap(item.picture, item.label)) {
      problems.push({ control: item.control, problem: 'the picture overlaps the label text' });
    }
  }
  return problems;
}

export const MAX_CENTRE_OFFSET = 2;

/** Middle of the span minus middle of the view. Negative when the span sits left of the middle. */
export function centreOffset(left: number, right: number, viewWidth: number): number {
  return (left + right) / 2 - viewWidth / 2;
}

/** The main column, and the sheets and panels in it, must sit in the middle of the view within 2 px. */
export function findCentreProblems(
  screen: string,
  column: { left: number; right: number },
  boxes: { left: number; right: number } | null,
  viewWidth: number,
): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const check = (what: string, span: { left: number; right: number }) => {
    const offset = centreOffset(span.left, span.right, viewWidth);
    if (Math.abs(offset) > MAX_CENTRE_OFFSET + EPSILON) {
      problems.push({ control: `${screen}/${what}`, problem: `the centre is ${px(Math.abs(offset))} ${offset < 0 ? 'left' : 'right'} of the centre of the view, needs within ${MAX_CENTRE_OFFSET} px` });
    }
  };
  check('column', column);
  if (boxes !== null) check('boxes', boxes);
  return problems;
}

/**
 * `whole`: the item is in the first view with 16 px to spare at the bottom. `start`: a tall item
 * whose start is in the first view. `after`: the item starts below every `whole` item.
 */
export interface FirstViewItem {
  name: string;
  rule: 'whole' | 'start' | 'after';
  top: number;
  bottom: number;
}

/** The marks each screen must carry, so that a check with no marks cannot pass by finding nothing. */
export const REQUIRED_FIRST_VIEW: Record<string, string[]> = {
  pick: ['pick-rental-return', 'pick-key-handover', 'pick-sold-as-seen', 'pick-tool-loan', 'pick-blank', 'pick-prefilled', 'pick-preview'],
  fill: ['stamp'],
  copy: ['seal-stamp', 'seal-words', 'carbon-sheet'],
};

/** The first view is the page at scroll 0. */
export function findFirstViewProblems(screen: string, items: FirstViewItem[], view: { width: number; height: number }): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const add = (name: string, problem: string) => problems.push({ control: `${screen}/${name}`, problem });
  for (const name of REQUIRED_FIRST_VIEW[screen] ?? []) {
    if (!items.some((i) => i.name === name)) add(name, 'no mark for the first view rules (data-first-view)');
  }
  const wholeBottom = Math.max(0, ...items.filter((i) => i.rule === 'whole').map((i) => i.bottom));
  for (const item of items) {
    if (item.rule === 'whole') {
      if (item.top < -EPSILON || item.bottom > view.height - MIN_EDGE + EPSILON) {
        add(item.name, `not whole in the first view: ${px(item.top)} to ${px(item.bottom)} in a view ${view.height} px high, needs 16 px to spare at the bottom`);
      }
    } else if (item.rule === 'start') {
      if (item.top < -EPSILON || item.top + Math.min(item.bottom - item.top, MIN_SIZE) > view.height + EPSILON) {
        add(item.name, `its start is not in the first view: it begins at ${px(item.top)} in a view ${view.height} px high`);
      }
    } else if (item.top < wholeBottom - EPSILON) {
      add(item.name, `starts at ${px(item.top)}, needs to be below the form choices that end at ${px(wholeBottom)}`);
    }
  }
  return problems;
}

/**
 * Runs in the page, at the scroll position it finds. Pictures inside controls, the main column, the
 * span of the sheets and panels, and the items marked `data-first-view`.
 */
export function collectFacts(): {
  screen: string;
  pictures: PictureCheck[];
  column: { left: number; right: number };
  boxes: { left: number; right: number } | null;
  firstView: FirstViewItem[];
  viewWidth: number;
  scrollY: number;
} {
  const screen = document.querySelector('[data-screen]')?.getAttribute('data-screen') ?? 'none';
  const toRect = (r: DOMRect | { left: number; top: number; width: number; height: number }) => ({ x: r.left, y: r.top, width: r.width, height: r.height });
  const visible = (el: Element) => {
    if (el.closest('[inert]') !== null) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };

  const pictures: PictureCheck[] = [];
  for (const control of Array.from(document.querySelectorAll('[data-control]'))) {
    if (!visible(control)) continue;
    const name = `${screen}/${control.getAttribute('data-control')}`;
    if (getComputedStyle(control).backgroundImage.includes('url(')) {
      pictures.push({ control: name, picture: null, label: null, background: true });
    }
    const art = Array.from(control.querySelectorAll('img, svg, [data-art]'));
    if (art.length === 0) continue;
    const text: DOMRect[] = [];
    const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? '').trim() === '') continue;
      if (art.some((a) => a.contains(node))) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) text.push(r);
    }
    const label = text.length === 0 ? null : toRect({
      left: Math.min(...text.map((r) => r.left)),
      top: Math.min(...text.map((r) => r.top)),
      width: Math.max(...text.map((r) => r.right)) - Math.min(...text.map((r) => r.left)),
      height: Math.max(...text.map((r) => r.bottom)) - Math.min(...text.map((r) => r.top)),
    });
    for (const a of art) pictures.push({ control: name, picture: toRect(a.getBoundingClientRect()), label, background: false });
  }

  const main = document.querySelector('main') ?? document.querySelector('[data-screen]') ?? document.body;
  const mainRect = main.getBoundingClientRect();
  const sheets = Array.from(document.querySelectorAll('[data-box]')).filter(visible).map((el) => el.getBoundingClientRect());
  const firstView: FirstViewItem[] = [];
  for (const el of Array.from(document.querySelectorAll('[data-first-view]'))) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const rule = el.getAttribute('data-first-view') as FirstViewItem['rule'];
    firstView.push({ name: el.getAttribute('data-control') ?? el.getAttribute('data-role') ?? 'unnamed', rule, top: r.top, bottom: r.bottom });
  }
  return {
    screen,
    pictures,
    column: { left: mainRect.left, right: mainRect.right },
    boxes: sheets.length === 0 ? null : { left: Math.min(...sheets.map((r) => r.left)), right: Math.max(...sheets.map((r) => r.right)) },
    firstView,
    viewWidth: document.documentElement.clientWidth,
    scrollY: window.scrollY,
  };
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
