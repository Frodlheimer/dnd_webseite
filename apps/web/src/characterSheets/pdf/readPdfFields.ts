import type { CharacterSheetValues } from '../types';

export type ReadPdfFieldsResult = {
  values: CharacterSheetValues;
  fieldNames: string[];
};

export const readPdfFields = async (file: Blob): Promise<ReadPdfFieldsResult> => {
  const pdfLib = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const pdfDocument = await pdfLib.PDFDocument.load(bytes);
  const form = pdfDocument.getForm();
  const fields = form.getFields();
  const values: CharacterSheetValues = {};
  const fieldNames: string[] = [];

  for (const field of fields) {
    const fieldName = field.getName();
    fieldNames.push(fieldName);

    if (field instanceof pdfLib.PDFTextField) {
      values[fieldName] = field.getText() ?? '';
      continue;
    }

    if (field instanceof pdfLib.PDFCheckBox) {
      values[fieldName] = field.isChecked();
      continue;
    }

    if (field instanceof pdfLib.PDFRadioGroup) {
      const selected = field.getSelected();
      values[fieldName] = selected ?? '';
      continue;
    }

    if (field instanceof pdfLib.PDFDropdown) {
      const selected = field.getSelected();
      values[fieldName] = selected[0] ?? '';
      continue;
    }

    if (field instanceof pdfLib.PDFOptionList) {
      const selected = field.getSelected();
      values[fieldName] = selected.join(', ');
      continue;
    }
  }

  return {
    values,
    fieldNames
  };
};
