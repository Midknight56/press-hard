import { buildCopyFile, sealWords, type HandoverRecord } from 'core';
import { appConfig } from '../app.config.js';

export interface ShareEnv {
  navigator?: {
    canShare?(data: ShareData): boolean;
    share?(data: ShareData): Promise<void>;
  };
  download(file: File): void;
}

export type TearOffResult = 'shared' | 'downloaded' | 'cancelled';

/** `copy-<first seal word>-<second seal word>.html` */
export function copyFileName(record: HandoverRecord): string {
  if (record.seal === undefined) throw new TypeError('copyFileName: the record has no seal');
  const [first, second] = sealWords(record.seal).split('-');
  return `copy-${first}-${second}.html`;
}

/** 999 B, 12 KB, 1.5 MB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The copy file of a sealed record, with its name and the size line to show before sharing. */
export function prepareCopy(record: HandoverRecord): { file: File; html: string; sizeLine: string } {
  const html = buildCopyFile(record, { title: appConfig.title, paper: 'carbon' });
  const file = new File([html], copyFileName(record), { type: 'text/html' });
  return { file, html, sizeLine: formatSize(file.size) };
}

export function browserDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function browserEnv(): ShareEnv {
  return {
    navigator: typeof navigator === 'undefined' ? undefined : navigator,
    download: browserDownload,
  };
}

/**
 * Offers the copy file through the share sheet where the browser can share files, and as a
 * download otherwise. A share that the user cancels is not an error. A share that fails falls
 * back to the download.
 */
export async function tearOff(record: HandoverRecord, env: ShareEnv = browserEnv()): Promise<TearOffResult> {
  const { file } = prepareCopy(record);
  const data: ShareData = { files: [file], title: record.form.title };
  const nav = env.navigator;
  const canShare = ((): boolean => {
    try {
      return typeof nav?.share === 'function' && typeof nav.canShare === 'function' && nav.canShare(data);
    } catch {
      return false;
    }
  })();
  if (canShare && nav?.share) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  env.download(file);
  return 'downloaded';
}