import type { HandoverRecord } from 'core';
import { blank } from './blank.js';
import { keyHandover } from './key-handover.js';
import { rentalReturn } from './rental-return.js';
import { soldAsSeen } from './sold-as-seen.js';
import { toolLoan } from './tool-loan.js';
import type { Template } from './types.js';

export type { Template, TemplateField } from './types.js';

export const templates: Template[] = [rentalReturn, keyHandover, soldAsSeen, toolLoan, blank];

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

/**
 * An empty record for a template. Photo lines are left out: a photo line enters the record
 * together with its photo, because a record photo line must point at a photo.
 */
export function recordFromTemplate(template: Template): HandoverRecord {
  return {
    format: 1,
    form: { templateId: template.id, title: template.title },
    sealedAt: null,
    parties: { giver: '', receiver: '' },
    fields: template.fields
      .filter((f) => f.kind !== 'photo')
      .map((f) => ({
        id: f.id,
        label: f.label,
        kind: f.kind,
        value: null,
        ...(f.unit !== undefined ? { unit: f.unit } : {}),
        ...(f.options !== undefined ? { options: [...f.options] } : {}),
      })),
    photos: [],
    signatures: [],
  };
}