import { backgroundsLookup } from '../generated/backgroundsLookup';
import { getBackgroundDetail, getBackgroundMeta } from '../../rules/backgrounds/api/backgroundsData';
import type { BackgroundStructuredData } from '../../rules/backgrounds/model';
import {
  foldBackgroundText,
  slugifyBackgroundValue
} from '../../rules/backgrounds/parse/normalizeNames';

export type BuilderBackgroundSummary = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  categories: string[];
  summary: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languagesGranted: string[];
  skillChoices: number;
  skillChoiceOptions: string[];
  toolChoices: number;
  toolChoiceOptions: string[];
  languageChoices: number;
  languageChoiceOptions: string[];
  featureName: string | null;
  defaultEquipment: string[];
  detailUrl: string;
};

export type BuilderBackgroundGrantedData = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  categories: string[];
  skills: string[];
  tools: string[];
  languages: string[];
  skillChoices: BackgroundStructuredData['grants']['skillChoices'];
  toolChoices: BackgroundStructuredData['grants']['toolChoices'];
  languageChoices: BackgroundStructuredData['grants']['languageChoices'];
  equipment: BackgroundStructuredData['equipment'];
  equipmentChoices: Array<{
    id: string;
    title: string;
    choose: number;
    source: 'background';
    options: Array<{
      id: string;
      label: string;
      items: Array<{
        id: string;
        name: string;
        quantity: number;
        source: string;
      }>;
    }>;
  }>;
  feature: BackgroundStructuredData['feature'];
  structuredSections: BackgroundStructuredData['structuredSections'];
  personality: BackgroundStructuredData['personality'];
};

const summaryById = new Map(
  Object.values(backgroundsLookup.byId).map((entry) => [
    entry.id,
    {
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      aliases: [...entry.aliases],
      categories: [...entry.categories],
      summary: entry.summary,
      skillProficiencies: [...entry.grants.skills],
      toolProficiencies: [...entry.grants.tools],
      languagesGranted: [...entry.grants.languages],
      skillChoices: entry.grants.skillChoices?.choose ?? 0,
      skillChoiceOptions: [...(entry.grants.skillChoices?.from ?? [])],
      toolChoices: entry.grants.toolChoices?.choose ?? 0,
      toolChoiceOptions: [...(entry.grants.toolChoices?.from ?? [])],
      languageChoices: entry.grants.languageChoices?.choose ?? 0,
      languageChoiceOptions: [...(entry.grants.languageChoices?.from ?? [])],
      featureName: entry.featureName,
      defaultEquipment: [...entry.equipmentSummary],
      detailUrl: entry.detailUrl
    } satisfies BuilderBackgroundSummary
  ])
);

const normalizeAlias = (value: string): string => foldBackgroundText(value);

const toEquipmentItems = (
  backgroundId: string,
  options: BackgroundStructuredData['equipment']['choiceGroups'][number]['options'],
  optionIndex: number
) => {
  return options.map((option) => ({
    id: `${backgroundId}-choice-item-${optionIndex}-${slugifyBackgroundValue(option.name)}`,
    name: option.name,
    quantity: option.quantity ?? 1,
    source: 'background_starting_equipment_choice'
  }));
};

const toEquipmentChoices = (
  background: BackgroundStructuredData
): BuilderBackgroundGrantedData['equipmentChoices'] => {
  return background.equipment.choiceGroups.map((group, groupIndex) => ({
    id: `background:${background.id}:equipment:${groupIndex}`,
    title: group.label ?? `Choose background equipment (${groupIndex + 1})`,
    choose: group.choose,
    source: 'background',
    options: group.options.map((option, optionIndex) => ({
      id: `background:${background.id}:equipment:${groupIndex}:option:${optionIndex}`,
      label: option.name,
      items: toEquipmentItems(background.id, [option], optionIndex)
    }))
  }));
};

export const backgroundRulesFacade = {
  listPlayableBackgrounds(): BuilderBackgroundSummary[] {
    return [...summaryById.values()].sort((left, right) => left.name.localeCompare(right.name));
  },

  getBackgroundById(id: string): BuilderBackgroundSummary | null {
    return summaryById.get(id) ?? null;
  },

  getBackgroundByAlias(alias: string): BuilderBackgroundSummary | null {
    const aliasId =
      backgroundsLookup.aliasToId[normalizeAlias(alias)] ??
      backgroundsLookup.aliasToId[normalizeAlias(alias).replace(/\s+variant$/, '')];
    return aliasId ? this.getBackgroundById(aliasId) : null;
  },

  async getBackgroundGrantedData(id: string): Promise<BuilderBackgroundGrantedData | null> {
    const meta = getBackgroundMeta(id);
    if (!meta) {
      return null;
    }

    const detail = await getBackgroundDetail(meta.id);
    if (!detail) {
      return null;
    }

    return {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      aliases: [...detail.aliases],
      categories: [...detail.categories],
      skills: [...detail.grants.skills],
      tools: [...detail.grants.tools],
      languages: [...detail.grants.languages],
      skillChoices: detail.grants.skillChoices ?? null,
      toolChoices: detail.grants.toolChoices ?? null,
      languageChoices: detail.grants.languageChoices ?? null,
      equipment: detail.equipment,
      equipmentChoices: toEquipmentChoices(detail),
      feature: detail.feature,
      structuredSections: detail.structuredSections,
      personality: detail.personality
    };
  }
};
