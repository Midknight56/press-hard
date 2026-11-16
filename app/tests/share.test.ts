import { canonicalText, parseCopyFile, sealRecord, sealWords, type HandoverRecord } from 'core';
import { describe, expect, it, vi } from 'vitest';
import { appConfig } from '../app.config.js';
import { copyFileName, formatSize, prepareCopy, tearOff, type ShareEnv } from '../src/share.js';
import { sampleRecord } from '../src/templates/sample.js';

const sealed = (() => {
  const r = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
  if (!r.ok) throw new Error('sample did not seal');
  return r.record as HandoverRecord;
})();

describe('file name rule', () => {
  it('is copy-<first word>-<second word>.html', () => {
    const [first, second] = sealWords(sealed.seal as string).split('-');
    expect(copyFileName(sealed)).toBe(`copy-${first}-${second}.html`);
    expect(copyFileName(sealed)).toMatch(/^copy-[a-z]+-[a-z]+\.html$/);
  });
  it('uses the words of a known seal', () => {
    const fake = { ...sealed, seal: '00'.repeat(32) };
    const [first, second] = sealWords(fake.seal).split('-');
    expect(copyFileName(fake)).toBe(`copy-${first}-${second}.html`);
  });
  it('refuses a record with no seal', () => {
    expect(() => copyFileName(sampleRecord)).toThrow(/seal/);
  });
});

describe('size line', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '2 KB'],
    [250 * 1024, '250 KB'],
    [1024 * 1024, '1.0 MB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
  ])('writes %d bytes as %s', (bytes, text) => {
    expect(formatSize(bytes)).toBe(text);
  });
});

describe('prepareCopy', () => {
  it('builds the copy file with the product title, its name, its size and its size line', async () => {
    const copy = prepareCopy(sealed);
    expect(copy.file.name).toBe(copyFileName(sealed));
    expect(copy.file.type).toBe('text/html');
    expect(copy.file.size).toBe(new TextEncoder().encode(copy.html).length);
    expect(copy.sizeLine).toBe(formatSize(copy.file.size));
    expect(copy.html).toContain(`<title>${appConfig.title}</title>`);
  });

  it('gives a file whose record has the same canonical text as the top copy', () => {
    const parsed = parseCopyFile(prepareCopy(sealed).html);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(canonicalText(parsed.record)).toBe(canonicalText(sealed));
  });
});

describe('share fallback', () => {
  const env = (over: Partial<ShareEnv> = {}): ShareEnv & { download: ReturnType<typeof vi.fn<(f: File) => void>> } => ({
    download: vi.fn<(f: File) => void>(),
    ...over,
  }) as never;

  it('shares the file where the browser can share files', async () => {
    const share = vi.fn(async () => undefined);
    const e = env({ navigator: { canShare: () => true, share } });
    expect(await tearOff(sealed, e)).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.files?.[0]?.name).toBe(copyFileName(sealed));
    expect(e.download).not.toHaveBeenCalled();
  });

  it('downloads when there is no share', async () => {
    const e = env({ navigator: {} });
    expect(await tearOff(sealed, e)).toBe('downloaded');
    expect(e.download).toHaveBeenCalledTimes(1);
    expect((e.download.mock.calls[0] as unknown as [File])[0].name).toBe(copyFileName(sealed));
  });

  it('downloads when there is no navigator', async () => {
    const e = env({ navigator: undefined });
    expect(await tearOff(sealed, e)).toBe('downloaded');
  });

  it('downloads when the browser cannot share files', async () => {
    const share = vi.fn(async () => undefined);
    const e = env({ navigator: { canShare: () => false, share } });
    expect(await tearOff(sealed, e)).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(e.download).toHaveBeenCalledTimes(1);
  });

  it('downloads when canShare is missing', async () => {
    const e = env({ navigator: { share: async () => undefined } });
    expect(await tearOff(sealed, e)).toBe('downloaded');
  });

  it('treats a cancelled share as no error and does not download', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const e = env({ navigator: { canShare: () => true, share } });
    expect(await tearOff(sealed, e)).toBe('cancelled');
    expect(e.download).not.toHaveBeenCalled();
  });

  it('falls back to download when the share fails', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('not allowed', 'NotAllowedError');
    });
    const e = env({ navigator: { canShare: () => true, share } });
    expect(await tearOff(sealed, e)).toBe('downloaded');
    expect(e.download).toHaveBeenCalledTimes(1);
  });

  it('falls back to download when canShare throws', async () => {
    const e = env({
      navigator: {
        canShare: () => {
          throw new TypeError('bad');
        },
        share: async () => undefined,
      },
    });
    expect(await tearOff(sealed, e)).toBe('downloaded');
  });
});