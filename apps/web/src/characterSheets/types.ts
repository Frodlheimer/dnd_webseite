export type CharacterSheetFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'signature'
  | 'unknown';

export type CharacterSheetFieldRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CharacterSheetField = {
  name: string;
  type: CharacterSheetFieldType;
  pageIndex: number;
  rect: CharacterSheetFieldRect;
  options?: string[];
  multiline?: boolean;
  maxLen?: number;
  widgetOption?: string;
};

export type CharacterSheetPage = {
  pageIndex: number;
  width: number;
  height: number;
};

export type CharacterSheetTemplateSummary = {
  id: string;
  title: string;
  className: string | null;
  pdfUrl: string;
  pageCount: number;
  updatedAt: string;
};

export type CharacterSheetTemplate = CharacterSheetTemplateSummary & {
  pages: CharacterSheetPage[];
  fields: CharacterSheetField[];
};

export type CharacterSheetValue = string | boolean;

export type CharacterSheetValues = Record<string, CharacterSheetValue>;

export type CharacterSheetInstance = {
  instanceId: string;
  templateId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  values: CharacterSheetValues;
};

export type CharacterSheetTemplateMatchResult = {
  templateId: string;
  score: number;
  overlapCount: number;
  uploadedFieldCount: number;
  templateFieldCount: number;
};
