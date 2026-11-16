import type { Template } from './types.js';

export const rentalReturn: Template = {
  id: 'rental-return',
  title: 'Rental return',
  fields: [
    { id: 'item', label: 'Item', kind: 'text', required: true },
    { id: 'condition', label: 'Condition', kind: 'choice', options: ['good', 'worn', 'damaged'], required: true },
    { id: 'mileage', label: 'Mileage', kind: 'number', unit: 'km', required: true },
    { id: 'fuel', label: 'Fuel', kind: 'choice', options: ['full', 'half', 'empty'], required: false },
    { id: 'damage', label: 'Damage notes', kind: 'text', required: false },
    { id: 'photo-front', label: 'Photo, front', kind: 'photo', required: false },
    { id: 'photo-back', label: 'Photo, back', kind: 'photo', required: false },
  ],
};