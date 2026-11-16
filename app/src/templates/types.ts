export interface TemplateField {
  id: string;
  label: string;
  kind: 'text' | 'choice' | 'number' | 'photo';
  options?: string[];
  unit?: string;
  required: boolean;
}

/** The giver and receiver name lines are added by every form and fill `parties`, not `fields`. */
export interface Template {
  id: string;
  title: string;
  fields: TemplateField[];
}