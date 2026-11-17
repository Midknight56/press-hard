import { inflateSync } from 'node:zlib';

/**
 * A small reader for the PDF files that Chromium writes (no object streams). It returns, for each
 * page in order, the text that is drawn on it and the number of images drawn on it. It is made for
 * the print test only and reads nothing else.
 */
export interface PdfPage {
  text: string;
  images: number;
}

interface PdfObject {
  dict: string;
  stream: Buffer | null;
}

function readObjects(pdf: Buffer): Map<number, PdfObject> {
  const text = pdf.toString('latin1');
  const objects = new Map<number, PdfObject>();
  const header = /(\d+) (\d+) obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const end = text.indexOf('endobj', start);
    if (end < 0) break;
    const body = text.slice(start, end);
    const streamAt = body.indexOf('stream');
    let dict = body;
    let stream: Buffer | null = null;
    if (streamAt >= 0 && /<<[\s\S]*>>\s*stream/.test(body.slice(0, streamAt + 6))) {
      dict = body.slice(0, streamAt);
      let from = start + streamAt + 'stream'.length;
      if (text[from] === '\r') from += 1;
      if (text[from] === '\n') from += 1;
      const until = text.indexOf('endstream', from);
      let raw = pdf.subarray(from, until);
      if (/\/FlateDecode/.test(dict)) raw = inflateSync(raw);
      stream = raw;
    }
    objects.set(Number(match[1]), { dict, stream });
    header.lastIndex = end;
  }
  return objects;
}

/** The unicode text of a hex string drawn with a font, using the font's ToUnicode map. */
function readCMap(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const unicode = (hex: string) => {
    let out = '';
    for (let i = 0; i + 3 < hex.length + 1; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return out;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] as string).matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(m[1] as string, 16), unicode(m[2] as string));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of (block[1] as string).matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]+>|\[[^\]]*\])/g)) {
      const low = parseInt(m[1] as string, 16);
      const high = parseInt(m[2] as string, 16);
      const target = m[3] as string;
      if (target.startsWith('[')) {
        [...target.matchAll(/<([0-9a-fA-F]+)>/g)].forEach((t, i) => map.set(low + i, unicode(t[1] as string)));
      } else {
        const first = parseInt(target.slice(1, -1), 16);
        for (let code = low; code <= high; code++) map.set(code, String.fromCharCode(first + code - low));
      }
    }
  }
  return map;
}

const ref = (text: string, key: string): number | null => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(text);
  return m === null ? null : Number(m[1]);
};

export function readPdf(pdf: Buffer): PdfPage[] {
  const objects = readObjects(pdf);
  const fontMaps = new Map<number, Map<number, string>>();
  const fontMap = (id: number): Map<number, string> => {
    let map = fontMaps.get(id);
    if (map === undefined) {
      const font = objects.get(id);
      const toUnicode = font === undefined ? null : ref(font.dict, 'ToUnicode');
      const cmap = toUnicode === null ? undefined : objects.get(toUnicode)?.stream;
      map = cmap ? readCMap(cmap.toString('latin1')) : new Map();
      fontMaps.set(id, map);
    }
    return map;
  };

  // Page order: follow /Kids from the page tree, and fall back to object order.
  const pageIds: number[] = [];
  const walk = (id: number) => {
    const object = objects.get(id);
    if (object === undefined) return;
    if (/\/Type\s*\/Pages\b/.test(object.dict)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(object.dict)?.[1] ?? '';
      for (const k of kids.matchAll(/(\d+)\s+0\s+R/g)) walk(Number(k[1]));
    } else if (/\/Type\s*\/Page\b/.test(object.dict)) {
      pageIds.push(id);
    }
  };
  const root = [...objects.entries()].find(([, o]) => /\/Type\s*\/Pages\b/.test(o.dict) && !/\/Parent/.test(o.dict));
  if (root !== undefined) walk(root[0]);

  return pageIds.map((id) => {
    const page = (objects.get(id) as PdfObject).dict;
    const contents = ref(page, 'Contents');
    const content = contents === null ? '' : ((objects.get(contents)?.stream ?? Buffer.alloc(0)).toString('latin1'));
    // Resources can be inline or an indirect object. Font names map to font objects.
    const resourcesId = ref(page, 'Resources');
    const resources = resourcesId === null ? page : (objects.get(resourcesId)?.dict ?? page);
    const fontsText = (() => {
      const direct = /\/Font\s*<<([^>]*)>>/.exec(resources);
      if (direct !== null) return direct[1] as string;
      const fontRef = ref(resources, 'Font');
      return fontRef === null ? '' : (objects.get(fontRef)?.dict ?? '');
    })();
    const fonts = new Map<string, number>();
    for (const m of fontsText.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) fonts.set(m[1] as string, Number(m[2]));

    let current: Map<number, string> = new Map();
    let text = '';
    for (const m of content.matchAll(/\/(\w+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]+)>\s*Tj|\[([^\]]*)\]\s*TJ|\bDo\b/g)) {
      if (m[1] !== undefined) {
        const fontId = fonts.get(m[1]);
        current = fontId === undefined ? new Map() : fontMap(fontId);
      } else if (m[2] !== undefined || m[3] !== undefined) {
        const hexes = m[2] !== undefined ? [m[2]] : [...(m[3] as string).matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => h[1] as string);
        for (const hex of hexes) {
          for (let i = 0; i + 3 < hex.length + 1; i += 4) {
            text += current.get(parseInt(hex.slice(i, i + 4), 16)) ?? '?';
          }
        }
        text += ' ';
      }
    }
    const images = [...content.matchAll(/\/\w+\s+Do\b/g)].length;
    return { text: text.replace(/\s+/g, ' ').trim(), images };
  });
}
