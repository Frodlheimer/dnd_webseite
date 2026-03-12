import type {
  CharacterSheetValues,
  ImportedCharacterData,
  ImportedSheetFieldRow,
  ImportedSheetSection
} from '../types';

type ExpectedValueType = 'text' | 'number' | 'boolean' | 'numberOrBoolean';

type RowIssueLevel = 'warning' | 'error';

type RowIssue = {
  level: RowIssueLevel;
  message: string;
};

type PresenceCheck = {
  label: string;
  section: ImportedSheetSection;
  message: string;
  matcher: (normalizedFieldName: string) => boolean;
};

const SECTION_ORDER: ImportedSheetSection[] = [
  'Identity',
  'Core stats',
  'Combat',
  'Skills',
  'Spellcasting',
  'Features / Notes'
];

const ABILITY_TOKEN_BY_KEY: Record<string, string[]> = {
  str: ['str', 'strength', 'staerke'],
  dex: ['dex', 'dexterity', 'ges', 'geschicklichkeit'],
  con: ['con', 'constitution', 'kon'],
  int: ['int', 'intelligence'],
  wis: ['wis', 'wisdom', 'wei', 'weisheit'],
  cha: ['cha', 'charisma']
};

const normalizeForMatching = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const includesWord = (value: string, word: string): boolean => {
  const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
  return regex.test(value);
};

const isBlankValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
};

const isSkillRelatedField = (normalized: string): boolean => {
  return (
    /(\bskill\b|\bproficiency\b|\bexpertise\b|\bsaving throw\b|\bsave\b|\brw\b)/i.test(normalized) ||
    /(\bathletics\b|\bacrobatics\b|\bsleight of hand\b|\bstealth\b|\barcana\b|\bhistory\b|\binvestigation\b|\bnature\b|\breligion\b|\banimal handling\b|\binsight\b|\bmedicine\b|\bperception\b|\bsurvival\b|\bdeception\b|\bintimidation\b|\bperformance\b|\bpersuasion\b)/i.test(
      normalized
    ) ||
    /(\bpassive perception\b|\bpassive insight\b)/i.test(normalized)
  );
};

const isDeathSaveField = (normalized: string): boolean => {
  return /(\bdeath save\b|\bdeathsave\b|\btodesrettung\b)/i.test(normalized);
};

const isSpellField = (normalized: string): boolean => {
  return /(\bspell\b|\bcantrip\b|\bslot\b|\britual\b|\bspellbook\b|\bspellcasting\b)/i.test(
    normalized
  );
};

const isCombatNumericField = (normalized: string): boolean => {
  return (
    /(\bac\b|\barmor class\b|\binitiative\b|\bhp\b|\bhit points?\b|\bhit dice\b|\btemp hp\b|\bweapon attack\b|\battack bonus\b|\bdamage\b)/i.test(
      normalized
    ) && !isDeathSaveField(normalized)
  );
};

const isCoreStatsField = (normalized: string): boolean => {
  const hasAbilityToken = Object.values(ABILITY_TOKEN_BY_KEY).some((tokens) => {
    return tokens.some((token) => includesWord(normalized, token));
  });

  if (!hasAbilityToken) {
    return false;
  }

  if (isSkillRelatedField(normalized) || isSpellField(normalized) || isCombatNumericField(normalized)) {
    return false;
  }

  return true;
};

const isIdentityField = (normalized: string): boolean => {
  return /(\bcharacter name\b|\bcharaktername\b|\bplayer name\b|\bspielername\b|\brace\b|\bvolk\b|\bbackground\b|\bhintergrund\b|\balignment\b|\bxp\b|\berfahrung\b|\blevel\b|\bstufe\b|\bclass and level\b|\bklasse und stufe\b)/i.test(
    normalized
  );
};

const isClassOrLevelField = (normalized: string): boolean => {
  return /(\blevel\b|\bstufe\b|\bclass and level\b|\bklasse und stufe\b|\barchetype\b)/i.test(
    normalized
  );
};

const isCharacterNameField = (normalized: string): boolean => {
  return /(\bcharacter name\b|\bcharaktername\b)/i.test(normalized);
};

const isRaceField = (normalized: string): boolean => {
  return /(\brace\b|\bvolk\b)/i.test(normalized);
};

const isAbilityTokenField = (normalized: string, abilityKey: string): boolean => {
  const tokens = ABILITY_TOKEN_BY_KEY[abilityKey];
  if (!tokens) {
    return false;
  }
  return tokens.some((token) => includesWord(normalized, token));
};

const isAbilityModifierField = (normalized: string): boolean => {
  return /(\bmod\b|\bmodifier\b)/i.test(normalized);
};

const isAbilityScoreField = (normalized: string): boolean => {
  const hasAbility = Object.keys(ABILITY_TOKEN_BY_KEY).some((abilityKey) =>
    isAbilityTokenField(normalized, abilityKey)
  );
  if (!hasAbility) {
    return false;
  }

  if (isAbilityModifierField(normalized) || isSkillRelatedField(normalized)) {
    return false;
  }

  if (/(\bscore\b|\bwert\b|\bability\b)/i.test(normalized)) {
    return true;
  }

  return Object.values(ABILITY_TOKEN_BY_KEY).some((tokens) => {
    return tokens.some((token) => normalized === token || normalized.endsWith(` ${token}`));
  });
};

const isArmorClassField = (normalized: string): boolean => {
  return /(\bac\b|\barmor class\b)/i.test(normalized);
};

const isInitiativeField = (normalized: string): boolean => {
  return /\binitiative\b/i.test(normalized);
};

const isHitPointsField = (normalized: string): boolean => {
  return /(\bhp\b|\bhit points?\b)/i.test(normalized);
};

const isSpellSaveDcField = (normalized: string): boolean => {
  return /\bspell save dc\b/i.test(normalized);
};

const isSpellAttackBonusField = (normalized: string): boolean => {
  return /\bspell attack( bonus)?\b/i.test(normalized);
};

const isProficiencyBonusField = (normalized: string): boolean => {
  return /(\bproficiency bonus\b|\bubungsbonus\b|\bungsbonus\b)/i.test(normalized);
};

const parseIntegerFromString = (value: string): number | null => {
  const normalized = value.trim();
  if (!/^[-+]?\d+$/.test(normalized)) {
    return null;
  }
  return Number.parseInt(normalized, 10);
};

const parseBooleanLikeString = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'on', 'checked', '1'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'off', 'unchecked', '0'].includes(normalized)) {
    return false;
  }
  return null;
};

const formatFieldLabel = (fieldName: string): string => {
  const withoutPrefix = fieldName.replace(/^(front|back|sheet|page\d+)[ _-]+/i, '');
  const spaced = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.length > 0 ? spaced : fieldName;
};

const detectSection = (fieldName: string, label: string): ImportedSheetSection => {
  const normalized = normalizeForMatching(`${fieldName} ${label}`);
  if (isIdentityField(normalized)) {
    return 'Identity';
  }
  if (isSpellField(normalized)) {
    return 'Spellcasting';
  }
  if (isDeathSaveField(normalized) || isCombatNumericField(normalized)) {
    return 'Combat';
  }
  if (isSkillRelatedField(normalized)) {
    return 'Skills';
  }
  if (isCoreStatsField(normalized)) {
    return 'Core stats';
  }
  return 'Features / Notes';
};

const inferExpectedValueType = (normalized: string, section: ImportedSheetSection): ExpectedValueType => {
  if (isDeathSaveField(normalized)) {
    return 'boolean';
  }

  if (section === 'Identity') {
    if (/\b(level|stufe|xp|experience|erfahrung)\b/i.test(normalized)) {
      return 'number';
    }
    return 'text';
  }

  if (section === 'Core stats') {
    if (isAbilityScoreField(normalized) || isAbilityModifierField(normalized) || isProficiencyBonusField(normalized)) {
      return 'number';
    }
    if (isSkillRelatedField(normalized)) {
      return 'numberOrBoolean';
    }
    return 'numberOrBoolean';
  }

  if (section === 'Combat') {
    if (isCombatNumericField(normalized)) {
      return 'number';
    }
    return 'numberOrBoolean';
  }

  if (section === 'Skills') {
    return 'numberOrBoolean';
  }

  if (section === 'Spellcasting') {
    if (isSpellSaveDcField(normalized) || isSpellAttackBonusField(normalized)) {
      return 'number';
    }
    if (/\b(cantrips? known|spells? known)\b/i.test(normalized)) {
      return 'number';
    }
    return 'numberOrBoolean';
  }

  return 'text';
};

const parseExpectedValue = (rawValue: unknown, expected: ExpectedValueType): { parsedValue: unknown; issues: RowIssue[] } => {
  if (expected === 'text') {
    return {
      parsedValue: rawValue,
      issues: []
    };
  }

  if (expected === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return {
        parsedValue: rawValue,
        issues: []
      };
    }

    if (typeof rawValue === 'string') {
      if (rawValue.trim().length === 0) {
        return {
          parsedValue: '',
          issues: []
        };
      }

      const parsed = parseBooleanLikeString(rawValue);
      if (parsed !== null) {
        return {
          parsedValue: parsed,
          issues: []
        };
      }
    }

    return {
      parsedValue: rawValue,
      issues: [
        {
          level: 'error',
          message: 'Expected a checkbox-style boolean value.'
        }
      ]
    };
  }

  if (expected === 'number') {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return {
        parsedValue: rawValue,
        issues: []
      };
    }

    if (typeof rawValue === 'boolean') {
      return {
        parsedValue: rawValue,
        issues: [
          {
            level: 'error',
            message: 'Expected a numeric value but received a boolean.'
          }
        ]
      };
    }

    if (typeof rawValue === 'string') {
      if (rawValue.trim().length === 0) {
        return {
          parsedValue: '',
          issues: []
        };
      }
      const parsed = parseIntegerFromString(rawValue);
      if (parsed !== null) {
        return {
          parsedValue: parsed,
          issues: []
        };
      }
    }

    return {
      parsedValue: rawValue,
      issues: [
        {
          level: 'error',
          message: 'Expected a numeric value.'
        }
      ]
    };
  }

  if (expected === 'numberOrBoolean') {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return {
        parsedValue: rawValue,
        issues: []
      };
    }

    if (typeof rawValue === 'boolean') {
      return {
        parsedValue: rawValue,
        issues: []
      };
    }

    if (typeof rawValue === 'string') {
      if (rawValue.trim().length === 0) {
        return {
          parsedValue: '',
          issues: []
        };
      }

      const maybeBoolean = parseBooleanLikeString(rawValue);
      if (maybeBoolean !== null) {
        return {
          parsedValue: maybeBoolean,
          issues: []
        };
      }

      const maybeNumber = parseIntegerFromString(rawValue);
      if (maybeNumber !== null) {
        return {
          parsedValue: maybeNumber,
          issues: []
        };
      }
    }

    return {
      parsedValue: rawValue,
      issues: [
        {
          level: 'warning',
          message: 'Value is not parseable as a number/boolean.'
        }
      ]
    };
  }

  return {
    parsedValue: rawValue,
    issues: []
  };
};

const statusFromIssues = (issues: RowIssue[]): ImportedSheetFieldRow['status'] => {
  if (issues.some((issue) => issue.level === 'error')) {
    return 'error';
  }
  if (issues.some((issue) => issue.level === 'warning')) {
    return 'warning';
  }
  return 'ok';
};

const buildNormalizedKey = (fieldName: string, label: string): string => {
  const normalized = normalizeForMatching(label.length > 0 ? label : fieldName);
  if (normalized.length === 0) {
    return `field_${normalizeForMatching(fieldName).replace(/\s+/g, '_')}`;
  }
  return normalized.replace(/\s+/g, '_');
};

const putUniqueValue = (target: Record<string, unknown>, key: string, value: unknown): void => {
  if (!(key in target)) {
    target[key] = value;
    return;
  }

  let index = 2;
  let nextKey = `${key}_${index}`;
  while (nextKey in target) {
    index += 1;
    nextKey = `${key}_${index}`;
  }
  target[nextKey] = value;
};

const cloneImportedData = (value: ImportedCharacterData): ImportedCharacterData => {
  return {
    identity: {
      ...value.identity
    },
    coreStats: {
      ...value.coreStats
    },
    combat: {
      ...value.combat
    },
    skills: {
      ...value.skills
    },
    spellcasting: {
      ...value.spellcasting
    },
    featuresNotes: {
      ...value.featuresNotes
    }
  };
};

const cloneExtractedRow = (row: ImportedSheetFieldRow): ImportedSheetFieldRow => {
  return {
    ...row,
    ...(row.issues ? { issues: [...row.issues] } : {})
  };
};

const isStatusHigher = (next: ImportedSheetFieldRow['status'], current: ImportedSheetFieldRow['status']): boolean => {
  const order: Record<ImportedSheetFieldRow['status'], number> = {
    ok: 0,
    warning: 1,
    error: 2
  };
  return order[next] > order[current];
};

const hasSameIssue = (collection: ValidationIssue[], issue: ValidationIssue): boolean => {
  return collection.some((entry) => {
    return (
      entry.level === issue.level &&
      entry.section === issue.section &&
      entry.fieldName === issue.fieldName &&
      entry.message === issue.message
    );
  });
};

const pushValidationIssue = (
  issue: ValidationIssue,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void => {
  if (issue.level === 'error') {
    if (!hasSameIssue(errors, issue)) {
      errors.push(issue);
    }
    return;
  }

  if (!hasSameIssue(warnings, issue)) {
    warnings.push(issue);
  }
};

const addIssueToRow = (
  rows: ImportedSheetFieldRow[],
  rowIndex: number,
  issue: RowIssue,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void => {
  const row = rows[rowIndex];
  if (!row) {
    return;
  }

  const nextIssues = row.issues ? [...row.issues] : [];
  if (!nextIssues.includes(issue.message)) {
    nextIssues.push(issue.message);
  }
  row.issues = nextIssues;

  const nextStatus: ImportedSheetFieldRow['status'] = issue.level === 'error' ? 'error' : 'warning';
  if (isStatusHigher(nextStatus, row.status)) {
    row.status = nextStatus;
  }

  const validationIssue: ValidationIssue = {
    fieldName: row.fieldName,
    section: row.section,
    level: issue.level,
    message: issue.message
  };

  pushValidationIssue(validationIssue, errors, warnings);
};

const addSyntheticIssueRow = (
  rows: ImportedSheetFieldRow[],
  issue: ValidationIssue,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void => {
  rows.push({
    fieldName: issue.fieldName ?? `missing_${normalizeForMatching(issue.message).replace(/\s+/g, '_')}`,
    label: issue.fieldName ?? 'Missing field',
    rawValue: '',
    parsedValue: '',
    section: issue.section,
    status: issue.level,
    issues: [issue.message]
  });

  pushValidationIssue(issue, errors, warnings);
};

const REQUIRED_AND_RECOMMENDED_CHECKS: PresenceCheck[] = [
  {
    label: 'Character Name',
    section: 'Identity',
    message: 'Character Name is empty.',
    matcher: isCharacterNameField
  },
  {
    label: 'Class / Level',
    section: 'Identity',
    message: 'Class / Level is missing (recommended).',
    matcher: isClassOrLevelField
  },
  {
    label: 'Race',
    section: 'Identity',
    message: 'Race is missing (recommended).',
    matcher: isRaceField
  },
  {
    label: 'Strength score',
    section: 'Core stats',
    message: 'Strength score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'str')
  },
  {
    label: 'Dexterity score',
    section: 'Core stats',
    message: 'Dexterity score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'dex')
  },
  {
    label: 'Constitution score',
    section: 'Core stats',
    message: 'Constitution score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'con')
  },
  {
    label: 'Intelligence score',
    section: 'Core stats',
    message: 'Intelligence score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'int')
  },
  {
    label: 'Wisdom score',
    section: 'Core stats',
    message: 'Wisdom score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'wis')
  },
  {
    label: 'Charisma score',
    section: 'Core stats',
    message: 'Charisma score is missing (recommended).',
    matcher: (normalized) => isAbilityScoreField(normalized) && isAbilityTokenField(normalized, 'cha')
  },
  {
    label: 'Armor Class',
    section: 'Combat',
    message: 'Armor Class is missing (recommended).',
    matcher: isArmorClassField
  },
  {
    label: 'Initiative',
    section: 'Combat',
    message: 'Initiative is missing (recommended).',
    matcher: isInitiativeField
  },
  {
    label: 'Hit Points',
    section: 'Combat',
    message: 'Hit Points are missing (recommended).',
    matcher: isHitPointsField
  }
];

export type ValidationIssue = {
  fieldName?: string;
  section: ImportedSheetSection;
  level: 'error' | 'warning';
  message: string;
};

export type ValidateImportedSheetResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalizedData: ImportedCharacterData;
  extractedRows: ImportedSheetFieldRow[];
};

export const buildExtractedFieldsFromValues = (values: CharacterSheetValues): ImportedSheetFieldRow[] => {
  return Object.entries(values).map(([fieldName, rawValue]) => {
    const label = formatFieldLabel(fieldName);
    const section = detectSection(fieldName, label);
    const normalized = normalizeForMatching(`${fieldName} ${label}`);
    const expectedType = inferExpectedValueType(normalized, section);
    const parsed = parseExpectedValue(rawValue, expectedType);

    return {
      fieldName,
      label,
      rawValue,
      parsedValue: parsed.parsedValue,
      section,
      status: statusFromIssues(parsed.issues),
      ...(parsed.issues.length > 0 ? { issues: parsed.issues.map((issue) => issue.message) } : {})
    };
  });
};

export const buildParsedCharacterData = (rows: ImportedSheetFieldRow[]): ImportedCharacterData => {
  const next: ImportedCharacterData = {
    identity: {},
    coreStats: {},
    combat: {},
    skills: {},
    spellcasting: {},
    featuresNotes: {}
  };

  const writeToSection = (sectionName: ImportedSheetSection, key: string, value: unknown): void => {
    if (sectionName === 'Identity') {
      putUniqueValue(next.identity, key, value);
      return;
    }
    if (sectionName === 'Core stats') {
      putUniqueValue(next.coreStats, key, value);
      return;
    }
    if (sectionName === 'Combat') {
      putUniqueValue(next.combat, key, value);
      return;
    }
    if (sectionName === 'Skills') {
      putUniqueValue(next.skills, key, value);
      return;
    }
    if (sectionName === 'Spellcasting') {
      putUniqueValue(next.spellcasting, key, value);
      return;
    }
    putUniqueValue(next.featuresNotes, key, value);
  };

  for (const row of rows) {
    const key = buildNormalizedKey(row.fieldName, row.label);
    writeToSection(row.section, key, row.parsedValue);
  }

  return next;
};

export const validateImportedSheet = (
  parsedData: ImportedCharacterData,
  extractedFields: ImportedSheetFieldRow[]
): ValidateImportedSheetResult => {
  const rows = extractedFields.map(cloneExtractedRow);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const row of rows) {
    if (!row.issues || row.issues.length === 0 || row.status === 'ok') {
      continue;
    }

    const level: ValidationIssue['level'] = row.status === 'error' ? 'error' : 'warning';
    for (const message of row.issues) {
      pushValidationIssue(
        {
          fieldName: row.fieldName,
          section: row.section,
          level,
          message
        },
        errors,
        warnings
      );
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }

    const normalized = normalizeForMatching(`${row.fieldName} ${row.label}`);
    const parsedValue = row.parsedValue;

    if (typeof parsedValue === 'number' && Number.isFinite(parsedValue)) {
      if (isAbilityScoreField(normalized) && (parsedValue < 1 || parsedValue > 30)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Ability score is outside the expected range (1-30).'
          },
          errors,
          warnings
        );
      }

      if (isAbilityModifierField(normalized) && (parsedValue < -10 || parsedValue > 15)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Ability modifier is outside the expected range (-10 to +15).'
          },
          errors,
          warnings
        );
      }

      if (isArmorClassField(normalized) && (parsedValue < 0 || parsedValue > 40)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Armor Class looks suspicious (expected 0-40).'
          },
          errors,
          warnings
        );
      }

      if (isInitiativeField(normalized) && (parsedValue < -20 || parsedValue > 20)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Initiative looks suspicious (expected -20 to +20).'
          },
          errors,
          warnings
        );
      }

      if (isHitPointsField(normalized) && (parsedValue < 0 || parsedValue > 1000)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Hit Points look suspicious (expected 0-1000).'
          },
          errors,
          warnings
        );
      }

      if (isSpellSaveDcField(normalized) && (parsedValue < 1 || parsedValue > 40)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Spell Save DC looks suspicious (expected 1-40).'
          },
          errors,
          warnings
        );
      }

      if (isSpellAttackBonusField(normalized) && (parsedValue < -20 || parsedValue > 20)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Spell Attack Bonus looks suspicious (expected -20 to +20).'
          },
          errors,
          warnings
        );
      }

      if (isProficiencyBonusField(normalized) && (parsedValue < -5 || parsedValue > 20)) {
        addIssueToRow(
          rows,
          index,
          {
            level: 'warning',
            message: 'Proficiency bonus looks suspicious (expected -5 to +20).'
          },
          errors,
          warnings
        );
      }
    }

    if (isDeathSaveField(normalized) && !isBlankValue(row.rawValue) && typeof parsedValue !== 'boolean') {
      addIssueToRow(
        rows,
        index,
        {
          level: 'error',
          message: 'Death save value should be a checkbox boolean.'
        },
        errors,
        warnings
      );
    }

    if (
      isSkillRelatedField(normalized) &&
      !isBlankValue(row.rawValue) &&
      typeof parsedValue !== 'number' &&
      typeof parsedValue !== 'boolean'
    ) {
      addIssueToRow(
        rows,
        index,
        {
          level: 'warning',
          message: 'Skill/proficiency value is not parseable as number or checkbox.'
        },
        errors,
        warnings
      );
    }
  }

  for (const check of REQUIRED_AND_RECOMMENDED_CHECKS) {
    const matchingIndexes = rows
      .map((row, index) => ({
        index,
        normalized: normalizeForMatching(`${row.fieldName} ${row.label}`)
      }))
      .filter((entry) => check.matcher(entry.normalized))
      .map((entry) => entry.index);

    if (matchingIndexes.length === 0) {
      addSyntheticIssueRow(
        rows,
        {
          fieldName: check.label,
          section: check.section,
          level: 'warning',
          message: check.message
        },
        errors,
        warnings
      );
      continue;
    }

    const hasValue = matchingIndexes.some((rowIndex) => {
      const row = rows[rowIndex];
      return row ? !isBlankValue(row.rawValue) : false;
    });
    if (!hasValue) {
      const rowIndex = matchingIndexes[0];
      if (rowIndex !== undefined) {
        addIssueToRow(
          rows,
          rowIndex,
          {
            level: 'warning',
            message: check.message
          },
          errors,
          warnings
        );
      }
    }
  }

  rows.sort((left, right) => {
    const leftSectionIndex = SECTION_ORDER.indexOf(left.section);
    const rightSectionIndex = SECTION_ORDER.indexOf(right.section);
    if (leftSectionIndex !== rightSectionIndex) {
      return leftSectionIndex - rightSectionIndex;
    }
    return left.label.localeCompare(right.label);
  });

  const normalizedData = buildParsedCharacterData(rows);
  const clonedParsedData = cloneImportedData(parsedData);

  return {
    errors,
    warnings,
    normalizedData: {
      identity: {
        ...clonedParsedData.identity,
        ...normalizedData.identity
      },
      coreStats: {
        ...clonedParsedData.coreStats,
        ...normalizedData.coreStats
      },
      combat: {
        ...clonedParsedData.combat,
        ...normalizedData.combat
      },
      skills: {
        ...clonedParsedData.skills,
        ...normalizedData.skills
      },
      spellcasting: {
        ...clonedParsedData.spellcasting,
        ...normalizedData.spellcasting
      },
      featuresNotes: {
        ...clonedParsedData.featuresNotes,
        ...normalizedData.featuresNotes
      }
    },
    extractedRows: rows
  };
};
