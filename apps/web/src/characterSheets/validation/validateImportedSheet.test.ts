import { describe, expect, it } from 'vitest';

import {
  buildExtractedFieldsFromValues,
  buildParsedCharacterData,
  validateImportedSheet
} from './validateImportedSheet';

describe('validateImportedSheet', () => {
  it('flags invalid numeric and malformed values', () => {
    const extracted = buildExtractedFieldsFromValues({
      'Front_Character Name': 'Elara',
      'Front_Str Score': '44',
      Front_AC: 'abc',
      'Front_Death Save Success 1': 'maybe'
    });
    const parsedData = buildParsedCharacterData(extracted);
    const result = validateImportedSheet(parsedData, extracted);

    expect(result.errors.some((issue) => issue.message.includes('Expected a numeric value.'))).toBe(true);
    expect(result.errors.some((issue) => issue.message.includes('Death save value should be a checkbox boolean.'))).toBe(
      true
    );
    expect(
      result.warnings.some((issue) => issue.message.includes('Ability score is outside the expected range'))
    ).toBe(true);
  });

  it('reports warnings for missing optional/recommended data', () => {
    const extracted = buildExtractedFieldsFromValues({
      'Front_Character Name': 'Elara'
    });
    const parsedData = buildParsedCharacterData(extracted);
    const result = validateImportedSheet(parsedData, extracted);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((issue) => issue.message.includes('recommended'))).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('preserves successful fields and parsed values', () => {
    const extracted = buildExtractedFieldsFromValues({
      'Front_Character Name': 'Elara',
      'Front_Str Score': '15',
      Front_AC: '17',
      Front_Initiative: '+2'
    });
    const parsedData = buildParsedCharacterData(extracted);
    const result = validateImportedSheet(parsedData, extracted);

    const acRow = result.extractedRows.find((row) => row.fieldName === 'Front_AC');
    const strRow = result.extractedRows.find((row) => row.fieldName === 'Front_Str Score');
    expect(acRow?.parsedValue).toBe(17);
    expect(acRow?.status).toBe('ok');
    expect(strRow?.parsedValue).toBe(15);
    expect(strRow?.status).toBe('ok');
    expect(result.normalizedData.combat.ac).toBe(17);
    expect(result.normalizedData.coreStats.str_score).toBe(15);
    expect(result.normalizedData.identity.character_name).toBe('Elara');
  });
});
