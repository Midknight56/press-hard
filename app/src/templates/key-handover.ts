import type { Template } from './types.js';

export const keyHandover: Template = {
  id: 'key-handover',
  title: 'Key handover',
  fields: [
    { id: 'address', label: 'Address', kind: 'text', required: true },
    { id: 'keys', label: 'Number of keys', kind: 'number', unit: 'keys', required: true },
    { id: 'fob', label: 'Door fob', kind: 'choice', options: ['yes', 'no'], required: true },
    { id: 'meter', label: 'Meter reading', kind: 'text', required: false },
    { id: 'notes', label: 'Notes', kind: 'text', required: false },
    { id: 'photo-keys', label: 'Photo of the keys', kind: 'photo', required: false },
  ],
};