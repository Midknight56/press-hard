// Canonical text of a record. This file is also turned into the inline check
// script of a copy file by core/scripts/gen-check.ts, so it must stay self
// contained: no value import, and no name that another inlined file uses.
import type { HandoverRecord } from './types.js';

function canonicalValue(value: unknown, topLevel: boolean): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalText: number is not finite');
    return String(value);
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const item of value) items.push(canonicalValue(item, false));
    return '[' + items.join(',') + ']';
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    // The default sort compares UTF-16 code units.
    const keys = Object.keys(object).sort();
    const parts: string[] = [];
    for (const key of keys) {
      if (topLevel && key === 'seal') continue;
      const entry = object[key];
      if (entry === undefined) continue;
      parts.push(JSON.stringify(key) + ':' + canonicalValue(entry, false));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new TypeError('canonicalText: unsupported value of type ' + typeof value);
}

export function canonicalText(record: HandoverRecord): string {
  return canonicalValue(record, true);
}
