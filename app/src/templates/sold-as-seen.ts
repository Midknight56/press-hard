import type { Template } from './types.js';

export const soldAsSeen: Template = {
  id: 'sold-as-seen',
  title: 'Item sold as seen',
  fields: [
    { id: 'item', label: 'Item', kind: 'text', required: true },
    { id: 'price', label: 'Price agreed', kind: 'number', required: true },
    { id: 'faults', label: 'Known faults', kind: 'text', required: false },
    { id: 'as-seen', label: 'Buyer accepts it as seen', kind: 'choice', options: ['yes', 'no'], required: true },
    { id: 'photo-item', label: 'Photo of the item', kind: 'photo', required: false },
  ],
};