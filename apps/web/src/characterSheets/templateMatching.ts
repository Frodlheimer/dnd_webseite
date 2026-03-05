import type { CharacterSheetTemplateMatchResult, CharacterSheetTemplateSummary } from './types';

const normalizeFieldName = (value: string): string => {
  return value.trim().toLowerCase();
};

const uniqueNormalizedNames = (values: string[]): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeFieldName(value);
    if (normalized.length > 0) {
      set.add(normalized);
    }
  }
  return [...set];
};

export const calculateTemplateMatch = (args: {
  uploadedFieldNames: string[];
  templateFieldNames: string[];
  templateId: string;
}): CharacterSheetTemplateMatchResult => {
  const uploaded = uniqueNormalizedNames(args.uploadedFieldNames);
  const template = uniqueNormalizedNames(args.templateFieldNames);
  const templateSet = new Set<string>(template);

  let overlapCount = 0;
  for (const fieldName of uploaded) {
    if (templateSet.has(fieldName)) {
      overlapCount += 1;
    }
  }

  const uploadedFieldCount = uploaded.length;
  const templateFieldCount = template.length;
  const denominator = Math.max(uploadedFieldCount, templateFieldCount, 1);
  const score = overlapCount / denominator;

  return {
    templateId: args.templateId,
    score,
    overlapCount,
    uploadedFieldCount,
    templateFieldCount
  };
};

export const pickBestTemplateMatch = (args: {
  uploadedFieldNames: string[];
  templates: Array<{
    summary: CharacterSheetTemplateSummary;
    fieldNames: string[];
  }>;
  minScore?: number;
}): CharacterSheetTemplateMatchResult | null => {
  const threshold = typeof args.minScore === 'number' ? args.minScore : 0.25;
  let best: CharacterSheetTemplateMatchResult | null = null;

  for (const template of args.templates) {
    const match = calculateTemplateMatch({
      uploadedFieldNames: args.uploadedFieldNames,
      templateFieldNames: template.fieldNames,
      templateId: template.summary.id
    });

    if (!best || match.score > best.score || (match.score === best.score && match.overlapCount > best.overlapCount)) {
      best = match;
    }
  }

  if (!best) {
    return null;
  }

  if (best.score < threshold) {
    return null;
  }

  return best;
};
