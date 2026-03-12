export type BuilderSectionId =
  | 'basics'
  | 'origin'
  | 'ability_scores'
  | 'proficiencies'
  | 'features'
  | 'spells'
  | 'equipment'
  | 'asi_feats'
  | 'review';

export type DecisionKind =
  | 'chooseClass'
  | 'chooseSubclass'
  | 'chooseRace'
  | 'chooseBackground'
  | 'chooseBackgroundLanguages'
  | 'chooseBackgroundTools'
  | 'choosePointBuy'
  | 'chooseClassSkills'
  | 'chooseFeatureOption'
  | 'chooseSpellCantrips'
  | 'chooseKnownSpells'
  | 'choosePreparedSpells'
  | 'chooseEquipmentPackage'
  | 'chooseAsiOrFeat'
  | 'chooseFeat'
  | 'chooseFeatBonusAbility'
  | 'chooseGrantedLanguage'
  | 'setCharacterIdentity'
  | 'setClassLevel';

export type DecisionOption = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  tags?: string[];
  payload?: Record<string, unknown>;
};

export type CharacterDecisionCard = {
  id: string;
  kind: DecisionKind;
  section: BuilderSectionId;
  title: string;
  description?: string;
  source: string;
  required: boolean;
  minSelections?: number;
  maxSelections?: number;
  selectedOptionIds?: string[];
  options: DecisionOption[];
  status: 'pending' | 'complete' | 'invalid' | 'needs_review';
  invalidReason?: string;
};

export const builderSectionOrder: BuilderSectionId[] = [
  'basics',
  'origin',
  'ability_scores',
  'proficiencies',
  'features',
  'spells',
  'equipment',
  'asi_feats',
  'review'
];

export const BUILDER_SECTION_LABELS: Record<BuilderSectionId, string> = {
  basics: 'Basics',
  origin: 'Origin',
  ability_scores: 'Ability Scores',
  proficiencies: 'Proficiencies',
  features: 'Features',
  spells: 'Spells',
  equipment: 'Equipment',
  asi_feats: 'ASI / Feats',
  review: 'Review'
};

