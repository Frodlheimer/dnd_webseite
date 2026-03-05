import type { CharacterSheetTemplate, CharacterSheetValues } from '../types';

const sanitizeFileNamePart = (value: string): string => {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

export const buildCharacterSheetPdfFileName = (args: {
  template: CharacterSheetTemplate;
  values: CharacterSheetValues;
  fallbackInstanceId: string;
}): string => {
  const candidateName =
    typeof args.values['CharacterName'] === 'string'
      ? args.values['CharacterName']
      : typeof args.values['Character Name'] === 'string'
        ? args.values['Character Name']
        : '';

  const namePart = sanitizeFileNamePart(candidateName);
  const templatePart = sanitizeFileNamePart(args.template.title) || args.template.id;
  const fallbackPart = sanitizeFileNamePart(args.fallbackInstanceId) || 'sheet';

  return `${templatePart}-${namePart || fallbackPart}.pdf`;
};

export const fillPdfTemplate = async (args: {
  template: CharacterSheetTemplate;
  values: CharacterSheetValues;
}): Promise<Blob> => {
  const pdfLib = await import('pdf-lib');
  const response = await fetch(args.template.pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to load template PDF: ${args.template.pdfUrl}`);
  }

  const sourceBytes = await response.arrayBuffer();
  const pdfDocument = await pdfLib.PDFDocument.load(sourceBytes);
  const form = pdfDocument.getForm();
  const fields = form.getFields();
  const byName = new Map(fields.map((field) => [field.getName(), field]));

  for (const [fieldName, rawValue] of Object.entries(args.values)) {
    const field = byName.get(fieldName);
    if (!field) {
      continue;
    }

    try {
      if (field instanceof pdfLib.PDFTextField) {
        field.setText(typeof rawValue === 'string' ? rawValue : String(rawValue));
        continue;
      }

      if (field instanceof pdfLib.PDFCheckBox) {
        if (rawValue === true || rawValue === 'true' || rawValue === 'on') {
          field.check();
        } else {
          field.uncheck();
        }
        continue;
      }

      if (field instanceof pdfLib.PDFRadioGroup) {
        if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
          field.select(rawValue);
        }
        continue;
      }

      if (field instanceof pdfLib.PDFDropdown) {
        if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
          field.select(rawValue);
        }
        continue;
      }

      if (field instanceof pdfLib.PDFOptionList) {
        if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
          field.select(rawValue);
        }
      }
    } catch {
      // Ignore unsupported field write errors and continue with remaining fields.
    }
  }

  const bytes = await pdfDocument.save();
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);
  return new Blob([safeBytes], {
    type: 'application/pdf'
  });
};

export const triggerPdfDownload = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};
