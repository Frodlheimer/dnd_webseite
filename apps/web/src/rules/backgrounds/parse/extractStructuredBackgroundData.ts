import type {
  BackgroundItemChoiceGroup,
  BackgroundItemGrant,
  BackgroundSection,
  BackgroundStructuredData,
  RuleBlock
} from '../model';
import type { BackgroundSourcePage } from './extractBackgrounds';
import {
  ALL_LANGUAGE_OPTIONS,
  ALL_SKILL_OPTIONS,
  ARTISAN_TOOL_OPTIONS,
  EXOTIC_LANGUAGE_OPTIONS,
  GAMING_SET_OPTIONS,
  MUSICAL_INSTRUMENT_OPTIONS,
  cleanEquipmentNoise,
  collapseWhitespace,
  dedupeStrings,
  extractFirstSentence,
  foldBackgroundText,
  normalizeLanguageName,
  normalizeSkillName,
  normalizeText,
  normalizeToolName,
  parseChoiceCount,
  removeLeadingArticle,
  slugifyBackgroundValue
} from './normalizeNames';
import { treeToBlocks } from './treeToBlocks';

type OutlineSection = {
  id: string;
  title: string;
  level: number;
  blocks: RuleBlock[];
  children: OutlineSection[];
};

type ParsedChoice = {
  choose: number;
  from: string[];
};

type ParsedGrantSet = {
  fixed: string[];
  choice: ParsedChoice | null;
};

type EquipmentCoins = Exclude<BackgroundStructuredData['equipment']['coins'], undefined>;
type BackgroundPersonality = NonNullable<BackgroundStructuredData['personality']>;

const uniqueStrings = (values: string[]): string[] => dedupeStrings(values.filter(Boolean));

const mergeChoice = (left: ParsedChoice | null, right: ParsedChoice | null): ParsedChoice | null => {
  if (!left && !right) {
    return null;
  }
  if (!left) {
    return right ? { choose: right.choose, from: [...right.from] } : null;
  }
  if (!right) {
    return { choose: left.choose, from: [...left.from] };
  }
  return {
    choose: left.choose + right.choose,
    from: uniqueStrings([...left.from, ...right.from])
  };
};

const splitTopLevelList = (value: string): string[] => {
  const normalized = normalizeText(value)
    .replace(/\band\b/gi, ',')
    .replace(/,\s*or\s+/gi, ' or ')
    .replace(/,\s+/g, ',');
  return normalized
    .split(',')
    .map((entry) => collapseWhitespace(entry))
    .filter(Boolean);
};

const blocksToText = (blocks: RuleBlock[]): string => {
  return blocks
    .flatMap((block) => {
      if (block.type === 'p') {
        return [block.text];
      }
      if (block.type === 'list') {
        return block.items;
      }
      if (block.type === 'table') {
        return block.rows.map((row) => row[row.length - 1] ?? '').filter(Boolean);
      }
      return [];
    })
    .map((entry) => collapseWhitespace(entry))
    .filter(Boolean)
    .join('\n');
};

const buildOutline = (blocks: RuleBlock[]): { introBlocks: RuleBlock[]; sections: OutlineSection[] } => {
  const root: OutlineSection = {
    id: 'root',
    title: 'root',
    level: 0,
    blocks: [],
    children: []
  };
  const stack: OutlineSection[] = [root];

  blocks.forEach((block, index) => {
    if (
      block.type === 'h1' ||
      block.type === 'h2' ||
      block.type === 'h3' ||
      block.type === 'h4' ||
      block.type === 'h5' ||
      block.type === 'h6'
    ) {
      const level = Number.parseInt(block.type.slice(1), 10);
      while ((stack[stack.length - 1]?.level ?? 0) >= level) {
        stack.pop();
      }
      const section: OutlineSection = {
        id: `${slugifyBackgroundValue(block.text)}-${index}`,
        title: block.text,
        level,
        blocks: [],
        children: []
      };
      stack[stack.length - 1]?.children.push(section);
      stack.push(section);
      return;
    }

    stack[stack.length - 1]?.blocks.push(block);
  });

  return {
    introBlocks: root.blocks,
    sections: root.children
  };
};

const collectLabelValues = (blocks: RuleBlock[]): Record<string, string> => {
  const output: Record<string, string> = {};
  blocks
    .filter((block): block is Extract<RuleBlock, { type: 'p' }> => block.type === 'p')
    .forEach((block) => {
      block.text.split('\n').forEach((line) => {
        const match = line.match(
          /^(Skill Proficiencies|Tool Proficiencies|Languages|Equipment)\s*:\s*(.+)$/i
        );
        if (!match?.[1] || !match[2]) {
          return;
        }
        output[match[1].toLowerCase()] = collapseWhitespace(match[2]);
      });
    });
  return output;
};

const parseFixedList = (value: string, normalizer: (entry: string) => string): string[] => {
  if (!value || /^none$/i.test(value.trim())) {
    return [];
  }
  return uniqueStrings(
    splitTopLevelList(value)
      .flatMap((entry) => entry.split(/\s+\bor\b\s+/i))
      .map((entry) => removeLeadingArticle(entry))
      .map((entry) => normalizer(entry))
      .filter(Boolean)
  );
};

const parseSkillGrants = (value: string | undefined): ParsedGrantSet => {
  const normalized = collapseWhitespace(value ?? '');
  if (!normalized || /^none$/i.test(normalized)) {
    return {
      fixed: [],
      choice: null
    };
  }

  const chooseFromMatch = normalized.match(/^(?:choose\s+)?(one|two|three|\d+)\s+from\s+(.+)$/i);
  if (chooseFromMatch?.[1] && chooseFromMatch[2]) {
    return {
      fixed: [],
      choice: {
        choose: parseChoiceCount(chooseFromMatch[1]) ?? 1,
        from: parseFixedList(chooseFromMatch[2], normalizeSkillName)
      }
    };
  }

  const freeChoiceMatch = normalized.match(/^(one|two|three|\d+)\s+of your choice$/i);
  if (freeChoiceMatch?.[1]) {
    return {
      fixed: [],
      choice: {
        choose: parseChoiceCount(freeChoiceMatch[1]) ?? 1,
        from: [...ALL_SKILL_OPTIONS]
      }
    };
  }

  if (!normalized.includes(',') && /\s+\bor\b\s+/i.test(normalized)) {
    return {
      fixed: [],
      choice: {
        choose: 1,
        from: parseFixedList(normalized, normalizeSkillName)
      }
    };
  }

  return {
    fixed: parseFixedList(normalized, normalizeSkillName),
    choice: null
  };
};

const expandToolOption = (value: string): string[] => {
  const normalized = foldBackgroundText(removeLeadingArticle(value));
  if (!normalized || normalized === 'none') {
    return [];
  }
  if (normalized.includes("artisan s tools")) {
    return [...ARTISAN_TOOL_OPTIONS];
  }
  if (normalized.includes('gaming set')) {
    return [...GAMING_SET_OPTIONS];
  }
  if (normalized.includes('musical instrument')) {
    return [...MUSICAL_INSTRUMENT_OPTIONS];
  }
  return [normalizeToolName(value)];
};

const parseToolGrants = (value: string | undefined): ParsedGrantSet => {
  const normalized = collapseWhitespace(value ?? '');
  if (!normalized || /^none$/i.test(normalized)) {
    return {
      fixed: [],
      choice: null
    };
  }

  const segments = splitTopLevelList(normalized);
  const fixed = new Set<string>();
  let choice: ParsedChoice | null = null;

  segments.forEach((segment) => {
    const lowered = foldBackgroundText(segment);
    if (!lowered) {
      return;
    }

    if (
      lowered.includes("artisan s tools") ||
      lowered.includes('gaming set') ||
      lowered.includes('musical instrument') ||
      /\s+\bor\b\s+/.test(segment)
    ) {
      const options = uniqueStrings(
        segment
          .split(/\s+\bor\b\s+/i)
          .flatMap((part) => expandToolOption(part))
      );
      if (options.length > 0) {
        choice = mergeChoice(choice, {
          choose: 1,
          from: options
        });
      }
      return;
    }

    expandToolOption(segment).forEach((entry) => fixed.add(entry));
  });

  return {
    fixed: [...fixed],
    choice
  };
};

const parseLanguageGrants = (value: string | undefined): ParsedGrantSet => {
  const normalized = collapseWhitespace(value ?? '');
  if (!normalized || /^none$/i.test(normalized)) {
    return {
      fixed: [],
      choice: null
    };
  }

  const segments = splitTopLevelList(normalized);
  const fixed = new Set<string>();
  let choice: ParsedChoice | null = null;

  segments.forEach((segment) => {
    const chooseMatch = segment.match(
      /^(one|two|three|\d+)\s+(exotic\s+language|language|languages|of your choice)(?:\s+of your choice)?$/i
    );
    if (chooseMatch?.[1]) {
      const choiceScope = chooseMatch[2] ?? '';
      const options =
        /exotic/i.test(choiceScope) ? [...EXOTIC_LANGUAGE_OPTIONS] : [...ALL_LANGUAGE_OPTIONS];
      choice = mergeChoice(choice, {
        choose: parseChoiceCount(chooseMatch[1]) ?? 1,
        from: options
      });
      return;
    }

    if (!segment.includes(',') && /\s+\bor\b\s+/i.test(segment)) {
      choice = mergeChoice(choice, {
        choose: 1,
        from: parseFixedList(segment, normalizeLanguageName)
      });
      return;
    }

    parseFixedList(segment, normalizeLanguageName).forEach((entry) => fixed.add(entry));
  });

  return {
    fixed: [...fixed],
    choice
  };
};

const parseEquipmentCoins = (value: string): EquipmentCoins => {
  const output: NonNullable<EquipmentCoins> = {};
  const regex = /(\d+)\s*(cp|sp|ep|gp|pp)\b/gi;
  for (const match of value.matchAll(regex)) {
    const amount = Number.parseInt(match[1] ?? '', 10);
    const coin = match[2]?.toLowerCase() as keyof typeof output | undefined;
    if (!Number.isFinite(amount) || !coin) {
      continue;
    }
    output[coin] = (output[coin] ?? 0) + amount;
  }
  return Object.keys(output).length > 0 ? output : null;
};

const parseEquipmentItem = (value: string): BackgroundItemGrant | null => {
  const cleaned = cleanEquipmentNoise(value).replace(/\.$/, '');
  const trimmed = removeLeadingArticle(cleaned);
  if (!trimmed) {
    return null;
  }

  const quantityMatch = trimmed.match(/^(\d+)\s+(.+)$/);
  if (quantityMatch?.[1] && quantityMatch[2]) {
    return {
      name: collapseWhitespace(quantityMatch[2]),
      quantity: Number.parseInt(quantityMatch[1], 10),
      notes: null
    };
  }

  return {
    name: collapseWhitespace(trimmed),
    quantity: 1,
    notes: null
  };
};

const parseEquipment = (value: string | undefined): BackgroundStructuredData['equipment'] => {
  const rawText = cleanEquipmentNoise(value ?? '');
  if (!rawText) {
    return {
      fixedItems: [],
      choiceGroups: [],
      coins: null,
      rawText: null
    };
  }

  const normalized = rawText.replace(/,\s*and\s+/gi, ', ').replace(/\s+and\s+a\s+/gi, ', a ');
  const segments = normalized
    .split(/\s*,\s*/g)
    .map((segment) => collapseWhitespace(segment))
    .filter(Boolean);

  const fixedItems: BackgroundItemGrant[] = [];
  const choiceGroups: BackgroundItemChoiceGroup[] = [];

  segments.forEach((segment) => {
    if (/\s+\bor\b\s+/i.test(segment)) {
      const options = segment
        .split(/\s+\bor\b\s+/i)
        .map((part) => parseEquipmentItem(part))
        .filter((entry): entry is BackgroundItemGrant => !!entry);

      if (options.length > 1) {
        choiceGroups.push({
          choose: 1,
          options,
          label: segment
        });
        return;
      }
    }

    const item = parseEquipmentItem(segment);
    if (item) {
      fixedItems.push(item);
    }
  });

  return {
    fixedItems,
    choiceGroups,
    coins: parseEquipmentCoins(rawText) ?? null,
    rawText
  };
};

const sectionMatches = (section: OutlineSection, patterns: RegExp[]): boolean => {
  return patterns.some((pattern) => pattern.test(section.title));
};

const collectPersonalityItems = (section: OutlineSection): string[] => {
  const values = section.blocks.flatMap((block) => {
    if (block.type === 'table') {
      return block.rows
        .map((row) => row[row.length - 1] ?? '')
        .map((entry) => collapseWhitespace(entry))
        .filter(Boolean);
    }
    if (block.type === 'list') {
      return block.items.map((entry) => collapseWhitespace(entry)).filter(Boolean);
    }
    return [];
  });
  return uniqueStrings(values);
};

const collectStructuredSections = (
  sections: OutlineSection[],
  output: BackgroundSection[],
  inheritedKind: BackgroundSection['kind'] | null = null
): void => {
  sections.forEach((section) => {
    const titleFolded = foldBackgroundText(section.title);
    const text = blocksToText(section.blocks);
    let kind: BackgroundSection['kind'] = inheritedKind ?? 'other';

    if (titleFolded.includes('variant')) {
      kind = 'variant';
    } else if (titleFolded.includes('feature')) {
      kind = 'feature';
    } else if (
      titleFolded.includes('personality') ||
      titleFolded.includes('ideal') ||
      titleFolded.includes('bond') ||
      titleFolded.includes('flaw')
    ) {
      kind = 'personality';
    }

    if (section.title !== 'root') {
      const entry: BackgroundSection = {
        id: section.id,
        title: section.title,
        kind
      };
      if (text) {
        entry.text = text;
      }
      output.push(entry);
    }

    if (section.children.length > 0) {
      collectStructuredSections(section.children, output, kind);
    }
  });
};

const createFeatureValue = (featureRoot: OutlineSection | undefined): BackgroundStructuredData['feature'] => {
  if (!featureRoot) {
    return {
      name: null,
      summary: null,
      rulesText: null
    };
  }

  const featureSections = featureRoot.children.length > 0 ? featureRoot.children : [featureRoot];
  const primary =
    featureRoot.children.length > 0
      ? featureSections[featureSections.length - 1] ?? featureSections[0]
      : featureSections[0];
  const featureName = primary?.title ?? null;

  const primaryText = blocksToText(primary?.blocks ?? []);
  const rulesText = primary
    ? primaryText
      ? `${primary.title}\n${primaryText}`.trim()
      : primary.title
    : null;

  return {
    name: featureName,
    summary: extractFirstSentence(primaryText || rulesText || '') ?? null,
    rulesText: rulesText || null
  };
};

const collectVariantAliases = (variantRoot: OutlineSection | undefined): string[] => {
  if (!variantRoot) {
    return [];
  }
  const sections = variantRoot.children.length > 0 ? variantRoot.children : [variantRoot];
  return sections
    .map((section) => collapseWhitespace(section.title))
    .filter((title) => title && !/^variants?$/i.test(title));
};

const createStructuredTags = (detail: Omit<BackgroundStructuredData, 'tags'>): string[] => {
  const tags = new Set<string>();
  detail.categories.forEach((category) => {
    tags.add(`category:${slugifyBackgroundValue(category)}`);
  });
  if (detail.grants.skills.length > 0 || detail.grants.skillChoices) {
    tags.add('has:skill-proficiency');
  }
  if (detail.grants.tools.length > 0 || detail.grants.toolChoices) {
    tags.add('has:tool-proficiency');
  }
  if (detail.grants.languages.length > 0 || detail.grants.languageChoices) {
    tags.add('has:language');
  }
  if (detail.grants.skillChoices || detail.grants.toolChoices || detail.grants.languageChoices) {
    tags.add('has:choice');
  }
  if (detail.equipment.fixedItems.length > 0 || detail.equipment.choiceGroups.length > 0 || detail.equipment.coins) {
    tags.add('has:equipment');
  }
  if (detail.feature.name || detail.feature.rulesText) {
    tags.add('has:feature');
  }
  if (detail.structuredSections.some((section) => section.kind === 'variant')) {
    tags.add('has:variant');
  }
  return [...tags].sort((left, right) => left.localeCompare(right));
};

export const extractStructuredBackgroundData = (page: BackgroundSourcePage): BackgroundStructuredData => {
  const documentBlocks = treeToBlocks(page.content.tree);
  const { introBlocks, sections } = buildOutline(documentBlocks);
  const labelValues = collectLabelValues(documentBlocks);

  const skillGrants = parseSkillGrants(labelValues['skill proficiencies']);
  const toolGrants = parseToolGrants(labelValues['tool proficiencies']);
  const languageGrants = parseLanguageGrants(labelValues.languages);
  const equipment = parseEquipment(labelValues.equipment);

  const featureRoot = sections.find((section) => sectionMatches(section, [/^features?$/i]));
  const variantRoot = sections.find((section) => sectionMatches(section, [/^variants?$/i]));
  const suggestedRoot = sections.find((section) => /suggested characteristics/i.test(section.title));

  const feature = createFeatureValue(featureRoot);
  const variantAliases = collectVariantAliases(variantRoot);

  const personalitySections = (suggestedRoot?.children ?? sections).filter((section) =>
    sectionMatches(section, [/personality/i, /ideal/i, /bond/i, /flaw/i])
  );

  const traitSection = personalitySections.find((section) => /personality/i.test(section.title));
  const idealSection = personalitySections.find((section) => /ideal/i.test(section.title));
  const bondSection = personalitySections.find((section) => /bond/i.test(section.title));
  const flawSection = personalitySections.find((section) => /flaw/i.test(section.title));

  const personality: BackgroundPersonality = {};
  if (traitSection) {
    personality.traits = collectPersonalityItems(traitSection);
  }
  if (idealSection) {
    personality.ideals = collectPersonalityItems(idealSection);
  }
  if (bondSection) {
    personality.bonds = collectPersonalityItems(bondSection);
  }
  if (flawSection) {
    personality.flaws = collectPersonalityItems(flawSection);
  }

  const seedSections: BackgroundSection[] = [];
  if (labelValues['skill proficiencies']) {
    seedSections.push({
      id: 'skills',
      title: 'Skill Proficiencies',
      kind: 'skills',
      text: labelValues['skill proficiencies']
    });
  }
  if (labelValues['tool proficiencies']) {
    seedSections.push({
      id: 'tools',
      title: 'Tool Proficiencies',
      kind: 'tools',
      text: labelValues['tool proficiencies']
    });
  }
  if (labelValues.languages) {
    seedSections.push({
      id: 'languages',
      title: 'Languages',
      kind: 'languages',
      text: labelValues.languages
    });
  }
  if (labelValues.equipment) {
    seedSections.push({
      id: 'equipment',
      title: 'Equipment',
      kind: 'equipment',
      text: cleanEquipmentNoise(labelValues.equipment)
    });
  }

  const summaryParagraph = introBlocks.find((block): block is Extract<RuleBlock, { type: 'p' }> => {
    if (block.type !== 'p') {
      return false;
    }
    return (
      !/^source:/i.test(block.text) &&
      !/^(Skill Proficiencies|Tool Proficiencies|Languages|Equipment)\s*:/i.test(block.text)
    );
  });

  const aliases = uniqueStrings(
    [...(page.aliases ?? []), ...variantAliases]
      .map((alias) => collapseWhitespace(alias))
      .filter(Boolean)
  );
  const name = aliases[0] ?? collapseWhitespace(page.page_title);

  const detailWithoutTags: Omit<BackgroundStructuredData, 'tags'> = {
    id: page.slug,
    slug: page.slug,
    name,
    aliases,
    categories: uniqueStrings((page.categories ?? []).map((category) => collapseWhitespace(category))),
    source: 'wikidot-local-export',
    grants: {
      skills: skillGrants.fixed,
      tools: toolGrants.fixed,
      languages: languageGrants.fixed,
      skillChoices: skillGrants.choice,
      toolChoices: toolGrants.choice,
      languageChoices: languageGrants.choice
    },
    equipment,
    feature,
    structuredSections: (() => {
      const output = [...seedSections];
      collectStructuredSections(sections, output);
      return output;
    })(),
    documentBlocks
  };
  const summary = extractFirstSentence(summaryParagraph?.text ?? '');
  if (summary) {
    detailWithoutTags.summary = summary;
  }
  if (Object.keys(personality).length > 0) {
    detailWithoutTags.personality = personality;
  }

  return {
    ...detailWithoutTags,
    tags: createStructuredTags(detailWithoutTags)
  };
};
