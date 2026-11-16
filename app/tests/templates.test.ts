import { describe, expect, it } from 'vitest';
import { sealRecord, validateRecord } from 'core';
import { getTemplate, recordFromTemplate, templates, type Template } from '../src/templates/index.js';
import { sampleRecord } from '../src/templates/sample.js';

describe('templates', () => {
  it('offers the four forms in order', () => {
    expect(templates.map((t) => t.id)).toEqual(['rental-return', 'key-handover', 'sold-as-seen', 'blank']);
    expect(templates.map((t) => t.title)).toEqual([
      'Rental return',
      'Key handover',
      'Item sold as seen',
      'Blank form',
    ]);
  });

  it('finds a template by id and returns undefined for an unknown id', () => {
    expect(getTemplate('key-handover')?.title).toBe('Key handover');
    expect(getTemplate('nope')).toBeUndefined();
  });

  for (const template of templates) {
    describe(template.id, () => {
      it('has fields with unique ids made of lower case letters, digits and "-"', () => {
        const ids = template.fields.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
      });

      it('has a label, a known kind and a required flag on every field', () => {
        for (const field of template.fields) {
          expect(field.label.length).toBeGreaterThan(0);
          expect(['text', 'choice', 'number', 'photo']).toContain(field.kind);
          expect(typeof field.required).toBe('boolean');
        }
      });

      it('gives every choice field at least two options and no other field any', () => {
        for (const field of template.fields) {
          if (field.kind === 'choice') expect(field.options?.length).toBeGreaterThanOrEqual(2);
          else expect(field.options).toBeUndefined();
        }
      });

      it('does not list the giver and receiver name lines as fields', () => {
        const labels = template.fields.map((f) => f.label.toLowerCase());
        expect(labels).not.toContain('giver');
        expect(labels).not.toContain('receiver');
      });

      it('makes a record that passes validateRecord', () => {
        const record = recordFromTemplate(template);
        expect(validateRecord(record)).toEqual([]);
        expect(record.form).toEqual({ templateId: template.id, title: template.title });
        expect(record.sealedAt).toBeNull();
        expect(record.seal).toBeUndefined();
        expect(record.parties).toEqual({ giver: '', receiver: '' });
        expect(record.fields.every((f) => f.value === null)).toBe(true);
      });
    });
  }

  it('leaves photo lines out of an empty record, because a photo line needs its photo', () => {
    const record = recordFromTemplate(getTemplate('rental-return') as Template);
    expect(record.fields.some((f) => f.kind === 'photo')).toBe(false);
    expect(record.fields.map((f) => f.id)).toEqual(['item', 'condition', 'mileage', 'fuel', 'damage']);
  });

  it('has ready forms with at least four lines and a blank form with none', () => {
    for (const id of ['rental-return', 'key-handover', 'sold-as-seen']) {
      expect((getTemplate(id)?.fields.length ?? 0)).toBeGreaterThanOrEqual(4);
    }
    expect(getTemplate('blank')?.fields).toEqual([]);
  });

  it('has a photo line in each ready form', () => {
    for (const id of ['rental-return', 'key-handover', 'sold-as-seen']) {
      expect(getTemplate(id)?.fields.some((f) => f.kind === 'photo')).toBe(true);
    }
  });
});

describe('sample', () => {
  it('is a filled rental return that validateRecord accepts', () => {
    expect(validateRecord(sampleRecord)).toEqual([]);
    expect(sampleRecord.form.templateId).toBe('rental-return');
  });

  it('has names, two photos, two signatures, no seal and no time', () => {
    expect(sampleRecord.parties.giver.length).toBeGreaterThan(0);
    expect(sampleRecord.parties.receiver.length).toBeGreaterThan(0);
    expect(sampleRecord.photos).toHaveLength(2);
    expect(sampleRecord.signatures.map((s) => s.party).sort()).toEqual(['giver', 'receiver']);
    expect(sampleRecord.sealedAt).toBeNull();
    expect(sampleRecord.seal).toBeUndefined();
  });

  it('fills every required line of the rental return template', () => {
    const template = getTemplate('rental-return');
    for (const field of template?.fields ?? []) {
      if (!field.required) continue;
      const filled = sampleRecord.fields.find((f) => f.id === field.id);
      if (field.kind === 'photo') expect(filled?.photoDigest).toBeDefined();
      else expect(filled?.value).toBeTruthy();
    }
  });

  it('can be sealed', () => {
    const result = sealRecord(sampleRecord, '2026-11-16T09:30:00Z');
    expect(result.ok).toBe(true);
  });
});