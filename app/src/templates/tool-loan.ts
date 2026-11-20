import type { Template } from './types.js';

export const toolLoan: Template = {
  id: 'tool-loan',
  title: 'Tool loan',
  fields: [
    { id: 'tool', label: 'Tool', kind: 'text', required: true },
    { id: 'serial', label: 'Marking or serial', kind: 'text', required: false },
    { id: 'condition', label: 'Condition', kind: 'choice', options: ['good', 'worn', 'damaged'], required: true },
    { id: 'return-by', label: 'Return by', kind: 'text', required: true },
    { id: 'deposit', label: 'Deposit', kind: 'number', unit: 'CA$', required: false },
    { id: 'notes', label: 'Notes', kind: 'text', required: false },
    { id: 'photo-tool', label: 'Photo of the tool', kind: 'photo', required: false },
  ],
};
